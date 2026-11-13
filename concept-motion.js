/* A short symbol sequence and one persistent tagline. Only the active layer
 * animates, using compositor opacity/transform; there is no per-frame DOM scan. */
(() => {
  'use strict';
  const timings = Object.freeze({ glyph: 500, cycles: 1, patternCount: 4,
    icons: 2000, dotwordHold: 0, wordSettle: 500, total: 2500 });
  const mounts = new WeakMap();
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const patterns = Object.freeze([
    { key: 'dollar', phase: 'currency', rows: ['00100','01111','10100','01110','00101','11110','00100'] },
    { key: 'yen', phase: 'currency', rows: ['10001','01010','00100','11111','00100','11111','00100'] },
    { key: 'shield', phase: 'protection', rows: ['11111','10001','10001','10001','01010','01010','00100'] },
    { key: 'paper', phase: 'policy', rows: ['11110','10011','10001','10101','10001','10101','11111'] }
  ].map(pattern => ({ ...pattern, path: pattern.rows.flatMap((row, y) =>
    [...row].map((cell, x) => cell === '1'
      ? `M${52 + x * 44},${34 + y * 44}a14,14 0 1,0 28,0a14,14 0 1,0 -28,0` : '')).join(' ') })));

  function mount(host, options = {}) {
    if (!host?.ownerDocument?.createElementNS || !host?.appendChild) {
      throw new TypeError('PolicyConceptMotion.mount requires a DOM element.');
    }
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument, view = doc.defaultView || window;
    const tagline = typeof options.tagline === 'string' && options.tagline.trim()
      ? options.tagline.trim() : '你的保單，付款前看清。';
    const originalAttributes = new Map();
    const cleanups = [], autoPauses = new Set();
    let state = 'ready', phase = 'name', destroyed = false, manualPaused = false;
    let run = null, animation = null;
    const preference = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = view.matchMedia?.('(forced-colors: active)');
    const quiet = () => preference?.matches || contrast?.matches;
    const ownAttribute = (name, value) => {
      if (!originalAttributes.has(name)) originalAttributes.set(name, host.getAttribute(name));
      host.setAttribute(name, value);
    };
    const symbol = doc.createElement('div');
    symbol.className = 'concept-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 340');
    svg.setAttribute('focusable', 'false');
    const path = doc.createElementNS(SVG_NS, 'path');
    svg.appendChild(path); symbol.appendChild(svg);
    const title = doc.createElement('div');
    title.className = 'concept-title';
    title.setAttribute('aria-hidden', 'true');
    const copy = doc.createElement('p');
    copy.className = 'concept-tagline';
    copy.textContent = tagline.replace('，', '，\n');
    title.appendChild(copy); host.append(symbol, title);
    ownAttribute('role', 'img'); ownAttribute('aria-label', tagline);

    function setStatus(next, nextPhase = phase) {
      const changed = state !== next || phase !== nextPhase;
      state = next; phase = nextPhase;
      ownAttribute('data-concept-state', state);
      ownAttribute('data-concept-phase', phase);
      if (changed && typeof options.onPhase === 'function') {
        try { options.onPhase(phase, state); } catch {}
      }
    }
    function finish() {
      if (destroyed) return;
      const job = run; run = null;
      animation?.cancel(); animation = null;
      manualPaused = false;
      ownAttribute('data-concept-glyph', 'tagline');
      setStatus('ready', 'name');
      job?.resolve();
    }
    function syncPlayback() {
      if (!run || destroyed) return;
      if (!host.isConnected || quiet()) { finish(); return; }
      const paused = manualPaused || autoPauses.size > 0;
      if (paused) animation?.pause();
      else animation?.play();
      setStatus(paused ? 'paused' : 'playing');
    }
    const setAutoPause = (reason, paused) => {
      if (paused) autoPauses.add(reason); else autoPauses.delete(reason);
      syncPlayback();
    };
    async function animate(node, frames, duration, job) {
      if (run !== job || destroyed) return false;
      const current = node.animate(frames, { duration, fill: 'both', easing: 'ease-out' });
      animation = current;
      if (manualPaused || autoPauses.size) current.pause();
      try { await current.finished; } catch {}
      if (animation === current) animation = null;
      current.cancel();
      return run === job && !destroyed;
    }
    async function sequence(job) {
      for (const pattern of patterns) {
        if (run !== job || destroyed) return;
        path.setAttribute('d', pattern.path);
        ownAttribute('data-concept-glyph', pattern.key);
        setStatus(manualPaused || autoPauses.size ? 'paused' : 'playing', pattern.phase);
        if (!await animate(symbol, [
          { opacity: 0, transform: 'translateY(5px)', offset: 0 },
          { opacity: 1, transform: 'none', offset: .25 },
          { opacity: 1, transform: 'none', offset: .72 },
          { opacity: 0, transform: 'none', offset: 1 }
        ], timings.glyph, job)) return;
      }
      ownAttribute('data-concept-glyph', 'tagline');
      setStatus(manualPaused || autoPauses.size ? 'paused' : 'playing', 'name');
      if (await animate(title, [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' }
      ], timings.wordSettle, job)) finish();
    }
    function play() {
      if (destroyed) return Promise.resolve();
      if (run) return run.promise;
      if (quiet() || !symbol.animate || !host.isConnected) { finish(); return Promise.resolve(); }
      manualPaused = false;
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      const job = { promise, resolve }; run = job;
      void sequence(job);
      return promise;
    }
    function pause() { manualPaused = true; syncPlayback(); }
    function resume() { manualPaused = false; syncPlayback(); }
    function destroy() {
      if (destroyed) return;
      finish(); destroyed = true;
      for (const cleanup of cleanups) cleanup();
      symbol.remove(); title.remove();
      for (const [name, original] of originalAttributes) {
        if (original === null) host.removeAttribute(name); else host.setAttribute(name, original);
      }
      state = 'destroyed';
      if (mounts.get(host) === controller) mounts.delete(host);
    }
    const controller = Object.freeze({ play, pause, resume, finish, destroy,
      get state() { return state; }, get phase() { return phase; } });
    mounts.set(host, controller);
    const visibility = () => setAutoPause('hidden', doc.hidden);
    if (doc.hidden) autoPauses.add('hidden');
    doc.addEventListener('visibilitychange', visibility);
    cleanups.push(() => doc.removeEventListener('visibilitychange', visibility));
    if (view.IntersectionObserver) {
      const observer = new view.IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === host);
        if (entry) setAutoPause('offscreen', !entry.isIntersecting);
      });
      observer.observe(host); cleanups.push(() => observer.disconnect());
    }
    if (view.MutationObserver && doc.documentElement) {
      const observer = new view.MutationObserver(() => { if (!host.isConnected) destroy(); });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      cleanups.push(() => observer.disconnect());
    }
    const preferenceChanged = () => { if (quiet()) finish(); };
    for (const media of [preference, contrast]) {
      media?.addEventListener?.('change', preferenceChanged);
      cleanups.push(() => media?.removeEventListener?.('change', preferenceChanged));
    }
    finish();
    if (options.autoplay !== false) void play();
    return controller;
  }
  window.PolicyConceptMotion = Object.freeze({ mount, timings });
})();
