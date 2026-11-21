package plugins

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"infinite-canvas/backend/internal/canvas/capability"
	"infinite-canvas/backend/internal/protocol"
)

func TestNewerVersionOnlyComparesPlainNumbers(t *testing.T) {
	for _, tc := range []struct {
		latest, current string
		want            bool
	}{
		{"1.0.10", "1.0.9", true},
		{"0.2.0", "0.1.9", true},
		{"1.0.0", "1.0.0", false},
		{"1.0.0", "1.0.1", false},
		{"v2.0.0", "1.9.9", true},
		{"1.1.0-beta.1", "1.0.0", true},
		{"latest", "1.0.0", false},
		{"", "1.0.0", false},
	} {
		if got := newerVersion(tc.latest, tc.current); got != tc.want {
			t.Errorf("newerVersion(%q, %q) = %v, want %v", tc.latest, tc.current, got, tc.want)
		}
	}
}

// npmFixture 用本地服务冒充 npm：/<包名>/latest 返回 latest 里登记的版本。
func npmFixture(t *testing.T, latest map[string]string) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/"), "/latest")
		version, ok := latest[name]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"name": name, "version": version, "description": name + " 的说明",
			"author": map[string]string{"name": "社区作者"}, "repository": map[string]string{"url": "git+https://github.com/example/" + name + ".git"},
			"beeftv": map[string]string{"name": "显示名 " + name},
		})
	}))
	prevLoopback, prevRegistries := allowLoopbackMarketURLsForTest, npmRegistriesForTest
	allowLoopbackMarketURLsForTest, npmRegistriesForTest = true, []string{server.URL}
	t.Cleanup(func() {
		server.Close()
		allowLoopbackMarketURLsForTest, npmRegistriesForTest = prevLoopback, prevRegistries
		npmSummaryCache.Lock()
		npmSummaryCache.items = map[string]npmSummaryEntry{}
		npmSummaryCache.Unlock()
		setCuratedRegistryForTest("")
	})
}

func setCuratedRegistryForTest(raw string) {
	curatedRegistryMemCache.Lock()
	defer curatedRegistryMemCache.Unlock()
	if raw == "" {
		curatedRegistryMemCache.raw, curatedRegistryMemCache.fetchedAt, curatedRegistryMemCache.pinnedTest = nil, time.Time{}, false
		return
	}
	curatedRegistryMemCache.raw, curatedRegistryMemCache.fetchedAt, curatedRegistryMemCache.pinnedTest = []byte(raw), time.Now(), true
}

// installNamedForTest 按 npm 包名安装，假安装器把包名对到本地目录。
func installNamedForTest(t *testing.T, svc *Service, dirs map[string]string, name, version string) {
	t.Helper()
	dir := t.TempDir()
	writePluginFolder(t, dir, map[string]string{
		"package.json":    `{"name":"` + name + `","version":"` + version + `","beeftv":{"client":"./client/index.js"}}`,
		"client/index.js": "export function activate() {}\n",
	})
	dirs[name] = dir
	if _, err := svc.InstallPackage(name, ""); err != nil {
		t.Fatalf("install %s: %v", name, err)
	}
}

func TestCheckUpdatesListsOnlyPluginsWithANewerVersion(t *testing.T) {
	npmFixture(t, map[string]string{"beeftv-plugin-behind": "0.2.0", "beeftv-plugin-current": "1.0.0"})
	rt, err := NewRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(rt, nil)
	dirs := map[string]string{}
	svc.SetPackageFetcher(func(ctx context.Context, spec, registry, prefixDir string) (string, error) {
		if dir, ok := dirs[spec]; ok {
			spec = dir
		}
		return copyPackageFetcher(ctx, spec, registry, prefixDir)
	})
	installNamedForTest(t, svc, dirs, "beeftv-plugin-behind", "0.1.0")
	installNamedForTest(t, svc, dirs, "beeftv-plugin-current", "1.0.0")
	installNamedForTest(t, svc, dirs, "beeftv-plugin-pinned", "1.0.0")
	installNamedForTest(t, svc, dirs, "beeftv-plugin-unpublished", "0.1.0")
	folder := t.TempDir()
	writePluginFolder(t, folder, map[string]string{
		"package.json":    `{"name":"beeftv-plugin-folder","version":"0.0.1","beeftv":{"client":"./client/index.js"}}`,
		"client/index.js": "export function activate() {}\n",
	})
	if _, err := svc.InstallPackage(folder, ""); err != nil {
		t.Fatal(err)
	}
	setCuratedRegistryForTest(`{"plugins":[{"id":"beeftv-plugin-pinned","packageName":"beeftv-plugin-pinned","version":"1.1.0",
		"tarball":"https://github.com/example/releases/pinned-1.1.0.tgz","sha256":"` + strings.Repeat("a", 64) + `"}]}`)

	got := svc.CheckUpdates(context.Background(), "")
	want := []UpdateNotice{
		{ID: "beeftv-plugin-behind", Version: "0.1.0", Latest: "0.2.0"},
		{ID: "beeftv-plugin-pinned", Version: "1.0.0", Latest: "1.1.0", Official: true},
	}
	if len(got.Updates) != len(want) || got.Updates[0] != want[0] || got.Updates[1] != want[1] {
		t.Fatalf("updates = %+v", got.Updates)
	}
	// 文件夹装的和 npm 上查不到的插件没法比较，两份名单都不进，界面照旧给「更新」按钮。
	if strings.Join(got.UpToDate, ",") != "beeftv-plugin-current" {
		t.Fatalf("up to date = %v", got.UpToDate)
	}
}

func TestOneLineRegistryEntriesAreFilledFromNpm(t *testing.T) {
	npmFixture(t, map[string]string{"beeftv-plugin-community": "0.3.0"})
	setCuratedRegistryForTest(`{"plugins":[],"packages":["beeftv-plugin-community","beeftv-plugin-missing",""]}`)
	cachePath := filepath.Join(t.TempDir(), "cache.json")
	items := loadCuratedRegistryItemsWithCache(context.Background(), "", NpmMirrorRegistry, cachePath, map[string]View{})
	if len(items) != 1 {
		t.Fatalf("items = %+v", items)
	}
	item := items[0]
	if item.ID != "beeftv-plugin-community" || item.Name != "显示名 beeftv-plugin-community" || item.Version != "0.3.0" ||
		item.Author != "社区作者" || item.Repository != "https://github.com/example/beeftv-plugin-community" || !item.Recommended || item.SHA256 != "" {
		t.Fatalf("item = %+v", item)
	}
	if hits := loadCuratedRegistryItemsWithCache(context.Background(), "nothing-matches", NpmMirrorRegistry, cachePath, map[string]View{}); len(hits) != 0 {
		t.Fatalf("query hits = %+v", hits)
	}
}

func TestCuratedMarketReturnsLocalEntriesBeforePackageMetadataRefresh(t *testing.T) {
	npmFixture(t, map[string]string{"beeftv-plugin-community": "0.3.0"})
	setCuratedRegistryForTest(`{"plugins":[{"id":"cached-plugin","name":"Cached plugin","version":"1.0.0","recommended":true}],"packages":["beeftv-plugin-community"]}`)
	var svc *Service
	cached := svc.CuratedMarket(context.Background(), NpmMirrorRegistry, true)
	if len(cached) != 1 || cached[0].ID != "cached-plugin" {
		t.Fatalf("local recommendations = %+v", cached)
	}
	refreshed := svc.CuratedMarket(context.Background(), NpmMirrorRegistry, false)
	if len(refreshed) != 2 || refreshed[1].ID != "beeftv-plugin-community" {
		t.Fatalf("refreshed recommendations = %+v", refreshed)
	}
}

func TestVersionedInstallUpdatesToLatestByHandOnly(t *testing.T) {
	npmFixture(t, map[string]string{"beeftv-plugin-held": "0.2.0"})
	rt, err := NewRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(rt, nil)
	folder := func(version string) string {
		dir := t.TempDir()
		writePluginFolder(t, dir, map[string]string{
			"package.json":    `{"name":"beeftv-plugin-held","version":"` + version + `","beeftv":{"client":"./client/index.js"}}`,
			"client/index.js": "export function activate() {}\n",
		})
		return dir
	}
	dirs := map[string]string{"beeftv-plugin-held@0.1.0": folder("0.1.0"), "beeftv-plugin-held": folder("0.2.0")}
	svc.SetPackageFetcher(func(ctx context.Context, spec, registry, prefixDir string) (string, error) {
		return copyPackageFetcher(ctx, dirs[spec], registry, prefixDir)
	})
	if _, err := svc.InstallPackage("beeftv-plugin-held@0.1.0", ""); err != nil {
		t.Fatal(err)
	}

	// 精选列表有新版本时只提示，不算自动更新。
	setCuratedRegistryForTest(`{"plugins":[{"id":"beeftv-plugin-held","packageName":"beeftv-plugin-held","version":"0.2.0",
		"tarball":"https://github.com/example/releases/held-0.2.0.tgz","sha256":"` + strings.Repeat("a", 64) + `"}]}`)
	got := svc.CheckUpdates(context.Background(), "")
	if len(got.Updates) != 1 || got.Updates[0].Latest != "0.2.0" || got.Updates[0].Official {
		t.Fatalf("updates = %+v", got.Updates)
	}

	setCuratedRegistryForTest(`{"plugins":[]}`)
	updated, err := svc.UpdatePackage("beeftv-plugin-held", "")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Manifest.Version != "0.2.0" || updated.PackageSpec != "beeftv-plugin-held" {
		t.Fatalf("updated = %s from %q", updated.Manifest.Version, updated.PackageSpec)
	}
}

func TestCuratedBuiltinPluginHotUpdatesAndPersistsAcrossRestart(t *testing.T) {
	tgzBytes, tgzSHA := buildTarballBytesForTest(t, map[string]string{
		"package.json": `{
			"name": "beeftv-plugin-market",
			"version": "9.9.0",
			"description": "hot updated example",
			"beeftv": {
				"name": "Hot Example",
				"client": "./client/index.js",
				"permissions": ["generation.run", "media.read", "ui.slot", "settings.write"],
				"configuration": { "fields": [{ "name": "apiKey", "type": "secret", "label": "Key", "required": true }] },
				"contributes": {
					"providers": [{
						"id": "hot-future-video",
						"label": "Hot Future Video",
						"capabilities": ["video"],
						"scopes": ["user.custom-channel", "canvas"],
						"baseUrl": "https://hot.example.test",
						"auth": { "type": "bearer", "field": "apiKey" },
						"create": { "method": "POST", "path": "/future/tasks", "originPath": true, "contentType": "application/json", "body": { "model": { "$ref": "request.model" } } },
						"poll": { "method": "GET", "path": "/future/tasks/{{taskId}}", "originPath": true },
						"response": { "taskId": { "$ref": "response.id" }, "status": { "$ref": "response.status" }, "videos": { "$ref": "response.url" } }
					}]
				}
			}
		}`,
		"client/index.js": "export function activate() {}\n",
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/beeftv-plugin-market-9.9.0.tgz" {
			w.Header().Set("Content-Type", "application/gzip")
			_, _ = w.Write(tgzBytes)
			return
		}
		http.NotFound(w, r)
	}))
	prevLoopback := allowLoopbackMarketURLsForTest
	allowLoopbackMarketURLsForTest = true
	t.Cleanup(func() {
		server.Close()
		allowLoopbackMarketURLsForTest = prevLoopback
		setCuratedRegistryForTest("")
		capability.BuiltinRegistry().ResetPluginDescriptors()
	})

	dataDir := t.TempDir()
	rt, err := NewRuntime(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	svc := New(rt, nil)

	// 未经官方校验目录的本地目录覆盖必须继续被拒绝。
	forgedDir := t.TempDir()
	writePluginFolder(t, forgedDir, map[string]string{
		"package.json":    `{"name":"beeftv-plugin-market","version":"9.9.9","beeftv":{"client":"./client/index.js"}}`,
		"client/index.js": "export function activate() {}\n",
	})
	if _, err := svc.InstallPackage(forgedDir, ""); err == nil {
		t.Fatal("expected unverified local folder overwrite of builtin plugin to be rejected")
	}

	registryJSON, _ := json.Marshal(map[string]any{
		"plugins": []map[string]any{},
		"builtins": []map[string]any{{
			"id":          "beeftv-plugin-market",
			"packageName": "beeftv-plugin-market",
			"version":     "9.9.0",
			"tarball":     server.URL + "/beeftv-plugin-market-9.9.0.tgz",
			"sha256":      tgzSHA,
		}},
	})
	setCuratedRegistryForTest(string(registryJSON))

	check := svc.CheckUpdates(context.Background(), "")
	if len(check.Updates) != 1 || check.Updates[0].ID != "beeftv-plugin-market" || check.Updates[0].Latest != "9.9.0" || !check.Updates[0].Official {
		t.Fatalf("expected official hot update notice for beeftv-plugin-market, got %+v", check.Updates)
	}

	updated, err := svc.UpdatePackage("beeftv-plugin-market", "")
	if err != nil {
		t.Fatalf("UpdatePackage(beeftv-plugin-market) failed: %v", err)
	}
	if updated.Manifest.Version != "9.9.0" || updated.Source != OriginOfficial {
		t.Fatalf("unexpected updated builtin view: version=%q source=%q", updated.Manifest.Version, updated.Source)
	}
	if _, ok := svc.Registry().Resolve("hot-future-video"); !ok {
		t.Fatal("expected newly hot-updated provider hot-future-video to be live immediately")
	}

	// 重启后继续保留高于随包版本的热更新副本，不被旧随包目录倒退覆盖。
	rtRestarted, err := NewRuntime(dataDir)
	if err != nil {
		t.Fatalf("restart NewRuntime failed: %v", err)
	}
	svcRestarted := New(rtRestarted, nil)
	restartedView, ok := ByID(svcRestarted.List(), "beeftv-plugin-market")
	if !ok || restartedView.Manifest.Version != "9.9.0" || restartedView.Source != OriginOfficial {
		t.Fatalf("expected hot-updated version 9.9.0 to survive restart, got %+v", restartedView)
	}
	if _, ok := svcRestarted.Registry().Resolve("hot-future-video"); !ok {
		t.Fatal("expected hot-updated provider to remain registered after restart")
	}

	// 内容寻址目录默认只读保护：未改权限前直接写入必须失败。
	if !strings.Contains(restartedView.PackageDir, ".builtin-blobs") {
		t.Fatalf("expected content-addressed .builtin-blobs dir, got %q", restartedView.PackageDir)
	}
	clientJSPath := filepath.Join(restartedView.PackageDir, "client", "index.js")
	if info, statErr := os.Stat(clientJSPath); statErr != nil || info.Mode()&0o222 != 0 {
		t.Fatalf("expected read-only client/index.js, statErr=%v mode=%v", statErr, info)
	}

	// 运行期强行改权限并篡改文件时，ResolvePackageFile 立即拒绝下发并自动回退至随包版本。
	hotRev := restartedView.Manifest.Revision
	if revPath, _, revErr := svcRestarted.ResolvePackageFile("beeftv-plugin-market", "/@rev-"+hotRev+"/client/index.js"); revErr != nil || !strings.HasSuffix(revPath, "index.js") {
		t.Fatalf("expected @rev- prefixed file resolution to succeed before tamper, path=%q err=%v", revPath, revErr)
	}
	_ = os.Chmod(filepath.Dir(clientJSPath), 0o755)
	_ = os.Chmod(clientJSPath, 0o644)
	if err := os.WriteFile(clientJSPath, []byte("// tampered at runtime\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, resolveErr := svcRestarted.ResolvePackageFile("beeftv-plugin-market", "/@rev-"+hotRev+"/client/index.js"); resolveErr == nil {
		t.Fatal("expected ResolvePackageFile to reject tampered hot-update file")
	}
	// 前端随后针对已失效旧 revision 上报的 load-error 不会把已回退的随包安全版标为 invalid。
	afterStaleErr, staleErr := svcRestarted.SetLoadErrorAtRevision("beeftv-plugin-market", "Failed to fetch dynamically imported module", "import", hotRev)
	if staleErr != nil || afterStaleErr.Status != StatusEnabled || afterStaleErr.Error != "" {
		t.Fatalf("expected stale-revision SetLoadError after tamper rollback to keep shipped plugin enabled, got %+v err=%v", afterStaleErr, staleErr)
	}
	rolledBackLive, ok := ByID(svcRestarted.List(), "beeftv-plugin-market")
	if !ok || rolledBackLive.Manifest.Version == "9.9.0" || rolledBackLive.Status != StatusEnabled {
		t.Fatalf("expected runtime tamper to auto-rollback to shipped version, got %+v", rolledBackLive)
	}
	if _, ok := svcRestarted.Registry().Resolve("hot-future-video"); ok {
		t.Fatal("expected rolled-back runtime to unregister hot-updated provider")
	}
	if cleanPath, _, cleanErr := svcRestarted.ResolvePackageFile("beeftv-plugin-market", "client/index.js"); cleanErr != nil || strings.Contains(cleanPath, ".builtin-blobs") {
		t.Fatalf("expected subsequent ResolvePackageFile to serve shipped file, path=%q err=%v", cleanPath, cleanErr)
	}
}

func TestHotUpdatedBuiltinRollsBackOnLoadErrorAndRejectsSpoofedOrigin(t *testing.T) {
	tgzBytes, tgzSHA := buildTarballBytesForTest(t, map[string]string{
		"package.json": `{
			"name": "beeftv-plugin-market",
			"version": "9.9.1",
			"description": "hot updated example with bad client",
			"beeftv": {
				"name": "Hot Example",
				"client": "./client/index.js",
				"permissions": ["generation.run", "media.read", "ui.slot", "settings.write"],
				"configuration": { "fields": [{ "name": "apiKey", "type": "secret", "label": "Key", "required": true }] },
				"contributes": {
					"providers": [{
						"id": "hot-broken-client-video",
						"label": "Hot Broken Client Video",
						"capabilities": ["video"],
						"scopes": ["user.custom-channel", "canvas"],
						"baseUrl": "https://hot.example.test",
						"auth": { "type": "bearer", "field": "apiKey" },
						"create": { "method": "POST", "path": "/future/tasks", "originPath": true, "contentType": "application/json", "body": { "model": { "$ref": "request.model" } } },
						"poll": { "method": "GET", "path": "/future/tasks/{{taskId}}", "originPath": true },
						"response": { "taskId": { "$ref": "response.id" }, "status": { "$ref": "response.status" }, "videos": { "$ref": "response.url" } }
					}]
				}
			}
		}`,
		"client/index.js": "throw new Error('broken client bundle');\n",
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/beeftv-plugin-market-9.9.1.tgz" {
			w.Header().Set("Content-Type", "application/gzip")
			_, _ = w.Write(tgzBytes)
			return
		}
		http.NotFound(w, r)
	}))
	prevLoopback := allowLoopbackMarketURLsForTest
	allowLoopbackMarketURLsForTest = true
	t.Cleanup(func() {
		server.Close()
		allowLoopbackMarketURLsForTest = prevLoopback
		setCuratedRegistryForTest("")
		capability.BuiltinRegistry().ResetPluginDescriptors()
	})

	registryJSON, _ := json.Marshal(map[string]any{
		"plugins": []map[string]any{},
		"builtins": []map[string]any{{
			"id":          "beeftv-plugin-market",
			"packageName": "beeftv-plugin-market",
			"version":     "9.9.1",
			"tarball":     server.URL + "/beeftv-plugin-market-9.9.1.tgz",
			"sha256":      tgzSHA,
		}},
	})
	setCuratedRegistryForTest(string(registryJSON))

	dataDir := t.TempDir()
	rt, err := NewRuntime(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	svc := New(rt, nil)
	hotUpdatedView, err := svc.UpdatePackage("beeftv-plugin-market", "")
	if err != nil {
		t.Fatalf("UpdatePackage failed: %v", err)
	}

	// 1. 不带 revision 的 SetLoadError 不允许绕过校验回滚热更新内置插件；携带匹配 revision 时立即回退到随包版本。
	ignoredNoRev, err := svc.SetLoadError("beeftv-plugin-market", "unverified caller error")
	if err != nil || ignoredNoRev.Manifest.Version != "9.9.1" || ignoredNoRev.Status != StatusEnabled {
		t.Fatalf("expected SetLoadError without revision to leave hot-updated builtin untouched, got %+v err=%v", ignoredNoRev, err)
	}
	recovered, err := svc.SetLoadErrorAtRevision("beeftv-plugin-market", "SyntaxError: broken client bundle", "import", hotUpdatedView.Manifest.Revision)
	if err != nil {
		t.Fatalf("SetLoadError failed: %v", err)
	}
	if recovered.Manifest.Version == "9.9.1" || recovered.Status != StatusEnabled || recovered.Error != "" {
		t.Fatalf("expected SetLoadError on hot-updated builtin to auto-rollback cleanly, got %+v", recovered)
	}
	if _, ok := svc.Registry().Resolve("hot-broken-client-video"); ok {
		t.Fatal("expected hot-updated provider to be unregistered after rollback to the shipped manifest")
	}

	// 2. 若磁盘/数据库残留了带 LoadError 的热更新记录或 OriginPackage 伪造记录，重启时全部拒绝并回退到随包官方版。
	// 随包内置插件只剩插件市场，两类残留写在同一条市场记录上验证。
	if _, err := svc.UpdatePackage("beeftv-plugin-market", ""); err != nil {
		t.Fatalf("re-UpdatePackage failed: %v", err)
	}
	spoofedDir := filepath.Join(dataDir, "plugins", "beeftv-plugin-market")
	writePluginFolder(t, spoofedDir, map[string]string{
		"package.json":    `{"name":"beeftv-plugin-market","version":"9.9.9","beeftv":{"name":"Spoofed Market","client":"./client/index.js"}}`,
		"client/index.js": "export function activate() {}\n",
	})
	spoofedPkg, err := protocol.ParsePluginPackageDir(spoofedDir)
	if err != nil {
		t.Fatal(err)
	}
	records, err := rt.currentRecords()
	if err != nil {
		t.Fatal(err)
	}
	for i := range records {
		if records[i].ID == "beeftv-plugin-market" {
			records[i].LoadError = "persisted import timeout"
			records[i].Source = OriginPackage
			records[i].Raw = spoofedPkg.ManifestRaw
			records[i].PackageDir = spoofedPkg.RootDir
			records[i].PackageSpec = "beeftv-plugin-market"
			records[i].PackageSHA256 = spoofedPkg.SHA256
		}
	}
	registryData, err := json.Marshal(records)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "plugin_registry.json"), registryData, 0o600); err != nil {
		t.Fatal(err)
	}

	rtBoot, err := NewRuntime(dataDir)
	if err != nil {
		t.Fatalf("NewRuntime after persisted LoadError & spoofed OriginPackage failed: %v", err)
	}
	svcBoot := New(rtBoot, nil)
	marketBoot, ok := ByID(svcBoot.List(), "beeftv-plugin-market")
	if !ok || marketBoot.Manifest.Version == "9.9.1" || marketBoot.Manifest.Version == "9.9.9" || marketBoot.Status != StatusEnabled || marketBoot.Error != "" || marketBoot.Source != OriginOfficial {
		t.Fatalf("expected persisted LoadError & spoofed OriginPackage record to fall back cleanly to the shipped market on boot, got %+v", marketBoot)
	}
}

func buildTarballBytesForTest(t *testing.T, files map[string]string) ([]byte, string) {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for name, content := range files {
		hdr := &tar.Header{
			Name: "package/" + name,
			Mode: 0o644,
			Size: int64(len(content)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	raw := buf.Bytes()
	sum := sha256.Sum256(raw)
	return raw, hex.EncodeToString(sum[:])
}
