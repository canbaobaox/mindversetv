import { describe, expect, test } from "bun:test";

import {
    getDockSidePanelEntries,
    getSidebarSidePanelEntries,
    getTopBarSidePanelEntries,
    initialDockPanelState,
    nextDockPanelState,
    type SidePanelSlotEntry,
} from "@/lib/plugins/plugin-side-panels";

function entry(id: string, dockButton?: boolean, topBarButton?: boolean): SidePanelSlotEntry {
    return {
        entryId: `entry-${id}`,
        pluginId: "test-plugin",
        payload: { id, title: id, dockButton, topBarButton, component: () => null },
    };
}

describe("画布侧栏去处", () => {
    test("dockButton 的面板只进画布 Dock，不进助手侧栏", () => {
        const entries = [entry("prompt-board", true), entry("other")];
        expect(getDockSidePanelEntries(entries).map((item) => item.payload.id)).toEqual(["prompt-board"]);
        expect(getSidebarSidePanelEntries(entries).map((item) => item.payload.id)).toEqual(["other"]);
    });

    test("没有 dockButton 的面板全部进助手侧栏（原有行为）", () => {
        const entries = [entry("a"), entry("b", false)];
        expect(getDockSidePanelEntries(entries)).toEqual([]);
        expect(getSidebarSidePanelEntries(entries)).toHaveLength(2);
    });

    test("只有 dockButton 且 topBarButton 的面板才进画布顶栏", () => {
        const entries = [entry("prompt-board", true, true), entry("dock-only", true), entry("sidebar-only", false, true), entry("other")];
        expect(getTopBarSidePanelEntries(entries).map((item) => item.payload.id)).toEqual(["prompt-board"]);
        // 顶栏入口不影响底部 Dock 与助手侧栏的去处。
        expect(getDockSidePanelEntries(entries).map((item) => item.payload.id)).toEqual(["prompt-board", "dock-only"]);
        expect(getSidebarSidePanelEntries(entries).map((item) => item.payload.id)).toEqual(["sidebar-only", "other"]);
    });
});

describe("画布 Dock 浮动面板开关状态", () => {
    test("入口点开、再点关闭、换面板不卡收起态", () => {
        const open = nextDockPanelState(initialDockPanelState, { type: "toggle-entry", id: "prompt-board" });
        expect(open).toEqual({ activeId: "prompt-board", collapsed: false });
        expect(nextDockPanelState(open, { type: "toggle-entry", id: "prompt-board" })).toEqual(initialDockPanelState);
        // 打开 A 再点 B：直接切到 B，不用先关 A。
        expect(nextDockPanelState(open, { type: "toggle-entry", id: "other" })).toEqual({ activeId: "other", collapsed: false });
    });

    test("收起后再点同一个入口是展开、不是关闭", () => {
        const open = nextDockPanelState(initialDockPanelState, { type: "toggle-entry", id: "prompt-board" });
        const collapsed = nextDockPanelState(open, { type: "toggle-minimize" });
        expect(collapsed).toEqual({ activeId: "prompt-board", collapsed: true });
        // 收起态下点顶栏/Dock 入口应展开面板；如果这里关掉了，看起来就像点了没反应。
        expect(nextDockPanelState(collapsed, { type: "toggle-entry", id: "prompt-board" })).toEqual({ activeId: "prompt-board", collapsed: false });
        // 收起态下点另一个入口：直接切过去并展开。
        expect(nextDockPanelState(collapsed, { type: "toggle-entry", id: "other" })).toEqual({ activeId: "other", collapsed: false });
    });

    test("收起开关来回切、关闭与 Esc 都回到关态", () => {
        const open = nextDockPanelState(initialDockPanelState, { type: "toggle-entry", id: "prompt-board" });
        const collapsed = nextDockPanelState(open, { type: "toggle-minimize" });
        expect(nextDockPanelState(collapsed, { type: "toggle-minimize" })).toEqual(open);
        // 收起态下点关闭按钮或按 Esc：直接关闭，不会先展开。
        expect(nextDockPanelState(collapsed, { type: "close" })).toEqual(initialDockPanelState);
        expect(nextDockPanelState(open, { type: "close" })).toEqual(initialDockPanelState);
        // 没打开时点收起是空操作，不凭空打开面板。
        expect(nextDockPanelState(initialDockPanelState, { type: "toggle-minimize" })).toEqual(initialDockPanelState);
    });
});
