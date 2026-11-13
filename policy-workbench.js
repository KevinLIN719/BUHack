/* Composite owns selection, inline wording/notes and the independent pull clone. */
(function (global) {
  'use strict';
  const mounts = new WeakMap(); let serial = 0;
  const labels = Object.freeze({ 1: '首要', 2: '重要', 3: '待確認', 4: '參考' });
  function mount(host, options = {}) {
    if (!host || !host.ownerDocument) throw new TypeError('PolicyWorkbench.mount needs a DOM host.');
    if (!global.PolicyDeck || !global.PolicyPull) throw new Error('Load policy-deck.js and policy-pull.js before the workbench.');
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument, win = doc.defaultView, items = Array.from(options.items || global.PolicyFixtures?.items || []);
    const surfaces = global.PolicySurfaceMotion?.mount(doc);
    const byId = new Map();
    items.forEach(item => {
      if (!item || !item.id || byId.has(item.id) || !Array.isArray(item.findings) || typeof item.excerpt !== 'string') throw new TypeError('PolicyWorkbench requires unique policy ids, excerpt and findings.');
      if (item.findings.some(f => ![1,2,3,4].includes(f.priority) || !f.quote || !item.excerpt.includes(f.quote))) throw new TypeError('Each finding needs priority 1–4 and a quote contained in its policy excerpt.');
      byId.set(item.id, item);
    });
    let dead = false, open = items.length > 0, selected = items[0]?.id || null, detailId = null, version = 0, inspecting = false;
    const root = doc.createElement('div'); root.className = 'pw-root'; root.dataset.policyWorkbench = ''; root.dataset.detailOpen = String(open);
    const layout = doc.createElement('div'); layout.className = 'pw-layout';
    const deckHost = doc.createElement('div'); deckHost.className = 'pw-deck'; deckHost.dataset.policyDeckHost = '';
    const detail = doc.createElement('section'); detail.className = 'pw-detail'; detail.dataset.policyDetail = ''; detail.id = 'pw-detail-' + (++serial); detail.setAttribute('aria-label', '保單條款與閱讀筆記');
    const placeholder = doc.createElement('p'); placeholder.className = 'pw-placeholder'; placeholder.textContent = '打開保單查看筆記。';
    const overlay = doc.createElement('div'); overlay.className = 'pw-pull-overlay'; overlay.dataset.policyPullOverlay = ''; overlay.setAttribute('aria-hidden', 'true');
    const status = doc.createElement('p'); status.className = 'pw-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    layout.append(deckHost, detail); root.append(layout, placeholder, status, overlay); host.append(root);
    const make = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const pull = global.PolicyPull.mount(overlay, { token: options.pullToken || 'shield', onState(state, info) { root.dataset.pullState = state; if (state === 'idle' && info.id === selected) root.dataset.pullState = 'idle'; } });
    const arrivalProperties = ['--pw-arrival','--pw-heading-ink','--pw-copy-ink','--pw-note-ink','--pw-loading-ink'];
    const ink = (progress,start,end) => {
      const p=Math.max(0,Math.min(1,(progress-start)/(end-start)));
      return p*p*p*(p*(p*6-15)+10);
    };
    let settling = 0;
    function clearArrival() {
      if (settling) { win.cancelAnimationFrame(settling); settling = 0; }
      detail.removeAttribute('data-detail-motion');
      detail.removeAttribute('aria-busy');
      arrivalProperties.forEach(property=>detail.style.removeProperty(property));
      detail.querySelectorAll('.pw-finding').forEach(row=>row.style.removeProperty('--pw-ink'));
    }
    // Interrupted arrivals ease the remaining ink in from its current value.
    function settleArrival() {
      if (!detail.hasAttribute('data-detail-motion')) { confirmOpen(); return; }
      if (settling) win.cancelAnimationFrame(settling);
      const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const read = (node, name) => Number.parseFloat(node.style.getPropertyValue(name)) || 0;
      const groups = ['--pw-heading-ink','--pw-copy-ink','--pw-note-ink'].map(name => [detail, name, read(detail, name)]);
      Array.from(detail.querySelectorAll('.pw-finding')).forEach(row => groups.push([row, '--pw-ink', read(row, '--pw-ink')]));
      const loading = read(detail, '--pw-loading-ink');
      if (reduced || !win.requestAnimationFrame) { clearArrival(); confirmOpen(); return; }
      detail.dataset.detailMotion = 'arriving';
      let started = null;
      const step = time => {
        if (started === null) started = time;
        const p = Math.min(1, (time - started) / 280), e = 1 - Math.pow(1 - p, 3);
        groups.forEach(([node, name, from]) => node.style.setProperty(name, String(from + (1 - from) * e)));
        detail.style.setProperty('--pw-loading-ink', String(loading * (1 - e)));
        if (p < 1) settling = win.requestAnimationFrame(step);
        else { settling = 0; clearArrival(); confirmOpen(); }
      };
      settling = win.requestAnimationFrame(step);
    }
    // Outgoing notes fade as an inert snapshot over the incoming ones, so a
    // new pull never starts with the reading column snapping to blank.
    function snapshotDetail() {
      if (detail.hidden || !detail.firstChild || win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return null;
      const head = detail.querySelector('.pw-detail-target');
      const start = head ? Number(win.getComputedStyle(head).opacity) : 1;
      if (!(start > .02)) return null;
      const ghost = doc.createElement('div'); ghost.className = 'pw-detail-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true; ghost.dataset.liquidIgnore = '';
      Array.from(detail.children).forEach(node => { if (!node.classList.contains('pw-detail-ghost')) ghost.append(node.cloneNode(true)); });
      ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      ghost.querySelectorAll('button').forEach(node => node.remove());
      return { ghost, start };
    }
    function releaseSnapshot(snapshot) {
      if (!snapshot) return;
      detail.querySelectorAll('.pw-detail-ghost').forEach(node => node.remove());
      const { ghost, start } = snapshot; detail.append(ghost);
      if (typeof ghost.animate !== 'function') { ghost.remove(); return; }
      const fade = ghost.animate([{ opacity: start, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,-6px,0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      fade.onfinish = fade.oncancel = () => ghost.remove();
    }
    function confirmOpen() {
      root.dataset.pullState = 'idle';
      if (open && byId.has(detailId)) status.textContent = byId.get(detailId).title + ' · 已展開';
      else if (selected) status.textContent = byId.get(selected).title + ' · 已選取';
    }
    function renderDetail(id, entrance = true) {
      const item = byId.get(id); if (!item) return;
      const wasHidden = detail.hidden;
      for (const node of [detail, ...detail.querySelectorAll('.pw-excerpt,.pw-reading-note,.pw-findings')]) surfaces?.cancel(node);
      detailId = id; detail.replaceChildren(); detail.dataset.policyId = id;
      const head = make('div', 'pw-detail-head');
      const target = make('div', 'pw-detail-target'); target.dataset.policyPullTarget = ''; target.append(make('span', 'pw-detail-kicker', item.demo ? '虛構保單' : '保單條款'), make('h3', 'pw-detail-title', item.title));
      const close = make('button', 'pw-close', '關閉筆記'); close.type = 'button'; close.dataset.pwAction = 'close';
      head.append(target, close);
      const source = make('p', 'pw-source', item.sourceLabel);
      const excerpt = make('blockquote', 'pw-excerpt'); excerpt.dataset.policyExcerpt = id;
      // Preserve the original excerpt exactly; add marker spans only around literal matching quotes.
      const ranges = item.findings.map(f => ({ start: item.excerpt.indexOf(f.quote), end: item.excerpt.indexOf(f.quote) + f.quote.length, finding: f })).sort((a,b) => a.start - b.start);
      let cursor = 0;
      ranges.forEach(r => { if (r.start < cursor) return; excerpt.append(doc.createTextNode(item.excerpt.slice(cursor,r.start))); const mark = make('mark', 'pl-marker', r.finding.quote); mark.dataset.priority = r.finding.priority; mark.dataset.findingId = r.finding.id; excerpt.append(mark); cursor = r.end; });
      excerpt.append(doc.createTextNode(item.excerpt.slice(cursor)));
      const note = make('p', 'pw-reading-note', '優先級用於整理問題，並非保障判定。');
      const findings = make('ol', 'pw-findings pl-ruled-list'); findings.dataset.policyFindings = id;
      item.findings.slice().sort((a,b) => a.priority - b.priority).forEach((f,index) => {
        const row = make('li', 'pw-finding'); row.dataset.findingId = f.id; row.dataset.priority = f.priority;
        row.style.setProperty('--pw-row',index);
        const badge = make('span', 'pl-priority pw-priority', f.priority + ' / ' + labels[f.priority]); badge.dataset.priority = f.priority;
        const content = make('div', 'pw-finding-copy'); content.append(make('h4', 'pw-finding-title', f.title), make('p', 'pw-question', f.question));
        row.append(badge, content); findings.append(row);
      });
      detail.append(head, source, excerpt, note, findings); syncOpen(entrance);
      if (entrance && open && !wasHidden) for (const node of [target, source, excerpt, note, findings]) surfaces?.enter(node, { distance:0, opacity:.18, duration:360 });
    }
    function syncOpen(entrance = true) {
      root.dataset.detailOpen = String(open);
      if (open) {
        const entering = detail.hidden;
        surfaces?.cancel(detail); detail.hidden = false;
        if (entering && entrance) surfaces?.enter(detail, { distance:0 });
      } else if (!detail.hidden) {
        if (surfaces) surfaces.visibility(detail, false);
        else detail.hidden = true;
      }
      placeholder.hidden = open;
      deckHost.querySelectorAll('[data-pd-paper]').forEach(p => { p.setAttribute('aria-controls', detail.id); p.setAttribute('aria-expanded', String(open && p.dataset.pdPaper === selected)); });
    }
    let deferred = null;
    function onSelect(id, item, meta) {
      if (dead) return; selected = id; version++;
      // A click or Enter selects and then synchronously opens. Defer the plain
      // selection render one microtask so it never flashes before the pull.
      if (!inspecting) {
        const token = deferred = {};
        queueMicrotask(() => { if (dead || deferred !== token) return; deferred = null; pull.fade(); const snapshot = open ? snapshotDetail() : null; clearArrival(); if (open) renderDetail(selected); releaseSnapshot(snapshot); syncOpen(); confirmOpen(); });
      }
      options.onSelection?.(id, item, meta);
      root.dispatchEvent(new win.CustomEvent('policyworkbench:selection', { bubbles: true, detail: { id, item, reason: meta?.reason || 'api' } }));
    }
    function inspect(id) {
      if (dead || !byId.has(id)) return false;
      deferred = null; inspecting = true;
      try { deck.select(id); } finally { inspecting = false; }
      selected = id; open = true; version++; const requestVersion = version;
      // Reserve the final text geometry now, but wait for the carried paper
      // before showing its ink. Pull alone drives the shared arrival clock.
      const snapshot = snapshotDetail();
      renderDetail(id, false);
      releaseSnapshot(snapshot);
      detail.dataset.detailMotion = 'waiting';
      detail.style.setProperty('--pw-arrival','0');
      detail.style.setProperty('--pw-heading-ink','0');
      detail.style.setProperty('--pw-copy-ink','0');
      detail.style.setProperty('--pw-note-ink','0');
      detail.style.setProperty('--pw-loading-ink','1');
      const rows=Array.from(detail.querySelectorAll('.pw-finding'));
      rows.forEach(row=>row.style.setProperty('--pw-ink','0'));
      detail.setAttribute('aria-busy','true');
      status.textContent = '正在打開：' + byId.get(id).title;
      const sourceElement = Array.from(deckHost.querySelectorAll('[data-pd-paper]')).find(p => p.dataset.pdPaper === id), targetElement = detail.querySelector('[data-policy-pull-target]');
      pull.play({ id, sourceElement, targetElement, onLanding(progress) {
        if (dead || requestVersion !== version) return;
        detail.dataset.detailMotion = 'arriving';
        detail.style.setProperty('--pw-arrival',String(progress));
        // Soft overlap with the retiring paper. Each group eases in and out on
        // Pull's existing clock, without delayed CSS ramps or another timer.
        detail.style.setProperty('--pw-heading-ink',String(ink(progress,.16,.76)));
        detail.style.setProperty('--pw-copy-ink',String(ink(progress,.22,.86)));
        detail.style.setProperty('--pw-note-ink',String(ink(progress,.25,.88)));
        detail.style.setProperty('--pw-loading-ink',String(1-ink(progress,0,.25)));
        rows.forEach((row,index)=>{
          const stagger=rows.length>1?index/(rows.length-1)*.12:0;
          row.style.setProperty('--pw-ink',String(ink(progress,.28+stagger,.86+stagger)));
        });
      } }).then(result => {
        if (dead || requestVersion !== version) return;
        if (result?.status === 'complete') { clearArrival(); confirmOpen(); }
        else settleArrival();
      });
      options.onInspect?.(id, byId.get(id));
      root.dispatchEvent(new win.CustomEvent('policyworkbench:inspect', { bubbles: true, detail: { id, item: byId.get(id) } })); return true;
    }
    const deck = global.PolicyDeck.mount(deckHost, { items, selectedId: selected, onSelect, onInspect: id => inspect(id) });
    const click = event => { if (event.target.closest?.('[data-pw-action="close"]')) closeNotes(); };
    function closeNotes() {
      if (!open) return;
      const wasArriving = detail.hasAttribute('data-detail-motion');
      open = false; version++; pull.fade(); clearArrival(); deck.cancel();
      // A cancelled arrival must not create a sharp exit snapshot of ink
      // which has not been revealed yet.
      if (wasArriving) { surfaces?.cancel(detail); detail.hidden = true; }
      syncOpen(); root.dataset.pullState = 'idle'; status.textContent = '筆記已關閉。';
      const paper = Array.from(deckHost.querySelectorAll('[data-pd-paper]')).find(p => p.dataset.pdPaper === selected); paper?.focus({ preventScroll: true });
    }
    // Pointer-down may become a click (redirect) or a drag; neither should cut
    // the current flight. Keyboard movement and reorder hand off softly.
    const stopPullFromPaper = event => { if (event.type !== 'pointerdown' && event.target.closest?.('[data-pd-paper]')) { version++; pull.fade(); settleArrival(); } };
    const stopPullForReorder = () => { version++; pull.fade(); settleArrival(); };
    const key = event => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) stopPullFromPaper(event);
      if (event.key === 'Escape') { event.preventDefault(); closeNotes(); }
    };
    root.addEventListener('click', click); root.addEventListener('keydown', key); root.addEventListener('pointerdown', stopPullFromPaper, true); root.addEventListener('policydeck:reorder', stopPullForReorder);
    if (selected) renderDetail(selected); else { open = false; syncOpen(); }
    const api = { select(id) { if (dead || !byId.has(id)) return false; version++; pull.fade(); settleArrival(); const result = deck.select(id); confirmOpen(); return result; }, inspect, destroy() { if (dead) return; dead = true; version++; clearArrival(); root.removeEventListener('click', click); root.removeEventListener('keydown', key); root.removeEventListener('pointerdown', stopPullFromPaper, true); root.removeEventListener('policydeck:reorder', stopPullForReorder); for (const node of [detail, ...detail.querySelectorAll('.pw-excerpt,.pw-reading-note,.pw-findings')]) surfaces?.cancel(node); pull.destroy(); deck.destroy(); root.remove(); if (mounts.get(host) === api) mounts.delete(host); }, get selectedId() { return selected; } };
    mounts.set(host, api); return api;
  }
  global.PolicyWorkbench = Object.freeze({ mount });
})(window);
