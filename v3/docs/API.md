# Policy Lens · 后端数据契约

下面是新版前端的分析事件设想。当前仓库后端的调查接口和事件格式与此不同，尚需适配，不能只加一行配置就接通真实分析。真实 PDF 上传与原文读取已通过 `js/documents.js` 接到现有后端；示例保单仍使用内置数据。

## 接口

```
POST {API_URL}/analyze
Content-Type: application/json
{ "fileId": "...", "context": { "flight": ["connect"], "act": ["ski"] }, "lang": "zh" }
```

返回 `text/event-stream`（SSE），每条是 `data: <JSON>\n\n`。

以下配置只适用于未来提供了上述 `/analyze` 事件接口的服务，不适用于当前仓库后端：

```html
<script>window.PL = { API_URL: 'https://your-backend' };</script>
```

没设置 `API_URL` 时，示例流程会走内置的三份示例保单。真实文件目前只支持查看原文。

## 为什么要流式

解读动画是按事件逐条播放的：
- 每收到一条 `finding`，前端就在纸面上找到 `quote` 那句原文，用荧光笔划出来，再飞进右侧总结。
- 动画放在队列里依次播。后端快就连着播，后端慢扫描线就继续扫着等。
- 所以**每条都必须带原文 `quote`**，并且要和文件里的文字逐字一致，前端才找得到这一句。

## 事件

所有文本字段都可以是字符串，也可以是 `{ "zh": "...", "en": "..." }`。

### 1. `document`：文件已打开

```json
{ "type": "document", "title": "晴程旅遊保 · 保單條款" }
```

### 2. `finding`：「一頁看懂」的 6 格，每格一条

`key` 是以下六个之一：`covers` `excludes` `max` `when` `docs` `unclear`

```json
{
  "type": "finding",
  "key": "when",
  "answer": "延誤要超過 6 小時才開始賠",
  "quote": "受保人預定乘搭之航班如因惡劣天氣……每連續延誤超過 6 小時，本公司賠償 HK$200，最高 HK$1,000。",
  "page": 6,
  "section": "4",
  "lineId": "d1"
}
```

`lineId` 可选。有的话按它定位；没有就按 `quote` 的文字匹配。

### 3. `gap`：最容易看错的一个数字（保障表 vs 细则）

```json
{
  "type": "gap",
  "says": "最高 HK$1,000",
  "reality": "每超過 6 小時才賠 HK$200……",
  "table":  { "quote": "航班延誤 …… 最高 HK$1,000", "page": 1, "section": "" },
  "detail": { "quote": "……每連續延誤超過 6 小時，本公司賠償 HK$200……", "page": 6, "section": "4" },
  "visual": { "kind": "split", "...": "见下文" }
}
```

### 4. `scenario`：边界场景，每个一条

```json
{
  "type": "scenario",
  "id": "tr-delay",
  "status": "excluded",
  "title": "航班延誤 5 小時 50 分",
  "why": "差 10 分鐘未過門檻，一分錢都沒有。",
  "question": "若航班剛好延誤 6 小時，是否符合「超過 6 小時」？",
  "quote": "……每連續延誤超過 6 小時……",
  "page": 6,
  "section": "4",
  "tags": ["connecting"],
  "visual": null
}
```

- `status` 取值：`covered` 有保障 / `partial` 只賠部分 / `excluded` 寫明不賠 / `ask` 字眼模糊 / `silent` 條款沒寫
- `tags` 和情境页选项的 `tags` 对上时，卡片会显示「與你有關」并排到前面。
- `visual` 是可选的，三种通用模板见下文。返回 `null` 就显示为普通卡片。

### 5. `done`

```json
{ "type": "done" }
```

## 三种可视化模板（`visual`）

模型只需要选一种 `kind`，再填参数，前端负责动画。

### `threshold`：门槛滑杆

适用于时数、天数、期限这类有一条界线的情况。

```json
{
  "kind": "threshold",
  "format": "hm",
  "min": 0, "max": 36, "step": 0.1666, "limit": 6, "value": 5.8333,
  "okSide": "above",
  "unit": "延誤時數",
  "rate": { "every": 6, "amount": 200, "cap": 1000 },
  "outcomes": {
    "below": { "status": "excluded", "text": "未過門檻" },
    "at":    { "status": "ask",      "text": "剛好 6 小時，算「超過」嗎？" },
    "above": { "status": "covered",  "text": "過了門檻" }
  }
}
```

- `format`：`hm` 表示小时和分钟，`day` 表示「第 N 日」，`days` 表示「N 日」。
- `okSide`：界线哪一侧算有保障，`above` 或 `below`。
- `rate` 可选：按单位计赔时填，比如每 6 小时赔 200、每住院一日赔多少。

### `split`：拆分

适用于上限、比例、墊底費：一个大数字裂开，剩下真正会赔的部分。

```json
{
  "kind": "split",
  "total": 30000,
  "totalLabel": "單車價值",
  "segments": [
    { "value": 4500, "tone": "paid",   "label": "賠付" },
    { "value": 500,  "tone": "deduct", "label": "墊底費" }
  ],
  "restLabel": "自己承擔"
}
```

`tone` 的取值是 `paid`（赔付）或 `deduct`（扣除）。各段加起来不到 `total` 的部分，会自动显示为 `restLabel`。

### `branch`：分支

适用于原因、方式、地点等不同情况得出不同结论。

```json
{
  "kind": "branch",
  "prompt": "水從哪裏來？",
  "options": [
    { "label": "水管突然爆裂", "status": "covered",  "note": "第 2 節有保" },
    { "label": "長期慢慢滲",   "status": "excluded", "note": "寫明不保" },
    { "label": "樓上單位漏落來", "status": "silent",  "note": "條款沒提" }
  ]
}
```

完整的示例数据见 `js/data/*.js`，结构和上面完全一致。
