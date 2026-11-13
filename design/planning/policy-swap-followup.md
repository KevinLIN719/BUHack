# Policy paper swap clarification · 2026-11-13

The user repeated the CardSwap React lifecycle wrapper and specified dragging between several different policies. The previously accepted implementation already supplies that interaction through the native PolicyDeck / PolicyWorkbench. The original CardSwapEngine.js, its options type and motion-runtime remain absent; an empty-host wrapper alone does not reveal the original motion.

## Scope and changes

Only showcase.html copy changed. The component now explicitly presents “Swap between policy papers”: three different fictional policies can be dragged onto each other; opening a paper is a separate detail/marker reveal. Questions and findings remain fine-rule lists. The usage panel names the missing-engine boundary in place, alongside the actual native integration API.

A fresh read-only audit confirmed actual DOM swap, selected-policy/detail matching, pointer click suppression, touch-action:none, keyboard/button alternatives and the absence of card styling on ordinary question rows. PolicyDeck has select/cancel/destroy, not the unknown wrapper’s update API; the wrapper is not claimed to be directly plugged in. No speculative engine or React migration was added.

## Actual verification

- npm run build and the current five-entry delivery audit pass; dist/index.html still equals the final component guide.
- Browser html_preview uses synthesized PointerEvents against actual measured source/target rectangles at1100px and390px. Starting order travel/home/health becomes home/travel/health, selected and detail IDs both equal fictional-home-02, original wording remains exact, the follow-up pointer click is blocked, and four ordinary findings remain list rows.
- At1100px the drag shell records translate3d(-340.397px,33.8891px,0) rotate(-7deg); at390px it records the expected vertical movement translate3d(-0.918783px,-263.485px,0). These are actual runtime transforms under the temporary event fixture.
- Document widths match viewports1084px and374px respectively; no console errors. The paper computes touch-action:none. This is browser/layout and event-handler evidence, not a physical-device touch certification.
- The final unmodified controller demo was separately previewed at728px, focused on its updated policy section, without errors. View focus/event setup is only in temporary wrappers.
- Existing controller files were untouched, so no new broad behavioral suite was added or redundantly rerun.

Final entries remain dist/index.html and dist/showcase.html. Exact original CardSwap motion still requires its missing engine/runtime source.
