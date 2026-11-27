// 图片“生成视频”模板：2 个推延 + 10 个运镜 + 首尾帧补间
// （选项名与顺序按梦由心生“无限画布 S2”图片条实测原样）。
// S2 的提示词原文看不到（在它前端代码里，不公开），以下提示词全部新写、只借选项结构；
// 效果不保证与 S2 一致。
// 生成走现有图生视频链路：建一个 idle 视频子节点（videoEditOperation=image_to_video，
// 首帧/尾帧节点 id 写进元数据，seconds=5），再打开节点对话框由用户点“生成”走标准流程，
// 与视频续写、故事板分镜同一条路。时长 5 秒只通过现有 videoSeconds 参数发，
// aspect_ratio/duration 站方认不认、images 接受 URL 还是 base64 都是审计 A1 未验证项，
// 待真 Key 真机验；帧角色（首帧/尾帧）目前只在提示词里表达。

export type CanvasVideoMotionKind = "extend" | "move" | "interpolate";

export type CanvasVideoMotionPreset = {
    id: string;
    kind: CanvasVideoMotionKind;
    label: string;
    prompt: string;
    // 首尾帧补间需要两张图；其余选项只需要当前一张图。
    needsTwoFrames: boolean;
};

const VIDEO_CONSISTENCY =
    "Keep the same person or product, same face, same outfit, same colors, same materials, same background and same art style as the reference image throughout the whole 5-second clip; smooth natural motion, no flicker, no morphing, no extra people or objects appearing";

export const CANVAS_VIDEO_EXTEND_PRESETS: CanvasVideoMotionPreset[] = [
    {
        id: "extend-backward",
        kind: "extend",
        label: "向前推延5秒",
        prompt: `The provided image is the LAST frame of this 5-second clip. Generate the 5 seconds leading up to it: the action and camera move naturally arrive at exactly this final frame, matching its pose, framing and lighting. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "extend-forward",
        kind: "extend",
        label: "向后推延5秒",
        prompt: `The provided image is the FIRST frame of this 5-second clip. Generate the 5 seconds that follow it: the action and camera move continue naturally from exactly this opening frame, keeping its pose, framing and lighting. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
];

export const CANVAS_VIDEO_MOVE_PRESETS: CanvasVideoMotionPreset[] = [
    {
        id: "push-in",
        kind: "move",
        label: "镜头推进5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the camera slowly pushes in toward the subject: a smooth, steady dolly-in, framing tightening gradually while the subject stays centered. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "pull-out",
        kind: "move",
        label: "镜头拉远5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the camera slowly pulls back away from the subject: a smooth, steady dolly-out, revealing more of the environment around the subject. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "orbit",
        kind: "move",
        label: "左右环绕5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the camera orbits smoothly around the subject from side to side: a gentle arc revealing the subject from shifting angles while keeping it centered. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "tilt-pan",
        kind: "move",
        label: "上下摇镜5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the camera tilts smoothly up and down: a slow vertical pan that explores the subject from top to bottom and back, steady and controlled. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "micro-motion",
        kind: "move",
        label: "动态微动5秒",
        prompt: `The provided image is the first frame. Over 5 seconds add only subtle living motion: gentle breathing, slight hair movement, a soft blink, faint ambient drift. The camera stays locked off and the composition barely changes; the picture simply comes alive. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "cinematic-transition",
        kind: "move",
        label: "电影转场5秒",
        prompt: `The provided image is the first frame. Over 5 seconds perform a cinematic transition: the scene flows into a new shot with a smooth film-style transition, matching light and color so the cut feels intentional and polished. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "expression-change",
        kind: "move",
        label: "表情/姿态变化5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the subject's expression and pose change naturally: a subtle shift in emotion, a small head turn or gesture, evolving smoothly from the opening expression. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "product-rotate",
        kind: "move",
        label: "产品展示旋转5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the product rotates smoothly on display: a slow, even turntable rotation showing the product from all sides, studio lighting, clean background. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "atmosphere-change",
        kind: "move",
        label: "环境氛围变化5秒",
        prompt: `The provided image is the first frame. Over 5 seconds the environment and atmosphere shift gradually: light, weather or ambience evolves while the subject stays in place, like time passing in one continuous shot. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: false,
    },
    {
        id: "interpolate",
        kind: "interpolate",
        label: "首尾帧补间5秒",
        prompt: `The two provided images are the FIRST frame and the LAST frame of this 5-second clip. Generate the smooth in-between motion that connects them: the subject, camera and environment morph gradually and coherently from the opening frame to the closing frame, arriving exactly at the last frame. ${VIDEO_CONSISTENCY}`,
        needsTwoFrames: true,
    },
];

export const CANVAS_VIDEO_MOTION_PRESETS: CanvasVideoMotionPreset[] = [...CANVAS_VIDEO_EXTEND_PRESETS, ...CANVAS_VIDEO_MOVE_PRESETS];

// 图生视频模板统一 5 秒：只用现有 videoSeconds 参数发，不编新值。
export const CANVAS_VIDEO_TEMPLATE_SECONDS = "5";

export function findVideoMotionPreset(id: string) {
    return CANVAS_VIDEO_MOTION_PRESETS.find((preset) => preset.id === id);
}

export function buildVideoMotionPrompt(presetId: string) {
    return findVideoMotionPreset(presetId)?.prompt || "";
}

export function buildVideoMotionLabel(presetId: string) {
    const preset = findVideoMotionPreset(presetId);
    return preset ? `生成视频 · ${preset.label}` : "生成视频";
}
