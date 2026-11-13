# Policy Lens：后端与 Agent 实施计划

> 旧版方案，保留作历史参考。2026-11-13 已由 [Agent V2：主动调查架构](AGENT_V2_PLAN.md) 替代；新版将首次分析也交由自主工具循环推进。实现时以 V2 的运行状态和 API 为准。

日期：2026-11-13（香港时间）

状态：设计建议，尚未实现；根据现有原生 HTML/CSS/JavaScript 前端及团队选择的 TypeScript、DeepSeek 制定。

## 1. 本届比赛的交付范围

第一版聚焦旅行保险，完成一条真实流程：合同 PDF（必需）+ 可选宣传截图 → 补充出行情况 → 有来源的条款解释 → 宣传对照 → 5–8 个相关边界问题 → 勾选、复制提问清单 → 基于当前材料追问。

优先支持含文字层的短篇 PDF 与 JPG/PNG。建议初始产品限额为合同 1 份、宣传图 3 张、合同 30 页、单文件 10 MB；这些是可调整的工程预算，不是供应商限制。超限明确提示，不默默截断。扫描 PDF 在时间允许时作为增强功能；首版不能可靠识别时给出明确错误和替代上传方式。

保留清楚标注的虚构样例入口；真实分析失败时不可悄悄显示样例结果。

暂缓：多险种、产品推荐/排名、自动理赔、自动联系经纪、支付、复杂账户、向量数据库、长期用户画像。

## 2. 技术选择与部署边界

| 层 | 建议 | 原因 |
| --- | --- | --- |
| 前端 | 保留原生 HTML/CSS/JS，增加 API adapter | 复用现有界面与动效 |
| HTTP 后端 | Node.js + TypeScript + Express | 与前端同语言生态，统一提供 API |
| 模型适配 | AI SDK 的 DeepSeek/兼容 provider；服务端配置模型与 key | 复用团队已有 DeepSeek；具体 provider 参数实施时核对安装版本 |
| 校验 | Zod + 自定义证据/数值校验 | JSON 合法不等于结论正确 |
| PDF | PDF.js 逐页提取与浏览器预览 | 页码由程序生成，保留原文位置 |
| 图像 | DeepSeek 支持视觉的模型做文字提取；低质量结果人工复核 | 与条款推理解耦，保留图片证据 |
| 本地存储 | SQLite 保存会话/任务/结果，非公开目录保存文件 | 本地和单实例演示易实现 |
| 对外部署 | 一个支持 Node 长进程且有持久磁盘的实例 | 同一服务提供前端与 API，任务重启可恢复 |

当前是已有的非 eve 前端项目，先以服务端固定工作流接入，不引入新的自主 Agent 运行时。AI SDK 作为模型调用层，不要求把前端改成 React。

部署若改为无状态函数，应同时改用托管数据库、私有对象存储及持久任务执行；不能照搬本地 SQLite、上传目录或仅在内存运行的后台任务。Figma Make 的静态 dist 部署不会自动带上这个后端。

Express 只公开明确的前端构建目录，不公开仓库根目录。API key、数据库与上传目录均在静态目录之外。

## 3. 主工作流

```text
创建 review（一次材料审阅）
  → 上传并标注合同/宣传/附表/批单
  → 逐页提取或识别，登记失败页与文件版本
  → 提取结构化条款与宣传主张
  → 定位引用 + 检查跨页条款、定义、除外和交叉引用
  → 条款解释 / 宣传对照 / 用户情境生成
  → 检查引用、金额、时间、条件和措辞
  → 发布带版本的报告
  → 有界追问 / 勾选问题 / 模板导出
```

任务状态：queued → extracting → analysing → validating → ready / partial / failed。

接口启动任务后立即返回 jobId，前端每 1–2 秒轮询进度。先做结构化结果一次返回，再优化流式体验。验证完成前不展示带结论的半成品。

SQLite 保存阶段输出与版本；启动时把被中断的任务标为可恢复。设置供应商超时、限流退避、阶段重试上限；JSON/schema 错误最多修复一次。每次 report 记录模型、提示词版本、输入哈希、耗时和用量，不记录 key 或完整敏感材料。

## 4. Agent 分工

这些是程序编排的角色/函数，不是必须互相对话的多个自治进程。文件处理与权限检查由代码完成。

### A. 条款提取与解释

输入：按页分块的原始合同文字、文档类型、页码、定义和上下文。

输出：保障项目、触发条件、限额及单位、免赔/墊底費、除外、证明文件、交叉引用、未明确事项、通俗解释。

保留币种原文；未说明币种不能按香港场景自动填 HKD。金额可用十进制字符串/最小货币单位表示，不能依赖浮点运算。阈值需区分 gt/gte/lt/lte；计算周期起点不明确则置空。

长文档按章节/页分块，带重叠；先建全合同条款索引，再归并全局定义、例外、附表/批单引用。未读页和缺失附件必须影响报告完整性。不能只看一段就断言整个合同没有某项保障。

### B. 宣传对照

输入：宣传主张 + 完整条款索引 + 关联条件与例外。

输出类别：supported（有依据）、conditional（需满足条件）、apparent_conflict（表面不一致待核实）、not_found_in_supplied_material（所交材料未找到）、insufficient_material（材料不足）、not_applicable（无宣传材料）。

每个对照项同时引用宣传和合同；不一致需核对产品、版本、保障计划与批单，不自动指控欺骗。宣传缺少细节不等于直接矛盾。

### C. 边界场景生成（产品核心）

输入：已验证的条款 + 可跳过的用户情况 + 文件完整性信息。

按以下维度生成候选并去重，输出最相关的 5–8 项：

- 时间边界：阈值前、刚好等于、刚超过。
- 事件变化：延误后取消、改签、联程衔接。
- 证明边界：无纸质证明、只有 App 截图。
- 人群/活动：同行儿童、滑雪、潜水等已填写情况。
- 定义与缺件：缺少附表、批单、指定定义或事件清单。

每项包含 scenario、相关条款、为何值得问、尚未知什么、推荐问题。场景是明确标注的假设，不属于合同事实。

示例：原文为“超过 6 小时”时，程序保留严格大于的字面含义；“刚好 6 小时”可用来发现定义和起算问题。先检索其他适用条文再说明字面条件，不直接作最终理赔判断。“每连续 6 小时 200 元”未明确起算点时，不能自行补出计算公式。

### D. 校验

程序硬校验：review/document/version 对得上、引用 ID 存在、页码有效、quote 可在保存的提取文字中定位、数字单位未被改写。

语义复核：解释是否被引用支撑、是否漏掉明显例外、是否把假设说成事实、是否混淆宣传和合同。语义检查可用一次独立模型调用；它不能证明绝对正确。

引用无法定位则重试/剔除对应结论并标记待复核，不伪造页码。OCR 引文只代表识别结果，不代表已核验原件；页面需同时提供原图并标明识别来源。

### E. 追问 Agent

只开放当前 review 内的 searchClauses、getSource 和 getReport 只读工具。服务端绑定 reviewId 与会话，不接受模型自由访问其他会话。最多 3 轮工具调用并设置总时限。

优先带入当前选中的 findingId、原问题与必要历史，再检索相关条款/定义/例外。结果使用与报告相同的引用结构。无依据时返回 unknown 及可询问的问题，不用常识补齐保单内容。经纪回复后续如接入，应标记为用户提供的回复，不等同于合同或正式批单。

## 5. 证据与数据模型

最小实体：reviews、documents、pages、clauses、jobs、reports、messages、selected_questions。

- review：一次审阅，带不可猜测的会话标识、contextVersion 和 documentSetVersion。
- document：用户标注的类型、产品/版本信息、hash、解析状态。
- page：PDF 文件页序（1-based）、可选印刷页码、原文、解析方法和完整性。
- clause：条款文本、标准化字段及 sourceIds。
- report：不可变版本快照，关联文件版本和用户情况版本。
- selected_question：关联 reportId/scenarioId/sourceIds，而非只保存一段文字。

Citation 的字段：

```ts
type Citation = {
  sourceId: string;
  documentId: string;
  documentVersion: string;
  pageIndex: number; // PDF 文件页序，1-based；截图为 1
  printedPageLabel?: string;
  blockId: string;
  quote: string; // 来自保存的提取层，不是重写摘要
  method: 'pdf_text' | 'ocr';
  quoteCheck: 'matched' | 'needs_review';
};

type Finding = {
  id: string;
  category: 'coverage' | 'exclusion' | 'limit' | 'trigger' | 'evidence' | 'uncertainty';
  title: string;
  explanation: string;
  evidenceStatus: 'document_supported' | 'interpretation' | 'unknown';
  sourceIds: string[];
  missingInformation: string[];
  question: string;
};
```

报告顶层：summary、findings、comparisons、scenarios、questions、sources、coverage、warnings。coverage 列出收到哪些文件、处理了多少页、哪些页失败、哪些交叉引用未解析。

unknown 项可引用相关但不充分的原文，不能把该引用显示成“答案已证实”。引用字符串匹配只是来源检查，不是语义蕴含检查。UI 不显示模型自报的“准确率 98%”。

## 6. 最小接口合同

| 方法与路径 | 输入/输出 |
| --- | --- |
| POST /api/reviews | 创建审阅，建立匿名安全会话，返回 reviewId |
| POST /api/reviews/:id/documents | multipart 文件、role，返回 documentId 和解析状态 |
| PATCH /api/reviews/:id/context | 保存可选情况，增加 contextVersion |
| POST /api/reviews/:id/analyses | 带 documentSetVersion/contextVersion/idempotencyKey，返回 202 + jobId |
| GET /api/jobs/:id | 状态、阶段、进度、错误；同样检查所属会话 |
| GET /api/reviews/:id/reports/:reportId | 获取固定版本结果 |
| GET /api/reviews/:id/documents/:docId/content | 经权限检查提供原文件，PDF 支持页码跳转 |
| POST /api/reviews/:id/chat | reportId、message、可选 findingId；返回 reply + sourceIds + evidenceStatus |
| PUT /api/reviews/:id/questions | 保存所选 reportId/questionIds |
| POST /api/reviews/:id/checklist | 服务端按问题 ID 读取原文、去重、模板排版；返回可复制文本/Markdown |
| DELETE /api/reviews/:id | 删除材料、派生结果并取消任务；防止迟到任务重新写回 |

首版导出不再调用模型，以免改写原问题或丢出处。复制/下载不等于已发给经纪。文件更新后旧报告仍对应旧文档版本；未实现历史版本保留时必须显式作废，而非继续显示为最新。

## 7. 前端接入位置

- 新增 api-client.js：集中处理 fetch、会话、错误和轮询。
- experience.js：从同步 fixtures 改为 review/report 状态，绑定上传与真实结果。
- experience-data.js：保留纯 demo 数据，真实模式不走关键词规则回复。
- experience-chat.js：submit 改为等待后端 reply；保留现有消息动效，增加等待/失败/取消。
- 取消或切换 review 时用 AbortController 与版本校验防止旧回复落到新保单上；前端取消不代表后端任务已停止。
- UI 的 quote/sourceLabel 由后端 citation 派生，优先实现“打开对应原件页”，像素级高亮可后做。
- 原有 demo 与 live 需明显区分。实时上传须通过 HTTP 服务；file:// 和纯静态离线版本保留 demo 功能。

## 8. 必须实现的可靠性边界

- 文件内容（包括“忽略之前指令”等文字）都是材料，不是工具授权；不执行文档里的链接、脚本或指令。
- 输出按文本安全渲染；不把模型 HTML 直接写入页面。
- API key 仅在服务端环境变量。浏览器与日志不含 key。
- 每个接口检查会话所有权；文件不提供公开永久 URL。
- 上传校验实际格式、大小、页数，拦截超大图/损坏/加密文件，失败页明确记录。
- 上传页说明材料会用于 DeepSeek 分析；默认不请求身份证、保单号和详细病史，支持删除及明确保留期限。
- 限制每会话并发与模型用量；缓存以文件哈希、解析器/模型/提示词版本组成键，并限制在所属会话内。

## 9. 建议实施顺序（相对工时估计，视成员熟练度调整）

| 阶段 | 目标 | 粗略预算 |
| --- | --- | --- |
| 1 | 冻结 JSON schema/API，Express + DeepSeek 连通，PDF 分页提取与引用 | 3–5 小时 |
| 2 | 真实合同 → 六类解读 → 点击原文；先接现有前端 | 4–6 小时 |
| 3 | 宣传图识别和对照、用户情况、边界场景 | 4–6 小时 |
| 4 | 有来源的追问、勾选清单、失败与部分完成状态 | 3–5 小时 |
| 5 | 部署、回归、演示脚本与三分钟视频 | 4–6 小时 |

以上为实施估计，不代表剩余赛程足够。若人手有限，优先完成阶段 1/2，再做 5–8 个边界问题及清单；降低多文档和动效新增范围。

按三人分工：A 文件/API/持久化；B 提取/对照/场景/校验；C 前端接入/引用预览/演示。先共用脱敏的真实格式小样和统一 schema，各自可用固定 JSON 联调。

## 10. 验收与演示

准备 10–15 个手工标注小案例，覆盖：

- 最高赔偿不等于固定赔偿；币种、单次/累计限额不混淆。
- “超过”和“至少”、起算点不明、刚好 6 小时。
- 联程/取消没有依据时明确未知；其他页有定义/例外时能找到。
- 宣传和合同相符、需条件、版本不一致、缺宣传材料。
- 只有图片、扫描页不清、部分页失败、附件缺失。
- 上传文件带恶意指令、两个会话隔离、切换保单时回复不会串线。
- DeepSeek 超时/空 JSON/截断时明确失败，绝不冒充样例成功。

演示顺序：上传合同与宣传图 → 一页看懂 → 点开引文 → 改成滑雪/联程情况 → 展示两个边界问题 → 追问并显示来源 → 勾选生成给经纪的清单。

## 参考（已核实的官方文档）

- DeepSeek API：https://api-docs.deepseek.com/
- JSON 输出：https://api-docs.deepseek.com/guides/json_mode/
- 图片输入：https://api-docs.deepseek.com/guides/vision/
- Files API（当前列出图片格式，不能据此当作 PDF 解析服务）：https://api-docs.deepseek.com/guides/files_api/
- AI SDK 工作流：https://ai-sdk.dev/docs/agents/workflows
- AI SDK 结构化输出：https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- PDF.js：https://mozilla.github.io/pdf.js/examples/
- Express 静态资源：https://expressjs.com/en/starter/static-files/

具体模型 ID、provider 行为和图像支持应在团队实际 DeepSeek 账户/代理端点上做一次小样验证；使用 DEEPSEEK_MODEL 等环境配置，避免把当前型号硬编码到业务逻辑。
