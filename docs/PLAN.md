# Policy Lens · 统一计划（单一事实来源）

更新：2026-11-14。本文合并并取代此前的计划与交接文档，是本仓库**唯一的进度与需求依据**。

| 项目 | 内容 |
| --- | --- |
| 产品 | Policy Lens：付款前把保单原文看清，用可核对的引用回答问题 |
| 形态 | 纯前端双入口（`experience.html` / `showcase.html`）+ 本机 Node 后端（`server/`） |
| 团队 | FE/UIUX 一名队友；用户负责后端 + Agent（当前由 AI 协作实现）；本分支 `feat/deepseek-live` |
| 需求来源优先级 | 本文 > `AGENT_V2_PLAN.md`（设计细节附录）> `HANDOFF.md` / `BACKEND_LOCAL.md`（已被本文吸收，仅留历史） |
| 已废弃 | `docs/SPEC.md`、`contracts/analysis.schema.json`（用户 2026-11-14 明确废弃，不再做 `AnalysisResult` 适配、`certainty` 三态、quote 240 字上限） |

---

## 1. 一句话与演示主线

用户上传保单 + 宣传单 + 附表 + 经纪沟通记录，提一个问题；Agent 自己检索原文、追查定义与除外、发现缺件、请求补充，然后用**逐字引用**给出结论、宣传对照、情景计算和经纪回复核验——每一条都能点回原文页码。

演示主线：问「去日本滑雪，这份旅行险有什么需要先确认？」→ 找到活动定义与除外 → 发现运动附表缺失 → 给出已能确认的部分并请求附表 → 上传附表 → 续查并重判受影响结论 → 用「普通雪道 / 越野滑雪」做情景对照 → 整理给经纪的问题清单。

材料与结论必须来自实际样本；不能预设某产品一定保或一定不保。

---

## 2. 进度总览

| 能力 | 状态 | 证据 |
| --- | --- | --- |
| 真文档 → 分页提取 → 逐页原文 / 引用 | ✅ 完成 | `server/ingest/*`、`materials.html` |
| 版面感知分块（页眉页脚 / 分栏 / 表格 / 段落 / 连字符） | ✅ 完成 | commit `406dfe6`，真实 QBE 保单复验 |
| Agent 主动调查（工具循环 + 引用校验） | ✅ 完成，真实 DeepSeek 联调通过 | `server/agent.ts` |
| 独立语义复核（第二条模型调用逐条判 verdict） | ✅ 完成 | commit `5379103` |
| 补件续查（`resumeFromRunId` successor run） | ✅ 完成 | commit `aa589de` |
| 宣传与合同对照（`comparisons`） | ✅ 完成 | commit `06d8c48` |
| 情景实验（`kind=scenario`，服务端确定性计算） | ✅ 完成 | commit `ad63442` |
| 经纪回复核验（`brokerClaims` + 粘贴沟通记录） | ✅ 完成 | commit `34abb48` |
| 正式前端接入（材料页「條款調查」区块） | ✅ 完成 | commit `32afe28` + `report.js` |
| 版本变化对照（`supersedes`，旧结论被新材料改变） | ✅ 完成，真实联调 3 条对照 | 本批次，`server/agent.ts` 校验 + `server/report.ts` 按材料版本发布 |
| 提问清单导出（`GET /api/reviews/:id/questions/export?format=md`） | ✅ 完成，材料页有下载链接 | 本批次，`server/export.ts` + `report.js` |
| 一页概览（报告顶部「先看這幾件事」） | ✅ 完成，服务端确定性排序（模型不参与） | 本批次，`server/overview.ts` + `report.js` |
| OCR（扫描件） | ⛔ 未做（只标 `needs_ocr`） | — |
| SSE 实时推送、run 重启恢复、失败原因分类 | ✅ 完成，服务端推送 + 心跳 + 断线续传；重启中的 run 标 `interrupted` | commit `f091353`（服务端）+ `9fbf380`（材料页改用 EventSource） |
| 材料页进度由事件驱动 | ✅ 完成，进度行显示「已讀取第 N 段材料」 | commit `9fbf380` |
| 真实公开保单复验 | ✅ 完成（QBE 香港 9 页，13 处引用全 verified） | `REAL-CONTRACT-TEST.md` |
| `experience.html` 主流程接真实后端 | ⛔ 未做（仍是 mock，属前端队友） | — |
| 语言切换（i18n）词典覆盖率 | ⚠️ 有缺陷（见 `I18N-TEST-REPORT.md`） | commit `28148da` |

---

## 3. 分工与文件归属

| 区域 | 负责人 | 文件 |
| --- | --- | --- |
| 视觉 / 组件 / 动效 / mock 体验 / i18n | 前端队友 | `*.html`、`ui-*.css`、`policy-*.js`、`experience-*.js`、`showcase-*.js`、`i18n.js`、`translations.js`、`design/` |
| 后端 API / 存储 / 解析 | 后端队友/用户 | `server/index.ts`、`server/app.ts`、`server/store.ts`、`server/ingest/*` |
| Agent / 工具 / 校验 / 报告视图 | 用户 | `server/agent.ts`、`server/scenario.ts`、`server/report.ts`、`server/tests/*` |
| 真实材料页接入 | 用户（新增文件，不动队友逻辑） | `materials.html` 尾部区块、`report.js`、`report.css`、`materials.js` 的两个钩子 |
| 静态白名单 | 共用，改动需通知 | `scripts/serve.mjs`（**新增根目录静态文件必须加白名单，否则 404**） |

原则：一个生产文件只有一个负责人；跨模块需求先提接口请求。`experience-data.js` / `policy-fixtures.js` 保留 demo 用途，真实失败不得回退成样例成功。

---

## 4. 本地运行与验收

需要 Node.js **>= 24.14**。

```bash
npm ci            # 或 npm install
npm run dev:api   # 终端 1：后端 http://localhost:3001
npm run dev       # 终端 2：前端 http://localhost:4173
```

浏览器打开 `http://localhost:4173/materials.html`。4173 把 `/api/*` 代理到 3001，cookie 同源；改后端端口要在前端启动前设 `API_PORT`。直接 `file://` 打开只有 demo 能力。

`.env`（不入 Git）：`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`。无 Key 时上传和原文阅读照常，`POST runs` 返回 `503 AGENT_NOT_CONNECTED`。

**四条检查**

```bash
npm run check       # 全部 js 语法
npm run check:api   # tsc 类型
npm run test:api    # 22 组后端测试（本地 mock 模型，不花钱）
npm run build       # 静态构建
```

**五分钟验收**：`npm run sample:pdf` 生成虚构 PDF → 上传为合同 → 看逐页原文与引用 → 点引用跳到原 PDF 页 → 刷新材料仍在 → 重复上传去重 → 删除连带清理 → 材料页「條款調查」填问题点开始 → 约 10–20 秒出结论、引用、语义复核、补充请求。

> 沙箱限制（本机开发机）：`npm run test:api`、`node --import tsx`、`npm run dev:api`（esbuild）在 DSH 沙箱内会 `spawn EPERM`，需提权执行；用户自己的终端无此问题。

---

## 5. 技术架构

- 后端：Node 24 + TypeScript + Express 5 + Zod + `node:sqlite`（单文件 `.data/policy-lens.sqlite`）
- PDF：`pdfjs-dist`，独立 worker 线程，20 秒超时 + 内存预算，按版面坐标分块
- Agent：AI SDK v7（`@ai-sdk/deepseek` + `ToolLoopAgent`），工具循环最多 14 步 / 24 次工具 / 120 秒
- 前端：原生 HTML/CSS/JS，无框架、无构建依赖（`scripts/build-preview.mjs` 内联资源）

**数据与版本模型**

- 每个 review 一份持久档案；SQLite 存 documents / pages / sources / runs / investigations / run_events。
- 原文件字节以私有 BLOB 存放，不放静态目录；`sources` 是引用单位（`sourceId = ${documentId}:p${pageIndex}:b${blockIndex}`）。
- `reviewRevision` 是统一递增版本；上传/删除材料、改背景、接受回答都会 +1。每个 run 固定一个输入快照。
- 发布前在事务内检查 run 未取消、review 未删除、revision 仍匹配；旧结果只能作为历史，不能覆盖当前结果。

**run 生命周期**：`queued → running → awaiting_input | completed | partial | failed | cancelled`。`awaiting_input` 表示已释放 worker 并保留报告 + 补充请求，用户补件后建 successor run。

**防幻觉四闸**

1. **schema**：模型输出必须通过 Zod；失败先自动重试一次（更严格的输出要求），再走修复路径，最后才 failed。
2. **引用绑定**：`sourceIds` 必须是本次运行实际读过的 source，`quote` 必须是对应原文的**逐字子串**（`normalizeText` 后比较）；不满足则拒绝该条。
3. **服务端重算**：情景阈值比较由 `server/scenario.ts` 计算，模型只能照抄；结果不一致则拒绝。
4. **独立语义复核**：发布后第二条无工具模型调用，逐条判断「引用原文是否支持这条结论」，失败降级为 `unavailable`，不使 run 失败。

**向 DeepSeek 加 schema 字段的铁律**：所有字段必填、不加 `maxItems` / `maxLength` / `.min()` 约束——兼容模式会把 schema 写进 system prompt，带约束会让模型无法满足并直接抛 `NoObjectGenerated`（见 `BACKEND_LOCAL.md`「模型容错」）。

---

## 6. 当前接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/reviews` | 建审阅 + 匿名会话 cookie |
| GET | `/api/reviews/:id` | 恢复审阅：材料、版本、任务、`currentReport` |
| PATCH | `/api/reviews/:id/context` | `expectedRevision` + context |
| POST | `/api/reviews/:id/documents` | multipart `role` + `file` → 202 排队解析 |
| GET | `/api/reviews/:id/documents/:docId` | 状态、页数、逐页完整性 |
| GET | `/api/reviews/:id/documents/:docId/pages/:pageIndex` | 某页原文 + sourceIds |
| GET | `/api/reviews/:id/documents/:docId/content` | 受会话保护的原件（PDF 或粘贴文本） |
| DELETE | `/api/reviews/:id/documents/:docId` | 删除原件、页、引用 |
| GET | `/api/reviews/:id/sources/:sourceId` | 原文、版本、页码出处 |
| POST | `/api/reviews/:id/text-materials` | 粘贴沟通记录（`role`/`fromWhom`/`capturedAt`/`text`）→ 一页原文材料 |
| POST | `/api/reviews/:id/runs` | `expectedRevision` + `kind`(`investigate`/`scenario`) + `goal`，可选 `resumeFromRunId` |
| GET | `/api/reviews/:id/runs/:runId` | 状态、`report`、`inputRequests` |
| GET | `/api/reviews/:id/runs/:runId/events` | SSE：先重放（`after` / `Last-Event-ID` 续传），未结束则持续推送 + 15s 心跳，终态自动关闭 |
| GET | `/api/reviews/:id/questions/export?format=md` | 提问清单导出（Markdown 附件；无报告时 404 `REPORT_NOT_FOUND`） |
| POST | `/api/reviews/:id/runs/:runId/cancel` | 取消，可重复调用 |
| DELETE | `/api/reviews/:id` | 删除审阅及其派生数据 |

`role` 五值：`contract` / `promotion` / `schedule` / `endorsement` / `broker_reply`。预算：单文件 10 MB / 30 页，每次审阅 8 份。

**错误码**：`INVALID_INPUT`、`REVISION_CONFLICT`(409)、`NO_NEW_INPUT`、`PARENT_RUN_ACTIVE`、`PARENT_RUN_NOT_RESUMABLE`、`PARENT_RUN_NOT_FOUND`(404)、`DOCUMENT_LIMIT`(413)、`AGENT_NOT_CONNECTED`(503)。同一 `Idempotency-Key` + 相同请求返回同一任务，内容不同 409。

---

## 7. 报告结构（`GET /api/reviews/:id` 的 `currentReport`）

| 字段 | 含义 |
| --- | --- |
| `runId` / `runStatus` / `createdAt` / `inputRevision` | 这份报告来自哪个任务、哪个输入版本 |
| `findings[]` | 结论：`explanation`、`evidenceStatus`（`document_supported` / `interpretation` / `unknown`）、`citations[]`（`sourceId`、`documentName`、`role`、`pageIndex`、`pageLabel`、`quote`、`status: verified/missing`） |
| `citationIntegrity` | `{cited, verified, missing}` 计数；材料被删后引用变 `missing`，不改写结论 |
| `review` | 语义复核：`status`（`checked` / `issues_found` / `unavailable` / `not_applicable`）+ `items[{index, verdict, note}]`；verdict = `supported` / `partial` / `unsupported` / `quote_mismatch` |
| `comparisons[]` | 宣传对照：`relation`（`supported_with_conditions` / `apparent_conflict` / `insufficient_basis`）+ 两侧逐字引用 + `explanation`；丢弃数 `droppedComparisons` |
| `scenarios[]` | 情景实验：`question`、`assumption`、`thresholdQuote`、`actualValue/Unit`、`status`（`satisfied` / `not_satisfied` / `boundary` / `insufficient_information`）、`detail`、`unknowns`、`citations` |
| `brokerClaims[]` | 经纪核验：`verdict`（`supported` / `overstated` / `not_in_contract` / `contradicted`）+ `brokerQuote` / `contractQuote` + 两侧引用 + `explanation`；丢弃数 `droppedBrokerClaims` |
| `supersedes[]` | 版本变化对照：`previousIndex` / `previousConclusion`（父报告结论原文）/ `verdict`（`unchanged` / `strengthened` / `weakened` / `reversed` / `withdrawn`）/ `currentIndex`（撤回为 -1）/ `explanation` / 新旧引用；`supersedesUnchecked` = 这次没重新核对的旧结论数 |
| `citationIntegrity` | `cited` / `verified` / `missing`（原文已被删除的引用仍列出，标 `missing`，不改写结论） |
| `requests[]` / `openQuestions[]` | 补充请求与待问清单 |
| `verification` | 一句话说明本次做了哪些校验 |

边界（写进 UI 也要写进文档）：不判断条款是否合法、不判断是否赔付、不核实说话人身份、不把粘贴记录当官方文件。

---

## 8. 已完成明细

### 8.1 前端（队友）

- 双入口纯前端交付：`experience.html`（默认 `dist/index.html`，五步 mock 体验）+ `showcase.html`（8 组独立元件 + 接入说明），`dist/` 下另有 journey / concept / completion 三个参考页。
- 视觉：橙色 `#F24E2A`、纸质保单、细线 notebook、20 色参考与 1–4 级标记、全浏览器宽度、窄屏不缩放海报。
- 动效：概念动画（16 个保险公司名）、Deck 拖拽/交换、书签牵引、清单生成光洗、`reduced-motion` 全兼容。
- 繁中本地化：主要界面、示例保单、聊天、导出清单均为 zh-Hant-HK；机器 ID / enums 未改名。
- 语言切换：`i18n.js` 支持 `?lang=` / localStorage / navigator，机制正确但词典是片段式、覆盖率仅 1–4%，`materials.html` 未加载（详见 `I18N-TEST-REPORT.md`，属队友待修）。

### 8.2 后端基础（后端队友/用户）

- `server/index.ts` / `app.ts` / `store.ts`：Express + SQLite + cookie 会话隔离 + 版本校验 + 幂等。
- `server/ingest/*`：PDF worker（超时、内存预算、重启重排队）、分页解析、材料删除的连带清理。
- 安全：cookie token 才是凭据、`%PDF-` 魔数校验、私有 BLOB、`nosniff` + CSP sandbox、监听 127.0.0.1、SQL 全参数化、原文 `textContent` 渲染。

### 8.3 Agent（用户）

- 工具：`listDocuments` / `searchSources` / `readSource` / `evaluateScenario`；`readSource` 容忍被截断的 sourceId 并返回可用列表。
- 报告校验：引用逐字子串 + role 白名单 + 服务端重算 + 空态优先；无法核对的条目整条丢弃并计数，不使 run 失败。
- 补件续查：`parentRunId`、`run.resumed` 事件、`prior{findings, openQuestions, requests}`、新文件清单、旧引用须重读。
- 真实样本复验：QBE 香港全年旅游险 9 页真实保单，13 处引用全部 verified，正确识别除外 (k) 但括号豁免滑雪（见 `REAL-CONTRACT-TEST.md`）。

### 8.4 真实材料页（前端队友/用户）

`materials.html` 底部「條款調查」由 `report.js` / `report.css` 驱动：填问题 → 开始调查 → 事件流（SSE，轮询兜底）→ 渲染结论 / 引用（点击跳原文页）/ 语义复核 / 宣传对照 / 情境實驗 / 經紀回覆核驗 / 补充请求 / 待问清单；有新加材料时出现「用新材料續查」。

### 8.5 PR #1 之后的增量（`0d034c3..HEAD`，19 个 commit，34 文件 +3484/−90）

按交付顺序，一行一件事、可用来核对提交历史：

| # | 做了什么 | commit |
| --- | --- | --- |
| 1 | 修 Windows 下 pdfjs 路径必须正斜杠结尾（否则所有 PDF 上传失败） | `18ff437` |
| 2 | 补件续查：`resumeFromRunId`、`parentRunId`、`run.resumed`、`NO_NEW_INPUT` / `PARENT_RUN_*` 错误码 | `aa589de` |
| 3 | `currentReport` 带页码解析与 `citationIntegrity`（材料被删标 `missing`） | `57dc489` |
| 4 | 开发自检页 `assets/dev-report.html`（可视化 currentReport） | `1fae9a9` |
| 5 | PDF 标为 binary，避免 git 换行转换破坏字节 | `526d620` |
| 6 | 独立语义复核：第二条无工具模型调用逐条判 `supported/partial/unsupported/quote_mismatch` | `5379103` |
| 7 | 材料页接真实调查（`report.js` / `report.css` + 引用点击跳原文） | `32afe28` |
| 8 | i18n 语言切换实测报告（覆盖率 1–4%，交给前端队友修） | `28148da` |
| 9 | 宣传与合同对照 `comparisons`（三态 + 双侧逐字引用 + 服务端重算） | `06d8c48` |
| 10 | 情景实验 `kind=scenario` + `evaluateScenario`（阈值比较由服务端确定性计算） | `ad63442` |
| 11 | 去掉 schema 长度/数量上限 + 模型输出格式不符时自动重试一次（修复真实调查失败） | `0c30abd` |
| 12 | 真实 QBE 保单端到端复验记录 | `877b330` |
| 13 | PDF 改为版面感知分块（页眉页脚 / 分栏顺序 / 表格行 / 段落 / 连字符） | `406dfe6` |
| 14 | 经纪回复核验 `brokerClaims` + 粘贴沟通记录（来源/时间/对话内容三栏） | `34abb48` |
| 15 | 合并全部计划与交接文档为 `PLAN.md`（本文） | `4186d4d` |
| 16 | 版本变化对照 `supersedes`（五 verdict）+ 提问清单 Markdown 导出 | `b4ac3ff` |
| 17 | 一页概览「先看這幾件事」（服务端确定性排序，最多 3 条 + 剩余计数） | `569ef53` |
| 18 | 系统健壮性：SSE 推送 + 心跳 + 断线续传、`interrupted` 状态、`classifyFailure` 六类原因 + `stopReason` | `f091353` |
| 19 | 材料页改用 EventSource 驱动进度，轮询作兜底 | `9fbf380` |

---

## 9. 未完成（按优先级）

后端与 Agent 的能力清单已全部交付；下表只剩**可省略项**，删掉也不影响演示与验收（理由列在判据里）。

| # | 事项 | 判据 | 量级 |
| --- | --- | --- | --- |
| 1 | OCR | 扫描件走独立 OCR，低质量结果标「待核验」并给页图；不静默丢弃页。**可省略**：HANDOFF 已把「不做 OCR」写成已知边界，验收只要求「低质量 OCR 显示待核验」，当前策略是直接标 `needs_ocr` 不猜测 | 大 |
| 2 | 专题子 Agent / 限定官方资料搜索 | 只读子 Agent 返回证据与反例；官方域名白名单搜索。**可省略**：`AGENT_V2_PLAN.md:283` 原文为「再加入……**或**……，每项需能证明提高调查质量」，属加分实验项 | 大 |
| 3 | 工程打磨（可选） | 多实例 worker 租约、限流退避重试、`experience.html` 主流程接真后端（见 §10 第 1 条） | 中 |

验收标准原文见 `AGENT_V2_PLAN.md:287`（自主性、反例、续查、证据、增量、情景、回复、系统、安全、告知）。逐条对照见 §11 之后的「验收对照」小节。

---

## 10. 移交给前端队友的事项

1. **`experience.html` 主流程接真实后端**（最重要）：`experience.js` 把 fixtures 状态改为 review/report 状态，`renderReading()` 渲染后端 findings/sources/scenarios；`experience-chat.js` 的 `submit()` 从本地 `PolicyExperienceData.reply` 改为创建 run 并订阅事件，`showSource()` 用 `sourceId` 而不是 `findingId`；`policy-workbench.js` 的「quote 必须在单一 excerpt 内」改为多来源查看器。
2. **i18n 词典修复**：按 `I18N-TEST-REPORT.md` 的修法 A（加 `data-i18n` 标记 + 整句重写词典）或 B（先补 `materials.html`）；`materials.html` 目前未加载 `i18n.js`。
3. **新模块接入**：建议 `api-client.js` / `review-store.js` / `agent-run.js` / `document-upload.js` / `source-viewer.js` / `scenario-lab.js`；新增根目录静态文件要同步 `scripts/serve.mjs` 白名单。
4. **可复用**：材料页的 `report.js` 已实现报告渲染，可直接抽成模块；`assets/demo-contract.pdf` + `assets/demo-promotion.pdf` 是虚构演示素材。
5. **`assets/dev-report.html` 的处置**：这是开发自检页（临时调试用），正式交付前可删或移到 dev 目录；它依赖 `/assets/demo-contract.pdf`。
6. 原文区禁止被界面翻译改写（i18n 需加排除标记），引用必须显示 PDF 页序与印刷页码。

---

## 11. 已知边界与限制

- 仅本机单实例开发；监听 127.0.0.1；上线需 HTTPS、安全 cookie、会话生命周期、速率与容量限制。
- 提取只读文本层，不做 OCR、不推断缺失文字；分块长度不固定，长段在工具返回时按预算截断（`searchSources` 320 字 / `readSource` 目标段 1600 字、相邻段 480 字），但引用以数据库中完整分块为准。
- `GET events` 是持续 SSE：先重放已发生事件（可用 `after` / `Last-Event-ID` 续传），run 未结束时继续推送并每 15s 发一次心跳，到终态（`awaiting_input` / `partial` / `failed` / `interrupted` / `cancelled`）自动关闭；材料页已改用 EventSource，无事件 20 秒或浏览器不支持时自动退回轮询。
- 服务重启时正在跑的 run 标记 `interrupted`（事件带 `reason: server_restarted`），业务状态与材料都保留，需重新点一次「開始調查」。
- 情景 run 与调查 run 共用 `currentReport`（取最近一次已发布报告），情景跑完后 findings 会被情景 run 的结论替换。
- 真实调用会把本次材料与问题发给配置的模型平台；UI 需在上传前告知并支持删除。
- `.env`、`.data/`、`node_modules/`、`dist/` 不入 Git。

---

## 11.5 验收标准对照（`AGENT_V2_PLAN.md:287` 逐条）

| 验收项 | 现状 | 证据 |
| --- | --- | --- |
| 自主性：不同材料走不同工具路径 | ✅ | 真实 DeepSeek 两次调查的工具序列不同（QBE 9 页 vs 示例 2 页） |
| 反例：后页除外能追查并调整结论 | ✅ | `REAL-CONTRACT-TEST.md`：除外 (k) 后括号豁免滑雪 |
| 续查：缺件指出文件与原因，重启后可继续 | ✅ | `aa589de` + successor run 测试；材料保留在 SQLite |
| 证据：无依据结论/金额不能发布 | ✅ | 引用逐字校验 + 语义复核 + `citationIntegrity` |
| 增量：新材料改变旧结论时被复核；旧 run 不覆盖新版 | ✅ | `b4ac3ff` `supersedes` + `latestReportRun` 按 `inputRevision` 排序 |
| 情景：阈值/起算/单位/上限不混淆，不自编公式 | ✅（工程部分） | `server/scenario.ts` 确定性计算；起算不明 → `insufficient_information` |
| 回复：经纪说「都可以」时保留未获证据的问题 | ✅ | `34abb48`：`not_in_contract` + 空合同侧 + 提问清单 |
| 系统：重复点击、SSE 重连、取消、限流、预算耗尽有可解释状态 | ✅ | `f091353` 六类 `stopReason` + `interrupted` |
| 安全：工具指令不改变权限、接口校验会话、原文安全渲染 | ✅ | 系统提示把材料列为不可信；cookie 会话；`textContent` |
| 告知：上传前说明第三方模型分析与删除权 | ✅ 已实现删除与说明文案 | `materials.html` 上传区文案 + 删除接口 |

---

## 12. 文档索引

| 文件 | 状态 |
| --- | --- |
| `docs/PLAN.md` | **本文，唯一权威** |
| `docs/AGENT_V2_PLAN.md` | 设计细节附录（架构、工具契约、run 实现要求、里程碑、验收标准） |
| `docs/BACKEND_LOCAL.md` | 接口与字段细节附录（本文 §6/§7 的来源与展开） |
| `docs/HANDOFF.md` | 历史交接记录（已并入本文 §4/§8/§10） |
| `docs/BACKEND_AGENT_PLAN.md` | 已废弃（旧固定流水线设计，被 AGENT_V2_PLAN 取代） |
| `docs/PR_BACKEND_FOUNDATION.md` | 历史 PR 描述草稿 |
| `docs/REAL-CONTRACT-TEST.md` | 真实保单复验记录（证据附录） |
| `docs/I18N-TEST-REPORT.md` | i18n 缺陷报告（给前端队友） |
| `MASTER_PLAN.md` / `WORKSTATE.md` | 前端模块与视觉交付的历史计划与检查点（前端侧有效） |
| `README.md` | 前端使用说明 |

---

## 13. 变更记录

- 2026-11-14：新增本文，合并 `AGENT_V2_PLAN` / `HANDOFF` / `BACKEND_LOCAL` / `BACKEND_AGENT_PLAN` / `PR_BACKEND_FOUNDATION`；补入已完成（版面分块、宣传对照、情景实验、经纪核验、粘贴材料、正式前端接入）与未完成/移交清单。
- 2026-11-14：版本变化对照（`supersedes`）与提问清单导出完成；`currentReport` 改为按材料版本取最新报告，旧 run 迟到结果不再覆盖新版。
- 2026-11-14：一页概览完成（`overview.items` 最多 3 条 + `remaining` 计数，`server/overview.ts` 纯函数排序：经纪冲突 > 宣传冲突 > 引用不支持 > 无法确认 > 情境缺条件 > 补充材料）；文档标注 OCR 与专题子 Agent 为可省略项。
- 2026-11-14：交接定稿。材料页改用 EventSource 驱动进度（`9fbf380`）；§8.5 补齐 `0d034c3..HEAD` 19 个 commit 的逐项交付；§9 未完成收敛为两项可省略项 + 可选打磨；新增 §11.5 验收标准逐条对照。
- 2026-11-14：系统健壮性完成：`GET events` 改为持续 SSE（重放 + 心跳 + 终态关闭 + `after`/`Last-Event-ID` 续传）；服务重启中的 run 由 `failed` 改标 `interrupted`（保留材料，提示重新开始）；新增 `classifyFailure`（`timeout`/`budget_exhausted`/`rate_limited`/`model_unreachable`/`model_output_invalid`/`model_failed`）与 `stopReason` 对外暴露，材料页按原因给一句可操作提示；步数预算 14、时间预算 120s 显式化。
- 2026-11-13：PR #1（`feat/backend-pdf-handoff`）交付后端基础；用户接替队友在 `feat/deepseek-live` 继续。

