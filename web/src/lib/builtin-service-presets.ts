import type { ModelCapability } from "@/stores/use-config-store";
import type { ModelProtocolDefinition } from "@/lib/model-protocols";
import type { MyxsaiModelPrice } from "@/lib/myxsai-model-pricing";
import {
    clearInMemoryPartnerCatalogForReloadTest,
    clearPartnerCatalogStoreForTest,
    getRememberedPartnerPresetId,
    getRemotePartnerMetaByPlugin,
    listRemotePartnerMeta,
    livePartnerSyncIssues,
    nextPartnerWindowBoundaryDelayMs,
    recordPartnersNoticed,
    rememberInstalledPartnerPreset,
    updatePartnerCatalogStore,
    type PartnerSyncIssue,
} from "@/lib/partner-catalog-store";
import type { PartnerCatalogItem } from "@/services/api/plugins";
import {
    BUILTIN_SERVICE_PRESET as MYXSAI_SERVICE_PRESET,
    DEFAULT_BASE_URL as MYXSAI_DEFAULT_BASE_URL,
    MYXSAI_CHANNEL_ID,
    MYXSAI_CHANNEL_NAME,
    MYXSAI_PRESET_MODELS,
    buildMyxsaiModelChannel,
    upgradeMyxsaiModelProfile,
} from "../../../plugin-packages/beeftv-plugin-myxsai/client/index.js";

export { MYXSAI_CHANNEL_ID, livePartnerSyncIssues, type PartnerSyncIssue };

export type BuiltinPresetModel = {
    model: string;
    displayName: string;
    capability: string;
    protocol: string;
    // 梦由心生预置模型的手抄价（模型广场，2026-11-28）；服务编辑器用它给新模型补价。
    pricing?: MyxsaiModelPrice;
    defaultOptions?: Record<string, unknown>;
    capabilityConfig?: unknown;
};

export type BuiltinModelProfile = {
    model: string;
    displayName?: string;
    capability?: string;
    protocol?: string;
    authType?: string;
    defaultOptions?: Record<string, unknown>;
    capabilityConfig?: unknown;
};

export type BuiltinPresetChannelLike = {
    id?: string;
    baseUrl?: string;
};

export type BuiltinPresetPlugin = {
    pluginId: string;
    name: string;
    subtitle: string;
    icon: string;
    baseUrl: string;
    partner?: boolean;
    live?: boolean;
    from?: string;
    until?: string;
    keysUrl?: string;
    websiteUrl?: string;
    promoText?: string;
    order?: number;
    /** 这个插件的协议都以这些前缀开头。 */
    protocolPrefixes: string[];
    hosts: string[];
    hostSuffixes: string[];
    /** 没有显式声明接口时，按能力给的默认协议。 */
    candidates: Partial<Record<ModelCapability, string>>;
    models: readonly BuiltinPresetModel[];
    /** 用在「已预置 N 款…模型及协议」的说明里。 */
    presetDescription: string;
    /** 服务商或平台简介（可选），展示在连接表单标题下方。 */
    providerIntro?: string;
    /** 插件自己在 manifest 里声明了素材怎么传时，设置页不再显示手填字段。 */
    declaresReferenceMediaTransport: boolean;
    buildChannel: (args: { apiKey: string; baseUrl: string; selectedModels?: string[]; existingChannel?: unknown }) => { models: string[]; modelProfiles: BuiltinModelProfile[] };
    upgradeProfile: <T>(profile: T, channel?: BuiltinPresetChannelLike) => T;
};

/** 没有显式声明接口时按能力补的默认协议。 */
export const TEXT_AUDIO_CANDIDATES: Partial<Record<ModelCapability, string>> = { text: "chat-completion", audio: "openai-audio" };
export const COMPATIBLE_CANDIDATES: Partial<Record<ModelCapability, string>> = { ...TEXT_AUDIO_CANDIDATES, image: "openai-image" };

const RESERVED_CORE_PRESET_IDS = new Set(["compatible", "openai", "gemini", "ark", "beeftv"]);
/** 随包静态内置的合作伙伴预设：目前只有梦由心生（自家渠道，非上游合作商）。 */
const STATIC_SHIPPED_PLUGIN_PRESET: Readonly<Record<string, string>> = {
    "beeftv-plugin-myxsai": MYXSAI_CHANNEL_ID,
};
const STATIC_PRESET_IDS = new Set([MYXSAI_CHANNEL_ID]);
const VALID_PARTNER_PLUGIN_ID = /^beeftv-plugin-[a-z0-9][a-z0-9-]{0,49}$/;
const VALID_PRESET_ID = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** 宿主已知的官方内置与动态合作伙伴预设表；新增合作方经权威注册表同步后在此生效。 */
export const BUILTIN_PRESETS: Record<string, BuiltinPresetPlugin> = {
    [MYXSAI_CHANNEL_ID]: {
        pluginId: "beeftv-plugin-myxsai",
        name: MYXSAI_CHANNEL_NAME,
        subtitle: MYXSAI_SERVICE_PRESET.subtitle,
        icon: MYXSAI_SERVICE_PRESET.icon,
        baseUrl: MYXSAI_DEFAULT_BASE_URL,
        partner: true,
        live: true,
        keysUrl: MYXSAI_SERVICE_PRESET.keysUrl,
        websiteUrl: MYXSAI_SERVICE_PRESET.websiteUrl,
        order: 0,
        protocolPrefixes: ["myxsai-"],
        hosts: [new URL(MYXSAI_DEFAULT_BASE_URL).hostname],
        hostSuffixes: [],
        candidates: { text: "chat-completion", image: "myxsai-media", video: "myxsai-media" },
        models: MYXSAI_PRESET_MODELS,
        presetDescription: MYXSAI_SERVICE_PRESET.presetDescription,
        declaresReferenceMediaTransport: true,
        buildChannel: (args) => buildMyxsaiModelChannel({ apiKey: args.apiKey, baseUrl: args.baseUrl, selectedModels: args.selectedModels, existingChannel: args.existingChannel }),
        upgradeProfile: (profile, channel) => upgradeMyxsaiModelProfile(profile, channel),
    },
};

/**
 * 已下线合作伙伴（ll2、银盛）的静态退役预设：只进退役表，不进新建列表。
 * 源码包已删除，这里只保留旧渠道编辑与迁移所需的最小身份数据（名称、地址、
 * 协议前缀、域名匹配），不保留预置模型目录、品牌介绍与取 Key 链接；
 * upgradeProfile 原样返回已存档案，不再按已删的预置规格改写；
 * buildChannel 只保留调用方带来的既有模型，不再补预置模型。
 * Infistar 从未在本机留下预置数据，故无退役条目。
 */
const STATIC_RETIRED_PRESETS: Readonly<Record<string, BuiltinPresetPlugin>> = {
    ll2: {
        pluginId: "beeftv-plugin-ll2",
        name: "LL2 (DMC)",
        subtitle: "文本 · 多款主流视频 · 视频超分",
        icon: "OpenAI",
        baseUrl: "https://api.ll2.cn",
        partner: true,
        live: false,
        protocolPrefixes: ["ll2-"],
        hosts: ["api.ll2.cn"],
        hostSuffixes: [".ll2.cn"],
        candidates: COMPATIBLE_CANDIDATES,
        models: [],
        presetDescription: "文本、视频与超分",
        declaresReferenceMediaTransport: false,
        buildChannel: (args) => {
            const existing = (args.existingChannel ?? {}) as { models?: unknown; modelProfiles?: BuiltinModelProfile[] };
            return {
                models: Array.isArray(existing.models) ? existing.models.filter((model): model is string => typeof model === "string") : [],
                modelProfiles: Array.isArray(existing.modelProfiles) ? existing.modelProfiles : [],
            };
        },
        upgradeProfile: (profile) => profile,
    },
    ysdui: {
        pluginId: "beeftv-plugin-ysdui",
        name: "银盛云枢壹算",
        subtitle: "文本 · 多款主流图片 · 多款主流视频",
        icon: "Ysdui",
        baseUrl: "https://tokenhub.ysdui.cn",
        partner: true,
        live: false,
        protocolPrefixes: ["ysdui-"],
        hosts: ["tokenhub.ysdui.cn", "ysdui.cn"],
        hostSuffixes: [".ysdui.cn"],
        candidates: TEXT_AUDIO_CANDIDATES,
        models: [],
        presetDescription: "文本、图像与视频",
        declaresReferenceMediaTransport: true,
        buildChannel: (args) => {
            const existing = (args.existingChannel ?? {}) as { models?: unknown; modelProfiles?: BuiltinModelProfile[] };
            return {
                models: Array.isArray(existing.models) ? existing.models.filter((model): model is string => typeof model === "string") : [],
                modelProfiles: Array.isArray(existing.modelProfiles) ? existing.modelProfiles : [],
            };
        },
        upgradeProfile: (profile) => profile,
    },
};

/** 已被权威注册表移除但本机已安装加载过的动态伙伴预设：从新建列表隐藏，保留给已存渠道编辑与档案迁移。 */
const RETIRED_DYNAMIC_PRESETS: Record<string, BuiltinPresetPlugin> = {};
const loadedPartnerModules = new Map<string, unknown>();
const loadedModuleFnRefs = new Map<string, { buildChannel: unknown; upgradeProfile: unknown }>();
const presetListeners = new Set<() => void>();
const indicatorListeners = new Set<() => void>();
let builtinPresetsVersion = 0;
let partnerIndicatorVersion = 0;

function emitBuiltinPresetsChanged() {
    builtinPresetsVersion += 1;
    partnerIndicatorVersion += 1;
    for (const listener of presetListeners) {
        listener();
    }
    for (const listener of indicatorListeners) {
        listener();
    }
}

function emitNoticedPartnersChanged() {
    partnerIndicatorVersion += 1;
    for (const listener of indicatorListeners) {
        listener();
    }
}

export function notifyPartnerWindowBoundaryCrossed(): void {
    emitBuiltinPresetsChanged();
}

export function nextActivePartnerWindowDelayMs(nowMs = Date.now()): number | null {
    return nextPartnerWindowBoundaryDelayMs(Object.values(BUILTIN_PRESETS), nowMs);
}

export function subscribeBuiltinPresets(listener: () => void): () => void {
    presetListeners.add(listener);
    return () => {
        presetListeners.delete(listener);
    };
}

export function getBuiltinPresetsVersion(): number {
    return builtinPresetsVersion;
}

export function subscribePartnerIndicator(listener: () => void): () => void {
    indicatorListeners.add(listener);
    return () => {
        indicatorListeners.delete(listener);
    };
}

export function getPartnerIndicatorVersion(): number {
    return partnerIndicatorVersion;
}

function stringArrayEqual(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((item, idx) => item === b[idx]);
}

function builtinPresetDataEqual(a: BuiltinPresetPlugin, b: BuiltinPresetPlugin): boolean {
    return (
        a.pluginId === b.pluginId &&
        a.name === b.name &&
        a.subtitle === b.subtitle &&
        a.icon === b.icon &&
        a.baseUrl === b.baseUrl &&
        a.partner === b.partner &&
        a.live === b.live &&
        a.from === b.from &&
        a.until === b.until &&
        a.keysUrl === b.keysUrl &&
        a.websiteUrl === b.websiteUrl &&
        a.promoText === b.promoText &&
        a.order === b.order &&
        a.presetDescription === b.presetDescription &&
        a.providerIntro === b.providerIntro &&
        a.declaresReferenceMediaTransport === b.declaresReferenceMediaTransport &&
        stringArrayEqual(a.protocolPrefixes, b.protocolPrefixes) &&
        stringArrayEqual(a.hosts, b.hosts) &&
        stringArrayEqual(a.hostSuffixes, b.hostSuffixes) &&
        JSON.stringify(a.candidates) === JSON.stringify(b.candidates) &&
        JSON.stringify(a.models) === JSON.stringify(b.models)
    );
}

function materializeBuiltinPresetModule(pluginId: string, mod: unknown): boolean {
    if (!mod || typeof mod !== "object" || !VALID_PARTNER_PLUGIN_ID.test(pluginId)) return false;
    const record = mod as Record<string, unknown>;
    const defaultExport = record.default && typeof record.default === "object" ? (record.default as Record<string, unknown>) : undefined;
    const raw = (record.BUILTIN_SERVICE_PRESET ?? defaultExport?.BUILTIN_SERVICE_PRESET) as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") return false;

    const staticPresetId = STATIC_SHIPPED_PLUGIN_PRESET[pluginId];
    const remoteMeta = getRemotePartnerMetaByPlugin(pluginId);
    const rememberedPresetId = !staticPresetId && !remoteMeta ? getRememberedPartnerPresetId(pluginId) : undefined;
    if (!staticPresetId && !remoteMeta && !rememberedPresetId) {
        return false;
    }
    const presetId = remoteMeta?.presetId ?? staticPresetId ?? rememberedPresetId!;
    if (!VALID_PRESET_ID.test(presetId) || RESERVED_CORE_PRESET_IDS.has(presetId)) return false;
    const rawExplicit = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined;
    if (rawExplicit && rawExplicit !== presetId) return false;

    const isRetiredReloadOnly = Boolean(rememberedPresetId && !remoteMeta && !staticPresetId);
    const isRetiredTarget = Boolean(isRetiredReloadOnly || remoteMeta?.retired);
    const current = isRetiredTarget ? RETIRED_DYNAMIC_PRESETS[presetId] : BUILTIN_PRESETS[presetId];
    if (current && current.pluginId !== pluginId) return false;
    if (!isRetiredTarget && BUILTIN_PRESETS[presetId] && BUILTIN_PRESETS[presetId].pluginId !== pluginId) return false;
    if (isRetiredReloadOnly && BUILTIN_PRESETS[presetId]) return false;

    const models = Array.isArray(raw.models) ? (raw.models as BuiltinPresetModel[]) : undefined;
    const buildChannel = typeof raw.buildChannel === "function" ? (raw.buildChannel as BuiltinPresetPlugin["buildChannel"]) : undefined;
    const upgradeProfile = typeof raw.upgradeProfile === "function" ? (raw.upgradeProfile as BuiltinPresetPlugin["upgradeProfile"]) : undefined;
    if (!models || !buildChannel || !upgradeProfile) return false;

    const nextBaseUrl = typeof raw.baseUrl === "string" && raw.baseUrl.trim() ? raw.baseUrl.trim() : current?.baseUrl ?? "";
    if (!nextBaseUrl) return false;
    const baseHosts = Array.isArray(raw.hosts) ? [...(raw.hosts as string[])] : [...(current?.hosts ?? [])];
    try {
        const nextHostname = new URL(nextBaseUrl).hostname;
        if (nextHostname && !baseHosts.includes(nextHostname)) baseHosts.push(nextHostname);
    } catch {
        if (!current) return false;
    }

    const defaultOrder = current?.order ?? Object.keys(BUILTIN_PRESETS).length;
    const rawIcon = typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : current?.icon ?? "OpenAI";

    const nextEntry: BuiltinPresetPlugin = {
        pluginId,
        name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : current?.name ?? presetId,
        subtitle: typeof raw.subtitle === "string" && raw.subtitle.trim() ? raw.subtitle.trim() : current?.subtitle ?? "多模态算力服务",
        icon: !isRetiredTarget ? (remoteMeta?.iconUrl || rawIcon) : rawIcon,
        baseUrl: nextBaseUrl,
        partner: remoteMeta ? true : (typeof raw.partner === "boolean" ? raw.partner : current?.partner ?? true),
        live: isRetiredTarget ? false : (remoteMeta ? remoteMeta.live : (current?.live ?? true)),
        from: isRetiredTarget ? undefined : (remoteMeta ? remoteMeta.from : current?.from),
        until: isRetiredTarget ? undefined : (remoteMeta ? remoteMeta.until : current?.until),
        keysUrl: isRetiredTarget ? undefined : (remoteMeta ? remoteMeta.keysUrl : current?.keysUrl),
        websiteUrl: isRetiredTarget ? undefined : (remoteMeta ? remoteMeta.websiteUrl : current?.websiteUrl),
        promoText: isRetiredTarget ? undefined : (remoteMeta ? remoteMeta.promoText : current?.promoText),
        order: remoteMeta ? remoteMeta.order : defaultOrder,
        protocolPrefixes: Array.isArray(raw.protocolPrefixes) ? (raw.protocolPrefixes as string[]) : current?.protocolPrefixes ?? [`${presetId}-`],
        hosts: baseHosts,
        hostSuffixes: Array.isArray(raw.hostSuffixes) ? (raw.hostSuffixes as string[]) : current?.hostSuffixes ?? [],
        candidates: raw.candidates && typeof raw.candidates === "object" ? (raw.candidates as Partial<Record<ModelCapability, string>>) : current?.candidates ?? COMPATIBLE_CANDIDATES,
        models,
        presetDescription: typeof raw.presetDescription === "string" ? raw.presetDescription : current?.presetDescription ?? "多模态",
        providerIntro: typeof raw.providerIntro === "string" ? raw.providerIntro : current?.providerIntro,
        declaresReferenceMediaTransport:
            typeof raw.declaresReferenceMediaTransport === "boolean" ? raw.declaresReferenceMediaTransport : current?.declaresReferenceMediaTransport ?? false,
        buildChannel: (args) => buildChannel.call(BUILTIN_PRESETS[presetId] ?? RETIRED_DYNAMIC_PRESETS[presetId], args),
        upgradeProfile: <T>(profile: T, channel?: BuiltinPresetChannelLike): T =>
            upgradeProfile.call(BUILTIN_PRESETS[presetId] ?? RETIRED_DYNAMIC_PRESETS[presetId], profile, channel) as T,
    };

    const prevFns = loadedModuleFnRefs.get(presetId);
    if (
        current &&
        prevFns &&
        prevFns.buildChannel === buildChannel &&
        prevFns.upgradeProfile === upgradeProfile &&
        builtinPresetDataEqual(current, nextEntry)
    ) {
        return false;
    }

    if (isRetiredTarget) {
        delete BUILTIN_PRESETS[presetId];
        RETIRED_DYNAMIC_PRESETS[presetId] = nextEntry;
        loadedModuleFnRefs.set(presetId, { buildChannel, upgradeProfile });
        return true;
    }

    if (remoteMeta && !staticPresetId) {
        rememberInstalledPartnerPreset(pluginId, presetId);
    }
    delete RETIRED_DYNAMIC_PRESETS[presetId];
    BUILTIN_PRESETS[presetId] = nextEntry;
    loadedModuleFnRefs.set(presetId, { buildChannel, upgradeProfile });
    return true;
}

export function syncBuiltinPresetFromModule(pluginId: string, mod: unknown): boolean {
    if (!mod || typeof mod !== "object" || !VALID_PARTNER_PLUGIN_ID.test(pluginId)) return false;
    loadedPartnerModules.set(pluginId, mod);
    const updated = materializeBuiltinPresetModule(pluginId, mod);
    if (updated) emitBuiltinPresetsChanged();
    return updated;
}

/** 同步后端 `/api/plugins/partners` 目录：仅当 complete!==false 时裁剪已下线动态项，并将其保留在已装退役表供旧渠道编辑。 */
export function applyPartnerCatalogMetadata(
    items: readonly PartnerCatalogItem[],
    options?: { complete?: boolean },
): void {
    const complete = options?.complete !== false;
    const { issuesChanged } = updatePartnerCatalogStore(items, RESERVED_CORE_PRESET_IDS, complete);
    let changed = issuesChanged;

    if (complete) {
        for (const [key, entry] of Object.entries(BUILTIN_PRESETS)) {
            if (STATIC_PRESET_IDS.has(key)) continue;
            const authoritative = getRemotePartnerMetaByPlugin(entry.pluginId);
            if (!authoritative || authoritative.retired || authoritative.presetId !== key) {
                if (loadedPartnerModules.has(entry.pluginId)) {
                    RETIRED_DYNAMIC_PRESETS[key] = {
                        ...entry,
                        live: false,
                        keysUrl: undefined,
                        websiteUrl: undefined,
                        promoText: undefined,
                    };
                }
                delete BUILTIN_PRESETS[key];
                loadedModuleFnRefs.delete(key);
                changed = true;
            }
        }
    }

    for (const [pluginId, mod] of loadedPartnerModules.entries()) {
        if (getRemotePartnerMetaByPlugin(pluginId)) {
            if (materializeBuiltinPresetModule(pluginId, mod)) {
                changed = true;
            }
        }
    }

    for (const meta of listRemotePartnerMeta()) {
        const existing = BUILTIN_PRESETS[meta.presetId];
        if (!existing || existing.pluginId !== meta.pluginId) continue;
        const nextIcon = meta.iconUrl || existing.icon;
        if (
            existing.live !== meta.live ||
            existing.from !== meta.from ||
            existing.until !== meta.until ||
            existing.keysUrl !== meta.keysUrl ||
            existing.websiteUrl !== meta.websiteUrl ||
            existing.promoText !== meta.promoText ||
            existing.icon !== nextIcon ||
            existing.order !== meta.order
        ) {
            BUILTIN_PRESETS[meta.presetId] = {
                ...existing,
                partner: true,
                live: meta.live,
                from: meta.from,
                until: meta.until,
                keysUrl: meta.keysUrl,
                websiteUrl: meta.websiteUrl,
                promoText: meta.promoText,
                icon: nextIcon,
                order: meta.order,
            };
            changed = true;
        }
    }

    if (changed) emitBuiltinPresetsChanged();
}

export function resetDynamicPartnersInMemoryForReloadTest(): void {
    for (const key of Object.keys(BUILTIN_PRESETS)) {
        if (!STATIC_PRESET_IDS.has(key)) {
            delete BUILTIN_PRESETS[key];
        }
    }
    for (const pluginId of [...loadedPartnerModules.keys()]) {
        if (!STATIC_SHIPPED_PLUGIN_PRESET[pluginId]) {
            loadedPartnerModules.delete(pluginId);
        }
    }
    for (const presetId of [...loadedModuleFnRefs.keys()]) {
        if (!STATIC_PRESET_IDS.has(presetId)) {
            loadedModuleFnRefs.delete(presetId);
        }
    }
    for (const retiredKey of Object.keys(RETIRED_DYNAMIC_PRESETS)) {
        delete RETIRED_DYNAMIC_PRESETS[retiredKey];
    }
    clearInMemoryPartnerCatalogForReloadTest();
    emitBuiltinPresetsChanged();
}

export function clearDynamicPartnerModulesForTest(): void {
    for (const pluginId of [...loadedPartnerModules.keys()]) {
        if (!STATIC_SHIPPED_PLUGIN_PRESET[pluginId]) {
            loadedPartnerModules.delete(pluginId);
        }
    }
    for (const presetId of [...loadedModuleFnRefs.keys()]) {
        if (!STATIC_PRESET_IDS.has(presetId)) {
            loadedModuleFnRefs.delete(presetId);
        }
    }
    for (const retiredKey of Object.keys(RETIRED_DYNAMIC_PRESETS)) {
        delete RETIRED_DYNAMIC_PRESETS[retiredKey];
    }
    clearPartnerCatalogStoreForTest();
}

export function markPartnersNoticed(ids: readonly string[]): void {
    if (recordPartnersNoticed(ids)) {
        emitNoticedPartnersChanged();
    }
}

/**
 * MindVerseTV 不展示「新合作伙伴」角标：上游合作商不进入本产品，始终返回空列表。
 */
export function unnoticedLivePartners(
    _channels: readonly BuiltinPresetChannelLike[] | undefined,
    _nowMs = Date.now(),
): Array<{ id: string; name: string }> {
    return [];
}

export function builtinPreset(id: string): BuiltinPresetPlugin | undefined {
    return BUILTIN_PRESETS[id] ?? RETIRED_DYNAMIC_PRESETS[id] ?? STATIC_RETIRED_PRESETS[id];
}

export function allKnownBuiltinPresets(): Array<[string, BuiltinPresetPlugin]> {
    return [...Object.entries(BUILTIN_PRESETS), ...Object.entries(RETIRED_DYNAMIC_PRESETS), ...Object.entries(STATIC_RETIRED_PRESETS)];
}

/** 按协议反查它属于哪个内置插件（含已从目录退役但本机仍保留的合作伙伴协议）。 */
export function builtinPresetForProtocol(protocol?: string): BuiltinPresetPlugin | undefined {
    if (!protocol) return undefined;
    return allKnownBuiltinPresets()
        .map(([, plugin]) => plugin)
        .find((plugin) => plugin.protocolPrefixes.some((prefix) => protocol.startsWith(prefix)));
}

/** 把旧档案依次交给每个内置插件升级；不属于自己的档案原样返回。 */
export function upgradeBuiltinModelProfile<T>(profile: T, channel?: BuiltinPresetChannelLike): T {
    return allKnownBuiltinPresets().reduce((next, [, plugin]) => plugin.upgradeProfile(next, channel), profile);
}

/** 判断一组渠道中是否存在需要由内置渠道插件升级修复的本地模型档案（与对象键顺序无关）。 */
export function hasBuiltinChannelProfileUpgrade(
    channels: readonly (BuiltinPresetChannelLike & { scope?: string; modelProfiles?: readonly BuiltinModelProfile[] })[] | undefined,
): boolean {
    if (!Array.isArray(channels)) return false;
    return channels.some(
        (channel) =>
            channel &&
            channel.scope !== "system" &&
            (channel.modelProfiles ?? []).some((raw: BuiltinModelProfile) => upgradeBuiltinModelProfile(raw, channel) !== raw),
    );
}

/** 插件声明的协议是否都已经加载；没加载时不让「一键保存并启用」。 */
export function builtinProtocolsAvailable(id: string, protocols: ModelProtocolDefinition[]): boolean {
    const models = builtinPreset(id)?.models;
    if (!models) return true;
    return models.every((item) =>
        protocols.some((protocol) => protocol.value === item.protocol && protocol.capability === item.capability && protocol.enabled !== false),
    );
}
