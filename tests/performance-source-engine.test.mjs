import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = require("../performance-source-engine.js");
const ledger = require("../ledger-engine.js");
function mark(date, nav) {
  const value = source.normalizePerformanceObservation({ id: date, date, capturedAt: `${date}T08:00:00.000Z`,
    cutoff: "END_OF_DAY_POST_FLOW", navKRW: nav, marketValueKRW: nav, cashKRW: 0,
    manualValueKRW: 0, unsettledKRW: 0, usMarketValueNative: 0, usMarketValueKRW: 0, usdKrw: 1300,
    typeTotals: { KRX: nav, US: 0, CASH: 0, MANUAL: 0 },
    cumulative: { externalFlowKRW: 0, depositsKRW: 0, withdrawalsKRW: 0, dividendsKRW: 0,
      interestKRW: 0, feesKRW: 0, taxesKRW: 0, fxDifferenceKRW: 0 },
    benchmarkLevels: {}, priceBasis: "UNADJUSTED_CLOSE", distributionTreatment: "EXCLUDED",
    ledgerAsOfFingerprint: ledger.fingerprintLedger([]), priceFingerprint: "performance-price-v1:" + "a".repeat(32),
    completeness: "COMPLETE", issueCodes: [] });
  value.markFingerprint = source.performanceObservationFingerprint(value);
  return value;
}
const input = { performanceObservations: [mark("2026-09-09", 100), mark("2026-09-10", 110)],
  events: [], baselineDate: "2026-09-01", todayKey: "2026-09-11" };
const before = JSON.stringify(input);
const result = source.buildReviewPerformance(input);
assert.equal(result.status, "VERIFIED");
assert.ok(Math.abs(result.twrPct - 10) < 1e-10);
assert.equal(result.maxDrawdownPct, 0);
assert.equal(result.annualizedVolatilityPct, null);
assert.equal(JSON.stringify(input), before);
assert.equal(source.buildReviewPerformance({ ...input, todayKey: "2026-09-18" }).status, "STALE");
assert.equal(source.buildReviewPerformance({ ...input, todayKey: "2026-09-08" }).status, "INCOMPLETE");
for (const mutate of [
  m => { m.markFingerprint = "performance-mark-v1:" + "b".repeat(32); },
  m => { m.ledgerAsOfFingerprint = "wrong"; m.markFingerprint = source.performanceObservationFingerprint(m); },
  m => { m.navKRW = 111; m.markFingerprint = source.performanceObservationFingerprint(m); },
  m => { m.cashKRW = null; },
  m => { m.priceBasis = "ADJUSTED_CLOSE"; m.markFingerprint = source.performanceObservationFingerprint(m); }
]) {
  const changed = structuredClone(input); mutate(changed.performanceObservations[1]);
  const blocked = source.buildReviewPerformance(changed);
  assert.equal(blocked.status, "INCOMPLETE");
  assert.equal(blocked.twrPct, null);
}
assert.throws(() => source.buildReviewPerformance({ ...input, events: [{ type: "INVALID" }] }), /LEDGER/);
assert.throws(() => source.buildReviewPerformance({ ...input, todayKey: "2026-02-30" }), /TODAY/);
console.log("standalone performance source: return, staleness, fingerprints and NAV gate passed");
