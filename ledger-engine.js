(function attachAssetTrailLedgerEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailLedgerEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLedgerEngine() {
  "use strict";

  const TRANSACTION_EVENT_TYPES = Object.freeze([
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
  const INTERNAL_EVENT_TYPES = Object.freeze(["OPENING_BALANCE", "CANCEL"]);
  const EVENT_TYPES = new Set([...TRANSACTION_EVENT_TYPES, ...INTERNAL_EVENT_TYPES]);
  const CASH_EVENT_TYPES = new Set([
    "BUY",
    "SELL",
    "DEPOSIT",
    "WITHDRAWAL",
    "DIVIDEND",
    "INTEREST",
    "FEE",
    "TAX",
    "FX"
  ]);
  const AMOUNT_EVENT_TYPES = new Set([
    "DEPOSIT",
    "WITHDRAWAL",
    "DIVIDEND",
    "INTEREST",
    "FEE",
    "TAX"
  ]);
  const OPENING_BALANCE_KINDS = new Set(["POSITION", "CASH", "VALUATION"]);
  const MAX_ABSOLUTE_NUMBER = 1e15;
  const EPSILON = 1e-8;

  function normalizedText(value) {
    return String(value ?? "").trim();
  }

  function normalizedUpper(value) {
    return normalizedText(value).toUpperCase();
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function round(value, digits = 8) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function validDateKey(value) {
    const key = normalizedText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function validTimestamp(value) {
    const text = normalizedText(value);
    if (!text) return "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return "";
    const parsed = new Date(text);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
  }

  function issue(code, message, details = {}) {
    return { code, severity: "error", message, ...details };
  }

  function warning(code, message, details = {}) {
    return { code, severity: "warning", message, ...details };
  }

  function eventSort(left, right) {
    return compareText(left.tradeDate, right.tradeDate)
      || (left.sequence || 0) - (right.sequence || 0)
      || compareText(left.eventId, right.eventId);
  }

  function postingSort(left, right) {
    return compareText(left.date, right.date)
      || (left.sequence || 0) - (right.sequence || 0)
      || compareText(left.eventId, right.eventId)
      || compareText(left.leg, right.leg);
  }

  function isBoundedNumber(value, options = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > MAX_ABSOLUTE_NUMBER) return false;
    if (options.integer && !Number.isSafeInteger(numeric)) return false;
    if (options.positive && !(numeric > 0)) return false;
    if (options.nonNegative && numeric < 0) return false;
    return true;
  }

  function readNumber(source, field, errors, options = {}) {
    const value = source[field];
    if ((value === undefined || value === null || value === "") && options.defaultValue !== undefined) {
      return options.defaultValue;
    }
    if (!isBoundedNumber(value, options)) {
      const qualifier = options.positive
        ? "0보다 큰 유한한 숫자"
        : options.nonNegative
          ? "0 이상의 유한한 숫자"
          : options.integer
            ? "안전한 정수"
            : "유한한 숫자";
      errors.push(issue("INVALID_NUMBER", `${field}은(는) ${qualifier}여야 합니다.`, { field }));
      return 0;
    }
    return Number(value);
  }

  function readRequiredText(source, field, errors, label = field) {
    const value = normalizedText(source[field]);
    if (!value) errors.push(issue("REQUIRED_FIELD", `${label}을(를) 입력해야 합니다.`, { field }));
    if (value.length > 240) errors.push(issue("TEXT_TOO_LONG", `${label}은(는) 240자 이하여야 합니다.`, { field }));
    return value.slice(0, 240);
  }

  function readOptionalText(source, field, errors, options = {}) {
    const value = normalizedText(source[field]);
    const maxLength = options.maxLength || 240;
    if (value.length > maxLength) {
      errors.push(issue(
        "TEXT_TOO_LONG",
        `${options.label || field}은(는) ${maxLength.toLocaleString("ko-KR")}자 이하여야 합니다.`,
        { field }
      ));
    }
    return value.slice(0, maxLength);
  }

  function readCurrencyAndRate(source, errors, options = {}) {
    const currencyField = options.currencyField || "currency";
    const rateField = options.rateField || "fxRate";
    const currency = normalizedUpper(source[currencyField]);
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push(issue("INVALID_CURRENCY", `${currencyField}은(는) ISO 3자리 통화 코드여야 합니다.`, {
        field: currencyField
      }));
    }
    const rawRate = source[rateField] ?? source[options.rateAlias || "__no_alias__"];
    let fxRate;
    const rateMissing = rawRate === undefined || rawRate === null || rawRate === "";
    if (currency === "KRW" && rateMissing) {
      fxRate = 1;
    } else if (options.allowUnknownRate && currency !== "KRW" && rateMissing) {
      fxRate = null;
    } else {
      const rateSource = { [rateField]: rawRate };
      fxRate = readNumber(rateSource, rateField, errors, { positive: true });
    }
    if (currency === "KRW" && Math.abs(fxRate - 1) > EPSILON) {
      errors.push(issue("INVALID_KRW_RATE", "KRW의 거래 당시 환율은 1이어야 합니다.", { field: rateField }));
    }
    return { currency, fxRate, fxRateKnown: Number.isFinite(fxRate) };
  }

  function normalizeLedgerEvent(source, options = {}) {
    const row = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    const index = Number.isSafeInteger(options.index) ? options.index : undefined;
    const errors = [];
    const warnings = [];
    if (row !== source) errors.push(issue("INVALID_EVENT", "원장 이벤트는 객체여야 합니다."));

    const eventId = readRequiredText(row, "eventId", errors, "이벤트 ID");
    const type = normalizedUpper(row.type);
    if (!EVENT_TYPES.has(type)) {
      errors.push(issue("INVALID_EVENT_TYPE", `지원하지 않는 이벤트 유형입니다: ${type || "(비어 있음)"}.`, {
        field: "type"
      }));
    }
    const accountId = readRequiredText(row, "accountId", errors, "계좌 ID");
    const tradeDate = validDateKey(row.tradeDate);
    if (!tradeDate) errors.push(issue("INVALID_TRADE_DATE", "거래일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.", {
      field: "tradeDate"
    }));
    const rawSettlementDate = normalizedText(row.settlementDate);
    const settlementDate = rawSettlementDate ? validDateKey(rawSettlementDate) : tradeDate;
    if (rawSettlementDate && !settlementDate) {
      errors.push(issue("INVALID_SETTLEMENT_DATE", "결제일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.", {
        field: "settlementDate"
      }));
    }
    if (tradeDate && settlementDate && settlementDate < tradeDate) {
      errors.push(issue("SETTLEMENT_BEFORE_TRADE", "결제일은 거래일보다 빠를 수 없습니다.", {
        field: "settlementDate"
      }));
    }

    const sequence = readNumber(row, "sequence", errors, { integer: true, nonNegative: true, defaultValue: 0 });
    const createdAt = validTimestamp(row.createdAt);
    if (normalizedText(row.createdAt) && !createdAt) {
      errors.push(issue("INVALID_CREATED_AT", "생성 시각은 유효한 ISO 날짜·시간이어야 합니다.", { field: "createdAt" }));
    }
    const sourceSystem = readOptionalText(row, "sourceSystem", errors, { maxLength: 120, label: "원본 시스템" });
    const sourceId = readOptionalText(row, "sourceId", errors, { maxLength: 240, label: "원본 ID" });
    if (Boolean(sourceSystem) !== Boolean(sourceId)) {
      errors.push(issue(
        "INCOMPLETE_SOURCE_ID",
        "원본 식별자는 sourceSystem과 sourceId를 함께 입력해야 합니다.",
        { field: sourceSystem ? "sourceId" : "sourceSystem" }
      ));
    }
    const note = readOptionalText(row, "note", errors, { maxLength: 10000, label: "메모" });
    const reason = readOptionalText(row, "reason", errors, { maxLength: 10000, label: "사유" });
    const correctsEventId = readOptionalText(row, "correctsEventId", errors, {
      maxLength: 240,
      label: "정정 대상 이벤트 ID"
    });
    const rawAuditDate = normalizedText(row.auditDate);
    if (correctsEventId && correctsEventId === eventId) {
      errors.push(issue("SELF_CORRECTION", "이벤트가 자기 자신을 정정할 수 없습니다.", { field: "correctsEventId" }));
    }
    if (correctsEventId && !reason) {
      errors.push(issue("CORRECTION_REASON_REQUIRED", "정정 이벤트에는 정정 사유가 필요합니다.", { field: "reason" }));
    }
    if (correctsEventId && !rawAuditDate) {
      errors.push(issue("AUDIT_DATE_REQUIRED", "정정 이벤트에는 감사 처리일이 필요합니다.", { field: "auditDate" }));
    }
    if (correctsEventId && !createdAt) {
      errors.push(issue("AUDIT_CREATED_AT_REQUIRED", "정정 이벤트에는 생성 시각이 필요합니다.", { field: "createdAt" }));
    }
    const auditDate = rawAuditDate ? validDateKey(rawAuditDate) : (correctsEventId ? tradeDate : "");
    if (rawAuditDate && !auditDate) {
      errors.push(issue("INVALID_AUDIT_DATE", "감사 처리일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.", {
        field: "auditDate"
      }));
    }
    if (correctsEventId && auditDate && tradeDate && auditDate < tradeDate) {
      errors.push(issue("AUDIT_BEFORE_CORRECTION", "감사 처리일은 정정 거래일보다 빠를 수 없습니다.", {
        field: "auditDate"
      }));
    }

    const event = {
      eventId,
      type,
      accountId,
      tradeDate,
      settlementDate,
      sequence
    };
    if (createdAt) event.createdAt = createdAt;
    if (sourceSystem) event.sourceSystem = sourceSystem;
    if (sourceId) event.sourceId = sourceId;
    if (note) event.note = note;
    if (reason) event.reason = reason;
    if (correctsEventId) {
      event.correctsEventId = correctsEventId;
      event.auditDate = auditDate;
    }

    const copyAssetIdentity = (required) => {
      const assetId = required
        ? readRequiredText(row, "assetId", errors, "자산 ID")
        : readOptionalText(row, "assetId", errors, { maxLength: 240, label: "자산 ID" });
      const instrumentKey = readOptionalText(row, "instrumentKey", errors, {
        maxLength: 240,
        label: "종목 식별자"
      });
      if (assetId) event.assetId = assetId;
      if (instrumentKey) event.instrumentKey = instrumentKey;
      return assetId;
    };

    if (type === "BUY" || type === "SELL") {
      copyAssetIdentity(true);
      event.cashAssetId = readRequiredText(row, "cashAssetId", errors, "결제 CASH 자산 ID");
      event.cashAccountId = readRequiredText(row, "cashAccountId", errors, "결제 CASH 계좌 ID");
      event.quantity = readNumber(row, "quantity", errors, { positive: true });
      event.price = readNumber(row, "price", errors, { positive: true });
      const currency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
      event.currency = currency.currency;
      event.fxRate = currency.fxRate;
      const costSource = {
        feeKRW: row.feeKRW ?? row.fee,
        taxKRW: row.taxKRW ?? row.tax
      };
      event.feeKRW = readNumber(costSource, "feeKRW", errors, { nonNegative: true, defaultValue: 0 });
      event.taxKRW = readNumber(costSource, "taxKRW", errors, { nonNegative: true, defaultValue: 0 });
      event.grossAmount = round(event.quantity * event.price, 8);
      event.grossAmountKRW = round(event.grossAmount * event.fxRate, 4);
      if (row.grossAmount !== undefined && row.grossAmount !== null && row.grossAmount !== "") {
        const suppliedGross = readNumber(row, "grossAmount", errors, { nonNegative: true });
        const tolerance = Math.max(0.00000001, Math.abs(event.grossAmount) * 1e-10);
        if (Math.abs(suppliedGross - event.grossAmount) > tolerance) {
          errors.push(issue(
            "GROSS_AMOUNT_MISMATCH",
            `거래금액이 수량×가격과 일치하지 않습니다. 계산값은 ${event.grossAmount}입니다.`,
            { field: "grossAmount" }
          ));
        }
      }
    } else if (AMOUNT_EVENT_TYPES.has(type)) {
      if (type === "DIVIDEND") copyAssetIdentity(true);
      else copyAssetIdentity(false);
      event.cashAssetId = readRequiredText(row, "cashAssetId", errors, "CASH 자산 ID");
      event.cashAccountId = readRequiredText(row, "cashAccountId", errors, "CASH 계좌 ID");
      event.amount = readNumber(row, "amount", errors, { positive: true });
      const currency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
      event.currency = currency.currency;
      event.fxRate = currency.fxRate;
      event.amountKRW = round(event.amount * event.fxRate, 4);
      if (row.amountKRW !== undefined && row.amountKRW !== null && row.amountKRW !== "") {
        const suppliedAmountKRW = readNumber(row, "amountKRW", errors, { positive: true });
        if (Math.abs(suppliedAmountKRW - event.amountKRW) > 0.01) {
          errors.push(issue(
            "KRW_AMOUNT_MISMATCH",
            `원화 금액이 거래통화 금액×환율과 일치하지 않습니다. 계산값은 ${event.amountKRW}원입니다.`,
            { field: "amountKRW" }
          ));
        }
      }
    } else if (type === "SPLIT") {
      copyAssetIdentity(true);
      event.numerator = readNumber(row, "numerator", errors, { integer: true, positive: true });
      event.denominator = readNumber(row, "denominator", errors, { integer: true, positive: true });
    } else if (type === "VALUATION") {
      copyAssetIdentity(true);
      event.amount = readNumber(row, "amount", errors, { nonNegative: true });
      const currency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
      event.currency = currency.currency;
      event.fxRate = currency.fxRate;
    } else if (type === "FX") {
      event.cashAssetId = readRequiredText(row, "cashAssetId", errors, "보내는 CASH 자산 ID");
      event.cashAccountId = readRequiredText(row, "cashAccountId", errors, "보내는 CASH 계좌 ID");
      event.counterCashAssetId = readRequiredText(row, "counterCashAssetId", errors, "받는 CASH 자산 ID");
      event.counterCashAccountId = readRequiredText(row, "counterCashAccountId", errors, "받는 CASH 계좌 ID");
      if (event.cashAssetId && event.cashAssetId === event.counterCashAssetId) {
        errors.push(issue("SAME_FX_CASH_ASSET", "환전의 보내는 CASH와 받는 CASH는 달라야 합니다."));
      }
      event.amount = readNumber(row, "amount", errors, { positive: true });
      event.counterAmount = readNumber(row, "counterAmount", errors, { positive: true });
      const sourceCurrency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
      const counterSource = {
        counterCurrency: row.counterCurrency,
        counterFxRate: row.counterFxRate ?? row.counterExchangeRate
      };
      const counterCurrency = readCurrencyAndRate(counterSource, errors, {
        currencyField: "counterCurrency",
        rateField: "counterFxRate"
      });
      event.currency = sourceCurrency.currency;
      event.fxRate = sourceCurrency.fxRate;
      event.counterCurrency = counterCurrency.currency;
      event.counterFxRate = counterCurrency.fxRate;
      event.conversionRate = round(event.counterAmount / event.amount, 12);
      event.amountKRW = round(event.amount * event.fxRate, 4);
      event.counterAmountKRW = round(event.counterAmount * event.counterFxRate, 4);
      if (event.currency && event.currency === event.counterCurrency) {
        errors.push(issue("SAME_FX_CURRENCY", "환전 전·후 통화는 달라야 합니다."));
      }
      if (row.conversionRate !== undefined && row.conversionRate !== null && row.conversionRate !== "") {
        const suppliedRate = readNumber(row, "conversionRate", errors, { positive: true });
        const tolerance = Math.max(1e-10, Math.abs(event.conversionRate) * 1e-10);
        if (Math.abs(suppliedRate - event.conversionRate) > tolerance) {
          errors.push(issue(
            "FX_RATE_MISMATCH",
            `환전율이 받는 금액÷보내는 금액과 일치하지 않습니다. 계산값은 ${event.conversionRate}입니다.`,
            { field: "conversionRate" }
          ));
        }
      }
      event.feeKRW = readNumber(
        { feeKRW: row.feeKRW ?? row.fee },
        "feeKRW",
        errors,
        { nonNegative: true, defaultValue: 0 }
      );
    } else if (type === "OPENING_BALANCE") {
      const balanceKind = normalizedUpper(row.balanceKind);
      if (!OPENING_BALANCE_KINDS.has(balanceKind)) {
        errors.push(issue(
          "INVALID_OPENING_KIND",
          "기초잔액 유형은 POSITION, CASH 또는 VALUATION이어야 합니다.",
          { field: "balanceKind" }
        ));
      }
      event.balanceKind = balanceKind;
      if (balanceKind === "POSITION") {
        copyAssetIdentity(true);
        event.quantity = readNumber(row, "quantity", errors, { nonNegative: true });
        event.unitCost = readNumber(row, "unitCost", errors, { nonNegative: true, defaultValue: 0 });
        const currency = readCurrencyAndRate(row, errors, {
          rateAlias: "exchangeRate",
          allowUnknownRate: true
        });
        event.currency = currency.currency;
        event.fxRate = currency.fxRate;
        event.fxRateKnown = currency.fxRateKnown;
      } else if (balanceKind === "CASH") {
        event.cashAssetId = readRequiredText(row, "cashAssetId", errors, "CASH 자산 ID");
        event.cashAccountId = readRequiredText(row, "cashAccountId", errors, "CASH 계좌 ID");
        event.amount = readNumber(row, "amount", errors, { nonNegative: true });
        const currency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
        event.currency = currency.currency;
        event.fxRate = currency.fxRate;
        if (event.currency !== "KRW") {
          errors.push(issue(
            "NON_KRW_OPENING_CASH",
            "현재 CASH 자산은 원화 단일 장부이므로 기초잔액 통화는 KRW여야 합니다.",
            { field: "currency" }
          ));
        }
      } else if (balanceKind === "VALUATION") {
        copyAssetIdentity(true);
        event.amount = readNumber(row, "amount", errors, { nonNegative: true });
        const currency = readCurrencyAndRate(row, errors, { rateAlias: "exchangeRate" });
        event.currency = currency.currency;
        event.fxRate = currency.fxRate;
      }
    } else if (type === "CANCEL") {
      event.targetEventId = readRequiredText(row, "targetEventId", errors, "취소 대상 이벤트 ID");
      if (event.targetEventId && event.targetEventId === eventId) {
        errors.push(issue("SELF_CANCELLATION", "취소 이벤트가 자기 자신을 취소할 수 없습니다.", {
          field: "targetEventId"
        }));
      }
      if (!reason) errors.push(issue("CANCELLATION_REASON_REQUIRED", "취소 이벤트에는 취소 사유가 필요합니다.", {
        field: "reason"
      }));
      if (!rawAuditDate) errors.push(issue("AUDIT_DATE_REQUIRED", "취소 이벤트에는 감사 처리일이 필요합니다.", {
        field: "auditDate"
      }));
      if (!createdAt) errors.push(issue("AUDIT_CREATED_AT_REQUIRED", "취소 이벤트에는 생성 시각이 필요합니다.", {
        field: "createdAt"
      }));
      if (correctsEventId) errors.push(issue("INVALID_CANCEL_CORRECTION", "취소 이벤트는 correctsEventId를 가질 수 없습니다."));
      event.auditDate = rawAuditDate ? auditDate : tradeDate;
    }

    if (!CASH_EVENT_TYPES.has(type) && type !== "OPENING_BALANCE" && row.cashAssetId) {
      warnings.push(warning("IGNORED_CASH_ASSET", `${type} 이벤트의 cashAssetId는 계산에 사용하지 않습니다.`, {
        field: "cashAssetId"
      }));
    }

    return {
      ok: errors.length === 0,
      event,
      errors: errors.map((item) => index === undefined ? item : { ...item, index, eventId }),
      warnings: warnings.map((item) => index === undefined ? item : { ...item, index, eventId })
    };
  }

  function sourceIdentity(event) {
    if (!event.sourceSystem || !event.sourceId) return "";
    return `${event.sourceSystem}\u0000${event.accountId}\u0000${event.sourceId}`;
  }

  function linkTarget(event) {
    if (event.type === "CANCEL") return event.targetEventId;
    return event.correctsEventId || "";
  }

  function resolveAuditLinks(events, errors, invalidIds) {
    const byId = new Map(events.map((event) => [event.eventId, event]));
    const candidates = [];
    events.forEach((event) => {
      const targetId = linkTarget(event);
      if (!targetId) return;
      const target = byId.get(targetId);
      if (!target) {
        errors.push(issue("MISSING_AUDIT_TARGET", `감사 연결 대상 ${targetId} 이벤트가 없습니다.`, {
          eventId: event.eventId,
          targetEventId: targetId
        }));
        invalidIds.add(event.eventId);
        return;
      }
      if (target.type === "CANCEL") {
        errors.push(issue("AUDIT_TARGET_IS_CANCEL", "취소 이벤트를 취소하거나 정정할 수 없습니다.", {
          eventId: event.eventId,
          targetEventId: targetId
        }));
        invalidIds.add(event.eventId);
        return;
      }
      if (event.accountId !== target.accountId) {
        errors.push(issue("AUDIT_ACCOUNT_MISMATCH", "취소·정정 이벤트는 원본과 같은 계좌여야 합니다.", {
          eventId: event.eventId,
          targetEventId: targetId
        }));
        invalidIds.add(event.eventId);
        return;
      }
      const auditDate = event.auditDate || event.tradeDate;
      if (auditDate < target.tradeDate) {
        errors.push(issue("AUDIT_BEFORE_TARGET", "취소·정정일은 원본 거래일보다 빠를 수 없습니다.", {
          eventId: event.eventId,
          targetEventId: targetId
        }));
        invalidIds.add(event.eventId);
        return;
      }
      if (event.type !== "CANCEL" && event.type !== target.type) {
        errors.push(issue("CORRECTION_TYPE_MISMATCH", "정정 이벤트 유형은 원본 이벤트 유형과 같아야 합니다.", {
          eventId: event.eventId,
          targetEventId: targetId
        }));
        invalidIds.add(event.eventId);
        return;
      }
      candidates.push({ event, target });
    });

    const byTarget = new Map();
    candidates.forEach((link) => {
      const list = byTarget.get(link.target.eventId) || [];
      list.push(link);
      byTarget.set(link.target.eventId, list);
    });
    byTarget.forEach((links, targetEventId) => {
      if (links.length <= 1) return;
      const eventIds = links.map((link) => link.event.eventId).sort(compareText);
      errors.push(issue(
        "MULTIPLE_AUDIT_ACTIONS",
        `이벤트 ${targetEventId}에 취소·정정이 여러 개 연결되어 있습니다: ${eventIds.join(", ")}.`,
        { targetEventId, eventIds }
      ));
      eventIds.forEach((eventId) => invalidIds.add(eventId));
    });

    const correctionTarget = new Map();
    candidates.forEach(({ event, target }) => {
      if (invalidIds.has(event.eventId) || event.type === "CANCEL") return;
      correctionTarget.set(event.eventId, target.eventId);
    });
    correctionTarget.forEach((_target, start) => {
      const path = [];
      const seen = new Map();
      let current = start;
      while (correctionTarget.has(current)) {
        if (seen.has(current)) {
          const cycle = path.slice(seen.get(current)).sort(compareText);
          errors.push(issue("CORRECTION_CYCLE", `정정 연결에 순환이 있습니다: ${cycle.join(", ")}.`, {
            eventIds: cycle
          }));
          cycle.forEach((eventId) => invalidIds.add(eventId));
          break;
        }
        seen.set(current, path.length);
        path.push(current);
        current = correctionTarget.get(current);
      }
    });

    return candidates.filter(({ event }) => !invalidIds.has(event.eventId));
  }

  function openingIdentity(event) {
    if (event.type !== "OPENING_BALANCE") return "";
    if (event.balanceKind === "CASH") return `CASH:${event.cashAssetId}:${event.currency}`;
    return `${event.balanceKind}:${event.assetId}`;
  }

  function isSingleCorrectionChain(events) {
    if (events.length < 2 || events.some((event) => event.type === "CANCEL")) return false;
    const ids = new Set(events.map((event) => event.eventId));
    const roots = events.filter((event) => !event.correctsEventId || !ids.has(event.correctsEventId));
    if (roots.length !== 1) return false;
    const childCounts = new Map();
    for (const event of events) {
      if (event === roots[0]) continue;
      if (!event.correctsEventId || !ids.has(event.correctsEventId)) return false;
      childCounts.set(event.correctsEventId, (childCounts.get(event.correctsEventId) || 0) + 1);
      if (childCounts.get(event.correctsEventId) > 1) return false;
    }
    let current = roots[0];
    const visited = new Set([current.eventId]);
    while (visited.size < events.length) {
      const child = events.find((event) => event.correctsEventId === current.eventId);
      if (!child || visited.has(child.eventId)) return false;
      visited.add(child.eventId);
      current = child;
    }
    return true;
  }

  function validateLedger(inputEvents, options = {}) {
    const topErrors = [];
    const topWarnings = [];
    const rawBaselineDate = normalizedText(options.baselineDate);
    const baselineDate = rawBaselineDate ? validDateKey(rawBaselineDate) : "";
    if (rawBaselineDate && !baselineDate) {
      topErrors.push(issue("INVALID_BASELINE_DATE", "원장 기준일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.", {
        field: "baselineDate"
      }));
    }
    if (!Array.isArray(inputEvents)) {
      return {
        ok: false,
        events: [],
        activeEvents: [],
        baselineDate,
        auditTrail: { cancellations: [], corrections: [], supersededEventIds: [] },
        errors: [...topErrors, issue("INVALID_LEDGER", "원장은 이벤트 배열이어야 합니다.")],
        warnings: []
      };
    }

    const normalizedRows = inputEvents.map((event, index) => normalizeLedgerEvent(event, { index }));
    normalizedRows.forEach((result) => {
      topErrors.push(...result.errors);
      topWarnings.push(...result.warnings);
    });
    const candidates = normalizedRows.filter((result) => result.ok).map((result) => result.event);
    const invalidIds = new Set();

    if (baselineDate) {
      candidates.forEach((event) => {
        if (event.type === "OPENING_BALANCE" || event.type === "CANCEL") return;
        if (event.tradeDate >= baselineDate) return;
        topErrors.push(issue(
          "EVENT_BEFORE_BASELINE",
          `이벤트 ${event.eventId}의 거래일이 원장 기준일 ${baselineDate}보다 빠릅니다.`,
          { eventId: event.eventId, tradeDate: event.tradeDate, baselineDate }
        ));
        invalidIds.add(event.eventId);
      });
    }

    const idGroups = new Map();
    candidates.forEach((event) => {
      const list = idGroups.get(event.eventId) || [];
      list.push(event);
      idGroups.set(event.eventId, list);
    });
    idGroups.forEach((events, eventId) => {
      if (events.length <= 1) return;
      topErrors.push(issue("DUPLICATE_EVENT_ID", `이벤트 ID ${eventId}가 ${events.length}번 중복되었습니다.`, { eventId }));
      invalidIds.add(eventId);
    });

    const sourceGroups = new Map();
    candidates.forEach((event) => {
      if (invalidIds.has(event.eventId)) return;
      const key = sourceIdentity(event);
      if (!key) return;
      const list = sourceGroups.get(key) || [];
      list.push(event);
      sourceGroups.set(key, list);
    });
    sourceGroups.forEach((events) => {
      if (events.length <= 1) return;
      if (isSingleCorrectionChain(events)) return;
      const eventIds = events.map((event) => event.eventId).sort(compareText);
      const sample = events[0];
      topErrors.push(issue(
        "DUPLICATE_SOURCE_ID",
        `원본 거래 ${sample.sourceSystem}/${sample.sourceId}가 같은 계좌에서 중복되었습니다.`,
        { sourceSystem: sample.sourceSystem, sourceId: sample.sourceId, accountId: sample.accountId, eventIds }
      ));
      eventIds.forEach((eventId) => invalidIds.add(eventId));
    });

    const structurallyUnique = candidates.filter((event) => !invalidIds.has(event.eventId));
    const links = resolveAuditLinks(structurallyUnique, topErrors, invalidIds);
    let accepted = structurallyUnique.filter((event) => !invalidIds.has(event.eventId));
    let acceptedLinks = links.filter(({ event }) => !invalidIds.has(event.eventId));
    let supersededIds = new Set(acceptedLinks.map(({ target }) => target.eventId));
    let activeEvents = accepted.filter((event) => event.type !== "CANCEL" && !supersededIds.has(event.eventId));

    const openingGroups = new Map();
    activeEvents.forEach((event) => {
      const key = openingIdentity(event);
      if (!key) return;
      const list = openingGroups.get(key) || [];
      list.push(event);
      openingGroups.set(key, list);
    });
    openingGroups.forEach((events, key) => {
      if (events.length <= 1) return;
      const eventIds = events.map((event) => event.eventId).sort(compareText);
      topErrors.push(issue(
        "DUPLICATE_OPENING_BALANCE",
        `같은 잔액에 활성 기초잔액이 여러 개 있습니다: ${key}.`,
        { openingKey: key, eventIds }
      ));
      eventIds.forEach((eventId) => invalidIds.add(eventId));
    });

    activeEvents.forEach((opening) => {
      if (opening.type !== "OPENING_BALANCE" || invalidIds.has(opening.eventId)) return;
      const relevant = activeEvents.filter((event) => {
        if (event.eventId === opening.eventId || event.type === "OPENING_BALANCE") return false;
        if (opening.balanceKind === "POSITION") {
          return event.assetId === opening.assetId && ["BUY", "SELL", "SPLIT"].includes(event.type);
        }
        if (opening.balanceKind === "VALUATION") {
          return event.assetId === opening.assetId && event.type === "VALUATION";
        }
        if (opening.balanceKind === "CASH") {
          return event.cashAssetId === opening.cashAssetId || event.counterCashAssetId === opening.cashAssetId;
        }
        return false;
      });
      relevant.forEach((event) => {
        if (eventSort(event, opening) >= 0) return;
        topErrors.push(issue(
          "EVENT_BEFORE_OPENING_BALANCE",
          `이벤트 ${event.eventId}가 ${opening.eventId} 기초잔액보다 먼저 발생해 기준잔액과 충돌합니다.`,
          { eventId: event.eventId, openingEventId: opening.eventId }
        ));
        invalidIds.add(event.eventId);
      });
    });

    accepted = accepted.filter((event) => !invalidIds.has(event.eventId)).sort(eventSort);
    acceptedLinks = acceptedLinks.filter(({ event }) => !invalidIds.has(event.eventId));
    supersededIds = new Set(acceptedLinks.map(({ target }) => target.eventId));
    activeEvents = accepted
      .filter((event) => event.type !== "CANCEL" && !supersededIds.has(event.eventId))
      .sort(eventSort);

    const cancellations = acceptedLinks
      .filter(({ event }) => event.type === "CANCEL")
      .map(({ event, target }) => ({
        eventId: event.eventId,
        targetEventId: target.eventId,
        tradeDate: event.tradeDate,
        auditDate: event.auditDate || event.tradeDate,
        reason: event.reason
      }))
      .sort((left, right) => compareText(left.auditDate, right.auditDate) || compareText(left.eventId, right.eventId));
    const corrections = acceptedLinks
      .filter(({ event }) => event.type !== "CANCEL")
      .map(({ event, target }) => ({
        eventId: event.eventId,
        targetEventId: target.eventId,
        tradeDate: event.tradeDate,
        auditDate: event.auditDate || event.tradeDate,
        reason: event.reason
      }))
      .sort((left, right) => compareText(left.auditDate, right.auditDate) || compareText(left.eventId, right.eventId));

    return {
      ok: topErrors.length === 0,
      baselineDate,
      events: accepted,
      activeEvents,
      auditTrail: {
        cancellations,
        corrections,
        supersededEventIds: [...supersededIds].sort(compareText)
      },
      errors: topErrors.sort((left, right) => compareText(left.eventId, right.eventId) || compareText(left.code, right.code)),
      warnings: topWarnings.sort((left, right) => compareText(left.eventId, right.eventId) || compareText(left.code, right.code))
    };
  }

  function resolveActiveAsOf(validated, asOfDate) {
    const eligible = validated.events.filter((event) => {
      if (!asOfDate) return true;
      if (event.type === "CANCEL" || event.correctsEventId) {
        return (event.auditDate || event.tradeDate) <= asOfDate;
      }
      return event.tradeDate <= asOfDate;
    });
    const superseded = new Set();
    eligible.forEach((event) => {
      const target = linkTarget(event);
      if (target) superseded.add(target);
    });
    return eligible.filter((event) => event.type !== "CANCEL" && !superseded.has(event.eventId)).sort(eventSort);
  }

  function projectLedger(inputEvents, options = {}) {
    const validated = validateLedger(inputEvents, { baselineDate: options.baselineDate });
    const diagnostics = [...validated.errors, ...validated.warnings];
    const rawAsOfDate = normalizedText(options.asOfDate);
    const asOfDate = rawAsOfDate ? validDateKey(rawAsOfDate) : "";
    if (rawAsOfDate && !asOfDate) {
      diagnostics.push(issue("INVALID_AS_OF_DATE", "기준일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.", {
        field: "asOfDate"
      }));
    }

    const positions = new Map();
    const cash = new Map();
    const valuations = new Map();
    const activeEvents = resolveActiveAsOf(validated, asOfDate || "");
    const postings = [];
    const summary = {
      externalCashFlowKRW: 0,
      depositsKRW: 0,
      withdrawalsKRW: 0,
      dividendsKRW: 0,
      interestKRW: 0,
      feesKRW: 0,
      taxesKRW: 0,
      realizedPnlKRW: 0,
      knownRealizedPnlKRW: 0,
      unknownRealizedPnlCount: 0,
      fxDifferenceKRW: 0
    };
    let openingCashTotalKRW = 0;
    let cashMovementTotalKRW = 0;

    function addPositionPosting(event) {
      postings.push({ date: event.tradeDate, sequence: event.sequence, eventId: event.eventId, leg: "POSITION", event });
    }

    function addCashPosting(event) {
      postings.push({ date: event.settlementDate, sequence: event.sequence, eventId: event.eventId, leg: "CASH", event });
    }

    activeEvents.forEach((event) => {
      if (["BUY", "SELL"].includes(event.type)) {
        addPositionPosting(event);
        addCashPosting(event);
      } else if (event.type === "SPLIT" || event.type === "VALUATION") {
        addPositionPosting(event);
      } else if (CASH_EVENT_TYPES.has(event.type)) {
        addCashPosting(event);
      } else if (event.type === "OPENING_BALANCE") {
        if (event.balanceKind === "CASH") addCashPosting(event);
        else addPositionPosting(event);
      }
    });

    const includedPostings = postings
      .filter((posting) => !asOfDate || posting.date <= asOfDate)
      .sort(postingSort);

    function positionFor(event) {
      const key = event.assetId;
      const current = positions.get(key) || {
        assetId: key,
        accountId: event.accountId,
        instrumentKey: event.instrumentKey || "",
        currency: event.currency || "",
        quantity: 0,
        costBasisNative: 0,
        averageCostNative: 0,
        costBasisKRW: 0,
        averageCostKRW: 0,
        costBasisKRWKnown: true,
        realizedPricePnlNative: 0,
        realizedPnlKRW: 0,
        realizedPnlKRWKnown: true,
        lastEventDate: ""
      };
      if (current.accountId !== event.accountId) {
        diagnostics.push(issue(
          "ASSET_ACCOUNT_MISMATCH",
          `자산 ${key}가 여러 계좌 ID에 연결되어 있습니다.`,
          { eventId: event.eventId, assetId: key }
        ));
      }
      if (current.instrumentKey && event.instrumentKey && current.instrumentKey !== event.instrumentKey) {
        diagnostics.push(issue(
          "ASSET_INSTRUMENT_MISMATCH",
          `자산 ${key}가 여러 종목 식별자에 연결되어 있습니다.`,
          { eventId: event.eventId, assetId: key }
        ));
      }
      if (!current.instrumentKey && event.instrumentKey) current.instrumentKey = event.instrumentKey;
      if (current.currency && event.currency && current.currency !== event.currency) {
        diagnostics.push(issue(
          "POSITION_CURRENCY_MISMATCH",
          `자산 ${key}가 여러 거래 통화에 연결되어 있습니다.`,
          { eventId: event.eventId, assetId: key, expectedCurrency: current.currency, currency: event.currency }
        ));
      }
      if (!current.currency && event.currency) current.currency = event.currency;
      positions.set(key, current);
      return current;
    }

    function cashFor(cashAssetId, cashAccountId, eventId) {
      const key = cashAssetId;
      const current = cash.get(key) || {
        key,
        cashAssetId,
        cashAccountId,
        currency: "KRW",
        amountKRW: 0,
        lastEventDate: ""
      };
      if (current.cashAccountId !== cashAccountId) {
        diagnostics.push(issue(
          "CASH_ACCOUNT_MISMATCH",
          `CASH 자산 ${cashAssetId}가 여러 계좌 ID에 연결되어 있습니다.`,
          { eventId, cashAssetId, expectedCashAccountId: current.cashAccountId, cashAccountId }
        ));
      }
      cash.set(key, current);
      return current;
    }

    function postCash(event, cashAssetId, cashAccountId, amountKRW) {
      const current = cashFor(cashAssetId, cashAccountId, event.eventId);
      current.amountKRW = round(current.amountKRW + amountKRW, 4);
      current.lastEventDate = event.settlementDate;
      if (current.amountKRW < -EPSILON) {
        diagnostics.push(issue(
          "NEGATIVE_CASH_BALANCE_AT_EVENT",
          `CASH 자산 ${cashAssetId}의 ${event.settlementDate} 반영 직후 잔액이 음수입니다.`,
          {
            eventId: event.eventId,
            date: event.settlementDate,
            cashAssetId,
            currency: "KRW",
            amountKRW: current.amountKRW
          }
        ));
      }
      if (event.type === "OPENING_BALANCE") openingCashTotalKRW = round(openingCashTotalKRW + amountKRW, 4);
      else cashMovementTotalKRW = round(cashMovementTotalKRW + amountKRW, 4);
    }

    includedPostings.forEach(({ event, leg }) => {
      if (leg === "POSITION") {
        if (event.type === "OPENING_BALANCE") {
          if (event.balanceKind === "POSITION") {
            const position = positionFor(event);
            position.quantity = round(event.quantity, 12);
            position.costBasisNative = round(event.quantity * event.unitCost, 8);
            position.averageCostNative = position.quantity > EPSILON ? round(event.unitCost, 8) : 0;
            position.costBasisKRWKnown = event.fxRateKnown;
            position.costBasisKRW = event.fxRateKnown
              ? round(position.costBasisNative * event.fxRate, 4)
              : null;
            position.averageCostKRW = event.fxRateKnown && position.quantity > EPSILON
              ? round(position.costBasisKRW / position.quantity, 8)
              : null;
            position.lastEventDate = event.tradeDate;
            if (!event.fxRateKnown) {
              diagnostics.push(warning(
                "UNKNOWN_OPENING_FX_RATE",
                `자산 ${event.assetId}의 기초잔액 당시 환율이 없어 원화 원가와 실현손익을 계산하지 않습니다.`,
                { eventId: event.eventId, assetId: event.assetId, currency: event.currency }
              ));
            }
          } else if (event.balanceKind === "VALUATION") {
            valuations.set(event.assetId, {
              assetId: event.assetId,
              accountId: event.accountId,
              amount: event.amount,
              currency: event.currency,
              valueKRW: round(event.amount * event.fxRate, 4),
              eventId: event.eventId,
              date: event.tradeDate,
              openingBalance: true
            });
          }
        } else if (event.type === "BUY") {
          const position = positionFor(event);
          const acquisitionCostKRW = event.grossAmountKRW + event.feeKRW + event.taxKRW;
          if (Math.abs(position.quantity) <= EPSILON && Math.abs(position.costBasisNative) <= EPSILON) {
            position.costBasisKRWKnown = true;
            position.costBasisKRW = 0;
            position.averageCostKRW = 0;
          }
          position.quantity = round(position.quantity + event.quantity, 12);
          position.costBasisNative = round(position.costBasisNative + event.grossAmount, 8);
          position.averageCostNative = position.quantity > EPSILON
            ? round(position.costBasisNative / position.quantity, 8)
            : 0;
          if (position.costBasisKRWKnown) {
            position.costBasisKRW = round(position.costBasisKRW + acquisitionCostKRW, 4);
            position.averageCostKRW = position.quantity > EPSILON
              ? round(position.costBasisKRW / position.quantity, 8)
              : 0;
          } else {
            position.costBasisKRW = null;
            position.averageCostKRW = null;
          }
          position.lastEventDate = event.tradeDate;
        } else if (event.type === "SELL") {
          const position = positionFor(event);
          const priorQuantity = position.quantity;
          const averageCostNative = priorQuantity > EPSILON ? position.costBasisNative / priorQuantity : 0;
          const releasedCostNative = averageCostNative * event.quantity;
          const realizedPriceNative = event.grossAmount - releasedCostNative;
          const netProceedsKRW = event.grossAmountKRW - event.feeKRW - event.taxKRW;
          const averageCostKRW = position.costBasisKRWKnown && priorQuantity > EPSILON
            ? position.costBasisKRW / priorQuantity
            : null;
          const releasedCostKRW = averageCostKRW === null ? null : averageCostKRW * event.quantity;
          const realizedKRW = releasedCostKRW === null ? null : netProceedsKRW - releasedCostKRW;
          position.quantity = round(priorQuantity - event.quantity, 12);
          position.costBasisNative = round(position.costBasisNative - releasedCostNative, 8);
          position.realizedPricePnlNative = round(position.realizedPricePnlNative + realizedPriceNative, 8);
          position.averageCostNative = position.quantity > EPSILON
            ? round(position.costBasisNative / position.quantity, 8)
            : 0;
          if (realizedKRW === null) {
            position.costBasisKRW = null;
            position.averageCostKRW = null;
            position.realizedPnlKRW = null;
            position.realizedPnlKRWKnown = false;
            summary.unknownRealizedPnlCount += 1;
            diagnostics.push(warning(
              "UNKNOWN_REALIZED_PNL_KRW",
              `자산 ${event.assetId}의 기초잔액 당시 환율이 없어 이 매도의 원화 실현손익을 계산하지 않습니다.`,
              { eventId: event.eventId, assetId: event.assetId }
            ));
          } else {
            position.costBasisKRW = round(position.costBasisKRW - releasedCostKRW, 4);
            position.averageCostKRW = position.quantity > EPSILON
              ? round(position.costBasisKRW / position.quantity, 8)
              : 0;
            position.realizedPnlKRW = round((position.realizedPnlKRW || 0) + realizedKRW, 4);
            summary.knownRealizedPnlKRW = round(summary.knownRealizedPnlKRW + realizedKRW, 4);
          }
          position.lastEventDate = event.tradeDate;
          if (priorQuantity + EPSILON < event.quantity) {
            diagnostics.push(issue(
              "NEGATIVE_POSITION",
              `자산 ${event.assetId}의 매도 수량이 원장상 보유 수량을 초과합니다.`,
              { eventId: event.eventId, assetId: event.assetId, availableQuantity: round(priorQuantity, 12) }
            ));
          }
        } else if (event.type === "SPLIT") {
          const position = positionFor(event);
          if (Math.abs(position.quantity) <= EPSILON) {
            diagnostics.push(warning(
              "SPLIT_WITHOUT_POSITION",
              `자산 ${event.assetId}의 보유 수량이 0인 상태에서 분할 이벤트가 적용되었습니다.`,
              { eventId: event.eventId, assetId: event.assetId }
            ));
          }
          position.quantity = round(position.quantity * event.numerator / event.denominator, 12);
          position.averageCostNative = position.quantity > EPSILON
            ? round(position.costBasisNative / position.quantity, 8)
            : 0;
          position.averageCostKRW = position.costBasisKRWKnown && position.quantity > EPSILON
            ? round(position.costBasisKRW / position.quantity, 8)
            : position.costBasisKRWKnown ? 0 : null;
          position.lastEventDate = event.tradeDate;
        } else if (event.type === "VALUATION") {
          valuations.set(event.assetId, {
            assetId: event.assetId,
            accountId: event.accountId,
            amount: event.amount,
            currency: event.currency,
            valueKRW: round(event.amount * event.fxRate, 4),
            eventId: event.eventId,
            date: event.tradeDate,
            openingBalance: false
          });
        }
        return;
      }

      if (event.type === "OPENING_BALANCE") {
        postCash(event, event.cashAssetId, event.cashAccountId, event.amount);
      } else if (event.type === "BUY") {
        postCash(
          event,
          event.cashAssetId,
          event.cashAccountId,
          -(event.grossAmountKRW + event.feeKRW + event.taxKRW)
        );
        summary.feesKRW = round(summary.feesKRW + event.feeKRW, 4);
        summary.taxesKRW = round(summary.taxesKRW + event.taxKRW, 4);
      } else if (event.type === "SELL") {
        postCash(
          event,
          event.cashAssetId,
          event.cashAccountId,
          event.grossAmountKRW - event.feeKRW - event.taxKRW
        );
        summary.feesKRW = round(summary.feesKRW + event.feeKRW, 4);
        summary.taxesKRW = round(summary.taxesKRW + event.taxKRW, 4);
      } else if (event.type === "DEPOSIT") {
        postCash(event, event.cashAssetId, event.cashAccountId, event.amountKRW);
        summary.depositsKRW = round(summary.depositsKRW + event.amountKRW, 4);
        summary.externalCashFlowKRW = round(summary.externalCashFlowKRW + event.amountKRW, 4);
      } else if (event.type === "WITHDRAWAL") {
        postCash(event, event.cashAssetId, event.cashAccountId, -event.amountKRW);
        summary.withdrawalsKRW = round(summary.withdrawalsKRW + event.amountKRW, 4);
        summary.externalCashFlowKRW = round(summary.externalCashFlowKRW - event.amountKRW, 4);
      } else if (event.type === "DIVIDEND") {
        postCash(event, event.cashAssetId, event.cashAccountId, event.amountKRW);
        summary.dividendsKRW = round(summary.dividendsKRW + event.amountKRW, 4);
      } else if (event.type === "INTEREST") {
        postCash(event, event.cashAssetId, event.cashAccountId, event.amountKRW);
        summary.interestKRW = round(summary.interestKRW + event.amountKRW, 4);
      } else if (event.type === "FEE") {
        postCash(event, event.cashAssetId, event.cashAccountId, -event.amountKRW);
        summary.feesKRW = round(summary.feesKRW + event.amountKRW, 4);
      } else if (event.type === "TAX") {
        postCash(event, event.cashAssetId, event.cashAccountId, -event.amountKRW);
        summary.taxesKRW = round(summary.taxesKRW + event.amountKRW, 4);
      } else if (event.type === "FX") {
        postCash(event, event.cashAssetId, event.cashAccountId, -(event.amountKRW + event.feeKRW));
        postCash(event, event.counterCashAssetId, event.counterCashAccountId, event.counterAmountKRW);
        summary.feesKRW = round(summary.feesKRW + event.feeKRW, 4);
        summary.fxDifferenceKRW = round(
          summary.fxDifferenceKRW
            + event.counterAmountKRW
            - event.amountKRW,
          4
        );
      }
    });

    const projectedPositions = [...positions.values()]
      .map((position) => ({
        ...position,
        quantity: round(position.quantity, 12),
        costBasisNative: round(position.costBasisNative, 8),
        averageCostNative: round(position.averageCostNative, 8),
        costBasisKRW: position.costBasisKRWKnown ? round(position.costBasisKRW, 4) : null,
        averageCostKRW: position.costBasisKRWKnown ? round(position.averageCostKRW, 8) : null,
        realizedPricePnlNative: round(position.realizedPricePnlNative, 8),
        realizedPnlKRW: position.realizedPnlKRWKnown ? round(position.realizedPnlKRW, 4) : null
      }))
      .sort((left, right) => compareText(left.accountId, right.accountId) || compareText(left.assetId, right.assetId));
    const projectedCash = [...cash.values()]
      .map((balance) => ({
        ...balance,
        amountKRW: round(balance.amountKRW, 4)
      }))
      .sort((left, right) => compareText(left.cashAccountId, right.cashAccountId)
        || compareText(left.cashAssetId, right.cashAssetId)
        || compareText(left.currency, right.currency));
    const projectedValuations = [...valuations.values()]
      .sort((left, right) => compareText(left.accountId, right.accountId) || compareText(left.assetId, right.assetId));

    let checkedPositionCount = 0;
    let checkedCashCount = 0;
    let mismatchCount = 0;
    const expectedPositions = options.expectedPositions;
    if (expectedPositions !== undefined && !Array.isArray(expectedPositions)) {
      diagnostics.push(issue("INVALID_EXPECTED_POSITIONS", "대조할 포지션은 배열이어야 합니다."));
    } else if (Array.isArray(expectedPositions)) {
      const seen = new Set();
      const actualById = new Map(projectedPositions.map((position) => [position.assetId, position]));
      expectedPositions.forEach((expected, index) => {
        const assetId = normalizedText(expected?.assetId);
        const quantity = Number(expected?.quantity);
        const averageCostNative = expected?.averageCostNative === undefined
          ? undefined
          : Number(expected.averageCostNative);
        if (!assetId || !Number.isFinite(quantity) || quantity < 0
          || (averageCostNative !== undefined && (!Number.isFinite(averageCostNative) || averageCostNative < 0))) {
          diagnostics.push(issue(
            "INVALID_EXPECTED_POSITION",
            `대조 포지션 ${index + 1}의 자산 ID·수량·평균단가가 올바르지 않습니다.`,
            { index }
          ));
          return;
        }
        if (seen.has(assetId)) {
          diagnostics.push(issue("DUPLICATE_EXPECTED_POSITION", `대조 포지션에 자산 ${assetId}가 중복되었습니다.`, {
            assetId
          }));
          return;
        }
        seen.add(assetId);
        checkedPositionCount += 1;
        const actual = actualById.get(assetId);
        const actualQuantity = actual?.quantity || 0;
        if (Math.abs(actualQuantity - quantity) > 1e-8) {
          mismatchCount += 1;
          diagnostics.push(issue(
            "POSITION_QUANTITY_MISMATCH",
            `자산 ${assetId}의 저장 수량 ${quantity}과 원장 계산 수량 ${actualQuantity}이 일치하지 않습니다.`,
            { assetId, expectedQuantity: quantity, projectedQuantity: actualQuantity }
          ));
        }
        if (averageCostNative !== undefined) {
          const actualAverage = actual?.averageCostNative || 0;
          if (Math.abs(actualAverage - averageCostNative) > 1e-6) {
            mismatchCount += 1;
            diagnostics.push(issue(
              "POSITION_AVERAGE_COST_MISMATCH",
              `자산 ${assetId}의 저장 평균단가와 원장 계산 평균단가가 일치하지 않습니다.`,
              { assetId, expectedAverageCostNative: averageCostNative, projectedAverageCostNative: actualAverage }
            ));
          }
        }
      });
    }

    const expectedCashBalances = options.expectedCashBalances;
    if (expectedCashBalances !== undefined && !Array.isArray(expectedCashBalances)) {
      diagnostics.push(issue("INVALID_EXPECTED_CASH", "대조할 CASH 잔액은 배열이어야 합니다."));
    } else if (Array.isArray(expectedCashBalances)) {
      const seen = new Set();
      const actualById = new Map(projectedCash.map((balance) => [balance.cashAssetId, balance]));
      expectedCashBalances.forEach((expected, index) => {
        const cashAssetId = normalizedText(expected?.cashAssetId);
        const amountKRW = Number(expected?.amountKRW);
        if (!cashAssetId || !Number.isFinite(amountKRW)) {
          diagnostics.push(issue(
            "INVALID_EXPECTED_CASH_BALANCE",
            `대조 CASH ${index + 1}의 자산 ID·원화 잔액이 올바르지 않습니다.`,
            { index }
          ));
          return;
        }
        if (seen.has(cashAssetId)) {
          diagnostics.push(issue("DUPLICATE_EXPECTED_CASH", `대조 CASH에 자산 ${cashAssetId}가 중복되었습니다.`, {
            cashAssetId
          }));
          return;
        }
        seen.add(cashAssetId);
        checkedCashCount += 1;
        const actualAmount = actualById.get(cashAssetId)?.amountKRW || 0;
        if (Math.abs(actualAmount - amountKRW) > 0.01) {
          mismatchCount += 1;
          diagnostics.push(issue(
            "CASH_BALANCE_MISMATCH",
            `CASH 자산 ${cashAssetId}의 저장 잔액과 원장 계산 잔액이 일치하지 않습니다.`,
            { cashAssetId, expectedAmountKRW: amountKRW, projectedAmountKRW: actualAmount }
          ));
        }
      });
    }

    projectedPositions.forEach((position) => {
      if (position.quantity < -EPSILON) {
        diagnostics.push(issue("NEGATIVE_POSITION_BALANCE", `자산 ${position.assetId}의 최종 수량이 음수입니다.`, {
          assetId: position.assetId,
          quantity: position.quantity
        }));
      }
      if (position.costBasisKRWKnown && position.costBasisKRW < -EPSILON) {
        diagnostics.push(issue("NEGATIVE_COST_BASIS", `자산 ${position.assetId}의 원가가 음수입니다.`, {
          assetId: position.assetId,
          costBasisKRW: position.costBasisKRW
        }));
      }
    });
    projectedCash.forEach((balance) => {
      if (balance.amountKRW < -EPSILON) {
        diagnostics.push(issue(
          "NEGATIVE_CASH_BALANCE",
          `CASH 자산 ${balance.cashAssetId}의 ${balance.currency} 잔액이 음수입니다.`,
          { cashAssetId: balance.cashAssetId, currency: "KRW", amountKRW: balance.amountKRW }
        ));
      }
    });

    summary.realizedPnlKRW = summary.unknownRealizedPnlCount > 0
      ? null
      : summary.knownRealizedPnlKRW;

    const errors = diagnostics.filter((item) => item.severity === "error");
    const warnings = diagnostics.filter((item) => item.severity === "warning");
    return {
      ok: errors.length === 0,
      baselineDate: validated.baselineDate,
      asOfDate,
      positions: projectedPositions,
      cashBalances: projectedCash,
      valuations: projectedValuations,
      summary,
      reconciliation: {
        activeEventCount: activeEvents.length,
        appliedPostingCount: includedPostings.length,
        positionCount: projectedPositions.length,
        cashBalanceCount: projectedCash.length,
        openingCashTotalKRW,
        cashMovementTotalKRW,
        endingCashTotalKRW: round(projectedCash.reduce((sum, balance) => sum + balance.amountKRW, 0), 4),
        cashEquationDifferenceKRW: round(
          projectedCash.reduce((sum, balance) => sum + balance.amountKRW, 0)
            - openingCashTotalKRW
            - cashMovementTotalKRW,
          4
        ),
        checkedPositionCount,
        checkedCashCount,
        mismatchCount,
        balanced: errors.length === 0
      },
      auditTrail: validated.auditTrail,
      errors,
      warnings
    };
  }

  function createOpeningBalanceEvent(asset, options = {}) {
    const row = asset && typeof asset === "object" && !Array.isArray(asset) ? asset : {};
    const type = normalizedUpper(row.type);
    const eventId = normalizedText(options.eventId);
    const openingDate = normalizedText(options.openingDate);
    const assetId = normalizedText(row.id ?? row.assetId);
    const explicitAccountId = normalizedText(options.accountId ?? row.accountId);
    const accountId = explicitAccountId || `UNASSIGNED:${assetId || "ASSET"}`;
    const base = {
      eventId,
      type: "OPENING_BALANCE",
      accountId,
      tradeDate: openingDate,
      settlementDate: openingDate,
      sequence: options.sequence ?? 0,
      note: normalizedText(options.note) || "기존 보유 자산의 명시적 기초잔액"
    };
    if (options.sourceSystem || options.sourceId) {
      base.sourceSystem = options.sourceSystem;
      base.sourceId = options.sourceId;
    }
    if (type === "KRX" || type === "US") {
      const result = normalizeLedgerEvent({
        ...base,
        balanceKind: "POSITION",
        assetId,
        instrumentKey: options.instrumentKey ?? row.instrumentKey,
        quantity: row.quantity,
        unitCost: row.averagePrice ?? row.unitCost ?? 0,
        currency: options.currency ?? (type === "US" ? "USD" : "KRW"),
        fxRate: options.fxRate ?? options.exchangeRate ?? (type === "KRX" ? 1 : undefined)
      });
      if (!explicitAccountId) result.warnings.push(warning(
        "UNASSIGNED_ACCOUNT_ID",
        `자산 ${assetId || "(ID 없음)"}에 안정적인 계좌 ID가 없어 결정적 임시 ID를 사용했습니다.`,
        { assetId, accountId }
      ));
      return result;
    }
    if (type === "CASH") {
      const result = normalizeLedgerEvent({
        ...base,
        balanceKind: "CASH",
        cashAssetId: assetId,
        cashAccountId: accountId,
        amount: row.amount,
        currency: options.currency ?? "KRW",
        fxRate: options.fxRate ?? options.exchangeRate ?? 1
      });
      if (!explicitAccountId) result.warnings.push(warning(
        "UNASSIGNED_ACCOUNT_ID",
        `CASH 자산 ${assetId || "(ID 없음)"}에 안정적인 계좌 ID가 없어 결정적 임시 ID를 사용했습니다.`,
        { assetId, accountId }
      ));
      return result;
    }
    if (type === "MANUAL") {
      const result = normalizeLedgerEvent({
        ...base,
        balanceKind: "VALUATION",
        assetId,
        amount: row.amount,
        currency: options.currency ?? "KRW",
        fxRate: options.fxRate ?? options.exchangeRate ?? 1
      });
      if (!explicitAccountId) result.warnings.push(warning(
        "UNASSIGNED_ACCOUNT_ID",
        `수동 자산 ${assetId || "(ID 없음)"}에 안정적인 계좌 ID가 없어 결정적 임시 ID를 사용했습니다.`,
        { assetId, accountId }
      ));
      return result;
    }
    return {
      ok: false,
      event: base,
      errors: [issue("UNSUPPORTED_OPENING_ASSET", "기초잔액은 KRX, US, CASH, MANUAL 자산만 변환할 수 있습니다.")],
      warnings: []
    };
  }

  return Object.freeze({
    TRANSACTION_EVENT_TYPES,
    INTERNAL_EVENT_TYPES,
    normalizeLedgerEvent,
    validateLedger,
    projectLedger,
    createOpeningBalanceEvent
  });
});
