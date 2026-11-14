import assert from "node:assert/strict";
import test from "node:test";

import { buildOverview } from "../overview.js";
import type { OverviewKind } from "../overview.js";

type Input = Parameters<typeof buildOverview>[0];

function citation(sourceId: string) {
  return {sourceId, documentId: "doc", documentName: "policy.pdf", role: "contract",
    pageIndex: 1, pageLabel: null, quote: "Delay exceeding 6 hours.", status: "verified" as const};
}

function view(overrides: Partial<Input> = {}): Input {
  return {
    findings: [], comparisons: [], scenarios: [], brokerClaims: [], requests: [],
    review: null,
    citationIntegrity: {cited: 0, verified: 0, missing: 0},
    ...overrides,
  } as unknown as Input;
}

test("the overview leads with claims the evidence contradicts", () => {
  const overview = buildOverview(view({
    brokerClaims: [
      {verdict: "contradicted", brokerQuote: "延誤三小時就賠", contractQuote: "Delay exceeding 6 hours.",
        explanation: "條款門檻是 6 小時", broker: [citation("chat:p1:b1")], contract: [citation("doc:p1:b1")]},
      {verdict: "overstated", brokerQuote: "全部都賠", contractQuote: "Maximum benefit 1000.",
        explanation: "有上限", broker: [citation("chat:p1:b2")], contract: [citation("doc:p1:b2")]},
    ] as never,
    comparisons: [{relation: "apparent_conflict", marketingQuote: "No exclusions", contractQuote: "Skiing excluded",
      explanation: "宣傳說沒有除外", marketing: [citation("promo:p1:b1")], contract: [citation("doc:p2:b1")]} as never],
    findings: [{explanation: "延誤 6 小時以上有保障", evidenceStatus: "document_supported", sourceIds: ["doc:p1:b1"],
      citations: [citation("doc:p1:b1")]}],
    citationIntegrity: {cited: 3, verified: 3, missing: 0},
  }));

  const kinds = overview.items.map(item => item.kind as OverviewKind);
  // Only three items are shown, and they must be the alarming ones rather than the neutral finding.
  assert.deepEqual(kinds, ["broker_conflict", "broker_overstated", "promotion_conflict"]);
  assert.equal(overview.remaining, 0);
  assert.equal(overview.items[0].detail.includes("經紀原話"), true);
  assert.equal(overview.items[2].citations.length, 2);
});

test("a claim the quotes do not support outranks an open gap, and the cap is honest", () => {
  const overview = buildOverview(view({
    review: {status: "issues_found", checkedAt: "2026-11-14T00:00:00.000Z", items: [
      {index: 0, verdict: "unsupported", note: "引用原文只提到延誤，沒有提到金額"},
    ]} as never,
    findings: [
      {explanation: "最高賠付 1000", evidenceStatus: "document_supported", sourceIds: ["doc:p1:b1"], citations: [citation("doc:p1:b1")]},
      {explanation: "滑雪是否保障仍未知", evidenceStatus: "unknown", sourceIds: [], citations: []},
      {explanation: "醫療費用上限仍未知", evidenceStatus: "unknown", sourceIds: [], citations: []},
      {explanation: "行李延誤是否重複賠付仍未知", evidenceStatus: "unknown", sourceIds: [], citations: []},
    ],
    requests: [{message: "請提供完整條款正文", requestedRole: "contract"}],
  }));

  assert.deepEqual(overview.items.map(item => item.kind), ["unsupported_claim", "cannot_confirm", "cannot_confirm"]);
  // One unsupported claim + three unknown findings + one request = five candidates, three shown.
  assert.equal(overview.remaining, 2);
});

test("an empty report produces no overview at all", () => {
  const overview = buildOverview(view());
  assert.deepEqual(overview.items, []);
  assert.equal(overview.remaining, 0);
  assert.deepEqual(overview.integrity, {cited: 0, verified: 0, missing: 0});
});

test("a scenario without enough conditions becomes an item, a satisfied one does not", () => {
  const base = {assumption: "如果延誤 9 小時", thresholdQuote: "as specified in the Table of Benefits",
    actualValue: 9, actualUnit: "hours", unknowns: ["起算時間"], citations: [citation("doc:p1:b1")]};
  const overview = buildOverview(view({
    scenarios: [
      {...base, question: "如果延誤 9 小時？", status: "insufficient_information", detail: "門檻在附表"},
      {...base, question: "如果延誤 8 小時？", status: "satisfied", detail: "符合門檻"},
    ] as never,
  }));
  assert.equal(overview.items.length, 1);
  assert.equal(overview.items[0].kind, "scenario_caveat");
  assert.equal(overview.items[0].title.includes("如果延誤 9 小時"), true);
});

test("citations are resolved the same way as the rest of the report", () => {
  const overview = buildOverview(view({
    findings: [{explanation: "這項無法確認", evidenceStatus: "unknown", sourceIds: ["doc:p1:b1"],
      citations: [citation("doc:p1:b1")]}],
  }));
  assert.equal(overview.items[0].citations[0].status, "verified");
  assert.equal(overview.items[0].citations[0].quote, "Delay exceeding 6 hours.");
  assert.equal(citation("doc:p1:b1").sourceId, overview.items[0].citations[0].sourceId);
});
