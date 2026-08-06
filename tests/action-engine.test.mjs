import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../action-engine.js");
const TODAY = "2026-08-05";

assert.deepEqual(Object.keys(engine).sort(), ["analyzeRiskExposure", "planContribution"]);

{
  const context = vm.createContext({});
  vm.runInContext(readFileSync("action-engine.js", "utf8"), context);
  assert.equal(typeof context.AssetTrailActionEngine?.planContribution, "function");
  assert.equal(typeof context.AssetTrailActionEngine?.analyzeRiskExposure, "function");
}

function allocationBuckets() {
  return [
    {
      key: "domestic",
      currentValue: 600,
      minPct: 40,
      targetPct: 50,
      maxPct: 60,
      reviewRequiredCount: 1,
      positionCount: 3
    },
    {
      key: "overseas",
      currentValue: 200,
      minPct: 20,
      targetPct: 30,
      maxPct: 40,
      reviewRequiredCount: 0,
      positionCount: 2
    },
    {
      key: "cash",
      currentValue: 100,
      minPct: 5,
      targetPct: 10,
      maxPct: 20,
      reviewRequiredCount: 0,
      positionCount: 1
    },
    {
      key: "manual",
      currentValue: 100,
      minPct: 0,
      targetPct: 10,
      maxPct: 20,
      reviewRequiredCount: 0,
      positionCount: 1
    }
  ];
}

{
  const plan = engine.planContribution({
    mode: "ONE_TIME",
    amount: 200,
    buckets: allocationBuckets()
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.mode, "ONE_TIME");
  assert.equal(plan.totalAllocated, 200);
  assert.equal(plan.currentTotal, 1000);
  assert.equal(plan.projectedTotal, 1200);
  assert.deepEqual(plan.allocations.map(({ key, amount }) => ({ key, amount })), [
    { key: "domestic", amount: 0 },
    { key: "overseas", amount: 160 },
    { key: "cash", amount: 20 },
    { key: "manual", amount: 20 }
  ]);
  assert.equal(plan.allocations.reduce((sum, item) => sum + item.amount, 0), 200);
  plan.allocations.forEach((item) => {
    assert.ok(item.projectedWeight * 100 <= item.maxPct + 0.000001);
    assert.ok(item.projectedWeight * 100 >= item.minPct - 0.000001);
  });
  assert.equal(plan.allocations[0].reviewRequired, true);
  assert.match(plan.allocations[0].reasons.join(" "), /검토 필요/);
  assert.deepEqual(plan.warnings[0].bucketKeys, ["domestic"]);

  const reversed = engine.planContribution({
    mode: "one_time",
    amount: 200,
    buckets: allocationBuckets().reverse()
  });
  assert.deepEqual(reversed, plan, "자산군 입력 순서가 달라도 배분 결과는 같아야 합니다.");
}

{
  const objectBuckets = Object.fromEntries(allocationBuckets().reverse().map(({ key, ...bucket }) => [key, bucket]));
  const monthly = engine.planContribution({ mode: "MONTHLY", amount: 200, buckets: objectBuckets });
  assert.equal(monthly.ok, true);
  assert.equal(monthly.mode, "MONTHLY");
  assert.deepEqual(
    monthly.allocations.map(({ key, amount }) => ({ key, amount })),
    engine.planContribution({ mode: "MONTHLY", amount: 200, buckets: allocationBuckets() })
      .allocations.map(({ key, amount }) => ({ key, amount }))
  );
}

{
  const invalidMode = engine.planContribution({ mode: "WEEKLY", amount: 100, buckets: allocationBuckets() });
  assert.equal(invalidMode.ok, false);
  assert.equal(invalidMode.code, "INVALID_MODE");
  assert.deepEqual(invalidMode.allocations, []);

  const invalidAmount = engine.planContribution({ mode: "ONE_TIME", amount: 1.5, buckets: allocationBuckets() });
  assert.equal(invalidAmount.ok, false);
  assert.equal(invalidAmount.code, "INVALID_AMOUNT");
  assert.equal(invalidAmount.totalAllocated, 0);
}

{
  const impossibleMax = engine.planContribution({
    mode: "ONE_TIME",
    amount: 100,
    buckets: [
      { key: "domestic", currentValue: 700, minPct: 0, targetPct: 50, maxPct: 60, reviewRequiredCount: 0, positionCount: 1 },
      { key: "overseas", currentValue: 100, minPct: 0, targetPct: 30, maxPct: 50, reviewRequiredCount: 0, positionCount: 1 },
      { key: "cash", currentValue: 100, minPct: 0, targetPct: 10, maxPct: 20, reviewRequiredCount: 0, positionCount: 1 },
      { key: "manual", currentValue: 100, minPct: 0, targetPct: 10, maxPct: 20, reviewRequiredCount: 0, positionCount: 1 }
    ]
  });
  assert.equal(impossibleMax.ok, false);
  assert.equal(impossibleMax.code, "CURRENT_MAX_UNREACHABLE");
  assert.deepEqual(impossibleMax.bucketKeys, ["domestic"]);
  assert.deepEqual(impossibleMax.allocations, []);
  assert.equal(impossibleMax.totalAllocated, 0);
}

{
  const impossibleMinimums = engine.planContribution({
    mode: "MONTHLY",
    amount: 100,
    buckets: [
      { key: "domestic", currentValue: 1000, minPct: 0, targetPct: 50, maxPct: 100, reviewRequiredCount: 0, positionCount: 1 },
      { key: "overseas", currentValue: 0, minPct: 20, targetPct: 30, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 },
      { key: "cash", currentValue: 0, minPct: 10, targetPct: 10, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 },
      { key: "manual", currentValue: 0, minPct: 5, targetPct: 10, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 }
    ]
  });
  assert.equal(impossibleMinimums.ok, false);
  assert.equal(impossibleMinimums.code, "MINIMUMS_UNREACHABLE");
  assert.ok(impossibleMinimums.minimumRequired > impossibleMinimums.amount);
  assert.deepEqual(impossibleMinimums.allocations, []);
}

{
  const oneWon = engine.planContribution({
    mode: "ONE_TIME",
    amount: 1,
    buckets: [
      { key: "domestic", currentValue: 0, minPct: 0, targetPct: 25, maxPct: 25, reviewRequiredCount: 0, positionCount: 0 },
      { key: "overseas", currentValue: 0, minPct: 0, targetPct: 25, maxPct: 25, reviewRequiredCount: 0, positionCount: 0 },
      { key: "cash", currentValue: 0, minPct: 0, targetPct: 25, maxPct: 25, reviewRequiredCount: 0, positionCount: 0 },
      { key: "manual", currentValue: 0, minPct: 0, targetPct: 25, maxPct: 25, reviewRequiredCount: 0, positionCount: 0 }
    ]
  });
  assert.equal(oneWon.ok, false);
  assert.equal(oneWon.code, "MAXIMUMS_UNREACHABLE");
  assert.equal(oneWon.maximumCapacity, 0);
  assert.deepEqual(oneWon.allocations, []);
}

{
  const invalidBand = allocationBuckets();
  invalidBand[0] = { ...invalidBand[0], minPct: 61 };
  const result = engine.planContribution({ mode: "ONE_TIME", amount: 100, buckets: invalidBand });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_BAND");

  const invalidTargetTotal = allocationBuckets();
  invalidTargetTotal[0] = { ...invalidTargetTotal[0], targetPct: 49 };
  const totalResult = engine.planContribution({ mode: "ONE_TIME", amount: 100, buckets: invalidTargetTotal });
  assert.equal(totalResult.ok, false);
  assert.equal(totalResult.code, "INVALID_TARGET_TOTAL");
}

{
  const toleratedDecimalTotal = [
    { key: "domestic", currentValue: 0, minPct: 0, targetPct: 50.005, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 },
    { key: "overseas", currentValue: 0, minPct: 0, targetPct: 30, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 },
    { key: "cash", currentValue: 0, minPct: 0, targetPct: 10, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 },
    { key: "manual", currentValue: 0, minPct: 0, targetPct: 10, maxPct: 100, reviewRequiredCount: 0, positionCount: 0 }
  ];
  const result = engine.planContribution({ mode: "ONE_TIME", amount: 100, buckets: toleratedDecimalTotal });
  assert.equal(result.ok, true, "UI와 동일한 ±0.01%p 합계 허용오차를 사용해야 합니다.");
  assert.equal(result.totalAllocated, 100);
}

{
  const impossibleMinimumTotal = allocationBuckets().map((bucket) => ({
    ...bucket,
    currentValue: 0,
    minPct: 25.002,
    targetPct: 25.002,
    maxPct: 100,
    reviewRequiredCount: 0,
    positionCount: 0
  }));
  const minimumResult = engine.planContribution({ mode: "ONE_TIME", amount: 100, buckets: impossibleMinimumTotal });
  assert.equal(minimumResult.ok, false);
  assert.equal(minimumResult.code, "INVALID_MIN_TOTAL");
  assert.deepEqual(minimumResult.allocations, []);

  const impossibleMaximumTotal = allocationBuckets().map((bucket) => ({
    ...bucket,
    currentValue: 0,
    minPct: 0,
    targetPct: 24.998,
    maxPct: 24.998,
    reviewRequiredCount: 0,
    positionCount: 0
  }));
  const maximumResult = engine.planContribution({ mode: "ONE_TIME", amount: 100, buckets: impossibleMaximumTotal });
  assert.equal(maximumResult.ok, false);
  assert.equal(maximumResult.code, "INVALID_MAX_TOTAL");
  assert.deepEqual(maximumResult.allocations, []);
}

const riskRows = [
  {
    id: "samsung-isa",
    type: "KRX",
    ticker: "5930",
    name: "삼성전자",
    account: "ISA",
    value: 300,
    hasValue: true,
    investmentRole: "CORE",
    riskTags: {
      industry: ["반도체"],
      country: ["한국"],
      currency: ["KRW"]
    },
    lastReviewedAt: "2026-07-01",
    nextReviewAt: "2026-12-31",
    reviewStatus: "ACTIVE"
  },
  {
    id: "samsung-general",
    type: "krx",
    ticker: "005930",
    name: "삼성전자",
    account: "일반계좌",
    value: 200,
    hasValue: true,
    investmentRole: "CORE",
    riskTags: {
      industry: ["반도체", "AI"],
      country: ["한국"],
      currency: ["krw"]
    },
    lastReviewedAt: "2026-07-01",
    nextReviewAt: "2026-12-31",
    reviewStatus: "ACTIVE"
  },
  {
    id: "apple",
    type: "US",
    ticker: "aapl",
    name: "Apple",
    value: 300,
    hasValue: true,
    investmentRole: "STRUCTURAL_GROWTH",
    riskTags: {
      industry: ["플랫폼"],
      country: ["미국"],
      currency: ["USD"],
      aiValueChain: ["애플리케이션"]
    },
    lastReviewedAt: "2025-01-01",
    nextReviewAt: "2026-12-31",
    reviewStatus: "ACTIVE"
  },
  {
    id: "cycle",
    type: "MANUAL",
    name: "조선 사이클",
    value: 100,
    hasValue: true,
    investmentRole: "CYCLE",
    riskTags: {
      industry: ["조선"],
      country: ["한국"],
      currency: ["KRW"]
    },
    lastReviewedAt: TODAY,
    nextReviewAt: "2026-12-31",
    reviewStatus: "REVIEW"
  },
  {
    id: "cash",
    type: "CASH",
    name: "비상 현금",
    value: 100,
    hasValue: true,
    investmentRole: "SURVIVAL",
    riskTags: {
      currency: ["KRW"],
      duration: ["단기"]
    },
    lastReviewedAt: TODAY,
    nextReviewAt: "2026-12-31",
    reviewStatus: "ACTIVE"
  }
];

const riskBudgetInput = {
  coreMinPct: 50,
  satelliteMaxPct: 40,
  aiStructuralMaxPct: 20,
  cycleMaxPct: 10
};

{
  const analysis = engine.analyzeRiskExposure(riskRows, riskBudgetInput, { todayKey: TODAY });
  assert.equal(analysis.totalValue, 1000);
  assert.equal(analysis.rowCount, 5);
  assert.equal(analysis.economicPositionCount, 4);

  const samsung = analysis.positions.find((position) => position.key === "KRX:005930");
  assert.equal(samsung.value, 500);
  assert.deepEqual(samsung.assetIds, ["samsung-general", "samsung-isa"]);
  assert.deepEqual(samsung.accounts, ["ISA", "일반계좌"]);
  assert.deepEqual(samsung.riskTags.industry, ["AI", "반도체"]);

  const semiconductor = analysis.tagExposures.find(
    (exposure) => exposure.dimension === "industry" && exposure.tag === "반도체"
  );
  assert.equal(semiconductor.value, 500);
  assert.equal(semiconductor.weight, 0.5);
  assert.equal(semiconductor.positionCount, 1, "동일 티커의 여러 계좌는 태그 포지션 수에서 한 번만 세야 합니다.");
  assert.deepEqual(semiconductor.positionKeys, ["KRX:005930"]);

  const korea = analysis.tagExposures.find(
    (exposure) => exposure.dimension === "country" && exposure.tag === "한국"
  );
  assert.equal(korea.value, 600);
  assert.equal(korea.positionCount, 2);

  const nonAdditive = analysis.warnings.find(
    (warning) => warning.code === "NON_ADDITIVE_TAGS" && warning.dimension === "industry"
  );
  assert.deepEqual(nonAdditive.positionKeys, ["KRX:005930"]);
  assert.match(nonAdditive.message, /합산할 수 없습니다/);

  assert.deepEqual(analysis.budgets.core, {
    inputKey: "coreMinPct",
    rule: "MIN",
    limitPct: 50,
    actualValue: 500,
    actualWeight: 0.5,
    actualPct: 50,
    status: "OK"
  });
  assert.equal(analysis.budgets.satellite.actualValue, 400, "SURVIVAL 역할은 위성 위험 예산과 분리해야 합니다.");
  assert.equal(analysis.budgets.satellite.status, "OK");
  assert.equal(analysis.budgets.aiStructural.actualValue, 300);
  assert.equal(analysis.budgets.aiStructural.status, "BREACHED");
  assert.equal(analysis.budgets.cycle.actualValue, 100);
  assert.equal(analysis.budgets.cycle.status, "OK");
  assert.deepEqual(analysis.quality.staleReviewPositionKeys, ["ASSET:MANUAL:cycle", "US:AAPL"]);
  assert.equal(analysis.quality.untaggedPositionCount, 0);
  assert.equal(analysis.quality.missingRolePositionCount, 0);
  assert.ok(!analysis.warnings.some((warning) => warning.code === "RISK_BUDGET_BREACH" && warning.budgetKey === "satellite"));
  assert.ok(analysis.warnings.some((warning) => warning.code === "RISK_BUDGET_BREACH" && warning.budgetKey === "aiStructural"));

  assert.deepEqual(
    engine.analyzeRiskExposure([...riskRows].reverse(), riskBudgetInput, { todayKey: TODAY }),
    analysis,
    "위험 분석은 입력 행 순서와 무관해야 합니다."
  );
}

{
  const quality = engine.analyzeRiskExposure([{
    id: "manual-untagged",
    type: "MANUAL",
    name: "미분류 자산",
    value: 100,
    hasValue: true,
    investmentRole: "",
    riskTags: {},
    lastReviewedAt: "",
    nextReviewAt: "2026-08-04",
    reviewStatus: "INVALIDATED"
  }], {}, { todayKey: TODAY });

  assert.equal(quality.quality.untaggedPositionCount, 1);
  assert.equal(quality.quality.missingRolePositionCount, 1);
  assert.equal(quality.quality.staleReviewPositionCount, 1);
  assert.deepEqual(quality.positions[0].reviewReasons, [
    "NEVER_REVIEWED",
    "OVERDUE_REVIEW",
    "STATUS_INVALIDATED"
  ]);
  assert.ok(quality.warnings.some((warning) => warning.code === "UNTAGGED_POSITIONS"));
  assert.ok(quality.warnings.some((warning) => warning.code === "MISSING_INVESTMENT_ROLES"));
  assert.ok(quality.warnings.some((warning) => warning.code === "STALE_REVIEWS"));
  assert.equal(quality.budgets.core.status, "UNSET");
}

{
  const empty = engine.analyzeRiskExposure([], { coreMinPct: 50 }, { todayKey: TODAY });
  assert.equal(empty.totalValue, 0);
  assert.equal(empty.economicPositionCount, 0);
  assert.deepEqual(empty.positions, []);
  assert.deepEqual(empty.tagExposures, []);
  assert.equal(empty.quality.untaggedPositionCount, 0);
  assert.equal(empty.budgets.core.status, "NO_DATA");
  assert.ok(empty.warnings.some((warning) => warning.code === "EMPTY_PORTFOLIO"));
}

{
  const dueConflict = engine.analyzeRiskExposure([{
    id: "due-conflict",
    type: "CASH",
    name: "오늘 검토할 현금",
    value: 100,
    hasValue: true,
    investmentRole: "CORE",
    riskTags: { currency: ["KRW"] },
    lastReviewedAt: TODAY,
    nextReviewAt: TODAY,
    reviewStatus: "ACTIVE",
    migrationConflictCount: 1
  }], {}, { todayKey: TODAY });
  assert.deepEqual(dueConflict.positions[0].reviewReasons, ["DUE_REVIEW", "MIGRATION_CONFLICT"]);
  assert.equal(dueConflict.positions[0].reviewRequired, true);
}

{
  const invalidBudget = engine.analyzeRiskExposure([], { cycleMaxPct: 101 }, { todayKey: TODAY });
  assert.equal(invalidBudget.budgets.cycle.status, "INVALID");
  assert.ok(invalidBudget.warnings.some(
    (warning) => warning.code === "INVALID_RISK_BUDGET" && warning.inputKey === "cycleMaxPct"
  ));
}

// 결정적 난수로 다양한 유효 밴드·현재 비중을 반복해 성공/실패 계약을 고정한다.
{
  let seed = 0x5a17c0de;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let index = 0; index < 1000; index += 1) {
    const cuts = [0, 100, Math.floor(random() * 101), Math.floor(random() * 101), Math.floor(random() * 101)]
      .sort((left, right) => left - right);
    const targets = cuts.slice(1).map((cut, cutIndex) => cut - cuts[cutIndex]);
    const buckets = allocationBuckets().map((bucket, bucketIndex) => {
      const targetPct = targets[bucketIndex];
      return {
        ...bucket,
        currentValue: Math.floor(random() * 100001),
        minPct: Math.floor(targetPct * random()),
        targetPct,
        maxPct: targetPct + Math.floor((100 - targetPct) * random()),
        reviewRequiredCount: Math.floor(random() * 3),
        positionCount: Math.floor(random() * 5)
      };
    });
    const amount = 1 + Math.floor(random() * 100001);
    const plan = engine.planContribution({ mode: index % 2 ? "MONTHLY" : "ONE_TIME", amount, buckets });
    assert.deepEqual(
      engine.planContribution({ mode: index % 2 ? "MONTHLY" : "ONE_TIME", amount, buckets: [...buckets].reverse() }),
      plan,
      `무작위 사례 ${index}의 결과는 입력 순서와 무관해야 합니다.`
    );
    if (!plan.ok) {
      assert.deepEqual(plan.allocations, [], `무작위 실패 사례 ${index}는 부분안을 반환하면 안 됩니다.`);
      assert.equal(plan.totalAllocated, 0, `무작위 실패 사례 ${index}의 배분액은 0이어야 합니다.`);
      continue;
    }
    assert.equal(plan.totalAllocated, amount, `무작위 성공 사례 ${index}의 총액이 일치해야 합니다.`);
    assert.equal(
      plan.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      amount,
      `무작위 성공 사례 ${index}의 자산군 합계가 일치해야 합니다.`
    );
    plan.allocations.forEach((allocation) => {
      const projectedPct = allocation.projectedWeight * 100;
      assert.ok(projectedPct >= allocation.minPct - 0.000001, `무작위 성공 사례 ${index}의 최소 비중을 지켜야 합니다.`);
      assert.ok(projectedPct <= allocation.maxPct + 0.000001, `무작위 성공 사례 ${index}의 최대 비중을 지켜야 합니다.`);
    });
  }
}

console.log("action engine tests passed");
