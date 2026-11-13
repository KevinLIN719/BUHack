# 后端本地开发（第二阶段：PDF 原文）

已实现：健康检查、匿名浏览器会话、审阅档案、背景版本、调查任务、状态查询、SSE 事件重放、取消与删除，以及 PDF 上传、后台分页提取、原件访问和原文引用。SQLite 保存数据，关闭服务后仍保留。

已接入初步调查运行器。没有可用合同时进入 awaiting_input；有合同但未配置 Key 时返回 503 AGENT_NOT_CONNECTED。配置模型后运行真实调查，结果由 GET run 的 report 字段提供。补件 resume 和前端接入待实现，详见第三阶段说明。

## 启动与检查

需要 Node.js >= 24.14。项目根目录运行：

```bash
npm install
npm run dev:api
```

访问 http://localhost:3001/api/health。前端依然由 npm run dev 在 4173 运行；materials.html 已通过前端同源代理接入上传和原文 API；原有示例聊天仍是模板。浏览器直接访问 API 的 GET 地址不能创建任务。

```bash
npm run check:api
npm run test:api
```

## 文件与配置

- server/index.ts：启动、端口与关闭服务。
- server/app.ts：接口、参数校验、会话隔离和错误响应。
- server/store.ts：SQLite 数据和事务。
- server/ingest/documents.ts：持久解析队列与引用分块。
- server/ingest/pdf-worker.mjs：独立线程中的 PDF.js 解析器；20 秒超时与内存预算。
- .data/policy-lens.sqlite：本机数据库，已加入 Git 忽略。
- .env.example：配置样本。需要修改配置时复制为 .env；API Key 仅填写在本地，不发送到聊天或提交到 Git。

DEEPSEEK_* 用于实际模型调用；自动测试使用本地模拟模型，无需真实 Key。SQLite 使用 Node 内置模块，启动时可能显示实验功能提示。

## 用终端测试一次调查

在项目目录另开终端。下面命令会把浏览器会话的等价凭证保存在本机临时文件；不要分享该文件。示例变量需要按真实返回值填写。

```bash
curl -s -c /tmp/policy-lens.cookies -X POST http://localhost:3001/api/reviews
```

记下返回的 id，然后替换下面的 YOUR_REVIEW_ID：

```bash
curl -s -b /tmp/policy-lens.cookies \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: local-investigate-01' \
  -d '{"expectedRevision":1,"kind":"investigate","goal":"检查旅行险中滑雪活动的保障边界"}' \
  http://localhost:3001/api/reviews/YOUR_REVIEW_ID/runs
```

未上传合同时，预期 HTTP 202，状态 awaiting_input，原因 missing_documents。返回的 id 是 runId，后续可 GET /api/reviews/YOUR_REVIEW_ID/runs/YOUR_RUN_ID 查询，或 GET 同路径 /events 查看事件。

## 上传与查看 PDF

沿用创建审阅时的 cookie，替换文件路径与 YOUR_REVIEW_ID：

```bash
curl -s -b /tmp/policy-lens.cookies \
  -F 'role=contract' \
  -F 'file=@/absolute/path/to/contract.pdf' \
  http://localhost:3001/api/reviews/YOUR_REVIEW_ID/documents
```

202 返回 document 的 id，使用 GET /api/reviews/:id/documents/:docId 查询状态。不要手工设置 multipart 的 Content-Type，curl/浏览器会生成 boundary。

- role：contract（合同）、promotion（宣传）、schedule（附表）、endorsement（批单）、broker_reply（经纪回复）。当前这些材料均只接收 PDF，图片 OCR 后续接入。
- 单文件最多 10 MB、最多 30 页、每次审阅最多 8 份文件；这是当前工程预算。超过页数整份失败，不静默截断。
- 状态：queued → parsing → ready / partial / needs_ocr / failed。ready 只表示每页有可提取文字，不表示条款内容已审核或版面读取绝对准确。
- 无文字页标记 needs_ocr，也可能是空白页；部分页可读时文档为 partial，逐页状态会明确列出。当前不调用 OCR 或模型。
- 原始字节存于私有 SQLite BLOB，不放公开静态目录。相同 review、文件哈希和 role 的重复上传返回同一 document（200）。
- 解析终态提交时增加 review revision；旧 run 保持原输入版本，不能把新文件偷偷混入旧任务。创建新任务前 GET review 读取最新 revision。
- 中断的解析在服务重启时重排队；删除审阅/文件后，迟到结果不得重新写入。

GET /api/reviews/:id/documents/:docId/pages/1 返回第一页提取文字及 sourceIds。页码为 PDF 文件页序，从 1 开始；如 PDF 包含印刷页码标签，会同时提供 printedPageLabel。

GET /api/reviews/:id/sources/:sourceId 返回 quote、documentVersion、pageIndex、原件页链接。quoteCheck=matched 仅说明引用来自保存的提取层，不代表语义已经验证。表格、多栏与复杂字体仍需对照原件。

GET /api/reviews/:id/documents/:docId/content 返回原 PDF。目前提供完整文件而非 Range 分段读取。DELETE 同一 document 路径可删除该文件及其页和引用，增加 review revision。

## 当前接口

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| GET | /api/health | 健康检查 |
| POST | /api/reviews | 创建审阅并设置匿名会话 cookie |
| GET | /api/reviews/:id | 恢复审阅、任务，以及带页码解析的 currentReport |
| PATCH | /api/reviews/:id/context | expectedRevision + context，保存背景并递增版本 |
| POST | /api/reviews/:id/documents | multipart：role + file，返回 202 并排队解析 |
| GET | /api/reviews/:id/documents/:docId | 文件状态、页数及逐页完整性 |
| GET | /api/reviews/:id/documents/:docId/pages/:pageIndex | 某页原文及引用编号 |
| GET | /api/reviews/:id/documents/:docId/content | 受会话保护的原 PDF |
| DELETE | /api/reviews/:id/documents/:docId | 删除原件、页与引用 |
| GET | /api/reviews/:id/sources/:sourceId | 原文、版本和页码出处 |
| POST | /api/reviews/:id/runs | expectedRevision + kind=investigate + goal，可选 resumeFromRunId；创建调查任务 |
| GET | /api/reviews/:id/runs/:runId | 查询状态 |
| GET | /api/reviews/:id/runs/:runId/events | SSE；after 或 Last-Event-ID 重放 |
| POST | /api/reviews/:id/runs/:runId/cancel | 取消任务，可重复调用 |
| DELETE | /api/reviews/:id | 删除审阅及其任务、事件 |

同一 Idempotency-Key 和相同请求会返回同一任务；请求内容不同返回 409。背景允许 destination、traveller、activities、concerns；未填写的事实保持未知。所有审阅接口绑定创建它的 cookie 会话，UUID 本身不是访问权限。

补件续查：`POST runs` 的 body 增加 `resumeFromRunId`（上一次 runId）即创建 successor run，返回体里 `parentRunId` 指向父任务，事件流里多一条 `run.resumed`。父任务必须已经产出 report 且已结束；当前 revision 必须大于父任务的 inputRevision（否则 409 `NO_NEW_INPUT`）。父任务还在执行返回 409 `PARENT_RUN_ACTIVE`，父任务无结论返回 409 `PARENT_RUN_NOT_RESUMABLE`，父任务属于别的审阅或不存在返回 404 `PARENT_RUN_NOT_FOUND`。新任务会拿到上次的 findings / openQuestions / requests 与新增材料清单；旧引用必须先重新读取原文才允许引用，已被删除的材料引用自动丢弃。report 与其中的 requests 存在 investigations.output，重启后仍可通过 GET run 读取。

`currentReport`：最近一次已发布报告的展示形态，没有报告时为 `null`（前端据此保留空态）。每条 finding 除原有 `explanation` / `evidenceStatus` / `sourceIds` 外，多一个 `citations` 数组，每项含 `sourceId`、`documentId`、`documentName`、`role`、`pageIndex`、`pageLabel`、`quote`、`status`。`status` 为 `verified` 表示原文仍在审阅里；报告发布后材料被删除时该引用变成 `missing`，finding 文本本身不改写。顶层 `citationIntegrity` 给出 `{cited, verified, missing}` 计数，前端可据此提示「有 1 处原文已删除」，不要静默隐藏。`runId` / `runStatus` / `createdAt` 指明这份报告来自哪个任务。

SSE 当前仅重放已保存事件；awaiting_input/cancelled 时关闭连接。消费端收到这种状态应主动关闭 EventSource，避免自动重连。接入持续运行的 Agent 时，再增加实时订阅和心跳。

本阶段仅供单机本地开发，监听 127.0.0.1。对外部署前需要补充 HTTPS/安全 cookie、会话生命周期和速率/容量限制等配置。API 不开放跨域调用，前端联调时使用同源服务或开发代理。


## 第三阶段：DeepSeek 调查原型

已接入 AI SDK ToolLoopAgent 与 DeepSeek provider。服务端工具为 listDocuments、searchSources、readSource；模型自主选择工具。每次运行保存不可变材料/背景快照，最多 10 轮和 24 次工具执行，120 秒活动超时。修改输入或取消后不可发布迟到结果。readSource 接受被缩短的 sourceId（如 `p2:b1`）并在找不到时返回可用列表，避免模型格式化失误导致材料看起来不可读。

本机 .env 填写 DEEPSEEK_API_KEY，按实际端点配置 DEEPSEEK_BASE_URL 和 DEEPSEEK_MODEL，重启 npm run dev:api。不要把 Key 发到聊天或提交 Git。有可用合同但没有 Key 时返回 503；配置后 POST runs 返回 202，GET run 可查询状态和 report。真实调用会把本次材料和用户问题交给配置的模型平台处理。

目前报告只经过 schema、材料范围和已观察引用检查，尚未独立语义审核，状态为 partial；需要补件时为 awaiting_input 并返回 requests。没有伪装成最终保险判断。经纪/宣传资料保留不同来源角色。仅未知项可以不引用原文。

测试使用本地模拟模型端点验证检索→阅读→结构化结果的完整循环，不需要真实 Key，不产生供应商费用。真实 DeepSeek 的账号、模型与端点仍需配置后验证。

当前限制：重启时正在执行的模型任务标记 failed/server_restarted，不自动恢复；需重新创建任务。补件续查、专题子 Agent、独立语义复核、即时 SSE 推送和前端接入尚未完成。GET events 目前为事件重放，可轮询 GET run。删除文件时清除相关审阅的调查快照/输出并取消其调查，避免保留被删材料的派生文本。
