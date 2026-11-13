# Frozen module contracts

Workspace: /Users/fanxinyun2/.t3/projects/bu. Read MASTER_PLAN.md and design/planning/prompt-inventory.json first. Latest user scope overrides the old full-journey delivery. No real backend or AI. English product UI. Existing prototype is reference/regression, not the new page foundation.

## Ownership

M1: ui-theme.css, ui-notebook.css, ui-markers.css, assets/policy-mark.svg, assets/policy-sheet.svg, design/modules/visual-system.md.
M2: liquid-controls.js, liquid-controls.css, design/modules/shared-controls.md.
M3: policy-fixtures.js, policy-deck.js/css, policy-pull.js/css, policy-workbench.js, design/modules/policy-interactions.md, relevant copied-source notices.
M4: showcase.html/css/js, showcase-chat.js, hero-transition.js/css, concept-motion.js/css, index.html, completion-preview.html, concept-preview.html, scripts/build-preview.mjs, scripts/serve.mjs, package.json, README.md, design/modules/showcase.md. concept-data.js may only change presentation configuration; retain all verified names/source URLs. Existing app.js, demo-data.js, agent-motion.js/replies.js, completion-motion.js remain stable unless M0 approves a concrete integration fix.
M0: MASTER_PLAN.md, TASK_BOARD.md, WORKSTATE.md, QUEUE_PLAN.md, final acceptance. Do not edit another owner's files or the shared task board.

## Baseline tokens / marker language

M1 provides --primary:#1F5E60, --background:#FBFCF8, --foreground/--ink:#253B3D, --muted, --secondary, --border:#DCE4DD, --ring, --primary-foreground, --font-sans, --font-mono, --radius. Maintain existing token aliases. Controls need --control-face, --control-hover, --control-pressed, --control-line and optional shadow tokens; M2 includes reasonable var() fallbacks.
M1 samples the supplied 20-color marker reference into --marker-N-ink / --marker-N-surface pairs, and exports four semantic priority pairs with data-priority=1..4. Labels describe importance/confirmation, never automatic coverage approval. Shared markup: <mark class="pl-marker" data-priority="1">...</mark>; .pl-priority with explicit numeral/label; .pl-grid-paper and .pl-ruled-list for paper/list primitives.
M1 creates the new folded-policy/lens mark. M4 uses its asset path and preserves accessible brand text. Existing PL button can be visually replaced through notebook CSS if app.js remains unchanged. Update actual paper SVG color so the final hero does not retain orange.

## M2 shared controls

window.PolicyButtonMotion.mount(root=document, options) -> {refresh(),destroy()}. Auto-mount document once on each entry is acceptable if idempotent. No provider/network calls.
Cover button, clickable summary and all dynamic choice/tab/icon/action buttons; preserve native semantics and handlers. Native text inputs, file input, select and reviewed checkbox are not fake button wrappers. External ordinary text links remain links.
Use a decorative aria-hidden .liquid-skin span with fixed hit/focus rectangle; do not wrap/replace actual text or SVG. Preserve skin when buttons replace children or are rerendered; no duplicate layers. Existing agent send pulse and completion label fade must coexist. Button press/release cannot prevent clicks or drag events. Keep selected/disabled/focus/keyboard/reduced/forced-color states. Store transient animations only while needed and clean detached elements/listeners/observers on destroy.
Source study: /tmp/policy-lens-liquid-study/observed-button-reference.md. Surface is shallow white convex material; QQ squash/stretch is a requested adaptation. Do not claim missing PixelToggle engine reuse; document adapter boundaries and mount/update/destroy compatibility.

## M3 policy fixture and document workbench

window.PolicyFixtures.items = array of {id,title,kind,summary,sourceLabel,excerpt,findings:[{id,priority:1|2|3|4,title,question,quote}],demo:true}. Use stable IDs and explicitly fictional records, independent of real insurer background names. Include at least three distinct policy samples with matching details. Keep text safe/escaped.
window.PolicyDeck.mount(host,{items,selectedId,onSelect,onInspect}) -> {select(id),cancel(),destroy(),selectedId}.
window.PolicyPull.mount(overlay,{token,onState}) -> {play({id,sourceElement,targetElement}),cancel(),destroy()}.
window.PolicyWorkbench.mount(host,{items,pullToken,onSelection,onInspect}) -> {select(id),inspect(id),destroy(),selectedId}. This composite renders/owns its deck, inline detail region and pull overlay so M4 can mount it without reimplementing private state.
Use ordinary scoped DOM, not the original fixed-size Shadow DOM music scene. Scope CSS pd-/pp-/pw-. Actual pointer dragging belongs to Deck; click-only Spider reference does not supply drag. Drag release suppresses accidental follow-up click; buttons/keyboard provide equivalent selection/inspection. Pull animates a visual clone, not the same transform shell used by drag; final detail content stays readable. Latest-request handling, resize/reduced/cancel/close settle coherently.
Preserve the source's aim/wrap/tension/carry/landing feel with a compact shield/bookmark/policy token and thin marker-colored tether. Avoid perpetual idle spider/music animations. If copying source code, preserve relevant source/third-party notices. Native adaptation preferred; request M0/M4 packaging coordination before any new dependency.

## M4 hero / page integration

window.PolicyHeroTransition.mount(host,{conceptOptions,onState}) -> {play(),finish(),replay(),destroy(),state}. Mount the existing concept inline, await its actual controller phases/Promise, then transfer a shared name/paper anchor into the final hero. Maintain stable surrounding geometry. Skip lands on final hero; replay cancels old work. Slow background names independently of source icon beats, eliminate conflicting scans/title layers. Add a subtle completion-palette dispersion layer behind readable names and brand at controlled phase transitions. Reduced motion presents final hero without a mandatory delay.
Use PolicyConceptData names and sources. Existing concept API play/pause/resume/finish/destroy may be extended compatibly with optional scan configuration. Existing callers and regression suites should still work.
New entry showcase.html is the final delivery page; retain index.html as prototype reference. Compose a normal responsive page with sections: concept-to-policy hero, control/choice samples, four-priority marker + original wording, policy workbench, contextual chat, generated checklist reveal, short integration notes. Explain each effect's purpose/trigger/placement in user-friendly English; keep low-level implementation detail in docs.
Use PolicyAgentMotion and PolicyAgentReplies in a small showcase-chat adapter with local transcript/draft/busy token; do not extract or clone the whole app.js IIFE. Use PolicyCompletionReveal with [data-reveal-content]/[data-reveal-row] and actual selected demo items.
Load order: existing base/component CSS, then ui-theme/notebook/markers, then shared liquid controls (coordinate component-specific CSS scopes). Load fixtures/data and controllers before showcase.js. Shared controls apply to the old prototype and focused previews too.
Build all local styles/scripts/SVG assets into dist/showcase.html. Current builder only special-cases paper asset replacement inside app.js; extend this for all new assets. Update server allowlist and package checks. No server is needed to show results; M0 uses html_preview then html_render.

## Implementation / review discipline

Each independent module session must use two roles: first a native implementation subagent with bounded file ownership; after it finishes, a fresh read-only review subagent. Explicitly forbid those subagents from spawning more agents. Inherit Codex model/options, no overrides. Coordinator fixes small findings and reports actual checks. Do not make extra top-level threads or worktrees.
Write per-module status/evidence to design/modules/<module>.md, not TASK_BOARD.md. Report to M0 with files, exported APIs/hooks, actual commands/results, remaining limitations and dependency requests. If dependencies are not ready, complete independent implementation/spec work and end with precise integration needs; do not poll/sleep or invent placeholder success.

## Final gates

No card-grid default for normal content, no orange primary/PL mark in final page, no fixed screenshot-sized device shell, no music artifacts, no copied dark Krea screen. All modules have destroy/reduced/resize/reentry behavior. Test real policy drag and keyboard alternative, matching detail data, selected generated items, source highlight priority, hero continuity, non-conflicting text and subtle background dispersion. Validate 320/390px widths and short viewport, all local resources embedded, no console errors. M0 accepts the full assembled page after module reviews; unit counts alone are not final acceptance.

M0后续兼容扩展：Workbench可选pullToken为shield/bookmark/policy，默认shield；最终指南显式使用bookmark。它只配置已有PolicyPull主体，不改变轨迹或增加后端。
