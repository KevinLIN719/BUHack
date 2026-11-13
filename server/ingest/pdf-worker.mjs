import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Only file bytes are passed in; document links/scripts are never executed.
//
// Extraction is layout aware on purpose: citations are verbatim substrings of what we store here,
// so a block that mixes a page header into a clause, or that splits a sentence at a fixed character
// count, breaks the "quote must hit the source" invariant for honest answers. The rules follow
// PaperPrism's parser (page-margin noise, column order, hyphen joins, paragraph breaks) but never
// drop text: legal wording has to stay quotable.
const HEADER_FOOTER_RATIO = 0.06;
const LINE_TOLERANCE = 2.5;
const MIN_COLUMN_LINES = 4;
const MIN_COLUMN_WIDTH = 60;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

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

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Glyph runs arrive without layout. Wide horizontal gaps separate columns and table cells, so a run
// of text never crosses them: those become separate segments, which is what makes column detection
// possible in the first place.
function intoSegments(items) {
  const runs = items
    .filter((item) => "str" in item && item.str)
    .map((item) => ({
      str: item.str,
      x0: item.transform[4],
      x1: item.transform[4] + (item.width ?? 0),
      y: item.transform[5],
      size: Math.abs(item.transform[3]) || item.height || 0,
    }))
    .sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const segments = [];
  let current = null;
  for (const run of runs) {
    const sameLine = current && Math.abs(current.y - run.y) <= LINE_TOLERANCE;
    const gap = sameLine ? run.x0 - current.x1 : Infinity;
    // A run that starts to the left of the segment it would join means two columns share this
    // baseline; joining them would splice a table cell into the clause beside it.
    const outOfOrder = sameLine && run.x0 < current.x0 - 1;
    const breakGap = sameLine && (gap > Math.max(8, (run.size || 10)) || outOfOrder);
    if (current && sameLine && !breakGap) {
      current.runs.push(run);
      current.y = (current.y * (current.runs.length - 1) + run.y) / current.runs.length;
      current.x1 = Math.max(current.x1, run.x1);
    } else {
      current = { y: run.y, x0: run.x0, x1: run.x1, runs: [run] };
      segments.push(current);
    }
  }
  return segments.map((segment) => {
    let text = "";
    segment.runs.forEach((run, index) => {
      const previous = segment.runs[index - 1];
      const needsSpace = previous && text && !/\s$/.test(text) && !/^\s/.test(run.str)
        && !(CJK.test(text.slice(-1)) && CJK.test(run.str.slice(0, 1)));
      text += (needsSpace ? " " : "") + run.str;
    });
    return {
      text: text.trim(),
      x0: Math.min(...segment.runs.map((run) => run.x0)),
      x1: Math.max(...segment.runs.map((run) => run.x1)),
      y: segment.y,
      size: Math.max(...segment.runs.map((run) => run.size)),
    };
  }).filter((segment) => segment.text);
}

// A two-column page has an empty vertical band (the gutter) that no segment crosses. Cut there when
// the band sits near the content midpoint; recurse on each side so three-column pages work too.
// Tables also contain empty bands, which is why the band closest to the midpoint wins.
function splitAtGutter(segments, depth) {
  if (depth === 0 || segments.length < MIN_COLUMN_LINES * 2) return [segments];
  const contentLeft = Math.min(...segments.map((segment) => segment.x0));
  const contentRight = Math.max(...segments.map((segment) => segment.x1));
  const center = (contentLeft + contentRight) / 2;
  // Full-width headings and rules would bridge the gutter if they took part in the sweep, so the
  // gap search only looks at items narrower than half the content width.
  const sorted = segments
    .filter((segment) => segment.x1 - segment.x0 < (contentRight - contentLeft) * 0.5)
    .sort((a, b) => a.x0 - b.x0);
  if (sorted.length < MIN_COLUMN_LINES * 2) return [segments];
  let best = null;
  let reach = sorted[0].x1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x0 - reach;
    if (gap >= 15) {
      const middle = (reach + sorted[i].x0) / 2;
      if (!best || Math.abs(middle - center) < Math.abs(best.middle - center)) {
        best = { cut: middle, middle };
      }
    }
    reach = Math.max(reach, sorted[i].x1);
  }
  if (!best) return [segments];
  const left = segments.filter((segment) => segment.x1 <= best.cut);
  const right = segments.filter((segment) => segment.x0 >= best.cut);
  const spanning = segments.filter((segment) => segment.x1 > best.cut && segment.x0 < best.cut);
  if (process.env.DEBUG_LAYOUT) {
    const leftWidth = Math.max(...left.map((segment) => segment.x1), 0) - Math.min(...left.map((segment) => segment.x0), Infinity);
    const rightWidth = Math.max(...right.map((segment) => segment.x1), 0) - Math.min(...right.map((segment) => segment.x0), Infinity);
    console.error(`[layout] cut=${Math.round(best.cut)} center=${Math.round(center)} left=${left.length}/${Math.round(leftWidth)} right=${right.length}/${Math.round(rightWidth)} total=${segments.length}`);
  }
  if (left.length < MIN_COLUMN_LINES || right.length < MIN_COLUMN_LINES) return [segments];
  const leftWidth = Math.max(...left.map((segment) => segment.x1)) - Math.min(...left.map((segment) => segment.x0));
  const rightWidth = Math.max(...right.map((segment) => segment.x1)) - Math.min(...right.map((segment) => segment.x0));
  if (leftWidth < MIN_COLUMN_WIDTH || rightWidth < MIN_COLUMN_WIDTH) return [segments];
  if (left.length + right.length + spanning.length !== segments.length) return [segments];
  // Headings that run across the gutter stay whole and are read before the columns they head.
  const head = spanning.length ? [spanning] : [];
  return [...head, left, right];
}

function joinLines(parts) {
  let text = "";
  for (const part of parts) {
    if (!text) { text = part; continue; }
    // A hyphen at the line end usually splits a word; keep it only when the next line starts lower
    // case, otherwise it belongs to the wording (a list dash, or a CJK compound).
    if (/[A-Za-z]-$/.test(text) && /^[a-z]/.test(part)) { text = text.slice(0, -1) + part; continue; }
    const noSpace = /\s$/.test(text) || /^\s/.test(part)
      || (CJK.test(text.slice(-1)) && CJK.test(part.slice(0, 1)));
    text += (noSpace ? "" : " ") + part;
  }
  return text.trim();
}

// Segments sharing a baseline are one table row: keep the cells together, in x order, in one block.
function intoRows(segments) {
  const rows = [];
  for (const segment of [...segments].sort((a, b) => b.y - a.y || a.x0 - b.x0)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - segment.y) <= LINE_TOLERANCE) {
      row.cells.push(segment);
      row.y = (row.y * (row.cells.length - 1) + segment.y) / row.cells.length;
      row.x0 = Math.min(row.x0, segment.x0);
      row.x1 = Math.max(row.x1, segment.x1);
    } else {
      rows.push({ y: segment.y, x0: segment.x0, x1: segment.x1, size: segment.size, cells: [segment] });
    }
  }
  return rows.map((row) => {
    row.cells.sort((a, b) => a.x0 - b.x0);
    return {
      text: row.cells.map((cell) => cell.text).join("  "),
      x0: row.x0,
      x1: row.x1,
      y: row.y,
      size: row.size,
      tableRow: row.cells.length > 1,
    };
  });
}

// Paragraph breaks: a gap clearly wider than this page's usual line gap, or an indented line whose
// predecessor stopped short of the right edge. Table rows always stand alone so they never get
// glued into the clause above them.
function intoParagraphs(rows) {
  if (!rows.length) return [];
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i - 1].y - rows[i].y - (rows[i].size || 10);
    if (gap > 0) gaps.push(gap);
  }
  const typical = median(gaps) || 0;
  const paragraphs = [];
  let current = [];
  let minX0 = 0;
  let maxX1 = 0;
  for (const row of rows) {
    if (current.length) {
      const previous = current[current.length - 1];
      const gap = previous.y - row.y - (row.size || 10);
      const gapBreak = typical > 0 && gap > typical * 1.6;
      const indentBreak = row.x0 - minX0 > 8 && maxX1 - previous.x1 > 8;
      if (gapBreak || indentBreak || row.tableRow || previous.tableRow) {
        paragraphs.push(current);
        current = [];
      }
    }
    current.push(row);
    minX0 = current.length === 1 ? row.x0 : Math.min(minX0, row.x0);
    maxX1 = Math.max(maxX1, row.x1);
  }
  if (current.length) paragraphs.push(current);
  return paragraphs.map((group) => joinLines(group.map((row) => row.text))).filter(Boolean);
}

async function extractPage(page) {
  const content = await page.getTextContent();
  const view = page.view ?? [0, 0, 612, 792];
  const height = Math.abs(view[3] - view[1]) || 792;
  const segments = intoSegments(content.items).filter((segment) =>
    segment.y > height * HEADER_FOOTER_RATIO && segment.y < height * (1 - HEADER_FOOTER_RATIO));
  if (!segments.length) return { text: "", blocks: [] };
  const columns = splitAtGutter(segments, 1);
  if (process.env.DEBUG_LAYOUT) {
    console.error(`[layout] page ${page.pageIndex ?? "?"} segments=${segments.length} columns=${columns.length} sizes=${columns.map((c) => c.length).join(",")}`);
    if (columns.length > 1) console.error(`[layout] boundaries=${columns.map((c) => `${Math.round(Math.min(...c.map((s) => s.x0)))}-${Math.round(Math.max(...c.map((s) => s.x1)))}`).join(" | ")}`);
  }
  const blocks = [];
  columns.forEach((column, index) => {
    const columnBlocks = intoParagraphs(intoRows(column));
    if (process.env.DEBUG_LAYOUT) console.error(`[layout] col ${index} segs=${column.length} blocks=${columnBlocks.length} first=${JSON.stringify((columnBlocks[0] ?? "").slice(0, 80))}`);
    for (const block of columnBlocks) blocks.push(block);
  });
  return { text: blocks.join("\n\n"), blocks };
}

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
        const extracted = await extractPage(page);
        totalCharacters += extracted.text.length;
        if (totalCharacters > 1_000_000) throw new Error("TEXT_LIMIT");
        pages.push({ pageIndex, printedPageLabel: labels?.[pageIndex - 1] ?? null,
          text: extracted.text, blocks: extracted.blocks,
          status: extracted.text ? "ready" : "needs_ocr" });
        page.cleanup();
      } catch (error) {
        if (error?.message === "TEXT_LIMIT") throw error;
        pages.push({ pageIndex, printedPageLabel: labels?.[pageIndex - 1] ?? null,
          text: "", blocks: [], status: "failed" });
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
