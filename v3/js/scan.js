/* Phone-only capture page. Tokens remain in memory / the URL fragment. */
(() => {
  'use strict';
  const PL = window.PL;
  const { h } = PL;
  const { request, channel, peer, encodeImage, encodeFile, MAX_PAGES } = window.PolicyCapture;
  const t = (zh, en) => PL.t(zh, en);
  const params = new URLSearchParams(location.hash.slice(1));
  const id = params.get('id'), token = params.get('token');
  const root = document.getElementById('phone-scan');
  let dead = false, terminal = false, stream = null, rtc = null, transport = null;
  let pageCount = 0, uploading = false, starting = false, facing = 'environment', cameraEpoch = 0, sessionStatus = '';
  const controller = new AbortController();
  const seenCaptures = new Set();
  const say = (message, error = false) => { if (!dead) { status.textContent = message; status.classList.toggle('is-error', error); } };
  const video = h('video', { class: 'cap-video', autoplay: true, muted: true, playsinline: true, 'aria-label': t('保單取景畫面', 'Policy camera') });
  video.muted = true;
  const placeholder = h('p', { class: 'phone-camera-placeholder' }, t('開啟攝像頭，讓電腦同步顯示取景畫面。', 'Start the camera to show its live view on your computer.'));
  const status = h('p', { class: 'cap-status', role: 'status', 'aria-live': 'polite' }, t('正在連接電腦……', 'Connecting to your computer…'));
  const count = h('span', { class: 'phone-page-count', 'aria-live': 'polite' }, t('已拍 0 頁', '0 pages captured'));
  const start = h('button', { type: 'button', class: 'cap-btn is-primary', disabled: true, onclick: () => { void startCamera(); } }, t('開啟攝像頭', 'Start camera'));
  const shutter = h('button', { type: 'button', class: 'cap-btn is-primary phone-shutter', disabled: true, onclick: () => { void takePhoto(); } }, t('拍攝這一頁', 'Capture this page'));
  const switcher = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: () => { facing = facing === 'environment' ? 'user' : 'environment'; void startCamera(); } }, t('切換鏡頭', 'Switch camera'));
  const stop = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: () => { stopCamera(); void transport?.send('disconnect').catch(() => {}); say(t('攝像頭已停止，仍可從相冊加入照片。', 'Camera stopped. You can still add gallery photos.')); } }, t('停止攝像頭', 'Stop camera'));
  const retry = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: () => {
    if (stream) { rtc?.reset(); void transport.send('ready', { camera: true }).catch((error) => say(error.message, true)); }
    else void startCamera();
  } }, t('重新連接', 'Reconnect'));
  const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: () => {
    const files = Array.from(picker.files || []); picker.value = '';
    if (files.length) void addFiles(files);
  } });
  const gallery = h('button', { type: 'button', class: 'cap-btn', disabled: true, onclick: () => picker.click() }, t('從相冊加入', 'Add from gallery'));
  const languages = h('div', { class: 'phone-language', role: 'group', 'aria-label': 'Language' },
    ...['zh', 'en'].map((lang) => h('button', { type: 'button', class: 'cap-btn', 'aria-pressed': lang === 'zh', onclick: () => {
      // Do not reload a live camera session for a language switch.
      PL.setState({ lang });
      document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant-HK';
      languages.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-pressed', ['zh', 'en'][index] === lang));
      paintLabels();
    } }, lang === 'en' ? 'EN' : '繁')));
  root.append(h('header', { class: 'phone-heading' }, h('div', {}, h('p', { class: 'eyebrow' }, 'Policy Lens'), h('h1', {}, t('手機掃描', 'Phone scan'))), languages),
    status,
    h('div', { class: 'cap-viewfinder phone-viewfinder' }, video, placeholder, h('span', { class: 'cap-frame', 'aria-hidden': 'true' })),
    h('div', { class: 'phone-primary-actions' }, start, shutter),
    h('div', { class: 'phone-secondary-actions' }, gallery, switcher, retry, stop), picker,
    h('footer', { class: 'phone-footer' }, count, h('p', { class: 'cap-note' }, t('一頁一拍。拍完後，在電腦開始識別。', 'One photo per page. Start reading on the computer when you are done.'))));

  function paintLabels() {
    root.querySelector('h1').textContent = t('手機掃描', 'Phone scan');
    start.textContent = t('開啟攝像頭', 'Start camera'); shutter.textContent = t('拍攝這一頁', 'Capture this page');
    gallery.textContent = t('從相冊加入', 'Add from gallery'); switcher.textContent = t('切換鏡頭', 'Switch camera');
    stop.textContent = t('停止攝像頭', 'Stop camera'); retry.textContent = t('重新連接', 'Reconnect');
    placeholder.textContent = t('開啟攝像頭，讓電腦同步顯示取景畫面。', 'Start the camera to show its live view on your computer.');
    root.querySelector('.phone-footer .cap-note').textContent = t('一頁一拍。拍完後，在電腦開始識別。', 'One photo per page. Start reading on the computer when you are done.');
    count.textContent = t(`已拍 ${pageCount} 頁`, `${pageCount} pages captured`);
  }
  function sync() {
    const available = !!transport && !dead && !terminal;
    const locked = ['processing', 'imported'].includes(sessionStatus);
    const live = stream?.getVideoTracks().some((track) => track.readyState === 'live');
    start.hidden = !!live;
    start.disabled = !available || uploading || starting;
    shutter.hidden = !live;
    shutter.disabled = !available || locked || !live || uploading || starting || pageCount >= MAX_PAGES;
    gallery.disabled = !available || locked || uploading || starting || pageCount >= MAX_PAGES;
    switcher.disabled = !available || !live || uploading || starting;
    stop.disabled = !available || !live || uploading || starting;
    retry.disabled = !available || uploading || starting;
    placeholder.hidden = !!live;
  }
  function stopCamera() {
    cameraEpoch += 1;
    rtc?.reset();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null; video.srcObject = null; sync();
  }
  function cameraError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return t('未獲攝像頭權限。可在瀏覽器設定允許，或從相冊加入照片。', 'Camera permission was denied. Allow it in browser settings, or add photos from your gallery.');
    if (error.name === 'NotFoundError') return t('找不到可用攝像頭，請從相冊加入照片。', 'No camera was found. Add photos from your gallery.');
    if (error.name === 'NotReadableError') return t('攝像頭可能正被其他程式使用。關閉後重試，或從相冊加入。', 'The camera may be in use by another app. Close it and retry, or use your gallery.');
    return error.message || t('未能開啟攝像頭，可從相冊加入照片。', 'Could not start the camera. You can use your gallery instead.');
  }
  async function startCamera() {
    if (starting || dead || terminal || !transport) return;
    stopCamera();
    const epoch = cameraEpoch;
    starting = true; sync();
    say(t('請允許攝像頭存取。', 'Please allow camera access.'));
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error(t('攝像頭需要 HTTPS。請使用電腦顯示的安全連結，或從相冊上傳。', 'The camera needs HTTPS. Use the secure link shown on your computer, or upload from your gallery.'));
      let next;
      try { next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1920 } } }); }
      catch (error) {
        if (error.name !== 'OverconstrainedError') throw error;
        next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } });
      }
      if (dead || terminal || epoch !== cameraEpoch) { next.getTracks().forEach((track) => track.stop()); return; }
      stream = next; video.srcObject = stream;
      await video.play();
      if (dead || epoch !== cameraEpoch) return;
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => {
        if (!dead && stream?.getVideoTracks().includes(track)) { stopCamera(); say(t('攝像頭已停止，請重新開啟。', 'The camera stopped. Please start it again.'), true); }
      }, { once: true });
      sync();
      await transport.send('ready', { camera: true });
      say(t('攝像頭已開啟，正在同步至電腦。', 'Camera started. Connecting its live view to the computer.'));
    } catch (error) {
      if (dead || epoch !== cameraEpoch) return;
      stopCamera(); say(cameraError(error), true);
      void transport.send('ready', { camera: false }).catch(() => {});
    } finally { if (!dead) { starting = false; sync(); } }
  }
  async function uploadPhoto(photo, name) {
    if (dead || terminal || controller.signal.aborted) return;
    if (['processing', 'imported'].includes(sessionStatus)) throw new Error(t('電腦已開始識別，暫時不能加入新頁面。', 'The computer has started reading. New pages cannot be added now.'));
    await request(`${transport.base}/pages`, {
      token, signal: controller.signal, method: 'POST', body: JSON.stringify({ dataUrl: photo.dataUrl, name }),
    });
    pageCount += 1; count.textContent = t(`已拍 ${pageCount} 頁`, `${pageCount} pages captured`);
  }
  async function takePhoto() {
    if (uploading || starting || dead || terminal || !stream || pageCount >= MAX_PAGES || ['processing', 'imported'].includes(sessionStatus)) return;
    if (video.readyState < 2 || !video.videoWidth) { say(t('畫面尚未準備好，請稍後再拍。', 'The camera is not ready. Try again in a moment.'), true); return; }
    uploading = true; sync(); say(t('正在上傳這一頁……', 'Uploading this page…'));
    try {
      // Read the phone camera, never the low-bandwidth video received by the computer.
      const image = await encodeImage(video, video.videoWidth, video.videoHeight);
      await uploadPhoto(image, `scan-${Date.now()}.jpg`);
      if (!dead && !terminal) say(t('已傳到電腦，可以繼續拍下一頁。', 'Sent to the computer. You can capture the next page.'));
    } catch (error) { if (error.name !== 'AbortError') say(error.message, true); }
    finally { if (!dead) { uploading = false; sync(); } }
  }
  async function addFiles(files) {
    if (uploading || dead || terminal || !transport || ['processing', 'imported'].includes(sessionStatus)) return;
    if (files.length + pageCount > MAX_PAGES) { say(t(`每次最多 ${MAX_PAGES} 頁，請減少選取的照片。`, `A session holds up to ${MAX_PAGES} pages. Select fewer photos.`), true); return; }
    uploading = true; sync();
    try {
      for (let i = 0; i < files.length; i += 1) {
        if (dead || terminal) return;
        say(t(`正在上傳照片 ${i + 1}／${files.length}……`, `Uploading photo ${i + 1} of ${files.length}…`));
        await uploadPhoto(await encodeFile(files[i]), files[i].name.replace(/\.[^.]+$/, '') + '.jpg');
      }
      say(t('照片已傳到電腦。', 'Photos sent to the computer.'));
    } catch (error) { if (error.name !== 'AbortError') say(error.message, true); }
    finally { if (!dead) { uploading = false; sync(); } }
  }
  function terminate(message) {
    terminal = true; transport?.stop(); stopCamera(); rtc?.close(); controller.abort(); say(message, true); sync();
  }
  function destroy() {
    if (dead) return;
    dead = true; controller.abort(); transport?.stop(); stopCamera(); rtc?.close();
  }
  window.addEventListener('pagehide', destroy, { once: true });
  if (!id || !token || id.length > 150 || token.length > 1000) {
    terminate(t('這個配對連結不完整。請掃描電腦上的新二維碼。', 'This pairing link is incomplete. Scan a new QR code on your computer.'));
    return;
  }
  void (async () => {
    try {
      const state = await request(`/api/capture/sessions/${encodeURIComponent(id)}`, { token, signal: controller.signal });
      if (dead) return;
      if (state.status === 'closed' || state.status === 'expired' || Date.parse(state.expiresAt) <= Date.now()) {
        terminate(t('配對已過期。請掃描電腦上的新二維碼。', 'Pairing expired. Scan a new QR code on your computer.')); return;
      }
      sessionStatus = state.status;
      pageCount = state.pages?.length || 0;
      transport = channel({ id }, token, {
        onState(next) {
          const changed = sessionStatus !== next.status;
          sessionStatus = next.status;
          pageCount = next.pages?.length || 0;
          count.textContent = t(`已拍 ${pageCount} 頁`, `${pageCount} pages captured`);
          if (changed && sessionStatus === 'processing') say(t('電腦正在識別這些頁面，請稍候。', 'The computer is reading these pages. Please wait.'));
          else if (changed && sessionStatus === 'imported') say(t('已加入保單，請在電腦繼續。', 'Your policy has been added. Continue on the computer.'));
          else if (changed && sessionStatus === 'connected') say(t('已連接電腦，可以繼續加入頁面。', 'Connected to the computer. You can keep adding pages.'));
          sync();
        },
        async onMessage(message) {
          if (message.type === 'capture') {
            const requestId = message.data?.requestId;
            if (requestId && seenCaptures.has(requestId)) return;
            if (requestId) { if (seenCaptures.size > 100) seenCaptures.clear(); seenCaptures.add(requestId); }
            if (!stream) say(t('電腦要求拍攝，請先開啟攝像頭。', 'The computer requested a photo. Start the camera first.'), true);
            else await takePhoto();
          } else await rtc.receive(message);
        },
        onError(error) {
          if ([401, 403, 404, 410].includes(error.status)) terminate(error.message);
          else say(error.message, true);
        },
      });
      rtc = peer({ role: 'phone', iceServers: state.iceServers, send: transport.send, stream: () => stream,
        onStatus(value, error) {
          if (uploading || starting || ['processing', 'imported'].includes(sessionStatus)) return;
          if (value === 'connected') say(t('電腦正同步顯示畫面。', 'Your computer is showing the live camera.'));
          else if (value === 'failed' || value === 'disconnected') say(t('實時預覽已斷開，照片仍可上傳。可按「重新連接」。', 'Live preview disconnected. Photo upload still works. Tap Reconnect.'), true);
          else if (value === 'error') say(error?.message || t('預覽連接失敗，照片仍可上傳。', 'Preview connection failed. Photo upload still works.'), true);
        },
      });
      sync();
      say(t('已連接電腦。開啟攝像頭，或從相冊加入照片。', 'Paired with your computer. Start the camera or add gallery photos.'));
      await transport.send('ready', { camera: false });
      void transport.start();
    } catch (error) { if (error.name !== 'AbortError') terminate(error.message); }
  })();
})();
