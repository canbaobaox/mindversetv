// Package videosr runs the VSR (video-subtitle-remover) sidecar for local AI
// subtitle / watermark removal.
//
// VSR is YaoFANGUK/video-subtitle-remover, Apache-2.0 (LICENSE全文见
// licenses/vsr-license.txt；仓库 LICENSE 已逐字核对，与 Apache 2.0 官方原文只差
// 一个行首空行）。只开 sttn-auto 与 lama 两种模式：propainter 权重是 NTU S-Lab
// 非商业许可，不启用、不打包。
//
// 集成形态照抄深度捕捉（backend/internal/depthcapture）：Go 后端 exec 调便携
// Python 运行时里的 resources/backend/main.py，stdout 逐行解析 tqdm 进度，输出视频导入
// 素材库后经任务系统交付到画布节点。
package videosr
