/* Flat shared controls. CSS owns the left-to-right fill; this adapter only
 * mirrors native state and manages pointer/keyboard presses and dynamic nodes. */
(() => {
  'use strict';
  if (window.PolicyButtonMotion) return;

  const DEFAULT_SELECTOR = 'button,summary,a.button,a.icon-action,a.text-action,nav a,.oc-access,.ex-page-actions a,.ex-footer a,.sc-footer a,[role="button"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"],[data-liquid-control]';
  const controllers = new WeakMap();
  const services = new WeakMap();
  const defaults = Object.freeze({ selector: DEFAULT_SELECTOR, pressMs: 180, releaseMs: 180 });
  const hooks = ['data-liquid-mounted', 'data-liquid-selected', 'data-liquid-disabled', 'data-liquid-pressed'];
  const snapshot = (element, names) => names.map(name => [name, element.getAttribute(name)]);
  const restore = (element, values) => values.forEach(([name, value]) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value));
  const attr = (element, name, value) => {
    if (value === null) { if (element.hasAttribute(name)) element.removeAttribute(name); }
    else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const duration = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(2000, value)) : fallback;
  // An opt-in decoration wraps the real input; it never becomes a second control.
  const choiceInput = element => element.hasAttribute('data-liquid-choice') ? element.querySelector('input[type="checkbox"],input[type="radio"]') : null;
  const chosen = element => choiceInput(element)?.checked ?? (['aria-pressed', 'aria-selected', 'aria-checked', 'data-selected'].some(name => element.getAttribute(name) === 'true') ||
    (element.hasAttribute('aria-current') && !['false', ''].includes(element.getAttribute('aria-current'))) ||
    /^(on|checked|selected|active)$/.test(element.getAttribute('data-state') || '') ||
    ['is-active', 'is-selected', 'selected'].some(name => element.classList.contains(name)));
  const composedParent = element => element.assignedSlot || element.parentElement || element.getRootNode()?.host || null;
  function ancestorMatches(element, selector) {
    for (let ancestor = element; ancestor; ancestor = composedParent(ancestor)) if (ancestor.matches(selector)) return true;
    return false;
  }
  // Motion engines write their own inline styles every frame. Never rescan the
  // document for those writes; availability is checked when a control is used.
  function visualMutation(record) {
    if (ancestorMatches(record.target, '[data-liquid-ignore]')) return true;
    return record.type === 'childList' && record.addedNodes.length > 0 && !record.removedNodes.length &&
      [...record.addedNodes].every(node => node.nodeType === 1 && node.matches('.liquid-skin'));
  }
  const disabled = element => element.matches(':disabled') || Boolean(choiceInput(element)?.matches(':disabled')) || ancestorMatches(element, '[aria-disabled="true"],[inert]');
  const unavailable = element => {
    if (!element.isConnected || disabled(element) || ancestorMatches(element, '[hidden],[aria-hidden="true"]')) return true;
    for (let ancestor = element; ancestor; ancestor = composedParent(ancestor)) {
      const style = element.ownerDocument.defaultView.getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
    }
    return false;
  };

  function serviceFor(doc) {
    if (services.has(doc)) return services.get(doc);
    const win = doc.defaultView;
    const records = new Map();
    const pointers = new Map();
    const active = new Set();
    const mounts = new Set();
    const listeners = [];
    const delegatedEvents = [];
    const eventRoots = new Map();
    const media = ['(prefers-reduced-motion: reduce)', '(forced-colors: active)'].map(query => win.matchMedia?.(query)).filter(Boolean);
    const quiet = () => media.some(item => item.matches);
    let refreshQueued = false;
    // A scoped host can itself be removed or inherit disabled/inert from outside
    // its subtree; its own observer cannot see those parent mutations.
    const documentObserver = new win.MutationObserver(records => {
      if (refreshQueued || records.every(visualMutation)) return;
      refreshQueued = true;
      queueMicrotask(() => { refreshQueued = false; mounts.forEach(controller => controller.refresh()); });
    });
    documentObserver.observe(doc, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'inert', 'aria-disabled', 'aria-hidden', 'class', 'data-liquid', 'data-liquid-ignore'] });
    const listen = (target, name, handler, options = true) => {
      target.addEventListener(name, handler, options);
      listeners.push(() => target.removeEventListener(name, handler, options));
      if (target === doc) delegatedEvents.push([name, handler, options]);
    };
    const fromEvent = event => {
      const path = event.composedPath?.() || [];
      for (const element of path) if (records.has(element)) return records.get(element);
      for (let element = event.target; element; element = element.parentElement) if (records.has(element)) return records.get(element);
      return null;
    };
    // Scoped owners override the automatic document mount. Among scoped owners,
    // the latest successful mount/update wins; refresh never changes precedence.
    const optionsFor = record => [...record.owners].sort((a, b) =>
      Number(a.root.nodeType === 9) - Number(b.root.nodeType === 9) || b.order - a.order
    )[0]?.options || defaults;
    function cancelAnimation(record) {
      if (record.releaseTimer !== null) win.clearTimeout(record.releaseTimer);
      record.releaseTimer = null;
      if (!record.pressing) active.delete(record);
    }
    function press(record) {
      if (unavailable(record.element) || record.pressing) return;
      cancelAnimation(record);
      record.pressing = true;
      record.pressedAt = win.performance.now();
      active.add(record);
      attr(record.element, 'data-liquid-pressed', 'true');
    }
    function release(record, immediate = false, synthetic = false) {
      if (synthetic) press(record);
      record.pressing = false;
      record.key = null;
      if (record.pointerId !== null) pointers.delete(record.pointerId);
      record.pointerId = null;
      cancelAnimation(record);
      const finish = () => {
        record.releaseTimer = null;
        attr(record.element, 'data-liquid-pressed', null);
        active.delete(record);
      };
      // A short tap still gets one readable fill. No bounce, host transform,
      // frame callback or continuous animation is allocated.
      const hold = immediate || quiet() || unavailable(record.element) ? 0 :
        Math.max(0, duration(optionsFor(record).pressMs, 180) - (win.performance.now() - record.pressedAt));
      if (!hold) finish();
      else { active.add(record); record.releaseTimer = win.setTimeout(finish, hold); }
    }
    function settle() { [...active].forEach(record => release(record, true)); pointers.clear(); }
    listen(doc, 'pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      const record = fromEvent(event);
      if (!record || record.pointerId !== null || unavailable(record.element)) return;
      record.pointerId = event.pointerId;
      pointers.set(event.pointerId, record);
      press(record);
    }, { capture: true, passive: true });
    const pointerEnd = event => { const record = pointers.get(event.pointerId); if (record) release(record); };
    listen(win, 'pointerup', pointerEnd, { capture: true, passive: true });
    listen(win, 'pointercancel', pointerEnd, { capture: true, passive: true });
    listen(doc, 'lostpointercapture', pointerEnd);
    listen(doc, 'dragstart', event => { const record = fromEvent(event); if (record) release(record, true); });
    listen(doc, 'keydown', event => {
      if (event.key === 'Escape') { settle(); return; }
      if (![' ', 'Spacebar', 'Enter'].includes(event.key) || event.repeat || event.isComposing) return;
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const record = fromEvent(event);
      if (!record || unavailable(record.element)) return;
      record.key = event.key;
      press(record);
    });
    listen(win, 'keyup', event => [...active].forEach(record => { if (record.key === event.key) release(record); }));
    listen(doc, 'focusout', event => {
      const record = fromEvent(event);
      if (record?.key && !record.element.contains(event.relatedTarget)) release(record);
    });
    listen(doc, 'click', event => {
      const record = fromEvent(event);
      if (record && event.detail === 0 && !record.pressing && record.releaseTimer === null && !unavailable(record.element)) release(record, false, true);
    });
    // checked is a live property, so native click/Space changes need an event,
    // not an attribute observer. Refresh siblings too for native radio groups.
    listen(doc, 'change', event => {
      if (event.target?.matches?.('input[type="checkbox"],input[type="radio"]')) mounts.forEach(controller => controller.refresh());
    });
    listen(win, 'blur', settle);
    listen(win, 'resize', settle);
    listen(win, 'pagehide', settle);
    listen(doc, 'visibilitychange', () => { if (doc.hidden) settle(); });
    media.forEach(item => {
      if (item.addEventListener) { item.addEventListener('change', settle); listeners.push(() => item.removeEventListener('change', settle)); }
      else if (item.addListener) { item.addListener(settle); listeners.push(() => item.removeListener(settle)); }
    });
    function retainEventRoot(root) {
      if (root === doc) return () => {};
      let entry = eventRoots.get(root);
      if (!entry) {
        const bindings = [...delegatedEvents,
          ['pointerup', pointerEnd, { capture: true, passive: true }],
          ['pointercancel', pointerEnd, { capture: true, passive: true }]];
        bindings.forEach(([name, handler, options]) => root.addEventListener(name, handler, options));
        entry = { count: 0, remove() {
          bindings.forEach(([name, handler, options]) => root.removeEventListener(name, handler, options));
        } };
        eventRoots.set(root, entry);
      }
      entry.count++;
      return () => {
        if (--entry.count) return;
        entry.remove();
        eventRoots.delete(root);
      };
    }
    const service = { records, mounts, release, cancelAnimation, retainEventRoot, order: 0, dispose() {
      settle(); documentObserver.disconnect(); listeners.splice(0).forEach(remove => remove());
      eventRoots.forEach(entry => entry.remove()); eventRoots.clear(); services.delete(doc);
    } };
    services.set(doc, service);
    return service;
  }

  function mount(root = document, options = {}) {
    if (!root || ![1, 9, 11].includes(root.nodeType)) throw new TypeError('PolicyButtonMotion.mount expects a Document, Element or ShadowRoot.');
    if (controllers.has(root)) { const current = controllers.get(root); current.update(options); return current; }
    // Validate the exact initial selector before allocating services or publishing
    // an instance. A failed mount must leave a clean retry path.
    root.querySelectorAll({ ...defaults, ...options }.selector);
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const service = serviceFor(doc);
    const owned = new Set();
    let stopped = false;
    let scheduled = false;
    let observer;
    let eventRoot;
    let releaseEventRoot;
    const controller = { root, order: 0, options: { ...defaults }, refresh, update, destroy };
    const valid = element => element.namespaceURI === 'http://www.w3.org/1999/xhtml' && !element.matches('input,textarea,select,option,label') && !ancestorMatches(element, '[data-liquid="off"],[data-liquid-ignore]');
    function removeOwner(record) {
      owned.delete(record);
      record.owners.delete(controller);
      if (record.owners.size) return;
      service.release(record, true);
      if (record.createdSkin) record.skin.remove();
      else restore(record.skin, record.skinAttributes);
      restore(record.element, record.attributes);
      if (record.createdClass) record.element.classList.remove('liquid-control');
      service.records.delete(record.element);
    }
    function sync(record) {
      const element = record.element;
      // Reattach the same decoration after app-owned textContent/replaceChildren.
      if (record.skin.parentNode !== element) element.appendChild(record.skin);
      [...element.children].filter(child => child !== record.skin && child.classList.contains('liquid-skin')).forEach(child => child.remove());
      if (!element.classList.contains('liquid-control')) element.classList.add('liquid-control');
      attr(record.skin, 'aria-hidden', 'true');
      attr(record.skin, 'data-liquid-skin', '');
      attr(element, 'data-liquid-mounted', '');
      attr(element, 'data-liquid-selected', String(chosen(element)));
      attr(element, 'data-liquid-disabled', String(disabled(element)));
      if ((record.pressing || record.releaseTimer !== null) && unavailable(element)) service.release(record, true);
    }
    function refresh() {
      if (stopped) return controller;
      const treeRoot = root.getRootNode();
      const nextEventRoot = treeRoot.nodeType === 11 && treeRoot.host ? treeRoot : doc;
      if (eventRoot !== nextEventRoot) {
        releaseEventRoot?.();
        eventRoot = nextEventRoot;
        releaseEventRoot = service.retainEventRoot(eventRoot);
      }
      const connected = root.nodeType === 9 || root.isConnected;
      const candidates = new Set(connected ? root.querySelectorAll(controller.options.selector) : []);
      if (connected && root.nodeType === 1 && root.matches(controller.options.selector)) candidates.add(root);
      [...candidates].forEach(element => { if (!valid(element)) candidates.delete(element); });
      [...owned].forEach(record => { if (!candidates.has(record.element)) removeOwner(record); });
      candidates.forEach(element => {
        let record = service.records.get(element);
        if (!record) {
          const skin = [...element.children].find(child => child.classList.contains('liquid-skin')) || doc.createElement('span');
          record = { element, skin, createdSkin: !skin.parentNode, skinAttributes: snapshot(skin, ['aria-hidden', 'data-liquid-skin']),
            attributes: snapshot(element, hooks), createdClass: !element.classList.contains('liquid-control'), owners: new Set(),
            releaseTimer: null, pressedAt: 0, pressing: false, pointerId: null, key: null };
          skin.classList.add('liquid-skin');
          service.records.set(element, record);
        }
        record.owners.add(controller);
        owned.add(record);
        sync(record);
      });
      return controller;
    }
    function update(next = {}) {
      if (stopped) return controller;
      const merged = { ...controller.options, ...next };
      // Validate before changing a running controller's selector.
      root.querySelectorAll(merged.selector);
      controller.options = merged;
      controller.order = ++service.order;
      return refresh();
    }
    function destroy() {
      if (stopped) return;
      stopped = true;
      observer?.disconnect();
      releaseEventRoot?.();
      [...owned].forEach(removeOwner);
      service.mounts.delete(controller);
      controllers.delete(root);
      if (!service.mounts.size) service.dispose();
    }
    controllers.set(root, controller);
    service.mounts.add(controller);
    update(options);
    // A successful explicit document mount consumes bootstrap, including when
    // the caller destroys it before DOMContentLoaded.
    if (root === document) document.removeEventListener('DOMContentLoaded', autoMount);
    observer = new doc.defaultView.MutationObserver(records => {
      if (scheduled || stopped || records.every(visualMutation)) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; if (!stopped) refresh(); });
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'disabled', 'checked', 'role', 'aria-disabled', 'aria-hidden', 'aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'data-selected', 'data-state', 'data-liquid', 'data-liquid-ignore', 'data-liquid-control', 'data-liquid-choice', 'hidden', 'inert'] });
    return controller;
  }

  window.PolicyButtonMotion = Object.freeze({ mount, defaults, adaptation: 'flat-left-to-right-fill; native-controls' });
  function autoMount() { mount(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  else mount(document);
})();
