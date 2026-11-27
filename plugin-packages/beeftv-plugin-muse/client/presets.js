// Muse 渠道预置（beeftv-plugin-muse）
// 对照：plugin-packages/beeftv-plugin-myxsai/client/presets.js。
// 文本 muse-spark 与图片 muse-image 走宿主通用协议（chat-completion /
// openai-image），本文件只给它们写预置 profile；视频 muse-video 走本插件
// 声明的 muse-video 协议（JSON 提交，见 package.json 与 docs/interface.md）。
// 中继不返回价格：预置模型不带 price，宿主按“价格待确认”显示（与 myxsai
// 无价模型同一处理，见 2026-11-22 v2.3.5 的 generation-cost-estimate 修复）。

export const DEFAULT_BASE_URL = "http://127.0.0.1:18610";
export const MUSE_CHANNEL_ID = "muse";
export const MUSE_CHANNEL_NAME = "Muse";
export const MUSE_VIDEO_PROTOCOL = "muse-video";

// 中继 /v1/models 返回的三个模型（muse2api app.py:326 MODELS，
// owned_by 均为 "muse"）。中继只会返回这三个 ID；fetchMuseModels 遇到
// 不认识的 ID 直接忽略（不猜 capability）。
export const MUSE_PRESET_MODELS = [
  {
    model: "muse-spark",
    displayName: "Muse Spark（文本）",
    capability: "text",
    protocol: "chat-completion",
    endpoint: "POST /v1/chat/completions",
  },
  {
    model: "muse-image",
    displayName: "Muse Image（图片）",
    capability: "image",
    protocol: "openai-image",
    endpoint: "POST /v1/images/generations",
  },
  {
    model: "muse-video",
    displayName: "Muse Video（视频）",
    capability: "video",
    protocol: MUSE_VIDEO_PROTOCOL,
    endpoint: "POST /v1/videos",
  },
];

const KNOWN_MODEL_BY_ID = new Map(
  MUSE_PRESET_MODELS.map((item) => [item.model, item]),
);

// Muse 视频能力配置：只写有出处的档位，其余字段留给宿主默认值合并
//（web/src/lib/model-capabilities.ts 的 modelCapabilityConfigFor 会把
// capabilityConfig 合并到默认能力上；sanitizeServerVideoCapability 要求
// references/duration/generateAudio/watermark/ratios/resolutions/
// operations/defaultRatio/defaultResolution/defaultOperation 全在，
// 缺一个就整份作废，所以下面十项一个不能少）。
// 出处：
// - 时长档 [5, 6, 8, 10]、默认 6 秒：muse2api README 与 app.py:1034
//   （`dur = r.duration or 6`）；README 只列这四档，不编别的值。
// - 画幅 ["16:9", "9:16"]、默认 16:9：muse2api README（只支持这两档）。
// - 参考图上限 10 张、单张 40 MiB：muse2api MAX_REFERENCE_IMAGES=10、
//   单图 40 MiB、总量 100 MiB（app.py；见验证报告第 3 节）。
// - 视频文件作参考图不支持（muse2api 只接受图片首帧，见方案第 2.3 节），
//   音频参考本插件不接线：maxVideos/maxAudios 均为 0。
// - 分辨率：中继没有分辨率结构化参数，只把“画质规格：…”拼进提示词，
//   所以 resolutions 为空、defaultResolution 为空（sanitize 要求空列表
//   配空字符串），不在界面上给用户一个假的分辨率档位。
// - 生成音频：Muse Video 输出自带原生音频（支持中文原声直出）；本插件
//   不发任何音频参数，这个开关只影响界面上是否出现音频选项。
// - 水印：不发任何水印参数，无证据表明中继支持，默认不支持。
// - 操作：text_to_video（纯提示词）与 image_to_video（首帧参考图）；
//   reference_to_video（视频文件参考）、extend、inpaint 均不支持，
//   不声明（没有证据）。
export const MUSE_VIDEO_CAPABILITY_CONFIG = {
  version: 1,
  video: {
    references: {
      minImages: 0,
      maxImages: 10,
      maxImageBytes: 40 * 1024 * 1024,
      maxVideos: 0,
      maxAudios: 0,
    },
    duration: { selection: "enum", values: [5, 6, 8, 10], default: 6 },
    ratios: ["16:9", "9:16"],
    defaultRatio: "16:9",
    resolutions: [],
    defaultResolution: "",
    generateAudio: { supported: true, default: true },
    watermark: { supported: false, default: false },
    operations: ["text_to_video", "image_to_video"],
    defaultOperation: "text_to_video",
  },
};

export function buildMuseModelChannel({
  apiKey,
  baseUrl,
  selectedModels,
  existingChannel,
  presetModels: sourcePresets = MUSE_PRESET_MODELS,
  extraProfiles = [],
}) {
  const cleanUrl =
    String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") ||
    DEFAULT_BASE_URL;
  const cleanKey = String(apiKey || "").trim();
  // 按类型拉取到的模型以 extraProfiles 形式并入预置表参与勾选与建 profile。
  const combinedPresets = [
    ...sourcePresets,
    ...extraProfiles.filter((item) => item && typeof item.model === "string"),
  ];
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
    ...(item.endpoint ? { endpoint: item.endpoint } : {}),
    // 视频模型挂能力配置（时长/画幅档位等）；文本与图片走宿主通用协议，
    // 用宿主默认能力，不挂（与 myxsai 文本/图片预置只挂文本/图片配置
    // 的做法一致）。structuredClone 防止调用方改动共享配置。
    ...(item.model === "muse-video"
      ? { capabilityConfig: structuredClone(MUSE_VIDEO_CAPABILITY_CONFIG) }
      : {}),
  }));

  const existingCustomModels = Array.isArray(existingChannel?.models)
    ? existingChannel.models.filter(
        (modelId) =>
          typeof modelId === "string" &&
          modelId.trim() &&
          !presetById.has(modelId) &&
          chosenSet.has(modelId),
      )
    : [];
  const existingCustomProfiles = Array.isArray(existingChannel?.modelProfiles)
    ? existingChannel.modelProfiles.filter(
        (profile) =>
          profile &&
          typeof profile.model === "string" &&
          !presetById.has(profile.model) &&
          chosenSet.has(profile.model),
      )
    : [];

  return {
    id: MUSE_CHANNEL_ID,
    name: MUSE_CHANNEL_NAME,
    scope: "user",
    baseUrl: cleanUrl,
    apiKey: cleanKey,
    hasApiKey: Boolean(cleanKey),
    apiFormat: "openai",
    models: [...presetModels, ...existingCustomModels],
    modelProfiles: [...presetProfiles, ...existingCustomProfiles],
  };
}

// 拉取中继模型目录：GET {baseUrl}/v1/models，Authorization: Bearer <Key>，
// 10 秒超时。接受的返回体形状（防御性解析）：{ data: [{ id }] } /
// { data: ["muse-spark", ...] } / 数组本体；条目为字符串 ID 或
// { id | model | name } 对象。任何失败（网络 / 401 / 格式不对）都返回 []，
// 面板静默回退到静态三模型。不认识的 ID 直接忽略，不猜 capability。
// 该端点与返回体形状已按 muse2api 源码核对（app.py:1454 /v1/models，
// 返回 {"object":"list","data":MODELS}），但尚未用真服务跑过。
export async function fetchMuseModels(baseUrl, apiKey) {
  const cleanUrl =
    String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") ||
    DEFAULT_BASE_URL;
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let resp;
    try {
      resp = await fetch(`${cleanUrl}/v1/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return [];
    const data = await resp.json().catch(() => null);
    const raw = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];
    const profiles = [];
    for (const entry of raw) {
      const id =
        typeof entry === "string"
          ? entry.trim()
          : String(entry?.id || entry?.model || entry?.name || "").trim();
      const known = KNOWN_MODEL_BY_ID.get(id);
      if (!known) continue;
      profiles.push({ ...known });
    }
    return profiles;
  } catch {
    return [];
  }
}

export const BUILTIN_SERVICE_PRESET = {
  id: MUSE_CHANNEL_ID,
  name: MUSE_CHANNEL_NAME,
  subtitle: "文本 · 图片 · 视频（经 muse2api 中继）",
  icon: "OpenAI",
  baseUrl: DEFAULT_BASE_URL,
  partner: false,
  keysUrl: "",
  websiteUrl: "",
  protocolPrefixes: ["muse-"],
  hosts: ["127.0.0.1", "localhost"],
  // candidates 只在模型没有显式声明协议时才起作用
  //（web/src/lib/model-service-presets.ts:296-300，
  // proposed = inherited || endpoint || candidates[capability]）；
  // 预置模型自带 protocol，不走这条回退。运行时拉到的模型若无显式协议，
  // 文本走 chat-completion、图片走 openai-image（与实录请求体一致，
  // 见验证报告第 2 节）、视频走本插件的 muse-video。
  // 注意：image 若保持默认回退会被发往 POST /v1/images/generations——
  // 这正是 muse2api 的图片接口，是对的；不要照 myxsai 的做法把它改掉。
  candidates: { text: "chat-completion", image: "openai-image", video: MUSE_VIDEO_PROTOCOL },
  models: MUSE_PRESET_MODELS,
  presetDescription: "文本、图片与视频",
  declaresReferenceMediaTransport: true,
  buildChannel(args) {
    return buildMuseModelChannel({
      apiKey: args.apiKey,
      baseUrl: args.baseUrl,
      selectedModels: args.selectedModels,
      existingChannel: args.existingChannel,
      extraProfiles: args.extraProfiles || [],
      presetModels: this.models,
    });
  },
};
