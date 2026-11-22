import { describe, expect, test } from "bun:test";

import {
    getDockSidePanelEntries,
    getSidebarSidePanelEntries,
    type SidePanelSlotEntry,
} from "@/lib/plugins/plugin-side-panels";

function entry(id: string, dockButton?: boolean): SidePanelSlotEntry {
    return {
        entryId: `entry-${id}`,
        pluginId: "test-plugin",
        payload: { id, title: id, dockButton, component: () => null },
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
});
