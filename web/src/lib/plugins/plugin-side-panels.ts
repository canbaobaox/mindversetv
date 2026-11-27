import type { PluginSlotMap } from "@/lib/plugins/plugin-types";

/** 画布侧栏贡献的去处只由 dockButton / topBarButton 决定，判断集中在这里，别处不要各写一份。 */
export type SidePanelSlotEntry = {
    entryId: string;
    pluginId: string;
    payload: PluginSlotMap["canvas.sidePanel"];
};

/** dockButton 为 true 的进画布底部 Dock：一个开关按钮 + 画布内浮动面板。 */
export function getDockSidePanelEntries(entries: ReadonlyArray<SidePanelSlotEntry>): Array<SidePanelSlotEntry> {
    return entries.filter((entry) => entry.payload.dockButton === true);
}

/** dockButton 且 topBarButton 都为 true 的，再进画布顶部胶囊栏：与底部 Dock 开关共用同一块浮动面板。 */
export function getTopBarSidePanelEntries(entries: ReadonlyArray<SidePanelSlotEntry>): Array<SidePanelSlotEntry> {
    return entries.filter((entry) => entry.payload.dockButton === true && entry.payload.topBarButton === true);
}

/** 其余的进创作助手侧栏页签（原有行为）。 */
export function getSidebarSidePanelEntries(entries: ReadonlyArray<SidePanelSlotEntry>): Array<SidePanelSlotEntry> {
    return entries.filter((entry) => entry.payload.dockButton !== true);
}

/**
 * 画布 Dock 浮动面板的开关状态：顶栏入口、底部 Dock 开关、面板自身的收起/关闭、
 * Esc 关闭，共用同一份——面板开关状态只在这里算，别处不要各写一份翻转逻辑。
 * activeId 为 null 表示面板关闭；collapsed 为 true 表示面板还开着，只是收起成标题栏。
 */
export type DockPanelOpenState = {
    activeId: string | null;
    collapsed: boolean;
};

export const initialDockPanelState: DockPanelOpenState = { activeId: null, collapsed: false };

export type DockPanelAction =
    | { type: "toggle-entry"; id: string }
    | { type: "toggle-minimize" }
    | { type: "close" };

export function nextDockPanelState(current: DockPanelOpenState, action: DockPanelAction): DockPanelOpenState {
    switch (action.type) {
        case "toggle-entry":
            if (current.activeId === action.id) {
                // 同一个入口再点一次：收起态下是展开（不是关闭），展开态下才是关闭。
                // 否则收起后点顶栏/Dock 会把面板直接关掉，看起来就像点了没反应。
                return current.collapsed ? { activeId: action.id, collapsed: false } : { activeId: null, collapsed: false };
            }
            return { activeId: action.id, collapsed: false };
        case "toggle-minimize":
            if (!current.activeId) return current;
            return { ...current, collapsed: !current.collapsed };
        case "close":
            return { activeId: null, collapsed: false };
    }
}
