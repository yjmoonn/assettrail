import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});

const { window } = dom;
const FIXED_NOW = "2026-05-19T01:00:00.000Z";
const RealDate = window.Date;
window.Date = class FixedDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [FIXED_NOW]));
  }

  static now() {
    return new RealDate(FIXED_NOW).getTime();
  }
};

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
  rect() {},
  restore() {},
  roundRect() {},
  save() {},
  setLineDash() {},
  setTransform() {},
  stroke() {},
  strokeRect() {}
});

window.HTMLElement.prototype.scrollIntoView = () => {};

window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-05-19T00:00:00.000Z",
    methodology: {
      priceBasis: "unadjusted_close",
      distributionTreatment: "excluded",
      valuationTiming: "LATEST_COMPLETED_SESSION"
    },
    finalCloseCertificate: {
      status: "FINAL_CLOSE",
      checkedAt: "2026-05-19T00:00:00.000Z",
      validUntil: "2026-05-20T00:00:00.000Z",
      marketSessions: { KRX: "2026-05-19", US: "2026-05-18", FX: "2026-05-18" }
    },
    fx: {
      USDKRW: {
        date: "2026-05-18",
        rate: 1300,
        sessionStatus: "FINAL_CLOSE",
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
          sessionStatus: "FINAL_CLOSE",
          source: "KRX"
        },
        "0092B0": {
          close: 19645,
          date: "2026-05-19",
          kind: "ETF",
          name: "SOL 한국원자력SMR",
          sessionStatus: "FINAL_CLOSE",
          source: "KRX ETF"
        }
      },
      US: {
        AAPL: {
          close: 190,
          date: "2026-05-18",
          kind: "STOCK",
          name: "Apple Inc.",
          sessionStatus: "FINAL_CLOSE",
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
await new Promise((resolve) => window.setTimeout(resolve, 30));
const today = window.eval("localDateInputValue()");

assert.equal(window.document.querySelector("#dashboardSnapshotBtn").hidden, true);
assert.equal(window.document.querySelector("#dashboardAssetBtn").textContent, "첫 자산 등록");
assert.equal(window.document.querySelector("#dashboardAssetBtn").classList.contains("primary-button"), true);
assert.match(window.document.querySelector("#dashboardChecklist").textContent, /첫 자산을 등록/);
assert.equal(window.document.querySelector("#historyChart").hidden, true);
assert.equal(window.document.querySelector("#historyChartEmpty").hidden, false);
assert.match(window.document.querySelector("#ledgerReconciliation").textContent, /검사할 거래 없음/);
assert.equal(window.document.querySelectorAll(".backup-scope-list li").length, 4);
assert.equal(window.document.querySelector("#loginBtn").closest(".settings-card") !== null, true);
assert.equal(window.document.querySelector("#syncStatus").textContent, "이 기기에 저장됨");

const appNavItems = [...window.document.querySelectorAll(".app-nav .app-nav-item")];
assert.equal(appNavItems[0].tabIndex, 0);
assert.equal(appNavItems.slice(1).every((button) => button.tabIndex === -1), true);
appNavItems[0].focus();
appNavItems[0].dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "ArrowRight",
  bubbles: true,
  cancelable: true
}));
assert.equal(window.location.hash, "#assets");
assert.equal(window.document.activeElement, appNavItems[1]);
assert.equal(appNavItems[1].getAttribute("aria-current"), "page");
appNavItems[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, appNavItems.at(-1));
assert.equal(window.location.hash, "#goals");
window.document.querySelector("#settingsBtn").click();
assert.equal(window.location.hash, "#settings");
appNavItems.at(-1).focus();
appNavItems.at(-1).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, appNavItems[0]);
assert.equal(window.location.hash, "#dashboard");

assert.equal(window.document.querySelectorAll("table > caption.sr-only").length, 5);
assert.equal(
  [...window.document.querySelectorAll("table thead th")].every((header) => header.getAttribute("scope") === "col"),
  true
);
assert.equal(window.document.querySelector("#historyChart").getAttribute("aria-describedby"), "historyChartDescription");

window.document.querySelector('[data-nav-view="ASSETS"]').click();

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

function expectAlert(action, pattern) {
  let message = "";
  const originalAlert = window.alert;
  window.alert = (value) => {
    message = String(value);
  };
  try {
    action();
  } finally {
    window.alert = originalAlert;
  }
  assert.match(message, pattern);
}

async function waitUntil(testWindow, predicate, message) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => testWindow.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

assert.equal(window.document.querySelector("#assetFormPanel").hidden, true);
window.document.querySelector("#toggleAssetFormBtn").click();
assert.equal(window.document.querySelector("#assetFormPanel").hidden, false);
assert.equal(window.document.querySelector("#toggleAssetFormBtn").textContent, "접기");

setValue("#assetCategory", "KRX");
assert.equal(window.document.querySelector("#assetAmountField").hidden, true);
setValue("#assetAccount", "삼성증권");
setValue("#assetTicker", "005930");
window.document.querySelector("#assetTicker").dispatchEvent(new window.Event("blur", { bubbles: true }));
assert.equal(window.document.querySelector("#assetName").value, "삼성전자");
setValue("#assetQuantity", "-1");
setValue("#assetAveragePrice", "70000");
expectAlert(submitAsset, /보유수량은 0보다 커야/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).assets.length, 0);
setValue("#assetQuantity", "10");
setValue("#assetAveragePrice", "0");
expectAlert(submitAsset, /평단가는 0보다 커야/);
setValue("#assetAveragePrice", "70000");
submitAsset();

window.document.querySelector('[data-nav-view="DASHBOARD"]').click();
assert.equal(window.document.querySelector("#dashboardSnapshotBtn").hidden, false);
assert.equal(window.document.querySelector("#dashboardAssetBtn").textContent, "새 자산 등록");
assert.equal(window.document.querySelector("#dashboardAssetBtn").classList.contains("ghost-button"), true);
window.document.querySelector('[data-nav-view="ASSETS"]').click();

setValue("#assetCategory", "KRX");
setValue("#assetAccount", "키움증권 ISA");
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
setValue("#assetAmount", "0");
expectAlert(submitAsset, /평가금액은 0보다 커야/);
setValue("#assetAmount", "1000000");
submitAsset();

setValue("#assetCategory", "MANUAL");
assert.equal(window.document.querySelector("#assetAmountField").hidden, false);
setValue("#assetName", "청년 적금");
setValue("#assetAccount", "적금 계좌");
setValue("#assetAmount", "2000000");
submitAsset();

setValue("#assetCategory", "MANUAL");
setValue("#assetName", "주택청약저축");
setValue("#assetAccount", "청약 계좌");
setValue("#assetAmount", "300000");
submitAsset();

setValue("#assetCategory", "MANUAL");
setValue("#assetName", "IRP 대기자산");
setValue("#assetAccount", "IRP");
setValue("#assetAmount", "500000");
submitAsset();

setValue("#assetCategory", "MANUAL");
setValue("#assetName", "DC 대기자산");
setValue("#assetAccount", "DC");
setValue("#assetAmount", "700000");
submitAsset();

const samsungMainRowBeforeBuy = [...window.document.querySelectorAll("#assetRows tr")].find((row) =>
  row.textContent.includes("삼성전자") && row.textContent.includes("삼성증권")
);
samsungMainRowBeforeBuy.querySelector('[data-action="buy"]').click();
assert.equal(window.document.querySelector("#buyFormPanel").hidden, false);
setValue("#buyDate", today);
setValue("#buySettlementDate", today);
setValue("#buyQuantity", "5");
setValue("#buyPrice", "80000");
setValue("#buyFees", "0");
assert.match(window.document.querySelector("#buyPreview").textContent, /보유 10주 → 15주/);
assert.match(window.document.querySelector("#buyPreview").textContent, /평단 70,000 → 73,333\.333333/);
window.document
  .querySelector("#buyForm")
  .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

const savedAfterBuy = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
const samsungMainAfterBuy = savedAfterBuy.assets.find((asset) => asset.ticker === "005930" && asset.account === "삼성증권");
assert.equal(samsungMainAfterBuy.quantity, 15);
assert.ok(Math.abs(samsungMainAfterBuy.averagePrice - 73333.33333333333) < 0.000001);
assert.equal(savedAfterBuy.tradeJournalEntries.length, 1);
assert.equal(savedAfterBuy.tradeJournalEntries[0].action, "BUY");
assert.equal(savedAfterBuy.tradeJournalEntries[0].ticker, "005930");

const detailOpener = [...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("삼성전자") && row.textContent.includes("삼성증권"))
  .querySelector('[data-action="detail"]');
detailOpener.focus();
detailOpener.click();
const detailOverlay = window.document.querySelector("#assetDetailOverlay");
const detailDrawer = window.document.querySelector("#assetDetailDrawer");
const detailClose = detailDrawer.querySelector("[data-detail-close]");
const detailLastAction = detailDrawer.querySelector(".detail-actions button:last-child");
assert.equal(detailOverlay.hidden, false);
assert.equal(window.document.querySelector(".app").hasAttribute("inert"), true);
assert.equal(detailDrawer.getAttribute("aria-labelledby"), "assetDetailTitle");
assert.equal(window.document.activeElement, detailClose);
detailClose.dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "Tab",
  shiftKey: true,
  bubbles: true,
  cancelable: true
}));
assert.equal(window.document.activeElement, detailLastAction);
detailLastAction.dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "Tab",
  bubbles: true,
  cancelable: true
}));
assert.equal(window.document.activeElement, detailClose);
window.document.dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "Escape",
  bubbles: true,
  cancelable: true
}));
assert.equal(detailOverlay.hidden, true);
assert.equal(window.document.querySelector(".app").hasAttribute("inert"), false);
assert.equal(window.document.activeElement, detailOpener);

const rows = [...window.document.querySelectorAll("#assetRows tr")].map((row) =>
  row.textContent.replace(/\s+/g, " ").trim()
);
const saved = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
const autoIsaAsset = saved.assets.find((asset) => asset.ticker === "005930" && asset.account === "키움증권 ISA");
assert.equal(autoIsaAsset.accountClass, "AUTO");

assert.equal(window.document.querySelector("#assetFormPanel").hidden, true);
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "전체 9개");
setValue("#assetSearch", "Apple");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 9개");
assert.match(window.document.querySelector("#assetRows").textContent, /Apple/);
setValue("#assetSearch", "");
setValue("#assetTypeFilter", "CASH");
assert.equal(window.document.querySelector("#visibleAssetCount").textContent, "1 / 9개");
assert.match(window.document.querySelector("#assetRows").textContent, /현금/);
setValue("#assetTypeFilter", "ALL");

window.document.querySelector('[data-nav-view="JOURNAL"]').click();
assert.match(window.document.querySelector("#historySummary").textContent, /기록 상태/);
const historyCanvas = window.document.querySelector("#historyChart");
Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
Object.defineProperty(historyCanvas, "clientWidth", {
  configurable: true,
  get: () => 320
});
Object.defineProperty(historyCanvas, "clientHeight", {
  configurable: true,
  get: () => 180
});
historyCanvas.getBoundingClientRect = () => ({
  bottom: 180,
  height: historyCanvas.clientHeight,
  left: 0,
  right: 320,
  top: 0,
  width: historyCanvas.clientWidth,
  x: 0,
  y: 0
});
assert.equal(window.document.querySelectorAll("[data-goal-mobile-panel]").length, 0);
assert.equal(window.eval("drawChart([])"), true);
assert.equal(historyCanvas.width, 640);
assert.equal(historyCanvas.height, 360);
for (let index = 0; index < 6; index += 1) window.eval("drawChart([])");
assert.equal(historyCanvas.width, 640);
assert.equal(historyCanvas.height, 360);
window.document.querySelector("#snapshotBtn").click();
await new Promise((resolve) => window.setTimeout(resolve, 30));
assert.match(window.document.querySelector("#historySummary").textContent, /기록 수/);
assert.match(window.document.querySelector("#historySummary").textContent, /1회/);
assert.match(window.document.querySelector("#appNotice").textContent, /조회 기록을 저장했습니다/);
const savedAfterSnapshot = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.equal(savedAfterSnapshot.schemaVersion, 9);
assert.equal(savedAfterSnapshot.snapshots[0].assets, undefined);
assert.deepEqual(
  Object.keys(savedAfterSnapshot.snapshots[0]).sort(),
  ["createdAt", "id", "nextReviewAt", "note", "qualityIssues", "source", "total", "typeTotals", "valuation"]
);
const savedValuation = savedAfterSnapshot.snapshots[0].valuation;
assert.equal(savedValuation.schemaVersion, "assettrail.snapshot-valuation.v2");
assert.equal(savedValuation.priceBookGeneratedAt, "2026-05-19T00:00:00.000Z");
assert.equal(savedValuation.priceBasis, "UNADJUSTED_CLOSE");
assert.equal(savedValuation.distributionTreatment, "EXCLUDED");
assert.equal(savedValuation.valuationTiming, "LATEST_COMPLETED_SESSION");
assert.equal(savedValuation.positions.length, 9);
assert.equal(
  savedValuation.positions.reduce((sum, position) => sum + position.marketValueKRW, 0),
  savedAfterSnapshot.snapshots[0].total
);
assert.deepEqual(
  savedValuation.positions.find((position) => position.ticker === "005930" && position.quantity === 15),
  {
    assetId: saved.assets.find((asset) => asset.ticker === "005930" && asset.account === "삼성증권").id,
    assetType: "KRX",
    accountClass: "GENERAL",
    accountName: "삼성증권",
    valuationMode: "FINAL_CLOSE",
    marketValueKRW: 1110000,
    ticker: "005930",
    kind: "STOCK",
    quantity: 15,
    appliedPrice: 74000,
    priceCurrency: "KRW",
    priceAsOf: "2026-05-18",
    sessionStatus: "FINAL_CLOSE"
  }
);
assert.deepEqual(
  savedValuation.positions.find((position) => position.ticker === "AAPL"),
  {
    assetId: saved.assets.find((asset) => asset.ticker === "AAPL").id,
    assetType: "US",
    accountClass: "UNASSIGNED",
    accountName: "",
    valuationMode: "FINAL_CLOSE",
    marketValueKRW: 494000,
    ticker: "AAPL",
    kind: "STOCK",
    quantity: 2,
    appliedPrice: 190,
    priceCurrency: "USD",
    priceAsOf: "2026-05-18",
    sessionStatus: "FINAL_CLOSE",
    fxRate: 1300,
    fxAsOf: "2026-05-18",
    fxSessionStatus: "FINAL_CLOSE"
  }
);
assert.equal(
  savedValuation.positions.find((position) => position.ticker === "0092B0").accountClass,
  "PENSION"
);
assert.deepEqual(
  savedValuation.positions
    .filter((position) => position.ticker === "005930" && position.quantity === 5)
    .map(({ accountClass, accountName }) => ({ accountClass, accountName })),
  [{ accountClass: "ISA", accountName: "키움증권 ISA" }]
);
assert.equal(
  savedValuation.positions.find((position) => position.assetType === "MANUAL" && position.marketValueKRW === 500000).accountClass,
  "PENSION"
);

window.document.querySelector('[data-nav-view="GOALS"]').click();
const requiredNestEggBeforePreset = window.document.querySelector("#requiredNestEgg").textContent;
window.document.querySelector('[data-retirement-preset="growth"]').click();
assert.equal(window.document.querySelector("#monthlyInvest").value, "1,500,000");
assert.equal(window.document.querySelector("#postReturnRate").value, "4.5");
const savedAfterPreset = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.equal(savedAfterPreset.retirement.monthlyInvest, 1500000);
assert.equal(savedAfterPreset.retirement.postReturnRate, 4.5);
assert.notEqual(window.document.querySelector("#requiredNestEgg").textContent, requiredNestEggBeforePreset);
assert.match(window.document.querySelector("#retirementProgressLabel").textContent, /%/);

setValue("#currentInvestable", "-1");
assert.match(window.document.querySelector("#retirementValidation").textContent, /0원 이상/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).retirement.currentInvestable, 0);
setValue("#currentInvestable", "0");
setValue("#currentAge", "101");
assert.match(window.document.querySelector("#retirementValidation").textContent, /0~100세/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).retirement.currentAge, 35);
setValue("#currentAge", "35");
setValue("#postReturnRate", "31");
assert.match(window.document.querySelector("#retirementValidation").textContent, /0~30%/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).retirement.postReturnRate, 4.5);
setValue("#postReturnRate", "4.5");

window.document.querySelector('[data-nav-view="DASHBOARD"]').click();
assert.equal(window.document.querySelector("#priceStatus").textContent, "가격 5/19 09:00");
assert.equal(window.document.querySelector("#totalAsset").textContent, "₩6,093,645");
assert.match(rows.join("\n"), /삼성전자 005930 KRX 국내 삼성증권 15 ₩1,110,000종가 74,000 · 5월 18일 ▲ \+₩10,000/);
assert.match(rows.join("\n"), /삼성전자 005930 KRX 국내 키움증권 ISA 5 ₩370,000종가 74,000 · 5월 18일 ▲ \+₩10,000/);
assert.match(rows.join("\n"), /SOL 한국원자력SMR 0092B0 KRX 국내 연금저축 1 ₩19,645종가 19,645 · 5월 19일 ▲ \+₩9,645/);
assert.match(rows.join("\n"), /Apple Inc\. AAPL US 미국 2 ₩494,000종가 \$190\.00 · 환율 1,300원 · 5월 18일 ▲ \+₩26,000/);
assert.match(rows.join("\n"), /현금 CASH 현금 - ₩600,000/);
assert.match(rows.join("\n"), /청년 적금 MANUAL 수동 적금 계좌 - ₩2,000,000/);
assert.match(rows.join("\n"), /주택청약저축 MANUAL 수동 청약 계좌 - ₩300,000/);
assert.match(rows.join("\n"), /IRP 대기자산 MANUAL 수동 IRP - ₩500,000/);
assert.match(rows.join("\n"), /DC 대기자산 MANUAL 수동 DC - ₩700,000/);
assert.equal(window.document.querySelector('[data-nav-view="PORTFOLIO"]'), null);
assert.equal(window.document.querySelector('.portfolio-panel[data-app-section="LEGACY"]').hidden, true);
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
    { amount: 0, account: "키움증권 ISA", currentPrice: undefined, name: "삼성전자", type: "KRX" },
    { amount: 0, account: "연금저축", currentPrice: undefined, name: "SOL 한국원자력SMR", type: "KRX" },
    { amount: 0, account: "", currentPrice: undefined, name: "Apple Inc.", type: "US" },
    { amount: 600000, account: "", currentPrice: undefined, name: "현금", type: "CASH" },
    { amount: 2000000, account: "적금 계좌", currentPrice: undefined, name: "청년 적금", type: "MANUAL" },
    { amount: 300000, account: "청약 계좌", currentPrice: undefined, name: "주택청약저축", type: "MANUAL" },
    { amount: 500000, account: "IRP", currentPrice: undefined, name: "IRP 대기자산", type: "MANUAL" },
    { amount: 700000, account: "DC", currentPrice: undefined, name: "DC 대기자산", type: "MANUAL" }
  ]
);

window.document.querySelector('[data-nav-view="ASSETS"]').click();
const appleRow = [...window.document.querySelectorAll("#assetRows tr")].find((row) =>
  row.textContent.includes("Apple Inc.")
);
appleRow.querySelector('[data-action="sell"]').click();
assert.equal(window.document.querySelector("#sellFormPanel").hidden, false);
setValue("#sellDate", today);
setValue("#sellSettlementDate", today);
setValue("#sellQuantity", "1");
setValue("#sellPrice", "200");
setValue("#sellFxRate", "1300");
setValue("#sellFees", "1000");
setValue("#sellTax", "500");
assert.match(window.document.querySelector("#sellPreview").textContent, /실현손익\(환차손익 제외\) \+₩24,500/);
window.document
  .querySelector("#sellForm")
  .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

const savedAfterSell = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.equal(savedAfterSell.realizedTrades.length, 1);
assert.equal(savedAfterSell.realizedTrades[0].realizedGain, 24500);
assert.equal(savedAfterSell.tradeJournalEntries.length, 2);
assert.equal(
  savedAfterSell.tradeJournalEntries.some((entry) => entry.realizedTradeId === savedAfterSell.realizedTrades[0].id),
  true
);
assert.equal(savedAfterSell.assets.find((asset) => asset.ticker === "AAPL").quantity, 1);
window.document.querySelector('[data-nav-view="JOURNAL"]').click();
assert.equal(window.document.querySelector("#ledgerTabPanel").hidden, false);
assert.equal(window.document.querySelector("#journalTabPanel").hidden, true);
const journalTab = window.document.querySelector("#investmentJournalTab");
const realizedTab = window.document.querySelector("#investmentRealizedTab");
const ledgerTab = window.document.querySelector("#investmentLedgerTab");
assert.equal(ledgerTab.tabIndex, 0);
realizedTab.click();
assert.equal(window.document.querySelector("#realizedTabPanel").hidden, false);
assert.equal(realizedTab.tabIndex, 0);
assert.equal(journalTab.tabIndex, -1);
realizedTab.focus();
realizedTab.dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "ArrowLeft",
  bubbles: true,
  cancelable: true
}));
assert.equal(window.document.activeElement, journalTab);
assert.equal(window.document.querySelector("#journalTabPanel").hidden, false);
journalTab.dispatchEvent(new window.KeyboardEvent("keydown", {
  key: "ArrowRight",
  bubbles: true,
  cancelable: true
}));
assert.equal(window.document.activeElement, realizedTab);
assert.equal(window.document.querySelector("#realizedTabPanel").hidden, false);
assert.match(window.document.querySelector("#realizedTabPanel > .field-help").textContent, /환차손익은 포함하지 않습니다/);
assert.match(window.document.querySelector("#realizedSummary").textContent, /누적 실현손익\s+₩24,500/);
const todayYear = today.slice(0, 4);
const todayMonth = Number(today.slice(5, 7));
assert.match(
  window.document.querySelector("#realizedChart").getAttribute("aria-label"),
  new RegExp(`${todayYear}년 월별 실현손익 차트.*${todayMonth}월 ₩24,500`)
);
assert.match(window.document.querySelector("#realizedRows").textContent, /Apple Inc\./);
assert.match(window.document.querySelector("#realizedRows").textContent, /\+₩24,500/);
assert.match(window.document.querySelector("#realizedRows").textContent, /환차손익 제외/);
assert.match(window.document.querySelector("#realizedRows").textContent, /일지 보기/);
window.document.querySelector('[data-realized-action="view-journal"]').click();
assert.equal(window.document.querySelector("#journalTabPanel").hidden, false);
assert.equal(window.document.querySelector("#journalRealizedTradeId").value, savedAfterSell.realizedTrades[0].id);
assert.match(window.document.querySelector("#journalReview").value, /실현손익 \+₩24,500/);

window.document.querySelector('[data-nav-view="ASSETS"]').click();
setValue("#assetCategory", "US");
setValue("#assetName", "Microsoft Corporation");
setValue("#assetTicker", "MSFT");
setValue("#assetQuantity", "1");
setValue("#assetAveragePrice", "400");
submitAsset();
const snapshotsBeforeMissingPrice = JSON.parse(
  window.localStorage.getItem("finance-ledger-retirement-v1")
).snapshots.length;
let missingPriceAlert = "";
const originalAlert = window.alert;
window.alert = (message) => {
  missingPriceAlert = String(message);
};
window.document.querySelector("#snapshotBtn").click();
await waitUntil(window, () => Boolean(missingPriceAlert), "가격 누락 저장 차단 경고가 표시되지 않았습니다.");
window.alert = originalAlert;
assert.match(missingPriceAlert, /가격이 없는 보유 자산.*US:MSFT.*조회 기록을 저장하지 않았습니다/);
assert.equal(
  JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).snapshots.length,
  snapshotsBeforeMissingPrice
);

function installSnapshotGuardStubs(testWindow, now = "2026-07-30T01:00:00.000Z") {
  const ScenarioRealDate = testWindow.Date;
  testWindow.Date = class FixedDate extends ScenarioRealDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }

    static now() {
      return new ScenarioRealDate(now).getTime();
    }
  };
  testWindow.HTMLCanvasElement.prototype.getContext = () => ({
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
  });
  testWindow.HTMLElement.prototype.scrollIntoView = () => {};
  testWindow.confirm = () => true;
  testWindow.firebaseConfig = {};
}

async function runSnapshotGuardScenario({ assets, priceData, failPrices = false }) {
  const scenarioDom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://yjmoonn.github.io/assettrail/"
  });
  const scenarioWindow = scenarioDom.window;
  const alerts = [];
  installSnapshotGuardStubs(scenarioWindow);
  scenarioWindow.alert = (message) => alerts.push(String(message));
  scenarioWindow.console.error = () => {};
  scenarioWindow.localStorage.setItem(
    "finance-ledger-retirement-v1",
    JSON.stringify({ assets, snapshots: [], retirement: {} })
  );
  scenarioWindow.fetch = failPrices
    ? async () => {
        throw new TypeError("prices unavailable");
      }
    : async () => ({
        ok: true,
        json: async () => priceData
      });

  scenarioWindow.eval(appCode);
  await waitUntil(
    scenarioWindow,
    () => !["가격 확인중"].includes(scenarioWindow.document.querySelector("#priceStatus").textContent),
    "가격표 초기화가 완료되지 않았습니다."
  );
  scenarioWindow.document.querySelector("#snapshotBtn").click();
  await waitUntil(
    scenarioWindow,
    () => alerts.length > 0
      || JSON.parse(scenarioWindow.localStorage.getItem("finance-ledger-retirement-v1")).snapshots.length > 0,
    "조회 기록 저장 또는 차단이 완료되지 않았습니다."
  );

  const stored = JSON.parse(scenarioWindow.localStorage.getItem("finance-ledger-retirement-v1"));
  const notice = scenarioWindow.document.querySelector("#appNotice").textContent;
  scenarioWindow.close();
  return { alerts, notice, stored };
}

const noAssetsGuard = await runSnapshotGuardScenario({
  assets: [],
  priceData: {
    generatedAt: "2026-07-30T00:00:00.000Z",
    fx: { USDKRW: { date: "2026-07-30", rate: 1300 } },
    prices: { KRX: {}, US: {} }
  }
});
assert.match(noAssetsGuard.alerts[0], /자산을 먼저 등록/);
assert.equal(noAssetsGuard.stored.snapshots.length, 0);

const cashOnlyWithoutPrices = await runSnapshotGuardScenario({
  assets: [
    {
      id: "cash-only",
      name: "현금",
      type: "CASH",
      amount: 1000000
    }
  ],
  priceData: null,
  failPrices: true
});
assert.equal(cashOnlyWithoutPrices.alerts.length, 0);
assert.equal(cashOnlyWithoutPrices.stored.snapshots.length, 1);
const cashOnlySnapshot = cashOnlyWithoutPrices.stored.snapshots[0];
assert.equal(cashOnlySnapshot.total, 1000000);
assert.deepEqual(cashOnlySnapshot.typeTotals, { CASH: 1000000 });
assert.deepEqual(cashOnlySnapshot.valuation, {
  schemaVersion: "assettrail.snapshot-valuation.v2",
  priceBookGeneratedAt: null,
  priceBasis: "NOT_APPLICABLE",
  distributionTreatment: "NOT_APPLICABLE",
  valuationTiming: "MANUAL_AMOUNT_ONLY",
  fx: {},
  positions: [{
    assetId: "cash-only",
    assetType: "CASH",
    accountClass: "UNASSIGNED",
    accountName: "",
    valuationMode: "MANUAL_AMOUNT",
    marketValueKRW: 1000000
  }]
});
assert.equal(
  cashOnlySnapshot.valuation.positions.reduce((sum, position) => sum + position.marketValueKRW, 0),
  cashOnlySnapshot.total
);

const manualOnlyWithoutPrices = await runSnapshotGuardScenario({
  assets: [
    {
      id: "manual-only",
      name: "IRP 대체자산",
      account: "개인형퇴직연금",
      type: "MANUAL",
      amount: 2500000
    }
  ],
  priceData: null,
  failPrices: true
});
assert.equal(manualOnlyWithoutPrices.alerts.length, 0);
assert.equal(manualOnlyWithoutPrices.stored.snapshots.length, 1);
const manualOnlySnapshot = manualOnlyWithoutPrices.stored.snapshots[0];
assert.equal(manualOnlySnapshot.total, 2500000);
assert.deepEqual(manualOnlySnapshot.typeTotals, { MANUAL: 2500000 });
assert.equal(manualOnlySnapshot.valuation.valuationTiming, "MANUAL_AMOUNT_ONLY");
assert.equal(manualOnlySnapshot.valuation.priceBookGeneratedAt, null);
assert.deepEqual(manualOnlySnapshot.valuation.fx, {});
assert.deepEqual(manualOnlySnapshot.valuation.positions, [{
  assetId: "manual-only",
  assetType: "MANUAL",
  accountClass: "PENSION",
  accountName: "개인형퇴직연금",
  valuationMode: "MANUAL_AMOUNT",
  marketValueKRW: 2500000
}]);

const zeroQuantityMarketWithoutPrices = await runSnapshotGuardScenario({
  assets: [
    {
      id: "zero-market",
      name: "수량이 없는 삼성전자",
      ticker: "005930",
      type: "KRX",
      quantity: 0,
      averagePrice: 70000
    }
  ],
  priceData: null,
  failPrices: true
});
assert.equal(zeroQuantityMarketWithoutPrices.alerts.length, 0);
assert.equal(zeroQuantityMarketWithoutPrices.stored.snapshots.length, 1);
const zeroQuantityMarketSnapshot = zeroQuantityMarketWithoutPrices.stored.snapshots[0];
assert.equal(zeroQuantityMarketSnapshot.total, 0);
assert.deepEqual(zeroQuantityMarketSnapshot.typeTotals, { KRX: 0 });
assert.deepEqual(zeroQuantityMarketSnapshot.valuation, {
  schemaVersion: "assettrail.snapshot-valuation.v2",
  priceBookGeneratedAt: null,
  priceBasis: "NOT_APPLICABLE",
  distributionTreatment: "NOT_APPLICABLE",
  valuationTiming: "MANUAL_AMOUNT_ONLY",
  fx: {},
  positions: []
});

const missingFxGuard = await runSnapshotGuardScenario({
  assets: [
    {
      id: "us-aapl-no-fx",
      name: "Apple Inc.",
      ticker: "AAPL",
      type: "US",
      quantity: 1,
      averagePrice: 180
    }
  ],
  priceData: {
    generatedAt: "2026-07-30T00:00:00.000Z",
    methodology: { valuationTiming: "LATEST_COMPLETED_SESSION" },
    finalCloseCertificate: {
      status: "FINAL_CLOSE",
      checkedAt: "2026-07-30T00:00:00.000Z",
      validUntil: "2026-07-31T00:00:00.000Z",
      marketSessions: { KRX: "2026-07-30", US: "2026-07-30", FX: "2026-07-30" }
    },
    prices: {
      KRX: {},
      US: {
        AAPL: { close: 190, date: "2026-07-30", name: "Apple Inc.", sessionStatus: "FINAL_CLOSE" }
      }
    }
  }
});
assert.match(missingFxGuard.alerts[0], /USD\/KRW 환율이 없습니다/);
assert.equal(missingFxGuard.stored.snapshots.length, 0);

const staleCloseGuard = await runSnapshotGuardScenario({
  assets: [
    {
      id: "krx-stale-close",
      name: "오래된 종가",
      ticker: "005930",
      type: "KRX",
      quantity: 1,
      averagePrice: 70000
    }
  ],
  priceData: {
    generatedAt: "2026-07-30T00:00:00.000Z",
    methodology: { valuationTiming: "LATEST_COMPLETED_SESSION" },
    finalCloseCertificate: {
      status: "FINAL_CLOSE",
      checkedAt: "2026-07-30T00:00:00.000Z",
      validUntil: "2026-07-31T00:00:00.000Z",
      marketSessions: { KRX: "2026-07-30", US: "2026-07-30", FX: "2026-07-30" }
    },
    prices: {
      KRX: {
        "005930": { close: 74000, date: "2026-07-24", name: "오래된 종가", sessionStatus: "FINAL_CLOSE" }
      },
      US: {}
    }
  }
});
assert.match(staleCloseGuard.alerts[0], /평일 기준 최대 4일 전이라 오래되었습니다/);
assert.equal(staleCloseGuard.stored.snapshots.length, 0);

const undatedCloseGuard = await runSnapshotGuardScenario({
  assets: [
    {
      id: "krx-undated-close",
      name: "기준일 없는 종가",
      ticker: "005930",
      type: "KRX",
      quantity: 1,
      averagePrice: 70000
    }
  ],
  priceData: {
    generatedAt: "2026-07-30T00:00:00.000Z",
    methodology: { valuationTiming: "LATEST_COMPLETED_SESSION" },
    finalCloseCertificate: {
      status: "FINAL_CLOSE",
      checkedAt: "2026-07-30T00:00:00.000Z",
      validUntil: "2026-07-31T00:00:00.000Z",
      marketSessions: { KRX: "2026-07-30", US: "2026-07-30", FX: "2026-07-30" }
    },
    prices: {
      KRX: {
        "005930": { close: 74000, name: "기준일 없는 종가", sessionStatus: "FINAL_CLOSE" }
      },
      US: {}
    }
  }
});
assert.match(undatedCloseGuard.alerts[0], /종가 1개의 기준일을 확인할 수 없습니다/);
assert.equal(undatedCloseGuard.stored.snapshots.length, 0);

function finalCloseManifest(close = 100, certificate = {}) {
  return {
    generatedAt: "2026-07-30T00:00:00.000Z",
    methodology: {
      distributionTreatment: "excluded",
      priceBasis: "unadjusted_close",
      valuationTiming: "LATEST_COMPLETED_SESSION"
    },
    finalCloseCertificate: {
      status: "FINAL_CLOSE",
      checkedAt: "2026-07-30T00:00:00.000Z",
      validUntil: "2026-07-31T00:00:00.000Z",
      marketSessions: { KRX: "2026-07-30", US: "2026-07-30", FX: "2026-07-30" },
      ...certificate
    },
    fx: {
      USDKRW: { date: "2026-07-30", rate: 1300, sessionStatus: "FINAL_CLOSE", source: "test" }
    },
    prices: {
      KRX: {
        "005930": {
          close,
          date: "2026-07-30",
          name: "삼성전자",
          sessionStatus: "FINAL_CLOSE",
          source: "test"
        }
      },
      US: {}
    },
    errors: []
  };
}

const expiredCertificateGuard = await runSnapshotGuardScenario({
  assets: [{
    id: "expired-certificate",
    name: "삼성전자",
    ticker: "005930",
    type: "KRX",
    quantity: 1,
    averagePrice: 90
  }],
  priceData: finalCloseManifest(100, { validUntil: "2026-07-30T00:30:00.000Z" })
});
assert.match(expiredCertificateGuard.alerts[0], /KRX 시장 최신 확정 종가 인증이 만료되었습니다/);
assert.equal(expiredCertificateGuard.stored.snapshots.length, 0);

const exactCutoffGuard = await runSnapshotGuardScenario({
  assets: [{
    id: "exact-certificate-cutoff",
    name: "삼성전자",
    ticker: "005930",
    type: "KRX",
    quantity: 1,
    averagePrice: 90
  }],
  priceData: finalCloseManifest(100, { validUntil: "2026-07-30T01:00:00.000Z" })
});
assert.match(exactCutoffGuard.alerts[0], /KRX 시장 최신 확정 종가 인증이 만료되었습니다/);
assert.equal(exactCutoffGuard.stored.snapshots.length, 0);

const unheldMarketExpiryIgnored = await runSnapshotGuardScenario({
  assets: [{
    id: "krx-only-market-certificate",
    name: "삼성전자",
    ticker: "005930",
    type: "KRX",
    quantity: 1,
    averagePrice: 90
  }],
  priceData: finalCloseManifest(100, {
    validUntil: "2026-07-30T00:30:00.000Z",
    validUntilByMarket: {
      KRX: "2026-07-31T00:00:00.000Z",
      US: "2026-07-30T00:30:00.000Z",
      FX: "2026-07-30T00:30:00.000Z"
    }
  })
});
assert.equal(unheldMarketExpiryIgnored.alerts.length, 0);
assert.equal(unheldMarketExpiryIgnored.stored.snapshots.length, 1);

const usCertificateWithExpiredFx = finalCloseManifest(100, {
  validUntilByMarket: {
    KRX: "2026-07-31T00:00:00.000Z",
    US: "2026-07-31T00:00:00.000Z",
    FX: "2026-07-30T00:30:00.000Z"
  }
});
usCertificateWithExpiredFx.prices.KRX = {};
usCertificateWithExpiredFx.prices.US = {
  AAPL: {
    close: 190,
    date: "2026-07-30",
    name: "Apple Inc.",
    sessionStatus: "FINAL_CLOSE",
    source: "test"
  }
};
const requiredFxExpiryGuard = await runSnapshotGuardScenario({
  assets: [{
    id: "us-requires-fx-certificate",
    name: "Apple Inc.",
    ticker: "AAPL",
    type: "US",
    quantity: 1,
    averagePrice: 180
  }],
  priceData: usCertificateWithExpiredFx
});
assert.match(requiredFxExpiryGuard.alerts[0], /FX 시장 최신 확정 종가 인증이 만료되었습니다/);
assert.equal(requiredFxExpiryGuard.stored.snapshots.length, 0);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function createSnapshotRefreshHarness(refreshFetch) {
  const scenarioDom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://yjmoonn.github.io/assettrail/"
  });
  const scenarioWindow = scenarioDom.window;
  const alerts = [];
  const fetchCalls = [];
  installSnapshotGuardStubs(scenarioWindow);
  scenarioWindow.alert = (message) => alerts.push(String(message));
  scenarioWindow.console.error = () => {};
  scenarioWindow.localStorage.setItem("finance-ledger-retirement-v1", JSON.stringify({
    assets: [{
      id: "snapshot-refresh",
      name: "삼성전자",
      ticker: "005930",
      type: "KRX",
      quantity: 2,
      averagePrice: 90
    }],
    snapshots: [],
    retirement: {}
  }));
  scenarioWindow.fetch = async (url, options) => {
    fetchCalls.push({ options, url: String(url) });
    if (fetchCalls.length === 1) {
      return { ok: true, json: async () => finalCloseManifest(100) };
    }
    return refreshFetch({ call: fetchCalls.length, options, url: String(url) });
  };

  scenarioWindow.eval(`${appCode}
    const originalSnapshotRefreshPerformance = refreshPerformanceObservation;
    let snapshotRefreshPerformanceSources = [];
    refreshPerformanceObservation = function snapshotRefreshPerformanceProbe(options = {}) {
      snapshotRefreshPerformanceSources.push(options.source || "");
      return originalSnapshotRefreshPerformance(options);
    };
    window.__snapshotRefreshTestApi = {
      changeContext() {
        activeStorageKey = activeStorageKey + ":changed";
        cloud.authGeneration += 1;
      },
      editAssetQuantity(quantity) {
        state.assets[0] = normalizeAsset({
          ...state.assets[0],
          quantity,
          updatedAt: "2026-07-30T01:00:00.000Z"
        });
      },
      deleteAsset() {
        state.assets = [];
      },
      replaceFromImportedState() {
        const imported = storageSafeState();
        imported.assets[0].quantity = 4;
        imported.events = imported.events.map((event) => (
          event.type === "OPENING_BALANCE" && event.balanceKind === "POSITION"
            ? { ...event, quantity: 4 }
            : event
        ));
        imported.snapshots = [];
        imported.performanceObservations = [];
        replaceState(validateImportPayload(imported));
      },
      performanceSources() {
        return [...snapshotRefreshPerformanceSources];
      },
      resetPerformanceSources() {
        snapshotRefreshPerformanceSources = [];
      },
      snapshots() {
        return JSON.parse(JSON.stringify(state.snapshots));
      }
    };
  `);
  await waitUntil(
    scenarioWindow,
    () => scenarioWindow.document.querySelector("#totalAsset").textContent === "₩200"
      && scenarioWindow.document.querySelector("#priceStatus").textContent !== "가격 확인중",
    "초기 가격표를 불러오지 못했습니다."
  );
  scenarioWindow.__snapshotRefreshTestApi.resetPerformanceSources();
  return { alerts, dom: scenarioDom, fetchCalls, window: scenarioWindow };
}

// 저장은 반드시 저장 직전 가격표를 기다리고, 중복 클릭은 하나의 저장으로 합친다.
{
  const refreshResponse = deferred();
  const harness = await createSnapshotRefreshHarness(() => refreshResponse.promise);
  const { window: scenarioWindow } = harness;
  const quickButton = scenarioWindow.document.querySelector("#snapshotBtn");
  const monthlyButton = scenarioWindow.document.querySelector("#dashboardSnapshotBtn");
  quickButton.click();
  monthlyButton.click();

  assert.equal(harness.fetchCalls.length, 2);
  assert.equal(quickButton.disabled, true);
  assert.equal(monthlyButton.disabled, true);
  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots().length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(scenarioWindow.__snapshotRefreshTestApi.performanceSources())), []);

  refreshResponse.resolve({ ok: true, json: async () => finalCloseManifest(120) });
  await waitUntil(
    scenarioWindow,
    () => scenarioWindow.__snapshotRefreshTestApi.snapshots().length === 1,
    "갱신 가격 기준 조회 기록이 저장되지 않았습니다."
  );

  assert.equal(harness.fetchCalls.length, 2);
  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots()[0].total, 240);
  assert.deepEqual(
    JSON.parse(JSON.stringify(scenarioWindow.__snapshotRefreshTestApi.performanceSources())),
    ["USER_SNAPSHOT"]
  );
  assert.equal(quickButton.disabled, false);
  assert.equal(monthlyButton.disabled, false);
  assert.deepEqual(harness.alerts, []);
  harness.dom.window.close();
}

// 저장 직전 재조회 실패는 이미 화면에 있던 가격으로 우회 저장하지 않는다.
{
  const harness = await createSnapshotRefreshHarness(async () => {
    throw new TypeError("refresh unavailable");
  });
  const { window: scenarioWindow } = harness;
  scenarioWindow.document.querySelector("#snapshotBtn").click();
  await waitUntil(
    scenarioWindow,
    () => harness.alerts.length > 0,
    "가격 재조회 실패 경고가 표시되지 않았습니다."
  );

  assert.equal(harness.fetchCalls.length, 2);
  assert.match(harness.alerts[0], /최신 확정 종가 가격표를 다시 불러오지 못해/);
  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots().length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(scenarioWindow.__snapshotRefreshTestApi.performanceSources())), []);
  assert.equal(scenarioWindow.document.querySelector("#snapshotBtn").disabled, false);
  assert.equal(scenarioWindow.document.querySelector("#dashboardSnapshotBtn").disabled, false);
  harness.dom.window.close();
}

// 가격을 기다리는 동안 사용자 저장 영역이 바뀌면 새 영역에 이전 요청을 저장하지 않는다.
{
  const refreshResponse = deferred();
  const harness = await createSnapshotRefreshHarness(() => refreshResponse.promise);
  const { window: scenarioWindow } = harness;
  scenarioWindow.document.querySelector("#snapshotBtn").click();
  scenarioWindow.__snapshotRefreshTestApi.changeContext();
  refreshResponse.resolve({ ok: true, json: async () => finalCloseManifest(120) });
  await waitUntil(
    scenarioWindow,
    () => harness.alerts.length > 0,
    "사용자 데이터 영역 변경 차단 경고가 표시되지 않았습니다."
  );

  assert.match(harness.alerts[0], /사용자 데이터 영역이 변경되어 조회 기록을 저장하지 않았습니다/);
  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots().length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(scenarioWindow.__snapshotRefreshTestApi.performanceSources())), []);
  assert.equal(scenarioWindow.document.querySelector("#snapshotBtn").disabled, false);
  assert.equal(scenarioWindow.document.querySelector("#dashboardSnapshotBtn").disabled, false);
  harness.dom.window.close();
}

// 같은 사용자 영역이어도 가격 조회 중 경제 데이터가 바뀌면 클릭 당시 스냅샷을 만들지 않는다.
for (const [label, mutate] of [
  ["자산 편집", (api) => api.editAssetQuantity(3)],
  ["자산 삭제", (api) => api.deleteAsset()],
  ["JSON 가져오기", (api) => api.replaceFromImportedState()]
]) {
  const refreshResponse = deferred();
  const harness = await createSnapshotRefreshHarness(() => refreshResponse.promise);
  const { window: scenarioWindow } = harness;
  scenarioWindow.document.querySelector("#snapshotBtn").click();
  mutate(scenarioWindow.__snapshotRefreshTestApi);
  refreshResponse.resolve({ ok: true, json: async () => finalCloseManifest(120) });
  await waitUntil(
    scenarioWindow,
    () => harness.alerts.length > 0,
    `${label} 중 조회 기록 저장이 차단되지 않았습니다.`
  );

  assert.match(harness.alerts[0], /자산·원장 또는 저장 기록이 변경되어 조회 기록을 저장하지 않았습니다/);
  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots().length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(scenarioWindow.__snapshotRefreshTestApi.performanceSources())), []);
  assert.equal(scenarioWindow.document.querySelector("#snapshotBtn").disabled, false);
  harness.dom.window.close();
}

// 메모 입력은 경제 상태가 아니며, 저장 클릭 때 확정한 메모를 사용한다.
{
  const refreshResponse = deferred();
  const harness = await createSnapshotRefreshHarness(() => refreshResponse.promise);
  const { window: scenarioWindow } = harness;
  const note = scenarioWindow.document.querySelector("#snapshotNote");
  note.value = "저장 클릭 당시 메모";
  scenarioWindow.document.querySelector("#snapshotBtn").click();
  note.value = "가격 조회 중 바꾼 메모";
  refreshResponse.resolve({ ok: true, json: async () => finalCloseManifest(120) });
  await waitUntil(
    scenarioWindow,
    () => scenarioWindow.__snapshotRefreshTestApi.snapshots().length === 1,
    "메모 입력 변경 때문에 조회 기록 저장이 중단되었습니다."
  );

  assert.equal(scenarioWindow.__snapshotRefreshTestApi.snapshots()[0].note, "저장 클릭 당시 메모");
  assert.deepEqual(harness.alerts, []);
  harness.dom.window.close();
}

{
  const xssDom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://localhost/"
  });
  const xssWindow = xssDom.window;
  installSnapshotGuardStubs(xssWindow);
  xssWindow.alert = () => {};
  xssWindow.console.error = () => {};
  xssWindow.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: "2026-07-30T00:00:00.000Z",
      fx: { USDKRW: { date: "2026-07-30", rate: 1300 } },
      prices: { KRX: {}, US: {} },
      errors: []
    })
  });
  const maliciousIds = {
    asset: 'asset-id" data-injected="asset',
    journal: 'journal-id" data-injected="journal',
    trade: 'trade-id" data-injected="trade',
    snapshot: 'snapshot-id" data-injected="snapshot'
  };
  xssWindow.localStorage.setItem("finance-ledger-retirement-v1", JSON.stringify({
    assets: [{ id: maliciousIds.asset, name: "검증 현금", type: "CASH", amount: 1000000 }],
    tradeJournalEntries: [{
      id: maliciousIds.journal,
      name: "검증 일지",
      date: "2026-07-30",
      action: "WATCH",
      status: "OPEN"
    }],
    realizedTrades: [{
      id: maliciousIds.trade,
      name: "검증 매도",
      soldAt: "2026-07-30",
      quantity: 1,
      sellPrice: 1000,
      grossAmount: 1000,
      realizedGain: 100
    }],
    snapshots: [{
      id: maliciousIds.snapshot,
      createdAt: "2026-07-30T00:00:00.000Z",
      total: 1000000,
      note: "검증"
    }],
    retirement: {}
  }));

  xssWindow.eval(appCode);
  await new Promise((resolve) => xssWindow.setTimeout(resolve, 20));

  assert.equal(xssWindow.document.querySelector("[data-injected]"), null);
  const renderedIds = new Set(
    [...xssWindow.document.querySelectorAll("[data-id]")].map((element) => element.dataset.id)
  );
  assert.equal(renderedIds.has(maliciousIds.asset), true);
  assert.equal(renderedIds.has(maliciousIds.journal), true);
  assert.equal(renderedIds.has(maliciousIds.trade), true);
  assert.equal(
    xssWindow.document.querySelector("[data-history-delete]").dataset.historyDelete,
    maliciousIds.snapshot
  );
  xssDom.window.close();
}
