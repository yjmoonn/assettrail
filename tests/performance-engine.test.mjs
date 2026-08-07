import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../performance-engine.js");

const API = [
  "analyzePerformance",
  "buildPerformanceSeries",
  "calculateDrawdown",
  "calculateTwr",
  "calculateVolatility",
  "calculateXirr",
  "compareBenchmark",
  "decomposeValueChange"
];

assert.deepEqual(Object.keys(engine).sort(), API);

{
  const context = vm.createContext({});
  vm.runInContext(readFileSync("performance-engine.js", "utf8"), context);
  assert.deepEqual(Object.keys(context.AssetTrailPerformanceEngine).sort(), API);
}

function verifiedPoint(date, navKRW, externalFlowKRW = 0, extra = {}) {
  return {
    date,
    navKRW,
    externalFlowKRW,
    completeness: true,
    ledgerFingerprint: "ledger-fixture-v1",
    priceFingerprint: `prices-${date}`,
    ...extra
  };
}

function hasCode(result, code) {
  return result.diagnostics.some((item) => item.code === code);
}

function closeTo(actual, expected, tolerance = 1e-10, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message || `${actual} should be within ${tolerance} of ${expected}`
  );
}

// Normalization is UTC-date based, deterministic, and never mutates caller input.
{
  const input = [
    verifiedPoint("2026-01-03", 121),
    verifiedPoint("2026-01-01", 100),
    verifiedPoint("2026-01-02", 110)
  ];
  const before = JSON.parse(JSON.stringify(input));
  const result = engine.buildPerformanceSeries(input);
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  assert.deepEqual(result.observations.map((row) => row.date), ["2026-01-01", "2026-01-02", "2026-01-03"]);
  result.returns.forEach((row) => closeTo(row.return, 0.1));
  assert.deepEqual(input, before);
  assert.equal(result.period.days, 2);
}

// Minimal observations remain calculable but cannot be represented as verified data.
{
  const result = engine.buildPerformanceSeries([
    { date: "2026-01-01", navKRW: 100, externalFlowKRW: 0 },
    { date: "2026-01-02", navKRW: 101, externalFlowKRW: 0 }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.availability, "LIMITED");
  assert.equal(hasCode(result, "UNVERIFIED_COMPLETENESS"), true);
  assert.equal(hasCode(result, "MISSING_LEDGER_FINGERPRINT"), true);
  assert.equal(hasCode(result, "MISSING_PRICE_FINGERPRINT"), true);

  const topLevelVerification = engine.buildPerformanceSeries({
    completeness: true,
    ledgerFingerprint: "ledger-top-level",
    priceFingerprint: "prices-top-level",
    observations: [
      { date: "2026-01-01", navKRW: 100, externalFlowKRW: 0 },
      { date: "2026-01-02", navKRW: 101, externalFlowKRW: 0 }
    ]
  });
  assert.equal(topLevelVerification.availability, "VERIFIED");

  const unsupportedPolicy = engine.buildPerformanceSeries({
    flowPolicy: "BEGINNING_OF_DAY",
    completeness: true,
    ledgerFingerprint: "ledger",
    priceFingerprint: "prices",
    observations: [
      { date: "2026-01-01", navKRW: 100 },
      { date: "2026-01-02", navKRW: 101 }
    ]
  });
  assert.equal(unsupportedPolicy.ok, false);
  assert.equal(hasCode(unsupportedPolicy, "UNSUPPORTED_FLOW_POLICY"), true);
}

// Bad boundaries are rejected instead of being silently sorted or clipped into a result.
{
  const duplicate = engine.buildPerformanceSeries([
    verifiedPoint("2026-01-01", 100),
    verifiedPoint("2026-01-01", 101)
  ]);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.availability, "UNAVAILABLE");
  assert.equal(hasCode(duplicate, "DUPLICATE_OBSERVATION_DATE"), true);

  const negative = engine.buildPerformanceSeries([
    verifiedPoint("2026-01-01", -1),
    verifiedPoint("2026-01-02", 1)
  ]);
  assert.equal(negative.ok, false);
  assert.equal(hasCode(negative, "NEGATIVE_NAV"), true);

  const incomplete = engine.buildPerformanceSeries([
    verifiedPoint("2026-01-01", 100),
    verifiedPoint("2026-01-02", 101, 0, { completeness: { complete: false, missing: ["US:AAPL"] } })
  ]);
  assert.equal(incomplete.ok, false);
  assert.equal(hasCode(incomplete, "INCOMPLETE_OBSERVATION"), true);

  const negativePreFlow = engine.calculateTwr([
    verifiedPoint("2026-01-01", 100),
    verifiedPoint("2026-01-02", 50, 60)
  ]);
  assert.equal(negativePreFlow.ok, false);
  assert.equal(hasCode(negativePreFlow, "NEGATIVE_PRE_FLOW_NAV"), true);
}

// Large date gaps do not masquerade as verified daily observations.
{
  const result = engine.buildPerformanceSeries([
    verifiedPoint("2026-01-01", 100),
    verifiedPoint("2026-01-10", 110)
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.availability, "LIMITED");
  assert.equal(hasCode(result, "IRREGULAR_OBSERVATION_GAP"), true);
  assert.equal(result.quality.maxGapDays, 9);
}

// End-of-day external flow policy: 10%, contribution, then 10% geometrically links to 21%.
const referenceObservations = [
  verifiedPoint("2025-01-01", 100),
  verifiedPoint("2025-07-01", 160, 50),
  verifiedPoint("2026-01-01", 176)
];

{
  const before = JSON.parse(JSON.stringify(referenceObservations));
  const result = engine.calculateTwr(referenceObservations, { maxGapDays: 200 });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  closeTo(result.periodReturn, 0.21);
  closeTo(result.annualizedReturn, 0.21);
  assert.equal(result.annualizedDisplayEligible, true);
  result.subperiodReturns.forEach((row) => closeTo(row.return, 0.1));
  assert.deepEqual(referenceObservations, before);
}

// Microsoft XIRR official example: 37.3362535% on a 365-day convention.
{
  const result = engine.calculateXirr({
    cashFlows: [
      { date: "2008-01-01", amountKRW: -10_000 },
      { date: "2008-03-01", amountKRW: 2_750 },
      { date: "2008-10-30", amountKRW: 4_250 },
      { date: "2009-02-15", amountKRW: 3_250 },
      { date: "2009-04-01", amountKRW: 2_750 }
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  closeTo(result.annualizedReturn, 0.373362535, 1e-8);
  assert.equal(result.period.days, 456);
}

// The same verified portfolio fixture yields a distinct money-weighted result.
{
  const result = engine.calculateXirr({
    observations: referenceObservations,
    options: { maxGapDays: 200 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  closeTo(result.annualizedReturn, 0.20964938570904812, 1e-10);
  closeTo(result.periodEquivalentReturn, result.annualizedReturn, 1e-12);
  assert.deepEqual(result.cashFlows, [
    { date: "2025-01-01", amountKRW: -100 },
    { date: "2025-07-01", amountKRW: -50 },
    { date: "2026-01-01", amountKRW: 176 }
  ]);
}

// Multiple roots, no root, and bounded iteration all fail explicitly.
{
  const multiple = engine.calculateXirr({
    cashFlows: [
      { date: "2021-01-01", amountKRW: -100 },
      { date: "2022-01-01", amountKRW: 230 },
      { date: "2023-01-01", amountKRW: -132 }
    ]
  });
  assert.equal(multiple.ok, false);
  assert.equal(multiple.availability, "UNAVAILABLE");
  assert.equal(hasCode(multiple, "XIRR_MULTIPLE_ROOTS"), true);
  assert.equal(multiple.roots.length, 2);
  closeTo(multiple.roots[0], 0.1, 1e-9);
  closeTo(multiple.roots[1], 0.2, 1e-9);

  const noRoot = engine.calculateXirr({
    cashFlows: [
      { date: "2021-01-01", amountKRW: -100 },
      { date: "2022-01-01", amountKRW: 230 },
      { date: "2023-01-01", amountKRW: -200 }
    ]
  });
  assert.equal(noRoot.ok, false);
  assert.equal(hasCode(noRoot, "XIRR_NO_ROOT"), true);

  const bounded = engine.calculateXirr({
    cashFlows: [
      { date: "2008-01-01", amountKRW: -10_000 },
      { date: "2008-03-01", amountKRW: 2_750 },
      { date: "2008-10-30", amountKRW: 4_250 },
      { date: "2009-02-15", amountKRW: 3_250 },
      { date: "2009-04-01", amountKRW: 2_750 }
    ]
  }, { maxIterations: 1 });
  assert.equal(bounded.ok, false);
  assert.equal(bounded.maxIterations, 1);
  assert.equal(hasCode(bounded, "XIRR_ITERATION_LIMIT"), true);
}

// KRW value bridge reconciles cash flow, price, FX, income, and recorded costs.
{
  const result = engine.decomposeValueChange({
    beginningValueKRW: 100_000,
    endingValueKRW: 142_900,
    depositsKRW: 10_000,
    withdrawalsKRW: 0,
    priceEffectKRW: 11_000,
    fxEffectKRW: 21_000,
    dividendKRW: 1_000,
    interestKRW: 0,
    feeKRW: 100,
    taxKRW: 0
  });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  assert.equal(result.reconciled, true);
  assert.equal(result.totalChangeKRW, 42_900);
  assert.equal(result.components.externalFlowKRW, 10_000);
  assert.equal(result.components.incomeEffectKRW, 1_000);
  assert.equal(result.components.costEffectKRW, -100);
  assert.equal(result.components.totalInvestmentEffectKRW, 32_900);
  assert.equal(result.residualKRW, 0);

  const broken = engine.decomposeValueChange({
    beginningValueKRW: 100_000,
    endingValueKRW: 143_000,
    depositsKRW: 10_000,
    withdrawalsKRW: 0,
    priceEffectKRW: 11_000,
    fxEffectKRW: 21_000,
    dividendKRW: 1_000,
    interestKRW: 0,
    feeKRW: 100,
    taxKRW: 0
  });
  assert.equal(broken.ok, false);
  assert.equal(broken.residualKRW, 100);
  assert.equal(hasCode(broken, "BRIDGE_NOT_RECONCILED"), true);

  const incomplete = engine.decomposeValueChange({
    beginningValueKRW: 100,
    endingValueKRW: 110,
    externalFlowKRW: 0,
    priceEffectKRW: 10
  });
  assert.equal(incomplete.ok, true);
  assert.equal(incomplete.availability, "LIMITED");
  assert.equal(incomplete.reconciled, false);
  assert.equal(hasCode(incomplete, "INCOMPLETE_ATTRIBUTION"), true);

  const intervalIncomplete = engine.decomposeValueChange({
    observations: [
      verifiedPoint("2026-01-01", 100),
      verifiedPoint("2026-01-02", 110, 0, { attribution: { priceEffectKRW: 10 } })
    ]
  });
  assert.equal(intervalIncomplete.ok, true);
  assert.equal(intervalIncomplete.availability, "LIMITED");
  assert.equal(intervalIncomplete.reconciled, false);
}

// Benchmark comparison distinguishes percentage-point and geometric relative performance.
{
  const result = engine.compareBenchmark({
    portfolioReturn: 0.21,
    benchmarkReturn: 0.10,
    kind: "TOTAL_RETURN",
    portfolioCurrency: "KRW",
    currency: "KRW"
  });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  closeTo(result.percentagePointDifference, 0.11);
  closeTo(result.geometricRelativeReturn, 0.1);

  const priceOnly = engine.compareBenchmark({
    portfolioReturn: 0.10,
    benchmarkReturn: 0.08,
    kind: "PRICE_ONLY",
    portfolioCurrency: "KRW",
    currency: "KRW"
  });
  assert.equal(priceOnly.ok, true);
  assert.equal(priceOnly.availability, "LIMITED");
  assert.equal(hasCode(priceOnly, "PRICE_ONLY_BENCHMARK"), true);

  const mismatch = engine.compareBenchmark({
    portfolioReturn: 0.10,
    benchmarkReturn: 0.08,
    kind: "TOTAL_RETURN",
    portfolioCurrency: "KRW",
    currency: "USD"
  });
  assert.equal(mismatch.ok, false);
  assert.equal(hasCode(mismatch, "BENCHMARK_CURRENCY_MISMATCH"), true);

  const levels = engine.compareBenchmark({
    portfolioReturn: 0.21,
    kind: "TOTAL_RETURN",
    portfolioCurrency: "KRW",
    currency: "KRW",
    observations: [
      { date: "2026-01-01", level: 100 },
      { date: "2026-12-31", level: 110 }
    ]
  });
  assert.equal(levels.ok, true);
  closeTo(levels.benchmarkReturn, 0.1);
}

// Drawdown is computed from a linked wealth index, with deterministic earliest ties and recovery.
{
  const result = engine.calculateDrawdown({
    wealthSeries: [
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 120 },
      { date: "2026-01-03", value: 90 },
      { date: "2026-01-04", value: 108 },
      { date: "2026-01-05", value: 121 }
    ]
  });
  assert.equal(result.ok, true);
  closeTo(result.maxDrawdown, -0.25);
  assert.equal(result.peakDate, "2026-01-02");
  assert.equal(result.troughDate, "2026-01-03");
  assert.equal(result.recoveryDate, "2026-01-05");
  assert.equal(result.declineDays, 1);
  assert.equal(result.recoveryDays, 2);
  assert.equal(result.underwaterDays, 3);

  const duplicate = engine.calculateDrawdown({
    wealthSeries: [
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-01", value: 99 }
    ]
  });
  assert.equal(duplicate.ok, false);
  assert.equal(hasCode(duplicate, "DUPLICATE_WEALTH_DATE"), true);
}

// Volatility uses n-1 sample standard deviation of daily log returns and sqrt(252).
{
  const returns = [0.01, -0.02, 0.03, 0];
  const logs = returns.map((rate) => Math.log1p(rate));
  const mean = logs.reduce((sum, value) => sum + value, 0) / logs.length;
  const expectedSample = Math.sqrt(
    logs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (logs.length - 1)
  );
  const result = engine.calculateVolatility(returns);
  assert.equal(result.ok, true);
  assert.equal(result.availability, "LIMITED");
  closeTo(result.sampleStandardDeviation, expectedSample, 1e-15);
  closeTo(result.annualizedVolatility, expectedSample * Math.sqrt(252), 1e-14);
  assert.equal(result.displayEligible, false);
  assert.equal(hasCode(result, "LIMITED_VOLATILITY_SAMPLE"), true);

  const enough = engine.calculateVolatility(Array.from({ length: 20 }, () => 0.01));
  assert.equal(enough.ok, true);
  assert.equal(enough.availability, "VERIFIED");
  assert.equal(enough.displayEligible, true);
  closeTo(enough.annualizedVolatility, 0, 1e-14);

  const totalLoss = engine.calculateVolatility([0.01, -1]);
  assert.equal(totalLoss.ok, false);
  assert.equal(hasCode(totalLoss, "INVALID_LOG_RETURN"), true);
}

// Full analysis composes all core metrics and keeps a verified daily series verified.
{
  const observations = [];
  let nav = 100;
  for (let day = 1; day <= 22; day += 1) {
    const date = `2026-01-${String(day).padStart(2, "0")}`;
    observations.push(verifiedPoint(date, nav));
    nav *= 1.001;
  }
  const before = JSON.parse(JSON.stringify(observations));
  const result = engine.analyzePerformance({ observations });
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  assert.equal(result.series.returns.length, 21);
  assert.equal(result.twr.ok, true);
  assert.equal(result.xirr.ok, true);
  assert.equal(result.drawdown.maxDrawdown, 0);
  assert.equal(result.volatility.displayEligible, true);
  assert.equal(result.attribution, null);
  assert.equal(result.benchmark, null);
  assert.deepEqual(observations, before);
}

// Full analysis preserves verification metadata while reusing normalized observations for benchmarks.
{
  const observations = [
    verifiedPoint("2026-02-01", 100, 0, {
      benchmark: { level: 100, kind: "TOTAL_RETURN", currency: "KRW" }
    }),
    verifiedPoint("2026-02-02", 100.1, 0, {
      benchmark: { level: 100.05, kind: "TOTAL_RETURN", currency: "KRW" }
    }),
    verifiedPoint("2026-02-03", 100.2, 0, {
      benchmark: { level: 100.1, kind: "TOTAL_RETURN", currency: "KRW" }
    })
  ];
  const result = engine.analyzePerformance(
    { observations },
    { minimumDisplayObservations: 2 }
  );
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  assert.equal(result.benchmark.availability, "VERIFIED");
  closeTo(result.benchmark.portfolioReturn, 0.002);
  closeTo(result.benchmark.benchmarkReturn, 0.001);
  assert.equal(hasCode(result, "UNVERIFIED_COMPLETENESS"), false);
}

console.log("performance engine tests passed");
