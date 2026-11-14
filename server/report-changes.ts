type Finding = {explanation: string; evidenceStatus: string; sourceIds: string[]};
type ComparableReport = {findings: Finding[]; requests: {message: string; requestedRole: string}[]; openQuestions: string[]};
const key = (finding: Finding) => JSON.stringify([finding.explanation.trim(), finding.evidenceStatus, [...finding.sourceIds].sort()]);

// Exact evidence/text comparison, not a semantic judgment. A missing old statement is
// "not repeated", never "resolved" or "disproved". Keep both versions inspectable.
export function compareReports(previous: ComparableReport, current: ComparableReport) {
  const oldKeys = new Set(previous.findings.map(key));
  const newKeys = new Set(current.findings.map(key));
  const requestKey = (item: ComparableReport["requests"][number]) => JSON.stringify([item.message, item.requestedRole]);
  const requests = new Set(current.requests.map(requestKey));
  return {
    unchanged: current.findings.filter(finding => oldKeys.has(key(finding))).length,
    added: current.findings.filter(finding => !oldKeys.has(key(finding))),
    notRepeated: previous.findings.filter(finding => !newKeys.has(key(finding))),
    previousRequestsNotRepeated: previous.requests.filter(item => !requests.has(requestKey(item))),
    previousOpenQuestions: previous.openQuestions,
    currentOpenQuestions: current.openQuestions,
  };
}
