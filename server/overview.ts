import type { ResolvedCitation, ReportView } from "./report.js";

// The report can be long: findings, comparisons, scenarios, broker claims, requests. Before the
// user scrolls through all of it they need the short list of things that actually need a decision.
// This module picks that list deterministically from the published report — the model never writes
// the summary, so the order and the wording cannot drift away from the evidence.
export type OverviewKind =
  | "broker_conflict" | "broker_overstated" | "promotion_conflict"
  | "unsupported_claim" | "cannot_confirm" | "scenario_caveat" | "need_material";

export type OverviewItem = {
  kind: OverviewKind;
  title: string;
  detail: string;
  citations: ResolvedCitation[];
};

export type Overview = {
  items: OverviewItem[];
  remaining: number;
  integrity: {cited: number; verified: number; missing: number};
};

const MAX_ITEMS = 3;

type OverviewInput = Pick<ReportView,
  "findings" | "comparisons" | "scenarios" | "brokerClaims" | "requests" | "review" | "citationIntegrity">;

// A claim the reviewer could not back with the quoted passage outranks an open question: it is a
// published statement that may be wrong, not a gap that is honestly declared.
function unsupportedIndexes(view: OverviewInput) {
  return new Set((view.review?.items ?? [])
    .filter(item => item.verdict === "unsupported" || item.verdict === "quote_mismatch")
    .map(item => item.index));
}

function candidates(view: OverviewInput): OverviewItem[] {
  const items: OverviewItem[] = [];
  for (const claim of view.brokerClaims) {
    if (claim.verdict === "contradicted") {
      items.push({
        kind: "broker_conflict",
        title: "經紀說的和條款原文不一致",
        detail: `${claim.explanation}（經紀原話：「${claim.brokerQuote}」）`,
        citations: [...claim.broker, ...claim.contract],
      });
    } else if (claim.verdict === "overstated") {
      items.push({
        kind: "broker_overstated",
        title: "經紀的說法比條款寬鬆",
        detail: `${claim.explanation}（經紀原話：「${claim.brokerQuote}」）`,
        citations: [...claim.broker, ...claim.contract],
      });
    }
  }
  for (const comparison of view.comparisons) {
    if (comparison.relation !== "apparent_conflict") continue;
    items.push({
      kind: "promotion_conflict",
      title: "宣傳材料與條款有衝突",
      detail: comparison.explanation,
      citations: [...comparison.marketing, ...comparison.contract],
    });
  }
  const unsupported = unsupportedIndexes(view);
  view.findings.forEach((finding, index) => {
    if (!unsupported.has(index)) return;
    const note = view.review?.items.find(item => item.index === index)?.note ?? "";
    items.push({
      kind: "unsupported_claim",
      title: "引用的原文不支持這條結論",
      detail: `${note}（結論：${finding.explanation}）`,
      citations: finding.citations,
    });
  });
  for (const finding of view.findings) {
    if (finding.evidenceStatus !== "unknown") continue;
    items.push({
      kind: "cannot_confirm",
      title: "以目前的材料無法確認",
      detail: finding.explanation,
      citations: finding.citations,
    });
  }
  for (const scenario of view.scenarios) {
    if (scenario.status !== "insufficient_information") continue;
    items.push({
      kind: "scenario_caveat",
      title: `情境「${scenario.question}」缺條件，無法比較`,
      detail: scenario.detail,
      citations: scenario.citations,
    });
  }
  for (const request of view.requests) {
    items.push({
      kind: "need_material",
      title: "要你補充材料",
      detail: `${request.message}（${request.requestedRole}）`,
      citations: [],
    });
  }
  return items;
}

// Only the first few items are shown; "remaining" tells the client how much of the short list was
// left over so the count stays honest when the report is trimmed.
export function buildOverview(view: OverviewInput): Overview {
  const all = candidates(view);
  return {
    items: all.slice(0, MAX_ITEMS),
    remaining: Math.max(0, all.length - MAX_ITEMS),
    integrity: {...view.citationIntegrity},
  };
}
