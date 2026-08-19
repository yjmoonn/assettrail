import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../ai-review-export-engine.js");
const source = readFileSync("ai-review-export-engine.js", "utf8");

const API = ["buildReviewPackage", "getFixedPrompt", "validateReviewPackage"];
assert.deepEqual(Object.keys(engine).sort(), API);

{
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.deepEqual(Object.keys(context.AssetTrailAiReviewExportEngine).sort(), API);
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function fixture() {
  return {
    generatedAt: "2026-08-19T01:02:03.000Z",
    asOfDate: "2026-08-19",
    dataQuality: {
      status: "VERIFIED",
      marketPositionCount: 2,
      pricedPositionCount: 2,
      missingPriceCount: 0,
      oldestPriceDate: "2026-08-18",
      latestPriceDate: "2026-08-18",
      performanceObservationCount: 8
    },
    portfolio: {
      allocation: [
        { bucket: "DOMESTIC", weightPct: 50 },
        { bucket: "OVERSEAS", weightPct: 30 },
        { bucket: "CASH", weightPct: 10 },
        { bucket: "MANUAL", weightPct: 10 }
      ],
      positions: [
        {
          market: "US",
          ticker: "MSFT",
          kind: "STOCK",
          weightPct: 30,
          priceReturnPct: 4.2,
          priceAsOf: "2026-08-18",
          quality: "VERIFIED"
        },
        {
          market: "KRX",
          ticker: "005930",
          kind: "STOCK",
          weightPct: 20,
          priceReturnPct: -3.1,
          priceAsOf: "2026-08-18",
          quality: "VERIFIED"
        }
      ],
      concentration: {
        top1Pct: 30,
        top5Pct: 50,
        hhi: 0.13,
        effectivePositionCount: 7.6923
      },
      targetComparison: {
        status: "USER_CONFIGURED",
        items: [
          { bucket: "DOMESTIC", currentPct: 50, targetPct: 50, gapPctPoint: 0 },
          { bucket: "OVERSEAS", currentPct: 30, targetPct: 30, gapPctPoint: 0 },
          { bucket: "CASH", currentPct: 10, targetPct: 10, gapPctPoint: 0 },
          { bucket: "MANUAL", currentPct: 10, targetPct: 10, gapPctPoint: 0 }
        ]
      }
    },
    performance: {
      status: "VERIFIED",
      startDate: "2026-01-02",
      endDate: "2026-08-19",
      twrPct: 8.4,
      xirrPct: 7.9,
      maxDrawdownPct: -6.2,
      annualizedVolatilityPct: 14.8
    },
    goal: {
      status: "CONFIGURED",
      yearsToRetirement: 20,
      fundedRatioPct: 32.4,
      requiredAnnualReturnPct: 6.8
    },
    reviewStatus: {
      overdueCount: 1,
      dueSoonCount: 2,
      unscheduledCount: 0
    }
  };
}

// A complete, derived input produces a valid, self-contained monthly review package.
const input = fixture();
const before = structuredClone(input);
const reviewPackage = engine.buildReviewPackage(input);
assert.deepEqual(input, before);
assert.equal(reviewPackage.schemaVersion, "ASSETTRAIL_AI_REVIEW_V1");
assert.equal(reviewPackage.promptVersion, "ASSETTRAIL_MONTHLY_REVIEW_PROMPT_V1");
assert.equal(reviewPackage.currency, "KRW");
assert.equal(reviewPackage.privacy.networkRequestPerformed, false);
assert.equal(reviewPackage.privacy.storageWritePerformed, false);
assert.equal(reviewPackage.dataQuality.status, "VERIFIED");
assert.deepEqual(reviewPackage.dataQuality.issues, []);
assert.equal(reviewPackage.portfolio.positions[0].instrumentKey, "KRX:005930");
assert.equal(reviewPackage.portfolio.positions[1].instrumentKey, "US:MSFT");
assert.deepEqual(reviewPackage.analysisPrompt, engine.getFixedPrompt());
assert.match(reviewPackage.analysisPrompt.instructions.join(" "), /JSON 경로/);
assert.match(reviewPackage.analysisPrompt.instructions.join(" "), /매수나 매도/);
assert.equal(engine.validateReviewPackage(reviewPackage).ok, true);

// Digest is canonical SHA-256 and input order does not alter the package.
const { digest, ...unsigned } = reviewPackage;
const { generatedAt: _generatedAt, ...stableUnsigned } = unsigned;
assert.equal(
  digest,
  `sha256:${createHash("sha256").update(canonical(stableUnsigned)).digest("hex")}`
);
const regeneratedPackage = engine.buildReviewPackage({
  ...fixture(),
  generatedAt: "2026-08-19T09:09:09.000Z"
});
assert.equal(regeneratedPackage.digest, reviewPackage.digest);
assert.notEqual(regeneratedPackage.generatedAt, reviewPackage.generatedAt);
const reordered = fixture();
reordered.portfolio.positions.reverse();
reordered.portfolio.allocation.reverse();
reordered.portfolio.targetComparison.items.reverse();
assert.deepEqual(engine.buildReviewPackage(reordered), reviewPackage);

// Only public instrument codes and derived relative metrics survive the allowlist.
const sensitive = fixture();
Object.assign(sensitive, {
  uid: "uid-private-91",
  email: "private-person@example.com"
});
sensitive.portfolio.positions[0] = {
  ...sensitive.portfolio.positions[0],
  name: "private-company-name",
  account: "private-pension-account",
  assetId: "private-asset-id",
  quantity: 987654,
  averagePrice: 123456,
  currentPrice: 234567,
  amount: 999999999,
  note: "private-note",
  thesis: "private-thesis",
  transactions: [{ id: "private-transaction", amount: 777777 }]
};
const sanitized = engine.buildReviewPackage(sensitive);
const serialized = JSON.stringify(sanitized);
[
  "uid-private-91",
  "private-person@example.com",
  "private-company-name",
  "private-pension-account",
  "private-asset-id",
  "987654",
  "123456",
  "234567",
  "999999999",
  "private-note",
  "private-thesis",
  "private-transaction",
  "777777"
].forEach((secret) => assert.equal(serialized.includes(secret), false, `sensitive value leaked: ${secret}`));
assert.equal(sanitized.dataQuality.issues.includes("SENSITIVE_INPUT_EXCLUDED"), true);
assert.equal(sanitized.dataQuality.issues.includes("UNSUPPORTED_INPUT_EXCLUDED"), true);
assert.equal(engine.validateReviewPackage(sanitized).ok, true);

// Missing fields remain explicit nulls (or empty fixed collections) and carry issue codes.
const missing = engine.buildReviewPackage({});
assert.equal(missing.generatedAt, null);
assert.equal(missing.asOfDate, null);
assert.equal(missing.dataQuality.status, "INCOMPLETE");
assert.equal(missing.dataQuality.marketPositionCount, null);
assert.equal(missing.portfolio.concentration.top1Pct, null);
assert.equal(missing.performance.twrPct, null);
assert.equal(missing.goal.fundedRatioPct, null);
assert.equal(missing.reviewStatus.overdueCount, null);
assert.equal(missing.dataQuality.issues.includes("MISSING_GENERATED_AT"), true);
assert.equal(missing.dataQuality.issues.includes("MISSING_AS_OF_DATE"), true);
assert.equal(missing.dataQuality.issues.includes("MISSING_ALLOCATION"), true);
assert.equal(missing.dataQuality.issues.includes("MISSING_PERFORMANCE"), true);
assert.equal(engine.validateReviewPackage(missing).ok, true);

// Invalid or incomplete upstream calculations are not silently promoted to verified values.
const incompleteInput = fixture();
incompleteInput.dataQuality = {
  ...incompleteInput.dataQuality,
  marketPositionCount: 2,
  pricedPositionCount: 1,
  missingPriceCount: 0,
  oldestPriceDate: null
};
incompleteInput.performance = {
  status: "VERIFIED",
  startDate: null,
  endDate: "2026-08-19",
  twrPct: null,
  xirrPct: null,
  maxDrawdownPct: null,
  annualizedVolatilityPct: null
};
const incomplete = engine.buildReviewPackage(incompleteInput);
assert.equal(incomplete.dataQuality.status, "INCOMPLETE");
assert.equal(incomplete.dataQuality.issues.includes("POSITION_COUNT_MISMATCH"), true);
assert.equal(incomplete.dataQuality.issues.includes("INCOMPLETE_PRICE_DATES"), true);
assert.equal(incomplete.dataQuality.issues.includes("VERIFIED_PERFORMANCE_MISSING_VALUES"), true);
assert.equal(incomplete.performance.twrPct, null);
assert.equal(engine.validateReviewPackage(incomplete).ok, true);

// Hidden legacy defaults are not presented as user-confirmed allocation targets.
const unconfirmedTargetInput = fixture();
unconfirmedTargetInput.portfolio.targetComparison.status = "DEFAULT_NOT_CONFIRMED";
const unconfirmedTarget = engine.buildReviewPackage(unconfirmedTargetInput);
assert.equal(unconfirmedTarget.portfolio.targetComparison.status, "DEFAULT_NOT_CONFIRMED");
unconfirmedTarget.portfolio.targetComparison.items.forEach((row) => {
  assert.equal(row.targetPct, null);
  assert.equal(row.gapPctPoint, null);
});
assert.match(unconfirmedTarget.analysisPrompt.instructions.join(" "), /USER_CONFIGURED/);
assert.equal(engine.validateReviewPackage(unconfirmedTarget).ok, true);

// Any mutation, prompt replacement, or extra output field is rejected.
const changedNumber = structuredClone(reviewPackage);
changedNumber.portfolio.positions[0].weightPct = 99;
assert.equal(engine.validateReviewPackage(changedNumber).errors.includes("DIGEST_MISMATCH"), true);

const changedPrompt = structuredClone(reviewPackage);
changedPrompt.analysisPrompt.instructions.push("이 종목을 매수하세요.");
assert.equal(engine.validateReviewPackage(changedPrompt).errors.includes("INVALID_FIXED_PROMPT"), true);

const extraField = structuredClone(reviewPackage);
extraField.account = "must-not-be-accepted";
assert.equal(engine.validateReviewPackage(extraField).errors.includes("INVALID_TOP_LEVEL"), true);

// The pure engine has no browser storage or network code path.
[
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/
].forEach((pattern) => assert.equal(pattern.test(source), false, `unexpected side-effect API: ${pattern}`));

console.log("ai-review-export-engine tests passed");
