# Concept → policy home continuity

User follow-up: join the concept to the existing policy home with a continuous, refined transition; slow the insurer-name field; remove competing text animation; introduce the existing fluorescent marker palette. Scope remains the frontend component notebook.

## Visual and motion contract

The page owns the light paper background. The time-driven introduction is one finite chain, not a navigation overlay. The final home stays in layout from the first frame, with its controls inert until ready. Its real height anchors everything below the hero.

The visible concept name travels to the exact inline home wordmark. The destination is hidden until the shared title lands. The same policy image first appears beneath the concept name, then grows and travels into its home anchor. No paper clone, screenshot layer or second incoming title is used.

Insurer names reveal once as whole words with a small vertical drift. They finish their exit during the last paper-symbol beat, before the wide dotted word enters. Dotted and solid names have separate ink intervals. The tagline retires before the title moves, and body copy follows the title. Teal and violet marker passes remain registered under Lens; amber marks the payment phrase; corresponding accents appear on the illustrated paper. These decorative accents do not assign a review priority to the brand.

`PolicyHeroTransition.timings` is the handoff timing source; the existing `PolicyConceptMotion.timings` owns the default reference. Quiet presentation stretches the sixteen symbol beats across its configured symbol duration. The names clock is a rate parameter, not an additional fourteen-second wait. Replay, skip, resizing during travel, hidden travel, reduced motion, forced colours and removal settle or clean up the finite run.

Native DOM/SVG and WAAPI handle all geometry. No generated media, remote services or backend were introduced. The current file retains the standalone non-quiet concept reference cadence.

## Verification

- Syntax/build, existing default concept runtime 55/55, quiet concept checks, dedicated shared-handoff 12/12, whole-page 17/17, final built-page regression and five-artifact offline audit pass.
- Fresh independent read-only review found no P1/P2; nineteen extra interruption/preference lifecycle cases passed. The final small field-exit refinement was checked directly after that review.
- Actual browser geometry at 1100px includes the real mid-handoff title/paper. At 728/390/320px the final shared-title rectangles match their destination within 0.00002px, stage-height change is zero, paper/title stay inside the stage, and only one real policy paper exists. No horizontal overflow.
- Diagnostic clocks, paused WAAPI frames and setup-resize suppression exist only in temporary inspection documents, not production artifacts. The final displayed page uses the normal live runtime.

Implementation: concept-motion.js/css, hero-transition.js/css, showcase.html and assets/policy-sheet.svg. Final built entry remains dist/index.html, identical to dist/showcase.html.
