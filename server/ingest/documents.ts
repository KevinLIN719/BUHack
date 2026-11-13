import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { Store } from "../store.js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 30;
export type DocumentRole = "contract" | "promotion" | "schedule" | "endorsement" | "broker_reply";
export type DocumentRow = {
  id: string; reviewId: string; role: DocumentRole; name: string; sha256: string;
  byteSize: number; status: "queued" | "parsing" | "ready" | "partial" | "needs_ocr" | "failed";
  pageCount: number | null; errorCode: string | null; createdAt: string;
};
export type ParsedPage = {
  pageIndex: number; printedPageLabel: string | null; text: string;
  status: "ready" | "needs_ocr" | "failed";
};
type ParseResult = { pages: ParsedPage[]; error?: never } | { error: string; pages?: never };

export function documentsFor(store: Store, reviewId: string) {
  return store.db.prepare("SELECT id, reviewId, role, name, sha256, byteSize, status, pageCount, errorCode, createdAt FROM documents WHERE reviewId = ? ORDER BY rowid")
    .all(reviewId) as DocumentRow[];
}
export function documentFor(store: Store, reviewId: string, documentId: string) {
  return documentsFor(store, reviewId).find(doc => doc.id === documentId);
}
export function publicDocument(doc: DocumentRow) {
  return { ...doc, documentVersion: doc.sha256, method: "pdf_text" };
}

function parsePdf(bytes: Uint8Array): { promise: Promise<ParseResult>; stop: () => void } {
  const worker = new Worker(resolve(__dirname, "pdf-worker.mjs"), {
    // This worker is plain ESM. Do not inherit tsx/watch/test loaders: they can
    // transform PDF.js again and consume the worker's entire memory budget.
    execArgv: [],
    workerData: { bytes, maxPages: MAX_PAGES },
    resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
  });
  let settle: (result: ParseResult) => void;
  const promise = new Promise<ParseResult>(resolveResult => { settle = resolveResult; });
  let done = false;
  const finish = (result: ParseResult) => {
    if (done) return;
    done = true; clearTimeout(timer); settle(result); void worker.terminate();
  };
  const timer = setTimeout(() => finish({ error: "PARSE_TIMEOUT" }), 20_000);
  worker.once("message", (result: ParseResult) => finish(result));
  worker.once("error", () => finish({ error: "PARSER_FAILED" }));
  worker.once("exit", () => finish({ error: "PARSER_FAILED" }));
  return { promise, stop: () => finish({ error: "INTERRUPTED" }) };
}

function blocks(text: string) {
  // Exact slices of the stored extraction layer; page metadata remains separate.
  const output: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + 1200, text.length);
    if (end < text.length) {
      const lineEnd = text.lastIndexOf("\n", end);
      if (lineEnd > offset + 500) end = lineEnd;
    }
    const block = text.slice(offset, end).trim();
    if (block) output.push(block);
    offset = end;
  }
  return output;
}

export class DocumentQueue {
  private closed = false;
  private active: ReturnType<typeof parsePdf> | undefined;
  private draining: Promise<void> | undefined;
  constructor(private store: Store) {
    // Durable queue: interrupted work can be parsed again from the stored bytes.
    store.db.prepare("UPDATE documents SET status = 'queued' WHERE status = 'parsing'").run();
  }
  wake() {
    if (this.closed || this.draining) return;
    this.draining = this.drain().finally(() => { this.draining = undefined; });
  }
  private async drain() {
    while (!this.closed) {
      const document = this.store.db.prepare("SELECT id, content FROM documents WHERE status = 'queued' ORDER BY rowid LIMIT 1")
        .get() as { id: string; content: Uint8Array } | undefined;
      if (!document) return;
      this.store.db.prepare("UPDATE documents SET status = 'parsing' WHERE id = ?").run(document.id);
      this.active = parsePdf(document.content);
      const result = await this.active.promise;
      this.active = undefined;
      if (this.closed) return;
      this.store.transaction(() => {
        const current = this.store.db.prepare("SELECT id, reviewId FROM documents WHERE id = ?").get(document.id) as { id: string; reviewId: string } | undefined;
        // Deleting a review during parsing must never resurrect its materials.
        if (!current) return;
        this.store.db.prepare("DELETE FROM pages WHERE documentId = ?").run(document.id);
        let status: DocumentRow["status"] = "failed";
        if (result.pages) {
          const ready = result.pages.filter(page => page.status === "ready").length;
          status = ready === result.pages.length ? "ready" : ready > 0 ? "partial"
            : result.pages.some(page => page.status === "needs_ocr") ? "needs_ocr" : "failed";
          for (const page of result.pages) {
            this.store.db.prepare("INSERT INTO pages (documentId, pageIndex, printedPageLabel, text, status) VALUES (?, ?, ?, ?, ?)")
              .run(document.id, page.pageIndex, page.printedPageLabel, page.text, page.status);
            blocks(page.text).forEach((quote, index) => {
              const sourceId = `${document.id}:p${page.pageIndex}:b${index + 1}`;
              this.store.db.prepare("INSERT INTO sources (id, documentId, pageIndex, blockId, quote) VALUES (?, ?, ?, ?, ?)")
                .run(sourceId, document.id, page.pageIndex, `b${index + 1}`, quote);
            });
          }
        }
        this.store.db.prepare("UPDATE documents SET status = ?, pageCount = ?, errorCode = ? WHERE id = ?")
          .run(status, result.pages?.length ?? null, result.error ?? null, document.id);
        this.store.db.prepare("UPDATE reviews SET revision = revision + 1 WHERE id = ?").run(current.reviewId);
      });
    }
  }
  async close() {
    this.closed = true;
    this.active?.stop();
    await this.draining;
  }
}
