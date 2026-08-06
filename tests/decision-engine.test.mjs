import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../decision-engine.js");
const TODAY = "2026-08-05";

assert.deepEqual(
  Object.keys(engine).sort(),
  ["analyzeDecisionPortfolio", "economicPositionKey", "reviewTiming"]
);

{
  const context = vm.createContext({});
  vm.runInContext(readFileSync("decision-engine.js", "utf8"), context);
  assert.equal(typeof context.AssetTrailDecisionEngine?.analyzeDecisionPortfolio, "function");
  assert.equal(typeof context.AssetTrailDecisionEngine?.economicPositionKey, "function");
  assert.equal(typeof context.AssetTrailDecisionEngine?.reviewTiming, "function");
}

assert.equal(engine.economicPositionKey({ id: "krx-a", type: "krx", ticker: "5930" }), "KRX:005930");
assert.equal(engine.economicPositionKey({ id: "krx-etf", type: "KRX", ticker: "0092b0" }), "KRX:0092B0");
assert.equal(engine.economicPositionKey({ id: "us-a", type: "us", ticker: " aapl " }), "US:AAPL");
assert.equal(engine.economicPositionKey({ id: "krx-empty", type: "KRX", ticker: "" }), "ASSET:KRX:krx-empty");
assert.notEqual(
  engine.economicPositionKey({ id: "cash-a", type: "CASH", name: "현금" }),
  engine.economicPositionKey({ id: "cash-b", type: "CASH", name: "현금" })
);
assert.notEqual(
  engine.economicPositionKey({ id: "krx-aapl", type: "KRX", ticker: "AAPL" }),
  engine.economicPositionKey({ id: "us-aapl", type: "US", ticker: "AAPL" })
);

assert.equal(engine.reviewTiming({ nextReviewAt: "" }, { todayKey: TODAY }), "unscheduled");
assert.equal(engine.reviewTiming({ nextReviewAt: "2026-02-29" }, { todayKey: TODAY }), "invalid");
assert.equal(engine.reviewTiming({ nextReviewAt: "2026-08-04" }, { todayKey: TODAY }), "overdue");
assert.equal(engine.reviewTiming({ nextReviewAt: TODAY }, { todayKey: TODAY }), "dueToday");
assert.equal(engine.reviewTiming({ nextReviewAt: "2026-08-06" }, { todayKey: TODAY }), "upcoming");
assert.equal(
  engine.reviewTiming({ nextReviewAt: TODAY, reviewStatus: "INVALIDATED" }, { todayKey: TODAY }),
  "dueToday"
);

const fixture = [
  {
    id: "samsung-isa",
    type: "KRX",
    ticker: "5930",
    name: "삼성전자",
    account: "ISA",
    value: 300,
    hasValue: true,
    investmentRole: "CORE",
    thesis: "현금흐름",
    nextReviewAt: "2026-08-04",
    reviewStatus: "ACTIVE"
  },
  {
    id: "samsung-general",
    type: "KRX",
    ticker: "005930",
    name: "삼성전자",
    account: "일반계좌",
    value: 200,
    hasValue: true,
    investmentRole: "CORE",
    thesis: "현금흐름",
    nextReviewAt: TODAY,
    reviewStatus: "ACTIVE"
  },
  {
    id: "apple",
    type: "US",
    ticker: "aapl",
    name: "Apple",
    value: 150,
    hasValue: true,
    investmentRole: "STRUCTURAL_GROWTH",
    thesis: "서비스 성장",
    nextReviewAt: "2026-08-06",
    reviewStatus: "ACTIVE"
  },
  {
    id: "cash",
    type: "CASH",
    name: "현금",
    value: 100,
    hasValue: true,
    investmentRole: "SURVIVAL",
    thesis: "유동성",
    nextReviewAt: "",
    reviewStatus: "ACTIVE"
  },
  {
    id: "manual-bond",
    type: "MANUAL",
    name: "채권",
    value: 100,
    hasValue: true,
    investmentRole: "",
    thesis: "",
    nextReviewAt: "2026-02-29",
    reviewStatus: "ACTIVE"
  },
  {
    id: "krx-etf",
    type: "KRX",
    ticker: "0092b0",
    name: "원자력 ETF",
    value: 100,
    hasValue: true,
    investmentRole: "CORE",
    thesis: "분산 노출",
    nextReviewAt: TODAY,
    reviewStatus: "ACTIVE"
  },
  {
    id: "microsoft",
    type: "US",
    ticker: "MSFT",
    name: "Microsoft",
    value: 50,
    hasValue: true,
    investmentRole: "TACTICAL",
    thesis: "클라우드 수요",
    nextReviewAt: "2026-08-07",
    reviewStatus: "INVALIDATED"
  }
];

const analysis = engine.analyzeDecisionPortfolio(fixture, { todayKey: TODAY });
assert.equal(analysis.totalValue, 1000);
assert.equal(analysis.ledgerRowCount, 7);
assert.equal(analysis.economicPositionCount, 6);
assert.equal(analysis.top1Weight, 0.5);
assert.equal(analysis.top5Weight, 0.95);
assert.equal(analysis.hhi, 0.305);
assert.equal(analysis.effectivePositionCount, 3.28);
assert.ok(Math.abs(analysis.positions.reduce((sum, position) => sum + position.weight, 0) - 1) < 0.000001);

const samsung = analysis.positions.find((position) => position.key === "KRX:005930");
assert.deepEqual(samsung, {
  key: "KRX:005930",
  name: "삼성전자",
  type: "KRX",
  ticker: "005930",
  value: 500,
  weight: 0.5,
  assetIds: ["samsung-general", "samsung-isa"],
  accounts: ["ISA", "일반계좌"]
});
assert.equal(analysis.reviews.overdue.length, 1);
assert.equal(analysis.reviews.dueToday.length, 2);
assert.equal(analysis.reviews.upcoming.length, 2);
assert.equal(analysis.reviews.unscheduled.length, 1);
assert.equal(analysis.reviews.invalid.length, 1);
assert.equal(analysis.reviews.overdue[0].id, "samsung-isa");
assert.equal(
  analysis.reviews.upcoming.find((review) => review.id === "microsoft").reviewStatus,
  "INVALIDATED"
);
assert.deepEqual(analysis.quality, {
  valuedRowCount: 7,
  missingValueCount: 0,
  roleAssignedCount: 6,
  thesisCount: 6,
  reviewScheduledCount: 5,
  completeDecisionCount: 5
});
assert.equal(
  analysis.warnings.find((warning) => warning.code === "TOP1_CONCENTRATION")?.severity,
  "high"
);
assert.equal(
  analysis.warnings.find((warning) => warning.code === "TOP5_CONCENTRATION")?.severity,
  "medium"
);
assert.equal(analysis.warnings.some((warning) => warning.code === "MISSING_VALUES"), false);
assert.equal(analysis.warnings.some((warning) => warning.code === "MISSING_INVESTMENT_ROLES"), true);
assert.equal(analysis.warnings.some((warning) => warning.code === "MISSING_THESES"), true);
assert.equal(analysis.warnings.some((warning) => warning.code === "UNSCHEDULED_REVIEWS"), true);
assert.equal(analysis.warnings.some((warning) => warning.code === "INVALID_REVIEW_DATES"), true);

assert.deepEqual(
  engine.analyzeDecisionPortfolio([...fixture].reverse(), { todayKey: TODAY }),
  analysis,
  "입력 행 순서가 달라도 분석 결과는 결정론적이어야 합니다."
);

{
  const separated = engine.analyzeDecisionPortfolio([
    { id: "krx-same", type: "KRX", ticker: "AAPL", name: "KRX AAPL", value: 1, hasValue: true },
    { id: "us-same", type: "US", ticker: "AAPL", name: "US AAPL", value: 1, hasValue: true },
    { id: "blank-a", type: "KRX", ticker: "", name: "빈 티커", value: 1, hasValue: true },
    { id: "blank-b", type: "KRX", ticker: "", name: "빈 티커", value: 1, hasValue: true },
    { id: "cash-a", type: "CASH", name: "현금", value: 1, hasValue: true },
    { id: "cash-b", type: "CASH", name: "현금", value: 1, hasValue: true }
  ], { todayKey: TODAY });

  assert.equal(separated.economicPositionCount, 6);
  assert.equal(new Set(separated.positions.map((position) => position.key)).size, 6);
}

{
  const unsafeValues = engine.analyzeDecisionPortfolio([
    { id: "negative", type: "CASH", name: "음수", value: -10, hasValue: true },
    { id: "nan", type: "MANUAL", name: "문자", value: "not-a-number", hasValue: true },
    { id: "zero", type: "CASH", name: "영", value: 0, hasValue: true },
    { id: "explicit-missing", type: "MANUAL", name: "미확인", value: 500, hasValue: false }
  ], { todayKey: TODAY });

  assert.equal(unsafeValues.totalValue, 0);
  assert.equal(unsafeValues.economicPositionCount, 4);
  assert.equal(unsafeValues.top1Weight, 0);
  assert.equal(unsafeValues.top5Weight, 0);
  assert.equal(unsafeValues.hhi, 0);
  assert.equal(unsafeValues.effectivePositionCount, 0);
  assert.equal(unsafeValues.quality.valuedRowCount, 1);
  assert.equal(unsafeValues.quality.missingValueCount, 3);
  assert.equal(
    unsafeValues.warnings.find((warning) => warning.code === "MISSING_VALUES")?.severity,
    "high"
  );
}

function weightedRows(weights) {
  return weights.map((value, index) => ({
    id: `position-${index + 1}`,
    type: "MANUAL",
    name: `포지션 ${index + 1}`,
    value,
    hasValue: true,
    investmentRole: "CORE",
    thesis: "검증",
    nextReviewAt: "2026-08-06",
    reviewStatus: "ACTIVE"
  }));
}

{
  const exactMedium = engine.analyzeDecisionPortfolio(weightedRows([20, 20, 20, 20, 20]), { todayKey: TODAY });
  assert.equal(exactMedium.top1Weight, 0.2);
  assert.equal(
    exactMedium.warnings.find((warning) => warning.code === "TOP1_CONCENTRATION")?.severity,
    "medium"
  );
  assert.equal(exactMedium.warnings.some((warning) => warning.code === "TOP5_CONCENTRATION"), false);
}

{
  const exactHigh = engine.analyzeDecisionPortfolio(weightedRows([30, 17.5, 17.5, 17.5, 17.5]), { todayKey: TODAY });
  assert.equal(exactHigh.top1Weight, 0.3);
  assert.equal(
    exactHigh.warnings.find((warning) => warning.code === "TOP1_CONCENTRATION")?.severity,
    "high"
  );
}

{
  const sixEqual = engine.analyzeDecisionPortfolio(weightedRows([1, 1, 1, 1, 1, 1]), { todayKey: TODAY });
  assert.equal(sixEqual.warnings.some((warning) => warning.code === "TOP1_CONCENTRATION"), false);
  assert.equal(
    sixEqual.warnings.find((warning) => warning.code === "TOP5_CONCENTRATION")?.severity,
    "medium"
  );
}

{
  const empty = engine.analyzeDecisionPortfolio(null, { todayKey: TODAY });
  assert.equal(empty.totalValue, 0);
  assert.equal(empty.ledgerRowCount, 0);
  assert.equal(empty.economicPositionCount, 0);
  assert.deepEqual(empty.reviews, {
    overdue: [],
    dueToday: [],
    upcoming: [],
    unscheduled: [],
    invalid: []
  });
  assert.equal(empty.warnings[0].code, "EMPTY_PORTFOLIO");
}

console.log("decision engine tests passed");
