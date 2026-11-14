(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reviewKey = 'policy-lens-live-review';
  const runKey = 'policy-lens-live-run';
  const runLabels = {queued:'排隊中',running:'調查中',awaiting_input:'等你補充材料',partial:'已完成初步分析',failed:'調查失敗',cancelled:'已取消',interrupted:'服務重啟，調查中斷'};
  // Server-provided reasons, turned into a sentence the user can act on. No reason is invented:
  // an unknown code falls back to "see the server log".
  const stopReasons = {
    server_restarted: '後端在調查途中重啟了，這次調查沒有完成。材料都還在，重新按一次「開始調查」即可。',
    timeout: '模型在 120 秒內沒有完成。可以重試，或把問題問得更小一點。',
    budget_exhausted: '模型把調查步數用完了才給出結論。可以重試，或縮小材料範圍。',
    rate_limited: '模型接口被限流了，稍等一兩分鐘再試。',
    model_unreachable: '連不到模型服務，請檢查網絡或 .env 裡的地址。',
    model_output_invalid: '模型返回的內容不符合格式，自動重試一次後仍然失敗。可以直接重試。',
    model_failed: '模型執行出錯，詳細原因見後端日誌。',
    additional_information: '已給出初步結論，補上材料後可以續查。',
    semantic_review_pending: '初步分析已完成。',
    user_cancelled: '你取消了這次調查。'
  };
  const verdictLabels = {supported:'語意相符',partial:'僅部分相符',unsupported:'原文不支援',quote_mismatch:'引文與結論不符'};
  const reviewLabels = {checked:'逐條語意複核完成',issues_found:'語意複核發現問題',unavailable:'語意複核未完成',not_applicable:'沒有可複核的引用結論'};
  const errors = {
    AGENT_NOT_CONNECTED:'伺服器未設定模型 API Key，暫時不能執行調查。',
    NO_NEW_INPUT:'沒有新材料，暫時不需要續查。',
    PARENT_RUN_ACTIVE:'上一次調查仍在執行，請等它結束。',
    PARENT_RUN_NOT_RESUMABLE:'上一次調查沒有可續用的結論，請重新開始調查。',
    REVISION_CONFLICT:'調查期間材料有變動，請重新開始。',
    EMPTY_GOAL:'請先寫下你想問的問題。'
  };
  const verdictTone = {supported:'ok',partial:'warn',unsupported:'bad',quote_mismatch:'bad'};
  const comparisonLabels = {supported_with_conditions:'有條件支持',apparent_conflict:'表面衝突',insufficient_basis:'材料不足以判斷'};
  const comparisonTone = {supported_with_conditions:'ok',apparent_conflict:'bad',insufficient_basis:'warn'};
  const scenarioLabels = {satisfied:'符合門檻',not_satisfied:'未達門檻',boundary:'剛好等於門檻',insufficient_information:'條件不足，無法比較'};
  const scenarioTone = {satisfied:'ok',not_satisfied:'warn',boundary:'warn',insufficient_information:'bad'};
  const scenarioUnitLabels = {minutes:'分鐘',hours:'小時',days:'天'};
  const brokerLabels = {supported:'與條款一致',overstated:'說大了，漏了條件',not_in_contract:'條款裡找不到依據',contradicted:'與條款原文衝突'};
  const brokerTone = {supported:'ok',overstated:'warn',not_in_contract:'warn',contradicted:'bad'};
  const changeLabels = {unchanged:'仍成立',strengthened:'更明確',weakened:'條件變多',reversed:'被推翻',withdrawn:'已不適用'};
  const changeTone = {unchanged:'ok',strengthened:'ok',weakened:'warn',reversed:'bad',withdrawn:'warn'};
  const state = {reviewId:null, review:null, runId:null, busy:false};

  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const status = text => { $('run-status').textContent = text; };

  async function api(path, options = {}) {
    let response;
    try { response = await fetch('/api' + path, {credentials:'same-origin', signal:AbortSignal.timeout(30000), ...options}); }
    catch { throw new Error('無法連接服務，請確認前端和後端均已啟動。'); }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const code = body.error?.code;
      const error = new Error(errors[code] || body.error?.message || '暫時未能處理，請重試。');
      error.code = code; error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  function rememberRun(runId) {
    try { localStorage.setItem(runKey, JSON.stringify({reviewId: state.reviewId, runId})); } catch {}
  }
  function lastRunId() {
    try {
      const saved = JSON.parse(localStorage.getItem(runKey) || 'null');
      return saved && saved.reviewId === state.reviewId ? saved.runId : null;
    } catch { return null; }
  }

  function lock(value) {
    state.busy = value;
    const ready = (state.review?.documents ?? []).some(doc => ['ready','partial'].includes(doc.status));
    $('start').disabled = value || !ready;
    $('resume').disabled = value;
    $('goal').disabled = value;
    $('scenario').disabled = value;
    $('scenario-run').disabled = value;
  }

  function citationButton(citation) {
    const missing = citation.status === 'missing';
    const page = citation.pageLabel || (citation.pageIndex ? `第 ${citation.pageIndex} 頁` : '');
    const button = node('button', `${citation.documentName || '（材料已刪除）'}${page ? ` · ${page}` : ''} · ${missing ? '原文已不在本次審閱中' : '已核對原文'}`, `citation ${missing ? 'missing' : ''}`);
    button.type = 'button';
    if (!missing && citation.pageIndex && typeof window.openPageAt === 'function') {
      button.title = '在逐頁原文中查看';
      button.addEventListener('click', () => { void window.openPageAt(citation.documentId, citation.pageIndex); });
    } else { button.disabled = true; }
    return button;
  }

  const overviewTitles = {
    broker_conflict: '經紀說法',
    broker_overstated: '經紀說法',
    promotion_conflict: '宣傳材料',
    unsupported_claim: '引用核對',
    cannot_confirm: '尚未確認',
    scenario_caveat: '情境假設',
    need_material: '待補材料'
  };

  // The list comes from the server so the order cannot drift from the evidence; the client only
  // decides how to lay it out. Empty when nothing needs a decision, in which case nothing renders.
  function renderOverview(report) {
    const overview = report.overview;
    if (!overview?.items?.length) return node('span');
    const section = node('section', undefined, 'overview');
    section.append(node('h3', '先看這幾件事'));
    section.append(node('p', '按「會影響判斷的程度」排出的前幾項，完整內容在下面。', 'muted'));
    const list = node('ol', undefined, 'overview-list');
    for (const item of overview.items) {
      const row = node('li', undefined, 'overview-item');
      row.append(node('span', overviewTitles[item.kind] ?? item.kind, 'badge overview-kind'));
      row.append(node('b', item.title));
      row.append(node('div', item.detail, 'finding-text'));
      const seen = new Set();
      for (const citation of item.citations ?? []) {
        if (seen.has(citation.sourceId)) continue;
        seen.add(citation.sourceId);
        row.append(citationButton(citation));
      }
      list.append(row);
    }
    section.append(list);
    if (overview.remaining > 0) section.append(node('p', `另有 ${overview.remaining} 項同樣需要確認，見下方分節。`, 'muted'));
    if (overview.integrity?.missing > 0) {
      section.append(node('p', `注意：有 ${overview.integrity.missing} 處引用所指的原文已不在這次材料中。`, 'muted'));
    }
    return section;
  }

  function renderReport(report) {
    const host = $('report');
    host.replaceChildren();
    host.hidden = false;

    const integrity = report.citationIntegrity ?? {cited:0, verified:0, missing:0};
    const kpis = node('div', undefined, 'kpis');
    for (const [value, label, tone] of [
      [report.findings.length, '條結論', ''],
      [integrity.cited, '處引用', ''],
      [integrity.verified, '已核對原文', ''],
      [integrity.missing, '處原文已刪除', integrity.missing ? 'bad' : '']
    ]) {
      const cell = node('div', undefined, `kpi ${tone}`);
      cell.append(node('b', String(value)), node('span', label));
      kpis.append(cell);
    }
    host.append(kpis);
    host.append(renderOverview(report));

    const review = report.review;
    host.append(node('p', review ? `${reviewLabels[review.status] ?? review.status}${review.items?.length ? `（逐條檢查 ${review.items.length} 條）` : ''}` : '這份報告尚未做語意複核。', 'review-line'));

    const verdicts = new Map((review?.items ?? []).map(item => [item.index, item]));
    const findingsHost = node('div', undefined, 'findings');
    report.findings.forEach((finding, index) => {
      const article = node('article', undefined, 'finding');
      const head = node('div', undefined, 'finding-head');
      head.append(node('span', finding.evidenceStatus, `badge ${finding.evidenceStatus === 'unknown' ? 'unknown' : ''}`));
      article.append(head, node('div', finding.explanation, 'finding-text'));
      for (const citation of finding.citations ?? []) {
        const block = node('div', undefined, 'citation-block');
        block.append(citationButton(citation));
        if (citation.quote) block.append(node('blockquote', citation.quote));
        article.append(block);
      }
      const verdict = verdicts.get(index);
      if (verdict) {
        const line = node('div', undefined, `verdict ${verdictTone[verdict.verdict] ?? ''}`);
        line.append(node('b', `語意複核 · ${verdictLabels[verdict.verdict] ?? verdict.verdict}`));
        if (verdict.note) line.append(node('span', verdict.note));
        article.append(line);
      }
      findingsHost.append(article);
    });
    host.append(findingsHost.childElementCount ? findingsHost : node('p', '本次沒有可引用的結論。', 'muted'));

    if (report.supersedes?.length || report.supersedesUnchecked) {
      const section = node('section', undefined, 'compare changes');
      section.append(node('h3', '結論的變化'));
      section.append(node('p', '上次調查的結論，在這次補充材料之後的變化。沒被提到的舊結論只算「未重新核對」，不代表仍然成立。', 'muted'));
      for (const item of report.supersedes ?? []) {
        const card = node('article', undefined, 'change');
        card.append(node('span', changeLabels[item.verdict] ?? item.verdict, `badge ${changeTone[item.verdict] ?? ''}`));
        card.append(node('p', `上次：${item.previousConclusion}`, 'side-label'));
        const previousIds = new Set((item.previous ?? []).map(citation => citation.sourceId));
        for (const citation of item.previous ?? []) {
          card.append(citationButton(citation));
          if (citation.quote) card.append(node('blockquote', citation.quote));
        }
        if (item.explanation) card.append(node('div', item.explanation, 'finding-text'));
        for (const citation of item.current ?? []) {
          // The same passage is often quoted on both sides; showing it twice just adds noise.
          if (previousIds.has(citation.sourceId) && citation.status !== 'missing') continue;
          card.append(citationButton(citation));
          if (citation.quote) card.append(node('blockquote', citation.quote));
        }
        section.append(card);
      }
      if (report.supersedesUnchecked) {
        section.append(node('p', `另有 ${report.supersedesUnchecked} 條上次的結論，這次沒有重新核對。`, 'muted'));
      }
      host.append(section);
    }

    if (report.comparisons?.length || report.droppedComparisons) {
      const section = node('section', undefined, 'compare');
      section.append(node('h3', '宣傳與條款'));
      section.append(node('p', '左側是宣傳材料的原話，右側是合同原文；只對照雙方能逐字引用的內容。', 'muted'));
      for (const item of report.comparisons ?? []) {
        const card = node('article', undefined, 'comparison');
        card.append(node('span', comparisonLabels[item.relation] ?? item.relation, `badge ${comparisonTone[item.relation] ?? ''}`));
        const side = (label, citations) => {
          const block = node('div', undefined, 'side');
          block.append(node('p', label, 'side-label'));
          for (const citation of citations ?? []) {
            block.append(citationButton(citation));
            if (citation.quote) block.append(node('blockquote', citation.quote));
          }
          return block;
        };
        card.append(side('宣傳材料說的', item.marketing));
        if (item.contract?.length) card.append(side('合同原文寫的', item.contract));
        else card.append(node('p', '合同材料中暫未找到對應條件。', 'muted'));
        if (item.explanation) card.append(node('div', item.explanation, 'finding-text'));
        section.append(card);
      }
      if (report.droppedComparisons) {
        section.append(node('p', `有 ${report.droppedComparisons} 條對照因原文無法核對而未顯示。`, 'muted'));
      }
      host.append(section);
    }

    if (report.scenarios?.length || report.droppedScenarios) {
      const section = node('section', undefined, 'compare scenarios');
      section.append(node('h3', '情境實驗'));
      section.append(node('p', '把你假設的條件放進條款原文的門檻比較；只算字面差距，不推算賠款。', 'muted'));
      for (const item of report.scenarios ?? []) {
        const card = node('article', undefined, 'scenario');
        card.append(node('span', scenarioLabels[item.status] ?? item.status, `badge ${scenarioTone[item.status] ?? ''}`));
        card.append(node('div', item.question, 'finding-text'));
        const facts = node('p', `假設：${item.assumption}`, 'muted');
        card.append(facts);
        card.append(node('p', `與門檻比較：${item.actualValue} ${scenarioUnitLabels[item.actualUnit] ?? item.actualUnit}`, 'muted'));
        for (const citation of item.citations ?? []) {
          card.append(citationButton(citation));
          if (citation.quote) card.append(node('blockquote', citation.quote));
        }
        if (item.detail) card.append(node('div', item.detail, 'finding-text'));
        if (item.unknowns?.length) {
          const list = node('ul', undefined, 'unknowns');
          list.append(node('li', '仍需確認', 'side-label'));
          for (const unknown of item.unknowns) list.append(node('li', unknown));
          card.append(list);
        }
        section.append(card);
      }
      if (report.droppedScenarios) {
        section.append(node('p', `有 ${report.droppedScenarios} 條情境因原文無法核對而未顯示。`, 'muted'));
      }
      host.append(section);
    }

    if (report.brokerClaims?.length || report.droppedBrokerClaims) {
      const section = node('section', undefined, 'compare broker');
      section.append(node('h3', '經紀回覆核驗'));
      section.append(node('p', '左側是經紀的原話，右側是條款原文。這裡只說明兩者是否一致，不判斷銷售是否合規，也不核實說話人身份。', 'muted'));
      for (const item of report.brokerClaims ?? []) {
        const card = node('article', undefined, 'comparison');
        card.append(node('span', brokerLabels[item.verdict] ?? item.verdict, `badge ${brokerTone[item.verdict] ?? ''}`));
        const side = (label, citations) => {
          const block = node('div', undefined, 'side');
          block.append(node('p', label, 'side-label'));
          for (const citation of citations ?? []) {
            block.append(citationButton(citation));
            if (citation.quote) block.append(node('blockquote', citation.quote));
          }
          return block;
        };
        card.append(side('經紀回覆原話', item.broker));
        if (item.contract?.length) card.append(side('合同原文寫的', item.contract));
        else card.append(node('p', '合同材料中暫未找到對應條款。', 'muted'));
        if (item.explanation) card.append(node('div', item.explanation, 'finding-text'));
        section.append(card);
      }
      if (report.droppedBrokerClaims) {
        section.append(node('p', `有 ${report.droppedBrokerClaims} 條核驗因原文無法逐字核對而未顯示。`, 'muted'));
      }
      host.append(section);
    }

    if (report.requests?.length) {
      const section = node('section', undefined, 'asks');
      section.append(node('h3', '還需要你補充'));
      const list = node('ul');
      for (const request of report.requests) list.append(node('li', request.message));
      section.append(list);
      host.append(section);
    }
    if (report.openQuestions?.length) {
      const section = node('section', undefined, 'asks');
      section.append(node('h3', '可以向對方問清楚'));
      const list = node('ul');
      for (const question of report.openQuestions) list.append(node('li', question));
      section.append(list);
      host.append(section);
    }

    const verified = review && ['checked','issues_found'].includes(review.status);
    host.append(node('p', verified
      ? '以上為初步分析。語意複核只判斷引用是否支持結論，不代表條款本身合法或一定賠付。'
      : '以上為初步分析，尚未完成獨立語意複核，不代表條款本身合法或一定賠付。', 'disclaimer'));

    if (state.reviewId) {
      const link = document.createElement('a');
      link.className = 'export-link';
      link.href = `/api/reviews/${encodeURIComponent(state.reviewId)}/questions/export?format=md`;
      link.setAttribute('download', 'policy-questions.md');
      link.textContent = '匯出提問清單（Markdown）↗';
      host.append(link);
    }
  }

  function render() {
    const review = state.review;
    const host = $('report');
    if (!review) {
      $('report').hidden = true;
      $('report').replaceChildren();
      $('start').disabled = true;
      $('resume').hidden = true;
      status('尚未上傳材料。加入 PDF 後即可開始調查。');
      return;
    }
    const ready = review.documents.filter(doc => ['ready','partial'].includes(doc.status));
    const report = review.currentReport;
    const pending = review.documents.some(doc => ['queued','parsing'].includes(doc.status));
    const hasNewInput = report && review.revision > report.inputRevision;

    $('resume').hidden = !hasNewInput;
    $('scenario-actions').hidden = !report;
    if (report) {
      renderReport(report);
      status(pending ? '新材料仍在解析，完成後可續查。'
        : hasNewInput ? '有新加入的材料，可接續上一次結論再查一次，不用重複調查。'
        : review.documents.length ? '已完成一次調查。可重新開始，或補充材料後續查。'
        : '尚未上傳材料。');
    } else {
      host.hidden = true;
      host.replaceChildren();
      status(pending ? '正在提取原文，完成後即可開始調查。'
        : ready.length ? '材料已就緒，可以開始調查。'
        : '材料尚不可讀，請先確認 PDF 是否有文字層。');
    }
    lock(state.busy);
  }

  async function load() {
    let reviewId;
    try { reviewId = localStorage.getItem(reviewKey); } catch { reviewId = null; }
    if (!reviewId) { state.reviewId = null; state.review = null; render(); return; }
    state.reviewId = reviewId;
    try {
      state.review = await api(`/reviews/${reviewId}`);
    } catch (error) {
      if (error.status === 404) { state.review = null; render(); return; }
      throw error;
    }
    render();
    // A run started before a reload keeps running on the server; follow it again.
    const tracked = lastRunId();
    if (tracked && !state.busy) {
      const run = await api(`/reviews/${reviewId}/runs/${tracked}`).catch(() => null);
      if (run && ['queued','running'].includes(run.status)) { state.runId = tracked; void poll(); }
    }
  }

  async function poll() {
    const reviewId = state.reviewId;
    const deadline = Date.now() + 240000;
    let run;
    // The server streams the run, so the progress line can be driven by real events instead of a
    // 1.5s poll. If the stream cannot be kept open the old polling loop still finishes the job.
    const live = typeof EventSource === 'function' ? await watch() : null;
    if (live?.terminal) run = await api(`/reviews/${reviewId}/runs/${state.runId}`).catch(() => null);
    while ((!run || ['queued','running'].includes(run.status)) && Date.now() < deadline) {
      run = await api(`/reviews/${reviewId}/runs/${state.runId}`).catch(error => {
        if (error.status === 404) throw new Error('這次調查已不存在，請重新開始。');
        return null;
      });
      if (run) {
        status(`調查進行中：${runLabels[run.status] ?? run.status}…`);
        if (!['queued','running'].includes(run.status)) break;
      }
      await sleep(1500);
    }
    state.busy = false;
    await load();
    if (run?.status === 'failed' || run?.status === 'interrupted') status(`調查沒有完成：${stopReasons[run.stopReason] ?? '請看後端日誌。'}`);
    else if (run) status(`${runLabels[run.status] ?? run.status}。`);
  }

  // Follows one run over SSE. Resolves with the terminal status once the server announces it, or
  // with {terminal: null} when the stream never opened / went quiet, so the caller can fall back to
  // polling. Nothing here decides whether the run succeeded: the server sends the final status.
  function watch() {
    return new Promise(resolve => {
      let source;
      try { source = new EventSource(`/api/reviews/${state.reviewId}/runs/${state.runId}/events`); }
      catch { resolve({terminal: null}); return; }
      let settled = false;
      let tools = 0;
      let idle;
      const finish = terminal => {
        if (settled) return;
        settled = true;
        clearTimeout(idle);
        source.close();
        resolve({terminal});
      };
      // A quiet stream must not leave the button disabled forever; 20s of silence hands over to
      // the polling loop.
      const keepAlive = () => { clearTimeout(idle); idle = setTimeout(() => finish(null), 20000); };
      keepAlive();
      source.addEventListener('run.status', event => {
        keepAlive();
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        const next = payload?.data?.status;
        if (!next) return;
        if (['awaiting_input','partial','failed','interrupted','cancelled'].includes(next)) { finish(next); return; }
        status(`調查進行中：${runLabels[next] ?? next}…`);
      });
      source.addEventListener('tool.started', () => {
        keepAlive();
        tools += 1;
        status(`調查進行中：已讀取第 ${tools} 段材料…`);
      });
      source.addEventListener('report.published', () => {
        keepAlive();
        status('結論已發布，正在整理…');
      });
      source.onerror = () => { if (source.readyState === EventSource.CLOSED) finish(null); };
    });
  }

  async function start(resume) {
    if (state.busy) return;
    const review = state.review;
    if (!review) return;
    const goal = $('goal').value.trim();
    if (!goal) { status(errors.EMPTY_GOAL); $('goal').focus(); return; }
    const body = {expectedRevision: review.revision, kind: 'investigate', goal};
    if (resume) {
      const previous = review.currentReport?.runId ?? lastRunId();
      if (!previous) { status('找不到上一次調查，請重新開始。'); return; }
      body.resumeFromRunId = previous;
    }
    state.busy = true;
    lock(true);
    status(resume ? '正在接續上一次調查……' : '正在建立調查……');
    try {
      const run = await api(`/reviews/${state.reviewId}/runs`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      state.runId = run.id;
      rememberRun(run.id);
      $('resume').hidden = true;
      await poll();
    } catch (error) {
      state.busy = false;
      lock(false);
      status(error.message);
      if (error.status === 409) await load().catch(() => {});
    }
  }

  // A scenario run reuses the current material snapshot and only asks the deterministic tool to
  // compare one assumption with one quoted threshold. It never writes user assumptions into the
  // review's context: the assumption belongs to this run only.
  async function startScenario() {
    if (state.busy) return;
    const review = state.review;
    if (!review?.currentReport) { status('請先完成一次調查，再有情境可測試。'); return; }
    const assumption = $('scenario').value.trim();
    if (!assumption) { status('請先寫下想假設的情境，例如「如果延誤 8 小時」。'); $('scenario').focus(); return; }
    state.busy = true;
    lock(true);
    status('正在比對情境與條款門檻……');
    try {
      const run = await api(`/reviews/${state.reviewId}/runs`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({expectedRevision: review.revision, kind: 'scenario', goal: `情景測試：${assumption}`})
      });
      state.runId = run.id;
      rememberRun(run.id);
      await poll();
      $('scenario').value = '';
    } catch (error) {
      state.busy = false;
      lock(false);
      status(error.message);
      if (error.status === 409) await load().catch(() => {});
    }
  }

  $('start').addEventListener('click', () => void start(false));
  $('resume').addEventListener('click', () => void start(true));
  $('scenario-run').addEventListener('click', () => void startScenario());
  $('scenario').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void startScenario(); } });
  document.addEventListener('policy-review-changed', () => { void load().catch(error => status(error.message)); });
  void load().catch(error => status(error.message));
})();
