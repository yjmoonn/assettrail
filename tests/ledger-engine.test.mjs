import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../ledger-engine.js");

assert.deepEqual(Object.keys(engine).sort(), [
  "INTERNAL_EVENT_TYPES",
  "TRANSACTION_EVENT_TYPES",
  "createOpeningBalanceEvent",
  "normalizeLedgerEvent",
  "projectLedger",
  "validateLedger"
]);
assert.deepEqual(engine.TRANSACTION_EVENT_TYPES, [
  "BUY",
  "SELL",
  "DEPOSIT",
  "WITHDRAWAL",
  "DIVIDEND",
  "INTEREST",
  "FEE",
  "TAX",
  "SPLIT",
  "VALUATION",
  "FX"
]);
assert.deepEqual(engine.INTERNAL_EVENT_TYPES, ["OPENING_BALANCE", "CANCEL"]);

{
  const context = vm.createContext({});
  vm.runInContext(readFileSync("ledger-engine.js", "utf8"), context);
  assert.equal(typeof context.AssetTrailLedgerEngine?.normalizeLedgerEvent, "function");
  assert.equal(typeof context.AssetTrailLedgerEngine?.projectLedger, "function");
}

const deepCopy = (value) => JSON.parse(JSON.stringify(value));

function openingCash(overrides = {}) {
  return {
    eventId: "opening-cash",
    type: "OPENING_BALANCE",
    balanceKind: "CASH",
    accountId: "account-cash",
    cashAccountId: "account-cash",
    cashAssetId: "cash-krw",
    tradeDate: "2026-01-01",
    settlementDate: "2026-01-01",
    amount: 1_000_000,
    currency: "KRW",
    fxRate: 1,
    ...overrides
  };
}

function openingPosition(overrides = {}) {
  return {
    eventId: "opening-position",
    type: "OPENING_BALANCE",
    balanceKind: "POSITION",
    accountId: "account-stock",
    assetId: "stock-1",
    instrumentKey: "INSTRUMENT:KRX:005930",
    tradeDate: "2026-01-01",
    settlementDate: "2026-01-01",
    quantity: 10,
    unitCost: 10_000,
    currency: "KRW",
    fxRate: 1,
    ...overrides
  };
}

function buyEvent(overrides = {}) {
  return {
    eventId: "buy-1",
    type: "BUY",
    accountId: "account-stock",
    cashAccountId: "account-cash",
    assetId: "stock-1",
    instrumentKey: "INSTRUMENT:KRX:005930",
    cashAssetId: "cash-krw",
    tradeDate: "2026-01-03",
    settlementDate: "2026-01-05",
    quantity: 5,
    price: 12_000,
    currency: "KRW",
    fxRate: 1,
    feeKRW: 1_000,
    taxKRW: 500,
    ...overrides
  };
}

function cashFlow(type, eventId, amount, overrides = {}) {
  return {
    eventId,
    type,
    accountId: "account-cash",
    cashAccountId: "account-cash",
    cashAssetId: "cash-krw",
    tradeDate: "2026-01-02",
    settlementDate: "2026-01-02",
    amount,
    currency: "KRW",
    fxRate: 1,
    ...overrides
  };
}

{
  const source = buyEvent({
    eventId: " normalize-buy ",
    type: " buy ",
    quantity: "2.5",
    price: "100",
    currency: "usd",
    fxRate: "1400",
    feeKRW: undefined,
    taxKRW: undefined,
    fee: "1000",
    tax: "200",
    grossAmount: 250,
    sourceSystem: "BROKER",
    sourceId: "TX-1"
  });
  const before = structuredClone(source);
  const result = engine.normalizeLedgerEvent(source);
  assert.equal(result.ok, true);
  assert.equal(result.event.eventId, "normalize-buy");
  assert.equal(result.event.type, "BUY");
  assert.equal(result.event.quantity, 2.5);
  assert.equal(result.event.currency, "USD");
  assert.equal(result.event.grossAmount, 250);
  assert.equal(result.event.grossAmountKRW, 350_000);
  assert.equal(result.event.feeKRW, 1_000, "fee 별칭도 현재 앱의 원화 비용으로 정규화해야 합니다.");
  assert.equal(result.event.taxKRW, 200);
  assert.deepEqual(source, before, "정규화는 입력 이벤트를 변경하지 않아야 합니다.");
}

{
  const invalidRows = [
    [{ ...buyEvent(), type: "GIFT" }, "INVALID_EVENT_TYPE"],
    [{ ...buyEvent(), accountId: "" }, "REQUIRED_FIELD"],
    [{ ...buyEvent(), tradeDate: "2026-02-30" }, "INVALID_TRADE_DATE"],
    [{ ...buyEvent(), settlementDate: "2025-12-31" }, "SETTLEMENT_BEFORE_TRADE"],
    [{ ...buyEvent(), cashAccountId: "" }, "REQUIRED_FIELD"],
    [{ ...buyEvent(), quantity: 0 }, "INVALID_NUMBER"],
    [{ ...buyEvent(), currency: "USD", fxRate: undefined }, "INVALID_NUMBER"],
    [{ ...buyEvent(), grossAmount: 123 }, "GROSS_AMOUNT_MISMATCH"],
    [{ ...cashFlow("DEPOSIT", "bad-source", 1), sourceSystem: "ONLY" }, "INCOMPLETE_SOURCE_ID"],
    [{ ...cashFlow("DEPOSIT", "long-note", 1), note: "가".repeat(10_001) }, "TEXT_TOO_LONG"],
    [{
      eventId: "bad-split",
      type: "SPLIT",
      accountId: "account-stock",
      assetId: "stock-1",
      tradeDate: "2026-01-01",
      numerator: 2.5,
      denominator: 1
    }, "INVALID_NUMBER"],
    [{
      eventId: "bad-value",
      type: "VALUATION",
      accountId: "account-manual",
      assetId: "manual-1",
      tradeDate: "2026-01-01",
      amount: -1,
      currency: "KRW",
      fxRate: 1
    }, "INVALID_NUMBER"]
  ];
  invalidRows.forEach(([row, code]) => {
    const result = engine.normalizeLedgerEvent(row);
    assert.equal(result.ok, false, row.eventId);
    assert.ok(result.errors.some((error) => error.code === code), `${row.eventId}: ${code}`);
  });
}

{
  const krx = engine.createOpeningBalanceEvent({
    id: "krx-1",
    type: "KRX",
    quantity: 3,
    averagePrice: 70_000
  }, {
    eventId: "open-krx",
    openingDate: "2026-01-01",
    accountId: "account-stock"
  });
  assert.equal(krx.ok, true);
  assert.equal(krx.event.type, "OPENING_BALANCE");
  assert.equal(krx.event.balanceKind, "POSITION");
  assert.equal(krx.event.fxRate, 1);

  const us = engine.createOpeningBalanceEvent({
    id: "us-1",
    type: "US",
    quantity: 2,
    averagePrice: 100
  }, {
    eventId: "open-us",
    openingDate: "2026-01-01",
    accountId: "account-us"
  });
  assert.equal(us.ok, true);
  assert.equal(us.event.currency, "USD");
  assert.equal(us.event.fxRate, null, "과거 환율을 현재 환율로 추정하면 안 됩니다.");
  assert.equal(us.event.fxRateKnown, false);

  const cash = engine.createOpeningBalanceEvent({
    id: "cash-empty-account",
    type: "CASH",
    amount: 500
  }, {
    eventId: "open-cash-fallback",
    openingDate: "2026-01-01"
  });
  assert.equal(cash.ok, true);
  assert.equal(cash.event.accountId, "UNASSIGNED:cash-empty-account");
  assert.equal(cash.event.cashAccountId, "UNASSIGNED:cash-empty-account");
  assert.ok(cash.warnings.some((item) => item.code === "UNASSIGNED_ACCOUNT_ID"));

  const manual = engine.createOpeningBalanceEvent({
    id: "manual-1",
    type: "MANUAL",
    amount: 123_000,
    accountId: "account-manual"
  }, {
    eventId: "open-manual",
    openingDate: "2026-01-01"
  });
  assert.equal(manual.ok, true);
  assert.equal(manual.event.balanceKind, "VALUATION");
  assert.notEqual(manual.event.type, "BUY", "기존 자산을 추정 매수로 만들어서는 안 됩니다.");
}

const fullLedger = [
  openingCash(),
  openingPosition(),
  cashFlow("DEPOSIT", "deposit-1", 100_000),
  buyEvent(),
  {
    ...buyEvent({
      eventId: "sell-1",
      type: "SELL",
      tradeDate: "2026-01-06",
      settlementDate: "2026-01-07",
      quantity: 3,
      price: 15_000,
      feeKRW: 500,
      taxKRW: 1_000
    })
  },
  cashFlow("DIVIDEND", "dividend-1", 3_000, {
    accountId: "account-stock",
    assetId: "stock-1",
    tradeDate: "2026-01-08",
    settlementDate: "2026-01-08"
  }),
  cashFlow("INTEREST", "interest-1", 2_000, {
    tradeDate: "2026-01-09",
    settlementDate: "2026-01-09"
  }),
  cashFlow("FEE", "fee-1", 100, {
    tradeDate: "2026-01-10",
    settlementDate: "2026-01-10"
  }),
  cashFlow("TAX", "tax-1", 200, {
    tradeDate: "2026-01-11",
    settlementDate: "2026-01-11"
  }),
  cashFlow("WITHDRAWAL", "withdrawal-1", 10_000, {
    tradeDate: "2026-01-12",
    settlementDate: "2026-01-12"
  }),
  {
    eventId: "split-1",
    type: "SPLIT",
    accountId: "account-stock",
    assetId: "stock-1",
    instrumentKey: "INSTRUMENT:KRX:005930",
    tradeDate: "2026-01-13",
    numerator: 2,
    denominator: 1
  },
  {
    eventId: "valuation-1",
    type: "VALUATION",
    accountId: "account-manual",
    assetId: "manual-1",
    tradeDate: "2026-01-14",
    amount: 250_000,
    currency: "KRW",
    fxRate: 1
  }
];

{
  const before = deepCopy(fullLedger);
  const projected = engine.projectLedger(fullLedger, { baselineDate: "2026-01-01" });
  assert.equal(projected.ok, true, JSON.stringify(projected.errors));
  assert.equal(projected.positions.length, 1);
  assert.equal(projected.positions[0].quantity, 24);
  assert.equal(projected.positions[0].costBasisNative, 128_000);
  assert.equal(projected.positions[0].averageCostNative, 5_333.33333333);
  assert.equal(projected.positions[0].costBasisKRW, 129_200);
  assert.equal(projected.positions[0].averageCostKRW, 5_383.33333333);
  assert.equal(projected.positions[0].realizedPnlKRW, 11_200);
  assert.equal(projected.cashBalances.length, 1, "현재 CASH 장부에는 USD 별도 잔액을 만들지 않습니다.");
  assert.equal(projected.cashBalances[0].currency, "KRW");
  assert.equal(projected.cashBalances[0].amountKRW, 1_076_700);
  assert.equal(projected.valuations[0].valueKRW, 250_000);
  assert.deepEqual(projected.summary, {
    externalCashFlowKRW: 90_000,
    depositsKRW: 100_000,
    withdrawalsKRW: 10_000,
    dividendsKRW: 3_000,
    interestKRW: 2_000,
    feesKRW: 1_600,
    taxesKRW: 1_700,
    realizedPnlKRW: 11_200,
    knownRealizedPnlKRW: 11_200,
    unknownRealizedPnlCount: 0,
    fxDifferenceKRW: 0
  });
  assert.equal(projected.reconciliation.balanced, true);
  assert.equal(projected.reconciliation.openingCashTotalKRW, 1_000_000);
  assert.equal(projected.reconciliation.cashMovementTotalKRW, 76_700);
  assert.equal(projected.reconciliation.endingCashTotalKRW, 1_076_700);
  assert.equal(projected.reconciliation.cashEquationDifferenceKRW, 0);
  assert.deepEqual(fullLedger, before, "projection도 입력 이벤트를 변경하지 않아야 합니다.");

  const beforeSettlement = engine.projectLedger(fullLedger, {
    baselineDate: "2026-01-01",
    asOfDate: "2026-01-04"
  });
  assert.equal(beforeSettlement.ok, true);
  assert.equal(beforeSettlement.positions[0].quantity, 15, "수량은 거래일에 반영해야 합니다.");
  assert.equal(beforeSettlement.cashBalances[0].amountKRW, 1_100_000, "현금은 결제일에 반영해야 합니다.");
}

{
  const matched = engine.projectLedger(fullLedger, {
    baselineDate: "2026-01-01",
    expectedPositions: [{ assetId: "stock-1", quantity: 24, averageCostNative: 5_333.33333333 }],
    expectedCashBalances: [{ cashAssetId: "cash-krw", amountKRW: 1_076_700 }]
  });
  assert.equal(matched.ok, true);
  assert.equal(matched.reconciliation.checkedPositionCount, 1);
  assert.equal(matched.reconciliation.checkedCashCount, 1);
  assert.equal(matched.reconciliation.mismatchCount, 0);

  const mismatched = engine.projectLedger(fullLedger, {
    baselineDate: "2026-01-01",
    expectedPositions: [{ assetId: "stock-1", quantity: 23, averageCostNative: 5_000 }],
    expectedCashBalances: [{ cashAssetId: "cash-krw", amountKRW: 1 }]
  });
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.reconciliation.mismatchCount, 3);
  assert.ok(mismatched.errors.some((item) => item.code === "POSITION_QUANTITY_MISMATCH"));
  assert.ok(mismatched.errors.some((item) => item.code === "POSITION_AVERAGE_COST_MISMATCH"));
  assert.ok(mismatched.errors.some((item) => item.code === "CASH_BALANCE_MISMATCH"));
}

{
  const usdBuy = engine.projectLedger([
    openingCash(),
    buyEvent({
      eventId: "usd-buy",
      accountId: "account-us",
      assetId: "us-new",
      instrumentKey: "INSTRUMENT:US:MSFT",
      quantity: 1,
      price: 100,
      currency: "USD",
      fxRate: 1_400,
      feeKRW: 1_000,
      taxKRW: 0
    })
  ]);
  assert.equal(usdBuy.ok, true);
  assert.equal(usdBuy.cashBalances[0].amountKRW, 859_000);
  assert.equal(usdBuy.positions[0].costBasisNative, 100);
  assert.equal(usdBuy.positions[0].costBasisKRW, 141_000, "원화 비용을 환율로 다시 곱하면 안 됩니다.");
}

{
  const events = [
    openingCash({ amount: 2_000_000 }),
    openingPosition({
      eventId: "opening-us",
      assetId: "us-stock",
      instrumentKey: "INSTRUMENT:US:MSFT",
      accountId: "account-us",
      quantity: 10,
      unitCost: 100,
      currency: "USD",
      fxRate: undefined
    }),
    buyEvent({
      eventId: "sell-us",
      type: "SELL",
      accountId: "account-us",
      assetId: "us-stock",
      instrumentKey: "INSTRUMENT:US:MSFT",
      tradeDate: "2026-02-01",
      settlementDate: "2026-02-03",
      quantity: 2,
      price: 120,
      currency: "USD",
      fxRate: 1_400,
      feeKRW: 1_000,
      taxKRW: 0
    })
  ];
  const result = engine.projectLedger(events, { baselineDate: "2026-01-01" });
  assert.equal(result.ok, true);
  assert.equal(result.positions[0].quantity, 8);
  assert.equal(result.positions[0].averageCostNative, 100);
  assert.equal(result.positions[0].costBasisKRW, null);
  assert.equal(result.positions[0].realizedPricePnlNative, 40);
  assert.equal(result.positions[0].realizedPnlKRW, null);
  assert.equal(result.summary.realizedPnlKRW, null);
  assert.equal(result.summary.unknownRealizedPnlCount, 1);
  assert.equal(result.cashBalances[0].amountKRW, 2_335_000);
  assert.ok(result.warnings.some((item) => item.code === "UNKNOWN_OPENING_FX_RATE"));
  assert.ok(result.warnings.some((item) => item.code === "UNKNOWN_REALIZED_PNL_KRW"));
}

{
  const original = cashFlow("DEPOSIT", "deposit-original", 100_000, {
    tradeDate: "2026-02-01",
    settlementDate: "2026-02-01",
    sourceSystem: "BROKER",
    sourceId: "D-1"
  });
  const correction = cashFlow("DEPOSIT", "deposit-corrected", 120_000, {
    tradeDate: "2026-02-01",
    settlementDate: "2026-02-01",
    sourceSystem: "BROKER",
    sourceId: "D-1",
    correctsEventId: "deposit-original",
    auditDate: "2026-03-01",
    createdAt: "2026-03-01T12:00:00+09:00",
    reason: "원본 입금액 정정"
  });
  const dividend = cashFlow("DIVIDEND", "dividend-cancel-target", 5_000, {
    accountId: "account-stock",
    assetId: "stock-1",
    tradeDate: "2026-02-10",
    settlementDate: "2026-02-10"
  });
  const cancel = {
    eventId: "cancel-dividend",
    type: "CANCEL",
    accountId: "account-stock",
    tradeDate: "2026-03-05",
    settlementDate: "2026-03-05",
    auditDate: "2026-03-05",
    createdAt: "2026-03-05T09:00:00Z",
    targetEventId: "dividend-cancel-target",
    reason: "중복 배당 취소"
  };
  const events = [openingCash(), original, correction, dividend, cancel];
  const validation = engine.validateLedger(events, { baselineDate: "2026-01-01" });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.deepEqual(validation.auditTrail.supersededEventIds, ["deposit-original", "dividend-cancel-target"]);
  assert.equal(validation.activeEvents.some((event) => event.eventId === "deposit-original"), false);
  assert.equal(validation.activeEvents.some((event) => event.eventId === "deposit-corrected"), true);

  const beforeCorrection = engine.projectLedger(events, {
    baselineDate: "2026-01-01",
    asOfDate: "2026-02-15"
  });
  assert.equal(beforeCorrection.cashBalances[0].amountKRW, 1_105_000);
  const afterCorrectionBeforeCancel = engine.projectLedger(events, {
    baselineDate: "2026-01-01",
    asOfDate: "2026-03-03"
  });
  assert.equal(afterCorrectionBeforeCancel.cashBalances[0].amountKRW, 1_125_000);
  const final = engine.projectLedger(events, { baselineDate: "2026-01-01" });
  assert.equal(final.cashBalances[0].amountKRW, 1_120_000);

  const reversed = engine.projectLedger([...events].reverse(), { baselineDate: "2026-01-01" });
  assert.deepEqual(reversed, final, "입력 배열 순서가 달라도 감사·projection 결과가 같아야 합니다.");
}

{
  const duplicateId = engine.validateLedger([
    openingCash(),
    cashFlow("DEPOSIT", "same", 1),
    cashFlow("DEPOSIT", "same", 2)
  ]);
  assert.equal(duplicateId.ok, false);
  assert.ok(duplicateId.errors.some((item) => item.code === "DUPLICATE_EVENT_ID"));

  const duplicateSource = engine.validateLedger([
    openingCash(),
    cashFlow("DEPOSIT", "source-1", 1, { sourceSystem: "BROKER", sourceId: "A" }),
    cashFlow("DEPOSIT", "source-2", 1, { sourceSystem: "BROKER", sourceId: "A" })
  ]);
  assert.equal(duplicateSource.ok, false);
  assert.ok(duplicateSource.errors.some((item) => item.code === "DUPLICATE_SOURCE_ID"));

  const missingAudit = engine.validateLedger([
    openingCash(),
    {
      eventId: "cancel-missing",
      type: "CANCEL",
      accountId: "account-cash",
      tradeDate: "2026-02-01",
      auditDate: "2026-02-01",
      createdAt: "2026-02-01T00:00:00Z",
      targetEventId: "missing",
      reason: "없는 이벤트"
    }
  ]);
  assert.equal(missingAudit.ok, false);
  assert.ok(missingAudit.errors.some((item) => item.code === "MISSING_AUDIT_TARGET"));

  const target = cashFlow("DEPOSIT", "multi-target", 1);
  const corrections = ["a", "b"].map((suffix, index) => cashFlow("DEPOSIT", `correction-${suffix}`, index + 2, {
    correctsEventId: "multi-target",
    auditDate: "2026-02-01",
    createdAt: `2026-02-01T00:00:0${index}Z`,
    reason: "경합 정정"
  }));
  const multiple = engine.validateLedger([openingCash(), target, ...corrections]);
  assert.equal(multiple.ok, false);
  assert.ok(multiple.errors.some((item) => item.code === "MULTIPLE_AUDIT_ACTIONS"));
}

{
  const events = [
    openingCash({ eventId: "open-from", cashAssetId: "cash-from", cashAccountId: "cash-account-from", accountId: "cash-account-from" }),
    openingCash({
      eventId: "open-to",
      cashAssetId: "cash-to",
      cashAccountId: "cash-account-to",
      accountId: "cash-account-to",
      amount: 0
    }),
    {
      eventId: "fx-1",
      type: "FX",
      accountId: "cash-account-from",
      cashAccountId: "cash-account-from",
      cashAssetId: "cash-from",
      counterCashAccountId: "cash-account-to",
      counterCashAssetId: "cash-to",
      tradeDate: "2026-01-02",
      settlementDate: "2026-01-02",
      amount: 100_000,
      currency: "KRW",
      fxRate: 1,
      counterAmount: 70,
      counterCurrency: "USD",
      counterFxRate: 1_400,
      feeKRW: 500
    }
  ];
  const result = engine.projectLedger(events, { baselineDate: "2026-01-01" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.cashBalances.map(({ cashAssetId, amountKRW }) => ({ cashAssetId, amountKRW })), [
    { cashAssetId: "cash-from", amountKRW: 899_500 },
    { cashAssetId: "cash-to", amountKRW: 98_000 }
  ]);
  assert.equal(result.summary.feesKRW, 500);
  assert.equal(result.summary.fxDifferenceKRW, -2_000, "환전 손익과 별도 원화 수수료를 중복 집계하면 안 됩니다.");
}

{
  const beforeBaseline = buyEvent({
    eventId: "pre-baseline-buy",
    tradeDate: "2025-12-31",
    settlementDate: "2025-12-31"
  });
  const validation = engine.validateLedger([openingCash(), openingPosition(), beforeBaseline], {
    baselineDate: "2026-01-01"
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((item) => item.code === "EVENT_BEFORE_BASELINE"));

  const openingConflict = engine.validateLedger([openingCash(), openingPosition(), beforeBaseline]);
  assert.equal(openingConflict.ok, false);
  assert.ok(openingConflict.errors.some((item) => item.code === "EVENT_BEFORE_OPENING_BALANCE"));

  const duplicateOpening = engine.validateLedger([openingCash(), openingCash({ eventId: "opening-cash-2" })]);
  assert.equal(duplicateOpening.ok, false);
  assert.ok(duplicateOpening.errors.some((item) => item.code === "DUPLICATE_OPENING_BALANCE"));
}

{
  const negativeCash = engine.projectLedger([
    openingCash({ amount: 100 }),
    cashFlow("WITHDRAWAL", "too-much", 200)
  ]);
  assert.equal(negativeCash.ok, false);
  assert.ok(negativeCash.errors.some((item) => item.code === "NEGATIVE_CASH_BALANCE"));

  const temporarilyNegativeCash = engine.projectLedger([
    openingCash({ amount: 100 }),
    cashFlow("WITHDRAWAL", "temporary-overdraft", 200, {
      tradeDate: "2026-01-02",
      settlementDate: "2026-01-02",
      sequence: 1
    }),
    cashFlow("DEPOSIT", "later-recovery", 200, {
      tradeDate: "2026-01-03",
      settlementDate: "2026-01-03",
      sequence: 1
    })
  ]);
  assert.equal(temporarilyNegativeCash.cashBalances[0].amountKRW, 100);
  assert.equal(temporarilyNegativeCash.ok, false, "a later deposit must not hide an earlier overdraft");
  assert.ok(temporarilyNegativeCash.errors.some((item) => (
    item.code === "NEGATIVE_CASH_BALANCE_AT_EVENT"
      && item.eventId === "temporary-overdraft"
      && item.date === "2026-01-02"
  )));

  const sameDaySequenceOverdraft = engine.projectLedger([
    openingCash({ amount: 100 }),
    cashFlow("WITHDRAWAL", "same-day-overdraft", 200, { sequence: 1 }),
    cashFlow("DEPOSIT", "same-day-recovery", 200, { sequence: 2 })
  ]);
  assert.equal(sameDaySequenceOverdraft.ok, false);
  assert.ok(sameDaySequenceOverdraft.errors.some((item) => (
    item.code === "NEGATIVE_CASH_BALANCE_AT_EVENT" && item.eventId === "same-day-overdraft"
  )));

  const negativePosition = engine.projectLedger([
    openingCash(),
    buyEvent({ eventId: "oversell", type: "SELL", quantity: 1, price: 1 })
  ]);
  assert.equal(negativePosition.ok, false);
  assert.ok(negativePosition.errors.some((item) => item.code === "NEGATIVE_POSITION"));
  assert.ok(negativePosition.errors.some((item) => item.code === "NEGATIVE_POSITION_BALANCE"));

  const invalidAsOf = engine.projectLedger([openingCash()], { asOfDate: "not-a-date" });
  assert.equal(invalidAsOf.ok, false);
  assert.ok(invalidAsOf.errors.some((item) => item.code === "INVALID_AS_OF_DATE"));
}

{
  const orderedEvents = [
    openingCash(),
    openingPosition(),
    buyEvent({ eventId: "same-day-buy", tradeDate: "2026-02-01", settlementDate: "2026-02-01", sequence: 1 }),
    buyEvent({
      eventId: "same-day-sell",
      type: "SELL",
      tradeDate: "2026-02-01",
      settlementDate: "2026-02-01",
      sequence: 2,
      quantity: 1,
      price: 13_000,
      feeKRW: 0,
      taxKRW: 0
    })
  ];
  const expected = engine.projectLedger(orderedEvents, { baselineDate: "2026-01-01" });
  for (let index = 0; index < 200; index += 1) {
    const rotated = orderedEvents.slice(index % orderedEvents.length).concat(orderedEvents.slice(0, index % orderedEvents.length));
    if (index % 2) rotated.reverse();
    assert.deepEqual(
      engine.projectLedger(rotated, { baselineDate: "2026-01-01" }),
      expected,
      `결정론 반복 ${index}`
    );
  }
}

{
  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let sample = 0; sample < 500; sample += 1) {
    let expectedQuantity = 100;
    let expectedCash = 1_000_000;
    const events = [
      openingCash(),
      openingPosition({ quantity: 100, unitCost: 100 })
    ];
    for (let index = 0; index < 20; index += 1) {
      const shouldBuy = expectedQuantity < 2 || random() >= 0.48;
      const quantity = 1 + Math.floor(random() * 3);
      const price = 80 + Math.floor(random() * 50);
      const feeKRW = Math.floor(random() * 10);
      const taxKRW = Math.floor(random() * 10);
      if (shouldBuy) {
        expectedQuantity += quantity;
        expectedCash -= quantity * price + feeKRW + taxKRW;
      } else {
        const sold = Math.min(quantity, expectedQuantity);
        expectedQuantity -= sold;
        expectedCash += sold * price - feeKRW - taxKRW;
        events.push(buyEvent({
          eventId: `random-${sample}-${index}`,
          type: "SELL",
          tradeDate: "2026-02-01",
          settlementDate: "2026-02-01",
          sequence: index + 1,
          quantity: sold,
          price,
          feeKRW,
          taxKRW
        }));
        continue;
      }
      events.push(buyEvent({
        eventId: `random-${sample}-${index}`,
        tradeDate: "2026-02-01",
        settlementDate: "2026-02-01",
        sequence: index + 1,
        quantity,
        price,
        feeKRW,
        taxKRW
      }));
    }
    const result = engine.projectLedger(events, { baselineDate: "2026-01-01" });
    assert.equal(result.ok, true, `무작위 원장 ${sample}: ${JSON.stringify(result.errors)}`);
    assert.equal(result.positions[0].quantity, expectedQuantity);
    assert.equal(result.cashBalances[0].amountKRW, expectedCash);
    assert.equal(result.reconciliation.cashEquationDifferenceKRW, 0);
    assert.deepEqual(
      engine.projectLedger([...events].reverse(), { baselineDate: "2026-01-01" }),
      result,
      `무작위 원장 순서 결정성 ${sample}`
    );
  }
}

console.log("ledger-engine tests passed");
