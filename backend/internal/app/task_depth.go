package app

import (
	"infinite-canvas/backend/internal/model"
	localtask "infinite-canvas/backend/internal/task"
)

type DepthCaptureCreateRequest = localtask.DepthCaptureCreateRequest

func (s *Service) CreateDepthCaptureTask(userID string, req DepthCaptureCreateRequest) (*model.Task, error) {
	return s.taskDomain().CreateDepthCaptureTask(userID, req)
}

// CreateVideoEraseVSRTask 与深度捕捉同属本地媒体任务，创建入口并在 task_depth.go
// 一起委托给任务域，避免为一个 4 行委托再单开文件。
func (s *Service) CreateVideoEraseVSRTask(userID string, req localtask.VideoEraseVSRCreateRequest) (*model.Task, error) {
	return s.taskDomain().CreateVideoEraseVSRTask(userID, req)
}
