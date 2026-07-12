import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const engineCode = readFileSync("analysis-engine.js", "utf8");
const appCode = readFileSync("app.js", "utf8");
const dom = new JSDOM(html, { pretendToBeVisual: true, runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;

window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {}, beginPath() {}, clearRect() {}, closePath() {}, createLinearGradient: () => ({ addColorStop() {} }),
  fill() {}, fillRect() {}, fillText() {}, lineTo() {}, measureText: (text) => ({ width: String(text).length * 7 }),
  moveTo() {}, rect() {}, restore() {}, roundRect() {}, save() {}, setLineDash() {}, setTransform() {}, stroke() {}, strokeRect() {}
});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = (message) => { throw new Error(`Unexpected alert: ${message}`); };
window.confirm = () => true;
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-07-12T00:00:00Z",
    fx: { USDKRW: { rate: 1300 } },
    prices: { KRX: { "005930": { close: 80000, kind: "STOCK", date: "2026-07-11" } }, US: {} },
    symbols: { KRX: {}, US: {} }
  })
});
window.localStorage.setItem("finance-ledger-retirement-v1", JSON.stringify({
  assets: [
    { id: "a1", type: "KRX", ticker: "005930", name: "삼성전자", account: "일반", quantity: 10, averagePrice: 70000 },
    { id: "a2", type: "CASH", name: "현금", amount: 200000 }
  ],
  snapshots: [
    { id: "s1", createdAt: "2026-06-01T00:00:00Z", total: 900000 },
    { id: "s2", createdAt: "2026-07-01T00:00:00Z", total: 1000000 }
  ]
}));

window.eval(engineCode);
window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 20));
window.document.querySelector('[data-nav-view="ANALYSIS"]').click();
window.document.querySelector("#analysisRunBtn").click();

assert.equal(window.location.hash, "#analysis");
assert.equal(window.document.querySelector("#analysisResults").hidden, false);
assert.match(window.document.querySelector("#analysisSummary").textContent, /₩1,000,000/);
assert.match(window.document.querySelector("#analysisQualityChecks").textContent, /CASH FLOW LEDGER/);
assert.match(window.document.querySelector("#analysisPerformance").textContent, /TWR/);
assert.equal(JSON.parse(window.localStorage.getItem("assettrail-analysis-runs-v1")).length, 1);

console.log("app analysis tests passed");
