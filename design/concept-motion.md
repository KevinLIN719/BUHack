# Policy Lens concept introduction

The working name remains **Policy Lens**: look closely at wording and coverage boundaries before purchase. This keeps the existing interface, paper visual and exports consistent. Two naming directions considered were Clausewise and BeforeCover; the current unit does not claim name or domain availability.

The current notebook uses a quieter presentation of the reusable component: whole insurer names reveal once, sixteen symbol beats are stretched across the presentation duration, and the field retires before dotted type appears. Its exact visible name and the real policy paper travel into the home without changing stage height. Teal/violet registered marker passes, amber copy and paper accents use the existing palette. The standalone non-quiet reference described below keeps its original cadence. See [current continuity contract](planning/concept-home-continuity.md).

## Reference and adaptation

User source: `720x900.mp4`, 720 × 900, 60 fps, 160 frames, approximately 2.667 seconds. Frame evidence is under `/tmp/policy-lens-concept-study/`.

The original uses a stationary 5 × 7 dot grid. Large disks switch visibility to show S → A → 2 → 0 every ten frames (166.667ms), repeating four times. The disk positions do not morph or ease. Small uppercase text occupies fixed columns behind them; character visibility reveals and erases from left to right, staggered across columns. The perceived flow comes from these scans, rather than translated text blocks. The source ends on 0, with background scanning still active.

The insurance adaptation retains the fixed geometry, fast four-beat cadence and character scanning. Even rounds show dollar, yen, shield and paper; odd rounds show euro, pound, shield and paper. The original 16 beats are preserved. The added ending holds a dotted POLICY LENS briefly and resolves it into the solid English name. Dot-word width aligns to the actual wordmark at the current container size, keeping the transition coherent. The brand name, tagline and sixteen market names use current light-mode theme tokens.

## Market names and sources

Describe these as **insurers operating in Hong Kong**, not as exclusively Hong Kong-owned businesses. Names are market context; no insurer logos, product rankings or affiliations are presented. The [Insurance Authority register](https://www.ia.org.hk/en/supervision/reg_insurers_lloyd/contact_list_of_authorized_insurers.html) and [government VHIS provider list](https://www.vhis.gov.hk/en/consumer_corner/list-providers.html) support the market context. The exact display strings and their official brand-page URLs are stored in `concept-data.js`:

AIA; Prudential; Manulife; AXA; FWD; HSBC Life; BOC Life; Sun Life; Chubb Life; Zurich; Hang Seng Insurance; Bowtie; Bupa; Blue Cross; China Life (Overseas); CTF Life.

The current CTF Life name is used. The implementation does not fetch these sites during playback; all verified text is local and offline-capable.

## Reusable component

`PolicyConceptMotion.mount(host, {name, tagline, insurers, autoplay, onPhase})` returns `play`, `pause`, `resume`, `finish`, `destroy`, `state` and `phase`. `onPhase(phase, state)` updates surrounding controls. Its frozen `timings` object is the sole implementation timing source. Generated child nodes and owned host properties are removed/restored on destruction.

The finite animation runs only while active. Manual pause, hidden-document pause and offscreen pause preserve elapsed time. Replay starts afresh after finishing the previous run. Reduced-motion or absent-RAF paths immediately show the final name. Missing scripts/data have a static text fallback. Decorative insurer text and SVG are hidden from assistive technology; the host has a concise accessible name.

`concept-preview.html` demonstrates autoplay with Replay, Pause/Resume and Skip controls. The home page's **Watch the concept** entry opens the same reusable component. It does not add a mandatory step to the existing review. `scripts/build-preview.mjs` now bundles the index and both focused previews without external local resources.

## Verification

Compare actual start/symbol frames, dotted-to-solid transition, final desktop/mobile lockup and short-dialog source-link visibility. Check pause, replay, reduced motion, removal and hidden/offscreen lifecycle cleanup. Check that closing restores launch focus and the existing review/export loops still work. The final source passed 55 runtime and 55 concept acceptance checks, plus the existing 39 original-flow, 51 Agent and 32 completion checks. Browser snapshots separately cover real layout and motion phases; jsdom uses controlled geometry and RAF.

The `oil-motion` continuity and runtime checks apply. This is native DOM/SVG; generated-media, video-delivery and atlas production are not used.
