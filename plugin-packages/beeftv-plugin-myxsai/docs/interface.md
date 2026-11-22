# 梦由心生AI 渠道接口说明

## 插件身份

- 插件包名：`beeftv-plugin-myxsai`
- 默认 Base URL：`https://api.lk888.ai`
- 鉴权方式：`Authorization: Bearer <apiKey>`
- 官网 / Key 申请：`https://myxsai.com`（控制台 API 密钥管理新建 Key，按量计费）

## 贡献的媒体协议 Provider

| Provider ID | 适用模型 | 创建接口 | 轮询接口 |
| --- | --- | --- | --- |
| `myxsai-media` | 全部图片与视频预置模型（见 README） | `POST /v1/media/generate` | `GET /v1/media/status?task_id={{taskId}}` |

文本模型不声明 provider，走宿主通用 `chat-completion`（`POST /v1/chat/completions`）。

### 提交（create）

```json
{
  "model": { "$ref": "request.model" },
  "prompt": { "$ref": "request.prompt" },
  "params": {
    "images": { "$omitEmpty": { "$map": "request.images -> media.value" } },
    "aspect_ratio": { "$omitEmpty": "request.aspectRatio" },
    "resolution": { "$omitEmpty": "request.resolution" },
    "duration": { "$if": "request.duration > 0 才发送" }
  }
}
```

提交成功返回 `{ data: { task_id } }`（已确认）。可选参数必须包在 `params` 里——
站方两个公开客户端（lingkeai/ComfyUI-LingKe `lingke_client.py`、
wenyinos/ai-image-generator `lib/utils.js`）提交体都是
`{model, prompt, params}`，`aspect_ratio` / `images` 是 `params` 的成员；
之前平铺在顶层的写法会被站方忽略（画幅、时长、参考图不生效）。
`duration` 为 0 时不发（`$omitEmpty` 对数字 0 不生效，改用 `$if` + `$gt` 守卫）。

### 轮询（poll）

`GET /v1/media/status?task_id={{taskId}}`。注意：`{{taskId}}` 插值只在 `path` 字段生效
（`backend/internal/protocol/manifest_adapter.go:237` 对 path 做 `ReplaceAll("{{taskId}}")`，
而 `query` 字段的模板字符串会被原样发送），所以 task_id 必须写在 path 的查询串里，
不能写进 `query` 字段。

轮询返回顶层 `{ is_final, state, error, error_code }`（公开客户端证实）。
`response.status` 用 `$if` 以 `is_final` 为准：`is_final` 为 false 时一律
`processing`（`state` 单独不可信——另一客户端明确把 `state=success` 但
`is_final≠true` 的情况降级为进行中）；`is_final` 为 true（或字段缺失时
沿用旧行为）才读 `state`，再经 `normalizeStatus`
（`backend/internal/protocol/builtin_helpers.go:192-210`）归一化。
`state` 已证实的取值：`success` / `succeeded`（成功）、`failed`（失败）、
`running` / `pending`（进行中）。另有 `successCodes: [0, 200, "0", "200"]`：
站方用 HTTP 200 + `code` 字段表示业务状态，`code=200` 是成功码，不能当成
错误（否则每次轮询都会被 `manifestError` 误判失败）。

### 结果地址（已按公开客户端对齐，仍需真 Key 实测收尾）

成功结果地址在**顶层**：`result_urls`（数组，优先）或 `result_url`（单个）。
`images` / `videos` 按以下顺序 `$coalesce` 提取：`response.result_urls` →
`response.result_url` → `response.data.result_urls` → `response.data.result_url` →
`response.data.image_url`（或 `video_url`）→ `response.image_url`（或 `video_url`）→
`response.data.content.image_url`（或 `video_url`）→ `response.data.url` →
`response.url` → `response.data.images`（或 `videos`）→ `response.images`（或 `videos`）。
旧映射漏掉了 `result_url` / `result_urls`，任务成功后也取不到地址，是
2026-11-22 用户真机生图失败（`result_unrecoverable`）的直接原因。轮询终态
的 `cost` 字段读进 `usage`（扣费确认只能从终态响应里取）。

### 轮询间隔

`ManifestOperation`（`backend/internal/protocol/manifest.go:11-30`）没有轮询间隔字段，
“每 5 秒轮询”无法在 manifest 里声明，取决于宿主轮询行为，需实测确认。

## 按类型拉取

`client/presets.js` 的 `fetchMyxsaiModelsByType(baseUrl, apiKey, type)`：

- `GET {baseUrl}/v1/media/models?type=<chat|image|video|audio>`，`Authorization: Bearer <Key>`，10 秒超时。
- 接受的返回体形状（防御性解析）：数组本体 / `{ models }` / `{ data }` / `{ list }` / `{ data: { models | list } }`；条目为字符串 ID 或 `{ id | model | name }` 对象。
- 任何失败（网络 / CORS / 401 / 格式不对）都返回 `[]`，面板静默回退到静态代表模型。
- 该端点与返回体形状尚未用真 Key 验证过。

## candidates 字段核查结论

`BUILTIN_SERVICE_PRESET.candidates` 本插件取 `{ text: "chat-completion", image: "myxsai-media", video: "myxsai-media" }`，
与 brief 原值（`image: "openai-image"`）不同，证据见下：

- `candidates` 的语义是“没有显式声明接口时，按能力给的默认协议”
  （`web/src/lib/builtin-service-presets.ts:81` 注释）。
- 消费处 `web/src/lib/model-service-presets.ts:296-300`：
  `proposed = inherited || endpoint || candidates[capability]`。预置模型走更早的分支
  （同文件约 273-290 行），直接用预置自带的 `protocol`，不走 candidates；
  只有非预置模型（例如“读取模型”拉到的、或按类型拉取后落盘的模型）才由 candidates 定协议。
- 若 image 保持 `openai-image`，运行时拉到的图片模型会被指派 `openai-image` 协议，
  发往站上不存在的 `POST /v1/images/generations`；图片的唯一已知走线是媒体协议，
  故 image 必须指向 `myxsai-media`。video 同理补上（brief 原值没有 video 键，
  拉到的视频模型无回退会落到 `proposed = undefined`，需用户手动选协议）。
- 音频不设回退：没有已验证的音频协议，拉到的音频模型不自动指派协议。

## 需真 Key 实测清单

1. 拿一次真实生图任务的提交响应与每次轮询响应的原始 JSON 全文，逐字段对照
   上文（重点：`result_urls` / `result_url` 是否如公开客户端所写、`code`
   字段是否出现、`is_final` 与 `state` 是否同步变化）。
2. `images` 参考图是否被接受、接受 URL 还是 base64、字段名是不是 `images`。
3. `GET /v1/media/models?type=...` 是否存在、返回体形状、音频类型是否返回模型。
4. `aspect_ratio` / `resolution` / `duration` 在 `params` 里的取值范围与默认值。
5. 实际轮询间隔是否为 5 秒；取消接口是否存在（本插件未声明 cancel，未编造）。
6. 另一轮询端点 `GET /v1/skills/task-status?task_id=` 与 `/v1/media/status`
   的响应是否相同（公开客户端两边都在用；本插件用前者）。
