# 总任务板

更新：2026-11-13。唯一维护者：M0 当前会话。总计划 MASTER_PLAN.md；接口与归属 design/planning/module-contracts.md；最终结果 FINAL_ACCEPTANCE.md。

## 最新交付

最新視覺收口已完成：全瀏覽器寬度、全站橙色、原雜誌式斜向保單；插圖移除螢光並加附件紙張。次要操作改輕量文字按鈕，主要操作保留彈性；完成光帶與內容統一由上往下，色彩調淡。繁體中文、雙入口、原文分級與既有互動保留。實際 320–2560px/短屏、16 built 流程、17 元件、14 參考、42 控件、40 新方向、六產物檢查通過；獨立複核的小字對比及媒體規則優先級已修。詳見 design/planning/orange-fluid-quiet-downward.md。本條取代後文歷史主題色、膠囊數量與向上揭示描述。

主入口為 dist/experience.html（預設 dist/index.html），所有單獨元件為 dist/showcase.html。以下保留模組與歷史收口記錄。

## 独立模块会话

| 模块 | 会话链接 | 状态 | 会话内安排 | 模块报告 |
| --- | --- | --- | --- | --- |
| M1 | <t3-thread://v2/9f333038-a49f-412b-ba02-6b9b106c0698/thread:mcp:3475fb04-2bd0-4391-ba24-5bbb52b37e26:policy-lens-unified-modules-20261113-v1:0> | completed | 实施 Agent → 新只读复核 Agent → 修正完成 | design/modules/visual-system.md |
| M2 | <t3-thread://v2/9f333038-a49f-412b-ba02-6b9b106c0698/thread:mcp:3475fb04-2bd0-4391-ba24-5bbb52b37e26:policy-lens-unified-modules-20261113-v1:1> | completed | 实施 Agent → 新只读复核 Agent → 修正完成 | design/modules/shared-controls.md |
| M3 | <t3-thread://v2/9f333038-a49f-412b-ba02-6b9b106c0698/thread:mcp:3475fb04-2bd0-4391-ba24-5bbb52b37e26:policy-lens-unified-modules-20261113-v1:2> | completed | 实施 Agent → 新只读复核 Agent → 修正完成 | design/modules/policy-interactions.md |
| M4 | <t3-thread://v2/9f333038-a49f-412b-ba02-6b9b106c0698/thread:mcp:3475fb04-2bd0-4391-ba24-5bbb52b37e26:policy-lens-unified-modules-20261113-v1:3> | completed | 实施 Agent → 新只读复核 Agent → 修正完成 | design/modules/showcase.md |

四个会话继承用户当前 Codex 设置，在共享工作区按单文件归属实施。各自实施和新复核均已结束，主会话核读报告并完成整页验收。

| 模块 | 最终状态 | 实际结果 |
| --- | --- | --- |
| M0 | 完成总验收/交付 | 全量需求冻结；17/17整页场景、四入口资源审计、最终dist、宽窄/短屏浏览器检查通过。 |
| M1 | 实施/新复核完成 | 主题、标识、细线/网格、20色与四级语义，39项旧流程回归及19个渲染样本。 |
| M2 | 实施/新复核完成 | 共享弹性控件，42项生命周期、16项集成、17项修复检查；5项复核发现已修正。 |
| M3 | 实施/新复核完成 | 三份保单拖拽/键盘、匹配详情和牵引；隐藏焦点、边界、timer等问题已修正。 |
| M4 | 实施/新复核完成 | 所有真实模块接入；连续Hero/慢名称/背景色散、聊天与清单；离线构建和完整新复核通过。 |

## 最终交付门槛

- [x] R01–R17逐项对应最终页面，最新色散补充已验收。
- [x] 四模块完成实施与新只读复核，无未处理重大问题。
- [x] M0检查主题、控件、标记、连续动效与数据对应。
- [x] 320/390px、短屏、键盘、reduced-motion、重复/取消检查通过。
- [x] 独立dist/showcase.html离线运行，四入口资源审计通过。
- [x] 入口、接入说明、实际验证和材料边界齐全。

初次交付时M0的一处跨模块小修：app.js保单图alt不再引用旧橙色；最终构建已包含。最终概念色散检查未发现额外网格列或文字遮挡，无需追加生产修正。

主入口 [dist/showcase.html](dist/showcase.html)，验收 [FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md)，操作/接入 [README.md](README.md)。原始队列不变；后续激活消息对照已有覆盖，不重复实现。

用户再次确认荧光笔要求后，M0补齐聊天原文和提示配色、共享标记字体、显式1–4排序与最终原文。实施/定向验证见 design/planning/highlight-followup.md；原四模块会话维持完成状态。

PixelToggle重复要求已定向复核：补齐原生清单多选的紧凑共享皮层，按钮/目的地/动态建议已覆盖。验证和材料边界见 design/planning/choice-followup.md。

Notebook重复方向已收紧：付款前梳理文案、上下细线/淡边线网格纸；320/728/1100px浏览器与四入口资源检查通过。见 design/planning/notebook-followup.md。

独立组件说明页范围再次确认：7组可折叠Frontend usage已补齐，文件/DOM/代码/Team data边界明确，320/728px展开说明与构建资源检查通过。见 design/planning/component-guide-followup.md。

入口/标识/尺寸收口完成：实际图形替代旧PL、去除基础橙色回退；dist/index.html为最终组件指南别名，旧流程在dist/journey-reference.html。五产物审计与1440/768/390/320px浏览器检查通过。见 design/planning/identity-layout-followup.md。

CardSwap用途已复核：保单专用拖拽交换与对应原文保持正确，问题继续细线清单；1100/390px事件几何、728px展示及五产物审计通过。原引擎缺失边界就地说明。见 design/planning/policy-swap-followup.md。

保险书签牵引已落实：可选pullToken、bookmark演示、选中保单笔记重播、独立第8组用法说明。三保单/五阶段定向检查、17/17整页、五产物资源与宽窄屏边界检查通过。见 design/planning/bookmark-pull-followup.md。

纯前端丝滑转场收口完成：Surface19、Deck28、整页17及dist/五产物检查通过；fresh复核P2已修，实际宽窄浏览器通过。保留既有材料与Notebook风格，无后端/完整路径扩建。见 design/planning/frontend-motion-acceptance.md。

- [x] 概念→保单首页连续衔接反馈：共享真实标题/纸张、home全程占位、整词慢显、文字错峰、荧光套色。独立复核无P1/P2；交接12项、默认55/quiet/17整页/最终dist/五产物通过；实际1100中间态和728/390/320末帧检查通过。见 design/planning/concept-home-continuity.md。

- [x] 最新入口纠正：最初橙色海报式首页恢复，原概念整组独立放入#concept。橙色局部隔离，后续组件和17个受保护引擎/样式/原资源未改；17整页/最终dist/五产物及1100/390/320布局、首屏外概念暂停检查通过。见 design/planning/orange-cover-followup.md。

- [x] 双入口 mock 体验＋单页组件库：默认experience串联五步效果，showcase集中8组组件；所有纸张透镜品牌图标移除，改纯文字。数据聊天23项、source/built全流程16项、原组件17项、六产物及跨页链接检查通过；两项数据聊天P2已修，journey独立复核无P1/P2，7项额外中断检查通过。实际1100/728/390/320布局检查通过。见 design/planning/connected-mock-experience.md。

- [x] 卡片→详情衔接：抓取/牵引→落位纸片虚化退场→同一时钟逐层清晰；取消状态P2已修。20专项、56交互、17组件、16built体验、六产物和实际阶段布局检查通过，已同步两个入口。

- [x] 全站主要內容繁體中文化，保留 POLICY LENS 與美觀英文；精確引文／中文問答／匯出及320px排版完成。20 mock、17元件、14舊流程／預覽、16built流程、20落位、六產物與53定向複核修正檢查通過，兩項P2已修。見 design/planning/zh-hant-localization.md。
