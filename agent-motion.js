/* Motion only. The conversation owns the DOM, data and final visual states. */
(() => {
  'use strict';

  window.PolicyAgentMotion?.cancelAll?.();

  const active = new Set();
  const owners = new WeakMap();
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const timings = Object.freeze({ bubble: 320, pulse: 360, response: 720, desk: 280 });
  const connected = node => Boolean(node?.isConnected);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function reduced() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }
    catch { return false; }
  }

  function bottom(feed) {
    if (connected(feed)) feed.scrollTop = feed.scrollHeight;
  }

  function responsePosition(feed, element) {
    if (!connected(feed) || !connected(element)) return;
    // Follow a growing answer until its heading reaches the top. A long answer
    // must open on its explanation rather than scroll straight to its actions.
    const top = element.getBoundingClientRect().top - feed.getBoundingClientRect().top + feed.scrollTop;
    feed.scrollTop = Math.min(Math.max(0, feed.scrollHeight - feed.clientHeight), Math.max(0, top));
  }

  // Each operation owns only its animations and the exact style values it sets.
  // Cancelling always resolves its promise, including when its node was removed.
  function operation(node) {
    owners.get(node)?.finish();
    let resolve;
    let settled = false;
    let frame = 0;
    const animations = [];
    const styles = [];
    const cleanups = [];
    const promise = new Promise(done => { resolve = done; });

    const job = {
      promise,
      get settled() { return settled; },
      style(element, property, value) {
        if (!connected(element)) return;
        styles.push({ element, property, value, original: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
        element.style.setProperty(property, value);
      },
      cleanup(callback) { cleanups.push(callback); },
      animate(element, keyframes, options) {
        if (!connected(element) || typeof element.animate !== 'function') return null;
        try {
          const animation = element.animate(keyframes, options);
          animations.push(animation);
          // Cancelling paragraph/field companions must not leave rejected
          // Animation.finished promises unhandled; only the primary drives completion.
          try { animation.finished?.then(() => {}, () => {}); } catch {}
          return animation;
        } catch { return null; }
      },
      watch(animation) {
        if (!animation) { job.finish(); return; }
        animation.onfinish = job.finish;
        animation.oncancel = job.finish;
        // Some engines/mocks supply one completion interface but not the other.
        try { animation.finished?.then(job.finish, job.finish); } catch {}
      },
      follow(feed, anchor) {
        const position = () => anchor ? responsePosition(feed, anchor) : bottom(feed);
        position();
        if (typeof window.requestAnimationFrame !== 'function') return;
        const tick = () => {
          frame = 0;
          if (settled) return;
          if (!connected(node)) { job.finish(); return; }
          position();
          frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
      },
      finish() {
        if (settled) return;
        settled = true;
        if (frame && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
        frame = 0;
        for (const animation of animations) {
          animation.onfinish = null;
          animation.oncancel = null;
          try { animation.cancel(); } catch {}
        }
        for (const record of styles.reverse()) {
          if (!connected(record.element) || record.element.style.getPropertyValue(record.property) !== record.value) continue;
          if (record.original) record.element.style.setProperty(record.property, record.original, record.priority);
          else record.element.style.removeProperty(record.property);
        }
        for (const callback of cleanups) { try { callback(); } catch {} }
        active.delete(job);
        if (owners.get(node) === job) owners.delete(node);
        resolve();
      },
    };
    owners.set(node, job);
    active.add(job);
    return job;
  }

  function cancelAll() {
    for (const job of [...active]) job.finish();
  }

  function launch({ bubble, composer, field, feed, button, fromRect } = {}) {
    if (!connected(bubble) || reduced() || typeof bubble.animate !== 'function') {
      bottom(feed);
      return Promise.resolve();
    }
    const target = bubble.getBoundingClientRect();
    if (!target.width || !target.height) { bottom(feed); return Promise.resolve(); }
    const origin = fromRect || field?.getBoundingClientRect() || composer?.getBoundingClientRect() || target;
    const composerRect = composer?.getBoundingClientRect() || origin;
    const originTop = Number.isFinite(origin.top) ? origin.top : target.top + 84;
    const originRight = Number.isFinite(origin.right) ? origin.right : (origin.left || target.left) + (origin.width || target.width);
    const rise = clamp(originTop - target.top + 8, 68, 132);
    const shift = clamp(originRight - target.right, -24, 24);
    const widthRatio = clamp((composerRect.width || target.width) * .82 / target.width, 1.04, 1.18);
    const finalRadius = window.getComputedStyle(bubble).borderRadius || '18px';
    const job = operation(bubble);

    const animation = job.animate(bubble, [
      { transform: `translate(${shift}px,${rise}px) scale(${widthRatio},.96)`, transformOrigin: '100% 100%', borderRadius: '13px', opacity: .18, filter: 'blur(3px)', offset: 0 },
      { transform: `translate(${shift * .1}px,${rise * .1}px) scale(1.012,1.006)`, transformOrigin: '100% 100%', borderRadius: finalRadius, opacity: 1, filter: 'blur(0px)', offset: .66 },
      { transform: 'translate(0,-1px) scale(1.002,1)', transformOrigin: '100% 100%', borderRadius: finalRadius, opacity: 1, filter: 'blur(0px)', offset: .87 },
      { transform: 'none', transformOrigin: '100% 100%', borderRadius: finalRadius, opacity: 1, filter: 'blur(0px)', offset: 1 },
    ], { duration: timings.bubble, easing: ease, fill: 'both' });

    // The parent clears and autosizes the existing textarea. Animate its new
    // target height from the old rectangle while the composer's bottom stays put.
    if (connected(field) && Number.isFinite(origin.height)) {
      const inlineHeight = /px$/.test(field.style.height) ? Number.parseFloat(field.style.height) : NaN;
      const height = Number.isFinite(inlineHeight) ? inlineHeight : field.getBoundingClientRect().height;
      if (height > 0 && origin.height > height + 2) {
        job.animate(field, [{ height: `${origin.height}px` }, { height: `${height}px` }], { duration: 260, easing: ease, fill: 'both' });
      }
    }
    job.cleanup(() => bottom(feed));
    job.follow(feed);
    job.watch(animation);
    return job.promise;
  }

  function reveal({ element, feed } = {}) {
    if (!connected(element) || reduced() || typeof element.animate !== 'function') {
      responsePosition(feed, element);
      return Promise.resolve();
    }
    const fullHeight = Math.ceil(Math.max(element.scrollHeight, element.getBoundingClientRect().height));
    if (!fullHeight) { responsePosition(feed, element); return Promise.resolve(); }
    const job = operation(element);
    job.style(element, 'overflow', 'hidden');
    job.style(element, 'overflow-anchor', 'none');

    const animation = job.animate(element, [
      { height: `${Math.min(22, fullHeight)}px`, opacity: .4, filter: 'blur(.6px)' },
      { height: `${fullHeight}px`, opacity: 1, filter: 'blur(0px)' },
    ], { duration: timings.response, easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'both' });

    // A soft trailing edge for paragraphs, without wrapping/replacing text nodes
    // or disturbing the parent's delegated controls and citation links.
    [...element.querySelectorAll('p, [data-agent-reveal]')].slice(0, 8).forEach((paragraph, index) => {
      job.animate(paragraph, [
        { opacity: .12, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 280, delay: 65 + index * 42, easing: ease, fill: 'both' });
    });
    job.cleanup(() => responsePosition(feed, element));
    job.follow(feed, element);
    job.watch(animation);
    return job.promise;
  }

  function transitionDesk(element) {
    if (!connected(element)) return;
    owners.get(element)?.finish();
    if (reduced() || typeof element.animate !== 'function') return;
    const job = operation(element);
    const animation = job.animate(element, [
      { opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
    ], { duration: timings.desk, easing: ease, fill: 'both' });
    job.watch(animation);
  }

  const api = { reduced, launch, reveal, transitionDesk, cancelAll };
  Object.defineProperty(api, 'timings', { value: timings, enumerable: true });
  window.PolicyAgentMotion = api;
})();
