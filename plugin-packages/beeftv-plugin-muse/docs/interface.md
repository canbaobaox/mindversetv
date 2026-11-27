# Muse 视频渠道接口说明

> 本插件已随 v2.3.7 进仓库。接口形状按 muse2api
> 源码（czg86389-hub/muse2api，version.json 1.6.14，2026-11-24 更新）与
> 画布请求体实录核对，见 `~/workspace/goals/ai/hidden_files/muse2api-local-verify-2026-11-27.md`。
> 真机验收（Windows + 用户本人导号）仍待做，见文末清单。

## 插件身份

- 插件包名：`beeftv-plugin-muse`（1.0.0）
- 默认 Base URL：`http://127.0.0.1:18610`（不要在末尾加 `/v1`）
- 鉴权方式：`Authorization: Bearer <MUSE2API_KEY>`
- 中继：muse2api（MIT），画布与中继必须在同一台机器上（结果地址是中继的本地地址）

## 贡献的视频协议 Provider

| Provider ID | 适用模型 | 创建接口 | 轮询接口 |
| --- | --- | --- | --- |
| `muse-video` | muse-video | `POST /v1/videos` | `GET /v1/videos/{{taskId}}` |

文本 muse-spark 不声明 provider，走宿主通用 `chat-completion`
（`POST /v1/chat/completions`）；图片 muse-image 不声明 provider，
走宿主通用 `openai-image`（`POST /v1/images/generations` /
`POST /v1/images/edits`）。这两条零代码走线已由画布请求体实录确认，
见验证报告第 2 节。

### 提交（create）

```json
{
  "model": { "$ref": "request.model" },
  "prompt": { "$ref": "request.prompt" },
  "duration": { "$if": "request.duration > 0 才发送（整数）" },
  "aspect_ratio": { "$omitEmpty": "request.aspectRatio" },
  "resolution": { "$omitEmpty": "request.resolution" },
  "images": { "$omitEmpty": "$map: request.images -> media.value（按顺序）" }
}
```

关键对照（muse2api `app.py`）：

- **必须是 JSON**：`create_video` 的参数是单个 Pydantic 模型
  `VideoRequest`（`app.py:1695`），FastAPI 只按 JSON 解析；
  内置 newapi 发的 `multipart/form-data` 会回 422
  （`{"error":{"message":"请求参数校验失败：…","code":422}}`）。
  本插件 `contentType: "application/json"`。
- **时长字段是 `duration`（整数），不是 `seconds`**：
  `VideoRequest` 没有 `seconds` 字段，未知字段会被 Pydantic 默认忽略，
  `seconds` 发过去等于没发；`duration` 为空时中继按 6 秒写进提示词
  （`build_video_prompt`，`app.py:1034`：`dur = r.duration or 6`）。
  `duration` 为 0 时不发（`$omitEmpty` 对数字 0 不生效，改用
  `$if` + `$gt` 守卫——与 myxsai 插件同一写法）。
- **`aspect_ratio` 与 `size` 的取舍**：中继把这两个值只拼进提示词
  （`build_video_prompt`，`app.py:1030-1085`），不作结构化参数；
  `"16:9"` 会触发 16:9 横屏分支、`"9:16"` 触发竖屏分支。本插件只发
  `aspect_ratio`（取 `request.aspectRatio`，即画布的画幅比字面值），
  不再另发 `size`——两个字段读的是同一批分支，重复发没有收益，
  反而多一个被未来版本误解的口子。
- **`images` 是 data URL 优先**：`media.value` 在无 URL 时取 DataURL；
  中继 `_prepare_reference_images`（`app.py:1478`）接受 data URL
  （base64 解码校验）；URL 形式只接受公网地址——中继默认
  `ref_image_local_files=0`、`ref_image_private_fetch=0`，
  localhost/私网 URL 会被挡（`config.py`）。画布本地素材没有公网
  URL，走 DataURL，正好绕过这个限制。
- **参考图上限**：中继 `MAX_REFERENCE_IMAGES = 10`，单张 40 MiB、
  总计 100 MiB（`engine.py:44-46`），超了回 400。
- **`resolution` 只是提示词文本**：中继把它拼成“画质规格：…”追加到
  提示词里（`app.py:1082`），上游是否采纳未验证；本插件原样透传，
  不设允许值白名单（没有出处，不猜）。
- **不发 `seconds`、`input_reference`**：前者会被忽略，后者是内置
  newapi 的字段名，中继不认识。

提交成功返回
`{"id","task_id","object":"video.task","status":"queued","progress":10,…}`
（`app.py:1736` 前后）。**提交时不检查账号**：无账号也会先回 200
`queued`，失败在轮询时才暴露（见“无账号行为”）。

### 轮询（poll）

`GET /v1/videos/{{taskId}}`。注意：`{{taskId}}` 插值只在 `path`
字段生效（`backend/internal/protocol/manifest_adapter.go:237`
对 path 做 `ReplaceAll("{{taskId}}")`），不能写进 `query` 字段。

轮询返回任务原文（`get_video`，`app.py:1736-1762`）：

- `status`：`queued` / `processing` / `completed` / `failed`。
  其中 `succeeded`/`success`/`done` 会先被中继归一成 `completed`；
  画布侧 `normalizeStatus`（`backend/internal/protocol/builtin_helpers.go:192`）
  再归一：`queued`→pending、`processing`→processing、
  `completed`→succeeded、`failed`→failed。所以 `response.status`
  直接 `$ref` 即可，不用 `$switch` 翻译。
- 成功时 `url` 一定在顶层，`video.url` 与 `result.url` 是同一地址的
  副本（`get_video` 会补齐）。`videos` 按以下顺序 `$coalesce` 提取：
  `response.url` → `response.video.url` → `response.result.url` →
  `response.data.url` → `response.data.video.url` →
  `response.data.result.url` → `response.data.videos` →
  `response.videos`。
- `resultEphemeral: true`：结果地址是中继本地地址
  （`http://127.0.0.1:18610/v1/media/…`），按临时地址处理，与
  myxsai 插件一致。
- `errorPaths: ["error", "error.message"]`：失败任务的 `error`
  字段（字符串或对象）会把状态强制打成 failed；成功响应没有
  `error` 字段，不会误伤。不设 `successCodes`：中继没有业务码字段，
  只用真实 HTTP 状态（404/422/502），非 2xx 由传输层先拦下。
  任务不存在时轮询回 404 `{"error":{"message":"task 不存在",…}}`。
  错误文案的 `$coalesce` 把 `response.error.message` 放
  `response.error` 前面：404 信封的 `error` 是对象，先取对象
  会整段 JSON 当文案；`error` 是字符串时 `error.message` 取不到
  （宿主对字符串取子键返回缺失），自动落到字符串本身，两形都对。

### 无账号行为（源码结论，未经真服务验证）

| 接口 | 无账号时 |
| --- | --- |
| `POST /v1/chat/completions` | 同步 400 `没有可用账号，请先在管理页面导入 cookie` |
| `POST /v1/images/generations` | 同步 502 `没有可用的生成账号，请检查账号池` |
| `POST /v1/images/edits` | 同步 502（同一 `_run_generation` 抛错路径） |
| `POST /v1/videos` | 先回 200 `queued`；轮询时任务变 `failed`，error 为 `没有可用的生成账号，请检查账号池` |
| `GET /v1/videos/{task_id}` | 正常返回任务；失败任务 `status: "failed"` |

面板文案已按此写：先在中继管理页导号再生成。

### 图片 size 的已知偏差（不经本插件，但影响生图）

画布生图（nil capability）把画幅比转成像素尺寸再发：
`size: "1824x1024"`（`NormalizePixelSize("16:9")`）。中继
`build_image_prompt`（`app.py:796-835`）只认 `"16:9"`、`"1280x720"`、
`"1920x1080"` 等字面值，`"1824x1024"` 命中不了任何分支，只会作为
“尺寸/比例：1824x1024”纯文本追加进提示词——16:9 指令不会被触发。
`1024x1024`（1:1）是唯一命中的像素值。真机验收时要看 16:9 生图
是否真出横屏；若不出，修法是在图片走线（非本插件）把 `size` 改发
`"16:9"` 或补 `aspect_ratio: "16:9"`，不要在中继侧猜映射。

## 模型目录

`GET {baseUrl}/v1/models`，`Authorization: Bearer <Key>`，返回
`{"object":"list","data":[{"id":"muse-spark",…},{"id":"muse-image",…},{"id":"muse-video",…}]}`。
`client/presets.js` 的 `fetchMuseModels` 按此解析；任何失败返回 `[]`，
面板回退到静态三模型。

## 真机验收清单（Windows + 用户本人导号后）

1. 中继启动：`MUSE2API_KEY` 从日志/`.env` 复制进面板；`GET /v1/models`
   返回三个模型；`/healthz` 与 `/readyz` 行为与源码一致。
2. 聊天：画布里 muse-spark 回一段文字（无账号时应看到 400 文案）。
3. 生图：muse-image 无参考出一张图；有参考（edits）出一张改过的图；
   16:9 是否真出横屏（见上节偏差）。
4. 生视频：muse-video 5 秒无参考出一段视频；带一张参考图（首帧）
   出一段视频；轮询 `completed` 后画布能取回本地地址的视频。
5. 时长：分别测 duration 5 / 8 / 10，核对成片时长是否与要求一致
   （中继只把时长写进提示词，最终由上游决定）。
6. 画幅：9:16 是否真出竖屏。
7. 无账号：四条无账号行为是否与上表一致。
