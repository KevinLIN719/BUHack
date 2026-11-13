/* A finite viewport measurement for the editorial cover. Read the browser
 * height, never the document/iframe content height: no resize feedback loop. */
(() => {
  'use strict';
  const root=document.documentElement, property='--page-viewport-height';
  const previous=root.style.getPropertyValue(property);
  let last='',dead=false;
  function refresh() {
    if(dead)return;
    const height=Math.round(window.innerHeight||root.clientHeight||900);
    const value=`${Math.max(1,height)}px`;
    if(value!==last){root.style.setProperty(property,value);last=value;}
  }
  function destroy() {
    if(dead)return;dead=true;
    window.removeEventListener('resize',refresh);window.removeEventListener('pagehide',leave);
    if(root.style.getPropertyValue(property)===last){if(previous)root.style.setProperty(property,previous);else root.style.removeProperty(property);}
  }
  function leave(event){if(!event.persisted)destroy();}
  window.addEventListener('resize',refresh,{passive:true});window.addEventListener('pagehide',leave);
  refresh();window.PolicyViewportLayout=Object.freeze({refresh,destroy});
})();
