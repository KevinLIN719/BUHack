(() => {
  'use strict';
  const data = window.PolicyDemo;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const pages = ['home', 'documents', 'your-trip', 'overview', 'scenarios', 'questions'];
  const state = { page: 0, reached: 0, demo: false, marketing: true, files: [], destination: '', route: '', activities: [], concerns: [], note: '', tab: 'overview', filter: 'personal', selected: [], edits: {}, replies: {}, reviewed: [], exported: false, customQuestions: {} };
  let fileSequence = 0;
  let returnFocus;
  let toastTimer;
  const agentThreads = new Map();
  let activeAgent = null;
  let returnAgentKey = null;
  let agentMessageSequence = 0;
  let customQuestionSequence = 0;
  const agentWaits = new Set();
  let completionReveal = null;
  let conceptIntro = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const source = id => data.sources.find(item => item.id === id);
  const scenario = id => data.scenarios.find(item => item.id === id) || state.customQuestions[id];
  const edited = id => Object.hasOwn(state.edits, id) && state.edits[id] !== scenario(id).question;
  const question = id => state.edits[id] ?? scenario(id).question;
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ arrow:'<path d="M5 19 19 5M5 5h14v14"/>', plus:'<path d="M12 4v16M4 12h16"/>', close:'<path d="m5 5 14 14M5 19 19 5"/>', file:'<path d="M14 2H5v20h14V7l-5-5Z"/><path d="M14 2v5h5M8 12h8m-8 4h6"/>', check:'<path d="m5 12 4 4L19 6"/>', up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>', back:'<path d="M20 12H4m6-6-6 6 6 6"/>' })[name] || ''}</svg>`;
  const button = (action, text, style = '', extra = '') => `<button type="button" class="button ${style}" data-action="${action}" ${extra}>${text}</button>`;
  const statusLabel = value => ({'In the wording':'條款已列明','Needs confirmation':'待確認','Not found':'未找到'}[value] || value);
  const status = (value, label) => `<span class="status ${value === 'In the wording' ? 'documented' : value === 'Not found' ? 'missing' : ''}">${esc(label || statusLabel(value))}</span>`;
  const sourceLink = (id, text) => source(id) ? `<button type="button" class="text-action" data-action="source" data-id="${esc(id)}">${esc(text || `閱讀條款／第 ${source(id).page} 頁`)} ${icon('arrow')}</button>` : '<span class="small-note">未附有對應條款。</span>';
  const choiceLabel = value => ({'Japan':'日本','Southeast Asia':'東南亞','Europe':'歐洲','Not sure yet':'尚未確定','Direct flights':'直航','Connecting flights':'轉機航班','City sightseeing':'城市觀光','Skiing':'滑雪','Diving':'潛水','Hiking':'遠足','Flight delays':'航班延誤','Medical cover':'醫療保障','Baggage':'行李','Activities':'活動','Policy wording':'保單條款','Marketing':'宣傳資料','Product notes':'產品說明'}[value] || value);
  const askLink = (kind='general',id='',label='向 Policy Lens 提問') => `<button type="button" class="text-action agent-entry" data-action="ask-agent" data-agent-kind="${kind}" data-id="${esc(id)}" data-agent-key="${kind}:${esc(id)}">${label} ${icon('arrow')}</button>`;
  const referenceLine = id => { const item=scenario(id),original=source(item.sourceId);return original?`${item.fromAgent?'建議示例出處，請核對是否適用：':edited(id)?'原有條款出處，修改後請重新核對：':'條款出處：'} 第 ${original.page} 頁 / ${original.section}`:'尚未找到對應示例條款，請向顧問索取適用條文。'; };
  const stepLink = (page, text, style = '') => button('navigate', `${text} ${icon('arrow')}`, style, `data-page="${page}"`);

  function masthead() {
    return `<div class="masthead"><button type="button" class="wordmark" data-action="home" aria-label="Policy Lens 首頁">Policy Lens</button><p class="masthead-copy">投保之前，<br>看清保障，<br>問對問題。<span>Policy Lens／你的獨立閱讀助手</span></p><div class="masthead-end">${!state.page?`<button class="text-action" type="button" data-action="concept-intro">觀看概念動畫 ${icon('arrow')}</button>`:''}${state.reached >= 4 ? `<button class="text-action" type="button" data-action="navigate" data-page="5">你的問題（${state.selected.length}） ${icon('arrow')}</button>` : `<button class="text-action" type="button" data-action="start-demo">試用示範 ${icon('arrow')}</button>`}<span>互動示範／01</span></div></div>`;
  }

  function navigation() {
    if (!state.page) return '';
    return `<nav class="progress-nav" aria-label="檢視步驟">${['文件', '你的情況', '保障概覽', '情境推演', '問題清單'].map((label, index) => `<button type="button" data-action="navigate" data-page="${index + 1}" ${index + 1 > state.reached ? 'disabled' : ''} ${state.page === index + 1 ? 'aria-current="step"' : ''}><span>0${index + 1}</span>${label}</button>`).join('')}</nav>`;
  }

  function pageTitle(kicker, title, intro) {
    return `<div class="page-heading"><div><p class="kicker">${kicker}</p><h1 id="page-title" tabindex="-1">${title}</h1></div><p class="page-intro">${intro}</p></div>`;
  }

  function landing() {
    return `<main class="poster" aria-labelledby="page-title"><div class="poster-art"><img src="assets/policy-sheet.svg" alt="印有細緻線條及 Policy Lens 字樣的象牙白保單" draggable="false"></div><div class="poster-caption"><span>投保之前，<br>多一分清晰。</span><div class="item-actions">${button('concept-intro',`觀看概念動畫 ${icon('arrow')}`,'quiet')}<button type="button" class="text-action" data-action="navigate" data-page="1">開始閱讀 ${icon('arrow')}</button></div></div><h1 class="poster-title" id="page-title" tabindex="-1"><span>POLICY LENS</span><span>MADE CLEAR.</span></h1><div class="poster-bottom"><p>閱讀條款，<br>看清保障界線。</p><button type="button" class="poster-start" data-action="navigate" data-page="1">開始梳理保單 ${icon('arrow')}</button><p>一份保單，<br>更具體的問題。</p></div><div class="landing-note"><p>在你決定投保之前，陪你把保單看清楚。</p><p>虛構保單示例；本原型不會分析真實文件。</p></div></main>`;
  }

  function formatSize(size) { return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`; }

  function fileList() {
    const demo = state.demo ? `<article class="document-row"><span class="document-number">01</span><div class="document-name"><strong>晴日旅遊／保單條款</strong><small>虛構示例・6 頁・版本 1.0</small></div>${sourceLink('basic', '開啟示例')}</article>${state.marketing ? `<article class="document-row"><span class="document-number">02</span><div class="document-name"><strong>晴日旅遊／產品小冊子</strong><small>宣傳文案示例・同一虛構產品</small></div><button class="icon-action" data-action="remove-marketing" type="button" aria-label="移除示例小冊子">${icon('close')}</button></article>` : button('add-marketing', '＋加入示例小冊子', 'quiet')}` : '';
    return `${demo}${state.demo && state.files.length ? '<p class="small-note local-note">你的本機檔案／僅供預覽，不會用於示例報告。</p>' : ''}${state.files.map((item, index) => `<article class="document-row local-document"><span class="document-number">${String(index + 1).padStart(2,'0')}</span><div class="document-name"><strong title="${esc(item.file.name)}">${esc(item.file.name)}</strong><small>${formatSize(item.file.size)} · 僅保留於此瀏覽器分頁</small></div><select data-file-kind="${item.id}" aria-label="文件類型： ${esc(item.file.name)}">${['Policy wording','Marketing','Product notes'].map(type => `<option value="${esc(type)}" ${item.kind === type ? 'selected' : ''}>${esc(choiceLabel(type))}</option>`).join('')}</select><button type="button" class="text-action" data-action="preview" data-id="${item.id}">預覽 ${icon('arrow')}</button><button class="icon-action" data-action="remove-file" data-id="${item.id}" type="button" aria-label="移除 ${esc(item.file.name)}">${icon('close')}</button></article>`).join('')}`;
  }

  function documents() {
    return `<main class="workflow-page">${pageTitle('01／準備資料', '把條款<br>看清楚。', '保單、小冊子或截圖，<br>由手邊的資料開始，讓原文隨時在旁。')}
      <div class="documents-layout"><section><div class="dropzone" id="dropzone"><span class="drop-plus" aria-hidden="true">+</span><h2>把文件拖曳至此。</h2><p>先準備保單條款，<br>產品小冊子及截圖可按需要加入。</p>${button('pick-files', `選擇檔案 ${icon('arrow')}`, 'solid')}<p class="small-note">PDF、JPG、PNG 或 WebP・每個檔案上限 20 MB・最多 10 個</p><input id="file-input" class="visually-hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" aria-label="選擇保單文件"></div><div class="document-list">${fileList()}</div><p class="small-note privacy-note">檔案只會保留於此瀏覽器分頁。本原型可預覽本機檔案，但不會分析內容。</p></section>
      <aside class="document-aside"><p class="kicker">手邊還沒有文件？</p><h2>先由一份<br>示例開始。</h2><p>使用虛構的「晴日旅遊」保單，完整體驗閱讀流程。</p><div class="sample-cover"><span>POLICY LENS／示例 01</span><strong>晴日<br>旅遊。</strong><span>保單條款＋產品小冊子<br>6 頁／8 個情境</span></div>${button('load-sample', `使用示例保單 ${icon('arrow')}`, 'quiet')}<p class="small-note">示例文件及結果均會清楚標示。</p></aside></div>
      <div class="page-actions">${stepLink(0,'返回首頁','quiet')}<div><p class="small-note">${state.demo ? '示例保單已就緒，請核對上方的產品名稱及版本。' : state.files.length ? '本機檔案可供預覽；繼續即可試用示例報告。' : '選擇文件或載入示例後即可繼續。'}</p>${button('continue-documents', `說說你的情況 ${icon('arrow')}`, 'solid', !state.demo && !state.files.length ? 'disabled' : '')}</div></div></main>`;
  }

  function choices(field, values) {
    return `<div class="choices" role="group" aria-label="${{destination:'目的地',route:'航班行程',activities:'計劃活動',concerns:'你在意的事項'}[field]}">${values.map(value => `<button type="button" data-action="choose" data-field="${field}" data-value="${esc(value)}" aria-pressed="${Array.isArray(state[field]) ? state[field].includes(value) : state[field] === value}">${esc(choiceLabel(value))}</button>`).join('')}</div>`;
  }

  function context() {
    return `<main class="workflow-page">${pageTitle('02／你的情況', '加入一點<br>你的情況。', '讓保險回到日常生活，<br>幾個細節便能讓重要問題更貼近你。')}
      <div class="context-form"><section class="form-row"><label for="destination"><span>01</span>你準備前往哪裏？</label><div><input id="destination" data-input="destination" maxlength="80" placeholder="目的地" value="${esc(choiceLabel(state.destination))}">${choices('destination',['Japan','Southeast Asia','Europe','Not sure yet'])}</div></section>
      <section class="form-row"><div class="field-label"><span>02</span>你會乘搭哪一種航班？</div>${choices('route',['Direct flights','Connecting flights','Not sure yet'])}</section>
      <section class="form-row"><div class="field-label"><span>03</span>你可能參與哪些活動？<small>可選擇多項。</small></div>${choices('activities',['City sightseeing','Skiing','Diving','Hiking'])}</section>
      <section class="form-row"><div class="field-label"><span>04</span>你最在意甚麼？<small>可選擇多項。</small></div>${choices('concerns',['Flight delays','Medical cover','Baggage','Activities'])}</section>
      <section class="form-row"><label for="personal-note"><span>05</span>還有甚麼想確認？<small>選填／最多 500 字</small></label><div><textarea id="personal-note" data-input="note" maxlength="500" rows="3" placeholder="例如：我會參加初學滑雪課程，行程中亦有轉機。">${esc(state.note)}</textarea><p class="small-note">筆記會隨問題清單保留。本示範會根據上方選項，調整預設情境的排序。</p></div></section></div>
      <div class="page-actions">${stepLink(1,'返回文件','quiet')}<div><button class="text-action" type="button" data-action="skip-context">暫時略過</button>${stepLink(3,'查看保障概覽','solid')}</div></div></main>`;
  }

  function tripSummary() { return [state.destination, state.route, ...state.activities].filter(Boolean).map(choiceLabel).join('／') || '尚未加入行程資料，你可隨時補充。'; }

  function demoNote() { return `<p class="demo-note"><span class="demo-dot"></span>示例保單／虛構條款；你的本機檔案尚未經過分析。</p>`; }

  function overviewContent() {
    return `<div class="coverage-grid">${data.coverage.map((item,index) => `<article class="coverage-item"><div class="item-top"><span class="item-number">0${index+1}</span>${status(item.status,item.statusLabel)}</div><h2>${esc(item.title)}</h2><p class="coverage-amount">${esc(item.amount)}</p><p class="body-copy">${esc(item.summary)}</p><div class="item-actions">${sourceLink(item.sourceId)}${askLink('source',item.sourceId,'追問這項條款')}</div></article>`).join('')}</div><p class="small-note">「條款已列明」代表示例中有相關條文，並不等於任何個別索償已獲確認。</p>`;
  }

  function comparisonContent() {
    if (!state.marketing) return `<div class="empty-state"><p class="kicker">再補一份資料</p><h2>加入小冊子，<br>便可對照宣傳內容。</h2><p>你仍可閱讀保障概覽及查看情境。</p>${button('add-marketing', `加入示例小冊子 ${icon('arrow')}`, 'quiet')}</div>`;
    return `<div class="comparison-labels"><span>宣傳說法</span><span>條款原文</span></div>${data.comparisons.map(item => `<article class="comparison-row"><h2>“${esc(item.claim)}”</h2><div><p>${esc(item.detail)}</p><p class="comparison-note">${esc(item.note)}</p>${sourceLink(item.sourceId)}</div></article>`).join('')}`;
  }

  function overview() {
    return `<main class="workflow-page">${pageTitle('03／保障概覽', '保障甚麼，<br>條件是甚麼。', '了解宣傳中的保障，<br>也別忽略背後的條件。')}${demoNote()}<div class="review-meta"><p><strong>${esc(data.policy.name)}</strong><span>${esc(tripSummary())}</span></p><div class="review-tools">${askLink()}${stepLink(2,'修改你的情況','quiet')}</div></div>
      <div class="report-tabs" role="tablist" aria-label="保單檢視方式">${[['overview','一頁看懂'],['comparison','宣傳與條款對照']].map(([id,label]) => `<button type="button" role="tab" id="tab-${id}" aria-controls="report-panel" aria-selected="${state.tab===id}" tabindex="${state.tab===id?0:-1}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div><section id="report-panel" role="tabpanel" aria-labelledby="tab-${state.tab}">${state.tab==='overview'?overviewContent():comparisonContent()}</section>
      <div class="page-actions">${stepLink(2,'返回你的情況','quiet')}<div><p class="small-note">接着把這些條件放回真實生活情境。</p>${stepLink(4,'查看可能遇到的情境','solid')}</div></div></main>`;
  }

  function sortedScenarios() {
    const score = item => (item.tags.includes('connection') && state.route==='Connecting flights' ? 12:0)+(item.tags.includes('ski') && state.activities.includes('Skiing') ? 12:0)+(item.tags.includes('diving') && state.activities.includes('Diving') ? 12:0)+(item.tags.includes('medical') && state.concerns.includes('Medical cover') ? 10:0)+(item.tags.includes('baggage') && state.concerns.includes('Baggage') ? 10:0)+(item.tags.includes('flight') && state.concerns.includes('Flight delays') ? 5:0)+(['ski','diving'].some(tag=>item.tags.includes(tag)) && state.concerns.includes('Activities') ? 4:0)+(item.id==='threshold'?2:0)+(item.id==='proof'?1:0);
    return [...data.scenarios].sort((a,b)=>score(b)-score(a));
  }

  function scenariosPage() {
    const sorted=sortedScenarios();
    const visible=state.filter==='personal'?sorted.slice(0,5):sorted.filter(item=>state.filter==='all'||(state.filter==='sport'?item.tags.includes('ski')||item.tags.includes('diving'):item.tags.includes(state.filter)));
    return `<main class="workflow-page">${pageTitle('04／保障邊界情境', '如果遇上<br>這些情況？', '找出你原本未想到的問題，<br>由最貼近生活的情境開始。')}${demoNote()}<p class="scenario-intro">以下是假設情境，依據示例條款整理。「未找到」代表現有資料沒有回答該問題。</p>
      <div class="scenario-filters" role="group" aria-label="篩選情境">${[['personal','為你挑選／5'],['all','全部／8'],['flight','航班'],['sport','活動'],['medical','醫療'],['baggage','行李']].map(([id,label])=>`<button type="button" data-action="filter" data-id="${id}" aria-pressed="${state.filter===id}">${label}</button>`).join('')}</div>
      <div class="scenario-list">${visible.map((item,index)=>`<article class="scenario-item" data-scenario="${item.id}"><span class="scenario-number">${String(index+1).padStart(2,'0')}</span><div class="scenario-body"><div class="item-top">${status(item.status,item.statusLabel)}<span class="small-note">假設情境</span></div><h2>${esc(item.title)}</h2><p class="scenario-context">${esc(item.context)}</p><div class="scenario-detail"><span>為何值得留意</span><p>${esc(item.why)}</p></div><div class="scenario-question"><span>值得帶去確認的問題</span><p>${esc(question(item.id))}</p>${edited(item.id)?'<small>你已修改問題，請重新核對所附原文。</small>':''}</div><div class="scenario-actions"><div class="item-actions">${sourceLink(item.sourceId)}${askLink('scenario',item.id,'一起釐清')}</div><button type="button" class="select-question" data-action="toggle-question" data-id="${item.id}" aria-pressed="${state.selected.includes(item.id)}"><span class="check-box">${state.selected.includes(item.id)?icon('check'):icon('plus')}</span>${state.selected.includes(item.id)?'已加入問題清單':'加入問題清單'}</button></div></div></article>`).join('')}</div>
      <div class="selection-bar ${state.selected.length?'has-selection':''}"><div><strong>已選 ${state.selected.length} 條問題</strong><p>已附上條款出處，你可在下一頁調整問題。</p></div>${stepLink(5,'檢視問題清單','solid')}</div><div class="page-actions">${stepLink(3,'返回保障概覽','quiet')}</div></main>`;
  }

  function questionsPage() {
    const allReviewed=state.selected.length>0&&state.selected.every(id=>state.reviewed.includes(id));
    return `<main class="workflow-page">${pageTitle('05／你的問題清單', '把問題<br>問清楚。', '具體的問題，讓對話更有方向。<br>編輯、分享，並記錄得到的答覆。')}${demoNote()}
      ${state.selected.length?`<div class="question-summary"><span>${state.selected.length} 條問題／${state.selected.filter(id=>state.reviewed.includes(id)).length} 條已由你檢閱</span><span>${esc(data.policy.name)}</span></div><div class="question-list">${state.selected.map((id,index)=>{const item=scenario(id),original=source(item.sourceId);return `<article class="question-item" data-question="${id}"><div class="question-top"><span class="item-number">${String(index+1).padStart(2,'0')}</span><h2>${esc(item.title)}</h2><div class="question-tools"><button class="icon-action" type="button" data-action="move-up" data-id="${id}" aria-label="將第 ${index+1} 條問題上移" ${index===0?'disabled':''}>${icon('up')}</button><button class="icon-action" type="button" data-action="move-down" data-id="${id}" aria-label="將第 ${index+1} 條問題下移" ${index===state.selected.length-1?'disabled':''}>${icon('down')}</button><button class="icon-action" type="button" data-action="delete-question" data-id="${id}" aria-label="移除第 ${index+1} 條問題">${icon('close')}</button></div></div><label class="visually-hidden" for="question-${id}">編輯第 ${index+1} 條問題</label><textarea id="question-${id}" data-question-edit="${id}" maxlength="1800" rows="3">${esc(question(id))}</textarea><p class="question-source">${esc(referenceLine(id))}</p><div class="item-actions">${sourceLink(item.sourceId,'核對條款原文')}${askLink('scenario',id,'釐清這條問題')}</div><details class="reply-details" ${state.replies[id]||state.reviewed.includes(id)?'open':''}><summary>收到答覆了？記錄下來。</summary><label for="reply-${id}">你收到的答覆／選填</label><textarea id="reply-${id}" data-reply="${id}" maxlength="2500" rows="2" placeholder="在此貼上或輸入答覆，內容不會經過分析。">${esc(state.replies[id]||'')}</textarea><label class="reviewed-label"><input type="checkbox" data-reviewed="${id}" ${state.reviewed.includes(id)?'checked':''}>${state.reviewed.includes(id)?'你已標記為已檢閱':'我已檢閱這段答覆'}</label></details></article>`}).join('')}</div>
      ${state.note?`<div class="personal-note"><span>你的情況／分享清單時一併附上</span><p>${esc(state.note)}</p></div>`:''}<div class="export-actions"><div><button type="button" class="text-action" data-action="navigate" data-page="4">${icon('back')} 繼續查看情境</button><p class="small-note">產生整潔的預覽，或連同條款出處一起匯出問題。</p></div><div>${button('download', '下載 .txt', 'quiet')}${button('copy', `複製問題清單 ${icon('arrow')}`, 'quiet')}${button('generate-checklist', `產生確認清單 ${icon('arrow')}`, 'solid')}</div></div>
      <section class="completion ${state.exported||allReviewed?'is-ready':''}"><p class="kicker">${allReviewed?'跟進紀錄':'下一步'}</p><h2>${allReviewed?'所選問題<br>已全部檢閱。':state.exported?'帶着清單，<br>展開更具體的對話。':'把這些問題<br>交給你的顧問。'}</h2><p>${allReviewed?'這些答覆由你標記為已檢閱，並不代表保障範圍或索償結果已獲確認。':state.exported?'問題清單已可分享。請自行交給顧問，再回來記錄答覆。':'複製或下載清單，自行交給顧問，並要求對方依據實際保單條款逐一回答。'}</p><button type="button" class="text-action" data-action="home">返回首頁 ${icon('arrow')}</button></section>`:`<section class="empty-state"><p class="kicker">尚未加入問題</p><h2>由你在意的<br>一條問題開始。</h2><p>在情境中選擇「加入問題清單」，相關條款出處亦會一併保留。</p>${stepLink(4,'查看情境','solid')}</section>`}</main>`;
  }

  function render({focus=false}={}) {
    window.clearTimeout(toastTimer);
    document.getElementById('toast')?.classList.remove('visible');
    app.innerHTML=`<div class="site" data-screen="${pages[state.page]}">${masthead()}${navigation()}${[landing,documents,context,overview,scenariosPage,questionsPage][state.page]()}<footer class="site-footer"><span>POLICY LENS／投保前，先看清楚。</span><span>虛構示例。檔案保留於本機，重新整理會重設此檢視。</span></footer></div>`;
    if(focus){document.getElementById('page-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }

  function go(page, push=true) {
    if(!Number.isInteger(page)||page<0||page>5) return;
    if(page>=2&&!state.demo) page=1;
    if(page>state.reached+1) return;
    closeModal({resumeAgent:false});
    state.page=page;state.reached=Math.max(state.reached,page);
    if(push) { try { window.history.pushState({page},'',`#${pages[page]}`); } catch {} }
    render({focus:true});
  }

  function loadSample(next=1) {state.demo=true;closeModal();go(next);}

  function addFiles(files) {
    let added=0,rejected=0;
    for(const file of files){
      const extension=file.name.split('.').pop().toLowerCase();
      if(!['pdf','jpg','jpeg','png','webp'].includes(extension)||file.size>20*1048576||(file.type&&!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))||state.files.length>=10){rejected++;continue;}
      if(state.files.some(item=>item.file.name===file.name&&item.file.size===file.size&&item.file.lastModified===file.lastModified))continue;
      state.files.push({id:`local-${++fileSequence}`,file,url:URL.createObjectURL(file),isPdf:extension==='pdf',kind:extension==='pdf'?'Policy wording':'Marketing'});added++;
    }
    render();app.querySelector('[data-action="pick-files"]')?.focus({preventScroll:true});
    if(rejected)toast(`有 ${rejected} 個檔案未能加入。請使用 PDF 或圖片，每個上限 20 MB，最多 10 個檔案。`);
    else if(added)toast(`已加入 ${added} 個檔案供本機預覽。`);
  }

  function toast(message) {const element=document.getElementById('toast');clearTimeout(toastTimer);element.textContent=message;element.classList.add('visible');toastTimer=window.setTimeout(()=>element.classList.remove('visible'),3600);}

  function openModal(content,{drawer=false,preserve=false,agent=false,completion=false,concept=false}={}) {
    completionReveal?.destroy();completionReveal=null;
    conceptIntro?.destroy();conceptIntro=null;
    if(!preserve)returnFocus=document.activeElement;
    modalRoot.innerHTML=`<div class="modal-overlay" data-overlay="true"><section class="${agent?'agent-workspace':completion?'completion-dialog':concept?'concept-dialog':drawer?'source-drawer':'dialog-panel'}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${content}</section></div>`;
    app.inert=true;document.documentElement.style.overflow='hidden';modalRoot.querySelector('button,textarea,input,a,[tabindex="-1"]')?.focus({preventScroll:true});
  }
  function closeModal({resumeAgent=true}={}){
    completionReveal?.destroy();completionReveal=null;
    conceptIntro?.destroy();conceptIntro=null;
    if(!modalRoot.firstChild)return;
    const leaving=activeAgent;
    if(leaving){settleAgent(leaving);activeAgent=null;}
    const resumeKey=resumeAgent?returnAgentKey:null;returnAgentKey=null;
    modalRoot.innerHTML='';app.inert=false;document.documentElement.style.overflow='';
    if(leaving?.dirty){render();leaving.dirty=false;returnFocus=findAgentLauncher(leaving);}
    if(resumeKey&&agentThreads.has(resumeKey)){openAgent(null,null,{resumeKey});return;}
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  const closeButton=()=>`<button type="button" class="icon-action" data-action="close-modal" aria-label="關閉對話框">${icon('close')}</button>`;

  function openConcept(){
    const concept=window.PolicyConceptData;
    openModal(`<div class="dialog-heading"><div><p class="kicker">POLICY LENS／產品概念</p><h2 id="dialog-title">投保前，先看清楚。</h2></div>${closeButton()}</div><div class="concept-stage" data-concept-host></div><div class="concept-toolbar"><div class="concept-toolbar-actions">${button('concept-replay','重播概念動畫','quiet')}${button('concept-pause','暫停','quiet')}${button('concept-skip','略過至品牌名稱','quiet')}</div><p class="concept-note">在香港營運的保險公司／市場背景資料。<br><a href="https://www.ia.org.hk/en/supervision/reg_insurers_lloyd/contact_list_of_authorized_insurers.html" target="_blank" rel="noopener noreferrer">保險業監管局名冊 ${icon('arrow')}</a></p></div>`,{concept:true});
    const panel=modalRoot.querySelector('.concept-dialog'),host=panel.querySelector('[data-concept-host]');
    const update=()=>{
      if(!panel.isConnected)return;
      const state=host.dataset.conceptState,pause=panel.querySelector('[data-action="concept-pause"]');
      pause.disabled=state==='ready';pause.textContent=state==='paused'?'繼續播放':'暫停';panel.querySelector('[data-action="concept-skip"]').disabled=state==='ready';
    };
    if(window.PolicyConceptMotion&&concept){conceptIntro=window.PolicyConceptMotion.mount(host,{...concept,autoplay:false,onPhase:update});void conceptIntro.play();update();}
    else{host.innerHTML='<div class="concept-title" style="opacity:1;filter:none;transform:none"><strong>Policy Lens</strong><p>投保前，先看清楚。</p></div>';host.dataset.conceptState='ready';update();panel.querySelector('[data-action="concept-replay"]').disabled=true;}
  }

  function openSource(id,preserve=false) {
    const item=source(id);if(!item)return;
    openModal(`<div class="dialog-heading"><div><p class="kicker">條款原文／示例</p><h2 id="dialog-title">${esc(item.title)}</h2><p class="small-note">晴日旅遊／虛構示例／第 ${item.page} 頁</p></div>${closeButton()}</div><nav class="source-pages" aria-label="示例條款頁碼">${data.sources.map(page=>`<button type="button" data-action="source-page" data-id="${page.id}" aria-current="${page.id===id?'page':'false'}">0${page.page}</button>`).join('')}</nav><article class="source-paper"><p class="kicker">POLICY LENS／條款示例</p><h3>晴日旅遊。</h3><p class="small-note">版本 1.0／虛構產品</p><h4>${esc(item.section)}</h4><blockquote>${esc(item.text)}</blockquote><p class="document-page">${String(item.page).padStart(2,'0')} / 06</p></article><p class="small-note">這是內置的示例條款，並非從你選擇的檔案擷取。</p>${state.reached>=3?askLink('source',id,'追問這項條款'):''}`,{drawer:true,preserve});
  }

  function previewFile(id) {
    const item=state.files.find(file=>file.id===id);if(!item)return;
    openModal(`<div class="dialog-heading"><div><p class="kicker">本機預覽</p><h2 id="dialog-title">你的文件。</h2><p class="small-note">${esc(item.file.name)}</p></div>${closeButton()}</div>${item.isPdf?`<object class="file-preview" data="${esc(item.url)}" type="application/pdf"><p>此瀏覽器無法直接顯示 PDF。 <a href="${esc(item.url)}" download="${esc(item.file.name)}">儲存你選擇的檔案</a>，再於本機開啟。</p></object>`:`<img class="file-preview" src="${esc(item.url)}" alt="${esc(item.file.name)} 的本機預覽">`}<p class="small-note">僅供預覽，檔案未有上傳或分析。</p>`);
  }

  // Conversations complement the review; they never advance or replace it.
  function agentSuggestions(thread){
    const id=thread.sourceId;
    if(thread.mode==='ask'&&id)return ['關於這項條款，我應該向顧問確認甚麼？','我應該準備或索取甚麼證明？'];
    if(id==='sport')return ['休閒滑雪是否明確屬於保障範圍？','休閒潛水又如何？'];
    if(id==='medical')return ['哪些醫院及費用符合要求？','還欠缺哪些資料？'];
    if(id==='baggage')return ['行李延誤需要保留哪些收據？','關於八小時的條件，我應該確認甚麼？'];
    if(id==='claim')return ['航空公司應用程式的截圖可以作為證明嗎？','需要準備哪些文件？'];
    if(id==='basic')return ['保障何時開始？','我應該核對保險證明書上的哪些資料？'];
    return ['如果剛好延誤六小時呢？','如果因此錯過轉機航班呢？'];
  }
  function suggestionMarkup(questions){return questions.slice(0,3).map(text=>`<button type="button" data-action="agent-suggest" data-prompt="${esc(text)}">${esc(text)} ${icon('arrow')}</button>`).join('');}
  function agentSaved(message){return Boolean(message.savedQuestionId&&state.selected.includes(message.savedQuestionId));}
  function agentAssistantBody(message,{ready=true}={}){
    const reply=message.reply,saved=agentSaved(message),disabled=ready?'':'disabled';
    return `<p class="agent-response-label">POLICY LENS / ${reply.grounded?'條款示例':'需要更多資料'}</p><h3>${esc(reply.title)}</h3>${reply.paragraphs.map(text=>`<p>${esc(text)}</p>`).join('')}<div class="agent-evidence">${reply.sourceIds.map(id=>`<button type="button" class="text-action" data-action="agent-source" data-id="${id}" data-agent-reply-action ${disabled}>示例條款／第 ${source(id).page} 頁 ${icon('arrow')}</button>`).join('')}${!reply.grounded?'<p class="small-note">未附有對應條款，這並非保障結論。</p>':''}</div><div class="agent-answer-actions"><button type="button" class="text-action" data-action="agent-save" data-id="${message.id}" data-agent-reply-action ${disabled||saved?'disabled':''}>${saved?'已加入問題清單':reply.grounded?'保留問題及這項出處':'保留尚未解答的問題'} ${saved?icon('check'):icon('plus')}</button></div><div class="agent-followups">${reply.followUps.slice(0,2).map(text=>`<button type="button" data-action="agent-suggest" data-prompt="${esc(text)}" data-agent-reply-action ${disabled}>${esc(text)} ${icon('arrow')}</button>`).join('')}</div>`;
  }
  function agentMessageMarkup(message){
    return message.role==='user'?`<article class="agent-message user" data-message="${message.id}"><p>${esc(message.text)}</p></article>`:`<article class="agent-message assistant" data-message="${message.id}">${agentAssistantBody(message)}</article>`;
  }
  function deskMarkup(thread){
    const reply=thread.lastReply;
    const id=reply?.sourceIds[0]||thread.sourceId;
    const original=source(id);
    const related=scenario(reply?.scenarioIds[0]||thread.scenarioId)||data.scenarios.find(item=>item.sourceId===id);
    if(reply&&!reply.grounded)return `<p class="agent-desk-heading kicker">條款參考／未找到</p><h3>讓問題更具體，<br>也看清資料的界線。</h3><p>示例條款未有提供足以回答這個問題的依據。</p><p class="agent-desk-quote">把問題留給顧問，並索取適用的條款原文。</p><p class="small-note">這裏沒有使用或推斷你檔案中的內容。</p>`;
    if(!original)return `<p class="agent-desk-heading kicker">條款參考</p><h3>讓原文<br>留在身旁。</h3><p>選擇條款或提出問題，相關示例原文會保留在對話旁。</p><div class="agent-desk-list">${data.sources.map(item=>`<button type="button" class="text-action" data-action="agent-topic" data-id="${item.id}"><span>0${item.page}</span>${esc(item.title)} ${icon('arrow')}</button>`).join('')}</div>`;
    if(thread.mode==='what-if'&&related)return `<p class="agent-desk-heading kicker">條款參考／假設情境</p><h3>看清條款<br>尚未回答的地方。</h3><p class="agent-desk-meta">${esc(related.title)}</p><blockquote class="agent-desk-quote">${esc(related.context||related.question)}</blockquote><p>${esc(related.why||'這個追問需要由顧問給予具體答覆。')}</p><button type="button" class="text-action" data-action="agent-source" data-id="${original.id}">核對示例第 ${original.page} 頁 ${icon('arrow')}</button>`;
    if(thread.mode==='ask'&&related)return `<p class="agent-desk-heading kicker">條款參考／帶去確認</p><h3>一條值得<br>問清楚的問題。</h3><blockquote class="agent-desk-quote">${esc(question(related.id))}</blockquote><p class="small-note">對應示例第 ${original.page} 頁。請顧問指出實際保單中適用的條款。</p><button type="button" class="text-action" data-action="agent-save-scenario" data-id="${related.id}" ${state.selected.includes(related.id)?'disabled':''}>${state.selected.includes(related.id)?'已在問題清單內':'加入這條情境問題'} ${icon('plus')}</button>`;
    return `<p class="agent-desk-heading kicker">條款參考／第 0${original.page}</p><h3>${esc(original.title)}</h3><p class="agent-desk-meta">晴日旅遊／虛構示例</p><blockquote class="agent-desk-quote">${esc(original.text.length>570?original.text.slice(0,570)+'…':original.text)}</blockquote><button type="button" class="text-action" data-action="agent-source" data-id="${id}">閱讀完整示例原文 ${icon('arrow')}</button><p class="small-note">內置示例的節錄，並非從你的檔案擷取。</p>`;
  }
  function agentMarkup(thread){
    return `<div class="agent-header"><div><p class="kicker">POLICY LENS／一起看清楚</p><h2 id="dialog-title">一起把問題釐清。</h2><p class="small-note">${esc(thread.label)} / 示例對話</p></div><button type="button" class="icon-action" data-action="close-modal" aria-label="關閉對話並返回檢視">${icon('close')}</button></div><div class="agent-layout"><section class="agent-conversation" aria-label="對話"><div class="agent-feed" role="log" aria-label="你的對話" aria-live="off"><div class="agent-stack">${thread.messages.length?thread.messages.map(agentMessageMarkup).join(''):`<div class="agent-empty"><h3>一條問題，<br>多一分清晰。</h3><p>針對示例保單提問，讓原文和尚待解答的問題留在身旁。</p><div class="agent-suggestions">${suggestionMarkup(agentSuggestions(thread))}</div></div>`}</div></div><form class="agent-composer" id="agent-form"><label class="visually-hidden" for="agent-draft">詢問示例保單</label><textarea id="agent-draft" data-agent-draft maxlength="1000" rows="2" placeholder="追問這項條款……">${esc(thread.draft)}</textarea><div class="agent-composer-toolbar"><div class="agent-modes" role="group" aria-label="對話方式">${[['explain','解釋條款'],['what-if','情境推演'],['ask','整理問題']].map(([id,label])=>`<button type="button" data-action="agent-mode" data-id="${id}" aria-pressed="${thread.mode===id}">${label}</button>`).join('')}</div><button type="submit" class="agent-send-button" aria-label="傳送問題" ${thread.draft.trim()?'':'disabled'}>${icon('up')}</button></div></form></section><aside class="agent-desk" aria-label="相關保單條款"><div class="agent-desk-content">${deskMarkup(thread)}</div></aside></div><div class="agent-disclosure"><span>預設答覆依據虛構示例條款，不會連接即時 AI 或分析檔案。</span><button type="button" class="text-action agent-list-link" data-action="agent-continue">${state.page<4?'繼續查看情境':'檢視問題清單'} (${state.selected.length}) ${icon('arrow')}</button></div><p class="visually-hidden agent-live" role="status" aria-live="polite"></p>`;
  }
  function findAgentLauncher(thread){
    if(thread.launcher?.isConnected)return thread.launcher;
    const key=thread.launcher?.dataset.agentKey;
    if(key)return app.querySelector(`[data-agent-key="${key}"]`);
    const id=thread.launcher?.dataset.id,action=thread.launcher?.dataset.action;
    return (id&&action?app.querySelector(`[data-action="${action}"][data-id="${id}"]`):null)||document.getElementById('page-title');
  }
  function openAgent(kind,id,{resumeKey=null}={}){
    if(!state.demo||state.reached<3){toast('請先閱讀示例概覽，再針對條款提問。');return;}
    const key=resumeKey||`${kind}:${id||''}`;
    const item=kind==='scenario'?scenario(id):null;
    const sourceId=item?.sourceId||(kind==='source'&&source(id)?id:null);
    if(!agentThreads.has(key))agentThreads.set(key,{key,sourceId,scenarioId:item?.id||null,label:item?.title||source(sourceId)?.title||'你的保單問題',mode:item?'what-if':'explain',messages:[],draft:'',busy:false,turn:0,dirty:false,lastReply:null,launcher:null});
    const thread=agentThreads.get(key);
    if(!resumeKey)thread.launcher=returnAgentKey?agentThreads.get(returnAgentKey)?.launcher:activeAgent?.launcher||(modalRoot.firstChild?returnFocus:document.activeElement);
    if(activeAgent)settleAgent(activeAgent);
    returnAgentKey=null;activeAgent=thread;
    openModal(agentMarkup(thread),{agent:true});returnFocus=thread.launcher;
    const field=modalRoot.querySelector('[data-agent-draft]');resizeAgentField(field);field.focus({preventScroll:true});field.setSelectionRange(field.value.length,field.value.length);
    const feed=modalRoot.querySelector('.agent-feed');feed.scrollTop=feed.scrollHeight;
  }
  function resizeAgentField(field){if(!field)return;field.style.height='auto';field.style.height=`${Math.max(52,Math.min(126,field.scrollHeight))}px`;}
  function setAgentBusy(thread){
    const panel=modalRoot.querySelector('.agent-workspace');if(!panel||activeAgent!==thread)return;
    panel.querySelector('.agent-feed').setAttribute('aria-busy',String(thread.busy));
    panel.querySelectorAll('[data-action="agent-mode"]').forEach(button=>{button.disabled=thread.busy;});
    const field=panel.querySelector('[data-agent-draft]');panel.querySelector('.agent-send-button').disabled=thread.busy||!field.value.trim();
  }
  function updateAgentDesk(thread){const content=modalRoot.querySelector('.agent-desk-content');if(!content)return;content.innerHTML=deskMarkup(thread);window.PolicyAgentMotion?.transitionDesk(content);}
  function waitForAgent(ms,thread){return new Promise(resolve=>{const job={thread,resolve,timer:null};job.timer=window.setTimeout(()=>{agentWaits.delete(job);resolve(true);},ms);agentWaits.add(job);});}
  function settleAgent(thread){
    const field=modalRoot.querySelector('[data-agent-draft]');if(activeAgent===thread&&field)thread.draft=field.value;
    thread.turn++;thread.busy=false;thread.messages.forEach(message=>{message.pending=false;});
    for(const job of agentWaits)if(job.thread===thread){window.clearTimeout(job.timer);agentWaits.delete(job);job.resolve(false);}
    window.PolicyAgentMotion?.cancelAll();
  }
  async function sendAgent(){
    const thread=activeAgent,field=modalRoot.querySelector('[data-agent-draft]');
    if(!thread||!field||thread.busy)return;
    const text=field.value.trim();if(!text)return;
    const fromRect=field.getBoundingClientRect();
    let reply;
    try{reply=window.PolicyAgentReplies.reply(text,{sourceId:thread.sourceId,scenarioId:thread.scenarioId,mode:thread.mode,trip:tripSummary()});}catch{reply={title:'先把它保留為問題。',paragraphs:['示例助手未能找到對應條款，請向顧問索取相關原文。'],sourceIds:[],scenarioIds:[],followUps:[],grounded:false};}
    reply={...reply,sourceIds:reply.sourceIds.filter(id=>source(id)),scenarioIds:reply.scenarioIds.filter(id=>scenario(id))};
    thread.sourceId=reply.grounded?reply.sourceIds[0]||null:null;
    thread.scenarioId=reply.grounded?reply.scenarioIds[0]||null:null;
    thread.label=source(thread.sourceId)?.title||'一條待確認的問題';
    modalRoot.querySelector('.agent-header .small-note').textContent=`${thread.label} / 示例對話`;
    const user={id:`agent-${++agentMessageSequence}`,role:'user',text};
    const answer={id:`agent-${++agentMessageSequence}`,role:'assistant',question:text,reply,pending:true,savedQuestionId:null};
    thread.messages.push(user,answer);thread.lastReply=reply;thread.draft='';thread.busy=true;const turn=++thread.turn;
    const feed=modalRoot.querySelector('.agent-feed'),stack=feed.querySelector('.agent-stack'),composer=modalRoot.querySelector('.agent-composer'),send=modalRoot.querySelector('.agent-send-button');
    field.value='';field.style.height='52px';stack.querySelector('.agent-empty')?.remove();
    stack.insertAdjacentHTML('beforeend',agentMessageMarkup(user));const bubble=stack.lastElementChild;feed.scrollTop=feed.scrollHeight;setAgentBusy(thread);field.focus({preventScroll:true});
    const alive=()=>activeAgent===thread&&thread.turn===turn&&composer.isConnected;
    try{
      await window.PolicyAgentMotion?.launch({bubble,composer,field,feed,button:send,fromRect});
      if(!alive())return;
      const node=document.createElement('article');node.className='agent-message assistant';node.dataset.message=answer.id;node.innerHTML='<p class="agent-response-label">POLICY LENS／條款示例</p><p class="agent-thinking">正在查看示例條款……</p>';stack.appendChild(node);feed.scrollTop=feed.scrollHeight;
      if(!window.PolicyAgentMotion?.reduced())await waitForAgent(140,thread);
      if(!alive())return;
      updateAgentDesk(thread);node.innerHTML=agentAssistantBody(answer,{ready:false});
      await window.PolicyAgentMotion?.reveal({element:node,feed});
      if(!alive())return;
      answer.pending=false;thread.busy=false;node.querySelectorAll('[data-agent-reply-action]').forEach(button=>{button.disabled=false;});setAgentBusy(thread);
      modalRoot.querySelector('.agent-live').textContent=`${reply.title} ${reply.grounded?'已附上示例條款出處。':'尚未找到對應的示例條款。'}`;
    }catch{
      if(alive()){answer.pending=false;thread.busy=false;const node=stack.querySelector(`[data-message="${answer.id}"]`);if(node)node.innerHTML=agentAssistantBody(answer);else stack.insertAdjacentHTML('beforeend',agentMessageMarkup(answer));setAgentBusy(thread);feed.scrollTop=feed.scrollHeight;}
    }
  }
  function updateAgentListLink(thread){const link=modalRoot.querySelector('.agent-list-link');if(link)link.innerHTML=`${state.page<4?'繼續查看情境':'檢視問題清單'} (${state.selected.length}) ${icon('arrow')}`;thread.dirty=true;}
  function saveAgentQuestion(id){
    const thread=activeAgent,message=thread?.messages.find(item=>item.id===id&&item.role==='assistant');if(!message||message.pending)return;
    let questionId=message.savedQuestionId;
    if(!questionId){questionId=`conversation-${++customQuestionSequence}`;const text=message.question;state.customQuestions[questionId]={id:questionId,title:text.length>78?text.slice(0,78)+'…':text,question:text,sourceId:message.reply.grounded?message.reply.sourceIds[0]||null:null,status:'Needs confirmation',fromAgent:true,tags:[]};message.savedQuestionId=questionId;}
    if(!state.selected.includes(questionId))state.selected.push(questionId);state.exported=false;updateAgentListLink(thread);
    const control=modalRoot.querySelector(`[data-action="agent-save"][data-id="${id}"]`);if(control){control.innerHTML=`已加入問題清單 ${icon('check')}`;control.disabled=true;}
    modalRoot.querySelector('.agent-live').textContent='你的原問題已加入檢視清單。';
  }
  function sourceFromAgent(id){const thread=activeAgent;if(!thread||!source(id))return;settleAgent(thread);activeAgent=null;openSource(id);returnAgentKey=thread.key;}

  function buildChecklist() {
    const lines=['POLICY LENS／示例問題清單',data.policy.name,'虛構示例條款，並非對真實保險產品的評估。','',`行程背景：${tripSummary()}`,...(state.note?[`我的筆記：${state.note}`]:[]),'','我希望在投保之前確認以下問題：'];
    state.selected.forEach((id,index)=>{const item=scenario(id),original=source(item.sourceId);lines.push('',`${index+1}. ${question(id)}`);if(original)lines.push(`${item.fromAgent?'建議示例出處（請核對是否適用）':edited(id)?'原有條款出處（問題已修改，請重新核對）':'條款出處'}：第 ${original.page} 頁 / ${original.section}`,`示例條款：${original.text}`);else lines.push('尚未找到對應示例條款，請向顧問索取適用條文。');if(state.replies[id])lines.push(`我記錄的答覆：${state.replies[id]}`);if(state.reviewed.includes(id))lines.push('狀態：我已標記為已檢閱。');});
    return lines.join('\n');
  }
  function canExport(){if(!state.selected.length){toast('請先選擇一條情境問題。');return false;}const id=state.selected.find(id=>!question(id).trim());if(id){const field=app.querySelector(`[data-question-edit="${id}"]`);field?.setAttribute('aria-invalid','true');field?.focus();toast('匯出前，請先填寫尚未完成的問題。');return false;}return true;}
  function openChecklistPreview(){
    if(!canExport())return;
    const count=state.selected.length;
    const rows=state.selected.map((id,index)=>{
      const item=scenario(id),original=source(item.sourceId);
      const reference=original?`${item.fromAgent?'建議出處／請重新核對':edited(id)?'問題已修改／請重新核對出處':'示例條款'}／第 ${String(original.page).padStart(2,'0')} 頁`:'未找到對應條款／請向顧問確認';
      return `<li class="completion-row" data-reveal-row><span class="completion-row-number">${String(index+1).padStart(2,'0')}</span><div><p>${esc(question(id))}</p><small>${esc(reference)}</small></div><span class="completion-row-state">${state.reviewed.includes(id)?'你已檢閱':'待確認'}</span></li>`;
    }).join('');
    openModal(`<div class="dialog-heading"><div><p class="kicker">已產生的確認清單／示例</p><h2 id="dialog-title">把問題整理在一起。</h2><p class="small-note">${count} 條問題／ ${esc(data.policy.name)}</p></div>${closeButton()}</div><div class="completion-reveal" aria-label="已產生的問題清單"><div class="completion-document" data-reveal-content><div class="completion-document-head"><span>投保之前／向顧問確認的問題</span><span>${count} 條待確認的問題</span></div><ol class="completion-list">${rows}</ol>${state.note?`<div class="completion-context"><strong>你的情況</strong>${esc(state.note)}</div>`:''}</div></div><div class="completion-prompt"><p>已將所選問題和現有出處整理在一起，分享前請先檢查清單。</p><div class="completion-prompt-toolbar"><p class="completion-status" role="status" aria-live="polite" data-reveal-status>確認清單已就緒。</p><div class="completion-result-actions">${button('completion-replay','重播揭示動畫','quiet')}${button('completion-download','下載 .txt','quiet','data-result-share')}${button('completion-copy','複製確認清單','solid','data-result-share')}</div></div></div><p class="completion-disclaimer">虛構示例。本預覽不會確認保障範圍或分析你的檔案，匯出時仍會包含你記錄的答覆。</p>`,{completion:true});
    const panel=modalRoot.querySelector('.completion-dialog'),surface=panel.querySelector('.completion-reveal');
    const onPhase=phase=>{
      if(!panel.isConnected)return;
      const busy=phase!=='ready';
      surface.setAttribute('aria-busy',String(busy));
      panel.querySelector('[data-reveal-status]').textContent=phase==='preparing'?'正在準備確認清單……':phase==='revealing'?'正在把內容整理在一起……':`${count} 條問題已可分享。`;
      panel.querySelectorAll('[data-result-share],[data-action="completion-replay"]').forEach(control=>{control.disabled=busy;});
    };
    if(window.PolicyCompletionReveal){completionReveal=window.PolicyCompletionReveal.mount(surface,{onPhase});void completionReveal.play().catch(()=>onPhase('ready'));}
    else onPhase('ready');
  }
  function exportComplete(action='copy'){state.exported=true;render();app.querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});}
  async function copyQuestions(){
    if(!canExport())return;const text=buildChecklist();let copied=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true;}}catch{}
    if(!copied){const area=document.createElement('textarea');area.value=text;area.className='visually-hidden';document.body.appendChild(area);area.select();try{copied=document.execCommand('copy');}catch{}area.remove();}
    if(copied){exportComplete();toast('問題及條款出處已複製。');}
    else openModal(`<div class="dialog-heading"><div><p class="kicker">複製問題清單</p><h2 id="dialog-title">手動複製清單。</h2></div>${closeButton()}</div><p>這裏無法自動複製，請選取下方文字後複製。</p><textarea class="manual-copy" rows="12" readonly aria-label="完整問題清單">${esc(text)}</textarea><div class="dialog-actions">${button('select-copy','全選','quiet')}${button('confirm-shared','我已複製','solid')}</div>`);
  }
  function downloadQuestions(){if(!canExport())return;const url=URL.createObjectURL(new Blob(['\uFEFF',buildChecklist()],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Policy-Lens_確認問題清單.txt';document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),2000);exportComplete('download');toast('已開始下載，請自行將清單交給顧問。');}
  function moveQuestion(id,delta){const i=state.selected.indexOf(id),j=i+delta;if(i<0||j<0||j>=state.selected.length)return;[state.selected[i],state.selected[j]]=[state.selected[j],state.selected[i]];state.exported=false;render();app.querySelector(`[data-question-edit="${id}"]`)?.focus({preventScroll:true});}

  function refreshQuestionMeta(id){
    const field=app.querySelector(`[data-reviewed="${id}"]`);
    if(field){field.checked=false;field.parentElement.replaceChildren(field,document.createTextNode('我已檢閱這段答覆'));}
    const summary=app.querySelector('.question-summary > span');
    if(summary)summary.textContent=`${state.selected.length} 條問題／${state.selected.filter(item=>state.reviewed.includes(item)).length} 條已由你檢閱`;
    const completion=app.querySelector('.completion');
    if(completion){completion.classList.remove('is-ready');completion.querySelector('.kicker').textContent='下一步';completion.querySelector('h2').innerHTML='把這些問題<br>交給你的顧問。';completion.querySelector('p:not(.kicker)').textContent='複製或下載清單，自行交給顧問，並要求對方依據實際保單條款逐一回答。';}
  }

  document.addEventListener('click',event=>{
    if(event.target.matches('[data-overlay]'))return closeModal();
    const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
    const {action,id}=target.dataset;
    if(action==='home')go(0);
    else if(action==='navigate')go(Number(target.dataset.page));
    else if(action==='start-demo')loadSample(1);
    else if(action==='load-sample'){state.demo=true;state.marketing=true;render();toast('已加入示例保單及小冊子，核對後即可繼續。');}
    else if(action==='pick-files')document.getElementById('file-input').click();
    else if(action==='continue-documents'){if(state.demo)go(2);else openModal(`<div class="dialog-heading"><div><p class="kicker">關於此原型的說明</p><h2 id="dialog-title">你的檔案，由你保留。</h2></div>${closeButton()}</div><p>你可在本機預覽檔案，但本原型不會分析內容。繼續使用虛構示例保單即可體驗完整流程，你的檔案會保持獨立。</p><div class="dialog-actions">${button('close-modal','繼續預覽','quiet')}${button('sample-continue',`繼續示範 ${icon('arrow')}`,'solid')}</div>`);}
    else if(action==='sample-continue')loadSample(2);
    else if(action==='preview')previewFile(id);
    else if(action==='remove-file'){const item=state.files.find(file=>file.id===id);if(item)URL.revokeObjectURL(item.url);state.files=state.files.filter(file=>file.id!==id);render();app.querySelector('[data-action="pick-files"]')?.focus({preventScroll:true});}
    else if(action==='remove-marketing'||action==='add-marketing'){state.marketing=action==='add-marketing';render();toast(state.marketing?'已加入示例小冊子。':'已移除示例小冊子，保障概覽及情境仍可使用。');}
    else if(action==='choose'){const {field,value}=target.dataset;state[field]=Array.isArray(state[field])?(state[field].includes(value)?state[field].filter(item=>item!==value):[...state[field],value]):(state[field]===value?'':value);state.exported=false;render();[...app.querySelectorAll('[data-action="choose"]')].find(item=>item.dataset.field===field&&item.dataset.value===value)?.focus({preventScroll:true});}
    else if(action==='skip-context')go(3);
    else if(action==='tab'){state.tab=id;render();document.getElementById(`tab-${id}`)?.focus({preventScroll:true});}
    else if(action==='filter'){state.filter=id;render();app.querySelector(`[data-action="filter"][data-id="${id}"]`)?.focus({preventScroll:true});}
    else if(action==='toggle-question'){const exists=state.selected.includes(id);state.selected=exists?state.selected.filter(item=>item!==id):[...state.selected,id];state.exported=false;render();app.querySelector(`[data-action="toggle-question"][data-id="${id}"]`)?.focus({preventScroll:true});toast(exists?'已移除問題。':'已加入問題清單，並附上原文出處。');}
    else if(action==='delete-question'){const index=state.selected.indexOf(id);state.selected=state.selected.filter(item=>item!==id);state.exported=false;render();const next=state.selected[Math.min(index,state.selected.length-1)];(next?app.querySelector(`[data-question-edit="${next}"]`):app.querySelector('.empty-state [data-page="4"]'))?.focus({preventScroll:true});}
    else if(action==='move-up')moveQuestion(id,-1);
    else if(action==='move-down')moveQuestion(id,1);
    else if(action==='source')openSource(id);
    else if(action==='source-page')openSource(id,true);
    else if(action==='close-modal')closeModal();
    else if(action==='copy')void copyQuestions();
    else if(action==='download')downloadQuestions();
    else if(action==='generate-checklist')openChecklistPreview();
    else if(action==='concept-intro')openConcept();
    else if(action==='concept-replay'){conceptIntro?.finish();void conceptIntro?.play();}
    else if(action==='concept-pause'){if(conceptIntro?.state==='paused')conceptIntro.resume();else conceptIntro?.pause();}
    else if(action==='concept-skip')conceptIntro?.finish();
    else if(action==='completion-replay'){const surface=modalRoot.querySelector('.completion-reveal');if(surface)surface.scrollTop=0;void completionReveal?.play();}
    else if(action==='completion-copy'){closeModal();void copyQuestions();}
    else if(action==='completion-download'){closeModal();downloadQuestions();}
    else if(action==='select-copy'){const field=modalRoot.querySelector('textarea');field.focus();field.select();}
    else if(action==='confirm-shared'){closeModal();exportComplete();toast('問題清單已可分享。');}
    else if(action==='ask-agent')openAgent(target.dataset.agentKind,id);
    else if(action==='agent-source')sourceFromAgent(id);
    else if(action==='agent-mode'){
      const thread=activeAgent;if(!thread||thread.busy)return;
      thread.mode=id;modalRoot.querySelectorAll('[data-action="agent-mode"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===id)));
      const suggestions=modalRoot.querySelector('.agent-suggestions');if(suggestions)suggestions.innerHTML=suggestionMarkup(agentSuggestions(thread));updateAgentDesk(thread);
    }
    else if(action==='agent-topic'){
      const thread=activeAgent;if(!thread||thread.busy||!source(id))return;
      thread.sourceId=id;thread.scenarioId=null;thread.label=source(id).title;thread.lastReply=null;
      modalRoot.querySelector('.agent-header .small-note').textContent=`${thread.label} / 示例對話`;
      const suggestions=modalRoot.querySelector('.agent-suggestions');if(suggestions)suggestions.innerHTML=suggestionMarkup(agentSuggestions(thread));updateAgentDesk(thread);
    }
    else if(action==='agent-suggest'){
      if(!activeAgent||activeAgent.busy)return;const field=modalRoot.querySelector('[data-agent-draft]');activeAgent.draft=target.dataset.prompt;field.value=activeAgent.draft;resizeAgentField(field);setAgentBusy(activeAgent);field.focus();
    }
    else if(action==='agent-save')saveAgentQuestion(id);
    else if(action==='agent-save-scenario'){
      if(!activeAgent||!scenario(id))return;if(!state.selected.includes(id))state.selected.push(id);state.exported=false;updateAgentListLink(activeAgent);target.disabled=true;target.innerHTML=`已加入問題清單 ${icon('check')}`;
    }
    else if(action==='agent-continue')go(state.page<4?4:5);
  });

  document.addEventListener('submit',event=>{if(event.target.id==='agent-form'){event.preventDefault();void sendAgent();}});

  document.addEventListener('input',event=>{
    const target=event.target;
    if(target.dataset.input){state[target.dataset.input]=target.value;state.exported=false;if(target.dataset.input==='destination')app.querySelectorAll('[data-field="destination"]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.value===target.value)));}
    if(target.dataset.questionEdit){const id=target.dataset.questionEdit;state.edits[id]=target.value;state.exported=false;state.reviewed=state.reviewed.filter(item=>item!==id);if(target.value.trim())target.removeAttribute('aria-invalid');target.closest('.question-item').querySelector('.question-source').textContent=referenceLine(id);refreshQuestionMeta(id);}
    if(target.dataset.reply){const id=target.dataset.reply;state.replies[id]=target.value;state.exported=false;state.reviewed=state.reviewed.filter(item=>item!==id);refreshQuestionMeta(id);}
    if(target.hasAttribute('data-agent-draft')&&activeAgent){activeAgent.draft=target.value;resizeAgentField(target);setAgentBusy(activeAgent);}
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.id==='file-input')addFiles(target.files);
    if(target.dataset.fileKind){const item=state.files.find(file=>file.id===target.dataset.fileKind);if(item)item.kind=target.value;}
    if(target.dataset.reviewed){const id=target.dataset.reviewed;state.reviewed=target.checked?[...new Set([...state.reviewed,id])]:state.reviewed.filter(item=>item!==id);render();app.querySelector(`[data-reviewed="${id}"]`)?.focus({preventScroll:true});}
  });
  document.addEventListener('dragover',event=>{event.preventDefault();event.target.closest('#dropzone')?.classList.add('drag');});
  document.addEventListener('dragleave',event=>{const zone=event.target.closest('#dropzone');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('drag');});
  document.addEventListener('drop',event=>{event.preventDefault();if(event.target.closest('#dropzone'))addFiles(event.dataTransfer.files);document.getElementById('dropzone')?.classList.remove('drag');});
  document.addEventListener('keydown',event=>{
    if(event.target.hasAttribute?.('data-agent-draft')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();void sendAgent();return;}
    if(modalRoot.firstChild){if(event.key==='Escape')closeModal();if(event.key==='Tab'){const panel=modalRoot.querySelector('[role="dialog"]'),items=[...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(item=>!item.disabled),first=items[0],last=items[items.length-1];if(document.activeElement===panel||!panel.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
    if(event.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const items=[...app.querySelectorAll('[role="tab"]')],index=items.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;items[next].click();}
  });
  window.addEventListener('popstate',()=>{closeModal({resumeAgent:false});const page=pages.indexOf(location.hash.slice(1));if(page>=0&&page<=state.reached){state.page=page;render({focus:true});}});
  window.addEventListener('pagehide',()=>{state.files.forEach(item=>URL.revokeObjectURL(item.url));if(activeAgent)settleAgent(activeAgent);completionReveal?.destroy();completionReveal=null;conceptIntro?.destroy();conceptIntro=null;});
  try{window.history.replaceState({page:0},'','#home');}catch{}
  render();
})();
