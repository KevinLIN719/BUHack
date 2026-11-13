// Scenario arithmetic is deliberately deterministic. The model may phrase the question and pick
// which clause to test, but the comparison itself is computed here from the quoted wording, so a
// payout or a "yes, covered" answer can never be invented by the model. Times are normalised to
// minutes; everything the wording does not state stays a caveat rather than an assumption.

export type ScenarioStatus = "satisfied" | "not_satisfied" | "boundary" | "insufficient_information";

const unitMinutes: Record<string, number> = {
  "分钟": 1, "分鐘": 1, "minute": 1, "minutes": 1, "min": 1, "mins": 1,
  "小时": 60, "小時": 60, "hour": 60, "hours": 60, "hr": 60, "hrs": 60,
  "天": 1440, "day": 1440, "days": 1440,
};
const thresholdPattern = /(\d+(?:\.\d+)?)\s*(分钟|分鐘|minutes?|mins?|小时|小時|hours?|hrs?|天|days?)/i;
// "超过 6 小时" excludes the boundary; "至少 6 小时" includes it. Anything else is treated as
// strict, which is the safer reading when the wording is ambiguous.
const inclusivePattern = /至少|最少|不少於|不少于|不低於|不低于|以上|at least|minimum|or more/i;

export const scenarioCaveats = [
  "只比较原文写明的时长门槛，不推算赔款金额。",
  "事件定义、保障起算时点、除外责任与证明材料仍需按条款确认。",
  "单次上限、累计上限与币种未在此计算。",
];

export type ThresholdResult = {
  status: ScenarioStatus;
  thresholdMinutes: number | null;
  actualMinutes: number;
  marginMinutes: number | null;
  inclusive: boolean;
  reason: string | null;
  caveats: string[];
};

export function unitToMinutes(unit: string): number | null {
  return unitMinutes[unit.toLowerCase().trim()] ?? null;
}

export function evaluateThreshold(thresholdText: string, actualValue: number, actualUnit: string): ThresholdResult {
  const base: ThresholdResult = {
    status: "insufficient_information", thresholdMinutes: null, actualMinutes: 0,
    marginMinutes: null, inclusive: false, reason: null, caveats: scenarioCaveats,
  };
  const factor = unitToMinutes(actualUnit);
  if (factor === null) return { ...base, reason: "无法识别实际时长的单位" };
  if (!Number.isFinite(actualValue) || actualValue <= 0) return { ...base, reason: "实际时长必须是正数" };
  const actualMinutes = Math.round(actualValue * factor);
  const match = thresholdPattern.exec(thresholdText);
  if (!match) return { ...base, actualMinutes, reason: "门槛原文中没有可解析的时长数字" };

  const thresholdMinutes = Math.round(Number(match[1]) * (unitToMinutes(match[2]) ?? 1));
  const inclusive = inclusivePattern.test(thresholdText);
  const marginMinutes = actualMinutes - thresholdMinutes;
  const result = { thresholdMinutes, actualMinutes, marginMinutes, inclusive, caveats: scenarioCaveats };

  if (actualMinutes > thresholdMinutes) return { ...result, status: "satisfied", reason: null };
  if (actualMinutes === thresholdMinutes) {
    return inclusive
      ? { ...result, status: "satisfied", reason: null }
      : { ...result, status: "boundary", reason: "正好等于门槛，原文用的是「超过」这类严格表述，等于并未满足。", };
  }
  return { ...result, status: "not_satisfied", reason: null };
}
