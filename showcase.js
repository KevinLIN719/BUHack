/* Page integration only: controllers keep their own rendering and motion. */
(() => {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const destinationLabels = {'Japan':'日本','United Kingdom':'英國','Hong Kong':'香港','Somewhere else':'其他地方'};
  const labels = {1:'首要',2:'重要',3:'待確認',4:'參考'};
  const byPriority = findings => [...findings].sort((a,b)=>a.priority-b.priority);
  const $ = selector => document.querySelector(selector);
  const cleanups = [];
  let destroyed = false, generation = 0, busy = false, snapshot = [];
  const fixtures = window.PolicyFixtures?.items || [];
  let current = fixtures[0] || null;
  let selected = new Set(current?.findings.map(item=>item.id));
  const surfaces = window.PolicySurfaceMotion?.mount(document);
  const hero = window.PolicyHeroTransition.mount($('[data-hero]'), { onState(state) { $('[data-hero-status]').textContent = state === 'ready' ? '概念介紹已完成。' : state === 'handoff' ? '正在帶出品牌標語。' : '概念介紹播放中。'; } });
  const reveal = window.PolicyCompletionReveal.mount($('[data-showcase-reveal]'), { onPhase(phase) { if (phase !== 'ready') $('[data-checklist-status]').textContent = phase === 'preparing' ? '正在整理所選示例問題……' : '讓重要問題逐一浮現……'; } });
  const chat = window.PolicyShowcaseChat.mount($('[data-showcase-chat]'), { onQuestion(question) { const note = $('[data-review-note]'); note.value = `${note.value}${note.value ? '\n' : ''}• ${question}`; } });
  const buttons = window.PolicyButtonMotion?.mount(document);
  function listen(node,event,callback) { node.addEventListener(event,callback); cleanups.push(()=>node.removeEventListener(event,callback)); }
  function syncButtons() {
    $('[data-checklist-generate]').disabled = busy || !selected.size;
    $('[data-checklist-generate]').setAttribute('aria-busy', String(busy));
    $('[data-checklist-replay]').disabled = busy || !snapshot.length;
    $('[data-checklist-cancel]').disabled = !busy;
  }
  function resetResult(message = '已更新選擇，請重新生成清單。') {
    const wasBusy = busy;
    generation++; reveal.cancel(); busy = false; snapshot = [];
    const result = $('[data-checklist-result]');
    if (surfaces && !wasBusy && !result.hidden) surfaces.visibility(result, false);
    else { surfaces?.cancel(result); result.hidden = true; }
    $('[data-reveal-content]').replaceChildren();
    $('[data-checklist-status]').textContent = message;
    syncButtons();
  }
  function updatePolicy(id) {
    const item = fixtures.find(item=>item.id===id);
    if (!item || current?.id===id && $('[data-wording-excerpt]').hasChildNodes()) return;
    current = item; selected = new Set(item.findings.map(f=>f.id));
    $('[data-policy-status]').textContent = `已選虛構保單：${item.title}。原文與問題亦同步顯示於第 02 及 06 區。`;
    $('[data-wording-source]').textContent = `${item.title} · ${item.sourceLabel}`;
    const ranges = item.findings.map(f=>({start:item.excerpt.indexOf(f.quote),end:item.excerpt.indexOf(f.quote)+f.quote.length,f})).filter(r=>r.start>=0).sort((a,b)=>a.start-b.start);
    let cursor = 0, html = '';
    for (const {start,end,f} of ranges) {
      if (start<cursor) continue;
      html += `${escape(item.excerpt.slice(cursor,start))}<mark class="pl-marker" data-priority="${f.priority}" data-finding-id="${escape(f.id)}">${escape(f.quote)}</mark>`; cursor = end;
    }
    $('[data-wording-excerpt]').innerHTML = html + escape(item.excerpt.slice(cursor));
    $('[data-wording-findings]').innerHTML = byPriority(item.findings).map(f=>`<div class="sc-finding"><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span><p>${escape(f.title)}<br />${escape(f.question)}</p></div>`).join('');
    $('[data-checklist-policy]').textContent = `${item.title}的問題 · 虛構示例`;
    $('[data-checklist-options]').innerHTML = byPriority(item.findings).map(f=>`<label><span class="sc-check-toggle" data-liquid-control data-liquid-choice><input type="checkbox" data-checklist-choice value="${escape(f.id)}" checked /></span><span><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span> ${escape(f.question)}</span></label>`).join('');
    for (const selector of ['[data-wording-excerpt]','[data-wording-findings]','[data-checklist-options]']) surfaces?.enter($(selector));
    resetResult('選擇你想帶去確認的問題。');
  }
  const workbench = window.PolicyWorkbench && fixtures.length ? window.PolicyWorkbench.mount($('[data-policy-workbench]'), { items:fixtures, pullToken:'bookmark', onSelection(id) { updatePolicy(id); } }) : null;
  $('[data-policy-pull-replay]').disabled = !workbench?.selectedId;
  if (current) updatePolicy(current.id);
  else { $('[data-policy-status]').textContent = '示例資料及工作台暫不可用；此區需要 PolicyWorkbench 模組。'; $('[data-checklist-status]').textContent = '生成清單前需要先載入示例保單資料。'; syncButtons(); }
  const paletteNames = ['Purple','Pink','Cherry','Red','Vermilion','Orange','Amber','Yellow','Lime','Shamrock','Green','Teal','Mint','Turquoise','Sky','Blue','Indigo','Sapphire','Violet','Grape'];
  $('[data-marker-palette]').innerHTML = paletteNames.map((name,index)=>`<div class="sc-swatch"><mark class="pl-marker" data-marker="${index+1}">${escape(name)}</mark><small>${String(index+1).padStart(2,'0')}／文字＋底色</small></div>`).join('');
  $('[data-market-sources]').innerHTML = window.PolicyConceptData.insurers.map(item=>`<li><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.name)} ↗</a></li>`).join('');
  async function generate(replay = false) {
    if (busy || destroyed) return;
    if (!replay) snapshot = current ? byPriority(current.findings.filter(f=>selected.has(f.id))).map(f=>({...f,policyTitle:current.title,sourceLabel:current.sourceLabel})) : [];
    if (!snapshot.length) return;
    const token = ++generation;
    busy = true; syncButtons();
    // Retain the native checkbox state when replaying the same generated sheet.
    if (!replay) $('[data-reveal-content]').innerHTML = `<div class="completion-document-head"><span>${escape(snapshot[0].policyTitle)}／示例問題</span><span>已選 ${snapshot.length} 題</span></div><ul class="completion-list">${snapshot.map(f=>`<li class="completion-row" data-reveal-row data-priority="${f.priority}" data-finding-id="${escape(f.id)}"><label class="completion-item"><input type="checkbox" class="completion-checkbox" aria-label="已確認：${escape(f.question)}" /><span class="completion-item-content">${escape(f.question)}</span></label><details class="completion-source"><summary>條款與出處</summary><blockquote class="sc-result-quote"><mark class="pl-marker" data-priority="${f.priority}">${escape(f.quote)}</mark></blockquote><small><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span> ${escape(f.sourceLabel)}</small></details></li>`).join('')}</ul>`;
    surfaces?.cancel($('[data-checklist-result]'));
    $('[data-checklist-result]').hidden = false;
    $('[data-showcase-reveal]').scrollTop = 0;
    await reveal.play();
    if (destroyed || token !== generation) return;
    busy = false; syncButtons();
    $('[data-checklist-status]').textContent = `已整理 ${snapshot.length} 個問題。可逐項勾選記錄確認進度，或展開條款與出處。`;
  }
  listen(document,'click',event=>{
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-hero-replay')) hero.replay();
    if (button.hasAttribute('data-hero-finish')) hero.finish();
    if (button.dataset.destination) {
      document.querySelectorAll('[data-destination]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      $('[data-control-status]').textContent = `目的地：${destinationLabels[button.dataset.destination] || button.dataset.destination}`;
    }
    if (button.hasAttribute('data-note-add')) { const note=$('[data-review-note]'); note.value += `${note.value?'\n':''}• 投保前先確認條款。`; note.focus(); }
    if (button.hasAttribute('data-mark-section')) { const pressed=button.getAttribute('aria-pressed')==='true'; button.setAttribute('aria-pressed',String(!pressed)); $('[data-control-status]').textContent = pressed ? '已取消分區標記。' : '已標記此分區，稍後可再閱讀。'; }
    if (button.hasAttribute('data-checklist-generate')) generate();
    if (button.hasAttribute('data-policy-pull-replay')) workbench?.inspect(workbench.selectedId);
    if (button.hasAttribute('data-checklist-replay')) generate(true);
    if (button.hasAttribute('data-checklist-cancel')) {
      generation++; reveal.cancel(); busy=false; syncButtons();
      $('[data-checklist-status]').textContent='展示已停止，清單與確認進度已保留。';
    }
  });
  listen($('[data-checklist-options]'),'change',event=>{
    if (!event.target.matches('[data-checklist-choice]')) return;
    if(event.target.checked) selected.add(event.target.value); else selected.delete(event.target.value);
    resetResult(selected.size ? '已更新選擇，請重新生成清單。' : '請至少選一個問題，才能生成清單。');
  });
  const visibility = () => { if (document.hidden && busy) { generation++; reveal.cancel(); busy=false; syncButtons(); $('[data-checklist-status]').textContent='頁面隱藏時已收起動畫，問題清單已就緒。'; } };
  listen(document,'visibilitychange',visibility);
  function destroy() {
    if(destroyed) return; destroyed=true; generation++;
    hero.destroy(); chat.destroy(); reveal.destroy(); workbench?.destroy(); buttons?.destroy();
    surfaces?.destroy();
    cleanups.forEach(fn=>fn());
  }
  listen(window,'pagehide',event=>{ if(!event.persisted) destroy(); });
  window.PolicyShowcase = Object.freeze({ hero, chat, workbench, generate, destroy, get selectedPolicyId(){return current?.id;}, get selectedFindingIds(){return [...selected];} });
  hero.play();
})();
