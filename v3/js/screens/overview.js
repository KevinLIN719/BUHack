/* Overview: the policy on one page + the number people misread. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  function quoteBlock(q) {
    if (!q) return null;
    const ref = PL.citeLabel(q);
    const stateDoc = PL.getState().document;
    // A quote may come from a schedule or endorsement, so link the PDF it was cited from.
    const docId = PL.docOf(q.sourceId) || stateDoc?.documentId;
    const pdfLink = stateDoc?.reviewId && docId && q.page
      ? h('a', { class: 'ref-link', href: PL.documents.original({ ...stateDoc, documentId: docId }, q.page), target: '_blank', rel: 'noopener noreferrer' }, PL.t('看原 PDF ↗', 'Original PDF ↗'))
      : null;
    const unverified = q.verified === false
      ? h('span', { class: 'ref-warn' }, PL.t('這句未能在原文逐字對上，請打開 PDF 核對。', 'This could not be matched word for word — check the PDF.'))
      : null;
    return h('div', { class: `quote${q.verified === false ? ' is-unverified' : ''}` }, h('span', { class: 'mark' }, PL.tx(q.quote)),
      ref || pdfLink ? h('span', { class: 'ref' }, ref, ref && pdfLink ? ' · ' : null, pdfLink) : null,
      unverified);
  }

  function card(f, before) {
    const body = h('div', { class: 'ov-src', hidden: true }, quoteBlock(f));
    const toggle = h('button', { type: 'button', class: 'ov-toggle', 'aria-expanded': 'false', onclick: () => open() },
      PL.t('看原文', 'Show wording'), h('span', { 'aria-hidden': 'true' }, '＋'));
    // After a follow-up: mark what changed and keep the earlier sentence visible.
    const changed = before && PL.tx(before.answer) !== PL.tx(f.answer);
    const c = h('article', { class: `ov-card key-${f.key}${changed ? ' is-changed' : ''}`, 'data-key': f.key },
      h('p', { class: 'ov-q' }, PL.ui(`summaryKeys.${f.key}`), changed ? h('span', { class: 'ov-new' }, PL.t('已更新', 'Updated')) : null),
      h('p', { class: 'ov-a' }, PL.tx(f.answer)),
      changed ? h('p', { class: 'ov-before' }, h('b', {}, PL.t('之前：', 'Before: ')), PL.tx(before.answer)) : null,
      toggle, body);

    function open() {
      const willOpen = body.hidden;
      toggle.setAttribute('aria-expanded', String(willOpen));
      c.classList.toggle('is-open', willOpen);
      if (!window.gsap || PL.reduced) { body.hidden = !willOpen; return; }
      if (willOpen) {
        body.hidden = false;
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out' });
        const m = PL.$('.mark', body);
        m.style.backgroundSize = '0% 100%';
        gsap.to(m, { backgroundSize: '100% 100%', duration: 0.8, delay: 0.2, ease: 'power2.inOut' });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { body.hidden = true; body.style.height = ''; } });
      }
    }
    return c;
  }

  function requestsBlock(a) {
    const st = PL.getState();
    if (!st.document?.reviewId) return null;
    const items = a.requests || [];
    // Only schedules / endorsements / the policy itself change the summary; adviser replies and
    // brochures are checked on the claim page instead.
    const contractNow = (st.materials || []).filter((d) => ['contract', 'schedule', 'endorsement'].includes(d.role) && !['failed', 'needs_ocr'].includes(d.status)).map((d) => d.id).sort();
    const stale = Array.isArray(a.contractDocs) && contractNow.length > 0 && contractNow.join() !== a.contractDocs.join();
    const followUp = () => {
      PL.setState({ prevAnalysis: a, analysis: null });
      PL.go('parse');
    };
    if (stale) {
      return h('section', { class: 'ov-notice is-stale', 'data-a': '' },
        h('div', {},
          h('p', { class: 'ov-notice-title' }, PL.t('材料已更新', 'Materials changed')),
          h('p', { class: 'ov-notice-text' }, PL.t('你加入或移除了附表、批單等合同材料，上面的結論還是按舊材料寫的。', 'You changed the schedule or endorsements; the summary above still reflects the old set.'))),
        h('div', { class: 'ov-notice-actions' },
          h('button', { type: 'button', class: 'btn quiet', onclick: () => PL.materials.sheet() }, PL.t('管理材料', 'Materials')),
          h('button', { type: 'button', class: 'btn primary', onclick: followUp }, PL.t('用新材料續查', 'Follow up'), h('span', { class: 'arrow' }, '→'))));
    }
    if (!items.length) return null;
    return h('section', { class: 'ov-notice', 'data-a': '' },
      h('div', {},
        h('p', { class: 'ov-notice-title' }, PL.t('還缺這些材料', 'Still missing')),
        h('ul', { class: 'ov-req' }, ...items.map((r) =>
          h('li', {}, h('span', { class: 'mat-tag' }, PL.roleLabel(r.role)), h('span', {}, PL.tx(r.message)))))),
      h('div', { class: 'ov-notice-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => PL.materials.sheet({ suggestRole: items[0]?.role, focus: items[0]?.role === 'broker_reply' ? 'paste' : 'pdf' }) },
          PL.t('補充材料', 'Add materials'), h('span', { class: 'arrow' }, '＋'))));
  }

  function render() {
    const p = PL.policy();
    const a = PL.getState().analysis;
    const prev = PL.getState().prevAnalysis;
    const beforeOf = (key) => prev?.findings?.find((f) => f.key === key) || null;
    const cards = a.findings.map((f) => card(f, beforeOf(f.key)));
    const changedCount = prev ? a.findings.filter((f) => { const b = beforeOf(f.key); return b && PL.tx(b.answer) !== PL.tx(f.answer); }).length : 0;
    const notice = h('div', { class: 'ov-notice-slot' }, requestsBlock(a));
    const gap = a.gap;
    const viz = gap ? PL.visual(gap.visual) : null;

    const gapBlock = gap ? h('section', { class: 'gap', 'data-a': '' },
      h('div', { class: 'gap-head' },
        h('p', { class: 'eyebrow' }, PL.t('最容易看錯的數字', 'The number people misread')),
        h('div', { class: 'gap-says' },
          h('span', {}, PL.t('保障表寫', 'The schedule says')),
          h('strong', {}, PL.tx(gap.says))),
        h('p', { class: 'gap-real' }, PL.tx(gap.reality))),
      h('div', { class: 'gap-body' }, viz.el, quoteBlock(gap.detail))) : null;

    const el = h('section', { class: 'screen ov' },
      h('div', { class: 'screen-head' },
        h('div', {},
          h('p', { class: 'eyebrow', 'data-a': '' }, PL.t(`第 ${PL.stepNo('overview')} 步 · 一頁看懂`, `Step ${PL.stepNo('overview')} · One page`)),
          h('h2', { class: 'h-title', 'data-a': '' }, PL.policyTitle()),
          prev ? h('p', { class: 'h-sub', 'data-a': '' }, changedCount
            ? PL.t(`續查完成：${changedCount} 格結論因新材料改變，已標出。`, `Follow-up done: ${changedCount} answers changed with the new materials.`)
            : PL.t('續查完成：新材料沒有改變這六格結論。', 'Follow-up done: the new materials did not change these answers.')) : null),
        h('button', { type: 'button', class: 'btn primary', 'data-a': '', onclick: () => PL.go('scenarios') },
          PL.t('看邊界場景', 'See edge cases'), h('span', { class: 'arrow' }, '→'))),
      notice,
      h('div', { class: 'ov-grid' }, ...cards),
      gapBlock);

    // Materials can change while this page is open (side sheet): repaint the notice.
    const unsub = PL.subscribe((s, old) => {
      if (s.materials !== old.materials) notice.replaceChildren(...[requestsBlock(PL.getState().analysis)].filter(Boolean));
    });

    let io = null;
    function enter({ instant }) {
      if (PL.getState().document?.reviewId) void PL.materials.refresh().catch(() => {});
      const flip = PL.flip;
      PL.flip = null;
      if (window.gsap && !PL.reduced && !instant) {
        cards.forEach((c, i) => {
          const from = flip?.[c.dataset.key];
          const to = c.getBoundingClientRect();
          if (from) {
            gsap.from(c, { x: from.left - to.left, y: from.top - to.top, scaleX: from.width / to.width, scaleY: from.height / to.height, transformOrigin: '0 0', duration: 0.9, delay: i * 0.05, ease: 'expo.inOut' });
            gsap.from(c.children, { opacity: 0, duration: 0.4, delay: 0.6 + i * 0.05 });
          } else {
            gsap.from(c, { y: 30, opacity: 0, duration: 0.6, delay: i * 0.06, ease: 'power3.out' });
          }
        });
      }
      if (viz) {
        io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) { viz.play(); io.disconnect(); }
        }, { threshold: 0.5 });
        io.observe(viz.el);
      }
    }

    return { el, enter, destroy: () => { unsub(); io?.disconnect(); viz?.destroy(); } };
  }

  PL.screens.overview = { render };
})();
