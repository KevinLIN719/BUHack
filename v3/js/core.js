/* Core: namespace, immutable state store, i18n, DOM helper. */
(() => {
  const PL = (window.PL = window.PL || {});
  PL.POLICIES = PL.POLICIES || {};
  PL.screens = PL.screens || {};

  const initial = {
    lang: 'zh',
    step: 'home',
    policyId: 'travel',
    fileName: null,
    document: null,
    intake: null,       // dynamic intake metadata & questions for real documents
    intakeLoading: false,
    userNote: '',       // optional free-text note from user in Step 1
    context: {},        // { questionId: [optionId, ...] }
    analysis: null,     // built from the analysis stream
    selected: [],       // scenario / claim ids the user wants to ask about
    materials: [],      // every document in the review: { id, role, name, status }
    materialsRevision: 0, // review input revision as last seen
    analysisRevision: null, // input revision the current analysis was made from
    prevAnalysis: null, // the analysis before a follow-up, to show what changed
    claims: null,       // { revision, items } adviser / brochure claims checked against the contract
  };
  let state = Object.freeze({ ...initial });
  const listeners = new Set();

  PL.getState = () => state;
  PL.setState = (patch) => {
    const prev = state;
    state = Object.freeze({ ...state, ...patch });
    listeners.forEach((fn) => fn(state, prev));
  };
  PL.subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  PL.policy = () => PL.POLICIES[state.policyId];
  /** Title of what the user is reading. A real upload only borrows a sample policy's theme,
   *  so it must never fall back to the sample's name (e.g. 晴程旅遊保). */
  PL.policyTitle = () => {
    const doc = state.document;
    if (!doc?.reviewId) return PL.tx(PL.policy()?.name);
    if (state.intake?.reviewId === doc.reviewId && state.intake.name) return PL.tx(state.intake.name);
    return PL.tx(doc.title) || (doc.name || '').replace(/\.pdf$/i, '') || PL.t('我的保單', 'My policy');
  };

  /* ---------- i18n ---------- */
  PL.tx = (v) => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v[state.lang] ?? v.zh ?? '';
  };

  PL.UI = {
    steps: {
      context: { zh: '情境', en: 'Context' },
      parse: { zh: '解讀', en: 'Read' },
      overview: { zh: '一頁看懂', en: 'One page' },
      scenarios: { zh: '邊界場景', en: 'Edge cases' },
      check: { zh: '核對承諾', en: 'Check claims' },
      ask: { zh: '提問', en: 'Ask' },
    },
    verdict: {
      supported: { zh: '合同有依據', en: 'Backed by contract' },
      overstated: { zh: '說大了', en: 'Overstated' },
      not_in_contract: { zh: '合同沒寫', en: 'Not in contract' },
      contradicted: { zh: '與合同相反', en: 'Contradicts contract' },
    },
    status: {
      covered: { zh: '有保障', en: 'Covered' },
      partial: { zh: '只賠部分', en: 'Partly paid' },
      excluded: { zh: '寫明不賠', en: 'Excluded' },
      ask: { zh: '字眼模糊', en: 'Ambiguous' },
      silent: { zh: '條款沒寫', en: 'Not stated' },
    },
    summaryKeys: {
      covers: { zh: '保甚麼', en: "What's covered" },
      excludes: { zh: '甚麼不保', en: "What's not" },
      max: { zh: '最多賠多少', en: 'The most it pays' },
      when: { zh: '甚麼時候才賠', en: 'When it pays' },
      docs: { zh: '要準備甚麼', en: "What you'll need" },
      unclear: { zh: '哪裏未說清', en: 'Still unclear' },
    },
  };
  /** Status colour used for each claim verdict. */
  PL.VERDICT_STATUS = { supported: 'covered', overstated: 'ask', not_in_contract: 'silent', contradicted: 'excluded' };

  /** Steps shown for the current document: the claim check needs a real upload. */
  PL.stepsFor = () => (state.document?.reviewId
    ? ['context', 'parse', 'overview', 'scenarios', 'check', 'ask']
    : ['context', 'parse', 'overview', 'scenarios', 'ask']);
  PL.stepNo = (name) => PL.stepsFor().indexOf(name) + 1;
  /** Document id of a cited source (`<documentId>:p<page>:b<block>`), for the right PDF link. */
  PL.docOf = (sourceId) => (typeof sourceId === 'string' && /^[0-9a-f-]{36}:/i.test(sourceId) ? sourceId.split(':')[0] : null);

  PL.ui = (path) => PL.tx(path.split('.').reduce((o, k) => (o ? o[k] : undefined), PL.UI)) || path;
  /** Pick zh/en inline: PL.t('中文', 'English') */
  PL.t = (zh, en) => (state.lang === 'en' ? en : zh);

  /* ---------- DOM ---------- */
  PL.h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(Infinity).forEach((kid) => {
      if (kid == null || kid === false) return;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    });
    return el;
  };
  PL.$ = (sel, root = document) => root.querySelector(sel);
  PL.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  PL.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  PL.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  PL.money = (n, cur = 'HK$') => `${cur}${Math.round(n).toLocaleString('en-US')}`;

  /** Find a clause line in the current policy document by id. */
  PL.findLine = (policy, lineId) => {
    for (const sec of policy.document.sections) {
      const line = sec.lines.find((l) => l.id === lineId);
      if (line) return { line, section: sec };
    }
    return null;
  };
  PL.refLabel = (section) =>
    section.no
      ? PL.t(`§${section.no} ${PL.tx(section.heading)} · 第 ${section.page} 頁`, `§${section.no} ${PL.tx(section.heading)} · p.${section.page}`)
      : PL.t(`${PL.tx(section.heading)} · 第 ${section.page} 頁`, `${PL.tx(section.heading)} · p.${section.page}`);

  /** Format a clause reference from either a sample lineId or event metadata (section / page / pageLabel). */
  PL.citeLabel = (item, policy = PL.policy()) => {
    if (!item) return '';
    const hit = item.lineId && policy?.document ? PL.findLine(policy, item.lineId) : null;
    if (hit) return PL.refLabel(hit.section);
    const parts = [];
    if (item.section) parts.push(`§${PL.tx(item.section)}`);
    if (item.pageLabel) parts.push(PL.tx(item.pageLabel));
    else if (item.page) parts.push(PL.t(`第 ${item.page} 頁`, `p.${item.page}`));
    return parts.join(' · ');
  };

  /** Status stamp element + entrance animation. */
  PL.stamp = (status) => PL.h('span', { class: `stamp st-${status}` }, PL.ui(`status.${status}`));
  PL.stampIn = (el, delay = 0) => {
    if (!window.gsap || PL.reduced) return;
    gsap.fromTo(el, { scale: 2.4, opacity: 0, rotate: -18 }, { scale: 1, opacity: 1, rotate: -4, duration: 0.5, delay, ease: 'back.out(2.2)' });
  };
})();
