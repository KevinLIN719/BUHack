import express, { type Request, type Response } from 'express';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { get, put, del } from '@vercel/blob';
import QRCode from 'qrcode';

type Role = 'host' | 'phone';
type Photo = { id: string; name: string; width: number; height: number; mimeType: 'image/jpeg' | 'image/png'; path: string };
type Signal = { id: number; from: Role; type: string; data: unknown };
export type CaptureSession = {
  id: string; hostHash: string; phoneHash: string; expiresAt: number;
  status: 'waiting' | 'connected' | 'processing' | 'imported' | 'closed'; pages: Photo[]; sequence: number; messages: Signal[];
};
export interface CaptureStorage {
  read(id: string): Promise<{ session: CaptureSession; version: string } | null>;
  write(session: CaptureSession, version?: string): Promise<void>;
  putPhoto(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  photo(path: string): Promise<Uint8Array | null>;
  removePhoto(path: string): Promise<void>;
}
export class CaptureError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const validId = (s: string) => /^[0-9a-f-]{36}$/.test(s);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PAGES = 20;
const fileRoot = resolve(process.env.CAPTURE_STORAGE_DIR || '.data/capture');

// Session state is private. ETag compare-and-swap prevents parallel ICE/photo
// writes from losing each other across separate Vercel function instances.
export class BlobCaptureStorage implements CaptureStorage {
  async read(id: string) {
    const result = await get(`capture/${id}/session.json`, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return { session: JSON.parse(await new Response(result.stream).text()) as CaptureSession, version: result.blob.etag.replace(/^W\//, '') };
  }
  async write(session: CaptureSession, version?: string) {
    await put(`capture/${session.id}/session.json`, JSON.stringify(session), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json',
      ...(version ? { ifMatch: version, allowOverwrite: true } : { allowOverwrite: false }),
    });
  }
  async putPhoto(path: string, bytes: Uint8Array, mime: string) {
    await put(path, Buffer.from(bytes), { access: 'private', addRandomSuffix: false, contentType: mime });
  }
  async photo(path: string) {
    const result = await get(path, { access: 'private', useCache: false });
    return result?.statusCode === 200 ? new Uint8Array(await new Response(result.stream).arrayBuffer()) : null;
  }
  async removePhoto(path: string) { await del(path); }
}

// Local development has the same durable shape without needing cloud keys.
export class FileCaptureStorage implements CaptureStorage {
  private async path(name: string) { await mkdir(resolve(fileRoot, name, '..'), { recursive: true }); return resolve(fileRoot, name); }
  async read(id: string) {
    try { const text = await readFile(await this.path(`${id}/session.json`), 'utf8'); return { session: JSON.parse(text) as CaptureSession, version: hash(text) }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async write(session: CaptureSession, version?: string) {
    const previous = await this.read(session.id);
    if (version ? previous?.version !== version : Boolean(previous)) throw new CaptureError(409, 'STATE_CONFLICT', '連線狀態正在更新，請重試。');
    const path = await this.path(`${session.id}/session.json`), tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(session), { mode: 0o600 }); await rename(tmp, path);
  }
  async putPhoto(path: string, bytes: Uint8Array) { await writeFile(await this.path(path), bytes, { mode: 0o600 }); }
  async photo(path: string) { try { return await readFile(await this.path(path)); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; } }
  async removePhoto(path: string) { await unlink(await this.path(path)).catch(() => {}); }
}
let defaultStorage: CaptureStorage | undefined;
export const captureStorage = () => defaultStorage ||= process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID
  ? new BlobCaptureStorage() : process.env.VERCEL ? (() => { throw new CaptureError(503, 'STORAGE_NOT_CONFIGURED', '尚未連接私有照片儲存。'); })() : new FileCaptureStorage();
const localLocks = new Map<string, Promise<unknown>>();
async function serial<T>(id: string, fn: () => Promise<T>) {
  const previous = localLocks.get(id) || Promise.resolve();
  const current = previous.catch(() => {}).then(fn); localLocks.set(id, current);
  try { return await current; } finally { if (localLocks.get(id) === current) localLocks.delete(id); }
}
function roleOf(session: CaptureSession, token: string): Role {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new CaptureError(404, 'SESSION_NOT_FOUND', '找不到這次手機連線。');
  const digest = Buffer.from(hash(token), 'hex');
  for (const role of ['host', 'phone'] as Role[]) if (timingSafeEqual(digest, Buffer.from(session[`${role}Hash`], 'hex'))) return role;
  throw new CaptureError(404, 'SESSION_NOT_FOUND', '找不到這次手機連線。');
}
async function authorized(storage: CaptureStorage, id: string, token: string, allowClosed = false) {
  if (!validId(id)) throw new CaptureError(404, 'SESSION_NOT_FOUND', '找不到這次手機連線。');
  const record = await storage.read(id);
  if (!record) throw new CaptureError(404, 'SESSION_NOT_FOUND', '找不到這次手機連線。');
  const role = roleOf(record.session, token);
  if (record.session.expiresAt <= Date.now()) throw new CaptureError(410, 'SESSION_EXPIRED', '手機連線已過期，請重新掃碼。');
  if (record.session.status === 'closed' && !allowClosed) throw new CaptureError(410, 'SESSION_CLOSED', '手機連線已結束。');
  return { ...record, role };
}
async function mutate<T>(storage: CaptureStorage, id: string, token: string, fn: (s: CaptureSession, role: Role) => T) {
  return serial(id, async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const { session, version, role } = await authorized(storage, id, token);
      const result = fn(session, role);
      try { await storage.write(session, version); return result; }
      catch (e) {
        if (!/precondition|conflict|412/i.test(String((e as Error).name) + String((e as Error).message)) || attempt === 9) throw e;
      }
    }
    throw new CaptureError(409, 'STATE_CONFLICT', '連線狀態正在更新，請重試。');
  });
}
export function captureIceServers(): RTCIceServer[] {
  const defaults = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (!process.env.CAPTURE_ICE_SERVERS_JSON) return defaults;
  try {
    const raw = JSON.parse(process.env.CAPTURE_ICE_SERVERS_JSON);
    if (!Array.isArray(raw) || raw.length > 8 || raw.some(s => !s || ![s.urls].flat().every(u => typeof u === 'string' && /^(stun|stuns|turn|turns):/.test(u)))) throw new Error();
    return raw;
  } catch { throw new CaptureError(503, 'ICE_NOT_CONFIGURED', '攝像頭連線設定有誤，請聯絡管理員。'); }
}
function publicSession(s: CaptureSession) { return { id: s.id, status: s.status, expiresAt: s.expiresAt, iceServers: captureIceServers(), pages: s.pages.map(({ path, mimeType, ...page }) => page) }; }
const tokenOf = (req: Request) => req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
const hostOnly = (role: Role) => { if (role !== 'host') throw new CaptureError(403, 'HOST_REQUIRED', '請在電腦端操作。'); };
function dimensions(bytes: Buffer, mime: string) {
  if (mime === 'image/png' && bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    for (let p = 2; p + 8 < bytes.length;) {
      if (bytes[p++] !== 255) break;
      while (bytes[p] === 255) p++;
      const marker = bytes[p++];
      if (marker === 217 || marker === 218) break;
      if (p + 2 > bytes.length) break;
      const size = bytes.readUInt16BE(p);
      if (size < 2 || p + size > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return { width: bytes.readUInt16BE(p+5), height: bytes.readUInt16BE(p+3) };
      p += size;
    }
  }
  throw new CaptureError(415, 'IMAGE_REQUIRED', '請拍攝或選擇 JPEG / PNG 照片。');
}

export async function capturePages(id: string, token: string, storage = captureStorage()) {
  const { session, role } = await authorized(storage, id, token); hostOnly(role);
  if (!session.pages.length) throw new CaptureError(400, 'PAGES_REQUIRED', '請先拍攝至少一頁。');
  return Promise.all(session.pages.map(async p => {
    const bytes = await storage.photo(p.path);
    if (!bytes) throw new CaptureError(409, 'PHOTO_MISSING', '有照片尚未上傳完成，請重試。');
    return { id: p.id, name: p.name, bytes, mimeType: p.mimeType };
  }));
}

export async function captureImportState(id: string, token: string, state: 'processing' | 'connected' | 'imported', storage = captureStorage()) {
  await mutate(storage,id,token,(session,role) => {
    hostOnly(role);
    if (state === 'processing' && ['processing','imported'].includes(session.status)) throw new CaptureError(409,'IMPORT_IN_PROGRESS','照片正在識別或已導入。');
    if (state === 'processing' && !session.pages.length) throw new CaptureError(400,'PAGES_REQUIRED','請先拍攝至少一頁。');
    session.status=state;
  });
}
const editable = (session: CaptureSession) => { if (['processing','imported'].includes(session.status)) throw new CaptureError(409,'PAGES_LOCKED','照片正在識別或已導入，暫時不能修改。'); };

export function createCaptureRouter(options: { storage?: CaptureStorage; origin?: string } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && origin && origin !== (options.origin || `${req.protocol}://${req.get('host')}`)) return next(new CaptureError(403, 'ORIGIN_DENIED', '請求來源不受支持。'));
    next();
  });
  router.use(express.json({ limit: '4300kb' }));
  const storage = () => options.storage || captureStorage();
  router.post('/sessions', async (req, res) => {
    const hostToken = randomBytes(32).toString('hex'), phoneToken = randomBytes(32).toString('hex'), id = randomUUID();
    const ttl = Math.max(5, Math.min(60, Number(process.env.CAPTURE_SESSION_TTL_MINUTES) || 30));
    const session: CaptureSession = { id, hostHash: hash(hostToken), phoneHash: hash(phoneToken), expiresAt: Date.now() + ttl*60000, status:'waiting', pages:[], sequence:0, messages:[] };
    const phoneUrl = `${options.origin || `${req.protocol}://${req.get('host')}`}/scan#id=${id}&token=${phoneToken}`;
    const qrSvg = await QRCode.toString(phoneUrl, { type:'svg', errorCorrectionLevel:'M', margin:2 });
    await storage().write(session);
    res.status(201).json({ ...publicSession(session), hostToken, phoneUrl, qrSvg });
  });
  router.get('/sessions/:id', async (req, res) => { const { session } = await authorized(storage(), String(req.params.id), tokenOf(req), true); res.json(publicSession(session)); });
  router.get('/sessions/:id/signals', async (req, res) => {
    const { session, role } = await authorized(storage(), String(req.params.id), tokenOf(req));
    const after = Number(req.query.after || 0);
    if (!Number.isSafeInteger(after) || after < 0) throw new CaptureError(400, 'INVALID_CURSOR', '連線進度無效。');
    res.json({ messages: session.messages.filter(m => m.id > after && m.from !== role), cursor: session.sequence });
  });
  router.post('/sessions/:id/signals', async (req, res) => {
    const { type, data } = req.body || {};
    if (!['offer','answer','ice','capture','disconnect','ready'].includes(type) || JSON.stringify(data ?? null).length > 40000) throw new CaptureError(400, 'INVALID_SIGNAL', '攝像頭連線訊息無效。');
    const result = await mutate(storage(), String(req.params.id), tokenOf(req), (s, role) => {
      if ((type === 'offer' || type === 'capture') && role !== 'host' || (type === 'answer' || type === 'ready') && role !== 'phone') throw new CaptureError(403,'SIGNAL_ROLE','連線操作不受支持。');
      const message = { id: ++s.sequence, from:role, type, data:data ?? null };
      s.messages.push(message); s.messages = s.messages.slice(-256);
      if (type === 'ready' && s.status === 'waiting') s.status = 'connected';
      return { id: message.id };
    });
    res.status(201).json(result);
  });
  router.post('/sessions/:id/pages', async (req, res) => {
    const id = String(req.params.id), token = tokenOf(req), store = storage();
    const { session, role } = await authorized(store, id, token);
    editable(session);
    if (role !== 'phone') throw new CaptureError(403, 'PHONE_REQUIRED', '請使用手機拍攝照片。');
    if (session.pages.length >= MAX_PAGES) throw new CaptureError(413,'PAGE_LIMIT','每份掃描最多20頁。');
    const match = typeof req.body?.dataUrl === 'string' && /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(req.body.dataUrl);
    if (!match) throw new CaptureError(415,'IMAGE_REQUIRED','請拍攝或選擇 JPEG / PNG 照片。');
    const bytes = Buffer.from(match[2], 'base64'), mimeType = match[1] as Photo['mimeType'];
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new CaptureError(413,'PHOTO_LIMIT','單頁照片不能超過3 MB。');
    const size = dimensions(bytes,mimeType);
    if (size.width < 32 || size.height < 32 || size.width > 12000 || size.height > 12000 || size.width*size.height > 24_000_000) throw new CaptureError(413,'IMAGE_DIMENSIONS','照片尺寸不合適，請重新拍攝。');
    const pageId = randomUUID(), path = `capture/${id}/photos/${pageId}.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    await store.putPhoto(path,bytes,mimeType);
    try {
      const page = await mutate(store,id,token,s => {
        editable(s);
        if (s.pages.length >= MAX_PAGES) throw new CaptureError(413,'PAGE_LIMIT','每份掃描最多20頁。');
        const photo: Photo = {id:pageId,path,mimeType,...size,name:String(req.body.name || `第${s.pages.length+1}頁`).slice(0,120)};
        s.pages.push(photo); return photo;
      });
      const { path:_path, mimeType:_mime, ...publicPhoto } = page;
      res.status(201).json(publicPhoto);
    } catch (e) { await store.removePhoto(path); throw e; }
  });
  router.get('/sessions/:id/pages/:pageId', async (req, res) => {
    const store = storage(), { session } = await authorized(store,String(req.params.id),tokenOf(req));
    const page = session.pages.find(p => p.id === req.params.pageId);
    if (!page) throw new CaptureError(404,'PHOTO_NOT_FOUND','找不到這一頁照片。');
    const bytes = await store.photo(page.path);
    if (!bytes) throw new CaptureError(404,'PHOTO_NOT_FOUND','找不到這一頁照片。');
    res.type(page.mimeType).send(Buffer.from(bytes));
  });
  router.delete('/sessions/:id/pages/:pageId', async (req, res) => {
    const store = storage();
    const path = await mutate(store,String(req.params.id),tokenOf(req),(s,role) => {
      hostOnly(role); editable(s); const page=s.pages.find(p => p.id===req.params.pageId);
      if (!page) throw new CaptureError(404,'PHOTO_NOT_FOUND','找不到這一頁照片。');
      s.pages=s.pages.filter(p=>p.id!==page.id); return page.path;
    });
    await store.removePhoto(path); res.status(204).end();
  });
  router.delete('/sessions/:id', async (req,res) => {
    const store = storage();
    const pages = await mutate(store,String(req.params.id),tokenOf(req),(s,role) => { hostOnly(role); s.status='closed'; s.messages=[]; return s.pages; });
    await Promise.allSettled(pages.map(p=>store.removePhoto(p.path))); res.status(204).end();
  });
  router.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const e=error as Error & {status?:number};
    res.status(error instanceof CaptureError ? error.status : e.status===413 ? 413 : 500).json({error:{code:error instanceof CaptureError ? error.code : 'CAPTURE_ERROR',message:error instanceof CaptureError ? error.message : e.status===413 ? '照片太大，請重新拍攝。' : '手機連線暫時無法使用，請重試。'}});
  });
  return router;
}
