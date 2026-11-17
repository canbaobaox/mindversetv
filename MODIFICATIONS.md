# MODIFICATIONS.md — MindVerseTV（MVTV）

> MindVerseTV 是 BeefTV 的修改版，不是官方发布，未获官方背书。
> MindVerseTV is a modified version of BeefTV, not an official release and not
> endorsed by the upstream authors.

## 上游 / Upstream

- 上游项目：[glanderness/BeefTV](https://github.com/glanderness/BeefTV)
- 基于版本：v2.2.5，commit `c52a2c43897a10f4179e27e5790ba5e904575012`
  （`chore(release): v2.2.5 - 版本号与更新说明 (#544)`，2026-11-14 发布）
- 上游技术栈：React + Go + Wails 桌面版，无限画布节点工作流，Agent + Skills，
  模型渠道由使用者自配。
- 本地工作目录：`~/workspace/mvtv/`（目标仓库名 `canbaobaox/mindversetv`，
  仓库尚未创建、本次改动未推送）。

## 产品改名 / Renaming

- 产品全名改为 **MindVerseTV**，简称 **MVTV**。界面、窗口标题、README 标题、
  关于页一律写 MindVerseTV，不只写 MVTV。
- 窗口标题（Wails `Title`）、安装包名、输出文件名、默认数据目录改为 MindVerseTV：
  `backend/cmd/desktop/wails.json`（name / outputfilename）、
  `backend/cmd/desktop/main.go`（Title）、
  `scripts/installers/windows.nsi`（安装目录、注册表、快捷方式、 exe 名）、
  `scripts/build-beeftv-windows-release.ps1` / `scripts/build-beeftv-release.sh` /
  `scripts/package-desktop-installer.py`（产物名）、
  `backend/internal/desktopstorage/location.go` 与 `backend/cmd/desktop/storage.go`
  （默认数据目录 `%AppData%\MindVerseTV`，原为 `%AppData%\BeefTV`）。
- README.md / README.en.md / QUICKSTART.md / docs/desktop-release.md 中的产品名
  改为 MindVerseTV，发布页链接指向 `canbaobaox/mindversetv`（仓库待创建）。

## 去官方化 / De-officialised

- 删除一键连接 BeefTV 官方账号的全部入口：
  删除 `web/src/components/beeftv-connection-actions.tsx`（原“连接 BeefTV”按钮组件）；
  渠道设置页不再渲染官方连接按钮，改为“官方算力连接已移除”提示；
  账户设置 → 账号与余额页的“登录 BeefTV”按钮已删除，改为文字说明；
  侧栏账户按钮不再显示“登录 BeefTV”。
- 模型配置只留自填渠道：默认 `channels: []`（上游默认即为空），添加渠道时
  首选“第三方模型服务（OpenAI 兼容 API）”，自填 Base URL + Key；
  Key 只存本地，不写入画布、素材或任务列表。
- 从“添加模型服务”预设中去掉赞助商商业渠道 ll2 与银盛·云枢壹算
  （`web/src/lib/model-service-presets.ts`）；ll2 / ysdui 的插件包文件仍在
  仓库内（可选插件，未默认启用），未删除。
- README 赞助商鸣谢表（含 ll2.cn 价格与推广链接、银盛·云枢壹算、腾讯云、
  BytePlus、超频三）已移除，改为一段历史致谢，不附价格与推广链接；
  侧栏的上游官网（beeftv.app）、X（@beefnoode）、微信二维码入口已删除；
  GitHub 入口改为 `canbaobaox/mindversetv`（待创建）。

## 有意保留、未改的东西 / Deliberately unchanged

- **LICENSE、NOTICE、THIRD_PARTY_NOTICES.md 原样保留，未动一个字。**
  上游许可仍为分范围许可：新原创内容适用 BeefTV Source Available License 1.0，
  历史 MIT 内容仍按 MIT。
- 内部标识未为改名而改：渠道 id / credentialRef `"beeftv"`、CLI 程序名
  `beeftv`、环境变量 `BEEFTV_*`、技能链接协议 `beeftv://`、
  插件包名 `beeftv-plugin-*`、`.beeftv-plugin` 归档后缀、API 字段与
  本地数据库字段。改这些会破坏旧工作区、测试与插件兼容。
- 上游致谢保留：README“开源参考”仍致谢 ddcat-ai/open-ai-canvas、
  basketikun/infinite-canvas 与 Pi（Pi Agent）。
- 历史更新日志（`app-changelog.zh.ts`）中 v2.2.0 及更早版本的“官方算力”
  记载作为历史保留，未改写历史。
- 测试夹具里的 `"private-key"` / `"official-private-key"` 等占位字符串
  不是真实密钥，未动。

## 许可与合规 / Licensing

- 本修改版仍按 BeefTV Source Available License 1.0（新原创内容）与
  历史 MIT 条款（历史内容）执行；LICENSE、NOTICE、THIRD_PARTY_NOTICES.md
  均原样保留。
- 允许：自用、内部二开、用 MindVerseTV 制作并销售视频等创作成果；
  免费分发须保留版权与许可声明、按同一 Part A 提供被覆盖部分、
  标明改动、与官方版本区分开、不冒充官方、不宣称官方背书。
- 不允许（需原作者书面授权，联系 lucas@bf-labs.cn）：改名转售、
  套壳销售、收费部署 / 定制交付、对外托管（免费或收费）。
- API 由使用者自己填，绝不使用作者本人的 Key；仓库内无任何真实密钥，
  无 myxsai 相关内容，无用户个人信息。

## 验证 / Verification（2026-11-17，本地）

- 前端依赖：`bun install --frozen-lockfile` 成功，906 个包（第一次有几个
  tarball 解压 EPERM，重跑一次后成功）。
- 类型检查：`bun run typecheck`（tsc --noEmit）通过。
- 前端桌面构建：`bun run build:desktop` 成功，23 秒，`web/dist/` 105M，
  `dist/index.html` 标题为 MindVerseTV；构建产物中可见
  “MindVerseTV 已移除官方算力连接”“MindVerseTV MCP”等新文案。
- 后端（Go）未构建：本机无 Go 工具链（QUICKSTART 要求 Go 1.25，
  `backend/go.mod` 实际要求 Go 1.26.0；Windows 构建还需本机 GCC）。
  未擅自安装重型工具链。
- 未创建 GitHub 仓库、未推送。

## 第二轮彻底改名（2026-11-17，同日追加）

- 品牌单一来源：`web/src/stores/use-appearance-store.ts` 的
  `brandName` / `seoTitle` / `seoDescription` / `footerCopyright` 改为
  MindVerseTV——侧栏品牌字、顶栏、页脚版权、画布导出文件名、
  “MindVerseTV 正在生成……”进度文案随之全部改名。
- 新 Logo（B 标换 M 标）：`assets/app-icon.png` 内容已换成黑底白字的 M
  （桌面应用图标，构建脚本直接拷贝此文件）；新建
  `web/public/mindversetv-logo.png`（白底黑字 M），favicon、加载屏、
  侧栏 logo 已改指新文件。旧 `web/public/beef-logo.png` 文件保留在仓库
  （测试引用），应用内已无引用。
- 其余可见文案：首次引导按钮、转写模型标签、配音试听句、任务核对状态、
  AI 剪辑助手系统提示、插件作者与安全提示、MCP 接入页、
  助手侧栏标题“MindVerseTV Agent”、CLI 帮助与报错、更新器与打包工具的
  产物名（MindVerseTV.exe / .app / -linux、更新包与增量包名）、
  安装文档（desktop-install / linux-install / 桌面本地开发）、
  CONTRIBUTING / 行为准则 / 安全策略中的产品名，全部改为 MindVerseTV。
- 应用内历史更新日志：涉及旧版官方算力的句子已去掉品牌词与失效链接，
  改写为“旧版官方算力 / 旧版官方账号”；v1.5.1 首版句改为“上游首个公开版本”。
  历史事实本身未改写。

### 有意保留的内部标识（用户看不见，改了会坏兼容）

| 标识 | 在哪里 | 为什么不能改 |
|---|---|---|
| 渠道 id / 凭据引用 `"beeftv"` | 前后端渠道配置、模型目录、数据库 `channels` 记录 | 旧工作区已保存的渠道靠它识别；改了旧画布读不到模型 |
| CLI 程序名 `beeftv`（`cli/beeftv(.exe)`） | 命令行工具、MCP 接入配置、外部 Agent 调用 | 外部工具（Claude Code / Codex）的配置里写死了这个名字；改了接入断开 |
| 环境变量 `BEEFTV_*`（`BEEFTV_DATA_DIR`、`BEEFTV_BASE_URL`、`BEEFTV_CLIENT_ID`、`BEEFTV_CLIENT_TOKEN`、`BEEFTV_CLIENT_TOKEN_FILE` 等） | 启动、数据目录、MCP 凭据 | 用户已有的启动脚本与环境配置依赖这些名字 |
| 技能链接协议 `beeftv://` | `beeftv://skills/install` 链接、Windows 注册表协议类 | 系统里已注册的协议与技能安装链接靠它打开应用 |
| Wails 协议 scheme `beeftv` | `wails.json` info.protocols、skill_links.go | 与上一条同一机制 |
| macOS Bundle ID `com.wails.beeftv` | `update-local-beeftv-app.sh` | 改了会让 macOS 认成另一个应用，已装用户的数据目录与更新通道断开 |
| 插件包名 `beeftv-plugin-*`、归档后缀 `.beeftv-plugin` | plugin-packages、更新器白名单 | 更新器只认这个后缀；改了插件装不上 |
| `brandSlug: "beeftv"` | appearance store | 内部标识段，UI 上不显示 |
| 数据库字段 `beef_usage_state` / `beef_billing_state` / `beef_reconcile_deadline` | 后端迁移 v27 | 已发布迁移只追加不改；改名要另写迁移 |
| API 路径 `/beeftv/connection*` | 后端路由 | 前端与外部调用方按此路径访问 |

### 还剩的可见 BeefTV 痕迹（故意留的）

- LICENSE / NOTICE / THIRD_PARTY_NOTICES.md 原文：许可与署名文件，法律底线，一个字未动。
- README 顶部上游说明与“贡献与许可”节的 “BeefTV Source Available License 1.0”：许可名称本身，不能改名。
- README 历史致谢段的上游赞助商名单：仅作历史致谢，无价格无链接。
- CONTRIBUTING.md 第 27 行 Part A 第 8 条：向官方 glanderness/BeefTV 仓库维护者的贡献授权，是许可条款原文的转述，不能改写。
- 应用内历史更新日志（v2.2.2 及更早）：上游发布历史原文；其中品牌词已中性化为“旧版官方算力”，但“官方算力 / 在线充值”等旧功能描述仍在，因为那是当时版本的真实记录。
- CHANGELOG.md：上游发布历史原文。
- docs/ 后端架构文档（http-api、code-map、backend-database、desktop-account 等）：描述上游服务端架构与已移除的官方算力；桌面产品内不展示这些文档，需另立文档重写任务。desktop-account.mdx 顶部已加“已移除”提示。
- `web/public/beef-logo.png` 与 `assets/readme/beeftv-*` 演示素材：旧品牌资产文件，应用内已无引用；测试仍引用 beef-logo.png 路径。
- 仓库根 AGENTS.md：上游协作者工作约定原文。
- SECURITY.md 里的漏洞报告邮箱 2667983673@qq.com：上游维护者联系方式，未改。

### 第二轮验证（2026-11-17，本地）

- `bun run typecheck`（tsc --noEmit）：通过。
- `bun run build:desktop`：成功，24.72 秒；`dist/index.html` 引用
  `mindversetv-logo.png` 3 处、0 处 `beef-logo.png`；构建产物含
  “MindVerseTV Agent”“MindVerseTV 已移除官方算力连接”等新文案。
- `node scripts/structure-budget.mjs`：结构预算通过（第一轮已跑）。
- 后端（Go）仍未构建：本机无 Go 工具链，未擅自安装。
- 未创建 GitHub 仓库、未推送。

## 2026-11-18 用户确认后补改

- Logo：按用户发的 MV 图原样使用，形状未改。桌面图标 `assets/app-icon.png` 为黑 MV 白底 1024x1024；界面用 `web/public/mindversetv-logo.png` 为白 MV 透明底 1024x1024（深色界面可见、加载屏遮罩可用）；原图存 `assets/mindversetv-logo-source.jpg`。
- 提示词板：不放进 MindVerseTV，画布单独做。
- 模型：全保留。`web/src/lib/model-service-presets.ts` 里被删掉的 ll2、银盛·云枢壹算两项预设已恢复；另有“第三方模型服务（OpenAI 兼容 API）”通用入口，聚合平台走它自填 Base URL + Key，仓库内不写任何平台地址与 Key。
- 节奏：保留原有工作流与功能，不急，慢慢优化迭代。
- 名字：确认用 mindversetv（产品全名 MindVerseTV）。
- 验证：`bun run typecheck` 通过；`bun run build:desktop` 成功（24.72 秒），dist 引用新 logo。

## 2026-11-18 用户确认后补改（2）

- ll2、银盛·云枢壹算两项模型服务预设已从“选择服务商”列表删除（`web/src/lib/model-service-presets.ts` 的 MODEL_SERVICE_PRESETS）；插件包文件与旧渠道兼容代码仍在仓库内，未删除，旧渠道不受影响。模型入口只留：第三方模型服务（OpenAI 兼容 API，聚合平台走它自填）、OpenAI、Google Gemini、火山方舟。
