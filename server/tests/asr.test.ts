import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAsrRouter, inspectVoiceWav, transcribeVoice, AsrError, MAX_AUDIO_BYTES } from "../asr.js";

const key = "test-only-not-a-real-key";
function wav(seconds = 1) {
  const length = Math.round(seconds * 16000) * 2;
  const bytes = Buffer.alloc(44 + length);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(length, 40);
  return bytes;
}
function result(text = "我會到日本滑雪。") {
  return { output: { choices: [{ finish_reason: "stop", message: { content: [{ text }] } }] } };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const expectCode = (code: string, status?: number) => (error: unknown) => error instanceof AsrError && error.code === code && (status === undefined || error.status === status);

test("Qwen ASR uses an in-memory WAV Data URL and returns transcription with verified duration", async () => {
  const input = wav(1.25);
  let calls = 0;
  const reading = await transcribeVoice(input, {
    apiKey: ` ${key}\n`, model: "qwen3-asr-flash", region: "cn",
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
      assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${key}`);
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "qwen3-asr-flash");
      assert.deepEqual(request.parameters, { asr_options: { enable_itn: false } });
      assert.equal(request.input.messages[0].content[0].audio, `data:audio/wav;base64,${input.toString("base64")}`);
      return json(result("  我會到日本滑雪。  "));
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(reading, { text: "我會到日本滑雪。", model: "qwen3-asr-flash", durationSeconds: 1.25 });
  assert.equal(JSON.stringify(reading).includes(key), false);
  assert.equal(JSON.stringify(reading).includes("base64"), false);
});

test("Qwen-Audio ASR uses its typed input and Singapore endpoint without accepting arbitrary hosts", async () => {
  const reading = await transcribeVoice(wav(), {
    apiKey: key, model: "qwen-audio-3.1-asr-flash", region: "singapore",
    fetch: async (url, init) => {
      assert.match(String(url), /^https:\/\/dashscope-intl\.aliyuncs\.com\//);
      const request = JSON.parse(String(init?.body));
      assert.equal(request.input.messages[0].content[0].type, "input_audio");
      assert.match(request.input.messages[0].content[0].input_audio.data, /^data:audio\/wav;base64,/);
      assert.deepEqual(request.parameters, { format: "wav", sample_rate: "16000" });
      return json({ output: { text: "我家會空置45天。" } });
    },
  });
  assert.equal(reading.text, "我家會空置45天。");
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, region: "https://foreign.example" }), expectCode("ASR_REGION_UNSUPPORTED", 503));
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, model: "fun-asr" }), expectCode("ASR_MODEL_UNSUPPORTED", 503));
  await assert.rejects(transcribeVoice(wav(), { apiKey: "" }), expectCode("ASR_NOT_CONFIGURED", 503));
});

test("WAV magic, declared chunk lengths, PCM format, sample rate, channel count and duration are verified before upload", async () => {
  assert.equal(inspectVoiceWav(wav(60)).durationSeconds, 60);
  let calls = 0;
  const badFormat = wav(); badFormat.writeUInt16LE(3, 20);
  const stereo = wav(); stereo.writeUInt16LE(2, 22);
  const wrongRate = wav(); wrongRate.writeUInt32LE(48000, 24);
  const fakeSize = wav(); fakeSize.writeUInt32LE(9999999, 40);
  const fakeRiff = wav(); fakeRiff.writeUInt32LE(1, 4);
  for (const input of [Buffer.from("not audio"), badFormat, stereo, wrongRate, fakeSize, fakeRiff, wav(0), wav().subarray(0, 43)]) {
    await assert.rejects(transcribeVoice(input, { apiKey: key, fetch: async () => { calls++; return json(result()); } }), expectCode("INVALID_VOICE_AUDIO", 415));
  }
  await assert.rejects(transcribeVoice(wav(60.001), { apiKey: key }), expectCode("VOICE_AUDIO_DURATION", 413));
  await assert.rejects(transcribeVoice(Buffer.alloc(MAX_AUDIO_BYTES + 1), { apiKey: key }), expectCode("VOICE_AUDIO_SIZE", 413));
  assert.equal(calls, 0);
});

test("authentication, throttling, provider configuration and network errors are safe categories only", async () => {
  for (const [status, code] of [[401, "ASR_AUTH_REQUIRED"], [403, "ASR_AUTH_REQUIRED"], [429, "ASR_RATE_LIMITED"], [404, "ASR_MODEL_UNAVAILABLE"], [500, "ASR_UNAVAILABLE"]] as const) {
    await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => json({ message: `${key} data:audio/wav;base64,private` }, status) }), error => {
      assert.ok(error instanceof AsrError); assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /test-only|base64|private/);
      return true;
    });
  }
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => { throw new Error(`${key} with private audio`); } }), error => {
    assert.ok(error instanceof AsrError); assert.equal(error.code, "ASR_UNAVAILABLE");
    assert.equal(error.cause, undefined); assert.doesNotMatch(error.message, /test-only|private/); return true;
  });
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => json({ code: "InvalidApiKey", message: key }) }), expectCode("ASR_AUTH_REQUIRED"));
});

test("malformed, truncated and empty ASR outputs cannot become supplemental information", async () => {
  for (const value of [null, {}, { output: {} }, { output: { choices: [{ finish_reason: "length", message: { content: [{ text: "partial" }] } }] } }, { output: { choices: [{ finish_reason: "stop", message: { content: [{ text: 123 }] } }] } }, result("a".repeat(20001))]) {
    await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => json(value) }), expectCode("ASR_INVALID_RESPONSE", 502));
  }
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => new Response("not json") }), expectCode("ASR_INVALID_RESPONSE", 502));
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => new Response("a".repeat(128 * 1024 + 1)) }), expectCode("ASR_INVALID_RESPONSE", 502));
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, fetch: async () => json(result(" \n ")) }), expectCode("ASR_NO_SPEECH", 422));
  await assert.rejects(transcribeVoice(wav(), { apiKey: key, model: "qwen-audio-3.1-asr-flash", fetch: async () => json({ output: { text: "" } }) }), expectCode("ASR_NO_SPEECH", 422));
});

test("timeout and caller cancellation abort the upstream request without leaking the fetch error", async () => {
  const waitForAbort: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    const abort = () => reject(new Error(`${key} private request`));
    if (init?.signal?.aborted) abort(); else init?.signal?.addEventListener("abort", abort, { once: true });
  });
  // Keep the event loop alive: AbortSignal.timeout intentionally uses an unref timer.
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(transcribeVoice(wav(), { apiKey: key, timeoutMs: 5, fetch: waitForAbort }), expectCode("ASR_TIMEOUT", 504));
    const controller = new AbortController();
    const pending = transcribeVoice(wav(), { apiKey: key, signal: controller.signal, fetch: waitForAbort });
    controller.abort();
    await assert.rejects(pending, expectCode("ASR_CANCELLED", 499));
  } finally { clearInterval(keepAlive); }
});

test("ASR route accepts one multipart recording, rejects foreign origins and malformed upload shapes", async t => {
  let calls = 0;
  const app = express(); app.use("/api/audio", createAsrRouter({ apiKey: key, fetch: async () => { calls++; return json(result()); } }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const url = `${origin}/api/audio/transcriptions`;
  const upload = (name = "file", extra = false) => {
    const form = new FormData(); form.set(name, new Blob([wav()], { type: "audio/wav" }), "voice.wav");
    if (extra) form.set("duration", "1");
    return form;
  };
  const good = await fetch(url, { method: "POST", headers: { Origin: origin }, body: upload() });
  assert.equal(good.status, 200); assert.equal(good.headers.get("cache-control"), "no-store");
  assert.equal((await good.json()).text, "我會到日本滑雪。");
  assert.equal((await fetch(url, { method: "POST", headers: { Origin: "https://foreign.example" }, body: upload() })).status, 403);
  assert.equal((await fetch(url, { method: "POST", body: upload("other") })).status, 400);
  assert.equal((await fetch(url, { method: "POST", body: upload("file", true) })).status, 400);
  assert.equal((await fetch(url, { method: "POST" })).status, 400);
  const large = new FormData(); large.set("file", new Blob([Buffer.alloc(MAX_AUDIO_BYTES + 1)]), "large.wav");
  assert.equal((await fetch(url, { method: "POST", body: large })).status, 413);
  assert.equal(calls, 1);
});

test("closing the browser request cancels the upstream ASR fetch", async t => {
  let begin!: () => void, aborted!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const cancelled = new Promise<void>(resolve => { aborted = resolve; });
  const app = express(); app.use("/api/audio", createAsrRouter({ apiKey: key, fetch: async (_url, init) => {
    begin();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => { aborted(); reject(new Error("cancelled")); }, { once: true }));
  } }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const form = new FormData(); form.set("file", new Blob([wav()], { type: "audio/wav" }), "voice.wav");
  const controller = new AbortController();
  const request = fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/audio/transcriptions`, { method: "POST", body: form, signal: controller.signal }).catch(() => {});
  await started; controller.abort();
  await Promise.race([cancelled, new Promise<void>((_resolve, reject) => { const timer = setTimeout(() => reject(new Error("ASR fetch was not aborted")), 1000); timer.unref(); })]);
  await request;
});
