# Policy Lens v3

付款之前，先看清你买了什么。界面支持繁体中文和英文。

## 运行

1. 在仓库根目录运行 `npm install`。
2. 在仓库根目录的 `.env` 填写 `DEEPSEEK_API_KEY`（不要提交这个文件）。
3. 运行 `npm run start:v3`，或双击 `v3/start.command`，然后打开 http://localhost:4185 。

不要用 `python3 -m http.server` 启动：它无法处理上传的文件。数据库默认在 `.data/policy-lens-v3.sqlite`，可以用 `POLICY_LENS_DATABASE_PATH` 改位置，用 `POLICY_LENS_PORT` 改端口。

## 流程（上传真实保单）

1. **上传**：PDF 单份最多 10 MB、120 页，在本机提取文字，可以逐页查看或打开原 PDF。扫描件暂时不能识别。
2. **情境**：DeepSeek 快速读一遍保单，出 2–3 道和这份保单有关的选择题，可以略过。这里也可以加入附表、批单、宣传单 PDF，或粘贴顾问的回复。
3. **解读**：Agent 先用工具查条款，再流式写出结论。左边纸面跟着高亮正在读的原文，右边逐格填入；随时可以停止。
4. **一頁看懂**：六格结论（保甚麼、甚麼不保、最多賠多少、甚麼時候才賠、要準備甚麼、哪裏未說清），每格能展开原文；下面是「最容易看錯的數字」。
   - 如果缺附表等材料，会列出「還缺這些材料」。
   - 加入或移除附表、批单后，会提示「用新材料續查」。续查只把有新材料原文作证的格子标为「已更新」，并显示之前的说法。
5. **邊界場景**：滑杆、金额条、情况切换三种互动卡片。顶部「自己測一個情況」可以输入自己的情况，生成一张新卡片。
6. **核對承諾**：把顾问回复、宣传单里的每句承诺拆出来，逐条对照合同原文，分为「合同有依據」「說大了」「合同沒寫」「與合同相反」。
7. **提問**：把勾选的场景和承诺写成发给顾问的消息，附条款出处和顾问原话，可以复制或下载。

三份示例保单（旅遊、危疾、家居）使用预置数据，不调用模型，也没有「核對承諾」一步。

## 规则

- 结论只以合同类材料（条款、附表、批单）为依据。顾问回复和宣传单只在「核對承諾」里被核对，不会当作依据。
- 引文在原文里找不到逐字匹配时，卡片会标出「未能在原文逐字對上」，不会拿别的句子顶替。
- 中文输出使用繁体书面语，不用粤语口语；界面选英文时全部用英文，只有引文保留原文。

## 后端接口（`server/v3.ts`）

| 接口 | 用途 |
|---|---|
| `POST /api/reviews/:id/intake` | 预检：险种、主题色、情境问题 |
| `POST /api/reviews/:id/v3-stream` | 解读（SSE）；`resume: true` 为续查 |
| `POST /api/reviews/:id/v3-claims` | 核对顾问回复和宣传单（SSE） |
| `POST /api/reviews/:id/v3-whatif` | 自定义情景（SSE） |

材料的上传、粘贴和删除沿用原有接口：`POST /documents`、`POST /text-materials`、`DELETE /documents/:docId`。每个 SSE 任务最长 150 秒，浏览器断开或按停止会中止模型调用。

## 文件

```
index.html
css/base.css          设计变量、顶栏、按钮、印章、荧光笔
css/screens.css       各页面样式
css/visuals.css       三种互动卡片的样式
js/core.js            状态、双语、DOM 工具
js/documents.js       PDF 上传、读取和恢复
js/materials.js       补充材料抽屉
js/api.js             解读、核对、情景测试的数据流
js/visuals.js         threshold / split / branch 三种模板
js/screens/*.js       各步骤页面
js/data/*.js          三份示例保单
server.mjs            本机前端与后端
start.command         双击启动
```

动画库是 GSAP 3.12.5（从 cdnjs 加载）。系统开启「减少动态效果」时，动画会自动关闭。
