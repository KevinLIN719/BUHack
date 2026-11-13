/* Keep one concept surface from the first symbol to the final tagline.
 * The static home is a no-script fallback, never a second animation layer. */
(() => {
  'use strict';
  const mounts = new WeakMap();
  const timings = Object.freeze({ symbols: window.PolicyConceptMotion?.timings.icons || 3600, copy: 500, handoff: 0 });
  function mount(host, { conceptOptions = {}, onState } = {}) {
    if (!host?.querySelector) throw new TypeError('A hero host is required.');
    mounts.get(host)?.destroy();
    const conceptHost = host.querySelector('[data-hero-concept]');
    const home = host.querySelector('[data-hero-home]');
    const originalHidden = conceptHost.hidden, homeHidden = home?.hidden;
    let state = 'ready', active = null, version = 0, destroyed = false;
    const notify = next => {
      state = next; host.dataset.heroState = next;
      try { onState?.(next); } catch {}
    };
    const concept = window.PolicyConceptMotion?.mount(conceptHost, {
      ...window.PolicyConceptData, ...conceptOptions, autoplay: false,
      onPhase(phase, status) {
        host.dataset.heroPhase = phase;
        conceptOptions.onPhase?.(phase, status);
      }
    });
    conceptHost.hidden = !concept;
    if (home) home.hidden = Boolean(concept);
    function finish() {
      if (destroyed) return;
      version++; concept?.finish(); active = null; notify('ready');
    }
    function play() {
      if (destroyed) return Promise.resolve();
      if (active) return active;
      if (!concept) { notify('ready'); return Promise.resolve(); }
      const token = ++version;
      notify('concept');
      const promise = concept.play().then(() => {
        if (!destroyed && token === version) notify('ready');
      }).finally(() => { if (active === promise) active = null; });
      active = promise;
      return promise;
    }
    function replay() { finish(); return play(); }
    function destroy() {
      if (destroyed) return;
      finish(); destroyed = true; state = 'destroyed'; concept?.destroy();
      conceptHost.hidden = originalHidden;
      if (home) home.hidden = homeHidden;
      host.removeAttribute('data-hero-state'); host.removeAttribute('data-hero-phase');
      mounts.delete(host);
    }
    const controller = Object.freeze({ play, finish, replay, destroy, get state() { return state; } });
    mounts.set(host, controller);
    notify('ready');
    return controller;
  }
  window.PolicyHeroTransition = Object.freeze({ mount, timings });
})();
