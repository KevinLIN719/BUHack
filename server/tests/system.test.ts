import test from "node:test";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { classifyFailure, parseLanguage } from "../agent.js";
import { createApp } from "../app.js";
import { Store, type Run } from "../store.js";

async function start(path = ":memory:") {
  const store = new Store(path);
  const app = createApp(store);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    store,
    request: (pathname: string, init?: RequestInit) => fetch(base + pathname, init),
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      await app.locals.close();
      store.close();
    },
  };
}

async function createReview(api: Awaited<ReturnType<typeof start>>) {
  const created = await api.request("/api/reviews", { method: "POST" });
  const cookie = created.headers.get("set-cookie")!.split(";")[0];
  const review = await created.json() as {id: string};
  return {cookie, reviewId: review.id};
}

function insertRun(api: Awaited<ReturnType<typeof start>>, reviewId: string, status: Run["status"]) {
  const runId = randomUUID();
  const now = new Date().toISOString();
  api.store.db.prepare(`INSERT INTO runs (id, reviewId, inputRevision, kind, goal, status,
      idempotencyKey, requestHash, parentRunId, createdAt, updatedAt)
    VALUES (?, ?, 1, 'investigate', '測試問題', ?, NULL, 'hash', NULL, ?, ?)`)
    .run(runId, reviewId, status, now, now);
  return runId;
}

// Reads SSE chunks until the buffer contains `needle`; the run events are written by the test
// itself, so a live push and a replay are the only two ways the text can arrive.
async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, state: {text: string},
  decoder: TextDecoder, needle: string, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const {value, done} = await reader.read();
    if (done) return state.text;
    state.text += decoder.decode(value, {stream: true});
    if (state.text.includes(needle)) return state.text;
  }
  throw new Error(`timed out waiting for ${needle}`);
}

test("the event stream pushes new events and closes on a terminal status", async () => {
  const api = await start();
  try {
    const {cookie, reviewId} = await createReview(api);
    const runId = insertRun(api, reviewId, "running");
    const response = await api.request(`/api/reviews/${reviewId}/runs/${runId}/events`,
      {headers: {Cookie: cookie}});
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const state = {text: ""};

    // The response only resolves once the subscription is installed, so an event added now is a
    // live push rather than a replay.
    api.store.addEvent(runId, "tool.started", {name: "searchSources"});
    await readUntil(reader, state, decoder, "tool.started");
    assert.match(state.text, /event: tool\.started/);

    const terminal = readUntil(reader, state, decoder, "run.status");
    api.store.addEvent(runId, "run.status", {status: "partial", reason: "semantic_review_pending"});
    await terminal;
    assert.match(state.text, /"status":"partial"/);

    // The stream ends by itself once the run is terminal; the client does not have to guess.
    const ended = await reader.read();
    assert.equal(ended.done, true);
  } finally { await api.close(); }
});

test("a client that reconnects only receives the events it has not seen", async () => {
  const api = await start();
  try {
    const {cookie, reviewId} = await createReview(api);
    const runId = insertRun(api, reviewId, "running");
    api.store.addEvent(runId, "run.status", {status: "running"});
    api.store.addEvent(runId, "tool.started", {name: "readSource"});
    api.store.addEvent(runId, "run.status", {status: "partial", reason: "semantic_review_pending"});
    const first = api.store.events({id: runId} as Run, 0);
    const cursor = first[0].eventId;

    const response = await api.request(`/api/reviews/${reviewId}/runs/${runId}/events?after=${cursor}`,
      {headers: {Cookie: cookie}});
    const body = await response.text();
    assert.equal(body.includes("event: run.status\ndata: {\"eventId\":" + cursor), false);
    assert.match(body, /event: tool\.started/);
    assert.match(body, /event: run\.status/);
  } finally { await api.close(); }
});

test("a run that was executing when the process stopped is marked interrupted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-system-"));
  const path = join(dir, "state.sqlite");
  let runId = "";
  let reviewId = "";
  const first = await start(path);
  try {
    const created = await createReview(first);
    reviewId = created.reviewId;
    runId = insertRun(first, reviewId, "running");
  } finally { await first.close(); }

  // A fresh process: the model call is gone, so the run cannot stay "running" forever.
  const store = new Store(path);
  const app = createApp(store);
  try {
    const run = store.getRun(runId, reviewId)!;
    assert.equal(run.status, "interrupted");
    const event = store.lastEvent(runId, "run.status");
    assert.deepEqual(event?.data, {status: "interrupted", reason: "server_restarted"});
  } finally {
    await app.locals.close();
    store.close();
    await rm(dir, {recursive: true, force: true, maxRetries: 10, retryDelay: 50});
  }
});

test("failures are classified into reasons the client can explain", () => {
  const budget = new Error("model used all 14 steps without a final answer");
  budget.name = "BudgetExhaustedError";
  const schema = new Error("No object generated: response did not match schema");
  schema.name = "AI_NoObjectGeneratedError";
  const rateLimited = new Error("429 Too Many Requests: rate limit reached");
  const offline = new Error("fetch failed");

  assert.equal(classifyFailure(budget, false), "budget_exhausted");
  assert.equal(classifyFailure(schema, false), "model_output_invalid");
  assert.equal(classifyFailure(rateLimited, false), "rate_limited");
  assert.equal(classifyFailure(offline, false), "model_unreachable");
  assert.equal(classifyFailure(new Error("boom"), false), "model_failed");
  // An abort means the 120s budget ran out (or the user cancelled), not a model defect.
  assert.equal(classifyFailure(new Error("aborted"), true), "timeout");
});

test("the answer language follows the browser and defaults to Traditional Chinese", () => {
  // The page ships in zh-Hant-HK, so a request without a language header must not produce
  // Simplified Chinese text.
  assert.equal(parseLanguage(undefined), "zh-HK");
  assert.equal(parseLanguage(""), "zh-HK");
  assert.equal(parseLanguage("zh-Hant-HK,zh;q=0.9"), "zh-HK");
  assert.equal(parseLanguage("zh-CN,zh;q=0.9,en;q=0.8"), "zh-CN");
  assert.equal(parseLanguage("zh-Hans-SG"), "zh-CN");
  assert.equal(parseLanguage("en-GB,en;q=0.9"), "en");
  // An unknown tag is not treated as English or as Simplified: it falls back to the site default.
  assert.equal(parseLanguage("ja-JP"), "zh-HK");
});
