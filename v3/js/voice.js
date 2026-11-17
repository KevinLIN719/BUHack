/* Voice notes: short local recordings, ASR, then an explicit editable confirmation. */
(() => {
  const PL = window.PL;
  const { h } = PL;
  const MAX_SECONDS = 60;
  const MAX_NOTE = 800;
  const SAMPLE_RATE = 16000;
  const MAX_WAV_BYTES = 2 * 1024 * 1024;
  let current = null;

  const t = (zh, en) => PL.t(zh, en);
  const clock = (seconds) => { const value = Math.min(MAX_SECONDS, Math.floor(seconds)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; };

  function microphoneError(error) {
    if (['NotAllowedError', 'SecurityError'].includes(error.name)) return t('未獲麥克風權限。請在瀏覽器允許錄音，或選擇已有的錄音。', 'Microphone access was denied. Allow it in your browser, or choose an audio file.');
    if (error.name === 'NotFoundError') return t('找不到麥克風，可以選擇已有的錄音。', 'No microphone was found. You can choose an audio file instead.');
    if (error.name === 'NotReadableError') return t('麥克風正在被其他程式使用，請關閉後重試。', 'The microphone is in use. Close the other app and retry.');
    return t('暫時無法開始錄音，可以選擇已有的錄音。', 'Recording could not start. You can choose an audio file instead.');
  }

  /** Decode in the browser, mix channels, and send only bounded PCM16 mono WAV. */
  async function toWav(blob, isCurrent, rememberContext, recording = false) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error(t('此瀏覽器無法處理錄音，請使用最新版 Safari、Chrome 或 Edge。', 'This browser cannot process audio. Use a current Safari, Chrome or Edge.'));
    if (blob.size > 20 * 1024 * 1024) throw new Error(t('錄音檔案太大，請選擇 60 秒內的短錄音。', 'This file is too large. Choose a recording of 60 seconds or less.'));
    const context = new Audio();
    rememberContext(context);
    try {
      const bytes = await blob.arrayBuffer();
      if (!isCurrent()) return null;
      let decoded;
      try { decoded = await context.decodeAudioData(bytes); }
      catch { throw new Error(t('無法讀取這段錄音，請重錄或選擇 WAV、MP3、M4A 等可播放的音訊。', 'This recording could not be read. Record again, or choose playable WAV, MP3 or M4A audio.')); }
      if (!isCurrent()) return null;
      if (!(decoded.duration > 0) || !decoded.length) throw new Error(t('這段錄音是空的，請重錄。', 'This recording is empty. Please record again.'));
      if (!recording && decoded.duration > MAX_SECONDS + 0.1) throw new Error(t('每段錄音最多 60 秒，請選擇較短的一段。', 'Each recording can be up to 60 seconds. Choose a shorter clip.'));
      // A recorder can flush a few extra milliseconds after the 60-second stop.
      const frames = Math.min(MAX_SECONDS * SAMPLE_RATE, Math.floor(decoded.duration * SAMPLE_RATE));
      if (44 + frames * 2 > MAX_WAV_BYTES) throw new Error(t('錄音太大，請縮短後重試。', 'This recording is too large. Try a shorter clip.'));
      const buffer = new ArrayBuffer(44 + frames * 2);
      const view = new DataView(buffer);
      const put = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
      put(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); put(8, 'WAVE');
      put(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      put(36, 'data'); view.setUint32(40, frames * 2, true);
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
      const ratio = decoded.sampleRate / SAMPLE_RATE;
      for (let i = 0; i < frames; i++) {
        const position = i * ratio, index = Math.floor(position), fraction = position - index;
        let value = 0;
        for (const channel of channels) value += channel[index] * (1 - fraction) + channel[Math.min(index + 1, channel.length - 1)] * fraction;
        value = Math.max(-1, Math.min(1, value / channels.length));
        view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 0x8000 : 0x7fff)), true);
      }
      return { blob: new Blob([buffer], { type: 'audio/wav' }), duration: frames / SAMPLE_RATE };
    } finally {
      rememberContext(null);
      if (context.state !== 'closed') await context.close().catch(() => {});
    }
  }

  function open({ onConfirm } = {}) {
    if (current) { current.dialog.focus(); return current; }
    const previous = document.activeElement;
    let dead = false, version = 0, phase = 'idle', recorder = null, stream = null, timer = 0, startedAt = 0;
    let audioContext = null, pendingRequest = null, audioUrl = null, wav = null, hasOldAnalysis = false;
    const isCurrent = (take) => !dead && take === version;
    const titleId = `voice-title-${crypto.randomUUID()}`;
    const editorId = `voice-text-${crypto.randomUUID()}`;
    const status = h('p', { class: 'voice-status', role: 'status', 'aria-live': 'polite' }, t('說說你的情況，或最想問的問題。', 'Tell us your situation, or what you want to ask.'));
    const time = h('span', { class: 'voice-clock', 'aria-label': t('錄音時間', 'Recording time') }, '00:00');
    const bars = h('span', { class: 'voice-bars', 'aria-hidden': 'true' }, ...Array.from({ length: 7 }, (_, i) => h('i', { style: `--bar:${i}` })));
    const start = h('button', { type: 'button', class: 'cap-btn is-primary', onclick: () => { void startRecording(); } }, t('開始錄音', 'Start recording'));
    const stop = h('button', { type: 'button', class: 'cap-btn is-primary', hidden: true, onclick: () => stopRecording() }, t('停止錄音', 'Stop recording'));
    const file = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.webm,.ogg,.mp4', hidden: true, onchange: (event) => {
      const selected = event.target.files?.[0]; event.target.value = '';
      if (selected) void prepare(selected);
    } });
    const choose = h('button', { type: 'button', class: 'cap-btn', onclick: () => file.click() }, t('選擇錄音檔案', 'Choose audio file'));
    const player = h('audio', { class: 'voice-player', controls: true, preload: 'metadata', 'aria-label': t('回聽錄音', 'Play recording'), hidden: true });
    const transcribe = h('button', { type: 'button', class: 'cap-btn is-primary', hidden: true, onclick: () => { void recognize(); } }, t('轉成文字', 'Transcribe'));
    const editor = h('textarea', { id: editorId, class: 'voice-editor', rows: '6', oninput: () => updateBudget(), 'aria-describedby': `${editorId}-budget` });
    const budget = h('p', { id: `${editorId}-budget`, class: 'voice-budget', 'aria-live': 'polite' });
    const review = h('section', { class: 'voice-review', hidden: true },
      h('label', { for: editorId }, t('確認文字後再加入', 'Check the text before adding it')), editor, budget);
    const confirm = h('button', { type: 'button', class: 'cap-btn is-primary', hidden: true, onclick: () => { void confirmText(); } }, t('加入補充信息', 'Add information'));
    const reread = h('button', { type: 'button', class: 'cap-btn is-primary', hidden: true, onclick: () => { close(); void PL.go('parse'); } }, t('重新解讀', 'Read again'));
    const done = h('button', { type: 'button', class: 'cap-btn', hidden: true, onclick: () => close() }, t('完成', 'Done'));
    const closer = h('button', { type: 'button', class: 'cap-btn cap-close', 'aria-label': t('關閉錄音', 'Close voice recording'), onclick: () => close() }, '×');
    const controls = h('div', { class: 'voice-controls' }, start, stop, choose, file, transcribe);
    const dialog = h('dialog', { class: 'cap-dialog voice-dialog', tabindex: '-1', 'aria-labelledby': titleId },
      h('div', { class: 'cap-heading' }, h('div', {}, h('p', { class: 'eyebrow' }, 'Policy Lens'), h('h2', { id: titleId }, t('錄音補充信息', 'Add information by voice'))), closer),
      h('p', { class: 'voice-caption' }, t('最多 60 秒 · 轉寫後可修改', 'Up to 60 seconds · edit after transcription')),
      status,
      h('div', { class: 'voice-meter' }, bars, time), controls, player, review,
      h('div', { class: 'voice-footer' }, confirm, reread, done),
      h('p', { class: 'cap-note voice-note' }, t('作為你的個人背景補充，不作保單條款依據。', 'Used as your personal context, not as policy wording.')));

    function say(message, error = false) {
      if (dead) return;
      status.textContent = message;
      status.classList.toggle('is-error', error);
    }
    function releaseStream() { stream?.getTracks().forEach((track) => track.stop()); stream = null; }
    function releaseAudio() {
      player.pause(); player.removeAttribute('src'); player.load(); player.hidden = true;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = null; wav = null;
    }
    function paint(next) {
      if (dead) return;
      phase = next;
      const busy = ['asking', 'preparing', 'transcribing', 'saving'].includes(phase);
      dialog.setAttribute('aria-busy', String(busy));
      dialog.classList.toggle('is-recording', phase === 'recording');
      start.hidden = phase === 'recording' || phase === 'confirmed';
      start.disabled = busy;
      start.textContent = wav || phase === 'review' ? t('重新錄音', 'Record again') : t('開始錄音', 'Start recording');
      stop.hidden = phase !== 'recording';
      choose.hidden = phase === 'confirmed'; choose.disabled = busy || phase === 'recording';
      transcribe.hidden = !wav || ['recording', 'review', 'confirmed'].includes(phase);
      transcribe.disabled = busy;
      review.hidden = !['review', 'saving', 'confirmed'].includes(phase);
      editor.disabled = phase !== 'review';
      budget.hidden = phase === 'confirmed';
      confirm.hidden = !['review', 'saving'].includes(phase);
      reread.hidden = phase !== 'confirmed' || !hasOldAnalysis;
      done.hidden = phase !== 'confirmed';
      updateBudget();
    }
    function combinedNote() {
      const before = (PL.getState().userNote || '').trim();
      const text = editor.value.trim();
      return [before, text].filter(Boolean).join('\n');
    }
    function updateBudget() {
      const before = (PL.getState().userNote || '').trim();
      const available = Math.max(0, MAX_NOTE - before.length - (before ? 1 : 0));
      const length = editor.value.trim().length;
      const over = combinedNote().length > MAX_NOTE;
      budget.textContent = over
        ? t(`超出 ${combinedNote().length - MAX_NOTE} 字，請精簡後再加入；原有補充會保留。`, `${combinedNote().length - MAX_NOTE} characters over the limit. Shorten the text; your earlier note will be kept.`)
        : t(`本次可加入 ${available} 字 · 已用 ${length} 字`, `${length} / ${available} characters available for this note`);
      budget.classList.toggle('is-error', over);
      confirm.disabled = phase !== 'review' || !length || over;
    }
    async function prepare(blob, take = ++version, recording = false) {
      if (!isCurrent(take)) return;
      paint('preparing'); say(t('正在準備錄音……', 'Preparing audio…'));
      releaseAudio(); editor.value = '';
      try {
        const prepared = await toWav(blob, () => isCurrent(take), (value) => { audioContext = value; }, recording);
        if (!isCurrent(take) || !prepared) return;
        wav = prepared.blob;
        audioUrl = URL.createObjectURL(wav); player.src = audioUrl; player.hidden = false;
        time.textContent = clock(prepared.duration);
        paint('ready'); say(t('可以先回聽，再轉成文字。', 'Play it back, then transcribe it.'));
      } catch (error) {
        if (!isCurrent(take)) return;
        paint('idle'); say(error.message, true);
      }
    }
    async function startRecording() {
      if (['asking', 'recording', 'preparing', 'transcribing', 'saving'].includes(phase)) return;
      const take = ++version;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        say(t('此瀏覽器無法錄音，可以選擇已有的錄音檔案。', 'Recording is unavailable in this browser. Choose an audio file instead.'), true); return;
      }
      paint('asking'); say(t('請允許使用麥克風。', 'Please allow microphone access.'));
      let acquired;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
        if (!isCurrent(take)) { acquired.getTracks().forEach((track) => track.stop()); return; }
        releaseStream(); stream = acquired;
        const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported?.(type));
        const recording = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
        recorder = recording;
        const chunks = [];
        let failed = false;
        recording.ondataavailable = (event) => { if (isCurrent(take) && event.data.size) chunks.push(event.data); };
        recording.onerror = () => {
          failed = true; clearInterval(timer); releaseStream();
          if (isCurrent(take)) { paint('idle'); say(t('錄音中斷，請重新錄音。', 'Recording was interrupted. Please record again.'), true); }
        };
        recording.onstop = () => {
          clearInterval(timer); releaseStream();
          if (recorder === recording) recorder = null;
          if (!isCurrent(take) || failed) return;
          void prepare(new Blob(chunks, { type: recording.mimeType || chunks[0]?.type || 'audio/webm' }), take, true);
        };
        releaseAudio(); editor.value = ''; time.textContent = '00:00';
        recording.start(250); startedAt = performance.now();
        paint('recording'); say(t('正在錄音，說完後按停止。', 'Recording. Press stop when you are finished.'));
        timer = setInterval(() => {
          if (!isCurrent(take)) return;
          const elapsed = (performance.now() - startedAt) / 1000;
          time.textContent = clock(elapsed);
          if (elapsed >= MAX_SECONDS) stopRecording();
        }, 200);
      } catch (error) {
        acquired?.getTracks().forEach((track) => track.stop()); releaseStream();
        if (isCurrent(take)) { paint('idle'); say(microphoneError(error), true); }
      }
    }
    function stopRecording() {
      if (!recorder || recorder.state === 'inactive') return;
      clearInterval(timer); paint('preparing');
      try { recorder.stop(); } catch { releaseStream(); paint('idle'); say(t('錄音未能完成，請重試。', 'The recording could not be completed. Please retry.'), true); }
    }
    async function recognize() {
      if (!wav || ['transcribing', 'saving'].includes(phase)) return;
      const take = ++version;
      pendingRequest?.abort();
      const request = new AbortController(); pendingRequest = request;
      const timeout = setTimeout(() => request.abort(), 75000);
      paint('transcribing'); say(t('正在轉成文字……', 'Transcribing…'));
      try {
        const form = new FormData(); form.set('file', wav, 'voice-note.wav');
        const response = await fetch('/api/audio/transcriptions', { method: 'POST', credentials: 'same-origin', body: form, signal: request.signal });
        const data = await response.json().catch(() => null);
        if (!isCurrent(take)) return;
        if (!response.ok) throw new Error(data?.error?.message || t('語音識別暫時無法使用，請稍後重試。', 'Speech recognition is unavailable. Please retry shortly.'));
        if (typeof data?.text !== 'string' || !data.text.trim()) throw new Error(t('沒有辨識到文字，請靠近麥克風重新錄音。', 'No speech was recognized. Record again closer to the microphone.'));
        editor.value = data.text.trim();
        paint('review'); say(t('請核對人名、金額和日期，再加入補充信息。', 'Check names, amounts and dates before adding the note.'));
        editor.focus();
      } catch (error) {
        if (!isCurrent(take)) return;
        paint('ready'); say(error.name === 'AbortError' ? t('語音識別逾時，錄音仍在，可以重試。', 'Transcription timed out. Your recording is still here; try again.') : error.message, true);
      } finally { clearTimeout(timeout); if (pendingRequest === request) pendingRequest = null; }
    }
    async function confirmText() {
      updateBudget();
      if (confirm.disabled) return;
      const take = version;
      const combined = combinedNote(), text = editor.value.trim();
      hasOldAnalysis = Boolean(PL.getState().analysis);
      paint('saving');
      try {
        if (onConfirm) await onConfirm(text);
        else PL.setState({ userNote: combined });
        if (!isCurrent(take)) return;
        paint('confirmed');
        say(hasOldAnalysis
          ? t('已加入個人背景。現有解讀尚未更新，可重新解讀。', 'Added to your context. The current reading has not changed; read again to include it.')
          : t('已加入個人背景，解讀保單時會一併使用。', 'Added to your context for the policy reading.'));
        (hasOldAnalysis ? reread : done).focus();
      } catch (error) { if (isCurrent(take)) { paint('review'); say(error.message, true); } }
    }
    function close() {
      if (dead) return;
      dead = true; version++; clearInterval(timer); pendingRequest?.abort();
      if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
      recorder = null; releaseStream(); releaseAudio();
      if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => {});
      audioContext = null; unsubscribe();
      window.removeEventListener('pagehide', close);
      if (dialog.open && dialog.close) dialog.close();
      dialog.remove(); current = null;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    dialog.addEventListener('close', close);
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button, input, textarea, audio, [tabindex]')].filter((node) => !node.disabled && !node.hidden && node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    const unsubscribe = PL.subscribe((state, before) => {
      if (state.step !== before.step) close();
      else if (state.userNote !== before.userNote) updateBudget();
    });
    window.addEventListener('pagehide', close);
    document.body.append(dialog);
    current = { dialog, close };
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    start.focus();
    return current;
  }

  PL.voice = Object.freeze({ open, close: () => current?.close() });
})();
