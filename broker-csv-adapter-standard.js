(function attachAssetTrailStandardBrokerCsvAdapter(root, factory) {
  let engine = root && root.AssetTrailBrokerCsvEngine;
  if (!engine && typeof module === "object" && module.exports) engine = require("./broker-csv-engine.js");
  const adapter = factory(engine);
  if (typeof module === "object" && module.exports) module.exports = adapter;
  if (root) root.AssetTrailBrokerCsvStandardAdapter = adapter;
  if (engine && !engine.listAdapters().some((item) => item.id === adapter.id)) engine.registerAdapter(adapter);
})(typeof globalThis !== "undefined" ? globalThis : this, function createStandardBrokerCsvAdapter(engine) {
  "use strict";

  if (!engine) throw new Error("AssetTrailBrokerCsvEngine must be loaded before the standard CSV adapter.");

  const REQUIRED_HEADERS = Object.freeze([
    "assettrail_version",
    "transaction_id",
    "type",
    "trade_date",
    "settlement_date",
    "account",
    "cash_account",
    "market",
    "ticker",
    "quantity",
    "price",
    "currency",
    "fx_rate",
    "amount",
    "fee_krw",
    "tax_krw"
  ]);
  const SUPPORTED_TYPES = Object.freeze([
    "BUY",
    "SELL",
    "DEPOSIT",
    "WITHDRAWAL",
    "DIVIDEND",
    "INTEREST",
    "FEE",
    "TAX"
  ]);
  const MARKET_TRANSACTION_TYPES = new Set(["BUY", "SELL", "DIVIDEND"]);
  const BUY_SELL_TYPES = new Set(["BUY", "SELL"]);

  const FORMAT = Object.freeze({
    id: "assettrail-standard-v1",
    version: 1,
    requiredHeaders: REQUIRED_HEADERS,
    supportedTypes: SUPPORTED_TYPES,
    sourceSemantics: Object.freeze({
      transaction_id: "증권사가 부여한 거래 고유 ID이며 선택값; 계좌번호·고객명·자유 메모를 넣지 않음",
      account: "시장 자산 연결에만 쓰고 이벤트에는 저장하지 않는 계좌 참조",
      cash_account: "CASH 자산 연결에만 쓰고 이벤트에는 저장하지 않는 계좌 참조"
    }),
    amountSemantics: Object.freeze({
      quantity: "BUY/SELL 체결수량이며 0보다 큰 값",
      price: "BUY/SELL 1주당 거래통화 체결단가이며 총액이나 순액이 아님",
      amount: "입출금·배당·이자·수수료·세금의 거래통화 기준 양수 총액; BUY/SELL에서는 비워 둠",
      fee_krw: "BUY/SELL에 포함된 원화 수수료 양수 또는 0; FEE 거래 자체 금액은 amount에 기록",
      tax_krw: "BUY/SELL에 포함된 원화 세금 양수 또는 0; TAX 거래 자체 금액은 amount에 기록",
      fx_rate: "거래통화 1단위당 원화 환율; KRW는 비우거나 1, 외화는 필수"
    })
  });

  function normalized(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  function textValue(row, field, rowIssues, context, options = {}) {
    const value = normalized(row.values[field]);
    if (options.required && !value) {
      rowIssues.push(context.issue("MISSING_FIELD", { rowNumber: row.rowNumber, field }));
      return "";
    }
    const maxLength = options.maxLength || engine.MAX_TEXT_LENGTH;
    if (value.length > maxLength) {
      rowIssues.push(context.issue("TEXT_TOO_LONG", { rowNumber: row.rowNumber, field }));
      return value.slice(0, maxLength);
    }
    return value;
  }

  function decimalValue(row, field, rowIssues, context, options = {}) {
    const raw = normalized(row.values[field]).replace(/[\s,\u00a0]/g, "");
    if (!raw) {
      if (options.required) rowIssues.push(context.issue("MISSING_FIELD", { rowNumber: row.rowNumber, field }));
      return options.defaultValue === undefined ? null : options.defaultValue;
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
      rowIssues.push(context.issue("INVALID_NUMBER", { rowNumber: row.rowNumber, field }));
      return null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1e15) {
      rowIssues.push(context.issue("INVALID_NUMBER", { rowNumber: row.rowNumber, field }));
      return null;
    }
    if (options.positive && !(value > 0)) {
      rowIssues.push(context.issue("NUMBER_MUST_BE_POSITIVE", { rowNumber: row.rowNumber, field }));
    }
    if (options.nonNegative && value < 0) {
      rowIssues.push(context.issue("NUMBER_MUST_BE_NON_NEGATIVE", { rowNumber: row.rowNumber, field }));
    }
    return value;
  }

  function dateValue(row, field, rowIssues, context, options = {}) {
    const raw = textValue(row, field, rowIssues, context, { required: options.required, maxLength: 20 });
    if (!raw) return "";
    const date = context.validDateKey(raw);
    if (!date) rowIssues.push(context.issue("INVALID_DATE", { rowNumber: row.rowNumber, field }));
    return date;
  }

  function currencyAndFx(row, rowIssues, context, market) {
    const currency = textValue(row, "currency", rowIssues, context, { required: true, maxLength: 3 }).toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      rowIssues.push(context.issue("INVALID_CURRENCY", { rowNumber: row.rowNumber, field: "currency" }));
    }
    const rawRate = normalized(row.values.fx_rate);
    let fxRate;
    if (currency === "KRW" && !rawRate) fxRate = 1;
    else fxRate = decimalValue(row, "fx_rate", rowIssues, context, { required: currency !== "KRW", positive: true });
    if (currency !== "KRW" && !rawRate) {
      const missingIndex = rowIssues.findIndex((item) => item.code === "MISSING_FIELD" && item.field === "fx_rate");
      if (missingIndex >= 0) rowIssues.splice(missingIndex, 1);
      rowIssues.push(context.issue("MISSING_FX_RATE", { rowNumber: row.rowNumber, field: "fx_rate" }));
    }
    if (currency === "KRW" && fxRate !== null && Math.abs(Number(fxRate) - 1) > 1e-10) {
      rowIssues.push(context.issue("INVALID_KRW_RATE", { rowNumber: row.rowNumber, field: "fx_rate" }));
    }
    if ((market === "KRX" && currency && currency !== "KRW")
      || (market === "US" && currency && currency !== "USD")) {
      rowIssues.push(context.issue("CURRENCY_MARKET_MISMATCH", { rowNumber: row.rowNumber, field: "currency" }));
    }
    return { currency, fxRate: fxRate === null ? 0 : fxRate };
  }

  function unexpectedPopulated(row, fields, rowIssues, context) {
    fields.forEach((field) => {
      const value = normalized(row.values[field]);
      if (value && value !== "0" && value !== "0.0") {
        rowIssues.push(context.issue("UNEXPECTED_FIELD", { rowNumber: row.rowNumber, field }));
      }
    });
  }

  const adapter = Object.freeze({
    id: FORMAT.id,
    brokerCode: "ASSETTRAIL_STANDARD_CSV",
    displayName: "AssetTrail 표준 거래 CSV v1",
    version: FORMAT.version,
    priority: 100,
    format: FORMAT,

    detect({ headers }) {
      return { confidence: headers.includes("assettrail_version") ? 1 : 0 };
    },

    parse(table, context) {
      REQUIRED_HEADERS.forEach((header) => {
        if (!table.headers.includes(header)) context.fail("MISSING_REQUIRED_HEADER", { field: header });
      });

      const rows = table.rows.map((row) => {
        const rowIssues = [];
        const version = textValue(row, "assettrail_version", rowIssues, context, { required: true, maxLength: 8 });
        if (version && version !== "1") {
          rowIssues.push(context.issue("INVALID_VERSION", { rowNumber: row.rowNumber, field: "assettrail_version" }));
        }
        const sourceTransactionId = textValue(row, "transaction_id", rowIssues, context, {
          maxLength: engine.SOURCE_ID_MAX_LENGTH
        });
        const type = textValue(row, "type", rowIssues, context, { required: true, maxLength: 20 }).toUpperCase();
        if (type && !SUPPORTED_TYPES.includes(type)) {
          rowIssues.push(context.issue("INVALID_TYPE", { rowNumber: row.rowNumber, field: "type" }));
        }
        const tradeDate = dateValue(row, "trade_date", rowIssues, context, { required: true });
        const settlementRaw = normalized(row.values.settlement_date);
        const settlementDate = settlementRaw
          ? dateValue(row, "settlement_date", rowIssues, context)
          : tradeDate;
        if (tradeDate && settlementDate && settlementDate < tradeDate) {
          rowIssues.push(context.issue("SETTLEMENT_BEFORE_TRADE", { rowNumber: row.rowNumber, field: "settlement_date" }));
        }
        const marketTransaction = MARKET_TRANSACTION_TYPES.has(type);
        const accountRef = textValue(row, "account", rowIssues, context, {
          required: marketTransaction,
          maxLength: 500
        });
        const cashAccountRef = textValue(row, "cash_account", rowIssues, context, { required: true, maxLength: 500 });
        const market = textValue(row, "market", rowIssues, context, {
          required: marketTransaction,
          maxLength: 8
        }).toUpperCase();
        if (marketTransaction && market && !["KRX", "US"].includes(market)) {
          rowIssues.push(context.issue("INVALID_MARKET", { rowNumber: row.rowNumber, field: "market" }));
        }
        const tickerRaw = textValue(row, "ticker", rowIssues, context, {
          required: marketTransaction,
          maxLength: 20
        });
        const ticker = context.normalizeTicker(market, tickerRaw);
        if (marketTransaction && ticker) {
          const valid = market === "KRX"
            ? /^[0-9A-Z]{6}$/.test(ticker)
            : market === "US" && /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker);
          if (!valid) rowIssues.push(context.issue("INVALID_TICKER", { rowNumber: row.rowNumber, field: "ticker" }));
        }

        const currency = currencyAndFx(row, rowIssues, context, marketTransaction ? market : "");
        let quantity = null;
        let price = null;
        let amount = null;
        let feeKRW = 0;
        let taxKRW = 0;
        if (BUY_SELL_TYPES.has(type)) {
          quantity = decimalValue(row, "quantity", rowIssues, context, { required: true, positive: true });
          price = decimalValue(row, "price", rowIssues, context, { required: true, positive: true });
          feeKRW = decimalValue(row, "fee_krw", rowIssues, context, { nonNegative: true, defaultValue: 0 });
          taxKRW = decimalValue(row, "tax_krw", rowIssues, context, { nonNegative: true, defaultValue: 0 });
          unexpectedPopulated(row, ["amount"], rowIssues, context);
        } else if (SUPPORTED_TYPES.includes(type)) {
          amount = decimalValue(row, "amount", rowIssues, context, { required: true, positive: true });
          unexpectedPopulated(row, ["quantity", "price", "fee_krw", "tax_krw"], rowIssues, context);
          if (!marketTransaction) unexpectedPopulated(row, ["market", "ticker"], rowIssues, context);
        }

        const transaction = rowIssues.some((item) => item.severity === "error") ? null : Object.freeze({
          rowNumber: row.rowNumber,
          sourceTransactionId,
          accountRef,
          cashAccountRef,
          type,
          tradeDate,
          settlementDate,
          market: marketTransaction ? market : "",
          ticker: marketTransaction ? ticker : "",
          quantity,
          price,
          amount,
          currency: currency.currency,
          fxRate: currency.fxRate,
          feeKRW,
          taxKRW
        });
        return Object.freeze({
          rowNumber: row.rowNumber,
          eventType: type,
          tradeDate,
          issues: Object.freeze(rowIssues),
          transaction
        });
      });
      return Object.freeze({ rows: Object.freeze(rows), issues: Object.freeze([]) });
    }
  });

  return adapter;
});
