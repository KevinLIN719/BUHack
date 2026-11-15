import test from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { PDFDocument } from "pdf-lib";
import { Store } from "../store.js";
import { importScannedPages, recognizeScanPage, ScanImportError, type ScanImage, type ScanPageReading } from "../scan-ocr.js";
import { gatewayConfigured, textModelConfigured, textModel, scanModel } from "../models.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=", "base64");
const image = (id = "page-1"): ScanImage => ({ id, name: id + ".png", mimeType: "image/png", bytes: png });
const reading = (text = "每次索償自負額為港幣 500 元。"): ScanPageReading => ({ blocks: [{ text, uncertain: false }], unreadable: false, warning: "" });
function fixture() { const store = new Store(":memory:"); return { store, review: store.createReview("owner") }; }
function mockModel(output: unknown, inspect?: (options: unknown) => void) {
  return new MockLanguageModelV4({ doGenerate: async options => {
    inspect?.(options);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
      warnings: [],
    };
  } });
}

test("OCR uses image input and persists a separate original-image PDF with citable transcription", async () => {
  const { store, review } = fixture();
  try {
    let modelInput = "";
    const document = await importScannedPages(store, review.id, [image()], {
      name: "我的照片", model: mockModel(reading(), options => { modelInput = JSON.stringify(options); }),
    });
    assert.match(modelInput, /image/);
    assert.match(modelInput, /逐字/);
    assert.equal(document.status, "ready");
    assert.equal(document.sourceType, "scan");
    assert.equal(document.mediaType, "application/pdf");
    assert.equal(document.name, "我的照片.pdf");
    const source = store.db.prepare("SELECT * FROM sources WHERE documentId = ?").get(document.id)!;
    assert.equal(source.quote, reading().blocks[0].text);
    assert.equal(source.pageIndex, 1);
    const page = store.db.prepare("SELECT text FROM pages WHERE documentId = ?").get(document.id)!;
    assert.match(String(page.text), /OCR 識別文字/);
    const raw = store.db.prepare("SELECT content FROM documents WHERE id = ?").get(document.id)!;
    const pdf = await PDFDocument.load(raw.content as Uint8Array);
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(store.getReview(review.id, "owner")?.revision, 2);
  } finally { store.close(); }
});

test("uncertain OCR is visible for checking but excluded from the agent's verbatim sources", async () => {
  const { store, review } = fixture();
  try {
    const document = await importScannedPages(store, review.id, [image()], {
      recognize: async () => ({ blocks: [
        { text: "保障期為一年。", uncertain: false },
        { text: "最高限額 [無法辨識] 元。", uncertain: false },
        { text: "疑似不保的字眼。", uncertain: true },
      ], unreadable: false, warning: "金額模糊，請重拍。" }),
    });
    assert.equal(document.status, "partial");
    assert.equal(document.errorCode, "OCR_REVIEW_REQUIRED");
    const sources = store.db.prepare("SELECT quote FROM sources WHERE documentId = ?").all(document.id);
    assert.deepEqual(sources.map(row => row.quote), ["保障期為一年。"]);
    const page = store.db.prepare("SELECT text,status FROM pages WHERE documentId = ?").get(document.id)!;
    assert.match(String(page.text), /無法辨識/);
    assert.equal(page.status, "needs_ocr");
  } finally { store.close(); }
});

test("an unreadable page remains in the original PDF without producing invented sources", async () => {
  const { store, review } = fixture();
  try {
    const doc = await importScannedPages(store, review.id, [image()], { recognize: async () => ({ blocks: [], unreadable: true, warning: "反光遮擋" }) });
    assert.equal(doc.status, "needs_ocr");
    assert.equal(doc.pageCount, 1);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM sources").get()!.n, 0);
    assert.match(String(store.db.prepare("SELECT text FROM pages").get()!.text), /反光/);
  } finally { store.close(); }
});

test("same ordered images deduplicate before another OCR call; multiple pages preserve their order", async () => {
  const { store, review } = fixture();
  let calls = 0;
  try {
    const options = { recognize: async (_image: ScanImage, index: number) => { calls++; return reading(`第 ${index + 1} 頁文字。`); } };
    const pages = [image("one"), image("two")];
    const first = await importScannedPages(store, review.id, pages, options);
    const second = await importScannedPages(store, review.id, pages, options);
    assert.equal(first.id, second.id);
    assert.equal(calls, 2);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM documents").get()!.n, 1);
    assert.deepEqual(store.db.prepare("SELECT quote FROM sources ORDER BY pageIndex").all().map(row => row.quote), ["第 1 頁文字。", "第 2 頁文字。"]);
  } finally { store.close(); }
});

test("upstream OCR failure does not persist a partial document or increment review revision", async () => {
  const { store, review } = fixture();
  try {
    await assert.rejects(importScannedPages(store, review.id, [image()], { recognize: async () => { throw new Error("upstream unavailable"); } }), /upstream unavailable/);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM documents").get()!.n, 0);
    assert.equal(store.getReview(review.id, "owner")?.revision, 1);
  } finally { store.close(); }
});

test("a review deleted or a request aborted during recognition cannot be resurrected", async () => {
  const { store, review } = fixture();
  try {
    await assert.rejects(importScannedPages(store, review.id, [image()], { recognize: async () => {
      store.db.prepare("DELETE FROM reviews WHERE id = ?").run(review.id); return reading();
    } }), error => error instanceof ScanImportError && error.code === "REVIEW_NOT_FOUND");
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM documents").get()!.n, 0);
    const second = store.createReview("owner");
    const controller = new AbortController();
    await assert.rejects(importScannedPages(store, second.id, [image()], { signal: controller.signal, recognize: async () => {
      controller.abort(); return reading();
    } }), error => error instanceof Error && error.name === "AbortError");
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM documents").get()!.n, 0);
  } finally { store.close(); }
});

test("page count, image magic, dimensions and byte limits are checked before OCR", async () => {
  const { store, review } = fixture();
  let calls = 0;
  const options = { recognize: async () => { calls++; return reading(); } };
  try {
    for (const pages of [[], Array.from({ length: 21 }, () => image()), [{ ...image(), bytes: new Uint8Array() }], [{ ...image(), bytes: new Uint8Array(3 * 1024 * 1024 + 1) }], [{ ...image(), bytes: Buffer.from("not an image") }]]) {
      await assert.rejects(importScannedPages(store, review.id, pages, options), ScanImportError);
    }
    const huge = Buffer.from(png); huge.writeUInt32BE(12001, 16);
    await assert.rejects(importScannedPages(store, review.id, [{ ...image(), bytes: huge }], options), error => error instanceof ScanImportError && error.code === "SCAN_IMAGE_DIMENSIONS");
    assert.equal(calls, 0);
  } finally { store.close(); }
});

test("OCR schema rejects malformed model output rather than silently generating sources", async () => {
  await assert.rejects(recognizeScanPage(image(), { model: mockModel({ summary: "Not a transcription" }) }));
});

test("OCR keeps bounded output validation outside the provider generation grammar", async () => {
  let requestSchema = "";
  await recognizeScanPage(image(), { model: mockModel(reading(), options => { requestSchema = JSON.stringify(options); }) });
  assert.doesNotMatch(requestSchema, /maxItems|maxLength/);
  await assert.rejects(recognizeScanPage(image(), { model: mockModel({ ...reading(), blocks: Array.from({ length: 301 }, () => ({ text: "a", uncertain: false })) }) }));
  await assert.rejects(recognizeScanPage(image(), { model: mockModel(reading("a".repeat(6001))) }));
});

test("model configuration preserves explicit DeepSeek settings and supports Gateway OIDC", () => {
  const names = ["DEEPSEEK_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "VERCEL", "POLICY_LENS_TEXT_MODEL", "POLICY_LENS_OCR_MODEL", "POLICY_LENS_GOOGLE_TEXT_MODEL", "POLICY_LENS_GOOGLE_OCR_MODEL"];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.equal(gatewayConfigured(), false); assert.equal(textModelConfigured(), false);
    process.env.VERCEL = "1";
    process.env.POLICY_LENS_TEXT_MODEL = "deepseek/deepseek-v3.1";
    process.env.POLICY_LENS_OCR_MODEL = "google/gemini-2.5-flash";
    assert.equal(gatewayConfigured(), true); assert.equal(textModelConfigured(), true);
    assert.equal((textModel() as { modelId: string }).modelId, "deepseek/deepseek-v3.1");
    assert.equal((scanModel() as { modelId: string }).modelId, "google/gemini-2.5-flash");
    process.env.DEEPSEEK_API_KEY = "test-only-not-a-real-key";
    assert.equal((textModel() as { provider: string }).provider, "deepseek.chat");
    delete process.env.DEEPSEEK_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-only-not-a-real-key";
    assert.match((textModel() as { provider:string }).provider,/^google/);
    assert.equal((scanModel() as { modelId:string }).modelId,"gemini-3.6-flash");
  } finally {
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});
