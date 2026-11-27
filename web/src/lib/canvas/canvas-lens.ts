// 图片“镜头效果”模板：9 个焦段/景深选项（选项名按梦由心生“无限画布 S2”图片条实测原样）。
// S2 的提示词原文看不到（在它前端代码里，不公开），以下提示词全部新写、只借选项结构；
// 效果不保证与 S2 一致。生成走现有图片重绘链路（当前图作参考图）。

export type CanvasLensPresetId = "wide-24mm" | "humanist-35mm" | "standard-50mm" | "portrait-85mm" | "telephoto-compression" | "macro-lens" | "shallow-depth" | "deep-depth" | "tilt-shift";

export type CanvasLensPreset = {
    id: CanvasLensPresetId;
    label: string;
    prompt: string;
};

// 只重构焦段与景深，不改主体：人、物、场景、服装、配色、画面风格都沿用参考图。
const LENS_CONSISTENCY =
    "Re-render the same subject from the reference image with a different lens and depth of field: keep the same person or product, same outfit, same colors, same materials, same background and same overall art style; do not redesign the subject, do not change the scene, only change the lens character, field of view and depth of field";

export const CANVAS_LENS_PRESETS: CanvasLensPreset[] = [
    {
        id: "wide-24mm",
        label: "24mm广角",
        prompt: `${LENS_CONSISTENCY}. Shot on a 24mm wide-angle lens: expansive field of view, stretched perspective at the edges, deep sense of space, environment clearly visible around the subject`,
    },
    {
        id: "humanist-35mm",
        label: "35mm人文",
        prompt: `${LENS_CONSISTENCY}. Shot on a 35mm humanist documentary lens: natural perspective close to the human eye, subject in context with a readable environment, candid street-photography feel`,
    },
    {
        id: "standard-50mm",
        label: "50mm标准",
        prompt: `${LENS_CONSISTENCY}. Shot on a 50mm standard lens: neutral, undistorted perspective, natural proportions, classic and balanced framing`,
    },
    {
        id: "portrait-85mm",
        label: "85mm人像",
        prompt: `${LENS_CONSISTENCY}. Shot on an 85mm portrait lens: flattering compression, creamy background separation, sharp focus on the face, classic portrait look`,
    },
    {
        id: "telephoto-compression",
        label: "长焦压缩",
        prompt: `${LENS_CONSISTENCY}. Shot on a long telephoto lens: strong perspective compression, background pulled close behind the subject, flattened depth, distant layers stacked together`,
    },
    {
        id: "macro-lens",
        label: "微距镜头",
        prompt: `${LENS_CONSISTENCY}. Shot on a macro lens: extreme close-up, fine detail magnified, shallow focus plane, tiny textures rendered with crisp clarity`,
    },
    {
        id: "shallow-depth",
        label: "浅景深虚化",
        prompt: `${LENS_CONSISTENCY}. Use a very shallow depth of field: subject tack-sharp, background melted into soft creamy bokeh, strong subject separation`,
    },
    {
        id: "deep-depth",
        label: "深景深全清",
        prompt: `${LENS_CONSISTENCY}. Use a deep depth of field: everything from the foreground to the far background in sharp focus, crisp detail across the whole frame`,
    },
    {
        id: "tilt-shift",
        label: "移轴微缩",
        prompt: `${LENS_CONSISTENCY}. Shot with a tilt-shift lens miniature effect: selective thin band of focus across the subject, the rest of the scene softly blurred, making the real scene look like a tiny scale model`,
    },
];

export function findLensPreset(id: string) {
    return CANVAS_LENS_PRESETS.find((preset) => preset.id === id);
}

export function buildLensPrompt(presetId: string) {
    return findLensPreset(presetId)?.prompt || "";
}

export function buildLensLabel(presetId: string) {
    const preset = findLensPreset(presetId);
    return preset ? `镜头效果 · ${preset.label}` : "镜头效果";
}
