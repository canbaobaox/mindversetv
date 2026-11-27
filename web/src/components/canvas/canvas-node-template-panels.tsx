// 图片胶囊浮条下的四组模板下拉面板（二期）：生成图片 / 生成视频 / 镜头效果 / 宫格生成。
// 点选即执行（图片类走即时重绘；视频类建 idle 视频子节点并打开节点对话框，
// 由用户在对话框点“生成”走标准图生视频流程，与视频续写、故事板分镜同一条路）。
// 首尾帧补间需要两张图：没有第二张图时置灰并注明原因，选了第二张图后才可用。

import { useState } from "react";

import type { CanvasNodeData } from "@/types/canvas";
import { CANVAS_GRID_GENERATE_PRESETS } from "@/lib/canvas/canvas-grid-generate";
import { CANVAS_LENS_PRESETS } from "@/lib/canvas/canvas-lens";
import { CANVAS_VIDEO_EXTEND_PRESETS, CANVAS_VIDEO_MOVE_PRESETS } from "@/lib/canvas/canvas-video-motion";
import { CANVAS_VIEWPOINT_PRESETS } from "@/lib/canvas/canvas-viewpoint";
import { CanvasTemplatePicker } from "./canvas-template-picker";

export type ImageTemplatePanelId = "viewpoint" | "video" | "lens" | "grid";

export function CanvasImageTemplatePanels({
    panel,
    node,
    imageNodes,
    onPickViewpoint,
    onPickVideo,
    onPickLens,
    onPickGrid,
}: {
    panel: ImageTemplatePanelId | null;
    node: CanvasNodeData;
    imageNodes: CanvasNodeData[];
    onPickViewpoint: (presetId: string) => void;
    onPickVideo: (presetId: string, secondFrameNode?: CanvasNodeData) => void;
    onPickLens: (presetId: string) => void;
    onPickGrid: (presetId: string) => void;
}) {
    const [secondFrameNodeId, setSecondFrameNodeId] = useState<string | null>(null);
    if (!panel) return null;

    if (panel === "viewpoint") {
        return <CanvasTemplatePicker title="生成图片 · 选择视角" sections={[{ items: CANVAS_VIEWPOINT_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })) }]} onPick={onPickViewpoint} />;
    }
    if (panel === "lens") {
        return <CanvasTemplatePicker title="镜头效果 · 选择焦段 / 景深" sections={[{ items: CANVAS_LENS_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })) }]} onPick={onPickLens} />;
    }
    if (panel === "grid") {
        return <CanvasTemplatePicker title="宫格生成 · 选择版式" sections={[{ items: CANVAS_GRID_GENERATE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })) }]} onPick={onPickGrid} />;
    }

    // 生成视频：2 个推延 + 10 个运镜；首尾帧补间单独一节，需要第二张图。
    const otherImages = imageNodes.filter((candidate) => candidate.id !== node.id && Boolean(candidate.metadata?.content || candidate.metadata?.storageKey));
    const secondFrameNode = otherImages.find((candidate) => candidate.id === secondFrameNodeId) || null;
    const interpolateDisabled = !secondFrameNode;
    return (
        <CanvasTemplatePicker
            title="生成视频 · 5 秒"
            header={
                <div>
                    <div>第二张图（仅首尾帧补间用，作尾帧）</div>
                    {otherImages.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>画布上暂无其他图片节点</div>
                    ) : (
                        <div className="canvas-template-picker-frame-list">
                            {otherImages.map((candidate) => (
                                <button
                                    key={candidate.id}
                                    type="button"
                                    className={`canvas-template-picker-frame-option${secondFrameNode?.id === candidate.id ? " is-active" : ""}`}
                                    aria-pressed={secondFrameNode?.id === candidate.id}
                                    onClick={() => setSecondFrameNodeId((current) => (current === candidate.id ? null : candidate.id))}
                                >
                                    <span aria-hidden>{secondFrameNode?.id === candidate.id ? "●" : "○"}</span>
                                    <span className="canvas-template-picker-frame-option-label">{candidate.title || "图片"}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            }
            sections={[
                { title: "推延", items: CANVAS_VIDEO_EXTEND_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })) },
                {
                    title: "运镜",
                    items: CANVAS_VIDEO_MOVE_PRESETS.map((preset) =>
                        preset.id === "interpolate"
                            ? {
                                  id: preset.id,
                                  label: preset.label,
                                  disabled: interpolateDisabled,
                                  disabledReason: interpolateDisabled ? "需要两张图：先在上方选一张作尾帧" : undefined,
                              }
                            : { id: preset.id, label: preset.label },
                    ),
                },
            ]}
            onPick={(presetId) => onPickVideo(presetId, presetId === "interpolate" ? secondFrameNode || undefined : undefined)}
        />
    );
}
