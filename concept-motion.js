/*
 * Native dot-grid introduction. CSS owns the palette and layout; this module
 * owns only its generated children, concept data attributes and CSS clocks.
 * play() reuses an active (including paused) run's Promise. After ready, play()
 * starts a replay. finish() and destroy() always settle that Promise.
 */
(() => {
  'use strict';

  const timings = (() => {
    const glyph = 1000 / 6;
    const cycles = 4;
    const patternCount = 4;
    const icons = glyph * cycles * patternCount;
    const dotwordHold = 350;
    const wordSettle = 650;
    return Object.freeze({ glyph, cycles, patternCount, icons, dotwordHold, wordSettle,
      total: icons + dotwordHold + wordSettle, fieldPeriod: 1200, fieldTravel: 1.8 });
  })();
  const mounts = new WeakMap();
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const patterns = Object.freeze([
    { key: 'dollar', phase: 'currency', label: '貨幣', rows: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'] },
    { key: 'yen', phase: 'currency', label: '貨幣', rows: ['10001', '01010', '00100', '11111', '00100', '11111', '00100'] },
    { key: 'shield', phase: 'protection', label: '保障', rows: ['11111', '10001', '10001', '10001', '01010', '01010', '00100'] },
    { key: 'paper', phase: 'policy', label: '保單條款', rows: ['11110', '10011', '10001', '10101', '10001', '10101', '11111'] },
  ]);
  const alternateCurrencies = Object.freeze([
    { key: 'euro', phase: 'currency', label: '貨幣', rows: ['01111', '10000', '11110', '10000', '11110', '10000', '01111'] },
    { key: 'pound', phase: 'currency', label: '貨幣', rows: ['00110', '01001', '01000', '11110', '01000', '01000', '11111'] },
  ]);
  // Five columns, seven rows. The terminal word is an authored product ending;
  // the four fast icon cycles retain the reference's stationary, hard snaps.
  const alphabet = Object.freeze({
    A: ['01110','10001','10001','11111','10001','10001','10001'],
    B: ['11110','10001','10001','11110','10001','10001','11110'],
    C: ['01111','10000','10000','10000','10000','10000','01111'],
    D: ['11110','10001','10001','10001','10001','10001','11110'],
    E: ['11111','10000','10000','11110','10000','10000','11111'],
    F: ['11111','10000','10000','11110','10000','10000','10000'],
    G: ['01111','10000','10000','10111','10001','10001','01111'],
    H: ['10001','10001','10001','11111','10001','10001','10001'],
    I: ['11111','00100','00100','00100','00100','00100','11111'],
    J: ['00111','00010','00010','00010','10010','10010','01100'],
    K: ['10001','10010','10100','11000','10100','10010','10001'],
    L: ['10000','10000','10000','10000','10000','10000','11111'],
    M: ['10001','11011','10101','10101','10001','10001','10001'],
    N: ['10001','11001','10101','10011','10001','10001','10001'],
    O: ['01110','10001','10001','10001','10001','10001','01110'],
    P: ['11110','10001','10001','11110','10000','10000','10000'],
    Q: ['01110','10001','10001','10001','10101','10010','01101'],
    R: ['11110','10001','10001','11110','10100','10010','10001'],
    S: ['01111','10000','10000','01110','00001','00001','11110'],
    T: ['11111','00100','00100','00100','00100','00100','00100'],
    U: ['10001','10001','10001','10001','10001','10001','01110'],
    V: ['10001','10001','10001','10001','10001','01010','00100'],
    W: ['10001','10001','10001','10101','10101','10101','01010'],
    X: ['10001','10001','01010','00100','01010','10001','10001'],
    Y: ['10001','10001','01010','00100','00100','00100','00100'],
    Z: ['11111','00001','00010','00100','01000','10000','11111'],
    0: ['01110','10001','10011','10101','11001','10001','01110'],
    1: ['00100','01100','00100','00100','00100','00100','01110'],
    2: ['01110','10001','00001','00010','00100','01000','11111'],
    3: ['11110','00001','00001','01110','00001','00001','11110'],
    4: ['00010','00110','01010','10010','11111','00010','00010'],
    5: ['11111','10000','10000','11110','00001','00001','11110'],
    6: ['01110','10000','10000','11110','10001','10001','01110'],
    7: ['11111','00001','00010','00100','01000','01000','01000'],
    8: ['01110','10001','10001','01110','10001','10001','01110'],
    9: ['01110','10001','10001','01111','00001','00001','01110'],
  });

  function mount(host, options = {}) {
    if (!host?.ownerDocument?.createElementNS || !host?.style || !host?.appendChild) {
      throw new TypeError('PolicyConceptMotion.mount requires a DOM element.');
    }
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument;
    const view = doc.defaultView || window;
    const name = typeof options.name === 'string' && options.name.trim() ? options.name.trim() : 'Policy Lens';
    const tagline = typeof options.tagline === 'string' ? options.tagline : '決定之前，先看清楚。';
    const insurerNames = (Array.isArray(options.insurers) ? options.insurers : [])
      .map(item => typeof item === 'string' ? item : item?.name)
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => item.trim().toUpperCase());
    if (!insurerNames.length) insurerNames.push('POLICY LENS');
    // Optional presentation clock: the existing default cadence stays unchanged.
    const scan = options.scan && typeof options.scan === 'object' ? options.scan : {};
    const fieldPeriod = Number.isFinite(scan.periodMs) ? Math.max(1200, scan.periodMs) : timings.fieldPeriod;
    const iconDuration = Number.isFinite(scan.iconDurationMs) ? Math.max(timings.icons, scan.iconDurationMs) : timings.icons;
    // A presentation can take more time without repeating the reference's
    // sixteen beats. The standalone reference retains its original cadence.
    const glyphDuration = scan.quiet ? iconDuration / (timings.cycles * timings.patternCount) : timings.glyph;
    const totalDuration = iconDuration + timings.dotwordHold + timings.wordSettle;
    const fieldClock = time => scan.quiet
      ? clamp(time / fieldPeriod * timings.fieldTravel, 0, timings.fieldTravel)
      : (time % fieldPeriod) / fieldPeriod * timings.fieldTravel;
    const ownedNodes = [];
    const styleRecords = new Map();
    const attributeRecords = new Map();
    const cleanups = [];
    const autoPauses = new Set();
    let state = 'ready';
    let phase = 'name';
    let destroyed = false;
    let manualPaused = false;
    let run = null;
    let frame = null;
    let frameVersion = 0;
    let elapsed = 0;
    let lastStamp = null;
    let drawnGlyph = null;
    let removalObserver = null;
    let preference;
    try { preference = view.matchMedia?.('(prefers-reduced-motion: reduce)'); } catch {}
    const now = () => view.performance?.now?.() ?? Date.now();
    const canAnimate = typeof view.requestAnimationFrame === 'function' && typeof view.cancelAnimationFrame === 'function';

    function ownStyle(property, value) {
      value = String(value);
      const actual = host.style.getPropertyValue(property);
      let record = styleRecords.get(property);
      if (!record) {
        record = { original: actual, priority: host.style.getPropertyPriority(property), value };
        styleRecords.set(property, record);
      } else if (actual !== record.value) {
        record.original = actual;
        record.priority = host.style.getPropertyPriority(property);
      }
      if (actual !== value) host.style.setProperty(property, value);
      record.value = host.style.getPropertyValue(property);
    }

    function ownAttribute(attribute, value) {
      const actual = host.getAttribute(attribute);
      let record = attributeRecords.get(attribute);
      if (!record) {
        record = { original: actual, value };
        attributeRecords.set(attribute, record);
      } else if (actual !== record.value) record.original = actual;
      if (actual !== value) host.setAttribute(attribute, value);
      record.value = value;
    }

    function element(tag, className, parent, svg = false) {
      const node = svg ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
      node.setAttribute('class', className);
      parent.appendChild(node);
      if (parent === host) {
        node.setAttribute('aria-hidden', 'true');
        ownedNodes.push(node);
      }
      return node;
    }

    if (scan.quiet) ownAttribute('data-concept-scan', 'quiet');
    const field = element('div', 'concept-field', host);
    for (let index = 0; index < (scan.quiet ? 16 : 20); index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const block = element('div', 'concept-block', field);
      block.setAttribute('data-concept-column', String(column));
      block.setAttribute('data-concept-row', String(row));
      if (scan.quiet) block.style.setProperty('--block-at', (index * .025).toFixed(3));
      const lines = scan.quiet ? [insurerNames[index % insurerNames.length]] : [insurerNames[index % insurerNames.length], '香港', '保單條款'];
      const length = lines.reduce((sum, line) => sum + Array.from(line).length, 0);
      let characterIndex = 0;
      for (const text of lines) {
        const line = element('span', 'concept-line', block);
        for (const character of Array.from(text)) {
          const span = element('span', 'concept-char', line);
          span.textContent = character;
          const at = characterIndex / Math.max(1, length - 1) * .8 + column * .15;
          span.style.setProperty('--char-at', at.toFixed(5));
          // Quiet introductions write, then hold complete names until the
          // field fades as a whole. The legacy reference keeps its erase scan.
          span.style.setProperty('--char-end', (scan.quiet ? timings.fieldTravel + .2 : at + .55).toFixed(5));
          characterIndex += 1;
        }
      }
    }

    const symbol = element('svg', 'concept-symbol', host, true);
    symbol.setAttribute('viewBox', '0 0 720 620');
    symbol.setAttribute('fill', 'currentColor');
    symbol.setAttribute('focusable', 'false');
    const icon = element('g', 'concept-icon', symbol, true);
    const circles = [];
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const circle = element('circle', 'concept-dot', icon, true);
        circle.setAttribute('cx', String(360 + (column - 2) * 44));
        circle.setAttribute('cy', String(310 + (row - 3) * 44));
        circle.setAttribute('r', '20');
        circles.push(circle);
      }
    }
    const dotword = element('g', 'concept-dotword', symbol, true);
    let word = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    if (!word) word = 'POLICY LENS';
    const cells = [];
    let cursor = 0;
    for (const character of word) {
      if (character === ' ') { cursor += 3; continue; }
      const bitmap = alphabet[character];
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 5; column += 1) {
          if (bitmap[row][column] === '1') cells.push([cursor + column, row]);
        }
      }
      cursor += 6;
    }
    const width = Math.max(1, cursor - 1);
    const pitch = Math.min(9, 620 / (width - 1 + 7 / 9));
    const radius = pitch * 3.5 / 9;
    const wordLeft = 360 - (width - 1) * pitch / 2;
    for (const [column, row] of cells) {
      const circle = element('circle', 'concept-letter-dot', dotword, true);
      circle.setAttribute('cx', (wordLeft + column * pitch).toFixed(3));
      circle.setAttribute('cy', (310 + (row - 3) * pitch).toFixed(3));
      circle.setAttribute('r', radius.toFixed(3));
    }
    const title = element('div', 'concept-title', host);
    const titleName = element('strong', 'concept-name', title);
    titleName.setAttribute('data-concept-name', '');
    if (scan.quiet) {
      const tail = name.search(/\S+$/u);
      titleName.appendChild(doc.createTextNode(name.slice(0, tail)));
      element('span', 'concept-name-accent', titleName).textContent = name.slice(tail);
    } else titleName.textContent = name;
    const titleTagline = element('p', 'concept-tagline', title);
    titleTagline.textContent = tagline;
    const phaseLabel = element('div', 'concept-phase-label', host);
    ownAttribute('role', 'img');
    ownAttribute('aria-label', `${name}${tagline ? `. ${tagline}` : ''}`);

    function alignDotword() {
      // Inline consumers can size the SVG independently of the surrounding
      // stage. Measure its actual viewport so dots and solid type still align.
      const box = symbol.getBoundingClientRect();
      const textWidth = titleName.getBoundingClientRect().width;
      const svgScale = Math.min(box.width / 720, box.height / 620);
      const dotWidth = (width - 1) * pitch + radius * 2;
      if (!svgScale || !textWidth || !dotWidth) return;
      const scale = clamp(textWidth / (dotWidth * svgScale), .2, 2);
      dotword.setAttribute('transform', `translate(360 310) scale(${scale}) translate(-360 -310)`);
    }

    function notify() {
      if (typeof options.onPhase === 'function') {
        try { options.onPhase(phase, state); } catch {}
      }
    }

    function setStatus(nextState, nextPhase, force = false) {
      const changed = state !== nextState || phase !== nextPhase;
      state = nextState;
      phase = nextPhase;
      ownAttribute('data-concept-state', state);
      ownAttribute('data-concept-phase', phase);
      if (changed || force) notify();
    }

    function intact() {
      return host.isConnected && ownedNodes.every(node => node.parentNode === host);
    }

    function cancelFrame() {
      frameVersion += 1;
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
    }

    function stopWatchingRemoval() {
      removalObserver?.disconnect();
      removalObserver = null;
    }

    function renderReady(force = false) {
      icon.setAttribute('display', 'none');
      dotword.setAttribute('display', 'none');
      phaseLabel.textContent = '';
      drawnGlyph = null;
      ownStyle('--concept-clock', scan.quiet ? fieldClock(iconDuration).toFixed(5) : timings.fieldTravel);
      ownStyle('--concept-clarity', 1);
      if (scan.quiet) ownStyle('--concept-field-visibility', 0);
      ownAttribute('data-concept-glyph', 'name');
      setStatus('ready', 'name', force);
    }

    function renderAt(time, nextState) {
      // Complete the name field's exit during the last paper beat, before
      // the wider dotted word occupies the centre of the small viewport.
      if (scan.quiet) ownStyle('--concept-field-visibility', clamp((iconDuration - time) / glyphDuration, 0, 1).toFixed(5));
      if (time < iconDuration) {
        const beat = Math.floor(time / glyphDuration) % timings.patternCount;
        const cycle = Math.floor(time / (glyphDuration * timings.patternCount));
        const pattern = cycle % 2 === 1 && beat < alternateCurrencies.length ? alternateCurrencies[beat] : patterns[beat];
        if (drawnGlyph !== pattern.key) {
          drawnGlyph = pattern.key;
          icon.removeAttribute('display');
          dotword.setAttribute('display', 'none');
          icon.setAttribute('data-concept-glyph', pattern.key);
          ownAttribute('data-concept-glyph', pattern.key);
          for (let index = 0; index < circles.length; index += 1) {
            circles[index].setAttribute('opacity', pattern.rows[Math.floor(index / 5)][index % 5]);
          }
          phaseLabel.textContent = scan.quiet ? '貨幣 · 保障 · 保單條款' : pattern.label;
        }
        ownStyle('--concept-clarity', 0);
        ownStyle('--concept-clock', fieldClock(time).toFixed(5));
        setStatus(nextState, pattern.phase);
      } else {
        if (drawnGlyph !== 'name') {
          drawnGlyph = 'name';
          alignDotword();
          icon.setAttribute('display', 'none');
          dotword.removeAttribute('display');
          ownAttribute('data-concept-glyph', 'name');
          phaseLabel.textContent = '決定之前，先看清楚';
          ownStyle('--concept-clock', fieldClock(iconDuration).toFixed(5));
        }
        const progress = clamp((time - iconDuration - timings.dotwordHold) / timings.wordSettle, 0, 1);
        ownStyle('--concept-clarity', (scan.quiet ? progress : 1 - Math.pow(1 - progress, 3)).toFixed(5));
        setStatus(nextState, 'name');
      }
    }

    function finish() {
      if (destroyed) return;
      const finishedRun = run;
      run = null;
      cancelFrame();
      stopWatchingRemoval();
      lastStamp = null;
      elapsed = totalDuration;
      manualPaused = false;
      renderReady();
      finishedRun?.resolve();
    }

    function accrue(stamp = now()) {
      if (state === 'playing' && lastStamp !== null) elapsed += Math.max(0, stamp - lastStamp);
      lastStamp = stamp;
    }

    function schedule(job) {
      if (destroyed || run !== job || state !== 'playing' || frame !== null) return;
      const version = ++frameVersion;
      frame = view.requestAnimationFrame(stamp => {
        if (version !== frameVersion || destroyed || run !== job || state !== 'playing') return;
        frame = null;
        if (!intact()) { finish(); return; }
        accrue(Number.isFinite(stamp) ? stamp : now());
        if (elapsed >= totalDuration) { finish(); return; }
        renderAt(elapsed, 'playing');
        schedule(job);
      });
    }

    function syncPlayback() {
      if (destroyed || !run) return;
      const job = run;
      if (!intact()) { finish(); return; }
      if (preference?.matches || !canAnimate) { finish(); return; }
      const shouldPause = manualPaused || autoPauses.size > 0;
      if (shouldPause && state === 'playing') {
        accrue();
        cancelFrame();
        lastStamp = null;
        if (elapsed >= totalDuration) { finish(); return; }
        renderAt(elapsed, 'paused');
      } else if (!shouldPause && state === 'paused') {
        lastStamp = now();
        renderAt(elapsed, 'playing');
        schedule(job);
      }
    }

    function setAutoPause(reason, paused) {
      if (paused) autoPauses.add(reason);
      else autoPauses.delete(reason);
      syncPlayback();
    }

    function play() {
      if (destroyed) return Promise.resolve();
      if (run) return run.promise;
      if (preference?.matches || !canAnimate || !intact()) {
        renderReady(true);
        return Promise.resolve();
      }
      manualPaused = false;
      elapsed = 0;
      lastStamp = now();
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      const job = { promise, resolve };
      run = job;
      if (typeof view.MutationObserver === 'function' && doc.documentElement) {
        removalObserver = new view.MutationObserver(() => { if (run && !intact()) finish(); });
        removalObserver.observe(doc.documentElement, { childList: true, subtree: true });
      }
      renderAt(0, autoPauses.size ? 'paused' : 'playing');
      schedule(job);
      return promise;
    }

    function pause() {
      manualPaused = true;
      syncPlayback();
    }

    function resume() {
      manualPaused = false;
      syncPlayback();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const oldRun = run;
      run = null;
      cancelFrame();
      stopWatchingRemoval();
      for (const cleanup of cleanups) { try { cleanup(); } catch {} }
      for (const node of ownedNodes) node.remove();
      for (const [property, record] of styleRecords) {
        if (host.style.getPropertyValue(property) !== record.value) continue;
        if (record.original) host.style.setProperty(property, record.original, record.priority);
        else host.style.removeProperty(property);
      }
      for (const [attribute, record] of attributeRecords) {
        if (host.getAttribute(attribute) !== record.value) continue;
        if (record.original === null) host.removeAttribute(attribute);
        else host.setAttribute(attribute, record.original);
      }
      if (mounts.get(host) === controller) mounts.delete(host);
      state = 'destroyed';
      oldRun?.resolve();
    }

    const controller = Object.freeze({ play, pause, resume, finish, destroy,
      get state() { return state; }, get phase() { return phase; } });
    mounts.set(host, controller);

    const visibilityChanged = () => setAutoPause('hidden', doc.hidden);
    view.addEventListener('resize', alignDotword);
    cleanups.push(() => view.removeEventListener('resize', alignDotword));
    if (doc.hidden) autoPauses.add('hidden');
    doc.addEventListener('visibilitychange', visibilityChanged);
    cleanups.push(() => doc.removeEventListener('visibilitychange', visibilityChanged));
    if (typeof view.IntersectionObserver === 'function') {
      const observer = new view.IntersectionObserver(entries => {
        if (destroyed) return;
        const entry = entries.find(item => item.target === host);
        if (entry) setAutoPause('offscreen', !entry.isIntersecting);
      }, { threshold: 0 });
      observer.observe(host);
      cleanups.push(() => observer.disconnect());
    } else {
      // A lightweight fallback for older browsers. Zero-sized synthetic DOM
      // geometry is unknown rather than evidence that a host is offscreen.
      const checkViewport = () => {
        const rect = host.getBoundingClientRect();
        const height = view.innerHeight || doc.documentElement.clientHeight;
        const width = view.innerWidth || doc.documentElement.clientWidth;
        const outside = rect.width > 0 && rect.height > 0 && height > 0 && width > 0 &&
          (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width);
        setAutoPause('offscreen', outside);
      };
      checkViewport();
      view.addEventListener('scroll', checkViewport, { passive: true, capture: true });
      view.addEventListener('resize', checkViewport, { passive: true });
      cleanups.push(() => view.removeEventListener('scroll', checkViewport, true));
      cleanups.push(() => view.removeEventListener('resize', checkViewport));
    }
    const preferenceChanged = event => { if (event.matches && !destroyed) finish(); };
    if (preference?.addEventListener) {
      preference.addEventListener('change', preferenceChanged);
      cleanups.push(() => preference.removeEventListener('change', preferenceChanged));
    } else if (preference?.addListener) {
      preference.addListener(preferenceChanged);
      cleanups.push(() => preference.removeListener(preferenceChanged));
    }

    renderReady();
    if (options.autoplay !== false) play();
    else notify();
    return controller;
  }

  window.PolicyConceptMotion = Object.freeze({ mount, timings });
})();
