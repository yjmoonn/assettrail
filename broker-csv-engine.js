(function attachAssetTrailBrokerCsvEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailBrokerCsvEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBrokerCsvEngine() {
  "use strict";

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_DATA_ROWS = 50_000;
  const MAX_COLUMNS = 128;
  const MAX_TEXT_LENGTH = 10_000;
  const SOURCE_ID_MAX_LENGTH = 240;
  const MARKET_TYPES = new Set(["KRX", "US"]);
  const AMOUNT_TYPES = new Set(["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX"]);
  const BUY_SELL_TYPES = new Set(["BUY", "SELL"]);
  const UTF8_ENCODER = new TextEncoder();
  const SHA256_CONSTANTS = Object.freeze([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  const ISSUE_MESSAGES = Object.freeze({
    FILE_TOO_LARGE: "CSV 파일이 허용 크기를 초과했습니다.",
    DECODE_FAILED: "CSV 문자 인코딩을 확인할 수 없습니다.",
    CSV_EMPTY: "CSV 파일에 헤더와 데이터가 없습니다.",
    CSV_UNCLOSED_QUOTE: "CSV 따옴표가 닫히지 않았습니다.",
    CSV_INVALID_QUOTE: "CSV 따옴표 형식이 올바르지 않습니다.",
    TOO_MANY_ROWS: "CSV 거래 행이 허용 개수를 초과했습니다.",
    TOO_MANY_COLUMNS: "CSV 열 개수가 허용 개수를 초과했습니다.",
    COLUMN_COUNT_MISMATCH: "행의 열 개수가 헤더와 일치하지 않습니다.",
    EMPTY_HEADER: "비어 있는 CSV 헤더가 있습니다.",
    DUPLICATE_HEADER: "중복된 CSV 헤더가 있습니다.",
    INVALID_ADAPTER: "CSV 어댑터 계약이 올바르지 않습니다.",
    DUPLICATE_ADAPTER: "같은 ID의 CSV 어댑터가 이미 등록되어 있습니다.",
    UNSUPPORTED_FORMAT: "지원하는 CSV 형식을 자동으로 찾지 못했습니다.",
    AMBIGUOUS_FORMAT: "여러 CSV 형식이 같은 신뢰도로 감지되어 자동 선택하지 않았습니다.",
    MISSING_REQUIRED_HEADER: "표준 CSV 필수 헤더가 없습니다.",
    INVALID_VERSION: "지원하지 않는 표준 CSV 버전입니다.",
    MISSING_FIELD: "필수 값이 비어 있습니다.",
    TEXT_TOO_LONG: "텍스트 값이 허용 길이를 초과했습니다.",
    INVALID_DATE: "날짜가 올바르지 않습니다.",
    SETTLEMENT_BEFORE_TRADE: "결제일은 거래일보다 빠를 수 없습니다.",
    INVALID_TYPE: "지원하지 않는 거래 유형입니다.",
    INVALID_NUMBER: "숫자 형식이 올바르지 않습니다.",
    NUMBER_MUST_BE_POSITIVE: "금액이나 수량은 0보다 커야 합니다.",
    NUMBER_MUST_BE_NON_NEGATIVE: "비용이나 세금은 0 이상이어야 합니다.",
    INVALID_MARKET: "시장 구분은 KRX 또는 US여야 합니다.",
    INVALID_TICKER: "종목코드 형식이 올바르지 않습니다.",
    INVALID_CURRENCY: "통화는 ISO 영문 3자리여야 합니다.",
    MISSING_FX_RATE: "외화 거래에는 거래 당시 환율이 필요합니다.",
    INVALID_KRW_RATE: "KRW 환율은 1이어야 합니다.",
    CURRENCY_MARKET_MISMATCH: "시장과 거래통화가 일치하지 않습니다.",
    UNEXPECTED_FIELD: "이 거래 유형에서 사용하지 않는 값이 입력되었습니다.",
    BEFORE_BASELINE: "원장 기준일 이전 거래라 이번 증분 가져오기에서 제외했습니다.",
    ASSET_NOT_FOUND: "거래와 연결할 기존 시장 자산을 찾지 못했습니다.",
    AMBIGUOUS_ASSET_MAPPING: "거래와 연결할 시장 자산이 여러 개라 명시적인 연결이 필요합니다.",
    INVALID_ASSET_MAPPING: "선택한 시장 자산이 거래 종목과 일치하지 않습니다.",
    CASH_NOT_FOUND: "거래와 연결할 기존 CASH 자산을 찾지 못했습니다.",
    AMBIGUOUS_CASH_MAPPING: "거래와 연결할 CASH 자산이 여러 개라 명시적인 연결이 필요합니다.",
    INVALID_CASH_MAPPING: "선택한 자산이 이 거래에 사용할 수 있는 CASH가 아닙니다.",
    DUPLICATE_EXACT: "이미 가져온 동일 거래라 건너뜁니다.",
    SOURCE_CHANGED: "같은 원본 거래 ID의 경제적 내용이 달라 자동 반영하지 않았습니다."
  });

  class BrokerCsvError extends Error {
    constructor(code, details = {}) {
      super(ISSUE_MESSAGES[code] || "CSV 가져오기를 처리하지 못했습니다.");
      this.name = "BrokerCsvError";
      this.code = code;
      this.rowNumber = safeRowNumber(details.rowNumber);
      this.field = safeField(details.field);
    }
  }

  function safeRowNumber(value) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
  }

  function safeField(value) {
    const field = String(value || "").trim().toLowerCase();
    return /^[a-z0-9_.-]{1,64}$/.test(field) ? field : "";
  }

  function issue(code, details = {}) {
    const severity = ["error", "warning", "info"].includes(details.severity)
      ? details.severity
      : "error";
    return Object.freeze({
      code: ISSUE_MESSAGES[code] ? code : "INVALID_ADAPTER",
      severity,
      rowNumber: safeRowNumber(details.rowNumber),
      field: safeField(details.field),
      message: ISSUE_MESSAGES[code] || ISSUE_MESSAGES.INVALID_ADAPTER
    });
  }

  function fail(code, details = {}) {
    throw new BrokerCsvError(code, details);
  }

  function normalizedText(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  function normalizedHeader(value) {
    return normalizedText(value).toLowerCase();
  }

  function normalizedAccount(value) {
    return normalizedText(value).replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
  }

  function normalizeTicker(market, value) {
    const ticker = normalizedText(value).toUpperCase();
    if (market === "KRX" && /^\d+$/.test(ticker)) return ticker.padStart(6, "0");
    return ticker;
  }

  function validDateKey(value) {
    const raw = normalizedText(value);
    let key = raw;
    if (/^\d{8}$/.test(raw)) key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    else if (/^\d{4}[./]\d{1,2}[./]\d{1,2}$/.test(raw)) {
      const [year, month, day] = raw.split(/[./]/);
      key = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function byteLengthOf(text) {
    return UTF8_ENCODER.encode(String(text || "")).byteLength;
  }

  function asUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new TypeError("CSV bytes must be an ArrayBuffer or Uint8Array.");
  }

  function decodeCsv(input, options = {}) {
    const bytes = asUint8Array(input);
    const maxBytes = Number.isSafeInteger(options.maxBytes) ? options.maxBytes : MAX_FILE_BYTES;
    if (bytes.byteLength > maxBytes) fail("FILE_TOO_LARGE");
    try {
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(3)), encoding: "utf-8" };
      }
      if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return { text: new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2)), encoding: "utf-16le" };
      }
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return { text: new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2)), encoding: "utf-16be" };
      }
      try {
        return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
      } catch (_utf8Error) {
        return { text: new TextDecoder("euc-kr", { fatal: true }).decode(bytes), encoding: "euc-kr" };
      }
    } catch (_decodeError) {
      fail("DECODE_FAILED");
    }
  }

  function firstRecordDelimiterCounts(text) {
    const counts = new Map([[",", 0], ["\t", 0], [";", 0]]);
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') index += 1;
        else quoted = !quoted;
        continue;
      }
      if (!quoted && (char === "\n" || char === "\r")) break;
      if (!quoted && counts.has(char)) counts.set(char, counts.get(char) + 1);
    }
    return counts;
  }

  function detectDelimiter(text) {
    const counts = firstRecordDelimiterCounts(text);
    const order = [",", "\t", ";"];
    const priority = new Map(order.map((delimiter, index) => [delimiter, index]));
    return [...order].sort((left, right) => (
      counts.get(right) - counts.get(left) || priority.get(left) - priority.get(right)
    ))[0];
  }

  function parseRecords(text, delimiter) {
    const records = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    let logicalRow = 1;

    function pushRecord() {
      row.push(field);
      const empty = row.every((cell) => cell === "");
      if (!empty) records.push({ rowNumber: logicalRow, cells: row });
      row = [];
      field = "";
      closedQuote = false;
      logicalRow += 1;
    }

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = false;
            closedQuote = true;
          }
        } else if (char === "\r" && text[index + 1] === "\n") {
          field += "\n";
          index += 1;
        } else {
          field += char;
        }
        continue;
      }

      if (closedQuote) {
        if (char === delimiter) {
          row.push(field);
          field = "";
          closedQuote = false;
          continue;
        }
        if (char === "\n" || char === "\r") {
          if (char === "\r" && text[index + 1] === "\n") index += 1;
          pushRecord();
          continue;
        }
        fail("CSV_INVALID_QUOTE", { rowNumber: logicalRow });
      }

      if (char === '"') {
        if (field) fail("CSV_INVALID_QUOTE", { rowNumber: logicalRow });
        quoted = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        pushRecord();
      } else {
        field += char;
      }
    }
    if (quoted) fail("CSV_UNCLOSED_QUOTE", { rowNumber: logicalRow });
    if (field || row.length || closedQuote) pushRecord();
    return records;
  }

  function parseCsv(input, options = {}) {
    const text = String(input ?? "").replace(/^\uFEFF/, "");
    const byteLength = Number.isSafeInteger(options.byteLength) ? options.byteLength : byteLengthOf(text);
    const maxBytes = Number.isSafeInteger(options.maxBytes) ? options.maxBytes : MAX_FILE_BYTES;
    const maxRows = Number.isSafeInteger(options.maxRows) ? options.maxRows : MAX_DATA_ROWS;
    if (byteLength > maxBytes) fail("FILE_TOO_LARGE");
    if (!text.trim()) fail("CSV_EMPTY");
    const delimiter = options.delimiter || detectDelimiter(text);
    const records = parseRecords(text, delimiter);
    if (records.length < 2) fail("CSV_EMPTY");
    const headerCells = records[0].cells;
    if (headerCells.length > MAX_COLUMNS) fail("TOO_MANY_COLUMNS");
    const headers = headerCells.map(normalizedHeader);
    if (headers.some((header) => !header)) fail("EMPTY_HEADER");
    if (new Set(headers).size !== headers.length) fail("DUPLICATE_HEADER");

    const rows = [];
    const issues = [];
    let dataRowCount = 0;
    records.slice(1).forEach((record) => {
      dataRowCount += 1;
      if (dataRowCount > maxRows) fail("TOO_MANY_ROWS");
      if (record.cells.length !== headers.length) {
        issues.push(issue("COLUMN_COUNT_MISMATCH", { rowNumber: record.rowNumber }));
        return;
      }
      const values = {};
      headers.forEach((header, index) => { values[header] = record.cells[index]; });
      rows.push(Object.freeze({ rowNumber: record.rowNumber, values: Object.freeze(values) }));
    });
    return Object.freeze({
      delimiter,
      headers: Object.freeze(headers),
      rows: Object.freeze(rows),
      issues: Object.freeze(issues),
      dataRowCount
    });
  }

  function validateAdapter(adapter) {
    if (!adapter || typeof adapter !== "object"
      || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(String(adapter.id || ""))
      || !/^[A-Z0-9][A-Z0-9:_-]{0,119}$/.test(String(adapter.brokerCode || ""))
      || typeof adapter.detect !== "function"
      || typeof adapter.parse !== "function") {
      fail("INVALID_ADAPTER");
    }
  }

  function createRegistry() {
    const adapters = new Map();
    return Object.freeze({
      register(adapter) {
        validateAdapter(adapter);
        if (adapters.has(adapter.id)) fail("DUPLICATE_ADAPTER");
        adapters.set(adapter.id, adapter);
        return adapter;
      },
      list() {
        return [...adapters.values()].map((adapter) => Object.freeze({
          id: adapter.id,
          brokerCode: adapter.brokerCode,
          displayName: String(adapter.displayName || adapter.id),
          version: Number(adapter.version || 1)
        }));
      },
      detect(table) {
        const candidates = [...adapters.values()].map((adapter) => {
          let result = { confidence: 0 };
          try {
            result = adapter.detect({ headers: table.headers, delimiter: table.delimiter }) || result;
          } catch (_error) {
            result = { confidence: 0 };
          }
          const confidence = Number(result.confidence);
          return {
            adapter,
            confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
            priority: Number.isFinite(Number(adapter.priority)) ? Number(adapter.priority) : 0
          };
        }).filter((candidate) => candidate.confidence > 0)
          .sort((left, right) => right.confidence - left.confidence || right.priority - left.priority);
        if (!candidates.length) fail("UNSUPPORTED_FORMAT");
        const winner = candidates[0];
        const tied = candidates.filter((candidate) => (
          candidate.confidence === winner.confidence && candidate.priority === winner.priority
        ));
        if (tied.length > 1) fail("AMBIGUOUS_FORMAT");
        return winner.adapter;
      }
    });
  }

  const defaultRegistry = createRegistry();

  function rotr(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  function sha256Hex(value) {
    const bytes = UTF8_ENCODER.encode(String(value));
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const view = new DataView(data.buffer);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    view.setUint32(paddedLength - 8, high);
    view.setUint32(paddedLength - 4, low);
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
      for (let index = 16; index < 64; index += 1) {
        const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
        const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
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
    return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
  }

  function canonicalNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(Object.is(numeric, -0) ? 0 : numeric) : "";
  }

  function economicFingerprint(event) {
    const textFields = [
      "sourceSystem", "type", "accountId", "assetId", "instrumentKey", "cashAssetId", "cashAccountId",
      "counterCashAssetId", "counterCashAccountId", "tradeDate", "settlementDate", "currency", "counterCurrency"
    ];
    const numberFields = [
      "quantity", "price", "fxRate", "feeKRW", "taxKRW", "amount", "amountKRW", "counterAmount",
      "counterFxRate", "numerator", "denominator"
    ];
    const parts = ["assettrail-economic-event-v1"];
    textFields.forEach((field) => parts.push(`${field}=${normalizedText(event?.[field])}`));
    numberFields.forEach((field) => parts.push(`${field}=${canonicalNumber(event?.[field])}`));
    return `sha256-v1:${sha256Hex(parts.join("\u0000"))}`;
  }

  function accountIdForAsset(asset) {
    return `ACCOUNT:${String(asset?.id || "UNKNOWN")}`;
  }

  function assetType(asset) {
    return normalizedText(asset?.type).toUpperCase();
  }

  function mappingKey(kind, brokerCode, accountRef, market = "", ticker = "") {
    const digest = sha256Hex([
      "assettrail-csv-mapping-v1", kind, brokerCode, normalizedAccount(accountRef), market, ticker
    ].join("\u0000"));
    return `${kind}:${digest.slice(0, 32)}`;
  }

  function maskedAccountHint(accountRef, key) {
    const digits = normalizedText(accountRef).replace(/\D/g, "");
    if (digits.length >= 4) return `계좌 ••••${digits.slice(-4)}`;
    return `계좌 참조 ${String(key).slice(-4).toUpperCase()}`;
  }

  function resolveMarketAsset(transaction, assets, mappings, requests) {
    if (!transaction.market || !transaction.ticker) return { asset: null, issue: null };
    const candidates = assets.filter((asset) => (
      assetType(asset) === transaction.market
      && normalizeTicker(transaction.market, asset.ticker) === transaction.ticker
    ));
    const key = mappingKey("asset", transaction.sourceSystem, transaction.accountRef, transaction.market, transaction.ticker);
    const explicitId = mappings?.assets?.[key];
    if (explicitId) {
      const selected = candidates.find((asset) => String(asset.id) === String(explicitId));
      if (!selected) return { asset: null, issue: issue("INVALID_ASSET_MAPPING", { rowNumber: transaction.rowNumber, field: "account" }) };
      return { asset: selected, issue: null };
    }
    const account = normalizedAccount(transaction.accountRef);
    const exact = candidates.filter((asset) => normalizedAccount(asset.account) === account);
    if (exact.length === 1) return { asset: exact[0], issue: null };
    if (exact.length > 1 || candidates.length > 1) {
      requests.set(key, Object.freeze({
        kind: "asset",
        key,
        hint: maskedAccountHint(transaction.accountRef, key),
        market: transaction.market,
        ticker: transaction.ticker,
        candidateAssetIds: Object.freeze(candidates.map((asset) => String(asset.id)))
      }));
      return { asset: null, issue: issue("AMBIGUOUS_ASSET_MAPPING", { rowNumber: transaction.rowNumber, field: "account" }) };
    }
    if (candidates.length === 1) return { asset: candidates[0], issue: null };
    return { asset: null, issue: issue("ASSET_NOT_FOUND", { rowNumber: transaction.rowNumber, field: "ticker" }) };
  }

  function resolveCashAsset(transaction, assets, mappings, requests) {
    const candidates = assets.filter((asset) => assetType(asset) === "CASH");
    const key = mappingKey("cash", transaction.sourceSystem, transaction.cashAccountRef);
    const explicitId = mappings?.cash?.[key];
    if (explicitId) {
      const selected = candidates.find((asset) => String(asset.id) === String(explicitId));
      if (!selected) return { asset: null, issue: issue("INVALID_CASH_MAPPING", { rowNumber: transaction.rowNumber, field: "cash_account" }) };
      return { asset: selected, issue: null };
    }
    const account = normalizedAccount(transaction.cashAccountRef);
    const exact = candidates.filter((asset) => normalizedAccount(asset.account) === account);
    if (exact.length === 1) return { asset: exact[0], issue: null };
    if (exact.length > 1 || candidates.length > 1) {
      requests.set(key, Object.freeze({
        kind: "cash",
        key,
        hint: maskedAccountHint(transaction.cashAccountRef, key),
        market: "",
        ticker: "",
        candidateAssetIds: Object.freeze(candidates.map((asset) => String(asset.id)))
      }));
      return { asset: null, issue: issue("AMBIGUOUS_CASH_MAPPING", { rowNumber: transaction.rowNumber, field: "cash_account" }) };
    }
    if (candidates.length === 1) return { asset: candidates[0], issue: null };
    return { asset: null, issue: issue("CASH_NOT_FOUND", { rowNumber: transaction.rowNumber, field: "cash_account" }) };
  }

  function eventFromTransaction(transaction, marketAsset, cashAsset) {
    const usesMarketAsset = BUY_SELL_TYPES.has(transaction.type) || transaction.type === "DIVIDEND";
    const accountAsset = usesMarketAsset ? marketAsset : cashAsset;
    const event = {
      type: transaction.type,
      accountId: accountIdForAsset(accountAsset),
      tradeDate: transaction.tradeDate,
      settlementDate: transaction.settlementDate,
      sequence: transaction.rowNumber,
      sourceSystem: transaction.sourceSystem
    };
    if (usesMarketAsset) {
      event.assetId = String(marketAsset.id);
      event.instrumentKey = `INSTRUMENT:${transaction.market}:${transaction.ticker}`;
    }
    event.cashAssetId = String(cashAsset.id);
    event.cashAccountId = accountIdForAsset(cashAsset);
    if (BUY_SELL_TYPES.has(transaction.type)) {
      event.quantity = transaction.quantity;
      event.price = transaction.price;
      event.currency = transaction.currency;
      event.fxRate = transaction.fxRate;
      event.feeKRW = transaction.feeKRW;
      event.taxKRW = transaction.taxKRW;
      event.grossAmount = round(transaction.quantity * transaction.price, 8);
      event.grossAmountKRW = round(event.grossAmount * transaction.fxRate, 4);
    } else if (AMOUNT_TYPES.has(transaction.type)) {
      event.amount = transaction.amount;
      event.currency = transaction.currency;
      event.fxRate = transaction.fxRate;
      event.amountKRW = round(transaction.amount * transaction.fxRate, 4);
    }
    return event;
  }

  function sourceIdentity(event) {
    if (!event?.sourceSystem || !event?.sourceId) return "";
    return `${event.sourceSystem}\u0000${event.accountId}\u0000${event.sourceId}`;
  }

  function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function summarizeReadyEvents(events) {
    const typeCounts = {};
    const positionMap = new Map();
    let cashDeltaKRW = 0;
    let feesKRW = 0;
    let taxesKRW = 0;
    events.forEach((event) => {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
      if (event.type === "BUY" || event.type === "SELL") {
        const direction = event.type === "BUY" ? 1 : -1;
        const current = positionMap.get(event.assetId) || {
          assetId: event.assetId,
          instrumentKey: event.instrumentKey,
          quantityDelta: 0
        };
        current.quantityDelta = round(current.quantityDelta + direction * event.quantity, 12);
        positionMap.set(event.assetId, current);
        const gross = event.grossAmountKRW;
        cashDeltaKRW += event.type === "BUY"
          ? -(gross + event.feeKRW + event.taxKRW)
          : gross - event.feeKRW - event.taxKRW;
        feesKRW += event.feeKRW;
        taxesKRW += event.taxKRW;
      } else if (["DEPOSIT", "DIVIDEND", "INTEREST"].includes(event.type)) {
        cashDeltaKRW += event.amountKRW;
      } else if (["WITHDRAWAL", "FEE", "TAX"].includes(event.type)) {
        cashDeltaKRW -= event.amountKRW;
      }
    });
    return Object.freeze({
      typeCounts: Object.freeze({ ...typeCounts }),
      cashDeltaKRW: round(cashDeltaKRW),
      feesKRW: round(feesKRW),
      taxesKRW: round(taxesKRW),
      positionChanges: Object.freeze([...positionMap.values()].map((item) => Object.freeze(item)))
    });
  }

  function preparePreview(options = {}) {
    const table = parseCsv(options.text, {
      byteLength: options.byteLength,
      maxBytes: options.maxBytes,
      maxRows: options.maxRows
    });
    const registry = options.registry || defaultRegistry;
    if (!registry || typeof registry.detect !== "function") fail("INVALID_ADAPTER");
    const adapter = registry.detect(table);
    let parsed;
    try {
      parsed = adapter.parse(table, Object.freeze({ issue, fail, validDateKey, normalizedText, normalizeTicker })) || {};
    } catch (error) {
      if (error instanceof BrokerCsvError) throw error;
      fail("INVALID_ADAPTER");
    }
    if (!Array.isArray(parsed.rows)) fail("INVALID_ADAPTER");

    const assets = Array.isArray(options.assets) ? options.assets : [];
    const existingEvents = Array.isArray(options.events) ? options.events : [];
    const baselineDate = options.baselineDate ? validDateKey(options.baselineDate) : "";
    if (options.baselineDate && !baselineDate) fail("INVALID_DATE", { field: "baseline_date" });
    const mappingRequests = new Map();
    const outputIssues = [...table.issues, ...(Array.isArray(parsed.issues) ? parsed.issues : [])];
    const rows = table.issues.map((item) => ({
      rowNumber: item.rowNumber,
      status: "invalid",
      eventType: "",
      tradeDate: "",
      eventId: "",
      issueCodes: [item.code]
    }));
    const provisional = [];
    const periodDates = [];
    const sourceAccounts = new Set();

    parsed.rows.forEach((parsedRow) => {
      const rowNumber = safeRowNumber(parsedRow.rowNumber);
      const rowIssues = Array.isArray(parsedRow.issues) ? parsedRow.issues : [];
      outputIssues.push(...rowIssues);
      if (!parsedRow.transaction || rowIssues.some((item) => item.severity === "error")) {
        rows.push({
          rowNumber,
          status: "invalid",
          eventType: safeField(parsedRow.eventType).toUpperCase(),
          tradeDate: validDateKey(parsedRow.tradeDate),
          eventId: "",
          issueCodes: rowIssues.map((item) => item.code)
        });
        return;
      }
      const transaction = { ...parsedRow.transaction, sourceSystem: adapter.brokerCode, rowNumber };
      periodDates.push(transaction.tradeDate);
      [transaction.accountRef, transaction.cashAccountRef].filter(Boolean).forEach((accountRef) => {
        sourceAccounts.add(sha256Hex(`${adapter.brokerCode}\u0000${normalizedAccount(accountRef)}`));
      });
      if (baselineDate && transaction.tradeDate < baselineDate) {
        const baselineIssue = issue("BEFORE_BASELINE", { rowNumber, field: "trade_date", severity: "info" });
        outputIssues.push(baselineIssue);
        rows.push({
          rowNumber,
          status: "excluded",
          eventType: transaction.type,
          tradeDate: transaction.tradeDate,
          eventId: "",
          issueCodes: [baselineIssue.code]
        });
        return;
      }

      let marketAsset = null;
      const resolutionIssues = [];
      if (BUY_SELL_TYPES.has(transaction.type) || transaction.type === "DIVIDEND") {
        const resolved = resolveMarketAsset(transaction, assets, options.mappings, mappingRequests);
        marketAsset = resolved.asset;
        if (resolved.issue) resolutionIssues.push(resolved.issue);
      }
      const cashResolution = resolveCashAsset(transaction, assets, options.mappings, mappingRequests);
      if (cashResolution.issue) resolutionIssues.push(cashResolution.issue);
      if (resolutionIssues.length) {
        outputIssues.push(...resolutionIssues);
        rows.push({
          rowNumber,
          status: "unresolved",
          eventType: transaction.type,
          tradeDate: transaction.tradeDate,
          eventId: "",
          issueCodes: resolutionIssues.map((item) => item.code)
        });
        return;
      }
      const event = eventFromTransaction(transaction, marketAsset, cashResolution.asset);
      provisional.push({
        rowNumber,
        transaction,
        event,
        fingerprint: economicFingerprint(event)
      });
    });

    const primary = new Map();
    const existingFallbackCounts = new Map();
    existingEvents.forEach((event) => {
      const key = sourceIdentity(event);
      if (key && !primary.has(key)) primary.set(key, { event, fingerprint: economicFingerprint(event), origin: "existing" });
      if (/^fallback:v1:[a-f0-9]{64}:\d+$/.test(String(event?.sourceId || ""))) {
        const fingerprint = economicFingerprint(event);
        existingFallbackCounts.set(fingerprint, (existingFallbackCounts.get(fingerprint) || 0) + 1);
      }
    });
    const fallbackOrdinals = new Map();
    const readyEvents = [];
    provisional.sort((left, right) => left.rowNumber - right.rowNumber).forEach((item) => {
      const originalId = normalizedText(item.transaction.sourceTransactionId);
      let sourceId = originalId;
      let fallbackOccurrence = 0;
      if (!sourceId) {
        fallbackOccurrence = (fallbackOrdinals.get(item.fingerprint) || 0) + 1;
        fallbackOrdinals.set(item.fingerprint, fallbackOccurrence);
        sourceId = `fallback:v1:${item.fingerprint.slice("sha256-v1:".length)}:${fallbackOccurrence}`;
      }
      item.event.sourceId = sourceId;
      item.event.eventId = `event-csv-${sha256Hex(sourceIdentity(item.event)).slice(0, 40)}`;
      if (!originalId && fallbackOccurrence <= (existingFallbackCounts.get(item.fingerprint) || 0)) {
        const duplicateIssue = issue("DUPLICATE_EXACT", {
          rowNumber: item.rowNumber,
          field: "transaction_id",
          severity: "info"
        });
        outputIssues.push(duplicateIssue);
        rows.push({
          rowNumber: item.rowNumber,
          status: "duplicate",
          eventType: item.transaction.type,
          tradeDate: item.transaction.tradeDate,
          eventId: "",
          issueCodes: [duplicateIssue.code]
        });
        return;
      }
      const key = sourceIdentity(item.event);
      const previous = primary.get(key);
      if (previous) {
        const same = previous.fingerprint === item.fingerprint;
        const duplicateIssue = issue(same ? "DUPLICATE_EXACT" : "SOURCE_CHANGED", {
          rowNumber: item.rowNumber,
          field: "transaction_id",
          severity: same ? "info" : "error"
        });
        outputIssues.push(duplicateIssue);
        rows.push({
          rowNumber: item.rowNumber,
          status: same ? "duplicate" : "conflict",
          eventType: item.transaction.type,
          tradeDate: item.transaction.tradeDate,
          eventId: "",
          issueCodes: [duplicateIssue.code]
        });
        return;
      }
      primary.set(key, { event: item.event, fingerprint: item.fingerprint, origin: "preview" });
      readyEvents.push(Object.freeze({ ...item.event }));
      rows.push({
        rowNumber: item.rowNumber,
        status: "ready",
        eventType: item.transaction.type,
        tradeDate: item.transaction.tradeDate,
        eventId: item.event.eventId,
        issueCodes: []
      });
    });

    rows.sort((left, right) => left.rowNumber - right.rowNumber);
    const statusCounts = { ready: 0, duplicate: 0, conflict: 0, invalid: 0, unresolved: 0, excluded: 0 };
    rows.forEach((row) => { statusCounts[row.status] = (statusCounts[row.status] || 0) + 1; });
    const eventSummary = summarizeReadyEvents(readyEvents);
    const sortedDates = periodDates.sort();
    return Object.freeze({
      adapter: Object.freeze({
        id: adapter.id,
        brokerCode: adapter.brokerCode,
        displayName: String(adapter.displayName || adapter.id),
        version: Number(adapter.version || 1)
      }),
      summary: Object.freeze({
        totalRows: table.dataRowCount,
        ...statusCounts,
        period: Object.freeze({
          from: sortedDates[0] || "",
          to: sortedDates[sortedDates.length - 1] || ""
        }),
        accountCount: sourceAccounts.size,
        mappingRequestCount: mappingRequests.size,
        ...eventSummary
      }),
      rows: Object.freeze(rows.map((row) => Object.freeze({ ...row, issueCodes: Object.freeze([...row.issueCodes]) }))),
      issues: Object.freeze(outputIssues.map((item) => Object.freeze({ ...item }))),
      mappingRequests: Object.freeze([...mappingRequests.values()]),
      candidateEvents: Object.freeze(readyEvents)
    });
  }

  return Object.freeze({
    MAX_FILE_BYTES,
    MAX_DATA_ROWS,
    MAX_COLUMNS,
    MAX_TEXT_LENGTH,
    SOURCE_ID_MAX_LENGTH,
    BrokerCsvError,
    issue,
    decodeCsv,
    parseCsv,
    createRegistry,
    registerAdapter: (adapter) => defaultRegistry.register(adapter),
    listAdapters: () => defaultRegistry.list(),
    detectAdapter: (table) => defaultRegistry.detect(table),
    preparePreview,
    economicFingerprint,
    sha256Hex
  });
});
