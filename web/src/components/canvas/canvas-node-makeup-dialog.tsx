// 图片“妆容调节”弹窗（二期）：居中大弹窗，按仓库现有弹窗模式写（AppModal flush + SpotlightSurface，
// 与打光面板同一套壳，不自创弹窗框架）。
// 16 张妆容卡是纯文字卡（带名字与分类），不照搬 S2 的人脸照片，避免版权/肖像问题。
// 分类（现代/古装/剧情）与性别筛选（全部/女妆/男妆）是我们自己的归类，S2 的归类看不到。
// “自定义”上传本地图片作妆容参考，走现有上传链路（uploadImage）；
// 生成走现有图片重绘链路（当前图作参考图，自定义图作第二张参考图）。

import { useRef, useState } from "react";
import { App, Slider } from "antd";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Send, Upload, X } from "lucide-react";

import { SpotlightSurface } from "@/components/ui/aceternity/spotlight-surface";
import { aceternityMotion } from "@/lib/aceternity-motion";
import { canvasThemes } from "@/lib/canvas-theme";
import { CANVAS_MAKEUP_CATEGORIES, CANVAS_MAKEUP_DEFAULT_INTENSITY, CANVAS_MAKEUP_GENDERS, CANVAS_MAKEUP_PRESETS, buildMakeupPrompt, makeupIntensityLabel, type CanvasMakeupCategory, type CanvasMakeupGender } from "@/lib/canvas/canvas-makeup";
import { uploadImage } from "@/services/image-storage";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import type { ReferenceImage } from "@/types/image";

export type CanvasMakeupPayload = {
    presetId: string;
    intensity: number;
    notes: string;
    customReference?: ReferenceImage;
};

export function CanvasNodeMakeupPanel({ dataUrl, onClose, onConfirm }: { dataUrl: string; onClose: () => void; onConfirm: (payload: CanvasMakeupPayload) => void }) {
    const theme = canvasThemes[useActiveTheme()];
    const reducedMotion = useReducedMotion();
    const { message } = App.useApp();
    const [category, setCategory] = useState<CanvasMakeupCategory>("modern");
    const [gender, setGender] = useState<"all" | CanvasMakeupGender>("all");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [intensity, setIntensity] = useState(CANVAS_MAKEUP_DEFAULT_INTENSITY);
    const [notes, setNotes] = useState("");
    const [customReference, setCustomReference] = useState<ReferenceImage | null>(null);
    const [uploadingCustom, setUploadingCustom] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const visiblePresets = CANVAS_MAKEUP_PRESETS.filter((preset) => preset.category === category && (gender === "all" || preset.gender === gender));
    const selectedPreset = CANVAS_MAKEUP_PRESETS.find((preset) => preset.id === selectedId) || null;

    const handleReset = () => {
        setCategory("modern");
        setGender("all");
        setSelectedId(null);
        setIntensity(CANVAS_MAKEUP_DEFAULT_INTENSITY);
        setNotes("");
        setCustomReference(null);
    };

    const handleCustomFile = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            message.warning("请选择图片文件作为妆容参考");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            if (!result) {
                message.error("读取图片失败，请重试");
                return;
            }
            setUploadingCustom(true);
            void uploadImage(result)
                .then((uploaded) => {
                    setCustomReference({
                        id: `makeup-reference-${Date.now()}`,
                        name: file.name,
                        type: file.type || "image/png",
                        dataUrl: result,
                        url: uploaded.url,
                        storageKey: uploaded.storageKey,
                        width: uploaded.width,
                        height: uploaded.height,
                        bytes: uploaded.bytes,
                    });
                    message.success("已上传妆容参考图");
                })
                .catch((error) => message.error(error instanceof Error ? `上传失败：${error.message}` : "上传失败，请重试"))
                .finally(() => setUploadingCustom(false));
        };
        reader.onerror = () => message.error("读取图片失败，请重试");
        reader.readAsDataURL(file);
    };

    const handleGenerate = () => {
        if (!selectedPreset) return;
        onConfirm({
            presetId: selectedPreset.id,
            intensity,
            notes: notes.trim(),
            ...(customReference ? { customReference } : {}),
        });
    };

    const secondaryButtonClass = "flex h-8 items-center gap-1.5 rounded-[var(--dock-item-radius)] px-3 text-[var(--fs-label)] font-medium transition hover:bg-black/5 dark:hover:bg-white/10";

    return (
        <SpotlightSurface
            data-canvas-no-zoom
            spotlightColor={theme.toolbar.itemHover}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : aceternityMotion.spring.panel}
            className="w-full max-w-full overflow-hidden rounded-[var(--r-2xl)] border backdrop-blur-2xl"
            style={{ background: theme.spatial.elevated, borderColor: theme.toolbar.border, color: theme.node.text, boxShadow: `0 28px 80px ${theme.spatial.shadow}` }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="flex h-14 items-center justify-between border-b px-5" style={{ borderColor: theme.toolbar.border }}>
                <h2 className="text-[var(--fs-title)] font-semibold leading-none">妆容调节</h2>
                <button type="button" aria-label="关闭妆容调节" className="grid size-8 place-items-center rounded-[var(--r-md)] transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.muted }} onClick={onClose}>
                    <X className="size-5" />
                </button>
            </div>

            <div className="grid items-stretch" style={{ gridTemplateColumns: "240px minmax(0, 1fr)" }}>
                <div className="flex shrink-0 flex-col items-center gap-2 border-r px-3 py-3" style={{ width: 240, borderColor: theme.toolbar.border }}>
                    <span className="w-full text-[var(--fs-tiny)] font-medium" style={{ color: theme.node.muted }}>
                        当前图片
                    </span>
                    {dataUrl ? (
                        <img src={dataUrl} alt="当前图片预览" className="max-h-64 w-full rounded-[var(--r-lg)] border object-contain" style={{ borderColor: theme.toolbar.border }} />
                    ) : (
                        <div className="grid h-40 w-full place-items-center rounded-[var(--r-lg)] border text-[var(--fs-tiny)]" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                            暂无预览
                        </div>
                    )}
                    {customReference ? (
                        <div className="w-full space-y-1">
                            <span className="text-[var(--fs-tiny)] font-medium" style={{ color: theme.node.muted }}>
                                妆容参考图
                            </span>
                            <div className="flex items-center gap-2">
                                <img src={customReference.dataUrl} alt={customReference.name} className="h-12 w-12 shrink-0 rounded-[var(--r-md)] border object-cover" style={{ borderColor: theme.toolbar.border }} />
                                <span className="min-w-0 flex-1 truncate text-[var(--fs-tiny)]" title={customReference.name}>
                                    {customReference.name}
                                </span>
                                <button type="button" aria-label="移除妆容参考图" className="grid size-6 shrink-0 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setCustomReference(null)}>
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="上传妆容参考图"
                        onChange={(event) => {
                            handleCustomFile(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                    <button type="button" className={secondaryButtonClass} style={{ color: theme.node.text }} disabled={uploadingCustom} onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-3.5" />
                        {uploadingCustom ? "上传中…" : "自定义"}
                    </button>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1 rounded-[var(--r-md)] p-1" style={{ background: theme.toolbar.itemHover }}>
                        {CANVAS_MAKEUP_CATEGORIES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-pressed={category === item.id}
                                onClick={() => setCategory(item.id)}
                                className="flex-1 rounded-[var(--r-md)] py-1 text-[11px] font-medium transition-colors"
                                style={category === item.id ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.muted }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 rounded-[var(--r-md)] p-1" style={{ background: theme.toolbar.itemHover }}>
                        {CANVAS_MAKEUP_GENDERS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-pressed={gender === item.id}
                                onClick={() => setGender(item.id)}
                                className="flex-1 rounded-[var(--r-md)] py-1 text-[11px] font-medium transition-colors"
                                style={gender === item.id ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.muted }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {visiblePresets.length ? (
                        <div className="grid grid-cols-4 gap-1.5">
                            {visiblePresets.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    aria-pressed={selectedId === preset.id}
                                    onClick={() => setSelectedId((current) => (current === preset.id ? null : preset.id))}
                                    className="flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-[var(--r-lg)] border px-2.5 py-2 text-left transition-colors"
                                    style={
                                        selectedId === preset.id
                                            ? { borderColor: theme.node.activeStroke, background: theme.toolbar.activeBg, color: theme.node.text }
                                            : { borderColor: theme.toolbar.border, background: theme.toolbar.itemHover, color: theme.node.text }
                                    }
                                >
                                    <span className="text-xs font-semibold leading-tight">{preset.label}</span>
                                    <span className="text-[11px] leading-tight" style={{ color: theme.node.muted }}>
                                        {preset.gender === "female" ? "女妆" : "男妆"} · {CANVAS_MAKEUP_CATEGORIES.find((item) => item.id === preset.category)?.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="grid h-24 place-items-center rounded-[var(--r-lg)] border text-[var(--fs-tiny)]" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                            该分类下暂无妆容
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[var(--fs-tiny)]" style={{ color: theme.node.muted }}>
                            妆容浓淡
                        </span>
                        <div className="min-w-0 flex-1">
                            <Slider min={0} max={100} value={intensity} onChange={setIntensity} tooltip={{ formatter: (value) => `${value} · ${makeupIntensityLabel(value ?? 0)}` }} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-[var(--fs-tiny)] font-semibold tabular-nums">
                            {intensity} · {makeupIntensityLabel(intensity)}
                        </span>
                    </div>
                    <input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="如：唇色改珊瑚色"
                        aria-label="妆容附加说明"
                        className="h-9 w-full rounded-[var(--r-lg)] border px-3 text-xs outline-none transition-colors"
                        style={{ borderColor: theme.toolbar.border, background: theme.toolbar.itemHover, color: theme.node.text }}
                    />
                    {selectedPreset ? (
                        <div className="rounded-[var(--r-lg)] border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.toolbar.border, background: theme.toolbar.itemHover, color: theme.node.muted }}>
                            将生成：{buildMakeupPrompt({ presetId: selectedPreset.id, intensity, notes, hasCustomReference: Boolean(customReference) })}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="flex h-12 items-center gap-2 border-t px-3" style={{ borderColor: theme.toolbar.border }}>
                <button type="button" className={secondaryButtonClass} style={{ color: theme.node.muted }} onClick={handleReset}>
                    <RotateCcw className="size-3.5" />
                    重置
                </button>
                <span className="flex-1" />
                <span className="text-[var(--fs-tiny)]" style={{ color: theme.node.muted }}>
                    {selectedPreset ? `已选：${selectedPreset.label}` : "请先选一张妆容卡"}
                </span>
                <motion.button
                    type="button"
                    whileHover={reducedMotion || !selectedPreset ? undefined : { y: -1 }}
                    whileTap={reducedMotion || !selectedPreset ? undefined : { scale: 0.97 }}
                    className="flex h-8 items-center gap-1.5 rounded-[var(--dock-item-radius)] px-3 text-[var(--fs-label)] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: theme.node.activeStroke, color: theme.node.panel }}
                    disabled={!selectedPreset}
                    onClick={handleGenerate}
                >
                    <Send className="size-3.5" />
                    生成
                </motion.button>
            </div>
        </SpotlightSurface>
    );
}
