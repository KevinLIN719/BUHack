(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storageKey = 'policy-lens-live-review';
  const labels = {queued:'等待處理',parsing:'正在逐頁提取',ready:'原文已可查看',partial:'部分頁面可讀',needs_ocr:'沒有可提取文字，需要識別或確認空白頁',failed:'解析失敗'};
  const roles = {contract:'合同',schedule:'附表',endorsement:'批單',promotion:'宣傳',broker_reply:'經紀回覆'};
  const errors = {PAGE_LIMIT:'超過 30 頁，請上傳較短的文件。',PASSWORD_REQUIRED:'文件已加密，請上傳無密碼版本。',INVALID_PDF:'文件損壞或不是有效 PDF。',PARSE_TIMEOUT:'解析逾時，請刪除後重試。',PARSER_FAILED:'未能提取文字，請嘗試其他 PDF。'};
  let reviewId, docs = [], selected, pageNumber = 1, viewKey = '', epoch = 0, pageEpoch = 0, timer, busy = false;
  const status = text => { $('status').textContent = text; };
  const remember = value => { try { value ? localStorage.setItem(storageKey,value) : localStorage.removeItem(storageKey); } catch {} };
  const node = (tag, text, className) => { const el = document.createElement(tag); if(text !== undefined) el.textContent=text; if(className) el.className=className; return el; };
  async function api(path, options = {}) {
    let response;
    try { response = await fetch('/api' + path, {credentials:'same-origin',signal:AbortSignal.timeout(30000),...options}); }
    catch { throw new Error('無法連接服務，請確認前端和後端均已啟動，再按重新整理。'); }
    if (!response.ok) {
      const body = await response.json().catch(()=>({}));
      const error = new Error(body.error?.message || '暫時未能處理，請重試。'); error.status=response.status; throw error;
    }
    return response.status===204 ? null : response.json();
  }
  function lock(value) { busy=value; $('upload-button').disabled=value; $('delete-review').disabled=value; }
  function clearReader() { pageEpoch++; viewKey=''; $('reader-controls').hidden=true; $('page-text').textContent=''; $('sources').replaceChildren(); $('page-status').textContent=''; }
  function renderDocs() {
    $('documents').replaceChildren(); $('empty').hidden=docs.length>0;
    for (const doc of docs) {
      const item=node('li'), open=node('button',doc.name,'doc-open'); open.type='button'; open.setAttribute('aria-pressed',String(selected===doc.id));
      open.addEventListener('click',()=>{selected=doc.id;pageNumber=1;viewKey='';renderDocs();void openDocument(doc).catch(error=>status(error.message));});
      const meta=node('p',`${roles[doc.role]} · ${labels[doc.status]}${doc.pageCount ? ` · ${doc.pageCount} 頁` : ''}`,'doc-meta');
      const remove=node('button','刪除','secondary doc-delete'); remove.type='button';remove.disabled=busy;
      remove.setAttribute('aria-label',`刪除 ${doc.name}`);
      remove.addEventListener('click',async()=>{
        if(busy || !confirm(`刪除「${doc.name}」及其原文？`)) return;
        lock(true);epoch++;clearTimeout(timer);
        try {await api(`/reviews/${reviewId}/documents/${doc.id}`,{method:'DELETE'}); if(selected===doc.id){selected=null;clearReader();} await refresh();status('材料已刪除。');}
        catch(error){status(error.message);}finally{lock(false);renderDocs();}
      });
      item.append(open,meta);if(doc.errorCode)item.append(node('p',errors[doc.errorCode] || '未能完成解析，請重新上傳。','doc-meta'));
      item.append(remove);$('documents').append(item);
    }
  }
  async function openPage() {
    const token=++pageEpoch, id=selected, review=reviewId, index=pageNumber;
    $('page-text').textContent='';$('sources').replaceChildren();$('page-status').textContent='正在讀取原文……';
    $('original').href=`/api/reviews/${review}/documents/${id}/content#page=${index}`;
    try {
      const page=await api(`/reviews/${review}/documents/${id}/pages/${index}`);
      if(token!==pageEpoch || id!==selected || review!==reviewId)return;
      $('page-status').textContent=`PDF 第 ${page.pageIndex} 頁${page.printedPageLabel ? ` · 文件頁標籤 ${page.printedPageLabel}` : ''} · ${labels[page.status]}`;
      $('page-text').textContent=page.text || '本頁未取得文字，請打開原 PDF 查看。';
      for(const source of page.sources){const detail=node('details'),summary=node('summary',`原文出處 · 第 ${page.pageIndex} 頁`),quote=node('blockquote',source.quote),code=node('code',source.sourceId);detail.append(summary,quote,code);$('sources').append(detail);}
    } catch(error){if(token===pageEpoch)$('page-status').textContent=error.message;}
  }
  async function openDocument(doc) {
    const key=`${doc.id}:${doc.status}:${doc.pageCount}`;if(viewKey===key)return;viewKey=key;
    clearReader();viewKey=key;const token=pageEpoch;
    $('reader-note').textContent=`${doc.name} · ${labels[doc.status]}`;
    let details;
    try { details=await api(`/reviews/${reviewId}/documents/${doc.id}`); } catch(error) { if(token===pageEpoch)viewKey=''; throw error; }
    if(selected!==doc.id || token!==pageEpoch)return;
    if(!details.pages.length){$('page-status').textContent=errors[doc.errorCode] || '完成提取後，頁碼會顯示在這裏。';return;}
    $('reader-controls').hidden=false;$('page').replaceChildren();
    for(const page of details.pages){const option=node('option',`第 ${page.pageIndex} 頁 · ${labels[page.status]}`);option.value=page.pageIndex;$('page').append(option);}
    pageNumber=Math.min(pageNumber,details.pages.length);$('page').value=String(pageNumber);await openPage();
  }
  async function refresh() {
    clearTimeout(timer);const token=epoch;
    const review=await api(`/reviews/${reviewId}`);if(token!==epoch)return;
    docs=review.documents;if(!docs.some(doc=>doc.id===selected)){selected=docs[0]?.id;pageNumber=1;viewKey='';}
    renderDocs();if(selected)await openDocument(docs.find(doc=>doc.id===selected));else{clearReader();$('reader-note').textContent='選擇一份材料，查看其原文。';}
    if(token!==epoch)return;
    const pending=docs.some(doc=>['queued','parsing'].includes(doc.status));
    status(pending?'材料已收到，正在提取原文……':docs.length?'材料已保存。選擇文件和頁碼查看原文。':'準備好了，請加入一份 PDF。');
    document.dispatchEvent(new CustomEvent('policy-review-changed',{detail:{reviewId,revision:review.revision,ready:docs.filter(doc=>['ready','partial'].includes(doc.status)).length}}));
    if(pending)timer=setTimeout(()=>void refresh().catch(error=>status(error.message)),1000);
  }
  async function connect() {
    if(location.protocol==='file:'){ $('offline').hidden=false;lock(true);return; }
    if(!reviewId){try{reviewId=localStorage.getItem(storageKey);}catch{}}
    if(reviewId){try{await refresh();return;}catch(error){if(error.status!==404)throw error;reviewId=null;remember(null);}}
    const review=await api('/reviews',{method:'POST'});reviewId=review.id;remember(reviewId);await refresh();
  }
  $('upload-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const file=$('file').files[0];if(!file)return;
    if(!/\.pdf$/i.test(file.name)){status('請選擇 PDF 文件。');return;}
    if(file.size>10*1024*1024){status('單份 PDF 不能超過 10 MB。');return;}
    lock(true);epoch++;clearTimeout(timer);status('正在上傳材料……');
    try{if(!reviewId)await connect();const form=new FormData();form.set('role',$('role').value);form.set('file',file);
      const doc=await api(`/reviews/${reviewId}/documents`,{method:'POST',body:form});selected=doc.id;pageNumber=1;viewKey='';$('file').value='';await refresh();
    }catch(error){status(error.message);}finally{lock(false);renderDocs();}
  });
  $('page').addEventListener('change',()=>{pageNumber=Number($('page').value);void openPage();});
  $('refresh').addEventListener('click',()=>{if(!busy)void connect().catch(error=>status(error.message));});
  $('delete-review').addEventListener('click',async()=>{
    if(busy || !reviewId || !confirm('刪除本次所有材料及原文？此操作無法復原。'))return;
    lock(true);clearTimeout(timer);epoch++;clearReader();
    try{await api(`/reviews/${reviewId}`,{method:'DELETE'});remember(null);reviewId=null;selected=null;docs=[];renderDocs();await connect();}
    catch(error){status(error.message);}finally{lock(false);}
  });
  window.openPageAt = async (docId, index) => {
    const doc = docs.find(item => item.id === docId);
    if (!doc) { status('這份材料已不在本次審閱中。'); return; }
    selected = doc.id; pageNumber = index || 1; viewKey = '';
    renderDocs();
    try { await openDocument(doc); } catch (error) { status(error.message); return; }
    $('reader-title').scrollIntoView({behavior:'smooth', block:'start'});
  };
  window.addEventListener('pagehide',()=>{epoch++;pageEpoch++;clearTimeout(timer);});
  window.addEventListener('pageshow',event=>{if(event.persisted)void connect().catch(error=>status(error.message));});
  void connect().catch(error=>status(error.message));
})();
