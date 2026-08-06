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
await new Promise((resolve) => window.setTimeout(resolve, 30));
const today = window.eval("localDateInputValue()");

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
assert.equal(window.location.hash, "#settings");
appNavItems.at(-1).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, appNavItems[0]);
assert.equal(window.location.hash, "#dashboard");

assert.equal(window.document.querySelectorAll("table > caption.sr-only").length, 4);
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

window.document.querySelector('[data-nav-view="GOALS"]').click();
assert.match(window.document.querySelector("#historySummary").textContent, /기록 상태/);
const historyMobileButton = window.document.querySelector('[data-goal-mobile-panel="HISTORY"]');
const retirementMobileButton = window.document.querySelector('[data-goal-mobile-panel="RETIREMENT"]');
const historyCanvas = window.document.querySelector("#historyChart");
const historyPanel = window.document.querySelector("#historyPanel");
Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
Object.defineProperty(historyCanvas, "clientWidth", {
  configurable: true,
  get: () => historyPanel.classList.contains("goal-panel-mobile-hidden") ? 0 : 320
});
Object.defineProperty(historyCanvas, "clientHeight", {
  configurable: true,
  get: () => historyPanel.classList.contains("goal-panel-mobile-hidden") ? 0 : 180
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
assert.equal(historyMobileButton.getAttribute("aria-pressed"), "true");
assert.equal(window.document.querySelector("#retirementPanel").classList.contains("goal-panel-mobile-hidden"), true);
assert.equal(window.eval("drawChart([])"), true);
assert.equal(historyCanvas.width, 640);
assert.equal(historyCanvas.height, 360);
retirementMobileButton.click();
assert.equal(retirementMobileButton.getAttribute("aria-pressed"), "true");
assert.equal(window.document.querySelector("#historyPanel").classList.contains("goal-panel-mobile-hidden"), true);
assert.equal(window.document.querySelector("#retirementPanel").classList.contains("goal-panel-mobile-hidden"), false);
for (let index = 0; index < 6; index += 1) window.eval("drawChart([])");
assert.equal(historyCanvas.width, 640);
assert.equal(historyCanvas.height, 360);
historyMobileButton.click();
await new Promise((resolve) => window.setTimeout(resolve, 20));
assert.equal(window.document.querySelector("#historyPanel").classList.contains("goal-panel-mobile-hidden"), false);
assert.equal(window.document.querySelector("#retirementPanel").classList.contains("goal-panel-mobile-hidden"), true);
assert.equal(historyCanvas.width, 640);
assert.equal(historyCanvas.height, 360);
window.document.querySelector("#snapshotBtn").click();
assert.match(window.document.querySelector("#historySummary").textContent, /기록 수/);
assert.match(window.document.querySelector("#historySummary").textContent, /1회/);
assert.match(window.document.querySelector("#appNotice").textContent, /조회 기록을 저장했습니다/);
const savedAfterSnapshot = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1"));
assert.equal(savedAfterSnapshot.schemaVersion, 5);
assert.equal(savedAfterSnapshot.snapshots[0].assets, undefined);
assert.deepEqual(
  Object.keys(savedAfterSnapshot.snapshots[0]).sort(),
  ["createdAt", "id", "note", "total", "typeTotals"]
);

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
assert.match(rows.join("\n"), /삼성전자 005930 KRX 국내 미래에셋 5 ₩370,000종가 74,000 · 5월 18일 ▲ \+₩10,000/);
assert.match(rows.join("\n"), /SOL 한국원자력SMR 0092B0 KRX 국내 연금저축 1 ₩19,645종가 19,645 · 5월 19일 ▲ \+₩9,645/);
assert.match(rows.join("\n"), /Apple Inc\. AAPL US 미국 2 ₩494,000종가 \$190\.00 · 환율 1,300원 · 5월 18일 ▲ \+₩26,000/);
assert.match(rows.join("\n"), /현금 CASH 현금 - ₩600,000/);
assert.match(rows.join("\n"), /청년 적금 MANUAL 수동 적금 계좌 - ₩2,000,000/);
assert.match(rows.join("\n"), /주택청약저축 MANUAL 수동 청약 계좌 - ₩300,000/);
assert.match(rows.join("\n"), /IRP 대기자산 MANUAL 수동 IRP - ₩500,000/);
assert.match(rows.join("\n"), /DC 대기자산 MANUAL 수동 DC - ₩700,000/);
window.document.querySelector('[data-nav-view="PORTFOLIO"]').click();
assert.match(window.document.querySelector(".ledger-panel .panel-header p").textContent, /US 평가손익은 환차손익을 제외/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /계좌 분석/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /연금계좌/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /적금/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /상품 유형 분석/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /개별종목/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /ETF/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /국내\/해외 비중/);
assert.match(window.document.querySelector("#categoryBreakdown").textContent, /해외/);
assert.equal(window.document.querySelectorAll(".pie-chart").length, 4);
assert.match(window.document.querySelector(".pie-chart").style.background, /conic-gradient/);
const portfolioBreakdownToggle = window.document.querySelector("#portfolioBreakdownToggle");
assert.equal(portfolioBreakdownToggle.hidden, false);
assert.equal(portfolioBreakdownToggle.getAttribute("aria-expanded"), "false");
assert.equal(window.document.querySelector("#categoryBreakdown").classList.contains("mobile-collapsed"), true);
portfolioBreakdownToggle.click();
assert.equal(portfolioBreakdownToggle.getAttribute("aria-expanded"), "true");
assert.equal(window.document.querySelector("#categoryBreakdown").classList.contains("mobile-collapsed"), false);
assert.equal(window.document.querySelector("#assetTableWrap").classList.contains("asset-table-wrap"), true);
window.document.querySelector("#targetDomestic").value = "40";
window.document.querySelector("#targetOverseas").value = "30";
window.document.querySelector("#targetCash").value = "20";
setValue("#targetManual", "10");
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).portfolioTargets.domestic, 40);
setValue("#targetDomestic", "41");
assert.match(window.document.querySelector("#targetValidation").textContent, /현재 합계는 101%/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).portfolioTargets.domestic, 40);
setValue("#targetManual", "-1");
assert.match(window.document.querySelector("#targetValidation").textContent, /0% 이상 100% 이하/);
assert.equal(JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).portfolioTargets.manual, 10);
window.document.querySelector("#targetDomestic").value = "40";
setValue("#targetManual", "10");
assert.match(window.document.querySelector("#targetValidation").textContent, /합계는 100%/);
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
assert.match(window.document.querySelector("#realizedChart").getAttribute("aria-label"), /2026년 월별 실현손익 차트.*8월 ₩24,500/);
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
expectAlert(
  () => window.document.querySelector("#snapshotBtn").click(),
  /가격이 없는 보유 자산.*US:MSFT.*조회 기록을 저장하지 않았습니다/
);
assert.equal(
  JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1")).snapshots.length,
  snapshotsBeforeMissingPrice
);

function installSnapshotGuardStubs(testWindow) {
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
    url: "http://localhost/"
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
  await new Promise((resolve) => scenarioWindow.setTimeout(resolve, 20));
  scenarioWindow.document.querySelector("#snapshotBtn").click();

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

const unloadedPriceGuard = await runSnapshotGuardScenario({
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
assert.match(unloadedPriceGuard.alerts[0], /가격표를 아직 불러오지 못했습니다/);
assert.equal(unloadedPriceGuard.stored.snapshots.length, 0);

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
    prices: {
      KRX: {},
      US: {
        AAPL: { close: 190, date: "2026-07-30", name: "Apple Inc." }
      }
    }
  }
});
assert.match(missingFxGuard.alerts[0], /USD\/KRW 환율이 없습니다/);
assert.equal(missingFxGuard.stored.snapshots.length, 0);

const staleCloseWarning = await runSnapshotGuardScenario({
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
    generatedAt: "2099-07-30T00:00:00.000Z",
    fx: { USDKRW: { date: "2099-07-30", rate: 1300 } },
    prices: {
      KRX: {
        "005930": { close: 74000, date: "2000-01-01", name: "오래된 종가" }
      },
      US: {}
    }
  }
});
assert.equal(staleCloseWarning.alerts.length, 0);
assert.equal(staleCloseWarning.stored.snapshots.length, 1);
assert.match(staleCloseWarning.notice, /보유 종목 종가 1개가 최대 .*일 전 기준/);

const undatedCloseWarning = await runSnapshotGuardScenario({
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
    generatedAt: "2099-07-30T00:00:00.000Z",
    fx: { USDKRW: { date: "2099-07-30", rate: 1300 } },
    prices: {
      KRX: {
        "005930": { close: 74000, name: "기준일 없는 종가" }
      },
      US: {}
    }
  }
});
assert.equal(undatedCloseWarning.alerts.length, 0);
assert.equal(undatedCloseWarning.stored.snapshots.length, 1);
assert.match(undatedCloseWarning.notice, /종가 1개의 기준일을 확인할 수 없습니다/);

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
