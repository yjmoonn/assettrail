import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const engine = createRequire(import.meta.url)("../ai-review-export-engine.js");
function fixture() {
  const market = {
    assetType: "KRX", ticker: "000660", kind: "STOCK", accountClass: "GENERAL",
    accountName: "검수 일반", valuationMode: "FINAL_CLOSE", quantity: 2,
    appliedPrice: 100, priceCurrency: "KRW", priceAsOf: "2026-09-10",
    sessionStatus: "FINAL_CLOSE", marketValueKRW: 200
  };
  return {
    snapshot: {
      id: "test-saved-snapshot", createdAt: "2026-09-10T08:00:00.000Z",
      total: 600, typeTotals: { KRX: 500, CASH: 100 }, note: "private ignored note",
      valuation: { schemaVersion: "assettrail.snapshot-valuation.v2", positions: [
        { ...market, assetId: "private-a" },
        { ...market, assetId: "private-b", quantity: 1, marketValueKRW: 100 },
        { ...market, assetId: "private-c", accountClass: "ISA", accountName: "검수 ISA" },
        { assetId: "private-d", assetType: "CASH", accountClass: "GENERAL",
          accountName: "검수 현금", valuationMode: "MANUAL_AMOUNT", marketValueKRW: 100 }
      ] }
    },
    generatedAt: "2026-09-11T05:00:00.000Z", timeZone: "Asia/Seoul",
    priceStaleDays: 3, performanceObservationCount: 0,
    performance: { status: "INCOMPLETE", startDate: null, endDate: null, twrPct: null,
      xirrPct: null, maxDrawdownPct: null, annualizedVolatilityPct: null },
    goal: { status: "DEFAULT_NOT_CONFIRMED", yearsToRetirement: null, fundedRatioPct: null,
      requiredAnnualReturnPct: null },
    reviewStatus: { overdueCount: 0, dueSoonCount: 0, unscheduledCount: 1 }
  };
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// No browser, clock, storage or network is available in this producer runtime.
const sandbox = vm.createContext({});
vm.runInContext(readFileSync("ai-review-export-engine.js", "utf8"), sandbox);
const input = freeze(fixture());
const original = JSON.stringify(input);
const mapped = engine.buildSnapshotReviewInput(input);
sandbox.inputJSON = original;
const isolated = vm.runInContext("AssetTrailAiReviewExportEngine.buildSnapshotReviewInput(JSON.parse(inputJSON))", sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(isolated)), mapped);
assert.equal(JSON.stringify(input), original);
assert.equal(mapped.portfolio.positions.length, 3);
assert.equal(mapped.portfolio.positions.find(p => p.accountClass === "GENERAL" && p.market).quantity, 3);
assert.equal(mapped.portfolio.positions.find(p => p.accountClass === "ISA").quantity, 2);
assert.ok(Math.abs(mapped.portfolio.concentration.top1Pct - 500 / 600 * 100) < 1e-10);
assert.equal(mapped.snapshotCreatedAt, input.snapshot.createdAt);
assert.equal(mapped.asOfDate, "2026-09-10");
assert.equal(mapped.dataQuality.oldestPriceDate, "2026-09-10");
assert.ok(!JSON.stringify(mapped).includes("private-"));
const exported = engine.buildReviewPackage(mapped);
assert.deepEqual(engine.validateReviewPackage(exported), { ok: true, errors: [] });
const regenerated = engine.buildReviewPackage(engine.buildSnapshotReviewInput({ ...input,
  generatedAt: "2026-09-11T06:00:00.000Z" }));
assert.equal(regenerated.digest, exported.digest);

// Exchange holiday certification is not implied by the preserved weekday age heuristic.
for (const [today, expected] of [["2026-09-13", "VERIFIED"], ["2026-09-15", "VERIFIED"],
  ["2026-09-16", "STALE"], ["2026-09-09", "UNAVAILABLE"]]) {
  const value = engine.buildSnapshotReviewInput({ ...input, generatedAt: `${today}T05:00:00.000Z` });
  assert.equal(value.portfolio.positions.find(p => p.market).quality, expected);
  assert.equal(value.asOfDate, "2026-09-10");
}
const futureWeekend = fixture();
futureWeekend.snapshot.valuation.positions.filter(p => p.assetType === "KRX")
  .forEach(p => { p.priceAsOf = "2026-09-13"; });
assert.equal(engine.buildSnapshotReviewInput({ ...futureWeekend, generatedAt: "2026-09-12T05:00:00.000Z" })
  .dataQuality.status, "INCOMPLETE");

const accountless = fixture();
accountless.snapshot.valuation.schemaVersion = "assettrail.snapshot-valuation.v1";
const legacy = engine.buildSnapshotReviewInput(accountless);
assert.equal(legacy.valuationStatus, "MISSING_SNAPSHOT_ACCOUNT_NAMES");
assert.ok(legacy.portfolio.positions.every(p => p.accountName === ""));
const noValuation = fixture();
delete noValuation.snapshot.valuation;
assert.equal(engine.buildSnapshotReviewInput(noValuation).valuationStatus, "MISSING_LEGACY_SNAPSHOT_VALUATION");
assert.deepEqual(engine.buildSnapshotReviewInput(noValuation).portfolio.positions, []);
assert.equal(engine.buildSnapshotReviewInput({ ...input, snapshot: null }).valuationStatus, "UNAVAILABLE");

for (const field of ["appliedPrice", "priceAsOf", "kind", "sessionStatus"]) {
  const conflict = fixture();
  conflict.snapshot.valuation.positions[1][field] = field === "appliedPrice" ? 200 : field === "kind" ? "ETF" : "different";
  const before = JSON.stringify(conflict);
  assert.throws(() => engine.buildSnapshotReviewInput(conflict), /CONFLICTING_SNAPSHOT_POSITION_BASIS/);
  assert.equal(JSON.stringify(conflict), before);
}
for (const change of [{ timeZone: "invalid" }, { generatedAt: "invalid" },
  { priceStaleDays: -1 }, { timeZone: null }]) {
  assert.throws(() => engine.buildSnapshotReviewInput({ ...input, ...change }), /INVALID_SNAPSHOT_REVIEW_CONTEXT/);
}
const invalid = fixture();
assert.equal(engine.buildSnapshotReviewInput({ ...input, asOfDate: "2026-09-11" }).asOfDate,
  "2026-09-10", "caller cannot relabel a saved snapshot as a newer valuation");
const midnight = fixture();
midnight.snapshot.createdAt = "2026-09-10T23:00:00.000Z";
assert.equal(engine.buildSnapshotReviewInput(midnight).asOfDate, "2026-09-11");
assert.equal(engine.buildSnapshotReviewInput({ ...midnight, timeZone: "America/New_York" }).asOfDate, "2026-09-10");
invalid.snapshot.valuation.schemaVersion = "unknown";
assert.throws(() => engine.buildSnapshotReviewInput(invalid), /INVALID_SNAPSHOT_REVIEW_SOURCE/);
console.log("snapshot review input tests passed");
