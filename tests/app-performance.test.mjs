import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [
  readFileSync("ledger-engine.js", "utf8"),
  readFileSync("performance-engine.js", "utf8"),
  readFileSync("app.js", "utf8")
].join("\n");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});
const { window } = dom;

window.HTMLCanvasElement.prototype.getContext = () => ({
  beginPath() {}, clearRect() {}, fillText() {}, lineTo() {}, measureText: () => ({ width: 20 }),
  moveTo() {}, rect() {}, restore() {}, roundRect() {}, save() {}, setLineDash() {}, setTransform() {},
  stroke() {}, strokeRect() {}, arc() {}, closePath() {}, createLinearGradient: () => ({ addColorStop() {} }),
  fill() {}, fillRect() {}
});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = (message) => { throw new Error(`Unexpected alert: ${message}`); };
window.confirm = () => true;
window.console.error = () => {};
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-08-06T00:00:00.000Z",
    fx: {},
    prices: { KRX: {}, US: {} },
    errors: []
  })
});

window.eval(`${appCode}
  window.__performanceTestApi = {
    setup() {
      state.assets = [{
        id: "cash-performance",
        name: "성과 현금",
        type: "CASH",
        account: "성과 계좌",
        amount: 50
      }];
      state.ledgerMeta = {
        activeLedgerId: "ledger-performance",
        baselineDate: "2025-01-01",
        migratedAt: null,
        migratedFromSchema: null
      };
      state.events = [normalizeLedgerEvent({
        eventId: "deposit-performance",
        type: "DEPOSIT",
        accountId: "ACCOUNT:cash-performance",
        cashAssetId: "cash-performance",
        cashAccountId: "ACCOUNT:cash-performance",
        tradeDate: "2025-07-01",
        settlementDate: "2025-07-01",
        sequence: 1,
        amount: 50,
        currency: "KRW",
        fxRate: 1,
        createdAt: "2025-07-01T12:00:00.000Z"
      })];
      const performanceMarks = [
        { date: "2025-01-01", navKRW: 100, external: 0, benchmark: 100 },
        { date: "2025-07-01", navKRW: 160, external: 50, benchmark: 110 },
        { date: "2026-01-01", navKRW: 176, external: 50, benchmark: 121 }
      ];
      state.performanceObservations = performanceMarks.map((mark, index) => sealPerformanceObservation({
        id: "performance-test-" + index,
        date: mark.date,
        capturedAt: mark.date + "T23:59:59.000Z",
        cutoff: "END_OF_DAY_POST_FLOW",
        source: "TEST",
        navKRW: mark.navKRW,
        marketValueKRW: mark.navKRW,
        cashKRW: 0,
        manualValueKRW: 0,
        unsettledKRW: 0,
        usMarketValueNative: 0,
        usMarketValueKRW: 0,
        usdKrw: 0,
        usdKrwDate: "",
        typeTotals: { KRX: mark.navKRW, US: 0, CASH: 0, MANUAL: 0 },
        cumulative: {
          externalFlowKRW: mark.external,
          depositsKRW: mark.external,
          withdrawalsKRW: 0,
          dividendsKRW: 0,
          interestKRW: 0,
          feesKRW: 0,
          taxesKRW: 0,
          fxDifferenceKRW: 0
        },
        benchmarkLevels: {
          KOSPI: {
            level: mark.benchmark,
            date: mark.date,
            currency: "KRW",
            returnType: "PRICE_ONLY",
            source: "test index",
            priceBasis: "PRICE_INDEX_LEVEL",
            distributionTreatment: "EXCLUDED",
            levelUnit: "INDEX_POINTS"
          }
        },
        priceBasis: "UNADJUSTED_CLOSE",
        distributionTreatment: "EXCLUDED",
        ledgerAsOfFingerprint: performanceLedgerFingerprintAsOf(mark.date),
        priceFingerprint: strongDeterministicFingerprint("performance-price-v1", { index }),
        completeness: "COMPLETE",
        issueCodes: []
      }, index));
      uiState.performanceRange = "ALL";
      uiState.performanceBenchmark = "KOSPI";
      setActiveView("JOURNAL", { updateHash: false });
      setInvestmentRecordTab("PERFORMANCE");
      persist();
    },
    removeFlowBoundaryMark() {
      state.performanceObservations = [state.performanceObservations[0], state.performanceObservations[2]];
      renderPerformance();
    },
    useLegacySnapshotOnly() {
      state.snapshots = [normalizeSnapshot({
        id: "legacy-only",
        createdAt: "2024-01-01T00:00:00.000Z",
        total: 999,
        note: "단순 자산 변화",
        typeTotals: { CASH: 999 }
      })];
      state.performanceObservations = [];
      renderPerformance();
    },
    generatedPayload() {
      const date = localDateInputValue();
      return {
        generatedAt: date + "T00:00:00.000Z",
        methodology: {
          priceBasis: "unadjusted_close",
          distributionTreatment: "excluded",
          totalReturn: false,
          quoteCurrencyByMarket: { KRX: "KRW", US: "USD" }
        },
        fx: { USDKRW: { date, rate: 1300, source: "test fx" } },
        prices: { KRX: {}, US: {} },
        benchmarks: {
          KOSPI: {
            name: "KOSPI",
            symbol: "1001",
            level: 3000,
            levelUnit: "index_points",
            quoteCurrency: "KRW",
            date,
            source: "test kospi",
            priceBasis: "price_index_level",
            distributionTreatment: "excluded",
            totalReturn: false
          },
          SP500: {
            name: "S&P 500",
            symbol: "^GSPC",
            level: 6000,
            levelUnit: "index_points",
            quoteCurrency: "USD",
            date,
            source: "test sp500",
            priceBasis: "price_index_level",
            distributionTreatment: "excluded",
            totalReturn: false
          }
        },
        errors: []
      };
    },
    normalizeGeneratedPayload(payload) {
      priceBook = normalizePriceBook(payload);
      return JSON.parse(JSON.stringify(priceBook));
    },
    currentObservationFromPayload(payload) {
      priceBook = normalizePriceBook(payload);
      return currentPerformanceObservation({ source: "TEST_GENERATED_PAYLOAD" });
    },
    setupSp500(invalidField = "") {
      state.assets = [];
      state.events = [];
      state.snapshots = [];
      state.ledgerMeta = {
        activeLedgerId: "ledger-performance-sp500",
        baselineDate: "2025-01-01",
        migratedAt: null,
        migratedFromSchema: null
      };
      const marks = [
        { date: "2025-01-01", nav: 100, sp: 100, fx: 1000 },
        { date: "2026-01-01", nav: 110, sp: 110, fx: 1200 }
      ];
      state.performanceObservations = marks.map((mark, index) => {
        const benchmark = {
          level: mark.sp,
          date: mark.date,
          currency: invalidField === "currency" ? "KRW" : "USD",
          returnType: invalidField === "returnType" ? "TOTAL_RETURN" : "PRICE_ONLY",
          source: "test sp500",
          priceBasis: invalidField === "priceBasis" ? "UNADJUSTED_CLOSE" : "PRICE_INDEX_LEVEL",
          distributionTreatment: invalidField === "distributionTreatment" ? "INCLUDED" : "EXCLUDED",
          levelUnit: invalidField === "levelUnit" ? "USD" : "INDEX_POINTS"
        };
        return sealPerformanceObservation({
          id: "performance-sp500-" + index,
          date: mark.date,
          capturedAt: mark.date + "T23:59:59.000Z",
          cutoff: "END_OF_DAY_POST_FLOW",
          source: "TEST",
          navKRW: mark.nav,
          marketValueKRW: mark.nav,
          cashKRW: 0,
          manualValueKRW: 0,
          unsettledKRW: 0,
          usMarketValueNative: 0,
          usMarketValueKRW: 0,
          usdKrw: mark.fx,
          usdKrwDate: invalidField === "fxDate" && index === 1 ? "2025-12-31" : mark.date,
          typeTotals: { KRX: mark.nav, US: 0, CASH: 0, MANUAL: 0 },
          cumulative: {
            externalFlowKRW: 0,
            depositsKRW: 0,
            withdrawalsKRW: 0,
            dividendsKRW: 0,
            interestKRW: 0,
            feesKRW: 0,
            taxesKRW: 0,
            fxDifferenceKRW: 0
          },
          benchmarkLevels: { SP500: benchmark },
          priceBasis: "UNADJUSTED_CLOSE",
          distributionTreatment: "EXCLUDED",
          ledgerAsOfFingerprint: performanceLedgerFingerprintAsOf(mark.date),
          priceFingerprint: strongDeterministicFingerprint("performance-price-v1", { sp500: index }),
          completeness: "COMPLETE",
          issueCodes: []
        }, index);
      });
      uiState.performanceRange = "ALL";
      uiState.performanceBenchmark = "SP500";
      setActiveView("JOURNAL", { updateHash: false });
      setInvestmentRecordTab("PERFORMANCE");
      persist();
    },
    validateStoredPayload(payload) {
      return validateImportPayload(payload);
    },
    duplicatePerformanceDateError(payload) {
      const candidate = JSON.parse(JSON.stringify(payload));
      const duplicate = sealPerformanceObservation({
        ...candidate.performanceObservations[0],
        id: "duplicate-performance-date"
      });
      candidate.performanceObservations.push(duplicate);
      try {
        validateImportPayload(candidate);
        return "";
      } catch (error) {
        return String(error.message || error);
      }
    },
    unsettled: (events, date) => unsettledTradeValueKRW(events, date)
  };
`);
await new Promise((resolve) => window.setTimeout(resolve, 30));

window.__performanceTestApi.setup();

assert.equal(window.document.querySelector("#performanceTabPanel").hidden, false);
assert.equal(window.document.querySelector("#performanceSummary").hidden, false);
assert.match(window.document.querySelector("#performanceTwr").textContent, /21/);
assert.match(window.document.querySelector("#performanceXirr").textContent, /20[.,]9|21/);
assert.equal(window.document.querySelector("#performanceNetFlow").textContent, "₩50");
assert.equal(window.document.querySelector("#performanceGain").textContent, "₩26");
assert.match(window.document.querySelector("#performanceBenchmarkStatus").textContent, /배당 미포함/);
assert.match(window.document.querySelector("#performanceCoverage").textContent, /평가점|검증/);
assert.match(window.document.querySelector("#performanceAttribution").textContent, /잔여 투자효과\(추정\)/);

const persisted = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.equal(persisted.schemaVersion, 6);
assert.equal(persisted.performanceObservations.length, 3);
assert.equal(persisted.snapshots.length, 0, "legacy history and performance marks must remain separate");

const generatedPayload = window.__performanceTestApi.generatedPayload();
const normalizedGenerated = window.__performanceTestApi.normalizeGeneratedPayload(generatedPayload);
assert.equal(normalizedGenerated.dataPolicy.priceBasis, "UNADJUSTED_CLOSE");
assert.equal(normalizedGenerated.dataPolicy.distributionTreatment, "EXCLUDED");
assert.deepEqual(
  JSON.parse(JSON.stringify(normalizedGenerated.benchmarks.SP500)),
  {
    level: 6000,
    date: generatedPayload.benchmarks.SP500.date,
    currency: "USD",
    returnType: "PRICE_ONLY",
    source: "test sp500",
    priceBasis: "PRICE_INDEX_LEVEL",
    distributionTreatment: "EXCLUDED",
    levelUnit: "INDEX_POINTS"
  }
);
const generatedObservation = window.__performanceTestApi.currentObservationFromPayload(generatedPayload);
assert.equal(generatedObservation.completeness, "COMPLETE");
assert.equal(generatedObservation.cumulative.externalFlowKRW, 50);
assert.equal(generatedObservation.cumulative.depositsKRW, 50);
assert.equal(generatedObservation.navKRW, 50);
assert.equal(generatedObservation.usdKrwDate, generatedPayload.fx.USDKRW.date);
assert.match(generatedObservation.markFingerprint, /^performance-mark-v1:[a-f0-9]{32}$/);

window.__performanceTestApi.setupSp500();
assert.equal(window.document.querySelector("#performanceBenchmarkReturn").textContent, "32.00%");
assert.equal(window.document.querySelector("#performanceExcessReturn").textContent, "-22.00%p");
assert.match(window.document.querySelector("#performanceBenchmarkStatus").textContent, /원화 환산 · 환헤지 아님/);
const spStored = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.doesNotThrow(() => window.__performanceTestApi.validateStoredPayload(spStored));
assert.equal(spStored.performanceObservations[1].usdKrwDate, "2026-01-01");
assert.equal(spStored.performanceObservations[1].benchmarkLevels.SP500.priceBasis, "PRICE_INDEX_LEVEL");
assert.match(window.__performanceTestApi.duplicatePerformanceDateError(spStored), /date가 중복/);

for (const invalidField of ["fxDate", "currency", "returnType", "priceBasis", "distributionTreatment", "levelUnit"]) {
  window.__performanceTestApi.setupSp500(invalidField);
  assert.equal(
    window.document.querySelector("#performanceBenchmarkReturn").textContent,
    "계산 불가",
    `${invalidField} mismatch must block benchmark calculation`
  );
  assert.match(window.document.querySelector("#performanceBenchmarkStatus").textContent, /날짜·통화·방법론·환율/);
}

window.__performanceTestApi.setup();

window.__performanceTestApi.removeFlowBoundaryMark();
assert.equal(window.document.querySelector("#performanceTwr").textContent, "계산 불가");
assert.match(window.document.querySelector("#performanceXirr").textContent, /20[.,]9|21/);
assert.match(window.document.querySelector("#performanceCoverage").textContent, /현금흐름 경계 평가점/);
assert.equal(window.document.querySelector("#performanceBenchmarkReturn").textContent, "계산 불가");
assert.equal(window.document.querySelector("#performanceMaxDrawdown").textContent, "계산 불가");
assert.equal(window.document.querySelector("#performanceVolatility").textContent, "관측 부족");

window.__performanceTestApi.useLegacySnapshotOnly();
assert.equal(window.document.querySelector("#performanceTwr").textContent, "계산 불가");
assert.match(window.document.querySelector("#performanceCoverage").textContent, /검증 평가점이 아직 없/);
assert.equal(window.document.querySelector("#performanceSummary").hidden, true);
assert.equal(window.document.querySelector("#performanceChartSection").hidden, true);
assert.equal(window.document.querySelector("#performanceDetailGrid").hidden, true);
assert.equal(window.document.querySelectorAll("#performanceCoverage .performance-prep-list li").length, 4);
assert.equal(window.document.querySelector("#performanceCoverage .primary-button").textContent, "대시보드에서 오늘 기록");

assert.equal(window.__performanceTestApi.unsettled([{
  type: "BUY",
  tradeDate: "2026-08-06",
  settlementDate: "2026-08-08",
  grossAmountKRW: 1000,
  feeKRW: 10,
  taxKRW: 5
}], "2026-08-06"), -1015);
assert.equal(window.__performanceTestApi.unsettled([{
  type: "SELL",
  tradeDate: "2026-08-06",
  settlementDate: "2026-08-08",
  grossAmountKRW: 1000,
  feeKRW: 10,
  taxKRW: 5
}], "2026-08-06"), 985);

dom.window.close();
console.log("app performance tests passed");
