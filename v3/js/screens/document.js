(() => {
  const PL = window.PL;
  const { h } = PL;

  function render() {
    let record = PL.getState().document;
    let details = null;
    let pageIndex = record.pageIndex || 1;
    let pageRequest = 0;
    let live = true;
    let ownsBusy = false;
    const controller = new AbortController();
    const title = h('h2', { class: 'parse-title real-reader-title' }, record.name || PL.t('我的保單', 'My policy'));
    const status = h('p', { class: 'parse-status', role: 'status', 'aria-live': 'polite' });
    const paperTitle = h('p', { class: 'doc-title' }, record.name || PL.t('我的保單', 'My policy'));
    const paperContent = h('div', { class: 'real-paper-content' });
    const pageInfo = h('p', { class: 'real-page-info' });
    const pageSelect = h('select', { 'aria-label': PL.t('選擇頁碼', 'Choose a page'), onchange: (event) => { void showPage(Number(event.target.value)); } });
    const previous = h('button', { type: 'button', class: 'mini-btn', onclick: () => { void showPage(pageIndex - 1); } }, PL.t('上一頁', 'Previous'));
    const next = h('button', { type: 'button', class: 'mini-btn', onclick: () => { void showPage(pageIndex + 1); } }, PL.t('下一頁', 'Next'));
    const controls = h('div', { class: 'real-page-controls', hidden: true }, previous, pageSelect, next);
    const analyzeBtn = h('button', { type: 'button', class: 'btn primary real-analyze', hidden: true, onclick: () => { void beginAnalysis(); } }, PL.t('開始解讀這份保單', 'Analyze this policy'), h('span', { class: 'arrow' }, '→'));
    const original = h('a', { class: 'btn real-original', target: '_blank', rel: 'noopener noreferrer', hidden: true }, PL.t('打開原 PDF', 'Open original PDF'), h('span', { class: 'arrow' }, '↗'));
    const remove = h('button', { type: 'button', class: 'btn quiet real-remove', hidden: true, onclick: () => { void removeDocument(); } }, PL.t('刪除這份保單', 'Delete this policy'));
    const retry = h('button', { type: 'button', class: 'btn real-retry', hidden: true, onclick: () => { retry.hidden = true; void start(); } }, PL.t('重試查看', 'Try again'));
    const back = h('button', { type: 'button', class: 'btn quiet', onclick: () => PL.go('home') }, PL.t('返回首頁', 'Back to home'));
    const extractionNote = h('p', { class: 'real-note' }, PL.t('這裏顯示從 PDF 提取的文字。頁眉、頁腳和表格可能不完整，如有疑問可隨時打開原 PDF 核對。', 'This shows text extracted from your PDF. Headers, footers and tables may be incomplete; open the original PDF whenever needed.'));

    const el = h('section', { class: 'screen parse real-reader' },
      h('div', { class: 'paper', 'data-a': '' },
        h('div', { class: 'paper-scroll real-paper' }, paperTitle, pageInfo, paperContent)),
      h('aside', { class: 'parse-panel real-panel', 'data-a': '' },
        h('p', { class: 'eyebrow' }, PL.t('保單原文', 'Policy wording')),
        title, status, analyzeBtn, controls, original, retry,
        extractionNote,
        remove, back));

    function say(message) {
      status.textContent = message;
    }

    function setRecord(value) {
      record = value;
      PL.setState({ document: value });
      PL.documents.setActive(value);
      title.textContent = value.name;
      paperTitle.textContent = value.name;
    }

    function errorText(code) {
      const errors = {
        PAGE_LIMIT: PL.t('這份 PDF 超過 120 頁，請選擇較短的文件。', 'This PDF has more than 120 pages. Please choose a shorter document.'),
        PASSWORD_REQUIRED: PL.t('這份 PDF 有密碼，請選擇沒有密碼的版本。', 'This PDF is password-protected. Please choose an unlocked copy.'),
        INVALID_PDF: PL.t('這份 PDF 損壞或無法讀取，請選擇另一份。', 'This PDF is damaged or cannot be read. Please choose another.'),
        PARSE_TIMEOUT: PL.t('提取原文逾時，請重新上傳。', 'Extracting the text timed out. Please upload it again.'),
      };
      return errors[code] || PL.t('未能提取原文，請打開原 PDF 或重新上傳。', 'Could not extract the text. Open the original PDF or upload it again.');
    }

    function showError(error) {
      if (!live || error.name === 'AbortError') return;
      if (error.status === 404 && ['REVIEW_NOT_FOUND', 'DOCUMENT_NOT_FOUND'].includes(error.code)) {
        say(PL.t('找不到這份保單。它可能已刪除，或瀏覽器的登入狀態已過期。', 'This policy could not be found. It may have been deleted, or your browser session may have expired.'));
      } else say(error.message);
      pageInfo.textContent = '';
      paperContent.replaceChildren(h('p', { class: 'real-paper-message' }, PL.t('暫時沒有可顯示的原文。', 'There is no text to show yet.')));
    }

    async function showPage(index) {
      if (!details || index < 1 || index > details.pages.length) return;
      const request = ++pageRequest;
      pageSelect.disabled = true;
      previous.disabled = true;
      next.disabled = true;
      pageInfo.textContent = PL.t('正在讀取這一頁……', 'Loading this page…');
      try {
        const page = await PL.documents.page(record, index, controller.signal);
        if (!live || request !== pageRequest) return;
        pageIndex = index;
        pageSelect.value = String(index);
        pageInfo.textContent = PL.t(`PDF 第 ${index} 頁`, `PDF page ${index}`) + (page.printedPageLabel ? ` · ${page.printedPageLabel}` : '');
        paperContent.replaceChildren(page.text
          ? h('p', { class: 'doc-line real-page-text' }, page.text)
          : h('p', { class: 'real-paper-message' }, page.status === 'failed'
            ? PL.t('這一頁的文字提取失敗。請打開原 PDF 查看。', 'Text extraction failed for this page. Open the original PDF to view it.')
            : PL.t('這一頁沒有可提取的文字。請打開原 PDF 查看。', 'No text could be extracted from this page. Open the original PDF to view it.')));
        original.href = PL.documents.original(record, index);
        const updated = { ...record, pageIndex: index };
        PL.documents.remember(updated);
        setRecord(updated);
      } catch (error) {
        if (live && request === pageRequest) showError(error);
      } finally {
        if (live && request === pageRequest) {
          pageSelect.disabled = false;
          previous.disabled = pageIndex <= 1;
          next.disabled = pageIndex >= details.pages.length;
        }
      }
    }

    function warmIntake(currentRecord) {
      if (!currentRecord?.reviewId) return;
      const st = PL.getState();
      if (st.intake?.reviewId === currentRecord.reviewId && st.intake?.lang === st.lang) return;
      PL.setState({ intakeLoading: true });
      PL.documents.intake(currentRecord, st.lang)
        .then((intake) => {
          const cur = PL.getState();
          const nextIntake = { ...intake, reviewId: currentRecord.reviewId, lang: st.lang };
          const updates = { intake: nextIntake, intakeLoading: false };
          if (intake?.themeKey && PL.POLICIES[intake.themeKey] && cur.document?.reviewId === currentRecord.reviewId) {
            updates.policyId = intake.themeKey;
          }
          PL.setState(updates);
        })
        .catch(() => {
          PL.setState({ intakeLoading: false });
        });
    }

    async function beginAnalysis() {
      if (!record?.reviewId) return;
      PL.setState({ analysis: null, context: {}, selected: [], prevAnalysis: null });
      void PL.materials.refresh().catch(() => {});
      await PL.go('context');
    }

    async function removeDocument() {
      if (!record.reviewId || !window.confirm(PL.t('刪除這份保單和已提取的原文？', 'Delete this policy and its extracted text?'))) return;
      remove.disabled = true;
      try {
        await PL.documents.remove(record, controller.signal);
        if (!live) return;
        PL.documents.forget(record);
        PL.setState({ document: null, intake: null, intakeLoading: false, analysis: null, context: {}, selected: [] });
        await PL.go('home');
      } catch (error) {
        showError(error);
        remove.disabled = false;
      }
    }

    async function start() {
      try {
        if (record.file) {
          ownsBusy = true;
          PL.setState({ busy: true });
          back.disabled = true;
          say(PL.t('正在上傳保單……', 'Uploading your policy…'));
          paperContent.replaceChildren(h('p', { class: 'real-paper-message' }, PL.t('收到文件後，這裏會顯示原文。', 'The extracted text will appear here.')));
          const uploaded = await PL.documents.upload(record.file, controller.signal);
          if (!live) return;
          setRecord(uploaded);
          ownsBusy = false;
          PL.setState({ busy: false });
          back.disabled = false;
        } else if (!record.documentId) {
          remove.hidden = false;
          say(PL.t('正在檢查上次的上傳……', 'Checking your previous upload…'));
          const review = await PL.documents.review(record, controller.signal);
          if (!live) return;
          const document = review.documents.find((item) => item.role === 'contract');
          if (!document) {
            say(PL.t('上次上傳未完成。可以重試查看，或刪除記錄後重新上傳。', 'The previous upload did not finish. Try again, or delete this record and upload the file again.'));
            paperContent.replaceChildren(h('p', { class: 'real-paper-message' }, PL.t('暫時沒有可顯示的原文。', 'There is no text to show yet.')));
            retry.hidden = false;
            return;
          }
          const restored = { reviewId: record.reviewId, documentId: document.id, name: document.name, pageIndex: record.pageIndex || 1 };
          PL.documents.remember(restored);
          setRecord(restored);
        }
        remove.hidden = false;
        original.hidden = false;
        original.href = PL.documents.original(record, pageIndex);
        do {
          say(PL.t('正在逐頁提取原文……', 'Extracting text page by page…'));
          details = await PL.documents.get(record, controller.signal);
          if (!live) return;
          if (['queued', 'parsing'].includes(details.status)) await PL.documents.wait(controller.signal, 500);
        } while (['queued', 'parsing'].includes(details.status));
        setRecord({ ...record, name: details.name });
        if (details.method === 'ocr' || details.sourceType === 'scan') {
          extractionNote.textContent = PL.t('文字由照片 OCR 識別。請打開原圖 PDF 核對金額、日期及「不保」等關鍵字；看不清的內容不會作為條款依據。', 'Text was recognized from photos using OCR. Check amounts, dates and exclusions against the original photo PDF. Unreadable text is not used as clause evidence.');
        }
        if (details.status === 'failed') {
          say(errorText(details.errorCode));
          paperContent.replaceChildren(h('p', { class: 'real-paper-message' }, PL.t('暫時沒有可顯示的原文。', 'There is no text to show yet.')));
          return;
        }
        if (details.status === 'partial') say(PL.t('部分頁面已提取；沒有文字的頁面請查看原 PDF。', 'Some pages were extracted. Open the original PDF for pages without text.'));
        else if (details.status === 'needs_ocr') say(PL.t('這份文件沒有可提取的文字，可能是掃描件或空白頁。', 'No text could be extracted. The document may be scanned or blank.'));
        else say(PL.t('原文已提取，可以逐頁查看，或直接開始解讀。', 'Text extracted. Read each page or start analyzing.'));
        if (['ready', 'partial'].includes(details.status)) {
          analyzeBtn.hidden = false;
          warmIntake(record);
        }
        pageSelect.replaceChildren(...details.pages.map((page) => h('option', { value: page.pageIndex }, PL.t(`第 ${page.pageIndex} 頁`, `Page ${page.pageIndex}`))));
        controls.hidden = !details.pages.length;
        if (details.pages.length) {
          pageIndex = Math.min(pageIndex, details.pages.length);
          await showPage(pageIndex);
        }
      } catch (error) {
        showError(error);
      } finally {
        if (live && ownsBusy) {
          ownsBusy = false;
          PL.setState({ busy: false });
          back.disabled = false;
        }
      }
    }

    return {
      el,
      enter: () => { void start(); },
      destroy: () => {
        live = false;
        controller.abort();
        if (ownsBusy) PL.setState({ busy: false });
      },
    };
  }

  PL.screens.document = { render };
})();
