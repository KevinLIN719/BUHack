# M2 — Shared shallow-convex controls

Implemented 2026-11-13 in `liquid-controls.js` and `liquid-controls.css`. The required implementation agent and subsequent fresh-context read-only review agent have both completed. The coordinator fixed the review's five findings and verified the corrections below. This report belongs to M2; entry loading, packaging and full-page acceptance belong to M4/M0.

## Reference and adaptation boundary

Read the frozen `MASTER_PLAN.md`, module contracts, complete prompt inventory, factual `WORKSTATE.md` and `/tmp/policy-lens-liquid-study/observed-button-reference.md` before implementing. The white shallow-convex reference is the 960×960 `...5744f96a-446e-40d0-8413-7160f74db969-mp4.mp4`; the 1314×844 `...7917a911...` is OTP and was not used to infer button material.

The surface uses an opaque off-white cap, a fine gray-green perimeter, bright lower inner rim and diffuse bottom shadow. Hover darkens the cap. Ordinary controls remain white; selected controls use a pale teal surface and teal perimeter, and primary actions use the shared dark teal. No glass streaks or liquid bridges were inferred from the video. The visible QQ squash/stretch is the user's requested extension, not a measured deformation in the source: 90ms to `scale(1.035,.92)`, then a 460ms diminishing rebound through `.965,1.065`, `1.02,.982`, `.994,1.008` and identity. Only the decorative skin is transformed.

The supplied PixelToggle text is a React lifecycle wrapper importing `./PixelToggleEngine.js`; neither that engine nor its implementation is present. Repository searches find that name only in captured requirement material and this adaptation's explicit disclaimer. **This is an authored native behavior/surface adaptation, not execution or reuse of the missing PixelToggle engine.** No React, provider, dependency or network request was added. Application choice state, toggle semantics and click handlers remain owned by the application; this module does not generate day/night pixels or manufacture toggle content inside the wrapper's otherwise empty host.

## Public API

```js
const controls = window.PolicyButtonMotion.mount(document, {
  // Defaults shown; selector replaces the default selector when supplied.
  selector: 'button,summary,a.button,a.icon-action,a.text-action,[role="button"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"],[data-liquid-control]',
  pressMs: 90,
  releaseMs: 460,
});
controls.refresh();            // Rescan this root and repair skins synchronously.
controls.update({releaseMs: 460}); // Merge options, preserve controller/state/skin.
controls.destroy();            // Idempotent cleanup; remount is supported.
```

The default document mount runs once after DOM readiness. A successful explicit document mount consumes the pending bootstrap, so destroying before DOM readiness stays destroyed. Calling `mount` again on the same root returns the same controller and merges supplied options. Document and scoped mounts may overlap: they share one skin and one event service per document; destroying one controller retains skins owned by another. Scoped motion options take precedence over the document owner; among scoped owners the most recent successful mount/update wins. `refresh()` does not change that precedence. Invalid selectors are validated before publishing an instance, allowing a clean retry.

Roots may be a Document, connected Element or ShadowRoot. A detached scoped host settles/removes its skins and remounts when reattached to the document. A detached light-DOM host mounted before attachment is discovered on insertion. Open/closed shadow content requires mounting its actual root or a connected element inside it; the module does not discover that content from the document. Shadow mounts receive local delegated event listeners and inherit hidden/inert/ARIA state across their hosts. Include this stylesheet inside each shadow root because document CSS does not cross the boundary. Moving roots between documents is outside this adapter's contract; destroy and mount again in the new document.

For an existing wrapper with a mount/update/destroy shape, use a clearly named local replacement adapter after supplying native button markup inside its host:

```js
// Native replacement adapter — NOT the unavailable PixelToggleEngine.
export function mountNativePolicyControls(host, options) {
  return window.PolicyButtonMotion.mount(host, options);
}
```

The React wrapper can call that adapter from its existing lifecycle and forward `controller.update(options)`, then `destroy()` on cleanup. Its import must explicitly identify the replacement. An empty `<div data-motion-component="pixel-toggle">` stays empty until its owner renders actual controls; this module never inserts a fake interactive wrapper.

## DOM hooks and behavior

- Mounted controls receive `.liquid-control[data-liquid-mounted]` and exactly one direct child `<span class="liquid-skin" aria-hidden="true" data-liquid-skin></span>`. The skin is appended after existing content. Text nodes, label spans, check-box decorations and SVG identities are preserved. A supplied `.liquid-skin` is treated as the reserved decoration hook and adopted; do not put meaningful content there or supply multiple layers.
- `data-liquid-selected="true|false"` reflects `aria-pressed`, `aria-selected`, `aria-checked`, `aria-current`, `data-selected`, `data-state=on|checked|selected|active` and `.is-active/.is-selected/.selected`. `data-liquid-disabled` reflects native disabled/fieldset state and inherited `aria-disabled`/`inert`. `data-liquid-pressed="true"` exists only during an active press. These are module-owned hooks; product state should use the input attributes above.
- `.solid`, `.agent-send-button` and `[data-liquid-variant="primary"]` select the primary surface. Icons retain existing width/height; icon controls use circular radius. Other controls use a pill radius. Compact legacy navigation/text actions receive enough horizontal padding for a rounded face.
- `[data-liquid="off"]` or `[data-liquid-ignore]` excludes an element and its subtree. Use this for a policy-paper/drag surface whose actual outline must remain a document, while leaving its ordinary action buttons mounted. `[data-liquid-control]` explicitly includes a native HTML action element. Ordinary links and native inputs/file fields/select/reviewed checkboxes remain unchanged. A non-native role button still needs its owner's accessible keyboard behavior; this module does not synthesize clicks.
- Event delegation covers pointer press/release, cancellation, lost capture, native drag start, Enter/Space, focus loss, visibility changes, resize, blur and pagehide. No event uses `preventDefault`, stops propagation, dispatches an action or captures the pointer. Disabled appearance does not replace an application's responsibility to suppress actions on an `aria-disabled` non-native element.
- `textContent`, `replaceChildren`, whole-page replacement, newly inserted suggestions/sources/modals and role changes are observed. The same existing skin is reattached after label replacement. Completion fade animations and `.agent-send-pulse` nodes are neither restyled nor canceled. Skin transforms never write to the host's transform. Host positioning defaults to relative through a zero-specificity rule so existing absolute/fixed/sticky positioning remains authoritative.
- Mutation observers also cover inherited disabled/hidden/inert and CSS hiding. Only active motion checks computed visibility through ancestors. Detached controls cancel their animations and relinquish records. Standard selected/disabled attributes and default selector hooks update automatically; arbitrary custom selector attributes need an explicit `refresh()` after modification.
- WAAPI animations are tracked only while needed, sample the current skin transform on interruption and cancel/remove fill on completion. With no WAAPI there is a simple CSS press/release fallback. Reduced-motion and forced-colors use immediate final states without WAAPI; forced-colors keeps ButtonFace/ButtonText, Highlight selection/focus and GrayText disabled cues. No perpetual animation or `will-change` remains.
- Destroy disconnects the root observer, removes owned generated skins/hooks, restores preexisting hook values, cancels transient animation and removes shared document/window/media listeners after the last controller is destroyed. It does not delete labels/SVG or any original event handler.

## Tokens and M4 integration

Uses the agreed M1 tokens with local fallbacks: `--primary:#1F5E60`, `--primary-foreground:#fff`, `--ink/--foreground:#253B3D`, `--ring`, `--control-face:#f7f8f5`, `--control-hover:#edefeb`, `--control-pressed:#e3e7e2`, `--control-line:#d8dfd9` and optional `--control-shadow`. Selected/primary gradients derive from `--primary`, not a hardcoded orange. Material fallbacks do not redeclare root brand tokens.

M4 must:

1. Add `liquid-controls.css` **after** existing base/component CSS and M1 theme/notebook/marker CSS on showcase.html, index.html, completion-preview.html and concept-preview.html. Avoid later broad button rules overriding its material hooks.
2. Load `liquid-controls.js` as a local deferred script before showcase initialization (it has no dependencies). Its automatic document mount is sufficient; explicit `PolicyButtonMotion.mount(document)` remains idempotent.
3. Include both resources in standalone build in authored order and the serve allowlist/package checks. There are no additional assets or packages.
4. Give single/multi choice samples actual native buttons plus the application's `aria-pressed`/`aria-checked`/`aria-selected` state and existing handlers. Do not replace native inputs with decorative button wrappers.
5. M3's transform-driven policy-paper surface can opt out with `data-liquid="off"` if it is itself rendered as a button; descendants excluded by that opt-out should instead be placed outside it if they require ordinary control skins. Use native action siblings for selection/inspection.

No entry, builder, app.js, other module production file, total plan or task board was edited by M2. Loading these files into every entry and accepting the assembled showcase remain explicit M4/M0 tasks.

## Actual verification

- `node --check liquid-controls.js`: passed.
- `node /tmp/policy-lens-m2-controls-test.cjs`: **42/42 passed**, using the existing jsdom at `/Users/fanxinyun2/.npm/_npx/32b3ceb8ef573b04/node_modules/jsdom/lib/api.js`, without installing dependencies. Covers auto/explicit/overlapping mounts, original text/SVG identity, summary/actions/role choices, excluded native controls and links, disabled/fieldset/inherited ARIA state, Enter/Space/repeat, native click preservation, pointercancel, rapid reentry, label replacement/fade preservation, pulse coexistence, dynamic suggestions, detach/reattach of both controls and scoped roots, media listener cleanup, destroy/remount, options/update/invalid selector, reduced/forced-colors, CSS hiding and absent WAAPI. Controlled animation stubs validate lifecycle/target/keyframes; they do not prove real interpolation or visual layout.
- `node /tmp/policy-lens-m2-integration.mjs`: **16/16 passed** through the actual application, including page/modal/choice/source/chat/new replies/completion, native reviewed checkbox, handlers/focus, destroy and zero runtime errors.
- `node /tmp/policy-lens-m2-owner-fixes.cjs`: **17/17 passed** after review fixes: early destroy, scoped/latest-updated duration precedence, clean retry after invalid initial selector, open/closed shadow pointer feedback, host hiding/inert, resize and shadow listener teardown.
- Review diagnostics rerun after fixes: `node /tmp/policy-lens-m2-review-lifecycle.cjs` now measures scoped release at **800ms both before and after document-owner destruction**, with retry selection state synchronized. `node /tmp/policy-lens-m2-review.cjs` measures opaque system ButtonFace for ordinary/primary/disabled-primary skins in **native Chrome forced-colors**, zero shadows, selected Highlight border, feedback in both shadow modes, no active animation after host hiding, inherited inert, and **0 skins after early destroy plus DOMContentLoaded**. These diagnostics print measured values; the lifecycle suites above contain assertions.
- `node /tmp/policy-lens-m2-review-browser.cjs`: actual Chrome keyboard input activates Enter/Space **once each**; reduced-motion active press has identity transform and zero animations; responsive hiding settles feedback; finished rebounds leave zero animations and no runtime errors. Existing local Chrome/playwright-core were used for these focused behavior diagnostics; no dependency was installed.
- Actual `html_preview` at **1000px, 390px and 320px**, with **18 skins/18 controls**, no horizontal overflow and no console errors. Paused real WAAPI frames measured skin matrices `(1.035,.92)` and `(.965,1.065)` while host/text Range/SVG rectangles stayed unchanged and the host transform remained none. Material visually reads shallow white/gray rim/soft bottom shadow with teal primary. Self-contained preview: `/tmp/policy-lens-m2-preview.html` (temporary QA artifact, not an entry owned by M4). No server was started.

## Independent review and owner fixes

The fresh-context read-only reviewer independently passed the original 42/16 suites, then rejected the initial version for four P2 issues and one P3 issue. It changed no project file. The coordinator resolved each within M2 ownership:

1. Primary variant specificity beat forced-color ButtonFace. Variant matching now uses zero-specificity `:where()`, allowing subsequent disabled/system-surface rules to win. Native forced-color computed surfaces are now opaque.
2. Pending DOMContentLoaded bootstrap remounted an explicitly destroyed document controller. Successful explicit document mounting now removes the pending named bootstrap listener.
3. Closed shadow events and shadow-host state were missing. Root-local event listeners have reference-counted cleanup; ancestor traversal follows slots/hosts, including hidden/inert and opt-out state.
4. Automatic document ownership overrode scoped timing options. Scoped owners now win, with explicit latest-update precedence among scopes.
5. Empty initial selector validation could leave a published controller without its observer. The exact merged selector is now validated before services and publication; retry state updates pass.

The coordinator also added resize settling. Review findings were verified through the original diagnostics and the 17 new assertions. This is owner verification following independent review, not a claim of a second independent acceptance pass.

## Remaining limits and next gate

The native adaptation cannot verify the unavailable PixelToggle engine's exact motion/state implementation. Source-video identity/material is supported by the supplied study; the stronger QQ extension and teal treatment are authored adaptations. The app's business choices, radio-group arrow navigation and non-native role activation remain its owner's behavior. Reduced/forced-colors were checked in Chrome; other browser engines and the final assembled page remain M0/M4 acceptance work. Arbitrary stylesheet/media changes beyond observed DOM state, resize and reduced/forced-color changes may require an explicit `refresh()` to settle a newly hidden active control. M2 is ready for M4 loading/packaging and M0 final acceptance; these entry changes remain outside this module's file ownership.

## M0 follow-up: native choice surfaces

After the completed module handoff, M0 added an explicit opt-in compact wrapper for native checklist choices: a span carrying data-liquid-control and data-liquid-choice around the real checkbox/radio. The wrapper has no role or tab stop; checked/disabled come from its input, native change refreshes sibling state, and keyboard focus is visible on the wrapper. The input itself remains native and unskinned; ordinary native inputs remain excluded. Programmatic checked writes without change need refresh(). See ../../design/planning/choice-followup.md for the actual 42/17/17 regressions, targeted checks and390px browser evidence. The absent PixelToggle engine is still not claimed as reused.
