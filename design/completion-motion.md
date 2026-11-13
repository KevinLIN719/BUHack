# Completion reveal

Reference: the user's `2396x2160.mp4`, 2396 × 2160, 60 fps, 298 video frames, approximately 5 seconds. Frame study and crops are in `/tmp/policy-lens-completion-study/`.

## Observations

The source has a tall pale results panel and a stationary white composer over its bottom. Generate changes through a brief blur into a loading state at about 0.85–1.05 seconds. A faint halo appears at the panel's bottom around 2.60 seconds. The main completion effect crosses the panel from about 2.75 to 3.75 seconds, with the residue gone around 3.90 seconds.

The effect is a broad, diffuse upward wash. Yellow sits toward the lower left, pink/magenta toward the lower centre, violet/blue above, and cyan/mint along the leading region. It fills the panel width. The lower result rows become legible first, followed by the higher rows. Whole row contents appear; there is no character typing. Text briefly shifts upward and then slightly below its resting baseline while it sharpens. At a 620px panel width, the observed movement is approximately −9px then +4px. The composer stays stationary and sharp.

The source does not establish circular rings or separated RGB outlines. A narrow orange ring would lose the characteristic broad light and spatial reveal.

## Product mapping and runtime

`completion-motion.js` exports `PolicyCompletionReveal.mount(host, {onPhase, prepareMs})`. The controller supplies `play()`, `cancel()`, `destroy()` and `state`. `PolicyCompletionReveal.timings` is the only implementation timing source. The host contains `[data-reveal-content]` and optional `[data-reveal-row]` rows. Colors and the broad light layers are defined in `completion.css` using the four `--priority-1/2/3/4-*` marker pairs: cherry, amber, teal and violet. The final refinement layer must not recolour them orange.

The controller holds an inaccessible, faint visual duplicate while preparing, then moves a layered spectral wash from top to bottom. A collective soft mask reveals the real list behind it. Row transforms approximate the reference's small local deformation rather than making cards enter independently. Geometry follows the visible result surface, including lists taller than the viewport. The visual duplicate and temporary effects are removed afterward.

The app's **Generate checklist** action validates the currently selected questions and opens a white grid-paper notebook with native confirmation checkboxes. Each question is a label beside its checkbox; the exact wording and source sit in a collapsed details element below. These sheet-local ticks do not change source selections or review states. It preserves exact edits and available references; unmatched Agent questions explicitly have no matching wording. A generation preview does not count as copying, sharing, adviser confirmation or a coverage decision. Copy/download use the existing export path after generation. Replaying and cancelling the animation retain the current sheet and its checked/expanded states. New generation creates unchecked inputs; changing source selections invalidates the old sheet. Closing and changing pages cancel the active animation.

`completion-preview.html` is a focused interactive demonstration with four concise sample questions. It starts with faint placeholders, then reveals all four when the user generates. `dist/completion-preview.html` is self-contained. The connected experience is the default entry in `dist/index.html`; the earlier journey remains in `dist/journey-reference.html`.

## Acceptance

- Compare a paused middle-of-sweep frame with the reference, then the clean final list.
- Keep prompt geometry and buttons steady while only the results surface changes.
- Keep long-list masking aligned to the host viewport; final content must remain scrollable.
- Ignore duplicate play while busy; resolve cancelled runs and clean up timers, observers, clones and animations.
- Restore inline styles, ARIA and inert state without overwriting newer external changes.
- Reduced-motion and absent-WAAPI paths immediately present the complete readable result.
- Preserve blank-question validation, exact text, references, copy/download and manual-copy fallback.
- Verify narrow and short screens without horizontal overflow or inaccessible completion controls.

This follows `oil-motion` state, continuity and cancellation checks. It is native DOM motion; generated-media, atlas and video-delivery production steps are not needed.

## Notebook update acceptance

- White paper uses the existing 24px grid and a fine notebook margin rule.
- One native checkbox precedes each question; clicking its label and pressing Space both work.
- New sheets start unchecked. Replaying or stopping the reveal retains ticks; these do not imply a coverage decision.
- Collapsed source details keep the main sheet concise without dropping exact quotations or references.
- The spectral wave is transient; after it finishes the final paper remains white.
