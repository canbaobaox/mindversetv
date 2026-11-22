// 梦由心生模型价格格式化：只认模型广场公开接口实测过的字段名，不编造价格。
import { expect, test } from "bun:test";
import { formatMyxsaiModelPrice, sanitizeMyxsaiModelPrice } from "../src/lib/myxsai-model-pricing";

test("formatMyxsaiModelPrice 按次/按秒/按 token 原样显示数字与单位，不加币种", () => {
    expect(formatMyxsaiModelPrice({ price_min: 0.05, price_available: true, billing_mode: "按次" })).toBe("0.05/次");
    expect(formatMyxsaiModelPrice({ price_min: 0.123456, price_available: true, billing_mode: "按秒" })).toBe("0.1235/秒");
    expect(formatMyxsaiModelPrice({ price_min: 2, price_available: true, billing_mode: "按token" })).toBe("2/百万 token");
    expect(formatMyxsaiModelPrice({ price_min: 2, output_price_min: 8, price_available: true, billing_mode: "按token" })).toBe("输入 2/百万 token，输出 8/百万 token");
});

test("formatMyxsaiModelPrice 接口没给价格时返回 null，调用方显示价格待确认", () => {
    // 匿名调广场接口时 144 个模型全是这个样子：有字段名，没价格。
    expect(formatMyxsaiModelPrice({ price_available: false, billing_mode: "", price_min: undefined })).toBeNull();
    expect(formatMyxsaiModelPrice({ price_min: 0.05, price_available: false, billing_mode: "按次" })).toBeNull();
    expect(formatMyxsaiModelPrice({})).toBeNull();
    expect(formatMyxsaiModelPrice(null)).toBeNull();
    expect(formatMyxsaiModelPrice({ price_min: "0.05", price_available: true, billing_mode: "按次" })).toBeNull();
});

test("sanitizeMyxsaiModelPrice 只保留已验证的价格字段", () => {
    expect(sanitizeMyxsaiModelPrice({ price_min: 0.05, price_max: 0.1, output_price_min: 0.2, price_available: true, billing_mode: "按次", vendor: "x" })).toEqual({ priceMin: 0.05, priceMax: 0.1, outputPriceMin: 0.2, billingMode: "按次" });
    expect(sanitizeMyxsaiModelPrice({ price_min: -1, price_available: true })).toBeNull();
});
