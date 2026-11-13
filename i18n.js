(() => {
  'use strict';
  const dictionaries = window.PolicyTranslations;
  const valid = value => Object.hasOwn(dictionaries, value || '');
  const saved = () => { try { return localStorage.getItem('policy-language'); } catch { return null; } };
  const preferred = () => {
    for (const value of navigator.languages || [navigator.language]) {
      if (/^en(?:-|$)/i.test(value)) return 'en';
      if (/^zh(?:-|$)/i.test(value)) return /(?:Hant|HK|TW|MO)/i.test(value) ? 'zh-HK' : 'zh-CN';
    }
    return 'zh-HK';
  };
  const resolve = () => {
    const query = new URL(location.href).searchParams.get('lang');
    return valid(query) ? query : valid(saved()) ? saved() : preferred();
  };
  let language = resolve();
  document.documentElement.lang = language;
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const entries = Object.entries(dictionaries['zh-HK']).sort((a,b) => b[1].length-a[1].length);
  const translate = value => {
    const exact = entries.find(([,source]) => source === value);
    if (exact) return dictionaries[language][exact[0]];
    // Only exact phrases are replaced; user-authored content is excluded below.
    return value;
  };
  let menu;
  function update() {
    observer.disconnect();
    document.documentElement.lang = language;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,textarea,input,select,[contenteditable], [data-i18n-ignore]')) continue;
      const previous = originals.get(node);
      const source = previous && node.data === previous.output ? previous.source : node.data;
      const key = parent.dataset.i18n;
      const core = source.trim();
      const translated = key && dictionaries[language][key] && parent.childNodes.length === 1 ? dictionaries[language][key] : translate(core);
      const output = core ? source.replace(core, translated) : source;
      originals.set(node, {source, output});
      if (node.data !== output) node.data = output;
      const match = entries.find(([,value]) => value === core);
      if (match && parent.childNodes.length === 1) parent.dataset.i18n = match[0];
    }
    document.querySelectorAll('[placeholder],[title],[alt],[aria-label],meta[name="description"]').forEach(element => {
      let record = attributes.get(element);
      if (!record) { record = {}; attributes.set(element, record); }
      for (const attr of ['placeholder','title','alt','aria-label','content']) {
        if (!element.hasAttribute(attr) || (attr === 'content' && !element.matches('meta[name="description"]'))) continue;
        const current = element.getAttribute(attr), old = record[attr];
        const source = old && old.output === current ? old.source : current;
        const key = element.getAttribute('data-i18n-' + attr);
        const output = dictionaries[language][key] || translate(source);
        record[attr] = {source,output};
        if (current !== output) element.setAttribute(attr,output);
      }
    });
    document.querySelectorAll('a[href]').forEach(anchor => {
      const raw = anchor.getAttribute('href');
      if (!raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(raw) || anchor.hasAttribute('download')) return;
      const url = new URL(raw,location.href);
      if (url.origin !== location.origin || !/(?:\/|\.html?)$/.test(url.pathname)) return;
      url.searchParams.set('lang',language);
      if (anchor.href !== url.href) anchor.href = url.href;
    });
    if (menu) menu.value = language;
    observer.observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','alt','aria-label','href']});
  }
  const observer = new MutationObserver(update);
  function choose(value) {
    if (!valid(value)) return;
    language = value;
    try { localStorage.setItem('policy-language',language); } catch { /* Storage may be disabled. */ }
    const url = new URL(location.href); url.searchParams.set('lang',language);
    history.pushState(null,'',url);
    update();
  }
  function mount() {
    if (!document.body || document.querySelector('.language-picker')) return;
    const host = document.querySelector('.masthead-end,nav,header,.sc-header,.sc-nav') || document.body;
    const label = document.createElement('label'); label.className='language-picker'; label.dataset.i18nIgnore='';
    label.append(document.createTextNode('🌐 '));
    menu = document.createElement('select'); menu.setAttribute('aria-label','Language / 语言 / 語言');
    for (const [value,text] of [['en','English'],['zh-CN','简体中文'],['zh-HK','繁體中文']]) menu.add(new Option(text,value));
    menu.value=language; menu.addEventListener('change',() => choose(menu.value));
    label.append(menu); host.append(label); update();
  }
  document.addEventListener('DOMContentLoaded',() => {
    mount();
    const remount = new MutationObserver(() => { if (!document.querySelector('.language-picker')) mount(); });
    remount.observe(document.body,{childList:true,subtree:true});
  });
  window.addEventListener('popstate',() => { language=resolve(); update(); });
  window.PolicyI18n={setLanguage:choose,get language(){return language;},refresh:update};
})();
