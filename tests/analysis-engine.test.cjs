const assert = require("node:assert/strict");
const { analyzePortfolio, SCHEMA_VERSION } = require("../analysis-engine.js");

const ledger = {
  assets: [
    { id: "a1", type: "KRX", ticker: "005930", name: "삼성전자", account: "일반", quantity: 10 },
    { id: "a2", type: "KRX", ticker: "005930", name: "삼성전자", account: "연금", quantity: 5 },
    { id: "a3", type: "US", ticker: "AAPL", name: "Apple", account: "일반", quantity: 2 },
    { id: "a4", type: "CASH", name: "현금", amount: 1000000 }
  ],
  snapshots: [
    { createdAt: "2026-01-01T00:00:00Z", total: 3000000 },
    { createdAt: "2026-02-01T00:00:00Z", total: 2700000 },
    { createdAt: "2026-03-01T00:00:00Z", total: 3300000 }
  ]
};
const priceBook = {
  generatedAt: "2026-03-01T00:00:00Z",
  fx: { USDKRW: { rate: 1300 } },
  prices: {
    KRX: { "005930": { close: 80000, kind: "STOCK", date: "2026-03-01" } },
    US: { AAPL: { close: 200, kind: "STOCK", date: "2026-03-01" } }
  }
};

const result = analyzePortfolio(ledger, {
  id: "test-run",
  createdAt: "2026-03-02T00:00:00Z",
  priceBook
});

assert.equal(result.schemaVersion, SCHEMA_VERSION);
assert.equal(result.summary.totalValue, 2720000);
assert.equal(result.summary.ledgerRowCount, 4);
assert.equal(result.summary.economicPositionCount, 3);
assert.equal(result.concentration.positions[0].label, "삼성전자");
assert.equal(result.concentration.positions[0].count, 2);
assert.equal(result.quality.marketPriceCoverage, 1);
assert.equal(result.performance.status, "partial");
assert.equal(result.performance.maxObservedDrawdown, -0.1);
assert.equal(result.performance.twr.status, "unavailable");
assert.equal(result.performance.xirr.status, "unavailable");

const missingPrice = analyzePortfolio({ assets: [ledger.assets[2]], snapshots: [] }, { priceBook: { prices: { US: {} } } });
assert.equal(missingPrice.summary.unpricedMarketAssetCount, 1);
assert.equal(missingPrice.quality.marketPriceCoverage, 0);
assert.equal(missingPrice.warnings[0].code, "UNPRICED_MARKET_ASSETS");

console.log("analysis-engine tests passed");
