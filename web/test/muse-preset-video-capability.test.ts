// Muse 视频能力配置：时长/画幅档位只用 muse2api README 有出处的
// 值（5/6/8/10 秒、16:9/9:16），且必须整份通过宿主的
// sanitizeServerVideoCapability（缺一个必填字段就整份作废）。
// 文本/图片预置不挂 capabilityConfig，走宿主通用协议默认能力。
import { expect, test } from "bun:test";
import {
  MUSE_VIDEO_CAPABILITY_CONFIG,
  buildMuseModelChannel,
} from "../../plugin-packages/beeftv-plugin-muse/client/presets.js";
import { sanitizeServerVideoCapability } from "../src/lib/model-capabilities-video";

test("Muse 视频能力配置通过宿主校验（时长 5/6/8/10、画幅 16:9/9:16）", () => {
  const sanitized = sanitizeServerVideoCapability(MUSE_VIDEO_CAPABILITY_CONFIG.video);
  expect(sanitized).not.toBeNull();
  expect(sanitized?.duration).toEqual({ selection: "enum", values: [5, 6, 8, 10], default: 6 });
  expect(sanitized?.ratios).toEqual(["16:9", "9:16"]);
  expect(sanitized?.defaultRatio).toBe("16:9");
  expect(sanitized?.references.maxImages).toBe(10);
  expect(sanitized?.references.maxVideos).toBe(0);
  expect(sanitized?.references.maxAudios).toBe(0);
});

test("Muse 视频预置只声明文生/图生视频，不声明续写与局部修改", () => {
  const sanitized = sanitizeServerVideoCapability(MUSE_VIDEO_CAPABILITY_CONFIG.video);
  expect(sanitized?.operations).toEqual(["text_to_video", "image_to_video"]);
  expect(sanitized?.defaultOperation).toBe("text_to_video");
  expect(sanitized?.operations).not.toContain("extend");
  expect(sanitized?.operations).not.toContain("inpaint");
  expect(sanitized?.operations).not.toContain("reference_to_video");
});

test("buildMuseModelChannel 给 muse-video 挂能力配置，文本/图片不挂", () => {
  const channel = buildMuseModelChannel({ apiKey: "k", baseUrl: "http://127.0.0.1:18610" });
  const video = channel.modelProfiles.find((item) => item.model === "muse-video");
  expect(video?.capabilityConfig).toEqual(MUSE_VIDEO_CAPABILITY_CONFIG);
  for (const model of ["muse-spark", "muse-image"]) {
    const profile = channel.modelProfiles.find((item) => item.model === model);
    expect(profile).toBeDefined();
    expect(profile?.capabilityConfig).toBeUndefined();
  }
});
