import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = readFileSync("app.js", "utf8");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/index.html"
});

const { window } = dom;

window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {},
  beginPath() {},
  clearRect() {},
  closePath() {},
  createLinearGradient: () => ({ addColorStop() {} }),
  fill() {},
  fillRect() {},
  fillText() {},
  lineTo() {},
  measureText: (text) => ({ width: String(text).length * 7 }),
  moveTo() {},
  setLineDash() {},
  stroke() {},
  strokeRect() {}
});

window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.firebaseConfig = {};

window.localStorage.setItem(
  "finance-ledger-retirement-v1",
  JSON.stringify({
    assets: [
      {
        id: "us-aapl",
        name: "Apple Inc.",
        ticker: "AAPL",
        type: "US",
        account: "해외계좌",
        amount: 0,
        quantity: 1,
        averagePrice: 180
      }
    ],
    snapshots: [],
    retirement: {}
  })
);

const fetchCalls = [];
window.fetch = async (url) => {
  fetchCalls.push(String(url));
  if (String(url).startsWith("prices.json")) {
    throw new TypeError("local file price fetch blocked");
  }
  if (String(url).startsWith("https://yjmoonn.github.io/assettrail/prices.json")) {
    return {
      ok: true,
      json: async () => ({
        generatedAt: "2026-05-19T00:00:00.000Z",
        fx: {
          USDKRW: {
            date: "2026-05-18",
            rate: 1300.25,
            source: "yfinance KRW=X"
          }
        },
        prices: {
          KRX: {},
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
        symbols: { KRX: {}, US: {} },
        errors: []
      })
    };
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 20));

assert.match(fetchCalls[0], /^prices\.json\?v=/);
assert.match(fetchCalls[1], /^https:\/\/yjmoonn\.github\.io\/assettrail\/prices\.json\?v=/);
assert.equal(window.document.querySelector("#priceStatus").textContent, "가격 5/19 09:00");
assert.equal(window.document.querySelector("#totalAsset").textContent, "₩247,048");
assert.match(window.document.querySelector("#assetRows").textContent, /종가 \$190\.00 · 환율 1,300\.25원/);

window.document.querySelector("#syncAssetsBtn").click();
assert.equal(window.document.querySelector("#currentInvestable").value, "247,048");
