package videosr

import (
	"math"
	"regexp"
	"strconv"
	"strings"
)

// BuildArgs 拼 VSR 命令行参数（不含 main.py 本身，调用方把它放在 argv[0]）。
// 合同来源：VSR 仓库 backend/tools/args_handler.py（v1.4.0）与 backend/main.py 的 __main__：
//
//	python resources/backend/main.py -i <输入> -o <输出> --inpaint-mode <模式> [-c YMIN YMAX XMIN XMAX ...]
//
// （QPT 打包布局：仓库根目录拷为 resources/，见 runtime.go Installed 注释。）
//
// -o 必须显式传：上游 __main__ 会无条件用 args.output 覆盖默认值，不传 -o 时
// args.output 为 None，run() 在 os.path.dirname(None) 崩掉。
// -c 坐标是整数像素，顺序 ymin ymax xmin xmax，可重复；不传 -c 时上游默认全帧扫描。
func BuildArgs(inputPath, outputPath, inpaintMode string, coords [][4]int) []string {
	mode := strings.TrimSpace(inpaintMode)
	if mode != InpaintModeSTTNAuto && mode != InpaintModeLama {
		mode = InpaintModeSTTNAuto
	}
	args := []string{"-i", inputPath, "-o", outputPath, "--inpaint-mode", mode}
	for _, c := range coords {
		args = append(args, "-c",
			strconv.Itoa(c[0]), strconv.Itoa(c[1]), strconv.Itoa(c[2]), strconv.Itoa(c[3]))
	}
	return args
}

// RegionToPixels 把对话框的相对选框（0-1）转成源视频像素坐标。算法与前端
// eraseRegionToPixels（web/src/lib/canvas/canvas-video-segment-args.ts）一致：
// 夹到画面内、坐标向下对齐到偶数（yuv420p 要求）、宽高至少 2px。
func RegionToPixels(region Region, videoWidth, videoHeight int) (x, y, width, height int) {
	w := maxInt(2, videoWidth)
	h := maxInt(2, videoHeight)
	clamp01 := func(v float64) float64 { return math.Min(1, math.Max(0, v)) }
	x = maxInt(0, int(math.Floor(clamp01(region.X)*float64(w)/2))*2)
	y = maxInt(0, int(math.Floor(clamp01(region.Y)*float64(h)/2))*2)
	maxW := maxInt(2, w-x)
	maxH := maxInt(2, h-y)
	width = minInt(maxW, maxInt(2, int(math.Ceil(clamp01(region.Width)*float64(w)/2))*2))
	height = minInt(maxH, maxInt(2, int(math.Ceil(clamp01(region.Height)*float64(h)/2))*2))
	return x, y, width, height
}

// RegionToCoords 把相对选框转成 VSR -c 参数的顺序（ymin, ymax, xmin, xmax）。
func RegionToCoords(region Region, videoWidth, videoHeight int) [4]int {
	x, y, width, height := RegionToPixels(region, videoWidth, videoHeight)
	return [4]int{y, y + height, x, x + width}
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// tqdmProgressRe 解析 tqdm 进度行。VSR 的 tqdm 以 file=sys.__stdout__ 写 stdout，
// 行形如：Subtitle Removing:  45%|████▍     | 450/1000 [00:12<00:15, 37.5frame/s]
// tqdm 用 \r 原地刷新，一行里可能含多个 \r 段，取最后一段的百分比。
var tqdmProgressRe = regexp.MustCompile(`(\d{1,3})%`)

func ParseProgressLine(line string) (percent int, ok bool) {
	segments := strings.Split(line, "\r")
	last := segments[len(segments)-1]
	m := tqdmProgressRe.FindStringSubmatch(last)
	if m == nil {
		return 0, false
	}
	value, err := strconv.Atoi(m[1])
	if err != nil || value < 0 || value > 100 {
		return 0, false
	}
	return value, true
}

// FinishedOutput 从 VSR 结束行里取输出路径。VSR 1.4.0 的 main.py 末尾打印的是
// tr['Main']['FinishedProcessing']，其文案在语言文件里（backend/interface/en.ini:92、
// ch.ini:92），不是字面 "FinishedProcessing:"：
//   英文：[Complete] Subtitles removed. Output saved to: /path/to/video_no_sub.mp4
//   中文：[完成] 字幕移除成功, 文件已保存到 /path/to/video_no_sub.mp4
// 打包默认界面是中文，Windows 上实际出现的是中文行；两行都认，旧前缀留作兜底。
// （2026-11-22 Linux 实测：lama 模式的真实输出就是英文行，退出码 0。）
func FinishedOutput(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	for _, prefix := range []string{
		"[Complete] Subtitles removed. Output saved to: ",
		"[完成] 字幕移除成功, 文件已保存到 ",
		"FinishedProcessing: ",
	} {
		if !strings.HasPrefix(trimmed, prefix) {
			continue
		}
		path := strings.TrimSpace(strings.TrimPrefix(trimmed, prefix))
		if path == "" {
			return "", false
		}
		return path, true
	}
	return "", false
}
