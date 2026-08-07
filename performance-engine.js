(function attachAssetTrailPerformanceEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailPerformanceEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPerformanceEngine() {
  "use strict";

  const AVAILABILITY = Object.freeze({
    VERIFIED: "VERIFIED",
    LIMITED: "LIMITED",
    UNAVAILABLE: "UNAVAILABLE"
  });
  const AVAILABILITY_RANK = Object.freeze({ VERIFIED: 0, LIMITED: 1, UNAVAILABLE: 2 });
  const FLOW_POLICY = "END_OF_DAY_POST_FLOW";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_MAX_GAP_DAYS = 4;
  const DEFAULT_ANNUALIZATION_FACTOR = 252;
  const DEFAULT_XIRR_MAX_ITERATIONS = 200;
  const XIRR_GRID_SIZE = 2048;
  const XIRR_MIN_RATE = -0.999999999;
  const XIRR_MAX_RATE = 1_000_000;
  const ROOT_SCALED_TOLERANCE = 1e-13;
  const ROOT_X_TOLERANCE = 1e-13;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizedText(value) {
    return String(value ?? "").trim();
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function validDateKey(value) {
    const key = normalizedText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function utcDayNumber(dateKey) {
    const key = validDateKey(dateKey);
    return key ? Date.parse(`${key}T00:00:00.000Z`) / DAY_MS : Number.NaN;
  }

  function daysBetween(startDate, endDate) {
    const start = utcDayNumber(startDate);
    const end = utcDayNumber(endDate);
    return Number.isFinite(start) && Number.isFinite(end) ? end - start : Number.NaN;
  }

  function finiteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function canonicalZero(value) {
    return Object.is(value, -0) || Math.abs(value) < Number.EPSILON ? 0 : value;
  }

  function diagnostic(code, severity, message, details = {}) {
    return { code, severity, message, ...details };
  }

  function error(code, message, details = {}) {
    return diagnostic(code, "error", message, details);
  }

  function warning(code, message, details = {}) {
    return diagnostic(code, "warning", message, details);
  }

  function compareDiagnostics(left, right) {
    return compareText(left.date, right.date)
      || compareText(left.code, right.code)
      || compareText(left.message, right.message);
  }

  function dedupeDiagnostics(items) {
    const seen = new Set();
    return (items || [])
      .filter(Boolean)
      .filter((item) => {
        const key = JSON.stringify([
          item.code,
          item.severity,
          item.date || "",
          item.index ?? "",
          item.message
        ]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(compareDiagnostics);
  }

  function availabilityFromDiagnostics(items, fallback = AVAILABILITY.VERIFIED) {
    if ((items || []).some((item) => item.severity === "error")) return AVAILABILITY.UNAVAILABLE;
    if ((items || []).some((item) => item.severity === "warning")) return AVAILABILITY.LIMITED;
    return fallback;
  }

  function worstAvailability(...values) {
    return values
      .filter((value) => Object.hasOwn(AVAILABILITY_RANK, value))
      .sort((left, right) => AVAILABILITY_RANK[right] - AVAILABILITY_RANK[left])[0]
      || AVAILABILITY.VERIFIED;
  }

  function completenessStatus(value) {
    if (value === true) return "COMPLETE";
    if (value === false) return "INCOMPLETE";
    const normalized = normalizedText(value).toUpperCase();
    if (["COMPLETE", "VERIFIED"].includes(normalized)) return "COMPLETE";
    if (normalized === "INCOMPLETE") return "INCOMPLETE";
    if (normalized === "UNKNOWN") return "UNKNOWN";
    if (!isPlainObject(value)) return "UNKNOWN";
    if (value.complete === true || value.verified === true) return "COMPLETE";
    if (value.complete === false || value.verified === false) return "INCOMPLETE";
    const flags = Object.entries(value)
      .filter(([key, flag]) => !["missing", "issues", "reason"].includes(key) && typeof flag === "boolean")
      .map(([, flag]) => flag);
    if (flags.length && flags.every(Boolean)) return "COMPLETE";
    if (flags.some((flag) => flag === false)) return "INCOMPLETE";
    if (Array.isArray(value.missing) && value.missing.length) return "INCOMPLETE";
    if (Array.isArray(value.issues) && value.issues.length) return "INCOMPLETE";
    return "UNKNOWN";
  }

  function firstDefined(source, fields) {
    for (const field of fields) {
      if (Object.hasOwn(source, field) && source[field] !== undefined && source[field] !== null) {
        return source[field];
      }
    }
    return undefined;
  }

  const ATTRIBUTION_ALIASES = Object.freeze({
    priceEffectKRW: ["priceEffectKRW", "priceKRW"],
    fxEffectKRW: ["fxEffectKRW", "fxKRW"],
    dividendKRW: ["dividendKRW", "dividendsKRW"],
    interestKRW: ["interestKRW"],
    feeKRW: ["feeKRW", "feesKRW"],
    taxKRW: ["taxKRW", "taxesKRW"],
    manualValuationEffectKRW: ["manualValuationEffectKRW", "manualValuationKRW"],
    otherEffectKRW: ["otherEffectKRW", "otherKRW"]
  });

  function normalizeAttribution(value, diagnostics, context = {}) {
    if (value === undefined || value === null) return null;
    if (!isPlainObject(value)) {
      diagnostics.push(error(
        "INVALID_ATTRIBUTION",
        "성과 원인 분해 값은 객체여야 합니다.",
        context
      ));
      return null;
    }
    const result = {};
    Object.entries(ATTRIBUTION_ALIASES).forEach(([canonical, aliases]) => {
      const raw = firstDefined(value, aliases);
      if (raw === undefined) return;
      const numeric = finiteNumber(raw);
      if (numeric === null) {
        diagnostics.push(error(
          "INVALID_ATTRIBUTION_NUMBER",
          `${canonical}은(는) 유한한 숫자여야 합니다.`,
          { ...context, field: canonical }
        ));
        return;
      }
      if (["dividendKRW", "interestKRW", "feeKRW", "taxKRW"].includes(canonical) && numeric < 0) {
        diagnostics.push(error(
          "NEGATIVE_ATTRIBUTION_AMOUNT",
          `${canonical}은(는) 0 이상이어야 합니다.`,
          { ...context, field: canonical }
        ));
        return;
      }
      result[canonical] = canonicalZero(numeric);
    });
    return result;
  }

  function normalizeBenchmarkPoint(source, diagnostics, context = {}) {
    const nested = isPlainObject(source.benchmark) ? source.benchmark : {};
    const rawLevel = firstDefined(source, ["benchmarkLevel", "benchmarkValue"])
      ?? firstDefined(nested, ["level", "value"]);
    if (rawLevel === undefined) return null;
    const level = finiteNumber(rawLevel);
    if (level === null || level <= 0) {
      diagnostics.push(error(
        "INVALID_BENCHMARK_LEVEL",
        "벤치마크 지수는 0보다 큰 유한한 숫자여야 합니다.",
        context
      ));
      return null;
    }
    const kind = normalizedText(firstDefined(source, ["benchmarkKind"]) ?? nested.kind).toUpperCase();
    const currency = normalizedText(firstDefined(source, ["benchmarkCurrency"]) ?? nested.currency).toUpperCase();
    const sourceName = normalizedText(firstDefined(source, ["benchmarkSource"]) ?? nested.source);
    return {
      level,
      ...(kind ? { kind } : {}),
      ...(currency ? { currency } : {}),
      ...(sourceName ? { source: sourceName } : {})
    };
  }

  function inputObservations(input) {
    if (Array.isArray(input)) return input;
    if (isPlainObject(input) && Array.isArray(input.observations)) return input.observations;
    if (isPlainObject(input) && Array.isArray(input.points)) return input.points;
    return null;
  }

  function mergedOptions(input, options) {
    const embedded = isPlainObject(input) && isPlainObject(input.options) ? input.options : {};
    return { ...embedded, ...(isPlainObject(options) ? options : {}) };
  }

  function buildPerformanceSeries(input, options = {}) {
    const rows = inputObservations(input);
    const resolvedOptions = mergedOptions(input, options);
    const diagnostics = [];
    if (!rows) {
      diagnostics.push(error("INVALID_OBSERVATIONS", "성과 관측점은 배열이어야 합니다."));
      return {
        ok: false,
        availability: AVAILABILITY.UNAVAILABLE,
        method: FLOW_POLICY,
        observations: [],
        returns: [],
        period: null,
        quality: {
          observationCount: 0,
          returnCount: 0,
          completeCount: 0,
          fingerprintedCount: 0,
          irregularGapCount: 0,
          maxGapDays: 0
        },
        diagnostics
      };
    }

    const requireCompleteness = resolvedOptions.requireCompleteness !== false;
    const requireLedgerFingerprint = resolvedOptions.requireLedgerFingerprint !== false;
    const requirePriceFingerprint = resolvedOptions.requirePriceFingerprint !== false;
    const inputDefaults = isPlainObject(input) ? input : {};
    const requestedFlowPolicy = normalizedText(
      resolvedOptions.flowPolicy ?? inputDefaults.flowPolicy ?? inputDefaults.cutoff
    ).toUpperCase();
    if (requestedFlowPolicy && requestedFlowPolicy !== FLOW_POLICY) {
      diagnostics.push(error(
        "UNSUPPORTED_FLOW_POLICY",
        `지원하는 외부 현금흐름 정책은 ${FLOW_POLICY}뿐입니다.`,
        { flowPolicy: requestedFlowPolicy }
      ));
    }
    const rawMaxGap = Number(resolvedOptions.maxGapDays);
    const maxGapDays = Number.isFinite(rawMaxGap) && rawMaxGap >= 1
      ? Math.floor(rawMaxGap)
      : DEFAULT_MAX_GAP_DAYS;

    const normalizedRows = [];
    rows.forEach((source, index) => {
      if (!isPlainObject(source)) {
        diagnostics.push(error(
          "INVALID_OBSERVATION",
          `성과 관측점 ${index + 1}은(는) 객체여야 합니다.`,
          { index }
        ));
        return;
      }
      const date = validDateKey(source.date);
      if (!date) {
        diagnostics.push(error(
          "INVALID_OBSERVATION_DATE",
          `성과 관측점 ${index + 1}의 날짜가 올바르지 않습니다.`,
          { index }
        ));
        return;
      }
      const navKRW = finiteNumber(source.navKRW);
      if (navKRW === null) {
        diagnostics.push(error(
          "INVALID_NAV",
          `${date}의 NAV는 유한한 숫자여야 합니다.`,
          { index, date }
        ));
        return;
      }
      if (navKRW < 0) {
        diagnostics.push(error(
          "NEGATIVE_NAV",
          `${date}의 NAV는 음수일 수 없습니다.`,
          { index, date, navKRW }
        ));
      }
      const flowRaw = source.externalFlowKRW === undefined ? 0 : source.externalFlowKRW;
      const externalFlowKRW = finiteNumber(flowRaw);
      if (externalFlowKRW === null) {
        diagnostics.push(error(
          "INVALID_EXTERNAL_FLOW",
          `${date}의 외부 현금흐름은 유한한 숫자여야 합니다.`,
          { index, date }
        ));
        return;
      }

      const completeness = completenessStatus(source.completeness ?? inputDefaults.completeness);
      if (requireCompleteness && completeness === "INCOMPLETE") {
        diagnostics.push(error(
          "INCOMPLETE_OBSERVATION",
          `${date}의 평가 데이터가 완전하지 않습니다.`,
          { index, date }
        ));
      } else if (requireCompleteness && completeness === "UNKNOWN") {
        diagnostics.push(warning(
          "UNVERIFIED_COMPLETENESS",
          `${date}의 평가 완전성을 확인할 수 없습니다.`,
          { index, date }
        ));
      }

      const defaultFingerprints = isPlainObject(inputDefaults.fingerprints) ? inputDefaults.fingerprints : {};
      const fingerprints = isPlainObject(source.fingerprints) ? source.fingerprints : {};
      const ledgerFingerprint = normalizedText(
        source.ledgerFingerprint
          ?? source.ledgerEventFingerprint
          ?? fingerprints.ledger
          ?? inputDefaults.ledgerFingerprint
          ?? inputDefaults.ledgerEventFingerprint
          ?? defaultFingerprints.ledger
      );
      const priceFingerprint = normalizedText(
        source.priceFingerprint
          ?? source.marketDataFingerprint
          ?? fingerprints.price
          ?? inputDefaults.priceFingerprint
          ?? inputDefaults.marketDataFingerprint
          ?? defaultFingerprints.price
      );
      if (requireLedgerFingerprint && !ledgerFingerprint) {
        diagnostics.push(warning(
          "MISSING_LEDGER_FINGERPRINT",
          `${date}의 원장 fingerprint가 없습니다.`,
          { index, date }
        ));
      }
      if (requirePriceFingerprint && !priceFingerprint) {
        diagnostics.push(warning(
          "MISSING_PRICE_FINGERPRINT",
          `${date}의 가격 fingerprint가 없습니다.`,
          { index, date }
        ));
      }

      const attribution = normalizeAttribution(source.attribution, diagnostics, { index, date });
      const benchmark = normalizeBenchmarkPoint(source, diagnostics, { index, date });
      normalizedRows.push({
        date,
        navKRW: canonicalZero(navKRW),
        externalFlowKRW: canonicalZero(externalFlowKRW),
        cutoff: FLOW_POLICY,
        completeness,
        ...(ledgerFingerprint ? { ledgerFingerprint } : {}),
        ...(priceFingerprint ? { priceFingerprint } : {}),
        ...(attribution ? { attribution } : {}),
        ...(benchmark ? { benchmark } : {}),
        _inputIndex: index
      });
    });

    normalizedRows.sort((left, right) => compareText(left.date, right.date) || left._inputIndex - right._inputIndex);
    const observations = [];
    normalizedRows.forEach((row) => {
      if (observations.at(-1)?.date === row.date) {
        diagnostics.push(error(
          "DUPLICATE_OBSERVATION_DATE",
          `${row.date}에 성과 관측점이 여러 개 있습니다.`,
          { date: row.date, index: row._inputIndex }
        ));
        return;
      }
      const { _inputIndex, ...clean } = row;
      observations.push(clean);
    });

    const returns = [];
    let irregularGapCount = 0;
    let observedMaxGap = 0;
    for (let index = 1; index < observations.length; index += 1) {
      const previous = observations[index - 1];
      const current = observations[index];
      const gapDays = daysBetween(previous.date, current.date);
      observedMaxGap = Math.max(observedMaxGap, gapDays);
      if (gapDays > maxGapDays) {
        irregularGapCount += 1;
        diagnostics.push(warning(
          "IRREGULAR_OBSERVATION_GAP",
          `${previous.date}부터 ${current.date}까지 ${gapDays}일의 관측 공백이 있습니다.`,
          { startDate: previous.date, endDate: current.date, gapDays }
        ));
      }
      if (!(previous.navKRW > 0)) {
        diagnostics.push(error(
          "ZERO_OPENING_NAV",
          `${previous.date}의 NAV가 0이라 다음 구간 수익률을 계산할 수 없습니다.`,
          { date: previous.date }
        ));
        continue;
      }
      const preFlowEndingNavKRW = current.navKRW - current.externalFlowKRW;
      const tolerance = Math.max(
        0.01,
        Number.EPSILON * 32 * (Math.abs(current.navKRW) + Math.abs(current.externalFlowKRW))
      );
      if (preFlowEndingNavKRW < -tolerance) {
        diagnostics.push(error(
          "NEGATIVE_PRE_FLOW_NAV",
          `${current.date}의 외부 현금흐름 차감 전 NAV가 음수입니다.`,
          {
            date: current.date,
            navKRW: current.navKRW,
            externalFlowKRW: current.externalFlowKRW,
            preFlowEndingNavKRW
          }
        ));
        continue;
      }
      const intervalReturn = canonicalZero(Math.max(0, preFlowEndingNavKRW) / previous.navKRW - 1);
      if (!Number.isFinite(intervalReturn) || intervalReturn < -1) {
        diagnostics.push(error(
          "INVALID_INTERVAL_RETURN",
          `${previous.date}부터 ${current.date}까지의 수익률을 계산할 수 없습니다.`,
          { startDate: previous.date, endDate: current.date }
        ));
        continue;
      }
      returns.push({
        startDate: previous.date,
        endDate: current.date,
        days: gapDays,
        openingNavKRW: previous.navKRW,
        endingNavKRW: current.navKRW,
        externalFlowKRW: current.externalFlowKRW,
        preFlowEndingNavKRW: canonicalZero(Math.max(0, preFlowEndingNavKRW)),
        return: intervalReturn
      });
    }

    const cleanDiagnostics = dedupeDiagnostics(diagnostics);
    const completeCount = observations.filter((row) => row.completeness === "COMPLETE").length;
    const fingerprintedCount = observations.filter((row) => row.ledgerFingerprint && row.priceFingerprint).length;
    return {
      ok: !cleanDiagnostics.some((item) => item.severity === "error"),
      availability: availabilityFromDiagnostics(cleanDiagnostics),
      method: FLOW_POLICY,
      observations,
      returns,
      period: observations.length
        ? {
            startDate: observations[0].date,
            endDate: observations.at(-1).date,
            days: daysBetween(observations[0].date, observations.at(-1).date)
          }
        : null,
      quality: {
        observationCount: observations.length,
        returnCount: returns.length,
        completeCount,
        fingerprintedCount,
        irregularGapCount,
        maxGapDays: observedMaxGap
      },
      diagnostics: cleanDiagnostics
    };
  }

  function asPerformanceSeries(input, options = {}) {
    if (isPlainObject(input)
      && Array.isArray(input.observations)
      && Array.isArray(input.returns)
      && input.method === FLOW_POLICY) {
      return input;
    }
    return buildPerformanceSeries(input, options);
  }

  function unavailableMetric(method, diagnostics, extra = {}) {
    const cleanDiagnostics = dedupeDiagnostics(diagnostics);
    return {
      ok: false,
      availability: AVAILABILITY.UNAVAILABLE,
      method,
      value: null,
      ...extra,
      diagnostics: cleanDiagnostics
    };
  }

  function calculateTwr(input, options = {}) {
    const series = asPerformanceSeries(input, options);
    const diagnostics = [...(series.diagnostics || [])];
    if (series.observations.length < 2) {
      diagnostics.push(error("INSUFFICIENT_OBSERVATIONS", "TWR에는 최소 2개의 평가점이 필요합니다."));
    }
    if (series.returns.length !== Math.max(0, series.observations.length - 1)) {
      diagnostics.push(error("INCOMPLETE_RETURN_SERIES", "모든 평가 구간의 수익률을 계산할 수 없습니다."));
    }
    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("TWR", diagnostics, {
        period: series.period,
        periodReturn: null,
        annualizedReturn: null,
        subperiodReturns: series.returns
      });
    }

    let wealth = 1;
    for (const row of series.returns) {
      wealth *= 1 + row.return;
      if (!Number.isFinite(wealth) || wealth < 0) {
        diagnostics.push(error("INVALID_LINKED_RETURN", "TWR 기하연결 결과가 유효하지 않습니다."));
        return unavailableMetric("TWR", diagnostics, {
          period: series.period,
          periodReturn: null,
          annualizedReturn: null,
          subperiodReturns: series.returns
        });
      }
    }
    const periodReturn = canonicalZero(wealth - 1);
    const days = series.period?.days || 0;
    let annualizedReturn = null;
    if (days > 0) {
      annualizedReturn = periodReturn === -1
        ? -1
        : canonicalZero(Math.exp(Math.log1p(periodReturn) * 365 / days) - 1);
    }
    return {
      ok: true,
      availability: worstAvailability(series.availability, availabilityFromDiagnostics(diagnostics)),
      method: "DAILY_VALUATION_TWR_END_OF_DAY_FLOW",
      value: periodReturn,
      period: series.period,
      periodReturn,
      annualizedReturn,
      annualizedDisplayEligible: days >= 365,
      subperiodReturns: series.returns,
      quality: series.quality,
      diagnostics: dedupeDiagnostics(diagnostics)
    };
  }

  function normalizeCashFlows(input, diagnostics) {
    let rows = [];
    if (Array.isArray(input)) {
      rows = input;
    } else if (isPlainObject(input) && Array.isArray(input.cashFlows)) {
      rows = input.cashFlows;
    } else {
      const observations = inputObservations(input);
      if (observations) {
        const series = asPerformanceSeries(input, isPlainObject(input) ? input.options : {});
        diagnostics.push(...series.diagnostics);
        if (series.observations.length) {
          rows.push({ date: series.observations[0].date, amountKRW: -series.observations[0].navKRW });
          series.observations.slice(1).forEach((row) => {
            if (row.externalFlowKRW) rows.push({ date: row.date, amountKRW: -row.externalFlowKRW });
          });
          const ending = series.observations.at(-1);
          rows.push({ date: ending.date, amountKRW: ending.navKRW });
        }
      } else if (isPlainObject(input)) {
        const startDate = input.startDate;
        const endDate = input.endDate;
        const startValue = firstDefined(input, ["startValueKRW", "beginningValueKRW"]);
        const endValue = firstDefined(input, ["endValueKRW", "endingValueKRW"]);
        if (startDate !== undefined || startValue !== undefined) {
          rows.push({ date: startDate, amountKRW: -Number(startValue) });
        }
        const externalRows = Array.isArray(input.externalCashFlows) ? input.externalCashFlows : [];
        externalRows.forEach((row) => rows.push({
          date: row?.date,
          amountKRW: -Number(row?.externalFlowKRW ?? row?.amountKRW ?? row?.amount)
        }));
        if (endDate !== undefined || endValue !== undefined) {
          rows.push({ date: endDate, amountKRW: Number(endValue) });
        }
      }
    }

    if (!rows.length) {
      diagnostics.push(error("INVALID_CASH_FLOWS", "XIRR 현금흐름을 입력해야 합니다."));
      return [];
    }
    const normalized = [];
    rows.forEach((source, index) => {
      if (!isPlainObject(source)) {
        diagnostics.push(error("INVALID_CASH_FLOW", `현금흐름 ${index + 1}은(는) 객체여야 합니다.`, { index }));
        return;
      }
      const date = validDateKey(source.date);
      const amount = finiteNumber(firstDefined(source, ["amountKRW", "amount", "value"]));
      if (!date) {
        diagnostics.push(error("INVALID_CASH_FLOW_DATE", `현금흐름 ${index + 1}의 날짜가 올바르지 않습니다.`, {
          index
        }));
        return;
      }
      if (amount === null) {
        diagnostics.push(error("INVALID_CASH_FLOW_AMOUNT", `${date} 현금흐름은 유한한 숫자여야 합니다.`, {
          index,
          date
        }));
        return;
      }
      if (amount === 0) return;
      normalized.push({ date, amountKRW: amount, _index: index });
    });
    normalized.sort((left, right) => compareText(left.date, right.date) || left._index - right._index);
    const aggregated = [];
    normalized.forEach((row) => {
      const current = aggregated.at(-1);
      if (current?.date === row.date) current.amountKRW += row.amountKRW;
      else aggregated.push({ date: row.date, amountKRW: row.amountKRW });
    });
    return aggregated
      .map((row) => ({ ...row, amountKRW: canonicalZero(row.amountKRW) }))
      .filter((row) => row.amountKRW !== 0);
  }

  function scaledNpvAtX(cashFlows, x, firstDay) {
    const terms = cashFlows.map((row) => ({
      sign: Math.sign(row.amountKRW),
      logMagnitude: Math.log(Math.abs(row.amountKRW)) - x * ((utcDayNumber(row.date) - firstDay) / 365)
    }));
    const maxLog = Math.max(...terms.map((term) => term.logMagnitude));
    let scaled = 0;
    let absoluteScaled = 0;
    terms.forEach((term) => {
      const magnitude = Math.exp(term.logMagnitude - maxLog);
      scaled += term.sign * magnitude;
      absoluteScaled += magnitude;
    });
    return { scaled, absoluteScaled, maxLog };
  }

  function scaledRoot(evalResult) {
    return Math.abs(evalResult.scaled) <= ROOT_SCALED_TOLERANCE * Math.max(1, evalResult.absoluteScaled);
  }

  function bisectXirrRoot(cashFlows, firstDay, leftX, rightX, maxIterations) {
    let left = leftX;
    let right = rightX;
    let leftEval = scaledNpvAtX(cashFlows, left, firstDay);
    let rightEval = scaledNpvAtX(cashFlows, right, firstDay);
    if (scaledRoot(leftEval)) return { converged: true, x: left, iterations: 0 };
    if (scaledRoot(rightEval)) return { converged: true, x: right, iterations: 0 };
    if (!(Math.sign(leftEval.scaled) * Math.sign(rightEval.scaled) < 0)) {
      return { converged: false, x: null, iterations: 0 };
    }
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const middle = (left + right) / 2;
      const middleEval = scaledNpvAtX(cashFlows, middle, firstDay);
      if (scaledRoot(middleEval) || Math.abs(right - left) <= ROOT_X_TOLERANCE) {
        return { converged: true, x: middle, iterations: iteration };
      }
      if (Math.sign(leftEval.scaled) * Math.sign(middleEval.scaled) < 0) {
        right = middle;
        rightEval = middleEval;
      } else {
        left = middle;
        leftEval = middleEval;
      }
    }
    return { converged: false, x: (left + right) / 2, iterations: maxIterations };
  }

  function countSignChanges(cashFlows) {
    let changes = 0;
    let previous = 0;
    cashFlows.forEach((row) => {
      const sign = Math.sign(row.amountKRW);
      if (previous && sign !== previous) changes += 1;
      previous = sign;
    });
    return changes;
  }

  function calculateXirr(input, options = {}) {
    const diagnostics = [];
    const cashFlows = normalizeCashFlows(input, diagnostics);
    const resolvedOptions = mergedOptions(input, options);
    const rawIterationInput = resolvedOptions.maxIterations ?? input?.maxIterations;
    const rawIterations = Number(rawIterationInput);
    const maxIterations = Number.isSafeInteger(rawIterations) && rawIterations > 0 && rawIterations <= 10_000
      ? rawIterations
      : DEFAULT_XIRR_MAX_ITERATIONS;
    if (rawIterationInput !== undefined && rawIterations !== maxIterations) {
      diagnostics.push(warning(
        "INVALID_XIRR_ITERATION_LIMIT",
        `XIRR 반복 한도가 올바르지 않아 ${DEFAULT_XIRR_MAX_ITERATIONS}회를 사용합니다.`
      ));
    }
    if (cashFlows.length < 2) {
      diagnostics.push(error("INSUFFICIENT_CASH_FLOWS", "XIRR에는 최소 2개의 서로 다른 현금흐름이 필요합니다."));
    }
    const hasPositive = cashFlows.some((row) => row.amountKRW > 0);
    const hasNegative = cashFlows.some((row) => row.amountKRW < 0);
    if (!hasPositive || !hasNegative) {
      diagnostics.push(error(
        "XIRR_REQUIRES_BOTH_SIGNS",
        "XIRR에는 양수와 음수 현금흐름이 모두 필요합니다."
      ));
    }
    const startDate = cashFlows[0]?.date || null;
    const endDate = cashFlows.at(-1)?.date || null;
    const periodDays = startDate && endDate ? daysBetween(startDate, endDate) : 0;
    if (!(periodDays > 0)) {
      diagnostics.push(error("INVALID_XIRR_PERIOD", "XIRR 시작일과 종료일 사이에는 최소 1일이 필요합니다."));
    }
    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("XIRR_365", diagnostics, {
        cashFlows,
        period: startDate && endDate ? { startDate, endDate, days: periodDays } : null,
        annualizedReturn: null,
        periodEquivalentReturn: null,
        roots: [],
        maxIterations
      });
    }

    const firstDay = utcDayNumber(startDate);
    const minRate = finiteNumber(resolvedOptions.minRate) ?? XIRR_MIN_RATE;
    const maxRate = finiteNumber(resolvedOptions.maxRate) ?? XIRR_MAX_RATE;
    if (!(minRate > -1) || !(maxRate > minRate)) {
      diagnostics.push(error("INVALID_XIRR_SEARCH_RANGE", "XIRR 탐색 범위가 올바르지 않습니다."));
      return unavailableMetric("XIRR_365", diagnostics, {
        cashFlows,
        period: { startDate, endDate, days: periodDays },
        annualizedReturn: null,
        periodEquivalentReturn: null,
        roots: [],
        maxIterations
      });
    }
    const minX = Math.log1p(minRate);
    const maxX = Math.log1p(maxRate);
    const rootXs = [];
    let iterationLimitHit = false;
    let previousX = minX;
    let previousEval = scaledNpvAtX(cashFlows, previousX, firstDay);

    function addRootX(x) {
      if (!Number.isFinite(x)) return;
      if (rootXs.some((candidate) => Math.abs(candidate - x) <= 1e-9)) return;
      rootXs.push(x);
    }

    if (scaledRoot(previousEval)) addRootX(previousX);
    for (let index = 1; index <= XIRR_GRID_SIZE; index += 1) {
      const currentX = minX + (maxX - minX) * index / XIRR_GRID_SIZE;
      const currentEval = scaledNpvAtX(cashFlows, currentX, firstDay);
      if (scaledRoot(currentEval)) addRootX(currentX);
      if (Math.sign(previousEval.scaled) * Math.sign(currentEval.scaled) < 0) {
        const solved = bisectXirrRoot(cashFlows, firstDay, previousX, currentX, maxIterations);
        if (solved.converged) addRootX(solved.x);
        else iterationLimitHit = true;
      }
      previousX = currentX;
      previousEval = currentEval;
    }

    rootXs.sort((left, right) => left - right);
    const roots = rootXs.map((x) => canonicalZero(Math.expm1(x)));
    if (iterationLimitHit) {
      diagnostics.push(error(
        "XIRR_ITERATION_LIMIT",
        `XIRR이 구간당 최대 ${maxIterations}회 안에 수렴하지 않았습니다.`,
        { maxIterations }
      ));
    }
    if (!roots.length && !iterationLimitHit) {
      diagnostics.push(error(
        "XIRR_NO_ROOT",
        `설정된 범위(${minRate}~${maxRate})에서 XIRR 해를 찾지 못했습니다.`,
        { minRate, maxRate }
      ));
    }
    if (roots.length > 1) {
      diagnostics.push(error(
        "XIRR_MULTIPLE_ROOTS",
        "현금흐름에 유효한 XIRR 근이 여러 개 있어 하나를 임의로 선택하지 않았습니다.",
        { roots }
      ));
    }
    const signChanges = countSignChanges(cashFlows);
    if (roots.length === 1 && signChanges > 1) {
      diagnostics.push(warning(
        "XIRR_ROOT_UNIQUENESS_NOT_GUARANTEED",
        "현금흐름 부호가 여러 번 바뀌어 탐색 범위 밖에 다른 XIRR 근이 있을 수 있습니다.",
        { signChanges }
      ));
    }
    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("XIRR_365", diagnostics, {
        cashFlows,
        period: { startDate, endDate, days: periodDays },
        annualizedReturn: null,
        periodEquivalentReturn: null,
        roots,
        maxIterations
      });
    }
    const annualizedReturn = roots[0];
    const periodEquivalentReturn = annualizedReturn === -1
      ? -1
      : canonicalZero(Math.exp(Math.log1p(annualizedReturn) * periodDays / 365) - 1);
    return {
      ok: true,
      availability: availabilityFromDiagnostics(diagnostics),
      method: "XIRR_365",
      value: annualizedReturn,
      cashFlows,
      period: { startDate, endDate, days: periodDays },
      annualizedReturn,
      periodEquivalentReturn,
      roots,
      maxIterations,
      diagnostics: dedupeDiagnostics(diagnostics)
    };
  }

  function hasAnyField(source, fields) {
    return fields.some((field) => Object.hasOwn(source, field) && source[field] !== undefined);
  }

  function readFiniteField(source, fields, diagnostics, label, options = {}) {
    const raw = firstDefined(source, fields);
    if (raw === undefined) return { present: false, value: 0 };
    const numeric = finiteNumber(raw);
    if (numeric === null || (options.nonNegative && numeric < 0)) {
      diagnostics.push(error(
        "INVALID_BRIDGE_COMPONENT",
        `${label}은(는) ${options.nonNegative ? "0 이상의 " : ""}유한한 숫자여야 합니다.`,
        { field: fields[0] }
      ));
      return { present: true, value: 0 };
    }
    return { present: true, value: canonicalZero(numeric) };
  }

  function bridgeInputFromObservations(input, diagnostics) {
    const series = asPerformanceSeries(input, isPlainObject(input) ? input.options : {});
    diagnostics.push(...series.diagnostics);
    if (series.observations.length < 2) return null;
    const result = {
      beginningValueKRW: series.observations[0].navKRW,
      endingValueKRW: series.observations.at(-1).navKRW,
      externalFlowKRW: series.observations.slice(1).reduce((sum, row) => sum + row.externalFlowKRW, 0)
    };
    const attributions = series.observations.slice(1).map((row) => row.attribution).filter(Boolean);
    if (!attributions.length) return result;
    Object.keys(ATTRIBUTION_ALIASES).forEach((field) => {
      result[field] = attributions.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    });
    result._attributionComplete = attributions.length === series.observations.length - 1
      && attributions.every((row) => [
        "priceEffectKRW",
        "fxEffectKRW",
        "dividendKRW",
        "interestKRW",
        "feeKRW",
        "taxKRW"
      ].every((field) => Object.hasOwn(row, field)));
    return result;
  }

  function decomposeValueChange(input, options = {}) {
    const diagnostics = [];
    let source;
    if (inputObservations(input)) {
      source = bridgeInputFromObservations(input, diagnostics) || {};
    } else {
      const nested = isPlainObject(input?.attribution)
        ? input.attribution
        : isPlainObject(input?.components)
          ? input.components
          : {};
      source = { ...(isPlainObject(input) ? input : {}), ...nested };
    }
    if (!isPlainObject(input)) {
      diagnostics.push(error("INVALID_BRIDGE_INPUT", "성과 원인 분해 입력은 객체여야 합니다."));
    }
    const beginning = readFiniteField(
      source,
      ["beginningValueKRW", "startValueKRW"],
      diagnostics,
      "시작 NAV",
      { nonNegative: true }
    );
    const ending = readFiniteField(
      source,
      ["endingValueKRW", "endValueKRW"],
      diagnostics,
      "종료 NAV",
      { nonNegative: true }
    );
    if (!beginning.present) diagnostics.push(error("MISSING_BEGINNING_VALUE", "시작 NAV가 필요합니다."));
    if (!ending.present) diagnostics.push(error("MISSING_ENDING_VALUE", "종료 NAV가 필요합니다."));

    const deposits = readFiniteField(source, ["depositsKRW", "depositKRW"], diagnostics, "입금", {
      nonNegative: true
    });
    const withdrawals = readFiniteField(source, ["withdrawalsKRW", "withdrawalKRW"], diagnostics, "출금", {
      nonNegative: true
    });
    const directExternal = readFiniteField(source, ["externalFlowKRW", "netExternalFlowKRW"], diagnostics, "순입출금");
    const splitExternalPresent = deposits.present || withdrawals.present;
    const splitExternal = deposits.value - withdrawals.value;
    const externalFlowKRW = splitExternalPresent ? splitExternal : directExternal.value;
    if (splitExternalPresent && directExternal.present) {
      const difference = Math.abs(splitExternal - directExternal.value);
      if (difference > 0.01) {
        diagnostics.push(error(
          "EXTERNAL_FLOW_MISMATCH",
          "입금·출금 합계와 순외부현금흐름이 일치하지 않습니다.",
          { splitExternalFlowKRW: splitExternal, externalFlowKRW: directExternal.value }
        ));
      }
    }

    const price = readFiniteField(source, ["priceEffectKRW", "priceKRW"], diagnostics, "가격효과");
    const manual = readFiniteField(
      source,
      ["manualValuationEffectKRW", "manualValuationKRW"],
      diagnostics,
      "수동평가효과"
    );
    const fx = readFiniteField(source, ["fxEffectKRW", "fxKRW"], diagnostics, "환율효과");
    const dividend = readFiniteField(
      source,
      ["dividendKRW", "dividendsKRW"],
      diagnostics,
      "배당",
      { nonNegative: true }
    );
    const interest = readFiniteField(source, ["interestKRW"], diagnostics, "이자", { nonNegative: true });
    const fee = readFiniteField(source, ["feeKRW", "feesKRW"], diagnostics, "수수료", { nonNegative: true });
    const tax = readFiniteField(source, ["taxKRW", "taxesKRW"], diagnostics, "세금", { nonNegative: true });
    const other = readFiniteField(source, ["otherEffectKRW", "otherKRW"], diagnostics, "기타효과");
    const groupedIncome = readFiniteField(source, ["incomeEffectKRW"], diagnostics, "소득효과");
    const groupedCost = readFiniteField(source, ["costEffectKRW"], diagnostics, "비용효과");

    const priceEffectKRW = price.value + manual.value;
    const incomeEffectKRW = groupedIncome.present ? groupedIncome.value : dividend.value + interest.value;
    const costEffectKRW = groupedCost.present ? groupedCost.value : -(fee.value + tax.value);
    const totalInvestmentEffectKRW = priceEffectKRW
      + fx.value
      + incomeEffectKRW
      + costEffectKRW
      + other.value;
    const totalChangeKRW = ending.value - beginning.value;
    const explainedChangeKRW = externalFlowKRW + totalInvestmentEffectKRW;
    const residualKRW = canonicalZero(totalChangeKRW - explainedChangeKRW);
    const scale = [
      beginning.value,
      ending.value,
      externalFlowKRW,
      priceEffectKRW,
      fx.value,
      incomeEffectKRW,
      costEffectKRW,
      other.value
    ].reduce((sum, value) => sum + Math.abs(value), 0);
    const requestedTolerance = finiteNumber(options.toleranceKRW ?? input?.toleranceKRW);
    const toleranceKRW = requestedTolerance !== null && requestedTolerance >= 0
      ? requestedTolerance
      : Math.max(0.01, Number.EPSILON * 32 * scale);

    const attributionComplete = source._attributionComplete === false
      ? false
      : source._attributionComplete === true || (
          price.present
          && fx.present
          && (groupedIncome.present || (dividend.present && interest.present))
          && (groupedCost.present || (fee.present && tax.present))
        );
    if (!attributionComplete) {
      diagnostics.push(warning(
        "INCOMPLETE_ATTRIBUTION",
        "가격·환율·배당·이자·수수료·세금 중 일부가 없어 잔여오차를 정합성 실패로 단정하지 않습니다."
      ));
    } else if (Math.abs(residualKRW) > toleranceKRW) {
      diagnostics.push(error(
        "BRIDGE_NOT_RECONCILED",
        "성과 원인 합계가 총자산 변화와 허용오차 안에서 일치하지 않습니다.",
        { residualKRW, toleranceKRW }
      ));
    }
    if (other.present && other.value !== 0) {
      diagnostics.push(warning(
        "OTHER_ATTRIBUTION_USED",
        "기타효과가 포함되어 원인을 추가로 확인해야 합니다.",
        { otherEffectKRW: other.value }
      ));
    }

    const cleanDiagnostics = dedupeDiagnostics(diagnostics);
    return {
      ok: !cleanDiagnostics.some((item) => item.severity === "error"),
      availability: availabilityFromDiagnostics(cleanDiagnostics),
      method: "ADDITIVE_KRW_VALUE_BRIDGE",
      value: totalChangeKRW,
      beginningValueKRW: beginning.value,
      endingValueKRW: ending.value,
      totalChangeKRW,
      components: {
        depositsKRW: deposits.value,
        withdrawalsKRW: withdrawals.value,
        externalFlowKRW,
        marketPriceEffectKRW: price.value,
        manualValuationEffectKRW: manual.value,
        priceEffectKRW,
        fxEffectKRW: fx.value,
        dividendKRW: dividend.value,
        interestKRW: interest.value,
        incomeEffectKRW,
        feeKRW: fee.value,
        taxKRW: tax.value,
        costEffectKRW,
        otherEffectKRW: other.value,
        totalInvestmentEffectKRW
      },
      explainedChangeKRW,
      residualKRW,
      toleranceKRW,
      reconciled: attributionComplete && Math.abs(residualKRW) <= toleranceKRW,
      attributionComplete,
      diagnostics: cleanDiagnostics
    };
  }

  function benchmarkInput(input) {
    if (!isPlainObject(input)) return {};
    return isPlainObject(input.benchmark) ? { ...input, ...input.benchmark } : input;
  }

  function compareBenchmark(input, options = {}) {
    const diagnostics = [];
    const source = benchmarkInput(input);
    let portfolioReturn = finiteNumber(firstDefined(source, ["portfolioReturn", "portfolioTwr", "twr"]));
    if (isPlainObject(source.twr)) {
      portfolioReturn = finiteNumber(source.twr.periodReturn ?? source.twr.value);
      diagnostics.push(...(source.twr.diagnostics || []));
    }
    let benchmarkReturn = finiteNumber(firstDefined(source, ["benchmarkReturn", "return"]));
    let period = source.period || null;
    let kind = normalizedText(source.kind ?? source.benchmarkKind).toUpperCase();
    let benchmarkCurrency = normalizedText(source.currency ?? source.benchmarkCurrency).toUpperCase();
    const portfolioCurrency = normalizedText(source.portfolioCurrency ?? options.portfolioCurrency ?? "KRW").toUpperCase();

    const observations = inputObservations(input);
    const hasPortfolioObservations = observations?.some((row) => isPlainObject(row) && Object.hasOwn(row, "navKRW"));
    if (hasPortfolioObservations) {
      const series = asPerformanceSeries(input, options);
      diagnostics.push(...series.diagnostics);
      period = series.period;
      if (portfolioReturn === null) {
        const twr = calculateTwr(series, options);
        diagnostics.push(...twr.diagnostics);
        portfolioReturn = twr.periodReturn;
      }
      const firstBenchmark = series.observations[0]?.benchmark;
      const lastBenchmark = series.observations.at(-1)?.benchmark;
      if (firstBenchmark?.level > 0 && lastBenchmark?.level > 0) {
        benchmarkReturn = lastBenchmark.level / firstBenchmark.level - 1;
        kind = kind || firstBenchmark.kind || lastBenchmark.kind || "";
        benchmarkCurrency = benchmarkCurrency || firstBenchmark.currency || lastBenchmark.currency || "";
      }
    } else if (Array.isArray(source.observations) || Array.isArray(source.levels)) {
      const levels = (source.observations || source.levels)
        .map((row, index) => ({
          date: validDateKey(row?.date),
          level: finiteNumber(row?.level ?? row?.value),
          _index: index
        }))
        .filter((row) => row.date && row.level !== null && row.level > 0)
        .sort((left, right) => compareText(left.date, right.date) || left._index - right._index);
      if (levels.length >= 2) {
        benchmarkReturn = levels.at(-1).level / levels[0].level - 1;
        period = { startDate: levels[0].date, endDate: levels.at(-1).date, days: daysBetween(levels[0].date, levels.at(-1).date) };
      }
    } else {
      const startLevel = finiteNumber(source.startLevel ?? source.beginningLevel);
      const endLevel = finiteNumber(source.endLevel ?? source.endingLevel);
      if (benchmarkReturn === null && startLevel > 0 && endLevel > 0) benchmarkReturn = endLevel / startLevel - 1;
    }

    if (portfolioReturn === null || portfolioReturn < -1) {
      diagnostics.push(error("INVALID_PORTFOLIO_RETURN", "비교할 포트폴리오 수익률이 올바르지 않습니다."));
    }
    if (benchmarkReturn === null || benchmarkReturn <= -1) {
      diagnostics.push(error("INVALID_BENCHMARK_RETURN", "비교할 벤치마크 수익률이 올바르지 않습니다."));
    }
    if (!kind) {
      diagnostics.push(warning("UNKNOWN_BENCHMARK_KIND", "벤치마크가 총수익지수인지 확인할 수 없습니다."));
    } else if (!["TOTAL_RETURN", "NET_TOTAL_RETURN", "GROSS_TOTAL_RETURN"].includes(kind)) {
      diagnostics.push(warning(
        "PRICE_ONLY_BENCHMARK",
        "배당이 포함되지 않은 벤치마크는 총수익률의 기본 비교 기준으로 제한적입니다.",
        { kind }
      ));
    }
    if (!benchmarkCurrency) {
      diagnostics.push(warning("UNKNOWN_BENCHMARK_CURRENCY", "벤치마크 통화를 확인할 수 없습니다."));
    } else if (portfolioCurrency && benchmarkCurrency !== portfolioCurrency && source.currencyAdjusted !== true) {
      diagnostics.push(error(
        "BENCHMARK_CURRENCY_MISMATCH",
        "포트폴리오와 벤치마크 통화가 다르며 환산 여부가 표시되지 않았습니다.",
        { portfolioCurrency, benchmarkCurrency }
      ));
    }

    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("TWR_BENCHMARK_COMPARISON", diagnostics, {
        period,
        portfolioReturn,
        benchmarkReturn,
        percentagePointDifference: null,
        geometricRelativeReturn: null
      });
    }
    const percentagePointDifference = canonicalZero(portfolioReturn - benchmarkReturn);
    const geometricRelativeReturn = canonicalZero((1 + portfolioReturn) / (1 + benchmarkReturn) - 1);
    return {
      ok: true,
      availability: availabilityFromDiagnostics(diagnostics),
      method: "TWR_BENCHMARK_COMPARISON",
      value: geometricRelativeReturn,
      period,
      portfolioReturn,
      benchmarkReturn,
      percentagePointDifference,
      geometricRelativeReturn,
      benchmarkKind: kind || null,
      portfolioCurrency: portfolioCurrency || null,
      benchmarkCurrency: benchmarkCurrency || null,
      diagnostics: dedupeDiagnostics(diagnostics)
    };
  }

  function wealthSeriesFromInput(input, options, diagnostics) {
    if (isPlainObject(input) && Array.isArray(input.wealthSeries)) {
      return input.wealthSeries.map((row, index) => ({
        date: validDateKey(row?.date),
        value: finiteNumber(row?.value ?? row?.wealthIndex),
        _index: index
      }));
    }
    if (Array.isArray(input) && input.every((row) => typeof row === "number")) {
      return input.map((value, index) => ({ date: String(index).padStart(10, "0"), value, _index: index, ordinal: true }));
    }
    if (isPlainObject(input) && Array.isArray(input.returns) && !inputObservations(input)) {
      const returns = input.returns;
      const startDate = validDateKey(input.startDate) || validDateKey(returns[0]?.startDate);
      const points = [{ date: startDate, value: 1, _index: 0 }];
      let wealth = 1;
      returns.forEach((row, index) => {
        const rate = finiteNumber(typeof row === "number" ? row : row?.return ?? row?.value);
        const date = validDateKey(row?.endDate ?? row?.date);
        if (rate === null || rate < -1 || !date) {
          diagnostics.push(error("INVALID_RISK_RETURN", `위험지표 수익률 ${index + 1}이 올바르지 않습니다.`, { index }));
          return;
        }
        wealth *= 1 + rate;
        points.push({ date, value: wealth, _index: index + 1 });
      });
      return points;
    }
    const observations = inputObservations(input);
    if (observations) {
      const series = asPerformanceSeries(input, options);
      diagnostics.push(...series.diagnostics);
      if (!series.observations.length) return [];
      let wealth = 1;
      const points = [{ date: series.observations[0].date, value: wealth, _index: 0 }];
      series.returns.forEach((row, index) => {
        wealth *= 1 + row.return;
        points.push({ date: row.endDate, value: wealth, _index: index + 1 });
      });
      return points;
    }
    return [];
  }

  function calculateDrawdown(input, options = {}) {
    const diagnostics = [];
    const rawPoints = wealthSeriesFromInput(input, options, diagnostics);
    if (!rawPoints.length) diagnostics.push(error("INSUFFICIENT_WEALTH_SERIES", "낙폭에는 누적 성과 관측점이 필요합니다."));
    const ordinal = rawPoints.every((row) => row.ordinal);
    const points = rawPoints
      .filter((row, index) => {
        if ((!row.date && !row.ordinal) || row.value === null || row.value < 0) {
          diagnostics.push(error("INVALID_WEALTH_POINT", `누적 성과 관측점 ${index + 1}이 올바르지 않습니다.`, {
            index
          }));
          return false;
        }
        return true;
      })
      .sort((left, right) => ordinal
        ? left._index - right._index
        : compareText(left.date, right.date) || left._index - right._index);
    if (!ordinal) {
      for (let index = 1; index < points.length; index += 1) {
        if (points[index - 1].date === points[index].date) {
          diagnostics.push(error(
            "DUPLICATE_WEALTH_DATE",
            `${points[index].date}에 누적 성과 관측점이 여러 개 있습니다.`,
            { date: points[index].date }
          ));
        }
      }
    }
    if (points.length < 2) diagnostics.push(error("INSUFFICIENT_WEALTH_SERIES", "낙폭에는 최소 2개의 관측점이 필요합니다."));
    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("MAX_DRAWDOWN_FROM_TWR_WEALTH", diagnostics, {
        maxDrawdown: null,
        peakDate: null,
        troughDate: null,
        recoveryDate: null
      });
    }

    let runningPeak = points[0].value;
    let runningPeakIndex = 0;
    let maxDrawdown = 0;
    let peakIndex = 0;
    let troughIndex = 0;
    points.forEach((point, index) => {
      if (point.value > runningPeak) {
        runningPeak = point.value;
        runningPeakIndex = index;
      }
      const drawdown = runningPeak > 0 ? point.value / runningPeak - 1 : 0;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
        peakIndex = runningPeakIndex;
        troughIndex = index;
      }
    });
    const peak = points[peakIndex];
    const trough = points[troughIndex];
    let recoveryIndex = maxDrawdown === 0 ? troughIndex : null;
    if (maxDrawdown < 0) {
      const recoveryTolerance = Number.EPSILON * 32 * Math.max(1, Math.abs(peak.value));
      for (let index = troughIndex + 1; index < points.length; index += 1) {
        if (points[index].value + recoveryTolerance >= peak.value) {
          recoveryIndex = index;
          break;
        }
      }
    }
    const recovery = recoveryIndex === null ? null : points[recoveryIndex];
    const calendarDuration = (left, right) => {
      if (ordinal) return right._index - left._index;
      return daysBetween(left.date, right.date);
    };
    const drawdowns = [];
    runningPeak = points[0].value;
    points.forEach((point) => {
      runningPeak = Math.max(runningPeak, point.value);
      drawdowns.push({
        date: point.date,
        wealthIndex: point.value,
        drawdown: runningPeak > 0 ? canonicalZero(point.value / runningPeak - 1) : 0
      });
    });
    return {
      ok: true,
      availability: availabilityFromDiagnostics(diagnostics),
      method: "MAX_DRAWDOWN_FROM_TWR_WEALTH",
      value: canonicalZero(maxDrawdown),
      maxDrawdown: canonicalZero(maxDrawdown),
      peakDate: peak.date,
      troughDate: trough.date,
      recoveryDate: recovery?.date || null,
      peakValue: peak.value,
      troughValue: trough.value,
      recovered: recovery !== null,
      declineDays: calendarDuration(peak, trough),
      recoveryDays: recovery ? calendarDuration(trough, recovery) : null,
      underwaterDays: recovery ? calendarDuration(peak, recovery) : calendarDuration(peak, points.at(-1)),
      declineObservations: troughIndex - peakIndex,
      recoveryObservations: recoveryIndex === null ? null : recoveryIndex - troughIndex,
      underwaterObservations: recoveryIndex === null
        ? points.length - 1 - peakIndex
        : recoveryIndex - peakIndex,
      drawdowns,
      diagnostics: dedupeDiagnostics(diagnostics)
    };
  }

  function returnsFromInput(input, options, diagnostics) {
    if (Array.isArray(input) && input.every((row) => typeof row === "number")) return [...input];
    if (isPlainObject(input) && Array.isArray(input.returns) && !inputObservations(input)) {
      return input.returns.map((row) => typeof row === "number" ? row : row?.return ?? row?.value);
    }
    const observations = inputObservations(input);
    if (observations) {
      const series = asPerformanceSeries(input, options);
      diagnostics.push(...series.diagnostics);
      return series.returns.map((row) => row.return);
    }
    return [];
  }

  function calculateVolatility(input, options = {}) {
    const diagnostics = [];
    const resolvedOptions = mergedOptions(input, options);
    const rawReturns = returnsFromInput(input, resolvedOptions, diagnostics);
    const returns = [];
    rawReturns.forEach((value, index) => {
      const numeric = finiteNumber(value);
      if (numeric === null || numeric <= -1) {
        diagnostics.push(error(
          "INVALID_LOG_RETURN",
          `수익률 ${index + 1}은(는) 로그수익률로 변환할 수 없습니다.`,
          { index, value }
        ));
        return;
      }
      returns.push(numeric);
    });
    if (returns.length < 2) {
      diagnostics.push(error("INSUFFICIENT_VOLATILITY_OBSERVATIONS", "변동성에는 최소 2개의 수익률이 필요합니다."));
    }
    const annualizationFactor = finiteNumber(
      resolvedOptions.annualizationFactor ?? input?.annualizationFactor ?? DEFAULT_ANNUALIZATION_FACTOR
    );
    if (!(annualizationFactor > 0)) {
      diagnostics.push(error("INVALID_ANNUALIZATION_FACTOR", "변동성 연환산 계수는 0보다 커야 합니다."));
    }
    if (diagnostics.some((item) => item.severity === "error")) {
      return unavailableMetric("ANNUALIZED_LOG_RETURN_SAMPLE_VOLATILITY", diagnostics, {
        observationCount: returns.length,
        annualizationFactor,
        sampleStandardDeviation: null,
        annualizedVolatility: null
      });
    }
    const logs = returns.map((rate) => Math.log1p(rate));
    const mean = logs.reduce((sum, value) => sum + value, 0) / logs.length;
    const variance = logs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (logs.length - 1);
    const sampleStandardDeviation = Math.sqrt(Math.max(0, variance));
    const annualizedVolatility = sampleStandardDeviation * Math.sqrt(annualizationFactor);
    const minimumDisplayObservations = Number.isSafeInteger(Number(resolvedOptions.minimumDisplayObservations))
      && Number(resolvedOptions.minimumDisplayObservations) >= 2
      ? Number(resolvedOptions.minimumDisplayObservations)
      : 20;
    if (returns.length < minimumDisplayObservations) {
      diagnostics.push(warning(
        "LIMITED_VOLATILITY_SAMPLE",
        `변동성 관측치가 ${returns.length}개로 ${minimumDisplayObservations}개보다 적습니다.`,
        { observationCount: returns.length, minimumDisplayObservations }
      ));
    }
    return {
      ok: true,
      availability: availabilityFromDiagnostics(diagnostics),
      method: "ANNUALIZED_LOG_RETURN_SAMPLE_VOLATILITY",
      value: canonicalZero(annualizedVolatility),
      observationCount: returns.length,
      annualizationFactor,
      meanLogReturn: canonicalZero(mean),
      sampleStandardDeviation: canonicalZero(sampleStandardDeviation),
      annualizedVolatility: canonicalZero(annualizedVolatility),
      displayEligible: returns.length >= minimumDisplayObservations,
      diagnostics: dedupeDiagnostics(diagnostics)
    };
  }

  function analyzePerformance(input, options = {}) {
    const series = buildPerformanceSeries(input, options);
    const twr = calculateTwr(series, options);
    const xirr = calculateXirr(series, options);
    const drawdown = calculateDrawdown(series, options);
    const volatility = calculateVolatility(series, options);
    const hasAttribution = series.observations.some((row) => row.attribution);
    const hasBenchmark = series.observations.some((row) => row.benchmark)
      || isPlainObject(input?.benchmark)
      || finiteNumber(input?.benchmarkReturn) !== null;
    const attribution = hasAttribution ? decomposeValueChange(series, options) : null;
    const benchmark = hasBenchmark ? compareBenchmark({ ...input, observations: series.observations, twr }, options) : null;
    const metrics = [series, twr, xirr, drawdown, volatility, attribution, benchmark].filter(Boolean);
    const diagnostics = dedupeDiagnostics(metrics.flatMap((metric) => metric.diagnostics || []));
    return {
      ok: series.ok && twr.ok && xirr.ok && drawdown.ok && volatility.ok
        && (!attribution || attribution.ok)
        && (!benchmark || benchmark.ok),
      availability: worstAvailability(...metrics.map((metric) => metric.availability)),
      method: "ASSETTRAIL_PERFORMANCE_ANALYSIS_V1",
      value: twr.value,
      period: series.period,
      series,
      twr,
      xirr,
      attribution,
      benchmark,
      drawdown,
      volatility,
      diagnostics
    };
  }

  return Object.freeze({
    buildPerformanceSeries,
    calculateTwr,
    calculateXirr,
    decomposeValueChange,
    compareBenchmark,
    calculateDrawdown,
    calculateVolatility,
    analyzePerformance
  });
});
