package videosr

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/mediatools"
	"infinite-canvas/backend/internal/model"
)

type fakeMedia struct {
	resource *model.Resource
	body     []byte
	saved    *model.Resource
}

func (m *fakeMedia) Open(userID, resourceID string) (*model.Resource, io.ReadCloser, error) {
	return m.resource, io.NopCloser(bytes.NewReader(m.body)), nil
}

func (m *fakeMedia) SaveVideo(userID, fileName string, size int64, width, height int, durationMs int64, body io.ReadSeeker, sourceKey string) (*model.Resource, error) {
	m.saved = &model.Resource{ID: "stored-resource", Size: size, Width: width, Height: height, DurationMs: durationMs}
	return m.saved, nil
}

type fakeTasks struct {
	progress []int
	stages   []string
	failed   string
	result   *Result
}

func (f *fakeTasks) Progress(task *model.Task, stage string, percent int) error {
	f.stages = append(f.stages, stage)
	f.progress = append(f.progress, percent)
	return nil
}

func (f *fakeTasks) Fail(task *model.Task, stage, message string) error {
	f.failed = stage + ": " + message
	return nil
}

func (f *fakeTasks) Complete(task *model.Task, result Result) error {
	f.result = &result
	return nil
}

// fakeRun imitates VSR: copies -i to -o and streams tqdm progress lines.
func fakeRun(t *testing.T) (CommandRun, *[][]string) {
	t.Helper()
	var seen *[][]string = new([][]string)
	run := func(ctx context.Context, python, mainPy string, args []string, onLine func(string)) error {
		*seen = append(*seen, append([]string{mainPy}, args...))
		var input, output string
		for i := 0; i+1 < len(args); i++ {
			if args[i] == "-i" {
				input = args[i+1]
			}
			if args[i] == "-o" {
				output = args[i+1]
			}
		}
		data, err := os.ReadFile(input)
		if err != nil {
			return err
		}
		if err := os.WriteFile(output, data, 0o600); err != nil {
			return err
		}
		onLine("Subtitle Removing:  45%|████| 450/1000 [00:12<00:15, 37.5frame/s]")
		onLine("Subtitle Removing: 100%|██████████| 1000/1000 [00:25<00:00, 40.0frame/s]")
		onLine("FinishedProcessing: " + output)
		return nil
	}
	return run, seen
}

func newTestService(t *testing.T, media *fakeMedia, tasks *fakeTasks, run CommandRun) *Service {
	t.Helper()
	toolDir := filepath.Join(t.TempDir(), "vsr")
	if err := os.MkdirAll(filepath.Join(toolDir, "resources", "backend"), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(toolDir, "resources", "backend", "main.py"), []byte("# fake\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	getenv := func(key string) string {
		switch key {
		case pythonEnv:
			return "/bin/true"
		case toolDirEnv:
			return toolDir
		}
		return ""
	}
	return New(Deps{
		DataDir: t.TempDir(),
		Media:   media,
		Tasks:   tasks,
		GOOS:    "windows",
		Getenv:  getenv,
		Run:     run,
		ProbeOutput: func(ctx context.Context, path string) (mediatools.MediaMetadata, error) {
			return mediatools.MediaMetadata{HasVideo: true, Width: 1920, Height: 1080, DurationMs: 10000, FPS: 30}, nil
		},
	})
}

func mustInputJSON(t *testing.T, input Input) string {
	t.Helper()
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestProcessAutoMode(t *testing.T) {
	media := &fakeMedia{
		resource: &model.Resource{ID: "res-1", MimeType: "video/mp4", Width: 1920, Height: 1080, DurationMs: 10000},
		body:     []byte("fake-video-bytes"),
	}
	tasks := &fakeTasks{}
	run, seen := fakeRun(t)
	svc := newTestService(t, media, tasks, run)
	task := &model.Task{ID: "task-1", UserID: "user-1", InputJSON: mustInputJSON(t, Input{ResourceID: "res-1", EraseType: EraseTypeSubtitle})}
	if err := svc.Process(context.Background(), task); err != nil {
		t.Fatalf("Process: %v", err)
	}
	if tasks.result == nil || tasks.result.ResourceID != "stored-resource" {
		t.Fatalf("result %+v", tasks.result)
	}
	if tasks.result.EraseType != "subtitle" || tasks.result.InpaintMode != "sttn-auto" {
		t.Fatalf("result meta %+v", tasks.result)
	}
	if len(*seen) != 1 {
		t.Fatalf("expected one run, got %d", len(*seen))
	}
	argv := (*seen)[0]
	for _, arg := range argv {
		if arg == "-c" {
			t.Fatalf("auto mode must not pass -c, argv %v", argv)
		}
	}
	if tasks.failed != "" {
		t.Fatalf("unexpected failure: %s", tasks.failed)
	}
	maxProgress := 0
	for _, p := range tasks.progress {
		if p > maxProgress {
			maxProgress = p
		}
	}
	if maxProgress < 90 {
		t.Fatalf("progress never reached 90: %v", tasks.progress)
	}
}

func TestProcessCustomRegionPassesCoords(t *testing.T) {
	media := &fakeMedia{
		resource: &model.Resource{ID: "res-1", MimeType: "video/mp4", Width: 1920, Height: 1080, DurationMs: 10000},
		body:     []byte("fake-video-bytes"),
	}
	tasks := &fakeTasks{}
	run, seen := fakeRun(t)
	svc := newTestService(t, media, tasks, run)
	region := Region{X: 0.08, Y: 0.76, Width: 0.84, Height: 0.18}
	task := &model.Task{ID: "task-2", UserID: "user-1", InputJSON: mustInputJSON(t, Input{
		ResourceID: "res-1", EraseType: EraseTypeWatermark, InpaintMode: "lama", Region: &region,
	})}
	if err := svc.Process(context.Background(), task); err != nil {
		t.Fatalf("Process: %v", err)
	}
	argv := (*seen)[0]
	want := []string{"-c", "820", "1016", "152", "1766"}
	joined := strings.Join(argv, " ")
	if !strings.Contains(joined, strings.Join(want, " ")) {
		t.Fatalf("argv %v must contain %v", argv, want)
	}
	if tasks.result == nil || tasks.result.EraseType != "watermark" || tasks.result.InpaintMode != "lama" {
		t.Fatalf("result %+v", tasks.result)
	}
}

func TestProcessRejectsNonVideo(t *testing.T) {
	media := &fakeMedia{
		resource: &model.Resource{ID: "res-1", MimeType: "image/png", Width: 1920, Height: 1080},
		body:     []byte("fake-image-bytes"),
	}
	tasks := &fakeTasks{}
	svc := newTestService(t, media, tasks, nil)
	task := &model.Task{ID: "task-3", UserID: "user-1", InputJSON: mustInputJSON(t, Input{ResourceID: "res-1", EraseType: EraseTypeSubtitle})}
	if err := svc.Process(context.Background(), task); err != nil {
		t.Fatalf("Process must report failure through Tasks, not return err: %v", err)
	}
	if !strings.Contains(tasks.failed, "仅支持视频") {
		t.Fatalf("failed %q must mention video-only", tasks.failed)
	}
}

func TestProcessFailsClosedWhenUnpublished(t *testing.T) {
	media := &fakeMedia{
		resource: &model.Resource{ID: "res-1", MimeType: "video/mp4", Width: 1920, Height: 1080, DurationMs: 10000},
		body:     []byte("fake-video-bytes"),
	}
	tasks := &fakeTasks{}
	svc := New(Deps{
		DataDir: t.TempDir(),
		Media:   media,
		Tasks:   tasks,
		GOOS:    "windows",
		Getenv:  func(string) string { return "" },
		Run:     nil,
		ProbeOutput: func(ctx context.Context, path string) (mediatools.MediaMetadata, error) {
			return mediatools.MediaMetadata{HasVideo: true, Width: 1920, Height: 1080, DurationMs: 10000, FPS: 30}, nil
		},
	})
	task := &model.Task{ID: "task-4", UserID: "user-1", InputJSON: mustInputJSON(t, Input{ResourceID: "res-1", EraseType: EraseTypeSubtitle})}
	if err := svc.Process(context.Background(), task); err != nil {
		t.Fatalf("Process must report failure through Tasks, not return err: %v", err)
	}
	if !strings.Contains(tasks.failed, "尚未发布") {
		t.Fatalf("failed %q must say the package is unpublished", tasks.failed)
	}
}

func TestPrepareAndParseInput(t *testing.T) {
	raw, err := PrepareInput("res-1", &model.Resource{MimeType: "video/mp4"}, EraseTypeWatermark, "propainter", nil)
	if err != nil {
		t.Fatal(err)
	}
	input, err := ParseInput(string(raw))
	if err != nil {
		t.Fatal(err)
	}
	if input.EraseType != EraseTypeWatermark {
		t.Fatalf("eraseType %q", input.EraseType)
	}
	// propainter 不是可用模式：归一化为 sttn-auto。
	if input.InpaintMode != "sttn-auto" {
		t.Fatalf("inpaintMode %q want sttn-auto", input.InpaintMode)
	}
	if _, err := PrepareInput("res-1", &model.Resource{MimeType: "image/png"}, EraseTypeSubtitle, "", nil); err != ErrNotVideo {
		t.Fatalf("got err %v want ErrNotVideo", err)
	}
	if _, err := ParseInput(`{"resourceId":""}`); err != ErrBadInput {
		t.Fatalf("got err %v want ErrBadInput", err)
	}
}
