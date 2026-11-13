/* Policy Lens selection motion.
 * A single indicator glides between the active choice of a group and glides
 * back when the choice is reversed. It only reads the real state attributes
 * (aria-pressed / aria-checked / aria-current), so page logic is unchanged. */
(function (global) {
  'use strict';
  if (global.PolicyToggleMotion) return;
  const doc = global.document;
  const groups = [
    { selector: '.ex-choices, .sc-choices', item: 'button,[role="radio"]', kind: 'pill',
      active: node => node.getAttribute('aria-pressed') === 'true' || node.getAttribute('aria-checked') === 'true' },
    { selector: '.ex-step-track', item: '.ex-step', kind: 'line',
      active: node => { const value = node.getAttribute('aria-current'); return value !== null && value !== 'false'; } }
  ];
  const reduce = global.matchMedia?.('(prefers-reduced-motion: reduce)');
  const mounted = new Map();

  function mount(group, config) {
    if (mounted.has(group)) return;
    const indicator = doc.createElement('span');
    indicator.className = 'tg-indicator';
    indicator.dataset.kind = config.kind;
    indicator.dataset.liquidIgnore = '';
    indicator.setAttribute('aria-hidden', 'true');
    group.classList.add('tg-group');
    group.dataset.tgKind = config.kind;
    group.prepend(indicator);
    let placed = false, frame = 0, last = '';
    function place() {
      frame = 0;
      if (!group.isConnected) { unmount(group); return; }
      const items = Array.from(group.children).filter(node => node !== indicator && node.matches(config.item));
      const active = items.find(config.active);
      if (!active || !group.getClientRects().length || !active.getClientRects().length) {
        indicator.style.opacity = '0'; placed = false; last = ''; return;
      }
      const box = group.getBoundingClientRect(), rect = active.getBoundingClientRect();
      const x = rect.left - box.left, y = rect.top - box.top;
      const key = [x, y, rect.width, rect.height].map(Math.round).join();
      if (key === last) return;
      last = key;
      // First placement, a group becoming visible, or reduced motion: no glide.
      const jump = !placed || reduce?.matches;
      if (jump) indicator.style.transition = 'none';
      indicator.style.width = rect.width + 'px';
      indicator.style.height = rect.height + 'px';
      indicator.style.transform = `translate3d(${x}px,${y}px,0)`;
      indicator.style.opacity = '1';
      if (jump) { indicator.getBoundingClientRect(); indicator.style.removeProperty('transition'); }
      placed = true;
    }
    const queue = () => { if (!frame) frame = global.requestAnimationFrame(place); };
    const observer = new global.MutationObserver(queue);
    observer.observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-checked', 'aria-current', 'hidden', 'disabled'] });
    const resize = global.ResizeObserver ? new global.ResizeObserver(queue) : null;
    resize?.observe(group);
    mounted.set(group, { queue, destroy() { observer.disconnect(); resize?.disconnect(); if (frame) global.cancelAnimationFrame(frame); indicator.remove(); group.classList.remove('tg-group'); } });
    queue();
  }
  function unmount(group) { mounted.get(group)?.destroy(); mounted.delete(group); }
  function scan(root = doc) {
    groups.forEach(config => root.querySelectorAll(config.selector).forEach(group => mount(group, config)));
  }
  function refresh() { mounted.forEach(entry => entry.queue()); }

  function start() {
    scan();
    // Groups inside panels that are rendered or revealed later.
    let pending = false;
    new global.MutationObserver(() => {
      if (pending) return; pending = true;
      global.requestAnimationFrame(() => { pending = false; scan(); refresh(); });
    }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    doc.fonts?.ready.then(refresh);
    global.addEventListener('resize', refresh);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  global.PolicyToggleMotion = Object.freeze({ scan, refresh });
})(window);
