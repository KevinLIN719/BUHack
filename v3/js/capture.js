/* Phone capture: finite pairing session, HTTP signalling, WebRTC video only. */
(() => {
  'use strict';
  const PL = window.PL;
  const h = PL.h;
  const t = (zh, en) => PL.t(zh, en);
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  const MAX_PAGES = 20;
  let current = null;

  async function request(path, { token, signal, raw = false, ...options } = {}) {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && typeof options.body === 'string') headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers, signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error(t('連線中斷，請檢查網絡後重試。', 'Connection interrupted. Check your network and retry.'));
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error = new Error(data?.error?.message || data?.message || t('這次操作未完成，請重試。', 'This action failed. Please retry.'));
      error.status = response.status;
      error.code = data?.error?.code;
      throw error;
    }
    if (response.status === 204) return null;
    return raw ? response.blob() : response.json();
  }

  function abortableWait(ms, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  }

  function channel(session, token, { onState, onMessage, onError } = {}) {
    const controller = new AbortController();
    let cursor = 0, stopped = false;
    const base = `/api/capture/sessions/${encodeURIComponent(session.id)}`;
    const send = (type, data = {}) => request(`${base}/signals`, {
      token, signal: controller.signal, method: 'POST', body: JSON.stringify({ type, data }),
    });
    async function run() {
      while (!stopped) {
        try {
          const state = await request(base, { token, signal: controller.signal });
          if (stopped) return;
          if (state.status === 'closed' || state.status === 'expired' || Date.parse(state.expiresAt) <= Date.now()) {
            const error = new Error(t('配對已結束，請在電腦重新建立連線。', 'Pairing ended. Start a new session on the computer.'));
            error.status = 410;
            throw error;
          }
          await onState?.(state);
          const batch = await request(`${base}/signals?after=${encodeURIComponent(cursor)}`, { token, signal: controller.signal });
          for (const message of batch.messages || []) {
            if (stopped) return;
            try { await onMessage?.(message); } catch (error) { onError?.(error); }
          }
          cursor = batch.cursor ?? cursor;
        } catch (error) {
          if (stopped || error.name === 'AbortError') return;
          onError?.(error);
          if ([401, 403, 404, 410].includes(error.status)) { stop(); return; }
        }
        try { await abortableWait(1000, controller.signal); } catch { return; }
      }
    }
    function stop() { stopped = true; controller.abort(); }
    return { base, send, start: run, stop, signal: controller.signal };
  }

  function peer({ role, iceServers = [], send, stream, onStream, onStatus }) {
    let pc = null, generation = null, dead = false, watchdog = 0;
    const queued = new Map();
    function closePeer() {
      clearTimeout(watchdog); watchdog = 0;
      if (pc) {
        pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
        pc.close(); pc = null;
      }
      generation = null;
      onStream?.(null);
    }
    function create(id) {
      closePeer(); generation = id;
      const connection = new RTCPeerConnection({ iceServers });
      pc = connection;
      connection.onicecandidate = (event) => {
        if (event.candidate && pc === connection && !dead) {
          void send('ice', { candidate: event.candidate.toJSON(), connectionId: id }).catch((error) => onStatus?.('error', error));
        }
      };
      connection.ontrack = (event) => {
        if (pc === connection) onStream?.(event.streams[0] || new MediaStream([event.track]));
      };
      connection.onconnectionstatechange = () => {
        if (pc !== connection) return;
        if (connection.connectionState === 'connected') { clearTimeout(watchdog); watchdog = 0; }
        onStatus?.(connection.connectionState);
      };
      watchdog = setTimeout(() => {
        if (!dead && pc === connection && connection.connectionState !== 'connected') onStatus?.('failed');
      }, 20000);
      const local = stream?.();
      if (role === 'phone' && local) local.getVideoTracks().forEach((track) => connection.addTrack(track, local));
      if (role === 'host') connection.addTransceiver('video', { direction: 'recvonly' });
      return connection;
    }
    async function flush(id, connection) {
      const candidates = queued.get(id) || [];
      queued.delete(id);
      for (const candidate of candidates) {
        if (dead || pc !== connection) return;
        await connection.addIceCandidate(candidate);
      }
    }
    async function offer() {
      if (dead) return;
      if (!window.RTCPeerConnection) throw new Error(t('此瀏覽器未支援實時預覽，仍可用手機上傳照片。', 'Live preview is unavailable in this browser. Phone photo upload still works.'));
      queued.clear();
      const id = crypto.randomUUID();
      const connection = create(id);
      onStatus?.('connecting');
      await connection.setLocalDescription(await connection.createOffer());
      if (pc !== connection || dead) return;
      await send('offer', { ...connection.localDescription.toJSON(), connectionId: id });
    }
    async function receive(message) {
      if (dead) return;
      const data = message.data || {};
      if (message.type === 'disconnect') { closePeer(); onStatus?.('disconnected'); return; }
      if (message.type === 'offer' && role === 'phone') {
        if (!stream?.()?.getVideoTracks().some((track) => track.readyState === 'live')) return;
        const id = data.connectionId;
        if (!id || !window.RTCPeerConnection) return;
        const connection = create(id);
        await connection.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await flush(id, connection);
        await connection.setLocalDescription(await connection.createAnswer());
        if (pc !== connection || dead) return;
        await send('answer', { ...connection.localDescription.toJSON(), connectionId: id });
      } else if (message.type === 'answer' && role === 'host' && pc && data.connectionId === generation) {
        const connection = pc;
        await connection.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await flush(generation, connection);
      } else if (message.type === 'ice' && data.candidate && data.connectionId) {
        if (pc && data.connectionId === generation && pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else {
          if (queued.size > 8) queued.clear();
          const candidates = queued.get(data.connectionId) || [];
          if (candidates.length < 100) candidates.push(data.candidate);
          queued.set(data.connectionId, candidates);
        }
      }
    }
    return { offer, receive, reset: closePeer, close() { dead = true; closePeer(); queued.clear(); } };
  }

  async function encodeImage(source, width, height) {
    if (!(width > 0 && height > 0)) throw new Error(t('未能讀取這張照片，請使用 JPEG 或 PNG。', 'Could not read this photo. Choose a JPEG or PNG.'));
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 3200 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error(t('瀏覽器無法準備照片，請重試。', 'The browser could not prepare this photo. Please retry.'));
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let quality = 0.92, blob;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error(t('照片處理失敗，請重拍。', 'Photo processing failed. Please take it again.'));
      if (blob.size <= MAX_IMAGE_BYTES) break;
      if (quality > 0.58) quality -= 0.12;
      else {
        const smaller = document.createElement('canvas');
        smaller.width = Math.max(1, Math.round(canvas.width * 0.8));
        smaller.height = Math.max(1, Math.round(canvas.height * 0.8));
        smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
        canvas.width = smaller.width; canvas.height = smaller.height;
        context.drawImage(smaller, 0, 0); quality = 0.8;
      }
    }
    if (blob.size > MAX_IMAGE_BYTES) throw new Error(t('照片仍然太大，請重拍或選擇較小的圖片。', 'This photo is too large. Retake it or choose a smaller image.'));
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    return { dataUrl, width: canvas.width, height: canvas.height };
  }

  async function encodeFile(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error(t('請選擇照片。', 'Please choose a photo.'));
    if (file.size > 40 * 1024 * 1024) throw new Error(t('這張照片超過 40 MB，請選擇較小的照片。', 'This photo exceeds 40 MB. Choose a smaller photo.'));
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode().catch(() => { throw new Error(t('未能讀取照片，請選擇 JPEG、PNG 或可顯示的圖片。', 'Could not read this photo. Choose a JPEG, PNG or supported image.')); });
      return await encodeImage(image, image.naturalWidth, image.naturalHeight);
    } finally { URL.revokeObjectURL(url); }
  }

  function open({ reviewId = null, role = 'contract', onImported = null } = {}) {
    if (current) return current.dialog.focus();
    const previous = document.activeElement;
    const controller = new AbortController();
    let dead = false, terminal = false, session = null, transport = null, rtc = null, connected = false, importing = false;
    let pages = [], createdReview = reviewId ? { id: reviewId } : null, pageKey = '', requestVersion = 0, shutterTimer = 0, sessionStatus = '';
    const urls = new Set(), imageUrls = new Map();
    const titleId = `capture-title-${crypto.randomUUID()}`;
    const say = (value, error = false) => { if (!dead) { status.textContent = value; status.classList.toggle('is-error', error); } };
    const status = h('p', { class: 'cap-status', role: 'status', 'aria-live': 'polite' }, t('正在建立配對……', 'Creating a pairing session…'));
    const video = h('video', { class: 'cap-video', autoplay: true, muted: true, playsinline: true, 'aria-label': t('手機攝像頭實時畫面', 'Live phone camera') });
    video.muted = true;
    const waiting = h('div', { class: 'cap-video-wait' }, h('span', { 'aria-hidden': 'true' }, '⌑'), h('p', {}, t('等待手機畫面', 'Waiting for the phone camera')));
    const qr = h('div', { class: 'cap-qr' });
    const link = h('input', { class: 'cap-link', type: 'text', readonly: true, 'aria-label': t('手機配對連結', 'Phone pairing link') });
    const copy = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: async () => {
      try { await navigator.clipboard.writeText(link.value); say(t('連結已複製。', 'Link copied.')); }
      catch { link.focus(); link.select(); say(t('請複製上方連結，在手機開啟。', 'Copy the link above and open it on your phone.')); }
    } }, t('複製連結', 'Copy link'));
    const capture = h('button', { type: 'button', class: 'cap-btn is-primary', disabled: true, onclick: async () => {
      if (!transport || !connected || importing) return;
      capture.disabled = true;
      try { await transport.send('capture', { requestId: crypto.randomUUID() }); say(t('請保持手機穩定，照片正從手機上傳。', 'Keep the phone steady. The photo is uploading from the phone.')); }
      catch (error) { say(error.message, true); }
      finally { if (!dead) { clearTimeout(shutterTimer); shutterTimer = setTimeout(syncButtons, 1200); } }
    } }, t('拍攝這一頁', 'Capture this page'));
    const reconnect = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: () => { void rtc?.offer().catch((error) => say(error.message, true)); } }, t('重新連接預覽', 'Reconnect preview'));
    const list = h('ol', { class: 'cap-pages', 'aria-label': t('已拍攝頁面', 'Captured pages') });
    const count = h('p', { class: 'cap-page-count' }, t('尚未拍攝', 'No pages yet'));
    const empty = h('p', { class: 'cap-empty' }, t('拍攝後，頁面會出現在這裏。', 'Captured pages will appear here.'));
    const start = h('button', { type: 'button', class: 'cap-btn is-primary', disabled: true, onclick: () => { void importPages(); } }, t('開始識別', 'Read these pages'));
    const closer = h('button', { type: 'button', class: 'cap-btn cap-close', 'aria-label': t('關閉手機掃描', 'Close phone scan'), onclick: () => close() }, '×');
    const dialog = h('dialog', { class: 'cap-dialog', 'aria-labelledby': titleId },
      h('div', { class: 'cap-heading' }, h('div', {}, h('p', { class: 'eyebrow' }, 'Policy Lens'), h('h2', { id: titleId }, t('拍照補充信息', 'Add information with photos'))), closer),
      status,
      h('div', { class: 'cap-layout' },
        h('section', { class: 'cap-camera-panel', 'aria-label': t('取景與配對', 'Camera and pairing') },
          h('div', { class: 'cap-viewfinder' }, video, waiting, h('span', { class: 'cap-frame', 'aria-hidden': 'true' })),
          h('div', { class: 'cap-camera-actions' }, capture, reconnect),
          h('div', { class: 'cap-pair' }, qr, h('div', { class: 'cap-pair-copy' }, h('p', {}, t('手機掃碼並允許攝像頭。', 'Scan the code and allow camera access.')), link, copy))),
        h('section', { class: 'cap-page-panel', 'aria-label': t('掃描頁面', 'Scanned pages') }, count, empty, list,
          h('p', { class: 'cap-note' }, t('識別使用手機拍下的照片。請讓文字清晰、避免反光。', 'Reading uses the photo captured on your phone. Keep text sharp and avoid glare.')),
          start)));

    function syncButtons() {
      const reading = importing || ['processing', 'imported'].includes(sessionStatus);
      capture.disabled = terminal || reading || !connected || pages.length >= MAX_PAGES;
      reconnect.disabled = terminal || reading || !rtc;
      start.disabled = terminal || reading || !pages.length;
      list.querySelectorAll('button').forEach((button) => { button.disabled = terminal || reading; });
    }
    async function paintPages(next) {
      pages = next || [];
      count.textContent = t(`已拍攝 ${pages.length} 頁`, `${pages.length} pages captured`);
      empty.hidden = pages.length > 0;
      syncButtons();
      const key = pages.map((page) => page.id).join(',');
      if (key === pageKey) return;
      pageKey = key;
      const version = ++requestVersion;
      for (const [id, url] of imageUrls) {
        if (!pages.some((page) => page.id === id)) { URL.revokeObjectURL(url); urls.delete(url); imageUrls.delete(id); }
      }
      list.replaceChildren(...pages.map((page, index) => {
        const image = h('img', { alt: t(`第 ${index + 1} 頁`, `Page ${index + 1}`), loading: 'lazy' });
        const known = imageUrls.get(page.id);
        if (known) image.src = known;
        else void request(`${transport.base}/pages/${encodeURIComponent(page.id)}`, { token: session.hostToken, signal: controller.signal, raw: true })
          .then((blob) => {
            if (dead || version !== requestVersion) return;
            const url = URL.createObjectURL(blob); imageUrls.set(page.id, url); urls.add(url); image.src = url;
          }).catch((error) => { if (error.name !== 'AbortError' && !dead) image.alt = t('預覽未能載入，照片仍已保存。', 'Preview unavailable; the photo is still saved.'); });
        const remove = h('button', { type: 'button', class: 'cap-btn cap-page-delete', 'aria-label': t(`刪除第 ${index + 1} 頁`, `Delete page ${index + 1}`), onclick: async () => {
          remove.disabled = true;
          try {
            await request(`${transport.base}/pages/${encodeURIComponent(page.id)}`, { token: session.hostToken, signal: controller.signal, method: 'DELETE' });
            if (!dead) await paintPages(pages.filter((item) => item.id !== page.id));
          } catch (error) { if (error.name !== 'AbortError') say(error.message, true); }
          finally { if (!dead) remove.disabled = importing; }
        } }, t('刪除', 'Delete'));
        return h('li', { class: 'cap-page' }, image, h('div', {}, h('span', {}, String(index + 1).padStart(2, '0')), remove));
      }));
      syncButtons();
    }
    async function importPages() {
      if (importing || !pages.length || !session) return;
      importing = true; syncButtons();
      start.textContent = t('正在識別……', 'Reading…');
      say(reviewId ? t('正在識別並加入這份保單的材料。', 'Reading and adding these pages to this policy.') : t('正在逐頁識別文字，完成後會打開保單。', 'Reading each page. Your policy will open when it is ready.'));
      dialog.setAttribute('aria-busy', 'true');
      try {
        if (!createdReview) {
          createdReview = await request('/api/reviews', { method: 'POST', body: '{}', signal: controller.signal });
          PL.documents.remember({ reviewId: createdReview.id, documentId: null, name: t('手機掃描保單', 'Phone-scanned policy'), pageIndex: 1, pending: true });
        }
        const doc = await request(`/api/reviews/${encodeURIComponent(createdReview.id)}/scans`, {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify({ sessionId: session.id, token: session.hostToken, role, name: reviewId ? t('拍照補充資料', 'Photographed material') : t('手機掃描保單', 'Phone-scanned policy') }),
        });
        if (dead) return;
        if (reviewId) {
          close();
          await (onImported ? onImported(doc) : PL.materials?.refresh());
          return;
        }
        const record = { reviewId: createdReview.id, documentId: doc.id, name: doc.name, pageIndex: 1 };
        PL.documents.remember(record);
        PL.setState({ document: record, intake: null, intakeLoading: false, analysis: null, context: {}, selected: [], materials: [], materialsRevision: 0, analysisRevision: null, prevAnalysis: null, claims: null });
        close();
        await PL.go('document');
      } catch (error) { if (error.name !== 'AbortError') say(error.message, true); }
      finally {
        if (!dead) { importing = false; dialog.removeAttribute('aria-busy'); start.textContent = t('重試識別', 'Retry reading'); syncButtons(); }
      }
    }
    function close() {
      if (dead) return;
      dead = true; clearTimeout(shutterTimer); controller.abort(); transport?.stop(); rtc?.close();
      video.srcObject = null;
      urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); imageUrls.clear();
      if (session) void request(`/api/capture/sessions/${encodeURIComponent(session.id)}`, { token: session.hostToken, method: 'DELETE' }).catch(() => {});
      window.removeEventListener('pagehide', close);
      if (dialog.open && dialog.close) dialog.close();
      dialog.remove(); current = null;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    dialog.addEventListener('close', close);
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    });
    document.body.append(dialog);
    current = { dialog, close };
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    window.addEventListener('pagehide', close);
    void (async () => {
      try {
        session = await request('/api/capture/sessions', { method: 'POST', body: '{}', signal: controller.signal });
        if (dead) {
          void request(`/api/capture/sessions/${encodeURIComponent(session.id)}`, { token: session.hostToken, method: 'DELETE' }).catch(() => {});
          return;
        }
        const phoneUrl = new URL(session.phoneUrl, location.origin);
        if (phoneUrl.origin !== location.origin) throw new Error(t('配對地址不正確，請重新建立。', 'The pairing address is invalid. Please start again.'));
        link.value = phoneUrl.href; copy.disabled = false;
        if (session.qrSvg) {
          const url = URL.createObjectURL(new Blob([session.qrSvg], { type: 'image/svg+xml' })); urls.add(url);
          qr.append(h('img', { src: url, alt: t('手機掃描配對二維碼', 'Scan this pairing QR code') }));
        }
        transport = channel(session, session.hostToken, {
          onState(state) { sessionStatus = state.status; return paintPages(state.pages); },
          async onMessage(message) {
            if (message.type === 'ready') {
              if (message.data?.camera === false) say(t('手機已連接，可從手機相冊加入照片。', 'Phone connected. You can upload photos from its gallery.'));
              else await rtc.offer();
            } else await rtc.receive(message);
          },
          onError(error) {
            say(error.message, true);
            if ([401, 403, 404, 410].includes(error.status)) { terminal = true; rtc?.close(); connected = false; syncButtons(); }
          },
        });
        rtc = peer({ role: 'host', iceServers: session.iceServers, send: transport.send,
          onStream(stream) { video.srcObject = stream; waiting.hidden = !!stream; if (stream) void video.play().catch(() => {}); },
          onStatus(state, error) {
            connected = state === 'connected'; syncButtons();
            if (importing) return;
            if (state === 'connected') say(t('手機畫面已連接。可以拍攝。', 'Live phone camera connected. Ready to capture.'));
            else if (state === 'connecting') say(t('手機已連接，正在建立實時畫面……', 'Phone paired. Connecting the live camera…'));
            else if (state === 'failed' || state === 'disconnected') say(t('實時畫面已斷開。可重新連接，或從手機繼續上傳照片。', 'Live preview disconnected. Reconnect, or keep uploading photos from the phone.'), true);
            else if (state === 'error') say(error?.message || t('預覽連線未完成。', 'Preview connection failed.'), true);
          },
        });
        syncButtons(); say(t('用手機掃描二維碼，或把連結傳到手機開啟。', 'Scan the QR code, or open the link on your phone.'));
        void transport.start();
      } catch (error) { if (error.name !== 'AbortError') say(error.message, true); }
    })();
  }
  window.PolicyCapture = Object.freeze({ request, channel, peer, encodeImage, encodeFile, MAX_PAGES });
  PL.capture = Object.freeze({ open, close: () => current?.close() });
})();
