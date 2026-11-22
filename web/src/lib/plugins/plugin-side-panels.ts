import type { PluginSlotMap } from "@/lib/plugins/plugin-types";

/** 画布侧栏贡献的两种去处只由 dockButton 决定，判断集中在这里，别处不要各写一份。 */
export type SidePanelSlotEntry = {
    entryId: string;
    pluginId: string;
    payload: PluginSlotMap["canvas.sidePanel"];
};

/** dockButton 为 true 的进画布底部 Dock：一个开关按钮 + 画布内浮动面板。 */
export function getDockSidePanelEntries(entries: ReadonlyArray<SidePanelSlotEntry>): Array<SidePanelSlotEntry> {
    return entries.filter((entry) => entry.payload.dockButton === true);
}

/** 其余的进创作助手侧栏页签（原有行为）。 */
export function getSidebarSidePanelEntries(entries: ReadonlyArray<SidePanelSlotEntry>): Array<SidePanelSlotEntry> {
    return entries.filter((entry) => entry.payload.dockButton !== true);
}
