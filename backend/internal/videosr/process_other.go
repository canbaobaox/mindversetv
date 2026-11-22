//go:build !windows

package videosr

import "os/exec"

// configureCommand 是非 Windows 下的子进程配置：无特殊处理。
// 照抄 depthcapture/process_other.go。
func configureCommand(_ *exec.Cmd) {}
