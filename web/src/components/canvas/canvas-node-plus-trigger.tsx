import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Plus } from "lucide-react";

import { subscribeCanvasGraphicsViewportPreview } from "@/lib/canvas/canvas-live-viewport";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";

import "./canvas-node-capsule.css";

type CanvasNodePlusTriggerProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    containerRef: RefObject<HTMLDivElement | null>;
    active: boolean;
    onOpen: (node: CanvasNodeData) => void;
    onClose: () => void;
};

/**
 * 图片/视频节点右边缘中点的青色“＋”触发点。
 * 悬停或点选节点时可见；点后打开节点正上方的胶囊浮条，并发光呈激活态。
 * 定位沿用节点工具栏同一套量法：读节点 DOM 位置，跟随视口变化重算。
 */
export function CanvasNodePlusTrigger({ node, viewport, containerRef, active, onOpen, onClose }: CanvasNodePlusTriggerProps) {
    const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!node || !container) {
            setAnchor(null);
            return;
        }
        const element = container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
        if (!element) {
            setAnchor(null);
            return;
        }
        let disposed = false;
        let queued = false;
        let containerRect = container.getBoundingClientRect();
        const update = () => {
            const nodeRect = element.getBoundingClientRect();
            // 圆心落在节点右边缘中点上。
            const left = Math.min(Math.max(nodeRect.right - containerRect.left, 10), containerRect.width - 10);
            const top = Math.min(Math.max(nodeRect.top - containerRect.top + nodeRect.height / 2, 10), containerRect.height - 10);
            setAnchor((current) => (current?.left === left && current.top === top ? current : { left, top }));
        };
        const scheduleUpdate = () => {
            if (queued || disposed) return;
            queued = true;
            queueMicrotask(() => {
                queued = false;
                if (!disposed) update();
            });
        };
        const measure = () => {
            containerRect = container.getBoundingClientRect();
            scheduleUpdate();
        };
        measure();
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(element);
        resizeObserver.observe(container);
        const unsubscribeViewport = subscribeCanvasGraphicsViewportPreview(container, scheduleUpdate);
        window.addEventListener("resize", measure);
        return () => {
            disposed = true;
            resizeObserver.disconnect();
            unsubscribeViewport();
            window.removeEventListener("resize", measure);
        };
    }, [anchor === null, containerRef, node, viewport.k, viewport.x, viewport.y]);

    if (!node || !anchor) return null;

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`canvas-node-plus-trigger${active ? " is-active" : ""}`}
            style={{ left: 0, top: 0, transform: `translate3d(${anchor.left}px, ${anchor.top}px, 0) translate(-50%, -50%)` }}
            aria-label={active ? "收起节点工具" : "打开节点工具"}
            aria-pressed={active}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                if (active) onClose();
                else onOpen(node);
            }}
            data-canvas-no-zoom
        >
            <Plus className="size-3" strokeWidth={3} />
        </button>
    );
}
