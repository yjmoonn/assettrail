import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
const STORAGE_KEY = "finance-ledger-retirement-v1";
const GENERATED_AT = "2026-08-03T00:00:00.000Z";
const EXPECTED_SYMBOL_URL = `https://yjmoonn.github.io/assettrail/symbols.json?v=${encodeURIComponent(GENERATED_AT)}`;

function canvasContext() {
  return {
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
    rect() {},
    restore() {},
    roundRect() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {},
    strokeRect() {}
  };
}

function pricesManifest() {
  return {
    generatedAt: GENERATED_AT,
    symbolFile: "symbols.json",
    symbolsGeneratedAt: GENERATED_AT,
    fx: {
      USDKRW: {
        date: "2026-08-03",
        rate: 1300,
        source: "test"
      }
    },
    prices: {
      KRX: {
        "005930": {
          close: 74000,
          date: "2026-08-03",
          kind: "STOCK",
          source: "KRX"
        }
      },
      US: {}
    },
    errors: []
  };
}

function storedState() {
  return {
    schemaVersion: 2,
    assets: [{
      id: "samsung",
      name: "삼성전자",
      ticker: "005930",
      type: "KRX",
      account: "증권계좌",
      quantity: 1,
      averagePrice: 70000
    }],
    snapshots: [],
    retirement: {}
  };
}

async function waitUntil(window, predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function createSymbolsScenario({ symbolsFail = false } = {}) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://yjmoonn.github.io/assettrail/"
  });
  const { window } = dom;
  const fetchCalls = [];

  window.HTMLCanvasElement.prototype.getContext = canvasContext;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.alert = (message) => {
    throw new Error(`Unexpected alert: ${message}`);
  };
  window.confirm = () => true;
  window.console.error = () => {};
  window.console.warn = () => {};
  window.firebaseConfig = {};
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState()));
  window.fetch = async (url, options) => {
    const href = String(url);
    fetchCalls.push({ href, options });
    if (href.startsWith("prices.json?v=")) {
      return {
        ok: true,
        json: async () => pricesManifest()
      };
    }
    if (href === EXPECTED_SYMBOL_URL) {
      if (symbolsFail) throw new TypeError("symbols unavailable");
      return {
        ok: true,
        json: async () => ({
          generatedAt: GENERATED_AT,
          symbols: {
            KRX: {
              "0092B0": {
                kind: "ETF",
                name: "SOL 한국원자력SMR",
                source: "KRX"
              }
            },
            US: {}
          }
        })
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  window.eval(appCode);
  return { dom, fetchCalls, window };
}

{
  const scenario = createSymbolsScenario();
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#totalAsset").textContent === "₩74,000"
      && !["가격 확인중", "가격 불가"].includes(window.document.querySelector("#priceStatus").textContent),
    "가격 매니페스트 부팅이 완료되지 않았습니다."
  );

  assert.equal(scenario.fetchCalls.filter(({ href }) => href.includes("symbols.json")).length, 0);
  assert.equal(window.document.querySelector("#totalAsset").textContent, "₩74,000");

  window.document.querySelector("#toggleAssetFormBtn").click();
  await waitUntil(
    window,
    () => scenario.fetchCalls.some(({ href }) => href.includes("symbols.json")),
    "자산 추가 폼을 열어도 심볼 디렉터리를 요청하지 않았습니다."
  );

  const ticker = window.document.querySelector("#assetTicker");
  ticker.value = "0092b0";
  ticker.dispatchEvent(new window.Event("input", { bubbles: true }));
  await waitUntil(
    window,
    () => window.document.querySelector("#assetName").value === "SOL 한국원자력SMR",
    "지연 로딩한 심볼로 자산명이 자동완성되지 않았습니다."
  );
  ticker.dispatchEvent(new window.Event("blur", { bubbles: true }));
  ticker.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 10));

  const symbolCalls = scenario.fetchCalls.filter(({ href }) => href.includes("symbols.json"));
  assert.equal(symbolCalls.length, 1);
  assert.equal(symbolCalls[0].href, EXPECTED_SYMBOL_URL);
  assert.equal(symbolCalls[0].options, undefined);
  scenario.dom.window.close();
}

{
  const scenario = createSymbolsScenario({ symbolsFail: true });
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#totalAsset").textContent === "₩74,000"
      && !["가격 확인중", "가격 불가"].includes(window.document.querySelector("#priceStatus").textContent),
    "가격 매니페스트 부팅이 완료되지 않았습니다."
  );
  const priceStatusBefore = window.document.querySelector("#priceStatus").textContent;
  const totalBefore = window.document.querySelector("#totalAsset").textContent;

  assert.equal(scenario.fetchCalls.filter(({ href }) => href.includes("symbols.json")).length, 0);
  window.document.querySelector("#toggleAssetFormBtn").click();
  await waitUntil(
    window,
    () => window.document.querySelector("#assetTickerHelp").textContent.includes("직접 입력"),
    "심볼 실패 안내가 완료되지 않았습니다."
  );

  assert.equal(scenario.fetchCalls.filter(({ href }) => href.includes("symbols.json")).length, 1);
  assert.equal(window.document.querySelector("#priceStatus").textContent, priceStatusBefore);
  assert.equal(window.document.querySelector("#totalAsset").textContent, totalBefore);
  assert.equal(totalBefore, "₩74,000");
  assert.notEqual(priceStatusBefore, "가격 불가");
  scenario.dom.window.close();
}
