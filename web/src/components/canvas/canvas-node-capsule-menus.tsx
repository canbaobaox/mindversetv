import type { ReactNode } from "react";

import type { CanvasNodeData, CanvasVideoSubjectAction } from "@/types/canvas";

export type CapsuleMenuItem = {
    key: string;
    label: ReactNode;
    icon?: ReactNode;
    disabled?: boolean;
    danger?: boolean;
    onClick: () => void;
};

// 下拉选项的主文案＋小字说明（费用/适用条件/未上线原因写在小字里，不只靠悬停提示）。
export function menuItemLabelWithNote(label: string, note: string) {
    return (
        <span>
            <span>{label}</span>
            <span style={{ display: "block", fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>{note}</span>
        </span>
    );
}

// 视频浮条三期下拉菜单（“高清”与“主体”）的构造：从 canvas-node-toolbar.tsx 拆出，
// 避免该文件超过 1000 行结构门禁。
export function buildVideoCapsuleMenuItems(input: {
    node: CanvasNodeData;
    canDraftToFinal: boolean;
    onHighDefinitionVideo?: (node: CanvasNodeData) => void;
    onVideoEditOperation?: (node: CanvasNodeData, operation: "extend" | "inpaint", subjectAction?: CanvasVideoSubjectAction) => void;
    onClose: () => void;
}): { hdMenuItems: CapsuleMenuItem[]; subjectMenuItems: CapsuleMenuItem[] } {
    const { node, canDraftToFinal, onHighDefinitionVideo, onVideoEditOperation, onClose } = input;

    // ---- “高清”1080P（只有 1 个选项）----
    // 适用条件直接写在选项小字里：草稿视频走样片转高清成片；非草稿视频走原提示词
    // 重新生成（会再次扣费，结果可能与原片有出入）；缺原提示词、空视频、样片生成中、
    // 样片缺上游任务 ID 时选项置灰并写明原因，不做成点了没反应的样子。
    const hdUnavailableNote = !node.metadata?.content && !node.metadata?.storageKey
        ? "视频节点为空，无法生成 1080P"
        : node.metadata?.draft === "true" && node.metadata?.status === "loading"
            ? "样片生成中，完成后可用"
            : node.metadata?.draft === "true" && !(node.metadata?.taskProviderRequestId?.trim() || node.metadata?.taskId?.trim())
                ? "该样片缺少上游任务 ID，无法转高清成片"
                : !canDraftToFinal && !node.metadata?.prompt?.trim()
                    ? "此视频无原提示词，无法重新生成"
                    : undefined;
    const hdMenuItems: CapsuleMenuItem[] = [];
    if (hdUnavailableNote) {
        hdMenuItems.push({ key: "hd-1080p", label: menuItemLabelWithNote("1080P", hdUnavailableNote), disabled: true, onClick: () => undefined });
    } else if (canDraftToFinal) {
        hdMenuItems.push({ key: "hd-1080p", label: menuItemLabelWithNote("1080P", "样片转高清成片：重新生成，会再次扣费"), onClick: () => { onHighDefinitionVideo?.(node); onClose(); } });
    } else {
        hdMenuItems.push({ key: "hd-1080p", label: menuItemLabelWithNote("1080P", "重新生成 1080P：会再次扣费，结果可能与原片有出入"), onClick: () => { onHighDefinitionVideo?.(node); onClose(); } });
    }

    // ---- “主体”----
    // 消除/修改/替换走已有视频局部修改链路（createVideoEditNodeFromVideo，inpaint）：
    // 右侧新建带连线的视频子节点、打开配置框，用户在框里补完提示词再提交，不在插件里
    // 声明新的 inpaint 能力、不编 edit 入口参数。站方是否接受 edit 入口未验证（审计
    // A2-1/A1-5），需真 Key 真机验；若站方拒绝，走现有报错链路。智能抠像无本地实现、
    // 无站方接口（Q7 已定单独立项），这里只置灰注明，不做成可用的样子。
    const subjectMenuItems: CapsuleMenuItem[] = [
        { key: "subject-remove", label: "主体消除", onClick: () => { onVideoEditOperation?.(node, "inpaint", "remove"); onClose(); } },
        { key: "subject-modify", label: "主体修改", onClick: () => { onVideoEditOperation?.(node, "inpaint", "modify"); onClose(); } },
        { key: "subject-replace", label: "主体替换", onClick: () => { onVideoEditOperation?.(node, "inpaint", "replace"); onClose(); } },
        { key: "subject-matting", label: menuItemLabelWithNote("智能抠像", "单独评估中，暂不上线"), disabled: true, onClick: () => undefined },
    ];

    return { hdMenuItems, subjectMenuItems };
}
