# Highlight follow-up · 2026-11-13

The user reaffirmed that all semantic highlights and hint types use the supplied twenty-colour marker reference; original wording and the final reveal must use matching treatment, with importance running from 1 to 4. This repeats the marker requirement already included in the master plan. M0 applied only the uncovered integration differences after a fresh read-only coverage audit; the four completed module sessions were not restarted.

## Changes

- ui-markers.css explicitly keeps marker/priority text in the shared sans family with 600 weight. policy-deck.css no longer resets priority labels to regular monospace.
- showcase-chat.js uses literal, editorial review points for each of the six fictional source passages. Desktop evidence and short-screen inline evidence call one renderer and preserve source.text exactly. Matching/no-matching hint labels use the sampled Teal/Amber pairs with explicit words; these hint types do not invent insurance urgency or claim approval.
- showcase.js explicitly sorts findings, choices and generated snapshots by priority. Omission preserves actual priority numbers. Final questions include their exact original quote with the same marker colour; workbench labels now use the same Essential / Important / Confirm / Context wording.
- showcase.css lets the generated list grow naturally, so the added original quotes do not hide lower priorities inside a fixed-height inner scroller. The existing completion animation is retained.
- showcase.html explains the final priority ordering and same-colour source quotations. dist outputs rebuilt.

## Actual checks

- npm run check and npm run build pass.
- Existing whole-page acceptance: 17/17, no bugs; final built artifact check and four-entry resource audit pass.
- /tmp/policy-lens-highlight-delta.mjs passes: all six desktop/inline sources retain exact original text with twenty-four priority marks; no-match hint uses Amber; all three policies still sort 1–4 when incoming findings are reversed; generated quotes exactly match findings; deselecting priority 1 leaves visible ranks 02/03/04. No captured runtime errors.
- Browser html_preview at320×500: inline source visible, exact text, four marks, Arial/Helvetica sans with600 weight; document/viewport widths both304px.
- Browser at728px: generated list priorities1/2/3/4, all four original quotes, marker and priority label sans600. Natural list clientHeight/scrollHeight both644px; fourth row lies inside the result. Document/viewport widths both712px, no horizontal overflow or console errors.
- Actual full-page wording section checked at728px with all four large original highlights and labels. Focus/scroll setup exists only in the display wrapper; source product remains normally interactive.

Reference colours remain sampled approximations; no exact original font identification is claimed. No backend, real analysis, dependency or second marker system was added.
