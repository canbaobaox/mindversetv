// 梦由心生 Seedance 2.5 续写声明：只有两个 Seedance 2.5 预置模型声明 extend，
// 其它视频模型不声明（没有证据）。续写子节点选模型时靠 operations 含 extend
// 才命中 Seedance，否则按普通参考生视频走。
import { expect, test } from "bun:test";
import { MYXSAI_PRESET_MODELS } from "../../plugin-packages/beeftv-plugin-myxsai/client/presets.js";

const SEEDANCE_EXTEND_MODELS = ["doubao-seedance-2-5-260628", "seedance-2.5-guanfang"];

test("Seedance 2.5 两个预置模型声明 extend（视频续写）", () => {
    for (const model of SEEDANCE_EXTEND_MODELS) {
        const preset = MYXSAI_PRESET_MODELS.find((item) => item.model === model);
        expect(preset).toBeDefined();
        expect(preset?.capability).toBe("video");
        expect(preset?.capabilityConfig?.video?.operations).toContain("extend");
        expect(preset?.capabilityConfig?.video?.operations).toContain("reference_to_video");
    }
});

test("其它视频预置模型不声明 extend", () => {
    const others = MYXSAI_PRESET_MODELS.filter((item) => item.capability === "video" && !SEEDANCE_EXTEND_MODELS.includes(item.model));
    expect(others.length).toBeGreaterThan(0);
    for (const preset of others) {
        expect(preset.capabilityConfig?.video?.operations).not.toContain("extend");
    }
});

test("局部修改（inpaint）未声明，需真 Key 实测", () => {
    for (const preset of MYXSAI_PRESET_MODELS.filter((item) => item.capability === "video")) {
        expect(preset.capabilityConfig?.video?.operations).not.toContain("inpaint");
    }
});
