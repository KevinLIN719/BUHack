/*
 * Three generic visual templates. The backend picks one via `visual.kind`
 * and fills parameters — no per-case animation code.
 *   threshold: a slider across a limit (hours, days…)
 *   split:     a headline amount breaking into what is actually paid
 *   branch:    switching between circumstances with different outcomes
 * Each returns { el, play(), destroy() }.
 */
(() => {
  const PL = window.PL;
  const { h } = PL;
  const anim = () => window.gsap && !PL.reduced;

  /* ---------- threshold ---------- */
  const fmt = (v, format) => {
    if (format === 'hm') {
      const total = Math.round(v * 60);
      const hh = Math.floor(total / 60);
      const mm = total % 60;
      return PL.t(`${hh} 小時 ${String(mm).padStart(2, '0')} 分`, `${hh}h ${String(mm).padStart(2, '0')}m`);
    }
    if (format === 'day') return PL.t(`第 ${Math.round(v)} 日`, `Day ${Math.round(v)}`);
    return PL.t(`${Math.round(v)} 日`, `${Math.round(v)} days`);
  };

  const limitLabel = (v) => (v.format === 'hm' ? PL.t(`${v.limit} 小時`, `${v.limit}h`) : v.format === 'day' ? PL.t(`第 ${v.limit} 日`, `Day ${v.limit}`) : PL.t(`${v.limit} 日`, `${v.limit} days`));

  function threshold(v) {
    const range = v.max - v.min;
    const pct = (x) => ((x - v.min) / range) * 100;
    const eps = v.step / 2;
    const sideOf = (x) => (Math.abs(x - v.limit) < eps ? 'at' : x > v.limit ? 'above' : 'below');

    const fill = h('div', { class: 'th-fill' });
    const okZone = h('div', { class: `th-zone ${v.okSide === 'above' ? 'is-right' : 'is-left'}`, style: v.okSide === 'above' ? `left:${pct(v.limit)}%;right:0` : `left:0;width:${pct(v.limit)}%` });
    const ticks = v.rate
      ? Array.from({ length: Math.floor(v.max / v.rate.every) }, (_, i) => (i + 1) * v.rate.every)
          .filter((x) => x !== v.limit)
          .map((x) => h('span', { class: 'th-tick', style: `left:${pct(x)}%` }))
      : [];
    const limitMark = h('div', { class: 'th-limit', style: `left:${pct(v.limit)}%` }, h('span', {}, limitLabel(v)));
    const knob = h('div', { class: 'th-knob' });
    const input = h('input', { type: 'range', min: v.min, max: v.max, step: v.step, value: v.value, 'aria-label': PL.tx(v.unit) });
    const track = h('div', { class: 'th-track' }, okZone, ...ticks, fill, limitMark, knob);

    const valueEl = h('strong', { class: 'th-value' });
    const pill = h('span', { class: 'th-pill' });
    const payNum = h('strong', { class: 'th-pay-num' });
    const pay = v.rate ? h('div', { class: 'th-pay' }, h('span', {}, PL.t('可賠', 'Pays')), payNum) : null;
    const playBtn = h('button', { type: 'button', class: 'mini-btn', onclick: () => play(true) }, '▶ ', PL.t('拖一次給我看', 'Show me'));

    const el = h('div', { class: 'vz vz-th' },
      h('div', { class: 'th-head' }, h('span', { class: 'th-unit' }, PL.tx(v.unit)), valueEl, pill),
      h('div', { class: 'th-rail' }, track, input),
      h('div', { class: 'th-foot' }, pay, playBtn));

    let lastSide = null;
    let payShown = 0;
    let tween = null;

    const payout = (x, side) => {
      if (!v.rate || side === 'below') return 0;
      const n = side === 'at' ? 1 : Math.floor((x - 1e-6) / v.rate.every);
      return Math.min(v.rate.cap, n * v.rate.amount);
    };

    function render(x) {
      const p = pct(x);
      fill.style.width = `${p}%`;
      knob.style.left = `${p}%`;
      valueEl.textContent = fmt(x, v.format);
      const side = sideOf(x);
      const out = v.outcomes[side];
      el.dataset.side = side;
      if (side !== lastSide) {
        pill.className = `th-pill st-${out.status}`;
        pill.textContent = PL.tx(out.text);
        if (lastSide && anim()) gsap.fromTo(pill, { scale: 0.7, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' });
        lastSide = side;
      }
      if (pay) {
        const target = payout(x, side);
        pay.classList.toggle('is-uncertain', side === 'at');
        if (target !== payShown) {
          const from = { n: payShown };
          payShown = target;
          if (anim()) gsap.to(from, { n: target, duration: 0.4, onUpdate: () => { payNum.textContent = PL.money(from.n) + (side === 'at' ? ' ?' : ''); } });
          else payNum.textContent = PL.money(target);
          if (anim()) gsap.fromTo(payNum, { y: -6 }, { y: 0, duration: 0.3, ease: 'power2.out' });
        } else payNum.textContent = PL.money(target) + (side === 'at' ? ' ?' : '');
      }
    }

    input.addEventListener('input', () => { tween?.kill(); render(Number(input.value)); });
    input.addEventListener('pointerdown', () => el.classList.add('is-drag'));
    input.addEventListener('pointerup', () => el.classList.remove('is-drag'));

    function play(full = false) {
      if (!anim()) { render(v.value); return; }
      tween?.kill();
      const o = { x: full ? v.min : Math.max(v.min, v.limit - range * 0.25) };
      const stops = full ? [v.limit, v.max, v.value] : [v.value];
      const tl = gsap.timeline();
      stops.forEach((s, i) => tl.to(o, {
        x: s, duration: full ? [1.4, 1.6, 1.1][i] : 1.1, ease: i === 0 ? 'power2.inOut' : 'power3.inOut',
        onUpdate: () => { const snapped = Math.round(o.x / v.step) * v.step; input.value = snapped; render(snapped); },
      }, i ? '+=0.35' : 0));
      tween = tl;
    }

    render(v.value);
    return { el, play: () => play(false), destroy: () => tween?.kill() };
  }

  /* ---------- split ---------- */
  function split(v) {
    const paid = v.segments.reduce((s, x) => s + x.value, 0);
    const rest = Math.max(0, v.total - paid);
    let left = 0;
    const segEls = v.segments.map((s) => {
      const w = (s.value / v.total) * 100;
      const seg = h('div', { class: `sp-seg tone-${s.tone}`, style: `left:${left}%;width:${w}%` },
        h('span', { class: 'sp-seg-amt' }, PL.money(s.value)),
        h('span', { class: 'sp-seg-lbl' }, PL.tx(s.label)));
      left += w;
      return seg;
    });
    const restEl = rest
      ? h('div', { class: 'sp-rest', style: `left:${left}%;right:0` },
          h('span', { class: 'sp-seg-amt' }, PL.money(rest)), h('span', { class: 'sp-seg-lbl' }, PL.tx(v.restLabel)))
      : null;
    const whole = h('div', { class: 'sp-whole' }, h('span', {}, PL.tx(v.totalLabel)), h('strong', {}, PL.money(v.total)));
    const bar = h('div', { class: 'sp-bar' }, ...segEls, restEl, whole);
    const paidOnly = v.segments.filter((s) => s.tone === 'paid').reduce((s, x) => s + x.value, 0);
    const resultNum = h('strong', {}, PL.money(paidOnly));
    const result = h('div', { class: 'sp-result' }, h('span', {}, PL.t('實際最多賠', 'Actually pays at most')), resultNum);
    const replay = h('button', { type: 'button', class: 'mini-btn', onclick: () => play() }, '↺ ', PL.t('再看一次', 'Replay'));
    const el = h('div', { class: 'vz vz-sp' }, bar, h('div', { class: 'sp-foot' }, result, replay));
    let tl = null;

    function play() {
      if (!anim()) { whole.style.opacity = 0; return; }
      tl?.kill();
      const parts = [...segEls, restEl].filter(Boolean);
      const count = { n: v.total };
      tl = gsap.timeline()
        .set(whole, { opacity: 1, scale: 1, x: 0 })
        .set(parts, { opacity: 0, y: 0, rotate: 0 })
        .set(resultNum, { textContent: PL.money(v.total) })
        .to(whole, { x: -4, duration: 0.06, repeat: 5, yoyo: true, ease: 'none' }, 0.35)
        .to(whole, { opacity: 0, scaleY: 0.6, duration: 0.3, ease: 'power2.in' })
        .fromTo(segEls, { opacity: 0, y: -26, rotate: () => gsap.utils.random(-6, 6) }, { opacity: 1, y: 0, rotate: 0, duration: 0.6, stagger: 0.09, ease: 'back.out(2)' }, '-=0.1')
        .to(count, { n: paidOnly, duration: 0.9, ease: 'power2.out', onUpdate: () => { resultNum.textContent = PL.money(count.n); } }, '<');
      if (restEl) tl.fromTo(restEl, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power3.out' }, '-=0.5');
      tl.fromTo(result, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1 });
    }

    if (!anim()) whole.style.opacity = 0;
    return { el, play, destroy: () => tl?.kill() };
  }

  /* ---------- branch ---------- */
  function branch(v, initial = 0) {
    let current = -1;
    const buttons = v.options.map((o, i) =>
      h('button', { type: 'button', role: 'radio', class: 'br-opt', onclick: () => select(i) }, PL.tx(o.label)));
    const indicator = h('span', { class: 'br-ind', 'aria-hidden': 'true' });
    const stampSlot = h('div', { class: 'br-stamp' });
    const note = h('p', { class: 'br-note' });
    const el = h('div', { class: 'vz vz-br' },
      h('p', { class: 'br-prompt' }, PL.tx(v.prompt)),
      h('div', { class: 'br-opts', role: 'radiogroup' }, indicator, ...buttons),
      h('div', { class: 'br-out' }, stampSlot, note));

    function moveIndicator(i, animate) {
      const b = buttons[i];
      if (!b.offsetWidth) return;
      const props = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight };
      if (animate && anim()) gsap.to(indicator, { ...props, duration: 0.45, ease: 'power3.out' });
      else Object.assign(indicator.style, { transform: `translate(${props.x}px, ${props.y}px)`, width: `${props.width}px`, height: `${props.height}px` });
    }

    function select(i, animate = true) {
      if (i === current) return;
      current = i;
      const o = v.options[i];
      buttons.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
      el.dataset.status = o.status;
      moveIndicator(i, animate);
      const st = PL.stamp(o.status);
      stampSlot.replaceChildren(st);
      note.textContent = PL.tx(o.note);
      if (animate) {
        PL.stampIn(st);
        if (anim()) gsap.fromTo(note, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
      }
    }

    const ro = new ResizeObserver(() => current >= 0 && moveIndicator(current, false));
    ro.observe(el);
    select(initial, false);

    return {
      el,
      play: () => {
        // Walk through every option once, ending on the most telling one.
        const order = v.options.map((_, i) => i).concat(initial);
        order.forEach((i, k) => setTimeout(() => select(i), k * 900));
      },
      destroy: () => ro.disconnect(),
    };
  }

  PL.visual = (v, opts) => {
    if (!v) return null;
    if (v.kind === 'threshold') return threshold(v);
    if (v.kind === 'split') return split(v);
    if (v.kind === 'branch') {
      // Land on the option that matches the scenario's verdict, else the first risky one.
      const byStatus = v.options.findIndex((o) => o.status === opts?.status);
      const risky = v.options.findIndex((o) => o.status !== 'covered');
      return branch(v, byStatus >= 0 ? byStatus : Math.max(0, risky));
    }
    return null;
  };
})();
