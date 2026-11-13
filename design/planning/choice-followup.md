# Shared choice follow-up · 2026-11-13

The user repeated the PixelToggle lifecycle wrapper and asked that all buttons, the Where are you going single-choice group and every choice use the same effect. The supplied wrapper still imports absent PixelToggleEngine.js and motion-runtime files; it contains no animation implementation. M0 retains the documented native adaptation, with no pixel/day-night content or React migration.

## Read-only coverage audit

A fresh read-only agent verified 29/29 current action buttons with one shared skin, all four destination choices, both summaries and dynamically inserted chat suggestions. Destination selection stays exclusive. The only uncovered choice type was the four native checklist checkboxes.

## Implemented difference

- showcase.js places each native checkbox inside a compact data-liquid-control / data-liquid-choice span. The input, label activation, checked property, native change event, focus and keyboard behavior remain intact. The row remains an ordinary fine-rule list.
- liquid-controls.js reads checked/disabled from explicitly opted-in native choice wrappers and refreshes on native change events, including sibling radio groups. It does not add roles, tab stops, synthetic clicks, pointer capture or preventDefault.
- liquid-controls.css adds visible native-input keyboard focus to the wrapper, including system Highlight in forced colours. The same decorative skin press/rebound animates; the checkbox and its hit box stay stable.
- showcase.css sizes the compact surface at34px and leaves the source text/priority markers unboxed. General native fields remain outside the effect unless explicitly wrapped.
- Programmatic checked-property changes without a native change event require controller.refresh(), just like other application-owned state updates.

## Actual validation

- npm run check/build passed; four self-contained outputs rebuilt.
- Existing shared-control suite42/42 and previous owner-fix suite17/17 pass.
- Whole-page acceptance17/17 passes, no bugs.
- /tmp/policy-lens-choice-delta.mjs passes: all action buttons and destinations; four actual checkbox wrappers; only skin motion; one native change per input/label action; checked and selected synchronization; preserved keyboard default; disabled state; native radio siblings; dynamic policy replacement; one skin; full destroy cleanup; zero runtime errors.
- Four-entry resource audit passes.
- Real html_preview at390px confirms four34px wrappers with one skin each, actual checked states match selected appearance, native focus remains on the input and the wrapper outline is visible. Viewport/document widths both374px, no console errors. Full controls section at728px renders without errors.
- The displayed page is the current artifact, focused on its existing controls section; no motion implementation is replaced in the presentation wrapper.

To reuse the original animation rather than this native adaptation, the actual PixelToggleEngine.js and its runtime dependencies are still required. This follow-up does not claim that the missing engine was supplied or executed.
