# M1 · Visual system and marker language

Implementation and module review completed: 2026-11-13. Ownership is restricted to `ui-theme.css`, `ui-notebook.css`, `ui-markers.css`, `assets/policy-mark.svg`, `assets/policy-sheet.svg`, and this report. The module provides styles and two SVG assets; it adds no runtime engine, network calls, dependencies, or entry-point edits. The frozen MASTER_PLAN and module contracts govern this work. One native implementation Agent completed the files before a fresh-context, read-only review Agent was started; both inherited the current model/settings and were prohibited from spawning further agents. The coordinator performed the browser checks below. M1 is ready for integration; final assembled-page acceptance belongs to M0.

## Design decisions

Deep teal `#1F5E60` is brand/navigation ink. Notebook paper is `#FBFCF8`, body ink is `#253B3D`, and rules are `#DCE4DD`. Ordinary information has a single reading direction, fine rules, and open margins. The `.coverage-grid` legacy name remains compatible while its presentation becomes a single ruled list; `.dropzone` uses horizontal boundaries; `.completion-preview-stage` loses its enclosing card. The Agent desk/background and workspace shadow are lighter. The paper policy border and the real conversation composer keep functional boundaries. This module does not alter controller geometry, transform ownership, or reveal/drag animations.

The folded-sheet symbol includes a lens and a small marker stroke. `policy-mark.svg` supplies title/description for standalone use. In linked brand markup, preserve readable brand text or use an explicit accessible name. The existing `.wordmark` button retains its `aria-label="Policy Lens home"`, original text and click target; CSS suppresses the old glyph visually and draws a decorative SVG via `::before` above the shared liquid skin. The paper SVG uses deep teal instead of orange, including its own description.

Brand ink, marker priorities, and the transient completion/dispersion palette have separate purposes. `--completion-*` remains with the existing effect. Orange remains one of the 20 reference marker colors; it is not primary brand color. No missing PixelToggle/CardSwap engine is claimed to run, and this module does not implement either engine.

## Exported tokens and hooks

- Core contract: `--primary`, `--primary-foreground`, `--background`, `--foreground`, `--ink`, `--muted`, `--secondary`, `--border`, `--ring`, `--font-sans`, `--font-mono`, `--radius`.
- Preserved existing aliases: `--muted-foreground`, `--card`, `--warning`, `--warning-surface`; `--ink` follows `--foreground`. Warning uses the sampled Amber pair.
- Control surfaces: `--control-face`, `--control-hover`, `--control-pressed`, `--control-line`, `--control-shadow`, `--control-hover-shadow`, `--control-pressed-shadow`. M2 owns button shape, text/focus placement, and motion.
- Paper helpers: `--paper`, `--paper-raised`, `--paper-grid`, `--notebook-rule`, `--notebook-gutter`, `--notebook-measure`; `.pl-grid-paper` draws a quiet 24px grid; `.pl-ruled-list` styles direct children as ruled rows. Put the grid behind a bounded reading area rather than every section.
- All 20 pairs: `--marker-N-ink` and `--marker-N-surface`, N=1…20. `.pl-marker[data-marker="N"]` selects a reference color without assigning priority. Optional `.pl-marker-palette` / `.pl-marker-swatch[data-marker="N"]` present a 4-column desktop / 2-column narrow-screen reference list.
- Semantic aliases: `--marker-cherry-*`, `--marker-amber-*`, `--marker-teal-*`, `--marker-violet-*`, and `--priority-1..4-ink/surface`. `.pl-marker[data-priority="1..4"]` highlights source wording; `.pl-priority[data-priority="1..4"]` presents an explicit numeral/label. Multi-line marks clone the background per line.

```html
<span class="pl-priority" data-priority="1"><b>1</b><span>Check first</span></span>
<p>Check the <mark class="pl-marker" data-priority="1">exclusion that applies to this activity</mark>.</p>
<ul class="pl-marker-palette" aria-label="Twenty reference marker colors">
  <li class="pl-marker-swatch" data-marker="1"><span>Purple</span><small>01 · Reference color</small></li>
  <!-- Repeat 02…20 with the exact names/order from the table below. -->
</ul>
```

Every priority needs a real visible numeral and an explanatory label in the DOM; CSS does not generate or duplicate the label. Show the four-level legend beside the source/detail examples. Priority describes review order only:

| Level | Pair | Suggested visible label | Meaning |
| --- | --- | --- | --- |
| 1 | Cherry / reference 03 | 1 · Check first | Start with the wording that could most affect the purchase decision. |
| 2 | Amber / reference 07 | 2 · Confirm key terms | Ask about a significant term or condition. |
| 3 | Teal / reference 12 | 3 · Review context | Compare relevant supporting context. |
| 4 | Violet / reference 19 | 4 · Keep in mind | Retain a supporting note for later reading. |

Teal is never a claim approval, confirmation of coverage, or a replacement for an insurer decision. The same finding priority must appear in the list, quotation, and detail view. These labels are presentation guidance, not an instruction to rewrite M3 fixture data.

## Actual reference sampling

Source: `/Users/fanxinyun2/.t3/userdata/attachments/30783f0a-b0a9-4483-8d10-97579a9efe98-256b46f9-21b5-4009-82a2-7e0ffe1228a3.png` (1092 × 886). The actual image was opened and visually inspected. It contains two columns of ten named colors. Numbering reads down the left column and then down the right column, retaining all 20 names. The attached raster has scaled/antialiased text; these are measured display approximations rather than claimed original design-source values.

Sampling uses RGB image pixels. Each inset rectangle excludes the rounded corner/white surrounding canvas. Surface = most frequent RGB in that rectangle. Ink = channel-wise median of the darkest 20% of eligible pixels with relative luminance below 0.45, recovering the interior letter color while excluding most antialiased fringes. No contrast darkening or fabricated palette was applied afterward. Rectangles below use `(left, top, right, bottom)` with right/bottom exclusive. WCAG relative luminance ratio is calculated for the exported opaque pair. All 20 pairs exceed 4.5:1; range 4.77–6.24:1. Bold weight is an additional visual cue, not a substitute for contrast.

| N | Name | Ink | Surface | Ratio | Sample rectangle |
| --- | --- | --- | --- | --- | --- |
| 01 | Purple | `#6C499A` | `#F3EBFD` | 5.92:1 | `(85, 31, 228, 85)` |
| 02 | Pink | `#863C74` | `#FBE7F9` | 6.15:1 | `(85, 115, 185, 169)` |
| 03 | Cherry | `#903959` | `#FBE8ED` | 6.13:1 | `(85, 199, 233, 253)` |
| 04 | Red | `#913A38` | `#FBE9E5` | 6.24:1 | `(85, 283, 175, 337)` |
| 05 | Vermilion | `#913E21` | `#FBEAE4` | 6.17:1 | `(85, 367, 289, 421)` |
| 06 | Orange | `#8D4A1D` | `#FBEBDE` | 5.76:1 | `(85, 451, 244, 505)` |
| 07 | Amber | `#81571E` | `#FCECD3` | 5.45:1 | `(85, 535, 236, 589)` |
| 08 | Yellow | `#706520` | `#F8F1CB` | 5.16:1 | `(85, 619, 224, 673)` |
| 09 | Lime | `#516D20` | `#E7F8D5` | 5.28:1 | `(85, 703, 197, 757)` |
| 10 | Shamrock | `#347332` | `#DEF9DD` | 5.13:1 | `(85, 787, 300, 841)` |
| 11 | Green | `#35784C` | `#D8FCE4` | 4.81:1 | `(763, 31, 899, 85)` |
| 12 | Teal | `#347665` | `#D2FBF1` | 4.79:1 | `(763, 115, 860, 169)` |
| 13 | Mint | `#347763` | `#D1FCF0` | 4.77:1 | `(763, 199, 866, 253)` |
| 14 | Turquoise | `#31717B` | `#D1FBFE` | 5.01:1 | `(763, 283, 973, 337)` |
| 15 | Sky | `#317086` | `#D6F7FE` | 4.90:1 | `(763, 367, 848, 421)` |
| 16 | Blue | `#2B61A8` | `#DDF4FE` | 5.46:1 | `(763, 451, 865, 505)` |
| 17 | Indigo | `#2B5DA7` | `#E4F2FE` | 5.71:1 | `(763, 535, 902, 589)` |
| 18 | Sapphire | `#4059A8` | `#E6F1FD` | 5.72:1 | `(763, 619, 958, 673)` |
| 19 | Violet | `#5753A9` | `#EDEEFE` | 5.68:1 | `(763, 703, 891, 757)` |
| 20 | Grape | `#5E51A8` | `#EEEEFE` | 5.69:1 | `(763, 787, 899, 841)` |

Reference names belong in the full color gallery, with each deep text color shown on its corresponding pale surface. Do not show only a dot or convert the reference into one yellow marker. The default sans stack stays consistent with the app; the source supplies no font file, so no exact typeface identification is claimed.

## Actual implementation verification

- `python3 /tmp/policy-lens-m1/sample-palette.py`: sampled all 20 pairs from the supplied image; output `/tmp/policy-lens-m1/palette-samples.json`.
- `node /tmp/policy-lens-m1/verify.mjs`: three new stylesheets parse (7/27/37 top-level rules), no CSS parse errors; required legacy/control aliases present; all 20 pairs contrast ≥4.5:1; semantic priority aliases match references 03/07/12/19; legacy list/card/wordmark declarations take effect; brand accessible name preserved; both SVGs parse as XML and contain the teal brand color with no orange description/color. Brand-to-paper contrast 7.21:1, body-to-paper 11.50:1, muted-to-paper 5.07:1. Output `/tmp/policy-lens-m1/verification.json`.
- `node /tmp/policy-lens-m1/regression.mjs`: **39/39** existing original-flow checks pass with these stylesheets injected. This covers sample/local document separation, source/detail matching, keyboard tabs, focus return, checklist edits/exports and no unhandled errors. The regression is derived from the existing established test, not a new production dependency.
- The coordinator independently reran the CSS/token/SVG checks and the **39/39** original-flow checks after implementation handoff.
- **Direct browser style verification:** `html_preview` rendered the M1 component sample at 320/390/728px; the original Home at 320/390/1100px; Documents at 320/390px; and Overview at 320/390/1100px. All 11 cases reported `documentElement.scrollWidth === clientWidth`, the expected `--primary: #1F5E60`, and no console errors. The coverage list computed to `display: block`; the dropzone computed to top border `1px`, right border `0px`. Screenshot inspection confirmed readable wrapped markers, fine rules, a quiet grid, the replacement brand symbol and teal policy sheet. These checks inject M1 styles into the original DOM or a component specimen; they do not accept the final showcase.
- **Current M2 compatibility smoke checks:** Home and Overview at 320px and the actual conversation at 320/390px were rendered with the current `liquid-controls.css/js` after M1. All four had no page horizontal overflow or console errors. The decorative skin coexists with the logo, and the real conversation composer retains a visible input boundary. These are static rendered states, not a retest of M2 motion/keyboard/lifecycle ownership.
- The final gallery specimen uses the actual `.pl-marker-swatch[data-marker="N"]` hooks for all 20 colors, plus the four numbered `.pl-priority`/`.pl-marker` examples. It was rechecked at 320/390/728px with no horizontal overflow or console errors, then displayed with `html_render`. The existing Completion preview was also rendered at 320px with current M2: the stage computed to border `0px`, radius `0px`, shadow `none`, transparent background, and no horizontal overflow. Browser metadata/console evidence for these **19** rendered cases is `/tmp/policy-lens-m1/browser-layout-results.json`; the composition scripts and HTML specimens are under `/tmp/policy-lens-m1-*` and are not runtime dependencies.
- **Fresh-context read-only review:** independently reran image sampling, token/contrast/SVG checks and the 39-item regression. Additional `/tmp/policy-lens-m1/read-only-review.mjs` checks compared all 40 sampled color values against the exported tokens, parsed the old CSS + M1 + current M2, checked the single aria-hidden skin and preserved 44px brand target, list/completion overrides, and desk/composer boundaries. Its isolated border assertion substitutes the already-verified border token because jsdom does not resolve `var()` in border shorthand; actual border appearance was checked in the browser separately. No M1 blocking issue was found. The reviewer did not edit production files or this report.
- Responsive CSS uses intrinsic columns, wrapping, and breakpoint overrides at 760/600/400/360px. **jsdom does not establish pixel layout or no-overflow acceptance.** No server was started, no dependency was installed, and no entry/controller/shared plan file was changed by M1.

## M4 / M0 integration and remaining checks

1. Load existing base/component CSS first, then `ui-theme.css`, `ui-notebook.css`, `ui-markers.css`, then M2 `liquid-controls.css`. Preserve M3 scoped styles. This module deliberately does not edit any entry.
2. In the new brand link use `<img src="assets/policy-mark.svg" alt="" width="32" height="36">` alongside visible `Policy Lens` text. If the symbol is the only content, supply an accessible link/button name. The old prototype receives the CSS `.wordmark` replacement after loading the module stylesheets.
3. Add the four labeled priority examples and all 20 named swatches, then apply `data-priority` to the matching quotation/detail findings from M3. Asset/palette support alone is not the final visible gallery.
4. Use `.pl-grid-paper` on a restrained notebook region and `.pl-ruled-list` for ordinary explanatory rows. Keep actual policy sheets as paper objects and the chat input as an input boundary. This CSS does not alter `app.js` or extract an application engine.
5. Include both SVG assets and CSS `url("assets/policy-mark.svg")` (including its forced-color mask use) in standalone build inlining. M0 must repeat 320/390px and short-height checks on the final assembled M2/M3/M4 page and standalone output. Forced-colors rules keep numbered labels visible and remove grid decoration; actual system forced-colors appearance remains unverified.
6. Cross-module alt inconsistency was reported explicitly: the original `app.js` home image alt referenced orange. M0 has now corrected it to a color-independent “Policy Lens wordmark”; M1 did not edit that file. M4 should update entry theme-color metadata to the chosen paper/brand color as appropriate. No entry, app, shared task board or total plan was edited by M1.

An early review snapshot of M3 had `.pw-excerpt .pl-marker { color: var(--ink) }`, which would override the sampled deep marker ink. The latest `policy-deck.css` now declares the corresponding `--priority-N-ink/surface` for each of the four levels; the reviewer re-read it and closed that observation. M1 made no cross-module fix. Keep these paired variables together when editing detail excerpts.

No open M1 blocker remains. Final full-page acceptance belongs to M0 after integration: final showcase/standalone resources, short screens, real dynamic/keyboard flows, reduced-motion behavior across modules, and system forced-colors appearance are outside the direct M1 style checks above. Raster sampling is a measured approximation of the supplied image; no exact source typeface or unavailable original engine is claimed.
