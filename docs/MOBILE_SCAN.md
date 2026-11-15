# 手机扫描与 Vercel 部署

电脑在首页选择「用手機掃描保單」，手机扫码后允许摄像头。电脑显示实时取景，可让手机拍下当前页，也可在手机连续拍摄或从相册加入。照片在手机端压缩，每页最多 3 MiB、每次最多 20 页。开始识别时锁定这批照片，OCR 完成后进入原有逐页阅读和保单解读。

## 运行与环境变量

本地使用 Node 24，执行 `npm ci` 和 `npm run start:v3`。本地目录为 `.data/`；真实手机需要能访问的 HTTPS 地址。`localhost` 仅适用于电脑自身。

Vercel 项目使用 `npm run build:vercel`、`dist` 输出目录、Node 24。`api/index.ts` 是 API 入口，`/scan` 是手机页面；`/showcase.html` 保留原组件库。

函数运行区设置为新加坡 `sin1`，以支持 Gemini API 直连；香港运行区会被 Google 返回 `User location is not supported for the API use`。Blob 仍使用原私有存储区域。

OCR 的模型生成 schema 只声明字段和类型，避免 Gemini 展开数组上限后拒绝请求；服务端仍使用完整 schema 校验段落数量、文字长度和类型，不合格输出不会导入。

| 环境变量 | 用途 |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 连接**私有** Vercel Blob 后自动注入；持久保存数据库快照、配对状态和照片 |
| `POLICY_LENS_TEXT_MODEL` | Gateway 文本模型，默认 `deepseek/deepseek-v3.1` |
| `POLICY_LENS_OCR_MODEL` | Gateway 视觉转录模型，默认 `google/gemini-2.5-flash` |
| `CAPTURE_SESSION_TTL_MINUTES` | 配对有效期，默认 30 分钟，允许 5–60 分钟 |
| `CAPTURE_ICE_SERVERS_JSON` | 可选 STUN/TURN 配置；受限网络需要自己的 TURN 中继凭据 |
| `AI_GATEWAY_API_KEY` | 本地使用 Gateway 时可配置；Vercel 优先使用项目短期 OIDC 身份 |
| `POLICY_LENS_GOOGLE_TEXT_MODEL` / `POLICY_LENS_GOOGLE_OCR_MODEL` | Gemini 直连使用的模型，默认 `gemini-3.6-flash`；与 Gateway 模型名分开配置 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 可选 Gemini 直连；用于 OCR，且未配置 DeepSeek key 时也用于文本分析，可绕过 Gateway 账单设置 |
| `DEEPSEEK_API_KEY` | 可选；显式设置时，原 DeepSeek provider 配置继续优先用于文字分析 |

密钥只配置在服务端环境，不能加公开变量前缀或提交 `.env`。手机配对 token 放在链接 fragment 中，API 使用 Bearer 鉴权，日志不记录照片、token 或原文。

AI Gateway 的 OIDC 身份并不等于账户已经具备模型调用额度。若 Gateway 返回 403 并要求完成账单设置，需在 Vercel 账户启用账单，或配置已有的 `GOOGLE_GENERATIVE_AI_API_KEY` 直连；此时界面保留照片供重试，不生成假的识别结果。

## 数据与识别

- 视频通过 WebRTC 在浏览器之间传输；服务器只处理配对信令和拍摄指令。默认配置 STUN；不能直连时明确提示，并保留手机相册上传。跨不同受限网络部署时应配置 TURN。
- OCR 读取手机端上传的照片，不从电脑的视频预览截图识别。照片依序生成原图 PDF；识别文字单独保存在页和来源记录中。
- 识别来源标记为 `scan` / `ocr`；不确定段落可供用户核对，但不进入条款引用来源。不制造精确坐标或置信度数字。
- 当前使用视觉模型做逐字转录，不能保证零误差。金额、日期、否定词与表格应以原图为准。原图 PDF 可从阅读页打开。
- OCR 每页最多 45 秒、两页并行、一次总预算 180 秒。技术失败不保存半份文档，照片保留供重试。
- Vercel 的普通 PDF 上传限额为 4 MiB、120 页；本地 API 保留 10 MiB。大于 4 MiB 的原图 PDF 在 owner 鉴权后通过短期私有签名链接读取。

## 持久化与并发

线上 `/tmp` SQLite 仅作为一次请求的工作副本；提交状态保存为每个浏览器 owner 独立的私有 Blob SQLite 快照。ETag lease 串行化写入并定期续租，读取使用已提交快照。普通成功响应、SSE `done` 均等待快照持久化；写入失败明确返回可重试错误。

配对状态使用独立 JSON 与 ETag 条件更新，防止 ICE、照片和拍摄命令并发时丢失。正常关闭时删除临时照片；导入后的原图 PDF 随保单记录保存，删除保单会移除其数据库内容。配对过期会拒绝访问，过期但未正常关闭的 Blob 仍需按保留策略清理。

## 验证

`npm run check`、`npm run check:api`、`npm run check:capture`、`npm run test:api`、`npm run test:capture`、`npm run build:vercel`。

自动化覆盖 owner 隔离、跨实例持久化、并发写锁、提交与响应顺序、照片权限和导入状态锁、OCR 不确定段处理、原图 PDF 与失败重试。双页面浏览器验证使用模拟摄像头建立真实 WebRTC；真实手机摄像头授权和特定网络的 TURN 可达性需要在演示设备上验证。
