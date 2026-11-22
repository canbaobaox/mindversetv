// 梦由心生模型价格：字段名以模型广场公开接口
// GET /gongkai/moxingguangchang 的实测返回为准
//（price_min / price_max / output_price_min / price_available / billing_mode，
// billing_mode 取值：按次 / 按秒 / 按 token）。
// 数值单位站方未说明（算力点还是人民币无法从匿名响应得知），因此只原样显示
// 数字 + 计费单位，不加币种符号、不换算、不编造。
// 接口没给价格（price_available 为 false，或 price_min 不是数字）时返回 null，
// 调用方显示“价格待确认”。

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
    if (record.price_available === false) return null;
    const priceMin = toFiniteNumber(record.price_min);
    if (priceMin === null) return null;
    const billingMode = typeof record.billing_mode === "string" && record.billing_mode.trim() ? record.billing_mode.trim() : undefined;
    return {
        priceMin,
        ...(toOptionalFiniteNumber(record.price_max) !== undefined ? { priceMax: toOptionalFiniteNumber(record.price_max)! } : {}),
        ...(toOptionalFiniteNumber(record.output_price_min) !== undefined ? { outputPriceMin: toOptionalFiniteNumber(record.output_price_min)! } : {}),
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
