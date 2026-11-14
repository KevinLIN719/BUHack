/* Extra materials: schedules, endorsements, brochures and pasted adviser replies.
 * One side sheet, opened from step 1, the "still missing" notice and the check step. */
(() => {
  const PL = window.PL;
  const { h } = PL;

  const ROLE = {
    contract: { zh: '保單條款', en: 'Policy wording' },
    schedule: { zh: '保障表／附表', en: 'Schedule' },
    endorsement: { zh: '批單／附加條款', en: 'Endorsement' },
    promotion: { zh: '宣傳單／計劃書', en: 'Brochure' },
    broker_reply: { zh: '顧問回覆', en: 'Adviser reply' },
  };
  PL.roleLabel = (role) => PL.tx(ROLE[role] || ROLE.contract);
  PL.CLAIM_ROLES = ['promotion', 'broker_reply'];

  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(PL.t('無法連接服務，請確認 Policy Lens 正在運行。', 'Cannot reach Policy Lens. Make sure it is running.'));
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error?.message || PL.t('未能處理這次請求，請重試。', 'Could not process this request. Please retry.'));
    }
    return res.status === 204 ? null : res.json();
  }

  /** Re-read the review and publish its materials + input revision to the store. */
  async function refresh() {
    const doc = PL.getState().document;
    if (!doc?.reviewId) return [];
    const review = await request(`/reviews/${doc.reviewId}`);
    const list = (review.documents || []).map((d) => ({ id: d.id, role: d.role, name: d.name, status: d.status }));
    PL.setState({ materials: list, materialsRevision: review.revision });
    return list;
  }

  async function waitParsed() {
    for (let i = 0; i < 60; i += 1) {
      const list = await refresh();
      if (!list.some((d) => ['queued', 'parsing'].includes(d.status))) return list;
      await PL.wait(700);
    }
    return PL.getState().materials;
  }

  async function addPdf(file, role) {
    const { reviewId } = PL.getState().document;
    const form = new FormData();
    form.set('role', role);
    form.set('file', file);
    await request(`/reviews/${reviewId}/documents`, { method: 'POST', body: form });
    return waitParsed();
  }

  async function paste(text, fromWhom) {
    const { reviewId } = PL.getState().document;
    const capturedAt = new Date().toISOString().slice(0, 10);
    await request(`/reviews/${reviewId}/text-materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'broker_reply', fromWhom: fromWhom || PL.t('保險顧問', 'Adviser'), capturedAt, text }),
    });
    return refresh();
  }

  async function remove(id) {
    const { reviewId } = PL.getState().document;
    await request(`/reviews/${reviewId}/documents/${id}`, { method: 'DELETE' });
    return refresh();
  }

  /* ---------- side sheet ---------- */
  let openSheet = null;

  function sheet({ focus = 'pdf', suggestRole = null } = {}) {
    if (openSheet) return openSheet.focus(focus);
    const status = h('p', { class: 'mat-status', role: 'status', 'aria-live': 'polite' });
    const list = h('ul', { class: 'mat-list' });

    let role = ['schedule', 'endorsement', 'promotion'].includes(suggestRole) ? suggestRole : 'schedule';
    const roleChips = ['schedule', 'endorsement', 'promotion'].map((r) =>
      h('button', { type: 'button', class: 'chip', 'data-role': r, 'aria-pressed': String(r === role), onclick: () => { role = r; paintRoles(); } },
        h('span', { class: 'chip-dot' }), PL.roleLabel(r)));
    const file = h('input', { type: 'file', accept: '.pdf,application/pdf', hidden: true, onchange: (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void doUpload(f); } });
    const pickBtn = h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, PL.t('選擇 PDF', 'Choose PDF'), h('span', { class: 'arrow' }, '↑'));

    const fromInput = h('input', { type: 'text', class: 'mat-from', value: PL.t('保險顧問', 'Adviser'), maxlength: '60', 'aria-label': PL.t('誰說的', 'Who said it') });
    const textArea = h('textarea', { class: 'mat-text', rows: '6', maxlength: '20000', placeholder: PL.t('把顧問在 WhatsApp、電郵或微信裏的回覆貼在這裏。例如：「骨折直接賠 5 萬，門診不限次數。」', 'Paste the adviser’s reply from WhatsApp, email or chat. e.g. “Fractures pay $50,000 flat, unlimited clinic visits.”') });
    const pasteBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { void doPaste(); } }, PL.t('加入', 'Add'));

    const closeBtn = h('button', { type: 'button', class: 'mat-close', 'aria-label': PL.t('關閉', 'Close'), onclick: () => close() }, '×');
    const panel = h('aside', { class: 'mat-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': PL.t('補充材料', 'Add materials') },
      h('header', { class: 'mat-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, PL.t('補充材料', 'More materials')),
          h('h3', { class: 'mat-title' }, PL.t('把手上的文件都放進來', 'Add what you have'))),
        closeBtn),
      h('p', { class: 'mat-sub' }, PL.t('附表和批單會一起拿來解讀；顧問回覆和宣傳單會逐句對照合同。', 'Schedules and endorsements join the reading; adviser replies and brochures get checked line by line against the contract.')),
      list,
      h('section', { class: 'mat-block', 'data-block': 'pdf' },
        h('h4', {}, PL.t('加 PDF', 'Add a PDF')),
        h('div', { class: 'mat-roles' }, ...roleChips),
        h('div', { class: 'mat-row' }, pickBtn, file)),
      h('section', { class: 'mat-block', 'data-block': 'paste' },
        h('h4', {}, PL.t('貼上顧問的回覆', 'Paste an adviser reply')),
        h('label', { class: 'mat-label' }, PL.t('誰說的', 'From'), fromInput),
        textArea,
        h('div', { class: 'mat-row' }, pasteBtn)),
      status);
    const scrim = h('div', { class: 'mat-scrim', onclick: () => close() });
    const root = h('div', { class: 'mat-root' }, scrim, panel);

    function paintRoles() { roleChips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.role === role))); }

    function paintList() {
      const items = PL.getState().materials || [];
      list.replaceChildren(...items.map((d) => {
        const busy = ['queued', 'parsing'].includes(d.status);
        const bad = ['failed', 'needs_ocr'].includes(d.status);
        return h('li', { class: `mat-item role-${d.role}` },
          h('span', { class: 'mat-tag' }, PL.roleLabel(d.role)),
          h('span', { class: 'mat-name' }, d.name),
          busy ? h('span', { class: 'mat-state' }, PL.t('提取中…', 'Reading…'))
            : bad ? h('span', { class: 'mat-state is-bad' }, PL.t('讀不到文字', 'No text'))
              : null,
          d.role === 'contract' ? null
            : h('button', { type: 'button', class: 'mat-x', 'aria-label': PL.t('移除', 'Remove'), onclick: () => { void doRemove(d.id); } }, '×'));
      }));
    }
    const unsub = PL.subscribe((s, prev) => { if (s.materials !== prev.materials) paintList(); });

    async function run(label, fn) {
      PL.$$('button, input, textarea', panel).forEach((b) => { if (b !== closeBtn) b.disabled = true; });
      status.textContent = label;
      status.classList.remove('is-error');
      try {
        await fn();
        return true;
      } catch (err) {
        status.textContent = err.message;
        status.classList.add('is-error');
        return false;
      } finally {
        PL.$$('button, input, textarea', panel).forEach((b) => { b.disabled = false; });
      }
    }
    async function doUpload(f) {
      if (await run(PL.t(`正在加入「${f.name}」並提取文字 …`, `Adding “${f.name}” …`), () => addPdf(f, role))) {
        status.textContent = PL.t('已加入。', 'Added.');
      }
    }
    async function doPaste() {
      const text = textArea.value.trim();
      if (text.length < 4) { status.textContent = PL.t('請先貼上回覆內容。', 'Paste the reply first.'); return; }
      if (await run(PL.t('正在加入 …', 'Adding …'), () => paste(text, fromInput.value.trim()))) {
        textArea.value = '';
        status.textContent = PL.t('已加入。', 'Added.');
      }
    }
    async function doRemove(id) {
      await run(PL.t('正在移除 …', 'Removing …'), () => remove(id));
      status.textContent = '';
    }

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.body.append(root);
    paintList();
    void refresh().catch(() => {});
    if (window.gsap && !PL.reduced) {
      gsap.fromTo(panel, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'expo.out' });
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }

    function focusBlock(which) {
      const target = which === 'paste' ? textArea : pickBtn;
      setTimeout(() => target.focus(), 60);
    }
    focusBlock(focus);

    async function close() {
      if (!openSheet) return;
      openSheet = null;
      unsub();
      document.removeEventListener('keydown', onKey);
      if (window.gsap && !PL.reduced) {
        await Promise.all([
          gsap.to(panel, { x: 40, opacity: 0, duration: 0.25, ease: 'power2.in' }),
          gsap.to(scrim, { opacity: 0, duration: 0.25 }),
        ]);
      }
      root.remove();
    }
    openSheet = { focus: focusBlock, close };
    return openSheet;
  }

  PL.materials = { refresh, addPdf, paste, remove, sheet };
})();
