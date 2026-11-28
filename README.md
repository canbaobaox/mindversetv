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

- **[v2.3.9](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.9)** — 深度捕捉下载失败时可手动下载：对话框与存储设置页给仓库发布页链接与放置路径，放好文件再点“继续下载”或“重新检查”直接校验；清单生成脚本加模型文件校验。
- **[v2.3.8](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.8)** — 合并上游 v2.5.0（创作助手 2.0、画布媒体工作流、应用内网络代理、新模型协议），画布工具栏三期（“＋”胶囊浮条、5 项提示词模板、主体与高清 1080P），提示词板镶顶栏＋缩小，A2 七项修复。
- **[v2.3.7](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.7)** — 新增 Muse 视频插件（经 muse2api 中继，视频走 JSON 提交，时长 5/6/8/10 秒、画幅 16:9/9:16），修复轮询 404 时报错文案显示整段 JSON。
- **[v2.3.6](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.6)** — 本地 AI 去字幕/去水印（接开源 VSR，自动检测并修复，首次使用需下载约 1.5GB 组件），深度动作捕捉自建签名清单（Windows 组件改从自有 Release 下载验签，CPU 档）。
- **[v2.3.5](https://github.com/canbaobaox/mindversetv/releases/tag/v2.3.5)** — 修复梦由心生生图仍失败（resolution 只发站方接受的 auto / 1K / 2K / 4K），生成面板无价格时显示“价格待确认”，超分门禁收紧，深度动作捕捉失败弹常驻弹窗不再静默。
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
- **[v2.5.0](https://github.com/glanderness/BeefTV/releases/tag/v2.5.0)** — 内置创作助手全面升级并改版侧栏界面，支持文档与扫描 PDF 读取、文件导出、创作设定集、对话分叉、多模型合并确认与外部 MCP 接入；新增项目素材自动保存本地、应用内网络代理、视频快捷裁剪及更多模型协议支持。
- **[v2.4.5](https://github.com/glanderness/BeefTV/releases/tag/v2.4.5)** — 内置创作助手更稳定、参考音频连线与本地直传，以及有声无画视频自动兼容播放。
- **[v2.4.4](https://github.com/glanderness/BeefTV/releases/tag/v2.4.4)** — 解决素材较多时启动卡顿，大视频上传提速并支持最高 2GB 文件保存，视频超分估价更快。
- **[v2.4.3](https://github.com/glanderness/BeefTV/releases/tag/v2.4.3)** — 局部重绘与表情/角度调整保留所选模型，画布右键新增直接复制图片和视频，修复旧版 macOS 启动问题。
- **[v2.4.2](https://github.com/glanderness/BeefTV/releases/tag/v2.4.2)** — 修复创作助手发起纯文生图整片方案后画布报错，以及画布名过长导致顶栏文字重叠的问题。

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
