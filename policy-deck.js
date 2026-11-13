/* Native pointer/keyboard paper deck. CardSwapEngine was not supplied. */
(function (global) {
  'use strict';
  const mounts = new WeakMap();
  const timings = Object.freeze({ settle: 380, easing: 'cubic-bezier(.2,.85,.2,1)' });
  function mount(host, options = {}) {
    if (!host || !host.ownerDocument) throw new TypeError('PolicyDeck.mount needs a DOM host.');
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument, win = doc.defaultView;
    const items = Array.from(options.items || []), byId = new Map();
    items.forEach(item => { if (!item || !item.id || byId.has(item.id)) throw new TypeError('Policy ids must be unique and nonempty.'); byId.set(item.id, item); });
    let order = items.map(item => item.id), selected = byId.has(options.selectedId) ? options.selectedId : order[0] || null;
    let dead = false, gesture = null, suppress = null, suppressTimer = 0;
    const disposers = [], cards = new Map(), motions = new Map(), held = new Map();
    const media = [win.matchMedia?.('(prefers-reduced-motion: reduce)'), win.matchMedia?.('(forced-colors: active)')].filter(Boolean);
    const quiet = () => media.some(query => query.matches);
    let motionBounds = null;
    const root = doc.createElement('div'); root.className = 'pd-root'; root.dataset.policyDeck = '';
    root.style.setProperty('--pd-settle-duration', timings.settle + 'ms'); root.style.setProperty('--pd-settle-ease', timings.easing);
    const hint = doc.createElement('p'); hint.className = 'pd-hint'; hint.textContent = '將保單拖到另一張上即可交換位置。打開保單可閱讀條款；方向鍵可選擇，Shift＋方向鍵可移動。';
    const list = doc.createElement('div'); list.className = 'pd-list'; list.setAttribute('role', 'list'); list.setAttribute('aria-label', '虛構保單紙張');
    const status = doc.createElement('p'); status.className = 'pd-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    root.append(hint, list, status); host.append(root);
    const on = (node, name, fn, settings) => { node.addEventListener(name, fn, settings); disposers.push(() => node.removeEventListener(name, fn, settings)); };
    const make = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    function button(text, action, id) { const n = make('button', 'pd-control', text); n.type = 'button'; n.dataset.pdAction = action; n.dataset.policyId = id; return n; }
    items.forEach((item, index) => {
      const card = make('div', 'pd-card'); card.dataset.policyId = item.id; card.setAttribute('role', 'listitem');
      const shell = make('div', 'pd-drag-shell'); shell.dataset.dragShell = '';
      const paper = make('div', 'pd-paper'); paper.tabIndex = 0; paper.setAttribute('role', 'button'); paper.dataset.pdPaper = item.id; paper.dataset.liquidIgnore = '';
      paper.setAttribute('aria-label', '打開「' + item.title + '」，虛構' + item.kind);
      paper.append(make('span', 'pd-paper-kicker', '虛構示例／' + String(index + 1).padStart(2, '0')), make('span', 'pd-paper-kind', item.kind), make('strong', 'pd-paper-title', item.title), make('span', 'pd-paper-summary', item.summary));
      const lines = make('span', 'pd-paper-lines'); lines.setAttribute('aria-hidden', 'true'); lines.append(make('i', ''), make('i', ''), make('i', '')); paper.append(lines, make('span', 'pd-paper-footer', '示例條款 · 打開 →'));
      shell.append(paper);
      const actions = make('div', 'pd-actions'); const read = button('閱讀條款', 'inspect', item.id), earlier = button('←', 'earlier', item.id), later = button('→', 'later', item.id);
      earlier.setAttribute('aria-label', '將「' + item.title + '」向前移動'); later.setAttribute('aria-label', '將「' + item.title + '」向後移動');
      actions.append(read, earlier, later); card.append(shell, actions); list.append(card); cards.set(item.id, { card, shell, paper, earlier, later });
    });
    function paint() {
      order.forEach((id, i) => {
        const c = cards.get(id); c.card.style.setProperty('--pd-order', i); c.card.dataset.selected = String(id === selected); c.paper.setAttribute('aria-pressed', String(id === selected));
        c.earlier.disabled = i === 0; c.later.disabled = i === order.length - 1; c.card.setAttribute('aria-posinset', i + 1); c.card.setAttribute('aria-setsize', order.length);
      });
      root.dataset.selectedId = selected || '';
    }
    const transformOf = node => { try { return win.getComputedStyle(node).transform || 'none'; } catch (_) { return 'none'; } };
    function rotationOf(node) {
      const value = transformOf(node), matrix = value.match(/^matrix(?:3d)?\(([^)]+)\)$/);
      if (matrix) { const n = matrix[1].split(',').map(Number); return Math.atan2(n[1], n[0]) * 180 / Math.PI || 0; }
      const rotate = value.match(/rotate\(([-\d.]+)deg\)/); return rotate ? Number(rotate[1]) : 0;
    }
    function motionState() {
      cards.forEach(c => {
        const moving = motions.has(c.card) || motions.has(c.shell) || held.has(c.card) || held.has(c.shell);
        if (moving) c.card.dataset.pdMotion = selected === c.paper.dataset.pdPaper ? 'landing' : 'settling';
        else c.card.removeAttribute('data-pd-motion');
      });
    }
    function stopMotion() {
      const running = [...motions.values()]; motions.clear();
      running.forEach(animation => { animation.onfinish = null; animation.oncancel = null; try { animation.cancel(); } catch (_) {} });
      held.forEach((record, node) => {
        if (node.style.getPropertyValue('transform') !== record.value) return;
        if (record.original) node.style.setProperty('transform', record.original, record.priority); else node.style.removeProperty('transform');
      });
      held.clear(); motionBounds = null; motionState();
    }
    function freezeMotion() {
      // Keep the rendered pose under the pointer; cancelling fill before this
      // measurement would make a moving paper jump to its logical grid slot.
      const nodes = new Set([...motions.keys(), ...held.keys()]), poses = [];
      nodes.forEach(node => poses.push({ node, transform: transformOf(node), original: held.get(node)?.original ?? node.style.getPropertyValue('transform'), priority: held.get(node)?.priority ?? node.style.getPropertyPriority('transform') }));
      stopMotion();
      poses.forEach(({ node, transform, original, priority }) => {
        if (transform === 'none') return;
        node.style.setProperty('transform', transform); held.set(node, { original, priority, value: node.style.getPropertyValue('transform') });
      });
      motionState();
    }
    function positions() {
      const result = new Map();
      cards.forEach((c, id) => {
        const box = c.card.getBoundingClientRect(), moving = gesture?.active && gesture.id === id;
        result.set(id, { left: box.left + (moving ? gesture.dx : 0), top: box.top + (moving ? gesture.dy : 0), rotation: rotationOf(c.shell) });
      });
      return result;
    }
    function animate(node, frames) {
      let animation;
      try { animation = node.animate(frames, { duration: timings.settle, easing: timings.easing, fill: 'both' }); } catch (_) { return; }
      if (!animation) return;
      motions.set(node, animation);
      const finish = () => {
        if (motions.get(node) !== animation) return;
        motions.delete(node); animation.onfinish = null; animation.oncancel = null; try { animation.cancel(); } catch (_) {}
        if (!motions.size && !held.size) motionBounds = null;
        motionState();
      };
      animation.onfinish = finish; animation.oncancel = finish; animation.finished?.catch(() => {});
    }
    function land(before) {
      stopMotion();
      if (dead || !root.isConnected || doc.hidden || root.closest('[hidden],[inert]') || quiet()) return;
      motionBounds = list.getBoundingClientRect();
      cards.forEach((c, id) => {
        if (typeof c.card.animate !== 'function') return;
        const was = before.get(id), now = c.card.getBoundingClientRect(); if (!was) return;
        const dx = was.left - now.left, dy = was.top - now.top, base = transformOf(c.card);
        if (Math.abs(dx) + Math.abs(dy) > .5) animate(c.card, [{ transform: `translate3d(${dx}px,${dy}px,0)${base === 'none' ? '' : ' ' + base}` }, { transform: base }]);
        if (Math.abs(was.rotation) > .05 && typeof c.shell.animate === 'function') animate(c.shell, [{ transform: `rotate(${was.rotation}deg)` }, { transform: 'none' }]);
      });
      if (!motions.size) motionBounds = null;
      motionState();
    }
    function select(id, reason = 'api') {
      if (dead || !byId.has(id)) return false;
      // Selection is also the Workbench's synchronous inspection handoff.
      // Commit an interrupted landing before another controller measures its
      // source; rapid reorder and pointer interruptions have their own path.
      cancel();
      cards.forEach(c => { for (const animation of c.paper.getAnimations?.() || []) {
        if (animation.transitionProperty === 'transform') { try { animation.finish(); } catch (_) {} }
      } });
      const changed = selected !== id; selected = id; paint(); motionState();
      if (changed) { status.textContent = byId.get(id).title + ' 已選擇。'; options.onSelect?.(id, byId.get(id), { reason, order: [...order] }); }
      return true;
    }
    function inspect(id, reason) {
      if (!select(id, reason)) return;
      options.onInspect?.(id, byId.get(id), { reason });
    }
    function swap(a, b, reason = 'move', before = positions()) {
      if (a === b || !byId.has(a) || !byId.has(b)) return;
      endGesture(); stopMotion();
      const x = order.indexOf(a), y = order.indexOf(b); [order[x], order[y]] = [order[y], order[x]];
      order.forEach(id => list.append(cards.get(id).card)); paint(); status.textContent = byId.get(a).title + ' 已移至第 ' + (y + 1) + ' 個位置，共 ' + order.length + ' 份保單。';
      root.dispatchEvent(new win.CustomEvent('policydeck:reorder', { bubbles: true, detail: { order: [...order], id: a, reason } }));
      land(before);
    }
    function clearSuppression() { suppress = null; win.clearTimeout(suppressTimer); suppressTimer = 0; }
    function endGesture() {
      if (!gesture) return null;
      const old = gesture; gesture = null;
      if (old.active) { clearSuppression(); suppress = old.id; suppressTimer = win.setTimeout(clearSuppression, 500); }
      old.c.shell.style.removeProperty('transform'); old.c.card.classList.remove('pd-dragging');
      cards.forEach(c => c.card.classList.remove('pd-drop-target'));
      root.dataset.dragging = 'false';
      try { if (old.c.paper.hasPointerCapture?.(old.pointerId)) old.c.paper.releasePointerCapture(old.pointerId); } catch (_) { /* Detached/cancelled pointers already release capture. */ }
      return old;
    }
    function cancel(soft = false) {
      const before = soft && gesture ? positions() : null;
      endGesture(); stopMotion();
      if (before) land(before);
    }
    function targetAt(x, y, movingId) {
      let found = null, distance = Infinity;
      cards.forEach((c, id) => {
        if (id === movingId) return;
        const r = c.card.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)); if (d < distance) { found = id; distance = d; }
        }
      });
      return found;
    }
    on(list, 'pointerdown', event => {
      const paper = event.target.closest?.('[data-pd-paper]');
      if (dead || !paper || !list.contains(paper) || event.button !== 0 || event.isPrimary === false) return;
      if (gesture) cancel(); freezeMotion(); clearSuppression();
      const id = paper.dataset.pdPaper; gesture = { id, c: cards.get(id), pointerId: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, baseAngle: rotationOf(cards.get(id).shell), bounds: list.getBoundingClientRect(), active: false, target: null };
      try { paper.setPointerCapture?.(event.pointerId); } catch (_) { /* Window listeners provide a fallback. */ }
    });
    on(win, 'pointermove', event => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (!root.isConnected || doc.hidden) { cancel(); return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.active && Math.hypot(dx, dy) < 7) return;
      gesture.active = true; root.dataset.dragging = 'true'; gesture.c.card.classList.add('pd-dragging');
      gesture.dx = dx; gesture.dy = dy;
      event.preventDefault();
      gesture.c.shell.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${gesture.baseAngle + Math.max(-7, Math.min(7, dx / 35))}deg)`;
      gesture.target = targetAt(event.clientX, event.clientY, gesture.id);
      cards.forEach((c, id) => c.card.classList.toggle('pd-drop-target', id === gesture.target));
    }, { passive: false });
    on(win, 'pointerup', event => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const before = positions(), old = endGesture();
      if (old.active) {
        event.preventDefault(); // endGesture() already armed the single follow-up click guard.
        select(old.id, 'drag');
        if (old.target) swap(old.id, old.target, 'drag', before); else land(before);
        old.c.paper.focus({ preventScroll: true });
      } else land(before);
    });
    on(win, 'pointercancel', event => { if (gesture?.pointerId === event.pointerId) cancel(true); });
    on(list, 'lostpointercapture', event => { if (gesture?.pointerId === event.pointerId) cancel(true); });
    on(list, 'click', event => {
      if (suppress && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); clearSuppression(); return; }
      const control = event.target.closest?.('[data-pd-action]'), paper = event.target.closest?.('[data-pd-paper]');
      if (control) {
        const id = control.dataset.policyId, action = control.dataset.pdAction;
        if (action === 'inspect') inspect(id, 'button');
        else { const index = order.indexOf(id), next = index + (action === 'earlier' ? -1 : 1); if (next >= 0 && next < order.length) { swap(id, order[next], 'button'); cards.get(id).paper.focus({ preventScroll: true }); } }
      } else if (paper && list.contains(paper)) inspect(paper.dataset.pdPaper, 'paper');
    }, true);
    on(list, 'keydown', event => {
      const paper = event.target.closest?.('[data-pd-paper]'); if (!paper || event.altKey || event.ctrlKey || event.metaKey) return;
      const id = paper.dataset.pdPaper, i = order.indexOf(id);
      if (event.key === 'Escape') { cancel(); return; }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(id, 'keyboard'); return; }
      let next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, i - 1);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(order.length - 1, i + 1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = order.length - 1;
      if (next === null) return;
      event.preventDefault();
      if (event.shiftKey) { swap(id, order[next], 'keyboard'); cards.get(id).paper.focus({ preventScroll: true }); }
      else { select(order[next], 'keyboard'); cards.get(order[next]).paper.focus({ preventScroll: true }); }
    });
    const settle = () => cancel();
    on(win, 'resize', settle); on(win, 'scroll', settle, true); on(win, 'blur', settle); on(doc, 'visibilitychange', () => { if (doc.hidden) settle(); });
    media.forEach(query => { if (query.addEventListener) on(query, 'change', settle); });
    let resize;
    if (win.ResizeObserver) { resize = new win.ResizeObserver(() => {
      const baseline = gesture?.bounds || motionBounds; if (!baseline) return;
      const box = list.getBoundingClientRect(); if (Math.abs(box.width - baseline.width) > .5 || Math.abs(box.height - baseline.height) > .5) settle();
    }); resize.observe(list); }
    let removal;
    if (win.MutationObserver) { removal = new win.MutationObserver(() => {
      if ((gesture || motions.size || held.size) && (!root.isConnected || root.closest('[hidden],[inert]') || [...motions.keys(), ...held.keys()].some(node => !root.contains(node)))) settle();
    }); removal.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert'] }); }
    paint();
    if (!items.length) status.textContent = '尚未提供示例保單。';
    const api = { select, cancel, destroy() { if (dead) return; cancel(); clearSuppression(); dead = true; disposers.forEach(fn => fn()); removal?.disconnect(); resize?.disconnect(); root.remove(); if (mounts.get(host) === api) mounts.delete(host); }, get selectedId() { return selected; } };
    mounts.set(host, api); return api;
  }
  global.PolicyDeck = Object.freeze({ mount, timings });
})(window);
