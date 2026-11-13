# Connected mock experience + one-page components

Latest scope: add an entrance that connects all frontend effects with mock data, and keep every individual component together on another page. The follow-up rejects the folded-paper/lens brand badge everywhere. Existing orange poster direction, notebook style and shared animation engines remain.

## Two entrances

- experience.html is the connected experience. It opens on the orange poster; an optional separate concept panel preserves the introduction. Its five review steps are policy selection, context, marked reading/scenarios, conversation and questions.
- showcase.html is the component notebook, with all eight standalone groups and their existing usage notes. Its previous duplicate poster has moved to the mock entrance. Both views link to one another.
- The offline build writes experience.html, showcase.html, three references and index.html as the exact default alias of experience.html. The optional dev server root also serves experience.html.

## Coherent mock loop

Three PolicyFixtures remain the single source of policy names, literal quotes, priority and original questions. experience-data.js supplies authored situations and local replies attached to those same findings. The selected policy drives the paper workbench, reading highlights, situation questions, chat evidence and final output. Topic-specific terms outrank broad words; unmatched questions have no borrowed source.

Two starter questions are selected for each policy. Keeping a reading/chat question or changing native checklist choices updates the same set. Grid-paper notes travel with the final list. Switching policy preserves each policy's notes/selection separately, clears the conversation and invalidates stale output. Changing context updates situations and invalidates prior replies/output. Restart clears the session.

experience-chat.js reuses the actual Agent launch/reveal/desk motion. experience.js reuses the actual Deck/Workbench/bookmark pull, liquid controls, concept handoff and completion reveal. Page changes use finite opacity transitions, preserving engine geometry. Cancel/rapid navigation/reset/hidden/destroy settle old work; old-policy callbacks cannot clear a newer response. Copy/download export the prepared local questions and exact source text. No files are uploaded or analysed; no service/auth/storage was added.

All brand entries now use plain Policy Lens text, including the earlier reference journey and forced-colour fallback. Illustrated policy papers and the bookmark pull are retained; they are distinct from the rejected logo.

## Acceptance

- Syntax/build pass. The data/chat suite passes 23 checks; the connected-flow suite passes 16 against source and the actual built artifact. Existing component suite remains 17/17, with its built-page regression passing.
- Independent data/chat review found two P2s (topic matching and stale callback reset); root fixed both and reproduced their corrections. Independent journey review found no P1/P2 and passed seven extra interruption/download-lifecycle cases.
- Six-entry resource audit passes: assets embedded, default alias exact, local sibling routes valid, one h1 per mode, no rendered rejected brand badge.
- Actual 1100px reading, 390px policies/chat, 320px context and 728px result/component previews show no horizontal overflow. Quotes, priority and selected counts match the chosen policy. Temporary inspection clocks/preferences are not in production artifacts.

New files: experience.html/css/js, experience-data.js, experience-chat.js. Existing shared motion engines are reused; the guide's component demos remain independently usable. Default delivery is dist/index.html; component delivery is dist/showcase.html.
