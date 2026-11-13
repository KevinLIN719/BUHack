# 后端与原文阅读交接

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

源码已接入 ToolLoopAgent + DeepSeek，模型可自行 listDocuments / searchSources / readSource。测试用本地模拟端点验证检索→阅读→JSON 输出，未验证真实 DeepSeek 账户。没有 Key 时不产生模型请求；上传页不会启动 Agent。

如要联调，在本机 .env 配置 DEEPSEEK_API_KEY、实际 DEEPSEEK_BASE_URL / DEEPSEEK_MODEL 后重启后端。创建任务与轮询方法见 BACKEND_LOCAL.md。真实调用会将本次材料和问题交给所配置的模型平台处理。

当前结果只检查 schema、引用归属和引用是否被工具观察到，尚无独立语义复核，因此标为 partial；有补充请求则为 awaiting_input。不能据此声称完整审阅或确定赔付。运行中重启会标记失败，需要新建任务；尚未实现模型步骤持久恢复。

## 下一位成员建议顺序

1. 用团队实际 DeepSeek 账户完成最小真实联调，确认 tool calling 和结构化输出兼容。
2. 完成 input_requests 持久化及补件 successor run，复用已查证据并检查版本。
3. 增加 resolveReference 和独立语义复核，之后再把调查工作台接到界面。
4. OCR、情景计算、宣传对照和经纪回复核验逐项增加。

## 交接边界

- 前端样例聊天仍为模板，上传页没有将真实材料接到样例聊天。
- 初始限额为单文件 10 MB / 30 页，每次审阅 8 份 PDF；图片不接受，扫描页未 OCR。
- GET events 目前重放已存事件，持续执行可轮询 GET run；尚无实时 SSE 心跳订阅。
- 仅本机单实例开发。跨机器部署需要重新配置会话、HTTPS、持久存储和容量限制。
- .env、.data/、node_modules/、dist/ 不交接到 Git。队友使用自己的配置和材料。
- 详细设计：AGENT_V2_PLAN.md；当前接口：BACKEND_LOCAL.md；PR 描述草稿：PR_BACKEND_FOUNDATION.md。
