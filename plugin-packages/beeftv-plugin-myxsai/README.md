# 梦由心生AI（`beeftv-plugin-myxsai`）

BeefTV 官方内置插件，提供 **梦由心生AI（`https://myxsai.com`，接口 `https://api.lk888.ai`）** 的一键 BYOK 渠道配置面板以及 1 套异步媒体生成协议：

- `myxsai-media`：图片与视频（`POST /v1/media/generate` 提交 + `GET /v1/media/status?task_id=xxx` 轮询）

文本模型走宿主通用 `chat-completion`（`POST /v1/chat/completions`），不单独声明协议。

## 预置模型（代表模型，非全量 144 个）

- 文本：`doubao-seed-2-1-pro-260628`、`kimi-k3`、`deepseek-v4-pro`、`qwen4-max`、`glm-5.3`、`MiniMax-M3.1-Flash`
- 图片：`doubao-seedream-5-5-261028`、`banana-pro`、`qwen-image`、`doubao-seedream-5-0-pro-260628`、`mj_imagine`、`kling-v3`
- 视频：`doubao-seedance-2-5-260628`、`kling-v4-video`、`hailuo-h3`、`seedance-2.5-guanfang`、`kling-v4-flash`、`hailuo-h3-cankaosheng`、`viduq4-preview`、`wan3.0`
- 音频：静态预置里没有音频模型（没有已验证的音频模型 ID，不编造）。设置面板支持“音频”分类，首次加载有 Key 时会按类型拉取在线音频模型并列出，但不自动勾选、不指派协议，需确认后自选。

## 使用方式

1. 打开 BeefTV「插件中心」，找到已预装启用的 **梦由心生AI**，点击 **「设置」**。
2. 填写梦由心生 API Key（在 [myxsai.com](https://myxsai.com) 控制台 API 密钥管理里新建），可点击 **「验证在线目录」** 校验连通性。
3. 首次打开且有 Key 时，面板会自动调 `GET /v1/media/models?type=<chat|image|video|audio>` 按类型拉取在线模型并合并进清单；拉取失败时静默回退到上方静态代表模型，不报错、不阻塞。
4. 点击 **「一键保存并同步到模型服务」**，即可将 `梦由心生AI` 渠道与所选模型自动写入「设置 -> 模型服务」，不改动 BeefTV 原有默认协议与预设。

## 需真 Key 实测（未验证项）

见 `docs/interface.md`：媒体协议的成功结果地址字段名、轮询 `state` 的取值、`images` 参考图是否接受、`/v1/media/models` 的返回体形状、图片尺寸/时长等可选参数是否被接受。
