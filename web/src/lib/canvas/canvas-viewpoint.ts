// 图片“生成图片”视角模板：12 个视角选项（选项名与顺序按梦由心生“无限画布 S2”图片条实测原样）。
// S2 的提示词原文看不到（在它前端代码里，不公开），以下提示词全部新写、只借选项结构；
// 效果不保证与 S2 一致。生成走现有图片重绘链路（当前图作参考图）。

export type CanvasViewpointPresetId = "auto-exposure" | "fisheye" | "tilt" | "front-top-down" | "front-low-angle" | "panoramic-top-down" | "back" | "three-quarter-45" | "side" | "macro" | "hero-low-angle" | "eye-level-product";

export type CanvasViewpointPreset = {
    id: CanvasViewpointPresetId;
    label: string;
    prompt: string;
};

// 只改视角，不改主体：人、物、场景、服装、配色、画面风格都沿用参考图。
const VIEWPOINT_CONSISTENCY =
    "Regenerate the same subject from the reference image from a new camera viewpoint: keep the same person or product, same outfit, same colors, same materials, same background and same overall art style; do not redesign the subject, do not change the scene, only change the camera viewpoint and framing";

export const CANVAS_VIEWPOINT_PRESETS: CanvasViewpointPreset[] = [
    {
        id: "auto-exposure",
        label: "自动曝光",
        prompt: `${VIEWPOINT_CONSISTENCY}. Use balanced, natural auto exposure: true-to-life brightness, no blown highlights, no crushed shadows, clean and evenly lit like a well-exposed photograph`,
    },
    {
        id: "fisheye",
        label: "鱼眼视角",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot with an ultra-wide fisheye lens: strong barrel distortion, curved edges, exaggerated depth in the center, playful wide-angle perspective`,
    },
    {
        id: "tilt",
        label: "倾斜视角",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot with a tilted Dutch angle: the horizon and vertical lines lean diagonally, creating a dynamic, slightly uneasy, cinematic tension`,
    },
    {
        id: "front-top-down",
        label: "正面俯拍",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot from directly above the subject, straight top-down view facing the front plane: flat-lay composition, symmetrical layout, everything seen from above`,
    },
    {
        id: "front-low-angle",
        label: "正面仰拍",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot from a low angle looking straight up at the subject from the front: the subject towers above the camera, strong and monumental, with the background receding upward`,
    },
    {
        id: "panoramic-top-down",
        label: "全景俯拍",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot a wide panoramic top-down aerial view: high above the scene looking down, broad field of view, the whole environment visible as a sweeping panorama`,
    },
    {
        id: "back",
        label: "背面视角",
        prompt: `${VIEWPOINT_CONSISTENCY}. Show the subject from directly behind: back of the head, back and shoulders, the world ahead of the subject visible in front of them`,
    },
    {
        id: "three-quarter-45",
        label: "45度三分之二",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot a three-quarter view at 45 degrees: the subject turned two-thirds toward the camera, showing depth of the face or product with one side slightly foreshortened`,
    },
    {
        id: "side",
        label: "侧面视角",
        prompt: `${VIEWPOINT_CONSISTENCY}. Show the subject in pure side profile: clean silhouette from the side, facial profile or product side elevation clearly readable`,
    },
    {
        id: "macro",
        label: "微距特写",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot an extreme macro close-up: fill the frame with fine surface detail, skin texture, fabric weave or product material, razor-sharp focus on the closest detail`,
    },
    {
        id: "hero-low-angle",
        label: "英雄低角度",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot a heroic low angle: camera near the ground looking up, the subject framed against the sky, powerful, tall and larger than life`,
    },
    {
        id: "eye-level-product",
        label: "平视产品视角",
        prompt: `${VIEWPOINT_CONSISTENCY}. Shoot at eye level straight on: camera at the same height as the subject, neutral frontal product-shot framing, no tilt, no distortion, catalog-clean presentation`,
    },
];

export function findViewpointPreset(id: string) {
    return CANVAS_VIEWPOINT_PRESETS.find((preset) => preset.id === id);
}

export function buildViewpointPrompt(presetId: string) {
    return findViewpointPreset(presetId)?.prompt || "";
}

export function buildViewpointLabel(presetId: string) {
    const preset = findViewpointPreset(presetId);
    return preset ? `生成图片 · ${preset.label}` : "生成图片";
}
