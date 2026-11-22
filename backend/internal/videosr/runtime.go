package videosr

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"infinite-canvas/backend/internal/depthruntime"
)

// Artifact 是组件包的下载描述，直接复用 depthruntime.Artifact（URL、大小、
// sha256、分段），下载器也复用 depthruntime.Download（断点续传、哈希校验、
//
//	stall 检测）。VSR 不走 depthruntime.Ensure 的清单流程：清单验签需要一把只在
//
// 签名版构建时注入的 Ed25519 公钥，深度捕捉就是缺这把钥匙才在 Windows 上不可用；
// VSR 只有一个可信源（我们自己的 Release，HTTPS + 下面的 sha256 钉死），
// 不再引入签名清单。
type Artifact = depthruntime.Artifact

// defaultArtifact 是自打 CPU 便携包的钉死描述，由
// .github/workflows/build-vsr-cpu.yml 产出（tag vsr-cpu-v1.4.0）。
// Size 与 SHA256 在第一次打包落地后填入；填入之前 Ensure 直接报
// ErrNotPublished，不会去下一个不存在的地址下载。
var defaultArtifact = Artifact{
	URLs: []string{
		"https://github.com/canbaobaox/mindversetv/releases/download/vsr-cpu-v1.4.0/vsr-cpu-v1.4.0.zip",
	},
	Size:   0,
	SHA256: "",
}

const (
	packageURLEnv    = "BEEFTV_VSR_PACKAGE_URL"
	packageSHAEnv    = "BEEFTV_VSR_PACKAGE_SHA256"
	packageSizeEnv   = "BEEFTV_VSR_PACKAGE_SIZE"
	pythonEnv        = "BEEFTV_VSR_PYTHON"
	toolDirEnv       = "BEEFTV_VSR_TOOL_DIR"
	installationFile = ".installation.json"
)

// Installation 是已安装的 VSR 运行时：便携 Python 与 VSR 源码目录。
type Installation struct {
	Python  string
	ToolDir string
}

// RuntimePaths 是运行时在数据目录里的布局（与深度组件 runtimes/<name>/v1/... 同形态）。
type RuntimePaths struct {
	Root    string
	Python  string
	ToolDir string
	Archive string
}

func runtimePaths(dataDir, goos string) RuntimePaths {
	root := filepath.Join(dataDir, "runtimes", "vsr", "v1", "windows-amd64", "cpu")
	python := filepath.Join(root, "Python", "python.exe")
	if goos != "windows" {
		python = filepath.Join(root, "bin", "python3")
	}
	return RuntimePaths{
		Root:    root,
		Python:  python,
		ToolDir: root,
		Archive: filepath.Join(dataDir, "downloads", "vsr-cpu-v1.4.0.zip"),
	}
}

// ResolveArtifact 返回本次要用的组件包描述：环境变量可覆盖 URL/大小/sha256
// （开发与测试用）；未覆盖时用钉死的 defaultArtifact。
func ResolveArtifact(getenv func(string) string) Artifact {
	artifact := defaultArtifact
	if getenv == nil {
		return artifact
	}
	if url := strings.TrimSpace(getenv(packageURLEnv)); url != "" {
		artifact.URLs = []string{url}
	}
	if sha := strings.TrimSpace(getenv(packageSHAEnv)); sha != "" {
		artifact.SHA256 = sha
	}
	if size := strings.TrimSpace(getenv(packageSizeEnv)); size != "" {
		if parsed, err := strconv.ParseInt(size, 10, 64); err == nil && parsed > 0 {
			artifact.Size = parsed
		}
	}
	return artifact
}

func validArtifact(artifact Artifact) bool {
	return artifact.Size > 0 && len(strings.TrimSpace(artifact.SHA256)) == 64 && len(artifact.URLs) > 0
}

// Installed 检查运行时是否已装好：便携 Python + resources/backend/main.py + 回执齐全。
// QPT 打包布局（1.1.1 directml 包实测）：仓库根目录拷为 resources/，入口是
// resources/backend/main.py，不是包根的 backend/main.py。
func Installed(dataDir, goos string, stat func(string) error) bool {
	if stat == nil {
		stat = func(name string) error { _, err := os.Stat(name); return err }
	}
	paths := runtimePaths(dataDir, goos)
	if stat(paths.Python) != nil {
		return false
	}
	if stat(filepath.Join(paths.ToolDir, "resources", "backend", "main.py")) != nil {
		return false
	}
	return stat(filepath.Join(paths.Root, installationFile)) == nil
}

// Ensure 保证 VSR 运行时可用：已安装直接返回；否则下载组件包（带进度回调）、
// 校验、解压到数据目录。ctx 取消会中断下载与解压。
func Ensure(ctx context.Context, dataDir, goos string, artifact Artifact, download DownloadFunc, onProgress func(stage string, percent int)) (Installation, error) {
	if err := ctx.Err(); err != nil {
		return Installation{}, err
	}
	paths := runtimePaths(dataDir, goos)
	if Installed(dataDir, goos, nil) {
		return Installation{Python: paths.Python, ToolDir: paths.ToolDir}, nil
	}
	if !validArtifact(artifact) {
		return Installation{}, ErrNotPublished
	}
	if download == nil {
		download = depthruntime.Download
	}
	if err := os.MkdirAll(filepath.Dir(paths.Archive), 0o750); err != nil {
		return Installation{}, err
	}
	report := func(progress depthruntime.Progress) {
		if onProgress == nil || progress.Total <= 0 {
			return
		}
		percent := int(progress.Downloaded * 100 / progress.Total)
		if percent < 0 {
			percent = 0
		}
		if percent > 100 {
			percent = 100
		}
		onProgress("downloading", percent)
	}
	if err := download(ctx, artifact, paths.Archive, report); err != nil {
		return Installation{}, fmt.Errorf("下载 VSR 组件失败: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return Installation{}, err
	}
	if onProgress != nil {
		onProgress("extracting", 0)
	}
	if err := installArchive(ctx, paths, artifact); err != nil {
		return Installation{}, err
	}
	receipt, err := json.Marshal(Artifact{Size: artifact.Size, SHA256: artifact.SHA256})
	if err != nil {
		return Installation{}, err
	}
	if err := os.WriteFile(filepath.Join(paths.Root, installationFile), receipt, 0600); err != nil {
		return Installation{}, err
	}
	return Installation{Python: paths.Python, ToolDir: paths.ToolDir}, nil
}

// installArchive 把组件 zip 解到临时目录、校验内容完整后发布到运行时目录。
// 安全约束与 depthruntime.extractRuntimeArchiveContext 一致：禁越界路径、
// 禁符号链接、文件数与解压体积上限。
func installArchive(ctx context.Context, paths RuntimePaths, artifact Artifact) error {
	if err := os.MkdirAll(filepath.Dir(paths.Root), 0o750); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(filepath.Dir(paths.Root), ".vsr-runtime-stage-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	if err := extractArchive(ctx, paths.Archive, stage, artifact); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(stage, "Python", "python.exe")); err != nil {
		// 非 Windows 测试包用 bin/python3；生产包只认 Python/python.exe。
		if _, binErr := os.Stat(filepath.Join(stage, "bin", "python3")); binErr != nil {
			return errors.New("VSR 组件包缺少 Python 解释器")
		}
	}
	if _, err := os.Stat(filepath.Join(stage, "resources", "backend", "main.py")); err != nil {
		return errors.New("VSR 组件包缺少 resources/backend/main.py")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if _, err := os.Stat(paths.Root); errors.Is(err, os.ErrNotExist) {
		return os.Rename(stage, paths.Root)
	} else if err != nil {
		return err
	}
	backupDir, err := os.MkdirTemp(filepath.Dir(paths.Root), ".vsr-runtime-backup-*")
	if err != nil {
		return err
	}
	backup := filepath.Join(backupDir, "previous")
	if err := os.Rename(paths.Root, backup); err != nil {
		_ = os.Remove(backupDir)
		return fmt.Errorf("旧版 VSR 组件仍被占用，无法安全替换: %w", err)
	}
	if err := os.Rename(stage, paths.Root); err != nil {
		if restoreErr := os.Rename(backup, paths.Root); restoreErr != nil {
			return fmt.Errorf("发布 VSR 组件失败: %w；旧版保留在 %s，自动恢复失败: %v", err, backup, restoreErr)
		}
		_ = os.Remove(backupDir)
		return fmt.Errorf("发布 VSR 组件失败，旧版已恢复: %w", err)
	}
	_ = os.RemoveAll(backupDir)
	return nil
}

func extractArchive(ctx context.Context, archivePath, destination string, artifact Artifact) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("打开 VSR 组件压缩包失败: %w", err)
	}
	defer reader.Close()
	var declaredExpanded int64
	for _, entry := range reader.File {
		declaredExpanded += int64(entry.UncompressedSize64)
	}
	if len(reader.File) > 50_000 {
		return errors.New("VSR 组件压缩包文件数量超过安全上限")
	}
	maxExpanded := int64(12 << 30)
	if artifact.ExpandedSize > 0 && declaredExpanded != artifact.ExpandedSize {
		return fmt.Errorf("VSR 组件解压体积与发布清单不一致: got %d want %d", declaredExpanded, artifact.ExpandedSize)
	}
	if declaredExpanded > maxExpanded {
		return errors.New("VSR 组件解压体积超过安全上限")
	}
	var expanded int64
	for _, entry := range reader.File {
		if err := ctx.Err(); err != nil {
			return err
		}
		portableName := strings.ReplaceAll(entry.Name, `\`, "/")
		if strings.Contains(portableName, ":") || strings.HasPrefix(portableName, "/") {
			return errors.New("VSR 组件压缩包包含非安全路径")
		}
		clean := filepath.Clean(filepath.FromSlash(portableName))
		if clean == "." || filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
			return errors.New("VSR 组件压缩包包含越界路径")
		}
		if entry.Mode()&os.ModeSymlink != 0 {
			return errors.New("VSR 组件压缩包不允许符号链接")
		}
		expanded += int64(entry.UncompressedSize64)
		if expanded > maxExpanded {
			return errors.New("VSR 组件解压体积超过安全上限")
		}
		target := filepath.Join(destination, clean)
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
			return err
		}
		source, err := entry.Open()
		if err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
		if err != nil {
			source.Close()
			return err
		}
		_, copyErr := io.Copy(output, source)
		closeErr := output.Close()
		source.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if entry.Mode().Perm()&0o111 != 0 {
			if err := os.Chmod(target, 0o750); err != nil {
				return err
			}
		}
	}
	return nil
}
