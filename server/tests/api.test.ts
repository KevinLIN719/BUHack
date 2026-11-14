import test from "node:test";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { Store } from "../store.js";
import { pdfFixture } from "./pdf-fixture.js";
import { semanticReview, sourceTools, validateAnswer, type Snapshot } from "../agent.js";
import { randomUUID } from "node:crypto";

test("successor report exposes exact changes and scoped persistent history without rewriting old output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-history-"));
  const dbPath = join(dir, "test.sqlite");
  let api = await start(dbPath);
  try {
    const response = await api.request("/api/reviews",{method:"POST"});
    const headers = {Cookie:response.headers.get("set-cookie")!.split(";")[0]};
    const review = await response.json(), path = `/api/reviews/${review.id}`;
    const oldId = randomUUID(), nextId = randomUUID();
    const same = {explanation:"此条仍成立",evidenceStatus:"unknown",sourceIds:[]};
    const oldReport = {findings:[same,{explanation:"缺少附表",evidenceStatus:"unknown",sourceIds:[]}],requests:[{message:"补充附表",requestedRole:"schedule"}],openQuestions:["运动范围？"]};
    const nextReport = {findings:[same,{explanation:"附表有新的限制",evidenceStatus:"unknown",sourceIds:[]}],requests:[],openQuestions:["越野滑雪？"]};
    const now = new Date().toISOString();
    for (const [id, revision, parent, output, snapshot] of [
      [oldId,1,null,oldReport,{context:{},documents:[]}],
      [nextId,3,oldId,nextReport,{context:{destination:"日本"},documents:[{id:"schedule-1",name:"附表.pdf",role:"schedule"}]}],
    ] as const) {
      api.store.db.prepare(`INSERT INTO runs (id,reviewId,inputRevision,kind,goal,status,requestHash,parentRunId,createdAt,updatedAt)
        VALUES (?,?,?,'investigate','检查滑雪','partial','test',?,?,?)`).run(id,review.id,revision,parent,now,now);
      api.store.db.prepare("INSERT INTO investigations (runId,snapshot,output) VALUES (?,?,?)").run(id,JSON.stringify(snapshot),JSON.stringify(output));
    }
    const stranger = await api.request("/api/reviews",{method:"POST"});
    const otherHeaders = {Cookie:stranger.headers.get("set-cookie")!.split(";")[0]};
    assert.equal((await api.request(`${path}/reports/${oldId}`,{headers:otherHeaders})).status,404);
    assert.equal((await api.request(`${path}/runs/${nextId}/activity`,{headers:otherHeaders})).status,404);
    await api.close(); api = await start(dbPath);
    const view = await (await api.request(path,{headers})).json();
    assert.equal(view.reportHistory.length,2);
    const changes = view.currentReport.changes;
    assert.equal(changes.unchanged,1);
    assert.equal(changes.added[0].explanation,"附表有新的限制");
    assert.equal(changes.notRepeated[0].explanation,"缺少附表");
    assert.equal(changes.previousRequestsNotRepeated[0].message,"补充附表");
    assert.equal(changes.newDocuments[0].name,"附表.pdf");
    assert.deepEqual(changes.changedContextFields,["destination"]);
    const old = await (await api.request(`${path}/reports/${oldId}`,{headers})).json();
    assert.equal(old.findings[1].explanation,"缺少附表");
    assert.equal(old.changes,null);
    const exportedOld = await (await api.request(`${path}/questions/export?format=md&reportId=${oldId}`,{headers})).text();
    assert.match(exportedOld,/缺少附表/);
    assert.doesNotMatch(exportedOld,/附表有新的限制/);
    assert.equal((await api.request(`${path}/questions/export?format=md&reportId=${oldId}`,{headers:otherHeaders})).status,404);
    assert.equal((await api.request(`${path}/reports/${randomUUID()}`,{headers})).status,404);
  } finally {await api.close();await rm(dir,{recursive:true,force:true});}
});

async function start(path = ":memory:") {
  const store = new Store(path);
  const app = createApp(store);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    store,
    request: (path: string, init?: RequestInit) => fetch(base + path, init),
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

test("review lifecycle, version checks, isolation, idempotency and event replay", async () => {
  const api = await start();
  try {
    const health = await api.request("/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const created = await api.request("/api/reviews", { method: "POST" });
    assert.equal(created.status, 201);
    const setCookie = created.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0];
    const review = await created.json();
    assert.deepEqual(review.context, {});
    assert.equal(review.owner, undefined);
    const path = `/api/reviews/${review.id}`;
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    assert.equal((await api.request(path)).status, 404);
    const stranger = await api.request("/api/reviews", { method: "POST" });
    const strangerCookie = stranger.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await api.request(path, { headers: { Cookie: strangerCookie } })).status, 404);

    const updated = await api.request(`${path}/context`, {
      method: "PATCH", headers,
      body: JSON.stringify({ expectedRevision: 1, context: { destination: "Japan", activities: ["skiing"] } }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).revision, 2);
    const stale = await api.request(`${path}/context`, {
      method: "PATCH", headers,
      body: JSON.stringify({ expectedRevision: 1, context: { destination: "Italy" } }),
    });
    assert.equal(stale.status, 409);

    const body = { expectedRevision: 2, kind: "investigate", goal: "检查滑雪活动条款" };
    const runHeaders = { ...headers, "Idempotency-Key": "investigate-test-01" };
    const runResponse = await api.request(`${path}/runs`, { method: "POST", headers: runHeaders, body: JSON.stringify(body) });
    assert.equal(runResponse.status, 202);
    const run = await runResponse.json();
    assert.equal(run.status, "awaiting_input");
    assert.equal(run.stopReason, "missing_documents");
    assert.equal(run.inputRequests.length, 1);
    assert.equal(run.inputRevision, 2);
    assert.equal(run.requestHash, undefined);
    const runPath = `${path}/runs/${run.id}`;
    assert.equal((await api.request(runPath, { headers: { Cookie: strangerCookie } })).status, 404);
    const replay = await api.request(`${path}/runs`, { method: "POST", headers: runHeaders, body: JSON.stringify(body) });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).id, run.id);
    const conflict = await api.request(`${path}/runs`, { method: "POST", headers: runHeaders, body: JSON.stringify({ ...body, goal: "另外的问题" }) });
    assert.equal(conflict.status, 409);

    const eventsResponse = await api.request(`${runPath}/events`, { headers });
    assert.match(eventsResponse.headers.get("content-type")!, /text\/event-stream/);
    const events = await eventsResponse.text();
    assert.match(events, /event: input.required/);
    const eventIds = [...events.matchAll(/^id: (\d+)$/gm)].map(match => Number(match[1]));
    assert.equal(eventIds.length, 2);
    const afterResponse = await api.request(`${runPath}/events?after=${eventIds[0]}`, { headers });
    const after = await afterResponse.text();
    assert.doesNotMatch(after, /event: run.status/);
    assert.match(after, /event: input.required/);
    assert.equal((await api.request(`${runPath}/events?after=NaN`, { headers })).status, 400);

    const cancel = await api.request(`${runPath}/cancel`, { method: "POST", headers });
    assert.equal((await cancel.json()).status, "cancelled");
    await api.request(`${runPath}/cancel`, { method: "POST", headers });
    const cancelledEvents = await (await api.request(`${runPath}/events?after=${eventIds[1]}`, { headers })).text();
    assert.equal([...cancelledEvents.matchAll(/^id:/gm)].length, 1);

    const removed = await api.request(path, { method: "DELETE", headers });
    assert.equal(removed.status, 204);
    assert.equal((await api.request(runPath, { headers })).status, 404);
    assert.equal(api.store.db.prepare("SELECT COUNT(*) AS count FROM runs").get()!.count, 0);
    assert.equal(api.store.db.prepare("SELECT COUNT(*) AS count FROM run_events").get()!.count, 0);
  } finally { await api.close(); }
});

test("invalid requests return safe structured errors", async () => {
  const api = await start();
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const review = await created.json();
    const path = `/api/reviews/${review.id}/runs`;
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const invalid = await api.request(path, { method: "POST", headers, body: JSON.stringify({ expectedRevision: 1, kind: "investigate", goal: "  " }) });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_INPUT");
    const malformed = await api.request(path, { method: "POST", headers, body: "{" });
    assert.equal((await malformed.json()).error.code, "INVALID_JSON");
    const crossOrigin = await api.request("/api/reviews", { method: "POST", headers: { Origin: "https://unrelated.example" } });
    assert.equal(crossOrigin.status, 403);
    const oversized = await api.request(path, { method: "POST", headers, body: JSON.stringify({ text: "x".repeat(1024 * 1024) }) });
    assert.equal(oversized.status, 413);
  } finally { await api.close(); }
});

test("reviews, input snapshots and events survive closing and reopening SQLite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-api-"));
  const dbPath = join(dir, "test.sqlite");
  let api = await start(dbPath);
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const review = await created.json();
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const path = `/api/reviews/${review.id}`;
    const run = await (await api.request(`${path}/runs`, {
      method: "POST", headers, body: JSON.stringify({ expectedRevision: 1, kind: "investigate", goal: "检查保障边界" }),
    })).json();
    await api.close();
    api = await start(dbPath);
    const restored = await (await api.request(path, { headers })).json();
    assert.equal(restored.id, review.id);
    assert.equal(restored.runs[0].id, run.id);
    assert.equal(restored.runs[0].inputRevision, 1);
    assert.match(await (await api.request(`${path}/runs/${run.id}/events`, { headers })).text(), /input.required/);
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
});

async function uploadPdf(api: Awaited<ReturnType<typeof start>>, path: string, cookie: string, bytes: Uint8Array, role = "contract", name = "policy.pdf") {
  const form = new FormData();
  form.set("role", role);
  form.set("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), name);
  return api.request(`${path}/documents`, { method: "POST", headers: { Cookie: cookie }, body: form });
}

async function waitForDocument(api: Awaited<ReturnType<typeof start>>, path: string, cookie: string) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const response = await api.request(path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const document = await response.json();
    if (!["queued", "parsing"].includes(document.status)) return document;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Document did not finish parsing");
}

async function waitForRun(api: Awaited<ReturnType<typeof start>>, path: string, runId: string, cookie: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await api.request(`${path}/runs/${runId}`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const run = await response.json();
    if (!["queued", "running"].includes(run.status)) return run;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Run did not finish");
}

test("PDF upload preserves bytes, page citations, isolation, version and duplicate semantics", async () => {
  const api = await start();
  try {
    const response = await api.request("/api/reviews", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const review = await response.json();
    const path = `/api/reviews/${review.id}`;
    const headers = { Cookie: cookie };
    const bytes = pdfFixture(["Delay exceeding 6 hours. Limit 1000.", "Carrier proof is required."]);
    const upload = await uploadPdf(api, path, cookie, bytes, "contract", "旅行保险合同.pdf");
    assert.equal(upload.status, 202);
    const queued = await upload.json();
    assert.equal(queued.name, "旅行保险合同.pdf");
    assert.equal(queued.status, "queued");
    assert.equal(queued.content, undefined);
    const docPath = `${path}/documents/${queued.id}`;
    const document = await waitForDocument(api, docPath, cookie);
    assert.equal(document.status, "ready");
    assert.equal(document.pageCount, 2);
    assert.deepEqual(document.pages.map((page: {pageIndex: number}) => page.pageIndex), [1, 2]);
    const restored = await (await api.request(path, { headers })).json();
    assert.equal(restored.revision, 2);
    assert.equal(restored.documents.length, 1);
    const page = await (await api.request(`${docPath}/pages/2`, { headers })).json();
    assert.equal(page.text, "Carrier proof is required.");
    assert.equal(page.sources.length, 1);
    const sourceUrl = `${path}/sources/${page.sources[0].sourceId}`;
    const source = await (await api.request(sourceUrl, { headers })).json();
    assert.equal(source.pageIndex, 2);
    assert.equal(source.documentVersion, document.sha256);
    assert.equal(source.quote, page.text);
    assert.equal(source.quoteCheck, "matched");
    assert.match(source.contentUrl, /#page=2$/);
    const content = await api.request(`${docPath}/content`, { headers });
    assert.equal(content.headers.get("content-type"), "application/pdf");
    assert.deepEqual(Buffer.from(await content.arrayBuffer()), bytes);
    for (const url of [docPath, `${docPath}/content`, `${docPath}/pages/2`, sourceUrl]) {
      assert.equal((await api.request(url)).status, 404);
    }
    assert.equal((await api.request(`${docPath}/pages/0`, { headers })).status, 400);
    assert.equal((await api.request(`${docPath}/pages/3`, { headers })).status, 404);
    const duplicate = await uploadPdf(api, path, cookie, bytes);
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).id, document.id);
    assert.equal((await (await api.request(path, { headers })).json()).revision, 2);
    // Files are available, but there is still no model runner. Never claim a report.
    const run = await api.request(`${path}/runs`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: 2, kind: "investigate", goal: "检查条款" }) });
    assert.equal(run.status, 503);
    assert.equal((await run.json()).error.code, "AGENT_NOT_CONNECTED");
    const removed = await api.request(docPath, { method: "DELETE", headers });
    assert.equal(removed.status, 204);
    assert.equal((await api.request(sourceUrl, { headers })).status, 404);
    assert.equal((await (await api.request(path, { headers })).json()).revision, 3);
    assert.equal(api.store.db.prepare("SELECT COUNT(*) AS count FROM sources").get()!.count, 0);
  } finally { await api.close(); }
});

test("textless, mixed, corrupt and over-page-limit PDFs are distinguished", async () => {
  const api = await start();
  try {
    const response = await api.request("/api/reviews", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await response.json()).id}`;
    const cases = [
      { bytes: pdfFixture([""]), status: "needs_ocr", code: null },
      { bytes: pdfFixture(["Coverage limit 1000.", ""]), status: "partial", code: null },
      { bytes: Buffer.from("%PDF-1.4\nbroken\n%%EOF"), status: "failed", code: "INVALID_PDF" },
      { bytes: pdfFixture(Array.from({ length: 121 }, () => "Text")), status: "failed", code: "PAGE_LIMIT" },
    ];
    for (const item of cases) {
      const upload = await uploadPdf(api, path, cookie, item.bytes);
      assert.equal(upload.status, 202);
      const doc = await upload.json();
      const result = await waitForDocument(api, `${path}/documents/${doc.id}`, cookie);
      assert.equal(result.status, item.status);
      assert.equal(result.errorCode, item.code);
      if (item.status === "needs_ocr") {
        const page = await (await api.request(`${path}/documents/${doc.id}/pages/1`, { headers: { Cookie: cookie } })).json();
        assert.deepEqual(page.sources, []);
      }
    }
  } finally { await api.close(); }
});

test("upload validation rejects fake PDFs, invalid roles, large files and unauthorised uploads", async () => {
  const api = await start();
  try {
    const response = await api.request("/api/reviews", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await response.json()).id}`;
    assert.equal((await uploadPdf(api, path, cookie, Buffer.from("not a pdf"))).status, 415);
    assert.equal((await uploadPdf(api, path, cookie, pdfFixture(["Text"]), "wrong")).status, 400);
    assert.equal((await uploadPdf(api, path, "", pdfFixture(["Text"]))).status, 404);
    const large = new Uint8Array(10 * 1024 * 1024 + 1);
    large.set(Buffer.from("%PDF-"));
    const oversized = await uploadPdf(api, path, cookie, large);
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "FILE_TOO_LARGE");
    const restored = await (await api.request(path, { headers: { Cookie: cookie } })).json();
    assert.equal(restored.documents.length, 0);
    assert.equal(restored.revision, 1);
  } finally { await api.close(); }
});

test("queued uploads resume after restart and deleting a review removes private material", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-docs-"));
  const dbPath = join(dir, "test.sqlite");
  let api = await start(dbPath);
  try {
    const response = await api.request("/api/reviews", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await response.json()).id}`;
    const doc = await (await uploadPdf(api, path, cookie, pdfFixture(["Persisted contract."]))).json();
    await api.close();
    api = await start(dbPath);
    assert.equal((await waitForDocument(api, `${path}/documents/${doc.id}`, cookie)).status, "ready");
    // A second parse may still be active when the review is deleted.
    await uploadPdf(api, path, cookie, pdfFixture(["Supplementary terms."]), "schedule");
    const removed = await api.request(path, { method: "DELETE", headers: { Cookie: cookie } });
    assert.equal(removed.status, 204);
    assert.equal(api.store.db.prepare("SELECT COUNT(*) AS count FROM documents").get()!.count, 0);
    assert.equal(api.store.db.prepare("SELECT COUNT(*) AS count FROM pages").get()!.count, 0);
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("agent tools scope evidence and reject unobserved or invented citations", async () => {
  const snapshot: Snapshot = { context: {}, documents: [], sources: [
    {sourceId:"a:p1:b1", documentId:"a", pageIndex:1, quote:"航班延误超过6小时", role:"contract"},
    {sourceId:"a:p2:b1", documentId:"a", pageIndex:2, quote:"需要承运人证明", role:"contract"},
  ]};
  const actions: string[] = [];
  const scoped = sourceTools(snapshot, name => actions.push(name), () => {});
  const options = {toolCallId:"test", messages:[], context:{}};
  const found = await scoped.tools.searchSources.execute!({query:"延误"}, options);
  assert.equal(Array.isArray(found) && found[0].sourceId, "a:p1:b1");
  const candidate = {findings:[{explanation:"需延误超过6小时",evidenceStatus:"interpretation",sourceIds:["a:p1:b1"]}],openQuestions:[],requests:[]};
  assert.equal(validateAnswer(candidate, snapshot, scoped.seen).sources.length, 1);
  assert.throws(() => validateAnswer({...candidate, findings:[{...candidate.findings[0], sourceIds:["a:p2:b1"]}]}, snapshot, scoped.seen), /INVALID_CITATION/);
  await scoped.tools.readSource.execute!({sourceId:"a:p1:b1"}, options);
  assert.ok(scoped.seen.has("a:p2:b1"));
  assert.throws(() => validateAnswer({...candidate, findings:[{...candidate.findings[0], sourceIds:["other-review"]}]}, snapshot, scoped.seen), /INVALID_CITATION/);
  assert.throws(() => validateAnswer({...candidate, findings:[{...candidate.findings[0], sourceIds:[]}]}, snapshot, scoped.seen), /MISSING_CITATION/);
  assert.deepEqual(actions, ["searchSources", "readSource"]);
});


test("model adapter drives a real tool loop against a local mock endpoint", async () => {
  const api = await start();
  let sourceId = "", calls = 0;
  const model = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    calls++;
    const name = calls === 1 ? "searchSources" : calls === 2 ? "readSource" : "testBoundary";
    const isReview = body.includes("核对每条结论");
    const message = isReview ? {role:"assistant",content:JSON.stringify({items:[{index:0,verdict:"supported",note:"原文直接陈述6小时延误条件"}]})}
      : calls <= 3 ? {role:"assistant",content:null,tool_calls:[{
      id:`call_${calls}`,type:"function",function:{name,arguments:JSON.stringify(calls === 1 ? {query:"Delay"} : calls === 2 ? {sourceId} : {sourceId, thresholdQuote:"Delay exceeding 6 hours.",question:"恰好六小时是否够？",rationale:"测试严格门槛"})}
    }]} : {role:"assistant",content:JSON.stringify({findings:[{
      explanation:"条款使用超过6小时的条件，仍需核对适用定义。",evidenceStatus:"interpretation",sourceIds:[sourceId]
    }],openQuestions:["起算点需进一步确认"],requests:[]})};
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({id:`mock_${calls}`,object:"chat.completion",created:1,model:request.model,
      choices:[{index:0,message,finish_reason:calls <= 3 ? "tool_calls" : "stop"}],
      usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}}));
  }).listen(0,"127.0.0.1");
  await once(model,"listening");
  const previous = { key:process.env.DEEPSEEK_API_KEY, base:process.env.DEEPSEEK_BASE_URL };
  process.env.DEEPSEEK_API_KEY = "local-mock-only";
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(model.address() as AddressInfo).port}`;
  try {
    const created = await api.request("/api/reviews", {method:"POST"});
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await created.json()).id}`;
    const uploaded = await (await uploadPdf(api,path,cookie,pdfFixture(["Delay exceeding 6 hours."]))).json();
    await waitForDocument(api,`${path}/documents/${uploaded.id}`,cookie);
    const headers = {Cookie:cookie,"Content-Type":"application/json"};
    const page = await (await api.request(`${path}/documents/${uploaded.id}/pages/1`,{headers})).json();
    sourceId = page.sources[0].sourceId;
    const started = await api.request(`${path}/runs`,{method:"POST",headers,body:JSON.stringify({expectedRevision:2,kind:"investigate",goal:"解释航班延误条件"})});
    assert.equal(started.status,202);
    const run = await started.json();
    let finished;
    const deadline = Date.now()+10000;
    do {
      finished = await (await api.request(`${path}/runs/${run.id}`,{headers})).json();
      if (!["queued","running"].includes(finished.status)) break;
      await new Promise(resolve=>setTimeout(resolve,25));
    } while (Date.now()<deadline);
    assert.equal(finished.status,"partial");
    assert.equal(finished.report.sources[0].sourceId,sourceId);
    assert.equal(finished.report.review.status,"checked");
    assert.equal(finished.report.review.items[0].verdict,"supported");
    assert.equal(calls,5);
    assert.deepEqual(finished.report.boundaryExperiments[0].cases.map((item: {status: string}) => item.status), ["not_satisfied","boundary","satisfied"]);
    const displayed = await (await api.request(`${path}/reports/${run.id}`,{headers})).json();
    assert.equal(displayed.boundaryExperiments[0].citations[0].sourceId,sourceId);
    const activity = await (await api.request(`${path}/runs/${run.id}/activity`,{headers})).json();
    assert.ok(activity.events.some((event: {data:{name?:string}}) => event.data.name === "testBoundary"));
  } finally {
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY=previous.key;
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL=previous.base;
    await api.close();
    await new Promise<void>(resolve=>{model.close(()=>resolve());model.closeAllConnections();});
  }
});

test("successor run continues a prior report only when new input arrived", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-resume-"));
  const dbPath = join(dir, "test.sqlite");
  const prompts: string[] = [];
  const model = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    prompts.push(JSON.stringify(request.messages ?? request));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: `mock_${prompts.length}`, object: "chat.completion", created: 1, model: request.model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({
        findings: [], openQuestions: ["滑雪是否在承保范围"], requests: [{ message: "请补充完整条款", requestedRole: "contract" }],
      }) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
  }).listen(0, "127.0.0.1");
  await once(model, "listening");
  const previous = { key: process.env.DEEPSEEK_API_KEY, base: process.env.DEEPSEEK_BASE_URL };
  process.env.DEEPSEEK_API_KEY = "local-mock-only";
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(model.address() as AddressInfo).port}`;
  let api = await start(dbPath);
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await created.json()).id}`;
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const contract = await (await uploadPdf(api, path, cookie, pdfFixture(["Delay exceeding 6 hours."]))).json();
    await waitForDocument(api, `${path}/documents/${contract.id}`, cookie);
    const first = await (await api.request(`${path}/runs`, { method: "POST", headers, body: JSON.stringify({ expectedRevision: 2, kind: "investigate", goal: "检查滑雪保障" }) })).json();
    const firstDone = await waitForRun(api, path, first.id, cookie);
    assert.equal(firstDone.status, "awaiting_input");
    assert.equal(firstDone.inputRequests[0].message, "请补充完整条款");
    assert.equal(firstDone.parentRunId, null);

    // Without new input the successor is refused instead of repeating the investigation.
    const early = await api.request(`${path}/runs`, { method: "POST", headers, body: JSON.stringify({ expectedRevision: 2, kind: "investigate", goal: "检查滑雪保障", resumeFromRunId: first.id }) });
    assert.equal(early.status, 409);
    assert.equal((await early.json()).error.code, "NO_NEW_INPUT");

    const supplement = await (await uploadPdf(api, path, cookie, pdfFixture(["Winter sports exclusion applies."]), "schedule")).json();
    await waitForDocument(api, `${path}/documents/${supplement.id}`, cookie);
    const resumed = await api.request(`${path}/runs`, { method: "POST", headers, body: JSON.stringify({ expectedRevision: 3, kind: "investigate", goal: "检查滑雪保障", resumeFromRunId: first.id }) });
    assert.equal(resumed.status, 202);
    const second = await resumed.json();
    assert.equal(second.parentRunId, first.id);
    assert.equal((await waitForRun(api, path, second.id, cookie)).status, "awaiting_input");
    // The model receives the previous requests and the list of new documents.
    assert.ok(prompts.some(prompt => prompt.includes("请补充完整条款")));
    assert.ok(prompts.some(prompt => prompt.includes("newDocuments") && prompt.includes(supplement.id)));
    // No Accept-Language was sent, and the page is Traditional Chinese, so the model is told to
    // write 繁體中文 and quotes stay untranslated.
    assert.ok(prompts.some(prompt => prompt.includes("繁體中文（香港用語）")));

    const stale = await api.request(`${path}/runs`, { method: "POST", headers, body: JSON.stringify({ expectedRevision: 2, kind: "investigate", goal: "检查滑雪保障", resumeFromRunId: first.id }) });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "REVISION_CONFLICT");

    const other = await api.request("/api/reviews", { method: "POST" });
    const otherCookie = other.headers.get("set-cookie")!.split(";")[0];
    const otherPath = `/api/reviews/${(await other.json()).id}`;
    const foreign = await api.request(`${otherPath}/runs`, { method: "POST", headers: { Cookie: otherCookie, "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: 1, kind: "investigate", goal: "x", resumeFromRunId: first.id }) });
    assert.equal(foreign.status, 404);

    // Reports, their requests and the parent link survive a restart.
    await api.close();
    api = await start(dbPath);
    const reopened = await (await api.request(`${path}/runs/${first.id}`, { headers })).json();
    assert.equal(reopened.inputRequests[0].message, "请补充完整条款");
    const reopenedSecond = await (await api.request(`${path}/runs/${second.id}`, { headers })).json();
    assert.equal(reopenedSecond.parentRunId, first.id);
  } finally {
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous.key;
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = previous.base;
    await api.close();
    await new Promise<void>(resolve => { model.close(() => resolve()); model.closeAllConnections(); });
    await rm(dir, { recursive: true, force: true });
  }
});

test("review exposes a resolved report and flags citations of deleted material", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-report-"));
  const dbPath = join(dir, "test.sqlite");
  const api = await start(dbPath);
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const review = await created.json();
    const headers = { Cookie: cookie };
    assert.equal((await (await api.request(`/api/reviews/${review.id}`, { headers })).json()).currentReport, null);

    const store = new Store(dbPath);
    const now = new Date().toISOString();
    const docId = "11111111-1111-4111-8111-111111111111";
    const runId = "22222222-2222-4222-8222-222222222222";
    const sourceId = `${docId}:p2:b1`;
    store.db.prepare(`INSERT INTO documents (id, reviewId, role, name, sha256, byteSize, content, status, pageCount, createdAt)
      VALUES (?, ?, 'contract', 'policy.pdf', ?, 1, ?, 'ready', 3, ?)`)
      .run(docId, review.id, "a".repeat(64), new Uint8Array([0x25, 0x50, 0x44, 0x46]), now);
    store.db.prepare("INSERT INTO pages (documentId, pageIndex, printedPageLabel, text, status) VALUES (?, 2, 'Page 2', 'Exclusion applies.', 'complete')").run(docId);
    store.db.prepare("INSERT INTO sources (id, documentId, pageIndex, blockId, quote) VALUES (?, ?, 2, 'b1', 'Exclusion applies.')").run(sourceId, docId);
    const report = JSON.stringify({
      findings: [{ explanation: "Exclusion applies.", evidenceStatus: "document_supported", sourceIds: [sourceId] }],
      openQuestions: ["滑雪是否属于除外范围？"],
      requests: [{ message: "请补充完整条款", requestedRole: "contract" }],
      sources: [{ sourceId, documentId: docId, pageIndex: 2, quote: "Exclusion applies.", role: "contract" }],
      coverage: [{ id: docId, status: "ready", pageCount: 3 }],
      verification: "source_ids_checked_semantics_not_independently_verified",
    });
    store.db.prepare(`INSERT INTO runs (id, reviewId, inputRevision, kind, goal, status, requestHash, createdAt, updatedAt)
      VALUES (?, ?, 1, 'investigate', '检查除外责任', 'awaiting_input', 'h', ?, ?)`).run(runId, review.id, now, now);
    store.db.prepare("INSERT INTO investigations (runId, snapshot, output) VALUES (?, ?, ?)")
      .run(runId, JSON.stringify({context: {}, documents: [], sources: []}), report);
    store.close();

    const view = (await (await api.request(`/api/reviews/${review.id}`, { headers })).json()).currentReport;
    assert.equal(view.runId, runId);
    assert.equal(view.findings[0].citations[0].status, "verified");
    assert.equal(view.findings[0].citations[0].pageIndex, 2);
    assert.equal(view.findings[0].citations[0].pageLabel, "Page 2");
    assert.equal(view.findings[0].citations[0].documentName, "policy.pdf");
    assert.deepEqual(view.citationIntegrity, { cited: 1, verified: 1, missing: 0 });
    assert.equal(view.requests[0].message, "请补充完整条款");
    assert.equal(view.openQuestions[0], "滑雪是否属于除外范围？");

    // Deleting the material must not rewrite history: the citation becomes visibly missing.
    const cleanup = new Store(dbPath);
    cleanup.db.prepare("DELETE FROM sources WHERE id = ?").run(sourceId);
    cleanup.close();
    const after = (await (await api.request(`/api/reviews/${review.id}`, { headers })).json()).currentReport;
    assert.equal(after.findings[0].citations[0].status, "missing");
    assert.deepEqual(after.citationIntegrity, { cited: 1, verified: 0, missing: 1 });
    assert.equal(after.findings[0].explanation, "Exclusion applies.");
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("semantic review flags conclusions the quotes do not support", async () => {
  const report = { findings: [
      { explanation: "条款规定延误超过 6 小时才触发", evidenceStatus: "document_supported" as const, sourceIds: ["doc:p1:b1"] },
      { explanation: "材料里没有滑雪相关条款", evidenceStatus: "unknown" as const, sourceIds: [] },
    ], openQuestions: [], requests: [],
    sources: [{ sourceId: "doc:p1:b1", documentId: "doc", pageIndex: 1, quote: "Delay exceeding 6 hours.", role: "contract" }] };

  // Only cited, non-unknown conclusions are sent to the reviewer.
  let sent = "";
  const clean = await semanticReview(report, async prompt => {
    sent = prompt;
    return { items: [{ index: 0, verdict: "supported", note: "原文直接陈述" }] };
  });
  assert.equal(clean.status, "checked");
  assert.match(sent, /Delay exceeding 6 hours/);
  assert.doesNotMatch(sent, /滑雪/);

  const flagged = await semanticReview(report, async () => ({ items: [{ index: 0, verdict: "quote_mismatch", note: "原文只说延误，未提 6 小时" }] }));
  assert.equal(flagged.status, "issues_found");
  assert.equal(flagged.items[0].verdict, "quote_mismatch");

  // A broken reviewer must never fail the investigation itself.
  const unavailable = await semanticReview(report, async () => { throw new Error("model down"); });
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.items, []);

  // Nothing cited means nothing to review, and the model is not called at all.
  const none = await semanticReview({ ...report, findings: report.findings.map(finding => ({ ...finding, sourceIds: [] })) },
    async () => { throw new Error("should not be called"); });
  assert.equal(none.status, "not_applicable");
});

test("promotion claims are only compared when both sides can be quoted verbatim", () => {
  const snapshot: Snapshot = { context: {}, documents: [], sources: [
    { sourceId: "c:p1:b1", documentId: "c", pageIndex: 1, quote: "Delay exceeding 6 hours applies to the trip delay benefit.", role: "contract" },
    { sourceId: "m:p1:b1", documentId: "m", pageIndex: 1, quote: "Total trip protection up to 10,000.", role: "promotion" },
  ]};
  const actions: string[] = [];
  const scoped = sourceTools(snapshot, name => actions.push(name), () => {});
  const options = { toolCallId: "compare", messages: [], context: {} };

  const comparison = {
    relation: "supported_with_conditions" as const,
    marketingQuote: "Total trip protection up to 10,000.",
    contractQuote: "Delay exceeding 6 hours",
    explanation: "宣传口径说的是总额，合同只支持 6 小时延误这一条件。",
    marketingSourceIds: ["m:p1:b1"],
    contractSourceIds: ["c:p1:b1"],
  };
  const answer = { findings: [], openQuestions: [], requests: [], comparisons: [comparison] };

  // Nothing can be quoted before the tools actually returned it.
  assert.throws(() => validateAnswer(answer, snapshot, scoped.seen), /COMPARISON_INVALID:marketing_source_0/);
  void scoped.tools.searchSources.execute!({ query: "trip" }, options);
  void scoped.tools.readSource.execute!({ sourceId: "c:p1:b1" }, options);

  const validated = validateAnswer(answer, snapshot, scoped.seen);
  assert.equal(validated.comparisons.length, 1);
  assert.deepEqual(validated.sources.map(source => source.sourceId).sort(), ["c:p1:b1", "m:p1:b1"]);

  // A rewritten promise is refused even when the source id is real.
  assert.throws(() => validateAnswer({ ...answer, comparisons: [{ ...comparison, marketingQuote: "全额赔付所有行程" }] },
    snapshot, scoped.seen), /COMPARISON_INVALID:marketing_quote_0/);
  // The contract side must come from contract material, not from the promotion sheet.
  assert.throws(() => validateAnswer({ ...answer, comparisons: [{ ...comparison, contractSourceIds: ["m:p1:b1"] }] },
    snapshot, scoped.seen), /COMPARISON_INVALID:contract_source_0/);
  // Missing basis is allowed to carry no contract quote.
  const insufficient = validateAnswer({ ...answer, comparisons: [{ ...comparison, relation: "insufficient_basis",
    contractQuote: "", contractSourceIds: [] }] }, snapshot, scoped.seen);
  assert.equal(insufficient.comparisons[0].relation, "insufficient_basis");
});

test("review exposes promotion comparisons with resolved citations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-compare-"));
  const dbPath = join(dir, "test.sqlite");
  const api = await start(dbPath);
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const review = await created.json();
    const headers = { Cookie: cookie };
    const db = api.store.db;
    const now = new Date().toISOString();
    const contractId = "33333333-3333-4333-8333-333333333333";
    const promoId = "44444444-4444-4444-8444-444444444444";
    const runId = "55555555-5555-4555-8555-555555555555";
    const insertDoc = db.prepare(`INSERT INTO documents (id, reviewId, role, name, sha256, byteSize, content, status, pageCount, createdAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, 'ready', 1, ?)`);
    insertDoc.run(contractId, review.id, "contract", "policy.pdf", "b".repeat(64), new Uint8Array([0x25, 0x50, 0x44, 0x46]), now);
    insertDoc.run(promoId, review.id, "promotion", "flyer.pdf", "c".repeat(64), new Uint8Array([0x25, 0x50, 0x44, 0x46]), now);
    const insertPage = db.prepare("INSERT INTO pages (documentId, pageIndex, text, status) VALUES (?, 1, ?, 'complete')");
    insertPage.run(contractId, "Delay exceeding 6 hours.");
    insertPage.run(promoId, "Total trip protection up to 10,000.");
    const insertSource = db.prepare("INSERT INTO sources (id, documentId, pageIndex, blockId, quote) VALUES (?, ?, 1, 'b1', ?)");
    const contractSource = `${contractId}:p1:b1`, promoSource = `${promoId}:p1:b1`;
    insertSource.run(contractSource, contractId, "Delay exceeding 6 hours.");
    insertSource.run(promoSource, promoId, "Total trip protection up to 10,000.");
    const report = JSON.stringify({
      findings: [], openQuestions: ["总额是否包含延误？"], requests: [],
      comparisons: [{ relation: "apparent_conflict", marketingQuote: "Total trip protection up to 10,000.",
        contractQuote: "Delay exceeding 6 hours.", explanation: "宣传说总额，合同只写延误条件。",
        marketingSourceIds: [promoSource], contractSourceIds: [contractSource] }],
      droppedComparisons: 1,
      sources: [], coverage: [], verification: "source_ids_checked_semantics_reviewed",
    });
    db.prepare(`INSERT INTO runs (id, reviewId, inputRevision, kind, goal, status, requestHash, createdAt, updatedAt)
      VALUES (?, ?, 1, 'investigate', '核对宣传口径', 'partial', 'h2', ?, ?)`).run(runId, review.id, now, now);
    db.prepare("INSERT INTO investigations (runId, snapshot, output) VALUES (?, ?, ?)")
      .run(runId, JSON.stringify({ context: {}, documents: [], sources: [] }), report);

    const view = (await (await api.request(`/api/reviews/${review.id}`, { headers })).json()).currentReport;
    assert.equal(view.comparisons.length, 1);
    assert.equal(view.comparisons[0].relation, "apparent_conflict");
    assert.equal(view.comparisons[0].marketing[0].role, "promotion");
    assert.equal(view.comparisons[0].marketing[0].documentName, "flyer.pdf");
    assert.equal(view.comparisons[0].marketing[0].status, "verified");
    assert.equal(view.comparisons[0].contract[0].documentName, "policy.pdf");
    assert.equal(view.droppedComparisons, 1);
  } finally {
    await api.close();
    // Windows can hold the file handle for a moment after the last connection closes.
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

test("an unverifiable comparison is dropped instead of failing the run", async () => {
  const api = await start();
  let calls = 0;
  const model = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    calls++;
    const message = { role: "assistant", content: JSON.stringify({
      findings: [], openQuestions: ["宣传口径来源不明"], requests: [],
      comparisons: [{ relation: "apparent_conflict", marketingQuote: "全额赔付", contractQuote: "Delay exceeding 6 hours.",
        explanation: "宣传与合同不一致。", marketingSourceIds: ["invented:p1:b1"], contractSourceIds: [] }],
    }) };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: `mock_${calls}`, object: "chat.completion", created: 1, model: request.model,
      choices: [{ index: 0, message, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
  }).listen(0, "127.0.0.1");
  await once(model, "listening");
  const previous = { key: process.env.DEEPSEEK_API_KEY, base: process.env.DEEPSEEK_BASE_URL };
  process.env.DEEPSEEK_API_KEY = "local-mock-only";
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(model.address() as AddressInfo).port}`;
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const path = `/api/reviews/${(await created.json()).id}`;
    const uploaded = await (await uploadPdf(api, path, cookie, pdfFixture(["Delay exceeding 6 hours."]))).json();
    await waitForDocument(api, `${path}/documents/${uploaded.id}`, cookie);
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const run = await (await api.request(`${path}/runs`, { method: "POST", headers,
      body: JSON.stringify({ expectedRevision: 2, kind: "investigate", goal: "核对宣传口径" }) })).json();
    const finished = await waitForRun(api, path, run.id, cookie);
    assert.equal(finished.status, "partial");
    assert.equal(finished.report.comparisons.length, 0);
    assert.equal(finished.report.droppedComparisons, 1);
    assert.equal(calls, 2, "one attempt plus one corrective attempt");
  } finally {
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous.key;
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = previous.base;
    await api.close();
    await new Promise<void>(resolve => { model.close(() => resolve()); model.closeAllConnections(); });
  }
});

// A pasted chat record is a material like any other: the text is stored verbatim, its paragraphs
// become citable sources, and the provenance travels with it so a quote keeps its context.
test("a pasted chat record becomes citable material with provenance", async () => {
  const api = await start();
  try {
    const response = await api.request("/api/reviews", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const review = await response.json();
    const path = `/api/reviews/${review.id}`;
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const body = JSON.stringify({
      role: "broker_reply",
      fromWhom: "WhatsApp · 經紀 Ken",
      capturedAt: "2026-11-13 21:30",
      text: "你延誤超過 3 小時就賠，最多兩萬。\n\n唔使填表，我幫你搞掂。",
    });
    const created = await api.request(`${path}/text-materials`, { method: "POST", headers, body });
    assert.equal(created.status, 201);
    const material = await created.json();
    assert.equal(material.role, "broker_reply");
    assert.equal(material.sourceType, "pasted");
    assert.equal(material.mediaType, "text/plain");
    assert.equal(material.method, "pasted_text");
    assert.equal(material.fromWhom, "WhatsApp · 經紀 Ken");
    assert.equal(material.capturedAt, "2026-11-13 21:30");
    assert.equal(material.status, "ready");
    assert.equal(material.pageCount, 1);
    assert.equal(material.name, "WhatsApp · 經紀 Ken · 2026-11-13 21:30");

    const docPath = `${path}/documents/${material.id}`;
    const page = await (await api.request(`${docPath}/pages/1`, { headers })).json();
    assert.equal(page.printedPageLabel, "貼上文字");
    assert.equal(page.sources.length, 2, "one source per paragraph");
    assert.equal(page.sources[0].quote, "你延誤超過 3 小時就賠，最多兩萬。");
    const source = await (await api.request(`${path}/sources/${page.sources[0].sourceId}`, { headers })).json();
    assert.equal(source.role, "broker_reply");
    assert.equal(source.quoteCheck, "matched");

    const restore = await (await api.request(`${docPath}/content`, { headers })).text();
    assert.match(restore, /最多兩萬/);

    const reviewAfter = await (await api.request(path, { headers })).json();
    assert.equal(reviewAfter.revision, 2, "a new material bumps the revision");

    const again = await api.request(`${path}/text-materials`, { method: "POST", headers, body });
    assert.equal(again.status, 200, "the same text in the same role is not stored twice");
    assert.equal((await again.json()).id, material.id);

    const missing = await api.request(`${path}/text-materials`, { method: "POST", headers,
      body: JSON.stringify({ role: "broker_reply", fromWhom: "Ken", capturedAt: "", text: "x" }) });
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error.code, "INVALID_INPUT");
  } finally {
    await api.close();
  }
});

test("the newest material version keeps the report slot and lists what changed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-lens-supersede-"));
  const dbPath = join(dir, "test.sqlite");
  const api = await start(dbPath);
  try {
    const created = await api.request("/api/reviews", { method: "POST" });
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    const review = await created.json();
    const headers = { Cookie: cookie };
    const db = api.store.db;
    const now = new Date().toISOString();
    const contractId = "66666666-6666-4666-8666-666666666666";
    db.prepare(`INSERT INTO documents (id, reviewId, role, name, sha256, byteSize, content, status, pageCount, createdAt)
      VALUES (?, ?, 'contract', 'policy.pdf', ?, 1, ?, 'ready', 1, ?)`)
      .run(contractId, review.id, "d".repeat(64), new Uint8Array([0x25, 0x50, 0x44, 0x46]), now);
    db.prepare("INSERT INTO pages (documentId, pageIndex, text, status) VALUES (?, 1, ?, 'complete')")
      .run(contractId, "Delay exceeding 6 hours.");
    const sourceId = `${contractId}:p1:b1`;
    db.prepare("INSERT INTO sources (id, documentId, pageIndex, blockId, quote) VALUES (?, ?, 1, 'b1', ?)")
      .run(sourceId, contractId, "Delay exceeding 6 hours.");
    const insertRun = db.prepare(`INSERT INTO runs (id, reviewId, inputRevision, kind, goal, status, requestHash, createdAt, updatedAt)
      VALUES (?, ?, ?, 'investigate', '延误多久才赔', 'partial', ?, ?, ?)`);
    const insertReport = db.prepare("INSERT INTO investigations (runId, snapshot, output) VALUES (?, ?, ?)");
    const newerRun = "77777777-7777-4777-8777-777777777777";
    const olderRun = "88888888-8888-4888-8888-888888888888";
    insertRun.run(newerRun, review.id, 2, "h3", now, now);
    insertReport.run(newerRun, JSON.stringify({context:{},documents:[],sources:[]}), JSON.stringify({
      findings: [{explanation: "附表把门槛写成 8 小时。", evidenceStatus: "document_supported", sourceIds: [sourceId]}],
      openQuestions: ["起算点如何计算？"],
      requests: [{message: "请提供完整附表。", requestedRole: "schedule"}],
      supersedes: [{previousIndex: 0, previousConclusion: "旧版说门槛是 6 小时。",
        previousEvidenceStatus: "document_supported", previousSourceIds: [sourceId],
        verdict: "reversed", explanation: "新材料把门槛改成 8 小时。", currentIndex: 0, newSourceIds: [sourceId]}],
      supersedesUnchecked: 1, sources: [], coverage: [], verification: "source_ids_checked_semantics_reviewed",
    }));
    // The older run finishes last: the newer revision must still be the published one.
    insertRun.run(olderRun, review.id, 1, "h4", now, now);
    insertReport.run(olderRun, JSON.stringify({context:{},documents:[],sources:[]}), JSON.stringify({
      findings: [{explanation: "旧版说门槛是 6 小时。", evidenceStatus: "document_supported", sourceIds: [sourceId]}],
      openQuestions: [], requests: [], sources: [], coverage: [],
    }));

    const view = (await (await api.request(`/api/reviews/${review.id}`, { headers })).json()).currentReport;
    assert.equal(view.runId, newerRun, "a late run from an older revision must not take the slot");
    assert.equal(view.supersedes.length, 1);
    assert.equal(view.supersedes[0].verdict, "reversed");
    assert.equal(view.supersedes[0].previousConclusion, "旧版说门槛是 6 小时。");
    assert.equal(view.supersedes[0].previous[0].status, "verified");
    assert.equal(view.supersedes[0].current[0].documentName, "policy.pdf");
    assert.equal(view.supersedesUnchecked, 1);

    const exported = await api.request(`/api/reviews/${review.id}/questions/export?format=md`, { headers });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-type") ?? "", /text\/markdown/);
    const markdown = await exported.text();
    assert.match(markdown, /# 提問清單/);
    assert.match(markdown, /起算点如何计算？/);
    assert.match(markdown, /\[schedule\] 请提供完整附表。/);
    assert.match(markdown, /旧版说门槛是 6 小时。/);
    assert.match(markdown, /policy\.pdf/);

    const badFormat = await api.request(`/api/reviews/${review.id}/questions/export?format=pdf`, { headers });
    assert.equal(badFormat.status, 400);
    assert.equal((await badFormat.json()).error.code, "UNSUPPORTED_FORMAT");

    const empty = await api.request("/api/reviews", { method: "POST" });
    const emptyCookie = empty.headers.get("set-cookie")!.split(";")[0];
    const emptyReview = await empty.json();
    const noReport = await api.request(`/api/reviews/${emptyReview.id}/questions/export`, { headers: { Cookie: emptyCookie } });
    assert.equal(noReport.status, 404);
    assert.equal((await noReport.json()).error.code, "REPORT_NOT_FOUND");
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
