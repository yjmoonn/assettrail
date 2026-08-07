(function attachAssetTrailAiReportEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailAiReportEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAiReportEngine() {
  "use strict";

  const EVIDENCE_SCHEMA = "ASSETTRAIL_AI_EVIDENCE_V1";
  const REPORT_SCHEMA = "ASSETTRAIL_AI_REPORT_V1";
  const HANDOFF_SCHEMA = "ASSETTRAIL_CHATGPT_HANDOFF_V1";
  const POLICY = "RELATIVE_METRICS_ONLY";
  const MAX_FACTS_DEFAULT = 24;
  const MAX_FACTS_HARD = 64;
  const MAX_EVIDENCE_DEFAULT = 48;
  const MAX_EVIDENCE_HARD = 96;
  const MAX_EVIDENCE_PER_FACT = 8;
  const MAX_REPORT_ITEMS = 24;
  const MAX_SENTENCE_LENGTH = 240;
  const MAX_ENVELOPE_BYTES = 64 * 1024;
  const MAX_REPORT_BYTES = 24 * 1024;
  const MAX_RAW_ITEMS = 2048;

  const QUALITY = Object.freeze(["VERIFIED", "LIMITED", "STALE", "INCOMPLETE", "UNAVAILABLE", "UNKNOWN"]);
  const QUALITY_RANK = Object.freeze({
    VERIFIED: 0,
    LIMITED: 1,
    STALE: 2,
    INCOMPLETE: 3,
    UNAVAILABLE: 4,
    UNKNOWN: 5
  });
  const FACT_KINDS = Object.freeze(["WEIGHT", "RETURN", "RATIO", "STATUS"]);
  const REPORT_KINDS = Object.freeze(["CALCULATED_FACT", "INTERPRETATION", "UNCERTAINTY"]);
  const REPORT_SECTIONS = Object.freeze([
    "ALLOCATION",
    "EXPOSURE",
    "PERFORMANCE",
    "RISK",
    "EXTERNAL_DATA",
    "DATA_QUALITY"
  ]);
  const EVIDENCE_KINDS = Object.freeze([
    "PORTFOLIO_CALCULATION",
    "PERFORMANCE_CALCULATION",
    "ETF_HOLDINGS",
    "MARKET_DATA",
    "FX_DATA",
    "COMPANY_FILING",
    "COMPANY_FACT",
    "OPENDART_FILING",
    "SEC_COMPANY_FACTS",
    "BUTLER_SNAPSHOT",
    "USER_POLICY",
    "DATA_QUALITY"
  ]);
  const LIMITATION_CODES = Object.freeze([
    "CONFLICTING_EVIDENCE",
    "CONFLICTING_FACTS",
    "EVIDENCE_LIMIT_REACHED",
    "EVIDENCE_REFERENCE_LIMIT_REACHED",
    "EXCLUDED_SENSITIVE_INPUT",
    "EXCLUDED_UNSTRUCTURED_INPUT",
    "FACT_LIMIT_REACHED",
    "INCOMPLETE_PERFORMANCE",
    "INPUT_LIMIT_REACHED",
    "INVALID_AS_OF_DATE",
    "INVALID_EVIDENCE",
    "INVALID_INPUT",
    "UNKNOWN_EVIDENCE",
    "UNSUPPORTED_FACT"
  ]);

  const METRICS_BY_KIND = Object.freeze({
    WEIGHT: new Set([
      "PORTFOLIO_WEIGHT",
      "DOMESTIC_WEIGHT",
      "OVERSEAS_WEIGHT",
      "CASH_WEIGHT",
      "MANUAL_WEIGHT",
      "CORE_WEIGHT",
      "STRUCTURAL_GROWTH_WEIGHT",
      "CYCLE_WEIGHT",
      "TACTICAL_WEIGHT",
      "SURVIVAL_WEIGHT",
      "COUNTRY_EXPOSURE_WEIGHT",
      "CURRENCY_EXPOSURE_WEIGHT",
      "INDUSTRY_EXPOSURE_WEIGHT",
      "ETF_TOTAL_WEIGHT",
      "ETF_MAPPED_WEIGHT",
      "ETF_UNMAPPED_WEIGHT",
      "ETF_CASH_OTHER_WEIGHT",
      "DIRECT_OVERLAP_WEIGHT",
      "PORTFOLIO_CONCENTRATION"
    ]),
    RETURN: new Set([
      "TWR_RETURN",
      "XIRR_RETURN",
      "KOSPI_RETURN",
      "SP500_KRW_RETURN",
      "BENCHMARK_RETURN",
      "BENCHMARK_RETURN_GAP",
      "MAX_DRAWDOWN",
      "ANNUALIZED_VOLATILITY",
      "PRICE_CHANGE"
    ]),
    RATIO: new Set([
      "REVENUE_GROWTH",
      "OPERATING_PROFIT_GROWTH",
      "NET_INCOME_GROWTH",
      "EPS_GROWTH",
      "OPERATING_MARGIN",
      "NET_MARGIN",
      "ROE",
      "ROA",
      "DEBT_RATIO",
      "CURRENT_RATIO",
      "FCF_MARGIN",
      "CONSENSUS_REVENUE_GROWTH",
      "CONSENSUS_OPERATING_PROFIT_GROWTH",
      "EARNINGS_SURPRISE_RATE",
      "DATA_COVERAGE",
      "REVENUE_GROWTH_PCT",
      "OPERATING_MARGIN_PCT",
      "NET_MARGIN_PCT",
      "FREE_CASH_FLOW_MARGIN_PCT",
      "LIABILITIES_TO_EQUITY_PCT"
    ]),
    STATUS: new Set([
      "AI_READINESS",
      "COMPANY_DATA",
      "DATA_FRESHNESS",
      "ETF_COVERAGE",
      "FX_DATA",
      "LEDGER_DATA",
      "PERFORMANCE_DATA",
      "PRICE_DATA",
      "REVIEW_STATE"
    ])
  });
  const SCOPES = new Set([
    "TOTAL",
    "PORTFOLIO",
    "DOMESTIC",
    "OVERSEAS",
    "CASH",
    "MANUAL",
    "CORE",
    "STRUCTURAL_GROWTH",
    "CYCLE",
    "TACTICAL",
    "SURVIVAL",
    "KOREA",
    "UNITED_STATES",
    "OTHER",
    "KRW",
    "USD",
    "KOSPI",
    "SP500",
    "BENCHMARK",
    "UNKNOWN"
  ]);
  const STATES = new Set([
    "OK",
    "WATCH",
    "REVIEW_REQUIRED",
    "BLOCKED",
    "AVAILABLE",
    "LIMITED",
    "UNAVAILABLE",
    "STALE",
    "INCOMPLETE",
    "VERIFIED",
    "UNKNOWN"
  ]);

  const METRIC_LABELS = Object.freeze({
    PORTFOLIO_WEIGHT: "포트폴리오 비중",
    DOMESTIC_WEIGHT: "국내 자산 비중",
    OVERSEAS_WEIGHT: "해외 자산 비중",
    CASH_WEIGHT: "현금 비중",
    MANUAL_WEIGHT: "수동 평가 자산 비중",
    CORE_WEIGHT: "코어 비중",
    STRUCTURAL_GROWTH_WEIGHT: "구조적 성장 비중",
    CYCLE_WEIGHT: "사이클 비중",
    TACTICAL_WEIGHT: "전술 비중",
    SURVIVAL_WEIGHT: "생존 자산 비중",
    COUNTRY_EXPOSURE_WEIGHT: "국가 실질노출 비중",
    CURRENCY_EXPOSURE_WEIGHT: "통화 실질노출 비중",
    INDUSTRY_EXPOSURE_WEIGHT: "산업 실질노출 비중",
    ETF_TOTAL_WEIGHT: "ETF 전체 비중",
    ETF_MAPPED_WEIGHT: "ETF 매핑 비중",
    ETF_UNMAPPED_WEIGHT: "ETF 미매핑 비중",
    ETF_CASH_OTHER_WEIGHT: "ETF 내부 현금·기타 비중",
    DIRECT_OVERLAP_WEIGHT: "직접 보유 중복노출 비중",
    PORTFOLIO_CONCENTRATION: "포트폴리오 집중도",
    TWR_RETURN: "시간가중수익률",
    XIRR_RETURN: "금액가중수익률",
    KOSPI_RETURN: "KOSPI 가격지수 수익률",
    SP500_KRW_RETURN: "S&P 500 원화 비헤지 가격지수 수익률",
    BENCHMARK_RETURN: "벤치마크 수익률",
    BENCHMARK_RETURN_GAP: "벤치마크 대비 참고 수익률 차이",
    MAX_DRAWDOWN: "관측점 기준 최대 낙폭",
    ANNUALIZED_VOLATILITY: "관측일 수익률 기준 연환산 변동성",
    PRICE_CHANGE: "가격 변화율",
    REVENUE_GROWTH: "매출 성장률",
    OPERATING_PROFIT_GROWTH: "영업이익 성장률",
    NET_INCOME_GROWTH: "순이익 성장률",
    EPS_GROWTH: "주당순이익 성장률",
    OPERATING_MARGIN: "영업이익률",
    NET_MARGIN: "순이익률",
    ROE: "자기자본이익률",
    ROA: "총자산이익률",
    DEBT_RATIO: "부채비율",
    CURRENT_RATIO: "유동비율",
    FCF_MARGIN: "잉여현금흐름 마진",
    CONSENSUS_REVENUE_GROWTH: "매출 컨센서스 성장률",
    CONSENSUS_OPERATING_PROFIT_GROWTH: "영업이익 컨센서스 성장률",
    EARNINGS_SURPRISE_RATE: "실적 서프라이즈율",
    DATA_COVERAGE: "외부 데이터 커버리지",
    REVENUE_GROWTH_PCT: "매출 성장률",
    OPERATING_MARGIN_PCT: "영업이익률",
    NET_MARGIN_PCT: "순이익률",
    FREE_CASH_FLOW_MARGIN_PCT: "잉여현금흐름 마진",
    LIABILITIES_TO_EQUITY_PCT: "자본 대비 부채비율",
    AI_READINESS: "AI 보고서 준비",
    COMPANY_DATA: "기업 데이터",
    DATA_FRESHNESS: "데이터 최신성",
    ETF_COVERAGE: "ETF 구성종목 커버리지",
    FX_DATA: "환율 데이터",
    LEDGER_DATA: "원장 데이터",
    PERFORMANCE_DATA: "성과 데이터",
    PRICE_DATA: "가격 데이터",
    REVIEW_STATE: "검토 상태"
  });
  const SCOPE_LABELS = Object.freeze({
    TOTAL: "",
    PORTFOLIO: "포트폴리오 ",
    DOMESTIC: "국내 ",
    OVERSEAS: "해외 ",
    CASH: "현금 ",
    MANUAL: "수동 평가 자산 ",
    CORE: "코어 ",
    STRUCTURAL_GROWTH: "구조적 성장 ",
    CYCLE: "사이클 ",
    TACTICAL: "전술 ",
    SURVIVAL: "생존 자산 ",
    KOREA: "한국 ",
    UNITED_STATES: "미국 ",
    OTHER: "기타 ",
    KRW: "원화 ",
    USD: "미국 달러 ",
    KOSPI: "KOSPI ",
    SP500: "S&P 500 ",
    BENCHMARK: "벤치마크 ",
    UNKNOWN: "범위 미확인 "
  });
  const QUALITY_LABELS = Object.freeze({
    VERIFIED: "검증됨",
    LIMITED: "제한적",
    STALE: "오래됨",
    INCOMPLETE: "불완전",
    UNAVAILABLE: "사용 불가",
    UNKNOWN: "확인 불가"
  });
  const STATE_LABELS = Object.freeze({
    OK: "정상",
    WATCH: "관찰 필요",
    REVIEW_REQUIRED: "검토 필요",
    BLOCKED: "차단됨",
    AVAILABLE: "사용 가능",
    LIMITED: "제한적",
    UNAVAILABLE: "사용 불가",
    STALE: "오래됨",
    INCOMPLETE: "불완전",
    VERIFIED: "검증됨",
    UNKNOWN: "확인 불가"
  });

  const NARRATIVE_TEMPLATES = Object.freeze({
    ALLOCATION: Object.freeze({
      INTERPRETATION: "자산 배분 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "자산 배분에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    }),
    EXPOSURE: Object.freeze({
      INTERPRETATION: "실질 노출 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "실질 노출에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    }),
    PERFORMANCE: Object.freeze({
      INTERPRETATION: "성과 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "성과에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    }),
    RISK: Object.freeze({
      INTERPRETATION: "위험 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "위험에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    }),
    EXTERNAL_DATA: Object.freeze({
      INTERPRETATION: "외부 데이터 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "외부 데이터에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    }),
    DATA_QUALITY: Object.freeze({
      INTERPRETATION: "데이터 품질 상태는 연결된 검증 근거 범위에서 확인할 수 있습니다.",
      UNCERTAINTY: "데이터 품질에 대한 추가 판단은 연결된 근거만으로 확정하지 않습니다."
    })
  });

  const FIXED_HANDOFF_INSTRUCTIONS = Object.freeze([
    "payload의 facts와 evidence만 근거로 사용하고, 외부 정보나 개인 정보를 추정하지 마세요.",
    "각 항목은 section, kind, text, factIds, evidenceIds 다섯 필드만 포함하세요.",
    "factIds는 payload에 있는 사실 ID를 중복 없이 정렬해 사용하고, evidenceIds는 연결된 사실들의 evidenceIds 정확 합집합만 중복 없이 정렬해 사용하세요.",
    "CALCULATED_FACT는 사실 하나만 연결하고 responseContract.calculatedFactTemplates의 해당 항목을 필드와 문구까지 그대로 사용하세요.",
    "INTERPRETATION과 UNCERTAINTY는 responseContract.narrativeTemplates의 해당 section과 kind 문구를 글자 하나 바꾸지 말고 사용하세요.",
    "quality가 VERIFIED가 아닌 사실은 INTERPRETATION이나 CALCULATED_FACT로 표시하지 마세요.",
    "매수, 매도, 목표가격, 주문 수량 또는 자동 주문 지시는 작성하지 마세요.",
    "마크다운 없이 ASSETTRAIL_AI_REPORT_V1 JSON 객체만 반환하고 items는 최대 스물네 개로 제한하세요."
  ]);

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function validDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function round(value, digits = 8) {
    const factor = 10 ** digits;
    const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function normalizeLimit(value, fallback, hardMaximum) {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 1) return fallback;
    return Math.min(numeric, hardMaximum);
  }

  function worstQuality(...values) {
    return values
      .filter((value) => Object.hasOwn(QUALITY_RANK, value))
      .sort((left, right) => QUALITY_RANK[right] - QUALITY_RANK[left])[0] || "UNKNOWN";
  }

  function normalizedQuality(value) {
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
    return QUALITY.includes(normalized) ? normalized : "UNKNOWN";
  }

  function utf8Bytes(text) {
    const bytes = [];
    for (const character of String(text)) {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 0x7f) bytes.push(codePoint);
      else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >>> 12),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >>> 18),
          0x80 | ((codePoint >>> 12) & 0x3f),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return bytes;
  }

  function sha256(text) {
    const bytes = utf8Bytes(text);
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));

    for (let offset = 0; offset < bytes.length; offset += 64) {
      const words = new Array(64).fill(0);
      for (let index = 0; index < 16; index += 1) {
        const start = offset + index * 4;
        words[index] = (
          (bytes[start] << 24)
          | (bytes[start + 1] << 16)
          | (bytes[start + 2] << 8)
          | bytes[start + 3]
        ) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const left = words[index - 15];
        const right = words[index - 2];
        const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
        const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temporary1 = (h + sigma1 + choose + constants[index] + words[index]) >>> 0;
        const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temporary2 = (sigma0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temporary1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temporary1 + temporary2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
  }

  function canonicalStringify(value, stack = new Set()) {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot contain a non-finite number.");
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    if (typeof value !== "object" || value === undefined) throw new TypeError("Canonical JSON contains an unsupported value.");
    if (stack.has(value)) throw new TypeError("Canonical JSON cannot contain cycles.");
    stack.add(value);
    let result;
    if (Array.isArray(value)) {
      result = `[${value.map((item) => canonicalStringify(item, stack)).join(",")}]`;
    } else if (isPlainObject(value)) {
      const entries = Object.keys(value).sort(compareText).map((key) => (
        `${JSON.stringify(key)}:${canonicalStringify(value[key], stack)}`
      ));
      result = `{${entries.join(",")}}`;
    } else {
      throw new TypeError("Canonical JSON only supports plain objects.");
    }
    stack.delete(value);
    return result;
  }

  function digestObject(value) {
    return `sha256:${sha256(canonicalStringify(value))}`;
  }

  function safeByteLength(value) {
    try {
      return utf8Bytes(canonicalStringify(value)).length;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  function makeEvidenceId(rawId) {
    return `EV_${sha256(`assettrail-evidence-v1:${rawId}`).slice(0, 20).toUpperCase()}`;
  }

  function makeFactId(fact) {
    return `FACT_${sha256(canonicalStringify(fact)).slice(0, 20).toUpperCase()}`;
  }

  function addLimitation(limitations, code) {
    if (LIMITATION_CODES.includes(code)) limitations.add(code);
  }

  function hasSensitiveInputKey(input) {
    if (!input || typeof input !== "object") return false;
    const stack = [input];
    const seen = new Set();
    let visited = 0;
    const sensitive = /^(?:uid|userids?|email|accountnames?|accountnumbers?|assetids?|eventids?|rawevents?|journal|journaltext|retirementinputs?|absolutevalues?|amounts?|balances?|nav|marketvalues?|cashflows?|quantities|quantity|shares?|prices?|targetprices?|names?|symbols?|tickers?|memos?|notes?|freetext|urls?|html|markdown)$/i;
    while (stack.length && visited < 4096) {
      const value = stack.pop();
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      visited += 1;
      if (Array.isArray(value)) {
        value.slice(0, MAX_RAW_ITEMS).forEach((item) => stack.push(item));
        continue;
      }
      for (const [key, child] of Object.entries(value)) {
        const compactKey = key.replace(/[\s_-]/g, "");
        if (sensitive.test(compactKey)) return true;
        stack.push(child);
      }
    }
    return false;
  }

  function normalizeEvidence(input, asOfDate, limitations, maxEvidence) {
    const rows = Array.isArray(input) ? input : [];
    if (rows.length > MAX_RAW_ITEMS) addLimitation(limitations, "INPUT_LIMIT_REACHED");
    const rawToOpaque = new Map();
    const grouped = new Map();

    rows.slice(0, MAX_RAW_ITEMS).forEach((row) => {
      if (!isPlainObject(row) || !(typeof row.id === "string" || typeof row.id === "number")) {
        addLimitation(limitations, "INVALID_EVIDENCE");
        return;
      }
      const rawId = String(row.id).trim();
      if (!rawId || rawId.length > 256) {
        addLimitation(limitations, "INVALID_EVIDENCE");
        return;
      }
      const id = makeEvidenceId(rawId);
      rawToOpaque.set(rawId, id);
      let kind = typeof row.kind === "string" ? row.kind.trim().toUpperCase() : "";
      let status = normalizedQuality(row.status ?? row.quality);
      let date = row.asOfDate === undefined ? asOfDate : validDateKey(row.asOfDate);
      if (!EVIDENCE_KINDS.includes(kind)) {
        kind = "DATA_QUALITY";
        status = worstQuality(status, "UNKNOWN");
        addLimitation(limitations, "INVALID_EVIDENCE");
      }
      if (!asOfDate || !date || (asOfDate && date > asOfDate)) {
        status = worstQuality(status, "UNKNOWN");
        addLimitation(limitations, "INVALID_EVIDENCE");
      }
      if (asOfDate && date && date > asOfDate) date = null;
      const candidate = { id, kind, status, asOfDate: date };
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(candidate);
    });

    let evidence = [...grouped.values()].map((variants) => {
      const kinds = [...new Set(variants.map((item) => item.kind))];
      const dates = [...new Set(variants.map((item) => item.asOfDate))];
      if (kinds.length > 1 || dates.length > 1) addLimitation(limitations, "CONFLICTING_EVIDENCE");
      return {
        id: variants[0].id,
        kind: kinds.length === 1 ? kinds[0] : "DATA_QUALITY",
        status: worstQuality(...variants.map((item) => item.status), kinds.length > 1 || dates.length > 1 ? "UNKNOWN" : "VERIFIED"),
        asOfDate: dates.length === 1 ? dates[0] : null
      };
    }).sort((left, right) => compareText(left.id, right.id));

    if (evidence.length > maxEvidence) {
      evidence = evidence.slice(0, maxEvidence);
      addLimitation(limitations, "EVIDENCE_LIMIT_REACHED");
    }
    return { evidence, rawToOpaque };
  }

  function normalizeFact(row, forcedKind, evidenceById, rawToOpaque, limitations) {
    if (!isPlainObject(row)) {
      addLimitation(limitations, "UNSUPPORTED_FACT");
      return null;
    }
    const kind = forcedKind || (typeof row.kind === "string" ? row.kind.trim().toUpperCase() : "");
    const metric = typeof row.metric === "string" ? row.metric.trim().toUpperCase() : "";
    if (!FACT_KINDS.includes(kind) || !METRICS_BY_KIND[kind]?.has(metric)) {
      addLimitation(limitations, "UNSUPPORTED_FACT");
      return null;
    }
    let scope = typeof row.scope === "string" ? row.scope.trim().toUpperCase() : "TOTAL";
    if (!SCOPES.has(scope)) {
      scope = "UNKNOWN";
      addLimitation(limitations, "UNSUPPORTED_FACT");
    }

    const rawReferences = Array.isArray(row.evidenceIds) ? row.evidenceIds : [];
    const evidenceIds = [];
    rawReferences.forEach((rawReference) => {
      if (!(typeof rawReference === "string" || typeof rawReference === "number")) return;
      const opaque = rawToOpaque.get(String(rawReference).trim());
      if (opaque && evidenceById.has(opaque)) evidenceIds.push(opaque);
      else addLimitation(limitations, "UNKNOWN_EVIDENCE");
    });
    const uniqueEvidenceIds = [...new Set(evidenceIds)].sort(compareText);
    if (!uniqueEvidenceIds.length) {
      addLimitation(limitations, "UNKNOWN_EVIDENCE");
      return null;
    }
    if (uniqueEvidenceIds.length > MAX_EVIDENCE_PER_FACT) {
      uniqueEvidenceIds.length = MAX_EVIDENCE_PER_FACT;
      addLimitation(limitations, "EVIDENCE_REFERENCE_LIMIT_REACHED");
    }

    let quality = normalizedQuality(row.quality ?? row.status);
    quality = worstQuality(
      quality,
      ...uniqueEvidenceIds.map((id) => evidenceById.get(id).status)
    );
    const fact = { kind, metric, scope, quality, evidenceIds: uniqueEvidenceIds };

    if (kind === "STATUS") {
      const state = typeof row.state === "string" ? row.state.trim().toUpperCase() : "";
      if (!STATES.has(state)) {
        addLimitation(limitations, "UNSUPPORTED_FACT");
        return null;
      }
      fact.state = state;
      return fact;
    }

    let valuePct = null;
    if (kind === "WEIGHT") valuePct = finiteNumber(row.weightPct ?? row.valuePct);
    else if (kind === "RATIO") valuePct = finiteNumber(row.ratioPct ?? row.valuePct);
    else if (Object.hasOwn(row, "returnPct")) valuePct = finiteNumber(row.returnPct);
    else {
      const returnRate = finiteNumber(row.returnRate);
      valuePct = returnRate === null ? null : returnRate * 100;
    }

    const validRange = kind === "WEIGHT"
      ? valuePct !== null && valuePct >= 0 && valuePct <= 100
      : valuePct !== null && valuePct >= -100 && valuePct <= 100000;
    if (!validRange) {
      if (kind !== "RETURN") {
        addLimitation(limitations, "UNSUPPORTED_FACT");
        return null;
      }
      quality = "UNKNOWN";
      fact.quality = quality;
    }

    if (kind === "RETURN" && quality !== "VERIFIED") {
      addLimitation(limitations, "INCOMPLETE_PERFORMANCE");
      return fact;
    }
    if (valuePct === null) {
      addLimitation(limitations, "UNSUPPORTED_FACT");
      return null;
    }
    fact.valuePct = round(valuePct);
    return fact;
  }

  function normalizeFacts(input, evidence, rawToOpaque, limitations, maxFacts) {
    const sources = [
      { rows: input.facts, kind: "" },
      { rows: input.weights, kind: "WEIGHT" },
      { rows: input.returns, kind: "RETURN" },
      { rows: input.ratios, kind: "RATIO" },
      { rows: input.statuses, kind: "STATUS" }
    ];
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const normalized = [];
    sources.forEach(({ rows, kind }) => {
      if (rows !== undefined && !Array.isArray(rows)) {
        addLimitation(limitations, "UNSUPPORTED_FACT");
        return;
      }
      if (!Array.isArray(rows)) return;
      if (rows.length > MAX_RAW_ITEMS) addLimitation(limitations, "INPUT_LIMIT_REACHED");
      rows.slice(0, MAX_RAW_ITEMS).forEach((row) => {
        const fact = normalizeFact(row, kind, evidenceById, rawToOpaque, limitations);
        if (fact) normalized.push(fact);
      });
    });

    const byIdentity = new Map();
    normalized.forEach((fact) => {
      const identity = [fact.kind, fact.metric, fact.scope].join(":");
      if (!byIdentity.has(identity)) byIdentity.set(identity, []);
      byIdentity.get(identity).push(fact);
    });

    const merged = [];
    [...byIdentity.keys()].sort(compareText).forEach((identity) => {
      const variants = byIdentity.get(identity);
      const byValue = new Map();
      variants.forEach((fact) => {
        const key = canonicalStringify({
          kind: fact.kind,
          metric: fact.metric,
          scope: fact.scope,
          quality: fact.quality,
          ...(Object.hasOwn(fact, "valuePct") ? { valuePct: fact.valuePct } : {}),
          ...(Object.hasOwn(fact, "state") ? { state: fact.state } : {})
        });
        if (!byValue.has(key)) byValue.set(key, { ...fact, evidenceIds: [] });
        byValue.get(key).evidenceIds.push(...fact.evidenceIds);
      });
      if (byValue.size > 1) {
        addLimitation(limitations, "CONFLICTING_FACTS");
        return;
      }
      const fact = [...byValue.values()][0];
      const mergedEvidenceIds = [...new Set(fact.evidenceIds)].sort(compareText);
      if (mergedEvidenceIds.length > MAX_EVIDENCE_PER_FACT) {
        addLimitation(limitations, "EVIDENCE_REFERENCE_LIMIT_REACHED");
      }
      fact.evidenceIds = mergedEvidenceIds.slice(0, MAX_EVIDENCE_PER_FACT);
      merged.push(fact);
    });

    merged.sort((left, right) => compareText(canonicalStringify(left), canonicalStringify(right)));
    if (merged.length > maxFacts) {
      merged.length = maxFacts;
      addLimitation(limitations, "FACT_LIMIT_REACHED");
    }
    return merged.map((fact) => ({ factId: makeFactId(fact), ...fact }));
  }

  function buildEvidenceEnvelope(input, options = {}) {
    const limitations = new Set();
    const source = isPlainObject(input) ? input : {};
    if (!isPlainObject(input)) addLimitation(limitations, "INVALID_INPUT");
    const allowedTopLevel = new Set(["asOfDate", "evidence", "facts", "weights", "returns", "ratios", "statuses"]);
    if (Object.keys(source).some((key) => !allowedTopLevel.has(key))) {
      addLimitation(limitations, "EXCLUDED_UNSTRUCTURED_INPUT");
    }
    if (hasSensitiveInputKey(source)) addLimitation(limitations, "EXCLUDED_SENSITIVE_INPUT");

    const explicitDate = validDateKey(source.asOfDate);
    if (!explicitDate) addLimitation(limitations, "INVALID_AS_OF_DATE");
    const maxFacts = normalizeLimit(options.maxFacts, MAX_FACTS_DEFAULT, MAX_FACTS_HARD);
    const maxEvidence = normalizeLimit(options.maxEvidence, MAX_EVIDENCE_DEFAULT, MAX_EVIDENCE_HARD);
    const normalizedEvidence = normalizeEvidence(source.evidence, explicitDate, limitations, maxEvidence);
    const facts = normalizeFacts(
      source,
      normalizedEvidence.evidence,
      normalizedEvidence.rawToOpaque,
      limitations,
      maxFacts
    );
    const usedEvidenceIds = new Set(facts.flatMap((fact) => fact.evidenceIds));
    const evidence = normalizedEvidence.evidence.filter((item) => usedEvidenceIds.has(item.id));

    let qualityStatus = "VERIFIED";
    if (!facts.length) qualityStatus = "INCOMPLETE";
    else if (limitations.size || facts.some((fact) => fact.quality !== "VERIFIED") || evidence.some((item) => item.status !== "VERIFIED")) {
      qualityStatus = "LIMITED";
    }
    const envelopeWithoutDigest = {
      schemaVersion: EVIDENCE_SCHEMA,
      asOfDate: explicitDate,
      policy: POLICY,
      qualityStatus,
      limitations: [...limitations].sort(compareText),
      facts,
      evidence
    };
    return { ...envelopeWithoutDigest, digest: digestObject(envelopeWithoutDigest) };
  }

  function validationError(code, details = {}) {
    return { code, ...details };
  }

  function exactKeys(value, allowed) {
    return isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
  }

  function hasExactKeys(value, expected) {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value).sort(compareText);
    const expectedKeys = expected.slice().sort(compareText);
    return keys.length === expectedKeys.length
      && keys.every((key, index) => key === expectedKeys[index]);
  }

  function isSortedUniqueStrings(values) {
    return Array.isArray(values)
      && values.every((value) => typeof value === "string")
      && values.every((value, index) => index === 0 || compareText(values[index - 1], value) < 0);
  }

  function equalStringArrays(left, right) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }

  function validateEvidenceEnvelope(envelope) {
    const errors = [];
    if (!isPlainObject(envelope)) return { ok: false, errors: [validationError("INVALID_ENVELOPE")] };
    if (safeByteLength(envelope) > MAX_ENVELOPE_BYTES) errors.push(validationError("ENVELOPE_TOO_LARGE"));
    if (!exactKeys(envelope, [
      "schemaVersion", "asOfDate", "policy", "qualityStatus", "limitations", "facts", "evidence", "digest"
    ])) errors.push(validationError("UNEXPECTED_ENVELOPE_FIELD"));
    if (envelope.schemaVersion !== EVIDENCE_SCHEMA) errors.push(validationError("INVALID_SCHEMA_VERSION"));
    if (envelope.policy !== POLICY) errors.push(validationError("INVALID_POLICY"));
    if (envelope.asOfDate !== null && !validDateKey(envelope.asOfDate)) errors.push(validationError("INVALID_AS_OF_DATE"));
    if (!["VERIFIED", "LIMITED", "INCOMPLETE"].includes(envelope.qualityStatus)) {
      errors.push(validationError("INVALID_QUALITY_STATUS"));
    }
    if (!isSortedUniqueStrings(envelope.limitations) || envelope.limitations.some((code) => !LIMITATION_CODES.includes(code))) {
      errors.push(validationError("INVALID_LIMITATIONS"));
    }

    const evidence = Array.isArray(envelope.evidence) ? envelope.evidence : [];
    if (!Array.isArray(envelope.evidence) || evidence.length > MAX_EVIDENCE_HARD) {
      errors.push(validationError("INVALID_EVIDENCE_COLLECTION"));
    }
    const evidenceIds = new Set();
    const evidenceById = new Map();
    evidence.forEach((item, index) => {
      if (!exactKeys(item, ["id", "kind", "status", "asOfDate"])) {
        errors.push(validationError("INVALID_EVIDENCE_SHAPE", { evidenceIndex: index }));
        return;
      }
      if (typeof item.id !== "string" || !/^EV_[A-F0-9]{20}$/.test(item.id) || evidenceIds.has(item.id)) {
        errors.push(validationError("INVALID_EVIDENCE_ID", { evidenceIndex: index }));
      }
      evidenceIds.add(item.id);
      evidenceById.set(item.id, item);
      if (!EVIDENCE_KINDS.includes(item.kind)) errors.push(validationError("INVALID_EVIDENCE_KIND", { evidenceIndex: index }));
      if (!QUALITY.includes(item.status)) errors.push(validationError("INVALID_EVIDENCE_STATUS", { evidenceIndex: index }));
      if (item.asOfDate !== null && !validDateKey(item.asOfDate)) {
        errors.push(validationError("INVALID_EVIDENCE_DATE", { evidenceIndex: index }));
      }
      if (item.status === "VERIFIED" && !item.asOfDate) {
        errors.push(validationError("UNDATED_VERIFIED_EVIDENCE", { evidenceIndex: index }));
      }
      if (envelope.asOfDate && item.asOfDate && item.asOfDate > envelope.asOfDate) {
        errors.push(validationError("FUTURE_EVIDENCE_DATE", { evidenceIndex: index }));
      }
      if (index > 0 && compareText(evidence[index - 1]?.id, item.id) >= 0) {
        errors.push(validationError("NON_CANONICAL_EVIDENCE_ORDER", { evidenceIndex: index }));
      }
    });

    const facts = Array.isArray(envelope.facts) ? envelope.facts : [];
    if (!Array.isArray(envelope.facts) || facts.length > MAX_FACTS_HARD) errors.push(validationError("INVALID_FACT_COLLECTION"));
    const factIds = new Set();
    let priorCanonicalFact = "";
    facts.forEach((fact, index) => {
      const allowedKeys = ["factId", "kind", "metric", "scope", "quality", "evidenceIds", "valuePct", "state"];
      if (!exactKeys(fact, allowedKeys)) {
        errors.push(validationError("INVALID_FACT_SHAPE", { factIndex: index }));
        return;
      }
      const { factId, ...content } = fact;
      if (typeof factId !== "string" || !/^FACT_[A-F0-9]{20}$/.test(factId) || factIds.has(factId)) {
        errors.push(validationError("INVALID_FACT_ID", { factIndex: index }));
      } else if (makeFactId(content) !== factId) {
        errors.push(validationError("FACT_DIGEST_MISMATCH", { factIndex: index }));
      }
      factIds.add(factId);
      if (!FACT_KINDS.includes(fact.kind) || !METRICS_BY_KIND[fact.kind]?.has(fact.metric)) {
        errors.push(validationError("INVALID_FACT_METRIC", { factIndex: index }));
      }
      if (!SCOPES.has(fact.scope)) errors.push(validationError("INVALID_FACT_SCOPE", { factIndex: index }));
      if (!QUALITY.includes(fact.quality)) errors.push(validationError("INVALID_FACT_QUALITY", { factIndex: index }));
      if (!isSortedUniqueStrings(fact.evidenceIds) || !fact.evidenceIds.length || fact.evidenceIds.length > MAX_EVIDENCE_PER_FACT) {
        errors.push(validationError("INVALID_FACT_EVIDENCE", { factIndex: index }));
      } else if (fact.evidenceIds.some((id) => !evidenceIds.has(id))) {
        errors.push(validationError("UNKNOWN_EVIDENCE_ID", { factIndex: index }));
      }
      const safeFactEvidenceIds = Array.isArray(fact.evidenceIds) ? fact.evidenceIds : [];
      const referencedEvidenceQuality = worstQuality(
        ...safeFactEvidenceIds.map((id) => evidenceById.get(id)?.status).filter(Boolean),
        "VERIFIED"
      );
      if (QUALITY_RANK[fact.quality] < QUALITY_RANK[referencedEvidenceQuality]) {
        errors.push(validationError("FACT_QUALITY_EXCEEDS_EVIDENCE", { factIndex: index }));
      }
      if (!envelope.asOfDate && fact.quality === "VERIFIED") {
        errors.push(validationError("VERIFIED_FACT_WITHOUT_CUTOFF", { factIndex: index }));
      }
      if (fact.kind === "STATUS") {
        if (!STATES.has(fact.state) || Object.hasOwn(fact, "valuePct")) errors.push(validationError("INVALID_STATUS_FACT", { factIndex: index }));
      } else if (fact.kind === "RETURN" && fact.quality !== "VERIFIED") {
        if (Object.hasOwn(fact, "valuePct") || Object.hasOwn(fact, "state")) {
          errors.push(validationError("INCOMPLETE_RETURN_HAS_VALUE", { factIndex: index }));
        }
      } else if (finiteNumber(fact.valuePct) === null || Object.hasOwn(fact, "state")) {
        errors.push(validationError("INVALID_QUANTITATIVE_FACT", { factIndex: index }));
      } else if (fact.kind === "WEIGHT" && (fact.valuePct < 0 || fact.valuePct > 100)) {
        errors.push(validationError("INVALID_WEIGHT_RANGE", { factIndex: index }));
      } else if (fact.valuePct < -100 || fact.valuePct > 100000) {
        errors.push(validationError("INVALID_RELATIVE_VALUE_RANGE", { factIndex: index }));
      }
      const canonicalFact = canonicalStringify(content);
      if (index > 0 && compareText(priorCanonicalFact, canonicalFact) >= 0) {
        errors.push(validationError("NON_CANONICAL_FACT_ORDER", { factIndex: index }));
      }
      priorCanonicalFact = canonicalFact;
    });

    const referencedEvidenceIds = new Set(facts.flatMap((fact) => Array.isArray(fact.evidenceIds) ? fact.evidenceIds : []));
    if (evidence.some((item) => !referencedEvidenceIds.has(item.id))) {
      errors.push(validationError("UNUSED_EVIDENCE"));
    }
    const expectedQualityStatus = !facts.length
      ? "INCOMPLETE"
      : ((Array.isArray(envelope.limitations) && envelope.limitations.length)
        || facts.some((fact) => fact.quality !== "VERIFIED")
        || evidence.some((item) => item.status !== "VERIFIED")
          ? "LIMITED"
          : "VERIFIED");
    if (envelope.qualityStatus !== expectedQualityStatus) {
      errors.push(validationError("QUALITY_STATUS_MISMATCH"));
    }
    if (!envelope.asOfDate && !(Array.isArray(envelope.limitations) && envelope.limitations.includes("INVALID_AS_OF_DATE"))) {
      errors.push(validationError("MISSING_CUTOFF_LIMITATION"));
    }

    if (typeof envelope.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(envelope.digest)) {
      errors.push(validationError("INVALID_ENVELOPE_DIGEST"));
    } else {
      const { digest, ...unsigned } = envelope;
      try {
        if (digestObject(unsigned) !== digest) errors.push(validationError("ENVELOPE_DIGEST_MISMATCH"));
      } catch {
        errors.push(validationError("INVALID_CANONICAL_ENVELOPE"));
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function formatPercent(value) {
    return `${Number(value).toFixed(2)}%`;
  }

  function metricLabel(fact) {
    const scope = SCOPE_LABELS[fact.scope] || "";
    const metric = METRIC_LABELS[fact.metric] || "지표";
    if (scope && metric.startsWith(scope.trim())) return metric;
    return `${scope}${metric}`.trim();
  }

  function reportSection(fact) {
    if (fact.kind === "RETURN") return "PERFORMANCE";
    if (fact.kind === "RATIO") return "EXTERNAL_DATA";
    if (fact.kind === "STATUS") return "DATA_QUALITY";
    return /EXPOSURE|ETF_|OVERLAP|CONCENTRATION/.test(fact.metric) ? "EXPOSURE" : "ALLOCATION";
  }

  function deterministicItemForFact(fact) {
    const label = metricLabel(fact);
    const base = {
      section: reportSection(fact),
      kind: "CALCULATED_FACT",
      text: "",
      factIds: [fact.factId],
      evidenceIds: fact.evidenceIds.slice()
    };
    if (fact.kind === "STATUS") {
      if (fact.quality !== "VERIFIED") {
        return {
          ...base,
          kind: "UNCERTAINTY",
          text: `${label}은 근거 품질이 ${QUALITY_LABELS[fact.quality]} 상태여서 상태를 확정하지 않습니다.`
        };
      }
      return { ...base, text: `${label} 상태는 ${STATE_LABELS[fact.state]}입니다.` };
    }
    if (fact.quality !== "VERIFIED") {
      return {
        ...base,
        kind: "UNCERTAINTY",
        text: `${label}은 근거 품질이 ${QUALITY_LABELS[fact.quality]} 상태여서 수치를 확정하지 않습니다.`
      };
    }
    return {
      ...base,
      text: `${label}은 ${formatPercent(fact.valuePct)}입니다.`
    };
  }

  function narrativeTemplateList() {
    return REPORT_SECTIONS.flatMap((section) => REPORT_KINDS
      .filter((kind) => kind !== "CALCULATED_FACT")
      .map((kind) => ({ section, kind, text: NARRATIVE_TEMPLATES[section][kind] })));
  }

  function buildDeterministicReport(envelope) {
    const validation = validateEvidenceEnvelope(envelope);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const items = envelope.facts.slice(0, MAX_REPORT_ITEMS).map(deterministicItemForFact);
    return {
      schemaVersion: REPORT_SCHEMA,
      sourceEnvelopeDigest: envelope.digest,
      generatedBy: "DETERMINISTIC_RULES",
      items
    };
  }

  function buildChatGptHandoff(envelope) {
    const validation = validateEvidenceEnvelope(envelope);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const deterministicReport = buildDeterministicReport(envelope);
    return {
      schemaVersion: HANDOFF_SCHEMA,
      mode: "MANUAL_COPY_ONLY",
      apiKeyUsed: false,
      networkRequestPerformed: false,
      instructions: FIXED_HANDOFF_INSTRUCTIONS.slice(),
      payload: {
        schemaVersion: envelope.schemaVersion,
        asOfDate: envelope.asOfDate,
        qualityStatus: envelope.qualityStatus,
        limitations: envelope.limitations,
        facts: envelope.facts,
        evidence: envelope.evidence,
        digest: envelope.digest
      },
      responseContract: {
        schemaVersion: REPORT_SCHEMA,
        sourceEnvelopeDigest: envelope.digest,
        generatedBy: "CHATGPT_MANUAL",
        itemFields: ["section", "kind", "text", "factIds", "evidenceIds"],
        allowedSections: REPORT_SECTIONS.slice(),
        allowedKinds: REPORT_KINDS.slice(),
        factReferenceRule: "KNOWN_SORTED_UNIQUE_FACT_IDS_WITH_EXACT_EVIDENCE_UNION",
        calculatedFactTemplates: deterministicReport.items
          .filter((item) => item.kind === "CALCULATED_FACT"),
        narrativeTemplates: narrativeTemplateList(),
        maximumItems: MAX_REPORT_ITEMS
      }
    };
  }

  function containsForbiddenPresentation(text) {
    if (/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>`]/.test(text)) return true;
    if (/&(?:lt|gt|#0*60|#0*62);/i.test(text)) return true;
    if (/\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/|\b)/i.test(text)) return true;
    if (/\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]|(?:\*\*|__|~~)/.test(text)) return true;
    if (/(?:^|\s)[*_][^*_\r\n]+[*_](?:\s|[.!?]|$)/.test(text)) return true;
    if (/^\s*(?:#{1,6}|>|[-+*]\s|\d+[.)]\s)/.test(text)) return true;
    return false;
  }

  function containsTradeInstruction(text) {
    return /(?:매수|매도|매입|처분|사세요|파세요|사라|팔아라|추가\s*매수|목표\s*(?:가격|주가|가)|주문|수량|몇\s*주|\d+\s*주|비중\s*(?:확대|축소))|\b(?:buy|sell|target\s*price|quantity|shares?|order)\b/i.test(text);
  }

  function containsPromptInjection(text) {
    return /ignore\s+(?:all\s+)?previous|disregard\s+(?:all\s+)?prior|system\s+prompt|developer\s+(?:message|instruction)|jailbreak|prompt\s+injection|forget\s+(?:all\s+)?instructions|act\s+as\s+(?:the\s+)?system|이전\s*(?:지시|지침|명령).*(?:무시|잊)|시스템\s*프롬프트|개발자\s*(?:메시지|지시|지침)|지시를\s*무시|프롬프트\s*인젝션|탈옥/i.test(text);
  }

  function containsSensitiveOutput(text) {
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\bsk-[A-Za-z0-9_-]{8,}\b|\bapi[ _-]?key\b|\buid\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|\b010[- ]?\d{3,4}[- ]?\d{4}\b|\b\d{6}[- ]?[1-4]\d{6}\b|(?:계좌\s*(?:번호|명)|이메일\s*주소|주민\s*등록\s*번호|사용자\s*아이디)/i.test(text)) {
      return true;
    }
    const allowedTokens = new Set(["AI", "TWR", "XIRR", "KOSPI", "KRW", "USD", "ETF", "FCF", "ROE", "ROA", "EPS"]);
    return (text.match(/\b[A-Z]{2,5}\b/g) || []).some((token) => !allowedTokens.has(token));
  }

  function containsInterpretiveNumber(text) {
    const withoutControlledIndexName = text.replace(/S&P\s*500/gi, "");
    return /\d|%/.test(withoutControlledIndexName);
  }

  function linkedFactsForItem(item, factById) {
    if (!Array.isArray(item.factIds)) return [];
    return item.factIds.map((factId) => factById.get(factId)).filter(Boolean);
  }

  function parseReportInput(report) {
    if (typeof report !== "string") return report;
    if (utf8Bytes(report).length > MAX_REPORT_BYTES) return null;
    try {
      return JSON.parse(report);
    } catch {
      return null;
    }
  }

  function validateAiReport(reportInput, envelope) {
    const envelopeValidation = validateEvidenceEnvelope(envelope);
    if (!envelopeValidation.ok) return { ok: false, errors: [validationError("INVALID_SOURCE_ENVELOPE")] };
    const report = parseReportInput(reportInput);
    const errors = [];
    if (!isPlainObject(report)) return { ok: false, errors: [validationError("INVALID_REPORT")] };
    if (safeByteLength(report) > MAX_REPORT_BYTES) errors.push(validationError("REPORT_TOO_LARGE"));
    if (!exactKeys(report, ["schemaVersion", "sourceEnvelopeDigest", "generatedBy", "items"])) {
      errors.push(validationError("UNEXPECTED_REPORT_FIELD"));
    }
    if (report.schemaVersion !== REPORT_SCHEMA) errors.push(validationError("INVALID_REPORT_SCHEMA"));
    if (report.sourceEnvelopeDigest !== envelope.digest) errors.push(validationError("SOURCE_DIGEST_MISMATCH"));
    if (!["DETERMINISTIC_RULES", "CHATGPT_MANUAL"].includes(report.generatedBy)) {
      errors.push(validationError("INVALID_REPORT_GENERATOR"));
    }
    const items = Array.isArray(report.items) ? report.items : [];
    if (!Array.isArray(report.items) || items.length > MAX_REPORT_ITEMS) errors.push(validationError("INVALID_REPORT_ITEMS"));
    const knownEvidenceIds = new Set(envelope.evidence.map((item) => item.id));
    const factById = new Map(envelope.facts.map((fact) => [fact.factId, fact]));

    items.forEach((item, itemIndex) => {
      if (!hasExactKeys(item, ["section", "kind", "text", "factIds", "evidenceIds"])) {
        errors.push(validationError("INVALID_REPORT_ITEM_SHAPE", { itemIndex }));
        return;
      }
      if (!REPORT_SECTIONS.includes(item.section)) errors.push(validationError("INVALID_REPORT_SECTION", { itemIndex }));
      if (!REPORT_KINDS.includes(item.kind)) errors.push(validationError("INVALID_REPORT_KIND", { itemIndex }));
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text || text !== item.text || text.length > MAX_SENTENCE_LENGTH || /[.!?]\s+\S/.test(text)) {
        errors.push(validationError("INVALID_REPORT_SENTENCE", { itemIndex }));
      }
      if (containsForbiddenPresentation(text)) errors.push(validationError("FORBIDDEN_PRESENTATION", { itemIndex }));
      if (containsTradeInstruction(text)) errors.push(validationError("TRADE_INSTRUCTION_BLOCKED", { itemIndex }));
      if (containsPromptInjection(text)) errors.push(validationError("PROMPT_INJECTION_BLOCKED", { itemIndex }));
      if (containsSensitiveOutput(text)) errors.push(validationError("SENSITIVE_OUTPUT_BLOCKED", { itemIndex }));
      const validFactIds = isSortedUniqueStrings(item.factIds)
        && item.factIds.length > 0
        && item.factIds.length <= MAX_FACTS_HARD;
      if (!validFactIds) {
        errors.push(validationError("INVALID_REPORT_FACTS", { itemIndex }));
      } else if (item.factIds.some((id) => !factById.has(id))) {
        errors.push(validationError("UNKNOWN_REPORT_FACT", { itemIndex }));
      }
      const validReportEvidenceIds = isSortedUniqueStrings(item.evidenceIds)
        && item.evidenceIds.length > 0
        && item.evidenceIds.length <= MAX_EVIDENCE_HARD;
      if (!validReportEvidenceIds) {
        errors.push(validationError("INVALID_REPORT_EVIDENCE", { itemIndex }));
      } else if (item.evidenceIds.some((id) => !knownEvidenceIds.has(id))) {
        errors.push(validationError("UNKNOWN_REPORT_EVIDENCE", { itemIndex }));
      }

      const linkedFacts = linkedFactsForItem(item, factById);
      if (!linkedFacts.length) errors.push(validationError("UNSUPPORTED_REPORT_CLAIM", { itemIndex }));
      if (validFactIds && linkedFacts.length === item.factIds.length) {
        const expectedEvidenceIds = [...new Set(linkedFacts.flatMap((fact) => fact.evidenceIds))].sort(compareText);
        if (!validReportEvidenceIds || !equalStringArrays(expectedEvidenceIds, item.evidenceIds)) {
          errors.push(validationError("REPORT_EVIDENCE_MISMATCH", { itemIndex }));
        }
        if (linkedFacts.some((fact) => reportSection(fact) !== item.section)) {
          errors.push(validationError("REPORT_SECTION_MISMATCH", { itemIndex }));
        }
      }
      if (report.generatedBy === "CHATGPT_MANUAL"
        && linkedFacts.some((fact) => fact.quality !== "VERIFIED")
        && item.kind !== "UNCERTAINTY") {
        errors.push(validationError("UNVERIFIED_FACT_INTERPRETATION", { itemIndex }));
      }
      if (report.generatedBy === "CHATGPT_MANUAL" && item.kind === "CALCULATED_FACT") {
        if (linkedFacts.length !== 1 || item.factIds.length !== 1) {
          errors.push(validationError("CALCULATED_FACT_REQUIRES_SINGLE_FACT", { itemIndex }));
        } else {
          const expectedItem = deterministicItemForFact(linkedFacts[0]);
          if (expectedItem.kind !== "CALCULATED_FACT"
            || expectedItem.section !== item.section
            || expectedItem.kind !== item.kind
            || expectedItem.text !== item.text
            || !equalStringArrays(expectedItem.factIds, item.factIds)
            || !equalStringArrays(expectedItem.evidenceIds, item.evidenceIds)) {
            errors.push(validationError("CALCULATED_FACT_TEMPLATE_MISMATCH", { itemIndex }));
          }
        }
      } else if (report.generatedBy === "CHATGPT_MANUAL"
        && ["INTERPRETATION", "UNCERTAINTY"].includes(item.kind)) {
        const expectedText = NARRATIVE_TEMPLATES[item.section]?.[item.kind];
        if (!expectedText || item.text !== expectedText) {
          errors.push(validationError("NARRATIVE_TEMPLATE_MISMATCH", { itemIndex }));
        }
      }
      const linkedReturns = linkedFacts.filter((fact) => fact.kind === "RETURN");
      const linkedPerformanceStatus = linkedFacts.some((fact) => (
        fact.kind === "STATUS" && fact.metric === "PERFORMANCE_DATA"
      ));
      if (item.section === "PERFORMANCE" && !linkedReturns.length) {
        errors.push(validationError("PERFORMANCE_EVIDENCE_REQUIRED", { itemIndex }));
      }
      const performanceWords = /수익률|성과|변동성|낙폭|\b(?:twr|xirr|return|performance|volatility|drawdown|benchmark)\b/i.test(text);
      if (performanceWords && !linkedReturns.length && !linkedPerformanceStatus) {
        errors.push(validationError("PERFORMANCE_EVIDENCE_REQUIRED", { itemIndex }));
      }
      const incompleteReturns = linkedReturns.filter((fact) => fact.quality !== "VERIFIED" || !Object.hasOwn(fact, "valuePct"));
      if (incompleteReturns.length && (item.kind !== "UNCERTAINTY" || containsInterpretiveNumber(text))) {
        errors.push(validationError("INCOMPLETE_PERFORMANCE_INTERPRETATION", { itemIndex }));
      }

      const percentageTokens = text.match(/[-+]?\d+(?:\.\d+)?%/g) || [];
      const linkedValues = linkedFacts
        .filter((fact) => Object.hasOwn(fact, "valuePct"))
        .map((fact) => round(fact.valuePct, 2));
      if (item.kind === "CALCULATED_FACT") {
        percentageTokens.forEach((token) => {
          if (!linkedValues.includes(round(Number(token.slice(0, -1)), 2))) {
            errors.push(validationError("UNSUPPORTED_CALCULATED_VALUE", { itemIndex }));
          }
        });
        if (linkedFacts.some((fact) => Object.hasOwn(fact, "valuePct")) && !percentageTokens.length) {
          errors.push(validationError("MISSING_CALCULATED_VALUE", { itemIndex }));
        }
      } else if (containsInterpretiveNumber(text)) {
        errors.push(validationError("INTERPRETATION_CONTAINS_CALCULATION", { itemIndex }));
      }
    });
    if (report.generatedBy === "DETERMINISTIC_RULES") {
      const expected = buildDeterministicReport(envelope);
      try {
        if (expected.schemaVersion !== REPORT_SCHEMA || canonicalStringify(expected) !== canonicalStringify(report)) {
          errors.push(validationError("DETERMINISTIC_REPORT_MISMATCH"));
        }
      } catch {
        errors.push(validationError("DETERMINISTIC_REPORT_MISMATCH"));
      }
    }
    return { ok: errors.length === 0, errors };
  }

  return Object.freeze({
    buildEvidenceEnvelope,
    validateEvidenceEnvelope,
    buildDeterministicReport,
    buildChatGptHandoff,
    validateAiReport
  });
});
