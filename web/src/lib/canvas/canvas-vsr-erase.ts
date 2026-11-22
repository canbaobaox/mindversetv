import { isInFlightGenerationTelemetryState, normalizeGenerationTaskProgress } from "@/lib/canvas/canvas-node-metadata-contract";
import { readTaskOutcome } from "@/lib/task-outcome";
import { bindBackendCanvasGenerationResult } from "@/services/canvas-generation-consumer";
import type { GenerationTask } from "@/services/api/task-center";
import { publishGenerationTaskTelemetry } from "@/stores/use-generation-task-telemetry";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";
import { assertLocalExecutorSession, type LocalExecutorSession } from "@/lib/plugins/builtin/editor/local-executor-session";
import type { Dispatch, SetStateAction } from "react";

/**
 * VSR 擦除任务 → 画布子节点元数据，与 depthCaptureTaskMetadata 同一套映射：
 * 任务 stage/progress/outcome 原样进节点，处理中 label 用任务 stage，缺省为
 * “正在本地 AI 擦除”。失败原因只读 task.outcome，前端不自行拼凑。
 */
export function vsrEraseTaskMetadata(task: GenerationTask): CanvasNodeMetadata {
    publishGenerationTaskTelemetry(task);
    const outcome = readTaskOutcome(task);
    const active = outcome ? outcome.phase === "running" || outcome.phase === "fetching" : task.status === "queued" || task.status === "running";
    const inFlight = isInFlightGenerationTelemetryState(task);
    return {
        taskId: task.id,
        taskType: task.type,
        taskOutcome: task.outcome,
        taskOutcomeSource: undefined,
        taskStatus: task.status,
        taskStage: inFlight ? undefined : task.stage,
        taskProgress: inFlight ? undefined : normalizeGenerationTaskProgress(task.progress, task.status),
        taskProvider: task.provider,
        taskErrorCode: task.errorCode,
        taskOfficialStatus: inFlight ? undefined : task.officialStatus,
        generationErrorCode: undefined,
        model: task.model,
        taskProviderRequestId: inFlight ? undefined : task.providerRequestId,
        taskFailureDiagnostics: task.failureDiagnostics,
        taskCreatedAt: task.createdAt,
        taskUpdatedAt: inFlight ? undefined : task.updatedAt,
        taskCompletedAt: inFlight ? undefined : task.completedAt,
        generationErrorSummary: task.error,
        processingLabel: inFlight ? undefined : (task.stage || "正在本地 AI 擦除"),
        ...(active ? { status: "loading", errorDetails: undefined } : {}),
    };
}

export function isVideoEraseVSRResultNode(node: CanvasNodeData) {
    return Boolean(node.metadata?.videoSubtitleEraseSourceNodeId) && node.metadata?.taskType === "video_erase_vsr";
}

/**
 * 把已成功的 VSR 任务结果绑定到画布子节点：与 attachOwnedDepthCaptureResult
 * 同一套通用绑定（bindBackendCanvasGenerationResult），按 task.outputs 取回
 * 物化产物；节点归属以 taskClientOperationId + taskId 判定。
 */
export async function attachOwnedVideoEraseVSRResult(input: {
    node: CanvasNodeData;
    task: GenerationTask;
    session: LocalExecutorSession;
    nodesRef: { current: CanvasNodeData[] };
    setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>;
}) {
    assertLocalExecutorSession(input.session);
    const ownsTask = input.nodesRef.current.some((node) => node.id === input.node.id && node.metadata?.taskId === input.task.id);
    if (!ownsTask) return;
    await bindBackendCanvasGenerationResult({
        canvasId: input.session.projectId,
        nodeId: input.node.id,
        task: input.task,
        signal: input.session.controller.signal,
        nodesRef: input.nodesRef,
        setNodes: (value) => input.setNodes((current) => (typeof value === "function" ? value(current) : value)),
        isCurrent: () => {
            assertLocalExecutorSession(input.session);
            return input.nodesRef.current.some((node) => node.id === input.node.id && node.metadata?.taskId === input.task.id);
        },
        isNodeOwned: () => input.nodesRef.current.some((node) => node.id === input.node.id && node.metadata?.taskId === input.task.id),
    });
}
