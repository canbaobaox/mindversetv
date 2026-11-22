package videosr

import (
	"reflect"
	"testing"
)

func TestBuildArgs(t *testing.T) {
	t.Run("默认 sttn-auto 且永远传 -o", func(t *testing.T) {
		got := BuildArgs("in.mp4", "out.mp4", "", nil)
		want := []string{"-i", "in.mp4", "-o", "out.mp4", "--inpaint-mode", "sttn-auto"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v want %v", got, want)
		}
	})
	t.Run("lama 模式原样透传", func(t *testing.T) {
		got := BuildArgs("in.mp4", "out.mp4", "lama", nil)
		if got[5] != "lama" {
			t.Fatalf("got mode %q want lama", got[5])
		}
	})
	t.Run("非法模式回落 sttn-auto，绝不传 propainter", func(t *testing.T) {
		for _, mode := range []string{"propainter", "opencv", "STTN-AUTO", ""} {
			got := BuildArgs("in.mp4", "out.mp4", mode, nil)
			if got[5] != "sttn-auto" {
				t.Fatalf("mode %q: got %q want sttn-auto", mode, got[5])
			}
		}
	})
	t.Run("多个 -c 区域按 ymin ymax xmin xmax 顺序", func(t *testing.T) {
		got := BuildArgs("in.mp4", "out.mp4", "sttn-auto", [][4]int{{10, 100, 20, 200}, {0, 50, 0, 60}})
		want := []string{"-i", "in.mp4", "-o", "out.mp4", "--inpaint-mode", "sttn-auto",
			"-c", "10", "100", "20", "200", "-c", "0", "50", "0", "60"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v want %v", got, want)
		}
	})
}

func TestRegionToPixels(t *testing.T) {
	// 对话框默认字幕选框 {x:0.08, y:0.76, w:0.84, h:0.18}，1920x1080 源视频。
	x, y, w, h := RegionToPixels(Region{X: 0.08, Y: 0.76, Width: 0.84, Height: 0.18}, 1920, 1080)
	if x != 152 || y != 820 || w != 1614 || h != 196 {
		t.Fatalf("got (%d,%d,%d,%d) want (152,820,1614,196)", x, y, w, h)
	}
	// 出界选框夹到画面内。
	x, y, w, h = RegionToPixels(Region{X: 0.9, Y: 0.9, Width: 0.5, Height: 0.5}, 1920, 1080)
	if x+w > 1920 || y+h > 1080 {
		t.Fatalf("region exceeds frame: (%d,%d,%d,%d)", x, y, w, h)
	}
	// 坐标与尺寸均为偶数（yuv420p 要求）。
	if x%2 != 0 || y%2 != 0 || w%2 != 0 || h%2 != 0 {
		t.Fatalf("not even-aligned: (%d,%d,%d,%d)", x, y, w, h)
	}
}

func TestRegionToCoords(t *testing.T) {
	// VSR -c 顺序是 ymin ymax xmin xmax。
	got := RegionToCoords(Region{X: 0.08, Y: 0.76, Width: 0.84, Height: 0.18}, 1920, 1080)
	want := [4]int{820, 1016, 152, 1766}
	if got != want {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestParseProgressLine(t *testing.T) {
	cases := []struct {
		line    string
		percent int
		ok      bool
	}{
		{"Subtitle Removing:  45%|████▍     | 450/1000 [00:12<00:15, 37.5frame/s]", 45, true},
		// tqdm 用 \r 原地刷新：取最后一段。
		{"Subtitle Removing:   0%|          | 0/100 [00:00<?, ?frame/s]\rSubtitle Removing:  78%|███████▊  | 780/1000 [00:20<00:05, 40.1frame/s]", 78, true},
		{"Subtitle Removing: 100%|██████████| 1000/1000 [00:25<00:00, 40.0frame/s]", 100, true},
		{"[INFO] loading model", 0, false},
		{"", 0, false},
		{"1000/1000 frames done", 0, false},
	}
	for _, c := range cases {
		percent, ok := ParseProgressLine(c.line)
		if percent != c.percent || ok != c.ok {
			t.Fatalf("line %q: got (%d,%v) want (%d,%v)", c.line, percent, ok, c.percent, c.ok)
		}
	}
}

func TestFinishedOutput(t *testing.T) {
	path, ok := FinishedOutput("FinishedProcessing: /tmp/work/output.mp4")
	if !ok || path != "/tmp/work/output.mp4" {
		t.Fatalf("got (%q,%v) want (/tmp/work/output.mp4,true)", path, ok)
	}
	// 1.4.0 真实输出（en.ini:92 / ch.ini:92，2026-11-22 Linux 实测）。
	path, ok = FinishedOutput("[Complete] Subtitles removed. Output saved to: /tmp/work/output.mp4")
	if !ok || path != "/tmp/work/output.mp4" {
		t.Fatalf("english completion line: got (%q,%v)", path, ok)
	}
	path, ok = FinishedOutput("[完成] 字幕移除成功, 文件已保存到 /tmp/work/output.mp4")
	if !ok || path != "/tmp/work/output.mp4" {
		t.Fatalf("chinese completion line: got (%q,%v)", path, ok)
	}
	if _, ok := FinishedOutput("[完成] 字幕移除成功, 文件已保存到 "); ok {
		t.Fatal("empty path must not parse as finished output")
	}
	if _, ok := FinishedOutput("Subtitle Removing:  45%|..."); ok {
		t.Fatal("progress line must not match FinishedProcessing")
	}
}
