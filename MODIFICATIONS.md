# MODIFICATIONS.md — MindVerseTV（MVTV）

> MindVerseTV 是 BeefTV 的修改版，不是官方发布，未获官方背书。
> MindVerseTV is a modified version of BeefTV, not an official release and not
> endorsed by the upstream authors.

## 上游 / Upstream

- 上游项目：[glanderness/BeefTV](https://github.com/glanderness/BeefTV)
- 基于版本：v2.3.2，commit `3e4eb1b8ca44f87d3aa49e3db930d6f4a8f15bcf`
  （2026-11-19 发布；2026-11-20 自 v2.2.5 `c52a2c4` 合并，见文末“合并上游 v2.3.2”）
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

## 2026-11-19 用户装机后补改（3）

用户装好 v2.2.5 安装包后逐屏点出四处残留，一并改掉：

- 首页卡片“Beef Agent”改名“MindVerseTV Agent”（`web/src/pages/home/home-data.ts`；内部 id 与跳转不变）。
- 技能市场筛选“BeefTV 市场”改名“MindVerseTV 市场”（`web/src/pages/skills/marketplace.tsx`；筛选值 `beeftv` 不变）。
- “我的投稿”功能整组去掉：技能页投稿 tab、入口菜单、投稿面板（`publishing-panel.tsx`、`publication-detail-content.tsx` 已删）、助手侧栏的投稿待确认卡片（`assistant-publication-entry.tsx` 已删）；后端投稿接口未动（无界面调用，留作死代码待清理）。
- LL2、银盛·云枢壹算两款插件移出安装包：`plugin-packages/bundled-plugin-dirs.txt` 只留市场插件；`backend/internal/plugins/package_fetch.go` 的 `BundledBuiltinPluginNames` 同步去掉两项；`Dockerfile` 不再拷两家客户端；`docs/desktop-release.md` 与 `docs/content/docs/plugins/plugin-system.mdx` 的随包清单同步。插件包源码仍在仓库内，可从插件中心在线安装；对应测试已同步（删 `TestBuiltinLL2PluginPreinstalledAndRegistersProviders`，`TestBundledPluginDirsManifestAndDesktopAgentHostResolution` 只验市场插件）。
- 内置渠道改成梦由心生AI 聚合站：预设 `backend/internal/providerpreset/catalog/beeftv.v1.json` 的显示名改“梦由心生AI”、地址改 `https://api.lk888.ai`（站方公开文档 https://myxsai.com/api 与 https://myxsai.com/apidoc 标注的 BASE_URL，OpenAI 兼容写法 `https://api.lk888.ai/v1`，后端请求时自动补 `/v1`）；`backend/internal/workspace/provider_state.go` 把旧地址 `https://beeftv.app` 的已存配置迁到新地址。只写公开地址，不写任何 Key；Key 由用户在编辑框里自填、只存本地。
- 内置渠道改走自填 Key：设置页标题与提示不再写“官方算力（已停用）”，改为渠道名与“请在编辑中填写 API Key（Key 只存本地），然后拉取模型”；编辑框里内置渠道也能填 API Key（原先只显示已断开的官方账号连接）；“拉取模型”在填好 Key 后可用（`web/src/services/api/image-models.ts`：有自填 Key 时不再走官方连接拉取目录，改走后端 `/ai/models` 中转；`channel-settings-pane.tsx` 的单条与批量拉取在无官方连接时直接用拉取结果，不再等服务端合并）；状态文案按自填渠道规则显示（未填 Key 显示“待配置”）。助手模型白名单（`backend/internal/modelcatalog/assistant.go`）只在托管凭证真实存在时生效，自填 Key 的渠道不受官方目录约束。
- 内部标识不动：渠道 id 仍为 `beeftv`、credentialRef 仍为 `beeftv`、协议 `beeftv://`、环境变量 `BEEFTV_*`、macOS bundle ID 等均保留，以保旧画布与旧配置兼容。
- 验证：`bun run typecheck` 与 `bun run build:desktop` 均已通过；后端 Go 未在本机编译（无 Go 工具链），GitHub Actions 构建验证通过（Windows 任务成功，安装包 2026-11-19 00:55 已上架 Release v2.2.5）。

## 2026-11-20 内置渠道自填 Key 拉取模型无反应

用户报：内置渠道“梦由心生AI”填完 API Key 后没有任何反应、不报错，拉取模型按钮点不动，画布用不了模型。根因是三处旧“官方托管凭证”逻辑互相咬合：

- 保存时 `web/src/services/model-config-repository.ts` 的 `omitManagedBeefTVSecrets` 把内置渠道的 apiKey/secretKey 一律清成 "" 再写后端，Key 永远存不到后端；后端快照因此 hasApiKey 恒 false，生成时 `LookupBeefTVCredential` 也读不到 Key。
- 拉取门禁 `web/src/stores/use-config-store.ts` 的 `channelHasManagedBeefTVCredential` 只认 credentialRef 或 hasApiKey，不看刚填进内存的 Key，所以填完 Key 按钮还是灰的。
- 重启后内存 Key 已清空、只有 hasApiKey 为真时，`fetchChannelModels` 会带空 Key 去撞 401（没带 channelId/credentialRef，后端无从查存的 Key）。

改了三处（只改前端，后端保存/回读/解析本来就是通的，不用动）：

- `model-config-repository.ts`：只有真正走官方托管凭证（credentialRef === "beeftv"）才清密钥；用户自填的 Key 原样保存。
- `use-config-store.ts`：`channelHasManagedBeefTVCredential` 改名 `channelHasBeefTVCredential`，托管凭证、已存密钥、刚填进内存的 Key 都算有凭证；`channelHasGenerationCredential` 改调它（原来就另认内存 Key，行为不变）。
- `web/src/services/api/image-models.ts`：重启后只有 hasApiKey 为真时，拉取改带 channelId/credentialRef 走 `/ai/models`，让后端 `ResolveChannelModelsRequest` 用存的 Key 查目录；刚填完有内存 Key 时仍直接带 Key。

验收链：填 Key → 按钮立刻能点（门禁认内存 Key）→ 点拉取带 Key 去 GET `https://api.lk888.ai/v1/models`（后端直通，不走托管连接）→ 保存后重启，后端仍有 Key、快照 hasApiKey 为真 → 重启后拉取带 channelId/credentialRef、后端用存的 Key 查目录 → 生成时后端 `LookupBeefTVCredential` 从存的配置里解析到 Key。

- 验证：`bun run typecheck`、`bun run build:desktop`、`bun run lint`、`node scripts/structure-budget.mjs` 均通过；新增 `web/test/builtin-channel-self-filled-key.test.ts`（门禁 + 持久化）与 `web/test/channel-model-catalog.test.ts` 的重启后存 Key 拉取测试，相关 8 个测试文件 89 个测试全过；后端 Go 本机编不了，由 CI 验。

- quality 修复记录（同日稍后）：上面这版推上 main 后 quality 运行 44702461201 挂了 Web checks (1/4)(2/4)(3/4)，12 个测试失败，症状是模型连接测试抛“请先填写 API Key”、模型列表为空、`beeftv-generation-readiness` 期望 true 实际 false。根因是本节改动里的一处重构失误：`channelHasGenerationCredential` 改调新 `channelHasBeefTVCredential` 时，丢了原来另认内存 Key 的 `|| Boolean(channel.apiKey?.trim())` 这一支；而 `channelHasBeefTVCredential` 对非内置渠道直接返回 false，于是所有带 Key 的普通渠道都被当成无凭证——`isAiConfigReady`、`testChannelModelConnection`、渠道状态文案/校验、`listVideoReferenceModels` 全跟着错。修法只补回这一支（`web/src/stores/use-config-store.ts` 一行，`channelHasBeefTVCredential(channel) || Boolean(channel.apiKey?.trim())`），没动门禁与拉取逻辑，07ef85f 的修复原样保留；本地复现的 5 个失败文件 60 个测试全过，4 个 shard 的共享测试全过（877/768/903/943），typecheck/build/lint/structure-budget 全过。

## 2026-11-20 注册按钮

用户要求在“本地模型渠道”页梦由心生AI 渠道名旁加一键注册按钮：

- 渠道名后加“去注册”按钮（`web/src/pages/settings/channel-settings-pane.tsx`，仅内置渠道显示），点开 https://myxsai.com/register（实测返回 200）。
- 2026-11-20 用户反馈 /register 打不开（站上注册走首页弹窗，无独立 /register 路由）：链接改为只打开 https://myxsai.com，桌面绑定 `OpenMyxsaiRegister` 与前端 href 两处同步改；本地验证 `bun run typecheck`、`bun run build:desktop`、`node scripts/structure-budget.mjs` 均通过。
- 桌面端走新 Wails 绑定 `OpenMyxsaiRegister`（`backend/cmd/desktop/app.go`，`wailsruntime.BrowserOpenURL` 打开系统浏览器）；网页预览无绑定时退回普通 `target="_blank"` 链接。绑定类型（`web/src/services/desktop-runtime.ts`）与绑定方法清单测试（`backend/cmd/desktop/app_test.go` 的 `TestDesktopAppBoundMethodsStayTiny`）同步更新。`OpenSkillMarketURL` 只放行 beeftv.app/skills 与回环地址，不能复用，故新加方法。
- 验证：`bun run typecheck` 与 `bun run build:desktop` 均已通过，产物含“去注册”与 myxsai.com/register；`node scripts/structure-budget.mjs` 通过；后端 Go 未在本机编译（无 Go 工具链），由 GitHub Actions 构建验证。

## 2026-11-20 合并上游 v2.3.2

分支 `merge/upstream-v2.3.2`：上游 v2.2.5（`c52a2c4`）→ v2.3.2（`3e4eb1b`，54 个提交，1216 个文件）。本地历史与上游无共同祖先，先把本地全部改版压成单提交再合，21 个文件起冲突，逐个解完；VERSION 已改为 v2.3.2。

- 新功能都进来了：画布视频智能擦除（去字幕增强、字幕提取翻译、去水印、隐私打码）、图片抽卡历史与看图工作台（历次结果叠放、双图对比、生成信息栏）、单人物替换工作流（画布工作流库内置，需 Seedance 2.0 Fast 参考视频）、画布流畅度提升与修复、Windows 内置助手命名管道读写修复（读超时归一化）。
- 四款社区插件（Eagle 素材库、AI 提示词优化器、AI 审美批改、媒体转换节点）按上游改为插件市场按需安装；另有 5 个插件包（character-replacement、comfyui、ecommerce-hero、runninghub、sticky-note）随上游外迁到 `Sunnyender-org/beeftv-plugins`，不再随包。
- 上游合作伙伴热接入一律不合进来，四道门：`MODEL_SERVICE_PRESETS` 只留通用与直连（第三方模型服务、OpenAI、Gemini、火山方舟）；`partnerServicePresets()` 与 `unnoticedLivePartners()` 恒返回空；`syncPartnerCatalogFromBackend()` 直接返回空列表，不拉目录、不装插件。LL2、银盛、Infistar 不进列表、不展示、不参与新建；已存旧渠道仍走内置预设数据兼容（`createServicePresetChannel` 对未上榜的内置预设仍按预设数据建渠道）。
- 剔掉的上游内容：合作伙伴分区与新合作方角标、Infistar 鸣谢（应用内更新日志与 `CHANGELOG.md` 的 v2.3.2/v2.3.1 条目已同步去掉 LL2 新模型与合作伙伴热更新、切换账号/退出登录文案）；`OpenPartnerKeysURL` 绑定已删（去注册按钮的 `OpenMyxsaiRegister` 保留）；上游 COS 桥接遗留文档整段删除；`BEEFTV_FFMPEG_RUNTIME` / `BEEFTV_FFMPEG_LICENSE` 编码器直供路径随上游移除（macOS 媒体运行时改为固定源码构建 + 哈希校验）。
- 保留的我们改版：梦由心生AI 内置渠道（预设与 `provider_state.go` 迁移逻辑）、去注册按钮、投稿已删、LL2/银盛插件已下架（`bundled-plugin-dirs.txt` 与 `BundledBuiltinPluginNames` 仍只含市场插件）、README 赞助商表已删、账户页无登录按钮、侧栏无微信/X 链接；编辑器壳作者按上游测试要求恢复为“开源社区”。
- 测试同步：`model-service-presets.test.ts`（列表断言改 presence/absence，动态合作方测试改为断言四道门）、`plugin-host-slots.test.ts`（热加载 ll2 只验预设数据、不验列表）、`catalog_test.go` 与 `provider_config_test.go`（预设身份断言改为梦由心生AI / `https://api.lk888.ai`，此前在 main 上即已失效，本次一并修好）、`channel-settings-pane.test.tsx`（删已删组件的死测试，未填 Key 的内置渠道状态期望由“未连接”改为“待配置”）。
- 验证：`bun install --frozen-lockfile`、`bun run typecheck`、`bun run build:desktop`（23.78 秒）通过；`node scripts/structure-budget.mjs` 通过；`./scripts/audit-public-docs.sh` 通过；`bun run lint` 通过；相关 7 个前端测试文件 89 个测试全过；`node scripts/deadcode-budget.mjs` 本机跑不了（无 Go 工具链），由 CI 验；后端 Go 编译同样靠 CI。

## 2026-11-21 插件替换：删三家接口插件，换成梦由心生插件

用户要求：插件页三个接口插件（无限星河 AI、LL2、银盛）删掉，换成梦由心生插件（同形态：接口地址 api.lk888.ai、API Key、预置模型带文本/图片/视频分类、一键保存并同步到模型服务）；账号与余额联动梦由心生。

### 删三家

- 删源码包 `plugin-packages/beeftv-plugin-ll2/`、`plugin-packages/beeftv-plugin-ysdui/` 整个目录；`plugin-packages/beeftv-plugin-market/registry.json` 的 builtins 里 ll2、ysdui 两项删除。Infistar 本来就不在仓库里（上游远端注册表自动下载），删无可删。
- 堵远端回流：`backend/internal/plugins/partners.go` 的 `InstallMissingLiveBuiltins` 加屏蔽名单（ll2 / ysdui / infistar 三个 plugin id，Infistar 的准确 id `beeftv-plugin-infistar` 已从远端 registry.json 取回确认）；`RunOfficialUpdates` 本身不停（只拦这三家，以后官方新插件仍能进）。
- 已装到用户电脑上的三家：新版启动时调一次 `Uninstall` 卸掉（`backend/internal/plugins/management.go` 的 `Uninstall`）。
- 已存 ll2/ysdui 渠道不硬删数据：复用 `RETIRED_DYNAMIC_PRESETS` / `STATIC_RETIRED_PRESETS` 机制，只留最小身份数据（名字、地址、协议前缀）供旧渠道编辑与迁移；新列表里不再出现；旧渠道的模型会变灰（协议提供方已不存在）。
- 删前端静态导入与数据：`web/src/lib/builtin-service-presets.ts`（两家 import、`BUILTIN_PRESETS` 两项、`STATIC_SHIPPED_PLUGIN_PRESET` 映射）、`web/src/lib/model-service-presets.ts`（LL2/YSDUI import 与 `ll2ProtocolsAvailable` / `ysduiProtocolsAvailable`）；`model-logo.tsx` 图标分支、`app-changelog.zh.ts` 三家文案、`assets/readme/partner-{infistar,ll2,ysdui}.png` 一并删除。
- 测试同步改：后端 `ysdui_manifest_test.go`、`bundled_builtin_test_helper_test.go` 删除，`partners_test.go`、`package_updates_test.go`、`builtin_hotupdate_test.go`、`catalog_test.go`、`protocol_media_upload_test.go`（3 个 YSDUI 专属测试删除，只留纯函数 URL 路由测试）等同步更新；前端 `model-service-presets.test.ts`、`plugin-host-channels.test.ts`、`plugin-host-slots.test.ts`、`model-connection-test.test.ts` 同步更新。

### 新插件 `beeftv-plugin-myxsai`

- 新包 `plugin-packages/beeftv-plugin-myxsai/`（`package.json`、`client/index.js`、`client/presets.js`、`README.md`、`docs/interface.md`），照抄 ll2/ysdui 三件套：plugin id `beeftv-plugin-myxsai`、presetId `myxsai`、channel id `myxsai`、显示名“梦由心生AI”；permissions 照抄 ll2；`configuration.fields`（apiKey secret 必填、baseUrl 默认 `https://api.lk888.ai`）；设置面板照抄 ll2 结构（介绍、Base URL 框、API Key 框、“验证在线目录”、预置模型多选带文本/图片/视频/音频标签、底部“一键保存并同步到模型服务”，经 `buildMyxsaiModelChannel` + `host.channels.upsert` 写渠道）。
- 预置模型只放 20 条代表模型（文本 6、图片 6、视频 8、音频 0），代表 ID：聊天 `doubao-seed-2-1-pro-260628`、`kimi-k3`、`deepseek-v4-pro`；生图 `doubao-seedream-5-5-261028`、`banana-pro`、`qwen-image`；生视频 `doubao-seedance-2-5-260628`、`kling-v4-video`、`hailuo-h3`。不手写 144 条：首次加载时按 type 拉取并缓存（站上接口 `GET /v1/media/models?type=image|video|chat` 与 `GET /v1/skills/models?type=video` 已证实路由存在）。
- 媒体协议（生图/生视频核心）：provider `myxsai-media`，create `POST /v1/media/generate`（flat body：model/prompt/images/aspect_ratio/resolution/duration，不包 `params`），poll `GET /v1/media/status?task_id={{taskId}}`（task_id 必须写进 path 查询串，`query` 字段会被原样发送，不可用），response 用 `$coalesce` 宽映射提 taskId/status/结果地址；文本走宿主通用 `chat-completion`（`POST /v1/chat/completions`），不声明。图片主走媒体协议，`openai-image`（`POST /v1/images/generations`）只作备选——站方明确不提供 OpenAI 视频格式端点，内置渠道原来的视频路径（`newapi-channel-2` → `POST /v1/video/generations`）是死路，生视频只能走新插件的媒体协议。
- candidates 与原方案有一处偏差（已核对代码，改法正确）：`BUILTIN_SERVICE_PRESET.candidates = {text: "chat-completion", image: "myxsai-media", video: "myxsai-media"}`（原方案写 image 用 `openai-image`、没写 video）。`candidates` 只对拉取回来的非预置模型生效；不这样改，拉回的图片/视频模型会被指到不存在的 `POST /v1/images/generations`。音频无 fallback（无已验证的音频协议，拉回的音频模型只列出、不自动勾选）。
- 前端接入：`builtin-service-presets.ts` 加 `BUILTIN_PRESETS["myxsai"]`（import 新包 `client/index.js`）+ `STATIC_SHIPPED_PLUGIN_PRESET` 映射；`model-service-presets.ts` 里 myxsai 排在 `MODEL_SERVICE_PRESETS` 与 `standardServicePresets()` 两处的第一位（服务选择器渲染的是后者，不加就看不到）；`presetKeysUrl("myxsai")` 为 `https://myxsai.com`，服务编辑器里显示注册链接。
- 插件进安装包：`plugin-packages/bundled-plugin-dirs.txt` 加 `beeftv-plugin-myxsai`（随安装包以源码目录形式带走，不打包成 `.beeftv-plugin`——应用插件与 68 个协议包不同，`build-packages.sh` 只打包含 `manifest.json` 的协议包，市场插件同样无包）。

### 内置渠道迁移合并

- 已存 `beeftv` 渠道迁移成 `myxsai` 渠道（id 改 myxsai，apiKey/models/modelProfiles 原样搬，默认模型引用里的 `beeftv::` / `beefapi::` 前缀改 `myxsai::`），然后删 `beeftv.v1.json`，改由 `myxsai.v1.json` 预设（`pinned: false`——插件 upsert 拒绝覆盖 pinned 渠道，pinned 会断掉面板的一键保存；`legacyIds: ["beefapi"]`，不含 `beeftv`，`beeftv` 由写迁移处理）+ `provider_state.go` 里 `preset.ID == "beeftv"` 的迁移分支删除。
- 迁移是**写迁移**，不是只读改名：只读改名会在两处丢 Key——`RedactConfig` 只对 id `beeftv` 脱敏，放任改名会把 myxsai 渠道的明文 Key 泄漏进 GET 响应；`PreserveManagedChannel` 只对 id `beeftv` 保 Key，第一次前端保存就会把 myxsai 的 Key 清空。所以迁移挂在 `decodeStoredDocument`（读盘/保存/审计都走它），改名后原地保留列表位置、补 `ownerPluginId: "beeftv-plugin-myxsai"`（否则插件面板认不出这是自己的渠道）、删 `credentialRef`/`legacyIds`、去 pinned；已存在 myxsai 渠道时旧 Key/模型只补空缺，旧渠道删除；幂等。
- 插件不能直接写 `beeftv` 渠道（命名空间守卫），宿主守卫没动。myxsai 渠道按普通插件渠道走（Design B）：Key 经服务端响应进前端内存、生成与拉取都带内存 Key；`RedactConfig` / `PreserveManagedChannel` 不扩展到 myxsai；面板 Key 框首次需用户粘贴一次，之后从插件 IndexedDB 预填。
- 几个实现细节（都是读代码后定的）：
  - `mergeManagedBeefTVCatalog` 改认 id `myxsai`，服务端给的 apiKey 不再清空（Design B），`credentialRef`/`legacyIds` 从服务端原样抄；本地 pinned 的旧 `beeftv` 渠道在服务端不再列出时按原逻辑删除，迁移后的 myxsai 是 unpinned，不会误删。函数名保留（仓库有意保留 `beeftv` 内部标识）。
  - `overlayHostedBeefTVMediaProfiles` 不再覆盖插件声明的协议：协议前缀为 `ll2-` / `ysdui-` / `myxsai-` 的 profile 一律跳过，否则 `seedance-2.5-guanfang` 会被改写成 `newapi`、`wan3.0` 被改写成 `newapi-channel-2`（两个都是 lk888 上的死路）；非插件协议的陈旧 profile 仍按原逻辑修复（`hy-image-v3` 等）。
  - `applyCatalog` 按 `findManagedChannel`（myxsai 优先、旧 beeftv 兜底）找目标渠道；目标是 myxsai 时不清空 apiKey、不写 credentialRef（清空会丢用户 Key，写 credentialRef 会挡住插件 upsert）。`clearBeefTVModels` 故意只认 ChannelID（迁移后成空操作，绝不能清掉插件所有的 myxsai 模型）。
  - `IsManagedChannel` 认 `myxsai`（channelID 或 credentialRef）；`LookupBeefTVCredential` 先查 myxsai 再兜底 beeftv（未迁移文档/旧客户端任务），无 baseUrl 时 myxsai 默认 `https://api.lk888.ai`。解析出的 myxsai 任务配置仍带 `credentialRef: "beeftv"`（外观错、功能上无害，且 `style_config_cancellation.go` 的能力过滤依赖它，别“顺手”改掉）。
  - `isBuiltinBeefTVChannel` 不动（旧判定，迁移后恒 false）；新增 `isMyxsaiChannel`（id === "myxsai"），超分节点、字幕擦除弹窗、首次创建引导、超分批量提交两处门（`use-canvas-upscale-batch.ts:128,239`，审查时补发现——初版漏了这两处，超分确认测试挂掉才暴露）改用它；助手模型仍用旧判定（myxsai 的文本模型不受 `MANAGED_ASSISTANT_MODELS` 限制，否则用户只拉 doubao/kimi 时助手可选模型会为空）。
  - `subtitle_erase.go` 校验接受 `myxsai`；`canvasworkflow/legacy_channel.go` 的 `UnmarshalJSON` 把 `beefapi::` / `beeftv::` 引用与 channelId 都归一到 `myxsai`（已存画布不丢引用）；`editor.go` 的官方算力通道选项改指 myxsai；超分/擦除任务的 `Provider: "beeftv"` 分发键有意保留（凭证解析已通用化）。
  - `PreserveManagedChannel` 的防伪造引用保护（forged-quote）不适用于插件所有的 myxsai 渠道——它与普通渠道一样 last-write-wins，这一点写进测试注释，不再假装它受保护。

### 账号与余额联动梦由心生

- 余额：后端新接口 `GET /api/account/myxsai-balance`（`backend/internal/handler/myxsai_account.go` + `backend/internal/generation/myxsai_account.go`，实现放在 generation 包——`internal/app` 行数门禁只降不升，新文件放 app 里会挂 `structure-budget`），用已存的梦由心生渠道 Key 在服务端调 `GET https://api.lk888.ai/v1/skills/balance`，只把余额数字回给前端；Key 绝不下发到浏览器。返回字段未验证，按站点其他接口的常见形状做宽容解析（`balance` / `data.balance` / `data.available_balance` / `data.available` / `data.credits` / `credits` / `available` / `data.balance_amount`，数字/数字串都认），认不出时报明确的“格式无法识别”而不是瞎猜一个数。
- 充值：应用内不收钱。原来整套 BeefTV 充值 UI（金额档、微信/支付宝/国际卡、订单 reconcile 轮询、待确认订单）全部删除；新面板只留“去充值”按钮（后端新绑定 `OpenMyxsaiRecharge`，照抄 `OpenMyxsaiRegister`，开系统浏览器到 `https://myxsai.com`——充值页准确路径未验证，先用首页占位并注明；无桌面绑定时退回普通外链）；“余额与用量”按钮同理改成开梦由心生官网。未连接梦由心生（没填 Key）时余额显示“—”，充值区只留“去充值”按钮。
- 面板保留了一处官方连接的残留处理：陈旧的待确认连接（pending/connecting）仍可取消（“取消本次登录”按钮 + 连接状态行），否则用户会被卡在一个无法清除的状态；这也是 `account-sidebar.browser.test.ts` 里“陈旧后台轮询不能覆盖取消结果”测试的触发入口。`余额与用量` 按钮在新面板是外链 `<a>`，不再是可禁用的 `<button>`，相关测试定位已改成 link。
- `GET /account/myxsai-balance` 的 handler 测试曾用真服务 + 假上游写不出结果：预设合并会把 myxsai 渠道的 baseUrl 强制改回 lk888（`presetChannelMap` 只认预设的 baseUrl，本地 baseUrl 被丢弃——这是预设的既有行为，生产上 lk888 本来就是正确地址，不改）。测试改用桩服务直供配置字节（绕过预设合并），上游调用本身由 generation 层测试覆盖。

### 仍需用户真 Key 实测（没 Key 验证不了，文档里已标明）

- 媒体协议轮询完成判定：`is_final` / `state` 的实际取值，以及引擎能否识别（`normalizeStatus` 只认 succeeded/success/completed/done，`ManifestResponse` 没有能吃 `is_final` 的字段）；成功结果地址字段名（`$coalesce` 目前是宽映射，拿到真任务后收紧）。
- `/v1/skills/balance` 返回字段（解析是宽容的，但字段名没对过真返回）。
- `/v1/images/generations` 请求体兼容性（只证实路由存在，没调通过）。
- 充值/用量页准确 URL（目前占位 `https://myxsai.com`）。
- 音频 6 个模型 ID（未记录，插件预置里音频为 0）。
- `GET /v1/media/models?type=...` 与 `GET /v1/skills/models?type=video` 的返回结构（插件按 type 拉取的解析是防御性的，拿不到数据时静默回空列表）。

### 审核中发现并修掉的问题

- `effective_video_contract_test.go` 在实现期曾被改坏：`requireEffectiveChannel(t, stored.Config, ...)` 类型不对（`stored.Config` 是 `map[string]any`，函数要 `EffectiveModelConfig`），包编译不过；且“规范快照仍带旧渠道”的断言用 `decodeStoredDocument` 读——它会在内存里迁移，断言恒假。修法：包一层 `EffectiveModelConfig{Config: stored.Config}`；快照断言改走手动解密（`localcrypto.Decrypt` + `decodeProviderDocument`），才真正读到未迁移的快照。
- `use-canvas-upscale-batch.ts:128,239` 的官方渠道门初版漏改（只查了 4 处调用点，实际有 5 处），超分确认浏览器测试挂掉才暴露；已补改并说明其余 `isBuiltinBeefTVChannel` 调用点为何保留（助手模型限制、渠道设置页的旧企业连接 UI、请求地址显隐、默认模型网格标签、store 内部凭证逻辑）。
- 浏览器测试 `account-sidebar.browser.test.ts`：3 个旧充值流程测试（余额/CNY-USD 切换/对账、topup 失败重试、慢 topup 覆盖）与 1 个旧已连接账号测试删除，mock 里的 topup 三路与相关变量一并删除；测试 289 的余额页断言改成新文案；新增 myxsai 余额测试（mock 提供带 Key 的 myxsai 渠道 + `/account/myxsai-balance`，connected 状态触发 provider 的目录同步才是唯一能把 served 配置载入 store 的路径，disconnected 初始态不拉配置——这是调试时发现的）。
- 旧 `"beeftv::"` 模型引用解析不到（agentops 提议 + storyboard 准备全挂 `generation_model_unavailable`）：根因是 myxsai 预设的 `legacyIds` 只有 `["beefapi"]`，`findEnabledAssistantChannel` 不认旧 id。修法：预设 `legacyIds` 改成 `["beefapi","beeftv"]`（解析层、前后端 `channelForId`、`UnmarshalJSON` 都走它），同时 `withoutLegacyOfficialChannel` 排除当前 managed id `ChannelID`——否则 `PreserveManagedChannel` 会把正在保存的 beefTV 渠道丢掉（`TestPreserveManagedChannelKeepsServerInventoryAndManualProviders` 的 incoming 渠道带 `enabled: false`）。受影响的测试期望同步改成 `myxsai::`（agentops 5 处 `payload["modelKey"]`、modelcatalog `assistant_effective_config_test.go` 2 处、beefTV `assistant_default_test.go` 常量 + 14 处保存/期望、`legacy_channel_test.go` 的 legacyIds 期望改成 `["beefapi","beeftv"]`）；输入固件保持旧 `"beeftv::"`（模拟迁移前的数据，迁移 + legacyIds 本来就该接住它们）。
- myxsai 渠道的视频任务走不进托管凭证解析（`internal/app` 的 `TestAssistantManagedVideoRestoresCapabilitiesBeforeEnvelope` 驱动发现，生产代码的遗漏）：`assistantGenerationConfig` 只在渠道 id 为旧 `"beeftv"` 时才写 `config["channelId"]`，myxsai 渠道的任务因此没标记，`ResolveManagedBeefTVSecrets` 不认、能力版本也不恢复。修法：`assistant_production_config.go:42` 的标记条件加上 `MyxsaiChannelID`；`cancellation_and_submission.go:453` 的解析后清理同步加上 myxsai（与旧 id 对称，任务入信封后 channelId 要删掉，否则执行器会把系统渠道 id 当未解析配置报错）。`assistant_production_video_capability_test.go` 的固件渠道 id 改成 myxsai（它测的是能力冻结，不是旧 id 解析）；`TestAssistantGenerationModelStripsChannelPrefix` 只改期望（输入保持旧键，迁移会改写）。
- 插件包测试曾编译不过：删除阶段误删了通用 helper `buildTarballBytesForTest`（`package_updates_test.go:533` 的旧定义，ll2 热更新测试以外的地方也在用），已原样恢复；`TestBundledPluginDirsManifestAndDesktopAgentHostResolution` 的期望清单加 myxsai。另发现一个集成缺口：发布脚本按 `bundled-plugin-dirs.txt` 拷目录，但后端运行时只认硬编码的 `BundledBuiltinPluginNames`（`package_fetch.go:817`，注释写明是“单一事实源”），只改清单文件新插件装不到用户电脑上——已把 myxsai 加进硬编码清单，并给注释加了“与清单文件保持同步”的提醒。
- 已证实 pre-existing、与本次改动无关的失败：`assistantruntime` 的 `TestNodeHostProxyRoutesHTTPAndHTTPSWithoutLeakingLoopbackTokens/HTTP-only_proxy_does_not_capture_HTTPS_model`（`eee15af` 基线 worktree 上同样失败：`buildEnv` 显式设 `NODE_USE_ENV_PROXY=1`，Node 的 undici 会用 HTTP_PROXY 兜底 HTTPS；本包代码一行没动）；`generation` 的 2 个 UDP DNS 测试（基线复现）；`assistant-outputs.browser.test.ts` 下载文件名断言（基线复现）。`plugins` 的 symlink 权限测试在当前 shell 的 umask 0007 下失败，umask 0022 后通过（2026-11-20 已记的已知环境问题）。`outbound` 的 `TestManagedPublicHTTPSBlocksDNSRebindingAtDirectDial` 也是同类环境失败：它用自建假 UDP DNS 服务器（`public_https_test.go:100` 起 `net.ListenPacket("udp", ...)`），沙箱禁 UDP，报错“外部服务域名解析失败”；旧全量日志里已有同一失败，`internal/outbound` 代码一行没动。
- 后端全量（`-timeout 30m`）跑出的最后 6 个 app 测试失败与 2 个 handler 测试失败，逐个修掉（全量日志 `/tmp/gotest-full2.log`，以下均为该日志里的失败）：
  - `TestAgentModelCatalogDesktopUsesActualSnapshotWithoutCredentials`：断言渠道 id `beeftv`，迁移后是 `myxsai`，改断言（固件保持旧 id）。
  - `TestAgentModelCatalogKeepsUnlimitedPromptImageModelsPriced`：估价入参 `beeftv::gpt-image-2` 改 `myxsai::gpt-image-2` 后仍报“自带 Key 的渠道暂无价格”——生产缺口：`PublicPrices`（`modelcatalog/local_snapshot.go:178`）只在 `item.ChannelID == managedChannelID`（常量 `"beeftv"`，`admission.go:12`）时才填定价表，myxsai 渠道的模型永远拿不到价格。修法：`admission.go` 加 `currentManagedChannelID = "myxsai"` 常量 + `isManagedChannelID` helper（认新旧两个 id；本包不能 import beefTV，因为 beefTV 反过来 import modelcatalog，会循环），`local_snapshot.go:178` 与 `TaskInputUsesCustomChannel`（`admission.go:271`）都改用它。`estimateTarget`（`operations/generation_estimate.go:81`）的无价文案同步：myxsai 无价时报“这个模型暂无价格”，不再报自带 Key 的文案。已知限制（不改）：`findEstimateModel` 只精确匹配渠道 id，`PublicChannelCatalog` 没有 LegacyIDs 字段，所以估价路径不认旧 `"beeftv::"` 键；估价入参本来就来自当前目录，生产上够用。
  - `TestAgentModelCatalogCapabilityDeclaredMatchesWebSourceRules`：期望键 `beeftv::empty-oprefs` 等改成 `myxsai::`（固件渠道 id 保持 `"beeftv"`）。
  - `TestPortraitQuoteManagedAdmission`：生产缺口：`ValidatePortraitTaskQuote`（`generation/cancellation_and_submission.go`）里 `managed`（credentialRef 为 beefTV）时循环只接受 `channel.ID == beeftv.ChannelID`，迁移后的 myxsai 渠道被全部跳过，`matches=0` → “报价不可用”。修法：循环的托管门与 `lookupCred` 分支都加上 `MyxsaiChannelID`。测试的 `savePortraitTestCatalog` 托管待遇条件同步加 myxsai，改用 `MyxsaiChannelID` 存目录、channelId 也用 myxsai（credentialRef 仍为 `"beeftv"`）。
  - `TestPluginViewIncludesDocumentationForEveryOfficialProtocol`：视图 70、期望 69——把 myxsai 加进运行时 `BundledBuiltinPluginNames` 后视图多了 1 个，期望的 bundled 列表加 `"beeftv-plugin-myxsai"`。
  - `TestYsduiPluginCreateRejectionWithTraceRequestIDKeepsRegenerateAllowed`（`seedream_plugin_execution_test.go:100`）：ysdui-image 已删。改指内置 `volcengine-ark-image`（同文件前两个测试已在用，同样走 `/v1/images/generations` 的 Seedream 映射），测试改名 `TestArkImageCreateRejectionWithTraceRequestIDKeepsRegenerateAllowed`、任务 ID 前缀改 `ark-reject-`。其中 http-200-payload-rejection 子用例随 ysdui 一起删掉（ysdui 专属错误信封：它把业务错以 HTTP 200 + 顶层 code/message/request_id 返回，ark 不把这种 200 当拒绝——该子用例下 ark 报 `submission_unknown`“声明式协议已完成但没有返回结果”；http-400 用例已过，仍覆盖本测试要保的行为：创建拒绝→记录带来源的失败诊断 + 允许重生成）。
- handler 两个模型配置测试（全量日志里的失败）：
  - `TestWorkspaceModelConfigReturnsBuiltinBeefTVAndPersistenceMetadata`：期望内置渠道 id `beeftv`，改成 `myxsai` 并改名 `TestWorkspaceModelConfigReturnsBuiltinMyxsaiAndPersistenceMetadata`。
  - `TestWorkspaceModelConfigGETRedactsBeefTVKey`：前提已变——Design B 下 myxsai 是普通插件渠道，Key 本就回给前端（前端要进内存调模型），旧“托管 Key 永不下发”的脱敏断言不再成立。测试改写成 `TestWorkspaceModelConfigGETReturnsMyxsaiKey`：PUT myxsai 渠道带 Key，GET 断言 Key 完整往返；`putModelConfig` 的渠道 id 改成 myxsai（三个共用它的测试一起过）。
- Seedance 2.5 归一化随 ll2 一起丢了（审查时发现的生产缺口）：manifest 适配器对每个协议都调 `applyManifestTaskOptions`，但 `NormalizeSeedanceTaskOptions`（首尾帧时把 AspectRatio 锁成 `adaptive`、inpaint 等把 duration 置 -1）只对 `isSeedanceConstraintPluginID` 列表里的协议生效；`ApplySeedanceBodyFields` 又读归一化后的 AspectRatio 才改写 body 的比例字段。myxsai-media 不在列表里时，Seedance 2.5 首尾帧视频的 body 会带一个非 adaptive 的比例。修法：`protocol/seedance_constraints.go` 的列表里把已删的 `ll2-seedance-video` 换成 `myxsai-media`（只影响 Seedance 2.5 带参考素材的情形，其余走通用归一化，不变）；`internal/protocol` 测试通过。

### 验证

- 前端 4 个 CI 分片：分片 1（880）、分片 2（768）、分片 3（9 个浏览器测试）、分片 4（943）——重跑后剩余失败全部是负载抖动（浏览器测试在 1.5 核机器上满载超时，每次挂的文件都不同，单独跑全过：`settings-model-picker` 30/30、`assistant-input` 11/11、`gpt-image-settings` 1/1、`icon-button-styles` 9/9、`creation-reference-file-card` 1/1）与 1 个已证实 pre-existing 的失败（`assistant-outputs.browser.test.ts` 下载文件名断言，`eee15af` 原始提交上 worktree 复现完全相同：期望 `成片2.mp4`、实际 `download`，与本次改动无关）；`canvas-archive-sqlite-restore` 需 Go 在 PATH（CI 自带，本地 `~/go1.26/go/bin` 不在默认 PATH，补上后 3/3 通过）。
- `bun run typecheck`、`bun run lint`、`bun run build:desktop` 通过（仅已知的大 chunk 警告）；`node scripts/structure-budget.mjs` 通过；`node scripts/deadcode-budget.mjs` 通过（521 项，基线 524 项，下降 3 项）。
- 后端：`providerpreset`、`workspace`、`beeftv`、`canvasworkflow`、`cmd/desktop`、`generation`、`handler`（含新余额接口）、`agentops`（提议 + storyboard）、`modelcatalog`、`app`（助手默认/视频能力/前缀）测试通过；`generation` 仅剩 2 个沙箱 UDP 屏蔽导致的 DNS 测试失败（`eee15af` 原始提交上 worktree 复现完全相同，与本次改动无关）；`assistantruntime` 仅剩 1 个代理子测试失败（基线复现，见上）；`outbound` 仅剩 1 个假 UDP DNS 测试失败（见上，同类环境问题）。`plugins` 全量在 umask 0022 下通过（`gotest-full2.log`：`ok internal/plugins 310.141s`）。`internal/app` 的全量在 `-timeout 30m` 下仍超时（1800.728 秒，超时瞬间只跑了 5 秒的单个测试，是累计超时不是挂起；此前两轮同样超时，本机 1.5 核跑不完 app 包，CI 才跑得完），以单个测试结果为准：该次全量里 6 个单个失败（`TestAgentModelCatalog*` 3 个、`TestPortraitQuoteManagedAdmission`、`TestPluginViewIncludesDocumentationForEveryOfficialProtocol`、ysdui 创建拒绝测试）已逐个修掉并重跑通过；`internal/handler` 全量里的 2 个模型配置测试失败（`TestWorkspaceModelConfigReturnsBuiltinBeefTVAndPersistenceMetadata`、`TestWorkspaceModelConfigGETRedactsBeefTVKey`）也已修掉并重跑通过（`TestWorkspaceModelConfig*` 全过）。`modelcatalog` / `operations` / `generation` 在生产代码改动（`isManagedChannelID`、`ValidatePortraitTaskQuote`、`estimateTarget`）后正在重跑回归，待补最终结果。
- 新增/改动的测试：后端 `effective_myxsai_contract_test.go`（overlay 不覆盖插件协议）、`origin_test.go`（`IsManagedChannel` 认 myxsai）、`managed_credential_test.go`（`LookupBeefTVCredential` myxsai 优先 + beefTV 兜底）、`subtitle_erase_test.go`（擦除接受 myxsai）、`myxsai_account_test.go`（generation 层解析 + 上游调用；handler 层路由 + 信封 + 无 Key 失败）；前端 `model-service-presets.test.ts`（myxsai 预设第一位、候选协议回落、`isMyxsaiChannel`）、`channel-settings-pane.test.tsx`（merge 改认 myxsai + Key 进内存）、`seedance-catalog-capabilities.test.ts`、`workspace-model-config-persistence.test.ts`、`canvas-node-toolbar.test.ts`（擦除 channelId 改 myxsai）、`upscale-confirmation.browser.test.ts`（harness 渠道改 myxsai + 任务 channelId 断言）、`account-sidebar.browser.test.ts`（见上）。

## 2026-11-22 v2.3.4：修梦由心生生图失败，加全选与单模型费用显示

用户真机反馈：v2.3.2 插件替换版生图用不了，图片节点报“无法确认上次是否已扣费，可先到模型服务后台查看使用记录 / 重新生成可能会再扣一次，确认后创建新任务”；另要求选择模型加全选、每个模型显示费用。v2.3.3 只升了版本号，不再发版，本次直接发 v2.3.4。

### 生图失败根因（已定位并修复）

- 截图文案是 `web/src/lib/task-outcome.ts:501` 的 `failed + regenerate==="confirm" + reason==="result_unrecoverable"`。后端 `backend/internal/task/outcome.go:44,69`：任务状态已是 `Succeeded` 但结果物化 `FailedPermanent`，或恢复结论为 `unrecoverable`，就出这个原因——即任务提交成功、结果取不回。
- 直接原因在 `plugin-packages/beeftv-plugin-myxsai/package.json` 的 `myxsai-media` provider 声明：`response.images` / `videos` 的 `$coalesce` 列表里根本没有 `result_url` / `result_urls`——而站方两个公开客户端（`lingkeai/ComfyUI-LingKe` 的 `lingke_client.py`、`wenyinos/ai-image-generator` 的 `lib/utils.js`）证实，成功结果地址只在顶层这两个字段里。任务成功后引擎提不到任何媒体 → 成功无结果 → 物化失败 → `result_unrecoverable`，与用户截图完全一致。
- 同批修掉的三个关联缺陷（同一 provider 声明内）：
  1. 完成判定只认 `state`、不认 `is_final`：站方成功当且仅当 `is_final=true` 且 `state=success/succeeded`（另一客户端明确把 `state=success` 但 `is_final≠true` 的情况降级为进行中）。现 `response.status` 用 `$if` 以 `is_final` 为准：非终态一律 `processing`（不用 `pending`：`parse()` 会把 pending + 有媒体的结果提前升成 succeeded，processing 不会升，终态门才不会漏）；`is_final` 缺失时沿用旧行为（只读 state）。
  2. `code` 在 `errorPaths` 里且没有 `successCodes`：轮询/创建响应若带 `"code": 200`，`manifestError` 会按“数字 200 是失败值”的规则强制判失败。现加 `successCodes: [0, 200, "0", "200"]`（与 LingKe 的判定一致：0/200 为成功）。
  3. 提交体可选参数平铺在顶层：站方两个公开客户端的提交体都是 `{model, prompt, params}`，`aspect_ratio` / `images` 等是 `params` 的成员；平铺会被站方忽略（画幅、时长、参考图不生效）。现包进 `params`；另 `duration` 为 0 时不发（`$omitEmpty` 对数字 0 不生效，改用 `$if` + `$gt` 守卫）。
- 轮询地址与 taskId 取值经核对无问题：`GET /v1/media/status?task_id={{taskId}}`（task_id 写进 path 查询串），`$coalesce` 先读 `data.task_id`（站方返回 `{data:{task_id}}`）；`usage` 轮询终态的 `cost` 字段读进 `usage`。`plugin-packages/beeftv-plugin-myxsai/docs/interface.md` 已按新映射重写（旧版写着“结果地址字段名没验证过”“is_final 未消费”，已作废）。
- 本地验证：新增 `backend/internal/protocol/myxsai_media_test.go`（回归测试，读真实 `package.json`、走与运行时相同的加载路径）：提交体带 `params` 且无平铺可选参数；`{code:0,data:{task_id}}` 解析出 taskId；7 组 LingKe 形状的轮询响应（进行中/未终态成功/单地址/数组地址/code:200/失败带错/data 包裹）全部按预期解析；轮询 URL 为 `/v1/media/status?task_id=task-123`。另核对了轮询循环契约（`backend/internal/generation/protocol.go:177-186`）：只有 `StatusSucceeded` 才收尾，中间结果里的媒体会被忽略，所以非终态的 `processing` 不会提前当成完成。

### 选择模型加全选

- 用户截图是宿主编辑器（`web/src/pages/settings/model-service-editor.tsx` 第二步），不是插件面板：筛选行加“全选（n 个）”按钮，n 为当前页签 + 搜索筛选下的可见模型数；点一下选中全部可见模型，已全选时变成“取消全选”（取消只移除可见的，不动其它页签已选的）；已选计数同步显示。走现有保存链路（`toggleModel` 同款 profile/protocol 补全逻辑，一次 `setDraft` 批量写 `draft.models` + `modelProfiles`，底部“保存并使用”原样保存）。
- 插件面板（`plugin-packages/beeftv-plugin-myxsai/client/index.js`）原有“全选模型”按钮无视页签全选全部模型，已改成只选当前页签可见模型（`visibleIds`），文案同步显示个数；宿主与面板两处行为一致。

### 每个模型显示费用

- 价格数据源结论（2026-11-22 16:15–16:25 只读调查，无 Key、未登录）：价格源是模型广场用的公开接口 `GET https://api.lk888.ai/gongkai/moxingguangchang?domain=myxsai.com&type=all`（同源备用 `https://myxsai.com/houduan/gongkai/moxingguangchang`），免 Key 能调、但匿名时 144 个模型全部 `price_available: false`、`billing_mode: ""`、`price_min` 全空——价格只随网站登录态返回（SPA 请求头带加密登录 token；桌面端没有该 token）。旧 `https://myxsai.com/api/pricing` 已死（只返回 SPA HTML）。`GET /v1/skills/models` 与 `GET /v1/media/models` 无 Key 时 401，返回里是否带价格字段未验证。
- 实现：价格字段只认已验证的广场字段名（`price_min` / `price_max` / `output_price_min` / `price_available` / `billing_mode`，取值 按次/按秒/按 token）；格式化按广场前端原样（数字最多 4 位小数 + `/次` / `/秒` / `/百万 token`，按 token 时分输入/输出两行），数值单位站方未说明——不加币种符号、不换算、不编造、不硬编码价格表。接口没给价格的模型显示“价格待确认”，不留空。
- 链路：`web/src/lib/model-pricing.ts`（新，格式化 + 校验，`web/test/model-pricing.test.ts` 覆盖）；宿主编辑器每行显示 `formatMyxsaiModelPrice(item.pricing) ?? "价格待确认"`；`web/src/lib/channel-model-catalog.ts` 的 `ChannelModelCatalogItem` 加 `pricing` 字段并透传；后端 `backend/internal/modelcatalog/catalog_fetch.go`（`catalogPricing`）+ `types_route.go` 把上游 `/v1/models` 条目里平铺的广场价格字段拼进 `pricing`（`price_available: false` 或无字段时不拼，`catalog_fetch_test.go` 新增 `TestParseChannelModelCatalogMyxsaiPricing`）；插件面板 `client/presets.js` 的 `fetchMyxsaiModelsByType` 从 `/v1/media/models` 条目里同样抓取（`extractMyxsaiPrice` / `formatMyxsaiPrice`），静态预置模型并进在线同名模型的价格，面板每行同样显示价格或“价格待确认”。

### 服务商列表测试修复（v2.3.3 quality 挂点）

- `web/test/service-credentials.browser.test.ts:109` 期望侧边栏 `.model-service-provider` 为 4 项、实际 5 项。核对结论：5 项是产品逻辑——`standardServicePresets()`（`web/src/lib/model-service-presets.ts:60-62`）返回 `[myxsai, 第三方模型服务, OpenAI, Google Gemini, 火山方舟]`，文件注释写明“梦由心生（自家渠道，置顶）+ 通用与直连入口”；测试注释是插件替换前的旧期望。修法：测试期望改成 5，注释同步。87360b4 时 quality 全绿是因为那次提交只改了 `MODIFICATIONS.md`、各分片被跳过，不是测试不稳定。

### 视频二创续写接 Seedance 2.5 extend

- 根因：视频节点工具栏“视频二创 → 视频续写”流程完整（`createVideoEditNodeFromVideo` 按 `modelCapabilityConfigFor(...).video?.operations` 找声明了 extend 的模型），但梦由心生插件的 `VIDEO_CAPABILITY_CONFIG`（`plugin-packages/beeftv-plugin-myxsai/client/presets.js`）只声明了 `["text_to_video","image_to_video","reference_to_video"]`，续写永远匹配不到，子节点只能按普通参考生视频走。
- 改动 1（声明）：新增 `SEEDANCE_VIDEO_CAPABILITY_CONFIG`（VIDEO 的克隆 + operations 加 "extend"），只用于两个 Seedance 2.5 预置模型（`doubao-seedance-2-5-260628`、`seedance-2.5-guanfang`）；其它视频模型不动。证据：站方模型标签含“视频编辑/视频延长”。
- 改动 2（映射）：`myxsai-media` provider 的 `create.body.params` 加 `_quan_neng_mode` 与 `video_url`，都只在 `request.operation == "extend"` 时发（`$if` + `$eq`，否则 key 直接省略——表达式求值 nil 键不入 map），不影响其它模式；`video_url` 为 `request.videos` 的 URL 列表（`$map` + `$sortByOrder`，与 `images` 同款写法）。约束：1–10 个片段、单段 2–30 秒、总计 ≤30 秒、aspect_ratio 须为 adaptive——后端 `NormalizeSeedanceTaskOptions` 对 extend 已锁定 adaptive，续写子节点也写死 `size: "adaptive"`，无需另改。
- 局部修改（inpaint）未接：Seedance 上游虽有 edit（`omni_reference_task_type: "edit"`，见 `backend/internal/protocol/seedance_constraints.go` 的 `SeedanceOmniTaskType`），但站内客户端无 edit 入口，需真 Key 实测，留待以后；预置里不声明 inpaint。
- 验证：后端新增 `TestMyxsaiMediaCreateBodyExtend`（读真实 package.json）：extend 发 `_quan_neng_mode: "extend"` + `video_url` + adaptive 画幅、顶层无平铺参数；`reference_to_video` 对照不发这两个参数。前端新增 `web/test/myxsai-preset-extend.test.ts`（3 个测试）：两个 Seedance 模型含 extend、其它视频模型不含、全部视频模型不含 inpaint。

### FFmpeg 硬件编码回落修复

- 根因：1db6ca1 的 `PreferredH264Encoder`（`backend/internal/mediatools/ffmpeg.go`）只查 `ffmpeg -encoders` 列表——本机 ffmpeg 8.1.2 的列表里有 `h264_nvenc`，但无 NVIDIA GPU 时运行时才失败（`Cannot load libcuda.so.1`，`-22 Invalid argument`），编码直接报错、不回落 CPU。“列表里有”不等于“能用”。
- 修法：`PreferredH264Encoder` 对每个候选编码器先做一帧试编码验证（`nullsrc` 64x64 → `-c:v <编码器> -pix_fmt yuv420p -frames:v 1 -f null -`，5 秒超时，结果按二进制路径 + 大小 + 修改时间缓存），只返回能真正打开的编码器；探测顺序不变（nvenc → qsv → amf → videotoolbox → libx264），其它编码参数不动。无 GPU 的机器上硬件探针均失败、回落 libx264；`video_derive.go` 返回的编码器名随之变成 `libx264`，前端已有的“未检测到硬件编码器，本次用 CPU 编码完成”提示照常触发，不新增文案。
- 回归测试：`ffmpeg_test.go` 新增 `TestPreferredH264EncoderFallsBackWhenHardwareProbeFails`（假 ffmpeg 列出 nvenc 但探针失败 → 选 libx264；只有 nvenc 且探针失败 → 无编码器）；`mediatools` 全量通过。
- 验证（本机，无 GPU）：2a7005a 审计挂的 10 个测试（app 三分片 6 个 + operations 4 个）全部复跑通过，同族 handler 3 个原生历史测试也全部通过——operations：`TestMediaReviewUsesOwnedVersionedClipAndDoesNotExposeBytes`、`TestMediaReviewSelectsReferencedResourceBeforeInference`、`TestNativeMediaReadCheckVersionAndBounds`、`TestNativeMediaOverviewEvidenceUsesOneOwnedSnapshot`；app：`TestCanvasTimelineDeliverReplaysAndBindsAfterRender`、`TestCanvasRenderAtomicAdmissionReplayAndNativeOutput`、`TestReplacementNativePrepareFinishAndRecovery`、`TestReplacementNativeDisplayGeometryAndFractionalFPS`、`TestReplacementPrepareHonorsMinRefSecondsAxisBoundsAndCorruptLimits`、`TestTimelineSubtitleOnlyUpdateAndRenderKeepSavedPortraitOutput`；handler：`TestNativeHistoryRealDefaultHostCanvasScopeAndSDKDeterministicFailure`（78.6s）、`TestNativeHistoryRealDefaultHostRestartsAfterBudgetFailure`（99.0s）、`TestDefaultDurableHostDispatchesActualNativeMediaBytes`（64.1s）。`node scripts/structure-budget.mjs` 通过；`node scripts/deadcode-budget.mjs` 通过（521 项，与基线持平）；`git diff --check` 通过；`gofmt` 干净（`video_derive.go` 的一处对齐问题是 HEAD 已有，未动）。

### 仍需用户真 Key 实测（没 Key 验证不了）

- 拿一次真实生图任务的提交响应与每次轮询响应的原始 JSON 全文，逐字段对照上文（重点：`result_urls` / `result_url` 是否如公开客户端所写、`code` 字段是否出现、`is_final` 与 `state` 是否同步变化）。
- `/v1/media/models` 与 `/v1/skills/models` 带 Key 后返回里是否含价格字段（决定宿主编辑器与插件面板的价格是否能真正显示出来，还是继续“价格待确认”）；登录后调 `GET /gongkai/moxingguangchang` 确认 `price_min` 是否返回及数值单位（算力点还是人民币）。
- `images` 参考图是否被接受、接受 URL 还是 base64；`aspect_ratio` / `resolution` / `duration` 在 `params` 里的取值范围与默认值；另一轮询端点 `GET /v1/skills/task-status?task_id=` 与 `/v1/media/status` 的响应是否相同。
- `/v1/skills/balance` 返回字段、充值/用量页准确 URL、音频 6 个模型 ID（同 v2.3.3 遗留）。
- 视频续写 extend 真机验证：`video_url` 列表形状是否被站方接受、续写是否按 `_quan_neng_mode: "extend"` 走、局部修改（inpaint）是否可用。

### 验证

- 生图映射回归测试 `backend/internal/protocol/myxsai_media_test.go`（新）：4 个测试全过（提交体 `params`、创建解析、7 组轮询响应、轮询 URL）；`backend/internal/modelcatalog` 价格透传测试 `TestParseChannelModelCatalogMyxsaiPricing` 通过；前端 `web/test/myxsai-model-pricing.test.ts`（新）3 个测试通过。
- `bun run lint`、`bun run typecheck` 通过；`bun run build` 通过（仅已知的大 chunk 警告）。
- 前端 4 个 CI 分片（`BEEFTV_TEST_SHARD=N/4`，本地重跑）：分片 1 通过（870 + 各隔离文件）；分片 2 通过（共享 954 + 各隔离文件，重跑前因新文件误用被禁路径名 `src/lib/model-pricing.ts` 挂 1 个，改名 `myxsai-model-pricing.ts` 后通过）；分片 3 通过（共享 839 + 各隔离文件，`canvas-archive-sqlite-restore` 3 个需 Go 在 PATH，补上后通过）；分片 4 除 1 个已证实 pre-existing 的失败外全过——`assistant-outputs.browser.test.ts:73` 下载文件名断言（期望 `成片2.mp4`、实际 `download`，2fba2a6 审计时已在基线 worktree 复现，与本次改动无关）。
- 后端 CI `packages` 分片（除 `internal/app` 外全包，本地跑 23 分钟）：除 2 个已知环境失败外全过——`internal/outbound` 的 `TestManagedPublicHTTPSBlocksDNSRebindingAtDirectDial`（沙箱禁 UDP，假 DNS 服务器起不来；基线同 fail）、`internal/plugins` 的 symlink 权限测试（shell umask 0007 下失败，umask 0022 重跑后 `ok 525.967s`）；`internal/generation` 仅剩 2 个已知 UDP DNS 测试失败（基线同 fail）；`internal/modelcatalog`、`internal/protocol` 全过。`internal/operations` 4 个媒体测试（`TestMediaReview*` 2 个、`TestNativeMedia*` 2 个）在干净 1db6ca1 基线 worktree 上同样失败（`媒体处理失败或超时`，输出里未见编码器名），与本次改动无关（与下述 app 失败同属原生媒体族，疑似 1db6ca1 的 FFmpeg GPU 优先改动所致，待主线另查）；`internal/handler` 全包在本次并行重跑中触到 Go 默认 10 分钟超时（当时与 plugins 重跑及其它会话的测试抢 1.5 核；已单独重跑验证，见下行）。
- 后端 `internal/app` 三个 CI 分片（本地）：分片 1 挂 2 个、分片 2 挂 3 个、分片 3 挂 1 个，6 个失败全部在干净 1db6ca1 基线 worktree 上复现、与本次改动无关——根因是 1db6ca1 的 FFmpeg GPU 优先改动在本机无 GPU 时调 `h264_nvenc` 失败（`ffmpeg 渲染失败：-22 (Invalid argument)`，`[vost#0:0/h264_nvenc …] Terminating thread`），未回落 CPU：分片 1 `TestCanvasTimelineDeliverReplaysAndBindsAfterRender`、`TestCanvasRenderAtomicAdmissionReplayAndNativeOutput`；分片 2 `TestReplacementNativePrepareFinishAndRecovery`、`TestReplacementNativeDisplayGeometryAndFractionalFPS`、`TestReplacementPrepareHonorsMinRefSecondsAxisBoundsAndCorruptLimits`；分片 3 `TestTimelineSubtitleOnlyUpdateAndRenderKeepSavedPortraitOutput`。以上 6 个加 operations 的 4 个共 10 个失败都已基线验证，建议主线另查 1db6ca1 的 GPU 回落逻辑（本机无 GPU 时应回落 CPU 编码而不是直接失败）；CI 的 Windows/macOS runner 有视频工具链，未必复现。
- `internal/handler` 单独重跑（umask 0022）：600.436s 触到 Go 默认 10 分钟超时（累计超时，1.5 核跑不完；同 2fba2a6 审计的 app 包情况）；命名失败 3 个，全部在干净 1db6ca1 基线 worktree 上复现、与本次改动无关（原生媒体/宿主族）：`TestNativeHistoryRealDefaultHostCanvasScopeAndSDKDeterministicFailure`、`TestNativeHistoryRealDefaultHostRestartsAfterBudgetFailure`、`TestDefaultDurableHostDispatchesActualNativeMediaBytes`（各约 10 秒，均似在等原生媒体宿主响应）。
- `node scripts/structure-budget.mjs` 通过；`node scripts/deadcode-budget.mjs` 通过（521 项，与基线持平）；`./scripts/audit-public-docs.sh` 通过（45 个文件）；`git diff --check` 通过；`gofmt` 干净。

## 2026-11-22 v2.3.5：resolution 白名单、价格待确认、超分门禁、深度捕捉显错

### A：生图仍失败——resolution=720 被站方在提交时拒绝

- 根因（与 v2.3.4 的 result_url 根因不同，同一文案、换了根因）：宿主侧 `buildGenerationConfig`（`web/src/lib/canvas/canvas-generation-config.ts:64`）对图片节点也塞 `vquality`，`normalizeVideoResolution`（`web/src/lib/video-generation-options.ts:33`）默认给 `"720"`；后端 `ProtocolRequestFromInput`（`backend/internal/generation/protocol_request.go:36-37`）只对视频分支归一化，图片模式把 `"720"` 原样放进 `request.Resolution`；myxsai-media 提交体 `params.resolution` 是 `$omitEmpty` 直传，于是 `"720"` 发到站上，站方 400 拒绝：“参数 resolution 的值 720 不合法，支持的值：auto / 1K / 2K / 4K”。视频同样中招：视频预置默认 `"720P"`（`plugin-packages/beeftv-plugin-myxsai/client/presets.js:98` 的 `VIDEO_CAPABILITY_CONFIG`）也不在接受集里。
- 修法（manifest 单一卡口，生图/生视频、静态预置/运行时拉取模型同一条提交链全覆盖）：`plugin-packages/beeftv-plugin-myxsai/package.json` 的 `params.resolution` 改成 `$switch` 白名单——只放 `auto / 1K / 2K / 4K`（`$lower` 归一大小写），其余一律 `default: null` 省略、由服务端自己定。**数值档位没有映射出处**（站方只给了接受集，没给 720→1K 这类映射），按 skill 规矩不猜映射、不传非法值。
- 回归测试：`backend/internal/protocol/myxsai_media_test.go` 新增 `TestMyxsaiMediaResolutionAllowlist`（9 组）：tt-image-2.5 + `"720"` 不发、`"1080"` 不发、视频 `"720P"`/`"1080P"` 不发、空值不发；`"auto"`/`"1k"`→`"1K"`/`"2K"`/`"4k"`→`"4K"` 正常发。旧 `TestMyxsaiMediaCreateBodyUsesParams`（`"2K"`）继续通过。
- 文档：`plugin-packages/beeftv-plugin-myxsai/docs/interface.md` 提交体示意与实测清单第 4 项同步（resolution 取值已有站方报错文本为证；`aspect_ratio`/`duration` 仍未验证）。
- 失败文案附带核查（未大改）：截图里的“无法确认上次是否已扣费”是 `result_unrecoverable` 的兜底文案。对提交即被拒的情况，`FinishRouteAttempt`（`backend/internal/modelcatalog/route_attempt.go:395`）只有 `SafeRouteRejection` 才记 `rejected_no_job`；而 `SafeRouteRejection`（`route_health.go:91-94`）的安全状态码是 401/402/403/404/405/429/501——**不含 400**，所以站方 400 参数拒绝会落到 `submission_unknown`，再由 `RecoveryOutcome=Unrecoverable` 走出吓人的扣费文案。修 A 之后 resolution 拒绝已不可能发生，该文案问题对这条路径已无实际影响；后续若要根治，需先拿到一次真实提交失败的 `FailureDiagnostics.ProviderCode`（站方错误码原文），再按 `generation/submission.go:82-83` 的 `model_not_found` 先例加“400 + 明确错误码 + 无 task_id 才算安全拒绝”的分支——错误码没出处前不猜、不加。

### B：tt 模型生成面板不显示单次费用

- 根因：费用链在生成面板处断了。`generation.estimate` 对 myxsai 无价格模型返回 `pricing.Unknown(reason)`（`backend/internal/operations/generation_estimate.go:72-84`：模型不在已存目录→“找不到这个模型，暂无价格”；目录里无 `Pricing`→“这个模型暂无价格”），即 `{Label: "", Text: 原因}`；前端 `formatInlineCostEstimate`（`web/src/lib/generation-cost-estimate.ts`）见 `label` 为空直接返回 `null`，`GenerationCostBadge` 与画布节点提示词面板（`canvas-node-prompt-panel-controls.tsx:92-93`）于是渲染空白——不是没接价格，是“无价格”被静默成空白。价格透传本身没问题：`catalog_fetch.go` 的 `catalogPricing`、`local_snapshot.go` 的 `PublicPrices`、插件 `presets.js` 的 `extractMyxsaiPrice` 都已接好，只等带 Key 的接口返回价格字段（仍未验证，见下）。
- 修法：`formatInlineCostEstimate` 在 `label` 为空但 `text` 非空时返回 `{label: "价格待确认", tooltip: 原因文本}`，两处调用点（徽章 + 节点面板）同时生效；`variable + hideVariableRate` 仍返回 null；label 与 text 都空时仍返回 null。**不编任何数字**：tt-image-2.5 的真实单次费用仍需带 Key 后看 `/v1/models` 或 `/v1/media/models` 是否返回价格字段。
- 测试：`web/test/generation-cost-estimate.test.tsx` 的“保持静默”用例改名并改期望——无 label 有 text 时返回“价格待确认”+ 原因 tooltip；新增“这个模型暂无价格”用例与双空仍 null 用例；按量结算的既有用例不动。

### C：AI 超分门禁收紧

- 核查结论：门禁本身已生效——后端 `LiveUpscaleCapabilities`（`backend/internal/generation/cancellation_and_submission.go:757-760`）在 myxsai 无 Topaz 能力接口时返回 `upstreamAvailable: false`；前端超分节点（`upscale-node.tsx:74,182,186`）据此置灰提交按钮并显示“云端超分服务暂未开启：梦由心生暂无超分模型，无法提交”。用户在 v2.3.2 上看到的“点了没反应/提交失败”是旧版表现：v2.3.2 没有这道门禁，提交走到后端才被 `topaz.Validate` 以渠道 ID 拒绝。
- 错位修复：`topaz.ResolveModelID`（`backend/internal/topaz/topaz.go:138`）只认 `channelId == "beeftv"`，而前端超分节点发 `"myxsai"`（`upscale-node.tsx:73`，迁移后的渠道 ID）。改成同时接受 `beeftv.ChannelID` 与 `beeftv.MyxsaiChannelID`（与画像配额修复同款处理），调用方 `generation.ValidateUpscaleInput` 与 `canvasworkflow/image_operations.go:51` 一并对齐；`topaz_test.go` 加 myxsai 通过用例，`"fal"` 仍拒绝。
- 本地替代评估（只评估、不动手）：FFmpeg `scale` 滤镜 lanczos 插值放大技术上可接——零模型下载、走现有 GPU 优先编码链，成本很小；但它**不是 AI 超分**，只放大像素、不增加细节，画质收益有限，且与节点上“AI 超分”的名字会误导用户。若要接，应另起名“本地放大（非 AI）”并写明“仅插值、不增加细节”，等用户拍板再做；Real-ESRGAN 这类重型模型下载不在考虑范围。

### D：深度动作捕捉点了没反应

- 点击链核查（全部读代码确认，无静默 return）：节点悬浮工具 `depthCapture` → `canvas-node-toolbar.tsx:322` 的 `tool.run` → `canvas-project-overlays.tsx:333` 的 `depthCaptureNode` → `use-canvas-video-tools.ts:259`。`projectIdRef` 在 `use-canvas-media-tools.ts:78-80` 每渲染都同步，不是 stale ref；`canvas-toolbar.tsx:269` 的空函数只是主工具栏默认值，与节点工具无关；`resourceId` 为空时有明确报错。**链路上没有静默吞错的分支**。
- 真正的失败点（Windows 版确定性失败）：`DepthComponentStatus` → `ComponentStatus`（`backend/internal/depthcapture/components.go`）在组件未安装时调 `componentOptions`，Windows 上要求 `depthWindowsManifestPublicKeyBase64`（`backend/internal/app/depth_adapter.go:19`）非空——该 key 只在签名版 Windows 构建时由 ldflags 注入，`desktop-installers.yml` 从未注入，于是返回 `ErrWindowsKey`（“Windows 深度处理组件尚未配置可信发布公钥，暂不可用”）。清单本身是活的（2026-11-22 再验：`depth-runtime-manifest.v2.json` 含 windows-amd64/cpu 857MB 与 cuda 3.7GB 三段、模型 `video_depth_anything_vits.pth` 116MB，sha256 与内置 fallback 一致），但**没有公钥就验不了签名、组件下不下来**。公钥值在公开渠道查不到（不在清单里、不在索引到的上游资料里）；要真修需上游作者提供公钥，或自建签名清单 + 镜像组件（857MB CPU + 3.7GB CUDA + 116MB 模型），都超出本次范围。
- 修法（失败必有明确提示）：`depthCaptureNode` 与 `retryDepthCaptureNode` 两处 `confirmDepthComponents` 的 catch 由“只弹 3 秒 toast”改成：① 先挂 `message.loading("正在检查深度处理组件…", 0)`（后端状态接口最长等 25 秒，等待期可见）；② 失败弹常驻 `modal.error`（标题“深度动作捕捉暂不可用”，内容 = 失败原因 + “请到设置 → 存储查看深度组件状态，或稍后重试。”），`finally` 里一定关掉加载提示。用户取消仍是静默返回（点了“暂不下载”本就是正常取消）；`resourceId` 为空的报错不动。
- 仍需用户提供（若弹窗后仍有问题）：弹窗全文截图；问题诊断页导出的诊断包（设置 → 问题诊断 → 导出）。

### E：提示词板“好像也没按要求搞定”——审计结论：代码无缺口，最可能是用户还没更新

- 逐项核对（插件仓库未动，只审计）：① 滚动——插件 v0.3.0（`09a6b30`）的 `.mv-prompt-board` 已有 `height:100%;overflow-y:auto`（`client/index.js:1566`）；宿主页面链（`router.tsx` 的 `PluginHostPageRoute` 直接渲染、无包裹层；`app-top-nav.tsx` 的 `h-dvh flex-col overflow-hidden` → `flex-1 min-h-0 overflow-hidden`）与浮动面板（`canvas-dock-panel.tsx:41,54` 的 `absolute top-4 bottom-24` + 内容区 `min-h-0 flex-1 overflow-y-auto`）都给了确定高度，`height:100%` 能解析、内滚动成立，无 overflow-hidden 链盖掉的问题。② 工具栏按钮——插件以 `canvas.sidePanel {id:"prompt-board", dockButton:true}` 贡献（`client/index.js:2084-2091`）；宿主 `getDockSidePanelEntries` 只认 `dockButton===true`（`web/src/lib/plugins/plugin-side-panels.ts`），`canvas-project-stage.tsx:102-106,476-488` 持 `activeDockPanelId` 开关、`canvas-toolbar.tsx:318-319` 渲染开关按钮，再点隐藏、Esc/X 关闭；面板 440px 宽。③ 发送到画布——面板模式下宿主传 `selectedNodeIds`，插件 `pickSendTargets`（`client/index.js:1620`）优先选中同类节点、选中不匹配时警告并回落全部同类节点、0 个新建、1 个配置、多个弹选择器（`1885-1905`），逻辑完整。
- 分清两种情况：**“用户那边还没做”**——按钮与滚动修复要求宿主 ≥ v2.3.4（含 `ba8b2f4`）**且**插件已重载到 v0.3.0（插件中心重载）；用户未确认是否双击安装了 v2.3.4，插件重载状态也未知，旧版上两项要求都不存在；**“代码本身有缺口”**——本次审计未发现，宿主侧无顺手可修的缺口。唯一已知的既存风险（非 v0.3.0 新引入）：全新画布 `revision < 1` 时发送会报“读取画布版本失败，请重试”（`client/index.js:1880`），需真机确认是否影响。

## 2026-11-22 v2.3.6（未发版）：深度捕捉自建签名清单（CPU 档）

- 根因：Windows 深度组件下载要验 Ed25519 签名，公钥 `depthWindowsManifestPublicKeyBase64`（`backend/internal/app/depth_adapter.go:19`）只在签名版构建时经 ldflags 注入；我们的 `desktop-installers.yml` 从未注入，于是 `ErrWindowsKey`，组件下不下来。公钥在公开渠道查不到。
- 修法：自建签名清单，不再用上游的清单与密钥。
  - 密钥：与更新器共用同一对 Ed25519 密钥（上游设计如此；`cmd/update-release` 的 `gen-key / sign-depth / verify-depth / public-key` 全是现成的）。仓库变量 `BEEFTV_UPDATER_PUBLIC_KEY`（base64 公钥）+ secret `BEEFTV_UPDATER_PRIVATE_KEY`（base64 私钥）需在 fork 里建好，建之前先查是否已有（已有则复用同一对，勿重复生成）。私钥绝不进仓库。
  - 注入：`print-ldflags` 只注入更新器的两个变量，不含深度公钥；`desktop-installers.yml` 的 Windows 构建步骤补 `BEEFTV_EXTRA_LDFLAGS: -X infinite-canvas/backend/internal/app.depthWindowsManifestPublicKeyBase64=${{ vars.BEEFTV_UPDATER_PUBLIC_KEY }}`（与上游 `release-desktop.yml:441` 同款写法）。
  - 运行时：不直接镜像上游的 zip（Part A §4 原则上允许无偿分发二进制，但 zip 内 22,343 个文件无法逐个核对许可证，且内含 GPL-3.0 FFmpeg，整包镜像要背源码提供义务）。改走现有构建脚本 `scripts/build-depth-runtime-windows.ps1` 从源码打包（`tools/depth-capture` 已在仓库；torch 等从 PyPI 现取；VDA 源码 pin 死 commit 并校验 HEAD；FFmpeg 收据进 `bin/`），经改版的 `release-depth-runtime.yml`（只编 CPU）签名后发到我们自己的 Release `depth-runtime-v2`。
  - 清单地址：`backend/internal/depthcapture/types.go` 的 `defaultWindowsManifestURL` 改到我们自己的 Release；镜像列表留空（单源；上游镜像的清单是上游密钥签的，用我们的公钥验不过）。模型文件第二源走 HuggingFace 官方地址（Apache-2.0，sha 已核对一致）。
  - 清单准备脚本 `scripts/prepare-depth-manifest.py`：基地址改我们自己的 Release，加 `--cpu-only`，去掉 CNB。
- CPU-only 回落（清单里没有 `windows-amd64/cuda`，N 卡机器原有代码会硬失败）：`depthruntime` 新增哨兵错 `ErrVariantUnavailable`（`loadArtifacts` 取不到 Windows variant 时返回）；`capture.go` 的 CUDA 探测闭包把它按 `ErrCUDADevice` 处理，走已有 CPU 回落；`components.go` 的 `ComponentStatus` 遇此错且 variant=cuda 时改选 cpu 重算下载计划。N 卡机器全程只装 CPU 包，不重复下载。磁盘占用：下载 857MB，解压后 3.8GB。
- 验签算法（已定位）：Ed25519，`backend/internal/depthruntime/manifest_verify.go`——信封 `{"payload": base64(清单JSON), "signature": base64(64字节签名)}`，`ed25519.Verify(公钥, payload, 签名)`，要求 `version == 2` 且 `Runtimes` 非空。验签逻辑本身未动。
- 发版顺序：密钥变量+secret → 跑 `release-depth-runtime.yml`（CPU）→ 下载签名清单本地再验 → 再发桌面安装包。CUDA 档以后要做时：清单加三段、去掉 `--cpu-only`、改回双 variant，代码侧回落逻辑不用动。
- 方案全文：`~/workspace/goals/ai/hidden_files/depth-selfbuilt-manifest-plan-2026-11-22.md`。

## 2026-11-22 v2.3.6（未发版）：本地 VSR 去字幕/去水印（AI 自动检测）

- 背景：去字幕/去水印/隐私打码原来走 BeefTV 云端接口，myxsai 没有对应端点，按钮点了没反应；本地只有 FFmpeg delogo 固定选框兜底（非 AI）。用户 2026-11-22 拍板：开源项目哪个好用就接哪个，不用他再决策；先接 VSR，深度捕捉第二批。
- 选型：VSR（YaoFANGUK/video-subtitle-remover，Apache-2.0，13,866 星）。LICENSE 全文已核对：与 apache.org canonical Apache 2.0 文本只差一个首行空行，无商业使用限制、无附加条款（“商业使用需许可”是二级评测的错误说法）；再分发义务是随包带 LICENSE + 署名。STTN 权重 MIT、LaMa Apache-2.0、PaddleOCR Apache-2.0；**ProPainter 权重非商业许可，不接**（打的包里直接删掉）。
- 接法：Go 后端 sidecar（`backend/internal/videosr/`），照抄深度捕捉的任务链：`POST /vsr-erases` → 本地任务 `video_erase_vsr` → exec 调便携 Python 跑 `resources/backend/main.py -i … -o … --inpaint-mode sttn-auto|lama [-c …]` → tqdm 进度进 `Task.Progress` → 输出视频导入素材库 → 画布子节点回填。只开 `sttn-auto`（默认，PaddleOCR 自动定位）与 `lama`；`propainter`/`opencv` 不开。
- 布局合同（1.1.1 directml 包实测，QPT 打包把仓库根目录拷为 `resources/`）：包根 `Python/python.exe` + `resources/backend/main.py`，入口是 `<包目录>/Python/python.exe resources/backend/main.py`。Go 侧 `Installed`/`installArchive` 按此校验。
- 分发：不随安装包（CPU 包实测 1.57GB，1,570,656,403 字节）。新增 workflow `.github/workflows/build-vsr-cpu.yml`（仅手动 dispatch）：拉 VSR@v1.4.0 源码 → windows-2022 上跑上游 QPT CPU 打包 → 删 ProPainter 权重 → 重打 zip → 发本仓库 Release `vsr-cpu-1.4.0`（不可变 tag，已存在则失败）并记 sha256；Go 侧钉死该 URL + sha256。**该 Release 已于 2026-11-23 发布**：`defaultArtifact` 已按发布值填入（URL/Size=1570656403/SHA256=f1d7fb42…，与 .sha256 文件及 Content-Length 核对过）；未发布时 `Ensure` 仍以 `ErrNotPublished` 明确失败，不静默、不猜地址。
- 前端：对话框本地区新增引擎选择，默认“AI 自动检测（VSR）”，备选“按选框快速擦除（delogo）”；`eraseMethod=auto` 不传 `-c`（全帧 OCR 自动找），`custom` 传框选区域换算的像素坐标；子节点任务进度/下载进度/失败原因原样展示，本地处理不扣费。
- 许可证署名：`licenses/vsr-license.txt`（Apache-2.0 全文，sha256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`）；打的 CPU 包内自带 `resources/LICENSE`。
- Linux CLI 实测（2026-11-22，VSR 1.4.0 源码）：`--help` 合同与方案一致；lama + `-c` 2 秒片段完整跑通（退出 0，273 秒，输出 640×360、音轨保留，字幕区亮像素 5.9%→0.0%）；完成行实测为 `[Complete] Subtitles removed. Output saved to: …`（英文）/`[完成] 字幕移除成功, 文件已保存到 …`（中文，见 en.ini:92/ch.ini:92），`FinishedOutput` 已按实测改。sttn-auto 6 秒片段在本机 1.5 核 CPU 上 35 分钟未跑完（第一批 50 帧推理中），CPU 档很慢，对话框需明示等待时间，Windows 真机验收仍待补。
- 未核实：CPU 档在 Windows 上的实际速度；官方 Setup.exe 静默安装可行性（备选，不阻塞主线）；Windows 真机验收待用户机器。（已核实：自打 CPU 包 1,570,656,403 字节；1.4.0 打包布局与 1.1.1 一致，CI 构建的布局校验已通过。）
- 方案全文：`~/workspace/goals/ai/hidden_files/vsr-integration-plan-2026-11-22.md`。
