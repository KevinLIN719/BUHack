(() => {
  const PL = window.PL;
  const savedKey = 'policy-lens-v3-document';
  const activeKey = 'policy-lens-v3-document-active';

  function saved() {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || '[]');
      const records = Array.isArray(value) ? value : [value];
      return records.filter((record) => record &&
        /^[0-9a-f-]{36}$/i.test(record.reviewId) &&
        (/^[0-9a-f-]{36}$/i.test(record.documentId) || (record.pending && record.documentId === null)));
    } catch {
      return [];
    }
  }

  function remember(value) {
    try {
      const records = saved();
      const record = {
        reviewId: value.reviewId,
        documentId: value.documentId,
        name: value.name,
        pageIndex: value.pageIndex || 1,
        ...(value.pending ? { pending: true } : {}),
      };
      const index = records.findIndex((item) => item.reviewId === record.reviewId);
      if (index < 0) records.unshift(record);
      else records[index] = record;
      localStorage.setItem(savedKey, JSON.stringify(records));
    } catch {}
  }

  function forget(value) {
    try {
      const records = saved().filter((item) => item.reviewId !== value.reviewId);
      if (records.length) localStorage.setItem(savedKey, JSON.stringify(records));
      else localStorage.removeItem(savedKey);
    } catch {}
  }

  function setActive(value) {
    try {
      if (value?.reviewId) sessionStorage.setItem(activeKey, JSON.stringify({ reviewId: value.reviewId }));
      else sessionStorage.removeItem(activeKey);
    } catch {}
  }

  function active() {
    try {
      const value = sessionStorage.getItem(activeKey);
      if (value === '1') return saved()[0] || null;
      const current = JSON.parse(value || 'null');
      return current && saved().find((item) => item.reviewId === current.reviewId);
    } catch { return null; }
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error(PL.t('無法連接文件服務，請啟動 Policy Lens 後重試。', 'Cannot connect to the document service. Start Policy Lens and try again.'));
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || PL.t('文件服務未能處理這次請求，請重試。', 'The document service could not process this request. Please try again.');
      const error = new Error(message);
      error.status = response.status;
      error.code = data?.error?.code;
      throw error;
    }
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw new Error(PL.t('文件服務回應不完整，請重試。', 'The document service returned an incomplete response. Please try again.')); }
  }

  async function upload(file, signal) {
    const review = await request('/reviews', { method: 'POST', signal });
    const pending = { reviewId: review.id, documentId: null, name: file.name, pageIndex: 1, pending: true };
    remember(pending);
    setActive(pending);
    try {
      const form = new FormData();
      form.set('role', 'contract');
      form.set('file', file);
      const document = await request(`/reviews/${review.id}/documents`, { method: 'POST', body: form, signal });
      const record = { reviewId: review.id, documentId: document.id, name: document.name, pageIndex: 1 };
      remember(record);
      return record;
    } catch (error) {
      try {
        await request(`/reviews/${review.id}`, { method: 'DELETE' });
        forget(pending);
      } catch {}
      throw error;
    }
  }

  function wait(signal, milliseconds) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, milliseconds);
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  PL.documents = {
    saved, remember, forget, setActive, active, upload, wait,
    review: (record, signal) => request(`/reviews/${record.reviewId}`, { signal }),
    get: (record, signal) => request(`/reviews/${record.reviewId}/documents/${record.documentId}`, { signal }),
    page: (record, index, signal) => request(`/reviews/${record.reviewId}/documents/${record.documentId}/pages/${index}`, { signal }),
    intake: (record, lang, signal, userNote = '') => {
      const apiLang = lang === 'en' ? 'en' : 'zh-Hant';
      return request(`/reviews/${record.reviewId}/intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': apiLang,
        },
        body: JSON.stringify({ lang: apiLang, ...(userNote ? { userNote } : {}) }),
        signal,
      });
    },
    remove: (record, signal) => request(`/reviews/${record.reviewId}`, { method: 'DELETE', signal }),
    original: (record, index) => `/api/reviews/${record.reviewId}/documents/${record.documentId}/content#page=${index}`,
  };
})();
