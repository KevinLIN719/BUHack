import express, { type Request, type Response } from "express";
import multer from "multer";

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 60;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_TRANSCRIPT_CHARACTERS = 20_000;
const ASR_PATH = "/api/v1/services/aigc/multimodal-generation/generation";

export class AsrError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

type AsrOptions = {
  apiKey?: string;
  model?: string;
  region?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** All duration and format checks use the file bytes, never client metadata. */
export function inspectVoiceWav(input: Uint8Array) {
  const bytes = Buffer.from(input);
  const invalid = () => new AsrError(415, "INVALID_VOICE_AUDIO", "請使用 16 kHz、單聲道的 WAV 錄音。");
  if (bytes.length > MAX_AUDIO_BYTES) throw new AsrError(413, "VOICE_AUDIO_SIZE", "錄音不能超過 2 MB，請縮短後重試。");
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) !== bytes.length - 8) throw invalid();
  let offset = 12, hasFormat = false, dataBytes = 0;
  while (offset + 8 <= bytes.length) {
    const name = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (size > bytes.length - offset) throw invalid();
    if (name === "fmt ") {
      if (hasFormat || size < 16 || bytes.readUInt16LE(offset) !== 1 || bytes.readUInt16LE(offset + 2) !== 1
        || bytes.readUInt32LE(offset + 4) !== 16000 || bytes.readUInt32LE(offset + 8) !== 32000
        || bytes.readUInt16LE(offset + 12) !== 2 || bytes.readUInt16LE(offset + 14) !== 16) throw invalid();
      hasFormat = true;
    } else if (name === "data") {
      if (dataBytes || !size || size % 2) throw invalid();
      dataBytes = size;
    }
    offset += size + size % 2;
  }
  if (!hasFormat || !dataBytes || offset !== bytes.length) throw invalid();
  const durationSeconds = dataBytes / 32000;
  if (durationSeconds > MAX_AUDIO_SECONDS) throw new AsrError(413, "VOICE_AUDIO_DURATION", "每次錄音最多 60 秒，請分段補充。");
  return { durationSeconds };
}

function configuration(options: AsrOptions) {
  const apiKey = (options.apiKey ?? process.env.DASHSCOPE_API_KEY)?.trim();
  if (!apiKey) throw new AsrError(503, "ASR_NOT_CONFIGURED", "語音識別尚未啟用，請先配置百煉服務。");
  const model = (options.model ?? process.env.POLICY_LENS_ASR_MODEL)?.trim() || "qwen3-asr-flash";
  // These synchronous families accept Data URLs. Filetrans/Fun-ASR require a
  // different asynchronous protocol and must never be silently sent this body.
  if (!/^(?:qwen3-asr-flash|qwen-audio-3\.[01]-asr-flash)(?:-(?:latest|\d{4}-\d{2}-\d{2}))?$/.test(model)) {
    throw new AsrError(503, "ASR_MODEL_UNSUPPORTED", "語音模型設定不受支援，請配置 Qwen ASR Flash 短錄音模型。");
  }
  const region = (options.region ?? process.env.DASHSCOPE_REGION)?.trim().toLowerCase() || "cn";
  const host = ["cn", "beijing", "cn-beijing", "china"].includes(region) ? "dashscope.aliyuncs.com"
    : ["intl", "singapore", "ap-southeast-1", "sg"].includes(region) ? "dashscope-intl.aliyuncs.com" : null;
  if (!host) throw new AsrError(503, "ASR_REGION_UNSUPPORTED", "語音服務地域設定有誤，請配置北京或新加坡地域。");
  return { apiKey, model, url: `https://${host}${ASR_PATH}` };
}

function providerFailure(status: number, code = ""): AsrError {
  if ([401, 403].includes(status) || /InvalidApiKey|AccessDenied|Unauthorized|InvalidAccessKey/i.test(code)) {
    return new AsrError(503, "ASR_AUTH_REQUIRED", "語音服務認證未生效，請核對百煉 Key 與地域後重試。");
  }
  if (status === 429 || /Throttl|RateLimit/i.test(code)) return new AsrError(429, "ASR_RATE_LIMITED", "語音識別繁忙，請稍後重試。");
  if ([400, 404, 422].includes(status) || /InvalidParameter|ModelNotFound/i.test(code)) return new AsrError(503, "ASR_MODEL_UNAVAILABLE", "語音模型暫時無法使用，請核對模型設定後重試。");
  return new AsrError(503, "ASR_UNAVAILABLE", "語音識別暫時無法使用，請重試。");
}

async function readResult(response: globalThis.Response): Promise<unknown> {
  if (!response.body) throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務沒有返回可用結果，請重試。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務返回的內容過大，請重試。");
      }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務沒有返回可用結果，請重試。"); }
  } finally { reader.releaseLock(); }
}

function transcriptionFrom(result: unknown, modern: boolean) {
  const raw = result as { code?: unknown; output?: { text?: unknown; choices?: { finish_reason?: unknown; message?: { content?: unknown } }[] } } | null;
  if (!raw || typeof raw !== "object") throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務沒有返回可用結果，請重試。");
  if (typeof raw.code === "string" && raw.code) throw providerFailure(0, raw.code);
  let text: unknown;
  if (modern) text = raw.output?.text;
  else {
    const choice = Array.isArray(raw.output?.choices) ? raw.output.choices[0] : undefined;
    if (choice?.finish_reason !== "stop" || !Array.isArray(choice.message?.content)) throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音識別結果未完整返回，請重試。");
    const content = choice.message.content as { text?: unknown }[];
    if (content.some(item => !item || typeof item.text !== "string")) throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務沒有返回可用結果，請重試。");
    text = content.map(item => item.text).join("");
  }
  if (typeof text !== "string" || text.length > MAX_TRANSCRIPT_CHARACTERS) throw new AsrError(502, "ASR_INVALID_RESPONSE", "語音服務沒有返回可用結果，請重試。");
  text = text.trim();
  if (!text) throw new AsrError(422, "ASR_NO_SPEECH", "沒有辨識到清晰語音，請靠近麥克風再錄一次。");
  return text as string;
}

/** Audio exists only in request memory. Confirmation/storage of text is separate. */
export async function transcribeVoice(input: Uint8Array, options: AsrOptions & { signal?: AbortSignal } = {}) {
  const { durationSeconds } = inspectVoiceWav(input);
  const { apiKey, model, url } = configuration(options);
  const modern = model.startsWith("qwen-audio-");
  const audio = `data:audio/wav;base64,${Buffer.from(input).toString("base64")}`;
  const timeout = AbortSignal.timeout(Math.min(60_000, Math.max(1, options.timeoutMs ?? 55_000)));
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    signal.throwIfAborted();
    const response = await (options.fetch ?? fetch)(url, {
      method: "POST", redirect: "error", signal,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "X-DashScope-SSE": "disable" },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: "user", content: modern ? [{ type: "input_audio", input_audio: { data: audio } }] : [{ audio }] }] },
        parameters: modern ? { format: "wav", sample_rate: "16000" } : { asr_options: { enable_itn: false } },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw providerFailure(response.status);
    }
    const result = await readResult(response);
    signal.throwIfAborted();
    return { text: transcriptionFrom(result, modern), model, durationSeconds };
  } catch (error) {
    // Fetch errors may carry headers or audio; never propagate their message/cause.
    if (options.signal?.aborted) throw new AsrError(499, "ASR_CANCELLED", "語音識別已取消。");
    if (timeout.aborted) throw new AsrError(504, "ASR_TIMEOUT", "語音識別逾時，請稍後重試。");
    if (error instanceof AsrError) throw error;
    throw providerFailure(0);
  }
}

function sendError(res: Response, error: unknown) {
  const safe = error instanceof AsrError ? error
    : error instanceof multer.MulterError ? new AsrError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "INVALID_VOICE_UPLOAD", "請上傳一段不超過 2 MB 的 WAV 錄音。")
      : new AsrError(503, "ASR_UNAVAILABLE", "語音識別暫時無法使用，請重試。");
  if (!res.destroyed && !res.headersSent) res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
}

export function createAsrRouter(options: AsrOptions = {}) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0, parts: 1 } }).single("file");
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST" && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) {
      return sendError(res, new AsrError(403, "ORIGIN_DENIED", "請從 Policy Lens 頁面錄音。"));
    }
    next();
  });
  router.post("/transcriptions", (req: Request, res: Response) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const closed = () => { if (!res.writableEnded) abort(); };
    req.once("aborted", abort);
    res.once("close", closed);
    const cleanup = () => { req.off("aborted", abort); res.off("close", closed); };
    upload(req, res, (uploadError: unknown) => {
      void (async () => {
        try {
          if (uploadError) throw uploadError;
          if (!req.file) throw new AsrError(400, "VOICE_AUDIO_REQUIRED", "請先錄音，再開始轉文字。");
          const result = await transcribeVoice(req.file.buffer, { ...options, signal: controller.signal });
          if (!controller.signal.aborted) res.json(result);
        } catch (error) { sendError(res, error); }
        finally { cleanup(); }
      })();
    });
  });
  return router;
}
