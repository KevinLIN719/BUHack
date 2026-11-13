/* Native DOM adaptation of the supplied Spider Track Switcher motion study.
   See design/modules/policy-interactions.md for provenance and implementation boundaries. */
(function (global) {
  'use strict';
  const mounts = new WeakMap();
  const durations = (() => {
    const phases = { aim:240, wrap:100, tension:60, carry:470, landing:430 };
    return Object.freeze({ ...phases, total:Object.values(phases).reduce((sum,value)=>sum+value,0) });
  })();
  function mount(overlay, options = {}) {
    if (!overlay || !overlay.ownerDocument) throw new TypeError('PolicyPull.mount needs a DOM overlay.');
    mounts.get(overlay)?.destroy();
    const doc = overlay.ownerDocument, win = doc.defaultView, ns = 'http://www.w3.org/2000/svg';
    const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = win.matchMedia?.('(forced-colors: active)');
    let dead = false, active = null, raf = 0;
    const ghosts = new Set();
    const disposers = [];
    const layer = doc.createElement('div'); layer.className = 'pp-layer'; layer.dataset.liquidIgnore = ''; layer.setAttribute('aria-hidden', 'true'); layer.hidden = true; overlay.append(layer);
    const svg = doc.createElementNS(ns, 'svg'); svg.classList.add('pp-tether');
    const thread = doc.createElementNS(ns, 'path'); thread.classList.add('pp-thread');
    const wrap = doc.createElementNS(ns, 'path'); wrap.classList.add('pp-wrap'); wrap.setAttribute('pathLength', '1');
    svg.append(thread, wrap);
    const token = doc.createElement('div'); token.className = 'pp-token'; token.dataset.token = ['shield','bookmark','policy'].includes(options.token) ? options.token : 'shield';
    token.innerHTML = '<svg viewBox="0 0 32 36" aria-hidden="true"><path class="pp-shield" d="M16 2 29 7v10c0 8-7 13-13 17C10 30 3 25 3 17V7Z"/><path class="pp-bookmark" d="M7 3h18v30l-9-6-9 6Z"/><path class="pp-policy" d="M6 3h14l7 7v23H6Zm14 0v8h7M10 17h13M10 22h13M10 27h9"/><path class="pp-check" d="m10 17 4 4 8-9"/></svg>';
    layer.append(svg, token);
    const on = (node, name, fn, opts) => { node.addEventListener(name, fn, opts); disposers.push(() => node.removeEventListener(name, fn, opts)); };
    function phase(name, job = active) { layer.dataset.phase = name; options.onState?.(name, job ? { id: job.id } : { id: null }); }
    function clean() { if (raf) win.cancelAnimationFrame(raf); raf = 0; active?.clone.remove(); layer.hidden = true; thread.setAttribute('d', ''); wrap.setAttribute('d', ''); }
    // An interrupted flight leaves a short fading copy of its current frame,
    // so a redirect or scroll never makes the paper and thread disappear.
    function ghost() {
      if (layer.hidden || !active) return;
      const copy = layer.cloneNode(true); copy.classList.add('pp-ghost'); copy.removeAttribute('data-phase'); overlay.append(copy); ghosts.add(copy);
      const done = () => { ghosts.delete(copy); copy.remove(); };
      if (media?.matches || typeof copy.animate !== 'function') { done(); return; }
      const fade = copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      fade.onfinish = done; fade.oncancel = done;
    }
    function settle(result, soft = false) {
      if (!active) return;
      if (soft) ghost();
      const job = active; clean(); active = null; phase(result === 'complete' ? 'idle' : 'cancelled', job); job.resolve({ id: job.id, status: result, soft });
    }
    function cancel() { settle('cancelled'); }
    function fade() { settle('cancelled', true); }
    function usable(element) { return element?.isConnected && !element.closest('[hidden],[inert]') && element.getClientRects().length > 0; }
    function play(request = {}) {
      if (dead) return Promise.resolve({ id: request.id, status: 'destroyed' });
      // Redirects continue from the visible bookmark instead of restarting.
      const handoff = active?.token ? { ...active.token } : null;
      fade();
      const { id, sourceElement, targetElement } = request;
      if (!sourceElement || !targetElement || !usable(sourceElement) || !usable(targetElement) || doc.hidden) {
        phase('idle', { id }); return Promise.resolve({ id, status: 'skipped' });
      }
      if (media?.matches || contrast?.matches || !win.requestAnimationFrame) { phase('idle', { id }); return Promise.resolve({ id, status: 'complete' }); }
      const base = overlay.getBoundingClientRect(), a = sourceElement.getBoundingClientRect(), b = targetElement.getBoundingClientRect();
      if (!base.width || !base.height || !a.width || !a.height || !b.width || !b.height) { phase('idle', { id }); return Promise.resolve({ id, status: 'skipped' }); }
      const clone = doc.createElement('div'); clone.className = 'pp-visual-clone'; clone.dataset.policyId = String(id ?? '');
      clone.setAttribute('inert', ''); clone.inert = true; clone.dataset.liquidIgnore = '';
      const paper = sourceElement.cloneNode(true);
      [paper, ...paper.querySelectorAll('*')].forEach(node => {
        for (const attr of Array.from(node.attributes)) { if (attr.name === 'id' || attr.name === 'tabindex' || attr.name === 'role' || attr.name.startsWith('aria-') || attr.name.startsWith('on') || attr.name.startsWith('data-')) node.removeAttribute(attr.name); }
        // Also neutralise a native control at the clone root, including without inert support.
        if ('disabled' in node) node.disabled = true;
        ['href', 'contenteditable', 'autofocus'].forEach(name => node.removeAttribute(name));
      });
      paper.querySelectorAll('.liquid-skin,button,input,textarea,select,a').forEach(n => n.remove());
      paper.style.transform = 'none'; clone.append(paper); layer.append(clone);
      const from = { x: a.left - base.left + a.width / 2, y: a.top - base.top + a.height / 2 };
      const to = { x: b.left - base.left + Math.min(b.width / 2, 90), y: b.top - base.top + b.height / 2 };
      const width = a.width, height = a.height;
      const scale = Math.min(.52, Math.max(.22, b.height / height));
      svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      return new Promise(resolve => {
        active = { id, sourceElement, targetElement, clone, resolve, onLanding:request.onLanding, started: null, from, to, width, height, scale, tokenStart: handoff, token: null, bounds: { width: base.width, height: base.height }, scrollX: win.scrollX || 0, scrollY: win.scrollY || 0, phase: '' };
        layer.hidden = false; layer.dataset.policyId = String(id ?? ''); tick(win.performance.now());
      });
    }
    // Zero velocity and acceleration at both ends of every shared segment.
    const ease = p => p * p * p * (p * (p * 6 - 15) + 10);
    const windowProgress = (p, start, end) => ease(Math.min(1,Math.max(0,(p-start)/(end-start))));
    const mix = (a, b, p) => a + (b - a) * p;
    const inside = (value, half, extent) => extent < half * 2 ? extent / 2 : Math.max(half, Math.min(extent - half, value));
    function tick(time) {
      raf = 0; const job = active; if (!job || dead) return;
      if (!usable(job.sourceElement) || !usable(job.targetElement) || !layer.isConnected || doc.hidden) { settle('cancelled'); return; }
      if (job.started === null) job.started = time;
      const elapsed = Math.max(0, time - job.started), p = Math.min(1, elapsed / durations.total);
      let name, local;
      let boundary = 0;
      for (const stage of ['aim','wrap','tension','carry','landing']) {
        if (elapsed < boundary + durations[stage] || stage === 'landing') { name=stage;local=Math.min(1,(elapsed-boundary)/durations[stage]);break; }
        boundary += durations[stage];
      }
      if (name !== job.phase) { job.phase = name; phase(name, job); if (active !== job) return; }
      const { from, to, width, height } = job;
      let x = from.x, y = from.y, size = 1, rotation = 0;
      const side = to.x >= from.x ? 1 : -1;
      // Aim and carry meet at the same paper edge on either side. In
      // particular, a narrow stacked layout must not flip the bookmark over
      // the entire paper when it enters carry.
      const start = job.tokenStart || { x: to.x, y: to.y - 25 };
      const aimed = ease(Math.min(1, elapsed / durations.aim));
      let tx = mix(start.x, from.x + side * (width / 2 + 18), aimed), ty = mix(start.y, from.y - height / 2 - 12, aimed);
      if (name === 'tension') {
        // A small lift before the carry, without a visible stop.
        const lift = Math.sin(local * Math.PI) ** 2;
        y -= lift * 2; ty -= lift * 3;
      }
      if (name === 'carry' || name === 'landing') {
        const t = name === 'landing' ? 1 : ease(local), q = 1 - t;
        const control = { x: mix(from.x, to.x, .53), y: Math.max(15, Math.min(from.y, to.y) - Math.min(90, Math.abs(from.x - to.x) * .22 + 35)) };
        x = q * q * from.x + 2 * q * t * control.x + t * t * to.x; y = q * q * from.y + 2 * q * t * control.y + t * t * to.y;
        size = mix(1, job.scale, t); rotation = Math.sin(t * Math.PI) * (to.x < from.x ? -5 : 5);
        tx = x + side * (width * size / 2 + 18); ty = y - height * size / 2 - 12;
      }
      const landing = name === 'landing' ? Math.min(1, local) : 0;
      // The paper arrives first. A short release then softens and opens the
      // thumbnail into the destination ink, instead of sitting over a title.
      const unfurl = windowProgress(landing,.02,.68);
      const retire = windowProgress(landing,.10,.64);
      if (landing) size *= 1 + unfurl * .1;
      if (name === 'carry' || name === 'landing') {
        // Reserve the rotated paper's visible half-size, not just its path centre.
        const angle = Math.abs(rotation) * Math.PI / 180;
        const halfW = (width * Math.cos(angle) + height * Math.sin(angle)) * size / 2 + 6;
        const halfH = (height * Math.cos(angle) + width * Math.sin(angle)) * size / 2 + 6;
        // Match the real source at lift-off, including a slightly tilted paper
        // touching the edge. Introduce safety clearance smoothly rather than
        // snapping it six pixels inward on the first carry frame.
        const clearance = name === 'carry' ? windowProgress(local,0,.16) : 1;
        x = mix(x,inside(x, halfW, job.bounds.width),clearance); y = mix(y,inside(y, halfH, job.bounds.height),clearance);
        tx = x + side * (width * size / 2 + 18); ty = y - height * size / 2 - 12;
      }
      tx = inside(tx + unfurl * 8, 18, job.bounds.width); ty = inside(ty - unfurl * 6, 20, job.bounds.height);
      const acquire = windowProgress(elapsed,durations.aim * .55,durations.aim + durations.wrap * .45);
      job.clone.style.cssText = `left:${x - width / 2}px;top:${y - height / 2}px;width:${width}px;height:${height}px;transform:scale(${size}) rotate(${rotation}deg);opacity:${acquire * (1 - retire)};`;
      job.token = { x: tx, y: ty };
      token.style.transform = `translate3d(${tx - 14}px,${ty - 16}px,0) rotate(${rotation}deg)`; token.style.opacity = String(1 - retire);
      const beam = name === 'aim' ? ease(local) : 1, ex = mix(tx, x, beam), ey = mix(ty, y, beam);
      const sag = Math.min(18, Math.abs(tx - x) * .04) + (name === 'tension' ? Math.sin(local * Math.PI) ** 2 * 1.5 : 0);
      thread.setAttribute('d', `M${tx} ${ty} Q${(tx + ex) / 2} ${(ty + ey) / 2 + sag} ${ex} ${ey}`);
      thread.style.opacity = String(1 - retire);
      const rw = width * size / 2 + 3, rh = height * size / 2 + 3;
      wrap.setAttribute('d', `M${x - rw} ${y - rh} H${x + rw} V${y + rh} H${x - rw} Z`);
      wrap.style.strokeDasharray = '1'; wrap.style.strokeDashoffset = String(name === 'aim' ? 1 : name === 'wrap' ? 1 - ease(local) : 0); wrap.style.opacity = String((1 - retire) * .7);
      if (name === 'landing' && typeof job.onLanding === 'function') {
        try { job.onLanding(landing); } catch {}
        if (active !== job || dead) return;
      }
      if (p >= 1) { settle('complete'); return; }
      raf = win.requestAnimationFrame(tick);
    }
    const cancelMotion = () => { if (active) settle('cancelled', true); };
    const scrolled = event => {
      if (!active) return;
      // A queued viewport notification can arrive after play() measured the
      // current scroll position. It does not invalidate the local route.
      if (event.target === doc && Math.abs((win.scrollX || 0) - active.scrollX) < .5 && Math.abs((win.scrollY || 0) - active.scrollY) < .5) return;
      cancelMotion();
    };
    on(win, 'resize', cancelMotion); on(win, 'scroll', scrolled, true); on(doc, 'visibilitychange', () => { if (doc.hidden) cancelMotion(); });
    if (media?.addEventListener) on(media, 'change', () => { if (media.matches && active) settle('complete'); });
    if (contrast?.addEventListener) on(contrast, 'change', () => { if (contrast.matches && active) settle('complete'); });
    let resize;
    if (win.ResizeObserver) {
      resize = new win.ResizeObserver(() => {
        if (!active) return;
        const bounds = overlay.getBoundingClientRect();
        // A render can queue a notification for geometry already measured by play().
        // Only a genuinely changed surface invalidates the in-flight route.
        if (!overlay.isConnected || Math.abs(bounds.width - active.bounds.width) > .5 || Math.abs(bounds.height - active.bounds.height) > .5) cancelMotion();
      });
      resize.observe(overlay);
    }
    let removal;
    if (win.MutationObserver) { removal = new win.MutationObserver(() => { if (active && (!overlay.isConnected || overlay.closest('[hidden],[inert]') || !active.sourceElement.isConnected || !active.targetElement.isConnected)) cancelMotion(); }); removal.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert'] }); }
    const api = { play, cancel, fade, destroy() { if (dead) return; cancel(); dead = true; ghosts.forEach(node => node.remove()); ghosts.clear(); disposers.forEach(fn => fn()); removal?.disconnect(); resize?.disconnect(); layer.remove(); if (mounts.get(overlay) === api) mounts.delete(overlay); } };
    mounts.set(overlay, api); return api;
  }
  global.PolicyPull = Object.freeze({ mount, timings: durations });
})(window);
