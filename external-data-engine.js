(function attachAssetTrailExternalDataEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailExternalDataEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createExternalDataEngine() {
  "use strict";

  const MAX_CLIPBOARD_BYTES = 200 * 1024;
  const MAX_PERIODS = 80;
  const MAX_ROWS = 100;
  const MAX_FACTS = 10_000;
  const MAX_REVISIONS = 50;
  const MAX_REVISION_DETAILS = 500;
  const MAX_SCAN_DEPTH = 12;
  const MAX_SCAN_NODES = 60_000;
  const MAX_SCAN_PROPERTIES = 400_000;
  const MAX_SCAN_ARRAY_LENGTH = 10_000;
  const MAX_FUTURE_RETRIEVAL_SKEW_MS = 5 * 60 * 1000;
  const SCHEMA_VERSION = 1;
  const DIGEST_PREFIX = "cyrb128-v1:";
  const PERIOD_TYPES = new Set(["TTM", "QUARTER", "ANNUAL"]);
  const VALUE_TYPES = new Set(["ACTUAL", "CONSENSUS"]);
  const MARKETS = new Set(["KRX", "US"]);
  const PROVIDER = Object.freeze({
    provider: "BUTLER",
    acquisitionMethod: "BUTLER_MANUAL",
    authority: "SECONDARY_AGGREGATOR",
    suppliedBy: "USER_SUPPLIED"
  });
  const METRIC_ORDER = Object.freeze([
    "REVENUE",
    "OPERATING_INCOME",
    "NET_INCOME",
    "TOTAL_ASSETS",
    "TOTAL_LIABILITIES",
    "TOTAL_EQUITY",
    "OPERATING_CASH_FLOW",
    "CAPEX",
    "FREE_CASH_FLOW"
  ]);
  const METRIC_SET = new Set(METRIC_ORDER);
  const SECTION_NAMES = Object.freeze({
    "손익계산서": "INCOME_STATEMENT",
    "포괄손익계산서": "COMPREHENSIVE_INCOME_STATEMENT",
    "재무상태표": "BALANCE_SHEET",
    "대차대조표": "BALANCE_SHEET",
    "현금흐름표": "CASH_FLOW_STATEMENT"
  });
  const METRIC_ALIASES = new Map();

  function normalizedText(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  function normalizedMetricLabel(value) {
    return normalizedText(value)
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s_·•:：/\\-]+/g, "")
      .replace(/[()（）]/g, "");
  }

  function addMetricAliases(metric, aliases) {
    aliases.forEach((alias) => METRIC_ALIASES.set(normalizedMetricLabel(alias), metric));
  }

  addMetricAliases("REVENUE", ["매출액", "매출", "영업수익", "수익(매출액)", "revenue"]);
  addMetricAliases("OPERATING_INCOME", ["영업이익", "영업손익", "operating income", "operating profit"]);
  addMetricAliases("NET_INCOME", ["순이익", "당기순이익", "연결순이익", "net income", "net profit"]);
  addMetricAliases("TOTAL_ASSETS", ["자산총계", "총자산", "total assets"]);
  addMetricAliases("TOTAL_LIABILITIES", ["부채총계", "총부채", "total liabilities"]);
  addMetricAliases("TOTAL_EQUITY", ["자본총계", "총자본", "total equity", "shareholders equity"]);
  addMetricAliases("OPERATING_CASH_FLOW", [
    "영업현금흐름", "영업활동현금흐름", "영업활동으로인한현금흐름", "영업활동으로 인한 현금흐름",
    "operating cash flow", "cash flow from operations"
  ]);
  addMetricAliases("CAPEX", ["CAPEX", "설비투자", "자본적지출", "capital expenditures", "capital expenditure"]);
  addMetricAliases("FREE_CASH_FLOW", ["FCF", "잉여현금흐름", "free cash flow"]);

  const ISSUE_MESSAGES = Object.freeze({
    INVALID_TEXT: "붙여넣은 표가 문자열이 아닙니다.",
    CLIPBOARD_TOO_LARGE: "붙여넣은 표가 200KB 제한을 초과했습니다.",
    EMPTY_TABLE: "붙여넣은 표가 비어 있습니다.",
    INVALID_CONTEXT: "기업과 출처 정보가 올바르지 않습니다.",
    INVALID_MARKET: "시장은 KRX 또는 US여야 합니다.",
    INVALID_TICKER: "시장에 맞는 종목코드를 입력해야 합니다.",
    INVALID_ENTITY_NAME: "기업명이 올바르지 않습니다.",
    INVALID_CURRENCY: "통화는 ISO 영문 3자리여야 합니다.",
    INVALID_SOURCE_URL: "Butler의 허용된 HTTPS 주소만 사용할 수 있습니다.",
    INVALID_RETRIEVED_AT: "조회 시각은 UTC ISO 8601 형식이어야 합니다.",
    FUTURE_RETRIEVED_AT: "조회 시각은 현재 시각보다 미래일 수 없습니다.",
    INVALID_MODE: "첫 칸은 4분기누적, 분기 또는 연도여야 합니다.",
    TOO_MANY_PERIODS: "기간 열이 허용 개수를 초과했습니다.",
    TOO_MANY_ROWS: "표 행이 허용 개수를 초과했습니다.",
    TOO_MANY_FACTS: "재무 사실이 허용 개수를 초과했습니다.",
    INVALID_PERIOD: "기간 표기가 올바르지 않습니다.",
    FUTURE_ACTUAL_PERIOD: "확정 실적 기간은 출처 조회일보다 미래일 수 없습니다.",
    DUPLICATE_PERIOD: "같은 기간 열이 중복되었습니다.",
    INVALID_ROW_WIDTH: "지표 행의 열 개수가 머리글과 다릅니다.",
    UNKNOWN_SECTION: "인식하지 못한 구역 행을 건너뛰었습니다.",
    UNKNOWN_METRIC: "지원하지 않는 지표 행을 건너뛰었습니다.",
    INVALID_NUMBER: "재무 값이 엄격한 숫자 형식이 아닙니다.",
    UNSAFE_NUMBER: "정확하게 저장할 수 없는 크기의 숫자입니다.",
    DUPLICATE_FACT: "같은 재무 사실이 중복되어 한 번만 반영했습니다.",
    CONFLICTING_FACT: "같은 기간과 지표에 서로 다른 값이 있습니다.",
    NO_SUPPORTED_FACTS: "지원하는 재무 지표가 없습니다.",
    INVALID_SNAPSHOT: "외부 데이터 스냅샷 형식이 올바르지 않습니다.",
    FORBIDDEN_RAW_CONTENT: "스냅샷에는 원문이나 클립보드 내용을 저장할 수 없습니다.",
    SNAPSHOT_STRUCTURE_LIMIT: "스냅샷 구조가 안전한 검사 한도를 초과했습니다.",
    DIGEST_MISMATCH: "외부 데이터 내용 지문이 현재 내용과 일치하지 않습니다.",
    DUPLICATE_SNAPSHOT: "같은 내용의 스냅샷이 이미 있습니다.",
    SNAPSHOT_CONFLICT: "같은 조회 시각에 서로 다른 내용이 있어 자동으로 덮어쓰지 않았습니다.",
    STALE_SNAPSHOT: "더 오래된 스냅샷은 현재 데이터를 덮어쓸 수 없습니다.",
    DIFFERENT_SERIES: "서로 다른 기업 또는 기간 유형의 스냅샷은 하나로 합칠 수 없습니다.",
    REVISION_HISTORY_TRUNCATED: "오래된 수정 이력이 보존 한도에 따라 제외되었습니다."
  });

  function diagnostic(code, severity = "error", details = {}) {
    const safeSeverity = ["error", "warning", "info"].includes(severity) ? severity : "error";
    const output = {
      code: Object.hasOwn(ISSUE_MESSAGES, code) ? code : "INVALID_SNAPSHOT",
      severity: safeSeverity,
      message: ISSUE_MESSAGES[code] || ISSUE_MESSAGES.INVALID_SNAPSHOT
    };
    if (Number.isSafeInteger(details.rowNumber) && details.rowNumber > 0) output.rowNumber = details.rowNumber;
    if (Number.isSafeInteger(details.columnNumber) && details.columnNumber > 0) output.columnNumber = details.columnNumber;
    if (METRIC_SET.has(details.metric)) output.metric = details.metric;
    if (Number.isSafeInteger(details.count) && details.count >= 0) output.count = details.count;
    return Object.freeze(output);
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function dedupeDiagnostics(items) {
    const seen = new Set();
    return Object.freeze((items || []).filter(Boolean).filter((item) => {
      const key = JSON.stringify([item.code, item.severity, item.rowNumber || 0, item.columnNumber || 0, item.metric || ""]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((left, right) => (
      (left.rowNumber || 0) - (right.rowNumber || 0)
      || (left.columnNumber || 0) - (right.columnNumber || 0)
      || compareText(left.code, right.code)
    )));
  }

  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  function utf8ByteLength(value) {
    let bytes = 0;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length
        && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function canonicalNumber(value) {
    return Object.is(value, -0) ? 0 : value;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      const output = {};
      Object.keys(value).sort(compareText).forEach((key) => { output[key] = stableValue(value[key]); });
      return output;
    }
    if (typeof value === "number") return canonicalNumber(value);
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  // Non-cryptographic 128-bit change detector. It is evidence of identical canonical content,
  // not proof that a third-party source was authentic or untampered with.
  function cyrb128Hex(value) {
    const text = String(value);
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= h2 ^ h3 ^ h4;
    h2 ^= h1;
    h3 ^= h1;
    h4 ^= h1;
    return [h1, h2, h3, h4].map((part) => (part >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function validIsoTimestamp(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text)) return "";
    const millis = Date.parse(text);
    if (!Number.isFinite(millis)) return "";
    const iso = new Date(millis).toISOString();
    return iso.slice(0, 19) === text.slice(0, 19) ? iso : "";
  }

  function validDateKey(value) {
    const key = typeof value === "string" ? value.trim() : "";
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(key)) return "";
    const millis = Date.parse(`${key}T00:00:00.000Z`);
    return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === key ? key : "";
  }

  function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }

  function fullYear(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return 0;
    const year = numeric < 100 ? 2000 + numeric : numeric;
    return year >= 2000 && year <= 2099 ? year : 0;
  }

  function hasConsensusMarker(value) {
    const text = normalizedText(value).toUpperCase();
    return /(?:\(\s*[EF]\s*\)|Q[1-4][EF]\s*\)|\b(?:EST|ESTIMATE|FORECAST|CONSENSUS)\b|예상|추정|컨센서스|[EF]\s*$)/.test(text);
  }

  function removeEstimateMarkers(value) {
    return normalizedText(value)
      .replace(/\(\s*[AEF]\s*\)/gi, "")
      .replace(/(Q[1-4])[EF](?=\s*\))/gi, "$1")
      .replace(/(?:예상|추정|컨센서스)/g, "")
      .replace(/\b(?:ACTUAL|EST|ESTIMATE|FORECAST|CONSENSUS)\b/gi, "")
      .replace(/([0-9)])\s*[EF]\s*$/i, "$1")
      .trim();
  }

  function parsePeriodHeader(value, periodType) {
    const valueType = hasConsensusMarker(value) ? "CONSENSUS" : "ACTUAL";
    const text = removeEstimateMarkers(value).replace(/\s+/g, " ");
    let year = 0;
    let month = 0;
    let quarter = 0;
    let match = text.match(
      /^((?:20)?\d{2})[.\-/]([01]?\d)\s+((?:20)?\d{2})Q([1-4])(?:\s+(?:연결|별도))?$/i
    );
    if (match) {
      year = fullYear(match[1]);
      month = Number(match[2]);
      quarter = Number(match[4]);
      if (fullYear(match[3]) !== year) return null;
    } else {
      match = text.match(/^((?:20)?\d{2})[.\-/]([01]?\d)(?:\s*\(((?:20)?\d{2})?\s*Q([1-4])\))?$/i);
    }
    if (match) {
      if (!year) {
        year = fullYear(match[1]);
        month = Number(match[2]);
        quarter = match[4] ? Number(match[4]) : 0;
        if (match[3] && fullYear(match[3]) !== year) return null;
      }
    } else {
      match = text.match(/^((?:20)?\d{2})\s*Q([1-4])$/i)
        || text.match(/^((?:20)?\d{2})년?\s*([1-4])분기$/);
      if (match) {
        year = fullYear(match[1]);
        quarter = Number(match[2]);
        month = quarter * 3;
      } else if (periodType === "ANNUAL") {
        match = text.match(/^((?:20)?\d{2})(?:년)?$/);
        if (match) {
          year = fullYear(match[1]);
          month = 12;
        }
      }
    }
    if (!year || month < 1 || month > 12) return null;
    if (periodType === "ANNUAL" && month !== 12) return null;
    if (["TTM", "QUARTER"].includes(periodType)) {
      if (![3, 6, 9, 12].includes(month)) return null;
      if (quarter && quarter * 3 !== month) return null;
    }
    const endDate = lastDayOfMonth(year, month);
    const key = `${periodType}:${endDate}:${valueType}`;
    return Object.freeze({ key, type: periodType, endDate, valueType });
  }

  function normalizedSourceUrl(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 2048 || typeof URL !== "function") return "";
    try {
      const url = new URL(text);
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
      if (!["www.butler.works", "butler.works"].includes(url.hostname.toLowerCase())) return "";
      if (!/^\/ko(?:\/|$)/.test(url.pathname) || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(url.pathname)) return "";
      url.protocol = "https:";
      url.hostname = "www.butler.works";
      url.port = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch (_error) {
      return "";
    }
  }

  function buildButlerCompanyUrl(input) {
    const candidate = typeof input === "string"
      ? input
      : input && typeof input === "object"
        ? input.sourceUrl || input.url || ""
        : "";
    if (/^https:\/\//i.test(String(candidate))) return normalizedSourceUrl(String(candidate));
    const corpCode = normalizedText(
      input && typeof input === "object" ? input.corpCode || input.companyId || "" : candidate
    );
    if (corpCode) {
      if (!/^\d{8}$/.test(corpCode)) return "";
      return `https://www.butler.works/ko/companies/${corpCode}`;
    }
    return "https://www.butler.works/ko/home";
  }

  function normalizeContext(context, diagnostics) {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      diagnostics.push(diagnostic("INVALID_CONTEXT"));
      return null;
    }
    const market = normalizedText(context.market).toUpperCase();
    let ticker = normalizedText(context.ticker).toUpperCase();
    const entityName = normalizedText(context.entityName).replace(/\s+/g, " ");
    const currency = normalizedText(context.currency).toUpperCase();
    const sourceUrl = normalizedSourceUrl(context.sourceUrl);
    const retrievedAt = validIsoTimestamp(context.retrievedAt);
    if (!MARKETS.has(market)) diagnostics.push(diagnostic("INVALID_MARKET"));
    if (market === "KRX" && /^\d{1,6}$/.test(ticker)) ticker = ticker.padStart(6, "0");
    const validTicker = market === "KRX"
      ? /^\d{6}$/.test(ticker)
      : market === "US" && /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker);
    if (!validTicker) diagnostics.push(diagnostic("INVALID_TICKER"));
    if (!entityName || entityName.length > 200 || /[\u0000-\u001f\u007f]/.test(entityName)) {
      diagnostics.push(diagnostic("INVALID_ENTITY_NAME"));
    }
    if (!/^[A-Z]{3}$/.test(currency)) diagnostics.push(diagnostic("INVALID_CURRENCY"));
    if (!sourceUrl) diagnostics.push(diagnostic("INVALID_SOURCE_URL"));
    if (!retrievedAt) diagnostics.push(diagnostic("INVALID_RETRIEVED_AT"));
    if (retrievedAt && Date.parse(retrievedAt) > Date.now() + MAX_FUTURE_RETRIEVAL_SKEW_MS) {
      diagnostics.push(diagnostic("FUTURE_RETRIEVED_AT"));
    }
    if (diagnostics.some((item) => item.severity === "error")) return null;
    return Object.freeze({ market, ticker, entityName, currency, sourceUrl, retrievedAt });
  }

  function parseMode(value) {
    const normalized = normalizedText(value).replace(/\s+/g, "");
    if (normalized === "4분기누적") return "TTM";
    if (normalized === "분기") return "QUARTER";
    if (normalized === "연도") return "ANNUAL";
    return "";
  }

  const MISSING_VALUES = new Set(["", "-", "--", "—", "–", "N/A", "NA", "NULL", "미제공"]);
  const UNIT_SCALES = Object.freeze({
    "": 1,
    "원": 1,
    "천": 1_000,
    "천원": 1_000,
    "만": 10_000,
    "만원": 10_000,
    "백만": 1_000_000,
    "백만원": 1_000_000,
    "억": 100_000_000,
    "억원": 100_000_000,
    "조": 1_000_000_000_000,
    "조원": 1_000_000_000_000
  });

  function parseFinancialNumber(value) {
    const consensus = hasConsensusMarker(value);
    let text = removeEstimateMarkers(value).replace(/[\u00a0\u202f\s]/g, "");
    if (MISSING_VALUES.has(text.toUpperCase())) return { missing: true, consensus };
    let negative = false;
    const parenthesized = text.match(/^\((.+)\)$/);
    if (parenthesized) {
      negative = true;
      text = parenthesized[1];
    }
    const unitMatch = text.match(/(천원|만원|백만원|억원|조원|백만|천|만|억|조|원)$/);
    const unit = unitMatch ? unitMatch[1] : "";
    if (unit) text = text.slice(0, -unit.length);
    if (/^[+-]/.test(text)) {
      if (negative || text[0] === "+") negative = negative || false;
      else negative = true;
      text = text.slice(1);
    }
    const grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text);
    const plain = /^(?:\d+|\d*\.\d+)$/.test(text);
    if (!grouped && !plain) return { error: "INVALID_NUMBER", consensus };
    const numeric = Number(text.replaceAll(",", "")) * UNIT_SCALES[unit];
    const valueNumber = canonicalNumber(negative ? -numeric : numeric);
    if (!Number.isFinite(valueNumber) || Math.abs(valueNumber) > Number.MAX_SAFE_INTEGER) {
      return { error: "UNSAFE_NUMBER", consensus };
    }
    return { value: valueNumber, consensus };
  }

  function factKey(fact) {
    return `${fact.metric}|${fact.periodType}|${fact.periodEnd}|${fact.valueType}`;
  }

  function periodKey(period) {
    return `${period.type}:${period.endDate}:${period.valueType}`;
  }

  function comparePeriods(left, right) {
    return compareText(left.endDate, right.endDate)
      || compareText(left.type, right.type)
      || compareText(left.valueType, right.valueType);
  }

  function compareFacts(left, right) {
    return compareText(left.periodEnd, right.periodEnd)
      || compareText(left.periodType, right.periodType)
      || compareText(left.valueType, right.valueType)
      || METRIC_ORDER.indexOf(left.metric) - METRIC_ORDER.indexOf(right.metric);
  }

  function contentForDigest(snapshot) {
    return {
      schemaVersion: SCHEMA_VERSION,
      entity: snapshot.entity,
      source: {
        provider: PROVIDER.provider,
        acquisitionMethod: PROVIDER.acquisitionMethod,
        authority: PROVIDER.authority,
        suppliedBy: PROVIDER.suppliedBy,
        url: snapshot.source.url
      },
      periodType: snapshot.periodType,
      periods: [...snapshot.periods].sort(comparePeriods),
      facts: [...snapshot.facts].sort(compareFacts)
    };
  }

  function calculateContentDigest(snapshot) {
    return `${DIGEST_PREFIX}${cyrb128Hex(stableStringify(contentForDigest(snapshot)))}`;
  }

  function snapshotId(entity, periodType, digest) {
    return `external-butler-${entity.market.toLowerCase()}-${entity.ticker.toLowerCase()}-${periodType.toLowerCase()}-${digest.slice(-16)}`;
  }

  function hasCompleteCanonicalCoverage(periods, facts) {
    if (!periods.length) return false;
    const metricsByPeriod = new Map(periods.map((period) => [period.key, new Set()]));
    facts.forEach((fact) => metricsByPeriod.get(fact.periodKey)?.add(fact.metric));
    return [...metricsByPeriod.values()].every((metrics) => METRIC_ORDER.every((metric) => metrics.has(metric)));
  }

  function createSnapshot({ context, periodType, periods, facts, quality, revision = 1, revisionHistory = [] }) {
    const base = {
      schemaVersion: SCHEMA_VERSION,
      snapshotId: "",
      status: "CURRENT",
      digestAlgorithm: "CYRB128_V1_NON_CRYPTOGRAPHIC_CHANGE_DETECTION",
      contentDigest: "",
      revision,
      entity: {
        market: context.market,
        ticker: context.ticker,
        name: context.entityName,
        currency: context.currency
      },
      source: {
        ...PROVIDER,
        url: context.sourceUrl,
        retrievedAt: context.retrievedAt
      },
      periodType,
      periods: [...periods].sort(comparePeriods),
      facts: [...facts].sort(compareFacts),
      quality: {
        factCount: facts.length,
        periodCount: periods.length,
        metricCount: new Set(facts.map((fact) => fact.metric)).size,
        missingCellCount: Number(quality?.missingCellCount || 0),
        unknownMetricRowCount: Number(quality?.unknownMetricRowCount || 0),
        coverage: quality?.coverage === "COMPLETE" && hasCompleteCanonicalCoverage(periods, facts)
          ? "COMPLETE"
          : "PARTIAL"
      },
      revisionHistory: [...revisionHistory]
    };
    base.contentDigest = calculateContentDigest(base);
    base.snapshotId = snapshotId(base.entity, periodType, base.contentDigest);
    return deepFreeze(base);
  }

  function parseFailure(diagnostics, summary = {}) {
    return deepFreeze({
      ok: false,
      snapshot: null,
      diagnostics: dedupeDiagnostics(diagnostics),
      summary: {
        periodType: summary.periodType || "",
        periodCount: Number(summary.periodCount || 0),
        factCount: Number(summary.factCount || 0),
        missingCellCount: Number(summary.missingCellCount || 0),
        unknownMetricRowCount: Number(summary.unknownMetricRowCount || 0)
      }
    });
  }

  function parseButlerClipboard(text, context) {
    const diagnostics = [];
    const normalizedContext = normalizeContext(context, diagnostics);
    if (typeof text !== "string") diagnostics.push(diagnostic("INVALID_TEXT"));
    else if (utf8ByteLength(text) > MAX_CLIPBOARD_BYTES) diagnostics.push(diagnostic("CLIPBOARD_TOO_LARGE"));
    if (!normalizedContext || diagnostics.some((item) => item.severity === "error")) return parseFailure(diagnostics);

    const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const lines = cleanText.split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    if (!lines.length) return parseFailure([diagnostic("EMPTY_TABLE")]);
    if (lines.length - 1 > MAX_ROWS) return parseFailure([diagnostic("TOO_MANY_ROWS")]);

    const header = lines[0].split("\t").map(normalizedText);
    const mode = parseMode(header[0]);
    if (!mode) diagnostics.push(diagnostic("INVALID_MODE", "error", { rowNumber: 1, columnNumber: 1 }));
    if (header.length < 2) diagnostics.push(diagnostic("INVALID_PERIOD", "error", { rowNumber: 1 }));
    if (header.length - 1 > MAX_PERIODS) diagnostics.push(diagnostic("TOO_MANY_PERIODS"));
    const headerPeriods = [];
    const seenPeriods = new Set();
    if (mode && header.length - 1 <= MAX_PERIODS) {
      header.slice(1).forEach((cell, index) => {
        const period = parsePeriodHeader(cell, mode);
        if (!period) {
          diagnostics.push(diagnostic("INVALID_PERIOD", "error", { rowNumber: 1, columnNumber: index + 2 }));
          return;
        }
        if (seenPeriods.has(period.key)) {
          diagnostics.push(diagnostic("DUPLICATE_PERIOD", "error", { rowNumber: 1, columnNumber: index + 2 }));
          return;
        }
        seenPeriods.add(period.key);
        headerPeriods.push(period);
      });
    }
    if (diagnostics.some((item) => item.severity === "error")) {
      return parseFailure(diagnostics, { periodType: mode, periodCount: headerPeriods.length });
    }

    const factMap = new Map();
    const periodMap = new Map(headerPeriods.map((period) => [period.key, period]));
    let section = "UNCLASSIFIED";
    let missingCellCount = 0;
    let unknownMetricRowCount = 0;
    let recognizedMetricRowCount = 0;
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      if (!lines[lineIndex].trim()) continue;
      const rowNumber = lineIndex + 1;
      const cells = lines[lineIndex].split("\t").map(normalizedText);
      while (cells.length > header.length && cells[cells.length - 1] === "") cells.pop();
      const nonLabelValues = cells.slice(1).filter((cell) => cell !== "");
      if (cells.length === 1 || nonLabelValues.length === 0) {
        const knownSection = SECTION_NAMES[cells[0]];
        if (knownSection) section = knownSection;
        else diagnostics.push(diagnostic("UNKNOWN_SECTION", "warning", { rowNumber }));
        continue;
      }
      if (cells.length > header.length) {
        diagnostics.push(diagnostic("INVALID_ROW_WIDTH", "error", { rowNumber }));
        continue;
      }
      const metric = METRIC_ALIASES.get(normalizedMetricLabel(cells[0]));
      if (!metric) {
        unknownMetricRowCount += 1;
        diagnostics.push(diagnostic("UNKNOWN_METRIC", "warning", { rowNumber }));
        continue;
      }
      recognizedMetricRowCount += 1;
      for (let periodIndex = 0; periodIndex < headerPeriods.length; periodIndex += 1) {
        const parsedValue = parseFinancialNumber(cells[periodIndex + 1] || "");
        if (parsedValue.missing) {
          missingCellCount += 1;
          continue;
        }
        if (parsedValue.error) {
          diagnostics.push(diagnostic(parsedValue.error, "error", {
            rowNumber,
            columnNumber: periodIndex + 2,
            metric
          }));
          continue;
        }
        const sourcePeriod = headerPeriods[periodIndex];
        const valueType = parsedValue.consensus ? "CONSENSUS" : sourcePeriod.valueType;
        const factPeriod = valueType === sourcePeriod.valueType
          ? sourcePeriod
          : Object.freeze({
            key: `${mode}:${sourcePeriod.endDate}:${valueType}`,
            type: mode,
            endDate: sourcePeriod.endDate,
            valueType
          });
        periodMap.set(factPeriod.key, factPeriod);
        const fact = Object.freeze({
          metric,
          section,
          periodKey: factPeriod.key,
          periodType: mode,
          periodEnd: factPeriod.endDate,
          valueType,
          value: parsedValue.value,
          currency: normalizedContext.currency
        });
        if (fact.valueType === "ACTUAL" && fact.periodEnd > normalizedContext.retrievedAt.slice(0, 10)) {
          diagnostics.push(diagnostic("FUTURE_ACTUAL_PERIOD", "error", {
            rowNumber,
            columnNumber: periodIndex + 2,
            metric
          }));
          continue;
        }
        const key = factKey(fact);
        const previous = factMap.get(key);
        if (previous) {
          diagnostics.push(diagnostic(
            previous.value === fact.value ? "DUPLICATE_FACT" : "CONFLICTING_FACT",
            previous.value === fact.value ? "warning" : "error",
            { rowNumber, columnNumber: periodIndex + 2, metric }
          ));
        } else {
          factMap.set(key, fact);
        }
        if (factMap.size > MAX_FACTS) diagnostics.push(diagnostic("TOO_MANY_FACTS"));
      }
    }
    const referencedPeriodKeys = new Set([...factMap.values()].map((fact) => fact.periodKey));
    for (const [key, period] of periodMap) {
      if (period.valueType === "ACTUAL"
        && period.endDate > normalizedContext.retrievedAt.slice(0, 10)
        && !referencedPeriodKeys.has(key)) {
        periodMap.delete(key);
      }
    }
    if (periodMap.size > MAX_PERIODS) diagnostics.push(diagnostic("TOO_MANY_PERIODS"));
    if (!factMap.size) diagnostics.push(diagnostic("NO_SUPPORTED_FACTS"));
    const summary = {
      periodType: mode,
      periodCount: periodMap.size,
      factCount: factMap.size,
      missingCellCount,
      unknownMetricRowCount
    };
    if (diagnostics.some((item) => item.severity === "error")) return parseFailure(diagnostics, summary);

    const snapshot = createSnapshot({
      context: normalizedContext,
      periodType: mode,
      periods: [...periodMap.values()],
      facts: [...factMap.values()],
      quality: {
        missingCellCount,
        unknownMetricRowCount,
        coverage: recognizedMetricRowCount === METRIC_ORDER.length
          && factMap.size === METRIC_ORDER.length * headerPeriods.length
          && unknownMetricRowCount === 0
          ? "COMPLETE"
          : "PARTIAL"
      }
    });
    const validation = validateExternalSnapshot(snapshot);
    if (!validation.ok) return parseFailure([...diagnostics, ...validation.diagnostics], summary);
    return deepFreeze({
      ok: true,
      snapshot: validation.snapshot,
      diagnostics: dedupeDiagnostics(diagnostics),
      summary
    });
  }

  function forbiddenPayloadKey(value) {
    const key = String(value || "").replace(/[_-]/g, "");
    return /^(?:raw(?:text|data|content|facts?)?|clipboard(?:text|data|content)?|html|source(?:text|html)|original(?:text|html)|payload)$/i.test(key);
  }

  function inspectSnapshotStructure(value) {
    const stack = [{ value, depth: 0 }];
    const seen = new Set();
    let nodes = 0;
    let properties = 0;
    while (stack.length) {
      const current = stack.pop();
      if (!current.value || typeof current.value !== "object" || seen.has(current.value)) continue;
      seen.add(current.value);
      nodes += 1;
      if (nodes > MAX_SCAN_NODES || (Array.isArray(current.value) && current.value.length > MAX_SCAN_ARRAY_LENGTH)) {
        return { forbidden: false, exceeded: true };
      }
      for (const key in current.value) {
        if (!Object.hasOwn(current.value, key)) continue;
        properties += 1;
        if (properties > MAX_SCAN_PROPERTIES) return { forbidden: false, exceeded: true };
        if (forbiddenPayloadKey(key)) return { forbidden: true, exceeded: false };
        const child = current.value[key];
        if (!child || typeof child !== "object" || seen.has(child)) continue;
        if (current.depth >= MAX_SCAN_DEPTH) return { forbidden: false, exceeded: true };
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
    return { forbidden: false, exceeded: false };
  }

  function safeNonNegativeInteger(value) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
  }

  function normalizeRevisionHistory(value, diagnostics) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_REVISIONS) {
      diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
      return [];
    }
    const output = [];
    value.forEach((entry) => {
      if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.revision) || entry.revision < 2
        || !new RegExp(`^${DIGEST_PREFIX}[a-f0-9]{32}$`).test(String(entry.previousDigest || ""))
        || !validIsoTimestamp(entry.changedAt)
        || !Number.isSafeInteger(entry.changeCount) || entry.changeCount < 0
        || !Array.isArray(entry.changes) || entry.changes.length > MAX_REVISION_DETAILS) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      const changes = [];
      entry.changes.forEach((change) => {
        if (!change || typeof change !== "object" || !["ADDED", "CHANGED"].includes(change.type)
          || !METRIC_SET.has(change.metric) || !PERIOD_TYPES.has(change.periodType)
          || !VALUE_TYPES.has(change.valueType) || !validDateKey(change.periodEnd)) {
          diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
          return;
        }
        const normalized = {
          type: change.type,
          metric: change.metric,
          periodType: change.periodType,
          periodEnd: change.periodEnd,
          valueType: change.valueType,
          currentValue: change.currentValue
        };
        if (typeof normalized.currentValue !== "number" || !Number.isFinite(normalized.currentValue)
          || Math.abs(normalized.currentValue) > Number.MAX_SAFE_INTEGER) {
          diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
          return;
        }
        if (change.type === "CHANGED") {
          normalized.previousValue = change.previousValue;
          if (typeof normalized.previousValue !== "number" || !Number.isFinite(normalized.previousValue)
            || Math.abs(normalized.previousValue) > Number.MAX_SAFE_INTEGER) {
            diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
            return;
          }
        }
        changes.push(normalized);
      });
      if (entry.changeCount < changes.length
        || (entry.changeCount <= MAX_REVISION_DETAILS && entry.changeCount !== changes.length)) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      output.push({
        revision: entry.revision,
        previousDigest: entry.previousDigest,
        changedAt: validIsoTimestamp(entry.changedAt),
        changeCount: entry.changeCount,
        changes
      });
    });
    return output;
  }

  function validateExternalSnapshot(input) {
    const diagnostics = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return deepFreeze({ ok: false, valid: false, snapshot: null, diagnostics: [diagnostic("INVALID_SNAPSHOT")] });
    }
    const structureInspection = inspectSnapshotStructure(input);
    if (structureInspection.forbidden) diagnostics.push(diagnostic("FORBIDDEN_RAW_CONTENT"));
    if (structureInspection.exceeded) diagnostics.push(diagnostic("SNAPSHOT_STRUCTURE_LIMIT"));
    const entity = input.entity && typeof input.entity === "object" ? input.entity : {};
    const source = input.source && typeof input.source === "object" ? input.source : {};
    const contextDiagnostics = [];
    const context = normalizeContext({
      market: entity.market,
      ticker: entity.ticker,
      entityName: entity.name,
      currency: entity.currency,
      sourceUrl: source.url,
      retrievedAt: source.retrievedAt
    }, contextDiagnostics);
    diagnostics.push(...contextDiagnostics);
    if (input.schemaVersion !== SCHEMA_VERSION
      || input.status !== "CURRENT"
      || input.digestAlgorithm !== "CYRB128_V1_NON_CRYPTOGRAPHIC_CHANGE_DETECTION"
      || source.provider !== PROVIDER.provider
      || source.acquisitionMethod !== PROVIDER.acquisitionMethod
      || source.authority !== PROVIDER.authority
      || source.suppliedBy !== PROVIDER.suppliedBy
      || !PERIOD_TYPES.has(input.periodType)
      || !Number.isSafeInteger(input.revision) || input.revision < 1) {
      diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
    }
    if (!Array.isArray(input.periods) || input.periods.length < 1 || input.periods.length > MAX_PERIODS) {
      diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
    }
    if (!Array.isArray(input.facts) || input.facts.length < 1 || input.facts.length > MAX_FACTS) {
      diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
    }
    const periodInputs = Array.isArray(input.periods) && input.periods.length <= MAX_PERIODS ? input.periods : [];
    const periods = [];
    const knownPeriods = new Set();
    const retrievedDate = context?.retrievedAt?.slice(0, 10) || "";
    periodInputs.forEach((period) => {
      if (!period || typeof period !== "object" || !PERIOD_TYPES.has(period.type)
        || period.type !== input.periodType || !VALUE_TYPES.has(period.valueType)
        || !validDateKey(period.endDate)) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      const normalized = {
        key: periodKey(period),
        type: period.type,
        endDate: period.endDate,
        valueType: period.valueType
      };
      if (normalized.valueType === "ACTUAL" && retrievedDate && normalized.endDate > retrievedDate) {
        diagnostics.push(diagnostic("FUTURE_ACTUAL_PERIOD"));
        return;
      }
      if (period.key !== normalized.key || knownPeriods.has(normalized.key)) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      knownPeriods.add(normalized.key);
      periods.push(normalized);
    });
    const factInputs = Array.isArray(input.facts) && input.facts.length <= MAX_FACTS ? input.facts : [];
    const facts = [];
    const knownFacts = new Map();
    factInputs.forEach((fact) => {
      const numeric = fact?.value;
      if (!fact || typeof fact !== "object" || !METRIC_SET.has(fact.metric)
        || !PERIOD_TYPES.has(fact.periodType) || fact.periodType !== input.periodType
        || !VALUE_TYPES.has(fact.valueType) || !validDateKey(fact.periodEnd)
        || !/^[A-Z]{3}$/.test(String(fact.currency || "")) || fact.currency !== entity.currency
        || ![...Object.values(SECTION_NAMES), "UNCLASSIFIED"].includes(fact.section)
        || typeof numeric !== "number" || !Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      const normalized = {
        metric: fact.metric,
        section: fact.section,
        periodKey: `${fact.periodType}:${fact.periodEnd}:${fact.valueType}`,
        periodType: fact.periodType,
        periodEnd: fact.periodEnd,
        valueType: fact.valueType,
        value: canonicalNumber(numeric),
        currency: fact.currency
      };
      if (normalized.valueType === "ACTUAL" && retrievedDate && normalized.periodEnd > retrievedDate) {
        diagnostics.push(diagnostic("FUTURE_ACTUAL_PERIOD", "error", { metric: normalized.metric }));
        return;
      }
      if (fact.periodKey !== normalized.periodKey || !knownPeriods.has(normalized.periodKey)) {
        diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
        return;
      }
      const key = factKey(normalized);
      if (knownFacts.has(key)) {
        diagnostics.push(diagnostic(
          knownFacts.get(key).value === normalized.value ? "DUPLICATE_FACT" : "CONFLICTING_FACT",
          knownFacts.get(key).value === normalized.value ? "warning" : "error",
          { metric: normalized.metric }
        ));
        return;
      }
      knownFacts.set(key, normalized);
      facts.push(normalized);
    });
    const revisionHistory = normalizeRevisionHistory(input.revisionHistory, diagnostics);
    const historyIsOrdered = revisionHistory.every((entry, index) => (
      (index === 0 || entry.revision > revisionHistory[index - 1].revision)
      && (!source.retrievedAt || Date.parse(entry.changedAt) <= Date.parse(source.retrievedAt))
    ));
    if ((input.revision === 1 && revisionHistory.length !== 0)
      || (input.revision > 1 && (!revisionHistory.length || revisionHistory.at(-1).revision !== input.revision))
      || !historyIsOrdered) {
      diagnostics.push(diagnostic("INVALID_SNAPSHOT"));
    }
    if (diagnostics.some((item) => item.severity === "error") || !context) {
      return deepFreeze({ ok: false, valid: false, snapshot: null, diagnostics: dedupeDiagnostics(diagnostics) });
    }
    const normalized = createSnapshot({
      context,
      periodType: input.periodType,
      periods,
      facts,
      quality: {
        missingCellCount: safeNonNegativeInteger(input.quality?.missingCellCount),
        unknownMetricRowCount: safeNonNegativeInteger(input.quality?.unknownMetricRowCount),
        coverage: input.quality?.coverage
      },
      revision: input.revision,
      revisionHistory
    });
    if (input.contentDigest !== normalized.contentDigest || input.snapshotId !== normalized.snapshotId) {
      diagnostics.push(diagnostic("DIGEST_MISMATCH"));
      return deepFreeze({ ok: false, valid: false, snapshot: null, diagnostics: dedupeDiagnostics(diagnostics) });
    }
    return deepFreeze({ ok: true, valid: true, snapshot: normalized, diagnostics: dedupeDiagnostics(diagnostics) });
  }

  function unwrapSnapshot(value) {
    return value && value.snapshot && typeof value.snapshot === "object" ? value.snapshot : value;
  }

  function seriesKey(snapshot) {
    return `${snapshot.entity.market}|${snapshot.entity.ticker}|${snapshot.entity.currency}|${snapshot.source.provider}|${snapshot.periodType}`;
  }

  function mergeResult(ok, status, snapshot, snapshots, diagnostics, changes = []) {
    return deepFreeze({
      ok,
      status,
      snapshot: snapshot || null,
      snapshots: snapshots || (snapshot ? [snapshot] : []),
      changes,
      diagnostics: dedupeDiagnostics(diagnostics)
    });
  }

  function mergePair(existingValue, incomingValue) {
    const existingValidation = validateExternalSnapshot(unwrapSnapshot(existingValue));
    const incomingValidation = validateExternalSnapshot(unwrapSnapshot(incomingValue));
    if (!existingValidation.ok || !incomingValidation.ok) {
      return mergeResult(false, "INVALID", null, [], [
        ...existingValidation.diagnostics,
        ...incomingValidation.diagnostics
      ]);
    }
    const existing = existingValidation.snapshot;
    const incoming = incomingValidation.snapshot;
    if (seriesKey(existing) !== seriesKey(incoming)) {
      return mergeResult(false, "DIFFERENT_SERIES", existing, [existing], [diagnostic("DIFFERENT_SERIES")]);
    }
    if (existing.contentDigest === incoming.contentDigest) {
      const refreshed = Date.parse(incoming.source.retrievedAt) > Date.parse(existing.source.retrievedAt)
        ? createSnapshot({
          context: {
            market: incoming.entity.market,
            ticker: incoming.entity.ticker,
            entityName: incoming.entity.name,
            currency: incoming.entity.currency,
            sourceUrl: incoming.source.url,
            retrievedAt: incoming.source.retrievedAt
          },
          periodType: incoming.periodType,
          periods: incoming.periods,
          facts: incoming.facts,
          quality: incoming.quality,
          revision: existing.revision,
          revisionHistory: existing.revisionHistory
        })
        : existing;
      return mergeResult(true, "DUPLICATE", refreshed, [refreshed], [diagnostic("DUPLICATE_SNAPSHOT", "info")]);
    }
    const existingTime = Date.parse(existing.source.retrievedAt);
    const incomingTime = Date.parse(incoming.source.retrievedAt);
    if (incomingTime === existingTime) {
      return mergeResult(false, "CONFLICT", existing, [existing], [diagnostic("SNAPSHOT_CONFLICT")]);
    }
    if (incomingTime < existingTime) {
      return mergeResult(false, "STALE", existing, [existing], [diagnostic("STALE_SNAPSHOT")]);
    }

    const factMap = new Map(existing.facts.map((fact) => [factKey(fact), fact]));
    const changes = [];
    incoming.facts.forEach((fact) => {
      const key = factKey(fact);
      const previous = factMap.get(key);
      if (!previous) {
        changes.push({
          type: "ADDED",
          metric: fact.metric,
          periodType: fact.periodType,
          periodEnd: fact.periodEnd,
          valueType: fact.valueType,
          currentValue: fact.value
        });
        factMap.set(key, fact);
      } else if (previous.value !== fact.value) {
        changes.push({
          type: "CHANGED",
          metric: fact.metric,
          periodType: fact.periodType,
          periodEnd: fact.periodEnd,
          valueType: fact.valueType,
          previousValue: previous.value,
          currentValue: fact.value
        });
        factMap.set(key, fact);
      }
    });
    changes.sort((left, right) => (
      compareText(left.periodEnd, right.periodEnd)
      || compareText(left.valueType, right.valueType)
      || METRIC_ORDER.indexOf(left.metric) - METRIC_ORDER.indexOf(right.metric)
    ));
    const periodMap = new Map(existing.periods.map((period) => [period.key, period]));
    incoming.periods.forEach((period) => periodMap.set(period.key, period));
    if (factMap.size > MAX_FACTS || periodMap.size > MAX_PERIODS) {
      return mergeResult(false, "INVALID", existing, [existing], [
        diagnostic(factMap.size > MAX_FACTS ? "TOO_MANY_FACTS" : "TOO_MANY_PERIODS")
      ]);
    }
    const revisionEntry = {
      revision: existing.revision + 1,
      previousDigest: existing.contentDigest,
      changedAt: incoming.source.retrievedAt,
      changeCount: changes.length,
      changes: changes.slice(0, MAX_REVISION_DETAILS)
    };
    const history = [...existing.revisionHistory, revisionEntry];
    const diagnostics = [];
    if (history.length > MAX_REVISIONS) diagnostics.push(diagnostic("REVISION_HISTORY_TRUNCATED", "warning"));
    const context = {
      market: incoming.entity.market,
      ticker: incoming.entity.ticker,
      entityName: incoming.entity.name,
      currency: incoming.entity.currency,
      sourceUrl: incoming.source.url,
      retrievedAt: incoming.source.retrievedAt
    };
    const merged = createSnapshot({
      context,
      periodType: incoming.periodType,
      periods: [...periodMap.values()],
      facts: [...factMap.values()],
      quality: {
        missingCellCount: incoming.quality.missingCellCount,
        unknownMetricRowCount: incoming.quality.unknownMetricRowCount,
        coverage: incoming.quality.coverage
      },
      revision: existing.revision + 1,
      revisionHistory: history.slice(-MAX_REVISIONS)
    });
    return mergeResult(true, "REVISED", merged, [merged], diagnostics, changes);
  }

  function mergeSnapshots(existingValue, incomingValue) {
    if (arguments.length === 1 && Array.isArray(existingValue)) {
      const snapshots = [];
      const diagnostics = [];
      for (const candidate of existingValue) {
        const validation = validateExternalSnapshot(unwrapSnapshot(candidate));
        if (!validation.ok) return mergeResult(false, "INVALID", null, snapshots, [...diagnostics, ...validation.diagnostics]);
        const key = seriesKey(validation.snapshot);
        const index = snapshots.findIndex((snapshot) => seriesKey(snapshot) === key);
        if (index < 0) snapshots.push(validation.snapshot);
        else {
          const result = mergePair(snapshots[index], validation.snapshot);
          diagnostics.push(...result.diagnostics);
          if (!result.ok && !["STALE", "CONFLICT"].includes(result.status)) {
            return mergeResult(false, result.status, result.snapshot, snapshots, diagnostics);
          }
          if (!result.ok) return mergeResult(false, result.status, result.snapshot, snapshots, diagnostics);
          snapshots[index] = result.snapshot;
        }
      }
      snapshots.sort((left, right) => compareText(seriesKey(left), seriesKey(right)));
      return mergeResult(true, "MERGED", snapshots[0] || null, snapshots, diagnostics);
    }
    if (existingValue == null) {
      const validation = validateExternalSnapshot(unwrapSnapshot(incomingValue));
      if (!validation.ok) return mergeResult(false, "INVALID", null, [], validation.diagnostics);
      return mergeResult(true, "ADDED", validation.snapshot, [validation.snapshot], []);
    }
    if (Array.isArray(existingValue)) {
      const incomingValidation = validateExternalSnapshot(unwrapSnapshot(incomingValue));
      if (!incomingValidation.ok) return mergeResult(false, "INVALID", null, existingValue, incomingValidation.diagnostics);
      const existing = [];
      for (const candidate of existingValue) {
        const validation = validateExternalSnapshot(unwrapSnapshot(candidate));
        if (!validation.ok) return mergeResult(false, "INVALID", null, existing, validation.diagnostics);
        existing.push(validation.snapshot);
      }
      const key = seriesKey(incomingValidation.snapshot);
      const index = existing.findIndex((snapshot) => seriesKey(snapshot) === key);
      if (index < 0) {
        existing.push(incomingValidation.snapshot);
        existing.sort((left, right) => compareText(seriesKey(left), seriesKey(right)));
        return mergeResult(true, "ADDED", incomingValidation.snapshot, existing, []);
      }
      const result = mergePair(existing[index], incomingValidation.snapshot);
      if (result.ok) existing[index] = result.snapshot;
      return mergeResult(result.ok, result.status, result.snapshot, existing, result.diagnostics, result.changes);
    }
    return mergePair(existingValue, incomingValue);
  }

  function compactFact(fact) {
    return {
      value: fact.value,
      currency: fact.currency,
      periodType: fact.periodType,
      periodEnd: fact.periodEnd,
      valueType: fact.valueType
    };
  }

  function rateOfChange(current, previous) {
    if (!current || !previous || previous.value === 0) return null;
    return (current.value - previous.value) / Math.abs(previous.value);
  }

  function safeRatio(numerator, denominator) {
    return typeof numerator === "number" && typeof denominator === "number" && denominator !== 0
      ? numerator / denominator
      : null;
  }

  function summarizeCompanyFacts(value) {
    const validation = validateExternalSnapshot(unwrapSnapshot(value));
    if (!validation.ok) {
      return deepFreeze({ ok: false, summary: null, diagnostics: validation.diagnostics });
    }
    const snapshot = validation.snapshot;
    const metrics = {};
    METRIC_ORDER.forEach((metric) => {
      const metricFacts = snapshot.facts.filter((fact) => fact.metric === metric).sort(compareFacts);
      if (!metricFacts.length) return;
      const actual = metricFacts.filter((fact) => fact.valueType === "ACTUAL");
      const consensus = metricFacts.filter((fact) => fact.valueType === "CONSENSUS");
      const latestActual = actual.at(-1) || null;
      const latestConsensus = consensus.at(-1) || null;
      let comparableActual = null;
      if (latestActual) {
        const target = new Date(`${latestActual.periodEnd}T00:00:00.000Z`);
        target.setUTCFullYear(target.getUTCFullYear() - 1);
        const targetDate = target.toISOString().slice(0, 10);
        comparableActual = actual.find((fact) => fact.periodEnd === targetDate) || actual.at(-2) || null;
      }
      metrics[metric] = {
        latestActual: latestActual ? compactFact(latestActual) : null,
        latestConsensus: latestConsensus ? compactFact(latestConsensus) : null,
        previousActual: comparableActual ? compactFact(comparableActual) : null,
        actualChangeRate: rateOfChange(latestActual, comparableActual)
      };
    });
    const byPeriod = new Map();
    snapshot.facts.forEach((fact) => {
      const key = `${fact.periodType}|${fact.periodEnd}|${fact.valueType}`;
      if (!byPeriod.has(key)) byPeriod.set(key, new Map());
      byPeriod.get(key).set(fact.metric, fact);
    });
    const ratios = [...byPeriod.entries()].sort((left, right) => compareText(left[0], right[0])).map(([key, facts]) => {
      const revenue = facts.get("REVENUE")?.value;
      const equity = facts.get("TOTAL_EQUITY")?.value;
      const [periodType, periodEnd, valueType] = key.split("|");
      return {
        periodType,
        periodEnd,
        valueType,
        operatingMargin: safeRatio(facts.get("OPERATING_INCOME")?.value, revenue),
        netMargin: safeRatio(facts.get("NET_INCOME")?.value, revenue),
        freeCashFlowMargin: safeRatio(facts.get("FREE_CASH_FLOW")?.value, revenue),
        liabilitiesToEquity: safeRatio(facts.get("TOTAL_LIABILITIES")?.value, equity)
      };
    }).filter((item) => Object.entries(item).some(([key, itemValue]) => (
      !["periodType", "periodEnd", "valueType"].includes(key) && itemValue !== null
    )));
    const summary = {
      schemaVersion: SCHEMA_VERSION,
      entity: { ...snapshot.entity },
      source: { ...snapshot.source },
      contentDigest: snapshot.contentDigest,
      periodType: snapshot.periodType,
      asOf: snapshot.periods.map((period) => period.endDate).sort(compareText).at(-1) || "",
      metrics,
      ratios,
      dataQuality: { ...snapshot.quality },
      limitations: [
        "SECONDARY_AGGREGATOR_USER_SUPPLIED",
        "NO_INDEPENDENT_SOURCE_AUTHENTICITY_PROOF",
        ...(Object.values(metrics).some((metric) => metric.latestConsensus)
          ? ["CONSENSUS_IS_NOT_CONFIRMED_ACTUAL"]
          : [])
      ]
    };
    return deepFreeze({ ok: true, summary, diagnostics: validation.diagnostics });
  }

  return Object.freeze({
    buildButlerCompanyUrl,
    mergeSnapshots,
    parseButlerClipboard,
    summarizeCompanyFacts,
    validateExternalSnapshot
  });
});
