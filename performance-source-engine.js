(function attachPerformanceSource(root, factory) {
  const api = factory(
    () => root?.AssetTrailLedgerEngine || (typeof require === "function" ? require("./ledger-engine.js") : null),
    () => root?.AssetTrailPerformanceEngine || (typeof require === "function" ? require("./performance-engine.js") : null)
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailPerformanceSourceEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPerformanceSource(ledgerEngine, performanceEngine) {
  "use strict";
  const PERFORMANCE_CUTOFF = "END_OF_DAY_POST_FLOW";
  const PERFORMANCE_EVIDENCE_STALE_DAYS = 7;
  const IMPORT_STRING_LIMITS = { id: 160, short: 500 };
  function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function normalizeStoredDate(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return null;
    return new Date(value).toISOString();
  }

  function normalizeDateKey(value) {
    const key = String(value || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function boundedPerformanceNumber(value, fallback = 0, { nonNegative = false } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) > 1e15) return fallback;
    if (nonNegative && number < 0) return fallback;
    return number;
  }

  function normalizePerformanceObservation(observation, index = 0) {
    const source = isPlainObject(observation) ? observation : {};
    const capturedAt = normalizeStoredDate(source.capturedAt) || new Date(0).toISOString();
    const date = normalizeDateKey(source.date) || capturedAt.slice(0, 10);
    const validRawNumber = (value, { nonNegative = false } = {}) => value !== ""
      && value !== null
      && value !== undefined
      && Number.isFinite(Number(value))
      && (!nonNegative || Number(value) >= 0);
    const requiredNonNegative = ["navKRW", "marketValueKRW", "manualValueKRW",
      "usMarketValueNative", "usMarketValueKRW", "usdKrw"];
    const requiredSigned = ["cashKRW", "unsettledKRW"];
    const requiredCumulative = ["externalFlowKRW", "depositsKRW", "withdrawalsKRW", "dividendsKRW",
      "interestKRW", "feesKRW", "taxesKRW", "fxDifferenceKRW"];
    const normalizationAdjusted = !normalizeStoredDate(source.capturedAt)
      || !normalizeDateKey(source.date)
      || String(source.cutoff || "").trim().toUpperCase() !== PERFORMANCE_CUTOFF
      || !requiredNonNegative.every((field) => validRawNumber(source[field], { nonNegative: true }))
      || !requiredSigned.every((field) => validRawNumber(source[field]))
      || !isPlainObject(source.typeTotals)
      || !["KRX", "US", "CASH", "MANUAL"].every((type) => validRawNumber(
        source.typeTotals?.[type],
        { nonNegative: type !== "CASH" }
      ))
      || !isPlainObject(source.cumulative)
      || !requiredCumulative.every((field) => validRawNumber(source.cumulative?.[field]));
    const typeTotals = {};
    if (isPlainObject(source.typeTotals)) {
      ["KRX", "US", "CASH", "MANUAL"].forEach((type) => {
        const value = Number(source.typeTotals[type]);
        if (Number.isFinite(value) && (type === "CASH" || value >= 0)) typeTotals[type] = value;
      });
    }
    const cumulativeSource = isPlainObject(source.cumulative) ? source.cumulative : {};
    const cumulative = {
      externalFlowKRW: boundedPerformanceNumber(cumulativeSource.externalFlowKRW),
      depositsKRW: boundedPerformanceNumber(cumulativeSource.depositsKRW, 0, { nonNegative: true }),
      withdrawalsKRW: boundedPerformanceNumber(cumulativeSource.withdrawalsKRW, 0, { nonNegative: true }),
      dividendsKRW: boundedPerformanceNumber(cumulativeSource.dividendsKRW, 0, { nonNegative: true }),
      interestKRW: boundedPerformanceNumber(cumulativeSource.interestKRW, 0, { nonNegative: true }),
      feesKRW: boundedPerformanceNumber(cumulativeSource.feesKRW, 0, { nonNegative: true }),
      taxesKRW: boundedPerformanceNumber(cumulativeSource.taxesKRW, 0, { nonNegative: true }),
      fxDifferenceKRW: boundedPerformanceNumber(cumulativeSource.fxDifferenceKRW)
    };
    const benchmarkLevels = {};
    if (isPlainObject(source.benchmarkLevels)) {
      ["KOSPI", "SP500"].forEach((key) => {
        const item = isPlainObject(source.benchmarkLevels[key]) ? source.benchmarkLevels[key] : {};
        const level = Number(item.level);
        const benchmarkDate = normalizeDateKey(item.date);
        if (!(level > 0) || !benchmarkDate) return;
        benchmarkLevels[key] = {
          level,
          date: benchmarkDate,
          currency: String(item.currency || "").trim().toUpperCase(),
          returnType: String(item.returnType || "UNKNOWN").trim().toUpperCase(),
          source: String(item.source || "").trim().slice(0, IMPORT_STRING_LIMITS.short),
          priceBasis: String(item.priceBasis || "").trim().toUpperCase(),
          distributionTreatment: String(item.distributionTreatment || "").trim().toUpperCase(),
          levelUnit: String(item.levelUnit || "").trim().toUpperCase()
        };
      });
    }
    let completeness = ["COMPLETE", "LIMITED", "INCOMPLETE"].includes(String(source.completeness || "").toUpperCase())
      ? String(source.completeness).toUpperCase()
      : "INCOMPLETE";
    const issueCodes = Array.isArray(source.issueCodes)
      ? [...new Set(source.issueCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean))].slice(0, 30)
      : [];
    if (normalizationAdjusted) {
      completeness = "INCOMPLETE";
      if (!issueCodes.includes("NORMALIZATION_ADJUSTED")) issueCodes.push("NORMALIZATION_ADJUSTED");
    }
    issueCodes.splice(30);
    return {
      id: String(source.id || `performance-${date}-${index}`).slice(0, IMPORT_STRING_LIMITS.id),
      date,
      capturedAt,
      cutoff: String(source.cutoff || PERFORMANCE_CUTOFF).trim().toUpperCase() === PERFORMANCE_CUTOFF
        ? PERFORMANCE_CUTOFF
        : PERFORMANCE_CUTOFF,
      source: String(source.source || "AUTOMATIC_PRICE_CLOSE").trim().toUpperCase().slice(0, 80),
      snapshotId: String(source.snapshotId || "").slice(0, IMPORT_STRING_LIMITS.id),
      navKRW: boundedPerformanceNumber(source.navKRW, 0, { nonNegative: true }),
      marketValueKRW: boundedPerformanceNumber(source.marketValueKRW, 0, { nonNegative: true }),
      cashKRW: boundedPerformanceNumber(source.cashKRW),
      manualValueKRW: boundedPerformanceNumber(source.manualValueKRW, 0, { nonNegative: true }),
      unsettledKRW: boundedPerformanceNumber(source.unsettledKRW),
      usMarketValueNative: boundedPerformanceNumber(source.usMarketValueNative, 0, { nonNegative: true }),
      usMarketValueKRW: boundedPerformanceNumber(source.usMarketValueKRW, 0, { nonNegative: true }),
      usdKrw: boundedPerformanceNumber(source.usdKrw, 0, { nonNegative: true }),
      usdKrwDate: normalizeDateKey(source.usdKrwDate),
      typeTotals,
      cumulative,
      benchmarkLevels,
      priceBasis: String(source.priceBasis || "").trim().toUpperCase().slice(0, 80),
      distributionTreatment: String(source.distributionTreatment || "").trim().toUpperCase().slice(0, 80),
      ledgerAsOfFingerprint: String(source.ledgerAsOfFingerprint || "").slice(0, IMPORT_STRING_LIMITS.short),
      priceFingerprint: String(source.priceFingerprint || "").slice(0, IMPORT_STRING_LIMITS.short),
      markFingerprint: String(source.markFingerprint || "").slice(0, IMPORT_STRING_LIMITS.short),
      completeness,
      issueCodes
    };
  }

  function strongDeterministicFingerprint(prefix, value) {
    const canonical = typeof value === "string" ? value : JSON.stringify(value);
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let index = 0; index < canonical.length; index += 1) {
      const code = canonical.charCodeAt(index);
      h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    const digest = [h1, h2, h3, h4]
      .map((valuePart) => (valuePart >>> 0).toString(16).padStart(8, "0"))
      .join("");
    return `${prefix}:${digest}`;
  }

  function performanceObservationFingerprint(observation) {
    const benchmarkLevels = Object.fromEntries(["KOSPI", "SP500"]
      .filter((key) => observation?.benchmarkLevels?.[key])
      .map((key) => [key, observation.benchmarkLevels[key]]));
    return strongDeterministicFingerprint("performance-mark-v1", {
      id: observation?.id || "",
      date: observation?.date || "",
      capturedAt: observation?.capturedAt || "",
      cutoff: observation?.cutoff || "",
      source: observation?.source || "",
      snapshotId: observation?.snapshotId || "",
      navKRW: Number(observation?.navKRW || 0),
      marketValueKRW: Number(observation?.marketValueKRW || 0),
      cashKRW: Number(observation?.cashKRW || 0),
      manualValueKRW: Number(observation?.manualValueKRW || 0),
      unsettledKRW: Number(observation?.unsettledKRW || 0),
      usMarketValueNative: Number(observation?.usMarketValueNative || 0),
      usMarketValueKRW: Number(observation?.usMarketValueKRW || 0),
      usdKrw: Number(observation?.usdKrw || 0),
      usdKrwDate: observation?.usdKrwDate || "",
      typeTotals: observation?.typeTotals || {},
      cumulative: observation?.cumulative || {},
      benchmarkLevels,
      priceBasis: observation?.priceBasis || "",
      distributionTreatment: observation?.distributionTreatment || "",
      ledgerAsOfFingerprint: observation?.ledgerAsOfFingerprint || "",
      priceFingerprint: observation?.priceFingerprint || "",
      completeness: observation?.completeness || "",
      issueCodes: [...(observation?.issueCodes || [])].sort()
    });
  }

  function performanceNumbersClose(left, right) {
    const a = Number(left);
    const b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= Math.max(0.01, Math.abs(a) * 1e-9, Math.abs(b) * 1e-9);
  }

  function performanceObservationIdentityValid(observation) {
    const cumulative = observation?.cumulative || {};
    const typeTotals = observation?.typeTotals || {};
    const navIdentity = Number(observation?.marketValueKRW || 0)
      + Number(observation?.manualValueKRW || 0)
      + Number(observation?.cashKRW || 0)
      + Number(observation?.unsettledKRW || 0);
    const marketIdentity = Number(typeTotals.KRX || 0) + Number(typeTotals.US || 0);
    const externalIdentity = Number(cumulative.depositsKRW || 0) - Number(cumulative.withdrawalsKRW || 0);
    const usNative = Number(observation?.usMarketValueNative || 0);
    const usKrwIdentity = usNative * Number(observation?.usdKrw || 0);
    return performanceNumbersClose(observation?.navKRW, navIdentity)
      && performanceNumbersClose(observation?.marketValueKRW, marketIdentity)
      && performanceNumbersClose(cumulative.externalFlowKRW, externalIdentity)
      && performanceNumbersClose(observation?.manualValueKRW, typeTotals.MANUAL || 0)
      && performanceNumbersClose(
        typeTotals.CASH || 0,
        Number(observation?.cashKRW || 0) + Number(observation?.unsettledKRW || 0)
      )
      && (usNative === 0 || performanceNumbersClose(observation?.usMarketValueKRW, usKrwIdentity));
  }

  function performanceEventDate(event) {
    if (["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX", "CASH_ADJUSTMENT", "FX"].includes(event?.type)) {
      return event.settlementDate || event.tradeDate || "";
    }
    if (event?.type === "OPENING_BALANCE" && event.balanceKind === "CASH") {
      return event.settlementDate || event.tradeDate || "";
    }
    return event?.tradeDate || "";
  }

  function externalPerformanceFlows(startDate, endDate, activeEvents) {
    return activeEvents
      .filter((event) => ["DEPOSIT", "WITHDRAWAL"].includes(event.type))
      .map((event) => ({
        date: event.settlementDate || event.tradeDate,
        amountKRW: event.type === "DEPOSIT" ? Number(event.amountKRW || 0) : -Number(event.amountKRW || 0),
        type: event.type
      }))
      .filter((row) => row.date > startDate && row.date <= endDate && row.amountKRW !== 0)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  function performanceXirr(engine, dataset) {
    if (!engine || dataset.marks.length < 2 || !dataset.boundaryExact) return null;
    const first = dataset.marks[0];
    const last = dataset.marks.at(-1);
    const cashFlows = [{ date: first.date, amountKRW: -first.navKRW }];
    dataset.flows.forEach((flow) => cashFlows.push({
      date: flow.date,
      amountKRW: -flow.amountKRW
    }));
    cashFlows.push({ date: last.date, amountKRW: last.navKRW });
    return engine.calculateXirr({ cashFlows });
  }

  function performanceLedgerFingerprintAsOf(date, activeEvents) {
    return ledgerEngine().fingerprintLedger(activeEvents.filter(event => performanceEventDate(event) <= date));
  }

  function buildDataset({ performanceObservations, events, baselineDate, startDate, endDate, benchmarkKey = "" }) {
    if (!Array.isArray(performanceObservations) || performanceObservations.length > 10000
        || !Array.isArray(events) || events.length > 50000) throw new Error("INVALID_PERFORMANCE_SOURCE");
    const bounds = { startDate, endDate };
    const validated = ledgerEngine().validateLedger(events, { baselineDate: baselineDate || undefined });
    if (!validated.ok) throw new Error("INVALID_PERFORMANCE_LEDGER");
    const marks = performanceObservations
      .map(normalizePerformanceObservation)
      .filter((mark) => mark.date >= bounds.startDate && mark.date <= bounds.endDate)
      .sort((left, right) => left.date.localeCompare(right.date) || left.capturedAt.localeCompare(right.capturedAt));
    const activeEvents = validated.activeEvents;
    const observations = marks.map((mark, index) => {
      const previous = marks[index - 1];
      const currentLedgerFingerprint = performanceLedgerFingerprintAsOf(mark.date, activeEvents);
      const exactMark = mark.completeness === "COMPLETE"
        && mark.cutoff === PERFORMANCE_CUTOFF
        && mark.priceBasis === "UNADJUSTED_CLOSE"
        && mark.distributionTreatment === "EXCLUDED"
        && mark.issueCodes.length === 0
        && performanceObservationIdentityValid(mark)
        && Boolean(mark.ledgerAsOfFingerprint)
        && mark.ledgerAsOfFingerprint === currentLedgerFingerprint
        && /^performance-price-v1:[a-f0-9]{32}$/.test(mark.priceFingerprint)
        && /^performance-mark-v1:[a-f0-9]{32}$/.test(mark.markFingerprint)
        && mark.markFingerprint === performanceObservationFingerprint(mark);
      const row = {
        date: mark.date,
        navKRW: mark.navKRW,
        externalFlowKRW: previous
          ? mark.cumulative.externalFlowKRW - previous.cumulative.externalFlowKRW
          : 0,
        completeness: exactMark,
        ledgerFingerprint: mark.ledgerAsOfFingerprint,
        priceFingerprint: mark.priceFingerprint
      };
      if (previous) {
        const dividendKRW = mark.cumulative.dividendsKRW - previous.cumulative.dividendsKRW;
        const interestKRW = mark.cumulative.interestKRW - previous.cumulative.interestKRW;
        const feeKRW = mark.cumulative.feesKRW - previous.cumulative.feesKRW;
        const taxKRW = mark.cumulative.taxesKRW - previous.cumulative.taxesKRW;
        const externalFlowKRW = row.externalFlowKRW;
        const manualValuationEffectKRW = mark.manualValueKRW - previous.manualValueKRW;
        const marketFxEffectKRW = ((previous.usMarketValueNative + mark.usMarketValueNative) / 2)
          * (mark.usdKrw - previous.usdKrw);
        const ledgerFxEffectKRW = mark.cumulative.fxDifferenceKRW - previous.cumulative.fxDifferenceKRW;
        const fxEffectKRW = marketFxEffectKRW + ledgerFxEffectKRW;
        const totalChangeKRW = mark.navKRW - previous.navKRW;
        const priceEffectKRW = totalChangeKRW
          - externalFlowKRW
          - fxEffectKRW
          - dividendKRW
          - interestKRW
          + feeKRW
          + taxKRW
          - manualValuationEffectKRW;
        row.attribution = {
          priceEffectKRW,
          fxEffectKRW,
          dividendKRW,
          interestKRW,
          feeKRW,
          taxKRW,
          manualValuationEffectKRW,
          otherEffectKRW: 0
        };
      }
      if (["KOSPI", "SP500"].includes(benchmarkKey)) {
        const benchmark = mark.benchmarkLevels[benchmarkKey];
        const expectedCurrency = benchmarkKey === "SP500" ? "USD" : "KRW";
        const methodologyVerified = benchmark?.currency === expectedCurrency
          && benchmark?.returnType === "PRICE_ONLY"
          && benchmark?.priceBasis === "PRICE_INDEX_LEVEL"
          && benchmark?.distributionTreatment === "EXCLUDED"
          && benchmark?.levelUnit === "INDEX_POINTS";
        const fxDateVerified = benchmarkKey !== "SP500" || mark.usdKrwDate === mark.date;
        if (benchmark && benchmark.date === mark.date && methodologyVerified && fxDateVerified) {
          const krwLevel = benchmarkKey === "SP500" ? benchmark.level * mark.usdKrw : benchmark.level;
          if (krwLevel > 0) {
            row.benchmark = {
              level: krwLevel,
              kind: benchmark.returnType || "PRICE_ONLY",
              currency: "KRW",
              source: benchmark.source
            };
          }
        }
      }
      return row;
    });
    const first = marks[0];
    const last = marks.at(-1);
    const flows = first && last ? externalPerformanceFlows(first.date, last.date, activeEvents) : [];
    const observationDates = new Set(marks.map((mark) => mark.date));
    const missingFlowDates = [...new Set(flows.map((flow) => flow.date).filter((date) => !observationDates.has(date)))];
    const boundaryExact = observations.length >= 2
      && observations[0].completeness === true
      && observations.at(-1).completeness === true;
    return { marks, observations, flows, missingFlowDates, activeEvents, boundaryExact };
  }

  function buildEvidence({ performanceObservations, events, baselineDate, todayKey, benchmarkKey = "" }) {
    if (!normalizeDateKey(todayKey) || normalizeDateKey(todayKey) !== todayKey) throw new Error("INVALID_PERFORMANCE_TODAY");
    if (!Array.isArray(performanceObservations) || performanceObservations.length > 10000) throw new Error("INVALID_PERFORMANCE_SOURCE");
    const marks = performanceObservations.map(normalizePerformanceObservation)
      .sort((left, right) => left.date.localeCompare(right.date));
    const engine = performanceEngine();
    if (!engine || marks.length < 2) return { status: "INCOMPLETE", facts: [], asOfDate: marks.at(-1)?.date || todayKey };
    const bounds = {
      startDate: marks[0].date,
      endDate: marks.at(-1).date,
      baselineDate: normalizeDateKey(baselineDate),
      error: ""
    };
    const dataset = buildDataset({ performanceObservations, events, baselineDate, benchmarkKey, ...bounds });
    const analysis = dataset.observations.length >= 2
      ? engine.analyzePerformance({ observations: dataset.observations })
      : null;
    const exact = Boolean(
      dataset.boundaryExact
      && dataset.observations.length === dataset.marks.length
      && dataset.observations.every((observation) => observation.completeness === true)
      && !dataset.missingFlowDates.length
      && analysis?.series?.ok
      && analysis.series.availability === "VERIFIED"
      && analysis?.twr?.ok
      && analysis.twr.availability === "VERIFIED"
    );
    const asOfDate = marks.at(-1)?.date || todayKey;
    const ageDays = (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${asOfDate}T00:00:00Z`)) / 86400000;
    const status = !exact || ageDays < 0 || !Number.isFinite(ageDays)
      ? "INCOMPLETE"
      : ageDays > PERFORMANCE_EVIDENCE_STALE_DAYS ? "STALE" : "VERIFIED";
    const facts = [];
    if (exact) {
      facts.push({ metric: "TWR_RETURN", returnRate: analysis.twr.periodReturn });
      if (analysis.drawdown?.ok) facts.push({ metric: "MAX_DRAWDOWN", returnRate: analysis.drawdown.maxDrawdown });
      const irregular = (analysis.series?.quality?.irregularGapCount || 0) > 0;
      if (analysis.volatility?.ok && analysis.volatility.displayEligible && !irregular) {
        facts.push({ metric: "ANNUALIZED_VOLATILITY", returnRate: analysis.volatility.annualizedVolatility });
      }
    }
    const xirr = performanceXirr(engine, dataset);
    if (exact && xirr?.ok && xirr.availability === "VERIFIED") {
      facts.push({ metric: "XIRR_RETURN", returnRate: xirr.annualizedReturn });
    }
    return {
      status,
      facts,
      asOfDate
    };
  }

  function buildReviewPerformance(input) {
    const evidence = buildEvidence(input);
    const facts = Object.fromEntries((evidence.facts || []).map((fact) => [fact.metric, fact.returnRate]));
    const observations = input.performanceObservations.map(normalizePerformanceObservation)
      .sort((left, right) => left.date.localeCompare(right.date));
    return {
      status: evidence.status || "INCOMPLETE",
      startDate: observations[0]?.date || null,
      endDate: observations.at(-1)?.date || null,
      twrPct: Number.isFinite(facts.TWR_RETURN) ? facts.TWR_RETURN * 100 : null,
      xirrPct: Number.isFinite(facts.XIRR_RETURN) ? facts.XIRR_RETURN * 100 : null,
      maxDrawdownPct: Number.isFinite(facts.MAX_DRAWDOWN) ? facts.MAX_DRAWDOWN * 100 : null,
      annualizedVolatilityPct: Number.isFinite(facts.ANNUALIZED_VOLATILITY)
        ? facts.ANNUALIZED_VOLATILITY * 100
        : null
    };
  }
  return Object.freeze({ normalizePerformanceObservation, strongDeterministicFingerprint,
    performanceObservationFingerprint, performanceObservationIdentityValid, performanceNumbersClose,
    performanceEventDate, performanceLedgerFingerprintAsOf, externalPerformanceFlows,
    performanceXirr, buildDataset, buildEvidence, buildReviewPerformance });
});
