package videosr

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// runCommand 跑一次 VSR 子进程：python resources/backend/main.py <args...>。
// stdout 逐行回调（tqdm 进度行与 FinishedProcessing 行都在 stdout）；
// stderr 只在失败时取尾部当原因。形态照抄 depthcapture.runCommand。
func runCommand(ctx context.Context, python string, args []string, onLine func(string), configure func(*exec.Cmd)) error {
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return err
		}
	}
	command := exec.CommandContext(ctx, python, args...)
	if configure != nil {
		configure(command)
	} else {
		configureCommand(command)
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return fmt.Errorf("无法启动 VSR 组件: %w", err)
	}
	var stderr bytes.Buffer
	command.Stderr = &stderr
	if err := command.Start(); err != nil {
		return fmt.Errorf("无法启动 VSR 组件: %w", err)
	}
	scanner := bufio.NewScanner(stdout)
	// tqdm 单行可能很长（整行进度条），默认 64KB 扫描上限不够，放宽到 1MB。
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if onLine != nil {
			onLine(line)
		}
	}
	scanErr := scanner.Err()
	runErr := command.Wait()
	if scanErr != nil && runErr == nil {
		return scanErr
	}
	if runErr != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = runErr.Error()
		}
		var exit *exec.ExitError
		if errors.As(runErr, &exit) {
			return fmt.Errorf("VSR 处理失败（退出码 %d）: %s", exit.ExitCode(), lastLines(message, 3))
		}
		return errors.New(message)
	}
	return nil
}

// lastLines 取多行文本的最后 n 行（VSR 的报错常堆在 stderr 尾部）。
func lastLines(text string, n int) string {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) <= n {
		return strings.TrimSpace(text)
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}
