import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { createModelChannel, defaultConfig } from "@/stores/use-config-store";
import { readAppGlobalsSource } from "./helpers/app-styles";

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
const version = readFileSync(new URL("../../VERSION", import.meta.url), "utf8").trim();

function createGate() {
    let enteredResolve!: () => void;
    let releaseResolve!: () => void;
    const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
    const released = new Promise<void>((resolve) => { releaseResolve = resolve; });
    return {
        enter: () => {
            enteredResolve();
            return released;
        },
        entered,
        release: () => releaseResolve(),
    };
}

let connectionState = "disconnected";
let startCalls = 0;
let disconnectCalls = 0;
let connectionReads = 0;
let catalogReads = 0;
let failCatalogReads = 0;
let blockNextConnectionPoll = false;
let connectionPollGate = createGate();
let blockCuratedRemote = false;
let curatedGate = createGate();
let failCuratedRemote = false;
let failNpmSearch = false;
let serveMyxsaiKey = false;
let myxsaiBalance = { balance: 28.5, currency: "CNY", hasBalance: true };
let networkProxyMode: "system" | "direct" = "system";
let networkProxyEffectiveMode: "system" | "environment" | "direct" = "system";
let failNetworkProxyGet = false;
let failNetworkProxySave = false;
let holdNetworkProxySave = false;
let networkProxySaveGate = createGate();
let networkProxyRestartPending = false;
let networkProxyPutModes: string[] = [];

beforeEach(() => {
    connectionState = "disconnected";
    startCalls = 0;
    disconnectCalls = 0;
    connectionReads = 0;
    catalogReads = 0;
    failCatalogReads = 0;
    blockNextConnectionPoll = false;
    connectionPollGate.release();
    connectionPollGate = createGate();
    blockCuratedRemote = false;
    curatedGate.release();
    curatedGate = createGate();
    failCuratedRemote = false;
    failNpmSearch = false;
    serveMyxsaiKey = false;
    myxsaiBalance = { balance: 28.5, currency: "CNY", hasBalance: true };
    networkProxyMode = "system";
    networkProxyEffectiveMode = "system";
    failNetworkProxyGet = false;
    failNetworkProxySave = false;
    holdNetworkProxySave = false;
    networkProxySaveGate = createGate();
    networkProxyRestartPending = false;
    networkProxyPutModes = [];
});

beforeAll(async () => {
    const build = await Bun.build({
        entrypoints: [import.meta.dir + "/fixtures/account-sidebar-harness.tsx"],
        target: "browser",
        define: {
            __APP_VERSION__: JSON.stringify(version),
            "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
            "import.meta.env.VITE_BUILD_COMMIT": '"test"',
            "import.meta.env.DEV": "false",
            "import.meta.env.PROD": "true",
            "import.meta.env.MODE": '"production"',
            "import.meta.env.VITE_CANVAS_LOCAL_MODE": '"true"',
            "import.meta.env.VITE_CANVAS_BACKEND_URL": '"/api"',
            "process.env.NODE_ENV": '"production"',
        },
        plugins: [{
            name: "source",
            setup(builder) {
                const globalsCssPath = Bun.resolveSync("../src/styles/globals.css", import.meta.dir);
                builder.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, namespace: "test-url" }));
                builder.onLoad({ filter: /.*/, namespace: "test-url" }, () => ({ contents: 'export default "";', loader: "js" }));
                builder.onResolve({ filter: /^@\/.*\?raw$/ }, (args) => ({ path: Bun.resolveSync("../src/" + args.path.slice(2, -4), import.meta.dir), namespace: "test-raw" }));
                builder.onLoad({ filter: /.*/, namespace: "test-raw" }, async (args) => ({
                    contents: `export default ${JSON.stringify(args.path === globalsCssPath ? readAppGlobalsSource() : await Bun.file(args.path).text())};`,
                    loader: "js",
                }));
                builder.onResolve({ filter: /^@\/components\/model-logo$/ }, () => ({ path: "model-logo", namespace: "test-icons" }));
                builder.onLoad({ filter: /.*/, namespace: "test-icons" }, () => ({ contents: "export function ModelLogo() { return null; }", loader: "js" }));
                builder.onResolve({ filter: /^@\/lib\/workspace-route-modules$/ }, () => ({ path: "workspace-route-modules", namespace: "test-preload" }));
                builder.onLoad({ filter: /.*/, namespace: "test-preload" }, () => ({ contents: "export function preloadWorkspaceRoute() {}", loader: "js" }));
                builder.onResolve({ filter: /^@\// }, (args) => ({ path: Bun.resolveSync("../src/" + args.path.slice(2), import.meta.dir) }));
            },
        }],
    });
    if (!build.success) throw new Error(build.logs.join("\n"));
    const js = await build.outputs.find((output) => output.path.endsWith(".js"))!.text();
    const css = (await build.outputs.find((output) => output.path.endsWith(".css"))?.text()) || "";
    const ok = (data: unknown) => Response.json({ code: 0, data });
    const savedConfig = {
        ...defaultConfig,
        channels: [createModelChannel({ id: "beeftv", pinned: true, enabled: true, models: ["gpt-6-astra"], modelProfiles: [{ model: "gpt-6-astra", capability: "text", protocol: "chat-completion" }] })],
    };

    server = Bun.serve({
        port: 0,
        async fetch(req) {
            const url = new URL(req.url);
            const path = url.pathname;
            if (path === "/harness.js") return new Response(js, { headers: { "Content-Type": "application/javascript" } });
            if (path === "/harness.css") return new Response(css, { headers: { "Content-Type": "text/css" } });
            if (path.endsWith("/beeftv/connection/start")) {
                startCalls += 1;
                connectionState = "connected";
                return ok({
                    state: connectionState,
                    hasCredential: true,
                    account: { id: "u-1", display_name: "测试账号", email: "tester@example.com" },
                });
            }
            if (path.endsWith("/beeftv/connection/cancel")) {
                connectionState = "cancelled";
                return ok({ state: connectionState, hasCredential: false });
            }
            if (path.endsWith("/beeftv/connection/disconnect")) {
                disconnectCalls += 1;
                connectionState = "disconnected";
                return ok({ state: connectionState, hasCredential: false, account: null });
            }
            if (path.endsWith("/beeftv/connection")) {
                connectionReads += 1;
                const snapshotState = connectionState;
                if (blockNextConnectionPoll) {
                    blockNextConnectionPoll = false;
                    await connectionPollGate.enter();
                }
                const hasRetainedCredential = snapshotState === "connected" || snapshotState === "catalog_failed" || snapshotState === "connection_error";
                return ok({
                    state: snapshotState,
                    hasCredential: hasRetainedCredential,
                    balance: hasRetainedCredential ? "available" : "unknown",
                    catalogFailed: snapshotState === "catalog_failed" || snapshotState === "connection_error",
                    account: hasRetainedCredential ? { id: "u-1", display_name: "测试账号", email: "tester@example.com" } : null,
                });
            }
            if (path.includes("model-config")) {
                if (req.method === "GET") {
                    catalogReads += 1;
                    if (failCatalogReads > 0) {
                        failCatalogReads -= 1;
                        return Response.json({ code: 500, msg: "Synthetic catalog failure" }, { status: 500 });
                    }
                    const config = serveMyxsaiKey
                        ? { ...savedConfig, channels: [...savedConfig.channels, createModelChannel({ id: "myxsai", name: "梦由心生AI", baseUrl: "https://api.lk888.ai", apiKey: "sk-test", enabled: true, models: ["doubao-seed-2-1-pro-260628"], modelProfiles: [{ model: "doubao-seed-2-1-pro-260628", capability: "text", protocol: "chat-completion" }] })] }
                        : savedConfig;
                    return ok({ config, revision: 1 });
                }
                return ok({ saved: true, revision: 2 });
            }
            if (path.endsWith("/account/myxsai-balance")) {
                return ok(myxsaiBalance);
            }
            if (path === "/api/plugins/market/curated") {
                if (url.searchParams.get("cached") === "1") {
                    return ok({ items: [] });
                }
                if (blockCuratedRemote) {
                    blockCuratedRemote = false;
                    await curatedGate.enter();
                }
                if (failCuratedRemote) {
                    return Response.json({ code: 502, msg: "测试推荐源暂不可用" }, { status: 502 });
                }
                return ok({
                    items: [{ id: "demo-curated", packageName: "demo-curated", name: "精选演示插件", description: "用于验证冷启动加载态", version: "0.1.0", recommended: true }],
                });
            }
            if (path === "/api/plugins/market/search") {
                if (failNpmSearch) {
                    return Response.json({ code: 502, msg: "社区搜索暂不可用" }, { status: 502 });
                }
                return ok({ items: [] });
            }
            if (path === "/api/workspace/network-proxy") {
                if (req.method === "PUT") {
                    const body = (await req.json()) as { mode?: string };
                    networkProxyPutModes.push(String(body.mode ?? ""));
                    if (holdNetworkProxySave) {
                        await networkProxySaveGate.enter();
                    }
                    if (failNetworkProxySave) {
                        return Response.json({ code: 500, msg: "网络代理设置保存失败" }, { status: 500 });
                    }
                    networkProxyMode = body.mode === "direct" ? "direct" : "system";
                    networkProxyEffectiveMode = networkProxyMode === "direct" ? "direct" : "system";
                    return ok({
                        mode: networkProxyMode,
                        effectiveMode: networkProxyEffectiveMode,
                        autoConfigOnly: false,
                        assistantRestarted: !networkProxyRestartPending,
                        assistantRestartPending: networkProxyRestartPending,
                    });
                }
                if (failNetworkProxyGet) {
                    return Response.json({ code: 500, msg: "读取网络代理设置失败" }, { status: 500 });
                }
                return ok({
                    mode: networkProxyMode,
                    effectiveMode: networkProxyEffectiveMode,
                    autoConfigOnly: false,
                    assistantRestartPending: networkProxyRestartPending,
                });
            }
            if (path.startsWith("/api/")) return ok({ items: [], plugins: [], states: {} });
            return new Response('<html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/harness.css"><div id="root"></div><script type="module" src="/harness.js"></script></html>', {
                headers: { "Content-Type": "text/html" },
            });
        },
    });
    const executablePath = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p): p is string => Boolean(p && existsSync(p)));
    browser = await chromium.launch({ executablePath, headless: true });
}, 60000);

afterAll(async () => {
    connectionPollGate.release();
    curatedGate.release();
    server?.stop(true);
    await browser?.close();
}, 30000);

test("account settings opens problem diagnostics as its own section without leaving the dialog", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 760 }, reducedMotion: "reduce" });
    try {
        await page.route("**/api/diagnostics/preview", (route) => route.fulfill({
            json: { code: 0, data: { taskCount: 3, apiCallCount: 5 } },
        }));
        await page.goto(server.url.toString());
        await page.getByRole("button", { name: "账户设置", exact: true }).click();
        const modal = page.locator(".account-settings-modal");
        const diagnostics = modal.getByRole("button", { name: "问题诊断", exact: true });
        const url = page.url();
        await diagnostics.click();
        expect(await diagnostics.getAttribute("aria-current")).toBe("page");
        await modal.getByRole("heading", { name: "问题诊断", exact: true }).waitFor();
        await modal.getByText("包含 3 个任务、5 次请求与前端日志。", { exact: true }).waitFor({ timeout: 5000 });
        expect(await modal.getByRole("button", { name: "导出诊断包" }).isVisible()).toBe(true);
        expect(await modal.getByRole("button", { name: "重新检查" }).isVisible()).toBe(true);
        expect(page.url()).toBe(url);
        await modal.getByRole("button", { name: "通用设置", exact: true }).click();
        expect(await modal.getByText("连接诊断", { exact: true }).count()).toBe(0);
    } finally {
        await page.close();
    }
}, 30000);

test("opening sidebar account modal never auto-starts a connection; account pane states no official login, changelog works, and model tab points to self-filled channels", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        const trigger = page.getByRole("button", { name: "账户设置", exact: true });
        await trigger.waitFor();
        expect(connectionReads).toBe(1);

        await trigger.click();
        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();
        expect(startCalls).toBe(0);

        await modal.getByRole("button", { name: "通用设置" }).click();
        expect(await modal.innerText()).toContain(version);
        await modal.getByRole("button", { name: /查看更新日志/ }).click();
        const changelogDialog = page.locator(".app-changelog-modal .ant-modal");
        await changelogDialog.waitFor();
        expect(await changelogDialog.innerText()).toContain(version);
        await changelogDialog.locator(".ant-modal-close").click();
        await changelogDialog.waitFor({ state: "hidden" });

        // MindVerseTV 已移除官方账号登录：账号页只说明去模型渠道自填梦由心生 Key，不再有登录按钮。
        await modal.getByRole("button", { name: "账号与余额" }).click();
        await modal.getByText("未填写 API Key，请先在模型渠道填写梦由心生 Key").waitFor();
        expect(await modal.getByRole("button", { name: /^登\s*录$/ }).count()).toBe(0);
        expect(startCalls).toBe(0);

        await modal.getByRole("button", { name: "模型", exact: true }).click();
        await modal.getByText("MindVerseTV 不提供官方账号登录，请自填模型渠道").waitFor();
        expect(await modal.getByRole("button", { name: "管理渠道", exact: true }).isVisible()).toBe(true);
        expect(startCalls).toBe(0);
    } finally {
        await page.close();
    }
}, 30000);


test("general settings switches network proxy mode, recovers from load errors, and never wedges saving across tab switches", async () => {
    failNetworkProxyGet = true;
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        await page.getByRole("button", { name: "账户设置", exact: true }).click();
        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();
        await modal.getByRole("button", { name: "通用设置", exact: true }).click();
        await modal.getByRole("alert").filter({ hasText: "读取网络代理设置失败" }).waitFor();

        // Retry button recovers cleanly from an initial load failure.
        failNetworkProxyGet = false;
        await modal.getByRole("button", { name: /^重\s*试$/ }).click();
        await modal.getByText("当前已跟随系统代理。", { exact: false }).waitFor();

        const proxyControl = modal.getByRole("radiogroup", { name: "网络代理" });
        networkProxyRestartPending = true;
        await proxyControl.getByText("不使用代理", { exact: true }).click();
        await modal.getByText("BeefTV 与内置助手均直连", { exact: false }).waitFor();
        await modal.getByText("助手当前正忙或正在重启，空闲后将自动应用新设置。").waitFor();
        expect(networkProxyPutModes).toEqual(["direct"]);

        // Save error renders in destructive color inline without duplicating error toasts.
        failNetworkProxySave = true;
        await proxyControl.getByText("跟随系统", { exact: true }).click();
        const errorAlert = modal.getByRole("alert").filter({ hasText: "网络代理设置保存失败" });
        await errorAlert.waitFor();
        const errorColors = await errorAlert.evaluate((node) => {
            const probe = document.createElement("span");
            probe.style.color = "var(--destructive)";
            node.parentElement?.appendChild(probe);
            const destructiveColor = getComputedStyle(probe).color;
            probe.remove();
            return { actual: getComputedStyle(node).color, expected: destructiveColor };
        });
        expect(errorColors.actual).toBe(errorColors.expected);
        expect(await page.locator(".ant-message-error").count()).toBe(0);
        expect(networkProxyMode).toBe("direct");

        // Switching tabs while a PUT is in flight must never leave the Segmented stuck disabled.
        failNetworkProxySave = false;
        networkProxyRestartPending = false;
        holdNetworkProxySave = true;
        await proxyControl.getByText("跟随系统", { exact: true }).click();
        await networkProxySaveGate.entered;
        await modal.getByRole("button", { name: "账号与余额", exact: true }).click();
        await modal.getByRole("button", { name: "通用设置", exact: true }).click();
        networkProxySaveGate.release();
        await modal.getByText("当前已跟随系统代理。", { exact: false }).waitFor();
        await page.waitForFunction(() => {
            const el = document.querySelector('.account-settings-modal [role="radiogroup"][aria-label="网络代理"]');
            return Boolean(el && !el.classList.contains("ant-segmented-disabled"));
        });
        holdNetworkProxySave = false;
        await proxyControl.getByText("不使用代理", { exact: true }).click();
        await modal.getByText("BeefTV 与内置助手均直连", { exact: false }).waitFor();
        expect(networkProxyMode).toBe("direct");
    } finally {
        await page.close();
    }
}, 30000);


test("catalog_failed keeps authenticated account identity/wallet and retries backend catalog finalize", async () => {
    connectionState = "catalog_failed";
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        const trigger = page.getByRole("button", { name: "MindVerseTV 账户：测试账号", exact: true });
        await trigger.waitFor();
        await trigger.click();

        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();
        expect(startCalls).toBe(0);
        expect(await modal.getByRole("link", { name: "余额与用量" }).isDisabled()).toBe(false);
        expect(await modal.innerText()).toContain("模型列表读取失败，请重试");

        await modal.getByRole("button", { name: "模型", exact: true }).click();
        await modal.getByText("模型同步失败").waitFor();
        await modal.getByRole("button", { name: "重试同步", exact: true }).click();
        await modal.getByText("已连接，模型已同步到本地").waitFor();
        expect(startCalls).toBe(1);
    } finally {
        await page.close();
    }
}, 30000);

test("connection_error with catalogFailed=true retries backend finalize from model tab", async () => {
    connectionState = "connection_error";
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        await page.getByRole("button", { name: "账户设置", exact: true }).click();
        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();
        await modal.getByRole("button", { name: "模型", exact: true }).click();
        await modal.getByText("模型同步失败").waitFor();
        await modal.getByRole("button", { name: "重试同步", exact: true }).click();
        await modal.getByText("已连接，模型已同步到本地").waitFor();
        expect(startCalls).toBe(1);
    } finally {
        await page.close();
    }
}, 30000);

test("stale background poll cannot overwrite a newer connection action result", async () => {
    connectionState = "pending";
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        const trigger = page.getByRole("button", { name: "等待确认", exact: true });
        await trigger.waitFor();
        await trigger.click();
        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();

        blockNextConnectionPoll = true;
        await connectionPollGate.entered;

        await modal.getByRole("button", { name: "取消本次登录", exact: true }).click();
        await modal.getByText("已取消本次连接").waitFor();

        connectionPollGate.release();
        await page.waitForTimeout(250);
        expect(await modal.innerText()).toContain("已取消本次连接");
        expect(await modal.innerText()).not.toContain("请在浏览器中确认授权");
    } finally {
        await page.close();
    }
}, 30000);

test("collapsing sidebar resets expanded social links without stealing focus from the collapse button", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        await page.getByRole("button", { name: "联系我们" }).click();
        await page.getByRole("button", { name: "收起联系方式" }).waitFor();

        const collapseBtn = page.getByRole("button", { name: "切换侧栏收起" });
        await collapseBtn.click();
        expect(await collapseBtn.evaluate((el) => document.activeElement === el)).toBe(true);

        await collapseBtn.click();
        const contactBtn = page.getByRole("button", { name: "联系我们" });
        expect(await contactBtn.getAttribute("aria-expanded")).toBe("false");
    } finally {
        await page.close();
    }
}, 30000);

test("sidebar utility icons show the shared tooltip above the control", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript(() => {
            if (new URLSearchParams(location.search).has("browser")) return;
            const update = async () => ({ status: "available", currentVersion: "v2.3.1", latestVersion: "v99.0.0" });
            window.go = { main: { DesktopApp: { UpdateStatus: update, CheckForUpdate: update, DownloadUpdate: async () => { throw Error("Unexpected download"); }, InstallUpdate: async () => { throw Error("Unexpected install"); } } } } as typeof window.go;
        });
        await page.goto(new URL("?utility", server.url).toString());
        const update = page.getByRole("button", { name: /下载并安装更新/ });
        const theme = page.getByRole("button", { name: /切换到[浅深]色模式/ });
        const themeLabel = (await theme.getAttribute("aria-label"))!;
        for (const [button, label] of [[update, "当前有可用更新"], [theme, themeLabel]] as const) {
            expect(await button.getAttribute("title")).toBeNull();
            await button.hover();
            const tooltip = page.locator(".app-workspace-sidebar-tooltip").getByText(label, { exact: true });
            await tooltip.waitFor({ state: "visible" });
            const control = (await button.boundingBox())!;
            await page.waitForFunction(({ label, controlTop }) =>
                Array.from(document.querySelectorAll(".app-workspace-sidebar-tooltip .app-workspace-sidebar-tooltip-content")).some((hint) =>
                    hint.textContent?.trim() === label && hint.getBoundingClientRect().bottom < controlTop,
                ), { label, controlTop: control.y }, { timeout: 5000 });
        }
        await theme.click();
        const switchedLabel = themeLabel === "切换到浅色模式" ? "切换到深色模式" : "切换到浅色模式";
        await page.locator(".app-workspace-sidebar-tooltip").getByText(switchedLabel, { exact: true }).waitFor({ state: "visible" });
        await page.goto(new URL("?utility&browser", server.url).toString());
        const unavailable = page.getByRole("button", { name: "当前环境不支持自动更新" });
        expect(await unavailable.isDisabled()).toBe(true);
        await page.locator(".app-workspace-update-trigger").hover();
        await page.locator(".app-workspace-sidebar-tooltip").getByText("当前环境不支持自动更新", { exact: true }).waitFor({ state: "visible" });
    } finally {
        await page.close();
    }
}, 30000);

test("plugin market keeps loading on empty cache, clears curated error after recovery, and isolates npm search errors", async () => {
    blockCuratedRemote = true;
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.goto(new URL("/market", server.url).toString());
        await curatedGate.entered;
        await page.getByText("正在读取插件…").waitFor();
        expect(await page.locator(".plugin-market").innerText()).not.toContain("暂无推荐插件");

        curatedGate.release();
        await page.getByText("精选演示插件").waitFor();

        failCuratedRemote = true;
        await page.getByRole("combobox", { name: "安装下载源" }).click();
        await page.locator(".ant-select-item-option-content").filter({ hasText: /npmjs\.org/ }).click();
        await page.getByRole("alert").filter({ hasText: "测试推荐源暂不可用" }).waitFor();

        failCuratedRemote = false;
        await page.getByRole("combobox", { name: "安装下载源" }).click();
        await page.locator(".ant-select-item-option-content").filter({ hasText: /npmmirror/ }).click();
        await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
        expect(await page.locator(".plugin-market").innerText()).toContain("精选演示插件");

        failNpmSearch = true;
        await page.getByTestId("market-tab-npm").click();
        await page.getByTestId("market-npm-search-button").click();
        await page.getByRole("alert").filter({ hasText: "社区搜索暂不可用" }).waitFor();

        await page.getByTestId("market-tab-curated").click();
        await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
        expect(await page.locator(".plugin-market").innerText()).toContain("精选演示插件");
    } finally {
        await page.close();
    }
}, 30000);

test("myxsai balance pane shows the server-side balance and only offers a recharge link", async () => {
    // Connected state triggers the provider's catalog sync on first poll,
    // which is the only path that loads the served model config into the
    // store (disconnected initial state never fetches it).
    connectionState = "connected";
    serveMyxsaiKey = true;
    const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
    try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(server.url.toString());
        await page.getByRole("button", { name: "MindVerseTV 账户：测试账号", exact: true }).click();
        const modal = page.locator(".account-settings-modal");
        await modal.waitFor();
        await modal.getByRole("button", { name: "账号与余额" }).click();
        await modal.getByText("已填写 API Key").waitFor();
        await modal.getByText("CNY 28.50").waitFor();

        // No in-app payment UI: recharge is only a link out to the myxsai site.
        const recharge = modal.getByRole("link", { name: "去充值", exact: true });
        expect(await recharge.getAttribute("href")).toBe("https://myxsai.com");
        expect(await modal.getByRole("button", { name: "微信支付", exact: true }).count()).toBe(0);
        expect(await modal.getByRole("button", { name: "支付宝", exact: true }).count()).toBe(0);
        expect(await modal.getByRole("button", { name: "国际银行卡", exact: true }).count()).toBe(0);
        expect(await modal.getByText("应用内不收钱").count()).toBe(1);
    } finally {
        await page.close();
    }
}, 30000);
