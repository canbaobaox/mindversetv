# Muse（`beeftv-plugin-muse`）

MindVerseTV 内置插件，提供 **Muse（经 czg86389-hub/muse2api 中继，MIT）** 的一键 BYOK 渠道配置面板以及 1 套异步视频生成协议：

- `muse-video`：视频（`POST /v1/videos` JSON 提交 + `GET /v1/videos/{taskId}` 轮询）

文本模型 `muse-spark` 走宿主通用 `chat-completion`（`POST /v1/chat/completions`），图片模型 `muse-image` 走宿主通用 `openai-image`（`POST /v1/images/generations`），均不单独声明协议。

## 预置模型（中继 /v1/models 返回的全部三个）

- 文本：`muse-spark`
- 图片：`muse-image`
- 视频：`muse-video`

## 使用方式

1. 在自己的 Windows 电脑上装 Docker Desktop，拉起 muse2api 中继（默认端口 `18610`），按中继 README 导入自己的 Muse 账号（Cookie 即账号，建议用小号；中继与画布必须在同一台机器上，结果地址是中继的本地地址）。
2. 打开 MindVerseTV「插件中心」，找到已预装启用的 **Muse**，点击 **「设置」**。
3. 填写中继的 API Key（`MUSE2API_KEY`；中继启动时未配置会自己生成一个并写进 `.env`、打印在启动日志里，从那里复制过来），Base URL 默认 `http://127.0.0.1:18610`（不要在末尾加 `/v1`），可点击 **「验证在线目录」** 校验连通性。
4. 点击 **「一键保存并同步到模型服务」**，即可将 `Muse` 渠道与所选模型自动写入「设置 -> 模型服务」，不改动原有默认协议与预设。
5. 也可以不走插件面板，直接在「设置 -> 模型服务」自填渠道：Base URL `http://localhost:18610` + Key，模型名填 `muse-spark` / `muse-image` / `muse-video`。

## 视频能力（只写有出处的档位）

- 时长：5 / 6 / 8 / 10 秒，默认 6 秒（muse2api README 与 `app.py:1034`）。
- 画幅：16:9 / 9:16，默认 16:9（muse2api README）。
- 参考图：最多 10 张、单张 40 MiB，作首帧（muse2api `MAX_REFERENCE_IMAGES=10`）；视频文件作参考不支持，续写、局部修改不支持。
- 分辨率：中继没有分辨率结构化参数，只把“画质规格：…”拼进提示词，界面上不提供分辨率档位。
- 中继不返回价格，模型不带 price，宿主按“价格待确认”显示。

## 需真机实测（未验证项）

见 `docs/interface.md`：无账号时各端点的实际返回（目前只是源码结论，中继真服务未在本机跑过）、16:9 生图是否真出横屏（画布发的 `size: "1824x1024"` 不在中继识别的比例值里）、视频 5/8/10 秒与 16:9 横屏出片、参考图 data URL 是否被接受。
