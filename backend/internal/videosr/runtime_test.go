package videosr

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/depthruntime"
)

// verifyPackageSHA 是测试用的小工具：算一个文件的 sha256。
func verifyPackageSHA(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	sum := sha256.New()
	if _, err := io.Copy(sum, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(sum.Sum(nil)), nil
}

// buildTestPackage 造一个最小 VSR 组件 zip：Python 解释器 + resources/backend/main.py。
func buildTestPackage(t *testing.T, goos string) ([]byte, string) {
	t.Helper()
	buf := new(bytes.Buffer)
	writer := zip.NewWriter(buf)
	pythonPath := "Python/python.exe"
	if goos != "windows" {
		pythonPath = "bin/python3"
	}
	for _, name := range []string{pythonPath, "resources/backend/main.py", "resources/backend/tools/args_handler.py"} {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte("# test package\n")); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(buf.Bytes())
	return buf.Bytes(), hex.EncodeToString(sum[:])
}

func servePackage(t *testing.T, payload []byte) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(payload)
	}))
}

func TestEnsureDownloadsAndInstalls(t *testing.T) {
	payload, sum := buildTestPackage(t, "linux")
	server := servePackage(t, payload)
	defer server.Close()
	dataDir := t.TempDir()
	artifact := Artifact{
		URLs:   []string{server.URL + "/vsr-cpu-1.4.0.zip"},
		Size:   int64(len(payload)),
		SHA256: sum,
	}
	installation, err := Ensure(context.Background(), dataDir, "linux", artifact, nil, nil)
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if !strings.HasSuffix(installation.Python, filepath.Join("bin", "python3")) {
		t.Fatalf("python path %q", installation.Python)
	}
	if _, err := os.Stat(filepath.Join(installation.ToolDir, "resources", "backend", "main.py")); err != nil {
		t.Fatalf("main.py missing: %v", err)
	}
	if !Installed(dataDir, "linux", nil) {
		t.Fatal("Installed must be true after Ensure")
	}
	// 第二次 Ensure 不再下载：把服务停掉也能成功。
	server.Close()
	if _, err := Ensure(context.Background(), dataDir, "linux", artifact, nil, nil); err != nil {
		t.Fatalf("second Ensure must skip download: %v", err)
	}
}

func TestEnsureFailsClosedWhenUnpublished(t *testing.T) {
	unpublished := Artifact{
		URLs:   []string{"https://example.invalid/vsr-cpu-1.4.0.zip"},
		Size:   0,
		SHA256: "",
	}
	_, err := Ensure(context.Background(), t.TempDir(), "windows", unpublished, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "尚未发布") {
		t.Fatalf("got err %v, want ErrNotPublished", err)
	}
}

func TestDefaultArtifactIsPublished(t *testing.T) {
	artifact := ResolveArtifact(nil)
	if len(artifact.URLs) != 1 || artifact.URLs[0] != "https://github.com/canbaobaox/mindversetv/releases/download/vsr-cpu-1.4.0/vsr-cpu-1.4.0.zip" {
		t.Fatalf("urls %v", artifact.URLs)
	}
	if artifact.Size != 1570656403 {
		t.Fatalf("size %d, want 1570656403", artifact.Size)
	}
	if artifact.SHA256 != "f1d7fb425cd1395ea35c2ab3115da1dbe7af1bef745f8e675e13d9ae40a4ca46" {
		t.Fatalf("sha256 %q", artifact.SHA256)
	}
}

func TestEnsureRejectsBadHash(t *testing.T) {
	payload, _ := buildTestPackage(t, "linux")
	server := servePackage(t, payload)
	defer server.Close()
	artifact := Artifact{
		URLs:   []string{server.URL + "/vsr-cpu-1.4.0.zip"},
		Size:   int64(len(payload)),
		SHA256: strings.Repeat("0", 64),
	}
	_, err := Ensure(context.Background(), t.TempDir(), "linux", artifact, nil, nil)
	if err == nil {
		t.Fatal("wrong sha256 must fail")
	}
}

func TestEnsureRejectsTraversal(t *testing.T) {
	buf := new(bytes.Buffer)
	writer := zip.NewWriter(buf)
	entry, err := writer.Create("../evil.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = entry.Write([]byte("evil"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	payload := buf.Bytes()
	sum := sha256.Sum256(payload)
	server := servePackage(t, payload)
	defer server.Close()
	artifact := Artifact{
		URLs:   []string{server.URL + "/x.zip"},
		Size:   int64(len(payload)),
		SHA256: hex.EncodeToString(sum[:]),
	}
	_, err = Ensure(context.Background(), t.TempDir(), "linux", artifact, nil, nil)
	if err == nil {
		t.Fatal("traversal entry must fail")
	}
}

func TestResolveArtifactEnvOverride(t *testing.T) {
	getenv := func(key string) string {
		switch key {
		case packageURLEnv:
			return "https://example.invalid/vsr.zip"
		case packageSHAEnv:
			return strings.Repeat("a", 64)
		case packageSizeEnv:
			return "12345"
		}
		return ""
	}
	artifact := ResolveArtifact(getenv)
	if len(artifact.URLs) != 1 || artifact.URLs[0] != "https://example.invalid/vsr.zip" {
		t.Fatalf("urls %v", artifact.URLs)
	}
	if artifact.SHA256 != strings.Repeat("a", 64) || artifact.Size != 12345 {
		t.Fatalf("sha/size %+v", artifact)
	}
}

func TestDepthruntimeDownloadReuse(t *testing.T) {
	// depthruntime.Download 是 videosr 默认下载器：冒烟验证它接受我们的 Artifact。
	payload, sum := buildTestPackage(t, "linux")
	server := servePackage(t, payload)
	defer server.Close()
	target := filepath.Join(t.TempDir(), "pkg.zip")
	artifact := depthruntime.Artifact{
		URLs:   []string{server.URL + "/pkg.zip"},
		Size:   int64(len(payload)),
		SHA256: sum,
	}
	if err := depthruntime.Download(context.Background(), artifact, target, nil); err != nil {
		t.Fatalf("depthruntime.Download: %v", err)
	}
	got, err := verifyPackageSHA(target)
	if err != nil || got != sum {
		t.Fatalf("sha got %q err %v want %q", got, err, sum)
	}
}
