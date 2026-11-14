/*
 * Parse: the document is scanned; every streamed finding highlights its
 * source line on the paper and flies into the summary list.
 * Includes the 5x7 dot-matrix Agent thinking indicator (from concept-motion)
 * and the 4-color spectral completion wash (from completion-motion).
 */
(() => {
  const PL = window.PL;
  const { h } = PL;
  const KEYS = ['covers', 'excludes', 'max', 'when', 'docs', 'unclear'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let run = 0; // cancels a stale run when the screen is left

  const norm = (s) => String(s || '').replace(/\s+/g, '');

  /* ---------- 5x7 dot-matrix glyph patterns (ported from bu-v2 concept-motion.js) ---------- */
  const DOT_PATTERNS = Object.fromEntries([
    { key: 'paper', rows: ['11110', '10011', '10001', '10101', '10001', '10101', '11111'] },
    { key: 'shield', rows: ['11111', '10001', '10001', '10001', '01010', '01010', '00100'] },
    { key: 'dollar', rows: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'] },
    { key: 'yen', rows: ['10001', '01010', '00100', '11111', '00100', '11111', '00100'] },
  ].map((p) => [
    p.key,
    p.rows.flatMap((row, y) =>
      [...row].map((cell, x) => (cell === '1'
        ? `M${52 + x * 44},${34 + y * 44}a14,14 0 1,0 28,0a14,14 0 1,0 -28,0`
        : ''))).join(' '),
  ]));

  function createDotIndicator() {
    const badge = h('div', { class: 'agent-dot-badge', 'data-phase': 'paper', 'aria-hidden': 'true' });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 340');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', DOT_PATTERNS.paper);
    svg.appendChild(path);
    badge.appendChild(svg);

    let currentPhase = 'paper';
    let currencyToggle = false;
    let pulseTimer = null;

    function setGlyph(phase) {
      const normalized = phase === 'shield' ? 'shield' : phase === 'currency' ? 'currency' : 'paper';
      badge.setAttribute('data-phase', normalized);
      let key = normalized;
      if (normalized === 'currency') {
        currencyToggle = !currencyToggle;
        key = currencyToggle ? 'dollar' : 'yen';
      }
      const nextD = DOT_PATTERNS[key] || DOT_PATTERNS.paper;
      path.setAttribute('d', nextD);
      if (!PL.reduced && typeof svg.animate === 'function') {
        try {
          svg.animate(
            [
              { opacity: 0.25, transform: 'translateY(4px) scale(0.92)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
          );
        } catch {}
      }
      currentPhase = normalized;
    }

    function startIdleCycle() {
      stopIdleCycle();
      if (PL.reduced) return;
      const cycle = ['paper', 'shield', 'currency'];
      let idx = 0;
      pulseTimer = window.setInterval(() => {
        idx = (idx + 1) % cycle.length;
        setGlyph(cycle[idx]);
      }, 1350);
    }

    function stopIdleCycle() {
      if (pulseTimer) {
        clearInterval(pulseTimer);
        pulseTimer = null;
      }
    }

    return {
      el: badge,
      setPhase(phase) {
        if (phase && phase !== currentPhase) setGlyph(phase);
        else if (phase === 'currency') setGlyph('currency');
      },
      startIdleCycle,
      stop: stopIdleCycle,
    };
  }

  /* ---------- 4-color spectral completion wash (ported from bu-v2 completion-motion.js) ---------- */
  function playCompletionWash(host) {
    if (!host || PL.reduced || typeof host.animate !== 'function') return;
    const height = host.clientHeight || host.getBoundingClientRect().height || 300;
    const wave = h('div', { class: 'completion-wave', 'aria-hidden': 'true' });
    const glow = h('div', { class: 'completion-wave-glow', 'aria-hidden': 'true' });
    host.append(wave, glow);

    const sweepFrames = [
      { transform: `translateY(${-height * 0.55}px)`, opacity: 0, offset: 0 },
      { transform: `translateY(${-height * 0.28}px)`, opacity: 0.72, offset: 0.18 },
      { transform: `translateY(${height * 0.32}px)`, opacity: 0.78, offset: 0.55 },
      { transform: `translateY(${height * 0.75}px)`, opacity: 0.5, offset: 0.82 },
      { transform: `translateY(${height * 1.1}px)`, opacity: 0, offset: 1 },
    ];
    const glowFrames = sweepFrames.map((f) => ({ ...f, opacity: f.opacity * 0.58 }));

    try {
      const a1 = wave.animate(sweepFrames, { duration: 1250, easing: 'linear', fill: 'both' });
      const a2 = glow.animate(glowFrames, { duration: 1250, easing: 'linear', fill: 'both' });
      Promise.allSettled([a1.finished, a2.finished]).then(() => {
        wave.remove();
        glow.remove();
      });
    } catch {
      wave.remove();
      glow.remove();
    }
  }

  /** Render either a real document's extracted pages/sources or a sample policy's sections. */
  function docView(p, realDoc) {
    if (realDoc?.pages?.length) {
      return h('div', { class: 'doc' },
        h('p', { class: 'doc-title' }, PL.tx(realDoc.title || realDoc.name || p?.name)),
        ...realDoc.pages.map((pg) => {
          const items = pg.sources?.length
            ? pg.sources.map((src) => h('p', { class: 'doc-line', 'data-source-id': src.sourceId, 'data-page': pg.pageIndex }, src.quote))
            : (pg.text ? [h('p', { class: 'doc-line', 'data-page': pg.pageIndex }, pg.text)] : []);
          return h('div', { class: 'doc-sec', 'data-page-sec': pg.pageIndex },
            h('div', { class: 'doc-sec-head' },
              h('b', {}, pg.printedPageLabel || PL.t(`PDF 第 ${pg.pageIndex} 頁`, `PDF page ${pg.pageIndex}`)),
              h('span', {}, PL.t(`第 ${pg.pageIndex} 頁`, `p.${pg.pageIndex}`))),
            ...items);
        }));
    }
    return h('div', { class: 'doc' },
      h('p', { class: 'doc-title' }, PL.tx(p.document.title)),
      ...p.document.sections.map((s) =>
        h('div', { class: `doc-sec ${s.table ? 'is-table' : ''}` },
          h('div', { class: 'doc-sec-head' },
            h('b', {}, s.no ? `§${s.no}  ${PL.tx(s.heading)}` : PL.tx(s.heading)),
            h('span', {}, PL.t(`第 ${s.page} 頁`, `p.${s.page}`))),
          ...s.lines.map((l) => h('p', { class: 'doc-line', 'data-line': l.id }, h('span', { class: 'mark' }, PL.tx(l.text)))))));
  }

  /**
   * Wrap the exact substring matching `quote` (ignoring whitespace differences)
   * inside `line` with `<span class="mark is-on">`, or activate the whole line's mark
   * if the quote covers the entire line.
   */
  function highlightQuote(line, rawQuote, extraClass = '') {
    if (!line) return null;
    const q = norm(PL.tx(rawQuote));
    const fullNorm = norm(line.textContent);
    if (extraClass) line.classList.add(extraClass);

    const wholeMark = line.children.length === 1 && line.firstElementChild?.classList.contains('mark')
      ? line.firstElementChild
      : null;

    if (!q || q === fullNorm) {
      if (wholeMark) {
        wholeMark.classList.add('is-on');
        return wholeMark;
      }
      const span = h('span', { class: 'mark is-on' }, line.textContent);
      line.replaceChildren(span);
      return span;
    }

    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const map = [];
    let normStr = '';
    let tNode;
    while ((tNode = walker.nextNode())) {
      const txt = tNode.nodeValue || '';
      for (let i = 0; i < txt.length; i += 1) {
        if (!/\s/.test(txt[i])) {
          map.push({ node: tNode, offset: i });
          normStr += txt[i];
        }
      }
    }

    const idx = normStr.indexOf(q);
    if (idx === -1) {
      if (wholeMark) {
        wholeMark.classList.add('is-on');
        return wholeMark;
      }
      return line;
    }

    const first = map[idx];
    const last = map[idx + q.length - 1];
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);

    if (wholeMark && !wholeMark.classList.contains('is-on')) {
      const rawText = wholeMark.textContent || '';
      const textNode = document.createTextNode(rawText);
      line.replaceChildren(textNode);
      return highlightQuote(line, rawQuote, extraClass);
    }

    const mark = h('span', { class: 'mark is-on' });
    mark.append(range.extractContents());
    range.insertNode(mark);
    return mark;
  }

  function render() {
    const p = PL.policy();
    const stateDoc = PL.getState().document;
    const myRun = ++run;
    let controller = new AbortController();
    let stopped = false;
    const scroller = h('div', { class: 'paper-scroll' }, docView(p, stateDoc?.pages ? stateDoc : null));
    const scanner = h('div', { class: 'scanner', 'aria-hidden': 'true' });
    const paper = h('div', { class: 'paper', 'data-a': '' }, scroller, scanner);

    const dotIndicator = createDotIndicator();
    const status = h('p', { class: 'parse-status', 'aria-live': 'polite' });
    const statusRow = h('div', { class: 'parse-status-row' }, dotIndicator.el, status);

    const barFill = h('span');
    const bar = h('div', { class: 'parse-bar' }, barFill);

    /* Three visible stages + elapsed time, so the wait never looks frozen. */
    const STAGES = [
      ['read', PL.t('讀保單', 'Open policy')],
      ['search', PL.t('查關鍵條款', 'Find key clauses')],
      ['write', PL.t('寫白話結論', 'Write it up')],
    ];
    const stageEls = STAGES.map(([id, label], i) =>
      h('li', { class: 'parse-phase', 'data-stage': id }, h('b', {}, String(i + 1)), h('span', {}, label)));
    const elapsedEl = h('span', { class: 'parse-elapsed' }, '');
    const phases = h('div', { class: 'parse-phases' }, h('ol', {}, ...stageEls), elapsedEl);
    /* Live reading log: what the agent is looking at right now. */
    const feed = h('ul', { class: 'parse-feed', 'aria-live': 'off' });
    const slots = KEYS.map((k) =>
      h('li', { class: 'slot', 'data-key': k },
        h('span', { class: 'slot-label' }, PL.ui(`summaryKeys.${k}`)),
        h('span', { class: 'slot-answer' })));
    const slotsWrap = h('div', { class: 'parse-slots-wrap' }, h('ul', { class: 'slots' }, ...slots));

    const gapCount = h('strong', {}, '0');
    const scCount = h('strong', {}, '0');
    const cta = h('button', { type: 'button', class: 'btn primary parse-cta', disabled: true, onclick: () => PL.go('overview') },
      PL.t('看一頁總結', 'See the summary'), h('span', { class: 'arrow' }, '→'));
    const retryBtn = h('button', { type: 'button', class: 'btn primary parse-retry', onclick: () => { void start(); } },
      PL.t('重試解讀', 'Retry'));
    const backBtn = h('button', { type: 'button', class: 'btn quiet parse-back', onclick: () => PL.go(stateDoc ? 'document' : 'home') },
      PL.t('返回重選', 'Back'));
    const errActions = h('div', { class: 'parse-error-actions', hidden: true, style: 'display:none; gap:10px; margin-top:12px;' }, retryBtn, backBtn);
    const stopBtn = h('button', { type: 'button', class: 'btn quiet parse-stop', hidden: true, onclick: () => { stopped = true; controller.abort(); } },
      h('span', { class: 'parse-stop-icon', 'aria-hidden': 'true' }), PL.t('停止解讀', 'Stop'));

    const titleEl = h('h2', { class: 'parse-title' }, PL.policyTitle());
    const panel = h('aside', { class: 'parse-panel', 'data-a': '' },
      h('p', { class: 'eyebrow' }, PL.t('第 2 步 · 解讀', 'Step 2 · Reading')),
      titleEl,
      statusRow,
      phases,
      bar,
      feed,
      slotsWrap,
      h('div', { class: 'parse-stats' },
        h('p', {}, gapCount, h('span', {}, PL.t('個容易看錯的數字', 'number people misread'))),
        h('p', {}, scCount, h('span', {}, PL.t('個邊界場景', 'edge cases found')))),
      cta,
      stopBtn,
      errActions);

    const el = h('section', { class: 'screen parse' }, paper, panel);

    const setStatus = (t) => {
      if (status.textContent === t) return;
      status.textContent = t;
      if (!PL.reduced && typeof status.animate === 'function') {
        try {
          status.animate(
            [{ opacity: 0.35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 220, easing: 'ease-out' },
          );
        } catch {}
      }
    };
    let progress = 0;
    const setProgress = (x) => { progress = Math.max(progress, x); barFill.style.width = `${Math.round(progress * 100)}%`; };

    let stage = 'read';
    const STAGE_CAP = { read: 0.14, search: 0.48, write: 0.97 };
    const setStage = (next) => {
      const order = STAGES.map(([id]) => id);
      if (order.indexOf(next) < order.indexOf(stage)) return;
      stage = next;
      stageEls.forEach((li) => {
        const i = order.indexOf(li.dataset.stage);
        li.classList.toggle('is-done', i < order.indexOf(stage));
        li.classList.toggle('is-active', i === order.indexOf(stage));
      });
      if (next === 'write') markWritingSlot();
    };

    let ticker = null;
    let startedAt = 0;
    const startTicker = () => {
      stopTicker();
      startedAt = Date.now();
      ticker = setInterval(() => {
        if (!el.isConnected) { stopTicker(); return; }
        elapsedEl.textContent = PL.t(`已用 ${Math.round((Date.now() - startedAt) / 1000)} 秒`, `${Math.round((Date.now() - startedAt) / 1000)}s`);
        // Creep toward the current stage's cap so the bar never sits still.
        const cap = STAGE_CAP[stage];
        if (progress < cap) setProgress(progress + (cap - progress) * 0.035);
      }, 250);
    };
    const stopTicker = () => { if (ticker) clearInterval(ticker); ticker = null; };

    const pushFeed = (text, kind) => {
      if (!text) return;
      const item = h('li', { class: `parse-feed-item is-${kind}` }, text);
      feed.prepend(item);
      while (feed.children.length > 3) feed.lastElementChild.remove();
      [...feed.children].forEach((n, i) => { n.style.opacity = String(1 - i * 0.3); });
      if (!PL.reduced && typeof item.animate === 'function') {
        try { item.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); } catch {}
      }
    };

    const markWritingSlot = () => {
      slots.forEach((s) => s.classList.remove('is-writing'));
      if (stage !== 'write') return;
      const next = slots.find((s) => !s.classList.contains('is-filled'));
      if (next) next.classList.add('is-writing');
    };

    const clearReadingPeek = () => {
      PL.$$('.doc-line.is-reading', el).forEach((n) => n.classList.remove('is-reading'));
    };

    const lineEl = (ev) => {
      if (!ev) return null;
      if (ev.lineId) {
        const byLine = PL.$(`.doc-line[data-line="${ev.lineId}"]`, el);
        if (byLine) return byLine;
      }
      if (ev.sourceId) {
        const bySrc = PL.$(`.doc-line[data-source-id="${ev.sourceId}"]`, el);
        if (bySrc) return bySrc;
      }
      const q = norm(PL.tx(ev.quote));
      if (!q) return null;
      const candidates = ev.page ? PL.$$(`.doc-line[data-page="${ev.page}"]`, el) : [];
      const pool = candidates.length ? [...candidates, ...PL.$$('.doc-line', el)] : PL.$$('.doc-line', el);
      return pool.find((n) => norm(n.textContent).includes(q)) || null;
    };

    const fillSlot = (ev, { type = false } = {}) => {
      const slot = PL.$(`.slot[data-key="${ev.key}"]`, el);
      if (!slot) return null;
      slot.classList.remove('is-writing');
      slot.classList.add('is-filled');
      const target = PL.$('.slot-answer', slot);
      const text = PL.tx(ev.answer) || '';
      if (type && !PL.reduced) {
        // Typewriter: whole answer in at most ~0.6s.
        const step = Math.max(1, Math.ceil(text.length / 30));
        let i = 0;
        target.textContent = '';
        const tick = () => {
          if (myRun !== run) return;
          i = Math.min(text.length, i + step);
          target.textContent = text.slice(0, i);
          if (i < text.length) setTimeout(tick, 20);
        };
        tick();
      } else {
        target.textContent = text;
      }
      markWritingSlot();
      return slot;
    };

    /* ---------- instant (already analysed) ---------- */
    function showDone(a) {
      dotIndicator.stop();
      clearReadingPeek();
      a.findings.forEach((ev) => {
        fillSlot(ev);
        const line = lineEl(ev);
        if (line) highlightQuote(line, ev.quote);
      });
      if (a.gap) {
        for (const q of [a.gap.table, a.gap.detail]) {
          const line = q && lineEl(q);
          if (line) highlightQuote(line, q.quote, 'is-gap');
        }
      }
      gapCount.textContent = a.gap ? '1' : '0';
      scCount.textContent = String(a.scenarios.length);
      setStatus(PL.t('解讀完成', 'Done reading'));
      stopBtn.hidden = true;
      stopTicker();
      setStage('write');
      stageEls.forEach((li) => { li.classList.remove('is-active'); li.classList.add('is-done'); });
      slots.forEach((s) => s.classList.remove('is-writing'));
      feed.replaceChildren();
      setProgress(1);
      scanner.hidden = true;
      errActions.hidden = true;
      errActions.style.display = 'none';
      cta.hidden = false;
      cta.disabled = false;
      el.classList.remove('is-error');
      el.classList.add('is-done');
    }

    function showFailed(message, { quiet = false } = {}) {
      stopBtn.hidden = true;
      stopTicker();
      slots.forEach((s) => s.classList.remove('is-writing'));
      stageEls.forEach((li) => li.classList.remove('is-active'));
      dotIndicator.stop();
      clearReadingPeek();
      scanner.hidden = true;
      if (window.gsap) gsap.killTweensOf(scanner);
      setStatus(message || PL.t('解讀失敗，請再試一次。', 'Reading failed — please try again.'));
      barFill.style.background = quiet ? 'var(--muted)' : 'var(--st-excluded, #d64545)';
      cta.disabled = true;
      cta.hidden = true;
      errActions.hidden = false;
      errActions.style.display = 'flex';
      el.classList.remove('is-done');
      el.classList.add('is-error');
    }

    /* ---------- animated steps ---------- */
    async function scrollTo(target, fast = false) {
      if (!target) return;
      const top = target.offsetTop - scroller.clientHeight * 0.35;
      if (window.gsap && !PL.reduced) await gsap.to(scroller, { scrollTop: Math.max(0, top), duration: fast ? 0.25 : 0.45, ease: 'power2.inOut' });
      else scroller.scrollTop = Math.max(0, top);
    }

    function handleThinking(ev, thinkingCount) {
      if (ev.phase) dotIndicator.setPhase(ev.phase);
      if (ev.message) setStatus(PL.tx(ev.message));
      if (ev.stage === 'write') setStage('write');
      else if (ev.tool) setStage('search');
      if (stage === 'search') setProgress(Math.min(STAGE_CAP.search, 0.14 + thinkingCount * 0.03));
      if (ev.tool === 'readSource' && ev.page && ev.snippet) {
        pushFeed(PL.t(`第 ${ev.page} 頁 · 「${ev.snippet}…」`, `p.${ev.page} · “${ev.snippet}…”`), 'read');
      } else if (ev.tool === 'searchSources' && ev.query) {
        pushFeed(PL.t(`搜尋「${ev.query}」· 找到 ${ev.hits || 0} 段`, `Search “${ev.query}” · ${ev.hits || 0} hits`), 'search');
      }

      const target = (ev.sourceId && PL.$(`.doc-line[data-source-id="${ev.sourceId}"]`, el))
        || (ev.page && PL.$(`[data-page-sec="${ev.page}"], .doc-line[data-page="${ev.page}"]`, el));
      if (target) {
        clearReadingPeek();
        if (target.classList.contains('doc-line')) target.classList.add('is-reading');
        const top = target.offsetTop - scroller.clientHeight * 0.32;
        if (window.gsap && !PL.reduced) {
          gsap.to(scroller, { scrollTop: Math.max(0, top), duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
          gsap.to(scanner, { top: Math.min(scroller.clientHeight - 24, Math.max(32, scroller.clientHeight * 0.35)), duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
        } else {
          scroller.scrollTop = Math.max(0, top);
        }
      }
    }

    async function playFinding(ev, backlog = 0) {
      const fast = backlog > 0; // more results are already waiting: keep up with the stream
      clearReadingPeek();
      dotIndicator.setPhase(ev.key === 'excludes' ? 'shield' : ev.key === 'max' ? 'currency' : 'paper');
      const line = lineEl(ev);
      if (!line) { fillSlot(ev, { type: true }); return; }
      const refText = ev.section ? `§${PL.tx(ev.section)}` : (ev.page ? PL.t(`第 ${ev.page} 頁`, `p.${ev.page}`) : PL.t('保障表', 'the schedule'));
      setStatus(PL.t(`正在標記 ${refText} …`, `Highlighting ${refText} …`));
      await scrollTo(line, fast);
      if (myRun !== run) return;
      const mark = highlightQuote(line, ev.quote) || line;
      if (window.gsap && !PL.reduced) gsap.to(scanner, { top: line.offsetTop - scroller.scrollTop + line.offsetHeight / 2, duration: 0.32, ease: 'power2.out' });
      await PL.wait(PL.reduced ? 0 : fast ? 120 : 320);
      if (myRun !== run) return;
      const slotEl = PL.$(`.slot[data-key="${ev.key}"]`, el);
      if (slotEl) {
        flyTo(mark, slotEl, PL.tx(ev.answer)).then(() => {
          if (myRun !== run) return;
          const slot = fillSlot(ev, { type: true });
          if (slot && window.gsap && !PL.reduced) gsap.fromTo(slot, { backgroundColor: 'rgba(255,224,102,.9)' }, { backgroundColor: 'rgba(255,224,102,0)', duration: 1.1 });
        });
      }
      await PL.wait(PL.reduced ? 0 : fast ? 150 : 400);
    }

    async function flyTo(fromEl, toEl, text) {
      if (!window.gsap || PL.reduced) return;
      const a = fromEl.getBoundingClientRect();
      const b = PL.$('.slot-answer', toEl).getBoundingClientRect();
      const chip = h('div', { class: 'fly', style: `left:${a.left}px;top:${a.top}px` }, text);
      document.body.append(chip);
      await gsap.timeline()
        .fromTo(chip, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2)' })
        .to(chip, { left: b.left, top: b.top - 4, duration: 0.52, ease: 'power3.inOut' })
        .to(chip, { opacity: 0, scale: 0.9, duration: 0.18 });
      chip.remove();
    }

    async function playGap(ev) {
      clearReadingPeek();
      dotIndicator.setPhase('currency');
      setStatus(PL.t('核對表面大數字與細則限制 …', 'Checking headline number vs fine print …'));
      for (const q of [ev.table, ev.detail]) {
        const line = q && lineEl(q);
        if (!line) continue;
        await scrollTo(line);
        highlightQuote(line, q.quote, 'is-gap');
        await PL.wait(PL.reduced ? 0 : 420);
      }
      gapCount.textContent = '1';
      if (window.gsap && !PL.reduced) gsap.fromTo(gapCount, { scale: 1.8 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    }

    async function start() {
      controller.abort();
      controller = new AbortController();
      stopped = false;
      stopBtn.hidden = !stateDoc;
      const resume = Boolean(stateDoc && PL.getState().prevAnalysis);
      el.classList.remove('is-error', 'is-done');
      errActions.hidden = true;
      errActions.style.display = 'none';
      cta.hidden = false;
      cta.disabled = true;
      scanner.hidden = false;
      barFill.style.background = '';
      slots.forEach((s) => { s.classList.remove('is-filled'); PL.$('.slot-answer', s).textContent = ''; });
      gapCount.textContent = '0';
      scCount.textContent = '0';
      progress = 0;
      barFill.style.width = '0%';
      stage = 'read';
      setStage('read');
      feed.replaceChildren();
      slots.forEach((s) => s.classList.remove('is-writing'));
      elapsedEl.textContent = '';
      startTicker();

      PL.setState({ busy: true, analysis: null });
      dotIndicator.setPhase('paper');
      dotIndicator.startIdleCycle();
      setStatus(resume ? PL.t('正在用新材料續查 …', 'Following up with the new materials …') : PL.t('正在打開保單原文 …', 'Opening your policy …'));
      setProgress(0.05);
      const acc = { findings: [], gap: null, scenarios: [], requests: [], revision: null };
      const queue = [];
      let streamDone = false;
      let failedError = null;
      let sawDone = false;
      let wake = null;
      let thinkingCount = 0;
      const push = (fn) => { queue.push(fn); wake?.(); };

      if (window.gsap && !PL.reduced) gsap.fromTo(scanner, { top: 24 }, { top: '88%', duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      // Producer: read the stream as fast as it arrives.
      (async () => {
        try {
          for await (const ev of PL.api.analyze(stateDoc?.reviewId || p.id, { signal: controller.signal, resume })) {
            if (myRun !== run) return;
            if (ev.type === 'error') {
              throw new Error(PL.tx(ev.message) || PL.t('解讀失敗，請再試一次。', 'Reading failed — please try again.'));
            }
            if (ev.type === 'document') {
              if (ev.title) {
                if (stateDoc) PL.setState({ document: { ...PL.getState().document, title: PL.tx(ev.title), ...(ev.pages?.length ? { pages: ev.pages } : {}) } });
                titleEl.textContent = stateDoc ? PL.policyTitle() : PL.tx(ev.title);
              }
              if (ev.pages?.length) scroller.replaceChildren(docView(p, ev));
            } else if (ev.type === 'thinking') {
              dotIndicator.stop(); // switch from idle cycle to real live telemetry
              thinkingCount += 1;
              handleThinking(ev, thinkingCount);
            } else if (ev.type === 'progress' && ev.message) {
              setStatus(PL.tx(ev.message));
            } else if (ev.type === 'finding') {
              dotIndicator.stop();
              if (window.gsap) gsap.killTweensOf(scanner);
              acc.findings.push(ev);
              setStage('write');
              push(() => playFinding(ev, queue.length));
            } else if (ev.type === 'gap') {
              acc.gap = ev;
              push(() => playGap(ev));
            } else if (ev.type === 'scenario') {
              acc.scenarios.push(ev);
              setStage('write');
              const n = acc.scenarios.length;
              push(async () => {
                scCount.textContent = String(n);
                pushFeed(PL.t(`場景 ${n}：${PL.tx(ev.title)}`, `Case ${n}: ${PL.tx(ev.title)}`), 'scenario');
                if (window.gsap && !PL.reduced) gsap.fromTo(scCount, { scale: 1.6 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
                await PL.wait(PL.reduced ? 0 : 120);
              });
            } else if (ev.type === 'requests') {
              acc.requests = Array.isArray(ev.items) ? ev.items : [];
              acc.revision = ev.revision ?? null;
              acc.contractDocs = Array.isArray(ev.contractDocs) ? ev.contractDocs : null;
            } else if (ev.type === 'done') {
              sawDone = true;
            }
          }
          // A real backend stream that closes without `done` was cut off — never show it as finished.
          if (myRun === run && stateDoc && !sawDone) {
            throw new Error(PL.t('解讀中斷，請重試。', 'Analysis interrupted. Please retry.'));
          }
        } catch (err) {
          if (err?.name === 'AbortError' || myRun !== run) return;
          console.error('[parse] analysis stream failed', err);
          failedError = err;
          queue.length = 0;
        } finally {
          streamDone = true;
          wake?.();
        }
      })();

      // Consumer: play one beat at a time.
      const isSample = !stateDoc && p?.analysis;
      const total = isSample ? (p.analysis.summary.length + 1 + p.analysis.scenarios.length) : 11;
      const baseProgress = isSample ? 0.04 : 0.45;
      let doneBeats = 0;
      while (myRun === run) {
        if (failedError) break;
        if (!queue.length) {
          if (streamDone) break;
          await new Promise((r) => { wake = r; });
          wake = null;
          continue;
        }
        await queue.shift()();
        doneBeats += 1;
        setProgress(Math.min(0.98, Math.max(progress, baseProgress + (doneBeats / total) * (1 - baseProgress))));
      }
      if (myRun !== run) return;

      if (stopped) {
        PL.setState({ busy: false, analysis: null });
        showFailed(PL.t('已停止解讀。可以重新開始，或返回修改。', 'Stopped. Start again or go back.'), { quiet: true });
        return;
      }

      if (failedError) {
        PL.setState({ busy: false, analysis: null });
        const customMsg = failedError?.message && !/^Analysis failed/i.test(failedError.message)
          ? failedError.message
          : PL.t('解讀失敗，請再試一次。', 'Reading failed — please try again.');
        showFailed(customMsg);
        return;
      }

      PL.setState({ busy: false, analysis: acc, analysisRevision: acc.revision ?? PL.getState().materialsRevision });
      showDone(acc);
      playCompletionWash(slotsWrap);
      if (window.gsap && !PL.reduced) gsap.fromTo(cta, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
    }

    function enter() {
      const a = PL.getState().analysis;
      if (a) showDone(a);
      else void start();
    }

    /** Remember slot positions so the overview cards can grow out of them. */
    function beforeLeave() {
      PL.flip = Object.fromEntries(slots.map((s) => [s.dataset.key, s.getBoundingClientRect()]));
    }

    return {
      el,
      enter,
      beforeLeave,
      destroy: () => {
        stopTicker();
        dotIndicator.stop();
        controller.abort();
      },
    };
  }

  PL.screens.parse = {
    render,
    destroy: () => { run += 1; if (PL.getState().busy) PL.setState({ busy: false }); },
  };
})();
