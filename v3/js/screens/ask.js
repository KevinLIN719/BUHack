/* Ask: picked edge cases become a message for the adviser. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  function buildMessage(items) {
    const p = PL.policy();
    const stateDoc = PL.getState().document;
    const policyTitle = PL.policyTitle();
    const lines = items.map((s, i) => {
      if (s.kind === 'claim') {
        const ref = s.contract ? PL.citeLabel({ section: s.section, page: s.contract.page }) : PL.t('合同未見相關條款', 'No matching clause found');
        return `${i + 1}. ${PL.tx(s.question)}\n   ${PL.t('你之前說', 'You said')}：「${PL.tx(s.claimQuote)}」\n   ${PL.t('相關條款', 'Clause')}：${ref}`;
      }
      const ref = PL.citeLabel(s, p) || PL.t('保單條款', 'Policy wording');
      return `${i + 1}. ${PL.tx(s.question)}\n   ${PL.t('相關條款', 'Clause')}：${ref}`;
    });
    return [
      PL.t('您好，', 'Hi,'),
      '',
      PL.t(`我正考慮投保「${policyTitle}」，付款前想確認以下 ${items.length} 個問題：`, `I'm considering "${policyTitle}" and would like to confirm ${items.length} points before I pay:`),
      '',
      lines.join('\n\n'),
      '',
      PL.t('麻煩以書面回覆，謝謝！', 'A written reply would be appreciated. Thank you!'),
    ].join('\n');
  }

  function render() {
    const a = PL.getState().analysis;
    const { selected } = PL.getState();
    const claimItems = (PL.getState().claims?.items || [])
      .filter((c) => selected.includes(`claim:${c.id}`))
      .map((c) => ({ ...c, kind: 'claim', id: `claim:${c.id}`, title: c.claim || c.claimQuote, status: PL.VERDICT_STATUS[c.verdict] || 'silent' }));
    const items = [...a.scenarios.filter((s) => selected.includes(s.id)), ...claimItems];

    if (!items.length) {
      const el = h('section', { class: 'screen ask is-empty' },
        h('p', { class: 'eyebrow', 'data-a': '' }, PL.t(`第 ${PL.stepNo('ask')} 步 · 提問`, `Step ${PL.stepNo('ask')} · Ask`)),
        h('h2', { class: 'h-title', 'data-a': '' }, PL.t('還未選問題', 'No questions yet')),
        h('p', { class: 'h-sub', 'data-a': '' }, PL.t('回到邊界場景或核對承諾，勾選你想問清楚的事。', 'Go back to the edge cases or claim check and tick what you want answered.')),
        h('button', { type: 'button', class: 'btn primary', 'data-a': '', onclick: () => PL.go('scenarios') }, PL.t('返回邊界場景', 'Back to edge cases')));
      return { el };
    }

    const text = buildMessage(items);
    const body = h('pre', { class: 'letter-body' });
    const copyBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => copy() }, PL.t('複製訊息', 'Copy message'));
    const dlBtn = h('button', { type: 'button', class: 'btn', onclick: () => download() }, PL.t('下載 .txt', 'Download .txt'));
    const letter = h('div', { class: 'letter', 'data-a': '' },
      h('div', { class: 'letter-head' },
        h('span', {}, PL.t('致：保險顧問', 'To: your adviser')),
        h('span', {}, PL.t(`${items.length} 個問題`, `${items.length} questions`))),
      body,
      h('div', { class: 'letter-actions' }, copyBtn, dlBtn));

    const list = h('ol', { class: 'ask-list' }, ...items.map((s) =>
      h('li', { class: 'ask-item', 'data-id': s.id },
        h('span', { class: `ask-dot st-${s.status}` }),
        h('span', {}, PL.tx(s.title)),
        h('button', { type: 'button', class: 'ask-x', 'aria-label': PL.t('移除', 'Remove'), onclick: () => remove(s.id) }, '×'))));

    const el = h('section', { class: 'screen ask' },
      h('div', { class: 'ask-side' },
        h('p', { class: 'eyebrow', 'data-a': '' }, PL.t(`第 ${PL.stepNo('ask')} 步 · 提問`, `Step ${PL.stepNo('ask')} · Ask`)),
        h('h2', { class: 'h-title', 'data-a': '' }, PL.t('帶著問題去確認', 'Ask before you pay')),
        h('p', { class: 'h-sub', 'data-a': '' }, PL.t('每個問題都附上條款出處，顧問不能只答「應該有保」。', 'Each question cites its clause, so “it should be covered” isn’t an answer.')),
        list),
      letter);

    function remove(id) {
      const next = PL.getState().selected.filter((x) => x !== id);
      PL.setState({ selected: next });
      PL.go('ask', { instant: true });
    }

    async function copy() {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = PL.t('已複製 ✓', 'Copied ✓');
        if (window.gsap && !PL.reduced) {
          gsap.timeline()
            .to(letter, { scaleY: 0.96, y: 6, duration: 0.15, ease: 'power2.in' })
            .to(letter, { scaleY: 1, y: 0, duration: 0.5, ease: 'elastic.out(1, .5)' });
        }
      } catch (err) {
        console.error('[ask] clipboard failed', err);
        copyBtn.textContent = PL.t('請手動選取複製', 'Select and copy manually');
      }
    }

    function download() {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: `policy-lens-questions-${PL.getState().policyId}.txt` });
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    let typing = null;
    function enter({ instant }) {
      if (instant || !window.gsap || PL.reduced) { body.textContent = text; return; }
      // Each picked item flies into the letter, then the message types itself.
      const target = body.getBoundingClientRect();
      PL.$$('.ask-item', el).forEach((li, i) => {
        const r = li.getBoundingClientRect();
        const ghost = h('div', { class: 'fly', style: `left:${r.left}px;top:${r.top}px` }, li.children[1].textContent);
        document.body.append(ghost);
        gsap.timeline({ delay: 0.3 + i * 0.12 })
          .fromTo(ghost, { opacity: 0 }, { opacity: 1, duration: 0.15 })
          .to(ghost, { left: target.left + 20, top: target.top + 60 + i * 28, scale: 0.85, duration: 0.6, ease: 'power3.inOut' })
          .to(ghost, { opacity: 0, duration: 0.2, onComplete: () => ghost.remove() });
      });
      const o = { n: 0 };
      typing = gsap.to(o, {
        n: text.length, duration: Math.min(3.2, text.length / 110), delay: 0.5 + items.length * 0.12, ease: 'none',
        onUpdate: () => { body.textContent = text.slice(0, Math.round(o.n)); },
      });
    }

    return { el, enter, destroy: () => typing?.kill() };
  }

  PL.screens.ask = { render };
})();
