package task

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
	"infinite-canvas/backend/internal/videosr"
)

// VideoEraseVSRDeps 是 VSR 本地擦除执行器需要的宿主能力：素材读写（Media）、
// 任务进度/失败写回、完成持久化（Repo）、结果交付与错误日志。宿主（app 层）在
// WorkerExecuteDeps 里组装，执行逻辑本身不依赖 app 包。
type VideoEraseVSRDeps struct {
	DataDir  string
	Media    videosr.Media
	Repo     *repository.Repository
	Progress func(task *model.Task, stage string, percent int) error
	FailTask func(task *model.Task, stage, message string) error
	Deliver  func(task model.Task) error
	LogError func(userID, taskID, message, detail string)
}

// VideoEraseVSRRunner 返回 WorkerExecuteDeps.RunVideoEraseVSR 可用的执行函数：
// 每次调用新建一个 videosr.Service（只存依赖、无重状态），跑完即走。
func VideoEraseVSRRunner(deps VideoEraseVSRDeps) func(*model.Task, context.Context) error {
	svc := videosr.New(videosr.Deps{
		DataDir: deps.DataDir,
		Media:   deps.Media,
		Tasks:   vsrHostTasks{deps: deps},
	})
	return func(task *model.Task, ctx context.Context) error {
		return svc.Process(ctx, task)
	}
}

// vsrHostTasks 把宿主回调翻译成 videosr.Tasks：进度直通，失败与成功走
// task 包共用的本地媒体收尾（FailLocalMediaTask / CompleteLocalMediaTask）。
type vsrHostTasks struct {
	deps VideoEraseVSRDeps
}

func (t vsrHostTasks) Progress(task *model.Task, stage string, percent int) error {
	if t.deps.Progress == nil {
		return nil
	}
	return t.deps.Progress(task, stage, percent)
}

func (t vsrHostTasks) Fail(task *model.Task, stage, message string) error {
	if t.deps.FailTask == nil {
		return nil
	}
	prepareLocalMediaFailure(task, stage, message)
	return t.deps.FailTask(task, stage, message)
}

func (t vsrHostTasks) Complete(task *model.Task, result videosr.Result) error {
	if t.deps.Repo == nil {
		return errors.New("视频擦除完成持久化未配置")
	}
	payload, _ := json.Marshal(result)
	save := func(task *model.Task) error {
		return t.deps.Repo.SaveTaskCompletion(task, model.TaskStatusRunning, nil)
	}
	if err := CompleteLocalMediaTask(save, t.deps.Deliver, t.deps.LogError, task, string(payload), "视频擦除成功但结果交付失败"); err != nil {
		return fmt.Errorf("写入视频擦除完成态失败: %w", err)
	}
	return nil
}
