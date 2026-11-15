import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { acquireCloudLease, CloudConflict, createCloudHandler, type CloudObject, type CloudObjects } from "../cloud.js";
import { pdfFixture } from "./pdf-fixture.js";
import { createHash } from "node:crypto";

class MemoryObjects implements CloudObjects {
  readonly records = new Map<string, CloudObject>();
  private version = 0;
  beforeWrite?: (key: string) => Promise<void>;
  async read(key: string) {
    const found = this.records.get(key);
    return found ? { bytes: found.bytes.slice(), etag: found.etag } : null;
  }
  async write(key: string, bytes: Uint8Array, options: { ifMatch?: string }) {
    await this.beforeWrite?.(key);
    const found = this.records.get(key);
    if (options.ifMatch ? found?.etag !== options.ifMatch : Boolean(found)) throw new CloudConflict("precondition failed");
    const etag = String(++this.version);
    this.records.set(key, { bytes: bytes.slice(), etag });
    return { etag };
  }
}

async function serve(handler: ReturnType<typeof createCloudHandler>) {
  const app = express();
  app.use(handler);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

test("a private snapshot survives a completely new handler and remains owner-isolated", async () => {
  const objects = new MemoryObjects();
  let service = await serve(createCloudHandler({ objects }));
  const created = await fetch(`${service.url}/api/reviews`, { method: "POST" });
  assert.equal(created.status, 201);
  const cookie = created.headers.get("set-cookie")!.split(";")[0];
  const review = await created.json() as { id: string };
  await service.close();
  service = await serve(createCloudHandler({ objects }));
  try {
    const read = await fetch(`${service.url}/api/reviews/${review.id}`, { headers: { cookie } });
    assert.equal(read.status, 200);
    assert.equal((await read.json() as { id: string }).id, review.id);
    const otherOwner = await fetch(`${service.url}/api/reviews/${review.id}`, { headers: { cookie: `pl_session=${"a".repeat(64)}` } });
    assert.equal(otherOwner.status, 404);
    const anonymous = await fetch(`${service.url}/api/reviews/${review.id}`);
    assert.equal(anonymous.status, 404);
  } finally { await service.close(); }
});

test("normal responses wait for the private snapshot commit", async () => {
  const objects = new MemoryObjects();
  let unlock!: () => void;
  let entered!: () => void;
  const writing = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { unlock = resolve; });
  objects.beforeWrite = async key => { if (key.endsWith("database.sqlite")) { entered(); await gate; } };
  const service = await serve(createCloudHandler({ objects }));
  let returned = false;
  const request = fetch(`${service.url}/api/reviews`, { method: "POST" }).then(response => { returned = true; return response; });
  try {
    await writing;
    assert.equal(returned, false);
    unlock();
    assert.equal((await request).status, 201);
  } finally { unlock(); await service.close(); }
});

test("uploaded PDF parsing completes before the request snapshot is committed", async () => {
  const objects = new MemoryObjects();
  let service = await serve(createCloudHandler({ objects }));
  const created = await fetch(`${service.url}/api/reviews`, { method: "POST" });
  const cookie = created.headers.get("set-cookie")!.split(";")[0];
  const review = await created.json() as { id: string };
  const form = new FormData();
  form.set("role", "contract");
  form.set("file", new Blob([pdfFixture(["The policy covers delays longer than six hours."])]), "contract.pdf");
  const uploaded = await fetch(`${service.url}/api/reviews/${review.id}/documents`, { method: "POST", headers: { cookie }, body: form });
  assert.equal(uploaded.status, 202);
  const document = await uploaded.json() as { id: string };
  await service.close();
  service = await serve(createCloudHandler({ objects }));
  try {
    const read = await fetch(`${service.url}/api/reviews/${review.id}/documents/${document.id}`, { headers: { cookie } });
    const info = await read.json() as { status: string };
    assert.equal(info.status, "ready");
    const page = await fetch(`${service.url}/api/reviews/${review.id}/documents/${document.id}/pages/1`, { headers: { cookie } });
    assert.match((await page.json() as { text: string }).text, /longer than six hours/);
  } finally { await service.close(); }
});

test("SSE progress streams immediately but done waits for durable commit", async () => {
  const objects = new MemoryObjects();
  let unlock!: () => void;
  let entered!: () => void;
  const writing = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { unlock = resolve; });
  objects.beforeWrite = async key => { if (key.endsWith("database.sqlite")) { entered(); await gate; } };
  const service = await serve(createCloudHandler({ objects, application: () => {
    const app = express();
    app.post("/api/stream", (_req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.flushHeaders();
      res.write('data: {"type":"thinking","message":"working"}\n\n');
      res.write('data: {"type":"done"}\n\n');
      res.end();
    });
    return app;
  } }));
  try {
    const response = await fetch(`${service.url}/api/stream`, { method: "POST", headers: { cookie: `pl_session=${"b".repeat(64)}` } });
    const reader = response.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.match(first, /thinking/);
    assert.doesNotMatch(first, /"done"/);
    await writing;
    unlock();
    let rest = "";
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value); }
    assert.match(rest, /"done"/);
  } finally { unlock(); await service.close(); }
});

test("failed persistence returns an explicit error rather than a false success", async () => {
  const objects = new MemoryObjects();
  objects.beforeWrite = async key => { if (key.endsWith("database.sqlite")) throw new Error("offline"); };
  const service = await serve(createCloudHandler({ objects }));
  try {
    const response = await fetch(`${service.url}/api/reviews`, { method: "POST" });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "STORAGE_UNAVAILABLE");
  } finally { await service.close(); }
});

test("leases exclude concurrent writes, release conditionally, and can be reacquired", async () => {
  const objects = new MemoryObjects();
  const first = await acquireCloudLease(objects, "lease", { ttl: 1000 });
  await assert.rejects(acquireCloudLease(objects, "lease", { wait: 20, poll: 5 }), CloudConflict);
  await first.assertOwned();
  await first.release();
  const second = await acquireCloudLease(objects, "lease", { wait: 20 });
  await second.assertOwned();
  await second.release();
});

test("a lost lease never overwrites or deletes its successor", async () => {
  const objects = new MemoryObjects();
  const lease = await acquireCloudLease(objects, "lease", { ttl: 60_000 });
  const current = (await objects.read("lease"))!;
  await objects.write("lease", new TextEncoder().encode(JSON.stringify({ owner: "successor", expiresAt: Date.now() + 60_000 })), { ifMatch: current.etag });
  await assert.rejects(lease.assertOwned(), CloudConflict);
  await lease.release();
  assert.equal(JSON.parse(new TextDecoder().decode((await objects.read("lease"))!.bytes)).owner, "successor");
});

test("concurrent requests from one owner preserve both writes", async () => {
  const objects = new MemoryObjects();
  const service = await serve(createCloudHandler({ objects, lease: { poll: 5 } }));
  const cookie = `pl_session=${"c".repeat(64)}`;
  try {
    const responses = await Promise.all([0, 1].map(() => fetch(`${service.url}/api/reviews`, { method: "POST", headers: { cookie } })));
    const reviews = await Promise.all(responses.map(async response => {
      assert.equal(response.status, 201);
      return response.json() as Promise<{ id: string }>;
    }));
    for (const review of reviews) assert.equal((await fetch(`${service.url}/api/reviews/${review.id}`, { headers: { cookie } })).status, 200);
  } finally { await service.close(); }
});

test("large originals get an owner-authorised, exact-object private redirect", async () => {
  const objects = new MemoryObjects() as MemoryObjects & { signedRead: (key: string) => Promise<string> };
  const signed: string[] = [];
  objects.signedRead = async key => { signed.push(key); return "https://private.example/policy.pdf?short-lived=1"; };
  const ownerToken = "d".repeat(64);
  const owner = createHash("sha256").update(ownerToken).digest("hex");
  const service = await serve(createCloudHandler({ objects, application: store => {
    const app = express();
    app.post("/api/seed", (_req, res) => {
      const review = store.createReview(owner);
      const content = Buffer.alloc(4 * 1024 * 1024 + 1, 32);
      store.db.prepare("INSERT INTO documents (id,reviewId,role,name,sha256,byteSize,content,status,createdAt) VALUES ('large',?,'contract','large.pdf','content-hash',?,?,'ready',?)")
        .run(review.id, content.length, content, new Date().toISOString());
      res.json(review);
    });
    return app;
  } }));
  const cookie = `pl_session=${ownerToken}`;
  try {
    const created = await fetch(`${service.url}/api/seed`, { method: "POST", headers: { cookie } });
    const review = await created.json() as { id: string };
    const path = `/api/reviews/${review.id}/documents/large/content`;
    const response = await fetch(service.url + path, { headers: { cookie }, redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://private.example/policy.pdf?short-lived=1");
    assert.equal(signed[0], `policy-lens/owners/${owner}/originals/large-content-hash.pdf`);
    const anonymous = await fetch(service.url + path, { redirect: "manual" });
    assert.equal(anonymous.status, 404);
    assert.equal(signed.length, 1);
  } finally { await service.close(); }
});
