import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../etf-exposure-engine.js");

const API = ["analyzeLookThrough", "normalizeInstrumentId", "validateHoldingsCatalog"];
assert.deepEqual(Object.keys(engine).sort(), API);

{
  const context = vm.createContext({ URL });
  vm.runInContext(readFileSync("etf-exposure-engine.js", "utf8"), context);
  assert.deepEqual(Object.keys(context.AssetTrailEtfExposureEngine).sort(), API);
}

function source(url = "https://example.test/holdings") {
  return { name: "테스트 운용사", url, retrievedAt: "2026-08-07T01:02:03Z" };
}

function fund(instrumentId, holdings, extra = {}) {
  return {
    instrumentId,
    name: `ETF ${instrumentId}`,
    structure: "PHYSICAL_LONG_ONLY",
    asOf: "2026-08-06",
    holdings,
    ...extra
  };
}

function catalog(funds, extra = {}) {
  return {
    schemaVersion: "assettrail.etf-holdings.v1",
    generatedAt: "2026-08-07T01:02:03Z",
    source: source(),
    redistribution: "ALLOWED",
    funds,
    ...extra
  };
}

function code(result, expected) {
  return result.diagnostics.some((item) => item.code === expected);
}

function closeTo(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function exposure(result, instrumentId) {
  return result.exposures.find((item) => item.instrumentId === instrumentId);
}

function bucket(result, name) {
  return result.bucketExposures.find((item) => item.bucket === name);
}

// Stable IDs accept numeric and alphanumeric six-place KRX symbols, including
// new ETF/ETN-style codes, without weakening US symbol validation.
{
  assert.equal(engine.normalizeInstrumentId("KRX", "5930"), "KRX:005930");
  assert.equal(engine.normalizeInstrumentId("krx:0092b0"), "KRX:0092B0");
  assert.equal(engine.normalizeInstrumentId("0092B0"), "KRX:0092B0");
  assert.equal(engine.normalizeInstrumentId({ exchange: "XKRX", code: "A12345" }), "KRX:A12345");
  assert.equal(engine.normalizeInstrumentId("US", "brk.b"), "US:BRK.B");
  assert.equal(engine.normalizeInstrumentId({ market: "NASDAQ", ticker: "msft" }), "US:MSFT");
  assert.equal(engine.normalizeInstrumentId("AAPL"), "");
  assert.equal(engine.normalizeInstrumentId("KRX:92B0"), "");
  assert.equal(engine.normalizeInstrumentId("KRX:1234567"), "");
  assert.equal(engine.normalizeInstrumentId("US:BAD/SYMBOL"), "");
}

// An explicit empty catalog is valid and distinguishable from malformed input.
{
  const result = engine.validateHoldingsCatalog({
    schema: "assettrail.etf-holdings.v1",
    funds: []
  });
  assert.equal(result.ok, true);
  assert.equal(result.usable, true);
  assert.equal(result.funds.length, 0);
  assert.equal(code(result, "NO_COVERAGE"), true);

  const malformed = engine.validateHoldingsCatalog(null);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.usable, false);
  assert.equal(code(malformed, "INVALID_CATALOG"), true);
  assert.equal(code(malformed, "UNSUPPORTED_CATALOG_SCHEMA"), true);
}

// Catalog metadata and fund-level overrides survive canonicalization. Validation
// is deterministic and does not alter the caller-owned object.
{
  const input = catalog([
    fund("KRX:069500", [{ instrumentId: "KRX:005930", weight: 1 }], {
      name: "KODEX 200",
      asOf: "2026-08-05",
      source: source("https://issuer.example.test/kodex200"),
      redistribution: {
        status: "USER_SUPPLIED",
        notice: "사용자가 직접 제공",
        termsUrl: "https://issuer.example.test/terms"
      }
    })
  ], { asOf: "2026-08-06" });
  const before = JSON.parse(JSON.stringify(input));
  const first = engine.validateHoldingsCatalog(input);
  const second = engine.validateHoldingsCatalog(input);

  assert.equal(first.ok, true);
  assert.equal(first.generatedAt, "2026-08-07T01:02:03.000Z");
  assert.equal(first.asOf, "2026-08-06");
  assert.equal(first.source.url, "https://example.test/holdings");
  assert.equal(first.source.retrievedAt, "2026-08-07T01:02:03.000Z");
  assert.equal(first.redistribution.status, "ALLOWED");
  assert.equal(first.funds[0].name, "KODEX 200");
  assert.equal(first.funds[0].asOf, "2026-08-05");
  assert.equal(first.funds[0].source.url, "https://issuer.example.test/kodex200");
  assert.equal(first.funds[0].source.retrievedAt, "2026-08-07T01:02:03.000Z");
  assert.equal(first.funds[0].redistribution.status, "USER_SUPPLIED");
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
}

// Missing/unsafe provenance, invalid timestamps, and redistribution restrictions
// fail closed rather than being silently accepted.
{
  const noSource = engine.validateHoldingsCatalog({
    schemaVersion: "assettrail.etf-holdings.v1",
    redistribution: "ALLOWED",
    funds: [fund("KRX:069500", [{ instrumentId: "KRX:005930", weight: 1 }])]
  });
  assert.equal(noSource.ok, false);
  assert.equal(code(noSource, "MISSING_SOURCE_URL"), true);

  const unsafeSource = engine.validateHoldingsCatalog(catalog([], {
    source: "file:///tmp/private.csv",
    funds: [fund("KRX:069500", [{ instrumentId: "KRX:005930", weight: 1 }])]
  }));
  assert.equal(unsafeSource.ok, false);
  assert.equal(code(unsafeSource, "UNSUPPORTED_SOURCE_PROTOCOL"), true);

  const prohibited = engine.validateHoldingsCatalog(catalog([
    fund("KRX:069500", [{ instrumentId: "KRX:005930", weight: 1 }])
  ], { redistribution: "PROHIBITED" }));
  assert.equal(prohibited.ok, false);
  assert.equal(prohibited.funds[0].eligible, false);
  assert.equal(code(prohibited, "REDISTRIBUTION_NOT_ELIGIBLE"), true);

  const badGeneratedAt = engine.validateHoldingsCatalog(catalog([], { generatedAt: "not-a-date" }));
  assert.equal(badGeneratedAt.ok, false);
  assert.equal(code(badGeneratedAt, "INVALID_CATALOG_GENERATED_AT"), true);

  const missingRetrievedAt = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }])
  ], { source: { name: "조회시각 누락", url: "https://issuer.example.test/holdings" } }));
  assert.equal(missingRetrievedAt.ok, false);
  assert.equal(missingRetrievedAt.funds[0].eligible, false);
  assert.equal(code(missingRetrievedAt, "MISSING_SOURCE_RETRIEVED_AT"), true);

  const missingOverrideRetrievedAt = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }], {
      source: { name: "불완전한 개별 출처", url: "https://issuer.example.test/spy" }
    })
  ]));
  assert.equal(missingOverrideRetrievedAt.ok, false);
  assert.equal(missingOverrideRetrievedAt.funds[0].eligible, false);
  assert.equal(code(missingOverrideRetrievedAt, "MISSING_SOURCE_RETRIEVED_AT"), true);

  const inheritedRetrievedAt = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }])
  ]));
  assert.equal(inheritedRetrievedAt.ok, true);
  assert.equal(inheritedRetrievedAt.funds[0].source.retrievedAt, "2026-08-07T01:02:03.000Z");

  const futureRetrievedAt = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }])
  ], { source: { ...source(), retrievedAt: "2099-01-01T00:00:00.000Z" } }));
  assert.equal(futureRetrievedAt.ok, false);
  assert.equal(futureRetrievedAt.funds[0].eligible, false);
  assert.equal(code(futureRetrievedAt, "FUTURE_SOURCE_RETRIEVED_AT"), true);

  const futureOverrideRetrievedAt = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }], {
      source: { ...source("https://issuer.example.test/spy"), retrievedAt: "2099-01-01T00:00:00.000Z" }
    })
  ]));
  assert.equal(futureOverrideRetrievedAt.ok, false);
  assert.equal(futureOverrideRetrievedAt.funds[0].eligible, false);
  assert.equal(code(futureOverrideRetrievedAt, "FUTURE_SOURCE_RETRIEVED_AT"), true);
}

// Persisted provenance URLs are deliberately boring: HTTPS only, without
// credentials, query tokens, or fragments. Oversized URLs are rejected before
// they can inflate local storage or logs.
{
  const sourceCases = [
    ["http://issuer.example.test/holdings", "UNSUPPORTED_SOURCE_PROTOCOL"],
    ["https://user:secret@issuer.example.test/holdings", "UNSAFE_SOURCE_URL"],
    ["https://issuer.example.test/holdings?token=secret", "UNSAFE_SOURCE_URL"],
    ["https://issuer.example.test/holdings#private", "UNSAFE_SOURCE_URL"],
    [`https://issuer.example.test/${"a".repeat(2050)}`, "SOURCE_URL_TOO_LONG"]
  ];
  sourceCases.forEach(([url, expectedCode]) => {
    const result = engine.validateHoldingsCatalog(catalog([], { source: source(url) }));
    assert.equal(result.ok, false, url);
    assert.equal(code(result, expectedCode), true, `${url}: ${expectedCode}`);
  });

  const termsCases = [
    ["http://issuer.example.test/terms", "UNSUPPORTED_REDISTRIBUTION_TERMS_PROTOCOL"],
    ["https://user:secret@issuer.example.test/terms", "UNSAFE_REDISTRIBUTION_TERMS_URL"],
    ["https://issuer.example.test/terms?sig=private", "UNSAFE_REDISTRIBUTION_TERMS_URL"],
    ["https://issuer.example.test/terms#private", "UNSAFE_REDISTRIBUTION_TERMS_URL"],
    [`https://issuer.example.test/${"a".repeat(2050)}`, "REDISTRIBUTION_TERMS_URL_TOO_LONG"]
  ];
  termsCases.forEach(([termsUrl, expectedCode]) => {
    const result = engine.validateHoldingsCatalog(catalog([], {
      redistribution: { status: "ALLOWED", termsUrl }
    }));
    assert.equal(result.ok, false, termsUrl);
    assert.equal(code(result, expectedCode), true, `${termsUrl}: ${expectedCode}`);
  });
}

// Only physical, long-only funds are eligible. Synthetic, inverse, leveraged,
// short, or unspecified structures never masquerade as mapped holdings.
{
  const result = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }], {
      structure: undefined,
      replicationMethod: "SYNTHETIC",
      exposure: "LONG_ONLY"
    }),
    fund("US:QQQ", [{ instrumentId: "US:MSFT", weight: 1 }], {
      structure: undefined,
      replicationMethod: "PHYSICAL",
      exposure: "SHORT"
    })
  ]));
  assert.equal(result.ok, false);
  assert.equal(result.funds.every((item) => !item.eligible), true);
  assert.equal(result.diagnostics.filter((item) => item.code === "UNSUPPORTED_FUND_STRUCTURE").length, 2);
}

// Weight sums within tolerance are normalized. A material omission becomes an
// explicit UNREPORTED bucket, while an excess or inconsistent declared coverage
// makes the fund ineligible.
{
  const withinTolerance = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [
      { instrumentId: "US:AAPL", weight: 0.5000002 },
      { instrumentId: "US:MSFT", weight: 0.5 }
    ])
  ]));
  assert.equal(withinTolerance.ok, true);
  assert.equal(code(withinTolerance, "HOLDING_WEIGHT_SUM_NORMALIZED"), true);
  closeTo(withinTolerance.funds[0].holdings.reduce((sum, item) => sum + item.weight, 0), 1, 1e-10);

  const partial = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [
      { instrumentId: "US:AAPL", weight: 0.7 },
      { bucket: "EMBEDDED_CASH", weight: 0.1 }
    ])
  ]));
  assert.equal(partial.ok, true);
  assert.equal(partial.funds[0].coverageWeight, 0.8);
  assert.equal(partial.funds[0].holdings.find((item) => item.bucket === "UNREPORTED").weight, 0.2);

  const excess = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [
      { instrumentId: "US:AAPL", weight: 0.7 },
      { instrumentId: "US:MSFT", weight: 0.4 }
    ])
  ]));
  assert.equal(excess.ok, false);
  assert.equal(code(excess, "HOLDING_WEIGHT_SUM_EXCEEDS_ONE"), true);

  const mismatch = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 0.8 }], { coverageWeight: 0.9 })
  ]));
  assert.equal(mismatch.ok, false);
  assert.equal(code(mismatch, "COVERAGE_WEIGHT_MISMATCH"), true);
}

// A mapped direct holding and the same security reached through an ETF aggregate
// into one economic exposure. The ETF container itself is not double-counted.
{
  const holdings = catalog([
    fund("KRX:069500", [
      { instrumentId: "KRX:005930", weight: 0.6 },
      { instrumentId: "KRX:000660", weight: 0.2 },
      { bucket: "CASH", weight: 0.05 },
      { bucket: "OTHER", weight: 0.04 },
      { bucket: "UNMAPPED", weight: 0.03 },
      { bucket: "UNREPORTED", weight: 0.03 },
      { bucket: "UNSUPPORTED", weight: 0.05 }
    ])
  ]);
  const positions = [
    { instrumentId: "KRX:005930", valueKRW: 40 },
    { instrumentId: "KRX:069500", instrumentKind: "ETF", valueKRW: 100 }
  ];
  const beforePositions = JSON.parse(JSON.stringify(positions));
  const beforeCatalog = JSON.parse(JSON.stringify(holdings));
  const result = engine.analyzeLookThrough(positions, holdings);

  assert.equal(result.ok, true);
  assert.equal(result.availability, "LIMITED");
  assert.equal(result.totalValueKRW, 140);
  assert.equal(result.accountedValueKRW, 140);
  assert.equal(result.invariantDeltaKRW, 0);
  assert.equal(exposure(result, "KRX:005930").valueKRW, 100);
  assert.equal(exposure(result, "KRX:005930").directValueKRW, 40);
  assert.equal(exposure(result, "KRX:005930").lookThroughValueKRW, 60);
  assert.equal(exposure(result, "KRX:000660").valueKRW, 20);
  assert.equal(exposure(result, "KRX:069500"), undefined);
  assert.equal(bucket(result, "CASH").valueKRW, 5);
  assert.equal(bucket(result, "OTHER").valueKRW, 4);
  assert.equal(bucket(result, "UNMAPPED").valueKRW, 3);
  assert.equal(bucket(result, "UNREPORTED").valueKRW, 3);
  assert.equal(bucket(result, "UNSUPPORTED").valueKRW, 5);
  assert.deepEqual(positions, beforePositions);
  assert.deepEqual(holdings, beforeCatalog);
}

// Direct cash/other and unnamed assets are kept as residual economic exposure.
{
  const result = engine.analyzeLookThrough([
    { type: "CASH", valueKRW: 10 },
    { bucket: "OTHER", valueKRW: 5 },
    { name: "매핑 대기", valueKRW: 3 }
  ], catalog([]));
  assert.equal(result.ok, true);
  assert.equal(result.totalValueKRW, 18);
  assert.equal(result.accountedValueKRW, 18);
  assert.equal(bucket(result, "CASH").valueKRW, 10);
  assert.equal(bucket(result, "OTHER").valueKRW, 5);
  assert.equal(bucket(result, "UNMAPPED").valueKRW, 3);
}

// Nested ETFs are recursively expanded; each container disappears from the final
// exposure while source paths remain auditable.
{
  const holdings = catalog([
    fund("US:AAA", [
      { instrumentId: "US:BBB", weight: 0.5 },
      { instrumentId: "US:MSFT", weight: 0.5 }
    ]),
    fund("US:BBB", [
      { instrumentId: "US:AAPL", weight: 0.8 },
      { bucket: "CASH", weight: 0.2 }
    ])
  ]);
  const result = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], holdings);
  assert.equal(result.ok, true);
  assert.equal(result.totalValueKRW, 100);
  assert.equal(exposure(result, "US:AAPL").valueKRW, 40);
  assert.equal(exposure(result, "US:MSFT").valueKRW, 50);
  assert.equal(bucket(result, "CASH").valueKRW, 10);
  assert.equal(exposure(result, "US:AAA"), undefined);
  assert.equal(exposure(result, "US:BBB"), undefined);
  assert.deepEqual(exposure(result, "US:AAPL").contributions[0].path, ["US:AAA", "US:BBB"]);
  assert.equal(result.expansionSteps, 4);
  assert.equal(result.maxExpansionSteps, 25000);
  assert.equal(result.accountedValueKRW, result.totalValueKRW);
  assert.equal(result.invariantDeltaKRW, 0);

  const explicitUnsupported = engine.validateHoldingsCatalog(catalog([
    fund("US:ZZZ", [{ instrumentId: "US:DERIV", instrumentKind: "DERIVATIVE", supported: false, weight: 1 }])
  ]));
  assert.equal(explicitUnsupported.ok, true);
  assert.equal(explicitUnsupported.funds[0].holdings[0].bucket, "UNSUPPORTED");
  assert.equal(Object.hasOwn(explicitUnsupported.funds[0].holdings[0], "instrumentKind"), false);
}

// Holding-level instrument kinds survive canonicalization. Typed nested funds
// expand when covered, while existing untyped v1 nested holdings remain
// backward compatible through their matching catalog entry.
{
  const holdings = catalog([
    fund("US:AAA", [
      { instrumentId: "US:BBB", instrumentKind: "ETF", weight: 0.5 },
      { instrumentId: "US:MSFT", kind: "STOCK", weight: 0.5 }
    ]),
    fund("US:BBB", [{ instrumentId: "US:AAPL", weight: 1 }])
  ]);
  const validation = engine.validateHoldingsCatalog(holdings);
  assert.equal(validation.ok, true);
  assert.equal(
    validation.funds.find((item) => item.instrumentId === "US:AAA")
      .holdings.find((item) => item.instrumentId === "US:BBB").instrumentKind,
    "ETF"
  );
  assert.equal(
    validation.funds.find((item) => item.instrumentId === "US:AAA")
      .holdings.find((item) => item.instrumentId === "US:MSFT").instrumentKind,
    "STOCK"
  );

  const result = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], holdings);
  assert.equal(result.ok, true);
  assert.equal(result.availability, "VERIFIED");
  assert.equal(exposure(result, "US:AAPL").valueKRW, 50);
  assert.equal(exposure(result, "US:MSFT").valueKRW, 50);
  assert.equal(result.accountedValueKRW, 100);
  assert.equal(result.invariantDeltaKRW, 0);
}

// A typed nested ETF without its own catalog record must not masquerade as a
// fully mapped stock exposure.
{
  const missingNested = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], catalog([
    fund("US:AAA", [{ instrumentId: "US:BBB", instrumentKind: "ETF", weight: 1 }])
  ]));
  assert.equal(missingNested.ok, true);
  assert.equal(missingNested.availability, "LIMITED");
  assert.equal(exposure(missingNested, "US:BBB"), undefined);
  assert.equal(bucket(missingNested, "UNSUPPORTED").valueKRW, 100);
  assert.equal(code(missingNested, "NESTED_FUND_COVERAGE_MISSING"), true);
  assert.equal(missingNested.accountedValueKRW, 100);
  assert.equal(missingNested.invariantDeltaKRW, 0);
}

// Cycles and depth limits fail closed at just the affected portion, preserving
// the total in UNSUPPORTED and preventing recursion from running forever.
{
  const cyclic = catalog([
    fund("US:AAA", [{ instrumentId: "US:BBB", weight: 1 }]),
    fund("US:BBB", [{ instrumentId: "US:AAA", weight: 1 }])
  ]);
  const cycleResult = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], cyclic);
  assert.equal(cycleResult.ok, true);
  assert.equal(cycleResult.availability, "LIMITED");
  assert.equal(bucket(cycleResult, "UNSUPPORTED").valueKRW, 100);
  assert.equal(cycleResult.totalValueKRW, cycleResult.accountedValueKRW);
  assert.equal(code(cycleResult, "ETF_HOLDING_CYCLE"), true);

  const nested = catalog([
    fund("US:AAA", [{ instrumentId: "US:BBB", weight: 1 }]),
    fund("US:BBB", [{ instrumentId: "US:AAPL", weight: 1 }])
  ]);
  const depthResult = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 75 }
  ], nested, { maxDepth: 1 });
  assert.equal(depthResult.ok, true);
  assert.equal(bucket(depthResult, "UNSUPPORTED").valueKRW, 75);
  assert.equal(code(depthResult, "ETF_MAX_DEPTH_REACHED"), true);
}

// Catalog gaps, ineligible structures, and prohibited redistribution preserve
// the full ETF value as unsupported rather than exposing the ETF as a stock.
{
  const noCoverage = engine.analyzeLookThrough([
    { instrumentId: "US:SPY", kind: "ETF", valueKRW: 50 }
  ], catalog([]));
  assert.equal(noCoverage.ok, true);
  assert.equal(noCoverage.availability, "LIMITED");
  assert.equal(bucket(noCoverage, "UNSUPPORTED").valueKRW, 50);
  assert.equal(code(noCoverage, "ETF_COVERAGE_MISSING"), true);

  const prohibitedCatalog = catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }])
  ], { redistribution: "PROHIBITED" });
  const prohibited = engine.analyzeLookThrough([
    { instrumentId: "US:SPY", kind: "ETF", valueKRW: 50 }
  ], prohibitedCatalog);
  assert.equal(prohibited.ok, false);
  assert.equal(prohibited.availability, "UNAVAILABLE");
  assert.equal(bucket(prohibited, "UNSUPPORTED").valueKRW, 50);
  assert.equal(prohibited.accountedValueKRW, 50);
  assert.equal(exposure(prohibited, "US:AAPL"), undefined);
}

// A catalog entry cannot turn a stock or untyped direct position into a fund.
// The original security remains direct and the conflict lowers result quality.
{
  const collidingCatalog = catalog([
    fund("US:AAPL", [{ instrumentId: "US:MSFT", weight: 1 }])
  ]);
  for (const position of [
    { instrumentId: "US:AAPL", kind: "STOCK", valueKRW: 100 },
    { instrumentId: "US:AAPL", valueKRW: 100 }
  ]) {
    const collision = engine.analyzeLookThrough([position], collidingCatalog);
    assert.equal(collision.ok, true);
    assert.equal(collision.availability, "LIMITED");
    assert.equal(exposure(collision, "US:AAPL").directValueKRW, 100);
    assert.equal(exposure(collision, "US:MSFT"), undefined);
    assert.equal(code(collision, "POSITION_KIND_CATALOG_CONFLICT"), true);
    assert.equal(collision.accountedValueKRW, 100);
    assert.equal(collision.invariantDeltaKRW, 0);
  }

  const explicitFund = engine.analyzeLookThrough([
    { instrumentId: "US:AAPL", kind: "ETF", valueKRW: 100 }
  ], collidingCatalog);
  assert.equal(explicitFund.availability, "VERIFIED");
  assert.equal(exposure(explicitFund, "US:AAPL"), undefined);
  assert.equal(exposure(explicitFund, "US:MSFT").lookThroughValueKRW, 100);
}

// An explicitly typed stock constituent also remains a stock if an unrelated
// catalog row reuses its identifier.
{
  const holdingCollision = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], catalog([
    fund("US:AAA", [{ instrumentId: "US:AAPL", instrumentKind: "STOCK", weight: 1 }]),
    fund("US:AAPL", [{ instrumentId: "US:MSFT", weight: 1 }])
  ]));
  assert.equal(holdingCollision.ok, true);
  assert.equal(holdingCollision.availability, "LIMITED");
  assert.equal(exposure(holdingCollision, "US:AAPL").lookThroughValueKRW, 100);
  assert.equal(exposure(holdingCollision, "US:MSFT"), undefined);
  assert.equal(code(holdingCollision, "HOLDING_KIND_CATALOG_CONFLICT"), true);
  assert.equal(holdingCollision.invariantDeltaKRW, 0);
}

// Invalid portfolio amounts are rejected. Caller-selected tolerances and depth
// values are bounded so bad configuration cannot weaken validation silently.
{
  const negative = engine.analyzeLookThrough([
    { instrumentId: "US:AAPL", valueKRW: -1 }
  ], catalog([]));
  assert.equal(negative.ok, false);
  assert.equal(negative.availability, "UNAVAILABLE");
  assert.equal(code(negative, "INVALID_POSITION_VALUE"), true);

  const badDepth = engine.analyzeLookThrough([], catalog([]), { maxDepth: 1000 });
  assert.equal(badDepth.ok, false);
  assert.equal(code(badDepth, "INVALID_MAX_DEPTH"), true);

  const badTolerance = engine.validateHoldingsCatalog(catalog([]), { weightTolerance: 0.5 });
  assert.equal(badTolerance.ok, false);
  assert.equal(code(badTolerance, "INVALID_WEIGHT_TOLERANCE"), true);
}

// Duplicate fund IDs are unsafe because selecting either source would be
// order-dependent; both entries are made ineligible and analysis cannot expand.
{
  const duplicate = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [{ instrumentId: "US:AAPL", weight: 1 }]),
    fund("US:SPY", [{ instrumentId: "US:MSFT", weight: 1 }])
  ]));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.funds.every((item) => !item.eligible), true);
  assert.equal(code(duplicate, "DUPLICATE_FUND_INSTRUMENT_ID"), true);
}

// Duplicate normalized targets inside one fund are rejected. Otherwise a
// repeated nested target could amplify work and make source ordering material.
{
  const duplicateHolding = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", [
      { instrumentId: "US:AAPL", weight: 0.5 },
      { market: "NASDAQ", ticker: "aapl", weight: 0.5 }
    ])
  ]));
  assert.equal(duplicateHolding.ok, false);
  assert.equal(duplicateHolding.funds[0].eligible, false);
  assert.equal(code(duplicateHolding, "DUPLICATE_HOLDING_INSTRUMENT_ID"), true);
}

// All attacker-controlled collection sizes are bounded. Oversized catalogs and
// portfolios fail closed instead of being silently truncated and analyzed.
{
  const tooManyFunds = engine.validateHoldingsCatalog(catalog(
    Array.from({ length: 501 }, (_, index) => fund(
      `US:F${String(index).padStart(3, "0")}`,
      [{ instrumentId: "US:AAPL", weight: 1 }]
    ))
  ));
  assert.equal(tooManyFunds.ok, false);
  assert.equal(tooManyFunds.usable, false);
  assert.equal(tooManyFunds.funds.length, 500);
  assert.equal(code(tooManyFunds, "CATALOG_FUND_LIMIT_EXCEEDED"), true);

  const tooManyFundHoldings = engine.validateHoldingsCatalog(catalog([
    fund("US:SPY", Array.from({ length: 2001 }, (_, index) => ({
      instrumentId: `US:H${String(index).padStart(4, "0")}`,
      weight: 1 / 2001
    })))
  ]));
  assert.equal(tooManyFundHoldings.ok, false);
  assert.equal(tooManyFundHoldings.funds[0].eligible, false);
  assert.equal(code(tooManyFundHoldings, "FUND_HOLDINGS_LIMIT_EXCEEDED"), true);

  let globalHoldingIndex = 0;
  const tooManyTotalHoldings = engine.validateHoldingsCatalog(catalog(
    Array.from({ length: 13 }, (_, fundIndex) => fund(
      `US:T${String(fundIndex).padStart(2, "0")}`,
      Array.from({ length: 2000 }, () => ({
        instrumentId: `US:X${String(globalHoldingIndex++).padStart(5, "0")}`,
        weight: 1 / 2000
      }))
    ))
  ));
  assert.equal(tooManyTotalHoldings.ok, false);
  assert.equal(tooManyTotalHoldings.usable, false);
  assert.equal(tooManyTotalHoldings.funds.at(-1).eligible, false);
  assert.equal(code(tooManyTotalHoldings, "CATALOG_TOTAL_HOLDINGS_LIMIT_EXCEEDED"), true);
  assert.equal(code(tooManyTotalHoldings, "FUND_CATALOG_HOLDING_BUDGET_EXCEEDED"), true);

  const tooManyPositions = engine.analyzeLookThrough(
    Array.from({ length: 10001 }, () => ({ instrumentId: "US:AAPL", valueKRW: 1 })),
    catalog([])
  );
  assert.equal(tooManyPositions.ok, false);
  assert.equal(tooManyPositions.availability, "UNAVAILABLE");
  assert.equal(tooManyPositions.totalValueKRW, 0);
  assert.equal(code(tooManyPositions, "PORTFOLIO_POSITION_LIMIT_EXCEEDED"), true);
}

// A small layered DAG can produce exponentially many paths without cycles or
// duplicate targets. The global step budget stops expansion, explicitly marks
// the remainder unsupported, and still preserves every won of portfolio value.
{
  const dagFunds = [];
  const layerId = (index, side) => `US:L${String(index).padStart(2, "0")}${side}`;
  dagFunds.push(fund("US:ROOT", [
    { instrumentId: layerId(0, "A"), weight: 0.5 },
    { instrumentId: layerId(0, "B"), weight: 0.5 }
  ]));
  for (let index = 0; index < 20; index += 1) {
    for (const side of ["A", "B"]) {
      const holdings = index === 19
        ? [{ instrumentId: "US:AAPL", weight: 1 }]
        : [
          { instrumentId: layerId(index + 1, "A"), weight: 0.5 },
          { instrumentId: layerId(index + 1, "B"), weight: 0.5 }
        ];
      dagFunds.push(fund(layerId(index, side), holdings));
    }
  }

  const bounded = engine.analyzeLookThrough(
    [{ instrumentId: "US:ROOT", kind: "ETF", valueKRW: 100 }],
    catalog(dagFunds),
    { maxDepth: 32 }
  );
  assert.equal(bounded.ok, true);
  assert.equal(bounded.availability, "LIMITED");
  assert.equal(bounded.expansionSteps, 25000);
  assert.equal(code(bounded, "ETF_EXPANSION_STEP_LIMIT_REACHED"), true);
  assert.ok(bucket(bounded, "UNSUPPORTED").valueKRW > 0);
  assert.equal(bounded.accountedValueKRW, 100);
  assert.equal(bounded.invariantDeltaKRW, 0);
  const contributionCount = bounded.exposures.reduce((sum, item) => sum + item.contributions.length, 0)
    + bounded.bucketExposures.reduce((sum, item) => sum + item.contributions.length, 0);
  assert.ok(contributionCount <= 26000, contributionCount);
}

// Input ordering does not affect canonical economic output ordering.
{
  const holdingsA = catalog([
    fund("US:AAA", [
      { instrumentId: "US:MSFT", weight: 0.4 },
      { instrumentId: "US:AAPL", weight: 0.6 }
    ])
  ]);
  const holdingsB = catalog([
    fund("US:AAA", [
      { instrumentId: "US:AAPL", weight: 0.6 },
      { instrumentId: "US:MSFT", weight: 0.4 }
    ])
  ]);
  const first = engine.analyzeLookThrough([
    { instrumentId: "US:MSFT", valueKRW: 10 },
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 }
  ], holdingsA);
  const second = engine.analyzeLookThrough([
    { instrumentId: "US:AAA", kind: "ETF", valueKRW: 100 },
    { instrumentId: "US:MSFT", valueKRW: 10 }
  ], holdingsB);
  assert.deepEqual(
    first.exposures.map(({ instrumentId, directValueKRW, lookThroughValueKRW, valueKRW, weight }) => ({
      instrumentId, directValueKRW, lookThroughValueKRW, valueKRW, weight
    })),
    second.exposures.map(({ instrumentId, directValueKRW, lookThroughValueKRW, valueKRW, weight }) => ({
      instrumentId, directValueKRW, lookThroughValueKRW, valueKRW, weight
    }))
  );
  assert.deepEqual(first.exposures.map((item) => item.instrumentId), ["US:AAPL", "US:MSFT"]);
}

console.log("etf-exposure-engine tests passed");
