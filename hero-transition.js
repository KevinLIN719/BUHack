/* One inline stage: the visible concept title and the actual policy paper
 * travel into their final positions. No screenshot or duplicate paper layer. */
(() => {
  'use strict';
  const mounts = new WeakMap();
  const timings = Object.freeze({ names: 14000, symbols: 7200, paperIn: 650,
    paperDelay: 220, handoff: 1550, copy: 850, copyDelay: 620,
    easing: 'cubic-bezier(.22,1,.36,1)' });
  function mount(host, { conceptOptions = {}, onState } = {}) {
    if (!host?.querySelector) throw new TypeError('A hero host is required.');
    mounts.get(host)?.destroy();
    const conceptHost = host.querySelector('[data-hero-concept]');
    const home = host.querySelector('[data-hero-home]');
    const name = host.querySelector('[data-hero-name-text]') || host.querySelector('[data-hero-name]');
    const paper = host.querySelector('[data-hero-paper]');
    const anchor = host.querySelector('[data-hero-paper-anchor]') || paper;
    // The paper is optional: without it the ending is the name and tagline only.
    const doc = host.ownerDocument;
    const view = doc.defaultView;
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = view.matchMedia?.('(forced-colors: active)');
    let state = 'ready', version = 0, destroyed = false, active = null;
    let paperPrepared = false, paperPose = 'rotate(-7deg)';
    const animations = new Set();
    const quiet = () => media?.matches || contrast?.matches;
    const notify = value => {
      state = value;
      host.dataset.heroState = value;
      if (onState) { try { onState(value); } catch {} }
    };
    function animate(node, frames, options = {}) {
      if (!node?.animate || quiet()) return Promise.resolve();
      const animation = node.animate(frames, { duration: timings.handoff,
        easing: timings.easing, fill: 'both', ...options });
      animations.add(animation);
      return animation.finished.catch(() => {}).finally(() => {
        animations.delete(animation);
        try { animation.cancel(); } catch {}
      });
    }
    function preparePaper(enter = true) {
      if (!paper || state !== 'concept' || destroyed) return;
      const stage = host.getBoundingClientRect();
      const target = anchor.getBoundingClientRect();
      if (!stage.width || !target.width) return;
      const small = (view.innerWidth || stage.width) <= 600;
      const width = Math.min(small ? 145 : 176, stage.width * (small ? .44 : .25));
      const scale = width / target.width;
      const dx = stage.left + stage.width * .5 - (target.left + target.width * .5);
      const dy = stage.top + stage.height * (small ? .71 : .80) - (target.top + target.height * .5);
      paperPose = `translate(${dx}px,${dy}px) scale(${scale}) rotate(-7deg)`;
      paper.style.transform = paperPose;
      paper.style.opacity = '1';
      if (enter && !paperPrepared) {
        animate(paper, [{ opacity: 0 }, { opacity: 1 }],
          { duration: timings.paperIn, delay: timings.paperDelay });
      }
      paperPrepared = true;
    }
    const concept = window.PolicyConceptMotion?.mount(conceptHost, {
      ...window.PolicyConceptData, ...conceptOptions,
      scan: { periodMs: timings.names, iconDurationMs: timings.symbols,
        quiet: true, ...conceptOptions.scan },
      autoplay: false,
      onPhase(phase, status) {
        host.dataset.heroPhase = phase;
        if (phase === 'name' && status === 'playing') preparePaper();
        conceptOptions.onPhase?.(phase, status);
      }
    });
    function clear() {
      for (const animation of animations) { try { animation.cancel(); } catch {} }
      animations.clear();
    }
    function settle() {
      clear();
      paper?.style.removeProperty('transform');
      paper?.style.removeProperty('opacity');
      paperPrepared = false;
      conceptHost.hidden = true;
      conceptHost.setAttribute('aria-hidden', 'true');
      home.hidden = false;
      home.inert = false;
      home.removeAttribute('aria-hidden');
      notify('ready');
    }
    async function handoff(token) {
      if (destroyed || token !== version) return;
      // The home has been in layout since the first frame, so revealing it
      // cannot change stage height or move the notebook beneath the hero.
      if (!paperPrepared) preparePaper(false);
      clear();
      const sourceName = conceptHost.querySelector('[data-concept-name]');
      const source = sourceName?.getBoundingClientRect();
      const destination = name.getBoundingClientRect();
      const dx = source ? destination.left - source.left : 0;
      const dy = source ? destination.top - source.top : 0;
      const sx = source?.width && destination.width ? destination.width / source.width : 1;
      const sy = source?.height && destination.height ? destination.height / source.height : 1;
      conceptHost.setAttribute('aria-hidden', 'true');
      if (paper) { paper.style.transform = 'rotate(-7deg)'; paper.style.opacity = '1'; }
      notify('handoff');
      await Promise.all([
        animate(sourceName, [
          { transform: 'none', transformOrigin: 'left top' },
          { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, transformOrigin: 'left top' }
        ]),
        paper && animate(paper, [{ transform: paperPose }, { transform: 'rotate(-7deg)' }]),
        animate(conceptHost.querySelector('.concept-tagline'), [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }),
        animate(home.querySelector('[data-hero-copy]'), [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: timings.copy, delay: timings.copyDelay })
      ]);
      if (!destroyed && token === version) settle();
    }
    function finish() {
      if (destroyed) return;
      version++;
      concept?.finish();
      settle();
      active = null;
    }
    function play() {
      if (destroyed) return Promise.resolve();
      if (active) return active;
      const token = ++version;
      clear();
      if (quiet() || !concept || !home.animate) { settle(); return Promise.resolve(); }
      paperPrepared = false;
      paper?.style.removeProperty('transform');
      paper?.style.removeProperty('opacity');
      conceptHost.hidden = false;
      conceptHost.removeAttribute('aria-hidden');
      home.hidden = false;
      home.inert = true;
      home.setAttribute('aria-hidden', 'true');
      notify('concept');
      const promise = concept.play().then(() => handoff(token)).finally(() => {
        if (active === promise) active = null;
      });
      active = promise;
      return promise;
    }
    function replay() { finish(); return play(); }
    const preferenceChanged = () => { if (quiet()) finish(); };
    const resize = () => {
      if (state === 'handoff') finish();
      else if (state === 'concept' && paperPrepared) preparePaper(false);
    };
    const visibility = () => { if (doc.hidden && state === 'handoff') finish(); };
    media?.addEventListener?.('change', preferenceChanged);
    contrast?.addEventListener?.('change', preferenceChanged);
    view.addEventListener('resize', resize);
    doc.addEventListener('visibilitychange', visibility);
    const observer = new view.MutationObserver(() => { if (!host.isConnected) destroy(); });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    function destroy() {
      if (destroyed) return;
      finish();
      destroyed = true;
      concept?.destroy(); clear(); observer.disconnect();
      media?.removeEventListener?.('change', preferenceChanged);
      contrast?.removeEventListener?.('change', preferenceChanged);
      view.removeEventListener('resize', resize);
      doc.removeEventListener('visibilitychange', visibility);
      notify('destroyed');
      mounts.delete(host);
    }
    const controller = Object.freeze({ play, finish, replay, destroy, get state() { return state; } });
    mounts.set(host, controller);
    settle();
    return controller;
  }
  window.PolicyHeroTransition = Object.freeze({ mount, timings });
})();
