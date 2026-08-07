(function attachAssetTrailEtfExposureEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailEtfExposureEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEtfExposureEngine() {
  "use strict";

  const SCHEMA_VERSION = "assettrail.etf-holdings.v1";
  const METHOD = "ASSETTRAIL_ETF_LOOK_THROUGH_V1";
  const DEFAULT_WEIGHT_TOLERANCE = 1e-6;
  const DEFAULT_MAX_DEPTH = 8;
  const MAX_MAX_DEPTH = 32;
  const MAX_FUNDS = 500;
  const MAX_HOLDINGS_PER_FUND = 2000;
  const MAX_TOTAL_HOLDINGS = 25000;
  const MAX_POSITIONS = 10000;
  const MAX_EXPANSION_STEPS = 25000;
  const MAX_URL_LENGTH = 2048;
  const MAX_FUTURE_RETRIEVAL_SKEW_MS = 5 * 60 * 1000;
  const VALUE_DIGITS = 8;
  const WEIGHT_DIGITS = 12;
  const ELIGIBLE_REDISTRIBUTION = new Set(["ALLOWED", "USER_SUPPLIED"]);
  const SPECIAL_BUCKETS = new Set([
    "CASH",
    "OTHER",
    "UNMAPPED",
    "UNREPORTED",
    "UNSUPPORTED"
  ]);
  const ETF_KINDS = new Set(["ETF", "FUND", "ETN"]);
  const QUALITY_LIMITING_WARNING_CODES = new Set([
    "POSITION_KIND_CATALOG_CONFLICT",
    "HOLDING_KIND_CATALOG_CONFLICT"
  ]);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function upper(value) {
    return text(value).toUpperCase();
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function round(value, digits = VALUE_DIGITS) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function cloneJson(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function validDateKey(value) {
    const key = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function validTimestamp(value) {
    const raw = text(value);
    if (!raw) return "";
    const timestamp = new Date(raw);
    return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : "";
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
    return compareText(left.fundId, right.fundId)
      || Number(left.fundIndex ?? -1) - Number(right.fundIndex ?? -1)
      || Number(left.holdingIndex ?? -1) - Number(right.holdingIndex ?? -1)
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
          item.fundId || "",
          item.fundIndex ?? "",
          item.holdingIndex ?? "",
          item.positionIndex ?? "",
          item.message
        ]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(compareDiagnostics);
  }

  function marketAlias(value) {
    const market = upper(value);
    if (["KRX", "XKRX", "KOREA", "KOSPI", "KOSDAQ"].includes(market)) return "KRX";
    if (["US", "USA", "NASDAQ", "NYSE", "AMEX"].includes(market)) return "US";
    return market;
  }

  /**
   * Converts a market/ticker pair into AssetTrail's stable economic identifier.
   *
   * Supported calls:
   *   normalizeInstrumentId("KRX", "005930")
   *   normalizeInstrumentId("KRX:0092B0")
   *   normalizeInstrumentId({ market: "US", ticker: "BRK.B" })
   *
   * An empty string is returned for an ambiguous or malformed identifier. In
   * particular, alphanumeric KRX tickers must already have exactly six places;
   * numeric KRX codes with fewer places are left-padded for legacy asset rows.
   */
  function normalizeInstrumentId(value, tickerValue) {
    let market = "";
    let ticker = "";

    if (tickerValue !== undefined) {
      market = marketAlias(value);
      ticker = upper(tickerValue);
    } else if (isPlainObject(value)) {
      const explicit = text(value.instrumentId ?? value.id);
      if (explicit.includes(":")) return normalizeInstrumentId(explicit);
      market = marketAlias(value.market ?? value.exchange ?? value.type);
      ticker = upper(value.ticker ?? value.symbol ?? value.code ?? explicit);
    } else {
      const raw = upper(value);
      const separator = raw.indexOf(":");
      if (separator > 0) {
        market = marketAlias(raw.slice(0, separator));
        ticker = raw.slice(separator + 1).trim();
      } else if (/^(?=.*\d)[A-Z0-9]{6}$/.test(raw)) {
        market = "KRX";
        ticker = raw;
      } else {
        return "";
      }
    }

    if (market === "KRX") {
      if (/^\d{1,6}$/.test(ticker)) ticker = ticker.padStart(6, "0");
      if (!/^[A-Z0-9]{6}$/.test(ticker)) return "";
      return `KRX:${ticker}`;
    }
    if (market === "US") {
      if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return "";
      if (ticker.includes("..") || ticker.includes("--") || /[.-]$/.test(ticker)) return "";
      return `US:${ticker}`;
    }
    return "";
  }

  function normalizeSource(raw, diagnostics, context) {
    let name = "";
    let url = "";
    let retrievedAt = "";

    if (typeof raw === "string") {
      url = text(raw);
      name = url;
    } else if (isPlainObject(raw)) {
      name = text(raw.name ?? raw.provider ?? raw.label);
      url = text(raw.url ?? raw.uri ?? raw.href);
      retrievedAt = text(raw.retrievedAt ?? raw.fetchedAt);
    }

    if (!url) {
      diagnostics.push(error("MISSING_SOURCE_URL", "구성종목 출처 URL이 필요합니다.", context));
      return null;
    }
    if (url.length > MAX_URL_LENGTH) {
      diagnostics.push(error(
        "SOURCE_URL_TOO_LONG",
        `구성종목 출처 URL은 ${MAX_URL_LENGTH}자 이하여야 합니다.`,
        context
      ));
      return null;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      diagnostics.push(error("INVALID_SOURCE_URL", "구성종목 출처 URL이 올바르지 않습니다.", context));
      return null;
    }
    if (parsed.protocol !== "https:") {
      diagnostics.push(error("UNSUPPORTED_SOURCE_PROTOCOL", "구성종목 출처는 HTTPS URL이어야 합니다.", context));
      return null;
    }
    if (parsed.href.length > MAX_URL_LENGTH) {
      diagnostics.push(error(
        "SOURCE_URL_TOO_LONG",
        `구성종목 출처 URL은 정규화 후에도 ${MAX_URL_LENGTH}자 이하여야 합니다.`,
        context
      ));
      return null;
    }
    if (parsed.username || parsed.password || url.includes("?") || url.includes("#")) {
      diagnostics.push(error(
        "UNSAFE_SOURCE_URL",
        "구성종목 출처 URL에는 인증정보, 쿼리 문자열, 프래그먼트를 포함할 수 없습니다.",
        context
      ));
      return null;
    }
    if (!retrievedAt) {
      diagnostics.push(error(
        "MISSING_SOURCE_RETRIEVED_AT",
        "구성종목 출처 조회 시각(retrievedAt)이 필요합니다.",
        context
      ));
      return null;
    }
    if (!validTimestamp(retrievedAt)) {
      diagnostics.push(error("INVALID_SOURCE_RETRIEVED_AT", "출처 조회 시각이 올바른 ISO 시각이 아닙니다.", context));
      return null;
    }
    if (Date.parse(retrievedAt) > Date.now() + MAX_FUTURE_RETRIEVAL_SKEW_MS) {
      diagnostics.push(error(
        "FUTURE_SOURCE_RETRIEVED_AT",
        "출처 조회 시각은 현재 시각보다 미래일 수 없습니다.",
        context
      ));
      return null;
    }
    return {
      name: name || parsed.hostname,
      url: parsed.href,
      retrievedAt: validTimestamp(retrievedAt)
    };
  }

  function normalizeRedistribution(raw, diagnostics, context) {
    let status = "";
    let notice = "";
    let termsUrl = "";
    if (typeof raw === "string") {
      status = upper(raw);
    } else if (raw === true) {
      status = "ALLOWED";
    } else if (raw === false) {
      status = "PROHIBITED";
    } else if (isPlainObject(raw)) {
      status = upper(raw.status ?? raw.permission);
      if (!status && raw.allowed === true) status = "ALLOWED";
      if (!status && raw.allowed === false) status = "PROHIBITED";
      if (!status && raw.userSupplied === true) status = "USER_SUPPLIED";
      notice = text(raw.notice ?? raw.terms ?? raw.label);
      termsUrl = text(raw.termsUrl ?? raw.url);
    }
    if (!status) {
      diagnostics.push(error("MISSING_REDISTRIBUTION_STATUS", "구성종목 재배포 조건이 필요합니다.", context));
      return null;
    }
    if (termsUrl) {
      if (termsUrl.length > MAX_URL_LENGTH) {
        diagnostics.push(error(
          "REDISTRIBUTION_TERMS_URL_TOO_LONG",
          `재배포 조건 URL은 ${MAX_URL_LENGTH}자 이하여야 합니다.`,
          context
        ));
        return null;
      }
      try {
        const parsed = new URL(termsUrl);
        if (parsed.protocol !== "https:") {
          diagnostics.push(error(
            "UNSUPPORTED_REDISTRIBUTION_TERMS_PROTOCOL",
            "재배포 조건 URL은 HTTPS URL이어야 합니다.",
            context
          ));
          return null;
        }
        if (parsed.href.length > MAX_URL_LENGTH) {
          diagnostics.push(error(
            "REDISTRIBUTION_TERMS_URL_TOO_LONG",
            `재배포 조건 URL은 정규화 후에도 ${MAX_URL_LENGTH}자 이하여야 합니다.`,
            context
          ));
          return null;
        }
        if (parsed.username || parsed.password || termsUrl.includes("?") || termsUrl.includes("#")) {
          diagnostics.push(error(
            "UNSAFE_REDISTRIBUTION_TERMS_URL",
            "재배포 조건 URL에는 인증정보, 쿼리 문자열, 프래그먼트를 포함할 수 없습니다.",
            context
          ));
          return null;
        }
        termsUrl = parsed.href;
      } catch {
        diagnostics.push(error("INVALID_REDISTRIBUTION_TERMS_URL", "재배포 조건 URL이 올바르지 않습니다.", context));
        return null;
      }
    }
    return {
      status,
      eligible: ELIGIBLE_REDISTRIBUTION.has(status),
      ...(notice ? { notice } : {}),
      ...(termsUrl ? { termsUrl } : {})
    };
  }

  function normalizeBucket(value) {
    const bucket = upper(value).replace(/[ -]+/g, "_");
    if (["CASH", "EMBEDDED_CASH", "현금"].includes(bucket)) return "CASH";
    if (["OTHER", "기타"].includes(bucket)) return "OTHER";
    if (["UNMAPPED", "미매핑"].includes(bucket)) return "UNMAPPED";
    if (["UNREPORTED", "NOT_REPORTED", "미공개"].includes(bucket)) return "UNREPORTED";
    if (["UNSUPPORTED", "지원불가"].includes(bucket)) return "UNSUPPORTED";
    return "";
  }

  function physicalLongOnly(fund) {
    const combined = upper(fund.structure ?? fund.method ?? fund.holdingsType).replace(/[ -]+/g, "_");
    if (combined === "PHYSICAL_LONG_ONLY") return true;
    const replication = upper(fund.replicationMethod ?? fund.replication ?? fund.replicationType);
    const exposure = upper(fund.exposure ?? fund.exposureType ?? fund.positionType);
    return replication === "PHYSICAL" && ["LONG_ONLY", "LONG"].includes(exposure);
  }

  function toleranceOption(options, diagnostics) {
    const candidate = options?.weightTolerance;
    if (candidate === undefined) return DEFAULT_WEIGHT_TOLERANCE;
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0 || candidate > 0.01) {
      diagnostics.push(error(
        "INVALID_WEIGHT_TOLERANCE",
        "비중 허용오차는 0 이상 0.01 이하의 유한한 숫자여야 합니다."
      ));
      return DEFAULT_WEIGHT_TOLERANCE;
    }
    return candidate;
  }

  function addSyntheticBucketHoldings(fund, holdings) {
    const fields = [
      ["cashWeight", "CASH"],
      ["otherWeight", "OTHER"],
      ["unmappedWeight", "UNMAPPED"],
      ["unreportedWeight", "UNREPORTED"],
      ["unsupportedWeight", "UNSUPPORTED"]
    ];
    fields.forEach(([field, bucket]) => {
      if (fund[field] !== undefined) holdings.push({ bucket, weight: fund[field], syntheticField: field });
    });
  }

  function syntheticBucketHoldingCount(fund) {
    return ["cashWeight", "otherWeight", "unmappedWeight", "unreportedWeight", "unsupportedWeight"]
      .filter((field) => fund[field] !== undefined)
      .length;
  }

  function normalizeFund(sourceFund, fundIndex, inherited, tolerance, holdingAllowance) {
    const diagnostics = [];
    const fund = isPlainObject(sourceFund) ? sourceFund : {};
    const rawId = fund.instrumentId ?? (fund.market || fund.type ? fund : "");
    const instrumentId = normalizeInstrumentId(rawId);
    const context = { fundIndex, ...(instrumentId ? { fundId: instrumentId } : {}) };
    if (!isPlainObject(sourceFund)) {
      diagnostics.push(error("INVALID_FUND", "펀드 항목은 객체여야 합니다.", context));
    }
    if (!instrumentId) diagnostics.push(error("INVALID_FUND_INSTRUMENT_ID", "펀드 표준 종목 식별자가 올바르지 않습니다.", context));
    if (!physicalLongOnly(fund)) {
      diagnostics.push(error(
        "UNSUPPORTED_FUND_STRUCTURE",
        "실물 복제·롱온리 ETF만 자동 투시할 수 있습니다.",
        context
      ));
    }

    const asOf = validDateKey(fund.asOf ?? inherited.asOf);
    if (!asOf) diagnostics.push(error("INVALID_FUND_AS_OF", "구성종목 기준일(YYYY-MM-DD)이 필요합니다.", context));
    const source = normalizeSource(fund.source ?? inherited.rawSource, diagnostics, context);
    const redistribution = normalizeRedistribution(
      fund.redistribution ?? inherited.rawRedistribution,
      diagnostics,
      context
    );
    if (redistribution && !redistribution.eligible) {
      diagnostics.push(error(
        "REDISTRIBUTION_NOT_ELIGIBLE",
        `재배포 상태 ${redistribution.status}인 데이터는 자동 투시에 사용할 수 없습니다.`,
        context
      ));
    }

    const sourceHoldings = Array.isArray(fund.holdings) ? fund.holdings : [];
    if (!Array.isArray(fund.holdings)) {
      diagnostics.push(error("INVALID_FUND_HOLDINGS", "펀드 holdings는 배열이어야 합니다.", context));
    }
    const syntheticHoldings = [];
    addSyntheticBucketHoldings(fund, syntheticHoldings);
    const declaredHoldingCount = sourceHoldings.length + syntheticHoldings.length;
    if (declaredHoldingCount > MAX_HOLDINGS_PER_FUND) {
      diagnostics.push(error(
        "FUND_HOLDINGS_LIMIT_EXCEEDED",
        `펀드당 구성종목은 ${MAX_HOLDINGS_PER_FUND}개 이하여야 합니다.`,
        { ...context, declaredHoldingCount, maxHoldingsPerFund: MAX_HOLDINGS_PER_FUND }
      ));
    }
    const boundedAllowance = Math.max(0, Math.min(
      MAX_HOLDINGS_PER_FUND,
      Number.isSafeInteger(holdingAllowance) ? holdingAllowance : MAX_HOLDINGS_PER_FUND
    ));
    if (declaredHoldingCount > boundedAllowance && declaredHoldingCount <= MAX_HOLDINGS_PER_FUND) {
      diagnostics.push(error(
        "FUND_CATALOG_HOLDING_BUDGET_EXCEEDED",
        "카탈로그 전체 구성종목 상한 때문에 이 펀드를 완전하게 검증할 수 없습니다.",
        { ...context, declaredHoldingCount, availableHoldingBudget: boundedAllowance }
      ));
    }
    const rawHoldingLimit = Math.max(0, boundedAllowance - syntheticHoldings.length);
    const rawHoldings = sourceHoldings.slice(0, rawHoldingLimit);
    rawHoldings.push(...syntheticHoldings.slice(0, boundedAllowance - rawHoldings.length));

    const holdings = [];
    const holdingIds = new Map();
    rawHoldings.forEach((rawHolding, holdingIndex) => {
      const holdingContext = { ...context, holdingIndex };
      if (!isPlainObject(rawHolding)) {
        diagnostics.push(error("INVALID_HOLDING", "구성종목 항목은 객체여야 합니다.", holdingContext));
        return;
      }
      const weight = rawHolding.weight ?? rawHolding.weightFraction;
      if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 1 + tolerance) {
        diagnostics.push(error("INVALID_HOLDING_WEIGHT", "구성종목 비중은 0~1 사이의 유한한 숫자여야 합니다.", holdingContext));
        return;
      }

      let bucket = normalizeBucket(rawHolding.bucket ?? rawHolding.kind ?? rawHolding.classification);
      let holdingId = normalizeInstrumentId(
        rawHolding.instrumentId ?? (rawHolding.market || rawHolding.type ? rawHolding : "")
      );
      const explicitKind = upper(
        rawHolding.instrumentKind
        ?? rawHolding.assetKind
        ?? (!bucket ? rawHolding.kind : "")
      );
      let instrumentKind = explicitKind === "STOCK" || ETF_KINDS.has(explicitKind) ? explicitKind : "";
      if (explicitKind && !instrumentKind && rawHolding.supported !== false) {
        diagnostics.push(error(
          "UNSUPPORTED_HOLDING_INSTRUMENT_KIND",
          "구성종목 종류는 STOCK, ETF, FUND, ETN 중 하나여야 합니다.",
          { ...holdingContext, receivedInstrumentKind: explicitKind }
        ));
        return;
      }
      if (rawHolding.supported === false) {
        bucket = "UNSUPPORTED";
        holdingId = "";
        instrumentKind = "";
      }
      if (bucket && holdingId) {
        diagnostics.push(error(
          "AMBIGUOUS_HOLDING_TARGET",
          "구성종목은 표준 종목 식별자와 특수 버킷을 동시에 가질 수 없습니다.",
          holdingContext
        ));
        return;
      }
      if (bucket && instrumentKind) {
        diagnostics.push(error(
          "AMBIGUOUS_HOLDING_INSTRUMENT_KIND",
          "특수 버킷에는 종목 종류를 함께 지정할 수 없습니다.",
          holdingContext
        ));
        return;
      }
      if (!bucket && !holdingId) {
        const missingNestedFundId = ETF_KINDS.has(instrumentKind);
        bucket = missingNestedFundId ? "UNSUPPORTED" : "UNMAPPED";
        diagnostics.push(warning(
          missingNestedFundId ? "UNMAPPED_NESTED_FUND" : "UNMAPPED_HOLDING",
          missingNestedFundId
            ? "표준 종목 식별자가 없는 중첩 펀드를 미지원 비중으로 보존했습니다."
            : "표준 종목 식별자로 매핑되지 않은 구성종목을 미매핑 비중으로 보존했습니다.",
          holdingContext
        ));
        instrumentKind = "";
      }
      if (holdingId && holdingIds.has(holdingId)) {
        diagnostics.push(error(
          "DUPLICATE_HOLDING_INSTRUMENT_ID",
          "한 펀드 안에 같은 표준 종목 식별자가 두 번 이상 있습니다.",
          { ...holdingContext, instrumentId: holdingId, firstHoldingIndex: holdingIds.get(holdingId) }
        ));
        return;
      }
      if (holdingId) holdingIds.set(holdingId, holdingIndex);
      holdings.push({
        ...(holdingId ? { instrumentId: holdingId } : { bucket }),
        ...(instrumentKind ? { instrumentKind } : {}),
        weight,
        ...(text(rawHolding.name) ? { name: text(rawHolding.name) } : {})
      });
    });

    let totalWeight = holdings.reduce((sum, holding) => sum + holding.weight, 0);
    if (totalWeight > 1 + tolerance) {
      diagnostics.push(error(
        "HOLDING_WEIGHT_SUM_EXCEEDS_ONE",
        `구성종목 비중 합계 ${totalWeight}이(가) 1을 초과합니다.`,
        { ...context, totalWeight }
      ));
    } else if (totalWeight > 0 && Math.abs(1 - totalWeight) <= tolerance) {
      if (totalWeight !== 1) {
        holdings.forEach((holding) => { holding.weight /= totalWeight; });
        diagnostics.push(warning(
          "HOLDING_WEIGHT_SUM_NORMALIZED",
          "허용오차 안의 구성종목 비중 합계를 1로 정규화했습니다.",
          { ...context, totalWeight }
        ));
        totalWeight = 1;
      }
    } else if (totalWeight < 1 - tolerance) {
      holdings.push({ bucket: "UNREPORTED", weight: 1 - totalWeight });
      totalWeight = 1;
    }

    const coverageCandidate = fund.coverageWeight ?? fund.reportedWeight ?? fund.coverage;
    const unreportedWeight = holdings
      .filter((holding) => holding.bucket === "UNREPORTED")
      .reduce((sum, holding) => sum + holding.weight, 0);
    const coverageWeight = Math.max(0, 1 - unreportedWeight);
    if (coverageCandidate !== undefined) {
      if (typeof coverageCandidate !== "number" || !Number.isFinite(coverageCandidate)
        || coverageCandidate < 0 || coverageCandidate > 1) {
        diagnostics.push(error("INVALID_COVERAGE_WEIGHT", "커버리지는 0~1 사이 숫자여야 합니다.", context));
      } else if (Math.abs(coverageCandidate - coverageWeight) > tolerance) {
        diagnostics.push(error(
          "COVERAGE_WEIGHT_MISMATCH",
          "표시된 커버리지와 구성종목 비중에서 계산한 커버리지가 일치하지 않습니다.",
          { ...context, declaredCoverageWeight: coverageCandidate, calculatedCoverageWeight: coverageWeight }
        ));
      }
    }

    const hasError = diagnostics.some((item) => item.severity === "error");
    return {
      instrumentId,
      name: text(fund.name) || instrumentId,
      asOf,
      source,
      redistribution,
      structure: "PHYSICAL_LONG_ONLY",
      eligible: !hasError,
      coverageWeight: round(coverageWeight, WEIGHT_DIGITS),
      holdings: holdings
        .map((holding) => ({ ...holding, weight: round(holding.weight, WEIGHT_DIGITS) }))
        .sort((left, right) => compareText(left.instrumentId || `~${left.bucket}`, right.instrumentId || `~${right.bucket}`)),
      diagnostics
    };
  }

  /**
   * Validates and canonicalizes an ETF holdings catalog without mutating it.
   * A catalog can be structurally usable while containing an ineligible fund;
   * those funds remain present with eligible=false so analysis can preserve the
   * full container value in UNSUPPORTED rather than silently dropping it.
   */
  function validateHoldingsCatalog(input, options = {}) {
    const catalog = isPlainObject(input) ? input : {};
    const diagnostics = [];
    const tolerance = toleranceOption(options, diagnostics);
    const schemaVersion = text(catalog.schemaVersion ?? catalog.schema);
    if (!isPlainObject(input)) diagnostics.push(error("INVALID_CATALOG", "ETF 구성종목 카탈로그는 객체여야 합니다."));
    if (schemaVersion !== SCHEMA_VERSION) {
      diagnostics.push(error(
        "UNSUPPORTED_CATALOG_SCHEMA",
        `카탈로그 스키마는 ${SCHEMA_VERSION}이어야 합니다.`,
        { receivedSchema: schemaVersion }
      ));
    }

    const generatedAtRaw = text(catalog.generatedAt);
    const generatedAt = generatedAtRaw ? validTimestamp(generatedAtRaw) : "";
    if (generatedAtRaw && !generatedAt) {
      diagnostics.push(error("INVALID_CATALOG_GENERATED_AT", "카탈로그 생성 시각이 올바른 ISO 시각이 아닙니다."));
    }

    const rootAsOfRaw = text(catalog.asOf);
    const rootAsOf = rootAsOfRaw ? validDateKey(rootAsOfRaw) : "";
    if (rootAsOfRaw && !rootAsOf) diagnostics.push(error("INVALID_CATALOG_AS_OF", "카탈로그 기준일이 올바르지 않습니다."));

    const fundsInput = Array.isArray(catalog.funds) ? catalog.funds : [];
    if (!Array.isArray(catalog.funds)) diagnostics.push(error("INVALID_CATALOG_FUNDS", "catalog.funds는 배열이어야 합니다."));
    if (fundsInput.length > MAX_FUNDS) {
      diagnostics.push(error(
        "CATALOG_FUND_LIMIT_EXCEEDED",
        `ETF 구성종목 카탈로그는 펀드 ${MAX_FUNDS}개 이하여야 합니다.`,
        { declaredFundCount: fundsInput.length, maxFunds: MAX_FUNDS }
      ));
    }

    // Empty catalogs are a valid, explicit no-coverage state. Metadata is only
    // mandatory once holdings are distributed or analyzed.
    let rootSource = null;
    let rootRedistribution = null;
    if (catalog.source !== undefined) rootSource = normalizeSource(catalog.source, diagnostics, {});
    if (catalog.redistribution !== undefined) {
      rootRedistribution = normalizeRedistribution(catalog.redistribution, diagnostics, {});
    }

    const inherited = {
      asOf: rootAsOf,
      rawSource: catalog.source,
      rawRedistribution: catalog.redistribution
    };
    const boundedFundsInput = fundsInput.slice(0, MAX_FUNDS);
    let declaredHoldingTotal = 0;
    boundedFundsInput.forEach((sourceFund) => {
      if (!isPlainObject(sourceFund)) return;
      const rawCount = Array.isArray(sourceFund.holdings) ? sourceFund.holdings.length : 0;
      declaredHoldingTotal = Math.min(
        MAX_TOTAL_HOLDINGS + 1,
        declaredHoldingTotal + rawCount + syntheticBucketHoldingCount(sourceFund)
      );
    });
    if (declaredHoldingTotal > MAX_TOTAL_HOLDINGS) {
      diagnostics.push(error(
        "CATALOG_TOTAL_HOLDINGS_LIMIT_EXCEEDED",
        `카탈로그 전체 구성종목은 ${MAX_TOTAL_HOLDINGS}개 이하여야 합니다.`,
        { declaredHoldingCount: declaredHoldingTotal, maxTotalHoldings: MAX_TOTAL_HOLDINGS }
      ));
    }
    let remainingHoldingAllowance = MAX_TOTAL_HOLDINGS;
    const funds = boundedFundsInput.map((fund, fundIndex) => {
      const declaredCount = isPlainObject(fund)
        ? (Array.isArray(fund.holdings) ? fund.holdings.length : 0) + syntheticBucketHoldingCount(fund)
        : 0;
      const allowance = Math.min(MAX_HOLDINGS_PER_FUND, remainingHoldingAllowance);
      remainingHoldingAllowance -= Math.min(declaredCount, allowance);
      return normalizeFund(fund, fundIndex, inherited, tolerance, allowance);
    });

    const byId = new Map();
    funds.forEach((fund, fundIndex) => {
      if (!fund.instrumentId) return;
      const duplicate = byId.get(fund.instrumentId);
      if (duplicate !== undefined) {
        const item = error(
          "DUPLICATE_FUND_INSTRUMENT_ID",
          "같은 ETF가 카탈로그에 두 번 이상 있습니다.",
          { fundId: fund.instrumentId, fundIndex }
        );
        diagnostics.push(item);
        fund.diagnostics.push(item);
        fund.eligible = false;
        funds[duplicate].diagnostics.push({ ...item, fundIndex: duplicate });
        funds[duplicate].eligible = false;
      } else {
        byId.set(fund.instrumentId, fundIndex);
      }
    });
    funds.forEach((fund) => diagnostics.push(...fund.diagnostics));

    if (!funds.length) {
      diagnostics.push(warning("NO_COVERAGE", "ETF 구성종목 카탈로그에 등록된 펀드가 없습니다."));
    }

    const rootErrors = diagnostics.filter((item) => item.severity === "error" && item.fundIndex === undefined);
    const resultDiagnostics = dedupeDiagnostics(diagnostics);
    return {
      ok: !resultDiagnostics.some((item) => item.severity === "error"),
      usable: rootErrors.length === 0,
      schemaVersion: SCHEMA_VERSION,
      ...(generatedAt ? { generatedAt } : {}),
      ...(rootAsOf ? { asOf: rootAsOf } : {}),
      ...(rootSource ? { source: rootSource } : {}),
      ...(rootRedistribution ? { redistribution: rootRedistribution } : {}),
      weightTolerance: tolerance,
      funds: funds
        .map((fund) => ({
          instrumentId: fund.instrumentId,
          name: fund.name,
          asOf: fund.asOf,
          source: fund.source,
          redistribution: fund.redistribution,
          structure: fund.structure,
          eligible: fund.eligible,
          coverageWeight: fund.coverageWeight,
          holdings: fund.holdings.map((holding) => ({ ...holding })),
          diagnostics: dedupeDiagnostics(fund.diagnostics)
        }))
        .sort((left, right) => compareText(left.instrumentId, right.instrumentId)),
      diagnostics: resultDiagnostics
    };
  }

  function normalizeMaxDepth(value, diagnostics) {
    if (value === undefined) return DEFAULT_MAX_DEPTH;
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MAX_DEPTH) {
      diagnostics.push(error(
        "INVALID_MAX_DEPTH",
        `maxDepth는 0 이상 ${MAX_MAX_DEPTH} 이하의 정수여야 합니다.`
      ));
      return DEFAULT_MAX_DEPTH;
    }
    return value;
  }

  function positionValue(row) {
    return row.valueKRW ?? row.marketValueKRW ?? row.value;
  }

  function positionKind(row) {
    return upper(row.instrumentKind ?? row.kind ?? row.category ?? row.assetClass);
  }

  function contributionSort(left, right) {
    return compareText(left.rootInstrumentId, right.rootInstrumentId)
      || compareText(left.path.join(">"), right.path.join(">"))
      || left.valueKRW - right.valueKRW;
  }

  /**
   * Expands ETF containers into economic exposures. The function never counts
   * an ETF container alongside its holdings. Any portion that cannot be safely
   * expanded is retained in a named residual bucket, keeping the total-value
   * invariant intact.
   */
  function analyzeLookThrough(input, catalogArg, optionsArg = {}) {
    let positions;
    let catalogInput;
    let options;
    if (Array.isArray(input)) {
      positions = input;
      catalogInput = catalogArg;
      options = optionsArg || {};
    } else {
      const envelope = isPlainObject(input) ? input : {};
      positions = envelope.positions ?? envelope.portfolio ?? [];
      catalogInput = catalogArg ?? envelope.catalog;
      options = catalogArg === undefined ? (envelope.options ?? optionsArg ?? {}) : (optionsArg ?? {});
    }

    const diagnostics = [];
    const maxDepth = normalizeMaxDepth(options.maxDepth, diagnostics);
    const positionsAreArray = Array.isArray(positions);
    if (!positionsAreArray) diagnostics.push(error("INVALID_PORTFOLIO", "positions는 배열이어야 합니다."));
    if (positionsAreArray && positions.length > MAX_POSITIONS) {
      diagnostics.push(error(
        "PORTFOLIO_POSITION_LIMIT_EXCEEDED",
        `포트폴리오 positions는 ${MAX_POSITIONS}개 이하여야 합니다.`,
        { declaredPositionCount: positions.length, maxPositions: MAX_POSITIONS }
      ));
    }
    const invalidPositionCount = positionsAreArray && positions.length > MAX_POSITIONS;
    const rows = positionsAreArray && !invalidPositionCount ? positions : [];
    const validated = validateHoldingsCatalog(catalogInput, options);
    diagnostics.push(...validated.diagnostics);

    const funds = new Map(validated.funds.map((fund) => [fund.instrumentId, fund]));
    const instruments = new Map();
    const residuals = new Map([...SPECIAL_BUCKETS].map((bucket) => [bucket, {
      bucket,
      directValueKRW: 0,
      lookThroughValueKRW: 0,
      contributions: []
    }]));
    let totalValue = 0;
    let invalidPortfolio = !positionsAreArray || invalidPositionCount;
    let expansionSteps = 0;
    let expansionLimitReached = false;

    function addInstrument(instrumentId, amount, rootInstrumentId, path, direct) {
      const current = instruments.get(instrumentId) || {
        instrumentId,
        directValueKRW: 0,
        lookThroughValueKRW: 0,
        contributions: []
      };
      if (direct) current.directValueKRW += amount;
      else current.lookThroughValueKRW += amount;
      current.contributions.push({ rootInstrumentId, path: [...path], valueKRW: amount });
      instruments.set(instrumentId, current);
    }

    function addResidual(bucket, amount, rootInstrumentId, path, reason, direct = false) {
      const safeBucket = SPECIAL_BUCKETS.has(bucket) ? bucket : "UNSUPPORTED";
      const current = residuals.get(safeBucket);
      if (direct) current.directValueKRW += amount;
      else current.lookThroughValueKRW += amount;
      current.contributions.push({
        rootInstrumentId,
        path: [...path],
        valueKRW: amount,
        ...(reason ? { reason } : {})
      });
    }

    function markExpansionLimit(instrumentId, path) {
      if (expansionLimitReached) return;
      expansionLimitReached = true;
      diagnostics.push(warning(
        "ETF_EXPANSION_STEP_LIMIT_REACHED",
        `ETF 중첩 투시 확장 단계가 ${MAX_EXPANSION_STEPS}회에 도달해 남은 평가금액을 미지원으로 보존했습니다.`,
        {
          fundId: instrumentId,
          path: [...path, instrumentId],
          expansionSteps,
          maxExpansionSteps: MAX_EXPANSION_STEPS
        }
      ));
    }

    function expandFund(instrumentId, amount, rootInstrumentId, path, depth) {
      const fund = funds.get(instrumentId);
      if (!validated.usable) {
        addResidual("UNSUPPORTED", amount, rootInstrumentId, path, "INVALID_CATALOG");
        return;
      }
      if (!fund || !fund.eligible) {
        addResidual("UNSUPPORTED", amount, rootInstrumentId, path, fund ? "INELIGIBLE_FUND" : "MISSING_FUND");
        return;
      }
      if (path.includes(instrumentId)) {
        diagnostics.push(warning(
          "ETF_HOLDING_CYCLE",
          "중첩 ETF 순환 참조를 발견해 해당 비중을 미지원으로 보존했습니다.",
          { fundId: instrumentId, path: [...path, instrumentId] }
        ));
        addResidual("UNSUPPORTED", amount, rootInstrumentId, path, "CYCLE_DETECTED");
        return;
      }
      if (depth >= maxDepth) {
        diagnostics.push(warning(
          "ETF_MAX_DEPTH_REACHED",
          "ETF 중첩 투시 최대 깊이에 도달해 해당 비중을 미지원으로 보존했습니다.",
          { fundId: instrumentId, maxDepth }
        ));
        addResidual("UNSUPPORTED", amount, rootInstrumentId, path, "MAX_DEPTH_REACHED");
        return;
      }
      if (expansionSteps >= MAX_EXPANSION_STEPS) {
        markExpansionLimit(instrumentId, path);
        addResidual("UNSUPPORTED", amount, rootInstrumentId, path, "EXPANSION_STEP_LIMIT_REACHED");
        return;
      }

      const nextPath = [...path, instrumentId];
      for (let holdingIndex = 0; holdingIndex < fund.holdings.length; holdingIndex += 1) {
        if (expansionSteps >= MAX_EXPANSION_STEPS) {
          markExpansionLimit(instrumentId, path);
          const remainingWeight = fund.holdings
            .slice(holdingIndex)
            .reduce((sum, holding) => sum + holding.weight, 0);
          addResidual(
            "UNSUPPORTED",
            amount * remainingWeight,
            rootInstrumentId,
            nextPath,
            "EXPANSION_STEP_LIMIT_REACHED"
          );
          return;
        }
        const holding = fund.holdings[holdingIndex];
        expansionSteps += 1;
        const childValue = amount * holding.weight;
        if (holding.bucket) {
          addResidual(holding.bucket, childValue, rootInstrumentId, nextPath, `CATALOG_${holding.bucket}`);
        } else if (ETF_KINDS.has(holding.instrumentKind)) {
          if (funds.has(holding.instrumentId)) {
            expandFund(holding.instrumentId, childValue, rootInstrumentId, nextPath, depth + 1);
          } else {
            diagnostics.push(warning(
              "NESTED_FUND_COVERAGE_MISSING",
              "카탈로그에 없는 중첩 ETF·펀드·ETN 평가금액을 미지원 비중으로 보존했습니다.",
              { fundId: instrumentId, holdingIndex, nestedFundId: holding.instrumentId }
            ));
            addResidual(
              "UNSUPPORTED",
              childValue,
              rootInstrumentId,
              nextPath,
              "NESTED_FUND_COVERAGE_MISSING"
            );
          }
        } else if (holding.instrumentKind === "STOCK") {
          if (funds.has(holding.instrumentId)) {
            diagnostics.push(warning(
              "HOLDING_KIND_CATALOG_CONFLICT",
              "주식으로 표시된 구성종목 ID가 펀드 카탈로그와 충돌해 직접 종목으로 보존했습니다.",
              { fundId: instrumentId, holdingIndex, instrumentId: holding.instrumentId }
            ));
          }
          addInstrument(holding.instrumentId, childValue, rootInstrumentId, nextPath, false);
        } else if (funds.has(holding.instrumentId)) {
          // v1 catalogs did not require holding-level kinds. Preserve their
          // existing nested-fund behavior when the child has a catalog entry.
          expandFund(holding.instrumentId, childValue, rootInstrumentId, nextPath, depth + 1);
        } else {
          addInstrument(holding.instrumentId, childValue, rootInstrumentId, nextPath, false);
        }
      }
    }

    rows.forEach((source, positionIndex) => {
      const row = isPlainObject(source) ? source : {};
      if (!isPlainObject(source)) {
        diagnostics.push(error("INVALID_POSITION", "포트폴리오 항목은 객체여야 합니다.", { positionIndex }));
        invalidPortfolio = true;
        return;
      }
      const rawValue = positionValue(row);
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0) {
        diagnostics.push(error(
          "INVALID_POSITION_VALUE",
          "포트폴리오 평가금액은 0 이상의 유한한 숫자여야 합니다.",
          { positionIndex }
        ));
        invalidPortfolio = true;
        return;
      }
      const value = rawValue;
      totalValue += value;
      const id = normalizeInstrumentId(row.instrumentId ?? (row.market || row.type ? row : ""));
      const kind = positionKind(row);
      const rootInstrumentId = id || `POSITION:${positionIndex}`;
      const directBucket = normalizeBucket(row.bucket) || (upper(row.type) === "CASH" ? "CASH" : "");

      if (directBucket) {
        addResidual(directBucket, value, rootInstrumentId, [], "DIRECT_POSITION", true);
      } else if (ETF_KINDS.has(kind)) {
        if (id && funds.has(id)) {
          expandFund(id, value, id, [], 0);
        } else {
          diagnostics.push(warning(
            "ETF_COVERAGE_MISSING",
            "카탈로그에 없는 ETF 평가금액을 미지원 비중으로 보존했습니다.",
            { positionIndex, ...(id ? { fundId: id } : {}) }
          ));
          addResidual("UNSUPPORTED", value, rootInstrumentId, [], "ETF_COVERAGE_MISSING", true);
        }
      } else if (id) {
        if (funds.has(id)) {
          diagnostics.push(warning(
            "POSITION_KIND_CATALOG_CONFLICT",
            "ETF·펀드·ETN으로 표시되지 않은 포지션 ID가 펀드 카탈로그와 충돌해 직접 종목으로 보존했습니다.",
            { positionIndex, instrumentId: id, receivedKind: kind || null }
          ));
        }
        addInstrument(id, value, id, [], true);
      } else {
        diagnostics.push(warning(
          "UNMAPPED_DIRECT_POSITION",
          "표준 종목 식별자가 없는 직접 보유분을 미매핑 비중으로 보존했습니다.",
          { positionIndex }
        ));
        addResidual("UNMAPPED", value, rootInstrumentId, [], "DIRECT_POSITION_UNMAPPED", true);
      }
    });

    const normalizedTotal = round(totalValue);
    const exposureRows = [...instruments.values()]
      .map((item) => ({
        instrumentId: item.instrumentId,
        directValueKRW: round(item.directValueKRW),
        lookThroughValueKRW: round(item.lookThroughValueKRW),
        valueKRW: round(item.directValueKRW + item.lookThroughValueKRW),
        contributions: item.contributions
          .map((entry) => ({ ...entry, valueKRW: round(entry.valueKRW) }))
          .sort(contributionSort)
      }))
      .sort((left, right) => right.valueKRW - left.valueKRW || compareText(left.instrumentId, right.instrumentId));
    const bucketRows = [...residuals.values()]
      .map((item) => ({
        bucket: item.bucket,
        directValueKRW: round(item.directValueKRW),
        lookThroughValueKRW: round(item.lookThroughValueKRW),
        valueKRW: round(item.directValueKRW + item.lookThroughValueKRW),
        contributions: item.contributions
          .map((entry) => ({ ...entry, valueKRW: round(entry.valueKRW) }))
          .sort(contributionSort)
      }))
      .sort((left, right) => compareText(left.bucket, right.bucket));

    // Reconcile only sub-won floating-point noise. The adjustment goes to the
    // largest existing component and is disclosed; it never creates coverage.
    let accounted = round(
      exposureRows.reduce((sum, item) => sum + item.valueKRW, 0)
      + bucketRows.reduce((sum, item) => sum + item.valueKRW, 0)
    );
    const roundingAdjustment = round(normalizedTotal - accounted);
    if (roundingAdjustment !== 0) {
      const candidates = [...exposureRows, ...bucketRows].filter((item) => item.valueKRW > 0);
      candidates.sort((left, right) => right.valueKRW - left.valueKRW
        || compareText(left.instrumentId || left.bucket, right.instrumentId || right.bucket));
      if (candidates.length) candidates[0].valueKRW = round(candidates[0].valueKRW + roundingAdjustment);
      accounted = normalizedTotal;
    }

    exposureRows.forEach((item) => {
      item.weight = normalizedTotal > 0 ? round(item.valueKRW / normalizedTotal, WEIGHT_DIGITS) : 0;
    });
    bucketRows.forEach((item) => {
      item.weight = normalizedTotal > 0 ? round(item.valueKRW / normalizedTotal, WEIGHT_DIGITS) : 0;
    });
    const bucketValues = Object.fromEntries(bucketRows.map((item) => [item.bucket, item.valueKRW]));
    const instrumentValue = round(exposureRows.reduce((sum, item) => sum + item.valueKRW, 0));
    const resultDiagnostics = dedupeDiagnostics(diagnostics);
    const hasResidualCoverage = bucketValues.UNMAPPED > 0
      || bucketValues.UNREPORTED > 0
      || bucketValues.UNSUPPORTED > 0;
    const hasError = resultDiagnostics.some((item) => item.severity === "error");
    const hasQualityLimitingWarning = resultDiagnostics.some((item) => (
      QUALITY_LIMITING_WARNING_CODES.has(item.code)
    ));

    return {
      ok: !invalidPortfolio && !hasError && accounted === normalizedTotal,
      availability: hasError
        ? "UNAVAILABLE"
        : hasResidualCoverage || hasQualityLimitingWarning ? "LIMITED" : "VERIFIED",
      method: METHOD,
      schemaVersion: SCHEMA_VERSION,
      totalValueKRW: normalizedTotal,
      accountedValueKRW: accounted,
      invariantDeltaKRW: round(normalizedTotal - accounted),
      roundingAdjustmentKRW: roundingAdjustment,
      maxDepth,
      expansionSteps,
      maxExpansionSteps: MAX_EXPANSION_STEPS,
      catalog: {
        generatedAt: validated.generatedAt || null,
        asOf: validated.asOf || null,
        source: validated.source || null,
        redistribution: validated.redistribution || null,
        fundCount: validated.funds.length,
        eligibleFundCount: validated.funds.filter((fund) => fund.eligible).length,
        asOfDates: [...new Set(validated.funds.map((fund) => fund.asOf).filter(Boolean))].sort(compareText),
        sources: [...new Map(validated.funds
          .filter((fund) => fund.source)
          .map((fund) => [fund.source.url, cloneJson(fund.source)])).values()]
          .sort((left, right) => compareText(left.url, right.url))
      },
      exposures: exposureRows,
      bucketExposures: bucketRows,
      totals: {
        instrumentsKRW: instrumentValue,
        cashKRW: bucketValues.CASH,
        otherKRW: bucketValues.OTHER,
        unmappedKRW: bucketValues.UNMAPPED,
        unreportedKRW: bucketValues.UNREPORTED,
        unsupportedKRW: bucketValues.UNSUPPORTED,
        accountedKRW: accounted
      },
      diagnostics: resultDiagnostics
    };
  }

  return Object.freeze({
    normalizeInstrumentId,
    validateHoldingsCatalog,
    analyzeLookThrough
  });
});
