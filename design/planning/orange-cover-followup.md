# Original orange cover, separate concept study

The latest user correction restores the first orange-version layout/effect on the opening page, moves the concept animation to its own place, and keeps everything else unchanged. This supersedes using the concept-to-home sequence as the default opening cover.

The original composition was recovered from app.js masthead/landing and the poster rules in styles.css: three small header columns, an oversized diagonal policy sheet above two very large lines of type. The original orange is #f24e2a. The old temporary home snapshot already mixed later teal overrides into that version, so it was not rolled back wholesale.

showcase.html now opens with an isolated `.oc-cover`, the original POLICY LENS / MADE CLEAR. wording, the existing folded-policy/lens mark rendered in orange, and a cover-specific copy of the policy artwork. New `.oc-*` rules in showcase.css scope the orange to the cover. The page keeps normal responsive width and natural vertical scroll. The intentional overlap is clipped by the poster, without creating document overflow. The paper has a finite entry and a reduced-motion alternative.

The existing complete `[data-hero]` animation, usage notes, controls and sources now sit inside `#concept`. Cover and notebook navigation link to that independent study. Its offscreen concept pauses, so it cannot take over the opening page. Its existing title/paper transition, slow names, marker colours and replay/skip remain intact. The cover supplies the page's single h1; the demo name is h2.

Scope was checked against a pre-edit SHA-256 snapshot: all seventeen protected engines/styles/assets are unchanged, as is every byte of HTML from Controls to the end. Only showcase.html/css and the new assets/policy-sheet-cover.svg affect production rendering. The main policy-sheet.svg is unchanged, preserving the other demos.

Validation: npm check/build; whole-page 17/17; final built-page controller check; five-entry offline audit all pass. Actual 1100/390/320px previews show the poster layout and no horizontal overflow, one h1, orange cover and teal notebook. At 320px the real IntersectionObserver reports the concept outside the viewport and paused. Default dist/index.html remains identical to dist/showcase.html.
