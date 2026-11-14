import type { Store } from "./store.js";

// The stored report only carries source ids. The web client needs to place every claim on a
// page, so this module resolves the ids against the material that is still in the review.
// A citation whose source was deleted after the report was published is reported as
// "missing" instead of being dropped: the report must not silently change.
export type ResolvedCitation = {
  sourceId: string; documentId: string; documentName: string; role: string;
  pageIndex: number; pageLabel: string | null; quote: string;
  status: "verified" | "missing";
};
type StoredReport = {
  findings: {explanation: string; evidenceStatus: string; sourceIds: string[]}[];
  openQuestions: string[];
  requests: {message: string; requestedRole: string}[];
  comparisons?: {relation: string; marketingQuote: string; contractQuote?: string; explanation: string;
    marketingSourceIds: string[]; contractSourceIds?: string[]}[];
  droppedComparisons?: number;
  scenarios?: {question: string; assumption: string; thresholdQuote: string; ruleSourceIds: string[];
    actualValue: number; actualUnit: string; status: string; detail: string; unknowns: string[]}[];
  droppedScenarios?: number;
  brokerClaims?: {verdict: string; brokerQuote: string; contractQuote: string; brokerSourceIds: string[];
    contractSourceIds: string[]; explanation: string}[];
  droppedBrokerClaims?: number;
  sources?: {sourceId: string; documentId: string; pageIndex: number; quote: string; role: string}[];
  coverage?: {id: string; status: string; pageCount: number | null}[];
  verification?: string;
  review?: {status: string; items: {index: number; verdict: string; note: string}[]; checkedAt: string};
};
type SourceRow = {
  sourceId: string; documentId: string; pageIndex: number; quote: string;
  documentName: string; role: string; pageLabel: string | null;
};

function sourceLookup(store: Store, reviewId: string) {
  return new Map((store.db.prepare(`SELECT s.id AS sourceId, s.documentId, s.pageIndex, s.quote,
      d.name AS documentName, d.role, p.printedPageLabel AS pageLabel
    FROM sources s JOIN documents d ON d.id = s.documentId
    LEFT JOIN pages p ON p.documentId = s.documentId AND p.pageIndex = s.pageIndex
    WHERE d.reviewId = ?`).all(reviewId) as SourceRow[]).map(row => [row.sourceId, row]));
}

export type ReportView = {
  runId: string; runStatus: string; inputRevision: number; createdAt: string;
  findings: (StoredReport["findings"][number] & {citations: ResolvedCitation[]})[];
  comparisons: (NonNullable<StoredReport["comparisons"]>[number] & {marketing: ResolvedCitation[]; contract: ResolvedCitation[]})[];
  droppedComparisons: number;
  scenarios: (NonNullable<StoredReport["scenarios"]>[number] & {citations: ResolvedCitation[]})[];
  droppedScenarios: number;
  brokerClaims: (NonNullable<StoredReport["brokerClaims"]>[number] & {broker: ResolvedCitation[]; contract: ResolvedCitation[]})[];
  droppedBrokerClaims: number;
  openQuestions: string[];
  requests: {message: string; requestedRole: string}[];
  sources: ResolvedCitation[];
  coverage: NonNullable<StoredReport["coverage"]>;
  verification: string | null;
  review: NonNullable<StoredReport["review"]> | null;
  citationIntegrity: {cited: number; verified: number; missing: number};
};

export function latestReportRun(store: Store, reviewId: string) {
  return store.db.prepare(`SELECT r.id AS runId, r.status, r.inputRevision, r.createdAt FROM runs r
    JOIN investigations i ON i.runId = r.id
    WHERE r.reviewId = ? AND i.output IS NOT NULL ORDER BY r.rowid DESC LIMIT 1`)
    .get(reviewId) as {runId: string; status: string; inputRevision: number; createdAt: string} | undefined;
}

// Returns null when the review has no published report yet, so the client can keep its
// empty state instead of inventing content.
export function reportView(store: Store, reviewId: string): ReportView | null {
  const run = latestReportRun(store, reviewId);
  if (!run) return null;
  const saved = store.db.prepare("SELECT output FROM investigations WHERE runId = ?").get(run.runId) as {output: string} | undefined;
  if (!saved?.output) return null;
  let report: StoredReport;
  try { report = JSON.parse(String(saved.output)) as StoredReport; } catch { return null; }
  const lookup = sourceLookup(store, reviewId);
  const cited = new Set<string>();
  const resolve = (sourceId: string): ResolvedCitation => {
    cited.add(sourceId);
    const row = lookup.get(sourceId);
    return row
      ? {...row, status: "verified"}
      : {sourceId, documentId: "", documentName: "", role: "", pageIndex: 0, pageLabel: null, quote: "", status: "missing"};
  };
  const findings = report.findings.map(finding => ({...finding, citations: finding.sourceIds.map(resolve)}));
  const comparisons = (report.comparisons ?? []).map(comparison => ({...comparison,
    marketing: comparison.marketingSourceIds.map(resolve),
    contract: (comparison.contractSourceIds ?? []).map(resolve)}));
  const scenarios = (report.scenarios ?? []).map(scenario => ({...scenario, citations: scenario.ruleSourceIds.map(resolve)}));
  const brokerClaims = (report.brokerClaims ?? []).map(claim => ({...claim,
    broker: claim.brokerSourceIds.map(resolve),
    contract: (claim.contractSourceIds ?? []).map(resolve)}));
  // Keep the report's own source list (with order) but resolve each entry as well.
  const sources = (report.sources ?? []).map(source => resolve(source.sourceId));
  const missing = [...cited].filter(id => !lookup.has(id)).length;
  return {
    runId: run.runId, runStatus: run.status, inputRevision: run.inputRevision, createdAt: run.createdAt,
    findings, comparisons, droppedComparisons: report.droppedComparisons ?? 0,
    scenarios, droppedScenarios: report.droppedScenarios ?? 0,
    brokerClaims, droppedBrokerClaims: report.droppedBrokerClaims ?? 0,
    openQuestions: report.openQuestions, requests: report.requests ?? [],
    sources, coverage: report.coverage ?? [], verification: report.verification ?? null,
    review: report.review ?? null,
    citationIntegrity: {cited: cited.size, verified: cited.size - missing, missing},
  };
}
