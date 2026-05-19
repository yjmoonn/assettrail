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
    fx: {
      USDKRW: {
        date: "2026-05-18",
        rate: 1300,
        source: "yfinance KRW=X"
      }
    },
    prices: {
      KRX: {
        "005930": {
          close: 74000,
          date: "2026-05-18",
          kind: "STOCK",
          name: "삼성전자",
          source: "KRX"
        },
        "0092B0": {
          close: 19645,
          date: "2026-05-19",
          kind: "ETF",
          name: "SOL 한국원자력SMR",
          source: "KRX ETF"
        }
      },
      US: {
        AAPL: {
          close: 190,
          date: "2026-05-18",
          kind: "STOCK",
          name: "Apple Inc.",
          source: "yfinance"
        }
      }
    },
    symbols: {
      US: {
        MSFT: {
          kind: "STOCK",
          name: "Microsoft Corporation Common Stock",
          source: "Nasdaq Trader"
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
assert.equal(window.document.querySelector("#assetAmountField").hidden, true);
setValue("#assetAccount", "삼성증권");
setValue("#assetTicker", "005930");
window.document.querySelector("#assetTicker").dispatchEvent(new window.Event("blur", { bubbles: true }));
assert.equal(window.document.querySelector("#assetName").value, "삼성전자");
setValue("#assetQuantity", "10");
setValue("#assetAveragePrice", "70000");
submitAsset();

setValue("#assetCategory", "KRX");
setValue("#assetAccount", "미래에셋");
setValue("#assetTicker", "005930");
assert.equal(window.document.querySelector("#assetName").value, "삼성전자");
setValue("#assetQuantity", "5");
setValue("#assetAveragePrice", "72000");
submitAsset();

setValue("#assetCategory", "KRX");
setValue("#assetAccount", "연금저축");
setValue("#assetTicker", "0092b0");
assert.equal(window.document.querySelector("#assetName").value, "SOL 한국원자력SMR");
setValue("#assetQuantity", "1");
setValue("#assetAveragePrice", "10000");
submitAsset();

setValue("#assetCategory", "US");
setValue("#assetTicker", "MSFT");
assert.equal(window.document.querySelector("#assetName").value, "Microsoft Corporation Common Stock");
setValue("#assetTicker", "AAPL");
assert.equal(window.document.querySelector("#assetName").value, "Apple Inc.");
setValue("#assetQuantity", "2");
setValue("#assetAveragePrice", "180");
submitAsset();

setValue("#assetCategory", "CASH");
assert.equal(window.document.querySelector("#assetAmountField").hidden, false);
setValue("#assetName", "현금");
setValue("#assetAmount", "1000000");
submitAsset();

const rows = [...window.document.querySelectorAll("#assetRows tr")].map((row) =>
  row.textContent.replace(/\s+/g, " ").trim()
);
const saved = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));

assert.equal(window.document.querySelector("#assetFormPanel").hidden, true);
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "전체 5개");
setValue("#assetSearch", "Apple");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 5개");
assert.match(window.document.querySelector("#assetRows").textContent, /Apple/);
setValue("#assetSearch", "");
setValue("#assetTypeFilter", "CASH");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 5개");
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
assert.equal(window.document.querySelector("#totalAsset").textContent, "₩2,623,645");
assert.match(rows.join("\n"), /삼성전자 삼성증권 005930 KRX 국내 10 ₩740,000종가 74,000 · 5월 18일 \+₩40,000/);
assert.match(rows.join("\n"), /삼성전자 미래에셋 005930 KRX 국내 5 ₩370,000종가 74,000 · 5월 18일 \+₩10,000/);
assert.match(rows.join("\n"), /SOL 한국원자력SMR 연금저축 0092B0 KRX 국내 1 ₩19,645종가 19,645 · 5월 19일 \+₩9,645/);
assert.match(rows.join("\n"), /Apple Inc\. AAPL US 미국 2 ₩494,000종가 \$190\.00 · 환율 1,300원 · 5월 18일 \+₩26,000/);
assert.match(rows.join("\n"), /현금 CASH 현금 - ₩1,000,000/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /계좌 분석/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /연금계좌/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /상품 유형 분석/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /개별종목/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /ETF/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /국내\/해외 비중/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /해외/);
assert.equal(window.document.querySelectorAll(".pie-chart").length, 4);
assert.match(window.document.querySelector(".pie-chart").style.background, /conic-gradient/);
assert.equal(window.document.querySelector("#assetTableWrap").classList.contains("asset-table-wrap"), true);
assert.deepEqual(
  saved.assets.map((asset) => ({
    amount: asset.amount,
    account: asset.account,
    currentPrice: asset.currentPrice,
    name: asset.name,
    type: asset.type
  })),
  [
    { amount: 0, account: "삼성증권", currentPrice: undefined, name: "삼성전자", type: "KRX" },
    { amount: 0, account: "미래에셋", currentPrice: undefined, name: "삼성전자", type: "KRX" },
    { amount: 0, account: "연금저축", currentPrice: undefined, name: "SOL 한국원자력SMR", type: "KRX" },
    { amount: 0, account: "", currentPrice: undefined, name: "Apple Inc.", type: "US" },
    { amount: 1000000, account: "", currentPrice: undefined, name: "현금", type: "CASH" }
  ]
);
