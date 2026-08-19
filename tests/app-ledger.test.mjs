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

const migrated = stored();
assert.equal(migrated.schemaVersion, 7);
assert.equal(migrated.events.length, 2);
assert.equal(migrated.events.every((event) => event.type === "OPENING_BALANCE"), true);
assert.equal(migrated.events.some((event) => event.type === "BUY"), false);
assert.equal(migrated.events.find((event) => event.assetId === "stock-1").instrumentKey, "INSTRUMENT:KRX:005930");
assert.equal(migrated.ledgerMeta.baselineDate, "2026-08-01");
assert.equal(
  window.localStorage.getItem(`${STORAGE_KEY}:migration-backup:v4-to-v7`),
  legacyRaw
);

window.document.querySelector('[data-nav-view="ASSETS"]').click();
const stockRow = [...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"));
stockRow.querySelector('[data-action="buy"]').click();
assert.equal(window.document.querySelector("#buyCashAssetId").value, "cash-1");
const today = window.eval("localDateInputValue()");
setValue("#buyDate", today);
setValue("#buySettlementDate", today);
setValue("#buyQuantity", "2");
setValue("#buyPrice", "12000");
setValue("#buyFees", "100");
assert.match(window.document.querySelector("#buyPreview").textContent, /증권 예수금.*₩1,000,000.*₩975,900/);
submit("#buyForm");

let afterBuy = stored();
const buyEvent = afterBuy.events.find((event) => event.type === "BUY");
assert.ok(buyEvent);
assert.equal(buyEvent.instrumentKey, "INSTRUMENT:KRX:005930");
assert.equal(buyEvent.cashAssetId, "cash-1");
assert.equal(buyEvent.feeKRW, 100);
assert.equal(afterBuy.assets.find((asset) => asset.id === "stock-1").quantity, 12);
assert.equal(afterBuy.assets.find((asset) => asset.id === "cash-1").amount, 975900);
assert.equal(afterBuy.tradeJournalEntries[0].ledgerEventId, buyEvent.eventId);

const eventsBeforeInsufficient = afterBuy.events.length;
const cashBeforeInsufficient = afterBuy.assets.find((asset) => asset.id === "cash-1").amount;
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"))
  .querySelector('[data-action="buy"]').click();
setValue("#buyDate", today);
setValue("#buySettlementDate", today);
setValue("#buyQuantity", "1000");
setValue("#buyPrice", "12000");
submit("#buyForm");
assert.match(alerts.at(-1), /CASH 잔액/);
assert.equal(stored().events.length, eventsBeforeInsufficient);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, cashBeforeInsufficient);

[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"))
  .querySelector('[data-action="sell"]').click();
setValue("#sellDate", today);
setValue("#sellSettlementDate", today);
setValue("#sellQuantity", "1");
setValue("#sellPrice", "15000");
setValue("#sellFees", "100");
setValue("#sellTax", "50");
submit("#sellForm");

let afterSell = stored();
const sellEvent = afterSell.events.find((event) => event.type === "SELL");
assert.ok(sellEvent);
assert.equal(sellEvent.instrumentKey, "INSTRUMENT:KRX:005930");
assert.equal(afterSell.assets.find((asset) => asset.id === "stock-1").quantity, 11);
assert.equal(afterSell.assets.find((asset) => asset.id === "cash-1").amount, 990750);
assert.equal(afterSell.realizedTrades[0].ledgerEventId, sellEvent.eventId);

window.document.querySelector('[data-nav-view="JOURNAL"]').click();
assert.equal(window.document.querySelector("#ledgerTabPanel").hidden, false);
assert.match(window.document.querySelector("#ledgerReconciliation").textContent, /원장 정합성 정상/);
assert.match(window.document.querySelector("#ledgerEventRows").textContent, /매수/);
assert.match(window.document.querySelector("#ledgerEventRows").textContent, /매도/);

window.eval("showCashFlowForm()");
setValue("#cashFlowType", "DIVIDEND");
setValue("#cashFlowDate", today);
setValue("#cashFlowSettlementDate", today);
setValue("#cashFlowCashAssetId", "cash-1");
setValue("#cashFlowSourceAssetId", "stock-1");
setValue("#cashFlowAmount", "10");
setValue("#cashFlowCurrency", "USD");
setValue("#cashFlowFxRate", "1300");
setValue("#cashFlowMemo", "분기 배당");
assert.match(window.document.querySelector("#cashFlowPreview").textContent, /원화 반영 \+₩13,000/);
submit("#cashFlowForm");

let afterDividend = stored();
const dividendEvent = afterDividend.events.find((event) => event.type === "DIVIDEND");
assert.equal(dividendEvent.amount, 10);
assert.equal(dividendEvent.instrumentKey, "INSTRUMENT:KRX:005930");
assert.equal(dividendEvent.currency, "USD");
assert.equal(dividendEvent.amountKRW, 13000);
assert.equal(afterDividend.assets.find((asset) => asset.id === "cash-1").amount, 1003750);

window.document.querySelector(`[data-event-id="${dividendEvent.eventId}"] [data-ledger-action="correct"]`).click();
setValue("#cashFlowAmount", "12");
submit("#cashFlowForm");
const afterCorrection = stored();
const correctedDividend = afterCorrection.events.find((event) => event.correctsEventId === dividendEvent.eventId);
assert.ok(correctedDividend);
assert.equal(afterCorrection.events.some((event) => event.eventId === dividendEvent.eventId), true);
assert.equal(afterCorrection.assets.find((asset) => asset.id === "cash-1").amount, 1006350);

assert.equal(
  window.eval(`cancelLedgerEvent(${JSON.stringify(correctedDividend.eventId)}, "중복 배당 취소")`),
  true
);
const afterCancel = stored();
assert.equal(afterCancel.events.some((event) => event.type === "CANCEL" && event.targetEventId === correctedDividend.eventId), true);
assert.equal(afterCancel.events.some((event) => event.eventId === dividendEvent.eventId), true);
assert.equal(afterCancel.assets.find((asset) => asset.id === "cash-1").amount, 990750);

window.eval("showCashFlowForm()");
setValue("#cashFlowType", "WITHDRAWAL");
setValue("#cashFlowDate", today);
setValue("#cashFlowSettlementDate", today);
setValue("#cashFlowCashAssetId", "cash-1");
setValue("#cashFlowAmount", "900000");
submit("#cashFlowForm");
const withdrawalEvent = stored().events.find((event) => event.type === "WITHDRAWAL");
assert.ok(withdrawalEvent);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 90750);
window.document.querySelector(`[data-event-id="${withdrawalEvent.eventId}"] [data-ledger-action="correct"]`).click();
setValue("#cashFlowAmount", "100000");
submit("#cashFlowForm");
const correctedWithdrawal = stored().events.find((event) => event.correctsEventId === withdrawalEvent.eventId);
assert.ok(correctedWithdrawal, "outgoing correction must restore the original debit before validating replacement cash");
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890750);

window.document.querySelector('[data-nav-view="ASSETS"]').click();
let cashRow = [...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("증권 예수금"));
assert.ok(cashRow.querySelector('[data-action="cash-deposit"]'));
assert.ok(cashRow.querySelector('[data-action="cash-withdrawal"]'));
assert.ok(cashRow.querySelector('[data-action="cash-reconcile"]'));
cashRow.querySelector('[data-action="cash-deposit"]').click();
assert.equal(window.document.querySelector("#cashFlowCashAssetId").value, "cash-1");
assert.equal(window.document.querySelector("#cashFlowType").value, "DEPOSIT");
window.eval("resetCashFlowForm(); setActiveView('ASSETS')");

cashRow = [...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("증권 예수금"));
cashRow.querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='edit']").click();
assert.equal(window.document.querySelector("#assetAmount").disabled, true);
assert.equal(window.document.querySelector("#cashAmountLockHelp").hidden, false);
window.document.querySelector("#manageCashBalanceBtn").click();
assert.equal(window.document.querySelector("#cashBalanceFormPanel").hidden, false);
setValue("#cashBalanceActualAmount", "900750");
setValue("#cashBalanceReason", "DEPOSIT");
setValue("#cashBalanceDate", today);
submit("#cashBalanceForm");
let afterBalanceDeposit = stored();
const balanceDeposit = afterBalanceDeposit.events.find((event) => (
  event.type === "DEPOSIT" && event.note?.startsWith("[잔액 맞추기]")
));
assert.ok(balanceDeposit);
assert.equal(afterBalanceDeposit.assets.find((asset) => asset.id === "cash-1").amount, 900750);
assert.equal(window.eval(`cancelLedgerEvent(${JSON.stringify(balanceDeposit.eventId)}, "잔액 맞추기 입금 테스트 복원")`), true);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890750);

window.eval(`showCashBalanceForm(storageSafeState().assets.find((asset) => asset.id === "cash-1"))`);
setValue("#cashBalanceActualAmount", "900750");
setValue("#cashBalanceReason", "OPENING_BALANCE");
setValue("#cashBalanceDate", "2026-08-05");
setValue("#cashBalanceMemo", "최초 등록금액 1만원 누락");
submit("#cashBalanceForm");
const firstOpeningCorrection = stored().events.find((event) => (
  event.type === "OPENING_BALANCE" && event.correctsEventId && event.cashAssetId === "cash-1"
));
assert.ok(firstOpeningCorrection);
assert.equal(firstOpeningCorrection.amount, 1010000);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 900750);

window.eval(`showCashBalanceForm(storageSafeState().assets.find((asset) => asset.id === "cash-1"))`);
setValue("#cashBalanceActualAmount", "890750");
setValue("#cashBalanceReason", "OPENING_BALANCE");
setValue("#cashBalanceDate", "2026-08-05");
setValue("#cashBalanceMemo", "테스트 기초잔액 복원");
submit("#cashBalanceForm");
const restoredOpening = stored().events.find((event) => event.correctsEventId === firstOpeningCorrection.eventId);
assert.ok(restoredOpening);
assert.equal(restoredOpening.amount, 1000000);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890750);

window.eval(`showCashBalanceForm(storageSafeState().assets.find((asset) => asset.id === "cash-1"))`);
setValue("#cashBalanceActualAmount", "890873");
setValue("#cashBalanceReason", "CASH_ADJUSTMENT");
setValue("#cashBalanceDate", "2026-08-05");
setValue("#cashBalanceMemo", "증권사 잔액과 123원 차이");
submit("#cashBalanceForm");
const unresolvedAdjustment = stored().events.find((event) => event.type === "CASH_ADJUSTMENT");
assert.ok(unresolvedAdjustment);
assert.equal(unresolvedAdjustment.amount, 123);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890873);
assert.equal(window.eval("ledgerProjection().warnings.some((warning) => warning.code === 'UNCLASSIFIED_CASH_ADJUSTMENT')"), true);
assert.equal(window.eval("currentPerformanceObservation().issueCodes.includes('UNRESOLVED_CASH_ADJUSTMENT')"), true);
assert.equal(window.eval(`cancelLedgerEvent(${JSON.stringify(unresolvedAdjustment.eventId)}, "원인 미확인 조정 테스트 복원")`), true);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890750);
assert.equal(
  window.eval("currentPerformanceObservation().issueCodes.includes('UNRESOLVED_CASH_ADJUSTMENT')"),
  true,
  "평가일 뒤에 취소한 조정은 과거 평가일 투영에서 여전히 미분류 상태여야 합니다."
);

[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='edit']").click();
assert.equal(window.document.querySelector("#assetCategory").disabled, true);
assert.equal(window.document.querySelector("#assetQuantity").disabled, true);
assert.equal(window.document.querySelector("#assetTicker").disabled, true);
window.document.querySelector("#assetQuantity").value = "999";
window.document.querySelector("#assetTicker").value = "000660";
submit("#assetForm");
assert.equal(stored().assets.find((asset) => asset.id === "stock-1").quantity, 11);
assert.equal(stored().assets.find((asset) => asset.id === "stock-1").ticker, "005930");

const tradedAssetCount = stored().assets.length;
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='delete']").click();
assert.match(alerts.at(-1), /거래·현금흐름 이력이 연결된 자산/);
assert.equal(stored().assets.length, tradedAssetCount);

window.eval("showAssetForm('create')");
setValue("#assetCategory", "KRX");
setValue("#assetName", "종목 정정 테스트");
setValue("#assetAccount", "신규 계좌");
setValue("#assetTicker", "000660");
setValue("#assetQuantity", "3");
setValue("#assetAveragePrice", "100000");
submit("#assetForm");
const openingOnlyMarket = stored().assets.find((asset) => asset.name === "종목 정정 테스트");
assert.ok(openingOnlyMarket);
const originalMarketOpening = stored().events.find((event) => (
  event.type === "OPENING_BALANCE" && event.assetId === openingOnlyMarket.id
));
assert.ok(originalMarketOpening);
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("종목 정정 테스트"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='edit']").click();
assert.equal(window.document.querySelector("#assetTicker").disabled, false);
setValue("#assetTicker", "035420");
submit("#assetForm");
const afterOpeningCorrection = stored();
const correctedMarketOpening = afterOpeningCorrection.events.find((event) => (
  event.correctsEventId === originalMarketOpening.eventId
));
assert.ok(correctedMarketOpening, "opening-only ticker change must create an auditable correction");
assert.equal(correctedMarketOpening.type, "OPENING_BALANCE");
assert.equal(correctedMarketOpening.instrumentKey, "INSTRUMENT:KRX:035420");
assert.equal(afterOpeningCorrection.assets.find((asset) => asset.id === openingOnlyMarket.id).ticker, "035420");
assert.equal(afterOpeningCorrection.assets.find((asset) => asset.id === openingOnlyMarket.id).quantity, 3);

[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("종목 정정 테스트"))
  .querySelector('[data-action="buy"]').click();
setValue("#buyDate", today);
setValue("#buySettlementDate", today);
setValue("#buyQuantity", "1");
setValue("#buyPrice", "1000");
setValue("#buyFees", "0");
submit("#buyForm");
const cancelledDependentBuy = stored().events.find((event) => (
  event.type === "BUY" && event.assetId === openingOnlyMarket.id
));
assert.ok(cancelledDependentBuy);
assert.equal(window.eval(`cancelLedgerEvent(${JSON.stringify(cancelledDependentBuy.eventId)}, "취소 이력 잠금 회귀")`), true);
assert.equal(stored().assets.find((asset) => asset.id === openingOnlyMarket.id).quantity, 3);
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("종목 정정 테스트"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='edit']").click();
assert.equal(window.document.querySelector("#assetTicker").disabled, true, "cancelled dependent history must keep ticker locked");
window.eval("resetAssetForm()");
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("종목 정정 테스트"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='delete']").click();
assert.match(alerts.at(-1), /거래·현금흐름 이력이 연결된 자산/);
assert.equal(stored().assets.some((asset) => asset.id === openingOnlyMarket.id), true);

window.eval("showAssetForm('create')");
setValue("#assetCategory", "CASH");
setValue("#assetName", "삭제할 임시 현금");
setValue("#assetAccount", "임시 계좌");
setValue("#assetAmount", "5000");
submit("#assetForm");
const mistakenCash = stored().assets.find((asset) => asset.name === "삭제할 임시 현금");
assert.ok(mistakenCash);
const mistakenCashOpening = stored().events.find((event) => (
  event.type === "OPENING_BALANCE" && event.cashAssetId === mistakenCash.id
));
assert.ok(mistakenCashOpening);
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("삭제할 임시 현금"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='delete']").click();
const afterOpeningDelete = stored();
assert.equal(afterOpeningDelete.assets.some((asset) => asset.id === mistakenCash.id), false);
assert.equal(afterOpeningDelete.events.some((event) => event.eventId === mistakenCashOpening.eventId), true);
assert.equal(afterOpeningDelete.events.some((event) => (
  event.type === "CANCEL" && event.targetEventId === mistakenCashOpening.eventId
)), true);
assert.equal(window.eval("ledgerProjection().ok"), true, "opening cancellation deletion must leave a valid ledger projection");
assert.doesNotThrow(
  () => window.eval(`validateImportPayload(${JSON.stringify(afterOpeningDelete)})`),
  "an exported opening cancellation deletion must remain importable"
);

const beforeDuplicateCreate = stored();
window.eval("showAssetForm('create')");
setValue("#assetCategory", "CASH");
setValue("#assetName", "증권 예수금");
setValue("#assetAccount", "증권계좌");
setValue("#assetAmount", "12345");
submit("#assetForm");
assert.match(alerts.at(-1), /이미 같은 자산이 등록/);
assert.equal(stored().assets.length, beforeDuplicateCreate.assets.length);
assert.equal(stored().events.length, beforeDuplicateCreate.events.length);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, beforeDuplicateCreate.assets.find((asset) => asset.id === "cash-1").amount);
window.eval("resetAssetForm()");

window.eval("showAssetForm('create')");
setValue("#assetCategory", "MANUAL");
setValue("#assetName", "수동 펀드");
setValue("#assetAmount", "100000");
submit("#assetForm");
const manualAsset = stored().assets.find((asset) => asset.name === "수동 펀드");
assert.ok(manualAsset);
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("수동 펀드"))
  .querySelector('[data-action="detail"]').click();
window.document.querySelector("#assetDetailDrawer [data-action='edit']").click();
assert.equal(window.document.querySelector("#assetAmount").disabled, false);
setValue("#assetAmount", "125000");
submit("#assetForm");
const afterValuation = stored();
const valuationEvent = afterValuation.events.find((event) => event.type === "VALUATION" && event.assetId === manualAsset.id);
assert.ok(valuationEvent);
assert.equal(valuationEvent.amount, 125000);
assert.equal(afterValuation.assets.find((asset) => asset.id === manualAsset.id).amount, 125000);

const beforeFailedSave = stored();
const storagePrototype = Object.getPrototypeOf(window.localStorage);
const originalSetItem = storagePrototype.setItem;
storagePrototype.setItem = () => {
  throw new window.DOMException("quota", "QuotaExceededError");
};
window.eval("setInvestmentRecordTab('LEDGER'); showCashFlowForm()");
setValue("#cashFlowType", "DEPOSIT");
setValue("#cashFlowDate", today);
setValue("#cashFlowSettlementDate", today);
setValue("#cashFlowCashAssetId", "cash-1");
setValue("#cashFlowAmount", "5000");
submit("#cashFlowForm");
assert.match(alerts.at(-1), /로컬 저장소에 기록하지 못했습니다/);
assert.equal(window.eval("storageSafeState().events.length"), beforeFailedSave.events.length);
assert.equal(window.eval('storageSafeState().assets.find((asset) => asset.id === "cash-1").amount'), 890750);
storagePrototype.setItem = originalSetItem;

const journalTab = window.document.querySelector("#investmentJournalTab");
const realizedTab = window.document.querySelector("#investmentRealizedTab");
const ledgerTab = window.document.querySelector("#investmentLedgerTab");
const performanceTab = window.document.querySelector("#investmentPerformanceTab");
ledgerTab.focus();
ledgerTab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, journalTab);
journalTab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, performanceTab);
performanceTab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, ledgerTab);
ledgerTab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
assert.equal(window.document.activeElement, realizedTab);

window.eval("setActiveView('ASSETS')");
const beforeAutoDeposit = stored();
[...window.document.querySelectorAll("#assetRows tr")]
  .find((row) => row.textContent.includes("테스트 주식"))
  .querySelector('[data-action="buy"]').click();
setValue("#buyDate", today);
setValue("#buySettlementDate", today);
setValue("#buyQuantity", "100");
setValue("#buyPrice", "12000");
setValue("#buyFees", "0");
assert.equal(window.document.querySelector("#buyCashShortfallField").hidden, false);
assert.match(window.document.querySelector("#buyCashShortfallText").textContent, /부족한/);
window.document.querySelector("#buyAutoDeposit").checked = true;
window.document.querySelector("#buyAutoDeposit").dispatchEvent(new window.Event("change", { bubbles: true }));
assert.match(window.document.querySelector("#buyPreview").textContent, /입금/);
submit("#buyForm");
const afterAutoDeposit = stored();
const beforeAutoIds = new Set(beforeAutoDeposit.events.map((event) => event.eventId));
const autoEvents = afterAutoDeposit.events.filter((event) => !beforeAutoIds.has(event.eventId));
const autoDepositEvent = autoEvents.find((event) => event.type === "DEPOSIT");
const autoBuyEvent = autoEvents.find((event) => event.type === "BUY");
assert.ok(autoDepositEvent);
assert.ok(autoBuyEvent);
assert.equal(autoDepositEvent.amount, 309250);
assert.equal(autoDepositEvent.cashAssetId, autoBuyEvent.cashAssetId);
assert.equal(autoDepositEvent.settlementDate, autoBuyEvent.settlementDate);
assert.ok(autoDepositEvent.sequence < autoBuyEvent.sequence);
assert.equal(afterAutoDeposit.assets.find((asset) => asset.id === "cash-1").amount, 0);
assert.equal(afterAutoDeposit.assets.find((asset) => asset.id === "stock-1").quantity, 111);
assert.equal(window.eval(`cancelLedgerEvents(${JSON.stringify(autoEvents.map((event) => event.eventId))}, "부족금 자동입금 테스트 복원")`), true);
assert.equal(stored().assets.find((asset) => asset.id === "cash-1").amount, 890750);
assert.equal(stored().assets.find((asset) => asset.id === "stock-1").quantity, 11);
assert.equal(stored().events.filter((event) => event.type === "CANCEL" && autoEvents.some((target) => target.eventId === event.targetEventId)).length, 2);

window.eval("showAssetForm('create')");
setValue("#assetCategory", "CASH");
setValue("#assetName", "당일 정정 예수금");
setValue("#assetAccount", "키움ISA계좌");
setValue("#assetAmount", "1000000");
submit("#assetForm");
const sameDayCash = stored().assets.find((asset) => asset.name === "당일 정정 예수금");
assert.ok(sameDayCash);
const sameDayOpening = stored().events.find((event) => (
  event.type === "OPENING_BALANCE" && event.cashAssetId === sameDayCash.id
));
assert.ok(sameDayOpening);
const originalDateNow = window.Date.now;
window.Date.now = () => 1786682695496;
window.eval(`showCashBalanceForm(storageSafeState().assets.find((asset) => asset.id === ${JSON.stringify(sameDayCash.id)}))`);
setValue("#cashBalanceActualAmount", "1100000");
setValue("#cashBalanceReason", "DEPOSIT");
setValue("#cashBalanceDate", today);
submit("#cashBalanceForm");
const sameDayDeposit = stored().events.find((event) => (
  event.type === "DEPOSIT" && event.cashAssetId === sameDayCash.id
));
assert.ok(sameDayDeposit);
window.Date.now = () => 1786688614892;
const alertsBeforeSameDayCorrection = alerts.length;
window.eval(`showCashBalanceForm(storageSafeState().assets.find((asset) => asset.id === ${JSON.stringify(sameDayCash.id)}))`);
setValue("#cashBalanceActualAmount", "1200000");
setValue("#cashBalanceReason", "OPENING_BALANCE");
setValue("#cashBalanceDate", today);
setValue("#cashBalanceMemo", "당일 거래 전 최초 등록금액 정정");
submit("#cashBalanceForm");
window.Date.now = originalDateNow;
const sameDayCorrection = stored().events.find((event) => event.correctsEventId === sameDayOpening.eventId);
assert.ok(sameDayCorrection, "same-day cash activity must not block an opening balance correction");
assert.equal(alerts.length, alertsBeforeSameDayCorrection);
assert.equal(sameDayCorrection.sequence, sameDayOpening.sequence);
assert.equal(sameDayCorrection.tradeDate, sameDayOpening.tradeDate);
assert.equal(sameDayCorrection.amount, 1100000);
assert.equal(stored().assets.find((asset) => asset.id === sameDayCash.id).amount, 1200000);
assert.equal(window.eval("ledgerProjection().ok"), true);

const knownFxAsset = {
  id: "us-known-fx",
  name: "Known FX",
  ticker: "AAPL",
  type: "US",
  account: "해외계좌",
  quantity: 2,
  averagePrice: 100
};
const knownFxOpening = window.AssetTrailLedgerEngine.createOpeningBalanceEvent(knownFxAsset, {
  eventId: "opening-us-known-fx",
  openingDate: "2026-08-01",
  accountId: "ACCOUNT:us-known-fx",
  instrumentKey: "INSTRUMENT:US:AAPL",
  currency: "USD",
  fxRate: 1350
}).event;
window.eval(`
  replaceState({
    ...defaultState(),
    assets: ${JSON.stringify([knownFxAsset])},
    events: ${JSON.stringify([knownFxOpening])},
    ledgerMeta: { activeLedgerId: "ledger-known-fx", baselineDate: "2026-08-01" }
  });
  render(false);
  setActiveView("ASSETS");
  handleAssetAction({ dataset: { action: "edit", id: "us-known-fx" } });
`);
assert.equal(window.document.querySelector("#assetTicker").disabled, false);
setValue("#assetTicker", "MSFT");
submit("#assetForm");
const knownFxCorrection = stored().events.find((event) => event.correctsEventId === knownFxOpening.eventId);
assert.ok(knownFxCorrection);
assert.equal(knownFxCorrection.currency, "USD");
assert.equal(knownFxCorrection.fxRate, 1350);
assert.equal(knownFxCorrection.fxRateKnown, true);

dom.window.close();
console.log("app ledger tests passed");
