package depthcapture

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"infinite-canvas/backend/internal/depthruntime"
	"infinite-canvas/backend/internal/model"
)

func TestComponentManifestMirrorsRespectExplicitOverride(t *testing.T) {
	for _, platform := range []string{"darwin-arm64", "windows-amd64"} {
		for _, override := range []string{"", "https://custom.invalid/manifest"} {
			svc := New(Deps{DataDir: t.TempDir(), WindowsManifestPublicKeyBase64: base64.StdEncoding.EncodeToString(make([]byte, 32)), Getenv: func(key string) string {
				if key == manifestEnv {
					return override
				}
				return ""
			}})
			options, err := svc.componentOptions(platform, "cpu")
			if err != nil {
				t.Fatal(err)
			}
			if override != "" {
				if options.ManifestURL != override || len(options.ManifestMirrors) != 0 {
					t.Fatalf("override leaked mirrors: %+v", options)
				}
				continue
			}
			name := "depth-runtime-manifest.json"
			if platform == "windows-amd64" {
				name = "depth-runtime-manifest.v2.json"
				if options.ManifestURL != mindverseDepthReleaseBase+name || len(options.ManifestMirrors) != 0 {
					t.Fatalf("default windows sources: %+v", options)
				}
				continue
			}
			if options.ManifestURL != componentCOSBase+name || !reflect.DeepEqual(options.ManifestMirrors, []string{componentR2Base + name, componentGHBase + name}) {
				t.Fatalf("default sources: %+v", options)
			}
			if platform == "darwin-arm64" && (options.FallbackManifest == nil || !strings.HasPrefix(options.FallbackManifest.Runtime.URLs[0], componentCOSBase) || !strings.HasPrefix(options.FallbackManifest.Model.URLs[0], componentCOSBase)) {
				t.Fatalf("fallback domestic order: %+v", options.FallbackManifest)
			}
		}
	}
}

func TestCaptureDoesNotDownloadMissingComponents(t *testing.T) {
	var hits atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); http.Error(w, "must not fetch", 500) }))
	defer server.Close()
	tasks := &fakeTasks{}
	svc := New(Deps{GOOS: "darwin", GOARCH: "arm64", DataDir: t.TempDir(), Media: &fakeMedia{resource: testVideo(), body: []byte("mp4")}, Tasks: tasks, Getenv: func(key string) string {
		if key == manifestEnv {
			return server.URL
		}
		return ""
	}})
	if err := svc.Process(context.Background(), &model.Task{ID: "depth", UserID: "user-1", InputJSON: `{"resourceId":"res-1"}`}); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 0 || !strings.Contains(tasks.failMsg, "设置") {
		t.Fatalf("implicit download: hits=%d failure=%s", hits.Load(), tasks.failMsg)
	}
}

type cancellableInstaller struct {
	started chan struct{}
	hits    atomic.Int32
}

func (i *cancellableInstaller) Ensure(ctx context.Context, _ depthruntime.EnsureOptions) (depthruntime.Installation, error) {
	i.hits.Add(1)
	close(i.started)
	<-ctx.Done()
	return depthruntime.Installation{}, ctx.Err()
}

func TestExplicitComponentDownloadIsSingleAndPausesWithoutRestarting(t *testing.T) {
	installer := &cancellableInstaller{started: make(chan struct{})}
	svc := New(Deps{GOOS: "darwin", GOARCH: "arm64", DataDir: t.TempDir(), Installer: installer})
	// State represents a completed metadata-only check before user confirmation.
	svc.componentState = ComponentState{Status: "not_installed", Variant: "mps", DataDir: svc.dataDir, DownloadBytes: 100, RequiredBytes: 200, FreeBytes: 1000}
	if installer.hits.Load() != 0 {
		t.Fatal("status started download")
	}
	if _, err := svc.StartComponentDownload(context.Background()); err != nil {
		t.Fatal(err)
	}
	<-installer.started
	if _, err := svc.StartComponentDownload(context.Background()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := svc.PauseComponentDownload(ctx); err != nil {
		t.Fatal(err)
	}
	state, err := svc.ComponentStatus(ctx)
	if err != nil || state.Status != "paused" || installer.hits.Load() != 1 {
		t.Fatalf("state=%+v hits=%d err=%v", state, installer.hits.Load(), err)
	}
}

type committedInstaller struct{ started chan struct{} }

func (i committedInstaller) Ensure(ctx context.Context, _ depthruntime.EnsureOptions) (depthruntime.Installation, error) {
	close(i.started)
	<-ctx.Done()
	// Installation committed just before the cancellation was observed.
	return depthruntime.Installation{Python: "installed"}, nil
}

func TestCancellationDoesNotRelabelCommittedInstallation(t *testing.T) {
	installer := committedInstaller{started: make(chan struct{})}
	svc := New(Deps{GOOS: "darwin", GOARCH: "arm64", DataDir: t.TempDir(), Installer: installer})
	svc.componentState = ComponentState{Status: "not_installed", Variant: "mps", DataDir: svc.dataDir, DownloadBytes: 100, RequiredBytes: 200, FreeBytes: 1}
	state, err := svc.ComponentStatus(context.Background())
	if err != nil || state.FreeBytes <= 1 {
		t.Fatalf("space was not refreshed: %+v %v", state, err)
	}
	if _, err := svc.StartComponentDownload(context.Background()); err != nil {
		t.Fatal(err)
	}
	<-installer.started
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := svc.PauseComponentDownload(ctx); err != nil {
		t.Fatal(err)
	}
	state, err = svc.ComponentStatus(ctx)
	if err != nil || state.Status != "ready" || state.Error != "" {
		t.Fatalf("committed install misreported: %+v %v", state, err)
	}
}

func TestFailedConcurrentRefreshCannotEraseConfirmedDownloadPlan(t *testing.T) {
	installer := &cancellableInstaller{started: make(chan struct{})}
	var svc *Service
	var refresh atomic.Bool
	svc = New(Deps{GOOS: "darwin", GOARCH: "arm64", DataDir: t.TempDir(), Installer: installer, Getenv: func(key string) string {
		if key == manifestEnv && !refresh.Swap(true) {
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			_, _ = svc.ComponentStatus(ctx, true)
		}
		return ""
	}})
	svc.componentState = ComponentState{Status: "not_installed", Variant: "mps", DataDir: svc.dataDir, DownloadBytes: 100, RequiredBytes: 200, FreeBytes: 1000}
	state, err := svc.StartComponentDownload(context.Background())
	if err != nil || state.DataDir != svc.dataDir || state.DownloadBytes != 100 || state.Variant != "mps" {
		t.Fatalf("lost confirmed plan: %+v %v", state, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := svc.PauseComponentDownload(ctx); err != nil {
		t.Fatal(err)
	}
}

type cudaOnlyInstaller struct{ t *testing.T }

func (i cudaOnlyInstaller) Ensure(_ context.Context, options depthruntime.EnsureOptions) (depthruntime.Installation, error) {
	if !options.Offline {
		i.t.Fatal("capture attempted an implicit download")
	}
	if options.Variant == "cpu" {
		return depthruntime.Installation{}, depthruntime.ErrNotInstalled
	}
	return depthruntime.Installation{Python: "python", ToolDir: "worker", ModelRuntime: "model"}, nil
}

func TestCUDAFallbackRequestsCPUConsentWithoutDownloading(t *testing.T) {
	tasks := &fakeTasks{}
	svc := New(Deps{GOOS: "windows", GOARCH: "amd64", DataDir: t.TempDir(), Media: &fakeMedia{resource: testVideo(), body: []byte("video")}, Tasks: tasks, Installer: cudaOnlyInstaller{t}, WindowsManifestPublicKeyBase64: base64.StdEncoding.EncodeToString(make([]byte, 32)), NVIDIA: func(context.Context) bool { return true }, ProbeCUDA: func(context.Context, string, string, string) error { return ErrCUDADevice }})
	svc.componentState = ComponentState{Status: "ready", Variant: "cuda"}
	if err := svc.Process(context.Background(), &model.Task{ID: "cuda-fallback", UserID: "user-1", InputJSON: `{"resourceId":"res-1"}`}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(tasks.failMsg, "CPU") || !svc.componentFallbackCPU || svc.componentState.Status != "" {
		t.Fatalf("CPU fallback lacks actionable consent: %s %+v", tasks.failMsg, svc.componentState)
	}
}

func cpuOnlySignedManifest(t *testing.T, private ed25519.PrivateKey) []byte {
	t.Helper()
	cpu := depthruntime.Artifact{URLs: []string{"https://example.test/cpu.zip"}, Size: 100, SHA256: strings.Repeat("a", 64), Files: 1, ExpandedSize: 200}
	model := depthruntime.Artifact{URLs: []string{"https://example.test/model.pth"}, Size: 100, SHA256: strings.Repeat("c", 64)}
	payload, err := json.Marshal(depthruntime.Manifest{Version: 2, Runtimes: map[string]depthruntime.Artifact{"windows-amd64/cpu": cpu}, Model: model})
	if err != nil {
		t.Fatal(err)
	}
	envelope, err := json.Marshal(map[string]string{
		"payload":   base64.StdEncoding.EncodeToString(payload),
		"signature": base64.StdEncoding.EncodeToString(ed25519.Sign(private, payload)),
	})
	if err != nil {
		t.Fatal(err)
	}
	return envelope
}

func TestComponentStatusFallsBackToCPUWhenManifestIsCPUOnly(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	envelope := cpuOnlySignedManifest(t, private)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(envelope)
	}))
	defer server.Close()
	svc := New(Deps{GOOS: "windows", GOARCH: "amd64", DataDir: t.TempDir(), WindowsManifestPublicKeyBase64: base64.StdEncoding.EncodeToString(public), NVIDIA: func(context.Context) bool { return true }, Getenv: func(key string) string {
		if key == manifestEnv {
			return server.URL
		}
		return ""
	}})
	state, err := svc.ComponentStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if state.Variant != "cpu" || state.DownloadBytes != 200 {
		t.Fatalf("CPU fallback plan: %+v", state)
	}
}

func TestReleasePageURLForManualDownload(t *testing.T) {
	cases := map[string]string{
		"https://github.com/canbaobaox/mindversetv/releases/download/depth-runtime-v2/depth-runtime-manifest.v2.json":     "https://github.com/canbaobaox/mindversetv/releases/tag/depth-runtime-v2",
		"https://github.com/glanderness/BeefTV/releases/download/v1.5.5/beeftv-depth-runtime-v1-darwin-arm64.zip":         "https://github.com/glanderness/BeefTV/releases/tag/v1.5.5",
		"https://beeftv-components-1481187348.cos.ap-guangzhou.myqcloud.com/depth-runtime-v2/depth-runtime-manifest.json": "",
		"https://updates.beefapi.com/beeftv/components/depth-runtime-v2/depth-runtime-manifest.json":                      "",
		"https://github.com/canbaobaox/mindversetv/releases/tag/depth-runtime-v2":                                         "",
		"https://github.com/canbaobaox/mindversetv":                                                                       "",
		"": "",
	}
	for manifestURL, want := range cases {
		if got := releasePageURL(manifestURL); got != want {
			t.Errorf("releasePageURL(%q) = %q, want %q", manifestURL, got, want)
		}
	}
}

func TestComponentStatusExposesManualDownloadPlacement(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	envelope := cpuOnlySignedManifest(t, private)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(envelope)
	}))
	defer server.Close()
	dataDir := t.TempDir()
	svc := New(Deps{GOOS: "windows", GOARCH: "amd64", DataDir: dataDir, WindowsManifestPublicKeyBase64: base64.StdEncoding.EncodeToString(public), NVIDIA: func(context.Context) bool { return true }, Getenv: func(key string) string {
		if key == manifestEnv {
			return server.URL
		}
		return ""
	}})
	state, err := svc.ComponentStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	// The test manifest is not hosted on a GitHub Release page, so there is
	// no manual-download link, but the placement paths must still come from
	// the same layout Ensure verifies.
	if state.ManualDownloadURL != "" {
		t.Fatalf("unexpected manual URL for a non-GitHub manifest: %q", state.ManualDownloadURL)
	}
	if !strings.HasSuffix(state.RuntimeArchivePath, "downloads\\depth-runtime-v1-windows-amd64-cpu.zip") && !strings.HasSuffix(state.RuntimeArchivePath, "downloads/depth-runtime-v1-windows-amd64-cpu.zip") {
		t.Fatalf("runtime archive path: %q", state.RuntimeArchivePath)
	}
	if !strings.HasSuffix(state.ModelPath, "models/video-depth-anything-small/v1/checkpoints/video_depth_anything_vits.pth") && !strings.HasSuffix(state.ModelPath, `models\video-depth-anything-small\v1\checkpoints\video_depth_anything_vits.pth`) {
		t.Fatalf("model path: %q", state.ModelPath)
	}
	if !strings.HasPrefix(state.RuntimeArchivePath, dataDir) || !strings.HasPrefix(state.ModelPath, dataDir) {
		t.Fatalf("placement paths must stay under the data dir: %+v", state)
	}
}

type cpuOnlyManifestInstaller struct{ t *testing.T }

func (i cpuOnlyManifestInstaller) Ensure(_ context.Context, options depthruntime.EnsureOptions) (depthruntime.Installation, error) {
	if !options.Offline {
		i.t.Fatal("capture attempted an implicit download")
	}
	if options.Variant == "cuda" {
		return depthruntime.Installation{}, depthruntime.ErrVariantUnavailable
	}
	return depthruntime.Installation{}, depthruntime.ErrNotInstalled
}

func TestCaptureFallsBackToCPUWhenManifestLacksCUDA(t *testing.T) {
	tasks := &fakeTasks{}
	svc := New(Deps{GOOS: "windows", GOARCH: "amd64", DataDir: t.TempDir(), Media: &fakeMedia{resource: testVideo(), body: []byte("video")}, Tasks: tasks, Installer: cpuOnlyManifestInstaller{t}, WindowsManifestPublicKeyBase64: base64.StdEncoding.EncodeToString(make([]byte, 32)), NVIDIA: func(context.Context) bool { return true }})
	svc.componentState = ComponentState{Status: "ready", Variant: "cuda"}
	if err := svc.Process(context.Background(), &model.Task{ID: "cpu-only-manifest", UserID: "user-1", InputJSON: `{"resourceId":"res-1"}`}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(tasks.failMsg, "CPU") || !svc.componentFallbackCPU || svc.componentState.Status != "" {
		t.Fatalf("CPU fallback lacks actionable consent: %s %+v", tasks.failMsg, svc.componentState)
	}
}
