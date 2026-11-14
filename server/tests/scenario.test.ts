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

// A broker promise is checked the same way as a promotion claim: the promise must be quoted from
// the chat record, and every verdict except "not_in_contract" must quote the contract side too.
const brokerSnapshot = {
  context: {},
  documents: [
    {id: "doc1", role: "contract", status: "ready", pageCount: 2, name: "policy.pdf"},
    {id: "chat1", role: "broker_reply", status: "ready", pageCount: 1, name: "Ken · 2026-11-13"},
  ],
  sources: [
    {sourceId: "doc1:p2:b1", documentId: "doc1", pageIndex: 2,
      quote: "Delay exceeding 6 hours. Maximum benefit 1000.", role: "contract"},
    {sourceId: "chat1:p1:b1", documentId: "chat1", pageIndex: 1,
      quote: "你延誤超過 3 小時就賠，最多兩萬。", role: "broker_reply"},
  ],
} as unknown as Parameters<typeof validateAnswer>[1];
const claim = {
  verdict: "overstated" as const,
  brokerQuote: "你延誤超過 3 小時就賠，最多兩萬。",
  contractQuote: "Delay exceeding 6 hours. Maximum benefit 1000.",
  brokerSourceIds: ["chat1:p1:b1"], contractSourceIds: ["doc1:p2:b1"],
  explanation: "经纪说 3 小时、两万，合同写 6 小时、上限 1000。",
};
const claimBase = {findings: [], openQuestions: [], requests: [], brokerClaims: [claim]};

test("a broker claim must quote both the promise and the wording that limits it", () => {
  const seen = new Set(["doc1:p2:b1", "chat1:p1:b1"]);
  const ok = validateAnswer(claimBase, brokerSnapshot, seen);
  assert.equal(ok.brokerClaims.length, 1);

  const rewritten = {...claimBase, brokerClaims: [{...claim, brokerQuote: "延誤三小時就賠兩萬"}]};
  assert.throws(() => validateAnswer(rewritten, brokerSnapshot, seen), /BROKER_CLAIM_INVALID:broker_quote_0/);

  const wrongSide = {...claimBase, brokerClaims: [{...claim, brokerSourceIds: ["doc1:p2:b1"]}]};
  assert.throws(() => validateAnswer(wrongSide, brokerSnapshot, seen), /BROKER_CLAIM_INVALID:broker_source_0/);

  const noContract = {...claimBase, brokerClaims: [{...claim, contractSourceIds: [], contractQuote: ""}]};
  assert.throws(() => validateAnswer(noContract, brokerSnapshot, seen), /BROKER_CLAIM_INVALID:contract_source_0/);

  const unread = {...claimBase, brokerClaims: [{...claim, brokerSourceIds: ["chat1:p1:b9"]}]};
  assert.throws(() => validateAnswer(unread, brokerSnapshot, seen), /BROKER_CLAIM_INVALID:broker_source_0/);
});

test("not_in_contract is the only verdict that may leave the contract side empty", () => {
  const seen = new Set(["doc1:p2:b1", "chat1:p1:b1"]);
  const nothing = {...claimBase, brokerClaims: [{...claim, verdict: "not_in_contract" as const,
    contractSourceIds: [], contractQuote: ""}]};
  const ok = validateAnswer(nothing, brokerSnapshot, seen);
  assert.equal(ok.brokerClaims[0].verdict, "not_in_contract");

  const stillQuoting = {...claimBase, brokerClaims: [{...claim, verdict: "not_in_contract" as const}]};
  assert.throws(() => validateAnswer(stillQuoting, brokerSnapshot, seen), /BROKER_CLAIM_INVALID:contract_source_0/);
});
