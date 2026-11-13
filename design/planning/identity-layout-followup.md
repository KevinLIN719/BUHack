# Identity, colour and responsive-entry follow-up · 2026-11-13

The user asked to replace the PL mark, choose a non-orange insurance-appropriate theme and use normal webpage dimensions. The current final guide already had the folded-policy/lens SVG, deep teal #1F5E60 and responsive layout. A fresh read-only review found remaining legacy-entry ambiguity and fallback styling; M0 fixed those concrete residuals.

## Changes

- Kept the final guide’s paper/lens mark and deep-teal brand. This colour choice is a design judgement: a quiet, steady ink beside the warm paper and marker colours.
- Replaced the old source prototype’s hidden pl. text substitute with the actual policy-mark.svg image, preserving its accessible home button and event handling. Notebook CSS suppresses the decorative fallback when the actual image is present.
- Removed the old orange primary/ring/foreground fallback from styles.css. Primary/ring now use the same teal and foreground uses the shared ink. Orange remains available only as one of the requested reference marker colours.
- The build now writes dist/index.html as an exact copy of dist/showcase.html, so a normal static host opens the final component guide. The old journey is preserved separately as dist/journey-reference.html; its source index.html remains a reference. The development server root already uses showcase.html.
- The actual final layout remains fluid with a1120px reading measure, narrow-screen breakpoints and natural vertical scroll. No fixed image aspect ratio, whole-page scale or screenshot-sized page was added. Conversation embeds are constrained by the chat column and do not define the actual browser viewport.

## Validation

- npm run check/build pass.
- /tmp/policy-lens-delivery-audit.mjs passes all five delivery entries: CSS/JS/assets embedded, correct authored modules and English; default index equals final guide byte-for-byte; no old orange fallback; actual image replaces PL. This audit supersedes the old four-name packaging map after the default-index change.
- The established final built-artifact controller check passes without errors.
- A focused check boots actual dist/journey-reference.html: exactly one real brand image, accessible Policy Lens home name, no PL text; clicking the image still returns from Documents to Home. No captured runtime errors.
- Real html_preview of the built default homepage at1440/768/390/320px: page widths exactly match the viewport1424/752/374/304px; content measures1120/712/342/272px; body transform none and aspect-ratio auto. Full page heights vary7864/8745/11773/12701px with wrapping, confirming natural webpage flow. All show the actual mark, theme#1F5E60 and Frontend UI guide title, with no console errors.
- The16px difference between requested preview width and measured inner viewport comes from the tool’s outer gutter. The1000px iframe height used for inspection is preview-only; delivered HTML has no such wrapper.

No business flow was expanded and no provider/settings were changed. The single final guide is available under either dist/showcase.html or the default dist/index.html alias.
