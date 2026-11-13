/* A local mock journey. Shared components own their animation and geometry. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {1:'首要',2:'重要',3:'待確認',4:'參考'};
  const data = window.PolicyExperienceData;
  const items = data.items;
  const steps = ['policies','context','reading','discussion','checklist'];
  const panels = new Map($$('[data-exp-panel]').map(node => [node.dataset.expPanel,node]));
  const context = {destination:'Japan',traveller:'Myself',activities:['skiing']};
  const policyNotes = new Map(items.map(item => [item.id,{kept:new Set(item.findings.filter(f=>f.priority<=2).map(f=>f.id)),note:''}]));
  let policyId = items[0].id, panel = 'cover', reached = 0, dead = false;
  let routeVersion = 0, resultVersion = 0, busy = false, snapshot = null;
  let workbench = null, chat = null;
  const navigation = new Set(), cleanups = [];
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const contrast = window.matchMedia?.('(forced-colors: active)');
  const surfaces = window.PolicySurfaceMotion.mount(document);
  const buttons = window.PolicyButtonMotion.mount(document);
  const hero = window.PolicyHeroTransition.mount($('[data-hero]'), {onState(state) {
    $('[data-exp-concept-status]').textContent = state==='ready' ? '概念展示已完成。' : state==='handoff' ? '正在帶出品牌標語。' : '正在播放概念動畫。';
  }});
  const reveal = window.PolicyCompletionReveal.mount($('[data-exp-reveal]'), {onPhase(phase) {
    if (busy) $('[data-exp-result-status]').textContent = phase==='preparing' ? '正在整理已選問題……' : phase==='ready' ? '你的清單已就緒。' : '正在逐一展現你的問題……';
  }});
  const current = () => items.find(item=>item.id===policyId);
  const notes = () => policyNotes.get(policyId);
  const ranked = item => [...item.findings].sort((a,b)=>a.priority-b.priority);
  const listen = (node,event,fn) => { node.addEventListener(event,fn); cleanups.push(()=>node.removeEventListener(event,fn)); };
  const calm = () => preference?.matches || contrast?.matches || document.hidden;
  function contextLabel() {
    const activity = {skiing:'滑雪',diving:'潛水',city:'城市探索'};
    const destination = {Japan:'日本','United Kingdom':'英國','Hong Kong':'香港','Somewhere else':'其他目的地'};
    const traveller = {Myself:'我自己',Family:'家人'};
    return [destination[context.destination] || context.destination,traveller[context.traveller] || context.traveller,...context.activities.map(key=>activity[key])].join(' · ');
  }
  function marked(item) {
    const ranges = item.findings.map(f=>({f,start:item.excerpt.indexOf(f.quote)})).filter(r=>r.start>=0).sort((a,b)=>a.start-b.start);
    let cursor=0,html='';
    for(const {f,start} of ranges) {
      if(start<cursor) continue;
      html+=escape(item.excerpt.slice(cursor,start))+`<mark class="pl-marker" data-priority="${f.priority}" data-finding-id="${escape(f.id)}">${escape(f.quote)}</mark>`;
      cursor=start+f.quote.length;
    }
    return html+escape(item.excerpt.slice(cursor));
  }
  function sync() {
    $$('[data-exp-kept-count]').forEach(node=>{node.textContent=notes().kept.size;});
    $$('[data-exp-context-label]').forEach(node=>{node.textContent=contextLabel();});
    $$('[data-exp-destination]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.expDestination===context.destination)));
    $$('[data-exp-traveller]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.expTraveller===context.traveller)));
    $$('[data-exp-activity]').forEach(node=>{node.checked=context.activities.includes(node.value);});
    $$('[data-exp-keep]').forEach(node=>{const kept=notes().kept.has(node.dataset.expKeep);node.setAttribute('aria-pressed',String(kept));node.textContent=kept?'已保留問題 ✓':'保留這個問題';});
    $$('[data-exp-question]').forEach(node=>{node.checked=notes().kept.has(node.dataset.expQuestion);});
    $$('[data-exp-action="generate"]').forEach(node=>{node.disabled=busy||!notes().kept.size;node.setAttribute('aria-busy',String(busy));});
    $('[data-exp-action="cancel"]').disabled=!busy;
    $('[data-exp-result-actions]').hidden=busy||!snapshot||$('[data-exp-result]').hidden;
    $('[data-exp-selection-status]').textContent=notes().kept.size?`已從「${current().title}」選擇 ${notes().kept.size} 個問題。`:'請至少選擇一個問題。';
    $$('[data-exp-nav] [data-exp-go]').forEach(node=>{
      node.disabled=steps.indexOf(node.dataset.expGo)>reached;
      if(node.dataset.expGo===panel)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
    });
  }
  function invalidate(message='選擇已更新，可以重新生成清單。') {
    resultVersion++; reveal.cancel();busy=false;snapshot=null;
    $('[data-exp-result]').hidden=true;
    $('[data-reveal-content]').replaceChildren();
    $('[data-exp-result-status]').textContent=message;
    sync();
  }
  function renderReading() {
    const item=current();
    $$('[data-exp-policy-name]').forEach(node=>{node.textContent=item.title;});
    $('[data-exp-source-label]').textContent=item.sourceLabel;
    $('[data-exp-excerpt]').innerHTML=marked(item);
    $('[data-exp-findings]').innerHTML=ranked(item).map(f=>`<li data-finding-id="${escape(f.id)}"><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span><h4>${escape(f.title)}</h4><p>${escape(f.question)}</p><div class="sc-actions"><button type="button" data-exp-ask="${escape(f.id)}">把疑問聊清楚 ↗</button><button type="button" data-exp-keep="${escape(f.id)}" aria-pressed="false">保留這個問題</button></div></li>`).join('');
    $('[data-exp-scenarios]').innerHTML=data.scenarios(policyId,context).map(s=>`<article data-scenario-id="${escape(s.id)}"><div class="ex-scenario-meta"><span class="pl-priority" data-priority="${s.priority}">${s.priority} · ${labels[s.priority]}</span><span class="sc-small">虛構情境示例</span></div><h4>${escape(s.title)}</h4><p>${escape(s.scene)}</p><p>${escape(s.why)}</p><blockquote><mark class="pl-marker" data-priority="${s.priority}">${escape(s.quote)}</mark></blockquote><div class="sc-actions"><button type="button" data-exp-ask="${escape(s.findingId)}">就這個情境提問 ↗</button><button type="button" data-exp-keep="${escape(s.findingId)}" aria-pressed="false">保留這個問題</button></div></article>`).join('');
    $('[data-exp-note]').value=notes().note;
    $('[data-exp-question-options]').innerHTML=ranked(item).map(f=>`<label><span class="sc-check-toggle" data-liquid-control data-liquid-choice><input type="checkbox" data-exp-question="${escape(f.id)}" /></span><span><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span><br />${escape(f.question)}<small><mark class="pl-marker" data-priority="${f.priority}">${escape(f.quote)}</mark></small></span></label>`).join('');
    sync();
  }
  function activatePolicy(id) {
    if(dead||!items.some(item=>item.id===id))return;
    if(policyId!==id) { policyId=id;chat?.reset();invalidate('已切換保單，問題與原文已一併更新。'); }
    $('[data-exp-policy-status]').textContent=`已選擇：${current().title} · ${current().kind} · 虛構示例。`;
    renderReading();
  }
  chat=window.PolicyExperienceChat.mount($('[data-exp-chat]'),{getPolicy:current,getContext:()=>({...context,activities:[...context.activities]}),onSaveQuestion(finding) {
    if(!current().findings.some(f=>f.id===finding.id))return;
    notes().kept.add(finding.id);invalidate('問題已保留，準備好後可重新生成清單。');
  }});
  function mountWorkbench() {
    workbench?.destroy();
    workbench=window.PolicyWorkbench.mount($('[data-exp-workbench]'),{items,pullToken:'bookmark',onSelection:activatePolicy});
  }
  mountWorkbench();activatePolicy(policyId);
  function clearNavigation() {
    for(const animation of navigation){try{animation.cancel();}catch{}}navigation.clear();
  }
  function animatePanel(node,frames,duration) {
    if(calm()||!node.animate)return Promise.resolve();
    const a=node.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});navigation.add(a);
    return a.finished.catch(()=>{}).finally(()=>{navigation.delete(a);try{a.cancel();}catch{}});
  }
  async function go(target,{force=false}={}) {
    if(dead||!panels.has(target))return false;
    const index=steps.indexOf(target);
    if(!force&&index>reached+1)return false;
    if(target===panel) {
      routeVersion++;clearNavigation();
      panels.forEach((node,name)=>{node.hidden=name!==panel;node.inert=name!==panel;});
      sync();return true;
    }
    const token=++routeVersion;
    clearNavigation();
    panels.forEach(node=>{node.inert=node.hidden;});
    chat.settle();
    if(panel==='concept')hero.finish();
    if(panel==='policies')workbench.select(policyId);
    if(panel==='checklist'&&busy)invalidate('展示已暫停，已選問題仍然保留。');
    const outgoing=panels.get(panel);outgoing.inert=true;
    await animatePanel(outgoing,[{opacity:1},{opacity:0}],120);
    if(dead||token!==routeVersion)return false;
    panels.forEach((node,name)=>{node.hidden=name!==target;node.inert=name!==target;});
    panel=target;reached=Math.max(reached,index);
    $('[data-exp-shell]').hidden=target==='cover';
    $('[data-exp-nav]').hidden=target==='cover'||target==='concept';
    if(target==='reading'||target==='checklist')renderReading();
    sync();
    window.scrollTo?.({top:0,behavior:'instant'});
    const incoming=panels.get(target);
    // Opacity only: pull targets and composer geometry are never displaced.
    const entry=animatePanel(incoming,[{opacity:.25},{opacity:1}],300);
    if(target==='concept')hero.replay();
    await entry;
    if(dead||token!==routeVersion)return false;
    incoming.querySelector('[data-exp-heading]')?.focus({preventScroll:true});
    return true;
  }
  function keep(id,toggle=true) {
    if(!current().findings.some(f=>f.id===id))return;
    if(toggle&&notes().kept.has(id))notes().kept.delete(id);else notes().kept.add(id);
    invalidate();
  }
  async function ask(id) {
    const finding=current().findings.find(f=>f.id===id),sourcePolicy=policyId;
    if(!finding)return;
    if(await go('discussion',{force:true})&&sourcePolicy===policyId)await chat.submit(finding.question,{findingId:id});
  }
  function resultText() {
    if(!snapshot)return '';
    return ['POLICY LENS／示例保單梳理',snapshot.title,snapshot.context,'',...snapshot.findings.flatMap(f=>[`${f.priority}. ${f.question}`,`條款原文： ${f.quote}`,snapshot.source,'']),snapshot.note?`你的筆記：\n${snapshot.note}`:'','虛構示例。請在投保前逐一確認這些問題。'].join('\n');
  }
  async function generate(replay=false) {
    if(dead||busy||panel!=='checklist')return;
    if(!replay) {
      const findings=ranked(current()).filter(f=>notes().kept.has(f.id));
      if(!findings.length)return;
      snapshot={title:current().title,source:current().sourceLabel,context:contextLabel(),note:notes().note,findings:findings.map(f=>({...f}))};
    }
    if(!snapshot)return;
    const token=++resultVersion;busy=true;
    $('[data-reveal-content]').innerHTML=`<div class="completion-document-head"><span>${escape(snapshot.title)} · 虛構示例</span><span>${snapshot.findings.length} 個已選問題</span></div>${snapshot.findings.map(f=>`<article class="completion-row" data-reveal-row data-finding-id="${escape(f.id)}" data-priority="${f.priority}"><span class="completion-row-number">${String(f.priority).padStart(2,'0')}</span><div><p>${escape(f.question)}</p><blockquote><mark class="pl-marker" data-priority="${f.priority}">${escape(f.quote)}</mark></blockquote><small><span class="pl-priority" data-priority="${f.priority}">${f.priority} · ${labels[f.priority]}</span> ${escape(snapshot.source)}</small></div></article>`).join('')}<div class="completion-context"><strong>你的使用情境</strong>${escape(snapshot.context)}${snapshot.note?`<br /><br /><strong>你的筆記</strong>${escape(snapshot.note)}`:''}</div>`;
    $('[data-exp-result]').hidden=false;sync();
    $('[data-exp-result]').scrollIntoView?.({block:'start',behavior:calm()?'instant':'smooth'});
    // Start only after the scroll operation has been requested. The reveal
    // reads the actual result surface, not an incoming page transition.
    await reveal.play();
    if(dead||token!==resultVersion)return;
    busy=false;sync();$('[data-exp-result-status]').textContent='提問清單已整理好，每個問題都附有對應原文。';
  }
  async function copy() {
    const text=resultText();if(!text)return;
    try { await navigator.clipboard.writeText(text);if(!dead)$('[data-exp-result-status]').textContent='已複製提問清單。'; }
    catch { if(!dead)$('[data-exp-result-status]').textContent='目前無法複製，請改用下載清單。'; }
  }
  function download() {
    if(!snapshot)return;
    const url=URL.createObjectURL(new Blob([resultText()],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='POLICY-LENS-提問清單.txt';document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),0);
    $('[data-exp-result-status]').textContent='已準備好可下載的提問清單。';
  }
  async function restart() {
    if(dead)return;
    routeVersion++;clearNavigation();hero.finish();chat.reset();invalidate('選擇一份保單，開始新的示例梳理。');
    for(const item of items)policyNotes.set(item.id,{kept:new Set(item.findings.filter(f=>f.priority<=2).map(f=>f.id)),note:''});
    Object.assign(context,{destination:'Japan',traveller:'Myself',activities:['skiing']});policyId=items[0].id;reached=0;mountWorkbench();renderReading();
    return go('cover',{force:true});
  }
  listen(document,'click',event=>{
    const button=event.target.closest('button');if(!button||dead)return;
    if(button.dataset.expGo)void go(button.dataset.expGo);
    else if(button.dataset.expDestination){context.destination=button.dataset.expDestination;chat.reset();invalidate();renderReading();}
    else if(button.dataset.expTraveller){context.traveller=button.dataset.expTraveller;chat.reset();invalidate();renderReading();}
    else if(button.dataset.expKeep)keep(button.dataset.expKeep);
    else if(button.dataset.expAsk)void ask(button.dataset.expAsk);
    else switch(button.dataset.expAction) {
      case 'concept-play':hero.replay();break;
      case 'concept-finish':hero.finish();break;
      case 'generate':void generate();break;
      case 'replay-result':void generate(true);break;
      case 'cancel':invalidate('展示已取消，已選問題仍然保留。');break;
      case 'copy':void copy();break;
      case 'download':download();break;
      case 'restart':void restart();break;
    }
  });
  listen(document,'change',event=>{
    if(dead)return;
    if(event.target.matches('[data-exp-activity]')){context.activities=$$('[data-exp-activity]:checked').map(node=>node.value);chat.reset();invalidate();renderReading();}
    if(event.target.matches('[data-exp-question]')){const id=event.target.dataset.expQuestion;if(event.target.checked)notes().kept.add(id);else notes().kept.delete(id);invalidate();}
  });
  listen($('[data-exp-note]'),'input',event=>{notes().note=event.target.value;invalidate();});
  listen(document,'visibilitychange',()=>{
    if(!document.hidden)return;
    // Cancel geometry travel to its real destination, without changing data.
    clearNavigation();
    if(busy){resultVersion++;reveal.cancel();busy=false;sync();$('[data-exp-result-status]').textContent='你的提問清單已就緒。';}
  });
  const preferenceChanged=()=>{if(calm())clearNavigation();};
  preference?.addEventListener?.('change',preferenceChanged);contrast?.addEventListener?.('change',preferenceChanged);
  function destroy() {
    if(dead)return;dead=true;routeVersion++;resultVersion++;clearNavigation();
    hero.destroy();chat.destroy();reveal.destroy();workbench.destroy();buttons.destroy();surfaces.destroy();cleanups.forEach(fn=>fn());
    preference?.removeEventListener?.('change',preferenceChanged);contrast?.removeEventListener?.('change',preferenceChanged);
  }
  listen(window,'pagehide',event=>{if(!event.persisted)destroy();});
  panels.forEach(node=>{node.inert=node.hidden;});sync();
  window.PolicyExperience=Object.freeze({go,generate,restart,destroy,hero,chat,get workbench(){return workbench;},get state(){return {panel,policyId,context:{...context,activities:[...context.activities]},kept:[...notes().kept],note:notes().note,busy,reached,result:snapshot?{...snapshot,findings:snapshot.findings.map(f=>({...f}))}:null};}});
})();
