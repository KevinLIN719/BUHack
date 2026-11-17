/**
 * Vercel request adapter. SQLite is a request-local working copy; the committed
 * database lives in a private Blob object, never in an instance's /tmp cache.
 * One renewable, conditional-write lease serialises writes for a browser owner.
 * Read requests use the last committed snapshot and do not recover background jobs.
 */
import type { Express, Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get, put, issueSignedToken, presignUrl } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { Store } from "./store.js";
import { createApp } from "./app.js";

export interface CloudObject { bytes: Uint8Array; etag: string }
export interface CloudObjects {
  read(key: string): Promise<CloudObject | null>;
  write(key: string, bytes: Uint8Array, options: { ifMatch?: string; contentType?: string }): Promise<{ etag: string }>;
  signedRead?(key: string): Promise<string>;
}

export class CloudConflict extends Error {
  readonly status = 409;
  readonly code = "CLOUD_CONFLICT";
}

function isConflict(error: unknown) {
  return error instanceof CloudConflict || (error instanceof Error &&
    /Precondition|already exists|ifMatch|condition.*failed|already.*blob/i.test(`${error.name}: ${error.message}`));
}

export const privateObjects: CloudObjects = {
  async read(key) {
    const result = await get(key, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(30_000) });
    if (!result || result.statusCode !== 200) return null;
    // Compressed downloads expose W/"..." while Blob conditional writes expect
    // the underlying object's strong tag. Its opaque value is unchanged.
    return { bytes: new Uint8Array(await new globalThis.Response(result.stream).arrayBuffer()), etag: result.blob.etag.replace(/^W\//, "") };
  },
  async write(key, bytes, options) {
    const result = await put(key, Buffer.from(bytes), {
      access: "private", addRandomSuffix: false,
      allowOverwrite: Boolean(options.ifMatch),
      ...(options.ifMatch ? { ifMatch: options.ifMatch } : {}),
      contentType: options.contentType || "application/octet-stream",
      abortSignal: AbortSignal.timeout(30_000),
    });
    return { etag: result.etag };
  },
  async signedRead(key) {
    const validUntil = Date.now() + 120_000;
    const signed = await issueSignedToken({ pathname: key, operations: ["get"], validUntil });
    return (await presignUrl(signed, { access: "private", operation: "get", pathname: key, validUntil })).presignedUrl;
  },
};

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
type LeaseValue = { owner: string; expiresAt: number };
function leaseValue(object: CloudObject | null): LeaseValue | null {
  if (!object) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(object.bytes));
    return typeof value.owner === "string" && Number.isFinite(value.expiresAt) ? value : null;
  } catch { return null; }
}

export async function acquireCloudLease(objects: CloudObjects, key: string,
  options: { ttl?: number; wait?: number; poll?: number } = {}) {
  const ttl = options.ttl ?? 60_000;
  const wait = options.wait ?? 8_000;
  const poll = options.poll ?? 180;
  const owner = randomUUID();
  const deadline = Date.now() + wait;
  let etag = "";
  for (;;) {
    const current = await objects.read(key);
    const value = leaseValue(current);
    if (!current || (value && value.expiresAt <= Date.now())) {
      try {
        const result = await objects.write(key, encode({ owner, expiresAt: Date.now() + ttl }),
          { ifMatch: current?.etag, contentType: "application/json" });
        etag = result.etag;
        break;
      } catch (error) { if (!isConflict(error)) throw error; }
    }
    if (Date.now() >= deadline) throw new CloudConflict("這個保單工作階段正在處理另一項操作，請稍後重試。");
    await sleep(poll);
  }
  let released = false;
  let lost: unknown;
  let chain = Promise.resolve();
  const serial = (task: () => Promise<void>) => {
    const result = chain.then(task);
    chain = result.catch(() => {});
    return result;
  };
  const assertOwned = async () => {
    if (released || lost) throw new CloudConflict("工作階段的寫入鎖已失效，請重試。");
    const current = await objects.read(key);
    const value = leaseValue(current);
    if (!current || value?.owner !== owner || value.expiresAt <= Date.now()) {
      throw new CloudConflict("工作階段已由另一項操作接續，沒有覆寫其資料。");
    }
    etag = current.etag;
  };
  const renew = () => serial(async () => {
    if (released) return;
    await assertOwned();
    const result = await objects.write(key, encode({ owner, expiresAt: Date.now() + ttl }),
      { ifMatch: etag, contentType: "application/json" });
    etag = result.etag;
  });
  const timer = setInterval(() => { void renew().catch(error => { lost = error; }); }, Math.max(5, Math.floor(ttl / 4)));
  timer.unref?.();
  return {
    assertOwned: () => serial(assertOwned),
    async release() {
      clearInterval(timer);
      await serial(async () => {
        if (released) return;
        try {
          const current = await objects.read(key);
          if (leaseValue(current)?.owner === owner) {
            // Keep the lease object. Conditional expiry cannot delete a successor's lock.
            await objects.write(key, encode({ owner, expiresAt: 0 }), { ifMatch: current!.etag, contentType: "application/json" });
          }
        } catch { /* An expired/taken lease must not be overwritten during cleanup. */ }
        released = true;
      });
    },
  };
}

function cookieToken(req: Request) {
  const token = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("pl_session="))?.slice(11);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function terminalSse(chunk: Buffer) {
  return chunk.toString("utf8").split("\n\n").some(event => {
    const data = event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    try { return ["done", "error"].includes(JSON.parse(data).type); } catch { return false; }
  });
}

/** Hold ordinary responses and terminal SSE events until the durable commit. */
function holdResponse(res: Response) {
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const chunks: Buffer[] = [];
  let ending: unknown[] = [];
  let terminal = false;
  let resolve!: () => void;
  const done = new Promise<void>(finish => { resolve = finish; });
  const write = (chunk: unknown, encoding?: unknown, callback?: unknown) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === "string" ? encoding as BufferEncoding : "utf8");
    const isSse = String(res.getHeader("content-type") || "").includes("text/event-stream");
    if (isSse && !terminal && !terminalSse(bytes)) return originalWrite(chunk as never, encoding as never, callback as never);
    if (isSse) terminal = true;
    chunks.push(bytes);
    const cb = typeof encoding === "function" ? encoding : callback;
    if (typeof cb === "function") queueMicrotask(() => cb());
    return true;
  };
  res.write = write as typeof res.write;
  res.end = ((...args: unknown[]) => { ending = args; resolve(); return res; }) as typeof res.end;
  return {
    done,
    commit() {
      res.write = originalWrite;
      res.end = originalEnd;
      if (res.destroyed) return;
      for (const chunk of chunks) originalWrite(chunk);
      (originalEnd as (...args: unknown[]) => unknown)(...ending);
    },
    fail(error: unknown) {
      res.write = originalWrite;
      res.end = originalEnd;
      if (res.destroyed) return;
      const conflict = error instanceof CloudConflict;
      const message = conflict ? error.message : "資料尚未成功儲存，請重試。";
      if (res.headersSent) {
        originalEnd(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      } else {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Disposition");
        res.statusCode = conflict ? 409 : 503;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        originalEnd(JSON.stringify({ error: { code: conflict ? "CLOUD_CONFLICT" : "STORAGE_UNAVAILABLE", message, retryable: true } }));
      }
    },
  };
}

export function createCloudHandler(options: {
  objects?: CloudObjects;
  application?: (store: Store, options: { readOnly: boolean }) => Express;
  lease?: { ttl?: number; wait?: number; poll?: number };
} = {}) {
  const objects = options.objects ?? privateObjects;
  const application = options.application ?? createApp;
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.path === "/api/health") {
      const configured = Boolean(options.objects || process.env.BLOB_READ_WRITE_TOKEN ||
        (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
      res.status(configured ? 200 : 503).json({ ok: configured, service: "Policy Lens", persistence: "private-blob", configured });
      return;
    }
    let token = cookieToken(req);
    if (!token && req.method === "POST" && req.path === "/api/reviews") {
      token = randomBytes(32).toString("hex");
      const otherCookies = req.headers.cookie?.split(";").map(value => value.trim()).filter(value => !value.startsWith("pl_session="));
      req.headers.cookie = [...(otherCookies || []), `pl_session=${token}`].join("; ");
      res.cookie("pl_session", token, { httpOnly: true, secure: Boolean(process.env.VERCEL) || req.secure,
        sameSite: "strict", maxAge: 7 * 86400_000, path: "/" });
    }
    if (!token) {
      res.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "請在建立保單的瀏覽器中開啟。", retryable: false } });
      return;
    }
    const owner = hash(token);
    const key = `policy-lens/owners/${owner}/database.sqlite`;
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    let lease: Awaited<ReturnType<typeof acquireCloudLease>> | undefined;
    let directory: string | undefined;
    let store: Store | undefined;
    let app: Express | undefined;
    let hooks: { afterCommit?: () => void | Promise<void>; onCommitFailure?: () => void | Promise<void> } | undefined;
    let committed = false;
    const response = holdResponse(res);
    try {
      if (mutating) lease = await acquireCloudLease(objects, `${key}.lease`, options.lease);
      const snapshot = await objects.read(key);
      directory = await mkdtemp(join(tmpdir(), "policy-lens-"));
      const path = join(directory, "database.sqlite");
      if (snapshot) await writeFile(path, snapshot.bytes);
      store = new Store(path);
      // A large original bypasses the Function response-size limit. Authorise in
      // the owner database first, then mint a 2-minute URL for that exact object.
      const original = /^\/api\/reviews\/([^/]+)\/documents\/([^/]+)\/content$/.exec(req.path);
      if (!mutating && original && objects.signedRead && store.getReview(original[1], owner)) {
        const row = store.db.prepare("SELECT content, sha256, mediaType FROM documents WHERE id = ? AND reviewId = ?")
          .get(original[2], original[1]) as { content: Uint8Array; sha256: string; mediaType: string } | undefined;
        if (row && row.content.length > 4 * 1024 * 1024) {
          const originalKey = `policy-lens/owners/${owner}/originals/${original[2]}-${row.sha256}.pdf`;
          try { await objects.write(originalKey, row.content, { contentType: row.mediaType }); }
          catch (error) { if (!isConflict(error)) throw error; }
          res.redirect(302, await objects.signedRead(originalKey));
          await response.done;
          store.close(); store = undefined;
          response.commit();
          return;
        }
      }
      app = application(store, { readOnly: !mutating });
      app.locals.cloudTransactions = true;
      hooks = app.locals;
      app(req, res, error => {
        if (error) res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "請重試。" } });
        else res.status(404).json({ error: { code: "NOT_FOUND", message: "找不到這個介面。" } });
      });
      await response.done;
      await app.locals.waitUntilIdle?.();
      await app.locals.close?.();
      app = undefined;
      store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      store.close(); store = undefined;
      if (mutating) {
        await lease!.assertOwned();
        await objects.write(key, new Uint8Array(await readFile(path)), { ifMatch: snapshot?.etag });
        await lease!.assertOwned();
      }
      committed = true;
      try { await hooks?.afterCommit?.(); }
      catch { console.warn("[cloud] post-commit metadata update unavailable"); }
      response.commit();
    } catch (error) {
      if (!committed) {
        try { await hooks?.onCommitFailure?.(); }
        catch { console.warn("[cloud] failed-request metadata cleanup unavailable"); }
      }
      // Do not log request cookies, Blob URLs, OCR text, credentials or DB bytes.
      console.error("[cloud] request failed", {
        kind: error instanceof CloudConflict ? "write_conflict" : "storage_or_request_failure",
        name: error instanceof Error ? error.name : "unknown",
        code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
        // Call sites only: omit the first stack line, which can include private input.
        at: error instanceof Error ? error.stack?.split("\n").slice(1,4).map(line=>line.trim()) : undefined,
      });
      response.fail(error);
    } finally {
      await app?.locals.close?.().catch(() => {});
      try { store?.close(); } catch {}
      await lease?.release();
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  };
}

const handler = createCloudHandler();
export function cloudHandler(req: Request, res: Response) {
  const job = handler(req, res);
  waitUntil(job);
  return job;
}
