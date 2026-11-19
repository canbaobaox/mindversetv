import { fetchPlugins, setPluginPlatformEnabled, setUserPluginEnabled, type PluginManagement } from "@/services/api/plugins";
import { usePluginStore } from "@/stores/use-plugin-store";

let transientRetryTimer: ReturnType<typeof setTimeout> | null = null;
const transientPartnerRetryAfter = new Map<string, number>();
export const TRANSIENT_PARTNER_RETRY_BACKOFF_MS = 120_000;

export function nextTransientPartnerRetryDelayMs(now = Date.now()): number | null {
    let earliest: number | null = null;
    for (const retryAt of transientPartnerRetryAfter.values()) {
        const wait = Math.max(0, retryAt - now);
        if (earliest === null || wait < earliest) {
            earliest = wait;
        }
    }
    return earliest;
}

function scheduleNextTransientPartnerRetry(onFire: () => void = () => { void syncPartnerCatalogFromBackend().catch(() => undefined); }): void {
    if (transientRetryTimer !== null) {
        clearTimeout(transientRetryTimer);
        transientRetryTimer = null;
    }
    const delay = nextTransientPartnerRetryDelayMs();
    if (delay === null) return;
    transientRetryTimer = setTimeout(() => {
        transientRetryTimer = null;
        onFire();
    }, Math.max(50, delay));
    if (typeof transientRetryTimer === "object" && transientRetryTimer && "unref" in transientRetryTimer && typeof transientRetryTimer.unref === "function") {
        transientRetryTimer.unref();
    }
}

export function recordTransientPartnerRetryForTest(pluginId: string, delayMs: number, onFire: () => void): void {
    transientPartnerRetryAfter.set(pluginId, Date.now() + delayMs);
    scheduleNextTransientPartnerRetry(onFire);
}

export function clearTransientPartnerRetryForTest(): void {
    if (transientRetryTimer !== null) {
        clearTimeout(transientRetryTimer);
        transientRetryTimer = null;
    }
    transientPartnerRetryAfter.clear();
}

export async function setPluginActivation(pluginId: string, enabled: boolean, scope: PluginManagement["activationScope"] = "user") {
    const next = scope === "system"
        ? await setPluginPlatformEnabled(pluginId, enabled)
        : await setUserPluginEnabled(pluginId, enabled);
    const store = usePluginStore.getState();
    store.setPluginStates({ ...store.pluginStates, [next.pluginId]: next });
    store.setEnabled(pluginId, next.effectiveEnabled);
    return next;
}

// The backend registry decides which plugins are installed and enabled. Every
// route follows it through the plugin store, so plugin canvas nodes render even
// when the plugin center was never opened in this window.
export async function syncPluginsFromBackend() {
    const result = await fetchPlugins();
    const plugins = (result.plugins || []).map((item) => ({
        manifest: {
            ...item.manifest,
            trusted: item.manifest.trusted ?? (item.source === "official" || item.source === "bundled" || item.source === "system"),
        },
        enabled: result.states?.[item.manifest.id]?.effectiveEnabled ?? item.status === "enabled",
    }));
    usePluginStore.getState().syncBackendPlugins(plugins, result.states || {});
    return result;
}

/**
 * MindVerseTV 不接入上游的合作伙伴热更新：不拉取合作伙伴目录、不应用远端
 * 合作商元数据、不自动安装合作伙伴插件（ll2、银盛、Infistar 等均不热接入）。
 * 调用方（应用启动、模型服务编辑页）仍可照常调用，本函数直接返回空列表。
 */
export async function syncPartnerCatalogFromBackend(_options?: { retryFailed?: boolean }) {
    return [];
}
