# 真实合同测试记录

用一份公开可下载的真实保单条款做端到端测试，替代此前 2 页的虚构 DEMO 材料。

## 测试材料

| 项目 | 值 |
| --- | --- |
| 文件 | `Annual Travel Insurance Policy 全年旅遊保險`（QBE Hongkong & Shanghai Insurance Limited） |
| 来源 | https://www.qbe.com/media/qbe/asia/hongkong/files/qtouch/policy-wording/annual-travel_policy-wording_rv1.pdf |
| 大小 | 576,175 字节 |
| 页数 | 9 |
| role | `contract` |

本地路径（不入 Git）：`bu-v2/.data/real/qbe-travel-policy.pdf`

## 结果一：调查（investigate）

问题：「我在日本滑雪受伤，这份保单的意外医疗最高赔付多少？如果不赔付，依据哪一条除外责任？我还需要补充什么材料？」

- 文档解析：`ready`，9 页全部提取
- 模型输出第一次不符合 schema，`generateWithRetry` 自动重试一次后成功（证明容错路径有效）
- run 状态：`awaiting_input`（需要补件）
- 结论：7 条
- 引用完整性：`{cited: 13, verified: 13, missing: 0}` —— 13 处引用全部逐字命中原文
- 语义复核：`checked`

结论质量抽样（均为模型自主找到的原文，非模板）：

- Benefit 1 Medical Expenses 限额按计划不同：Silver HK$500,000 / Gold HK$1,000,000 / Diamond HK$3,000,000，因此「意外医疗最高赔付」无法给单一数字。
- 除外条款 (k) 把 extreme or adventurous sports 列为除外，但括号内明确豁免 `skiing, snowboarding... which are covered under the Policy` → 休闲滑雪不在该除外内。
- 同时指出仍可能不赔的情形：专业身份或有报酬参与运动 (j)、海拔 5,000 米以上登山、Pre-existing Medical Conditions (c) 等。
- 减少赔付的规定：半私家房 50% / 单人房或私家房 25% 调整、70 岁以上按限额 50%、其他保险的超额赔付条款。
- 主动声明缺口：附表（Schedule）不在材料内，无法确定实际购买的计划等级与地域限制。

要求的补件：附表/保单凭证页、宣传或经纪书面回复、批单全文、日本就诊记录与费用收据、理赔申请书。

## 结果二：情景实验（scenario）

问题：「这次只关心行李延误保障：行李延误多久才开始赔？赔多少？」
情景假设：「如果行李延誤 9 小時，可以賠多少？」

```
status: insufficient_information
thresholdQuote: "in excess of the time as specified in the Table of Benefits"
detail: 条款正文只写「超过附表所列时间」，该门槛的具体时长载于附表而非正文，
        因此正文本身无可比较的数字；假设的 9 小时无法据此判定是否已达门槛。
citations: 1（已核对原文）
```

仍需确认 6 项：事件定义、起算时点、是否需先超过门槛才赔首段、所投档次与上限、除外与证明文件、与其他保险的超额关系。

**这条是想要的正确行为**：门槛数字不在正文里，系统不猜、不编赔款公式，而是明确返回「条件不足，无法比较」并指明缺什么。

## 复现步骤

1. 浏览器打开保单 PDF，另存为本地文件
2. 启动后端 `npm run dev:api` + 前端 `npm run dev`
3. 打开 `http://localhost:4173/materials.html`
4. 材料类型选「保險合同」，上传 PDF，等状态变「原文已可查看」
5. 填问题 → 開始調查（约 30–60 秒）
6. 调查完成后出现「情境實驗」输入框，填「如果延誤 9 小時」→ 測試情境

## 遗留观察

- 保单附表数字是表格排版，被拆成多个文本块（如 `full hrs, 1,000 every 6 full hrs thereafter`），模型能引用但无法还原表格结构；这类「每 N 小时递增」的累计规则目前按设计返回 `insufficient_information`。
- 该 PDF 只有 9 页，未触及 30 页上限与 10MB 上限。
