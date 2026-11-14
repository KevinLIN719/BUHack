import test from "node:test";
import assert from "node:assert/strict";
import { sampleSourcesForIntake, resolveOutputLanguage, alignCitation } from "../v3.js";

test("resolveOutputLanguage strictly follows UI language unless userNote switches language", () => {
  assert.equal(resolveOutputLanguage("en", ""), "en");
  assert.equal(resolveOutputLanguage("zh-HK", ""), "zh-HK");
  assert.equal(resolveOutputLanguage("zh-CN", ""), "zh-CN");

  // UI is English, user types Chinese -> overrides to Traditional Chinese
  assert.equal(resolveOutputLanguage("en", "去旅行超過一個月屋企無人住賠唔賠？"), "zh-HK");

  // UI is Chinese, user types English sentence -> overrides to English
  assert.equal(resolveOutputLanguage("zh-HK", "What happens if my flat is unoccupied for 45 days?"), "en");

  // Same language stays unchanged
  assert.equal(resolveOutputLanguage("zh-HK", "漏水墊底費幾多錢？"), "zh-HK");
  assert.equal(resolveOutputLanguage("en", "Does it cover laptop theft outside home?"), "en");
});

test("sampleSourcesForIntake spreads across opening, middle and closing pages", () => {
  const sources = Array.from({ length: 54 }, (_, i) => {
    const pageIndex = i + 1;
    let quote = `General paragraph on page ${pageIndex}.`;
    if (pageIndex === 1) quote = "PREMIER HOME COMPREHENSIVE INSURANCE POLICY";
    if (pageIndex === 12) quote = "This Policy does not cover wear and tear or gradual seepage.";
    if (pageIndex === 35) quote = "未得本公司書面同意下連續 14 日以上無人居住的住所內家居財物損失不保。";
    if (pageIndex === 50) quote = "賠償限額表：家居財物最高賠償額 HK$1,000,000，每件上限 HK$5,000。";
    return { sourceId: `doc:p${pageIndex}:b1`, pageIndex, quote };
  });

  const sampled = sampleSourcesForIntake(sources);
  assert.ok(sampled.length >= 6 && sampled.length <= 16);
  const pages = sampled.map(s => s.pageIndex);
  assert.ok(pages.includes(1), "includes opening page");
  assert.ok(pages.includes(35), "includes Chinese exclusion/unoccupied threshold in second half");
  assert.ok(pages.includes(50), "includes schedule table near end of document");
});

test("alignCitation resolves verbatim substring across whitespace differences", () => {
  const sources = [
    { sourceId: "doc:p25:b1", pageIndex: 25, quote: "1. HOME CONTENTS\n300,000/event   600,000/event   1,000,000/event" },
    { sourceId: "doc:p33:b2", pageIndex: 33, quote: "保障因住所被爆竊或行劫而引致現金損失，惟必須在發現該等損失後 24 小時內報警。" },
  ];
  const hit = alignCitation("wrong-id", "保障因住所被爆竊或行劫而引致現金損失，惟必須在發現該等損失後24小時內報警。", sources);
  assert.equal(hit.sourceId, "doc:p33:b2");
  assert.equal(hit.page, 33);
});

test("alignCitation flags a quote that is not in the policy instead of passing off another sentence", async () => {
  const { alignCitation } = await import("../v3.js");
  const sources = [
    { sourceId: "d1:p1:b1", pageIndex: 1, quote: "任何索償通知書必須在意外發生後十四天內送交本公司。" },
    { sourceId: "d1:p2:b1", pageIndex: 2, quote: "門診每次港幣 150 元。" },
  ];
  const hit = alignCitation("d1:p1:b1", "必須在意外發生後十四天內", sources);
  assert.equal(hit.found, true);
  assert.equal(hit.page, 1);
  const elsewhere = alignCitation("d1:p1:b1", "門診每次港幣 150 元", sources);
  assert.equal(elsewhere.found, true);
  assert.equal(elsewhere.sourceId, "d1:p2:b1");
  const missing = alignCitation("d1:p1:b1", "三個月內通知就可以", sources);
  assert.equal(missing.found, false);
  const strict = alignCitation("", "三個月內通知就可以", sources, { strict: true });
  assert.equal(strict.found, false);
  assert.equal(strict.quote, "三個月內通知就可以");
});

test("toWrittenChinese rewrites Cantonese colloquialisms only", async () => {
  const { toWrittenChinese } = await import("../v3.js");
  assert.equal(toWrittenChinese("屋企冇人，睇醫生唔賠嘅"), "家裏沒有人，看醫生不賠的");
  assert.equal(toWrittenChinese("門診每次只賠 150 元"), "門診每次只賠 150 元");
});
