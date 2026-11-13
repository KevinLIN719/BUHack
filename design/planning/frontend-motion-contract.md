# Frontend motion contract · 2026-11-13

The user's current instruction is to finish frontend visual changes and transitions, preserving the refined notebook style. The final artifact remains one UI component guide. Backend services, production data retrieval/persistence and a complete business journey belong to teammates.

## Visible intent

- Reveal and dismiss UI surfaces with continuity instead of abrupt content cuts.
- Change policy wording, findings and choice content with a short opacity treatment, while exact text and state update synchronously.
- Reorder policy papers from their actually visible positions; preserve drag ownership and click suppression.
- Keep the concept handoff, flowing messages, completion wash and bookmark tether as their existing primary effects.
- Use native smooth page-anchor navigation, with reduced-motion/forced-colour fallback.
- Rapid reversal or cancellation must converge to the latest readable state, with no orphan animation, clone, timer or event listener.

Driver is UI state, click, keyboard and pointer. Input semantics are discrete events plus continuous dragging. Playback is finite segment motion; latest valid requests take priority. Idle state has no decorative animation. Background and text remain native DOM; no media-generation pipeline or service is needed.

## Geometry ownership

| Surface | Owner | Integration boundary |
| --- | --- | --- |
| Concept name and hero paper | PolicyHeroTransition | Do not add a second Surface transform. |
| Button/choice decoration | PolicyButtonMotion | Animate its skin; labels, native inputs and hit boxes stay stable. |
| Drag shell / paper landing | PolicyDeck | Pointer shell stays distinct from reorder FLIP. |
| Bookmark/token/carried clone | PolicyPull | Measure the final source/target geometry; same-size observer notifications must not cancel it. |
| Composer and message flow | PolicyAgentMotion | Settle chat-panel opening before measuring launch geometry. |
| Completed result content | PolicyCompletionReveal | Keep its reveal as the sole generation entrance; no simultaneous height entrance. |
| Disclosures, chat visibility, ordinary content | PolicySurfaceMotion | Own only its finite styles/snapshots; semantic hidden/open states update synchronously. |

Workbench detail content uses opacity only when opening or changing, leaving the tether target's position and dimensions stable. Closing can release its layout after motion cancellation. Paper pointerdown/navigation cancels an old tether before manipulating its live source.

## Facts and verification

Runtime timing values belong to each controller's exported timings; documentation references them rather than copying alternate values. No underlying insurance/source data is inferred or changed by motion. Existing fictional examples remain clearly labelled.

Validation must cover native summary keyboard interaction, repeated open/close, close/send/reopen chat, interrupted swaps, exact policy/detail and wording matches, reduced/no-WAAPI behavior, initial resize notifications, actual size changes, hidden/removal/destroy, responsive layout and packaged default entry.
