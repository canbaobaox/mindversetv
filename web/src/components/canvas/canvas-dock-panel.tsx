import { useEffect } from "react";
import { X } from "lucide-react";

import type { PluginCanvasSidePanelProps } from "@/lib/plugins/plugin-types";

/**
 * 画布内浮动面板：插件侧栏（dockButton）的落点。
 * 挂在画布工作区右侧，Dock 开关按钮点开即现、再点即隐；Esc 或右上角关闭。
 * 内容区自己滚动，板子本身也自带滚动（长内容不会顶出面板）。
 */
export function CanvasDockPanel({
    title,
    onClose,
    component: PanelComponent,
    projectId,
    canvasId,
    selectedNodeIds,
}: {
    title: string;
    onClose: () => void;
    component: React.ComponentType<PluginCanvasSidePanelProps>;
    projectId?: string;
    canvasId?: string;
    selectedNodeIds: string[];
}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener("keydown", closeOnEscape, true);
        return () => window.removeEventListener("keydown", closeOnEscape, true);
    }, [onClose]);

    return (
        <section
            role="dialog"
            aria-label={title}
            data-canvas-no-zoom
            className="pointer-events-auto absolute bottom-24 right-4 top-4 z-30 flex w-[440px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[18px] border bg-surface text-foreground shadow-xl"
        >
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                <h2 className="text-sm font-semibold">{title}</h2>
                <button
                    type="button"
                    aria-label={`关闭${title}`}
                    onClick={onClose}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <PanelComponent projectId={projectId} canvasId={canvasId} selectedNodeIds={selectedNodeIds} />
            </div>
        </section>
    );
}
