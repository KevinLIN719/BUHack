# Policy Lens

> 全仓进度、后端接口、已完成/未完成与移交事项见 [docs/PLAN.md](docs/PLAN.md)。本 README 只说明前端页面的使用与打包。

A Traditional Chinese, light-mode frontend with two views: a **connected mock experience** and a **single-page component notebook**. The POLICY LENS brand, selected decorative English, insurer proper names and technical code identifiers are retained. The default entry is `experience.html` (`dist/index.html` after building); every standalone component is on `showcase.html` (`dist/showcase.html`). Both pages link to each other.

主要介面、提示、保單示例、中文問答、元件接入說明和匯出清單均使用繁體中文（香港用語）。保單引文與高亮仍逐字對應；英文機器值、DOM hooks 和 API 沒有改名。中文查詢與追問會保留正確的條款上下文。 介面只保留必要操作提示；情境的條款說明與元件接入資料預設折疊，原文與匯出內容完整保留。

The experience opens with the original orange poster composition: two large title lines on the left and a tilted, slightly fanned A4 policy stack behind the title on the right. The full browser width carries an orange brand palette, warm paper, notebook rules and numbered marker priorities. The illustrated policy uses a portrait A4 sheet (630 × 891) with two offset back sheets spread by three and six degrees, a compact upper reading summary, folded attachments and a confirmation checklist, with no fluorescent patches; literal wording highlights retain their priority colours. All brand entrances now use plain text; the rejected paper-and-lens badge has been removed. The eight independent component groups retain their usage panels and effects. All policies and responses are local fictional data; no real AI, document analysis, account or backend is connected.

## Open and package

Open `experience.html` directly, or open `dist/index.html` after building. Open `showcase.html` for the component notebook. Both views fill the browser width with fluid side gutters and natural page scroll. The desktop poster follows the actual window height with a 660px floor; the A4 stack is tilted by fourteen degrees, with slightly offset back sheets. All wording, the brand and checklist attachments are confined to the upper part of the artwork (below y=510). From y=520 down, only the grid remains so the foreground title can safely overlap the paper. A finite entrance gives the back sheets 70ms and 140ms follow delays; all effects stop after one second. The headline is slightly smaller to leave the paper more room. Reduced motion shows the final offsets immediately. Short windows scroll naturally; narrow screens also place the title over the reserved blank paper area. `viewport-layout.js` reads only window height, deduplicates resize writes and cleans up on unload. No dependencies need to be installed. To use the optional local development server:

```sh
npm run dev
```

The server prints `http://localhost:4173` and serves the mock experience at `/`. `PORT=another-port npm run dev` changes the port. The server is for development; it is not needed to view or share the standalone output.

```sh
npm run check
npm run build
```

The build emits the connected experience (also as the default index), the component notebook and three standalone references, with local CSS, JavaScript and SVG/image/font references embedded:

- `dist/experience.html` — connected mock review: policy → context → marked wording/scenarios → conversation → generated question list.
- `dist/index.html` — the same mock experience as the default homepage for a static host.
- `dist/showcase.html` — all eight standalone component groups on one page.
- `dist/journey-reference.html` — the earlier six-step journey, retained as a reference.
- `dist/concept-preview.html` — focused concept animation.
- `dist/completion-preview.html` — focused checklist reveal.

Source attribution links remain ordinary external links. Following one requires a connection; rendering and operating the demos does not. The build fails on missing local files and remote stylesheet/script dependencies instead of silently producing an incomplete offline file.

## What to try

1. The orange poster opens the page. **Watch the concept** and the notebook's **Concept** link lead to the independent concept study: sixteen faint insurer names appear in batches behind four currency, protection and policy symbols, then fade away as the orange POLICY LENS wordmark appears with 「你的保單，付款前看清。」 in one group. The 4.1-second sequence keeps that same group at the end. Each background name is one complete text node with a finite fade; there are no character scans, dotted brand lettering, duplicate title handoffs or blur effects. **Skip** lands on the brand and tagline. **Replay introduction** cancels the old sequence before starting again. Reduced-motion preferences show the complete brand and tagline immediately.
2. Try the shared flat controls, choose a destination, and add a notebook note. Primary, secondary, choice, navigation and send controls all use one left-to-right fill on hover, keyboard focus or press; selected choices keep their fill. Labels, focus and hit areas stay still. There are no button shadows, bevels, squash/stretch or sliding choice indicators. Reduced-motion preferences make state changes immediate.
3. Read the twenty marker pairs and the four numbered priorities. The original wording uses literal quotes from the currently selected fictional policy.
4. Drag a paper in the policy workbench; keyboard selection and inspection are also available. Opening a policy carries a small policy bookmark along a tether into its matching inline notes. The separate Note pull guide explains the click-driven sequence and offers a replay control. Selection updates both the wording sample and checklist choices.
5. Ask about the fictional **晴日旅遊** flight-delay wording. Existing `PolicyAgentMotion` and `PolicyAgentReplies` power the flowing conversation. The composer offers 「解釋條款／假設情境／怎樣問」 with persistent guidance, mode-specific examples and distinct replies. Switching modes keeps the draft and never submits it. The transcript and next draft survive close/reopen within the page. The component notebook uses a separate, clearly named sample from the workbench's three policy fixtures; the connected experience uses the selected fixture and trip context.
6. Select questions from the current policy and generate a checklist. The broad, top-to-bottom `PolicyCompletionReveal` blends the same cherry, amber, teal and violet colours used for wording priorities. The result is one white grid-paper notebook with a native checkbox beside each question; clauses and sources are collapsed below it. Ticks record progress only on that generated sheet. Replay and cancelling the animation preserve the sheet and its ticks; changing the selected policy or questions invalidates it.

Notes and transcripts live only in the current page; refresh clears them. Generation does not send, export or mark anything reviewed. The sixteen real market names are context with source links; they are not partners, recommendations or providers of the fictional samples.

## Module integration

The connected mock page is owned by experience.html/css/js, with experience-data.js and experience-chat.js. It reuses the existing motion engines and three PolicyFixtures; its local state supplies the selected policy, context, kept questions, notes and prepared output.

See `design/modules/showcase.md` for the page's DOM hooks, public APIs, load order and lifecycle/acceptance evidence. Other module contracts are in `design/planning/module-contracts.md`.

- M1: `ui-theme.css`, `ui-notebook.css`, `ui-markers.css`, `assets/policy-sheet.svg`, `assets/policy-sheet-cover.svg` — visual tokens, paper/list primitives, twenty marker pairs and four semantic priorities.
- M2: `liquid-controls.css/js` — shared flat controls with one left-to-right fill for primary, quiet, choice, navigation and dynamically created actions. Load this CSS last. Native state and lifecycle APIs are documented in `design/modules/shared-controls.md`; `toggle-motion.js` keeps compatible refresh hooks without adding a second indicator. No external control engine is required.
- M3: `policy-fixtures.js`, `policy-deck.js/css`, `policy-pull.js/css`, `policy-workbench.js` — fictional policies, pointer dragging, keyboard alternatives and inline tethered details. The missing CardSwap engine is not claimed as reused.
- M4: `showcase.html/css/js`, `showcase-chat.js`, `hero-transition.js/css` — page, local adapters and the single-surface concept introduction. `concept-motion.js` keeps `play/pause/resume/finish/destroy` APIs, pauses when hidden or offscreen, and uses Web Animations opacity and 2D transforms rather than per-frame text scans. The old scan configuration is no longer used.
- Shared state transitions: `surface-motion.js` — native disclosure motion, panel open/close and opacity changes. The guide owns one `PolicySurfaceMotion.mount(document)` controller, cancels component jobs on unmount, and destroys it with the page. Keep the dedicated hero, message, completion and bookmark engines as their own geometry owners.
- Existing reusable units: `agent-motion.js`, `agent-replies.js`, `completion-motion.js`, `concept-motion.js`, with their companion CSS/data. The original `app.js` closure remains the reference journey rather than the new page foundation.

## Earlier prototype boundaries

The old `index.html` journey remains Home → Documents → Your situation → Overview → Scenarios → Questions. Its Sunny Days Travel policy, comparisons and scenarios are fictional; amounts are labelled CNY. Local PDFs and JPG/PNG/WebP files are previewed in the browser, not analysed or uploaded. Maximum: 20 MB per file, 10 files per review.

That reference journey includes contextual conversation, checklist generation/copy/download, manually recorded replies and reviewed status. A manually reviewed item does not establish cover or claim eligibility. It is retained for regression and design history; the notebook is the single final delivery page.
