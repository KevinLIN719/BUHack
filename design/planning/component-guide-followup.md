# Component-guide scope confirmation · 2026-11-13

The user explicitly reaffirmed the final deliverable: one separate English frontend UI explanation/showcase page, containing independently demonstrable components, what each effect looks like, when/where it belongs and how to add it. The teammate owns backend data/services. This scope was already in MASTER_PLAN; M0 clarified the visible guide identity and filled the missing in-page integration instructions.

## Changes

- showcase.html now identifies itself as Frontend UI guide in its title, metadata, edition and introduction. The concept hero remains a component demo. Its primary link explores components rather than implying a complete policy journey.
- Component navigation links directly to Concept, Controls, Highlights, Grid notes, Policy papers, Chat and Reveal. The old journey stays in the repository as a reference but is no longer promoted by a footer link in the final guide.
- Seven collapsible Frontend usage panels provide purpose, file/load requirements, real DOM prerequisites, short API/markup examples, lifecycle notes and Team data boundaries.
- Concept and chat correctly require their complete existing host markup; policy workbench can mount into a connected empty div. Marker and grid primitives are CSS-only. Completion plays already-prepared content. No nonexistent replyProvider/onReply API is documented.
- The handoff section identifies policy records, reply retrieval and notes/output persistence as teammate-supplied data boundaries.
- showcase.css keeps the instructions as quiet ruled text and code, with wrapping on mobile. README describes the final guide.
- All existing runtime/controllers and demos remain unchanged; no extra business route or backend was built.

## Actual validation

- A fresh read-only agent checked all seven snippets against the actual APIs and required DOM/data/CSS.
- npm run build and the four-entry offline resource audit pass.
- The built page boots without runtime errors. Its seven panels appear exactly once, each includes Files / Team data and an escaped code sample. Opening them produces one shared summary skin each. All in-page links resolve; existing workbench and four real checklist choices remain present.
- Actual html_preview:728px grid note with its usage panel open has viewport/page widths712px and code client/scroll widths672px. At320px the full completion usage panel has viewport/page widths304px and code widths272px. No horizontal overflow or console errors.
- The final instruction-only refinement adds paragraph spacing and comments optional replay/skip calls rather than immediately executing them. Final offline outputs rebuilt and audited.
- Page-focus/open-details setup is only in display wrappers. The delivered page keeps its ordinary concept/demo controls and closed-by-default usage panels.

No full behavioral suite was rerun for static copy/HTML/CSS additions. The targeted built-page checks cover new markup, summary integration and links; previous controller acceptance remains applicable.
