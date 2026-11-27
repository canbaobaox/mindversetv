import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { App, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { Aperture, ChevronDown, ChevronRight, Clapperboard, Globe2, ImagePlus, LayoutGrid, Maximize2, Palette, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { canvasDockStyle } from "@/lib/canvas/canvas-aceternity-style";
import { canvasThemes } from "@/lib/canvas-theme";
import { resolveNodeToolbarPlacement, resolveToolbarTools, type NodeToolbarGroup, type ToolContext, type ToolbarHandlers } from "@/lib/canvas/tool-registry";
import { subscribeCanvasGraphicsViewportPreview } from "@/lib/canvas/canvas-live-viewport";
import { canQuickReferenceCanvasMediaNode } from "@/lib/canvas/canvas-node-semantics";
import type { ImageSplitParams } from "@/lib/canvas/canvas-image-data";
import { useCopyText } from "@/hooks/use-copy-text";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { CanvasNodeType, type CanvasNodeData, type CanvasVideoSubjectAction, type CanvasWorkspaceMode, type ViewportTransform } from "@/types/canvas";
import { buildImageToolbarTools } from "./canvas-image-toolbar-tools";
import { canConvertCanvasVideoDraft } from "@/lib/canvas/canvas-video-draft";
import type { ToolbarTool } from "./canvas-video-toolbar-tools";
import { CanvasGridSplitPicker } from "./canvas-grid-split-picker";
import { CanvasImageTemplatePanels, type ImageTemplatePanelId } from "./canvas-node-template-panels";
import { buildVideoCapsuleMenuItems, type CapsuleMenuItem } from "./canvas-node-capsule-menus";
import "./canvas-node-capsule.css";

type CanvasNodeToolbarProps = {
    node: CanvasNodeData | null;
    viewport: ViewportTransform;
    containerRef: RefObject<HTMLDivElement | null>;
    onKeep: (nodeId: string) => void;
    onLeave: () => void;
    onInfo: (node: CanvasNodeData) => void;
    onEditText: (node: CanvasNodeData) => void;
    onDecreaseFont: (node: CanvasNodeData) => void;
    onIncreaseFont: (node: CanvasNodeData) => void;
    onToggleDialog: (node: CanvasNodeData) => void;
    onAnnotate: (node: CanvasNodeData) => void;
    onGenerateImage: (node: CanvasNodeData) => void;
    onUpload: (node: CanvasNodeData) => void;
    onDownload: (node: CanvasNodeData) => void;
    onSaveAsset: (node: CanvasNodeData) => void;
    onMaskEdit: (node: CanvasNodeData) => void;
    onEmotion: (node: CanvasNodeData) => void;
    onPortraitTexture: (node: CanvasNodeData) => void;
    onCrop: (node: CanvasNodeData) => void;
    onSplit: (node: CanvasNodeData, params: ImageSplitParams) => void;
    onLayerSplit?: (node: CanvasNodeData) => void;
    onUpscale: (node: CanvasNodeData) => void;
    onHighDefinitionVideo?: (node: CanvasNodeData) => void;
    onVideoEditOperation?: (node: CanvasNodeData, operation: "extend" | "inpaint", subjectAction?: CanvasVideoSubjectAction) => void;
    onVideoRetake?: (node: CanvasNodeData) => void;
    onAngle: (node: CanvasNodeData) => void;
    onLighting: (node: CanvasNodeData) => void;
    onPanorama: (node: CanvasNodeData) => void;
    onPanoramaConfig: (node: CanvasNodeData) => void;
    // 二期模板：图片模板（生成图片 / 镜头效果 / 宫格生成）、视频模板、妆容弹窗。
    onImageTemplate?: (node: CanvasNodeData, kind: "viewpoint" | "lens" | "grid", presetId: string) => void;
    onVideoTemplate?: (node: CanvasNodeData, presetId: string, secondFrameNode?: CanvasNodeData) => void;
    onMakeup?: (node: CanvasNodeData) => void;
    imageNodes?: CanvasNodeData[];
    onClose: () => void;
    onViewImage: (node: CanvasNodeData) => void;
    onExtractVideoFrames: (node: CanvasNodeData, preset?: "current" | "first" | "last" | "firstLast") => void;
    onExtractAudioFromVideo: (node: CanvasNodeData) => void;
    onTrimVideoSegments: (node: CanvasNodeData) => void;
    onDepthCapture: (node: CanvasNodeData) => void;
    onSubtitleErase: (node: CanvasNodeData, eraseType?: "subtitle" | "watermark" | "privacy") => void;
    onSubtitles: (node: CanvasNodeData) => void;
    onTimeline: (node: CanvasNodeData) => void;
    extractingVideoFrames: boolean;
    extractingAudio: boolean;
    trimmingVideo: boolean;
    onReversePrompt: (node: CanvasNodeData) => void;
    onRetry: (node: CanvasNodeData) => void;
    onToggleFreeResize: (node: CanvasNodeData) => void;
    onToggleLocked: (node: CanvasNodeData) => void;
    onDelete: (node: CanvasNodeData) => void;
    onQuickReference?: (node: CanvasNodeData) => void;
    workspaceMode?: CanvasWorkspaceMode;
};

type CapsuleEntry = {
    id: string;
    label: string;
    kind: "button" | "split" | "frames" | "panel" | "makeup" | "menu";
    tool: ToolbarTool | undefined;
    menuItems?: CapsuleMenuItem[];
};

type CapsuleEntryDraft = {
    id: string;
    label: string;
    kind: CapsuleEntry["kind"];
    tool: ToolbarTool | undefined;
    menuItems?: CapsuleMenuItem[];
};

type CapsuleMenuGroup = {
    key: string;
    title: string;
    items: CapsuleMenuItem[];
};

export function CanvasNodeToolbar({
    node,
    viewport,
    containerRef,
    onKeep,
    onLeave,
    onInfo,
    onEditText,
    onDecreaseFont,
    onIncreaseFont,
    onToggleDialog,
    onAnnotate,
    onGenerateImage,
    onUpload,
    onDownload,
    onSaveAsset,
    onMaskEdit,
    onEmotion,
    onPortraitTexture,
    onCrop,
    onSplit,
    onLayerSplit,
    onUpscale,
    onHighDefinitionVideo,
    onVideoEditOperation,
    onVideoRetake,
    onAngle,
    onLighting,
    onPanorama,
    onPanoramaConfig,
    onImageTemplate,
    onVideoTemplate,
    onMakeup,
    imageNodes = [],
    onClose,
    onViewImage,
    onExtractVideoFrames,
    onExtractAudioFromVideo,
    onTrimVideoSegments,
    onDepthCapture,
    onSubtitleErase,
    onSubtitles,
    onTimeline,
    extractingVideoFrames,
    extractingAudio,
    trimmingVideo,
    onReversePrompt,
    onRetry,
    onToggleFreeResize,
    onToggleLocked,
    onDelete,
    onQuickReference,
    workspaceMode = "professional",
}: CanvasNodeToolbarProps) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [splitOpen, setSplitOpen] = useState(false);
    const [templatePanel, setTemplatePanel] = useState<ImageTemplatePanelId | null>(null);
    const [containerWidth, setContainerWidth] = useState(1000);
    const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const { message } = App.useApp();
    const copyText = useCopyText();
    const themeName = useActiveTheme();
    const theme = canvasThemes[themeName];
    const simpleMode = workspaceMode === "simple";

    useEffect(() => {
        setOpenMenuId(null);
        setSplitOpen(false);
        setTemplatePanel(null);
    }, [node?.id]);

    // 胶囊只由点条外、× 或 Esc 收起；悬停离开、点开下拉菜单都不收。
    useEffect(() => {
        if (!node || (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video)) return;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target || typeof target.closest !== "function") return;
            if (toolbarRef.current?.contains(target)) return;
            if (target.closest(".canvas-node-plus-trigger, [data-canvas-no-zoom], .ant-dropdown, .ant-modal-root, .ant-popover")) return;
            onClose();
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        return () => document.removeEventListener("pointerdown", handlePointerDown, true);
    }, [node, onClose]);

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
        let toolbarWidth = toolbarRef.current?.offsetWidth || 0;
        let toolbarHeight = toolbarRef.current?.offsetHeight || 40;
        const update = () => {
            const nodeRect = element.getBoundingClientRect();
            const preferredLeft = nodeRect.left - containerRect.left + nodeRect.width / 2;
            const halfToolbar = toolbarWidth / 2;
            const canClamp = toolbarWidth > 0 && toolbarWidth <= containerRect.width - 20;
            let left = canClamp ? Math.min(Math.max(preferredLeft, halfToolbar + 10), containerRect.width - halfToolbar - 10) : preferredLeft;
            const above = nodeRect.top - containerRect.top - 30;
            let top = Math.max(toolbarHeight + 8, Math.min(above, containerRect.height - 8));
            // Node-specific panels live inside the canvas container, while the
            // docked Agent is a sibling overlay. Treat both as occluders so a
            // toolbar never becomes half-unusable beneath the Agent surface.
            const occludingPanels = [...Array.from(container.querySelectorAll<HTMLElement>("[data-canvas-node-panel]")), ...Array.from(document.querySelectorAll<HTMLElement>(".canvas-agent-panel"))];
            for (const panel of occludingPanels) {
                const panelRect = panel.getBoundingClientRect();
                const panelLeft = panelRect.left - containerRect.left;
                const panelRight = panelRect.right - containerRect.left;
                const panelTop = panelRect.top - containerRect.top;
                const panelBottom = panelRect.bottom - containerRect.top;
                if (left + halfToolbar <= panelLeft || left - halfToolbar >= panelRight || top <= panelTop || top - toolbarHeight >= panelBottom) continue;
                if (panelLeft >= toolbarWidth + 18) left = panelLeft - halfToolbar - 8;
                else if (containerRect.width - panelRight >= toolbarWidth + 18) left = panelRight + halfToolbar + 8;
                else if (panelTop >= toolbarHeight + 16) top = panelTop - 8;
                else if (containerRect.height - panelBottom >= toolbarHeight + 16) top = panelBottom + toolbarHeight + 8;
            }
            if (toolbarRef.current) {
                toolbarRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                return;
            }
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
            toolbarWidth = toolbarRef.current?.offsetWidth || 0;
            toolbarHeight = toolbarRef.current?.offsetHeight || 40;
            setContainerWidth(containerRect.width);
            scheduleUpdate();
        };
        measure();
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(element);
        resizeObserver.observe(container);
        if (toolbarRef.current) resizeObserver.observe(toolbarRef.current);
        const unsubscribeViewport = subscribeCanvasGraphicsViewportPreview(container, scheduleUpdate);
        window.addEventListener("resize", measure);
        return () => {
            disposed = true;
            resizeObserver.disconnect();
            unsubscribeViewport();
            window.removeEventListener("resize", measure);
        };
    }, [anchor === null, containerRef, node, viewport.k, viewport.x, viewport.y]);

    if (!node || !anchor || node.type === CanvasNodeType.Director || node.type === CanvasNodeType.Upscale || node.metadata?.directorSceneId) return null;

    const isImage = node.type === CanvasNodeType.Image;
    const isVideo = node.type === CanvasNodeType.Video;
    const isAudio = node.type === CanvasNodeType.Audio;
    const hasImage = isImage && Boolean(node.metadata?.content);
    const hasStorageOnlyImage = isImage && !hasImage && Boolean(node.metadata?.storageKey);
    const canDraftToFinal = canConvertCanvasVideoDraft(node);
    const copyImagePrompt = (target: CanvasNodeData) => {
        const prompt = target.metadata?.prompt?.trim();
        if (!prompt) {
            message.warning("暂无可复制的提示词");
            return;
        }
        copyText(prompt, "提示词已复制");
    };
    const imageTools = buildImageToolbarTools(node, {
        onUpload,
        onToggleFreeResize,
        onAnnotate,
        onMaskEdit,
        onEmotion,
        onPortraitTexture,
        onCrop,
        onLayerSplit,
        onUpscale,
        // AI 超分随旧工具栏一起下线：图片工具定义里本就没有超分入口，
        // 这里只为满足 ImageToolHandlers 的类型占位，不再接任何按钮。
        onSuperResolve: () => undefined,
        onAngle,
        onLighting,
        onPanorama,
        onViewImage,
        onCopyPrompt: copyImagePrompt,
        onReversePrompt,
    });

    // 构建 ToolContext——供注册表解析工具
    const nodeHoverHandlers = {
        onNodeInfo: onInfo,
        onNodeDelete: onDelete,
        onNodeRetry: onRetry,
        onNodeEditText: onEditText,
        onNodeDecreaseFont: onDecreaseFont,
        onNodeIncreaseFont: onIncreaseFont,
        onNodeToggleDialog: onToggleDialog,
        onNodeAnnotate: onAnnotate,
        onNodeGenerateImage: onGenerateImage,
        onNodeUpload: onUpload,
        onNodeDownload: onDownload,
        onNodeSaveAsset: onSaveAsset,
        onNodeMaskEdit: onMaskEdit,
        onNodeEmotion: onEmotion,
        onNodePortraitTexture: onPortraitTexture,
        onNodeCrop: onCrop,
        onNodeSplit: (target) => onSplit(target, { rows: 2, columns: 2 }),
        onNodeUpscale: onUpscale,
        // AI 超分随旧工具栏一起下线：注册表里没有跑这条的工具，占位即可。
        onNodeSuperResolve: () => undefined,
        onNodeAngle: onAngle,
        onNodeViewImage: onViewImage,
        onNodeExtractVideoFrames: onExtractVideoFrames,
        onNodeExtractAudioFromVideo: onExtractAudioFromVideo,
        onNodeTrimVideoSegments: onTrimVideoSegments,
        onNodeCropVideo: onCrop,
        onNodeDepthCapture: onDepthCapture,
        onNodeSubtitleErase: onSubtitleErase,
        onNodeReversePrompt: onReversePrompt,
        onNodeToggleFreeResize: onToggleFreeResize,
        onNodeSubtitles: onSubtitles,
        onNodeTimeline: onTimeline,
        onNodeToggleLocked: onToggleLocked,
        onNodeCopyPrompt: copyImagePrompt,
    } as Partial<ToolbarHandlers> as ToolbarHandlers;

    const nodeHoverCtx: ToolContext = {
        selectedCount: 0,
        selectedNodeTypes: new Set(),
        selectedVideoCount: 0,
        canvasTool: "move",
        workspaceMode: workspaceMode || "professional",
        isProjectLinked: false,
        canUndo: false,
        canRedo: false,
        node,
        nodeMetadata: node.metadata,
        extractingVideoFrames,
        extractingAudio,
        trimmingVideo,
        mergingVideos: false,
        addPanelOpen: false,
        appearancePanelOpen: false,
        settingsPanelOpen: false,
        handlers: nodeHoverHandlers,
    };

    // 注册表统一提供动作合同、适用性和节点 Dock 层级。
    const registryTools = resolveToolbarTools("node-hover", nodeHoverCtx, null);
    const registryToolbarTools: ToolbarTool[] = registryTools.map((tool) => {
        const placement = resolveNodeToolbarPlacement(tool, nodeHoverCtx);
        return {
            id: tool.id,
            label: tool.displayLabel ? (typeof tool.displayLabel === "function" ? tool.displayLabel(nodeHoverCtx) : tool.displayLabel) : typeof tool.label === "function" ? tool.label(nodeHoverCtx) : tool.label,
            icon: typeof tool.icon === "function" ? tool.icon(nodeHoverCtx) : tool.icon,
            group: placement.group,
            order: placement.order,
            section: tool.nodeToolbar?.section,
            description: tool.nodeToolbar?.description,
            active: tool.active?.(nodeHoverCtx),
            danger: tool.danger,
            disabled: tool.disabled?.(nodeHoverCtx),
            onClick: () => tool.run(nodeHoverCtx),
        };
    });
    const storageOnlyImageTools = hasStorageOnlyImage ? imageTools.filter((tool) => tool.id === "angle" || tool.id === "layerSplit") : [];
    const activeImageTools = hasImage ? imageTools : storageOnlyImageTools;
    const allTools: ToolbarTool[] = activeImageTools.length && !simpleMode ? [...registryToolbarTools, ...activeImageTools] : registryToolbarTools;
    const compact = containerWidth < 640;
    const narrow = containerWidth < 420;
    const inGroup = (group: NodeToolbarGroup) => allTools.filter((tool) => tool.group === group).sort(compareToolbarTools);
    const primary = inGroup("primary");
    const primaryTools = narrow ? primary.slice(0, 1) : primary;
    const processTools = inGroup("process");
    const allWorkspaceTools = inGroup("workspace");
    const workspaceTools = narrow ? [] : allWorkspaceTools;
    const utilityTools = inGroup("utility");
    const processMenuLabel = compact ? "工具" : isAudio ? "音频处理" : "文本调整";

    // 三期下拉菜单（“高清”与“主体”）见 canvas-node-capsule-menus.tsx。
    const { hdMenuItems, subjectMenuItems } = buildVideoCapsuleMenuItems({
        node,
        canDraftToFinal,
        onHighDefinitionVideo,
        onVideoEditOperation,
        onClose,
    });

    // ---- 一期换皮：胶囊浮条模型（图片/视频）----
    // 按钮只取已解析好的工具定义，接线与旧 dock 完全一致，不重做弹窗。
    // AI 超分（画质提升）随旧工具栏一起下线：云端超分服务未开启，节点保持置灰，
    // 这里直接不渲染；超分处理节点本身（Upscale 节点类型）不受影响。
    const findCapsuleTool = (id: string) => allTools.find((tool) => tool.id === id);
    const templatePanelIdForEntry = (id: string): ImageTemplatePanelId | null =>
        id === "viewpoint" ? "viewpoint" : id === "video-template" ? "video" : id === "lens" ? "lens" : id === "grid-generate" ? "grid" : null;
    const templatePanelIcon = (panel: ImageTemplatePanelId) =>
        panel === "viewpoint" ? <ImagePlus className="size-3.5" /> : panel === "video" ? <Clapperboard className="size-3.5" /> : panel === "lens" ? <Aperture className="size-3.5" /> : <LayoutGrid className="size-3.5" />;
    const runCapsuleTool = (tool: ToolbarTool | undefined) => {
        if (!tool || tool.disabled) return;
        tool.onClick();
        onClose();
    };
    const toCapsuleMenuItem = (tool: ToolbarTool, label?: string): CapsuleMenuItem => ({
        key: tool.id,
        label: label ?? tool.label,
        icon: tool.icon,
        disabled: tool.disabled,
        danger: tool.danger,
        onClick: () => runCapsuleTool(tool),
    });
    const toCapsuleMenuItems = (ids: string[]) => ids.flatMap((id) => {
        const tool = findCapsuleTool(id);
        return tool ? [toCapsuleMenuItem(tool)] : [];
    });
    const frameMenuItems: CapsuleMenuItem[] = ([
        ["current", "截取当前帧"],
        ["first", "截取首帧"],
        ["last", "截取尾帧"],
        ["firstLast", "首尾帧一次出两张"],
    ] as const).map(([preset, label]) => ({
        key: `keyframe-${preset}`,
        label,
        disabled: extractingVideoFrames,
        onClick: () => onExtractVideoFrames(node, preset),
    }));

    // 图片胶囊（二期）：10 个，按 S2 图片条顺序——生成图片 / 生成视频 / 镜头效果 / 宫格生成 /
    // 拆分图片 / 多角度编辑 / 打光效果 / 表情调节 / 妆容调节 / 生成 720° 全景图。
    // 前四个是模板下拉面板（点选即执行）；妆容调节开居中大弹窗；其余沿用一期接线。
    const imageCapsuleDrafts: CapsuleEntryDraft[] = isImage
        ? [
            { id: "viewpoint", label: "生成图片", kind: "panel", tool: undefined },
            { id: "video-template", label: "生成视频", kind: "panel", tool: undefined },
            { id: "lens", label: "镜头效果", kind: "panel", tool: undefined },
            { id: "grid-generate", label: "宫格生成", kind: "panel", tool: undefined },
            { id: "split", label: "拆分图片", kind: "split", tool: findCapsuleTool("split") },
            { id: "angle", label: "多角度编辑", kind: "button", tool: findCapsuleTool("angle") },
            { id: "lighting", label: "打光效果", kind: "button", tool: findCapsuleTool("lighting") },
            { id: "emotion", label: "表情调节", kind: "button", tool: findCapsuleTool("emotion") },
            { id: "makeup", label: "妆容调节", kind: "makeup", tool: undefined },
            { id: "panorama", label: "生成 720° 全景图", kind: "button", tool: findCapsuleTool("panorama") },
        ]
        : [];
    const imageCapsuleEntries: CapsuleEntry[] = imageCapsuleDrafts.filter((entry): entry is CapsuleEntry => Boolean(entry.tool) || entry.kind === "panel" || entry.kind === "makeup");
    // 视频胶囊（三期）：截取 / 高清 / 智能去字幕 / 主体 / 音视频分离 / 深度捕捉，按 S2 视频条顺序。
    const videoCapsuleDrafts: CapsuleEntryDraft[] = isVideo
        ? [
            { id: "frames", label: "截取", kind: "frames", tool: findCapsuleTool("extractFrames") },
            ...(onHighDefinitionVideo ? [{ id: "hd", label: "高清", kind: "menu" as const, tool: undefined, menuItems: hdMenuItems }] : []),
            { id: "subtitleErase", label: "智能去字幕", kind: "button", tool: findCapsuleTool("subtitleErase") },
            ...(onVideoEditOperation ? [{ id: "subject", label: "主体", kind: "menu" as const, tool: undefined, menuItems: subjectMenuItems }] : []),
            { id: "extractAudio", label: "音视频分离", kind: "button", tool: findCapsuleTool("extractAudio") },
            { id: "depthCapture", label: "深度捕捉", kind: "button", tool: findCapsuleTool("depthCapture") },
        ]
        : [];
    const videoCapsuleEntries: CapsuleEntry[] = videoCapsuleDrafts.filter((entry): entry is CapsuleEntry => Boolean(entry.tool) || entry.kind === "menu");
    const capsuleEntries = isImage ? imageCapsuleEntries : videoCapsuleEntries;
    // 窄屏与 simple 模式：放不下的按钮收进“更多”，simple 模式只留“更多”。
    const capsuleVisibleCount = simpleMode ? 0 : narrow ? 1 : compact ? 3 : capsuleEntries.length;
    const capsuleVisibleEntries = capsuleEntries.slice(0, capsuleVisibleCount);
    const capsuleOverflowEntries = capsuleEntries.slice(capsuleVisibleCount);
    const overflowMenuItems: CapsuleMenuItem[] = capsuleOverflowEntries.flatMap((entry): CapsuleMenuItem[] => {
        if (entry.kind === "split") {
            return [{ key: "split", label: entry.label, icon: entry.tool?.icon, disabled: entry.tool?.disabled, onClick: () => setSplitOpen(true) }];
        }
        if (entry.kind === "frames") return frameMenuItems;
        if (entry.kind === "menu") return entry.menuItems ?? [];
        if (entry.kind === "panel") {
            const panel = templatePanelIdForEntry(entry.id);
            return panel ? [{ key: entry.id, label: entry.label, icon: templatePanelIcon(panel), onClick: () => setTemplatePanel(panel) }] : [];
        }
        if (entry.kind === "makeup") {
            return [{ key: "makeup", label: entry.label, icon: <Palette className="size-3.5" />, onClick: () => { onMakeup?.(node); onClose(); } }];
        }
        if (!entry.tool) return [];
        return [toCapsuleMenuItem(entry.tool, entry.label)];
    });

    // “更多”：被换掉的不删，全收进来；节点管理类跟旧分组走，不丢功能。
    const imageMoreGroups: CapsuleMenuGroup[] = isImage ? [
        {
            key: "image-tools",
            title: "图片工具",
            items: [
                ...overflowMenuItems,
                ...toCapsuleMenuItems(["maskEdit", "portraitTexture", "annotation", "crop", "upscale", "layerSplit", "copyPrompt", "reversePrompt"]),
                { key: "panorama-config", label: "全景更多设置", icon: <Globe2 className="size-3.5" />, onClick: () => { onPanoramaConfig(node); onClose(); } },
            ],
        },
        {
            key: "node-manage",
            title: "节点管理",
            items: toCapsuleMenuItems(["replace", "resize", "info", "node-lock", "view", "generationInfo", "download", "saveAsset", "delete", "retry"]),
        },
    ] : [];
    const videoMoreGroups: CapsuleMenuGroup[] = isVideo ? [
        {
            key: "video-process",
            title: "视频处理",
            items: [
                ...overflowMenuItems,
                ...(onVideoEditOperation ? [
                    { key: "video-extend", label: "视频续写", onClick: () => { onVideoEditOperation(node, "extend"); onClose(); } },
                    // 视频局部修改已并进浮条“主体”（消除/修改/替换），不再单独留。
                ] as CapsuleMenuItem[] : []),
                ...(onVideoRetake ? [{ key: "video-retake", label: "片段重拍", onClick: () => { onVideoRetake(node); onClose(); } } as CapsuleMenuItem] : []),
                { key: "video-reverse-prompt", label: "反推提示词", onClick: () => { onReversePrompt(node); onClose(); } },
                ...toCapsuleMenuItems(["trimRegenerate", "cropVideo", "watermarkErase"]),
            ],
        },
        {
            key: "video-post",
            title: "视频后期",
            // 转高清成片已并进浮条“高清”（1080P），不再单独留。
            items: toCapsuleMenuItems(["subtitles", "timeline"]),
        },
        {
            key: "node-manage",
            title: "节点管理",
            items: [
                ...toCapsuleMenuItems(["uploadVideo", "video-aspect-ratio", "info", "node-lock"]),
                { key: "video-preview", label: "预览", icon: <Maximize2 className="size-3.5" />, disabled: !Boolean(node.metadata?.content || node.metadata?.storageKey), onClick: () => { onViewImage(node); onClose(); } },
                ...toCapsuleMenuItems(["generationInfo", "download", "saveAsset", "delete", "retry"]),
            ],
        },
    ] : [];
    const moreGroups = isImage ? imageMoreGroups : videoMoreGroups;
    const handleMenuOpenChange = (menuId: string, open: boolean) => {
        setOpenMenuId((current) => (open ? menuId : current === menuId ? null : current));
        if (open) onKeep(node.id);
        else if (!toolbarRef.current?.contains(document.activeElement)) onLeave();
    };
    const dockStyle = canvasDockStyle(theme, theme.node.text);

    return (
        <div
            ref={toolbarRef}
            className="canvas-node-toolbar absolute z-[var(--z-node-toolbar)] -translate-x-1/2 -translate-y-full"
            style={{ left: 0, top: 0, transform: `translate3d(${anchor.left}px, ${anchor.top}px, 0)`, width: "max-content", maxWidth: "calc(100% - 20px)", color: theme.node.text }}
            onMouseEnter={() => onKeep(node.id)}
            onMouseLeave={() => {
                if (!isImage && !isVideo && !openMenuId) onLeave();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            data-canvas-no-zoom
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") onClose();
            }}
            onFocus={() => onKeep(node.id)}
            onBlur={(event) => {
                if (isImage || isVideo || event.currentTarget.contains(event.relatedTarget as Node | null) || openMenuId) return;
                onLeave();
            }}
        >
            {isImage || isVideo ? (
                <>
                    <div role="toolbar" aria-label="节点快捷工具" className="canvas-node-capsule">
                        {capsuleVisibleEntries.map((entry) =>
                            entry.kind === "frames" || entry.kind === "menu" ? (
                                <CapsuleMenuButton
                                    key={entry.id}
                                    label={entry.label}
                                    icon={entry.tool?.icon}
                                    disabled={entry.kind === "frames" ? entry.tool?.disabled || extractingVideoFrames : false}
                                    menuItems={entry.kind === "frames" ? frameMenuItems : entry.menuItems ?? []}
                                    onOpen={() => onKeep(node.id)}
                                />
                            ) : entry.kind === "panel" ? (
                                <CapsuleToolButton
                                    key={entry.id}
                                    label={entry.label}
                                    icon={templatePanelIcon(templatePanelIdForEntry(entry.id) || "viewpoint")}
                                    pressed={templatePanel === templatePanelIdForEntry(entry.id)}
                                    onClick={() => {
                                        setSplitOpen(false);
                                        const panel = templatePanelIdForEntry(entry.id);
                                        setTemplatePanel((current) => (current === panel ? null : panel));
                                    }}
                                />
                            ) : entry.kind === "makeup" ? (
                                <CapsuleToolButton
                                    key={entry.id}
                                    label={entry.label}
                                    icon={<Palette className="size-3.5" />}
                                    onClick={() => {
                                        onMakeup?.(node);
                                        onClose();
                                    }}
                                />
                            ) : (
                                <CapsuleToolButton
                                    key={entry.id}
                                    label={entry.label}
                                    icon={entry.tool?.icon}
                                    disabled={entry.tool?.disabled}
                                    active={entry.tool?.active}
                                    pressed={entry.kind === "split" && splitOpen}
                                    onClick={entry.kind === "split" ? () => { setTemplatePanel(null); setSplitOpen((current) => !current); } : () => runCapsuleTool(entry.tool)}
                                />
                            ),
                        )}
                        <span aria-hidden className="canvas-node-capsule-separator" />
                        <CapsuleMenuButton label="更多" menuGroups={moreGroups} onOpen={() => onKeep(node.id)} />
                        <button type="button" className="canvas-node-capsule-close" aria-label="收起工具栏" onClick={onClose}>
                            <X className="size-3.5" />
                        </button>
                    </div>
                    {splitOpen && isImage ? (
                        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2" data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                            <CanvasGridSplitPicker
                                onPick={(params) => {
                                    setSplitOpen(false);
                                    onSplit(node, params);
                                    onClose();
                                }}
                            />
                        </div>
                    ) : null}
                    {templatePanel && isImage ? (
                        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2" data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                            <CanvasImageTemplatePanels
                                panel={templatePanel}
                                node={node}
                                imageNodes={imageNodes}
                                onPickViewpoint={(presetId) => {
                                    setTemplatePanel(null);
                                    onImageTemplate?.(node, "viewpoint", presetId);
                                    onClose();
                                }}
                                onPickVideo={(presetId, secondFrameNode) => {
                                    setTemplatePanel(null);
                                    onVideoTemplate?.(node, presetId, secondFrameNode);
                                    onClose();
                                }}
                                onPickLens={(presetId) => {
                                    setTemplatePanel(null);
                                    onImageTemplate?.(node, "lens", presetId);
                                    onClose();
                                }}
                                onPickGrid={(presetId) => {
                                    setTemplatePanel(null);
                                    onImageTemplate?.(node, "grid", presetId);
                                    onClose();
                                }}
                            />
                        </div>
                    ) : null}
                </>
            ) : (
                <div role="toolbar" aria-label="节点快捷工具" className="flex h-10 max-w-full items-center gap-0.5 overflow-visible rounded-[var(--dock-radius-tight)] px-1.5 backdrop-blur-2xl" style={{ ...dockStyle, border: 0 }}>
                    {isAudio && onQuickReference && !simpleMode && canQuickReferenceCanvasMediaNode(node) ? (
                        <NodeDockToolButton tool={{ id: "quick-reference", label: "引用生成", icon: <Sparkles className="size-3.5" />, group: "primary", order: 0, onClick: () => onQuickReference(node) }} showTooltip={false} />
                    ) : null}
                    {primaryTools.map((tool) => (
                        <NodeDockToolButton key={tool.id} tool={tool} showTooltip />
                    ))}
                    {processTools.length ? (
                        <NodeDockMenuButton
                            menuId="process"
                            label={processMenuLabel}
                            icon={<SlidersHorizontal className="size-3.5" />}
                            tools={processTools}
                            openMenuId={openMenuId}
                            onOpenChange={handleMenuOpenChange}
                        />
                    ) : null}
                    {workspaceTools.length ? <span aria-hidden className="aceternity-dock-separator mx-1 h-5 w-px shrink-0" /> : null}
                    {workspaceTools.map((tool) => (
                        <NodeDockToolButton key={tool.id} tool={tool} />
                    ))}
                    {utilityTools.length ? <span aria-hidden className="aceternity-dock-separator mx-1 h-5 w-px shrink-0" /> : null}
                    {utilityTools.map((tool) => (
                        <NodeDockToolButton key={tool.id} tool={tool} iconOnly />
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeDockToolButton({ tool, iconOnly = false, showTooltip = true }: { tool: ToolbarTool; iconOnly?: boolean; showTooltip?: boolean }) {
    const button = (
        <button
            type="button"
            className={`aceternity-dock-command is-labeled pointer-events-auto inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[var(--dock-item-radius)] px-2.5 outline-none ${tool.active ? "is-active" : ""} ${tool.danger ? "is-danger" : ""}`}
            aria-label={tool.label}
            aria-pressed={tool.active}
            disabled={tool.disabled}
            onClick={tool.onClick}
        >
            <span className="grid size-3.5 shrink-0 place-items-center">{tool.icon}</span>
            {!iconOnly ? <span className="inline-flex h-4 items-center whitespace-nowrap text-[var(--fs-label)] font-medium leading-none">{tool.label}</span> : null}
        </button>
    );
    return showTooltip ? <Tooltip title={tool.description ? `${tool.label}：${tool.description}` : tool.label}>{button}</Tooltip> : button;
}

function compareToolbarTools(left: ToolbarTool, right: ToolbarTool) {
    if (left.danger !== right.danger) return left.danger ? 1 : -1;
    return left.order - right.order;
}

function NodeDockMenuButton({
    menuId,
    label,
    icon,
    tools,
    openMenuId,
    onOpenChange,
    placement = "bottom",
    iconOnly = false,
    split,
}: {
    menuId: string;
    label: string;
    icon?: ReactNode;
    tools: ToolbarTool[];
    openMenuId: string | null;
    onOpenChange: (menuId: string, open: boolean) => void;
    placement?: "top" | "topRight" | "bottom" | "bottomLeft" | "bottomRight";
    iconOnly?: boolean;
    split?: { node: CanvasNodeData; onSplit: (node: CanvasNodeData, params: ImageSplitParams) => void };
}) {
    const open = openMenuId === menuId;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [splitPanelOpen, setSplitPanelOpen] = useState(false);
    useEffect(() => {
        if (!open) {
            setSplitPanelOpen(false);
            return;
        }
        const frame = requestAnimationFrame(() => triggerRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open]);
    const keepSplitMenuOpenRef = useRef(false);
    const splitEntry = split ? tools.find((tool) => tool.id === "split") : undefined;
    const renderItem = (tool: ToolbarTool): NonNullable<MenuProps["items"]>[number] => {
        const isSplit = Boolean(splitEntry && split && tool.id === "split");
        return {
            key: tool.id,
            // 菜单只保留功能名称；图标和辅助说明留在工具定义中，供其他上下文使用。
            icon: undefined,
            className: isSplit ? `canvas-grid-split-menu-item${splitPanelOpen ? " is-open" : ""}` : undefined,
            label: (
                <div
                    className={isSplit ? "canvas-grid-split-menu-label" : undefined}
                    onMouseDown={
                        isSplit
                            ? () => {
                                  keepSplitMenuOpenRef.current = true;
                              }
                            : undefined
                    }
                >
                    <div>
                        <span className="inline-flex items-center gap-2">{tool.label}</span>
                    </div>
                    {isSplit ? <ChevronRight className="canvas-grid-split-chevron" strokeWidth={2} /> : null}
                </div>
            ),
            disabled: tool.disabled,
            danger: tool.danger,
            onClick: (info) => {
                if (isSplit) {
                    info.domEvent.preventDefault();
                    info.domEvent.stopPropagation();
                    keepSplitMenuOpenRef.current = true;
                    setSplitPanelOpen((current) => !current);
                    return;
                }
                onOpenChange(menuId, false);
                tool.onClick();
            },
        };
    };
    const items: MenuProps["items"] = tools.map(renderItem);
    return (
        <Dropdown
            open={open}
            trigger={["click"]}
            placement={placement}
            autoAdjustOverflow={false}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && (keepSplitMenuOpenRef.current || document.querySelector(".canvas-node-toolbar-menu-split:hover, .canvas-grid-split-picker:hover"))) {
                    keepSplitMenuOpenRef.current = false;
                    return;
                }
                onOpenChange(menuId, nextOpen);
                if (!nextOpen) setSplitPanelOpen(false);
            }}
            menu={{ items }}
            autoFocus
            popupRender={(menu) => (
                <div
                    className={`canvas-node-toolbar-menu${splitEntry && split ? " canvas-node-toolbar-menu-split" : ""}`}
                    data-canvas-no-zoom
                    data-canvas-wheel-scroll
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    onKeyDownCapture={(event) => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            triggerRef.current?.focus();
                            onOpenChange(menuId, false);
                        }
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <div className="canvas-node-toolbar-menu-stack">{menu}</div>
                    {splitPanelOpen && split ? (
                        <CanvasGridSplitPicker
                            onPick={(params) => {
                                setSplitPanelOpen(false);
                                onOpenChange(menuId, false);
                                split.onSplit(split.node, params);
                            }}
                        />
                    ) : null}
                </div>
            )}
        >
            <button
                ref={triggerRef}
                type="button"
                className={`aceternity-dock-command is-labeled pointer-events-auto inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[var(--dock-item-radius)] px-2.5 outline-none ${open ? "is-active" : ""}`}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="menu"
                title={label}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && open) {
                        event.preventDefault();
                        document.querySelector<HTMLElement>(".ant-dropdown:not(.ant-dropdown-hidden) .canvas-node-toolbar-menu [role='menuitem']:not([aria-disabled='true'])")?.focus();
                    }
                    if (event.key === "Escape" && open) {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenChange(menuId, false);
                    }
                }}
            >
                {icon ? <span className="grid size-3.5 shrink-0 place-items-center">{icon}</span> : null}
                {!iconOnly ? (
                    <>
                        <span className="inline-flex h-4 items-center whitespace-nowrap text-[var(--fs-label)] font-medium leading-none">{label}</span>
                        <ChevronDown className="size-3 shrink-0 opacity-55" />
                    </>
                ) : null}
            </button>
        </Dropdown>
    );
}

function CapsuleToolButton({ label, icon, disabled, active, pressed, onClick }: { label: string; icon: ReactNode; disabled?: boolean; active?: boolean; pressed?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            className={`canvas-node-capsule-button${active || pressed ? " is-active" : ""}`}
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            title={label}
        >
            <span className="canvas-node-capsule-icon">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function CapsuleMenuButton({
    label,
    icon,
    disabled,
    menuItems,
    menuGroups,
    onOpen,
}: {
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    menuItems?: CapsuleMenuItem[];
    menuGroups?: CapsuleMenuGroup[];
    onOpen?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const toAntdItems = (items: CapsuleMenuItem[]): MenuProps["items"] =>
        items.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            disabled: item.disabled,
            danger: item.danger,
            onClick: () => {
                setOpen(false);
                item.onClick();
            },
        }));
    const items: MenuProps["items"] = menuGroups
        ? menuGroups
            .filter((group) => group.items.length > 0)
            .map((group) => ({ key: group.key, label: group.title, type: "group" as const, children: toAntdItems(group.items) }))
        : toAntdItems(menuItems ?? []);
    return (
        <Dropdown
            open={open}
            trigger={["click"]}
            placement="bottom"
            autoAdjustOverflow={false}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) onOpen?.();
            }}
            menu={{ items }}
            autoFocus
            popupRender={(menu) => (
                <div
                    className="canvas-node-toolbar-menu"
                    data-canvas-no-zoom
                    data-canvas-wheel-scroll
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    {menu}
                </div>
            )}
        >
            <button
                type="button"
                className={`canvas-node-capsule-button${open ? " is-active" : ""}`}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="menu"
                disabled={disabled}
            >
                {icon ? <span className="canvas-node-capsule-icon">{icon}</span> : null}
                <span>{label}</span>
                <ChevronDown className="size-3 shrink-0 opacity-55" />
            </button>
        </Dropdown>
    );
}

export { CanvasNodeInfoModal } from "./canvas-node-info-modal";
