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
  "images": { "$omitEmpty": { "$map": "request.images -> media.value" } },
  "aspect_ratio": { "$omitEmpty": "request.aspectRatio" },
  "resolution": { "$omitEmpty": "request.resolution" },
  "duration": { "$omitEmpty": "request.duration" }
}
```

提交成功返回 `{ data: { task_id } }`（已确认）。`aspect_ratio` / `resolution` / `duration` / `images` 为空时不发送。

### 轮询（poll）

`GET /v1/media/status?task_id={{taskId}}`。注意：`{{taskId}}` 插值只在 `path` 字段生效
（`backend/internal/protocol/manifest_adapter.go:237` 对 path 做 `ReplaceAll("{{taskId}}")`，
而 `query` 字段的模板字符串会被原样发送），所以 task_id 必须写在 path 的查询串里，
不能写进 `query` 字段。

轮询返回 `{ is_final, state, error, error_code }`（已确认字段名，未确认 `state` 取值）。
`response.status` 取 `$coalesce[response.state, response.status, "pending"]`，再经
`normalizeStatus`（`backend/internal/protocol/builtin_helpers.go:192-210`）归一化：
`succeeded/success/completed/done -> succeeded`，`failed/error/expired -> failed`，
未知取值 -> pending。`is_final` 没有对应的 ManifestResponse 字段，本插件未消费它。

### 结果地址（未验证，按最可能字段映射）

`images` / `videos` 均按以下顺序 `$coalesce` 提取：
`response.data.image_url`（或 `video_url`）→ `response.image_url`（或 `video_url`）→
`response.data.content.image_url`（或 `video_url`）→ `response.data.url` → `response.url` →
`response.data.images`（或 `videos`）→ `response.images`（或 `videos`）。
成功结果地址的真实字段名没有真 Key 验证过，需实测后收紧。

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

1. 成功结果地址字段名（`response.data` 里到底是 `image_url` / `video_url` / `url` / `content.*` 还是数组）。
2. 轮询 `state` 的实际取值（如 `succeeded` / `completed` / `processing` / `failed` 之外的值），以及 `is_final=true` 时是否一定代表成功。
3. `images` 参考图是否被接受、接受 URL 还是 base64、字段名是不是 `images`。
4. `GET /v1/media/models?type=...` 是否存在、返回体形状、音频类型是否返回模型。
5. `aspect_ratio` / `resolution` / `duration` 是否被接受、取值范围与默认值。
6. 实际轮询间隔是否为 5 秒；取消接口是否存在（本插件未声明 cancel，未编造）。
