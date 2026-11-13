import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type Review = {
  id: string; owner: string; revision: number; context: string; createdAt: string;
};
export type Run = {
  id: string; reviewId: string; inputRevision: number; kind: "investigate";
  goal: string; status: "awaiting_input" | "cancelled" | "queued" | "running" | "partial" | "failed";
  idempotencyKey: string | null; requestHash: string;
  createdAt: string; updatedAt: string;
};

export class Store {
  readonly db: DatabaseSync;
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
  }

  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = work(); this.db.exec("COMMIT"); return value; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  createReview(owner: string) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO reviews VALUES (?, ?, 1, '{}', ?)")
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
    this.db.prepare("INSERT INTO run_events (runId, type, data, timestamp) VALUES (?, ?, ?, ?)")
      .run(runId, type, JSON.stringify(data), new Date().toISOString());
  }

  events(run: Run, after = 0) {
    const rows = this.db.prepare("SELECT * FROM run_events WHERE runId = ? AND eventId > ? ORDER BY eventId")
      .all(run.id, after) as {eventId: number; type: string; data: string; timestamp: string}[];
    return rows.map(row => ({ ...row, data: JSON.parse(row.data), runId: run.id, inputRevision: run.inputRevision }));
  }

  close() { this.db.close(); }
}
