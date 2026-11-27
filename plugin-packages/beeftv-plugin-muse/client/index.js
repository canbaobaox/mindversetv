// Muse 渠道配置面板（beeftv-plugin-muse）
// 对照：plugin-packages/beeftv-plugin-myxsai/client/index.js（765 行）。
// 本面板只做三件事：填 MUSE2API_KEY + Base URL、拉取中继模型目录、
// 一键同步到宿主「设置 -> 模型服务」。文本走 chat-completion、图片走
// openai-image，均无需插件；视频走本插件的 muse-video 协议。
// 中继不返回价格，模型不带 price，宿主按“价格待确认”显示。

import {
  BUILTIN_SERVICE_PRESET,
  DEFAULT_BASE_URL,
  MUSE_CHANNEL_ID,
  MUSE_CHANNEL_NAME,
  MUSE_PRESET_MODELS,
  buildMuseModelChannel,
  fetchMuseModels,
} from "./presets.js";

export {
  BUILTIN_SERVICE_PRESET,
  DEFAULT_BASE_URL,
  MUSE_CHANNEL_ID,
  MUSE_CHANNEL_NAME,
  MUSE_PRESET_MODELS,
  buildMuseModelChannel,
  fetchMuseModels,
};

const CAPABILITY_LABEL = { text: "文本", image: "图片", video: "视频" };
const CAPABILITY_STYLE = {
  text: { background: "rgba(59, 130, 246, 0.12)", color: "#2563eb" },
  image: { background: "rgba(16, 185, 129, 0.12)", color: "#047857" },
  video: { background: "rgba(139, 92, 246, 0.12)", color: "#7c3aed" },
};

function getReact(host) {
  if (host?.React) return host.React;
  if (host?.ui?.React) return host.ui.React;
  if (typeof window !== "undefined") {
    return window.__BEEFTV_REACT__ || window.React || null;
  }
  return null;
}

function createMuseSettingsPanel(host) {
  const React = getReact(host);
  if (!React) return () => null;
  const h = React.createElement;

  return function MuseSettingsPanel(props) {
    const existingChannel = React.useMemo(() => {
      try {
        const channels = host?.channels?.list?.() || [];
        return channels.find(
          (item) =>
            item.id === MUSE_CHANNEL_ID ||
            String(item.baseUrl || "").includes("127.0.0.1:18610"),
        );
      } catch {
        return undefined;
      }
    }, []);

    const initialApiKey =
      props?.config?.apiKey ||
      host?.config?.get?.("apiKey", "") ||
      existingChannel?.apiKey ||
      "";
    const initialBaseUrl =
      props?.config?.baseUrl ||
      host?.config?.get?.("baseUrl", DEFAULT_BASE_URL) ||
      existingChannel?.baseUrl ||
      DEFAULT_BASE_URL;

    const [apiKey, setApiKey] = React.useState(String(initialApiKey));
    const [baseUrl, setBaseUrl] = React.useState(String(initialBaseUrl));
    const [showKey, setShowKey] = React.useState(false);
    const [selectedModels, setSelectedModels] = React.useState(() =>
      existingChannel?.models?.length
        ? existingChannel.models
        : MUSE_PRESET_MODELS.map((item) => item.model),
    );
    const [catalogChecking, setCatalogChecking] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [fetchedProfiles, setFetchedProfiles] = React.useState([]);
    const [filter, setFilter] = React.useState("all");
    const [synced, setSynced] = React.useState(
      Boolean(existingChannel?.hasApiKey || existingChannel?.apiKey),
    );
    const [statusMessage, setStatusMessage] = React.useState(
      existingChannel?.hasApiKey || existingChannel?.apiKey
        ? `已连接「${existingChannel.name}」渠道（已启用 ${existingChannel.models?.length || 0} 个模型）`
        : "",
    );
    const [errorMessage, setErrorMessage] = React.useState("");

    const allModels = React.useMemo(() => {
      const staticIds = new Set(MUSE_PRESET_MODELS.map((item) => item.model));
      const fetchedById = new Map(fetchedProfiles.map((item) => [item.model, item]));
      return [
        ...MUSE_PRESET_MODELS.map((item) =>
          fetchedById.has(item.model) ? { ...item, ...fetchedById.get(item.model) } : item,
        ),
        ...fetchedProfiles.filter((item) => !staticIds.has(item.model)),
      ];
    }, [fetchedProfiles]);

    const visibleModels =
      filter === "all"
        ? allModels
        : allModels.filter((item) => item.capability === filter);

    // 全选只针对当前页签下可见的模型，不无视页签全选全部模型。
    const visibleIds = visibleModels.map((item) => item.model);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedModels.includes(id));

    const toggleModel = (modelId) => {
      setSelectedModels((prev) =>
        prev.includes(modelId)
          ? prev.filter((item) => item !== modelId)
          : [...prev, modelId],
      );
    };

    const handleFetchCatalog = async () => {
      const trimmedKey = apiKey.trim();
      const trimmedUrl = baseUrl.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
      if (!trimmedKey) {
        setErrorMessage("请先填写 Muse 中继 API Key");
        return;
      }
      setCatalogChecking(true);
      setErrorMessage("");
      try {
        let profiles = [];
        if (typeof host?.channels?.fetchCatalog === "function") {
          const catalog = await host.channels.fetchCatalog({
            baseUrl: trimmedUrl,
            apiKey: trimmedKey,
            apiFormat: "openai",
          });
          const ids = Array.isArray(catalog?.models) ? catalog.models : [];
          profiles = ids
            .map((item) => (typeof item === "string" ? item : item?.id))
            .filter(Boolean)
            .map((id) => MUSE_PRESET_MODELS.find((m) => m.model === id))
            .filter(Boolean);
        } else {
          profiles = await fetchMuseModels(trimmedUrl, trimmedKey);
        }
        setFetchedProfiles(profiles);
        setStatusMessage(
          profiles.length
            ? `在线目录验证成功：共发现 ${profiles.length} 个模型（${profiles.map((p) => p.model).join("、")}）`
            : "在线目录未返回已知模型，已回退到静态三模型",
        );
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "读取在线目录失败");
      } finally {
        setCatalogChecking(false);
      }
    };

    const handleSaveAndSync = async () => {
      const trimmedKey = apiKey.trim();
      const trimmedUrl = baseUrl.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
      if (!trimmedKey) {
        setErrorMessage("请填写有效的 Muse 中继 API Key");
        return;
      }
      if (!selectedModels.length) {
        setErrorMessage("请至少勾选 1 个要同步的模型");
        return;
      }
      setSaving(true);
      setErrorMessage("");
      try {
        const patch = { apiKey: trimmedKey, baseUrl: trimmedUrl };
        if (typeof props?.updateConfig === "function") {
          await props.updateConfig(patch);
        } else if (host?.config?.set) {
          await host.config.set(patch);
        }
        const channel = buildMuseModelChannel({
          apiKey: trimmedKey,
          baseUrl: trimmedUrl,
          selectedModels,
          existingChannel,
          extraProfiles: fetchedProfiles,
        });
        if (!host?.channels?.upsert) {
          throw new Error("当前宿主版本不支持同步模型渠道");
        }
        await host.channels.upsert(channel);
        setSynced(true);
        setStatusMessage(
          `已将「${MUSE_CHANNEL_NAME}」与 ${channel.models.length} 个模型同步至「设置 -> 模型服务」！`,
        );
        host?.ui?.notify?.("Muse 渠道与模型已同步至模型服务", "success");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "保存并同步渠道失败");
      } finally {
        setSaving(false);
      }
    };

    return h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "4px 0",
        },
      },
      h(
        "div",
        { style: { color: "#666", fontSize: "13px", lineHeight: "1.6" } },
        "把 Muse 接进画布：先在本机跑起 muse2api 中继（默认 http://127.0.0.1:18610），",
        "再把中继的 API Key 填到这里。文本与图片走画布通用协议，无需插件；",
        "视频走本插件的 muse-video 协议（JSON 提交）。",
        h("br"),
        "注意：画布与中继必须在同一台电脑上；中继未登录账号时聊天返回 400、",
        "生图返回 502、生视频先排队、轮询时失败——先在中继管理页导号再生成。",
      ),
      h(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" } },
        "Muse 中继 API Key（MUSE2API_KEY）",
        h(
          "div",
          { style: { display: "flex", gap: "8px" } },
          h("input", {
            type: showKey ? "text" : "password",
            value: apiKey,
            placeholder: "m2a_…（中继启动日志 / .env 里复制）",
            onChange: (e) => setApiKey(e.target.value),
            style: {
              flex: 1,
              padding: "8px 10px",
              border: "1px solid #d9d9d9",
              borderRadius: "8px",
              fontSize: "13px",
            },
          }),
          h(
            "button",
            {
              type: "button",
              onClick: () => setShowKey((v) => !v),
              style: {
                padding: "8px 12px",
                border: "1px solid #d9d9d9",
                borderRadius: "8px",
                background: "#fff",
                cursor: "pointer",
                fontSize: "13px",
              },
            },
            showKey ? "隐藏" : "显示",
          ),
        ),
      ),
      h(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" } },
        "Base URL（不要在末尾加 /v1）",
        h("input", {
          type: "text",
          value: baseUrl,
          placeholder: DEFAULT_BASE_URL,
          onChange: (e) => setBaseUrl(e.target.value),
          style: {
            padding: "8px 10px",
            border: "1px solid #d9d9d9",
            borderRadius: "8px",
            fontSize: "13px",
          },
        }),
      ),
      h(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        h(
          "button",
          {
            type: "button",
            disabled: catalogChecking,
            onClick: handleFetchCatalog,
            style: {
              padding: "8px 14px",
              border: "1px solid #d9d9d9",
              borderRadius: "8px",
              background: "#fff",
              cursor: catalogChecking ? "wait" : "pointer",
              fontSize: "13px",
            },
          },
          catalogChecking ? "读取中..." : "验证在线目录",
        ),
        h(
          "span",
          { style: { fontSize: "12px", color: "#888" } },
          "中继只返回 muse-spark / muse-image / muse-video 三个模型",
        ),
      ),
      h(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" } },
        ["all", "text", "image", "video"].map((key) =>
          h(
            "button",
            {
              key,
              type: "button",
              onClick: () => setFilter(key),
              style: {
                padding: "6px 12px",
                borderRadius: "999px",
                border: filter === key ? "1px solid #2563eb" : "1px solid #d9d9d9",
                background: filter === key ? "rgba(37, 99, 235, 0.08)" : "#fff",
                color: filter === key ? "#2563eb" : "#333",
                cursor: "pointer",
                fontSize: "13px",
              },
            },
            key === "all" ? "全部" : CAPABILITY_LABEL[key],
          ),
        ),
        h(
          "label",
          { style: { marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" } },
          h("input", {
            type: "checkbox",
            checked: allVisibleSelected,
            onChange: () => {
              setSelectedModels((prev) =>
                allVisibleSelected
                  ? prev.filter((id) => !visibleIds.includes(id))
                  : [...new Set([...prev, ...visibleIds])],
              );
            },
          }),
          "全选当前页签",
        ),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        visibleModels.map((item) =>
          h(
            "label",
            {
              key: item.model,
              style: {
                display: "flex",
                gap: "10px",
                alignItems: "center",
                padding: "10px 12px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
              },
            },
            h("input", {
              type: "checkbox",
              checked: selectedModels.includes(item.model),
              onChange: () => toggleModel(item.model),
            }),
            h("span", { style: { fontWeight: 600 } }, item.displayName),
            h(
              "span",
              {
                style: {
                  marginLeft: "auto",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  ...CAPABILITY_STYLE[item.capability],
                },
              },
              CAPABILITY_LABEL[item.capability],
            ),
            h("span", { style: { color: "#888", fontSize: "12px" } }, item.protocol),
          ),
        ),
      ),
      errorMessage
        ? h("div", { style: { color: "#dc2626", fontSize: "13px" } }, errorMessage)
        : null,
      statusMessage
        ? h("div", { style: { color: "#047857", fontSize: "13px" } }, statusMessage)
        : null,
      h(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        h(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: handleSaveAndSync,
            style: {
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            },
          },
          saving ? "同步中..." : "一键保存并同步到模型服务",
        ),
        synced
          ? h(
              "button",
              {
                type: "button",
                onClick: () => host?.ui?.navigate?.("/settings?section=channels"),
                style: {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d9d9d9",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                },
              },
              "去模型服务查看",
            )
          : null,
      ),
    );
  };
}

export function activate(host) {
  const SettingsPanel = createMuseSettingsPanel(host);
  const dispose = host.contribute("app.settings", {
    id: "muse-settings",
    label: "Muse",
    component: SettingsPanel,
  });
  return () => {
    if (typeof dispose === "function") dispose();
  };
}

export default { activate, BUILTIN_SERVICE_PRESET };
