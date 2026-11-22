import { http, type HttpRequestConfig } from "@/services/api/request";
import type { GenerationTask } from "@/services/api/task-center";

export type VideoEraseVSRRegion = { x: number; y: number; width: number; height: number };

export type VideoEraseVSRCreateRequest = {
    projectId?: string;
    nodeId?: string;
    resourceId: string;
    eraseType?: "subtitle" | "watermark";
    inpaintMode?: "sttn-auto" | "lama";
    region?: VideoEraseVSRRegion;
    clientOperationId?: string;
};

export type VideoEraseVSRResult = {
    resourceId: string;
    fileName: string;
    size: number;
    durationMs: number;
    width: number;
    height: number;
    fps?: number;
    eraseType?: string;
    inpaintMode?: string;
};

export function createVideoEraseVSRTask(
    payload: VideoEraseVSRCreateRequest,
    config?: HttpRequestConfig,
): Promise<GenerationTask> {
    return http.post<GenerationTask>("/vsr-erases", payload, config);
}
