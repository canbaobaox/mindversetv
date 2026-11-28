// 梦由心生模型价格：字段名以模型广场公开接口
// GET /gongkai/moxingguangchang 的实测返回为准
//（price_min / price_max / output_price_min / price_available / billing_mode，
// billing_mode 取值：按次 / 按秒 / 按 token）。
// 数值单位站方未说明（算力点还是人民币无法从匿名响应得知），因此只原样显示
// 数字 + 计费单位，不加币种符号、不换算、不编造。
// 接口没给价格（price_available 为 false，或 price_min 不是数字）时返回 null，
// 调用方显示“价格待确认”。
// 价格有三种写法，都认：① 平铺在记录上的下划线字段（广场公开接口）；
// ② 嵌在 myxsaiPrice 里的驼峰字段（后端目录快照 PublicChannelModel）；
// ③ 嵌在 pricing 里的驼峰字段（插件拉取到的目录）。只取价格字段，其余不透传。

export type MyxsaiModelPrice = {
    priceMin: number;
    priceMax?: number;
    outputPriceMin?: number;
    billingMode?: string;
};

function toFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return value;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
    const parsed = toFiniteNumber(value);
    return parsed === null ? undefined : parsed;
}

// 最多保留 4 位小数（与广场前端 w(price_min, 4) 一致），去掉末尾多余的 0。
function formatPriceNumber(value: number): string {
    return String(Number(value.toFixed(4)));
}

export function sanitizeMyxsaiModelPrice(value: unknown): MyxsaiModelPrice | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    // 价格可能嵌在 myxsaiPrice（后端目录快照）或 pricing（插件拉取）里，也可能
    // 直接平铺在记录上（模型广场公开接口）；三种形状都认，字段名驼峰与下划线
    // 两种写法都认（驼峰优先，与后端解析一致）。
    const source = (record.myxsaiPrice && typeof record.myxsaiPrice === "object"
        ? record.myxsaiPrice
        : record.pricing && typeof record.pricing === "object"
          ? record.pricing
          : record) as Record<string, unknown>;
    if (source.price_available === false || source.priceAvailable === false) return null;
    const priceMin = toFiniteNumber(source.priceMin) ?? toFiniteNumber(source.price_min);
    if (priceMin === null) return null;
    const priceMax = toOptionalFiniteNumber(source.priceMax) ?? toOptionalFiniteNumber(source.price_max);
    const outputPriceMin = toOptionalFiniteNumber(source.outputPriceMin) ?? toOptionalFiniteNumber(source.output_price_min);
    const billingModeRaw = source.billingMode ?? source.billing_mode;
    const billingMode = typeof billingModeRaw === "string" && billingModeRaw.trim() ? billingModeRaw.trim() : undefined;
    return {
        priceMin,
        ...(priceMax !== undefined ? { priceMax } : {}),
        ...(outputPriceMin !== undefined ? { outputPriceMin } : {}),
        ...(billingMode ? { billingMode } : {}),
    };
}

export function formatMyxsaiModelPrice(value: unknown): string | null {
    const price = sanitizeMyxsaiModelPrice(value);
    if (!price) return null;
    const amount = formatPriceNumber(price.priceMin);
    switch (price.billingMode) {
        case "按次":
            return `${amount}/次`;
        case "按秒":
            return `${amount}/秒`;
        case "按token":
            if (price.outputPriceMin !== undefined) return `输入 ${amount}/百万 token，输出 ${formatPriceNumber(price.outputPriceMin)}/百万 token`;
            return `${amount}/百万 token`;
        default:
            return amount;
    }
}
