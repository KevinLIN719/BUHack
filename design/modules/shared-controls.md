# M2 — Flat shared controls

All actions use a flat 6px corner surface with a single left-to-right colour fill. Primary actions use solid orange; secondary actions use orange text and a pale hover fill; choices add a fine border and retain the fill when selected. The white cover CTA uses the same motion against the orange poster. Shadows, bevels, gradients, squash/stretch, rebound and moving choice indicators have been removed.

`liquid-controls.css` owns the surface and its 240ms `scaleX` fill transition. `liquid-controls.js` mirrors native application state and manages pointer/keyboard pressed feedback. Labels, focus rings and hit areas stay still. `toggle-motion.js` keeps the old `scan()`/`refresh()` entry points and delegates to the shared controls; it creates no extra geometry or animation loop.

## Public API

```js
const controls = window.PolicyButtonMotion.mount(document, {
  // Optional: supplying selector replaces the default selector.
  pressMs: 180, // Minimum readable pressed feedback for short taps.
});
controls.refresh();
controls.update({ pressMs: 180 });
controls.destroy();
```

The default selector includes native buttons and summaries, button-like anchors, navigation links, page/footer action links, button/tab/radio/checkbox/switch roles and `[data-liquid-control]`. Ordinary source-attribution links and native inputs are not restyled. A selector override can narrow a scoped mount. The legacy `releaseMs` option remains accepted for older callers but no longer controls an animation; fill timing is `--liquid-fill-ms` in CSS.

Automatic document mounting runs once on DOM readiness. Repeated explicit mounts return the same controller. Mounts can target a Document, connected Element or ShadowRoot. Overlapping owners share one skin and one document event service; the latest scoped owner takes precedence for press timing. Invalid selectors are validated before publishing a controller. Destroy disconnects observers/listeners, clears pressed-feedback timers, removes generated skins and restores original module-owned attributes. Mounting again is supported. Shadow roots require their own CSS inclusion and explicit mount.

## Native state and exclusions

- A mounted control has `.liquid-control[data-liquid-mounted]` and exactly one direct `<span class="liquid-skin" aria-hidden="true" data-liquid-skin></span>`. The span's `::before` is the only moving fill.
- `[data-liquid-selected="true|false"]` mirrors native checked state or the application's `aria-pressed`, `aria-selected`, `aria-checked`, `aria-current`, `data-selected`, `data-state` or selection classes. The adapter does not set application selection state.
- `[data-liquid-disabled]` mirrors native disabled/fieldset state and inherited ARIA disabled/inert. Disabled controls have no hover fill. `[data-liquid-pressed]` is transient pointer/keyboard feedback.
- `.solid`, `.primary`, `.agent-send-button` and `[data-liquid-variant="primary"]` select the primary palette. `[data-liquid-variant="surface"]` keeps a flat bordered surface. All variants use the same direction and corner geometry.
- `[data-liquid="off"]` and `[data-liquid-ignore]` exclude an element and its subtree. The draggable policy paper uses this exclusion; its separate action buttons still receive shared controls.
- `[data-liquid-control][data-liquid-choice]` can decorate a compact wrapper around a real native checkbox/radio. No role or tab stop is added to the wrapper; input checked/disabled state is mirrored. Native checkbox marks remain visible.

No event prevents default behaviour, dispatches product actions or captures a pointer. Non-native role controls still require their owner's keyboard behaviour and ARIA-disabled action guard. Native `change` refreshes checkbox/radio state; programmatic `.checked` writes without an event require `refresh()`.

## Integration and performance

Load `liquid-controls.css` last, after component, page and refinement styles. Load `liquid-controls.js` deferred; it needs no dependency or external engine. Both resources are included in all five source entries and the standalone build. The absent PixelToggle engine is not claimed as reused.

Dynamic inserted controls and label replacements are observed, with the existing skin reattached after `textContent`/`replaceChildren`. Selected, disabled, hidden and inert attributes stay synchronized. Inline `style` writes are deliberately not observed: concept, paper and message animation frames must not trigger a document-wide control scan. Availability is checked when a control is used and when active state is synchronized. After a programmatic style-only visibility change, call `refresh()` if immediate pressed-state settlement is required.

CSS uses existing orange/ink/paper tokens with local fallbacks. The fill uses compositor-friendly transform only, with no persistent `will-change`, WAAPI button animation, per-frame layout read or animation loop. Reduced-motion removes transitions. Forced-colors uses ButtonFace/ButtonText, a selected Highlight border, visible focus and GrayText for disabled controls.

## Verification for the current implementation

- `node --check liquid-controls.js` and `node --check toggle-motion.js`: passed.
- Headless Chromium checks on experience, showcase, legacy journey, concept preview and completion preview: mounted buttons have no host/skin shadows; runtime page errors are empty.
- Cover normal/hover states: one left-origin fill, no host/skin transform or secondary `::after` effect.
- Choices: selected state, keyboard focus, disabled appearance and native state updates pass. Dynamic insertion and label replacement each retain exactly one skin.
- Twelve successive inline-style animation frames cause zero document `querySelectorAll` scans.
- Reduced-motion reports `0s` transition; forced-colors hides decorative fill and uses a 2px selected border.
- At 320px, experience context/reading/discussion/checklist and the component showcase each measure a 320px document with no out-of-bounds visible buttons.

These checks cover controls and their integration. Full concept playback and chat-flow acceptance are documented by the respective modules.
