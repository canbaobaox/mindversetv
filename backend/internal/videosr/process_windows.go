//go:build windows

package videosr

import (
	"context"
	"os"
	"os/exec"
	"strconv"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

// configureCommand 是 Windows 下的子进程配置：不弹黑窗口，取消时整树杀掉。
// 照抄 depthcapture/process_windows.go。
func configureCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	command.WaitDelay = 5 * time.Second
	command.Cancel = func() error {
		if command.Process == nil {
			return os.ErrProcessDone
		}
		killCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		kill := exec.CommandContext(killCtx, "taskkill", "/T", "/F", "/PID", strconv.Itoa(command.Process.Pid))
		kill.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
		_ = kill.Run()
		return command.Process.Kill()
	}
}
