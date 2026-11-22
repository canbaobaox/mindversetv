package videosr

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeScript(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fake-vsr.sh")
	if err := os.WriteFile(path, []byte(body), 0o750); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestRunCommandSuccessStreamsProgress(t *testing.T) {
	script := writeScript(t, "#!/bin/sh\necho 'Subtitle Removing:  45%|████| 450/1000 [00:12<00:15, 37.5frame/s]'\necho 'FinishedProcessing: /tmp/out.mp4'\n")
	var lines []string
	err := runCommand(context.Background(), "sh", []string{script, "-i", "in.mp4", "-o", "out.mp4"}, func(line string) {
		lines = append(lines, line)
	}, nil)
	if err != nil {
		t.Fatalf("runCommand: %v", err)
	}
	if len(lines) != 2 || !strings.Contains(lines[0], "45%") {
		t.Fatalf("lines %v", lines)
	}
	if _, ok := FinishedOutput(lines[1]); !ok {
		t.Fatalf("second line %q must parse as FinishedProcessing", lines[1])
	}
}

func TestRunCommandFailureReportsExitCodeAndStderrTail(t *testing.T) {
	script := writeScript(t, "#!/bin/sh\necho 'line one' >&2\necho 'Traceback: boom' >&2\nexit 3\n")
	err := runCommand(context.Background(), "sh", []string{script}, nil, nil)
	if err == nil {
		t.Fatal("exit 3 must fail")
	}
	if !strings.Contains(err.Error(), "退出码 3") || !strings.Contains(err.Error(), "Traceback: boom") {
		t.Fatalf("error %q must carry exit code and stderr tail", err.Error())
	}
}

func TestRunCommandCanceledContext(t *testing.T) {
	script := writeScript(t, "#!/bin/sh\nsleep 30\n")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := runCommand(ctx, "sh", []string{script}, nil, nil)
	if err == nil {
		t.Fatal("canceled context must fail")
	}
}
