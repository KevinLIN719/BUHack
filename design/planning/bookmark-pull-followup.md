# Insurance bookmark pull · 2026-11-13

The user supplied the complete Spider Track Switcher attachment again and asked how to replace the spider with insurance/notebook content, especially clicking papers to see details.

## Applied direction

Use a small policy bookmark. In the live demo, clicking a policy leads from that document to its exact original wording, four numbered review priorities and questions to confirm. The five finite phases remain aim → trace/wrap → tug/tension → carry → settle/landing. This gives the motion a document-to-note meaning.

Two additional placements are documented as suggestions, not built business features: highlighted clause → explanation; saved question → notebook list. The final scope stays a single frontend component guide.

## Reference and implementation

The supplied attachment is1514320bytes/848lines and contains a complete click-driven music player engine, including aim/wrap/carry, strain/tremor, curved transfer, pending selections, reduced-motion handling and runtime cleanup. The giant embedded artwork line was skipped during source reading. Its source-study/provenance record remains in design/modules/policy-interactions.md.

The existing native PolicyPull already implements the adapted finite trajectory and supports shield/bookmark/policy tokens. No new animation engine, source artwork, music scene, font asset, provider or dependency was added.

- policy-workbench.js now accepts optional pullToken, preserving shield as its default. The guide mounts it with pullToken:'bookmark'.
- showcase.js wires Replay selected policy’s note reveal to the selected Workbench instance. It disables that control when no workbench/selection is available.
- showcase.html/css adds Note pull navigation, a separate explanation, the replay control and an eighth Frontend usage panel. It explains the connection, trigger, current live example and suggested future placements.
- The native Workbench owns one overlay and pull controller. The guide reuses that instance rather than mounting a second controller on its overlay.
- README is updated for eight usage panels and the policy-bookmark demo.

## Actual verification

- npm run check/build pass.
- /tmp/policy-lens-bookmark-delta.mjs passes: actual bookmark option; all three exact policy notes; aim/wrap/tension/carry/landing; repeated replay; selected-policy changes; closing/reopening; hidden document; reduced motion; eight guide panels; destroy cleanup; no captured runtime errors.
- Existing whole-page acceptance17/17, focused final built-artifact check and current five-entry delivery audit all pass.
- Actual browser preview at1100px and390px freezes one real carry pose at800ms: token is bookmark, token and carried paper are both inside the overlay, selected health-policy detail and exact wording match, viewport/document widths match, no console errors.
- The paused fixture uses a controlled clock and one copy of the actually painted layer to retain the pose after initial browser resize/scroll settlement. This is screenshot instrumentation only, absent from production and the final interactive display.
- Normal runtime previews at320px and728px show the new explanation/replay. Viewport/page widths match304px/712px, token bookmark, eight panels, exactly one shared replay-button skin, no console errors.

The existing native trajectory remains an authored insurance adaptation informed by the supplied source. No claim of running the music player unchanged or reproducing every source frame is made. The bookmark never establishes real cover or claim eligibility.
