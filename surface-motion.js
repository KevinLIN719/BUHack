/* Frontend surface transitions only. Data, focus decisions and final states stay
 * with the component. Hidden/open commit synchronously; snapshots never act. */
(() => {
  'use strict';
  if (window.PolicySurfaceMotion) return;
  const mounts = new WeakMap();
  const owners = new WeakMap();
  const timings = Object.freeze({ enter: 240, visibility: 280, disclosure: 300, ease: 'cubic-bezier(.22,1,.36,1)' });
  const visualData = new Set(['data-priority','data-marker','data-selected','data-state','data-token','data-liquid-mounted','data-liquid-selected','data-liquid-disabled','data-liquid-pressed','data-liquid-variant']);
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const pixels = value => Number.parseFloat(value) || 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function mount(root = document) {
    if (!root?.querySelectorAll || ![1,9].includes(root.nodeType)) throw new TypeError('PolicySurfaceMotion.mount needs a Document or Element.');
    if (mounts.has(root)) return mounts.get(root);
    const doc = root.nodeType === 9 ? root : root.ownerDocument, view = doc.defaultView;
    const active = new Set(), listeners = [];
    const media = ['(prefers-reduced-motion: reduce)','(forced-colors: active)'].map(query => view.matchMedia?.(query)).filter(Boolean);
    let dead = false;
    const contains = node => node?.ownerDocument === doc && (root === node || root.contains(node));
    const connected = node => Boolean(node?.isConnected && contains(node));
    const quiet = () => doc.hidden || media.some(item => item.matches);
    const css = node => view.getComputedStyle(node);
    const height = node => Math.max(0, node.getBoundingClientRect().height);
    const opacity = node => { const value = css(node).opacity; return value === '' ? 1 : clamp(number(value, 1), 0, 1); };
    const hiddenParent = node => {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = css(parent);
        if (parent.hidden || parent.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
      }
      return false;
    };
    const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); listeners.push(() => target.removeEventListener(name, fn, options)); };

    function job(node, kind, desired) {
      owners.get(node)?.finish();
      let resolve;
      const record = { node, kind, desired, settled:false, animations:[], styles:[], cleanups:[], timer:0, ghost:null, slot:null, promise:new Promise(done => { resolve = done; }),
        style(element, property, value) {
          const existing = record.styles.find(item => item.element === element && item.property === property);
          if (existing) { element.style.setProperty(property, value); existing.value = element.style.getPropertyValue(property); return; }
          const before = element.style.getPropertyValue(property), priority = element.style.getPropertyPriority(property);
          element.style.setProperty(property, value);
          record.styles.push({element,property,before,priority,value:element.style.getPropertyValue(property)});
        },
        animate(element, frames, duration) {
          if (!element?.isConnected || typeof element.animate !== 'function') return null;
          try {
            const animation = element.animate(frames, {duration,easing:timings.ease,fill:'both'});
            record.animations.push(animation);
            animation.finished?.catch(() => {});
            return animation;
          } catch (_) { return null; }
        },
        watch(animation, duration) {
          if (!animation) { record.finish(); return; }
          animation.onfinish = record.finish;
          animation.oncancel = record.finish;
          try { animation.finished?.then(record.finish, record.finish); } catch (_) {}
          record.timer = view.setTimeout(record.finish, duration + 100);
        },
        finish() {
          if (record.settled) return;
          record.settled = true;
          view.clearTimeout(record.timer);
          record.animations.forEach(animation => { animation.onfinish = null; animation.oncancel = null; try { animation.cancel(); } catch (_) {} });
          record.styles.reverse().forEach(item => {
            if (item.element.style.getPropertyValue(item.property) !== item.value) return;
            if (item.before) item.element.style.setProperty(item.property,item.before,item.priority);
            else item.element.style.removeProperty(item.property);
          });
          record.cleanups.forEach(cleanup => { try { cleanup(); } catch (_) {} });
          active.delete(record);
          if (owners.get(node) === record) owners.delete(node);
          resolve();
        }
      };
      active.add(record); owners.set(node,record);
      return record;
    }

    function cancel(node) {
      for (const record of [...active]) if (!node || record.node === node || node.contains?.(record.node)) record.finish();
    }

    // Capture a visual, never another mounted component. Retain only attributes
    // used by the palette/control skin; selectors for real UI cannot hit it.
    function snapshot(source) {
      const clone = source.cloneNode(true), originals = [source,...source.querySelectorAll('*')], copies = [clone,...clone.querySelectorAll('*')];
      const scrolls = [];
      originals.forEach((original,index) => {
        const copy = copies[index];
        for (const attribute of Array.from(copy.attributes)) {
          const name = attribute.name;
          if (name === 'id' || name === 'role' || name === 'name' || name === 'for' || name === 'form' || name === 'href' || name === 'autofocus' || name === 'tabindex' || name.startsWith('aria-') || name.startsWith('on') || name.startsWith('data-') && !visualData.has(name)) copy.removeAttribute(name);
        }
        if (original.matches('input,textarea')) {
          try { copy.value = original.value; } catch (_) {}
          if ('checked' in copy) { copy.checked = original.checked; copy.indeterminate = original.indeterminate; }
        }
        if (original.matches('select')) [...copy.options].forEach((option,i) => { option.selected = original.options[i].selected; });
        if (copy.matches('a,button,input,textarea,select,summary,[contenteditable]')) copy.setAttribute('tabindex','-1');
        copy.removeAttribute('contenteditable');
        scrolls.push([copy,original.scrollTop,original.scrollLeft]);
      });
      clone.setAttribute('aria-hidden','true'); clone.setAttribute('inert',''); clone.inert = true;
      clone.setAttribute('data-liquid-ignore',''); clone.setAttribute('data-surface-ghost','');
      return {clone,scroll(){ scrolls.forEach(([element,top,left]) => { element.scrollTop = top; element.scrollLeft = left; }); }};
    }

    function enter(node, options = {}) {
      if (dead || !connected(node) || node.hidden || node.closest('[hidden],[inert]')) return Promise.resolve();
      const previous = owners.get(node), start = previous ? opacity(node) : null;
      previous?.finish();
      if (quiet() || typeof node.animate !== 'function' || css(node).display === 'none') return Promise.resolve();
      const duration = clamp(number(options.duration,timings.enter),0,1000);
      if (!duration) return Promise.resolve();
      const target = opacity(node), from = start ?? Math.min(target,clamp(number(options.opacity,.35),0,1));
      const distance = node.matches('input,textarea,select,button,[contenteditable]') ? 0 : clamp(number(options.distance,0),-12,12);
      const frames = [{opacity:from},{opacity:target}];
      if (distance) {
        const base = css(node).transform;
        frames[0].transform = `translateY(${distance}px) ${base === 'none' ? '' : base}`;
        frames[1].transform = base;
      }
      const current = job(node,'enter');
      current.watch(current.animate(node,frames,duration),duration);
      return current.promise;
    }

    function visibility(node, shown) {
      if (dead || !connected(node)) return Promise.resolve();
      shown = Boolean(shown);
      const previous = owners.get(node);
      if (previous?.kind === 'visibility' && previous.desired === shown) return previous.promise;
      if (node.hidden === !shown && !previous) return Promise.resolve();
      if (node.matches('input,textarea,select,button,[contenteditable]')) {
        cancel(node); node.hidden = !shown;
        return shown ? enter(node) : Promise.resolve();
      }
      const wasHidden = node.hidden;
      const startHeight = previous?.slot ? height(previous.slot) : wasHidden ? 0 : height(node);
      const startAlpha = previous?.ghost ? opacity(previous.ghost) : wasHidden ? .35 : opacity(node);
      // Clone before cancelling an entry or hiding live controls, preserving
      // current form values and the visible scroll position.
      const visual = !shown && !wasHidden && startHeight ? snapshot(node) : null;
      const box = node.getBoundingClientRect(), style = css(node);
      const margins = [style.marginTop,style.marginRight,style.marginBottom,style.marginLeft];
      const placement = {gridArea:style.gridArea,order:style.order,alignSelf:style.alignSelf,justifySelf:style.justifySelf,flexGrow:style.flexGrow,flexShrink:style.flexShrink,flexBasis:style.flexBasis};
      cancel(node);
      node.hidden = !shown;
      if (quiet() || typeof node.animate !== 'function') return Promise.resolve();
      if (shown) {
        const target = height(node), alpha = opacity(node);
        if (!target) return enter(node);
        const current = job(node,'visibility',true);
        current.style(node,'overflow','hidden'); current.style(node,'min-height','0'); current.style(node,'max-height','none'); current.style(node,'box-sizing','border-box');
        const animation = current.animate(node,[{height:`${startHeight}px`,opacity:startAlpha},{height:`${target}px`,opacity:alpha}],timings.visibility);
        current.watch(animation,timings.visibility);
        return current.promise;
      }
      if (!visual || !box.width || !startHeight) return Promise.resolve();
      const current = job(node,'visibility',false), slot = doc.createElement('div'), clone = visual.clone;
      slot.setAttribute('data-surface-slot',''); slot.setAttribute('aria-hidden','true'); slot.setAttribute('inert',''); slot.inert = true; slot.setAttribute('data-liquid-ignore','');
      Object.assign(slot.style,{position:'relative',boxSizing:'border-box',height:`${startHeight}px`,width:`${box.width}px`,maxWidth:'100%',minWidth:'0',padding:'0',border:'0',overflow:'hidden',pointerEvents:'none',marginTop:margins[0],marginRight:margins[1],marginBottom:margins[2],marginLeft:margins[3],...placement});
      Object.assign(clone.style,{position:'absolute',inset:'0 auto auto 0',boxSizing:'border-box',width:'100%',height:`${startHeight}px`,maxHeight:'none',margin:'0',pointerEvents:'none'});
      slot.append(clone); node.before(slot); visual.scroll();
      current.slot = slot; current.ghost = clone; current.cleanups.push(() => slot.remove());
      current.animate(clone,[{opacity:startAlpha},{opacity:0}],timings.visibility);
      const animation = current.animate(slot,[{height:`${startHeight}px`,marginTop:margins[0],marginBottom:margins[2]},{height:'0px',marginTop:'0px',marginBottom:'0px'}],timings.visibility);
      current.watch(animation,timings.visibility);
      return current.promise;
    }

    function disclose(details, shown) {
      const summary = Array.from(details.children).find(child => child.tagName === 'SUMMARY');
      if (!summary) { details.open = shown; return; }
      const previous = owners.get(details), startHeight = height(details), summaryBox = summary.getBoundingClientRect();
      const body = Array.from(details.children).filter(child => child !== summary);
      const priorAlpha = previous?.ghost ? opacity(previous.ghost) * number(previous.ghost.firstElementChild && css(previous.ghost.firstElementChild).opacity,1) : body[0] ? opacity(body[0]) : 1;
      let ghost, align, visibleGhostHeight;
      if (!shown && body.length && !quiet()) {
        ghost = doc.createElement('div');
        ghost.className = details.className;
        ghost.setAttribute('data-surface-ghost',''); ghost.setAttribute('data-liquid-ignore',''); ghost.setAttribute('inert',''); ghost.inert = true; ghost.setAttribute('aria-hidden','true');
        const style = css(details), box = details.getBoundingClientRect();
        Object.assign(ghost.style,{position:'fixed',left:`${box.left + pixels(style.borderLeftWidth) + pixels(style.paddingLeft)}px`,top:`${summaryBox.bottom}px`,width:`${Math.max(0,box.width-pixels(style.borderLeftWidth)-pixels(style.borderRightWidth)-pixels(style.paddingLeft)-pixels(style.paddingRight))}px`,pointerEvents:'none',zIndex:'30',display:'flow-root',margin:'0',padding:'0',border:'0',overflow:'hidden'});
        const snapshots = body.map(element => { const visual = snapshot(element); visual.clone.style.opacity = String(opacity(element)); ghost.append(visual.clone); return visual; });
        const firstTop = body[0].getBoundingClientRect().top;
        doc.body.append(ghost); snapshots.forEach(visual => visual.scroll());
        const firstOffset = ghost.firstElementChild.getBoundingClientRect().top-ghost.getBoundingClientRect().top;
        align = firstTop-firstOffset;
        ghost.style.top = `${align}px`;
        // Reversing a partly opened disclosure must not reveal the unpainted
        // tail of its full snapshot. Keep the outgoing clip at the live edge.
        visibleGhostHeight = Math.min(height(ghost),Math.max(0,box.bottom-pixels(style.borderBottomWidth)-align));
        ghost.style.height = `${visibleGhostHeight}px`;
      }
      cancel(details);
      details.open = shown;
      if (!shown && details.contains(doc.activeElement) && doc.activeElement !== summary && !summary.contains(doc.activeElement)) summary.focus({preventScroll:true});
      if (quiet() || typeof details.animate !== 'function' || !connected(details)) { ghost?.remove(); return; }
      const target = height(details);
      if (!startHeight || !target || Math.abs(startHeight-target) < .5) { ghost?.remove(); return; }
      const current = job(details,'details',shown);
      current.style(details,'overflow','hidden'); current.style(details,'min-height','0'); current.style(details,'max-height','none'); current.style(details,'box-sizing','border-box');
      if (shown) body.forEach(element => current.animate(element,[{opacity:priorAlpha < .99 ? priorAlpha : .35},{opacity:opacity(element)}],timings.disclosure));
      else if (ghost) {
        current.ghost = ghost; current.cleanups.push(() => ghost.remove());
        const ghostHeight = visibleGhostHeight ?? height(ghost);
        current.animate(ghost,[{height:`${ghostHeight}px`,opacity:1},{height:'0px',opacity:0}],timings.disclosure);
      }
      current.watch(current.animate(details,[{height:`${startHeight}px`},{height:`${target}px`}],timings.disclosure),timings.disclosure);
    }

    function click(event) {
      if (dead || event.defaultPrevented || event.button > 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const summary = event.target.closest?.('summary'), details = summary?.parentElement;
      if (!summary || details?.tagName !== 'DETAILS' || !contains(details) || details.closest('[data-surface-ghost],[data-surface-slot]')) return;
      const action = event.target.closest?.('a,button,input,select,textarea,[contenteditable]');
      if (action && summary.contains(action)) return;
      event.preventDefault(); disclose(details,!details.open);
    }
    listen(root,'click',click);
    listen(view,'resize',() => cancel());
    // Fixed disclosure snapshots cannot follow scrolling without lying about
    // their position. User scroll settles the latest native state immediately.
    listen(view,'scroll',() => { for (const record of [...active]) if (record.kind === 'details') record.finish(); },true);
    listen(doc,'visibilitychange',() => { if (doc.hidden) cancel(); });
    listen(view,'pagehide',() => cancel());
    media.forEach(item => {
      const change = () => { if (item.matches) cancel(); };
      if (item.addEventListener) listen(item,'change',change);
      else if (item.addListener) { item.addListener(change); listeners.push(() => item.removeListener(change)); }
    });
    const observer = typeof view.MutationObserver === 'function' ? new view.MutationObserver(() => {
      if (root.nodeType === 1 && !root.isConnected) { destroy(); return; }
      for (const record of [...active]) {
        const style = css(record.node);
        if (!connected(record.node) || record.node.hasAttribute('inert') || hiddenParent(record.node) || style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none' && !(record.kind === 'visibility' && !record.desired) || record.slot && !record.slot.isConnected || record.ghost && !record.ghost.isConnected || record.kind === 'enter' && record.node.hidden || record.kind === 'details' && record.node.open !== record.desired || record.kind === 'visibility' && record.node.hidden === record.desired) record.finish();
      }
    }) : null;
    observer?.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','inert','open','class','style']});
    function destroy() {
      if (dead) return;
      dead = true; cancel(); observer?.disconnect(); listeners.splice(0).forEach(remove => remove());
      if (mounts.get(root) === controller) mounts.delete(root);
    }
    const controller = Object.freeze({enter,visibility,cancel,destroy});
    mounts.set(root,controller);
    return controller;
  }
  window.PolicySurfaceMotion = Object.freeze({mount,timings});
})();
