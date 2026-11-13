# Policy Lens

A Traditional Chinese, light-mode frontend with two views: a **connected mock experience** and a **single-page component notebook**. The POLICY LENS brand, selected decorative English, insurer proper names and technical code identifiers are retained. The default entry is `experience.html` (`dist/index.html` after building); every standalone component is on `showcase.html` (`dist/showcase.html`). Both pages link to each other.

主要介面、提示、保單示例、中文問答、元件接入說明和匯出清單均使用繁體中文（香港用語）。保單引文與高亮仍逐字對應；英文機器值、DOM hooks 和 API 沒有改名。中文查詢與追問會保留正確的條款上下文。

The experience opens with the original orange poster composition: an oversized diagonal policy above two large title lines. The full browser width carries an orange brand palette, warm paper, notebook rules and numbered marker priorities. The illustrated policy has layered folded documents and an attachment checklist, with no fluorescent patches; literal wording highlights retain their priority colours. All brand entrances now use plain text; the rejected paper-and-lens badge has been removed. The eight independent component groups retain their usage panels and effects. All policies and responses are local fictional data; no real AI, document analysis, account or backend is connected.

## Open and package

Open `experience.html` directly, or open `dist/index.html` after building. Open `showcase.html` for the component notebook. Both views fill the browser width with fluid side gutters and natural page scroll. The landscape cover follows the actual window height with a 660px floor; short windows scroll naturally and narrow screens use a portrait paper composition. `viewport-layout.js` reads only window height, deduplicates resize writes and cleans up on unload. No dependencies need to be installed. To use the optional local development server:

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

1. The orange poster opens the page. **Watch the concept** and the notebook's **Concept** link lead to the independent concept study: currency and protection dots, slow Hong Kong market names and the dotted name, which settles into a centred ending of only POLICY LENS and 「你的保單，付款前看清。」. **Skip** lands on that ending. **Replay introduction** clears the old process. Reduced-motion preferences show the final policy immediately.
2. Try the primary elastic controls, light text actions and flatter selection surfaces, choose a destination, and add a notebook note. Secondary actions such as copy, download, replay and restart have no persistent capsule or shadow; their subtle skin still responds to press while label, focus and hit area remain stable.
3. Read the twenty marker pairs and the four numbered priorities. The original wording uses literal quotes from the currently selected fictional policy.
4. Drag a paper in the policy workbench; keyboard selection and inspection are also available. Opening a policy carries a small policy bookmark along a tether into its matching inline notes. The separate Note pull guide explains the click-driven sequence and offers a replay control. Selection updates both the wording sample and checklist choices.
5. Ask about the fictional **晴日旅遊** flight-delay wording. Existing `PolicyAgentMotion` and `PolicyAgentReplies` power the flowing conversation. The transcript and next draft survive close/reopen within the page. This chat uses a separate, clearly named sample from the workbench's three policy fixtures.
6. Select questions from the current policy and generate a checklist. The softer, broad, top-to-bottom `PolicyCompletionReveal` shows exactly those questions. Replay uses that generated snapshot; changing the selection invalidates it. Cancel stops the reveal and preserves the selected questions.

Notes and transcripts live only in the current page; refresh clears them. Generation does not send, export or mark anything reviewed. The sixteen real market names are context with source links; they are not partners, recommendations or providers of the fictional samples.

## Module integration

The connected mock page is owned by experience.html/css/js, with experience-data.js and experience-chat.js. It reuses the existing motion engines and three PolicyFixtures; its local state supplies the selected policy, context, kept questions, notes and prepared output.

See `design/modules/showcase.md` for the page's DOM hooks, public APIs, load order and lifecycle/acceptance evidence. Other module contracts are in `design/planning/module-contracts.md`.

- M1: `ui-theme.css`, `ui-notebook.css`, `ui-markers.css`, `assets/policy-sheet.svg`, `assets/policy-sheet-cover.svg` — visual tokens, paper/list primitives, twenty marker pairs and four semantic priorities.
- M2: `liquid-controls.css/js` — shared control motion with primary, quiet and choice surfaces, including dynamically created controls. The supplied PixelToggle wrapper did not include its engine; this is a documented native adaptation.
- M3: `policy-fixtures.js`, `policy-deck.js/css`, `policy-pull.js/css`, `policy-workbench.js` — fictional policies, pointer dragging, keyboard alternatives and inline tethered details. The missing CardSwap engine is not claimed as reused.
- M4: `showcase.html/css/js`, `showcase-chat.js`, `hero-transition.js/css` — page, local adapters and inline choreography. `concept-motion.js` accepts optional presentation scan configuration; old callers retain their default timing.
- Shared state transitions: `surface-motion.js` — native disclosure motion, panel open/close and opacity changes. The guide owns one `PolicySurfaceMotion.mount(document)` controller, cancels component jobs on unmount, and destroys it with the page. Keep the dedicated hero, message, completion and bookmark engines as their own geometry owners.
- Existing reusable units: `agent-motion.js`, `agent-replies.js`, `completion-motion.js`, `concept-motion.js`, with their companion CSS/data. The original `app.js` closure remains the reference journey rather than the new page foundation.

## Earlier prototype boundaries

The old `index.html` journey remains Home → Documents → Your situation → Overview → Scenarios → Questions. Its Sunny Days Travel policy, comparisons and scenarios are fictional; amounts are labelled CNY. Local PDFs and JPG/PNG/WebP files are previewed in the browser, not analysed or uploaded. Maximum: 20 MB per file, 10 files per review.

That reference journey includes contextual conversation, checklist generation/copy/download, manually recorded replies and reviewed status. A manually reviewed item does not establish cover or claim eligibility. It is retained for regression and design history; the notebook is the single final delivery page.
