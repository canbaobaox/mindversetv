# MindVerseTV

> MindVerseTV 是 BeefTV（glanderness/BeefTV，v2.2.5）的修改版，不是官方发布，未获官方背书；仍按 BeefTV Source Available License 1.0 与历史 MIT 条款执行，商业转售、套壳、收费部署与托管需原作者书面授权。

MindVerseTV 是一个无限画布 AI 视频工作台。

在一张自由画布上，把图片、视频、模型和提示词连起来做视频：从分镜、素材到成片，都可以继续编辑、迭代。

Windows 安装包在 [Releases](https://github.com/canbaobaox/mindversetv/releases/latest)，下载后双击就能装；模型自己填地址和 Key 就能用。

<p align="center">
  <a href="https://github.com/canbaobaox/mindversetv/stargazers"><img src="https://img.shields.io/github/stars/glanderness/MindVerseTV?style=flat-square&amp;logo=github&amp;label=Stars&amp;labelColor=303030&amp;color=E86C36" alt="MindVerseTV GitHub Stars"></a>
  <a href="https://github.com/canbaobaox/mindversetv/releases/latest"><img src="https://img.shields.io/github/v/release/glanderness/MindVerseTV?style=flat-square&amp;label=Release&amp;labelColor=303030&amp;color=525252" alt="MindVerseTV 最新版本"></a>
  <a href="QUICKSTART.md#下载与首次打开"><img src="https://img.shields.io/badge/Desktop-macOS%20%7C%20Windows-525252?style=flat-square&amp;labelColor=303030" alt="桌面版支持 macOS 和 Windows"></a>
  <a href="QUICKSTART.md"><img src="https://img.shields.io/badge/Workspace-Local--first-525252?style=flat-square&amp;labelColor=303030" alt="本地优先工作区"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Source%20Available-525252?style=flat-square&amp;labelColor=303030" alt="源码可用，许可范围见 LICENSE"></a>
</p>

## 最近更新

- **[v2.3.4](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.4)** — 修复梦由心生生图失败（结果地址与轮询判定按站方协议对齐），选择模型加全选，每个模型显示费用。
- **[v2.3.3](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.3)** — 移除无限星河、LL2、银盛三家接口插件，新增梦由心生插件，内置渠道迁移为梦由心生，账号与余额联动梦由心生。
- **[v2.3.2](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.2)** — 修复 Windows 内置助手连续对话无法操作画布的问题。
- **[v2.3.1](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.1)** — 修复第三方渠道插件「一键配置」兼容问题，新增单人物替换工作流等。
- **[v2.3.0](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.0)** — 社区插件改为按需安装，新增画布抽卡对比、视频智能擦除等。
- **[v2.2.5](https://github.com/canbaobaox/mindversetv/releases/tag/v2.2.5)** — 修复画布上传回退、缩略图与分镜生成问题。
- **[v2.2.4](https://github.com/canbaobaox/mindversetv/releases/tag/v2.2.4)** — 修复 Eagle 素材库预览，支持自定义渠道无 `/v1` 前缀地址。
- **[v2.2.3](https://github.com/canbaobaox/mindversetv/releases/tag/v2.2.3)** — 接入 Seedream 5.5 图片生成与图层拆分。
- **[v2.2.2](https://github.com/canbaobaox/mindversetv/releases/tag/v2.2.2)** — 上线实时余额与在线充值，完善费用预估。
- **[v2.2.1](https://github.com/canbaobaox/mindversetv/releases/tag/v2.2.1)** — 新增银盛云枢壹算渠道插件。

[查看全部版本与详细说明](https://github.com/canbaobaox/mindversetv/releases)

## 开源参考

MindVerseTV 的开发基于并参考了以下开源项目：

- **[影策 Open AI Canvas](https://github.com/ddcat-ai/open-ai-canvas)**：MindVerseTV 基于该项目二次开发，画布节点编排、模型渠道接入、任务与素材管理等基础能力来自该项目。
- **[basketikun 的 infinite-canvas](https://github.com/basketikun/infinite-canvas)**：无限画布架构参考，沿用了部分画布代码。
- **[Pi（Pi Agent）](https://github.com/earendil-works/pi)**：内置 Agent 的基础框架。

上游与第三方代码、版权声明及许可仍按各自条款保留，具体归属见 [`NOTICE`](NOTICE)、[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和 [`LICENSE`](LICENSE)。

## 联系作者

<p align="center">
  <img src="assets/readme/wechat-qrcode.jpg" width="200" alt="扫码加作者微信">
</p>
