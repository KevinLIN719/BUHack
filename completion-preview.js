(() => {
  'use strict';
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const data=window.PolicyDemo;
  const items=['threshold','cancel','ski','proof'].map(id=>data.scenarios.find(item=>item.id===id)).filter(Boolean);
  const prompts={threshold:'剛好延誤六小時，是否符合條件？',cancel:'航班延誤後再取消，會如何處理？',ski:'休閒滑雪及初學課程是否受保？',proof:'航空公司應用程式截圖可否代替延誤證明？'};
  document.getElementById('completion-preview-list').innerHTML=items.map((item,index)=>{
    const original=data.sources.find(source=>source.id===item.sourceId);
    return `<li class="completion-row" data-reveal-row><span class="completion-row-number">${String(index+1).padStart(2,'0')}</span><div><p>${esc(prompts[item.id])}</p><small>示例條款／第 ${String(original.page).padStart(2,'0')} 頁／ ${esc(original.title)}</small></div><span class="completion-row-state">待確認</span></li>`;
  }).join('');
  const button=document.getElementById('completion-generate'),host=document.getElementById('completion-surface'),status=document.querySelector('[data-reveal-status]');
  let played=false;
  const setButtonLabel=text=>{
    const label=document.createElement('span');label.textContent=text;button.replaceChildren(label);
    if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&typeof label.animate==='function'){
      const animation=label.animate([{opacity:.35,filter:'blur(2px)'},{opacity:1,filter:'blur(0px)'}],{duration:180,easing:'ease-out'});
      animation.finished?.then(()=>animation.cancel(),()=>{});
    }
  };
  const controller=window.PolicyCompletionReveal.mount(host,{onPhase:phase=>{
    const busy=phase!=='ready';button.disabled=busy;button.setAttribute('aria-busy',String(busy));host.setAttribute('aria-busy',String(busy));
    setButtonLabel(phase==='preparing'?'準備中……':phase==='revealing'?'產生中……':played?'重新產生 ↗':'產生確認清單 ↗');
    status.textContent=phase==='preparing'?'正在準備確認清單……':phase==='revealing'?'正在把內容整理在一起……':played?`${items.length} 條問題已整理好。`:'已就緒，按下按鈕產生確認清單。';
  }});
  const content=host.querySelector('[data-reveal-content]');content.setAttribute('aria-hidden','true');content.setAttribute('inert','');
  button.addEventListener('click',()=>{played=true;document.querySelector('.completion-preview-stage').classList.add('has-generated');content.removeAttribute('aria-hidden');content.removeAttribute('inert');host.scrollTop=0;void controller.play();});
  window.addEventListener('pagehide',()=>controller.destroy(),{once:true});
})();
