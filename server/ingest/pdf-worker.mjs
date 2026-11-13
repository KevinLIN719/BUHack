import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Only file bytes are passed in; document links/scripts are never executed.
const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("pdfjs-dist/package.json"));
const task = getDocument({
  data: workerData.bytes,
  stopAtErrors: true,
  disableFontFace: true,
  useSystemFonts: false,
  standardFontDataUrl: join(packageDir, "standard_fonts").split(sep).join("/") + "/",
  cMapUrl: join(packageDir, "cmaps").split(sep).join("/") + "/",
  cMapPacked: true,
});

try {
  const pdf = await task.promise;
  if (pdf.numPages > workerData.maxPages) {
    parentPort.postMessage({ error: "PAGE_LIMIT" });
  } else {
    const labels = await pdf.getPageLabels().catch(() => null);
    const pages = [];
    let totalCharacters = 0;
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      try {
        const page = await pdf.getPage(pageIndex);
        const content = await page.getTextContent();
        const lines = [];
        let line = "", previousY;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (line && previousY !== undefined && Math.abs(y - previousY) > 3) {
            lines.push(line.trim()); line = "";
          }
          const adjacentCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(line)
            && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(item.str);
          line += (line && item.str && !adjacentCjk && !/\s$/.test(line) && !/^\s/.test(item.str) ? " " : "") + item.str;
          previousY = y;
          if (item.hasEOL) { lines.push(line.trim()); line = ""; }
        }
        if (line.trim()) lines.push(line.trim());
        const text = lines.filter(Boolean).join("\n").replace(/\u0000/g, "").trim();
        totalCharacters += text.length;
        if (totalCharacters > 1_000_000) throw new Error("TEXT_LIMIT");
        pages.push({ pageIndex, printedPageLabel: labels?.[pageIndex - 1] ?? null,
          text, status: text ? "ready" : "needs_ocr" });
        page.cleanup();
      } catch (error) {
        if (error?.message === "TEXT_LIMIT") throw error;
        pages.push({ pageIndex, printedPageLabel: labels?.[pageIndex - 1] ?? null,
          text: "", status: "failed" });
      }
    }
    parentPort.postMessage({ pages });
  }
} catch (error) {
  const code = error?.name === "PasswordException" ? "PASSWORD_REQUIRED"
    : error?.message === "TEXT_LIMIT" ? "TEXT_LIMIT" : "INVALID_PDF";
  parentPort.postMessage({ error: code });
} finally {
  await task.destroy();
}
