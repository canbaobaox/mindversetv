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
    "resolution": { "$switch": "仅 auto / 1K / 2K / 4K（大小写归一）才发，其余省略" },
    "duration": { "$if": "request.duration > 0 才发送" },
    "_quan_neng_mode": { "$if": "request.operation == \"extend\" 时为 \"extend\"，否则不发" },
    "video_url": { "$if": "request.operation == \"extend\" 时为 request.videos 的 URL 列表，否则不发" }
  }
}
```

视频续写（extend，仅 Seedance 2.5 的两个预置模型声明）：站方模型标签含“视频编辑/视频延长”，
`_quan_neng_mode: "extend"` + `video_url`（1–10 个片段、单段 2–30 秒、总计 ≤30 秒、
`aspect_ratio` 须为 `adaptive`——后端 `NormalizeSeedanceTaskOptions` 对 extend 已锁定 adaptive，
续写子节点本身也写死 `size: "adaptive"`）。`video_url` 只在 extend 时发，普通参考生视频
（`reference_to_video`）不发（站方对该模式是否接受 `video_url` 未验证，不乱发）。
局部修改（inpaint）未接：上游虽有 edit 能力，但站内客户端无 edit 入口，需真 Key 实测。

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

## 价格字段：`pricing`（v2.3.10）

插件发出的价格字段名是 `pricing`，不是 `price`（`client/presets.js`：
`buildMyxsaiModelChannel` 的 presetProfiles 与 `normalizeTypedModelEntry`；
`client/index.js` 面板读 `item.pricing`）。宿主 `MyxsaiModelPrice` 类型与后端
目录快照（`backend/internal/modelcatalog/catalog_fetch.go` 拼好的 `pricing`
对象）都认 `pricing` 这个字段名。里面的形状是 MyxsaiModelPrice（驼峰）：
`{ priceMin, priceMax?, outputPriceMin?, billingMode }`，billingMode 取值
“按次 / 按秒 / 按token”。`extractMyxsaiPrice` 读入时两种写法都认：站方接口
的下划线（`price_min` 等）与手抄对象的驼峰（`priceMin` 等）。

手抄价全部来自梦由心生模型广场公开卡片价（“最低……起”的数字原样抄，不加币种
符号、不换算），抄录日期 2026-11-28：

| 模型 | 价格 |
| --- | --- |
| doubao-seed-2-1-pro-260628 | 输入 6.7924，输出 34.1095 /百万 token |
| kimi-k3 | 输入 22.149，输出 110.745 /百万 token |
| deepseek-v4-pro | 输入 1.9004，输出 5.7012 /百万 token |
| qwen4-max | 输入 10.1191，输出 30.2437 /百万 token |
| glm-5.3 | 输入 1.9491，输出 6.8219 /百万 token |
| MiniMax-M3.1-Flash | 输入 1.4766，输出 5.9064 /百万 token |
| doubao-seedream-5-5-261028 | 0.1183/次 |
| banana-pro | 0.0812/次 |
| doubao-seedream-5-0-pro-260628 | 0.2658/次 |
| mj_imagine | 0.4134/次 |
| kling-v3 | 0.1772/次 |
| kling-v4-video | 1.1628/秒 |
| kling-v4-flash | 0.7309/秒 |
| hailuo-h3 | 0.0487/秒（站上海螺 H3 非 Max 非升 2K 的各模式均为 0.0487/秒） |
| hailuo-h3-cankaosheng | 0.0487/秒 |
| viduq4-preview | 0.2284/秒 |

没抄的（留无价，面板显示“价格待确认”，不编）：qwen-image（站上暂无法显示
价格）；doubao-seedance-2-5-260628、seedance-2.5-guanfang（站上 Seedance 2.5
各变体价格不同，无法确定对应哪张卡）；wan3.0（站上“万相 3.0”0.1705/秒与
“万相3.0 文生视频”0.443/秒，无法确定对应哪条）。

注意：宿主 `sanitizeMyxsaiModelPrice`（`web/src/lib/myxsai-model-pricing.ts`）
读的是下划线字段（`record.pricing ?? record` 里的 `price_min`）；插件面板
`formatMyxsaiPrice` 读驼峰。插件发出的驼峰 pricing 只在插件面板与
presetProfiles 里流通，宿主模型服务页的价格来自后端目录快照（下划线），两者
字段名相同、内层写法不同，不要混用。

## 图标：lobehub id（v2.3.10）

- 每个预置模型带 `icon`（lobehub 图标 id），对照
  `web/node_modules/@lobehub/icons/es/toc.json` 现查：豆包 / 豆包 Seedream /
  豆包 Seedance 三族都用 `Doubao`；Kimi 用 `Kimi`；DeepSeek 用 `DeepSeek`；
  Qwen 用 `Qwen`；GLM 用 `ChatGLM`（toc 里没有 GLM 本身，用智谱 ChatGLM 产品
  图标）；MiniMax 用 `Minimax`；MiniMax Hailuo 用 `Hailuo`；Banana 用
  `NanoBanana`；Midjourney 用 `Midjourney`；Kling 用 `Kling`；Vidu 用
  `Vidu`。Wan：toc 里没有对应 id，不写 icon。
- `buildMyxsaiModelChannel` 的 presetProfiles 把 icon 带上；宿主读
  `modelProfiles[].icon`（`web/src/stores/use-config-store.ts` `modelIcon`，
  `web/src/components/model-logo.tsx` `ModelLogo`）。无图标时 ModelLogo 回落为
  默认 Cpu 图标。
- `normalizeTypedModelEntry` 保留站方返回的图标字段，依次取 icon / logo /
  avatar_url（字段名未验证过，`/v1/media/models` 是否带图标字段尚未用真 Key
  验证）。

## 分类：kling-v3 与类型校验（v2.3.10）

- kling-v3 保持 capability `"image"`：站上把“可灵-V3”列在图片类（0.1772/次），
  视频类另有不同条目“可灵-V3-video”；应用内预置的模型 ID 就是 kling-v3，对应
  站上图片类的那条，不要改成 video。
- `normalizeTypedModelEntry`：条目自带类型字段（modelType / type / category /
  model_type，任一存在即用）时优先用它校验，与请求时的 type 参数不一致的丢弃
  （返回 null）；值只认 chat/text、image、video、audio，认不出的值不丢弃、按
  请求时的 type 走；没有自带类型字段的保持原有行为。
- `-token` 变体（banana-pro-token、tt-image-2.5-token 等）保持分开两行：站上
  把它们列为不同卡片、价格不同，是不同的可调用 ID，不合并、不归一。

## 分模型生图能力（v2.3.10）

`client/presets.js` 的 `MYXSAI_IMAGE_CAPABILITY_BY_MODEL` 按站上实录分模型写
生图能力（抄录 2026-11-28），只填实录里有的；静态预置与按类型拉取到的同名
模型（tt-image-2.5 只有拉取时才出现）共用这张表。

| 模型 | 宽高比 | 分辨率 | 画质 | 透明背景 | 参考图上限 | 张数上限 |
| --- | --- | --- | --- | --- | --- | --- |
| tt-image-2.5 | 自适应/1:1/16:9/9:16/4:3/3:4/3:2/2:3/5:4/4:5/2:1/1:2/21:9/9:21＋自定义 | 自适应/1K/2K/4K | 自适应/低/中/高/超高/极致 | 有（三档） | 通用 10 张 | 50 |
| banana-pro | 自动/1:1/2:3/3:2/3:4/4:3/4:5/5:4/9:16/16:9/21:9（无自定义） | 1K/2K/4K（无自适应） | 无 | 无 | 14 张 | 50 |
| doubao-seedream-5-5-261028 | 自动/1:1/4:3/3:4/16:9/9:16/3:2/2:3/21:9 | 1K/1.5K/2K（无 4K、无自适应） | 无 | 无 | 10 张 | 50 |
| qwen-image | 自动/1:1/2:3/3:2/3:4/4:3/9:16/16:9/21:9 | 无 | 无 | 无 | 通用 10 张 | 50 |
| mj_imagine | 1:1/16:9/9:16/4:3/3:4/3:2/2:3/4:5/5:4/21:9（无自动、无自定义） | 无 | 见下 | 无 | 4 张 | 50 |
| doubao-seedream-5-0-pro-260628、kling-v3 | 未验证，继续用通用配置 | — | — | — | 通用 10 张 | 通用 1 张 |

### 宿主渲染语义（只读核对，未改 web/src）

- 面板组件核对：高级设置入口是
  `web/src/components/canvas/canvas-image-settings-popover.tsx`（`高级设置`
  触发器，`aria-label={`高级设置：${summary}`}`）→
  `web/src/components/image-settings-panel.tsx`（`ImageSettingsPanel`）。报告
  说的组件就是这一个。截图里“分辨率 1K/2K/4K＋质量＋透明背景同时出现”与插件
  通用配置对不上（通用配置 quality / transparentBackground 均不支持）：唯一
  能同时出现三者的宿主配置，是模型没有 capabilityConfig 时的默认 fallback
  （`defaultImageCapabilityConfig`：quality auto/low/medium/high +
  transparentBackground 支持 + 像素尺寸预设 → 1K/2K/4K 档）。所以截图那个模型
  当时走的是宿主默认配置，不是插件配置。
- 按模型配置的生效链：`modelCapabilityConfigFor`（`web/src/lib/model-capabilities.ts`）
  → `mergeConfiguredImageCapability` 合并插件配置 → 非 Seedream 模型按插件
  配置渲染；`size.values` / `size.presets` 拼出分辨率档位与宽高比网格
  （`web/src/lib/image-size-presets.ts` `imageSizePresets`、`imageResolutionUsesQuality`；
  `size.parameter` 为 `aspect_ratio` 且 quality 值能映射 1K/2K/4K 档位时，面板
  出“分辨率”档位按钮＋宽高比网格，单独的“质量”区被隐藏），`quality.supported`
  才出质量区，`transparentBackground.supported` 才出透明背景开关，
  `maxOutputs > 1` 才出张数区，`references.maxImages` 只做校验与上限。
- Seedream 分族兜底（已被版本化配置绕过）：`modelCapabilityConfigFor`
  （`model-capabilities.ts:403`）经 `upgradeGPTImageCapability`，对所有
  Seedream 模型整段替换为 `seedreamImageCapability`
  （`web/src/lib/seedream-image.ts`，与协议无关）：size 值固定为
  1K/1.5K/2K（5.5 与 Pro）或 2K/4K（Lite），transparentBackground 支持
  （modern 族），outputFormat 支持（modern 族），maxOutputs 15，maxImages 10
  （modern）/ 14。但本插件的生图 profile 都带 `imageCapabilitiesVersion`
  （`MYXSAI_IMAGE_CAPABILITIES_VERSION`），宿主在替换之前先按版本直通原样采用
  插件配置（`model-capabilities.ts:387`），所以 5.5 的
  `transparentBackground.supported:false`、`maxOutputs:50`、1K/1.5K/2K 档位、
  maxImages 10 都能真正落到面板上。仍表达不进面板的两项：宽高比列表无处可写
  （宿主 Seedream 面板用固定的 `IMAGE_RATIOS` 10 档渲染，含站上没有的
  4:5/5:4）、输出格式 JPEG/PNG 无字段可写（`ImageCapabilityConfig.outputFormat`
  只有 supported，没有值列表）。
- 版本化直通（已启用）：profile 带 `imageCapabilitiesVersion` 且
  `capabilityConfig.image` 通过 `sanitizeServerImageCapability` 时，
  `modelCapabilityConfigFor` 原样采用插件配置、不走 Seedream 替换
  （`model-capabilities.ts:387`）。本插件的生图配置都通过该形状校验
  （references/size/quality/transparentBackground/responseFormat/outputFormat
  齐全，maxOutputs ≥ 1）。`upgradeMyxsaiModelProfile` 按版本号同步：版本一致
  且配置相同才不动，版本不一致时同步 capabilityConfig +
  imageCapabilitiesVersion + pricing + icon；用户自定义的 capabilityConfig
  （capabilitySource 为 "user"）不覆盖。改动预置表里的生图配置时，把
  `MYXSAI_IMAGE_CAPABILITIES_VERSION` 一起递增，否则已存 profile 收不到改动。

### 接不上的选项（已核对，不编）

- 提交链（`package.json` 的 manifest 参数只有 model / prompt / images /
  aspect_ratio / resolution / duration；后端
  `backend/internal/generation/protocol_request.go`：`request.Resolution` 取自
  `VQuality`，manifest 不读 `request.quality`）：面板档位选择写的是
  `config.quality`，不会作为 resolution 发给站方；真正发出去的 resolution 是
  画布 vquality 默认值（常为 `"720"`，被 manifest allowlist 挡掉→不发）。
  aspect_ratio 会发（size → `request.aspectRatio`）。quality /
  transparentBackground / outputFormat / count 均不在 manifest 参数里，发不出去。
- mj_imagine：质量 0.25/0.5/1/2 倍率、风格化、混乱度、Raw 风格，宿主面板没有
  对应控件，且 manifest 没有 quality 参数，声明 `quality.values` 也发不出去，
  故不声明。qwen-image：提示词优化开关宿主面板没有对应控件，不接。
- qwen-image / mj_imagine：无分辨率档位时宿主拼不出宽高比预设，面板比例网格
  为空（显示“未配置预设尺寸”），宽高比在面板上选不了，只能走 size 默认
  （qwen-image 为 auto，即不发 aspect_ratio；mj_imagine 为 1:1）。这是宿主
  “比例×档位”预设机制的限制，不是插件配置缺字段。
- tt-image-2.5：画质超高（xhigh）/极致（max）没有对应的档位按钮，面板上选
  不到；自适应画质只是 quality 默认值 auto，选过档位后回不去；透明背景站上是
  三档（不要/要/自适应），宿主类型只有 boolean，“自适应”档无法表达，面板只出
  一个开关；自定义比例 allowCustom:true，但画布高级设置面板以 presetsOnly
  渲染，不出自定义比例输入框，自定义比例在面板上填不了。另：9:21 在宿主
  `imagePresetForRatio` 里会按约分显示为 3:7（同一比例）。
- banana-pro：站上没有画质档，1K/2K/4K 是分辨率档；宿主没有独立的分辨率字段，
  按宿主既有模式（agnes/grok：quality 字段借作分辨率档位）写进
  `quality.values`，面板上显示为“分辨率”区。

## 需真 Key 实测清单

1. 拿一次真实生图任务的提交响应与每次轮询响应的原始 JSON 全文，逐字段对照
   上文（重点：`result_urls` / `result_url` 是否如公开客户端所写、`code`
   字段是否出现、`is_final` 与 `state` 是否同步变化）。
2. `images` 参考图是否被接受、接受 URL 还是 base64、字段名是不是 `images`。
3. `GET /v1/media/models?type=...` 是否存在、返回体形状、音频类型是否返回模型。
4. `aspect_ratio` / `resolution` / `duration` 在 `params` 里的取值范围与默认值。
   `resolution` 已有站方证据：2026-11-22 真机报错“参数 resolution 的值 720 不合法，
   支持的值：auto / 1K / 2K / 4K”，插件只发这四个值（大小写归一），720 / 720P /
   1080P 等一律省略、由服务端自己定，不猜映射。`aspect_ratio` 与 `duration`
   的取值范围仍未验证。
5. 实际轮询间隔是否为 5 秒；取消接口是否存在（本插件未声明 cancel，未编造）。
6. 另一轮询端点 `GET /v1/skills/task-status?task_id=` 与 `/v1/media/status`
   的响应是否相同（公开客户端两边都在用；本插件用前者）。
