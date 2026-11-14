/* App shell: router with transitions, stepper, theme, language. */
(() => {
  const PL = window.PL;
  const { h } = PL;
  const NEEDS_ANALYSIS = new Set(['overview', 'scenarios', 'check', 'ask']);
  const stage = PL.$('#stage');
  let current = null; // { name, inst }
  let navigating = false;

  /* ---------- theme ---------- */
  function applyTheme(policy, animate) {
    const vars = { '--accent': policy.theme.accent, '--accent-soft': policy.theme.soft, '--accent-ink': policy.theme.ink };
    if (animate && window.gsap && !PL.reduced) gsap.to(document.documentElement, { ...vars, duration: 0.8, ease: 'power2.out' });
    else Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }

  PL.selectPolicy = (id, fileName) => {
    const s = PL.getState();
    const changed = id !== s.policyId;
    PL.setState({
      policyId: id,
      fileName: fileName ?? null,
      document: null,
      intake: null,
      intakeLoading: false,
      ...(changed || fileName || s.document ? { analysis: null, selected: [], context: {}, materials: [], materialsRevision: 0, analysisRevision: null, prevAnalysis: null, claims: null } : {}),
    });
    applyTheme(PL.POLICIES[id], true);
  };

  /* ---------- router ---------- */
  async function animateOut(el) {
    if (!window.gsap || PL.reduced) return;
    const parts = PL.$$('[data-a]', el);
    await gsap.to(parts.length ? parts : el, { y: -14, opacity: 0, duration: 0.28, stagger: 0.025, ease: 'power2.in' });
  }
  function animateIn(el) {
    if (!window.gsap || PL.reduced) return;
    gsap.from(PL.$$('[data-a]', el), { y: 30, opacity: 0, duration: 0.75, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity' });
  }

  PL.go = async (name, { instant = false } = {}) => {
    if (navigating || PL.getState().busy) return;
    if (name === 'document' && !PL.getState().document) name = 'home';
    if (NEEDS_ANALYSIS.has(name) && !PL.getState().analysis) name = 'parse';
    navigating = true;
    try {
      if (current && !instant) {
        current.inst.beforeLeave?.();
        await animateOut(current.inst.el);
      }
      current?.inst.destroy?.();
      PL.screens[current?.name]?.destroy?.();
      const inst = PL.screens[name].render();
      stage.replaceChildren(inst.el);
      window.scrollTo({ top: 0, behavior: 'instant' });
      current = { name, inst };
      PL.setState({ step: name });
      PL.documents.setActive(name === 'document' ? PL.getState().document : null);
      if (!instant) animateIn(inst.el);
      inst.enter?.({ instant });
    } catch (err) {
      console.error(`[router] failed to open "${name}"`, err);
    } finally {
      navigating = false;
    }
  };

  /* ---------- header ---------- */
  const stepper = PL.$('#stepper');
  const chip = PL.$('#policyChip');
  const langBox = PL.$('.lang');
  const brand = PL.$('[data-go="home"]');
  let indicator = null;

  function renderHeader() {
    const s = PL.getState();
    brand.disabled = !!s.busy;
    document.documentElement.lang = s.lang === 'en' ? 'en' : 'zh-Hant-HK';
    langBox.dataset.lang = s.lang;
    PL.$$('[data-lang]', langBox).forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.lang === s.lang)); b.disabled = !!s.busy; });

    if (s.step === 'home') { stepper.replaceChildren(); chip.replaceChildren(); return; }
    if (s.step === 'document') {
      chip.replaceChildren(s.document?.name || PL.t('我的保單', 'My policy'));
      stepper.replaceChildren();
      return;
    }
    const p = PL.policy();
    const realTitle = PL.policyTitle();
    const realGlyph = s.document?.reviewId
      ? (s.intake?.reviewId === s.document.reviewId && s.intake.glyph ? s.intake.glyph : '§')
      : p.glyph;
    chip.replaceChildren(h('i', {}, realGlyph), realTitle);
    indicator = h('span', { class: 'st-ind' });
    stepper.replaceChildren(indicator, ...PL.stepsFor().map((name, i) =>
      h('button', {
        type: 'button', 'data-step': name,
        'aria-current': s.step === name ? 'step' : null,
        disabled: (NEEDS_ANALYSIS.has(name) && !s.analysis) || s.busy,
        onclick: () => name !== s.step && PL.go(name),
      }, h('b', {}, String(i + 1)), PL.ui(`steps.${name}`))));
    placeIndicator(true);
  }

  let lastIndicator = null;
  function placeIndicator(animate) {
    const active = PL.$('[aria-current="step"]', stepper);
    if (!active || !indicator) return;
    const to = { x: active.offsetLeft, width: active.offsetWidth };
    if (animate && lastIndicator && window.gsap && !PL.reduced) gsap.fromTo(indicator, lastIndicator, { ...to, duration: 0.5, ease: 'expo.out' });
    else Object.assign(indicator.style, { transform: `translateX(${to.x}px)`, width: `${to.width}px` });
    lastIndicator = to;
  }

  PL.subscribe((s, prev) => {
    if (s.intake !== prev.intake && s.intake?.themeKey && PL.POLICIES[s.intake.themeKey]) {
      applyTheme(PL.POLICIES[s.intake.themeKey], true);
    }
    if (s.step !== prev.step || s.lang !== prev.lang || s.analysis !== prev.analysis || s.busy !== prev.busy || s.policyId !== prev.policyId || s.document !== prev.document || s.intake !== prev.intake) renderHeader();
  });

  langBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b || b.disabled || b.dataset.lang === PL.getState().lang) return;
    const nextLang = b.dataset.lang;
    const s = PL.getState();
    // If viewing a real document and switching UI language, clear cached analysis so re-reading uses the new language
    PL.setState({
      lang: nextLang,
      ...(s.document?.reviewId ? { analysis: null } : {}),
    });
    if (current) PL.go(current.name, { instant: true });
  });
  brand.addEventListener('click', () => PL.go('home'));
  window.addEventListener('scroll', () => PL.$('#topbar').classList.toggle('is-scrolled', window.scrollY > 4), { passive: true });
  window.addEventListener('resize', () => placeIndicator(false));

  /* ---------- boot ---------- */
  applyTheme(PL.policy(), false);
  renderHeader();
  const start = new URLSearchParams(location.search).get('step');
  const saved = PL.documents.active();
  if (!start && saved) PL.setState({ document: saved });
  PL.go(start && PL.screens[start] ? start : saved ? 'document' : 'home');
})();
