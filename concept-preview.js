(() => {
  'use strict';
  const data=window.PolicyConceptData,host=document.getElementById('concept-intro');
  const pause=document.querySelector('[data-concept-pause]'),skip=document.querySelector('[data-concept-skip]');
  const update=()=>{
    const state=host.dataset.conceptState;
    pause.disabled=state==='ready';pause.textContent=state==='paused'?'繼續播放':'暫停';skip.disabled=state==='ready';
    pause.setAttribute('aria-label',state==='paused'?'繼續播放概念動畫':'暫停概念動畫');
  };
  if(!data||!window.PolicyConceptMotion){
    host.dataset.conceptState='ready';
    const title=document.createElement('div');title.className='concept-title';
    const tagline=document.createElement('p');tagline.className='concept-tagline';tagline.textContent=(data?.tagline||'你的保單，付款前看清。').replace('，','，\n');title.appendChild(tagline);host.appendChild(title);
    document.querySelectorAll('[data-concept-replay],[data-concept-pause],[data-concept-skip]').forEach(button=>{button.disabled=true;});return;
  }
  const controller=window.PolicyConceptMotion.mount(host,{...data,autoplay:false,onPhase:update});
  document.querySelector('[data-concept-replay]').addEventListener('click',()=>{controller.finish();void controller.play();update();});
  pause.addEventListener('click',()=>{if(controller.state==='paused')controller.resume();else controller.pause();update();});
  skip.addEventListener('click',()=>{controller.finish();update();});
  void controller.play();update();
  window.addEventListener('pagehide',()=>controller.destroy(),{once:true});
})();
