// 图片“妆容调节”模板：16 张妆容卡（选项名按梦由心生“无限画布 S2”图片条实测原样）。
// S2 的提示词原文看不到（在它前端代码里，不公开），以下提示词全部新写、只借选项结构；
// 效果不保证与 S2 一致。
// 妆容卡是纯文字卡（不照搬 S2 的人脸照片，避免版权/肖像问题）。
// 分类（现代/古装/剧情）与性别（女妆/男妆）是我们自己的归类，S2 的归类看不到；
// 生成走现有图片重绘链路（当前图作参考图；“自定义”上传的妆容参考图作第二张参考图）。

export type CanvasMakeupCategory = "modern" | "period" | "drama";
export type CanvasMakeupGender = "female" | "male";

export type CanvasMakeupPreset = {
    id: string;
    label: string;
    category: CanvasMakeupCategory;
    gender: CanvasMakeupGender;
    prompt: string;
};

export const CANVAS_MAKEUP_CATEGORIES: Array<{ id: CanvasMakeupCategory; label: string }> = [
    { id: "modern", label: "现代" },
    { id: "period", label: "古装" },
    { id: "drama", label: "剧情" },
];

export const CANVAS_MAKEUP_GENDERS: Array<{ id: "all" | CanvasMakeupGender; label: string }> = [
    { id: "all", label: "全部" },
    { id: "female", label: "女妆" },
    { id: "male", label: "男妆" },
];

export const CANVAS_MAKEUP_PRESETS: CanvasMakeupPreset[] = [
    {
        id: "commute-nude",
        label: "通勤裸妆",
        category: "modern",
        gender: "female",
        prompt: "natural no-makeup look for daily commuting: sheer even skin tone, light soft brows, nude lips, barely-there blush, clean and fresh, suitable for office daylight",
    },
    { id: "urban-elite", label: "都市精英", category: "modern", gender: "female", prompt: "polished urban professional makeup: defined brows, subtle winged eyeliner, muted rose lips, flawless matte skin, confident and refined city-professional look" },
    { id: "cool-fashion", label: "冷感时尚", category: "modern", gender: "female", prompt: "cool-toned fashion makeup: pale luminous skin, grey-brown smoky eyes, straight cool brows, muted mauve lips, high-fashion editorial coolness" },
    { id: "vivid-glam", label: "明艳浓妆", category: "modern", gender: "female", prompt: "vivid glamorous makeup: bold defined eyes, rich red lips, sculpted contour, glowing skin, striking and radiant evening glamour" },
    {
        id: "first-love",
        label: "白月光",
        category: "period",
        gender: "female",
        prompt: "pure first-love period makeup: clear translucent skin, soft willow-leaf brows, light pink lips, gentle peach blush, delicate and luminous, like a beloved figure from a period drama",
    },
    { id: "heiress", label: "豪门千金", category: "period", gender: "female", prompt: "noble heiress period makeup: elegant arched brows, refined eye makeup with a touch of gold, deep rose lips, porcelain skin, graceful and luxurious classical beauty" },
    { id: "hk-retro", label: "港风复古", category: "drama", gender: "female", prompt: "retro Hong Kong style makeup: bold red lips, dramatic wavy hair feel, strong defined eyes, warm-toned skin, nostalgic 1980s Hong Kong cinema glamour" },
    { id: "sweet-spicy", label: "甜酷辣妹", category: "modern", gender: "female", prompt: "sweet yet edgy makeup: glossy pink lips, playful blush, sharp cat eyeliner, dewy skin, cute and cool at the same time" },
    { id: "fresh-youth", label: "清爽少年", category: "modern", gender: "male", prompt: "fresh youthful makeup for a young man: clean clear skin, natural groomed brows, healthy light lip color, bright and energetic, no heavy makeup" },
    { id: "sharp-elite", label: "利落精英", category: "modern", gender: "male", prompt: "sharp professional makeup for a man: clean matte skin, neatly defined brows, subtle contour, understated and capable executive look" },
    { id: "mature-gentleman", label: "成熟绅士", category: "modern", gender: "male", prompt: "mature gentleman grooming: even skin tone, restrained and elegant, light definition around the eyes, calm and dignified masculine charm" },
    { id: "cold-fashion-male", label: "冷峻时尚", category: "modern", gender: "male", prompt: "cold fashion grooming for a man: pale even skin, cool grey-brown eye definition, straight strong brows, aloof high-fashion editorial mood" },
    { id: "k-idol", label: "韩系偶像", category: "modern", gender: "male", prompt: "Korean idol style makeup for a man: flawless dewy skin, soft gradient lips, gentle eye definition, youthful and polished K-pop idol glow" },
    { id: "restrained-ceo", label: "禁欲总裁", category: "drama", gender: "male", prompt: "restrained CEO drama makeup for a man: sharp suit-ready grooming, cool detached expression, precise brows, muted lips, powerful and untouchable presence" },
    { id: "hk-dandy", label: "港风雅痞", category: "drama", gender: "male", prompt: "retro Hong Kong dandy grooming for a man: slicked hair feel, confident smirk-ready look, warm-toned skin, a hint of roguish charm from classic Hong Kong films" },
    { id: "rebel-rock", label: "痞帅摇滚", category: "drama", gender: "male", prompt: "rebel rockstar grooming for a man: smoky eyes, tousled hair feel, bold attitude, slightly rough skin texture, cool and defiant rock energy" },
];

// 妆容浓淡滑杆：默认 60（标准还原）。
export const CANVAS_MAKEUP_DEFAULT_INTENSITY = 60;

export function makeupIntensityLabel(intensity: number) {
    if (intensity < 30) return "轻柔淡妆";
    if (intensity < 50) return "自然清透";
    if (intensity <= 70) return "标准还原";
    if (intensity <= 85) return "浓郁鲜明";
    return "强烈戏剧";
}

export function findMakeupPreset(id: string) {
    return CANVAS_MAKEUP_PRESETS.find((preset) => preset.id === id);
}

export function buildMakeupPrompt(input: { presetId: string; intensity?: number; notes?: string; hasCustomReference?: boolean }) {
    const preset = findMakeupPreset(input.presetId);
    if (!preset) return "";
    const intensity = input.intensity ?? CANVAS_MAKEUP_DEFAULT_INTENSITY;
    const parts = [
        "Apply makeup to the person in the reference image, keeping the same face, same identity, same hairstyle, same outfit, same pose, same background and same art style; only the makeup changes, do not change who the person is",
        preset.prompt,
        `makeup intensity: ${makeupIntensityLabel(intensity)} (${intensity}/100)${intensity < 30 ? ", keep it very subtle and natural" : intensity > 85 ? ", make it bold and dramatic" : ""}`,
    ];
    if (input.hasCustomReference) parts.push("use the second reference image as the makeup style reference: match its makeup colors and style");
    const notes = input.notes?.trim();
    if (notes) parts.push(`additional request: ${notes}`);
    return parts.join(". ");
}

export function buildMakeupLabel(presetId: string) {
    const preset = findMakeupPreset(presetId);
    return preset ? `妆容调节 · ${preset.label}` : "妆容调节";
}
