import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const code = ["ledger-engine.js", "performance-engine.js", "app.js"].map((file) => readFileSync(file, "utf8")).join("\n");
const dom = new JSDOM(html, { pretendToBeVisual: true, runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;
const RealDate = window.Date;
window.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : ["2026-07-30T01:00:00Z"])); }
  static now() { return new RealDate("2026-07-30T01:00:00Z").getTime(); }
};
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_, name) => name === "measureText" ? (text) => ({ width: text.length * 7 }) : name === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {} });
window.HTMLElement.prototype.scrollIntoView = () => {};
window.firebaseConfig = {};
window.confirm = () => true;
const alerts = [];
window.alert = (text) => alerts.push(text);

function manifest({ actual = "2026-07-29", rate = 1300, delayed = true } = {}) {
  return {
    generatedAt: "2026-07-30T00:00:00Z",
    methodology: { priceBasis: "unadjusted_close", distributionTreatment: "excluded", valuationTiming: "LATEST_COMPLETED_SESSION" },
    finalCloseCertificate: {
      status: delayed ? "PARTIAL_FINAL_CLOSE" : "FINAL_CLOSE",
      checkedAt: "2026-07-30T00:00:00Z", validUntil: "2026-07-31T00:00:00Z",
      expectedFxSession: delayed ? "2026-07-30" : null,
      validUntilByMarket: { KRX: "2026-07-31T00:00:00Z", US: "2026-07-31T00:00:00Z", FX: delayed ? null : "2026-07-31T00:00:00Z" },
      marketSessions: { KRX: "2026-07-30", US: "2026-07-30", FX: delayed ? null : "2026-07-30" }
    },
    fx: { USDKRW: { date: actual, rate, source: "yfinance KRW=X", sessionStatus: delayed ? "DELAYED_CLOSE" : "FINAL_CLOSE", freshnessStatus: delayed ? "DELAYED" : "CURRENT", expectedSession: "2026-07-30", retrievedAt: "2026-07-30T00:00:01Z" } },
    prices: { KRX: { "005930": { close: 10, date: "2026-07-30", sessionStatus: "FINAL_CLOSE" } }, US: { AAPL: { close: 100, date: "2026-07-30", sessionStatus: "FINAL_CLOSE" } } },
    errors: []
  };
}
let response = manifest();
window.fetch = async () => ({ ok: true, json: async () => response });
window.localStorage.setItem("finance-ledger-retirement-v1", JSON.stringify({
  assets: [
    { id: "synthetic-us", name: "미국 테스트", type: "US", ticker: "AAPL", quantity: 2, averagePrice: 80 },
    { id: "synthetic-krx", name: "국내 테스트", type: "KRX", ticker: "005930", quantity: 3, averagePrice: 8 }
  ],
  snapshots: [{ id: "prior-synthetic", createdAt: "2026-07-28T01:00:00Z", total: 250000, note: "기존 기록" }], retirement: {}
}));
window.eval(`${code}\nwindow.fxTest = {
  load: () => initPrices(), book: () => priceBook, total: () => totalAssets(),
  readiness: () => snapshotReadiness(), observation: () => currentPerformanceObservation(),
  observe: () => refreshPerformanceObservation(), snapshots: () => JSON.stringify(state.snapshots),
  events: () => JSON.stringify(state.events), performance: () => JSON.stringify(state.performanceObservations),
  krxReadiness: () => finalCloseCertificateIssue(heldMarketAssets().filter(asset => assetType(asset) === 'KRX')),
  details: () => assetValueDetail(state.assets[0]), normalize: (fx) => normalizeFx(fx),
  refresh: () => requestPriceRefreshFromApp(), renderHistory: () => renderHistory()
};`);
for (let i = 0; i < 100 && !window.fxTest.book().loaded; i++) await new Promise((resolve) => setTimeout(resolve, 10));
const api = window.fxTest;
let snapshots = api.snapshots();
const events = api.events();
const performance = api.performance();
assert.equal(api.total(), 260030);
assert.equal(api.book().fx.USDKRW.date, "2026-07-29");
assert.equal(api.book().fx.USDKRW.expectedSession, "2026-07-30");
assert.equal(api.book().fx.USDKRW.retrievedAt, "2026-07-30T00:00:01Z");
assert.equal(api.book().finalCloseCertificate.marketSessions.FX, null);
assert.equal(api.readiness().ok, true);
assert.match(api.readiness().warnings[0], /잠정 평가/);
assert.equal(api.krxReadiness(), "");
assert.equal(api.observation().completeness, "INCOMPLETE");
assert.equal(api.observe(), null);
assert.equal(api.performance(), performance);
assert.match(window.document.querySelector("#fxValuationNotice").textContent, /2026-07-29.*잠정 평가/);
assert.match(api.details(), /환율 기준 2026-07-29.*잠정 평가/);
assert.equal((await api.refresh()).provisional, true);
window.document.querySelector("#snapshotBtn").click();
window.document.querySelector("#snapshotBtn").click();
for (let i = 0; i < 100 && window.document.querySelector("#snapshotBtn").disabled; i++) await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepEqual(alerts, []);
const records = JSON.parse(api.snapshots());
assert.equal(records.length, 2, "double click saves once");
const saved = records.find(row => row.id !== "prior-synthetic");
assert.equal(saved.total, 260030);
assert.equal(saved.valuation.fx.USDKRW.date, "2026-07-29");
assert.equal(saved.valuation.fx.USDKRW.source, "yfinance KRW=X");
assert.equal(saved.valuation.fx.USDKRW.retrievedAt, "2026-07-30T00:00:01.000Z");
assert.equal(saved.valuation.fx.USDKRW.provisional, true);
assert.equal(saved.valuation.fx.USDKRW.freshnessStatus, "DELAYED");
assert.equal(saved.valuation.positions[0].fxSessionStatus, "DELAYED_CLOSE");
assert.deepEqual(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).snapshots, records);
api.renderHistory();
assert.match(window.document.querySelector("#historyRows").textContent, /환율 지연.*잠정 평가.*2026-07-29/);
snapshots = api.snapshots();
assert.equal(api.events(), events);

// Long delays strengthen the warning without blocking ordinary valuations.
response = manifest({ actual: "2026-06-01" });
assert.equal(await api.load(), true);
assert.equal(api.total(), 260030);
assert.match(window.document.querySelector("#fxValuationNotice").textContent, /환율 장기 지연.*2026-06-01/);
assert.equal(api.readiness().ok, true);
assert.equal(api.snapshots(), snapshots);
assert.equal(api.events(), events);

// A partial certificate cannot be promoted by changing only the FX row status/date.
response = manifest({ actual: "2026-07-30", delayed: false });
response.finalCloseCertificate.status = "PARTIAL_FINAL_CLOSE";
assert.equal(await api.load(), true);
assert.equal(api.readiness().ok, false);
assert.equal(api.observe(), null);
assert.equal(api.snapshots(), snapshots);

// New daily close flows through the normal load, recalculates, and clears provisional UI.
response = manifest({ actual: "2026-07-30", rate: 1400, delayed: false });
assert.equal(await api.load(), true);
assert.equal(api.total(), 280030);
assert.equal(api.readiness().ok, true);
assert.equal(window.document.querySelector("#fxValuationNotice").hidden, true);
assert.doesNotMatch(api.details(), /잠정/);
assert.equal(api.snapshots(), snapshots);
assert.equal(api.events(), events);

for (const entry of [
  { ...manifest().fx.USDKRW, rate: NaN },
  { ...manifest().fx.USDKRW, rate: -1 },
  { ...manifest().fx.USDKRW, rate: 0 },
  { ...manifest().fx.USDKRW, source: "other-provider" },
  { ...manifest().fx.USDKRW, retrievedAt: "2026-07-31T00:00:00Z" },
  { date: "2026-07-31", rate: 1300, sessionStatus: "FINAL_CLOSE" },
  { date: "2026-07-30", rate: 1300, sessionStatus: "INTRADAY" },
  { date: "2026-07-29", rate: 5000, sessionStatus: "DELAYED_CLOSE" },
  { date: "2026-07-29", rate: Infinity, sessionStatus: "DELAYED_CLOSE" },
  { date: "invalid", rate: 1300, sessionStatus: "DELAYED_CLOSE" }
]) {
  assert.equal(api.normalize({ USDKRW: entry }).USDKRW, null);
  response = manifest();
  response.fx.USDKRW = entry;
  await api.load();
  assert.equal(api.readiness().ok, false);
  assert.equal(api.snapshots(), snapshots);
}
assert.equal(api.normalize({}).USDKRW, null);
dom.window.close();
console.log("Delayed FX valuation, snapshot saving, provenance, warnings and recovery passed.");
