package videosr

import (
	"context"
	"errors"
	"io"
	"os/exec"

	"infinite-canvas/backend/internal/depthruntime"
	"infinite-canvas/backend/internal/mediatools"
	"infinite-canvas/backend/internal/model"
)

const (
	// Prompt / Provider / ModelID 是任务列表里展示的本地任务身份，与深度捕捉同形态。
	Prompt       = "视频智能擦除"
	Provider     = "local"
	ModelID      = "video-subtitle-remover"
	InitialStage = "检查 VSR 组件"
	OutputName   = "video-no-subtitle.mp4"

	// VSR 上游版本：自打 CPU 便携包的源码版本（.github/workflows/build-vsr-cpu.yml）。
	UpstreamVersion = "1.4.0"

	// InpaintModeSTTNAuto 是默认模式：PaddleOCR 自动定位字幕后用 STTN 修复。
	InpaintModeSTTNAuto = "sttn-auto"
	// InpaintModeLama 用于动画/静图效果更好的场景。
	InpaintModeLama = "lama"
)

// EraseType 是去字幕 / 去水印两种本地任务。
type EraseType string

const (
	EraseTypeSubtitle  EraseType = "subtitle"
	EraseTypeWatermark EraseType = "watermark"
)

// Region 是相对坐标选框（0-1），与画布对话框的 SubtitleEraseRegion 同含义。
// 为空表示自动检测（不传 -c，全帧扫描）。
type Region struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Input 是任务输入的持久化形态（存在 task.InputJSON）。
type Input struct {
	ResourceID  string    `json:"resourceId"`
	EraseType   EraseType `json:"eraseType"`
	InpaintMode string    `json:"inpaintMode,omitempty"`
	Region      *Region   `json:"region,omitempty"`
}

// Result 是任务完成时写进 task.ResultJSON 的形态，与深度捕捉的 Result
// 字段对齐，前端按 resourceId 取回资源。
type Result struct {
	ResourceID     string  `json:"resourceId"`
	FileName       string  `json:"fileName"`
	Size           int64   `json:"size"`
	DurationMs     int64   `json:"durationMs"`
	Width          int     `json:"width"`
	Height         int     `json:"height"`
	FPS            float64 `json:"fps,omitempty"`
	Device         string  `json:"device,omitempty"`
	EraseType      string  `json:"eraseType,omitempty"`
	InpaintMode    string  `json:"inpaintMode,omitempty"`
	RuntimeVersion string  `json:"runtimeVersion,omitempty"`
	ProcessingMs   int64   `json:"processingMs,omitempty"`
}

// Media 是 Service 读写视频素材的端口（由 app 层注入，与 depthMedia 同形态）。
type Media interface {
	Open(userID, resourceID string) (*model.Resource, io.ReadCloser, error)
	SaveVideo(userID, fileName string, size int64, width, height int, durationMs int64, body io.ReadSeeker, sourceKey string) (*model.Resource, error)
}

// Tasks 是 Service 汇报任务进度/失败/完成的端口（由 app 层注入）。
type Tasks interface {
	Progress(task *model.Task, stage string, percent int) error
	Fail(task *model.Task, stage, message string) error
	Complete(task *model.Task, result Result) error
}

// CommandRun 是执行 VSR 子进程的可替换实现（默认 runCommand；测试可注入假实现）。
type CommandRun func(ctx context.Context, python, mainPy string, args []string, onLine func(string)) error

// DownloadFunc 是下载组件包的可替换实现（默认 depthruntime.Download；测试可注入）。
type DownloadFunc func(ctx context.Context, artifact depthruntime.Artifact, target string, report func(depthruntime.Progress)) error

// Deps 是 Service 的依赖（字段为空时用默认值，与 depthcapture.Deps 同形态）。
type Deps struct {
	ProbeOutput func(context.Context, string) (mediatools.MediaMetadata, error)
	DataDir     string
	Media       Media
	Tasks       Tasks
	GOOS        string
	GOARCH      string
	Getenv      func(key string) string
	Stat        func(name string) error
	MkdirTemp   func(dir, pattern string) (string, error)
	Configure   func(*exec.Cmd)
	Run         CommandRun
	Download    DownloadFunc
}

var (
	ErrBadInput     = errors.New("视频智能擦除任务参数无效")
	ErrNeedVideo    = errors.New("请选择视频素材")
	ErrMissingVideo = errors.New("视频素材不存在或未就绪")
	ErrNotVideo     = errors.New("视频智能擦除仅支持视频素材")
	ErrUnsupported  = errors.New("VSR 组件仅支持 Windows")
	// ErrNotPublished 表示自打 CPU 便携包尚未发布（见 build-vsr-cpu.yml）：
	// 集成代码已就绪，缺的是第一次 CI 打包产出的下载地址与哈希。
	ErrNotPublished = errors.New("VSR 组件包尚未发布，请等待新版安装包")
	ErrComponent    = errors.New("VSR 组件不可用")
	ErrNoOutput     = errors.New("VSR 没有生成结果视频")
	ErrEmptyOutput  = errors.New("VSR 生成的结果视频为空")
	ErrProbeOutput  = errors.New("无法读取 VSR 结果视频的实际尺寸和时长")
)
