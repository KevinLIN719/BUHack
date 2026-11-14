import type { Store } from "./store.js";
import { compareReports } from "./report-changes.js";
import type { BoundaryExperiment } from "./boundary.js";

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
  boundaryExperiments?: BoundaryExperiment[];
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
  supersedes?: {previousIndex: number; previousConclusion: string; previousEvidenceStatus: string;
    previousSourceIds: string[]; verdict: string; explanation: string; currentIndex: number;
    newSourceIds: string[]}[];
  supersedesUnchecked?: number;
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
  kind: string; goal: string; parentRunId: string | null;
  boundaryExperiments: (BoundaryExperiment & {citations: ResolvedCitation[]})[];
  changes: (ReturnType<typeof compareReports> & {previousRunId: string; previousRevision: number;
    previousFindings: ReportView["findings"]; newDocuments: {id: string; name: string; role: string}[];
    changedContextFields: string[]}) | null;
  runId: string; runStatus: string; inputRevision: number; createdAt: string;
  findings: (StoredReport["findings"][number] & {citations: ResolvedCitation[]})[];
  comparisons: (NonNullable<StoredReport["comparisons"]>[number] & {marketing: ResolvedCitation[]; contract: ResolvedCitation[]})[];
  droppedComparisons: number;
  scenarios: (NonNullable<StoredReport["scenarios"]>[number] & {citations: ResolvedCitation[]})[];
  droppedScenarios: number;
  brokerClaims: (NonNullable<StoredReport["brokerClaims"]>[number] & {broker: ResolvedCitation[]; contract: ResolvedCitation[]})[];
  droppedBrokerClaims: number;
  // What the newer report says about the older one: the earlier conclusion text is stored next to
  // the new verdict, so the client can show both sides without refetching the parent run.
  supersedes: (NonNullable<StoredReport["supersedes"]>[number] & {previous: ResolvedCitation[]; current: ResolvedCitation[]})[];
  supersedesUnchecked: number;
  openQuestions: string[];
  requests: {message: string; requestedRole: string}[];
  sources: ResolvedCitation[];
  coverage: NonNullable<StoredReport["coverage"]>;
  verification: string | null;
  review: NonNullable<StoredReport["review"]> | null;
  citationIntegrity: {cited: number; verified: number; missing: number};
};

// Newest material version wins: a report built from revision 3 must keep the slot even when an
// older run from revision 2 finishes later.
export function latestReportRun(store: Store, reviewId: string) {
  return store.db.prepare(`SELECT r.id AS runId, r.status, r.inputRevision, r.createdAt FROM runs r
    JOIN investigations i ON i.runId = r.id
    WHERE r.reviewId = ? AND i.output IS NOT NULL
    ORDER BY r.inputRevision DESC, r.rowid DESC LIMIT 1`)
    .get(reviewId) as {runId: string; status: string; inputRevision: number; createdAt: string} | undefined;
}

// Returns null when the review has no published report yet, so the client can keep its
// empty state instead of inventing content.
export function reportView(store: Store, reviewId: string, runId?: string): ReportView | null {
  const selected = runId ?? latestReportRun(store, reviewId)?.runId;
  const row = selected && store.getRun(selected, reviewId);
  const run = row && {...row, runId: row.id};
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
  const supersedes = (report.supersedes ?? []).map(item => ({...item,
    previous: item.previousSourceIds.map(resolve),
    current: item.newSourceIds.map(resolve)}));
  // Keep the report's own source list (with order) but resolve each entry as well.
  const sources = (report.sources ?? []).map(source => resolve(source.sourceId));
  const boundaryExperiments = (report.boundaryExperiments ?? []).map(item => ({...item, citations: [resolve(item.sourceId)]}));
  let changes: ReportView["changes"] = null;
  if (run.parentRunId) {
    const parent = store.getRun(run.parentRunId, reviewId);
    const prior = parent && store.db.prepare("SELECT output, snapshot FROM investigations WHERE runId = ?").get(parent.id) as {output: string | null; snapshot: string} | undefined;
    const current = store.db.prepare("SELECT snapshot FROM investigations WHERE runId = ?").get(run.id) as {snapshot: string};
    if (parent && prior?.output) {
      const before = JSON.parse(prior.output) as StoredReport;
      const oldInput = JSON.parse(prior.snapshot);
      const newInput = JSON.parse(current.snapshot);
      const oldIds = new Set(oldInput.documents.map((doc: {id: string}) => doc.id));
      const contextValue = (value: unknown) => value === undefined || value === "" || (Array.isArray(value) && !value.length) ? null : value;
      changes = {...compareReports({...before, requests: before.requests ?? []}, {...report, requests: report.requests ?? []}),
        previousRunId: parent.id, previousRevision: parent.inputRevision,
        previousFindings: before.findings.map(finding => ({...finding, citations: finding.sourceIds.map(id => {
          const source = lookup.get(id);
          return source ? {...source, status: "verified" as const} : {sourceId:id, documentId:"", documentName:"", role:"", pageIndex:0, pageLabel:null, quote:"", status:"missing" as const};
        })})),
        newDocuments: newInput.documents.filter((doc: {id: string}) => !oldIds.has(doc.id)).map((doc: {id: string; name: string; role: string}) => ({id:doc.id, name:doc.name, role:doc.role})),
        changedContextFields: [...new Set([...Object.keys(oldInput.context), ...Object.keys(newInput.context)])]
          .filter(field => JSON.stringify(contextValue(oldInput.context[field])) !== JSON.stringify(contextValue(newInput.context[field]))),
      };
    }
  }
  const allMissing = [...cited].filter(id => !lookup.has(id)).length;
  return {
    kind: run.kind, goal: run.goal, parentRunId: run.parentRunId,
    boundaryExperiments, changes,
    runId: run.runId, runStatus: run.status, inputRevision: run.inputRevision, createdAt: run.createdAt,
    findings, comparisons, droppedComparisons: report.droppedComparisons ?? 0,
    scenarios, droppedScenarios: report.droppedScenarios ?? 0,
    brokerClaims, droppedBrokerClaims: report.droppedBrokerClaims ?? 0,
    supersedes, supersedesUnchecked: report.supersedesUnchecked ?? 0,
    openQuestions: report.openQuestions, requests: report.requests ?? [],
    sources, coverage: report.coverage ?? [], verification: report.verification ?? null,
    review: report.review ?? null,
    citationIntegrity: {cited: cited.size, verified: cited.size - allMissing, missing: allMissing},
  };
}
