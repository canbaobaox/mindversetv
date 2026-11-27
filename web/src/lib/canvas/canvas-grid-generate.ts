// 图片“宫格生成”模板：7 个选项（选项名按梦由心生“无限画布 S2”图片条实测原样）。
// 注意方向：这是“生成一张多格新图”，不是“宫格拆分”（把一张图切成多张）；
// 与已改名的“宫格拆分”入口区分开。S2 的提示词原文看不到（在它前端代码里，不公开），
// 以下提示词全部新写、只借选项结构；效果不保证与 S2 一致。
// 生成走现有图片重绘链路（当前图作参考图），一次出一张多格图。

export type CanvasGridGeneratePresetId = "multi-angle-nine" | "story-four" | "face-three-views" | "product-three-views" | "storyboard-25" | "cinematic-grade" | "character-three-views";

export type CanvasGridGeneratePreset = {
    id: CanvasGridGeneratePresetId;
    label: string;
    prompt: string;
};

const GRID_CONSISTENCY =
    "Based on the reference image, keep the same character or product identity, same face, same outfit, same colors, same materials and same art style in every cell; the person or product must be recognizably the same across all panels";

export const CANVAS_GRID_GENERATE_PRESETS: CanvasGridGeneratePreset[] = [
    {
        id: "multi-angle-nine",
        label: "多机位九宫格",
        prompt: `Generate ONE single image containing a 3x3 nine-panel grid, nine different camera angles of the same subject from the reference image: front, back, left, right, top-down, low angle, three-quarter left, three-quarter right and close-up. ${GRID_CONSISTENCY}. Clean thin grid dividers, each panel the same size, no text, no captions`,
    },
    {
        id: "story-four",
        label: "剧情推演四宫格",
        prompt: `Generate ONE single image containing a 2x2 four-panel grid that tells a short story in sequence: the same character from the reference image in four consecutive story beats, reading left to right, top to bottom, with a clear narrative progression. ${GRID_CONSISTENCY}. Clean thin grid dividers, each panel the same size, no text, no captions`,
    },
    {
        id: "face-three-views",
        label: "角色脸部三视图",
        prompt: `Generate ONE single image containing three face views of the same character from the reference image side by side: front view, three-quarter view, and side profile. ${GRID_CONSISTENCY}. Same lighting, same expression, neutral background, clean layout, no text`,
    },
    {
        id: "product-three-views",
        label: "产品三视图",
        prompt: `Generate ONE single image containing three views of the same product from the reference image side by side: front view, side view, and top view. ${GRID_CONSISTENCY}. Same product, same color, same materials, clean studio background, even lighting, no text`,
    },
    {
        id: "storyboard-25",
        label: "25宫格连贯分镜",
        prompt: `Generate ONE single image containing a 5x5 twenty-five-panel storyboard grid: twenty-five consecutive frames telling one coherent short story with the same character from the reference image, reading left to right, top to bottom, with smooth continuity of action, framing and lighting. ${GRID_CONSISTENCY}. Clean thin grid dividers, each panel the same size, no text, no captions`,
    },
    {
        id: "cinematic-grade",
        label: "电影级光影校正",
        prompt: `Re-render the reference image as a single frame with cinematic-grade lighting and color correction: balanced exposure, filmic contrast, refined highlights and shadows, subtle teal-and-warm color grade, clean and polished movie still. Keep the same subject, same composition, same pose and same background; only the light and color are corrected. This option outputs one single corrected image, not a grid`,
    },
    {
        id: "character-three-views",
        label: "角色三视图生成",
        prompt: `Generate ONE single image containing three full-body views of the same character from the reference image side by side: front view, side view, and back view. ${GRID_CONSISTENCY}. Same height, same build, same outfit, same hairstyle, neutral background, clean layout, no text`,
    },
];

export function findGridGeneratePreset(id: string) {
    return CANVAS_GRID_GENERATE_PRESETS.find((preset) => preset.id === id);
}

export function buildGridGeneratePrompt(presetId: string) {
    return findGridGeneratePreset(presetId)?.prompt || "";
}

export function buildGridGenerateLabel(presetId: string) {
    const preset = findGridGeneratePreset(presetId);
    return preset ? `宫格生成 · ${preset.label}` : "宫格生成";
}
