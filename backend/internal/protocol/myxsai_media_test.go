package protocol

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// 回归测试：myxsai-media provider 的提交体与轮询映射必须与站方媒体协议
// 一致。站方返回结构以 lingkeai/ComfyUI-LingKe 公开客户端为准：
// 提交体 {model, prompt, params}；提交返回 {data:{task_id}}；轮询返回顶层
// {is_final, state, error, error_code, result_url/result_urls, cost}，
// 成功当且仅当 is_final=true 且 state=success/succeeded。
func loadMyxsaiAdapter(t *testing.T) Adapter {
	t.Helper()
	// 走与运行时相同的加载路径：ParsePluginPackageDir 补全 Metadata
	//（id/version 来自包名与版本号），再由 LoadInstalledProviders 做
	// provider 投影。
	pkg, err := ParsePluginPackageDir(filepath.Join("..", "..", "..", "plugin-packages", "beeftv-plugin-myxsai"))
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

func TestMyxsaiMediaCreateBodyUsesParams(t *testing.T) {
	adapter := loadMyxsaiAdapter(t)
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:  CapabilityImage,
		Model:       "doubao-seedream-5-5-261028",
		Prompt:      "一只猫",
		AspectRatio: "16:9",
		Resolution:  "2K",
	}})
	if err != nil {
		t.Fatalf("BuildCreate: %v", err)
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body is %T, want map", spec.Body)
	}
	if body["model"] != "doubao-seedream-5-5-261028" || body["prompt"] != "一只猫" {
		t.Fatalf("body model/prompt = %v", body)
	}
	for _, key := range []string{"aspect_ratio", "duration", "images", "resolution"} {
		if _, exists := body[key]; exists {
			t.Fatalf("body must not carry top-level %q, got %v", key, body)
		}
	}
	params, ok := body["params"].(map[string]any)
	if !ok {
		t.Fatalf("body params is %T, want map", body["params"])
	}
	if params["aspect_ratio"] != "16:9" || params["resolution"] != "2K" {
		t.Fatalf("params = %v", params)
	}
	if _, exists := params["duration"]; exists {
		t.Fatalf("empty duration must be omitted, params = %v", params)
	}
}

func TestMyxsaiMediaParseCreate(t *testing.T) {
	adapter := loadMyxsaiAdapter(t)
	result, err := adapter.ParseCreate(context.Background(), []byte(`{"code":0,"data":{"task_id":"task-123"}}`))
	if err != nil {
		t.Fatalf("ParseCreate: %v", err)
	}
	if result.TaskID != "task-123" {
		t.Fatalf("TaskID = %q", result.TaskID)
	}
	if result.Status != StatusPending {
		t.Fatalf("Status = %q, want pending", result.Status)
	}
	result, err = adapter.ParseCreate(context.Background(), []byte(`{"code":200,"task_id":"task-456"}`))
	if err != nil {
		t.Fatalf("ParseCreate: %v", err)
	}
	if result.TaskID != "task-456" {
		t.Fatalf("TaskID = %q", result.TaskID)
	}
}

func TestMyxsaiMediaParsePoll(t *testing.T) {
	adapter := loadMyxsaiAdapter(t)
	ctx := context.Background()
	pollCtx := PollContext{TaskID: "task-123", Model: "doubao-seedream-5-5-261028"}
	cases := []struct {
		name       string
		body       string
		wantStatus Status
		wantImages []string
		wantMsg    string
	}{
		{
			name:       "running keeps polling",
			body:       `{"is_final":false,"state":"running","progress":30}`,
			wantStatus: StatusProcessing,
		},
		{
			// 未终态时状态必须是 processing：轮询循环只看 Status
			//（generation/protocol.go），中间结果里的 media 会被忽略、
			// 不会提前当成完成；这里断言 URL 仍被解析出来只是说明
			// 映射读得到它，不代表任务已完成。
			name:       "success before final stays processing",
			body:       `{"is_final":false,"state":"success","result_url":"https://example.test/img.png"}`,
			wantStatus: StatusProcessing,
			wantImages: []string{"https://example.test/img.png"},
		},
		{
			name:       "success with single result_url",
			body:       `{"is_final":true,"state":"success","result_url":"https://example.test/img.png","cost":0.5}`,
			wantStatus: StatusSucceeded,
			wantImages: []string{"https://example.test/img.png"},
		},
		{
			name:       "success with result_urls array",
			body:       `{"is_final":true,"state":"success","result_urls":["https://example.test/1.png","https://example.test/2.png"]}`,
			wantStatus: StatusSucceeded,
			wantImages: []string{"https://example.test/1.png", "https://example.test/2.png"},
		},
		{
			name:       "code 200 must not force failure",
			body:       `{"code":200,"is_final":true,"state":"success","result_url":"https://example.test/img.png"}`,
			wantStatus: StatusSucceeded,
			wantImages: []string{"https://example.test/img.png"},
		},
		{
			name:       "failed with error and code",
			body:       `{"is_final":true,"state":"failed","error":"余额不足","error_code":"insufficient_balance"}`,
			wantStatus: StatusFailed,
			wantMsg:    "余额不足",
		},
		{
			name:       "data-wrapped success still resolves",
			body:       `{"data":{"is_final":true,"state":"success","result_url":"https://example.test/img.png"}}`,
			wantStatus: StatusSucceeded,
			wantImages: []string{"https://example.test/img.png"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := adapter.ParsePoll(ctx, pollCtx, []byte(tc.body))
			if err != nil {
				t.Fatalf("ParsePoll: %v", err)
			}
			if result.Status != tc.wantStatus {
				t.Fatalf("Status = %q, want %q (body %s)", result.Status, tc.wantStatus, tc.body)
			}
			var got []string
			if result.Result != nil {
				for _, ref := range result.Result.Images {
					got = append(got, ref.URL)
				}
			}
			if len(got) != len(tc.wantImages) {
				t.Fatalf("images = %v, want %v", got, tc.wantImages)
			}
			for i := range got {
				if got[i] != tc.wantImages[i] {
					t.Fatalf("images = %v, want %v", got, tc.wantImages)
				}
			}
			if tc.wantMsg != "" && !strings.Contains(result.Message, tc.wantMsg) {
				t.Fatalf("Message = %q, want it to contain %q", result.Message, tc.wantMsg)
			}
		})
	}
}

func TestMyxsaiMediaBuildPollURL(t *testing.T) {
	adapter := loadMyxsaiAdapter(t)
	spec, err := adapter.BuildPoll(context.Background(), PollContext{TaskID: "task-123", Model: "doubao-seedream-5-5-261028"})
	if err != nil {
		t.Fatalf("BuildPoll: %v", err)
	}
	if spec.Method != "GET" {
		t.Fatalf("Method = %q", spec.Method)
	}
	if spec.Path != "/v1/media/status?task_id=task-123" {
		t.Fatalf("Path = %q", spec.Path)
	}
}

// 回归测试：视频续写（extend，仅 Seedance 2.5）走媒体协议 _quan_neng_mode +
// video_url；非 extend 一律不发这两个参数。画幅须被 Seedance 约束锁到 adaptive。
func TestMyxsaiMediaCreateBodyExtend(t *testing.T) {
	adapter := loadMyxsaiAdapter(t)
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:  CapabilityVideo,
		Model:       "doubao-seedance-2-5-260628",
		Prompt:      "继续",
		Operation:   "extend",
		AspectRatio: "16:9",
		Duration:    5,
		Videos:      []MediaReference{{URL: "https://example.test/src.mp4"}},
	}})
	if err != nil {
		t.Fatalf("BuildCreate: %v", err)
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body is %T, want map", spec.Body)
	}
	for _, key := range []string{"_quan_neng_mode", "video_url", "aspect_ratio", "duration", "images", "resolution"} {
		if _, exists := body[key]; exists {
			t.Fatalf("body must not carry top-level %q, got %v", key, body)
		}
	}
	params, ok := body["params"].(map[string]any)
	if !ok {
		t.Fatalf("body params is %T, want map", body["params"])
	}
	if params["_quan_neng_mode"] != "extend" {
		t.Fatalf("_quan_neng_mode = %v, want extend (params %v)", params["_quan_neng_mode"], params)
	}
	urls, ok := params["video_url"].([]any)
	if !ok || len(urls) != 1 || urls[0] != "https://example.test/src.mp4" {
		t.Fatalf("video_url = %v, want [https://example.test/src.mp4]", params["video_url"])
	}
	if params["aspect_ratio"] != "adaptive" {
		t.Fatalf("extend must lock aspect_ratio to adaptive, params = %v", params)
	}

	// 对照：普通参考生视频不发 extend 参数。
	spec, err = adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:  CapabilityVideo,
		Model:       "doubao-seedance-2-5-260628",
		Prompt:      "参考",
		Operation:   "reference_to_video",
		AspectRatio: "16:9",
		Duration:    5,
		Videos:      []MediaReference{{URL: "https://example.test/src.mp4"}},
	}})
	if err != nil {
		t.Fatalf("BuildCreate: %v", err)
	}
	body, ok = spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body is %T, want map", spec.Body)
	}
	params, ok = body["params"].(map[string]any)
	if !ok {
		t.Fatalf("body params is %T, want map", body["params"])
	}
	for _, key := range []string{"_quan_neng_mode", "video_url"} {
		if _, exists := params[key]; exists {
			t.Fatalf("non-extend must not carry params %q, got %v", key, params)
		}
	}
}
