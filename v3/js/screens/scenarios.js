/* Edge cases: real-life situations at the edge of the wording. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  function toggleSelect(id) {
    const { selected } = PL.getState();
    PL.setState({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  }

  function scenarioCard(s, relevant, visuals) {
    const viz = PL.visual(s.visual, { status: s.status });
    if (viz) visuals.push(viz);
    const ref = PL.citeLabel(s);
    const src = h('details', { class: 'sc-src' },
      h('summary', {}, PL.t('條款原文', 'Policy wording'), ref ? h('span', {}, ` · ${ref}`) : null),
      h('div', { class: `quote${s.verified === false ? ' is-unverified' : ''}` }, h('span', { class: 'mark' }, PL.tx(s.quote)),
        s.verified === false ? h('span', { class: 'ref-warn' }, PL.t('這句未能在原文逐字對上，請打開 PDF 核對。', 'This could not be matched word for word — check the PDF.')) : null));
    const pick = h('button', { type: 'button', class: 'sc-pick', 'data-id': s.id, onclick: (e) => { toggleSelect(s.id); popPick(e.currentTarget); } },
      h('span', { class: 'sc-check', 'aria-hidden': 'true' }), h('span', { class: 'sc-pick-txt' }));
    // Sliders and switches show their own outcome; a second stamp would repeat it.
    const showsOutcome = viz && s.visual.kind !== 'split';
    const stamp = showsOutcome ? null : PL.stamp(s.status);

    const el = h('article', { class: `sc-card ${viz ? 'has-viz' : ''}`, 'data-id': s.id },
      h('header', { class: 'sc-head' },
        h('div', {},
          s.tags?.includes('custom') ? h('span', { class: 'sc-rel is-custom' }, PL.t('你問的', 'Your question'))
            : relevant ? h('span', { class: 'sc-rel' }, PL.t('與你有關', 'Relevant to you')) : null,
          h('h3', { class: 'sc-title' }, PL.tx(s.title))),
        stamp),
      h('p', { class: 'sc-why' }, PL.tx(s.why)),
      viz ? viz.el : null,
      src,
      pick);
    return { el, viz, stamp };
  }

  function popPick(btn) {
    if (window.gsap && !PL.reduced) gsap.fromTo(btn.querySelector('.sc-check'), { scale: 0.5 }, { scale: 1, duration: 0.45, ease: 'back.out(4)' });
  }

  function render() {
    const a = PL.getState().analysis;
    const tags = PL.contextTags();
    const isRel = (s) => s.tags?.some((t) => tags.includes(t));
    const ordered = [...a.scenarios].sort((x, y) => Number(isRel(y)) - Number(isRel(x)));
    const visuals = [];
    const cards = ordered.map((s) => scenarioCard(s, isRel(s), visuals));

    const grid = h('div', { class: 'sc-grid' }, ...cards.map((c) => c.el));
    const whatIf = PL.getState().document?.reviewId ? whatIfBox() : null;

    /* ---------- the user's own situation ---------- */
    function whatIfBox() {
      let ctrl = null;
      const input = h('input', {
        type: 'text', class: 'wi-input', maxlength: '400',
        placeholder: PL.t('例如：週末行山扭傷腳，看了三次跌打，每次 300 元，能賠多少？', 'e.g. I sprain my ankle hiking and see a bonesetter 3 times at $300 each. How much is paid?'),
        onkeydown: (e) => { if (e.key === 'Enter') void run(); },
      });
      const goBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { void run(); } }, PL.t('測試', 'Test'), h('span', { class: 'arrow' }, '→'));
      const stopBtn = h('button', { type: 'button', class: 'btn quiet', hidden: true, onclick: () => ctrl?.abort() }, h('span', { class: 'parse-stop-icon', 'aria-hidden': 'true' }), PL.t('停止', 'Stop'));
      const status = h('p', { class: 'wi-status', 'aria-live': 'polite' });
      const box = h('section', { class: 'wi-box', 'data-a': '' },
        h('div', { class: 'wi-head' },
          h('p', { class: 'wi-title' }, PL.t('自己測一個情況', 'Test your own situation')),
          h('p', { class: 'wi-sub' }, PL.t('寫下你擔心的事，系統會到條款裏找答案，做成一張場景卡。', 'Describe what worries you; we look it up in the wording and add a card.'))),
        h('div', { class: 'wi-row' }, input, goBtn, stopBtn),
        status);

      async function run() {
        const q = input.value.trim();
        if (q.length < 4 || ctrl) return;
        ctrl = new AbortController();
        goBtn.disabled = true; input.disabled = true; stopBtn.hidden = false;
        box.classList.add('is-running'); box.classList.remove('is-error');
        status.textContent = PL.t('正在找相關條款 …', 'Looking up the wording …');
        let got = null;
        try {
          for await (const ev of PL.api.whatIf(q, { signal: ctrl.signal })) {
            if (ev.type === 'thinking') {
              status.textContent = ev.tool === 'readSource' && ev.page
                ? PL.t(`正在讀第 ${ev.page} 頁 …`, `Reading page ${ev.page} …`)
                : PL.tx(ev.message) || status.textContent;
            } else if (ev.type === 'scenario') got = ev;
          }
          if (!got) throw new Error(PL.t('沒有得到結果，請換個說法再試。', 'No result — try rephrasing.'));
          const a = PL.getState().analysis;
          PL.setState({ analysis: { ...a, scenarios: [got, ...a.scenarios] } });
          const c = scenarioCard(got, true, visuals);
          cards.unshift(c);
          grid.prepend(c.el);
          if (window.gsap && !PL.reduced) {
            gsap.fromTo(c.el, { opacity: 0, y: -16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out' });
            if (c.stamp) PL.stampIn(c.stamp, 0.35);
          }
          if (c.viz) setTimeout(() => c.viz.play(), 500);
          paint();
          input.value = '';
          status.textContent = PL.t('已加到下面第一張。', 'Added as the first card below.');
          c.el.scrollIntoView({ behavior: PL.reduced ? 'auto' : 'smooth', block: 'center' });
        } catch (err) {
          if (err.name === 'AbortError') status.textContent = PL.t('已停止。', 'Stopped.');
          else { status.textContent = err.message; box.classList.add('is-error'); }
        } finally {
          ctrl = null;
          goBtn.disabled = false; input.disabled = false; stopBtn.hidden = true;
          box.classList.remove('is-running');
        }
      }
      return { el: box, abort: () => ctrl?.abort() };
    }

    const counter = h('strong', { class: 'tray-n' }, '0');
    const tray = h('div', { class: 'tray' },
      h('p', {}, h('span', {}, PL.t('已選', 'Selected')), counter, h('span', {}, PL.t('個問題', 'questions'))),
      h('button', { type: 'button', class: 'btn primary', onclick: () => PL.go('ask') }, PL.t('生成提問', 'Write my questions'), h('span', { class: 'arrow' }, '→')));
    const nextBtn = PL.getState().document?.reviewId
      ? h('button', { type: 'button', class: 'btn', 'data-a': '', onclick: () => PL.go('check') }, PL.t('核對顧問說法', 'Check adviser claims'), h('span', { class: 'arrow' }, '→'))
      : null;

    const legend = h('div', { class: 'legend', 'data-a': '' },
      ...['excluded', 'ask', 'silent', 'partial', 'covered'].map((st) => h('span', { class: `lg st-${st}` }, h('i'), PL.ui(`status.${st}`))));

    const el = h('section', { class: 'screen sc' },
      h('div', { class: 'screen-head' },
        h('div', {},
          h('p', { class: 'eyebrow', 'data-a': '' }, PL.t(`第 ${PL.stepNo('scenarios')} 步 · 邊界場景`, `Step ${PL.stepNo('scenarios')} · Edge cases`)),
          h('h2', { class: 'h-title', 'data-a': '' }, PL.t('這些情況，最容易出事', 'Where it gets tricky')),
          h('p', { class: 'h-sub', 'data-a': '' }, PL.t('拖一拖、切一切，看條款的界線在哪裏。勾選你想問清楚的。', 'Drag and switch to see where the line is. Tick the ones you want answered.'))),
        h('div', { class: 'sc-head-side' }, legend, nextBtn)),
      whatIf?.el,
      grid,
      tray);

    function paint() {
      const { selected } = PL.getState();
      PL.$$('.sc-pick', el).forEach((b) => {
        const on = selected.includes(b.dataset.id);
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('.sc-pick-txt').textContent = on ? PL.t('已加入提問', 'Added to questions') : PL.t('加入提問', 'Add to questions');
        b.closest('.sc-card').classList.toggle('is-picked', on);
      });
      const n = selected.length;
      if (counter.textContent !== String(n)) {
        counter.textContent = String(n);
        if (window.gsap && !PL.reduced) gsap.fromTo(counter, { y: -10, scale: 1.5 }, { y: 0, scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
      tray.classList.toggle('is-on', n > 0);
    }
    const unsub = PL.subscribe((s, prev) => { if (s.selected !== prev.selected) paint(); });
    paint();

    let io = null;
    function enter({ instant }) {
      const played = new WeakSet();
      io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting || played.has(e.target)) return;
        played.add(e.target);
        const c = cards.find((x) => x.el === e.target);
        if (window.gsap && !PL.reduced && !instant) {
          gsap.fromTo(c.el, { opacity: 0, y: 40, rotateX: -14 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.8, ease: 'expo.out', transformPerspective: 900 });
          if (c.stamp) PL.stampIn(c.stamp, 0.45);
        }
        if (c.viz) setTimeout(() => c.viz.play(), instant ? 0 : 700);
      }), { threshold: 0.35 });
      cards.forEach((c) => { if (window.gsap && !PL.reduced && !instant) gsap.set(c.el, { opacity: 0 }); io.observe(c.el); });
    }

    return { el, enter, destroy: () => { whatIf?.abort(); unsub(); io?.disconnect(); visuals.forEach((v) => v.destroy()); } };
  }

  PL.screens.scenarios = { render };
})();
