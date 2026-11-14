/* Context: a few optional taps so the edge cases fit the user. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  function toggle(q, optId) {
    const { context } = PL.getState();
    const cur = context[q.id] || [];
    const next = q.multi
      ? (cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId])
      : (cur[0] === optId ? [] : [optId]);
    PL.setState({ context: { ...context, [q.id]: next } });
  }

  function hasMatchingIntake(st) {
    return Boolean(
      st.document?.reviewId
      && st.intake?.reviewId === st.document.reviewId
      && (!st.intake.lang || st.intake.lang === st.lang)
    );
  }

  function activeQuestions() {
    const st = PL.getState();
    if (hasMatchingIntake(st) && Array.isArray(st.intake.questions) && st.intake.questions.length) {
      return st.intake.questions;
    }
    return PL.policy().context;
  }

  function render() {
    const init = PL.getState();
    const isReal = Boolean(init.document?.reviewId);

    const rowsWrap = h('div', { class: 'ctx-rows' });
    const subEl = h('p', { class: 'h-sub', 'data-a': '' });
    const glyphEl = h('i', {});
    const titleEl = h('b', {});
    const kindEl = h('span', {});
    const metaEl = h('span', { class: 'ctx-doc-meta' });
    const paperEl = h('div', { class: 'ctx-doc-paper' }, glyphEl, titleEl, kindEl, metaEl);

    const noteInput = isReal
      ? h('input', {
        type: 'text',
        class: 'ctx-note-input',
        value: init.userNote || '',
        placeholder: PL.t('或者直接寫一句你最擔心的事（例如：我出門旅行一個半月，家裏沒人住，出事賠不賠？）', 'Or type one thing on your mind (e.g. What if my flat is empty for 45 days?)'),
        oninput: (e) => { PL.setState({ userNote: e.target.value }); },
        onkeydown: (e) => { if (e.key === 'Enter') PL.go('parse'); },
      })
      : null;
    const noteRow = isReal
      ? h('div', { class: 'ctx-note-box', 'data-a': '' }, noteInput)
      : null;
    const actionsWrap = h('div', { class: 'ctx-actions', 'data-a': '' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => PL.go('parse') }, PL.t('開始解讀', 'Read my policy'), h('span', { class: 'arrow' }, '→')),
      h('button', { type: 'button', class: 'btn quiet', onclick: () => { PL.setState({ context: {}, userNote: '' }); PL.go('parse'); } }, PL.t('略過', 'Skip')));

    /* Other materials (real uploads only): schedules, endorsements, brochures, adviser replies. */
    const matList = h('ul', { class: 'ctx-mats' });
    const matBox = isReal ? h('div', { class: 'ctx-mat-box' },
      h('p', { class: 'ctx-mat-title' }, PL.t('其他材料', 'Other materials'), h('small', {}, PL.t('可略過', 'optional'))),
      matList,
      h('button', { type: 'button', class: 'mini-btn ctx-mat-add', onclick: () => PL.materials.sheet() },
        PL.t('＋ 加附表、宣傳單或顧問回覆', '+ Add schedule, brochure or adviser reply'))) : null;
    function paintMats() {
      const extra = (PL.getState().materials || []).filter((d) => d.role !== 'contract');
      matList.replaceChildren(...extra.map((d) => h('li', {}, h('b', {}, PL.roleLabel(d.role)), h('span', {}, d.name))));
      matList.hidden = !extra.length;
    }
    if (isReal) paintMats();

    const doc = h('div', { class: 'ctx-doc', 'data-a': '' },
      paperEl,
      h('p', { class: 'ctx-doc-note' },
        isReal
          ? h('button', { type: 'button', class: 'link-btn', onclick: () => PL.go('document') }, PL.t('查看提取原文 ↗', 'View extracted text ↗'))
          : PL.t('已收到保單', 'Policy received')),
      matBox);

    const el = h('section', { class: 'screen ctx' },
      h('div', { class: 'ctx-main' },
        h('p', { class: 'eyebrow', 'data-a': '' }, PL.t('第 1 步 · 可略過', 'Step 1 · optional')),
        h('h2', { class: 'h-title', 'data-a': '' }, PL.t('說說你的情況', 'Tell us a little')),
        subEl,
        rowsWrap,
        noteRow,
        actionsWrap),
      doc);

    function paint() {
      const { context } = PL.getState();
      PL.$$('.chip', el).forEach((c) => c.setAttribute('aria-pressed', String((context[c.dataset.q] || []).includes(c.dataset.o))));
    }
    function bump(c) {
      if (window.gsap && !PL.reduced) gsap.fromTo(c, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    }

    function syncView() {
      const st = PL.getState();
      const realDoc = st.document;
      const matched = hasMatchingIntake(st);
      const intake = st.intake;
      const themePolicy = (matched && intake.themeKey && PL.POLICIES[intake.themeKey]) || PL.policy();

      paperEl.style.setProperty('--pa', themePolicy.theme.accent);
      glyphEl.textContent = matched && intake.glyph ? intake.glyph : (isReal ? '§' : themePolicy.glyph);
      titleEl.textContent = matched && intake.name ? PL.tx(intake.name) : (isReal ? (realDoc?.name || PL.t('我的保單', 'My policy')) : PL.tx(themePolicy.name));
      kindEl.textContent = matched && intake.kind ? PL.tx(intake.kind) : (isReal ? PL.t('真實保單 PDF', 'Uploaded PDF policy') : (st.fileName || PL.tx(themePolicy.kind)));
      metaEl.textContent = matched && intake.trip ? PL.tx(intake.trip) : (isReal ? (realDoc?.name || '') : PL.tx(themePolicy.trip));
      subEl.textContent = matched && intake.hook ? PL.tx(intake.hook) : PL.t('答了，邊界場景會更貼近你。', 'Answers make the edge cases fit you.');

      if (isReal && !matched && st.intakeLoading) {
        rowsWrap.replaceChildren(
          h('div', { class: 'ctx-loading' },
            h('span', { class: 'ctx-loading-dot', 'aria-hidden': 'true' }),
            h('span', {}, PL.t('正在快速辨識你的保單類型，準備幾個貼身問題……', 'Scanning your policy to prepare tailored questions…'))));
        return;
      }

      const qs = activeQuestions();
      const rows = qs.map((q) => {
        const chips = q.options.map((o) =>
          h('button', { type: 'button', class: 'chip', 'data-q': q.id, 'data-o': o.id, onclick: (e) => { toggle(q, o.id); paint(); bump(e.currentTarget); } },
            h('span', { class: 'chip-dot', 'aria-hidden': 'true' }), PL.tx(o.label)));
        return h('div', { class: 'ctx-row' },
          h('p', { class: 'ctx-q' }, PL.tx(q.q), q.multi ? h('small', {}, PL.t('可多選', 'pick any')) : null),
          h('div', { class: 'ctx-chips' }, ...chips));
      });
      rowsWrap.replaceChildren(...rows);
      paint();
    }

    syncView();

    let live = true;
    const controller = new AbortController();
    const curState = PL.getState();
    if (isReal && !hasMatchingIntake(curState) && !curState.intakeLoading) {
      PL.setState({ intakeLoading: true });
      syncView();
      PL.documents.intake(curState.document, curState.lang, controller.signal, curState.userNote)
        .then((res) => {
          if (!live) return;
          const nextIntake = { ...res, reviewId: curState.document.reviewId, lang: curState.lang };
          const updates = { intake: nextIntake, intakeLoading: false };
          if (res?.themeKey && PL.POLICIES[res.themeKey]) updates.policyId = res.themeKey;
          PL.setState(updates);
        })
        .catch(() => {
          if (!live) return;
          PL.setState({ intakeLoading: false });
        });
    }

    const unsub = PL.subscribe((next, prev) => {
      if (!live) return;
      if (next.intake !== prev.intake || next.intakeLoading !== prev.intakeLoading) {
        syncView();
      }
      if (isReal && next.materials !== prev.materials) paintMats();
    });

    return {
      el,
      destroy: () => {
        live = false;
        controller.abort();
        unsub();
      },
    };
  }

  /** Tags selected in context, used to mark relevant edge cases. */
  PL.contextTags = () => {
    const qs = activeQuestions();
    const { context } = PL.getState();
    return qs.flatMap((q) => (context[q.id] || []).flatMap((oid) => q.options.find((o) => o.id === oid)?.tags || []));
  };

  PL.screens.context = { render };
})();
