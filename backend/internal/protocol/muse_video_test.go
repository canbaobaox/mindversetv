package protocol

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

// muse-video provider 的提交体与轮询映射必须与 muse2api 的
// /v1/videos 协议一致。接口形状以 muse2api 源码为准（app.py:1695
// create_video、app.py:1736 get_video）：提交是 JSON（不是 multipart），
// 时长字段是 duration（整数），不是 seconds；轮询 status 取值 queued /
// processing / completed / failed，成功时 url 在顶层。
func loadMuseVideoAdapter(t *testing.T) Adapter {
	t.Helper()
	// 走与运行时相同的加载路径：ParsePluginPackageDir 补全 Metadata
	//（id/version 来自包名与版本号），再由 LoadInstalledProviders 做
	// provider 投影。
	pkg, err := ParsePluginPackageDir(filepath.Join("..", "..", "..", "plugin-packages", "beeftv-plugin-muse"))
	if err != nil {
		t.Fatalf("ParsePluginPackageDir: %v", err)
	}
	raw, err := json.Marshal(pkg.Manifest)
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	adapters, err := LoadInstalledProviders(raw)
	if err != nil {
		t.Fatalf("LoadInstalledProviders: %v", err)
	}
	if len(adapters) != 1 {
		t.Fatalf("want 1 adapter, got %d", len(adapters))
	}
	return adapters[0]
}

func TestMuseVideoCreateBodyIsJSONWithDuration(t *testing.T) {
	adapter := loadMuseVideoAdapter(t)
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:  CapabilityVideo,
		Model:       "muse-video",
		Prompt:      "一只猫在窗台上伸懒腰",
		Duration:    5,
		AspectRatio: "16:9",
		Images: []MediaReference{
			{Kind: "image", DataURL: "data:image/png;base64,iVBORw0KGgo="},
		},
	}})
	if err != nil {
		t.Fatalf("BuildCreate: %v", err)
	}
	if spec.Method != "POST" {
		t.Fatalf("Method = %q, want POST", spec.Method)
	}
	if spec.Path != "/v1/videos" {
		t.Fatalf("Path = %q, want /v1/videos", spec.Path)
	}
	// 必须是 JSON 提交：multipart 会被中继回 422。
	if spec.ContentType != "application/json" {
		t.Fatalf("ContentType = %q, want application/json", spec.ContentType)
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body is %T, want map", spec.Body)
	}
	if body["model"] != "muse-video" || body["prompt"] != "一只猫在窗台上伸懒腰" {
		t.Fatalf("body model/prompt = %v", body)
	}
	// duration 必须是整数 5；seconds 字段绝不能出现（中继会直接忽略它）。
	if body["duration"] != 5 && body["duration"] != float64(5) {
		t.Fatalf("body duration = %v (%T), want int 5", body["duration"], body["duration"])
	}
	for _, key := range []string{"seconds", "input_reference"} {
		if _, exists := body[key]; exists {
			t.Fatalf("body must not carry %q, got %v", key, body)
		}
	}
	if body["aspect_ratio"] != "16:9" {
		t.Fatalf("body aspect_ratio = %v, want 16:9", body["aspect_ratio"])
	}
	images, ok := body["images"].([]any)
	if !ok || len(images) != 1 || images[0] != "data:image/png;base64,iVBORw0KGgo=" {
		t.Fatalf("body images = %v, want [data URL]", body["images"])
	}
}

func TestMuseVideoCreateOmitsZeroDuration(t *testing.T) {
	adapter := loadMuseVideoAdapter(t)
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:  CapabilityVideo,
		Model:       "muse-video",
		Prompt:      "海边日落",
		AspectRatio: "9:16",
	}})
	if err != nil {
		t.Fatalf("BuildCreate: %v", err)
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body is %T, want map", spec.Body)
	}
	// duration 为 0 时不发，中继默认按 6 秒写进提示词。
	if _, exists := body["duration"]; exists {
		t.Fatalf("zero duration must be omitted, body = %v", body)
	}
	if body["aspect_ratio"] != "9:16" {
		t.Fatalf("body aspect_ratio = %v, want 9:16", body["aspect_ratio"])
	}
}

func TestMuseVideoParseCreate(t *testing.T) {
	adapter := loadMuseVideoAdapter(t)
	result, err := adapter.ParseCreate(context.Background(), []byte(`{"id":"vid-1","task_id":"vid-1","object":"video.task","status":"queued","progress":10}`))
	if err != nil {
		t.Fatalf("ParseCreate: %v", err)
	}
	if result.TaskID != "vid-1" {
		t.Fatalf("TaskID = %q", result.TaskID)
	}
	if result.Status != StatusPending {
		t.Fatalf("Status = %q, want pending", result.Status)
	}
}

func TestMuseVideoParsePoll(t *testing.T) {
	adapter := loadMuseVideoAdapter(t)
	ctx := context.Background()
	pollCtx := PollContext{TaskID: "vid-1", Model: "muse-video"}
	cases := []struct {
		name       string
		body       string
		wantStatus Status
		wantVideos []string
		wantMsg    string
	}{
		{
			name:       "queued keeps polling",
			body:       `{"id":"vid-1","task_id":"vid-1","status":"queued","progress":10}`,
			wantStatus: StatusPending,
		},
		{
			name:       "processing keeps polling",
			body:       `{"id":"vid-1","task_id":"vid-1","status":"processing","progress":15}`,
			wantStatus: StatusProcessing,
		},
		{
			name:       "completed resolves top-level url",
			body:       `{"id":"vid-1","task_id":"vid-1","status":"completed","progress":100,"url":"http://127.0.0.1:18610/v1/media/vid-1.mp4","video":{"url":"http://127.0.0.1:18610/v1/media/vid-1.mp4"},"result":{"url":"http://127.0.0.1:18610/v1/media/vid-1.mp4"}}`,
			wantStatus: StatusSucceeded,
			wantVideos: []string{"http://127.0.0.1:18610/v1/media/vid-1.mp4"},
		},
		{
			name:       "failed with error message",
			body:       `{"id":"vid-1","task_id":"vid-1","status":"failed","error":"没有可用的生成账号，请检查账号池"}`,
			wantStatus: StatusFailed,
			wantMsg:    "没有可用的生成账号，请检查账号池",
		},
		{
			name:       "task not found is failure",
			body:       `{"error":{"message":"task 不存在","type":"not_found_error","param":null,"code":404}}`,
			wantStatus: StatusFailed,
			wantMsg:    "task 不存在",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := adapter.ParsePoll(ctx, pollCtx, []byte(tc.body))
			if err != nil {
				t.Fatalf("ParsePoll: %v", err)
			}
			if result.Status != tc.wantStatus {
				t.Fatalf("Status = %q, want %q", result.Status, tc.wantStatus)
			}
			if len(tc.wantVideos) > 0 {
				if len(result.Result.Videos) != len(tc.wantVideos) {
					t.Fatalf("Videos = %v, want %v", result.Result.Videos, tc.wantVideos)
				}
				for i, want := range tc.wantVideos {
					if result.Result.Videos[i].URL != want {
						t.Fatalf("Videos[%d].URL = %q, want %q", i, result.Result.Videos[i].URL, want)
					}
				}
			}
			if tc.wantMsg != "" && result.Message != tc.wantMsg {
				t.Fatalf("Message = %q, want %q", result.Message, tc.wantMsg)
			}
		})
	}
}
