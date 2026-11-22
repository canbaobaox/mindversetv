package videosr

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"infinite-canvas/backend/internal/mediatools"
	"infinite-canvas/backend/internal/model"
)

const (
	stageUnavailable = "暂不可用"
	stageComponent   = "检查 VSR 组件"
	stageFailed      = "处理失败"
	stageOutput      = "检查处理结果"
	stageSave        = "保存到素材库"
)

// Service owns VSR erase execution. Create-time quota and activity stay in the
// application composition layer (same split as depthcapture.Service).
type Service struct {
	probeOutput func(context.Context, string) (mediatools.MediaMetadata, error)
	dataDir     string
	media       Media
	tasks       Tasks
	goos        string
	goarch      string
	getenv      func(string) string
	stat        func(name string) error
	mkdirTemp   func(dir, pattern string) (string, error)
	configure   func(*exec.Cmd)
	run         CommandRun
	download    DownloadFunc
}

func New(deps Deps) *Service {
	goos := deps.GOOS
	if goos == "" {
		goos = runtime.GOOS
	}
	goarch := deps.GOARCH
	if goarch == "" {
		goarch = runtime.GOARCH
	}
	getenv := deps.Getenv
	if getenv == nil {
		getenv = os.Getenv
	}
	stat := deps.Stat
	if stat == nil {
		stat = func(name string) error {
			_, err := os.Stat(name)
			return err
		}
	}
	mkdirTemp := deps.MkdirTemp
	if mkdirTemp == nil {
		mkdirTemp = os.MkdirTemp
	}
	configure := deps.Configure
	if configure == nil {
		configure = configureCommand
	}
	run := deps.Run
	if run == nil {
		run = func(ctx context.Context, python, mainPy string, args []string, onLine func(string)) error {
			return runCommand(ctx, python, append([]string{mainPy}, args...), onLine, configure)
		}
	}
	s := &Service{
		probeOutput: deps.ProbeOutput,
		dataDir:     deps.DataDir,
		media:       deps.Media,
		tasks:       deps.Tasks,
		goos:        goos,
		goarch:      goarch,
		getenv:      getenv,
		stat:        stat,
		mkdirTemp:   mkdirTemp,
		configure:   configure,
		run:         run,
		download:    deps.Download,
	}
	if s.probeOutput == nil {
		s.probeOutput = mediatools.ProbeLocal
	}
	return s
}

// PrepareInput validates the resource is a video and marshals the durable task input.
func PrepareInput(resourceID string, resource *model.Resource, eraseType EraseType, inpaintMode string, region *Region) ([]byte, error) {
	resourceID = strings.TrimSpace(resourceID)
	if resourceID == "" {
		return nil, ErrNeedVideo
	}
	if resource == nil {
		return nil, ErrMissingVideo
	}
	if !strings.HasPrefix(resource.MimeType, "video/") {
		return nil, ErrNotVideo
	}
	if eraseType != EraseTypeSubtitle && eraseType != EraseTypeWatermark {
		eraseType = EraseTypeSubtitle
	}
	if inpaintMode != InpaintModeSTTNAuto && inpaintMode != InpaintModeLama {
		inpaintMode = InpaintModeSTTNAuto
	}
	return json.Marshal(Input{
		ResourceID:  resourceID,
		EraseType:   eraseType,
		InpaintMode: inpaintMode,
		Region:      region,
	})
}

// ParseInput decodes the durable task input.
func ParseInput(raw string) (Input, error) {
	var input Input
	if err := json.Unmarshal([]byte(raw), &input); err != nil || strings.TrimSpace(input.ResourceID) == "" {
		return Input{}, ErrBadInput
	}
	input.ResourceID = strings.TrimSpace(input.ResourceID)
	if input.EraseType != EraseTypeSubtitle && input.EraseType != EraseTypeWatermark {
		input.EraseType = EraseTypeSubtitle
	}
	if input.InpaintMode != InpaintModeSTTNAuto && input.InpaintMode != InpaintModeLama {
		input.InpaintMode = InpaintModeSTTNAuto
	}
	return input, nil
}

func (s *Service) progress(task *model.Task, stage string, percent int) error {
	if s.tasks == nil {
		return nil
	}
	return s.tasks.Progress(task, stage, percent)
}

func (s *Service) fail(task *model.Task, stage, message string) error {
	if s.tasks == nil {
		return nil
	}
	return s.tasks.Fail(task, stage, message)
}

func (s *Service) failUnlessCanceled(ctx context.Context, task *model.Task, stage, message string) error {
	if ctx != nil && ctx.Err() != nil {
		return ctx.Err()
	}
	return s.fail(task, stage, message)
}

func (s *Service) resolveRuntime(ctx context.Context, task *model.Task) (python, toolDir string, err error) {
	python = strings.TrimSpace(s.getenv(pythonEnv))
	toolDir = strings.TrimSpace(s.getenv(toolDirEnv))
	if python != "" && toolDir != "" {
		if s.stat(python) == nil {
			return python, toolDir, nil
		}
	}
	artifact := ResolveArtifact(s.getenv)
	installation, ensureErr := Ensure(ctx, s.dataDir, s.goos, artifact, s.download, func(stage string, percent int) {
		switch stage {
		case "downloading":
			_ = s.progress(task, "正在下载 VSR 组件", percent)
		case "extracting":
			_ = s.progress(task, "正在解压 VSR 组件", 0)
		}
	})
	if ensureErr != nil {
		return "", "", ensureErr
	}
	return installation.Python, installation.ToolDir, nil
}

func eraseLabel(eraseType EraseType) string {
	if eraseType == EraseTypeWatermark {
		return "去水印"
	}
	return "去字幕"
}

// Process runs one VSR erase task end to end.
func (s *Service) Process(ctx context.Context, task *model.Task) error {
	if task == nil {
		return ErrBadInput
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if s.goos != "windows" {
		return s.failUnlessCanceled(ctx, task, stageUnavailable, ErrUnsupported.Error())
	}
	input, err := ParseInput(task.InputJSON)
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, err.Error())
	}
	if s.media == nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, ErrMissingVideo.Error())
	}
	resource, reader, err := s.media.Open(task.UserID, input.ResourceID)
	if err != nil || resource == nil || reader == nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, ErrMissingVideo.Error())
	}
	defer reader.Close()
	if !strings.HasPrefix(resource.MimeType, "video/") {
		return s.failUnlessCanceled(ctx, task, stageFailed, ErrNotVideo.Error())
	}
	label := eraseLabel(input.EraseType)
	started := time.Now()
	python, toolDir, err := s.resolveRuntime(ctx, task)
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageComponent, err.Error())
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := s.progress(task, "准备视频", 8); err != nil {
		return err
	}
	workDir, err := s.mkdirTemp("", "beeftv-vsr-*")
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, "无法创建临时工作目录")
	}
	defer os.RemoveAll(workDir)
	inputPath := filepath.Join(workDir, "input.mp4")
	inputFile, err := os.OpenFile(inputPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, "无法准备输入视频")
	}
	_, copyErr := io.Copy(inputFile, reader)
	closeErr := inputFile.Close()
	if copyErr != nil || closeErr != nil {
		return s.failUnlessCanceled(ctx, task, stageFailed, "读取输入视频失败")
	}
	outputPath := filepath.Join(workDir, "output.mp4")
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := s.progress(task, "正在 AI "+label, 15); err != nil {
		return err
	}
	var coords [][4]int
	if input.Region != nil && resource.Width > 0 && resource.Height > 0 {
		coords = append(coords, RegionToCoords(*input.Region, resource.Width, resource.Height))
	}
	mainPy := filepath.Join(toolDir, "resources", "backend", "main.py")
	args := BuildArgs(inputPath, outputPath, input.InpaintMode, coords)
	stage := "正在 AI " + label
	runErr := s.run(ctx, python, mainPy, args, func(line string) {
		if percent, ok := ParseProgressLine(line); ok {
			// tqdm 15%..100% 映射到任务 15..90，留 10 给保存入库。
			mapped := 15 + percent*75/100
			_ = s.progress(task, stage, mapped)
			return
		}
		if _, ok := FinishedOutput(line); ok {
			_ = s.progress(task, stage, 90)
		}
	})
	if runErr != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return s.fail(task, stageFailed, runErr.Error())
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	info, statErr := os.Stat(outputPath)
	if statErr != nil {
		return s.failUnlessCanceled(ctx, task, stageOutput, ErrNoOutput.Error())
	}
	if info.Size() <= 0 {
		return s.failUnlessCanceled(ctx, task, stageOutput, ErrEmptyOutput.Error())
	}
	if err := s.progress(task, "保存到素材库", 92); err != nil {
		return err
	}
	facts, err := s.probeOutput(ctx, outputPath)
	if err != nil || !facts.HasVideo || facts.Width <= 0 || facts.Height <= 0 || facts.DurationMs <= 0 {
		return s.failUnlessCanceled(ctx, task, stageOutput, ErrProbeOutput.Error())
	}
	file, err := os.Open(outputPath)
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageOutput, ErrNoOutput.Error())
	}
	defer file.Close()
	stored, err := s.media.SaveVideo(task.UserID, OutputName, info.Size(), facts.Width, facts.Height, facts.DurationMs, file, "vsr:"+task.ID)
	if err != nil {
		return s.failUnlessCanceled(ctx, task, stageSave, err.Error())
	}
	result := Result{
		ResourceID:     stored.ID,
		FileName:       OutputName,
		Size:           stored.Size,
		DurationMs:     stored.DurationMs,
		Width:          stored.Width,
		Height:         stored.Height,
		FPS:            facts.FPS,
		Device:         "cpu",
		EraseType:      string(input.EraseType),
		InpaintMode:    input.InpaintMode,
		RuntimeVersion: "vsr-" + UpstreamVersion,
		ProcessingMs:   time.Since(started).Milliseconds(),
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if s.tasks == nil {
		return nil
	}
	return s.tasks.Complete(task, result)
}
