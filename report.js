(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reviewKey = 'policy-lens-live-review';
  const runKey = 'policy-lens-live-run';
  const runLabels = {queued:'排隊中',running:'調查中',awaiting_input:'等你補充材料',partial:'已完成初步分析',failed:'調查失敗',cancelled:'已取消'};
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
    while (Date.now() < deadline) {
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
    if (run?.status === 'failed') status(`調查失敗：${run.error?.message ?? '請看後端日誌。'}`);
    else if (run) status(`${runLabels[run.status] ?? run.status}。`);
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

  $('start').addEventListener('click', () => void start(false));
  $('resume').addEventListener('click', () => void start(true));
  document.addEventListener('policy-review-changed', () => { void load().catch(error => status(error.message)); });
  void load().catch(error => status(error.message));
})();
