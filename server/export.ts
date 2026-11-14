import type { ReportView, ResolvedCitation } from "./report.js";

// A printable checklist for the phone call with the insurer or broker. It only repeats what the
// report already published: open questions, missing material and conclusions that are still
// unconfirmed. Nothing new is inferred here.

const verdictNote: Record<string, string> = {
  supported: "與條款一致",
  overstated: "說大了，漏了條件",
  not_in_contract: "條款裡找不到依據",
  contradicted: "與條款原文衝突",
};

const changeNote: Record<string, string> = {
  unchanged: "仍然成立",
  strengthened: "更明確",
  weakened: "條件變多",
  reversed: "被新材料推翻",
  withdrawn: "已不適用",
};

function cite(citation: ResolvedCitation) {
  if (citation.status === "missing") return "（原文已不在審閱中）";
  const page = citation.pageLabel ?? (citation.pageIndex ? `第 ${citation.pageIndex} 頁` : "");
  return `（${citation.documentName}${page ? ` · ${page}` : ""}）`;
}

function quote(citation: ResolvedCitation) {
  if (citation.status === "missing") return "";
  return `\n  > ${citation.quote.replace(/\n+/g, " ").trim()}`;
}

export function buildQuestionChecklist(report: ReportView, exportedAt = new Date()) {
  const lines: string[] = [];
  lines.push("# 提問清單");
  lines.push("");
  lines.push(`匯出時間：${exportedAt.toISOString().slice(0, 16).replace("T", " ")}`);
  lines.push(`對應調查：${report.runId.slice(0, 8)} · 材料版本 ${report.inputRevision}`);
  lines.push("");
  lines.push("這份清單只整理已發布的調查結果，不構成保險建議，也不代表任何賠付承諾。");
  lines.push("");

  lines.push("## 一、可以向對方問清楚");
  lines.push("");
  if (!report.openQuestions.length) {
    lines.push("（目前沒有待問問題。）");
  } else {
    report.openQuestions.forEach((question, index) => lines.push(`${index + 1}. ${question}`));
  }
  lines.push("");

  lines.push("## 二、還需要補充的材料");
  lines.push("");
  if (!report.requests.length) {
    lines.push("（目前沒有待補材料。）");
  } else {
    for (const request of report.requests) lines.push(`- [${request.requestedRole}] ${request.message}`);
  }
  lines.push("");

  const open = report.findings.filter(finding => finding.evidenceStatus === "unknown");
  lines.push("## 三、尚未確認的結論");
  lines.push("");
  if (!open.length) {
    lines.push("（沒有標記為 unknown 的結論。）");
  } else {
    for (const finding of open) {
      lines.push(`- ${finding.explanation}`);
      for (const citation of finding.citations) lines.push(`  ${cite(citation)}`);
    }
  }
  lines.push("");

  const changes = report.supersedes ?? [];
  if (changes.length) {
    lines.push("## 四、舊結論的變化");
    lines.push("");
    for (const item of changes) {
      lines.push(`- ${changeNote[item.verdict] ?? item.verdict}：舊結論「${item.previousConclusion}」`);
      lines.push(`  ${item.explanation}`);
      for (const citation of item.previous) lines.push(`  舊引用${cite(citation)}`);
      for (const citation of item.current) lines.push(`  新引用${cite(citation)}${quote(citation)}`);
    }
    if (report.supersedesUnchecked) lines.push(`- 另有 ${report.supersedesUnchecked} 條舊結論這次沒有重新核對。`);
    lines.push("");
  }

  const claims = report.brokerClaims ?? [];
  if (claims.length) {
    lines.push("## 五、經紀說法與條款原文對照");
    lines.push("");
    for (const claim of claims) {
      lines.push(`- ${verdictNote[claim.verdict] ?? claim.verdict}：經紀說「${claim.brokerQuote.replace(/\n+/g, " ").trim()}」`);
      lines.push(`  ${claim.explanation}`);
      for (const citation of claim.broker) lines.push(`  經紀原話${cite(citation)}`);
      for (const citation of claim.contract) lines.push(`  條款原文${cite(citation)}${quote(citation)}`);
    }
    lines.push("");
  }

  const comparisons = report.comparisons ?? [];
  if (comparisons.length) {
    lines.push("## 六、宣傳材料與條款對照");
    lines.push("");
    for (const comparison of comparisons) {
      lines.push(`- ${comparison.explanation}`);
      for (const citation of comparison.marketing) lines.push(`  宣傳原文${cite(citation)}${quote(citation)}`);
      for (const citation of comparison.contract) lines.push(`  條款原文${cite(citation)}${quote(citation)}`);
    }
    lines.push("");
  }

  lines.push("## 七、引用核對");
  lines.push("");
  lines.push(`已引用 ${report.citationIntegrity.cited} 處：核對通過 ${report.citationIntegrity.verified} 處，原文已不在審閱中 ${report.citationIntegrity.missing} 處。`);
  lines.push("");
  return lines.join("\n");
}
