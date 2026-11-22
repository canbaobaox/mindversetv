import { createElement } from "react";
import { describe, expect, test } from "bun:test";
// Use the explicit Node renderer so Bun cannot select the browser server
// build when another parallel test has installed partial DOM globals.
import { renderToStaticMarkup } from "react-dom/server.node";

import { CanvasDockPanel } from "@/components/canvas/canvas-dock-panel";
import { createDockPanelCommand } from "@/components/canvas/canvas-toolbar";

describe("画布 Dock 插件面板开关", () => {
    test("按钮 id 固定、点开切换对应面板", () => {
        const toggled: string[] = [];
        const command = createDockPanelCommand({ id: "prompt-board", title: "提示词板" }, false, (id) => {
            toggled.push(id);
        });

        expect(command.kind).toBe("command");
        expect(command.id).toBe("tool-dock-panel-prompt-board");
        expect(command.label).toBe("提示词板");
        expect(command.active).toBe(false);
        expect(command.expands).toBe(true);
        command.onClick?.();
        expect(toggled).toEqual(["prompt-board"]);
    });

    test("已打开的面板按钮处于激活态", () => {
        const command = createDockPanelCommand({ id: "prompt-board", title: "提示词板" }, true, () => {});
        expect(command.active).toBe(true);
    });

    test("面板渲染标题、关闭按钮与插件内容，并把画布上下文传给插件", () => {
        const Stub = ({ projectId, canvasId, selectedNodeIds }: { projectId?: string; canvasId?: string; selectedNodeIds: string[] }) =>
            createElement("div", null, `project=${projectId} canvas=${canvasId} selected=${selectedNodeIds.join(",")}`);
        const html = renderToStaticMarkup(
            createElement(CanvasDockPanel, {
                title: "提示词板",
                onClose: () => {},
                component: Stub,
                projectId: "project-1",
                canvasId: "project-1",
                selectedNodeIds: ["node-1", "node-2"],
            }),
        );

        expect(html).toContain("提示词板");
        expect(html).toContain('aria-label="关闭提示词板"');
        expect(html).toContain("project=project-1 canvas=project-1 selected=node-1,node-2");
    });
});
