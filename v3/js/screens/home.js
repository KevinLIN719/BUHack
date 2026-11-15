/* Home: one-line promise, upload, three sample policies. */
(() => {
  const PL = window.PL;
  const { h } = PL;
  const ORDER = ['travel', 'critical', 'home'];

  function miniPaper(p, i) {
    const lines = p.document.sections.slice(0, 3).flatMap((s) => [
      h('span', { class: 'mp-h' }, s.no ? `§${s.no} ${PL.tx(s.heading)}` : PL.tx(s.heading)),
      ...s.lines.slice(0, 2).map((_, j) => h('span', { class: `mp-l ${j === 0 && i === 0 ? 'is-hl' : ''}` })),
    ]);
    return h('div', { class: 'mini-paper', 'data-policy': p.id, style: `--pa:${p.theme.accent}` },
      h('div', { class: 'mp-top' }, h('i', {}, p.glyph), h('b', {}, PL.tx(p.name))),
      ...lines);
  }

  function render() {
    const policies = ORDER.map((id) => PL.POLICIES[id]);
    const error = h('p', { class: 'home-file-error', role: 'alert', hidden: true });
    const fileInput = h('input', { type: 'file', accept: '.pdf,application/pdf', hidden: true, onchange: (e) => {
      onFile(e.target.files[0], error);
      e.target.value = '';
    } });
    const drop = h('label', { class: 'drop', 'data-a': '', tabindex: '0', role: 'button', onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    } },
      fileInput,
      h('span', { class: 'drop-icon', 'aria-hidden': 'true' }, '↑'),
      h('span', { class: 'drop-main' }, PL.t('拖入保單 PDF', 'Drop a policy PDF')),
      h('span', { class: 'drop-sub' }, PL.t('或點擊選擇檔案 · 最多 4 MB、120 頁', 'or choose a file · up to 4 MB and 120 pages')));
    const phoneScan = h('button', { type: 'button', class: 'cap-btn home-scan-entry', 'data-a': '', onclick: () => PL.capture.open() },
      PL.t('用手機掃描保單', 'Scan with your phone'), h('span', { 'aria-hidden': 'true' }, '↗'));

    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); onFile(e.dataTransfer.files[0], error); });

    const saved = PL.documents.saved();
    const resume = saved.length ? h('div', { class: 'home-saved', 'data-a': '' },
      h('p', { class: 'home-saved-title' }, PL.t('已上傳的保單', 'Uploaded policies')),
      ...saved.map((record) => h('button', { type: 'button', class: 'home-saved-item', onclick: () => {
        PL.setState({ document: record, analysis: null, selected: [], context: {}, materials: [], materialsRevision: 0, analysisRevision: null, prevAnalysis: null, claims: null });
        PL.go('document');
      } }, h('span', {}, (record.name || PL.t('我的保單', 'My policy')) +
        (record.pending ? PL.t(' · 上傳未完成', ' · Upload incomplete') : '')), h('span', { 'aria-hidden': 'true' }, '→')))) : null;

    const samples = policies.map((p) =>
      h('button', { type: 'button', class: 'sample', style: `--pa:${p.theme.accent};--ps:${p.theme.soft}`, 'data-a': '', onclick: (e) => pick(p.id, e.currentTarget) },
        h('span', { class: 'sample-glyph' }, p.glyph),
        h('span', { class: 'sample-kind' }, PL.tx(p.kind)),
        h('span', { class: 'sample-hook' }, PL.tx(p.hook)),
        h('span', { class: 'sample-go', 'aria-hidden': 'true' }, '→')));

    const stack = h('div', { class: 'hero-stack', 'aria-hidden': 'true' }, ...policies.map(miniPaper));

    const el = h('section', { class: 'screen home' },
      h('div', { class: 'home-copy' },
        h('p', { class: 'eyebrow', 'data-a': '' }, 'Policy Lens'),
        h('h1', { class: 'home-title', 'data-a': '' },
          PL.t('付款之前，', 'Know what you’re buying'), h('br'),
          h('span', {}, PL.t('先看清你買了甚麼。', 'before you pay.'))),
        h('p', { class: 'home-sub', 'data-a': '' },
          PL.t('上傳 PDF 查看條款原文，或選一份示例體驗完整流程。', 'Upload a PDF to read its wording, or try the full flow with a sample.')),
        drop, phoneScan, error, resume,
        h('p', { class: 'home-or', 'data-a': '' }, PL.t('或試試這三份保單', 'Or try one of these')),
        h('div', { class: 'samples' }, ...samples)),
      stack);

    return { el, enter: () => enter(stack) };
  }

  let floatTl = null;
  function enter(stack) {
    if (!window.gsap || PL.reduced) return;
    const papers = PL.$$('.mini-paper', stack);
    gsap.from(papers, { y: 120, opacity: 0, rotate: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', delay: 0.15 });
    floatTl = gsap.to(papers, { y: '+=10', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.5 } });
  }

  function onFile(file, error) {
    if (!file) return;
    let message = '';
    if (!/\.pdf$/i.test(file.name)) message = PL.t('目前請選擇 PDF 文件，圖片暫不支援。', 'Please choose a PDF. Images are not supported yet.');
    else if (file.size > 4 * 1024 * 1024) message = PL.t('單份 PDF 不能超過 4 MB。', 'A PDF must be 4 MB or smaller.');
    else if (!file.size) message = PL.t('這個檔案是空的，請選擇另一份。', 'This file is empty. Please choose another.');
    if (message) { error.textContent = message; error.hidden = false; return; }
    error.hidden = true;
    PL.setState({ document: { file, name: file.name }, analysis: null, selected: [], context: {}, materials: [], materialsRevision: 0, analysisRevision: null, prevAnalysis: null, claims: null });
    PL.go('document');
  }

  /** Sample card morphs into its paper, then we move on. */
  function pick(id, card) {
    const paper = PL.$(`.mini-paper[data-policy="${id}"]`);
    PL.selectPolicy(id, null);
    if (!window.gsap || PL.reduced || !paper) { PL.go('context'); return; }
    floatTl?.kill();
    const r = card.getBoundingClientRect();
    const ghost = h('div', { class: 'pick-ghost', style: `--pa:${PL.POLICIES[id].theme.accent};left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px` });
    document.body.append(ghost);
    const tl = gsap.timeline({ onComplete: () => { PL.go('context', { from: 'pick' }); gsap.to(ghost, { opacity: 0, duration: 0.4, delay: 0.1, onComplete: () => ghost.remove() }); } });
    tl.to(card, { scale: 0.97, duration: 0.12, yoyo: true, repeat: 1 })
      .to(paper, { rotate: 0, scale: 1.08, y: -20, zIndex: 5, duration: 0.5, ease: 'power3.out' }, 0)
      .to(ghost, { left: 0, top: 64, width: window.innerWidth, height: window.innerHeight - 64, borderRadius: 0, duration: 0.7, ease: 'expo.inOut' }, 0.15);
  }

  PL.screens.home = { render, destroy: () => { floatTl?.kill(); PL.capture?.close(); } };
})();
