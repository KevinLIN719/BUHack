# 语言切换（i18n）测试报告

测试时间：2026-11-14　测试对象：`i18n.js` / `translations.js` / `i18n.css`（当前 `feat/deepseek-live`，含 `32afe28`）

## 一句话结论

切换机制（下拉框、`?lang`、`localStorage`、`<html lang>`、跨页保持、`<title>`）全部正常；**页面正文几乎没有被翻译**，覆盖率 1–4%，页面呈中英混杂；`materials.html` 未接入。

## 复现方式

```bash
PORT=4180 node scripts/serve.mjs      # 静态服务，不需要后端
# 依次打开 experience.html / showcase.html / index.html / materials.html
# 在页头把 🌐 下拉切到 English，对比切换前后的正文
```

## 实测数据

| 页面 | 是否加载 i18n | 可见文本节点 | 切到 en 后实际变化 | 覆盖率 |
|---|---|---|---|---|
| `experience.html` | 是 | 288 | 11 | 3.8% |
| `showcase.html` | 是 | 208 | 3 | 1.4% |
| `index.html`（旧版参考） | 是 | 11 | 2 | 18% |
| `materials.html` | **否** | — | 0 | 0% |

`experience.html` 里翻到的全部是单词/短句：保單→Policy、閱讀→Read、提問→Ask、觀看概念動畫→Watch the introduction、日本→Japan、滑雪→Skiing、潛水→Diving、多一分清晰。→A little more clarity.、閱讀條款→Read the wording。

典型混杂现象（en 模式下的步骤条）：

> `01 Policy · 02 情境 · 03 Read · 04 討論 · 05 Ask`

同页大标题「從示例保單開始。」、说明段落、「上傳我的保單」、`aria-label`、`placeholder` 全部仍是中文。属性共 22 个（`aria-label` / `placeholder` / `title`），翻译成功 0 个。

机制类检查均通过：`document.documentElement.lang` 正确、URL 写入 `?lang=`、`localStorage.policy-language` 持久、页内链接自动带 `lang`、刷新后保持、`zh-HK → en → zh-CN → zh-HK → en` 来回切换可正确复原、切换时 `PolicyExperience` 状态（当前面板、已保留问题）不丢失。

## 根因（代码级）

1. `i18n.js` 的 `translate()` 只做**整段文本节点与词典值完全相等**的替换：

   ```js
   const exact = entries.find(([, source]) => source === value);
   ```

2. 但 `translations.js` 的 92 条 zh-HK 值大多只是**页面文案的片段或旧版措辞**。例：`copy.1 = "投保之前"`，页面实际是「投保之前，我想記下……」；`copy.11 = "多一分清晰。"` 刚好整句相同，所以能翻。

3. `translations.js` 92 条里，能在 `experience.html` 源码命中的只有 30 条，且多数是更长句子中的一小段 → 只能翻到单词级。

4. `materials.html` 没有引入 `i18n.css` / `translations.js` / `i18n.js`，因此没有切换器；该页（含新增的「條款調查」区块）全部中文硬编码。

5. 天然盲区：JS 动态生成的聊天回复、清单、场景卡不在 92 条静态文案内，切语言不会变化。

## 建议修法

**A（推荐）**：给页面元素加显式标记，机制已支持，不需要改 `i18n.js`：

- 文本：`<h2 data-i18n="copy.16">…</h2>`
- 属性：`<input data-i18n-placeholder="copy.70" placeholder="…">`
- 词典按**整句**重写，key 与页面一一对应；去掉靠片段碰运气的条目。

**B（最小改动）**：只给 `materials.html` 补三语静态文案并把 `i18n.*` 引入该页，主流程维持现状。

## 验收标准（建议写进 issue）

1. `experience.html` / `showcase.html` / `materials.html` 三页在 en 模式下，可见正文中文字符为 0（品牌名、`Policy Lens` 等专有名词除外）。
2. `aria-label` / `placeholder` 同样随语言切换。
3. 三语来回切换 3 轮无污染（切回 zh-HK 与初始文案逐字一致）。
4. 切换语言不丢失流程状态（面板、已保留问题、草稿）。
5. `translations.js` 三种语言键集合一致，且不存在「key 有值但页面没有该标记」的孤儿条目。
