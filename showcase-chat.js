/* Local transcript adapter; motion and grounded replies stay in their original modules. */
(() => {
  'use strict';
  const mounts = new WeakMap();
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const priorityLabels = {1:'首要',2:'重要',3:'待確認',4:'參考'};
  // Editorial review points for the named fictional sample, not inferred policy analysis.
  // Every quote is matched literally; both evidence layouts render the same marked text.
  const sourceHighlights = {
  "basic": [
    "保險憑證所列的開始及結束時間",
    "在該期間內，於憑證所列的目的地旅遊",
    "各項保障亦受其個別條件約束。",
    "投保前請核對日期、時間及目的地。"
  ],
  "delay": [
    "超過 6 小時",
    "每連續 6 小時支付人民幣 200 元，保障期間內累計上限為人民幣 1,000 元",
    "申請時必須提供承運人簽發的延誤證明。",
    "本示例條款未進一步界定準確的時間門檻，亦未說明航班取消或錯過轉機的處理方式。"
  ],
  "medical": [
    "於保障期間內在旅遊目的地遭受意外受傷",
    "累計上限為人民幣 200,000 元",
    "治療必須符合指定醫療機構及合資格費用的要求。",
    "本示例資料未附醫療機構名單及費用細則，投保前應先索取。"
  ],
  "baggage": [
    "於受保人抵達目的地超過 8 小時後才送達",
    "累計上限為人民幣 1,000 元",
    "必須提供承運人簽發的行李延誤證明及相關購物單據。",
    "此項保障的其他條件亦同時適用。"
  ],
  "sport": [
    "因高風險運動、專業或競賽活動引致的損失，不屬本示例保單的基本保障。",
    "滑雪比賽及競賽潛水列為此類活動。",
    "本示例資料未直接說明一般滑雪場的休閒滑雪、滑雪課程或休閒潛水是否受保。",
    "請確認上述活動是否屬保障範圍，以及是否需要附加保障。"
  ],
  "claim": [
    "申請時須提交保險憑證、相關旅遊行程，以及各項保障指定的文件。",
    "航班延誤申請須有承運人簽發的延誤證明。",
    "行李延誤申請須有承運人簽發的行李延誤證明及相關購物單據。",
    "本示例資料未說明航空公司應用程式的通知截圖能否代替承運人簽發的證明。"
  ]
};

  function sourceWording(source) {
    const ranges = (sourceHighlights[source.id] || []).map((quote,index) => ({
      quote, priority:index+1, start:source.text.indexOf(quote)
    })).filter(range => range.start >= 0).sort((a,b)=>a.start-b.start);
    let cursor = 0, html = '';
    for (const {quote,priority,start} of ranges) {
      if (start < cursor) continue;
      html += escape(source.text.slice(cursor,start)) + '<mark class="pl-marker" data-priority="' + priority + '" title="' + priority + ' · ' + priorityLabels[priority] + '">' + escape(quote) + '</mark>';
      cursor = start + quote.length;
    }
    return html + escape(source.text.slice(cursor));
  }
  const sourceLegend = '<p class="sc-source-legend" aria-label="條款閱讀優先級">' +
    Object.entries(priorityLabels).map(([priority,label]) => '<span class="pl-priority" data-priority="' + priority + '">' + priority + ' · ' + label + '</span>').join('') + '</p>';
  const modes = Object.freeze({
    explain: { label:'解釋條款', help:'用白話拆解條件、限制和所需證明。', placeholder:'例如：航班延誤要符合甚麼條件？', prompts:['航班延誤要符合甚麼條件？','行李延誤需要保留哪些收據？'] },
    'what-if': { label:'假設情境', help:'寫下「如果……」，對照條款看哪些細節仍需確認。', placeholder:'例如：如果剛好延誤六小時呢？', prompts:['如果剛好延誤六小時呢？','如果因此錯過轉機航班呢？'] },
    ask: { label:'怎樣問', help:'把疑問整理成可以直接向顧問確認的具體問題。', placeholder:'例如：航班延誤的限制，我應該怎樣問？', prompts:['航班延誤的限制，我應該怎樣問？','行李延誤需要向顧問確認甚麼？'] }
  });
  function mount(host, { onQuestion } = {}) {
    mounts.get(host)?.destroy();
    const panel = host.querySelector('[data-chat-panel]');
    const stack = host.querySelector('[data-chat-stack]');
    const feed = host.querySelector('[data-chat-feed]');
    const field = host.querySelector('[data-agent-draft]');
    const form = host.querySelector('form');
    const sendButton = host.querySelector('[data-chat-send]');
    const composer = host.querySelector('.agent-composer');
    const status = host.querySelector('[data-chat-status]');
    const evidence = host.querySelector('[data-chat-evidence]');
    const motion = window.PolicyAgentMotion;
    const surfaces = window.PolicySurfaceMotion?.mount(host.ownerDocument);
    let transcript = [], draft = '', busy = false, version = 0, destroyed = false, mode = 'explain', pending = null;
    let sourceId = 'delay', scenarioId = null;
    function resize() { field.style.height = '50px'; field.style.height = `${Math.min(126, Math.max(50, field.scrollHeight))}px`; }
    function updateMode() {
      const selected = modes[mode];
      field.placeholder = selected.placeholder;
      const help = host.querySelector('[data-chat-mode-help]');
      if (help) help.textContent = `${selected.label} · ${selected.help}`;
      const suggestions = stack.querySelector('[data-chat-starters]');
      if (suggestions) suggestions.innerHTML = selected.prompts.map(question => `<button type="button" data-chat-suggestion="${escape(question)}">${escape(question)}</button>`).join('');
    }
    function update() {
      sendButton.disabled = busy || !field.value.trim();
      form.setAttribute('aria-busy', String(busy));
      host.querySelectorAll('[data-chat-mode]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.chatMode === mode)); button.disabled = busy; });
      status.textContent = busy ? '正在準備本機示例回覆……' : '本機虛構示例 · Enter 送出 · Shift + Enter 換行';
    }
    function message(item) {
      const node = host.ownerDocument.createElement('article');
      node.className = `agent-message ${item.role}`;
      if (item.role === 'user') node.innerHTML = `<p>${escape(item.text)}</p>`;
      else {
        node.innerHTML = `<span class="agent-response-label">虛構示例 · <span class="pl-marker" data-marker="${item.reply.grounded ? '12' : '7'}">${item.reply.grounded ? '已連結原文' : '未找到對應原文'}</span></span><h3>${escape(item.reply.title)}</h3>${item.reply.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}<div class="agent-evidence">${item.reply.sourceIds.map(id => `<button type="button" data-chat-source="${escape(id)}">閱讀示例原文</button>`).join('')}</div><div class="agent-followups">${item.reply.followUps.map(q => `<button type="button" data-chat-suggestion="${escape(q)}">${escape(q)}</button>`).join('')}</div><div class="agent-answer-actions"><button type="button" data-chat-save="${escape(item.question)}">保留這個問題</button></div>`;
      }
      if (item.role === 'assistant') {
        const label = host.ownerDocument.createElement('p');
        label.className = 'agent-mode-label';
        label.textContent = modes[item.mode || 'explain'].label;
        node.prepend(label);
      }
      stack.appendChild(node);
      return node;
    }
    function render() {
      stack.replaceChildren();
      if (!transcript.length) stack.innerHTML = '<div class="agent-empty"><h3>從一條不清楚的條款開始。</h3><p>可以詢問虛構的航班延誤條款。回覆會連同原文保留，方便繼續問得更具體。</p><div class="agent-suggestions" data-chat-starters></div></div>';
      else transcript.forEach(message);
      updateMode();
    }
    function showSource(id, messageHost) {
      const source = window.PolicyDemo?.sources?.find(item => item.id === id);
      if (!source) return;
      sourceId = source.id;
      evidence.innerHTML = `<p class="sc-eyebrow">晴日旅遊 · 虛構條款 · 第 ${escape(source.page)} 頁</p><h3>${escape(source.title)}</h3>${sourceLegend}<blockquote class="agent-desk-quote">${sourceWording(source)}</blockquote><p>請結合上下文閱讀條件；示例解釋不代表真實保障判定。</p>`;
      motion?.transitionDesk(evidence);
      if (messageHost) {
        let inline = messageHost.querySelector('.sc-chat-inline-source');
        if (!inline) { inline = host.ownerDocument.createElement('div'); inline.className = 'sc-chat-inline-source'; messageHost.appendChild(inline); }
        inline.innerHTML = `<p class="agent-response-label">虛構示例條款 · 第 ${escape(source.page)} 頁</p><h4>${escape(source.title)}</h4>${sourceLegend}<blockquote>${sourceWording(source)}</blockquote>`;
        surfaces?.enter(inline, { distance:0 });
        if (inline.getClientRects().length) inline.scrollIntoView?.({ block: 'nearest' });
      }
    }
    function completePending() {
      if (pending) { transcript.push(pending); pending = null; }
      busy = false;
      update();
    }
    async function submit(question) {
      if (destroyed || busy || !String(question).trim()) return;
      open(false);
      surfaces?.cancel(panel); // The composer must have final geometry before launch.
      const text = String(question).trim().slice(0,1000);
      const token = ++version;
      busy = true;
      const fromRect = field.getBoundingClientRect();
      transcript.push({ role: 'user', text });
      const reply = window.PolicyAgentReplies.reply(text, { sourceId, scenarioId, mode });
      pending = { role: 'assistant', question: text, reply, mode };
      sourceId = reply.grounded ? reply.sourceIds[0] || null : null;
      scenarioId = reply.grounded ? reply.scenarioIds?.[0] || null : null;
      if (sourceId) showSource(sourceId);
      else {
        evidence.innerHTML = '<h3><span class="pl-marker" data-marker="7">未找到對應示例條款。</span></h3><p>這個問題在虛構示例中未有來源依據。請選取已連結的條款，重新開始原文討論。</p>';
        motion?.transitionDesk(evidence);
      }
      field.value = draft = '';
      resize(); update();
      stack.querySelector('.agent-empty')?.remove();
      const bubble = message(transcript.at(-1));
      await motion?.launch({ bubble, composer, field, feed, button: sendButton, fromRect });
      if (destroyed || token !== version) return;
      const answer = pending;
      pending = null;
      transcript.push(answer);
      const response = message(answer);
      await motion?.reveal({ element: response, feed });
      if (destroyed || token !== version) return;
      busy = false; update(); field.focus({ preventScroll: true });
    }
    function open(focus = true) {
      if (destroyed) return;
      if (panel.hidden) {
        if (surfaces) surfaces.visibility(panel, true);
        else panel.hidden = false;
      }
      host.querySelector('[data-chat-open]').setAttribute('aria-expanded', 'true');
      field.value = draft;
      resize(); update();
      if (focus) field.focus({ preventScroll: true });
    }
    function close() {
      if (destroyed) return;
      version++; motion?.cancelAll(); completePending(); render();
      if (surfaces) surfaces.visibility(panel, false);
      else panel.hidden = true;
      const opener = host.querySelector('[data-chat-open]');
      opener.setAttribute('aria-expanded', 'false'); opener.focus({ preventScroll: true });
    }
    function replay() {
      if (destroyed) return Promise.resolve();
      version++; motion?.cancelAll(); pending = null; busy = false; transcript = [];
      sourceId = 'delay'; scenarioId = null;
      render(); return submit('航班延誤條件怎樣寫？');
    }
    function click(event) {
      const button = event.target.closest('button');
      if (!button || !host.contains(button)) return;
      if (button.hasAttribute('data-chat-close')) close();
      else if (button.hasAttribute('data-chat-open')) open();
      else if (button.hasAttribute('data-chat-replay')) replay();
      else if (button.dataset.chatSuggestion) submit(button.dataset.chatSuggestion);
      else if (button.dataset.chatSource) { scenarioId = null; showSource(button.dataset.chatSource, button.closest('.agent-message')); }
      else if (button.dataset.chatMode && !busy) { mode = button.dataset.chatMode; updateMode(); update(); }
      else if (button.dataset.chatSave) { onQuestion?.(button.dataset.chatSave); status.textContent = '問題已保留在此頁筆記。'; }
    }
    function keydown(event) {
      if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); }
      if (event.target === field && event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); submit(field.value); }
    }
    const input = () => { draft = field.value; resize(); update(); };
    const submitEvent = event => { event.preventDefault(); submit(field.value); };
    const visibility = () => { if (host.ownerDocument.hidden) { version++; motion?.cancelAll(); completePending(); render(); } };
    host.addEventListener('click', click); host.addEventListener('keydown', keydown);
    field.addEventListener('input', input); form.addEventListener('submit', submitEvent);
    host.ownerDocument.addEventListener('visibilitychange', visibility);
    const observer = new MutationObserver(() => { if (!host.isConnected) destroy(); });
    observer.observe(host.ownerDocument.documentElement, {childList:true,subtree:true});
    function destroy() {
      if (destroyed) return;
      surfaces?.cancel(panel);
      version++; motion?.cancelAll(); completePending(); destroyed = true; observer.disconnect();
      host.removeEventListener('click',click); host.removeEventListener('keydown',keydown);
      field.removeEventListener('input',input); form.removeEventListener('submit',submitEvent);
      host.ownerDocument.removeEventListener('visibilitychange',visibility);
      mounts.delete(host);
    }
    const controller = Object.freeze({ open, close, replay, submit, destroy, get busy() { return busy; }, get transcript() { return transcript.map(item=>({...item})); }, get draft() { return draft; } });
    mounts.set(host,controller); render(); showSource('delay'); update();
    return controller;
  }
  window.PolicyShowcaseChat = Object.freeze({ mount });
})();
