/*
 * Analysis stream for the sample policies. The proposed event format in
 * docs/API.md still needs an adapter before it can use the current backend.
 */
(() => {
  const PL = window.PL;

  const quoteOf = (policy, ref) => {
    const hit = PL.findLine(policy, ref);
    if (!hit) return null;
    return { quote: hit.line.text, page: hit.section.page, section: hit.section.no, lineId: ref };
  };

  /** Mock: replays a sample policy as a stream with realistic gaps. */
  async function* mockStream(policyId, { speed = 1 } = {}) {
    const policy = PL.POLICIES[policyId];
    if (!policy) throw new Error(`Unknown policy: ${policyId}`);
    const pause = (ms) => PL.wait(ms / speed);
    const { summary, gap, scenarios } = policy.analysis;

    yield { type: 'document', title: policy.document.title };
    await pause(500);
    for (const item of summary) {
      await pause(350 + Math.random() * 300);
      yield { type: 'finding', key: item.key, answer: item.answer, ...quoteOf(policy, item.ref) };
    }
    await pause(600);
    yield {
      type: 'gap', says: gap.says, reality: gap.reality, visual: gap.visual,
      table: quoteOf(policy, gap.tableRef), detail: quoteOf(policy, gap.detailRef),
    };
    for (const s of scenarios) {
      await pause(260);
      yield { type: 'scenario', ...s, ...quoteOf(policy, s.ref) };
    }
    yield { type: 'done' };
  }

  /** Real backend: Server-Sent Events, same event shapes. */
  async function* sseStream(url, body, signal) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': PL.getState().lang === 'en' ? 'en' : 'zh-Hant',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(PL.t('無法連接解讀服務，請確認服務正在運行。', 'Cannot reach the analysis service. Make sure Policy Lens is running.'));
    }
    if (!res.ok || !res.body) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error?.message || `Analysis failed (${res.status})`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += value;
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop();
        for (const chunk of chunks) {
          const lines = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart());
          if (!lines.length) continue;
          const event = JSON.parse(lines.join('\n'));
          if (event.type === 'error') throw new Error(event.message || PL.t('解讀中斷，請重試。', 'Analysis interrupted. Please retry.'));
          yield event;
        }
      }
    } finally {
      try { await reader.cancel(); } catch {}
    }
  }

  const apiLang = () => (PL.getState().lang === 'en' ? 'en' : 'zh-Hant');

  PL.api = {
    /** Returns an async iterator of analysis events. */
    analyze(policyId, opts = {}) {
      const state = PL.getState();
      if (state.document?.reviewId) {
        return sseStream(
          `/api/reviews/${state.document.reviewId}/v3-stream`,
          {
            context: state.context || {},
            contextTags: PL.contextTags(),
            ...(state.userNote?.trim() ? { userNote: state.userNote.trim() } : {}),
            lang: apiLang(),
            ...(opts.resume ? { resume: true } : {}),
          },
          opts.signal,
        );
      }
      if (PL.API_URL) {
        return sseStream(`${PL.API_URL}/analyze`, { policyId, context: state.context }, opts.signal);
      }
      return mockStream(policyId, opts);
    },
    /** Adviser reply / brochure claims checked against the contract. */
    claims(opts = {}) {
      const { reviewId } = PL.getState().document;
      return sseStream(`/api/reviews/${reviewId}/v3-claims`, { lang: apiLang() }, opts.signal);
    },
    /** The user's own "what if" situation. */
    whatIf(question, opts = {}) {
      const { reviewId } = PL.getState().document;
      return sseStream(`/api/reviews/${reviewId}/v3-whatif`, { question, lang: apiLang() }, opts.signal);
    },
  };
})();
