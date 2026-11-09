import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
const STORAGE_KEY = "finance-ledger-retirement-v1";

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});
const { window } = dom;
const alerts = [];

window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {}, beginPath() {}, clearRect() {}, closePath() {},
  createLinearGradient: () => ({ addColorStop() {} }), fill() {}, fillRect() {}, fillText() {},
  lineTo() {}, measureText: (text) => ({ width: String(text).length * 7 }), moveTo() {}, rect() {},
  restore() {}, roundRect() {}, save() {}, setLineDash() {}, setTransform() {}, stroke() {}, strokeRect() {}
});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = (message) => alerts.push(String(message));
window.confirm = () => true;
window.prompt = () => "사용자 취소 테스트";
window.console.error = () => {};
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-08-05T00:00:00.000Z",
    fx: { USDKRW: { date: "2026-08-05", rate: 1300 } },
    prices: { KRX: { "005930": { close: 15000, date: "2026-08-05", name: "테스트 주식" } }, US: {} },
    symbols: { KRX: {}, US: {} },
    errors: []
  })
});

const legacyState = {
  schemaVersion: 4,
  assets: [
    {
      id: "stock-1",
      name: "테스트 주식",
      ticker: "005930",
      type: "KRX",
      account: "증권계좌",
      quantity: 10,
      averagePrice: 10000
    },
    {
      id: "cash-1",
      name: "증권 예수금",
      type: "CASH",
      account: "증권계좌",
      amount: 1000000
    }
  ],
  snapshots: [],
  meta: { lastSavedAt: "2026-08-01T00:00:00.000Z" },
  retirement: {}
};
legacyState.assets = legacyState.assets.filter(asset => asset.type !== "CASH");
const legacyRaw = JSON.stringify(legacyState);
window.localStorage.setItem(STORAGE_KEY, legacyRaw);

window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 40));

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
}

function setValue(selector, value) {
  const element = window.document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function submit(selector) {
  window.document.querySelector(selector).dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true })
  );
}


const today = window.eval("localDateInputValue()");
function trade(kind, qty, price, fees = 0, tax = 0) {
  window.document.querySelector('[data-nav-view="ASSETS"]').click();
  const row = [...window.document.querySelectorAll("#assetRows tr")].find(row => row.textContent.includes("테스트 주식"));
  row.querySelector(`[data-action="${kind}"]`).click();
  assert.equal(window.document.querySelector(`#${kind}CashAssetId`).required, false);
  setValue(`#${kind}Date`, today);
  setValue(`#${kind}SettlementDate`, today);
  setValue(`#${kind}Quantity`, String(qty));
  setValue(`#${kind}Price`, String(price));
  setValue(`#${kind}Fees`, String(fees));
  if (kind === "sell") setValue("#sellTax", String(tax));
  submit(`#${kind}Form`);
}
trade("sell", 2, 15000, 100, 50);
let data = stored();
let cash = data.assets.find(asset => asset.type === "CASH");
assert.ok(cash);
assert.equal(cash.account, "증권계좌");
assert.equal(cash.cashBalanceKnown, false);
assert.equal(cash.amount, 29850);
assert.equal(data.assets.find(asset => asset.id === "stock-1").quantity, 8);
assert.equal(data.events.filter(event => event.type === "SELL").length, 1);
assert.equal(data.events.filter(event => event.type === "DEPOSIT").length, 0);
assert.match(window.document.querySelector("#assetRows").textContent, /기존 잔액 미확인/);
trade("buy", 5, 12000, 100);
data = stored();
assert.equal(data.assets.filter(asset => asset.type === "CASH").length, 1);
cash = data.assets.find(asset => asset.type === "CASH");
assert.equal(cash.amount, -30250);
assert.equal(data.assets.find(asset => asset.id === "stock-1").quantity, 13);
assert.equal(data.events.some(event => event.type === "DEPOSIT"), false);
assert.equal(window.eval("ledgerProjection().ok"), true);
assert.ok(window.eval("ledgerProjection().warnings").some(warning => warning.code === "UNCONFIRMED_CASH_BALANCE"));
assert.doesNotThrow(() => window.eval(`validateImportPayload(${JSON.stringify(data)})`));

const buyId = data.events.find(event => event.type === "BUY").eventId;
assert.equal(window.eval(`cancelLedgerEvent(${JSON.stringify(buyId)}, "취소 검증")`), true);
assert.equal(stored().assets.find(asset => asset.id === cash.id).amount, 29850);
// Actual cash confirmation needs no fictitious deposit, including a zero difference.
window.eval(`showCashBalanceForm(${JSON.stringify(stored().assets.find(asset => asset.id === cash.id))})`);
setValue("#cashBalanceActualAmount", "29850");
submit("#cashBalanceForm");
assert.notEqual(stored().assets.find(asset => asset.id === cash.id).cashBalanceKnown, false);
assert.equal(window.eval("ledgerProjection().ok"), true);
// A confirmed but insufficient balance also permits a buy without manufacturing an inflow.
trade("buy", 100, 1000);
cash = stored().assets.find(asset => asset.id === cash.id);
assert.equal(cash.amount, -70150);
assert.equal(cash.cashBalanceKnown, false);
assert.equal(stored().events.some(event => event.type === "DEPOSIT"), false);
assert.doesNotThrow(() => window.eval(`validateImportPayload(${JSON.stringify(stored())})`));
assert.equal(alerts.length, 0, alerts.join(" | "));
dom.window.close();
console.log("automatic trade cash tests passed");

async function reopen(raw) {
  const next = new JSDOM(html, { pretendToBeVisual: true, runScripts: "outside-only", url: "http://localhost/" });
  const w = next.window;
  w.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.alert = message => { throw new Error(String(message)); };
  w.confirm = () => true;
  w.firebaseConfig = {};
  w.fetch = window.fetch;
  w.localStorage.setItem(STORAGE_KEY, raw);
  w.eval(appCode);
  await new Promise(resolve => w.setTimeout(resolve, 40));
  return next;
}
const restored = await reopen(JSON.stringify(data));
assert.equal(JSON.parse(restored.window.localStorage.getItem(STORAGE_KEY)).assets.find(asset => asset.id === cash.id).cashBalanceKnown, false);
assert.equal(restored.window.eval("ledgerProjection().ok"), true);
restored.window.close();
const buyOnly = await reopen(legacyRaw);
const w = buyOnly.window;
w.document.querySelector('[data-nav-view="ASSETS"]').click();
w.document.querySelector('[data-action="buy"]').click();
for (const [id, value] of Object.entries({ buyQuantity: "5", buyPrice: "10000", buyFees: "0" })) {
  const el = w.document.getElementById(id); el.value = value; el.dispatchEvent(new w.Event("input", { bubbles: true }));
}
w.document.querySelector("#buyForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const firstBuy = JSON.parse(w.localStorage.getItem(STORAGE_KEY));
assert.equal(firstBuy.assets.filter(asset => asset.type === "CASH").length, 1);
assert.equal(firstBuy.assets.find(asset => asset.type === "CASH").amount, -50000);
assert.equal(firstBuy.assets.find(asset => asset.id === "stock-1").quantity, 15);
assert.equal(firstBuy.events.some(event => event.type === "DEPOSIT"), false);
assert.equal(w.eval("ledgerProjection().ok"), true);
assert.doesNotThrow(() => w.eval(`validateImportPayload(${JSON.stringify(firstBuy)})`));
const sellEventId = firstBuy.events.find(event => event.type === "BUY").eventId;
assert.equal(w.eval(`cancelLedgerEvent(${JSON.stringify(sellEventId)}, "예수금 없는 매수 취소")`), true);
assert.equal(JSON.parse(w.localStorage.getItem(STORAGE_KEY)).assets.find(asset => asset.type === "CASH").amount, 0);
buyOnly.window.close();
console.log("trade cash reload and first-buy tests passed");
