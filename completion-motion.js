/* Native, transient result-surface motion. The host owns its data and copy. */
(() => {
  'use strict';

  const timings = Object.freeze({ prepare: 1750, sweep: 1300, revealLag: 400, reveal: 800, deform: 500 });
  const mounts = new WeakMap();
  const mask = 'linear-gradient(to bottom, #000 0%, #000 40%, transparent 60%, transparent 100%)';
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const connected = element => Boolean(element?.isConnected);

  function reduced() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }
    catch { return false; }
  }

  function mount(host, options = {}) {
    mounts.get(host)?.destroy();
    const validHost = Boolean(host?.querySelector && host?.setAttribute);
    const initialState = validHost ? host.getAttribute('data-reveal-state') : null;
    let state = 'ready';
    let destroyed = false;
    let current = null;

    function phase(next, notify = true) {
      state = next;
      if (validHost) host.setAttribute('data-reveal-state', next);
      if (notify && typeof options.onPhase === 'function') {
        try { options.onPhase(next); } catch {}
      }
    }

    function play() {
      if (current) return current.promise;
      if (destroyed) return Promise.resolve();
      const content = validHost ? host.querySelector('[data-reveal-content]') : null;
      if (!connected(host) || !connected(content) || reduced() || typeof content.animate !== 'function') {
        phase('ready');
        return Promise.resolve();
      }

      const hostRect = host.getBoundingClientRect();
      const height = host.clientHeight || hostRect.height;
      const width = host.clientWidth || hostRect.width;
      const scrollTop = host.scrollTop;
      const scrollLeft = host.scrollLeft;
      if (!height || !width) {
        phase('ready');
        return Promise.resolve();
      }

      let resolve;
      let finished = false;
      const promise = new Promise(done => { resolve = done; });
      const timers = new Set();
      const animations = new Set();
      const styles = [];
      const attributes = [];
      const layers = [];
      const cleanups = [];
      const prepare = Number.isFinite(options.prepareMs) ? Math.max(0, options.prepareMs) : timings.prepare;
      const total = Math.max(timings.sweep, timings.revealLag + timings.reveal);
      const job = { promise, finish };
      current = job;

      function ownStyle(element, property, value) {
        let record = styles.find(item => item.element === element && item.property === property);
        const original = element.style.getPropertyValue(property);
        const priority = element.style.getPropertyPriority(property);
        if (!record) {
          record = { element, property, original, priority, value };
          styles.push(record);
        } else {
          // Retain a newer owner value if it changed between our two writes.
          if (original !== record.value) Object.assign(record, { original, priority });
          record.value = value;
        }
        element.style.setProperty(property, value);
        // CSSOM may normalize gradients, colors or spacing on assignment.
        record.value = element.style.getPropertyValue(property);
      }

      function ownAttribute(element, name, value) {
        attributes.push({ element, name, original: element.getAttribute(name), value });
        element.setAttribute(name, value);
      }

      function intact() {
        return connected(host) && connected(content) && host.contains(content);
      }

      function later(callback, delay) {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (finished) return;
          if (!intact()) { finish(); return; }
          callback();
        }, delay);
        timers.add(timer);
      }

      function animate(element, frames, timing) {
        try {
          const animation = element.animate(frames, timing);
          if (!animation) return null;
          animations.add(animation);
          // Every companion must consume its rejection when this run is cancelled.
          try { animation.finished?.then(() => {}, () => {}); } catch {}
          return animation;
        } catch { return null; }
      }

      function finish() {
        if (finished) return;
        finished = true;
        for (const timer of timers) window.clearTimeout(timer);
        timers.clear();
        for (const animation of animations) {
          animation.onfinish = null;
          animation.oncancel = null;
          try { animation.cancel(); } catch {}
        }
        animations.clear();
        for (const cleanup of cleanups) { try { cleanup(); } catch {} }
        for (const layer of layers) layer.remove();
        // Restore detached nodes too: a view may be reinserted after cancellation.
        for (const record of styles.reverse()) {
          if (record.element.style.getPropertyValue(record.property) !== record.value) continue;
          if (record.original) record.element.style.setProperty(record.property, record.original, record.priority);
          else record.element.style.removeProperty(record.property);
        }
        for (const record of attributes.reverse()) {
          if (record.element.getAttribute(record.name) !== record.value) continue;
          if (record.original === null) record.element.removeAttribute(record.name);
          else record.element.setAttribute(record.name, record.original);
        }
        if (current === job) current = null;
        phase('ready');
        resolve();
      }

      function addLayer(className) {
        const layer = host.ownerDocument.createElement('div');
        layer.className = className;
        layer.setAttribute('aria-hidden', 'true');
        layer.setAttribute('inert', '');
        layer.style.pointerEvents = 'none';
        layers.push(layer);
        host.appendChild(layer);
        return layer;
      }

      const contentRect = content.getBoundingClientRect();
      const ghost = content.cloneNode(true);
      ghost.classList.add('completion-ghost');
      ghost.removeAttribute('data-reveal-content');
      for (const element of [ghost, ...ghost.querySelectorAll('*')]) {
        element.removeAttribute('id');
        element.removeAttribute('data-reveal-row');
        for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for']) element.removeAttribute(attribute);
        if (element.matches('a, button, input, select, textarea, [tabindex], [contenteditable]')) element.setAttribute('tabindex', '-1');
      }
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      Object.assign(ghost.style, {
        position: 'absolute',
        top: `${contentRect.top - hostRect.top - host.clientTop + host.scrollTop}px`,
        left: `${contentRect.left - hostRect.left - host.clientLeft + host.scrollLeft}px`,
        width: `${contentRect.width}px`,
        margin: '0',
        opacity: '.08',
        filter: 'blur(1.5px)',
        pointerEvents: 'none',
        userSelect: 'none',
      });
      layers.push(ghost);
      if (window.getComputedStyle(host).position === 'static') ownStyle(host, 'position', 'relative');
      ownStyle(content, 'opacity', '0');
      ownStyle(content, 'pointer-events', 'none');
      ownAttribute(content, 'aria-hidden', 'true');
      ownAttribute(content, 'inert', '');
      host.appendChild(ghost);
      const wave = addLayer('completion-wave');
      const glow = addLayer('completion-wave-glow');

      // Observation exists only for a running play. Resizing or removing the
      // surface settles it rather than replaying stale geometry or holding a loop.
      const resized = () => {
        const rect = host.getBoundingClientRect();
        // The state CSS may hide a scrollbar. Only a change to the outer
        // geometry invalidates the sweep, not the resulting client-width change.
        if (!intact() || Math.abs(rect.height - hostRect.height) > .5 || Math.abs(rect.width - hostRect.width) > .5) finish();
      };
      if (typeof window.ResizeObserver === 'function') {
        const observer = new window.ResizeObserver(resized);
        observer.observe(host);
        cleanups.push(() => observer.disconnect());
      }
      window.addEventListener('resize', resized);
      cleanups.push(() => window.removeEventListener('resize', resized));
      const scrolled = () => { if (host.scrollTop !== scrollTop || host.scrollLeft !== scrollLeft) finish(); };
      host.addEventListener('scroll', scrolled);
      cleanups.push(() => host.removeEventListener('scroll', scrolled));
      if (typeof window.MutationObserver === 'function' && host.ownerDocument.documentElement) {
        const observer = new window.MutationObserver(() => { if (!intact()) finish(); });
        observer.observe(host.ownerDocument.documentElement, { childList: true, subtree: true });
        cleanups.push(() => observer.disconnect());
      }
      let preference;
      try { preference = window.matchMedia?.('(prefers-reduced-motion: reduce)'); } catch {}
      const changedPreference = event => { if (event.matches) finish(); };
      if (preference?.addEventListener) {
        preference.addEventListener('change', changedPreference);
        cleanups.push(() => preference.removeEventListener('change', changedPreference));
      }

      function reveal() {
        if (!intact()) { finish(); return; }
        phase('revealing');
        // onPhase may synchronously cancel, destroy or remove this view.
        if (finished || !intact()) { finish(); return; }
        ownStyle(content, 'opacity', '1');
        ownStyle(content, 'will-change', 'mask-position, filter');
        const viewportTop = host.getBoundingClientRect().top + host.clientTop;
        const contentBox = content.getBoundingClientRect();
        const viewportOffset = viewportTop - contentBox.top;
        // Percent positions use the whole content box, which can be much taller
        // than a scrollable host. These are the equivalent 250%-height mask
        // positions measured against the visible viewport instead.
        // The opaque part enters from above: the list resolves top to bottom,
        // following the downward light rather than exposing the bottom first.
        const maskStart = `0px ${viewportOffset - height * 1.5}px`;
        const maskEnd = `0px ${viewportOffset}px`;
        let supportsMask = false;
        try { supportsMask = Boolean(window.CSS?.supports?.('mask-image', mask) || window.CSS?.supports?.('-webkit-mask-image', mask)); } catch {}
        let revealFrames;
        if (supportsMask) {
          for (const prefix of ['', '-webkit-']) {
            ownStyle(content, `${prefix}mask-image`, mask);
            ownStyle(content, `${prefix}mask-size`, `100% ${height * 2.5}px`);
            ownStyle(content, `${prefix}mask-repeat`, 'no-repeat');
            ownStyle(content, `${prefix}mask-position`, maskStart);
          }
          revealFrames = [
            { maskPosition: maskStart, webkitMaskPosition: maskStart, filter: 'blur(4px)' },
            { maskPosition: maskEnd, webkitMaskPosition: maskEnd, filter: 'blur(0px)' },
          ];
        } else {
          const contentHeight = contentBox.height || content.scrollHeight || height;
          const top = clamp(viewportOffset, 0, contentHeight);
          const bottom = clamp(viewportOffset + height, 0, contentHeight);
          const insetBottom = Math.max(0, contentHeight - bottom);
          const clipStart = `inset(${top}px 0 ${Math.max(0, contentHeight - top)}px 0)`;
          const clipEnd = `inset(${top}px 0 ${insetBottom}px 0)`;
          ownStyle(content, 'clip-path', clipStart);
          revealFrames = [
            { clipPath: clipStart, filter: 'blur(4px)' },
            { clipPath: clipEnd, filter: 'blur(0px)' },
          ];
        }

        const sweepFrames = [
          { transform: `translateY(${scrollTop - height * .57}px)`, opacity: 0, offset: 0 },
          { transform: `translateY(${scrollTop - height * .32}px)`, opacity: .64, offset: .15 },
          { transform: `translateY(${scrollTop + height * .33}px)`, opacity: .7, offset: .54 },
          { transform: `translateY(${scrollTop + height * .77}px)`, opacity: .48, offset: .8 },
          { transform: `translateY(${scrollTop + height * 1.1}px)`, opacity: 0, offset: 1 },
        ];
        const sweepAnimation = animate(wave, sweepFrames, { duration: timings.sweep, easing: 'linear', fill: 'both' });
        const glowFrames = sweepFrames.map(frame => ({ ...frame, opacity: frame.opacity * .55 }));
        const glowAnimation = animate(glow, glowFrames, { duration: timings.sweep, easing: 'linear', fill: 'both' });
        const contentAnimation = animate(content, revealFrames, { duration: timings.reveal, delay: timings.revealLag, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
        animate(ghost, [{ opacity: .08 }, { opacity: 0 }], { duration: timings.reveal, delay: timings.revealLag, easing: 'linear', fill: 'both' });
        if (!sweepAnimation || !glowAnimation || !contentAnimation) { finish(); return; }

        // A travelling local distortion, tied to the same band's geometry.
        // Opacity belongs to the collective mask, never to individual rows.
        const deformScale = clamp(width / 620, .45, 1.25);
        for (const row of content.querySelectorAll('[data-reveal-row]')) {
          const rect = row.getBoundingClientRect();
          const center = rect.top + rect.height / 2 - viewportTop;
          if (rect.bottom <= viewportTop || rect.top >= viewportTop + height) continue;
          const crossing = clamp((center + height * .195) / (height * 1.67), 0, 1);
          const delay = clamp(timings.sweep * crossing - timings.deform * .38, 0, Math.max(0, total - timings.deform));
          const computed = window.getComputedStyle(row);
          const baseTransform = computed.transform && computed.transform !== 'none' ? `${computed.transform} ` : '';
          const baseFilter = computed.filter && computed.filter !== 'none' ? `${computed.filter} ` : '';
          animate(row, [
            { transform: `${baseTransform}translateY(0px) skewY(0deg)`, filter: `${baseFilter}blur(0px)`, offset: 0 },
            { transform: `${baseTransform}translateY(${8 * deformScale}px) skewY(-.2deg)`, filter: `${baseFilter}blur(1px)`, offset: .38 },
            { transform: `${baseTransform}translateY(${-4 * deformScale}px) skewY(.08deg)`, filter: `${baseFilter}blur(.35px)`, offset: .7 },
            { transform: `${baseTransform}translateY(0px) skewY(0deg)`, filter: `${baseFilter}blur(0px)`, offset: 1 },
          ], { duration: timings.deform, delay, easing: 'ease-in-out', fill: 'both' });
        }
        later(finish, total);
      }

      phase('preparing');
      if (!finished && intact()) later(reveal, prepare);
      else finish();
      return promise;
    }

    function cancel() {
      current?.finish();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      if (validHost && host.getAttribute('data-reveal-state') === state) {
        if (initialState === null) host.removeAttribute('data-reveal-state');
        else host.setAttribute('data-reveal-state', initialState);
      }
      if (validHost && mounts.get(host) === controller) mounts.delete(host);
    }

    const controller = Object.freeze({ play, cancel, destroy, get state() { return state; } });
    phase('ready', false);
    if (validHost) mounts.set(host, controller);
    return controller;
  }

  window.PolicyCompletionReveal = Object.freeze({ mount, timings });
})();
