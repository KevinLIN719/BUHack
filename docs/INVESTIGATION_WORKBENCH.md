# 真实调查入口、续查对照与主动边界测试

2026-11-14。本次在 `feat/deepseek-live` 上继续实现三个交付项，不替换现有调查模型或前端框架。

## 使用流程

1. `npm ci`，分别运行 `npm run dev:api` 和 `npm run dev`。
2. 打开 http://localhost:4173，点击「開始保單調查」。原有虚构体验保留为次要入口。
3. 上传合同 PDF，可以添加附表、批单、宣传或经纪沟通记录。
4. 可选填写目的地、投保对象、活动与关切，点击「儲存情況」。空白保持未知；未保存的修改会阻止启动任务，避免被误认为已采用。
5. 输入目标并调查。页面展示服务端记录的工具活动，支持取消；刷新可继续跟踪正在执行的任务。
6. Agent 如果读到相关且明确的时长下限，可自主调用 `testBoundary`。报告展示门槛前一分钟、等于、后一分钟的程序计算与出处。
7. 新增材料或保存背景后，旧报告明确提示输入已更新。点击「用新材料續查」，报告显示前后版本、添加的文件、变化的背景和前后结论。
8. 用「調查版本」查看旧报告，点击引用回到原文。续查使用最新的 investigate 报告，不以用户选中的旧版本或独立 scenario 测试为基础。

## 工具与数据边界

`testBoundary({sourceId, thresholdQuote, question, rationale})` 由模型决定是否调用及测试哪段。要求：来源在本次快照中且已通过 readSource 阅读；角色只能为合同/附表/批单；thresholdQuote 必须是原文的精确子串。每次运行最多保存两个不同测试，重复调用复用结果，计入总工具预算。

工具只接受单一、明确的时长下限。多数字、上下限不清、无比较词、非整分钟等情况返回 insufficient_information。没有相关数值规则时允许不调用，不伪造测试。测试结果由服务端计算并直接落盘，不依赖模型再次抄写；假设不进入用户真实背景。支持的是数值时长边界，尚不是滑雪方式等任意非数值反事实推理。

前后对照使用结论文字、证据类别与 sourceIds 的精确比较。重写的句子会同时列入“新增或改写”和“本次未再出现”；未再提出的补件要求不代表已经得到回答。页面同时提供前后结论与原文，避免用不可靠的自动语义匹配宣布问题已解决。

## 新增接口（均绑定原 cookie 会话）

- `GET /api/reviews/:id` 增加 `reportHistory`，按新到旧列出 runId、kind、goal、inputRevision、parentRunId、createdAt。
- `GET /api/reviews/:id/reports/:reportId` 读取特定运行的已保存报告；reportId 为 runId。无输出、其他会话或其他 review 返回 404。
- `GET /api/reviews/:id/runs/:runId/activity` 返回已落库的公开动作，不含模型内部推理、工具参数或材料正文。前端轮询；不是实时 SSE 订阅。
- 报告增加 `boundaryExperiments[]`（程序计算与解析引用）、`changes`（父报告对照）、`kind`、`goal`、`parentRunId`。

历史报告使用保存的 output，读取时补充引用和对照，不改写旧 output。删除材料仍遵守既有隐私清理行为：相关派生报告可能被清除，不能承诺删除后保留历史文本。

## 验证

`npm run check`、`npm run check:api`、`npm run test:api`、`npm run build`。

自动测试涵盖真实 SDK 对本地模拟模型的工具循环（含 testBoundary 与报告落盘）、严格/包含门槛、模糊规则拒绝、未阅读来源拒绝、引用伪造拒绝、对照持久化、历史报告不被覆盖、两会话隔离。自动测试不调用真实 DeepSeek。

浏览器验收使用隔离数据库、本地模拟模型和虚构 PDF：主页 → 上传 → 调查 → 边界结果 → 补充附表 → 续查前后对照 → 历史版本 → 刷新恢复。模拟模型不用于实际产品运行；正常 dev:api 仍使用团队自己的 DeepSeek 配置。

## 仍未实现

完整 issue/evidence dependency 档案、requestId 对应的回答/跳过闭环、任意非数值反事实研究、模型逐步检查点与崩溃恢复、OCR、专题子 Agent、官方资料搜索及多实例部署。本次没有把这些标为已完成。
