// 梦由心生AI（myxsai.com）预置模型清单、渠道构建与旧配置自动修复逻辑。
// 文本走宿主通用 chat-completion；图片 / 视频走站内媒体协议 myxsai-media
// （POST /v1/media/generate 提交，GET /v1/media/status?task_id=xxx 轮询）。
// 音频：没有已验证的音频模型 ID，静态预置里不放音频模型；运行时的音频模型
// 只能由按类型拉取（fetchMyxsaiModelsByType）补进，且不自动勾选、不指派协议。

export const DEFAULT_BASE_URL = "https://api.lk888.ai";
export const MYXSAI_CHANNEL_ID = "myxsai";
export const MYXSAI_CHANNEL_NAME = "梦由心生AI";
export const MYXSAI_MEDIA_PROTOCOL = "myxsai-media";

const DEFAULT_VIDEO_REFERENCES = {
  promptMaxChars: 2000,
  minImages: 0,
  maxImages: 9,
  maxImageBytes: 30 * 1024 * 1024,
  minImageWidth: 0,
  maxImageWidth: 0,
  minImageHeight: 0,
  maxImageHeight: 0,
  minImageAspectRatio: 0,
  maxImageAspectRatio: 0,
  minImagePixels: 0,
  maxImagePixels: 0,
  maxVideos: 3,
  maxVideoBytes: 200 * 1024 * 1024,
  minVideoDurationSeconds: 0,
  maxVideoDurationSeconds: 15,
  maxVideoTotalDurationSeconds: 0,
  minVideoWidth: 0,
  maxVideoWidth: 0,
  minVideoHeight: 0,
  maxVideoHeight: 0,
  minVideoAspectRatio: 0,
  maxVideoAspectRatio: 0,
  minVideoPixels: 0,
  maxVideoPixels: 0,
  minVideoFps: 0,
  maxVideoFps: 0,
  maxAudios: 3,
  maxAudioBytes: 15 * 1024 * 1024,
  minAudioDurationSeconds: 0,
  maxAudioDurationSeconds: 15,
  maxAudioTotalDurationSeconds: 0,
  maxTotalReferences: 0,
};

const TEXT_CAPABILITY_CONFIG = {
  version: 1,
  text: {
    references: { promptMaxChars: 12000, maxImages: 0, maxImageBytes: 0 },
    streaming: true,
    thinking: true,
  },
};

// 异步生图的能力规格：形状照抄 ysdui-image-task（WAND-Vega 异步图）预置，
// 尺寸档位取通用画幅（站方是否支持 size/quality 参数未验证，见 docs/interface.md）。
const IMAGE_CAPABILITY_CONFIG = {
  version: 1,
  image: {
    references: {
      promptMaxChars: 4000,
      maxImages: 10,
      maxImageBytes: 10 * 1024 * 1024,
      maskSupported: false,
    },
    size: {
      parameter: "size",
      values: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      default: "1:1",
      allowCustom: true,
    },
    quality: {
      supported: false,
      values: [],
      default: "auto",
    },
    transparentBackground: { supported: false, default: false },
    sequentialGeneration: { supported: false, default: false },
    responseFormat: { supported: true, value: "url" },
    outputFormat: { supported: false },
    maxOutputs: 1,
  },
};

// 在通用生图配置上改几个字段，拼出单个模型的生图能力。只改 ImageCapabilityConfig
// 里本来就有的表达位，不新造字段。
function myxsaiImageCapability({ size, quality, transparentBackground, outputFormat, maxOutputs, maxImages }) {
  const config = structuredClone(IMAGE_CAPABILITY_CONFIG);
  if (size) config.image.size = { ...config.image.size, ...size };
  if (quality) config.image.quality = { ...config.image.quality, ...quality };
  if (transparentBackground) config.image.transparentBackground = { ...config.image.transparentBackground, ...transparentBackground };
  if (outputFormat) config.image.outputFormat = { ...config.image.outputFormat, ...outputFormat };
  if (maxOutputs !== undefined) config.image.maxOutputs = maxOutputs;
  if (maxImages !== undefined) config.image.references.maxImages = maxImages;
  return config;
}

// 分模型生图能力的版本号：预置表里的生图配置改动时一起递增。宿主
// modelCapabilityConfigFor 对带 imageCapabilitiesVersion 的 profile 原样采用
// 其 capabilityConfig，不走 Seedream 分族兜底替换
// （web/src/lib/model-capabilities.ts:387），所以 5.5 的无透明背景、张数 50、
// 1K/1.5K/2K 档位等能真正落到面板上；已存 profile 由 upgradeMyxsaiModelProfile
// 按版本号同步，版本一致才不动。本插件的生图配置都通过宿主的
// sanitizeServerImageCapability 形状校验（references/size/quality/
// transparentBackground/responseFormat/outputFormat 齐全），所以宿主的目录合并
// 也会保留带版本的已存配置（channel-model-catalog.ts 保留分支）。
export const MYXSAI_IMAGE_CAPABILITIES_VERSION = "myxsai-1";

// 分模型生图能力：数值与选项来自梦由心生模型广场实录（抄录 2026-11-28，
// 见 docs/interface.md），只填实录里有的；没有实录的模型（doubao-seedream-5-0-pro-260628、
// kling-v3）不在这张表里，继续用通用配置并在预置旁注明“未验证”。
// 宿主渲染语义（web/src/lib/image-size-presets.ts、image-settings-panel.tsx）：
// size.parameter "aspect_ratio" + quality 值能映射 1K/2K/4K 档位时，面板出“分辨率”
// 档位按钮 + 宽高比网格，单独的“质量”区被隐藏；quality 不支持时面板不出分辨率区，
// 但也拼不出宽高比预设（比例网格为空，见 interface.md）；transparentBackground
// supported 才出透明背景开关；maxOutputs > 1 才出张数区。
const MYXSAI_IMAGE_CAPABILITY_BY_MODEL = {
  // tt-image-2.5：宽高比 自适应/1:1/16:9/9:16/4:3/3:4/3:2/2:3/5:4/4:5/2:1/1:2/21:9/9:21
  // ＋自定义；分辨率 自适应/1K/2K/4K；画质 自适应/低/中/高/超高/极致；透明背景有
  // （三档：不要/要/自适应）；张数上限 50。画质档按宿主既有映射写进 quality.values
  // （low→1K、medium→2K、high→4K）：面板上低/中/高以分辨率档位按钮出现，单独的
  // 质量区被隐藏；xhigh（超高）/max（极致）没有对应的档位按钮，面板上选不到；
  // 自适应画质只是 quality 默认值 auto，选过档位后回不去。透明背景站上是三档，
  // 宿主类型只有 boolean，“自适应”档无法表达，这里只声明 supported:true、default:false，
  // 面板只出一个开关。allowCustom:true，但画布高级设置面板以 presetsOnly 渲染，
  // 不出自定义比例输入框，自定义比例在面板上填不了。
  "tt-image-2.5": myxsaiImageCapability({
    size: {
      parameter: "aspect_ratio",
      values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "2:1", "1:2", "21:9", "9:21"],
      default: "auto",
      allowCustom: true,
    },
    quality: { supported: true, values: ["auto", "low", "medium", "high", "xhigh", "max"], default: "auto" },
    transparentBackground: { supported: true, default: false },
    maxOutputs: 50,
  }),
  // banana-pro：宽高比 自动/1:1/2:3/3:2/3:4/4:3/4:5/5:4/9:16/16:9/21:9（无自定义）；
  // 分辨率 1K/2K/4K（无自适应）；无画质档、无透明背景、无格式；参考图最多 14 张；
  // 张数上限 50。站上 Banana 没有画质档，1K/2K/4K 是分辨率档；宿主没有独立的
  // 分辨率字段，按宿主既有模式（agnes/grok：quality 字段借作分辨率档位）写进
  // quality.values，面板上显示为“分辨率”区。宽高比有自动，分辨率无自适应（默认 2K）。
  "banana-pro": myxsaiImageCapability({
    size: {
      parameter: "aspect_ratio",
      values: ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
      default: "auto",
      allowCustom: false,
    },
    quality: { supported: true, values: ["1k", "2k", "4k"], default: "2k" },
    transparentBackground: { supported: false, default: false },
    maxOutputs: 50,
    maxImages: 14,
  }),
  // doubao-seedream-5-5-261028：宽高比 自动/1:1/4:3/3:4/16:9/9:16/3:2/2:3/21:9；
  // 分辨率 1K/1.5K/2K（无 4K、无自适应）；输出格式 JPEG/PNG；无画质档、无透明背景；
  // 参考图最多 10 张；张数上限 50。
  // 注意——本配置能真正落到面板上：生图 profile 带 imageCapabilitiesVersion，
  // 宿主 modelCapabilityConfigFor 原样采用插件配置，不走 Seedream 分族兜底替换
  // （web/src/lib/model-capabilities.ts:387）。仍有两项表达不进面板：① 宽高比列表
  // 无处可写，宿主 Seedream 面板用固定的 IMAGE_RATIOS（10 档，含站上没有的
  // 4:5/5:4）渲染；② 输出格式 JPEG/PNG 写不进配置：ImageCapabilityConfig.outputFormat
  // 只有 supported，没有值列表。见 interface.md。
  "doubao-seedream-5-5-261028": myxsaiImageCapability({
    size: { parameter: "size", values: ["1K", "1.5K", "2K"], default: "2K", allowCustom: true },
    quality: { supported: false, values: [], default: "auto" },
    transparentBackground: { supported: false, default: false },
    outputFormat: { supported: true },
    maxOutputs: 50,
    maxImages: 10,
  }),
  // qwen-image：宽高比 自动/1:1/2:3/3:2/3:4/4:3/9:16/16:9/21:9；无单独分辨率；
  // 无画质档、无透明背景、无格式；张数上限 50。无分辨率按现有 profile 语义表达：
  // quality 不支持，面板不显示分辨率区。但宿主只有“比例×档位”才能拼出宽高比预设，
  // 无档位时比例网格为空（面板显示“未配置预设尺寸”），宽高比在面板上选不了，
  // 只能走 size 默认 auto（不发 aspect_ratio）——宿主侧限制，见 interface.md。
  // 提示词优化开关宿主面板没有对应控件，不接。
  "qwen-image": myxsaiImageCapability({
    size: {
      parameter: "aspect_ratio",
      values: ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
      default: "auto",
      allowCustom: false,
    },
    quality: { supported: false, values: [], default: "auto" },
    transparentBackground: { supported: false, default: false },
    maxOutputs: 50,
  }),
  // mj_imagine：宽高比 1:1/16:9/9:16/4:3/3:4/3:2/2:3/4:5/5:4/21:9（无自动、无自定义）；
  // 参考图最多 4 张；张数上限 50。质量 0.25/0.5/1/2 倍率、风格化、混乱度、Raw 风格：
  // 宿主面板没有对应控件，且媒体协议 manifest（package.json）根本没有 quality 参数，
  // 声明 quality.values 也发不出去，故不声明 quality。比例网格同 qwen-image：
  // 无档位时面板比例网格为空。
  "mj_imagine": myxsaiImageCapability({
    size: {
      parameter: "aspect_ratio",
      values: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"],
      default: "1:1",
      allowCustom: false,
    },
    quality: { supported: false, values: [], default: "auto" },
    transparentBackground: { supported: false, default: false },
    maxOutputs: 50,
    maxImages: 4,
  }),
};

const VIDEO_CAPABILITY_CONFIG = {
  version: 1,
  video: {
    references: {
      ...DEFAULT_VIDEO_REFERENCES,
      minVideoDurationSeconds: 2,
      minAudioDurationSeconds: 2,
    },
    duration: { selection: "enum", values: [4, 5, 6, 7, 8, 9, 10], default: 5 },
    ratios: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
    defaultRatio: "16:9",
    resolutions: ["480P", "720P", "1080P"],
    defaultResolution: "720P",
    generateAudio: { supported: true, default: true },
    watermark: { supported: false, default: false },
    returnLastFrame: { supported: false, default: false },
    operations: ["text_to_video", "image_to_video", "reference_to_video"],
    defaultOperation: "text_to_video",
  },
};

// Seedance 2.5 专属能力：只在有证据的两个 Seedance 2.5 模型上声明 extend（视频续写）。
// 证据：站方模型标签含“视频编辑/视频延长”，走媒体协议 _quan_neng_mode: "extend" + video_url
//（1–10 个片段、单段 2–30 秒、总计 ≤30 秒、aspect_ratio 须为 adaptive）。
// 局部修改（inpaint）上游虽有 edit 能力，但站内客户端无 edit 入口，需真 Key 实测，暂不声明。
const SEEDANCE_VIDEO_CAPABILITY_CONFIG = structuredClone(VIDEO_CAPABILITY_CONFIG);
SEEDANCE_VIDEO_CAPABILITY_CONFIG.video.operations = [...SEEDANCE_VIDEO_CAPABILITY_CONFIG.video.operations, "extend"];

// 手抄价格：全部来自梦由心生模型广场公开卡片价（“最低……起”的数字原样抄，
// 不加币种符号、不换算），抄录日期 2026-11-28；形状是 MyxsaiModelPrice
// { priceMin, priceMax?, outputPriceMin?, billingMode }。站上给不出唯一对应价的
// 模型（qwen-image、doubao-seedance-2-5-260628、seedance-2.5-guanfang、wan3.0）
// 不写 pricing，面板显示“价格待确认”，原因见各条目旁与 docs/interface.md。
// icon 是 lobehub 图标 id（对照 web/node_modules/@lobehub/icons/es/toc.json 现查；
// toc 里没有的 Wan 不写 icon）。GLM 用 ChatGLM：toc 里没有 GLM 本身，用智谱
// ChatGLM 产品图标。
export const MYXSAI_PRESET_MODELS = [
  // ---- 聊天：POST /v1/chat/completions（宿主通用 chat-completion）----
  {
    model: "doubao-seed-2-1-pro-260628",
    displayName: "豆包 Seed 2.1 Pro",
    family: "豆包",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "Doubao",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 6.7924，输出 34.1095。
    pricing: { priceMin: 6.7924, outputPriceMin: 34.1095, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "kimi-k3",
    displayName: "Kimi K3",
    family: "Kimi",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "Kimi",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 22.149，输出 110.745。
    pricing: { priceMin: 22.149, outputPriceMin: 110.745, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    family: "DeepSeek",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "DeepSeek",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 1.9004，输出 5.7012。
    pricing: { priceMin: 1.9004, outputPriceMin: 5.7012, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "qwen4-max",
    displayName: "Qwen4 Max",
    family: "Qwen",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "Qwen",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 10.1191，输出 30.2437。
    pricing: { priceMin: 10.1191, outputPriceMin: 30.2437, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "glm-5.3",
    displayName: "GLM 5.3",
    family: "GLM",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "ChatGLM",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 1.9491，输出 6.8219。
    pricing: { priceMin: 1.9491, outputPriceMin: 6.8219, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "MiniMax-M3.1-Flash",
    displayName: "MiniMax M3.1 Flash",
    family: "MiniMax",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    icon: "Minimax",
    // 价格手抄：梦由心生模型广场，2026-11-28。输入 1.4766，输出 5.9064。
    pricing: { priceMin: 1.4766, outputPriceMin: 5.9064, billingMode: "按token" },
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  // ---- 生图：媒体协议 POST /v1/media/generate ----
  {
    model: "doubao-seedream-5-5-261028",
    displayName: "豆包 Seedream 5.5",
    family: "豆包 Seedream",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Doubao",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.1183/次。
    pricing: { priceMin: 0.1183, billingMode: "按次" },
    capabilityConfig: structuredClone(MYXSAI_IMAGE_CAPABILITY_BY_MODEL["doubao-seedream-5-5-261028"]),
  },
  {
    model: "banana-pro",
    displayName: "Banana Pro",
    family: "Banana",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "NanoBanana",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.0812/次。
    pricing: { priceMin: 0.0812, billingMode: "按次" },
    capabilityConfig: structuredClone(MYXSAI_IMAGE_CAPABILITY_BY_MODEL["banana-pro"]),
  },
  {
    model: "qwen-image",
    displayName: "Qwen Image",
    family: "Qwen",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Qwen",
    // 无价格：站上暂无法显示价格，不编。
    capabilityConfig: structuredClone(MYXSAI_IMAGE_CAPABILITY_BY_MODEL["qwen-image"]),
  },
  {
    model: "doubao-seedream-5-0-pro-260628",
    displayName: "豆包 Seedream 5.0 Pro",
    family: "豆包 Seedream",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Doubao",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.2658/次。
    pricing: { priceMin: 0.2658, billingMode: "按次" },
    // 生图能力未验证：站上无该模型实录，继续用通用配置（带版本，宿主原样采用）。
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "mj_imagine",
    displayName: "MJ Imagine",
    family: "Midjourney",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Midjourney",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.4134/次。
    pricing: { priceMin: 0.4134, billingMode: "按次" },
    capabilityConfig: structuredClone(MYXSAI_IMAGE_CAPABILITY_BY_MODEL["mj_imagine"]),
  },
  {
    model: "kling-v3",
    displayName: "Kling V3",
    family: "Kling",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Kling",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.1772/次。
    pricing: { priceMin: 0.1772, billingMode: "按次" },
    // 分类核对（2026-11-28）：站上把“可灵-V3”列在图片类（0.1772/次），视频类
    // 另有不同条目“可灵-V3-video”；应用内预置的模型 ID 就是 kling-v3，对应站上
    // 图片类的那条，所以 capability 保持 "image"，不要改成 video。
    // 生图能力未验证：站上无该模型实录，继续用通用配置。
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  // ---- 生视频：媒体协议 POST /v1/media/generate ----
  {
    model: "doubao-seedance-2-5-260628",
    displayName: "豆包 Seedance 2.5",
    family: "豆包 Seedance",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Doubao",
    // 无价格：站上 Seedance 2.5 各变体价格不同，无法确定对应哪张卡，不编。
    capabilityConfig: structuredClone(SEEDANCE_VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "kling-v4-video",
    displayName: "Kling V4 Video",
    family: "Kling",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Kling",
    // 价格手抄：梦由心生模型广场，2026-11-28。1.1628/秒。
    pricing: { priceMin: 1.1628, billingMode: "按秒" },
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "hailuo-h3",
    displayName: "Hailuo H3",
    family: "MiniMax Hailuo",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Hailuo",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.0487/秒。站上海螺 H3 非 Max
    // 非升 2K 的各模式均为 0.0487/秒。
    pricing: { priceMin: 0.0487, billingMode: "按秒" },
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "seedance-2.5-guanfang",
    displayName: "Seedance 2.5 官方",
    family: "豆包 Seedance",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Doubao",
    // 无价格：站上 Seedance 2.5 各变体价格不同，无法确定对应哪张卡，不编。
    capabilityConfig: structuredClone(SEEDANCE_VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "kling-v4-flash",
    displayName: "Kling V4 Flash",
    family: "Kling",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Kling",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.7309/秒。
    pricing: { priceMin: 0.7309, billingMode: "按秒" },
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "hailuo-h3-cankaosheng",
    displayName: "Hailuo H3 参考生",
    family: "MiniMax Hailuo",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Hailuo",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.0487/秒。
    pricing: { priceMin: 0.0487, billingMode: "按秒" },
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "viduq4-preview",
    displayName: "Vidu Q4 Preview",
    family: "Vidu",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    icon: "Vidu",
    // 价格手抄：梦由心生模型广场，2026-11-28。0.2284/秒。
    pricing: { priceMin: 0.2284, billingMode: "按秒" },
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "wan3.0",
    displayName: "Wan 3.0",
    family: "Wan",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    // 无 icon：lobehub toc 里没有 Wan，不写 icon，宿主侧无图标时显示默认占位图标。
    // 无价格：站上“万相 3.0”0.1705/秒与“万相3.0 文生视频”0.443/秒，无法确定对应哪条，不编。
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  // 注意：音频没有已验证的模型 ID，静态预置里故意不放音频模型。
];

function isMyxsaiChannelLike(channel) {
  if (!channel || typeof channel !== "object") return false;
  if (channel.id === MYXSAI_CHANNEL_ID) return true;
  try {
    const host = new URL(String(channel.baseUrl || "").trim()).hostname.toLowerCase();
    return host === "api.lk888.ai" || host.endsWith(".lk888.ai");
  } catch {
    return false;
  }
}

function stableJson(value) {
  if (value === null || value === undefined || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
}

export function upgradeMyxsaiModelProfile(profile, channel, presetModels = MYXSAI_PRESET_MODELS) {
  if (!profile || typeof profile !== "object") return profile;
  const isMyxsaiProtocol = String(profile.protocol || "").startsWith("myxsai-");
  if (!isMyxsaiProtocol && !isMyxsaiChannelLike(channel)) return profile;
  const preset = presetModels.find((item) => item.model === profile.model);
  if (!preset) return profile;

  let next = profile;

  if (next.protocol !== preset.protocol || next.capability !== preset.capability) {
    next = {
      ...next,
      displayName: next.displayName || preset.displayName,
      capability: preset.capability,
      protocol: preset.protocol,
      authType: "bearer",
    };
  }

  // 预置的手抄价只补缺不覆盖：已存价可能是拉取到的实时价（buildChannel 里
  // 拉取条目优先于预置，见 buildMyxsaiModelChannel），比手抄价新，覆盖就丢了；
  // 预置无值时也不动。手抄价本身过期后靠重新同步（buildChannel 重建）更新，
  // 不在这里覆盖。
  if (!next.pricing && preset.pricing) {
    next = { ...next, pricing: structuredClone(preset.pricing) };
  }
  // 图标以预置为准：预置是可渲染的 lobehub id，拉取到的站方图标字段未验证过、
  // 宿主不认 URL 形状，留着只会回落到默认图标。
  if (preset.icon && next.icon !== preset.icon) {
    next = { ...next, icon: preset.icon };
  }

  if (next.capabilitySource === "user") return next;

  // 生图能力按版本号同步：带 imageCapabilitiesVersion 的 profile，宿主原样采用
  // 其 capabilityConfig（不走 Seedream 分族兜底），所以版本号必须跟预置表一起
  // 走；版本一致且配置相同才不动。旧的“带版本就直接返回”会让已存 profile 永远
  // 收不到预置改动，这里按版本号比较，不再无条件返回。
  const presetImageVersion = preset.capability === "image" && preset.capabilityConfig?.image
    ? MYXSAI_IMAGE_CAPABILITIES_VERSION
    : undefined;
  if (presetImageVersion) {
    if (next.imageCapabilitiesVersion !== presetImageVersion || stableJson(next.capabilityConfig) !== stableJson(preset.capabilityConfig)) {
      next = {
        ...next,
        imageCapabilitiesVersion: presetImageVersion,
        capabilityConfig: structuredClone(preset.capabilityConfig),
      };
    }
  } else if (stableJson(next.capabilityConfig) !== stableJson(preset.capabilityConfig)) {
    next = { ...next, capabilityConfig: structuredClone(preset.capabilityConfig) };
  }
  return next;
}

export function buildMyxsaiModelChannel({
  apiKey,
  baseUrl,
  selectedModels,
  existingChannel,
  presetModels: sourcePresets = MYXSAI_PRESET_MODELS,
  extraProfiles = [],
}) {
  const cleanUrl = String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  const cleanKey = String(apiKey || "").trim();
  // 按类型拉取到的模型以 extraProfiles 形式并入预置表参与勾选与建 profile。
  const combinedPresets = [...sourcePresets, ...extraProfiles.filter((item) => item && typeof item.model === "string")];
  const presetById = new Map(combinedPresets.map((item) => [item.model, item]));
  const chosenList =
    Array.isArray(selectedModels) && selectedModels.length
      ? selectedModels
      : combinedPresets.map((item) => item.model);
  const chosenSet = new Set(chosenList);

  const activePresets = combinedPresets.filter((item) => chosenSet.has(item.model));
  const presetModels = activePresets.map((item) => item.model);
  const presetProfiles = activePresets.map((item) => ({
    model: item.model,
    displayName: item.displayName,
    capability: item.capability,
    protocol: item.protocol,
    authType: "bearer",
    // 价格与图标字段名与宿主认的名字一致：pricing（宿主 MyxsaiModelPrice 与后端
    // 目录快照都认 pricing 这个字段名）、icon（宿主 modelProfiles[].icon）。
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.pricing ? { pricing: structuredClone(item.pricing) } : {}),
    ...(item.defaultOptions ? { defaultOptions: item.defaultOptions } : {}),
    ...(item.capabilityConfig ? { capabilityConfig: structuredClone(item.capabilityConfig) } : {}),
    // 版本化生图配置：宿主对带 imageCapabilitiesVersion 的 profile 原样采用
    // 其 capabilityConfig（不走 Seedream 分族兜底替换），分模型配置才能真正
    // 落到面板上；改动预置表时把版本号一起递增，升级靠版本号同步。
    ...(item.capability === "image" && item.capabilityConfig?.image ? { imageCapabilitiesVersion: MYXSAI_IMAGE_CAPABILITIES_VERSION } : {}),
  }));

  const existingCustomModels = Array.isArray(existingChannel?.models)
    ? existingChannel.models.filter(
        (modelId) => typeof modelId === "string" && modelId.trim() && !presetById.has(modelId) && chosenSet.has(modelId),
      )
    : [];
  const existingCustomProfiles = Array.isArray(existingChannel?.modelProfiles)
    ? existingChannel.modelProfiles.filter(
        (profile) => profile && typeof profile.model === "string" && !presetById.has(profile.model) && chosenSet.has(profile.model),
      )
    : [];

  return {
    id: MYXSAI_CHANNEL_ID,
    name: MYXSAI_CHANNEL_NAME,
    scope: "user",
    baseUrl: cleanUrl,
    apiKey: cleanKey,
    hasApiKey: Boolean(cleanKey),
    apiFormat: "openai",
    models: [...presetModels, ...existingCustomModels],
    modelProfiles: [...presetProfiles, ...existingCustomProfiles],
  };
}

// 按类型拉取分好类的模型：GET {baseUrl}/v1/media/models?type=<chat|image|video|audio>。
// 任何失败（网络 / CORS / 401 / 响应格式不对）都静默返回 []，调用方回退到静态代表模型。
// 该端点与返回体形状尚未用真 Key 验证过，见 docs/interface.md。
const TYPED_MODEL_CAPABILITY = { chat: "text", image: "image", video: "video", audio: "audio" };
const TYPED_MODEL_PROTOCOL = { chat: "chat-completion", image: MYXSAI_MEDIA_PROTOCOL, video: MYXSAI_MEDIA_PROTOCOL };
const TYPED_MODEL_ENDPOINT = { chat: "POST /v1/chat/completions", image: "POST /v1/media/generate", video: "POST /v1/media/generate" };
const TYPED_MODEL_CAPABILITY_CONFIG = { chat: TEXT_CAPABILITY_CONFIG, image: IMAGE_CAPABILITY_CONFIG, video: VIDEO_CAPABILITY_CONFIG };

// 拉取条目自带的类型字段：任一存在即用它校验。站方字段名未验证过，
// 依次认 modelType / type / category / model_type；值只认 chat/text、image、
// video、audio 这组词（大小写不敏感），认不出的值不丢弃、按请求时的 type 走。
const TYPED_MODEL_TYPE_FIELDS = ["modelType", "type", "category", "model_type"];
const TYPED_MODEL_TYPE_VALUES = { chat: "chat", text: "chat", image: "image", video: "video", audio: "audio" };

function declaredTypedModelType(entry) {
  if (!entry || typeof entry !== "object") return undefined;
  for (const field of TYPED_MODEL_TYPE_FIELDS) {
    const raw = entry[field];
    if (typeof raw !== "string" || !raw.trim()) continue;
    return TYPED_MODEL_TYPE_VALUES[raw.trim().toLowerCase()];
  }
  return undefined;
}

// 拉取到的生图模型按模型 id 查分模型能力表（tt-image-2.5 等只有拉取时才出现，
// 不在静态预置里）；查不到的继续用通用配置。-token 变体（banana-pro-token、
// tt-image-2.5-token 等）是站上单独列出的卡片、价格不同、是不同的可调用 ID，
// 这里不做归一、不合并，各自成行。
function typedModelCapabilityConfig(type, id) {
  if (type === "image") {
    const perModel = MYXSAI_IMAGE_CAPABILITY_BY_MODEL[id];
    return structuredClone(perModel || IMAGE_CAPABILITY_CONFIG);
  }
  const config = TYPED_MODEL_CAPABILITY_CONFIG[type];
  return config ? structuredClone(config) : undefined;
}

function normalizeTypedModelEntry(entry, type) {
  const id = typeof entry === "string" ? entry.trim() : String(entry?.id || entry?.model || entry?.name || "").trim();
  if (!id) return null;
  const capability = TYPED_MODEL_CAPABILITY[type];
  if (!capability) return null;
  // 条目自带类型字段时优先用它校验：与请求时的 type 不一致的丢弃（返回 null）。
  const declaredType = declaredTypedModelType(entry);
  if (declaredType && declaredType !== type) return null;
  const displayName = typeof entry === "object" && entry && typeof entry.displayName === "string" && entry.displayName.trim()
    ? entry.displayName.trim()
    : id;
  const pricing = extractMyxsaiPrice(entry);
  // 图标：站方 /v1/media/models 是否带图标字段尚未用真 Key 验证过，字段名也未验证，
  // 依次取 icon / logo / avatar_url，有就保留；没有就不写，宿主侧显示默认占位图标。
  const icon = typeof entry === "object" && entry
    ? ["icon", "logo", "avatar_url"]
        .map((field) => entry[field])
        .find((value) => typeof value === "string" && value.trim())?.trim()
    : undefined;
  const capabilityConfig = typedModelCapabilityConfig(type, id);
  const profile = {
    model: id,
    displayName,
    capability,
    ...(pricing ? { pricing } : {}),
    ...(icon ? { icon } : {}),
    ...(TYPED_MODEL_PROTOCOL[type] ? { protocol: TYPED_MODEL_PROTOCOL[type] } : {}),
    ...(TYPED_MODEL_ENDPOINT[type] ? { endpoint: TYPED_MODEL_ENDPOINT[type] } : {}),
    ...(capabilityConfig ? { capabilityConfig } : {}),
    ...(type === "image" && capabilityConfig?.image ? { imageCapabilitiesVersion: MYXSAI_IMAGE_CAPABILITIES_VERSION } : {}),
  };
  return profile;
}

// 梦由心生价格：字段名以模型广场公开接口 /gongkai/moxingguangchang 的实测
// 返回为准（price_min / price_max / output_price_min / price_available /
// billing_mode）。数值单位站方未说明，不加币种符号、不换算；接口没给价格
// （price_available 为 false，或 price_min 不是数字）时返回 null，调用方
// 显示“价格待确认”。/v1/media/models 是否带这些字段尚未用真 Key 验证过。
// 发出的字段名统一是 pricing（见 buildMyxsaiModelChannel 与
// normalizeTypedModelEntry），里面的形状是 MyxsaiModelPrice（驼峰：priceMin /
// priceMax / outputPriceMin / billingMode）。读入时两种写法都认：站方接口是
// 下划线，插件自己手抄的 pricing 对象是驼峰。
function pickFiniteNumber(...candidates) {
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function pickOptionalFiniteNumber(...candidates) {
  const value = pickFiniteNumber(...candidates);
  return value === null ? undefined : value;
}

function pickBillingMode(...candidates) {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function extractMyxsaiPrice(entry) {
  const source = entry && typeof entry === "object"
    ? (entry.price && typeof entry.price === "object" ? entry.price : entry.pricing && typeof entry.pricing === "object" ? entry.pricing : entry)
    : null;
  if (!source) return null;
  if (source.price_available === false || source.priceAvailable === false) return null;
  const priceMin = pickFiniteNumber(source.price_min, source.priceMin);
  if (priceMin === null) return null;
  const priceMax = pickOptionalFiniteNumber(source.price_max, source.priceMax);
  const outputPriceMin = pickOptionalFiniteNumber(source.output_price_min, source.outputPriceMin);
  const billingMode = pickBillingMode(source.billing_mode, source.billingMode);
  return {
    priceMin,
    ...(priceMax !== undefined ? { priceMax } : {}),
    ...(outputPriceMin !== undefined ? { outputPriceMin } : {}),
    ...(billingMode ? { billingMode } : {}),
  };
}

function formatPriceNumber(value) {
  return String(Number(value.toFixed(4)));
}

export function formatMyxsaiPrice(value) {
  const price = value && typeof value === "object" && "priceMin" in value ? value : extractMyxsaiPrice(value);
  if (!price) return null;
  const amount = formatPriceNumber(price.priceMin);
  switch (price.billingMode) {
    case "按次":
      return `${amount}/次`;
    case "按秒":
      return `${amount}/秒`;
    case "按token":
      if (price.outputPriceMin !== undefined) return `输入 ${amount}/百万 token，输出 ${formatPriceNumber(price.outputPriceMin)}/百万 token`;
      return `${amount}/百万 token`;
    default:
      return amount;
  }
}

function extractTypedModelList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.models)) return data.models;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.list)) return data.list;
    if (data.data && typeof data.data === "object") {
      if (Array.isArray(data.data.models)) return data.data.models;
      if (Array.isArray(data.data.list)) return data.data.list;
    }
  }
  return [];
}

export async function fetchMyxsaiModelsByType(baseUrl, apiKey, type, { timeoutMs = 10000 } = {}) {
  try {
    const cleanUrl = String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
    const cleanKey = String(apiKey || "").trim();
    if (!cleanKey || !TYPED_MODEL_CAPABILITY[type]) return [];
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const resp = await fetch(`${cleanUrl}/v1/media/models?type=${encodeURIComponent(type)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${cleanKey}`, Accept: "application/json" },
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!resp.ok) return [];
      const data = await resp.json().catch(() => null);
      const seen = new Set();
      return extractTypedModelList(data)
        .map((entry) => normalizeTypedModelEntry(entry, type))
        .filter((profile) => profile && !seen.has(profile.model) && seen.add(profile.model));
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

export const BUILTIN_SERVICE_PRESET = {
  id: MYXSAI_CHANNEL_ID,
  name: MYXSAI_CHANNEL_NAME,
  subtitle: "文本 · 图片 · 视频（音频按类型拉取）",
  icon: "OpenAI",
  baseUrl: DEFAULT_BASE_URL,
  partner: true,
  keysUrl: "https://myxsai.com",
  websiteUrl: "https://myxsai.com",
  protocolPrefixes: ["myxsai-"],
  hosts: ["api.lk888.ai"],
  // 注意：brief 原值 image 是 "openai-image"，已按代码核查结果改掉，见文件头与报告。
  // candidates 只在模型没有显式声明协议时才起作用（web/src/lib/model-service-presets.ts:296-300，
  // proposed = inherited || endpoint || candidates[capability]）；预置模型自带 protocol，
  // 不走这条回退。运行时拉到的图片/视频模型若走 openai-image，会被发往站上不存在的
  // POST /v1/images/generations，必须指向媒体协议 myxsai-media。
  // 音频没有已验证的协议，故不设 audio 回退，拉到的音频模型留给用户在模型服务里自选协议。
  candidates: { text: "chat-completion", image: MYXSAI_MEDIA_PROTOCOL, video: MYXSAI_MEDIA_PROTOCOL },
  models: MYXSAI_PRESET_MODELS,
  presetDescription: "文本、图片与视频",
  declaresReferenceMediaTransport: true,
  buildChannel(args) {
    return buildMyxsaiModelChannel({
      apiKey: args.apiKey,
      baseUrl: args.baseUrl,
      selectedModels: args.selectedModels,
      existingChannel: args.existingChannel,
      extraProfiles: args.extraProfiles || [],
      presetModels: this.models,
    });
  },
  upgradeProfile(profile, channel) {
    return upgradeMyxsaiModelProfile(profile, channel, this.models);
  },
};
