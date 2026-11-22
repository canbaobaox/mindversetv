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

export const MYXSAI_PRESET_MODELS = [
  // ---- 聊天：POST /v1/chat/completions（宿主通用 chat-completion）----
  {
    model: "doubao-seed-2-1-pro-260628",
    displayName: "豆包 Seed 2.1 Pro",
    family: "豆包",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "kimi-k3",
    displayName: "Kimi K3",
    family: "Kimi",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    family: "DeepSeek",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "qwen4-max",
    displayName: "Qwen4 Max",
    family: "Qwen",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "glm-5.3",
    displayName: "GLM 5.3",
    family: "GLM",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
    capabilityConfig: structuredClone(TEXT_CAPABILITY_CONFIG),
  },
  {
    model: "MiniMax-M3.1-Flash",
    displayName: "MiniMax M3.1 Flash",
    family: "MiniMax",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
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
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "banana-pro",
    displayName: "Banana Pro",
    family: "Banana",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "qwen-image",
    displayName: "Qwen Image",
    family: "Qwen",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "doubao-seedream-5-0-pro-260628",
    displayName: "豆包 Seedream 5.0 Pro",
    family: "豆包 Seedream",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "mj_imagine",
    displayName: "MJ Imagine",
    family: "Midjourney",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(IMAGE_CAPABILITY_CONFIG),
  },
  {
    model: "kling-v3",
    displayName: "Kling V3",
    family: "Kling",
    capability: "image",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
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
    capabilityConfig: structuredClone(SEEDANCE_VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "kling-v4-video",
    displayName: "Kling V4 Video",
    family: "Kling",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "hailuo-h3",
    displayName: "Hailuo H3",
    family: "MiniMax Hailuo",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "seedance-2.5-guanfang",
    displayName: "Seedance 2.5 官方",
    family: "豆包 Seedance",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(SEEDANCE_VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "kling-v4-flash",
    displayName: "Kling V4 Flash",
    family: "Kling",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "hailuo-h3-cankaosheng",
    displayName: "Hailuo H3 参考生",
    family: "MiniMax Hailuo",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "viduq4-preview",
    displayName: "Vidu Q4 Preview",
    family: "Vidu",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
    capabilityConfig: structuredClone(VIDEO_CAPABILITY_CONFIG),
  },
  {
    model: "wan3.0",
    displayName: "Wan 3.0",
    family: "Wan",
    capability: "video",
    protocol: MYXSAI_MEDIA_PROTOCOL,
    endpoint: "POST /v1/media/generate",
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
  if (
    (typeof profile.imageCapabilitiesVersion === "string" && profile.imageCapabilitiesVersion.trim()) ||
    (typeof profile.videoCapabilitiesVersion === "string" && profile.videoCapabilitiesVersion.trim())
  ) {
    return profile;
  }
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
    if (next.capabilitySource !== "user") {
      return {
        ...next,
        capabilityConfig: structuredClone(preset.capabilityConfig),
      };
    }
    return next;
  }

  if (next.capabilitySource !== "user") {
    if (stableJson(next.capabilityConfig) !== stableJson(preset.capabilityConfig)) {
      return {
        ...next,
        capabilityConfig: structuredClone(preset.capabilityConfig),
      };
    }
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
    ...(item.defaultOptions ? { defaultOptions: item.defaultOptions } : {}),
    ...(item.capabilityConfig ? { capabilityConfig: structuredClone(item.capabilityConfig) } : {}),
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

function normalizeTypedModelEntry(entry, type) {
  const id = typeof entry === "string" ? entry.trim() : String(entry?.id || entry?.model || entry?.name || "").trim();
  if (!id) return null;
  const capability = TYPED_MODEL_CAPABILITY[type];
  if (!capability) return null;
  const displayName = typeof entry === "object" && entry && typeof entry.displayName === "string" && entry.displayName.trim()
    ? entry.displayName.trim()
    : id;
  const price = extractMyxsaiPrice(entry);
  const profile = {
    model: id,
    displayName,
    capability,
    ...(price ? { price } : {}),
    ...(TYPED_MODEL_PROTOCOL[type] ? { protocol: TYPED_MODEL_PROTOCOL[type] } : {}),
    ...(TYPED_MODEL_ENDPOINT[type] ? { endpoint: TYPED_MODEL_ENDPOINT[type] } : {}),
    ...(TYPED_MODEL_CAPABILITY_CONFIG[type] ? { capabilityConfig: structuredClone(TYPED_MODEL_CAPABILITY_CONFIG[type]) } : {}),
  };
  return profile;
}

// 梦由心生价格：字段名以模型广场公开接口 /gongkai/moxingguangchang 的实测
// 返回为准（price_min / price_max / output_price_min / price_available /
// billing_mode）。数值单位站方未说明，不加币种符号、不换算；接口没给价格
// （price_available 为 false，或 price_min 不是数字）时返回 null，调用方
// 显示“价格待确认”。/v1/media/models 是否带这些字段尚未用真 Key 验证过。
export function extractMyxsaiPrice(entry) {
  const source = entry && typeof entry === "object"
    ? (entry.price && typeof entry.price === "object" ? entry.price : entry.pricing && typeof entry.pricing === "object" ? entry.pricing : entry)
    : null;
  if (!source) return null;
  if (source.price_available === false) return null;
  const priceMin = typeof source.price_min === "number" && Number.isFinite(source.price_min) && source.price_min >= 0 ? source.price_min : null;
  if (priceMin === null) return null;
  const priceMax = typeof source.price_max === "number" && Number.isFinite(source.price_max) && source.price_max >= 0 ? source.price_max : undefined;
  const outputPriceMin = typeof source.output_price_min === "number" && Number.isFinite(source.output_price_min) && source.output_price_min >= 0 ? source.output_price_min : undefined;
  const billingMode = typeof source.billing_mode === "string" && source.billing_mode.trim() ? source.billing_mode.trim() : undefined;
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
