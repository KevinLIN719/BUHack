# M3 · Policy papers and reading notes

Module handoff: 2026-11-13. Implementation Agent completed first, then a fresh-context read-only review Agent inspected the result. The coordinator fixed the findings within M3 ownership and completed the module checks below. Full assembled-page acceptance remains with M0/M4. Scoped native DOM module; no backend, file analysis or coverage decision.

## Files and ownership

- `policy-fixtures.js`: three frozen, explicitly fictional travel / home contents / health records with stable IDs and twelve matching findings.
- `policy-deck.js`, `policy-deck.css`: actual pointer dragging and paper swaps, selection, keyboard/button alternatives; CSS also contains the composite `pw-` layout and fine-rule details.
- `policy-pull.js`, `policy-pull.css`: shield/bookmark/policy token, thin tether, wrap, tension, curved carry and landing; independent transient paper clone.
- `policy-workbench.js`: composite owns deck, inline detail, close/reopen state, marked original excerpt, priority list and pull overlay.
- `design/modules/policy-interactions.md`: this handoff and source boundary.

No other module, app.js, task board, plan, package or build file was modified by this implementation agent. No dependencies, provider changes, top-level threads or worktrees were added.

## Input data

`window.PolicyFixtures.items` is an array of `{id,title,kind,summary,sourceLabel,excerpt,findings:[{id,priority:1|2|3|4,title,question,quote}],demo:true}`.

| Stable ID | Fictional title | Wording / finding topics |
| --- | --- | --- |
| `fictional-travel-01` | Weekend Away | Cancellation triggers, baggage evidence, activity extension, excess |
| `fictional-home-02` | Everyday Home | Unoccupied home, listed valuables, accidental damage, value records |
| `fictional-health-03` | Care Notes | Waiting period, disclosure, authorisation, referral |

All amounts use “demo units”. No real insurer name is attached to any fictional record. Findings reference literal sentences in the matching excerpt. Workbench validates unique policy IDs, excerpts, findings, priorities and quote containment before rendering. Text uses DOM `textContent` / text nodes, not interpolated HTML. Example arrays/objects are frozen. Inputs with overlapping quotes retain the exact original excerpt; overlapping marks are skipped to avoid duplicating text.

## Public API

```js
const workbench = window.PolicyWorkbench.mount(host, {
  items: window.PolicyFixtures.items,
  onSelection(id, item, meta) { /* meta.reason, meta.order */ },
  onInspect(id, item) { /* Optional integration notification. */ }
});
workbench.select('fictional-home-02'); // Select; updates open details.
workbench.inspect('fictional-health-03'); // Select + open matching details + pull.
workbench.selectedId; // Getter.
workbench.destroy(); // Idempotent; only owned DOM/listeners/observers removed.
```

`PolicyDeck.mount(host,{items,selectedId,onSelect,onInspect})` returns `{select(id),cancel(),destroy(),selectedId}`. Callbacks use `(id,item,meta)` with a reason (`api`, `drag`, `keyboard`, `button`, `paper`) and selection metadata includes an order copy. `cancel()` clears a gesture, capture and drag transforms; it does not mutate policy data. `policydeck:reorder` bubbles with `{id,order,reason}` after pointer, button or keyboard swaps. The visible order lives in Deck, never mutating input arrays.

`PolicyPull.mount(overlay,{token,onState})` returns `{play({id,sourceElement,targetElement,onLanding?}),cancel(),destroy()}`. `token` accepts `shield` (default), `bookmark` or `policy`. `onState(phase,{id})` reports `aim`, `wrap`, `tension`, `carry`, `landing`, `idle` or `cancelled`. `play` additionally returns a Promise resolving to `{id,status:'complete'|'cancelled'|'skipped'|'destroyed'}`. Hidden/unmeasurable endpoints skip animation; readable final content is owned by Workbench and already correct. Optional per-request `onLanding(progress)` reports 0–1 on the existing RAF. `PolicyPull.timings` is the duration source; its extended landing accommodates the shared blur reveal.

Workbench starts with the first paper selected and its notes open. `select` updates any open notes; selection while closed leaves notes closed. `inspect` opens notes. `Close notes` or Escape closes them and restores focus to the selected paper. Initial mount does not emit a synthetic selection callback; read `selectedId` for initial integration state. Mounting the same host again destroys the previous instance.

## Stable DOM hooks

| Hook | Purpose |
| --- | --- |
| `[data-policy-workbench]` / `.pw-root` | Composite, `data-detail-open` and `data-pull-state` |
| `[data-policy-deck-host]` | Owned deck slot |
| `[data-policy-deck]` / `.pd-root` | Deck with `data-selected-id` / `data-dragging` |
| `.pd-card[data-policy-id]` | Ordered policy paper and actions |
| `[data-drag-shell]` / `.pd-drag-shell` | Exclusive pointer-transform owner |
| `[data-pd-paper="<id>"]` / `.pd-paper` | Focusable paper, selected/expanded/controls ARIA |
| `[data-pd-action="inspect|earlier|later"]` | Ordinary native buttons with `data-policy-id` |
| `[data-policy-detail][data-policy-id]` | Owned inline notes section |
| `[data-policy-excerpt="<id>"]` | Exact original wording with `mark.pl-marker[data-priority]` |
| `[data-policy-findings="<id>"]` | Ruled notes; rows contain matching `data-finding-id` / `data-priority` |
| `[data-policy-pull-target]` | Stable detail heading destination |
| `[data-pw-action="close"]` | Native close button |
| `[data-policy-pull-overlay]` | Own absolute overlay; never the drag shell |
| `.pp-layer[data-phase]`, `.pp-visual-clone` | Transient, aria-hidden pull visuals |

`policyworkbench:selection` and `policyworkbench:inspect` bubble with `{id,item,reason?}`. Integrators may use callbacks or events; avoid subscribing to both for the same action.

## Interaction / motion contract

The paper is the continuous drag driver, threshold 7 CSS px. Drop onto another paper swaps the two DOM positions and selects the dragged paper. Releasing or cancelling an active drag suppresses its next pointer-generated click for up to 500ms; keyboard activation is not suppressed. The shell owns pointer translation; paper tilt is on its child. Read wording buttons, Enter/Space, arrow/Home/End selection, Shift + arrow movement, and earlier/later buttons provide alternatives. No HTML5 data transfer, fake drag timer or click-only substitution is used.

Inspection is event-driven segment playback. The compact shield aims toward the paper, draws a thin tether, wraps its outline, pulls against a brief tension, carries a separate paper clone over a curved route, then releases/fades it at the detail heading. Stages are finite; no idle/music/spider animation runs. Source paper and final detail remain untouched by Pull transforms. The clone is aria-hidden, inert, stripped of IDs and descendant controls, and clipped to the workbench. Native controls at the clone root are disabled and link/edit/focus attributes removed as a fallback; its wrapper opts out of M2 skinning. Carry/landing reserve the rotated, scaled paper's half-size within overlay bounds, and the token also stays inside those bounds. Paper height grows with its wording; action buttons stay in normal flow below the paper.

Latest inspection safely cancels the previous visual run and settles its Promise. Workbench reserves the exact wording layout immediately, masks its ink during travel, then reveals the heading, excerpt and findings from the shared landing progress. The clone retires with blur before destination text becomes clear; stale completion cannot unmask a newer request. Close, Escape, resize (window and ResizeObserver), scrolling, hidden document, endpoint removal, hidden/inert ancestor, reduced-motion changes and destroy clear transient visuals/frames. Deck likewise cancels pointer capture/transforms for resize/scroll/blur/visibility/removal/hidden/inert. Missing RAF and reduced-motion use stable content without a mandatory delay. No perpetual RAF, interval or animation survives idle/destroy. Host content outside the owned root is preserved.

M1 tokens have local fallbacks. Marked excerpts use four semantic `--priority-N-ink/surface` pairs and explicit priority numbers/labels in corresponding findings. Ordinary content is a fine-rule list. Only actual policy papers have paper borders/shadows/tilt.

M2 integration: command buttons remain ordinary native buttons. `.pd-paper` is a paper-shaped interactive document surface with `data-liquid-ignore`, because applying a 999px button skin would turn the entire paper into an oval. The actual Read wording / move / close controls receive the shared M2 material. No Shadow DOM separates these controls from M2.

## Reference and adaptation boundary

Read the actual `materials.spiderCodeAttachment` from `design/planning/prompt-inventory.json`, skipping its giant embedded artwork line. It contains the full click-driven `SpiderMusicPlayerEngine.js`, GSAP 3.12.7 import, motion runtime and phases; it is not a pointer-drag engine. Source reference: https://x.com/desdivj/status/2114305692547043677/video/1 . The attachment's provenance states: “Independently rebuilt by LeiBox from a Divan Raj motion reference.” Its embedded artwork retains third-party rights.

This module studied that source's aim / wrapping / strain / curved carry / arrival logic, latest pending request handling and resize settlement. Its implementation is newly authored native DOM + RAF: no engine/runtime source, GSAP, spider artwork, music metadata, cover images, fonts, fixed 1416×1080 device shell or React wrapper was copied into the product. Consequently there is no embedded third-party media/font or copied-code license block to distribute. The provenance above is retained as the source-study notice; it does not claim ownership of the reference.

CardSwap in the prompt supplies a wrapper importing an absent `CardSwapEngine.js`. The paper drag/swap behavior here is a native adaptation, **not execution or reproduction of that missing engine**. Neither source has been silently promoted to an installed dependency.

The oil-motion workflow was applied only to interaction intent, finite segments, reentry and cleanup checks; this pure DOM implementation uses no generated media pipeline.

## Actual implementation validation

Run from workspace root:

```sh
node --check policy-fixtures.js
node --check policy-deck.js
node --check policy-pull.js
node --check policy-workbench.js
node /tmp/policy-lens-m3-implementation-check.mjs
node /tmp/policy-lens-m3-fallback-check.mjs
```

Results: all four syntax checks pass; **56/56** implementation checks and **5/5** fallback/remount checks pass. Tests import the existing local jsdom installation; no dependency was added. Geometry and RAF are controlled stubs, not evidence of actual browser layout.

Implementation checks include: unique/demo schema and literal quotes; real pointer shell displacement; target swap reflected in DOM; post-drag click suppression; arrows, Enter, Shift+arrows, reorder buttons; window/container resize, hidden page and pointercancel; five actual pull phases and Promise completion; separate clone / unchanged live transforms; rapid cancellation and latest result; mid-flight reduced-motion; removal and destroy cleanup; exact excerpts / twelve findings / four priorities; close/reopen/Escape; escaped supplied title; empty input; absent RAF and repeated mounts. Listener, observer and pending-frame cleanup is checked.

Coordinator independently reported **20 additional passing checks** in `/tmp/policy-lens-m3-independent.mjs` and used actual `html_preview` to detect the paper/control skin conflict, which is fixed. Coordinator owns updated browser visual evidence and the fresh read-only review; those are not inferred from jsdom counts here.

## M4 integration request and limits

1. Load `policy-deck.css` and `policy-pull.css` with component CSS, then M1 theme/notebook/markers, and M2 controls last.
2. Load scripts in order: `policy-fixtures.js`, `policy-deck.js`, `policy-pull.js`, `policy-workbench.js`, then page integration. No imports/network/runtime assets are required.
3. Call `PolicyWorkbench.mount(workbenchHost,{items:PolicyFixtures.items,onSelection,onInspect})` once after DOM readiness. M4 does not render or manage private details/pull state.
4. Keep the controller; call `destroy()` before replacing/removing the feature. Document/window lifecycle guards also clear active visuals when removed or hidden. Forward `selectedId` or the callback ID when building another sample output.
5. Add these six production files to the final standalone inliner, server allowlist and syntax check list in M4-owned files. The module itself needs no package/build modification.

Module limits: examples are fictional, with no uploaded-document analysis; dragging swaps papers within this workbench, with no cross-window transfer or long-distance auto-scroll. Dragging can be replaced by keyboard/buttons on narrow or touch screens. Pull uses adaptive bounds and finite motion, not the original fixed-device simulation. The coordinator has checked this module at the responsive/short-viewport sizes below. Full assembled-page acceptance remains an M0/M4 responsibility.


## Coordinator acceptance and fresh review

The implementation Agent stopped writing before a separate, fresh-context read-only Agent was started. Neither Agent spawned children; both inherited the current Codex model/settings. Review did not edit any repository file. It independently found two defects: an active pointer release created two suppression timers, leaving one after destroy, and the public Pull API could clone a native button root that remained focusable. The coordinator removed the duplicate timer arm and made visual clones inert, disabled native cloned controls and removed link/edit/focus attributes. No further delegate was used to fix these small findings.

Actual reruns on the corrected files:

| Command | Result |
| --- | --- |
| `node --check policy-fixtures.js` / `policy-deck.js` / `policy-pull.js` / `policy-workbench.js` | All four pass |
| `node /tmp/policy-lens-m3-implementation-check.mjs` | 56/56 pass |
| `node /tmp/policy-lens-m3-fallback-check.mjs` | 5/5 pass |
| `node /tmp/policy-lens-m3-independent.mjs` | Coordinator's 20/20 pass |
| `node /tmp/policy-lens-m3-fresh-review.cjs` | Review's original script: 42 pass, no defects |
| `node /tmp/policy-lens-m3-fresh-extra.cjs` | Review's additional script: 7 pass, no defects |
| `node /tmp/policy-lens-m3-timer-check.mjs` | One timer after drag, zero after destroy |
| `node /tmp/policy-lens-m3-bounds-check.mjs` | 12 clone/token boundary assertions pass |

The review scripts initially reported 45 passes and four failed assertions for the two defects; the same scripts now report 49 passes and no defects. This is a coordinator rerun of the independent tests, not a claim that the review Agent re-reviewed the subsequent fixes. The suites overlap; their counts are not unique user flows.

Actual `html_preview` evidence, using the current M1 theme/notebook/markers and M2 CSS/JS in contract load order, without a server:

- `/tmp/policy-lens-m3-728-settled.html`: 728px desktop/single-column workbench, 1071px content. Viewport/scroll width both 728; no overflowing elements. Rectangular folded papers, four original-wording ink/surface pairs and shared skins on command buttons.
- `/tmp/policy-lens-m3-320-settled.html`: 320px narrow page, 1902px naturally scrolling content. Viewport/scroll width both 320; no overflowing elements.
- `/tmp/policy-lens-m3-390-short.html`: 390px width with a 480px scrolling host, 496px total preview. Health notes and Close notes remain readable; viewport/scroll width both 390. This is a constrained host check, not a full assembled mobile page assertion.
- `/tmp/policy-lens-m3-1200-carry.html`: 1200px two-column workbench, a paused real Pull carry pose. Source footer stays inside its paper with separate actions below; moving clone and shield are visible inside the overlay; final home-policy wording stays sharp and correctly paired. The temporary preview controls only Pull's clock and captures its painted layer for a static intermediate frame; shipped files use normal RAF/lifecycle handling. An initial attempt to freeze the global browser clock timed out; it was replaced by this scoped instrumentation.
- `/tmp/policy-lens-m3-browser-probes.html`: browser-native PointerEvents with actual layout rectangles run through shipped handlers. Console confirms `translated:true`, `swapped:true`, `postDragInspect:0`, `cloneSafe:true`. These are scripted browser events, not a human/touch-device exercise. Native button-source clone focus was actually attempted and rejected by the browser.

Successful previews report no console errors. The final interactive desktop HTML is also handed off through `html_render`. Temporary files are verification artifacts, not runtime dependencies or additions to another module's ownership.

No open M3 defect remains from this review. Remaining limits are the fictional data, lack of cross-window dragging/long-distance auto-scroll, and final M4 packaging/full-page integration. M4 should follow the five integration steps above and include these production modules in its syntax check, server allowlist and standalone build. No changes to `app.js`, another module's files, the shared plan or task board were made by this coordinator.

## M0 follow-up: policy bookmark and replay

Workbench now accepts optional pullToken (shield/bookmark/policy), preserving its shield default. The final guide uses bookmark and a selected-policy replay action, reusing the existing inspect path and owned overlay. The trajectory remains unchanged. Eight in-page usage panels now distinguish the policy swap and click-driven note reveal. Actual targeted/17-case integration, five-entry delivery audit, paused carry bounds and320/728 normal-layout evidence are recorded in design/planning/bookmark-pull-followup.md.
