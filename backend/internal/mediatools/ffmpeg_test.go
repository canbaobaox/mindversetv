package mediatools

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

func TestBundledFFmpegRelocationAndCLI(t *testing.T) {
	root := filepath.Join(t.TempDir(), "中文 install with spaces")
	want := filepath.Join(root, "media-runtime", "ffmpeg.exe")
	if err := os.MkdirAll(filepath.Dir(want), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(want, []byte("fixture"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, executable := range []string{filepath.Join(root, "BeefTV.exe"), filepath.Join(root, "cli", "beeftv.exe")} {
		if got := bundledFFmpeg(executable); got != want {
			t.Fatalf("bundle resolution: %q != %q", got, want)
		}
	}
}

func TestExplicitFFmpegOverrideDoesNotFallBack(t *testing.T) {
	want := filepath.Join(t.TempDir(), "missing.exe")
	t.Setenv(FFmpegPathEnv, want)
	got, err := ResolveFFmpeg()
	if err != nil || got != want {
		t.Fatalf("override = %q, %v", got, err)
	}
}

func TestNestedFFmpegWinsOverPreservedStandaloneRuntime(t *testing.T) {
	root := filepath.Join(t.TempDir(), "中文 install with spaces")
	legacy := filepath.Join(root, "media-runtime", "ffmpeg.exe")
	want := filepath.Join(root, "agent-host", "media-runtime", "ffmpeg.exe")
	for _, file := range []string{legacy, want} {
		if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(file, []byte("fixture"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	for _, executable := range []string{filepath.Join(root, "BeefTV.exe"), filepath.Join(root, "cli", "beeftv.exe")} {
		if got := bundledFFmpeg(executable); got != want {
			t.Fatalf("preserved runtime won over update: %q != %q", got, want)
		}
	}
}

func writeFakeFFmpegEncoderList(t *testing.T, encoders ...string) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("shell encoder fixture; native bundle tested separately")
	}
	bin := filepath.Join(t.TempDir(), "ffmpeg")
	var listing strings.Builder
	listing.WriteString("#!/bin/sh\n")
	for _, encoder := range encoders {
		fmt.Fprintf(&listing, "echo ' V..... %s           fake encoder'\n", encoder)
	}
	if err := os.WriteFile(bin, []byte(listing.String()), 0o755); err != nil {
		t.Fatal(err)
	}
	return bin
}

func TestPreferredH264EncoderPrefersHardware(t *testing.T) {
	cases := []struct {
		name     string
		encoders []string
		want     string
	}{
		{"nvenc wins over libx264", []string{"libx264", "h264_nvenc"}, "h264_nvenc"},
		{"qsv wins over libx264", []string{"libx264", "h264_qsv"}, "h264_qsv"},
		{"amf wins over libx264", []string{"libx264", "h264_amf"}, "h264_amf"},
		{"videotoolbox wins over libx264", []string{"libx264", "h264_videotoolbox"}, "h264_videotoolbox"},
		{"nvenc wins over qsv and amf", []string{"h264_amf", "h264_qsv", "h264_nvenc"}, "h264_nvenc"},
		{"libx264 fallback", []string{"libx264"}, "libx264"},
		{"no h264 encoder", []string{"aac", "libmp3lame"}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			bin := writeFakeFFmpegEncoderList(t, tc.encoders...)
			if got := PreferredH264Encoder(bin); got != tc.want {
				t.Fatalf("PreferredH264Encoder = %q, want %q", got, tc.want)
			}
			if got := SupportsH264Encode(bin); got != (tc.want != "") {
				t.Fatalf("SupportsH264Encode = %v, want %v", got, tc.want != "")
			}
		})
	}
}

func TestPreferredH264VideoArgsUseHardwareQualityControls(t *testing.T) {
	nvenc := writeFakeFFmpegEncoderList(t, "libx264", "h264_nvenc")
	args := PreferredH264VideoArgs(nvenc, "veryfast", "18", "6M", "10M")
	if !slices.Contains(args, "h264_nvenc") || !slices.Contains(args, "-cq") || !slices.Contains(args, "18") {
		t.Fatalf("nvenc args = %v, want h264_nvenc with -cq 18", args)
	}
	if slices.Contains(args, "veryfast") || slices.Contains(args, "libx264") {
		t.Fatalf("nvenc args must not carry libx264 preset/codec: %v", args)
	}

	qsv := writeFakeFFmpegEncoderList(t, "h264_qsv")
	args = PreferredH264VideoArgs(qsv, "veryfast", "23", "6M", "10M")
	if !slices.Contains(args, "h264_qsv") || !slices.Contains(args, "-global_quality") || !slices.Contains(args, "23") {
		t.Fatalf("qsv args = %v, want h264_qsv with -global_quality 23", args)
	}
	args = PreferredH264VideoArgs(qsv, "", "", "6M", "10M")
	if slices.Contains(args, "-preset") {
		t.Fatalf("qsv args without preset must not pass -preset: %v", args)
	}

	amf := writeFakeFFmpegEncoderList(t, "h264_amf")
	args = PreferredH264VideoArgs(amf, "veryfast", "", "6M", "10M")
	if !slices.Contains(args, "h264_amf") || !slices.Contains(args, "-rc") || !slices.Contains(args, "cqp") || !slices.Contains(args, "-qp_i") {
		t.Fatalf("amf args = %v, want h264_amf with -rc cqp", args)
	}
	if !slices.Contains(args, "20") {
		t.Fatalf("amf args without crf must default quality to 20: %v", args)
	}

	vt := writeFakeFFmpegEncoderList(t, "h264_videotoolbox")
	args = PreferredH264VideoArgs(vt, "veryfast", "20", "6M", "10M")
	if !slices.Contains(args, "h264_videotoolbox") || !slices.Contains(args, "-b:v") || !slices.Contains(args, "6M") {
		t.Fatalf("videotoolbox args = %v, want h264_videotoolbox with -b:v 6M", args)
	}

	cpu := writeFakeFFmpegEncoderList(t, "libx264")
	args = PreferredH264VideoArgs(cpu, "veryfast", "20", "6M", "10M")
	if !slices.Contains(args, "libx264") || !slices.Contains(args, "-preset") || !slices.Contains(args, "-crf") {
		t.Fatalf("libx264 args = %v, want libx264 with -preset/-crf", args)
	}
}
