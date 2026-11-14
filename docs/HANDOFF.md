# 后端与原文阅读交接

> 2026-11-14（交接定稿）：本文内容已并入 [统一计划 PLAN.md](PLAN.md)——启动方式见 §4、已完成明细见 §8、PR #1 之后 19 个 commit 的逐项交付见 §8.5、未完成只剩可省略项见 §9、移交前端事项见 §10、验收对照见 §11.5。本文保留为历史交接记录（含 PR #1 当时的边界与状态），不再单独更新；后续以 PLAN.md 为准。
>
> 与本文撰写时的差异（都已实现，细节见 PLAN.md）：材料页已接真实调查并用 SSE 推送进度；补件续查、独立语义复核、宣传对照、情景实验、经纪核验、一页概览、版本变化对照、提问清单导出均已完成；PDF 提取改为版面感知分块；服务重启中的 run 改为 `interrupted` 而不是 `failed`。

交接节点：真实 PDF → 后台分页提取 → 浏览器查看逐页原文和出处。无需模型 Key 即可演示；原来的虚构示例仍可使用。此文档随功能分支与 PR 交付，供队友审阅后合并。

## 队友从这里开始

需要 Node.js >= 24.14。在项目根目录执行：

```bash
npm ci
npm run dev:api
```

另开终端，同一目录执行：

```bash
npm run dev
```

浏览器打开 http://localhost:4173/materials.html；也可从首页的“上傳我的保單”进入。

4173 的前端把 /api/* 代理到本机 3001 后端，cookie 保持同源。若后端改端口，前端启动前设置 API_PORT；不要只修改后端 PORT。直接打开 file:// 仅有示例能力。静态 dist 不包含后端，上传页会提示服务不可用。

## 五分钟验收

1. 运行 npm run sample:pdf，命令会打印虚构两页 PDF 的绝对路径（保存在忽略目录 .data 中）。它只用于软件测试，不是真实合同。
2. 在上传页选择这份 PDF，类型为合同，点击上传；观察 queued/parsing 到原文可查看。
3. 选择第二页，应显示 Carrier proof is required 等虚构测试文字；展开原文出处，查看其引用编号。
4. 点击打开原 PDF，应定位第二页；刷新上传页，材料应仍在。
5. 上传同一文件同一角色，不会重复新增；删除文件后原文和引用一起删除。
6. 有文字页加空白/扫描页会显示 partial；无文字层显示 needs_ocr，不会伪装识别完成。

## 已实现与主要文件

| 模块 | 文件 | 状态 |
| --- | --- | --- |
| 真实材料界面 | materials.html / materials.css / materials.js | 上传、状态轮询、原文/引用、原件链接、删除、刷新恢复 |
| 前端服务 | scripts/serve.mjs | 静态白名单、固定目标的 API 代理；后端不可用返回 502 |
| 服务入口 | server/index.ts | .env、启动和关闭处理 |
| HTTP 接口 | server/app.ts | cookie 会话隔离、版本校验、幂等、上传/原件/原文/任务接口 |
| 数据存储 | server/store.ts | SQLite，原文件是私有 BLOB；页、来源和任务记录 |
| 文档提取 | server/ingest/* | PDF.js 工作线程、超时/内存预算、重启恢复解析队列 |
| Agent 原型 | server/agent.ts | DeepSeek 工具循环、材料快照、三种只读工具、引用校验 |
| 测试 | server/tests/api.test.ts | 9 组，含本地模拟模型完整循环 |

原文使用 textContent 渲染，文件内容不能当 HTML 执行；原文区不会被界面翻译改写。会话 cookie 才是访问凭据，reviewId 本身不是凭据。

## 测试

```bash
npm run check
npm run check:api
npm run test:api
npm run build
```

已验证：浏览器上传、解析、第二页文字/引用、刷新恢复；桌面和窄屏无横向溢出。后端测试覆盖持久化、隔离、幂等、版本、PDF 错误和引用检查。前端目前没有自动化浏览器回归脚本，上述浏览器验收步骤需手动执行。

## Agent 的真实进度

源码已接入 ToolLoopAgent + DeepSeek，模型可自行 listDocuments / searchSources / readSource。测试用本地模拟端点验证检索→阅读→JSON 输出。**真实 DeepSeek 账户已完成联调**：目标明确时约 11 秒、13 次工具调用后返回 awaiting_input；检索无命中的条目明确写「没有可引用条款」，没有编造引用。

如要联调，在本机 .env 配置 DEEPSEEK_API_KEY、实际 DEEPSEEK_BASE_URL / DEEPSEEK_MODEL 后重启后端。创建任务与轮询方法见 BACKEND_LOCAL.md。真实调用会将本次材料和问题交给所配置的模型平台处理。

当前结果检查 schema、引用归属、引用是否被工具观察到，并在发布后做一次独立语义复核（只判断引用是否支持结论）；有补充请求则为 awaiting_input。不能据此声称完整审阅或确定赔付。引用校验失败时会给模型一次修正机会（把无引用的结论降级为 unknown），仍失败才把任务标记失败，并在服务端日志写明原因。运行中重启会标记失败，需要新建任务；尚未实现模型步骤持久恢复。

### 补件续查（successor run）

1. 第一次 `POST /api/reviews/:id/runs` 返回 `awaiting_input` 时，`inputRequests` 就是模型请求的材料。
2. 上传新材料（或 PATCH 背景）会递增 `revision`。
3. 再 `POST /api/reviews/:id/runs`，body 加 `resumeFromRunId` 指向上一次的 runId，`expectedRevision` 用最新值。
4. 新任务会收到上次的 findings / openQuestions / requests 和新增材料清单；复用旧引用前必须重新读取原文，已失效的引用会被丢弃。
5. 失败语义：没有新材料 → 409 `NO_NEW_INPUT`；版本过期 → 409 `REVISION_CONFLICT`；父任务仍在跑 → 409 `PARENT_RUN_ACTIVE`；父任务没有结论 → 409 `PARENT_RUN_NOT_RESUMABLE`。

## 下一位成员建议顺序

1. ~~用团队实际 DeepSeek 账户完成最小真实联调~~ 已完成，见上文「Agent 的真实进度」。
2. ~~完成 input_requests 持久化及补件 successor run~~ 已完成，用法见上文「补件续查」。
3. resolveReference 与独立语义复核已完成：`GET /api/reviews/:id` 返回的 `currentReport` 每条结论带 `citations`（documentName / role / pageIndex / pageLabel / quote / status，材料被删后标 `missing`），并带 `review`（逐条 `supported` / `partial` / `unsupported` / `quote_mismatch` + 一句话依据；复核失败记 `unavailable` 不影响运行）。**材料页已接上一次调查**：`materials.html` 底部「條款調查」区块由 `report.js` / `report.css` 驱动，填问题 → 开始调查 → 轮询 run → 读 `currentReport` 渲染结论、原文引用（点击跳到逐页原文）、语义复核结论、补充请求与提问清单；有新加入的材料时出现「用新材料續查」，带 `resumeFromRunId` 走 successor run，不重复调查旧内容。仍未接的是 `experience.html` 主流程（示意聊天的二次入口）与 OCR／经纪回复核验。
4. 宣传与条款对照已完成：上传 `role=promotion` 的宣传单后，`currentReport.comparisons` 给出每条宣传主张对合同原文的 `supported_with_conditions` / `apparent_conflict` / `insufficient_basis`，两侧引文均为逐字摘录并带页码解析，无法核对的整条丢弃并记 `droppedComparisons`；`materials.html` 的「條款調查」区块在结论之后渲染「宣傳與條款」。演示素材：`assets/demo-contract.pdf` + `assets/demo-promotion.pdf`（均为虚构测试材料）。
5. 情景实验（`kind=scenario`）已完成：材料页出现「情境實驗」输入框，假设的时长与原文门槛由服务端确定性比较，结果带 status、差距和仍待确认项；不推算赔款。
5b. 经纪回复核验已完成：`role=broker_reply` 的沟通记录可以直接粘贴（来源 / 对话时间 / 对话内容三栏，存为一页原文材料，不必先转 PDF），报告在「經紀回覆核驗」里逐条给出 与条款一致 / 说大了 / 条款里找不到依据 / 与条款原文冲突，两侧都带逐字引用和页码；只说明一致性，不判断销售是否合规、不核实说话人身份。剩余：OCR、版本变化对照与 run 恢复。
6. PDF 提取改为按版面分块（页眉页脚剔除、分栏顺序、表格行合并、段落边界、连字符接回），引用的 quote 取自整段而不是 1200 字硬切，因此「Page 1 of 9」这类页眉不会再混进引用，赔付表能还原成一行。代价是段落更长，工具输出加了预算截断（searchSources 320 字 / readSource 目标段 1600 字、相邻段 480 字）、调查循环上限提到 14 步并要求「读到关键条款就输出报告」。真实 QBE 保单复验见 REAL-CONTRACT-TEST.md。剩余：OCR、经纪回复核验逐项增加。

## 交接边界

- 前端样例聊天仍为模板，上传页没有将真实材料接到样例聊天。
- 初始限额为单文件 10 MB / 30 页，每次审阅 8 份 PDF；图片不接受，扫描页未 OCR。
- 提取只读文本层：分栏与表格按坐标还原，但不做 OCR、不推断缺失文字；分块长度不固定，长段在工具返回时按预算截断，引用仍以数据库里的完整分块为准。
- GET events 现为持续 SSE：重放已存事件后继续推送、每 15s 心跳、终态自动关闭，支持 `after` / `Last-Event-ID` 续传；材料页已改用 EventSource（静默 20 秒或浏览器不支持时退回轮询）。
- 仅本机单实例开发。跨机器部署需要重新配置会话、HTTPS、持久存储和容量限制。
- .env、.data/、node_modules/、dist/ 不交接到 Git。队友使用自己的配置和材料。
- 详细设计：AGENT_V2_PLAN.md；当前接口：BACKEND_LOCAL.md；PR 描述草稿：PR_BACKEND_FOUNDATION.md。
