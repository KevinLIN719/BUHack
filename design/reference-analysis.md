# Policy Lens / Editorial reference

## Current visual source

The user's latest `image.png` is the governing reference. The previous video-derived interface has been replaced.

The reference uses a white canvas, a very small three-part masthead, sparse orange-red copy, a large diagonal white physical object, and oversized uppercase typography near the bottom. The object overlaps the typography and extends beyond the right edge of the composition.

## Applied design rules

- White surfaces, orange-red headings and actions, gray fine rules, and restrained dark body text for longer explanations.
- Small functional masthead information rather than a conventional navigation bar.
- Oversized, tightly spaced sans-serif headings with generous empty space.
- A finely ruled, layered ivory policy sheet in perspective. A small folded policy summary replaces the chip motif. No payment-card numbers, metal chip, particle field or neumorphic controls remain.
- Square, flat controls and document-like form rows. No inherited raised or recessed control material from the earlier visual direction.
- English throughout the interface, accessibility labels, fictional policy, source pages, toasts and exports.
- The same type, color, rules and spacing apply to every workflow page, not only the landing poster.

## Page sequence

Home → Documents → Your situation → Overview → Scenarios → Questions.

The sample entry loads the document page first. Users can inspect the sample's name, version and sources before continuing. Real selected files are kept separate, and the prototype explicitly explains that they are only previewed locally.

The overview includes the optional marketing comparison. Every explanation links to its original sample page. Missing marketing has a recovery action. Scenarios remain hypotheses; an absent provision is labelled “Not found”, never automatically treated as an exclusion.

Users select scenario questions, edit and reorder them, then copy or download a list with the original wording references. They may record replies and mark them reviewed themselves. Completion describes a list ready to share or questions reviewed by the user, never an insurance recommendation or coverage confirmation.

## Runtime and assets

`assets/policy-sheet.svg` is an original code-native vector product visual, with live vector typography and fine paper-edge geometry. The build embeds it in the standalone HTML. No generated image service, external font, runtime API or hosted backend is required.

Page changes preserve state within the current session. Browser history follows the page sequence. Keyboard focus is maintained on primary controls; source dialogs trap focus and return it when closed. Edited questions retain an explicit reference-recheck note.
