package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"infinite-canvas/backend/internal/depthcapture"
	"infinite-canvas/backend/internal/model"
	localtask "infinite-canvas/backend/internal/task"
)

// Set only when building a signed Windows depth release. An empty value keeps
// the Windows feature closed instead of trusting an unsigned remote manifest.
// ldflags must remain on this package: internal/app.depthWindowsManifestPublicKeyBase64.
var depthWindowsManifestPublicKeyBase64 string

func (s *Service) depthCaptureRuntime() *depthcapture.Service {
	if s == nil {
		return depthcapture.New(depthcapture.Deps{})
	}
	s.depthCaptureOnce.Do(func() {
		s.depthCapture = depthcapture.New(depthcapture.Deps{
			DataDir:                        s.dataDir,
			Media:                          depthMedia{svc: s},
			Tasks:                          depthTasks{w: s.taskWorker()},
			WindowsManifestPublicKeyBase64: depthWindowsManifestPublicKeyBase64,
		})
	})
	return s.depthCapture
}

func (s *Service) DepthComponents() *depthcapture.Service { return s.depthCaptureRuntime() }

func (w *taskWorkerCoordinator) processDepthCapture(task *model.Task, ctx context.Context) error {
	if w == nil || w.service == nil {
		return depthcapture.ErrBadInput
	}
	return w.service.depthCaptureRuntime().Process(ctx, task)
}

type depthMedia struct {
	svc *Service
}

func (m depthMedia) Open(userID, resourceID string) (*model.Resource, io.ReadCloser, error) {
	if m.svc == nil {
		return nil, nil, depthcapture.ErrMissingVideo
	}
	return m.svc.OpenResource(userID, resourceID)
}

func (m depthMedia) SaveVideo(userID, fileName string, size int64, width, height int, durationMs int64, body io.ReadSeeker, sourceKey string) (*model.Resource, error) {
	if m.svc == nil {
		return nil, depthcapture.ErrMissingVideo
	}
	return m.svc.UploadLocalResourceFile(userID, fileName, size, "video", width, height, durationMs, body, sourceKey)
}

type depthTasks struct {
	w *taskWorkerCoordinator
}

func (t depthTasks) Progress(task *model.Task, stage string, percent int) error {
	if t.w == nil {
		return nil
	}
	return t.w.progress(task, stage, percent)
}

func (t depthTasks) Fail(task *model.Task, stage, message string) error {
	if t.w == nil {
		return nil
	}
	return localtask.FailLocalMediaTask(t.w.service.repo, t.w.service.logInfo, task, stage, message)
}

func (t depthTasks) Complete(task *model.Task, result depthcapture.Result) error {
	if t.w == nil || t.w.service == nil || t.w.service.repo == nil {
		return nil
	}
	payload, _ := json.Marshal(result)
	svc := t.w.service
	if err := localtask.CompleteLocalMediaTask(func(task *model.Task) error {
		return svc.repo.SaveTaskCompletion(task, model.TaskStatusRunning, nil)
	}, svc.DeliverSucceededTask, func(userID, taskID, message, detail string) {
		_ = svc.log(userID, taskID, "error", message, detail)
	}, task, string(payload), "深度处理成功但结果交付失败"); err != nil {
		return fmt.Errorf("写入深度处理完成态失败: %w", err)
	}
	return nil
}
