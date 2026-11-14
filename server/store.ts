import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type Review = {
  id: string; owner: string; revision: number; context: string; createdAt: string;
};
export type Run = {
  id: string; reviewId: string; inputRevision: number; kind: "investigate" | "scenario";
  goal: string;
  // "interrupted" means the server stopped while the run was executing; nothing of it survives
  // except the events, so the client is told to start again instead of waiting forever.
  status: "awaiting_input" | "cancelled" | "queued" | "running" | "partial" | "failed" | "interrupted";
  idempotencyKey: string | null; requestHash: string; parentRunId: string | null;
  createdAt: string; updatedAt: string;
};

// A run event as it is stored and as it is pushed to a live subscriber.
export type RunEvent = {
  eventId: number; type: string; data: unknown; timestamp: string; runId: string; inputRevision: number;
};

// Columns added after the first release; existing local databases must be migrated in place.
function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {name: string}[];
  if (!columns.some(entry => entry.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export class Store {
  readonly db: DatabaseSync;
  private readonly listeners = new Set<(event: RunEvent) => void>();
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL,
        context TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY, reviewId TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        inputRevision INTEGER NOT NULL, kind TEXT NOT NULL, goal TEXT NOT NULL,
        status TEXT NOT NULL, idempotencyKey TEXT, requestHash TEXT NOT NULL,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        UNIQUE(reviewId, idempotencyKey)
      );
      CREATE TABLE IF NOT EXISTS run_events (
        eventId INTEGER PRIMARY KEY AUTOINCREMENT,
        runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL, data TEXT NOT NULL, timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_review ON runs(reviewId);
      CREATE INDEX IF NOT EXISTS events_run ON run_events(runId, eventId);
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, reviewId TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        role TEXT NOT NULL, name TEXT NOT NULL, sha256 TEXT NOT NULL,
        byteSize INTEGER NOT NULL, content BLOB NOT NULL, status TEXT NOT NULL,
        pageCount INTEGER, errorCode TEXT, createdAt TEXT NOT NULL,
        UNIQUE(reviewId, sha256, role)
      );
      CREATE TABLE IF NOT EXISTS pages (
        documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        pageIndex INTEGER NOT NULL, printedPageLabel TEXT, text TEXT NOT NULL,
        status TEXT NOT NULL, PRIMARY KEY(documentId, pageIndex)
      );
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY, documentId TEXT NOT NULL, pageIndex INTEGER NOT NULL,
        blockId TEXT NOT NULL, quote TEXT NOT NULL,
        FOREIGN KEY(documentId, pageIndex) REFERENCES pages(documentId, pageIndex) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS investigations (
        runId TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
        snapshot TEXT NOT NULL, output TEXT
      );
      CREATE INDEX IF NOT EXISTS documents_review ON documents(reviewId);
      CREATE INDEX IF NOT EXISTS sources_document ON sources(documentId, pageIndex);
    `);
    // A successor run points at the run whose report requested more material.
    ensureColumn(this.db, "runs", "parentRunId", "parentRunId TEXT");
    // Materials can be pasted chat records, not only uploaded PDFs: keep where the text came
    // from and when it was said, because a quote without provenance is not evidence.
    ensureColumn(this.db, "documents", "sourceType", "sourceType TEXT NOT NULL DEFAULT 'upload'");
    ensureColumn(this.db, "documents", "mediaType", "mediaType TEXT NOT NULL DEFAULT 'application/pdf'");
    ensureColumn(this.db, "documents", "fromWhom", "fromWhom TEXT");
    ensureColumn(this.db, "documents", "capturedAt", "capturedAt TEXT");
    // Cached v3 intake & v3 structured analysis keyed by review input revision.
    ensureColumn(this.db, "reviews", "v3Intake", "v3Intake TEXT");
    ensureColumn(this.db, "reviews", "v3IntakeRevision", "v3IntakeRevision INTEGER");
    ensureColumn(this.db, "reviews", "v3Analysis", "v3Analysis TEXT");
    ensureColumn(this.db, "reviews", "v3AnalysisKey", "v3AnalysisKey TEXT");
    ensureColumn(this.db, "reviews", "v3Claims", "v3Claims TEXT");
    ensureColumn(this.db, "reviews", "v3ClaimsKey", "v3ClaimsKey TEXT");
  }

  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = work(); this.db.exec("COMMIT"); return value; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  createReview(owner: string) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO reviews (id, owner, revision, context, createdAt) VALUES (?, ?, 1, '{}', ?)")
      .run(id, owner, new Date().toISOString());
    return this.getReview(id, owner)!;
  }

  getReview(id: string, owner: string) {
    return this.db.prepare("SELECT * FROM reviews WHERE id = ? AND owner = ?")
      .get(id, owner) as Review | undefined;
  }

  getRun(id: string, reviewId: string) {
    return this.db.prepare("SELECT * FROM runs WHERE id = ? AND reviewId = ?")
      .get(id, reviewId) as Run | undefined;
  }

  addEvent(runId: string, type: string, data: unknown) {
    const timestamp = new Date().toISOString();
    const inserted = this.db.prepare("INSERT INTO run_events (runId, type, data, timestamp) VALUES (?, ?, ?, ?)")
      .run(runId, type, JSON.stringify(data), timestamp);
    const run = this.db.prepare("SELECT inputRevision FROM runs WHERE id = ?").get(runId) as {inputRevision: number} | undefined;
    const event: RunEvent = {eventId: Number(inserted.lastInsertRowid), type, data, timestamp,
      runId, inputRevision: run?.inputRevision ?? 0};
    // A live subscriber must never be able to break the write path that produced the event.
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* the stream will recover from the stored event */ }
    }
  }

  // Used by the SSE endpoint: the client keeps a request open and receives events as they happen,
  // instead of polling or reconnecting every second.
  subscribe(listener: (event: RunEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  events(run: Run, after = 0) {
    const rows = this.db.prepare("SELECT * FROM run_events WHERE runId = ? AND eventId > ? ORDER BY eventId")
      .all(run.id, after) as {eventId: number; type: string; data: string; timestamp: string}[];
    return rows.map(row => ({ ...row, data: JSON.parse(row.data), runId: run.id, inputRevision: run.inputRevision }));
  }

  lastEvent(runId: string, type?: string) {
    const row = (type
      ? this.db.prepare("SELECT * FROM run_events WHERE runId = ? AND type = ? ORDER BY eventId DESC LIMIT 1").get(runId, type)
      : this.db.prepare("SELECT * FROM run_events WHERE runId = ? ORDER BY eventId DESC LIMIT 1").get(runId)) as
      {eventId: number; type: string; data: string; timestamp: string} | undefined;
    if (!row) return null;
    let data: unknown = null;
    try { data = JSON.parse(row.data); } catch { data = null; }
    return {...row, data, runId};
  }

  close() { this.db.close(); }
}
