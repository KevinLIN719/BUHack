/* Self-contained local conversation adapter for the connected experience.
 * Replies and citations use the same selected PolicyFixtures record as review. */
(() => {
  'use strict';
  const mounts = new WeakMap();
  let serial = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const labels = Object.freeze({ 1:'首要', 2:'重要', 3:'待確認', 4:'參考' });
  const modes = Object.freeze({
    explain: { label:'解釋條款', help:'用白話拆解這份保單的條件與限制。', placeholder:'例如：這項保障要符合甚麼條件？' },
    'what-if': { label:'假設情境', help:'描述你的情況，對照原文看哪些細節仍需確認。', placeholder:'例如：如果發生這個情況，還要確認甚麼？' },
    ask: { label:'怎樣問', help:'把疑問整理成可以直接向顧問確認的問題。', placeholder:'例如：關於這項條款，我應如何問？' }
  });
  function mount(host, { getPolicy, getContext = () => ({}), onSaveQuestion } = {}) {
    if (!host?.ownerDocument) throw new TypeError('PolicyExperienceChat.mount needs an empty DOM host.');
    if (!window.PolicyExperienceData) throw new Error('Load experience-data.js before experience-chat.js.');
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument, view = doc.defaultView;
    const motion = window.PolicyAgentMotion;
    const id = `expchat-draft-${++serial}`;
    const workspace = doc.createElement('div');
    workspace.className = 'agent-workspace expchat-workspace';
    workspace.innerHTML = `<div class="agent-header"><div><p class="kicker">同一份保單／再看仔細一點</p><h3>一起釐清這個問題。</h3><p class="small-note" data-expchat-policy></p></div><button type="button" data-expchat-reset>清除對話</button></div><div class="agent-layout"><section class="agent-conversation" aria-label="保單對話"><div class="agent-feed" data-expchat-feed role="log" aria-label="你的保單對話" aria-live="off"><div class="agent-stack" data-expchat-stack></div></div><form class="agent-composer" data-expchat-form><label class="visually-hidden" for="${id}">詢問所選虛構保單的條款</label><p class="agent-mode-help" id="${id}-help" data-expchat-mode-help role="status" aria-live="polite"></p><textarea aria-describedby="${id}-help" id="${id}" data-expchat-draft maxlength="1000" rows="2" placeholder="詢問某項條件，或選擇上方的問題……"></textarea><div class="agent-composer-toolbar"><div class="agent-modes" role="group" aria-label="回覆方式">${Object.entries(modes).map(([value,item]) => `<button type="button" data-expchat-mode="${value}" aria-pressed="${value === 'explain'}">${item.label}</button>`).join('')}</div><button type="submit" class="agent-send-button" data-expchat-send aria-label="送出問題" disabled>↑</button></div></form></section><aside class="agent-desk ex-chat-evidence" aria-label="所選保單的確切原文"><div class="agent-desk-content" data-expchat-evidence></div></aside></div><p class="agent-disclosure" data-expchat-status role="status" aria-live="polite"></p>`;
    host.appendChild(workspace);
    const $ = selector => workspace.querySelector(selector);
    const feed = $('[data-expchat-feed]'), stack = $('[data-expchat-stack]');
    const field = $('[data-expchat-draft]'), form = $('[data-expchat-form]');
    const send = $('[data-expchat-send]'), evidence = $('[data-expchat-evidence]');
    const composer = $('.agent-composer'), status = $('[data-expchat-status]');
    const readPolicy = () => getPolicy?.() || window.PolicyExperienceData.items[0] || null;
    let policyId = readPolicy()?.id || null, transcript = [], pending = null;
    let busy = false, dead = false, version = 0, lastFindingId = null, mode = 'explain';
    const find = id => readPolicy()?.findings.find(finding => finding.id === id);
    const source = finding => `<span class="pl-priority" data-priority="${finding.priority}">${finding.priority} · ${labels[finding.priority]}</span><blockquote class="agent-desk-quote"><mark class="pl-marker" data-priority="${finding.priority}">${escape(finding.quote)}</mark></blockquote>`;
    function resize() {
      field.style.height = '50px';
      field.style.height = `${Math.min(126,Math.max(50,field.scrollHeight))}px`;
    }
    function updateMode() {
      const selected = modes[mode];
      field.placeholder = selected.placeholder;
      const help = $('[data-expchat-mode-help]'), text = `${selected.label} · ${selected.help}`;
      if (help.textContent !== text) help.textContent = text;
      workspace.querySelectorAll('[data-expchat-mode]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.expchatMode === mode));
        button.disabled = busy;
      });
    }
    function sync() {
      updateMode();
      send.disabled = busy || !field.value.trim();
      form.setAttribute('aria-busy', String(busy));
      feed.setAttribute('aria-busy', String(busy));
      $('[data-expchat-policy]').textContent = `${readPolicy()?.title || '尚未選擇保單'} · 虛構示例`;
      status.textContent = busy ? '正在準備附有條款依據的本機示例回覆……' : '示例回覆 · 按 Enter 送出 · 按 Shift + Enter 換行';
    }
    function showSource(findingId, animate = true) {
      const policy = readPolicy(), finding = policy?.findings.find(item => item.id === findingId);
      if (!finding) {
        evidence.innerHTML = '<p class="kicker">條款參考區</p><h3>未找到相符的示例條款。</h3><p>所選虛構保單沒有與這個問題相符的原文。請選擇一項附有條款的重點，重新開始對照。</p>';
      } else {
        evidence.innerHTML = `<p class="kicker">${escape(policy.title)}／虛構條款依據</p><h3>${escape(finding.title)}</h3>${source(finding)}<p class="small-note">${escape(policy.sourceLabel)}</p><p>問題旁會保留確切原文。本機示例說明不代表真實保障已獲確認。</p>`;
      }
      if (animate) motion?.transitionDesk(evidence);
    }
    function message(item) {
      const element = doc.createElement('article');
      element.className = `agent-message ${item.role}`;
      if (item.role === 'user') element.innerHTML = `<p>${escape(item.text)}</p>`;
      else {
        const reply = item.reply, policy = readPolicy(), finding = policy?.findings.find(value => value.id === reply.findingId);
        const followups = reply.followUps.map(question => {
          const next = policy?.findings.find(value => value.question === question);
          return next ? `<button type="button" data-expchat-suggestion="${escape(next.id)}">${escape(question)}</button>` : '';
        }).join('');
        element.innerHTML = `<p class="agent-mode-label">${modes[item.mode || 'explain'].label}</p><span class="agent-response-label">本機虛構示例 · <span class="pl-marker" data-marker="${reply.grounded ? '12' : '7'}">${reply.grounded ? '附有條款依據' : '需要其他依據'}</span></span><h3>${escape(reply.title)}</h3>${reply.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}${finding ? `<div class="agent-evidence"><button type="button" data-expchat-source="${escape(finding.id)}">查看確切原文 ↗</button></div><div class="ex-chat-inline-source"><p class="agent-response-label">${escape(policy.title)} · ${escape(policy.sourceLabel)}</p>${source(finding)}</div>` : ''}<div class="agent-followups">${followups}</div>${finding ? `<div class="agent-answer-actions"><button type="button" data-expchat-save="${escape(finding.id)}">保留這個問題</button></div>` : ''}`;
      }
      stack.appendChild(element);
      return element;
    }
    function render() {
      stack.replaceChildren();
      if (transcript.length) transcript.forEach(message);
      else {
        const policy = readPolicy();
        stack.innerHTML = `<div class="agent-empty"><h3>一個問題，<br />再看清楚一點。</h3><p>你可以詢問「${escape(policy?.title || '所選示例')}」的條件。說明與確切原文會放在一起，方便對照。</p><div class="agent-suggestions">${(policy?.findings || []).slice(0,3).map(finding => `<button type="button" data-expchat-suggestion="${escape(finding.id)}">${escape(finding.question)}</button>`).join('')}</div></div>`;
      }
    }
    function completePending() {
      if (pending) { transcript.push(pending); pending = null; }
      busy = false;
    }
    function settle() {
      if (dead) return;
      if (readPolicy()?.id !== policyId) { reset(); return; }
      version++;
      motion?.cancelAll();
      completePending(); render(); sync();
    }
    function reset() {
      if (dead) return;
      version++; motion?.cancelAll();
      pending = null; transcript = []; busy = false; lastFindingId = readPolicy()?.findings[0]?.id || null;
      policyId = readPolicy()?.id || null;
      field.value = ''; resize(); render();
      showSource(readPolicy()?.findings[0]?.id, false); sync();
    }
    function ensurePolicy() {
      if (readPolicy()?.id !== policyId) reset();
    }
    async function submit(question, { findingId } = {}) {
      if (dead) return;
      ensurePolicy();
      if (busy) return;
      const text = String(question ?? '').trim().slice(0,1000), policy = readPolicy();
      if (!text || !policy) return;
      const token = ++version, selectedPolicyId = policy.id;
      const fromRect = field.getBoundingClientRect();
      const reply = window.PolicyExperienceData.reply(selectedPolicyId,text,{ findingId:findingId || lastFindingId, context:getContext(), mode });
      lastFindingId = reply.grounded ? reply.findingId : null;
      transcript.push({ role:'user', text });
      pending = { role:'assistant', question:text, reply, mode };
      busy = true;
      field.value = ''; resize(); sync();
      showSource(lastFindingId);
      stack.querySelector('.agent-empty')?.remove();
      const bubble = message(transcript[transcript.length-1]);
      const current = () => !dead && token === version && selectedPolicyId === readPolicy()?.id;
      try {
        await motion?.launch({ bubble, composer, field, feed, button:send, fromRect });
        if (!current()) { if (!dead && token === version && selectedPolicyId !== readPolicy()?.id) reset(); return; }
        const answer = pending;
        pending = null; transcript.push(answer);
        const response = message(answer);
        await motion?.reveal({ element:response, feed });
        if (!current()) { if (!dead && token === version && selectedPolicyId !== readPolicy()?.id) reset(); return; }
        busy = false; sync(); field.focus({ preventScroll:true });
      } catch {
        if (current()) { completePending(); render(); sync(); }
      }
    }
    function click(event) {
      const button = event.target.closest('button');
      if (!button || !workspace.contains(button) || dead) return;
      ensurePolicy();
      if (button.dataset.expchatMode && !busy) { mode = button.dataset.expchatMode; updateMode(); }
      else if (button.hasAttribute('data-expchat-reset')) { reset(); field.focus({ preventScroll:true }); }
      else if (button.dataset.expchatSuggestion) {
        const finding = find(button.dataset.expchatSuggestion);
        if (finding) submit(finding.question,{findingId:finding.id});
      } else if (button.dataset.expchatSource) {
        const finding = find(button.dataset.expchatSource);
        if (finding) { lastFindingId = finding.id; showSource(finding.id); }
      } else if (button.dataset.expchatSave) {
        const finding = find(button.dataset.expchatSave);
        if (finding && onSaveQuestion) {
          try {
            const result = onSaveQuestion(finding);
            status.textContent = result === false ? '這個問題已在你的清單內。' : '已將問題加入你的確認清單。';
          } catch { status.textContent = '未能保留這個問題，請再試一次。'; }
        }
      }
    }
    const input = () => { if (!dead) { resize(); sync(); } };
    const submitted = event => { event.preventDefault(); submit(field.value); };
    const keydown = event => {
      if (event.target === field && event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault(); submit(field.value);
      }
    };
    const visibility = () => { if (doc.hidden) settle(); };
    const resizeActive = () => { if (busy) settle(); };
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrast = view.matchMedia?.('(forced-colors: active)');
    const preference = event => { if (event.matches) settle(); };
    workspace.addEventListener('click',click); workspace.addEventListener('keydown',keydown);
    field.addEventListener('input',input); form.addEventListener('submit',submitted);
    doc.addEventListener('visibilitychange',visibility); view.addEventListener('resize',resizeActive);
    media?.addEventListener?.('change',preference); contrast?.addEventListener?.('change',preference);
    const observer = new view.MutationObserver(() => { if (!host.isConnected || !host.contains(workspace)) destroy(); });
    observer.observe(doc.documentElement,{childList:true,subtree:true});
    function destroy() {
      if (dead) return;
      version++; motion?.cancelAll(); completePending(); dead = true;
      observer.disconnect();
      workspace.removeEventListener('click',click); workspace.removeEventListener('keydown',keydown);
      field.removeEventListener('input',input); form.removeEventListener('submit',submitted);
      doc.removeEventListener('visibilitychange',visibility); view.removeEventListener('resize',resizeActive);
      media?.removeEventListener?.('change',preference); contrast?.removeEventListener?.('change',preference);
      workspace.remove();
      mounts.delete(host);
    }
    const controller = Object.freeze({ submit, reset, settle, destroy,
      get busy() { return busy; }, get draft() { return field.value; },
      get transcript() { return transcript.map(item => ({...item})); }
    });
    mounts.set(host,controller);
    reset();
    return controller;
  }
  window.PolicyExperienceChat = Object.freeze({ mount });
})();
