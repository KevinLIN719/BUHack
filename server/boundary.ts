import { evaluateThreshold, scenarioCaveats, unitToMinutes } from "./scenario.js";

export type BoundaryExperiment = {
  question: string; rationale: string; sourceId: string; thresholdQuote: string;
  status: "tested" | "insufficient_information"; reason: string | null;
  cases: {minutes: number; status: string; marginMinutes: number | null}[];
  caveats: string[];
};

// Only unambiguous lower duration thresholds are eligible. A paragraph with several
// durations, an upper bound or no comparison operator must not become an invented rule.
export function testDurationBoundary(quote: string): Pick<BoundaryExperiment, "status" | "reason" | "cases" | "caveats"> {
  const durations = [...quote.matchAll(/\d+(?:\.\d+)?\s*(?:分钟|分鐘|minutes?|mins?|小时|小時|hours?|hrs?|天|days?)\b|\d+(?:\.\d+)?\s*(?:分钟|分鐘|小时|小時|天)/gi)];
  const lower = /超过|超過|超出|至少|最少|不少[於于]|不低[於于]|以上|exceed(?:ing|s)?|more than|in excess of|at least|minimum|or more/i;
  const upper = /不超过|不超過|少于|少於|以内|以內|within|less than|at most|not more than|no more than|not exceed|or less/i;
  if (durations.length !== 1 || !lower.test(quote) || upper.test(quote)) {
    return {status: "insufficient_information", reason: "需要一段只含一个明确时长下限的原文；多门槛或未写明比较方式时不自动计算。", cases: [], caveats: scenarioCaveats};
  }
  const probe = evaluateThreshold(quote, 1, "minutes");
  const threshold = probe.thresholdMinutes;
  const duration = /(\d+(?:\.\d+)?)\s*(分钟|分鐘|minutes?|mins?|小时|小時|hours?|hrs?|天|days?)/i.exec(quote)!;
  const exactMinutes = Number(duration[1]) * (unitToMinutes(duration[2]) ?? 1);
  if (threshold === null || threshold < 1 || threshold > 5_256_000 || !Number.isSafeInteger(exactMinutes)) {
    return {status: "insufficient_information", reason: "时长门槛无法按整分钟可靠测试。", cases: [], caveats: scenarioCaveats};
  }
  const cases = [threshold - 1, threshold, threshold + 1].filter(minutes => minutes > 0).map(minutes => {
    const result = evaluateThreshold(quote, minutes, "minutes");
    return {minutes, status: result.status, marginMinutes: result.marginMinutes};
  });
  return {status: "tested", reason: null, cases, caveats: scenarioCaveats};
}
