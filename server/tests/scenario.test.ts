import assert from "node:assert/strict";
import test from "node:test";
import { evaluateThreshold, scenarioCaveats } from "../scenario.js";
import { validateAnswer } from "../agent.js";

// The comparison is the only place where a scenario gets a verdict, so it is tested on its own:
// boundary semantics differ between "超过 6 小时" and "至少 6 小时", and an unparseable threshold
// must degrade to insufficient_information instead of guessing.
test("threshold comparison respects strict and inclusive wording", () => {
  const strict = evaluateThreshold("Delay exceeding 6 hours.", 8, "hours");
  assert.equal(strict.status, "satisfied");
  assert.equal(strict.thresholdMinutes, 360);
  assert.equal(strict.marginMinutes, 120);

  const boundary = evaluateThreshold("Delay exceeding 6 hours.", 6, "hours");
  assert.equal(boundary.status, "boundary");
  assert.match(boundary.reason ?? "", /严格表述/);

  const inclusive = evaluateThreshold("延误至少 6 hours 才賠付", 6, "hours");
  assert.equal(inclusive.status, "satisfied");
  assert.equal(inclusive.inclusive, true);

  const short = evaluateThreshold("Delay exceeding 6 hours.", 359, "minutes");
  assert.equal(short.status, "not_satisfied");
  assert.equal(short.marginMinutes, -1);
});

test("a threshold without a parseable duration degrades to insufficient_information", () => {
  const missing = evaluateThreshold("Carrier proof is required.", 8, "hours");
  assert.equal(missing.status, "insufficient_information");
  assert.deepEqual(missing.caveats, scenarioCaveats);
  assert.match(missing.reason ?? "", /时长数字/);

  const badUnit = evaluateThreshold("Delay exceeding 6 hours.", 8, "weeks");
  assert.equal(badUnit.status, "insufficient_information");
  assert.match(badUnit.reason ?? "", /单位/);
});

// Only the fields validation reads are provided; the rows carry far more in production.
const snapshot = {
  context: {},
  documents: [{id: "doc1", role: "contract", status: "ready", pageCount: 2, name: "policy.pdf"}],
  sources: [{sourceId: "doc1:p2:b1", documentId: "doc1", pageIndex: 2,
    quote: "Delay exceeding 6 hours. Carrier proof is required.", role: "contract"}],
} as unknown as Parameters<typeof validateAnswer>[1];
const base = {
  findings: [], openQuestions: [], requests: [],
  scenarios: [{
    question: "如果我延誤 8 小時？", assumption: "延誤 8 小時",
    thresholdQuote: "Delay exceeding 6 hours.", ruleSourceIds: ["doc1:p2:b1"],
    actualValue: 8, actualUnit: "hours" as const, status: "satisfied" as const,
    detail: "比门槛多 2 小时。", unknowns: ["事件定义与起算时点待确认。"],
  }],
};

test("a scenario must quote the threshold it compares against", () => {
  const seen = new Set(["doc1:p2:b1"]);
  const ok = validateAnswer(base, snapshot, seen);
  assert.equal(ok.scenarios.length, 1);
  assert.equal(ok.scenarios[0].status, "satisfied");

  const rewritten = {...base, scenarios: [{...base.scenarios[0], thresholdQuote: "延误超过六小时"}]};
  assert.throws(() => validateAnswer(rewritten, snapshot, seen), /SCENARIO_INVALID:threshold_quote_0/);

  const unread = {...base, scenarios: [{...base.scenarios[0], ruleSourceIds: ["doc1:p9:b1"]}]};
  assert.throws(() => validateAnswer(unread, snapshot, seen), /SCENARIO_INVALID:rule_source_0/);
});

test("a scenario whose claimed status disagrees with the arithmetic is rejected", () => {
  const seen = new Set(["doc1:p2:b1"]);
  const lying = {...base, scenarios: [{...base.scenarios[0], actualValue: 4}]};
  assert.throws(() => validateAnswer(lying, snapshot, seen), /SCENARIO_INVALID:status_0/);

  const boundary = {...base, scenarios: [{...base.scenarios[0], actualValue: 6, status: "not_satisfied" as const}]};
  assert.throws(() => validateAnswer(boundary, snapshot, seen), /SCENARIO_INVALID:status_0/);
});
