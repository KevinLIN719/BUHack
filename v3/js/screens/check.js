/* Check claims: what the adviser or brochure promised vs what the contract says. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  const claimMaterials = () => (PL.getState().materials || []).filter((d) => PL.CLAIM_ROLES.includes(d.role));

  function toggleSelect(id) {
    const { selected } = PL.getState();
    PL.setState({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  }

  function claimCard(c) {
    const status = PL.VERDICT_STATUS[c.verdict] || 'silent';
    const stamp = h('span', { class: `stamp st-${status}` }, PL.ui(`verdict.${c.verdict}`));
    const stateDoc = PL.getState().document;
    const docId = c.contract && (PL.docOf(c.contract.sourceId) || stateDoc?.documentId);
    const contract = c.contract
      ? h('div', { class: 'quote' }, h('span', { class: 'mark' }, PL.tx(c.contract.quote)),
        h('span', { class: 'ref' }, [c.section ? `§${PL.tx(c.section)}` : null, c.contract.page ? PL.t(`第 ${c.contract.page} 頁`, `p.${c.contract.page}`) : null].filter(Boolean).join(' · '),
          docId && c.contract.page ? ' · ' : null,
          docId && c.contract.page ? h('a', { class: 'ref-link', href: PL.documents.original({ ...stateDoc, documentId: docId }, c.contract.page), target: '_blank', rel: 'noopener noreferrer' }, PL.t('看原 PDF ↗', 'Original PDF ↗')) : null))
      : h('p', { class: 'ck-none' }, PL.t('合同裏找不到對應的條款。', 'No matching clause in the contract.'));
    const pickId = `claim:${c.id}`;
    const pick = h('button', { type: 'button', class: 'sc-pick', 'data-id': pickId, onclick: (e) => { toggleSelect(pickId); popPick(e.currentTarget); } },
      h('span', { class: 'sc-check', 'aria-hidden': 'true' }), h('span', { class: 'sc-pick-txt' }));
    const el = h('article', { class: `ck-card v-${c.verdict}`, 'data-id': pickId },
      h('header', { class: 'ck-head' },
        h('div', { class: 'ck-said' },
          h('span', { class: 'ck-from' }, c.from === 'promotion' ? PL.t('宣傳單寫', 'Brochure says') : PL.t('顧問說', 'Adviser says')),
          h('p', { class: 'ck-claim' }, '「', PL.tx(c.claimQuote), '」')),
        stamp),
      h('p', { class: 'ck-explain' }, PL.tx(c.explain)),
      h('div', { class: 'ck-contract' },
        h('p', { class: 'ck-label' }, PL.t('合同原文', 'Contract wording')),
        contract),
      c.verdict === 'supported' ? null : pick);
    return { el, stamp };
  }

  function popPick(btn) {
    if (window.gsap && !PL.reduced) gsap.fromTo(btn.querySelector('.sc-check'), { scale: 0.5 }, { scale: 1, duration: 0.45, ease: 'back.out(4)' });
  }

  function render() {
    let ctrl = null;
    let live = true;
    const list = h('div', { class: 'ck-grid' });
    const status = h('p', { class: 'ck-status', 'aria-live': 'polite' });
    const dot = h('span', { class: 'ck-dot', 'aria-hidden': 'true' });
    const statusRow = h('div', { class: 'ck-status-row', hidden: true }, dot, status);
    const tally = h('div', { class: 'ck-tally' });
    const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { void run(); } }, PL.t('開始核對', 'Check now'), h('span', { class: 'arrow' }, '→'));
    const stopBtn = h('button', { type: 'button', class: 'btn quiet', hidden: true, onclick: () => ctrl?.abort() },
      h('span', { class: 'parse-stop-icon', 'aria-hidden': 'true' }), PL.t('停止核對', 'Stop'));

    /* quick paste, right on the page */
    const pasteArea = h('textarea', { class: 'mat-text', rows: '5', maxlength: '20000', placeholder: PL.t('把顧問的回覆貼在這裏，例如：「骨折直接賠 5 萬，門診不限次數，三個月內通知就可以。」', 'Paste the adviser’s reply, e.g. “Fractures pay $50,000 flat, unlimited clinic visits, notify within 3 months.”') });
    const pasteBtn = h('button', { type: 'button', class: 'btn', onclick: () => { void quickPaste(); } }, PL.t('加入這段回覆', 'Add this reply'));
    const pdfBtn = h('button', { type: 'button', class: 'mini-btn', onclick: () => PL.materials.sheet({ suggestRole: 'promotion' }) }, PL.t('＋ 加宣傳單／計劃書 PDF', '+ Add a brochure PDF'));
    const matList = h('ul', { class: 'ck-mats' });
    const pasteMsg = h('p', { class: 'mat-status', 'aria-live': 'polite' });

    const side = h('aside', { class: 'ck-side', 'data-a': '' },
      h('p', { class: 'ck-side-title' }, PL.t('要核對的材料', 'Materials to check')),
      matList,
      pasteArea,
      h('div', { class: 'mat-row' }, pasteBtn, pdfBtn),
      pasteMsg);

    const el = h('section', { class: 'screen ck' },
      h('div', { class: 'screen-head' },
        h('div', {},
          h('p', { class: 'eyebrow', 'data-a': '' }, PL.t(`第 ${PL.stepNo('check')} 步 · 核對承諾`, `Step ${PL.stepNo('check')} · Check claims`)),
          h('h2', { class: 'h-title', 'data-a': '' }, PL.t('顧問說的，合同有沒有寫？', 'Does the contract back it up?')),
          h('p', { class: 'h-sub', 'data-a': '' }, PL.t('把顧問回覆或宣傳單裏的每句承諾拆出來，逐條對照合同原文。', 'Every promise in the adviser reply or brochure, checked line by line against the contract.'))),
        h('div', { class: 'ck-actions', 'data-a': '' }, runBtn, stopBtn)),
      h('div', { class: 'ck-layout' },
        h('div', { class: 'ck-main' }, statusRow, tally, list),
        side));

    const counter = h('strong', { class: 'tray-n' }, '0');
    const tray = h('div', { class: 'tray' },
      h('p', {}, h('span', {}, PL.t('已選', 'Selected')), counter, h('span', {}, PL.t('個問題', 'questions'))),
      h('button', { type: 'button', class: 'btn primary', onclick: () => PL.go('ask') }, PL.t('生成提問', 'Write my questions'), h('span', { class: 'arrow' }, '→')));
    el.append(tray);

    function paintMaterials() {
      const mats = claimMaterials();
      matList.replaceChildren(...mats.map((d) => h('li', {}, h('span', { class: 'mat-tag' }, PL.roleLabel(d.role)), h('span', { class: 'mat-name' }, d.name),
        h('button', { type: 'button', class: 'mat-x', 'aria-label': PL.t('移除', 'Remove'), onclick: () => { void PL.materials.remove(d.id).catch((e) => { pasteMsg.textContent = e.message; }); } }, '×'))));
      matList.hidden = !mats.length;
      runBtn.disabled = !mats.length || Boolean(ctrl);
      const st = PL.getState();
      const stale = st.claims && st.claims.revision !== st.materialsRevision;
      if (!ctrl && !mats.length) showEmpty();
      else if (!ctrl && stale && list.children.length) {
        status.textContent = PL.t('材料已更新，按「開始核對」重新對照。', 'Materials changed — press “Check now” to re-check.');
        statusRow.hidden = false;
        dot.classList.remove('is-live');
      }
    }

    function showEmpty() {
      if (list.querySelector('.ck-card')) return;
      list.replaceChildren(h('div', { class: 'ck-empty' },
        h('p', { class: 'ck-empty-title' }, PL.t('還沒有要核對的說法', 'Nothing to check yet')),
        h('p', {}, PL.t('在「要核對的材料」貼上顧問在 WhatsApp、電郵裏的回覆，或加入宣傳單 PDF。', 'Paste the adviser’s reply under “Materials to check”, or add a brochure PDF.'))));
    }

    function paintPicks() {
      const { selected } = PL.getState();
      PL.$$('.sc-pick', el).forEach((b) => {
        const on = selected.includes(b.dataset.id);
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('.sc-pick-txt').textContent = on ? PL.t('已加入提問', 'Added to questions') : PL.t('加入提問', 'Add to questions');
        b.closest('.ck-card').classList.toggle('is-picked', on);
      });
      const n = selected.length;
      if (counter.textContent !== String(n)) {
        counter.textContent = String(n);
        if (window.gsap && !PL.reduced) gsap.fromTo(counter, { y: -10, scale: 1.5 }, { y: 0, scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
      tray.classList.toggle('is-on', n > 0);
    }

    function paintTally(items) {
      const counts = {};
      items.forEach((c) => { counts[c.verdict] = (counts[c.verdict] || 0) + 1; });
      tally.replaceChildren(...['contradicted', 'overstated', 'not_in_contract', 'supported'].filter((v) => counts[v]).map((v) =>
        h('span', { class: `ck-count st-${PL.VERDICT_STATUS[v]}` }, h('b', {}, String(counts[v])), PL.ui(`verdict.${v}`))));
    }

    function addCard(c, animate) {
      list.querySelector('.ck-empty')?.remove();
      const card = claimCard(c);
      list.append(card.el);
      if (animate && window.gsap && !PL.reduced) {
        gsap.fromTo(card.el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' });
        PL.stampIn(card.stamp, 0.3);
      }
      paintPicks();
    }

    async function quickPaste() {
      const text = pasteArea.value.trim();
      if (text.length < 4) { pasteMsg.textContent = PL.t('請先貼上回覆內容。', 'Paste the reply first.'); return; }
      pasteBtn.disabled = true;
      pasteMsg.textContent = PL.t('正在加入 …', 'Adding …');
      try {
        await PL.materials.paste(text);
        pasteArea.value = '';
        pasteMsg.textContent = PL.t('已加入，可以開始核對。', 'Added — ready to check.');
      } catch (err) {
        pasteMsg.textContent = err.message;
      } finally {
        pasteBtn.disabled = false;
      }
    }

    async function run() {
      if (ctrl || !claimMaterials().length) return;
      ctrl = new AbortController();
      const items = [];
      runBtn.disabled = true;
      stopBtn.hidden = false;
      statusRow.hidden = false;
      dot.classList.add('is-live');
      el.classList.remove('is-error');
      list.replaceChildren();
      tally.replaceChildren();
      status.textContent = PL.t('正在讀顧問和宣傳單的說法 …', 'Reading the claims …');
      const revision = PL.getState().materialsRevision;
      try {
        for await (const ev of PL.api.claims({ signal: ctrl.signal })) {
          if (!live) return;
          if (ev.type === 'thinking') {
            status.textContent = ev.tool === 'readSource' && ev.page
              ? PL.t(`正在合同第 ${ev.page} 頁找依據 …`, `Checking page ${ev.page} of the contract …`)
              : ev.tool === 'searchSources' && ev.query
                ? PL.t(`正在合同裏搜尋「${ev.query}」…`, `Searching the contract for “${ev.query}” …`)
                : PL.tx(ev.message) || status.textContent;
          } else if (ev.type === 'claim') {
            items.push(ev);
            addCard(ev, true);
            paintTally(items);
            status.textContent = PL.t(`已核對 ${items.length} 條 …`, `${items.length} checked …`);
          }
        }
        PL.setState({ claims: { revision, items } });
        status.textContent = items.length
          ? PL.t(`核對完成：共 ${items.length} 條說法。`, `Done: ${items.length} claims checked.`)
          : PL.t('材料裏沒有找到和保障有關的具體說法。', 'No specific coverage claims were found in these materials.');
        if (!items.length) showEmpty();
      } catch (err) {
        if (!live) return;
        if (err.name === 'AbortError') status.textContent = PL.t('已停止核對。', 'Stopped.');
        else { status.textContent = err.message; el.classList.add('is-error'); }
        if (items.length) PL.setState({ claims: { revision, items } });
      } finally {
        if (live) {
          ctrl = null;
          dot.classList.remove('is-live');
          stopBtn.hidden = true;
          runBtn.disabled = !claimMaterials().length;
        }
      }
    }

    const unsub = PL.subscribe((s, prev) => {
      if (s.materials !== prev.materials || s.materialsRevision !== prev.materialsRevision) paintMaterials();
      if (s.selected !== prev.selected) paintPicks();
    });

    function enter() {
      const st = PL.getState();
      if (st.claims?.items?.length) {
        st.claims.items.forEach((c) => addCard(c, false));
        paintTally(st.claims.items);
      }
      paintMaterials();
      void PL.materials.refresh().catch(() => {});
    }

    return {
      el,
      enter,
      destroy: () => { live = false; ctrl?.abort(); unsub(); },
    };
  }

  PL.screens.check = { render };
})();
