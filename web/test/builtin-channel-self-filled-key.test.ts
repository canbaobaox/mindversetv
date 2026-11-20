import { afterEach, expect, test } from "bun:test";

import { apiClient } from "../src/services/api/request";
import { commitModelConfig, hydrateModelConfig } from "../src/services/model-config-repository";
import { channelHasBeefTVCredential, createModelChannel, defaultConfig, type AiConfig } from "../src/stores/use-config-store";

const originalApiRequest = apiClient.request;

afterEach(() => {
    apiClient.request = originalApiRequest;
});

test("builtin channel pull gate accepts a just-typed key, a stored key, or the managed credential", () => {
    const base = { id: "beeftv", pinned: true } as const;
    // 刚在编辑器里填完 Key、hasApiKey 还没回读到：按钮必须立刻能点。
    expect(channelHasBeefTVCredential({ ...base, apiKey: "synthetic-typed-key" })).toBe(true);
    // 重启后内存 Key 已清空、只有服务端标记：按钮也要能点。
    expect(channelHasBeefTVCredential({ ...base, hasApiKey: true })).toBe(true);
    expect(channelHasBeefTVCredential({ ...base, credentialRef: "beeftv" })).toBe(true);
    expect(channelHasBeefTVCredential({ ...base })).toBe(false);
    expect(channelHasBeefTVCredential({ id: "manual", pinned: false, apiKey: "synthetic-key" })).toBe(false);
});

test("self-filled builtin channel key is persisted, managed credential key is not written to local config", async () => {
    const puts: Array<{ config: AiConfig; expectedRevision: number }> = [];
    let revision = 1;
    apiClient.request = (async (request) => {
        if (request.url === "/workspace/model-config" && request.method === "get") {
            return { status: 200, data: { code: 0, data: { config: defaultConfig, revision, health: "ready", source: "builtin+local" }, msg: "" } };
        }
        if (request.url === "/workspace/model-config" && request.method === "put") {
            puts.push(request.data as { config: AiConfig; expectedRevision: number });
            revision = (request.data as { config: AiConfig; expectedRevision: number }).expectedRevision + 1;
            return { status: 200, data: { code: 0, data: { saved: true, revision }, msg: "" } };
        }
        throw new Error(`unexpected request ${request.method} ${request.url}`);
    }) as typeof apiClient.request;

    await hydrateModelConfig();

    const selfFilled = {
        ...defaultConfig,
        channels: [createModelChannel({ id: "beeftv", name: "梦由心生AI", pinned: true, baseUrl: "https://api.lk888.ai", apiKey: "synthetic-self-filled-key", models: [] })],
    };
    await commitModelConfig(selfFilled);
    expect(puts).toHaveLength(1);
    expect(puts[0]!.config.channels[0]?.apiKey).toBe("synthetic-self-filled-key");

    const managed = {
        ...defaultConfig,
        channels: [createModelChannel({ id: "beeftv", name: "梦由心生AI", pinned: true, credentialRef: "beeftv", baseUrl: "https://api.lk888.ai", apiKey: "synthetic-managed-key", models: [] })],
    };
    await commitModelConfig(managed);
    expect(puts).toHaveLength(2);
    expect(puts[1]!.config.channels[0]?.apiKey).toBe("");
});
