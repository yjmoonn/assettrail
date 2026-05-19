import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = readFileSync("app.js", "utf8");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});

const { window } = dom;

window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {},
  beginPath() {},
  clearRect() {},
  fill() {},
  fillRect() {},
  fillText() {},
  lineTo() {},
  moveTo() {},
  stroke() {}
});

window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-05-19T00:00:00.000Z",
    prices: {
      KRX: {
        "005930": {
          close: 74000,
          date: "2026-05-18",
          source: "KRX"
        }
      },
      US: {
        AAPL: {
          close: 190,
          date: "2026-05-18",
          source: "yfinance"
        }
      }
    }
  })
});

window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 10));

function setValue(selector, value) {
  const element = window.document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function submitAsset() {
  window.document
    .querySelector("#assetForm")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

assert.equal(window.document.querySelector("#assetFormPanel").hidden, true);
window.document.querySelector("#toggleAssetFormBtn").click();
assert.equal(window.document.querySelector("#assetFormPanel").hidden, false);
assert.equal(window.document.querySelector("#toggleAssetFormBtn").textContent, "닫기");

setValue("#assetCategory", "KRX");
setValue("#assetName", "삼성전자");
setValue("#assetTicker", "005930");
setValue("#assetQuantity", "10");
setValue("#assetAveragePrice", "70000");
submitAsset();

setValue("#assetCategory", "US");
setValue("#assetName", "Apple");
setValue("#assetTicker", "AAPL");
setValue("#assetQuantity", "2");
setValue("#assetAveragePrice", "180");
submitAsset();

setValue("#assetCategory", "CASH");
setValue("#assetName", "현금");
setValue("#assetAmount", "1000000");
submitAsset();

const rows = [...window.document.querySelectorAll("#assetRows tr")].map((row) =>
  row.textContent.replace(/\s+/g, " ").trim()
);
const saved = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));

assert.equal(window.document.querySelector("#assetFormPanel").hidden, true);
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "전체 3개");
setValue("#assetSearch", "Apple");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 3개");
assert.match(window.document.querySelector("#assetRows").textContent, /Apple/);
setValue("#assetSearch", "");
setValue("#assetTypeFilter", "CASH");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 3개");
assert.match(window.document.querySelector("#assetRows").textContent, /현금/);
setValue("#assetTypeFilter", "ALL");

assert.match(window.document.querySelector("#historySummary").textContent, /기록 상태/);
window.document.querySelector("#snapshotBtn").click();
assert.match(window.document.querySelector("#historySummary").textContent, /기록 수/);
assert.match(window.document.querySelector("#historySummary").textContent, /1회/);

window.document.querySelector('[data-retirement-preset="growth"]').click();
assert.equal(window.document.querySelector("#monthlyInvest").value, "1500000");
assert.equal(window.document.querySelector("#postReturnRate").value, "4.5");
assert.match(window.document.querySelector("#retirementProgressLabel").textContent, /%/);

assert.equal(window.document.querySelector("#priceStatus").textContent, "Prices: 5월 19일");
assert.equal(window.document.querySelector("#totalAsset").textContent, "₩1,740,380");
assert.match(rows.join("\n"), /삼성전자 005930 KRX 국내 10 ₩740,000종가 74,000 · 5월 18일 \+₩40,000/);
assert.match(rows.join("\n"), /Apple AAPL US 미국 2 ₩380종가 190 · 5월 18일 \+₩20/);
assert.match(rows.join("\n"), /현금 CASH 현금 - ₩1,000,000/);
assert.deepEqual(
  saved.assets.map((asset) => ({
    amount: asset.amount,
    currentPrice: asset.currentPrice,
    name: asset.name,
    type: asset.type
  })),
  [
    { amount: 0, currentPrice: undefined, name: "삼성전자", type: "KRX" },
    { amount: 0, currentPrice: undefined, name: "Apple", type: "US" },
    { amount: 1000000, currentPrice: undefined, name: "현금", type: "CASH" }
  ]
);
