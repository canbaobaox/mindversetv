// BeefTV 内置插件：梦由心生AI 算力与多模态渠道（beeftv-plugin-myxsai）
// 通过 app.settings 插槽提供一键 BYOK 配置面板，将梦由心生 API Key 与预置协议模型
// 一键同步至宿主「设置 -> 模型服务」。文本走 chat-completion，图片 / 视频走媒体协议
// myxsai-media；首次加载且有 Key 时按类型拉取在线模型并合并进清单，拉取失败静默
// 回退到静态代表模型，不阻塞面板。

import {
  BUILTIN_SERVICE_PRESET,
  DEFAULT_BASE_URL,
  MYXSAI_CHANNEL_ID,
  MYXSAI_CHANNEL_NAME,
  MYXSAI_PRESET_MODELS,
  buildMyxsaiModelChannel,
  fetchMyxsaiModelsByType,
  upgradeMyxsaiModelProfile,
} from "./presets.js";

export {
  BUILTIN_SERVICE_PRESET,
  DEFAULT_BASE_URL,
  MYXSAI_CHANNEL_ID,
  MYXSAI_CHANNEL_NAME,
  MYXSAI_PRESET_MODELS,
  buildMyxsaiModelChannel,
  fetchMyxsaiModelsByType,
  upgradeMyxsaiModelProfile,
};

const CAPABILITY_LABEL = { text: "文本", image: "图片", video: "视频", audio: "音频" };
const CAPABILITY_STYLE = {
  text: { background: "rgba(59, 130, 246, 0.12)", color: "#2563eb" },
  image: { background: "rgba(16, 185, 129, 0.12)", color: "#047857" },
  video: { background: "rgba(139, 92, 246, 0.12)", color: "#7c3aed" },
  audio: { background: "rgba(245, 158, 11, 0.14)", color: "#b45309" },
};

function getReact(host) {
  if (host?.React) return host.React;
  if (host?.ui?.React) return host.ui.React;
  if (typeof window !== "undefined") {
    return window.__BEEFTV_REACT__ || window.React || null;
  }
  return null;
}

function createMyxsaiSettingsPanel(host) {
  const React = getReact(host);
  if (!React) return () => null;
  const h = React.createElement;

  return function MyxsaiSettingsPanel(props) {
    const existingChannel = React.useMemo(() => {
      try {
        const channels = host?.channels?.list?.() || [];
        return channels.find(
          (item) =>
            item.id === MYXSAI_CHANNEL_ID ||
            String(item.baseUrl || "").includes("api.lk888.ai"),
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
        : MYXSAI_PRESET_MODELS.map((item) => item.model),
    );
    const [catalogChecking, setCatalogChecking] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [onlineModels, setOnlineModels] = React.useState([]);
    const [fetchedProfiles, setFetchedProfiles] = React.useState([]);
    const [fetchedSummary, setFetchedSummary] = React.useState("");
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
    const typedFetchKeyRef = React.useRef("");

    // 首次加载且有 Key 时按类型拉取在线模型并合并进清单；任何失败都静默回退，
    // 不报错、不阻塞面板。音频模型不自动勾选（音频协议未验证，留给用户自选）。
    React.useEffect(() => {
      const trimmedKey = String(apiKey || "").trim();
      const trimmedUrl = String(baseUrl || "").trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
      const fetchKey = `${trimmedUrl}\n${trimmedKey}`;
      if (!trimmedKey || typedFetchKeyRef.current === fetchKey) return;
      typedFetchKeyRef.current = fetchKey;
      let cancelled = false;
      (async () => {
        const results = await Promise.all([
          fetchMyxsaiModelsByType(trimmedUrl, trimmedKey, "chat"),
          fetchMyxsaiModelsByType(trimmedUrl, trimmedKey, "image"),
          fetchMyxsaiModelsByType(trimmedUrl, trimmedKey, "video"),
          fetchMyxsaiModelsByType(trimmedUrl, trimmedKey, "audio"),
        ]);
        if (cancelled) return;
        const [chat, image, video, audio] = results;
        const staticIds = new Set(MYXSAI_PRESET_MODELS.map((item) => item.model));
        const fresh = [...chat, ...image, ...video, ...audio].filter(
          (item) => item && !staticIds.has(item.model),
        );
        if (!fresh.length) return;
        setFetchedProfiles(fresh);
        const autoCheck = fresh
          .filter((item) => item.capability !== "audio")
          .map((item) => item.model);
        if (autoCheck.length) {
          setSelectedModels((prev) => [...prev, ...autoCheck.filter((id) => !prev.includes(id))]);
        }
        const counts = { text: chat.length, image: image.length, video: video.length, audio: audio.length };
        setFetchedSummary(
          `已按类型拉取在线模型：文本 ${counts.text} / 图片 ${counts.image} / 视频 ${counts.video} / 音频 ${counts.audio} 个` +
            (audio.length ? "（音频模型已列出但未自动勾选，协议需确认后自选）" : ""),
        );
      })();
      return () => {
        cancelled = true;
      };
      // 只在首次加载（同一 Key 只拉一次）时执行，apiKey/baseUrl 变化由 fetchKey 守卫。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allModels = React.useMemo(() => {
      const staticIds = new Set(MYXSAI_PRESET_MODELS.map((item) => item.model));
      return [...MYXSAI_PRESET_MODELS, ...fetchedProfiles.filter((item) => !staticIds.has(item.model))];
    }, [fetchedProfiles]);

    const visibleModels = filter === "all"
      ? allModels
      : allModels.filter((item) => item.capability === filter);

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
        setErrorMessage("请先填写梦由心生 API Key");
        return;
      }
      setCatalogChecking(true);
      setErrorMessage("");
      try {
        let ids = [];
        if (typeof host?.channels?.fetchCatalog === "function") {
          const catalog = await host.channels.fetchCatalog({
            baseUrl: trimmedUrl,
            apiKey: trimmedKey,
            apiFormat: "openai",
          });
          ids = Array.isArray(catalog?.models) ? catalog.models : [];
        } else {
          const resp = await fetch("/api/ai/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              baseUrl: trimmedUrl,
              apiKey: trimmedKey,
              apiFormat: "openai",
            }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || (typeof data?.code === "number" && data.code !== 0)) {
            throw new Error(
              data?.msg || data?.error || `读取在线目录失败（HTTP ${resp.status}）`,
            );
          }
          const rawModels = Array.isArray(data?.data?.models)
            ? data.data.models
            : Array.isArray(data?.models)
              ? data.models
              : [];
          ids = rawModels
            .map((item) => (typeof item === "string" ? item : item?.id))
            .filter(Boolean);
        }
        setOnlineModels(ids);
        setStatusMessage(`在线目录验证成功：共发现 ${ids.length} 个上游模型`);
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
        setErrorMessage("请填写有效的梦由心生 API Key");
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
        const channel = buildMyxsaiModelChannel({
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
          `已将「${MYXSAI_CHANNEL_NAME}」与 ${channel.models.length} 个模型同步至「设置 -> 模型服务」！`,
        );
        host?.ui?.notify?.("梦由心生渠道与模型已同步至模型服务", "success");
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
        {
          style: {
            borderRadius: "12px",
            border: "1px solid rgba(59, 130, 246, 0.22)",
            background:
              "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)",
            padding: "14px 16px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "6px",
            },
          },
          h(
            "div",
            { style: { fontWeight: 600, fontSize: "14px" } },
            "梦由心生AI · BYOK 一键接入",
          ),
          h(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(16, 185, 129, 0.14)",
                color: "#059669",
                fontWeight: 600,
              },
            },
            "官方内置插件",
          ),
        ),
        h(
          "p",
          {
            style: {
              margin: 0,
              fontSize: "12px",
              opacity: 0.75,
              lineHeight: 1.6,
            },
          },
          "只需填写一个梦由心生 API Key，即可一键配置聊天、图片与视频模型：文本走通用 chat-completion，图片与视频走站内媒体协议（POST /v1/media/generate 提交，GET /v1/media/status 轮询）。有 Key 时首次打开会自动按类型拉取在线模型并合并进清单，拉取失败时静默使用下方静态代表模型，不改动 BeefTV 原有默认模型配置。",
        ),
      ),

      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "12px",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h(
            "label",
            {
              htmlFor: "myxsai-plugin-base-url",
              style: { fontSize: "12px", fontWeight: 600 },
            },
            "接口地址 (Base URL)",
          ),
          h("input", {
            id: "myxsai-plugin-base-url",
            type: "text",
            value: baseUrl,
            onChange: (e) => setBaseUrl(e.target.value),
            placeholder: DEFAULT_BASE_URL,
            style: {
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(128,128,128,0.28)",
              background: "transparent",
              fontSize: "13px",
              fontFamily: "monospace",
            },
          }),
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h(
            "label",
            {
              htmlFor: "myxsai-plugin-api-key",
              style: { fontSize: "12px", fontWeight: 600 },
            },
            "梦由心生 API Key",
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px" } },
            h("input", {
              id: "myxsai-plugin-api-key",
              "aria-label": "梦由心生 API Key",
              type: showKey ? "text" : "password",
              value: apiKey,
              onChange: (e) => setApiKey(e.target.value),
              placeholder: "sk-...",
              style: {
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(128,128,128,0.28)",
                background: "transparent",
                fontSize: "13px",
                fontFamily: "monospace",
              },
            }),
            h(
              "button",
              {
                type: "button",
                onClick: () => setShowKey((v) => !v),
                style: {
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(128,128,128,0.28)",
                  background: "transparent",
                  fontSize: "12px",
                  cursor: "pointer",
                },
              },
              showKey ? "隐藏" : "显示",
            ),
            h(
              "button",
              {
                type: "button",
                disabled: catalogChecking,
                onClick: handleFetchCatalog,
                style: {
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  background: "rgba(59, 130, 246, 0.08)",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: catalogChecking ? "wait" : "pointer",
                },
              },
              catalogChecking ? "验证中..." : "验证在线目录",
            ),
          ),
        ),
      ),

      fetchedSummary
        ? h(
            "div",
            {
              style: {
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#047857",
                fontSize: "12px",
              },
            },
            fetchedSummary,
          )
        : null,

      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            },
          },
          h(
            "span",
            { style: { fontSize: "12px", fontWeight: 600 } },
            `预置协议模型（已选 ${selectedModels.length} / ${allModels.length}）`,
          ),
          h(
            "div",
            { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
            ["all", "text", "image", "video", "audio"].map((key) =>
              h(
                "button",
                {
                  key,
                  type: "button",
                  onClick: () => setFilter(key),
                  style: {
                    padding: "3px 10px",
                    borderRadius: "999px",
                    border: "1px solid rgba(128, 128, 128, 0.3)",
                    background: filter === key ? "rgba(59, 130, 246, 0.12)" : "transparent",
                    color: filter === key ? "#2563eb" : "inherit",
                    fontSize: "12px",
                    fontWeight: filter === key ? 600 : 400,
                    cursor: "pointer",
                  },
                },
                key === "all"
                  ? "全部"
                  : `${CAPABILITY_LABEL[key]} ${allModels.filter((item) => item.capability === key).length}`,
              ),
            ),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () =>
                setSelectedModels(
                  selectedModels.length === allModels.length
                    ? []
                    : allModels.map((item) => item.model),
                ),
              style: {
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: "12px",
                cursor: "pointer",
              },
            },
            selectedModels.length === allModels.length ? "取消全选" : "全选模型",
          ),
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "8px",
            },
          },
          visibleModels.map((item) => {
            const checked = selectedModels.includes(item.model);
            const isOnline =
              onlineModels.includes(item.model) ||
              onlineModels.some((m) =>
                String(m).toLowerCase().endsWith(item.model.toLowerCase()),
              );
            const isFetched = fetchedProfiles.some((entry) => entry.model === item.model);
            const badge = CAPABILITY_STYLE[item.capability] || CAPABILITY_STYLE.text;
            return h(
              "label",
              {
                key: item.model,
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: checked
                    ? "1px solid rgba(59, 130, 246, 0.45)"
                    : "1px solid rgba(128, 128, 128, 0.2)",
                  background: checked ? "rgba(59, 130, 246, 0.05)" : "transparent",
                  cursor: "pointer",
                  fontSize: "12px",
                },
              },
              h("input", {
                type: "checkbox",
                checked,
                onChange: () => toggleModel(item.model),
                style: { marginTop: "3px" },
              }),
              h(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "4px",
                      fontWeight: 600,
                    },
                  },
                  h("span", null, item.displayName),
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: badge.background,
                        color: badge.color,
                      },
                    },
                    CAPABILITY_LABEL[item.capability] || item.capability,
                  ),
                ),
                h(
                  "div",
                  {
                    style: {
                      fontSize: "11px",
                      opacity: 0.65,
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  `${item.model} · ${item.endpoint || item.protocol || ""}`,
                ),
                isFetched
                  ? h(
                      "div",
                      { style: { fontSize: "10px", color: "#059669", marginTop: "2px" } },
                      "● 在线按类型拉取",
                    )
                  : null,
                isOnline
                  ? h(
                      "div",
                      { style: { fontSize: "10px", color: "#059669", marginTop: "2px" } },
                      "● 上游目录已确认在线",
                    )
                  : null,
                item.capability === "audio" && !item.protocol
                  ? h(
                      "div",
                      { style: { fontSize: "10px", color: "#b45309", marginTop: "2px" } },
                      "音频协议待确认，同步后请在模型服务里自选协议",
                    )
                  : null,
              ),
            );
          }),
        ),
        visibleModels.length === 0
          ? h(
              "div",
              { style: { fontSize: "12px", opacity: 0.6 } },
              "该分类下暂无模型（音频分类仅在按类型拉取到模型后出现）。",
            )
          : null,
      ),

      errorMessage
        ? h(
            "div",
            {
              role: "alert",
              style: {
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#dc2626",
                fontSize: "12px",
              },
            },
            errorMessage,
          )
        : null,
      statusMessage
        ? h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#059669",
                fontSize: "12px",
              },
            },
            h("span", null, statusMessage),
            synced
              ? h(
                  "button",
                  {
                    type: "button",
                    onClick: () => host?.ui?.navigate?.("/settings?section=channels"),
                    style: {
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#047857",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    },
                  },
                  "前往模型服务查看与测试 →",
                )
              : null,
          )
        : null,

      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            paddingTop: "4px",
          },
        },
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
      ),
    );
  };
}

export function activate(host) {
  const SettingsPanel = createMyxsaiSettingsPanel(host);
  const dispose = host.contribute("app.settings", {
    id: "myxsai-settings",
    label: "梦由心生AI",
    component: SettingsPanel,
  });
  return () => {
    if (typeof dispose === "function") dispose();
  };
}

export default { activate, BUILTIN_SERVICE_PRESET };
