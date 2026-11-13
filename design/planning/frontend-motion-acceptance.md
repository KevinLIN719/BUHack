# Frontend motion polish · final acceptance · 2026-11-13

The user explicitly limited the work to frontend visual changes and smooth transitions, with backend and complete product functionality assigned to teammates. This delivery preserves the notebook/material/marker theme and the single component guide.

## What changed

- Added surface-motion.js: one idempotent page controller for small opacity entrances, native disclosure height transitions and panel visibility. Native hidden/open state commits synchronously. Outgoing snapshots are inert, stripped of business hooks and removed after their finite transition.
- Chat opens/closes smoothly and preserves its real input, draft and transcript. submit settles the panel before measuring the composer, leaving the original flowing-bubble engine as the sole launch owner. Unmatched evidence now uses the existing evidence transition.
- Switching policy wording/findings/choices uses short opacity-only entrances. Workbench does not change tether-target height or transform when measuring a route. Closing notes and replacing a completed checklist can leave through the surface layer; generating a new checklist retains the completion reveal as its sole primary entrance.
- PolicyDeck now lands with finite FLIP from the actual visible position, including drag displacement and rotation. Fast reversal/drag continuation preserve the visible pose. Selection stabilises a landing before handing geometry to the bookmark tether.
- Fixed two premature pull invalidations: a same-size ResizeObserver notification and a queued viewport scroll notification at the already-measured position. Actual viewport/list size changes and real scrolling still cancel stale routes.
- Paper gestures, keyboard navigation and policydeck:reorder cancel the old pull. This includes earlier/later buttons; fresh review found and Root corrected that last interference case.
- Native page-anchor scrolling is smooth, with reduced-motion/forced-colour fallback. Loading/packaging and the frontend handoff notes include the shared motion layer.

No backend, database, account, production AI, persistence, dependency or additional business route was added. Existing sample interactions remain local.

## Independent implementation and review

Two bounded implementation agents owned Surface and Deck separately, then stopped writing. A fresh read-only reviewer checked both and the root integration. It reported one P2: reordering with an earlier/later button left an old tether alive. Root added a synchronous reorder cancellation/listener cleanup and verified that scenario in the integration check. No other P1/P2 was found.

Root also identified and corrected partial-open disclosure tail exposure during implementation review; the Surface owner confirmed the clipped snapshot geometry in a real browser.

## Actual verification

- npm run check and npm run build pass.
- Surface19/19, Deck28/28 and the established whole-page17/17 checks pass. The fresh reviewer independently reran those scoped suites.
- /tmp/policy-lens-motion-integration.mjs passes against the actual self-contained artifact: disclosure reversal, unique/inert current-draft snapshot, close/open/send composer stability, exact note content with no target geometry animation, gesture/reorder versus tether cancellation, generated-result replacement, hidden/destroy and zero remaining RAF/animations/timers/ghosts/slots.
- /tmp/policy-lens-pull-resize-delta.mjs passes: same-size resize and same-position queued scroll preserve the active route; actual size/scroll changes and removal cancel and clear RAF.
- The focused final-artifact check and current five-entry delivery audit pass. Default dist/index.html remains identical to dist/showcase.html.
- Surface owner’s real browser checks cover728/390px disclosure and visibility states. A390px fast reversal has ghostBottom151.828px equal to oldVisibleBottom151.828px, so hidden tail content is not exposed.
- Deck owner’s1100/390px browser geometry gives zero first-swap discontinuity, interruption/drop errors below.00005px, continuous rotation, and zero owned animations/inline transforms after finish.
- Root’s320px native chat close/reopen check: actual panel hidden synchronously, closing slot measured30.890625px mid-transition, exact next draft copied into an inert snapshot with no duplicate data hook; reopen retains the same real textarea and draft, with zero ghost. Page/viewport widths both304px.
- Root’s1100/390px carry check now holds an actual painted800ms route without copying a visual layer: phase carry, bookmark/paper inside bounds, one pending finite route frame, no premature cancellation, no console errors. Page/viewport widths match1084/374px.

Browser inspection fixtures settle the preview host’s initial resize before starting an interaction. Controlled-clock carry poses, paused measurements and focus jumps are QA/display setup only. They are absent from the delivered HTML. jsdom checks establish state/ownership; browser geometry is recorded separately.

## Handoff

Final entries: dist/index.html and dist/showcase.html. Runtime timing values live in PolicySurfaceMotion.timings and PolicyDeck.timings; existing primary engines retain their own timing sources. Root owns page-level Surface destroy; components cancel only their own nodes.

Snapshots retain style classes for faithful painting. Business code should continue using stable data hooks or cached live-node references; broad class-only document queries can see a brief inert visual snapshot. Native primitive fallback keeps UI usable when WAAPI or motion is unavailable. No physical-device or all-browser rendering certification is implied.
