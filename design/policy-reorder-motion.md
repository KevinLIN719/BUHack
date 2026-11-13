# Policy paper reorder motion

Implemented 2026-11-13 as a frontend-only refinement of the existing native PolicyDeck. Files changed: policy-deck.js and policy-deck.css. No data, Workbench API, ordinary question rows, backend, dependency or missing CardSwap engine was added.

## Behavior and ownership

The actual DOM order and selection still update synchronously. A finite380ms FLIP on each generated outer `.pd-card` carries it from its previously visible position to the new grid position. The pointer shell remains the sole owner of live dragging. After release, that shell only animates the remaining drag rotation to identity. The inner paper retains its small CSS tilt; existing liquid-button skins are untouched.

A drag snapshot includes pointer displacement before clearing the shell or changing DOM order. This prevents the dragged paper from snapping back to its old cell before the swap. Rapid button/keyboard reversals sample the current rendered position. Pressing a paper during an active landing freezes its current card/shell transforms before the new pointer gesture, preserving the position under the pointer. Both matrix and matrix3d computed drag rotations are handled.

Public selection, including same-ID selection used by Workbench replay, commits an interrupted landing and any paper-tilt CSS transition before returning or issuing callbacks. The separate tether therefore measures a stable final paper rather than an endpoint still moving under it. Other rapid reorder and drag interruptions continue from their visible pose.

`PolicyDeck.timings` is the single JavaScript timing source: `{settle:380,easing:'cubic-bezier(.2,.85,.2,1)'}`. The owned root exports these as CSS variables for the small paper-tilt transition. Existing select/cancel/destroy/selectedId remain unchanged. `data-pd-motion=settling|landing` is transient visual state on generated cards.

No-WAAPI, reduced-motion and forced-colour modes use the real immediate DOM swap. Public cancel, resize, scroll, blur, hidden document/ancestor, removed host and destroy settle transient transforms and animations. Pointer cancellation or an unmatched drop can return softly. A same-size initial ResizeObserver notification is ignored; actual list-size changes settle motion. No RAF or new timer is used by the landing layer. The pre-existing single500ms follow-up-click guard remains intentional and is cleared by destroy.

## Actual checks

- `node --check policy-deck.js`: passed.
- Existing `/tmp/policy-lens-m3-implementation-check.mjs`:56/56 passed.
- Existing `/tmp/policy-lens-m3-fallback-check.mjs`:5/5 passed.
- `/tmp/policy-lens-deck-settle-check.mjs`:28/28 passed. Tests cover synchronous DOM order/selection, two-card FLIP, actual previously visible start position, rapid reversal, pointer interruption/freeze, drop position preservation, matrix3d rotation preservation, independent shell rotation, finish/cancel cleanup, unmatched return, resize/media/hidden/removed-host cleanup, same-size observer behavior, destroy, no-WAAPI and a synchronous inspect handoff with no remaining card/shell animation.
- Actual `html_preview` uses the current files in `/tmp/policy-lens-deck-motion-browser.html` at1100px and390px, without a server. Browser WAAPI is paused only to measure poses. First-swap discontinuity is0px; pointer interruption is0.0000229px /0.0000458px; drop-start discontinuity is0.0000305px /0.00000763px. The real DOM order becomes health/travel/home, home is selected, no shell inline transform remains, and native shell rotation is preserved across release. No horizontal overflow or runtime errors.
- At1100px, finishing the paused native animations and allowing the browser's animation events to run yields0 remaining owned card/shell animations and0 inline transforms. This is lifecycle evidence; the screenshot itself is not claimed to be a frozen intermediate pose, because the preview host can resize/settle after measurement.

Temporary jsdom geometry/animation models establish state and continuity algebra; the browser measurements separately establish real layout/interpolation starts. No physical-device touch certification or exact reproduction of the unavailable CardSwap engine is claimed.

## Integration boundaries

The layout below the card deck is not redesigned. External changes to the list's size or viewport intentionally settle landing immediately to avoid stale geometry. Source data arrays remain unmodified. The layer owns only generated card/shell transforms; consumers should keep their own transforms on a separate wrapper. Main-page rebuild and cross-module acceptance belong to M0.
