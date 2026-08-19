(function attachAssetTrailHistoryRepository(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailHistoryRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHistoryRepository() {
  "use strict";

  const HISTORY_SCHEMA = "assettrail.history.v1";
  const CHUNK_SCHEMA = "assettrail.history-chunk.v1";
  const INDEXED_DB_NAME = "assettrail-history-v1";
  const INDEXED_DB_VERSION = 1;
  const PERFORMANCE = "PERFORMANCE";
  const SNAPSHOT = "SNAPSHOT";
  const PERFORMANCE_CHUNK_MAX_ITEMS = 31;
  const SNAPSHOT_CHUNK_MAX_ITEMS = 50;
  const SNAPSHOT_CHUNK_MAX_BYTES = 256 * 1024;
  const PERFORMANCE_MAX_ITEMS = 10_000;
  const SNAPSHOT_MAX_ITEMS = 10_000;
  const ID_MAX_LENGTH = 160;
  const DEFAULT_HISTORY_ID = "history-local";
  const EPOCH_INSTANT = "1970-01-01T00:00:00.000Z";
  const BUNDLE_KEYS = Object.freeze(["chunks", "manifest"]);
  const MANIFEST_KEYS = Object.freeze([
    "chunkCount",
    "contentFingerprint",
    "historyId",
    "performanceCount",
    "schemaVersion",
    "snapshotCount",
    "updatedAt"
  ]);
  const CHUNK_KEYS = Object.freeze([
    "bucket",
    "chunkId",
    "digest",
    "historyId",
    "itemCount",
    "items",
    "kind",
    "schemaVersion",
    "updatedAt"
  ]);

  const CONSTANTS = Object.freeze({
    historySchema: HISTORY_SCHEMA,
    chunkSchema: CHUNK_SCHEMA,
    indexedDbName: INDEXED_DB_NAME,
    performanceChunkMaxItems: PERFORMANCE_CHUNK_MAX_ITEMS,
    performanceMaxItems: PERFORMANCE_MAX_ITEMS,
    snapshotChunkMaxItems: SNAPSHOT_CHUNK_MAX_ITEMS,
    snapshotChunkMaxBytes: SNAPSHOT_CHUNK_MAX_BYTES,
    snapshotMaxItems: SNAPSHOT_MAX_ITEMS
  });

  function fail(code, message) {
    const error = new Error(message);
    error.name = "HistoryRepositoryError";
    error.code = code;
    throw error;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function assertExactKeys(value, expectedKeys, code, label) {
    const actual = Object.keys(value).sort(compareText);
    const expected = [...expectedKeys].sort(compareText);
    if (actual.length !== expected.length
        || actual.some((key, index) => key !== expected[index])) {
      fail(code, `${label}에 지원하지 않거나 누락된 필드가 있습니다.`);
    }
  }

  function canonicalStringify(value, stack = new Set()) {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
      return JSON.stringify(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail("NON_FINITE_NUMBER", "Canonical JSON에는 유한한 숫자만 저장할 수 있습니다.");
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    if (value === undefined || typeof value !== "object") {
      fail("UNSUPPORTED_CANONICAL_VALUE", "Canonical JSON에 지원하지 않는 값이 있습니다.");
    }
    if (stack.has(value)) fail("CYCLIC_VALUE", "Canonical JSON에 순환 참조가 있습니다.");
    stack.add(value);
    let result;
    if (Array.isArray(value)) {
      result = `[${value.map((item) => canonicalStringify(item, stack)).join(",")}]`;
    } else if (isPlainObject(value)) {
      result = `{${Object.keys(value).sort(compareText).map((key) => (
        `${JSON.stringify(key)}:${canonicalStringify(value[key], stack)}`
      )).join(",")}}`;
    } else {
      fail("UNSUPPORTED_CANONICAL_OBJECT", "Canonical JSON에는 평범한 객체만 저장할 수 있습니다.");
    }
    stack.delete(value);
    return result;
  }

  function canonicalClone(value) {
    return JSON.parse(canonicalStringify(value));
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

  function utf8ByteLength(text) {
    return utf8Bytes(text).length;
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

  function digestCanonical(value) {
    return `sha256:${sha256(canonicalStringify(value))}`;
  }

  function validDateKey(value) {
    const key = typeof value === "string" ? value.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function normalizeInstant(value, field) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
      fail("INVALID_INSTANT", `${field}은(는) 올바른 시각이어야 합니다.`);
    }
    return new Date(value).toISOString();
  }

  function normalizeHistoryId(value) {
    const historyId = String(value || "").trim();
    if (!historyId || historyId.length > 200 || historyId.includes("/")) {
      fail("INVALID_HISTORY_ID", "historyId가 비어 있거나 저장 경로에 사용할 수 없습니다.");
    }
    return historyId;
  }

  function normalizedRecordId(value, field) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || id.length > ID_MAX_LENGTH) {
      fail("INVALID_RECORD_ID", `${field}가 비어 있거나 ${ID_MAX_LENGTH}자를 초과했습니다.`);
    }
    return id;
  }

  function normalizeSnapshot(snapshot, index) {
    if (!isPlainObject(snapshot)) fail("INVALID_SNAPSHOT", `snapshots[${index}]가 객체가 아닙니다.`);
    const normalized = canonicalClone(snapshot);
    normalized.id = normalizedRecordId(normalized.id, `snapshots[${index}].id`);
    normalized.createdAt = normalizeInstant(normalized.createdAt, `snapshots[${index}].createdAt`);
    return canonicalClone(normalized);
  }

  function normalizePerformanceObservation(observation, index) {
    if (!isPlainObject(observation)) {
      fail("INVALID_PERFORMANCE_OBSERVATION", `performanceObservations[${index}]가 객체가 아닙니다.`);
    }
    const normalized = canonicalClone(observation);
    normalized.id = normalizedRecordId(normalized.id, `performanceObservations[${index}].id`);
    normalized.date = validDateKey(normalized.date);
    if (!normalized.date) {
      fail("INVALID_PERFORMANCE_DATE", `performanceObservations[${index}].date가 올바르지 않습니다.`);
    }
    normalized.capturedAt = normalizeInstant(
      normalized.capturedAt,
      `performanceObservations[${index}].capturedAt`
    );
    return canonicalClone(normalized);
  }

  function assertUnique(items, field, code, label) {
    const seen = new Set();
    items.forEach((item, index) => {
      const key = item[field];
      if (seen.has(key)) fail(code, `${label}[${index}].${field}가 중복되었습니다.`);
      seen.add(key);
    });
  }

  function normalizeHistory(input = {}) {
    if (!isPlainObject(input)) fail("INVALID_HISTORY", "히스토리 입력은 객체여야 합니다.");
    const snapshotsSource = input.snapshots === undefined ? [] : input.snapshots;
    const performanceSource = input.performanceObservations === undefined ? [] : input.performanceObservations;
    if (!Array.isArray(snapshotsSource)) fail("INVALID_SNAPSHOT_LIST", "snapshots는 목록이어야 합니다.");
    if (!Array.isArray(performanceSource)) {
      fail("INVALID_PERFORMANCE_LIST", "performanceObservations는 목록이어야 합니다.");
    }
    if (snapshotsSource.length > SNAPSHOT_MAX_ITEMS) {
      fail("SNAPSHOT_LIMIT_EXCEEDED", `조회 기록은 최대 ${SNAPSHOT_MAX_ITEMS}개까지 저장할 수 있습니다.`);
    }
    if (performanceSource.length > PERFORMANCE_MAX_ITEMS) {
      fail(
        "PERFORMANCE_LIMIT_EXCEEDED",
        `성과 평가점은 최대 ${PERFORMANCE_MAX_ITEMS}개까지 저장할 수 있습니다.`
      );
    }
    const snapshots = snapshotsSource.map(normalizeSnapshot).sort((left, right) => (
      compareText(left.createdAt, right.createdAt) || compareText(left.id, right.id)
    ));
    const performanceObservations = performanceSource.map(normalizePerformanceObservation).sort((left, right) => (
      compareText(left.date, right.date)
      || compareText(left.capturedAt, right.capturedAt)
      || compareText(left.id, right.id)
    ));
    assertUnique(snapshots, "id", "DUPLICATE_SNAPSHOT_ID", "snapshots");
    assertUnique(performanceObservations, "id", "DUPLICATE_PERFORMANCE_ID", "performanceObservations");
    assertUnique(performanceObservations, "date", "DUPLICATE_PERFORMANCE_DATE", "performanceObservations");
    return { snapshots, performanceObservations };
  }

  function monthForInstant(value) {
    return normalizeInstant(value, "createdAt").slice(0, 7);
  }

  function itemsByMonth(items, monthForItem) {
    const groups = new Map();
    items.forEach((item) => {
      const month = monthForItem(item);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(item);
    });
    return [...groups.entries()].sort(([left], [right]) => compareText(left, right));
  }

  function chunkDigestPayload(chunk) {
    return {
      schemaVersion: CHUNK_SCHEMA,
      chunkId: chunk.chunkId,
      kind: chunk.kind,
      bucket: chunk.bucket,
      itemCount: chunk.items.length,
      items: chunk.items
    };
  }

  function buildChunk({ historyId, chunkId, kind, bucket, items, updatedAt }) {
    const base = {
      schemaVersion: CHUNK_SCHEMA,
      historyId,
      chunkId,
      kind,
      bucket,
      items: canonicalClone(items),
      itemCount: items.length,
      updatedAt
    };
    return canonicalClone({
      ...base,
      digest: `history-chunk-v1:${sha256(canonicalStringify(chunkDigestPayload(base)))}`
    });
  }

  function performanceChunks(items, historyId, updatedAt) {
    return itemsByMonth(items, (item) => item.date.slice(0, 7)).map(([month, monthItems]) => {
      if (monthItems.length > PERFORMANCE_CHUNK_MAX_ITEMS) {
        fail("PERFORMANCE_MONTH_LIMIT_EXCEEDED", `${month} 성과 평가점이 월 최대 개수를 초과했습니다.`);
      }
      return buildChunk({
        historyId,
        chunkId: `performance:${month}`,
        kind: PERFORMANCE,
        bucket: month,
        items: monthItems,
        updatedAt
      });
    });
  }

  function snapshotChunkId(month, prefix) {
    return `snapshot:${month}:${prefix || "root"}`;
  }

  function snapshotItemHash(item) {
    return sha256(item.id);
  }

  function snapshotChunksForShard(items, month, prefix, historyId, updatedAt) {
    const chunk = buildChunk({
      historyId,
      chunkId: snapshotChunkId(month, prefix),
      kind: SNAPSHOT,
      bucket: month,
      items,
      updatedAt
    });
    const byteLength = utf8ByteLength(canonicalStringify(chunk));
    if (items.length <= SNAPSHOT_CHUNK_MAX_ITEMS && byteLength <= SNAPSHOT_CHUNK_MAX_BYTES) return [chunk];
    if (items.length === 1) {
      fail(
        "SNAPSHOT_ITEM_TOO_LARGE",
        `${items[0].id} 조회 기록 하나가 ${SNAPSHOT_CHUNK_MAX_BYTES}바이트 chunk 한도를 초과했습니다.`
      );
    }
    if (prefix.length >= 64) {
      fail("SNAPSHOT_SHARD_COLLISION", `${month} 조회 기록의 안정적 shard를 더 분할할 수 없습니다.`);
    }
    const childGroups = new Map();
    items.forEach((item) => {
      const hash = snapshotItemHash(item);
      const childPrefix = `${prefix}${hash[prefix.length]}`;
      if (!childGroups.has(childPrefix)) childGroups.set(childPrefix, []);
      childGroups.get(childPrefix).push(item);
    });
    return [...childGroups.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .flatMap(([childPrefix, childItems]) => (
        snapshotChunksForShard(childItems, month, childPrefix, historyId, updatedAt)
      ));
  }

  function snapshotChunks(items, historyId, updatedAt) {
    return itemsByMonth(items, (item) => monthForInstant(item.createdAt))
      .flatMap(([month, monthItems]) => snapshotChunksForShard(monthItems, month, "", historyId, updatedAt));
  }

  function chunkSummary(chunk) {
    return {
      chunkId: chunk.chunkId,
      kind: chunk.kind,
      bucket: chunk.bucket,
      itemCount: chunk.itemCount,
      digest: chunk.digest
    };
  }

  function historyContentFingerprint(chunks) {
    const summaries = chunks.map(chunkSummary).sort((left, right) => compareText(left.chunkId, right.chunkId));
    return `history-v1:${sha256(canonicalStringify({ schemaVersion: HISTORY_SCHEMA, chunks: summaries }))}`;
  }

  function createHistoryBundle(input = {}, options = {}) {
    const history = normalizeHistory(input);
    const historyId = normalizeHistoryId(options.historyId || DEFAULT_HISTORY_ID);
    const updatedAt = options.updatedAt === undefined
      ? EPOCH_INSTANT
      : normalizeInstant(options.updatedAt, "updatedAt");
    const chunks = [
      ...performanceChunks(history.performanceObservations, historyId, updatedAt),
      ...snapshotChunks(history.snapshots, historyId, updatedAt)
    ].sort((left, right) => compareText(left.chunkId, right.chunkId));
    const manifest = canonicalClone({
      schemaVersion: HISTORY_SCHEMA,
      historyId,
      snapshotCount: history.snapshots.length,
      performanceCount: history.performanceObservations.length,
      chunkCount: chunks.length,
      contentFingerprint: historyContentFingerprint(chunks),
      updatedAt
    });
    return { manifest, chunks };
  }

  function normalizeManifest(manifest) {
    if (!isPlainObject(manifest)) fail("INVALID_MANIFEST", "history manifest가 객체가 아닙니다.");
    assertExactKeys(manifest, MANIFEST_KEYS, "INVALID_MANIFEST_FIELDS", "history manifest");
    const normalized = canonicalClone(manifest);
    if (normalized.schemaVersion !== HISTORY_SCHEMA) {
      fail("UNSUPPORTED_HISTORY_SCHEMA", "지원하지 않는 history manifest 스키마입니다.");
    }
    normalized.historyId = normalizeHistoryId(normalized.historyId);
    ["snapshotCount", "performanceCount", "chunkCount"].forEach((field) => {
      if (!Number.isSafeInteger(normalized[field]) || normalized[field] < 0) {
        fail("INVALID_MANIFEST_COUNT", `history manifest의 ${field}가 올바르지 않습니다.`);
      }
    });
    if (normalized.snapshotCount > SNAPSHOT_MAX_ITEMS) {
      fail("SNAPSHOT_LIMIT_EXCEEDED", `history manifest의 조회 기록이 최대 ${SNAPSHOT_MAX_ITEMS}개를 넘었습니다.`);
    }
    if (normalized.performanceCount > PERFORMANCE_MAX_ITEMS) {
      fail(
        "PERFORMANCE_LIMIT_EXCEEDED",
        `history manifest의 성과 평가점이 최대 ${PERFORMANCE_MAX_ITEMS}개를 넘었습니다.`
      );
    }
    if (!/^history-v1:[a-f0-9]{64}$/.test(normalized.contentFingerprint || "")) {
      fail("INVALID_HISTORY_FINGERPRINT", "history manifest fingerprint 형식이 올바르지 않습니다.");
    }
    normalized.updatedAt = normalizeInstant(normalized.updatedAt, "manifest.updatedAt");
    return canonicalClone(normalized);
  }

  function normalizeChunk(chunk, historyId) {
    if (!isPlainObject(chunk)) fail("INVALID_CHUNK", "history chunk가 객체가 아닙니다.");
    assertExactKeys(chunk, CHUNK_KEYS, "INVALID_CHUNK_FIELDS", "history chunk");
    const normalized = canonicalClone(chunk);
    if (normalized.schemaVersion !== CHUNK_SCHEMA) {
      fail("UNSUPPORTED_CHUNK_SCHEMA", "지원하지 않는 history chunk 스키마입니다.");
    }
    if (normalizeHistoryId(normalized.historyId) !== historyId) {
      fail("CHUNK_HISTORY_MISMATCH", "history chunk의 historyId가 manifest와 다릅니다.");
    }
    if (![PERFORMANCE, SNAPSHOT].includes(normalized.kind)) {
      fail("INVALID_CHUNK_KIND", "history chunk kind가 올바르지 않습니다.");
    }
    if (!/^\d{4}-\d{2}$/.test(normalized.bucket || "")) {
      fail("INVALID_CHUNK_BUCKET", "history chunk bucket이 올바르지 않습니다.");
    }
    if (!Array.isArray(normalized.items) || normalized.itemCount !== normalized.items.length) {
      fail("CHUNK_ITEM_COUNT_MISMATCH", "history chunk itemCount가 실제 항목 수와 다릅니다.");
    }
    normalized.updatedAt = normalizeInstant(normalized.updatedAt, "chunk.updatedAt");
    if (!/^history-chunk-v1:[a-f0-9]{64}$/.test(normalized.digest || "")) {
      fail("INVALID_CHUNK_DIGEST", "history chunk digest 형식이 올바르지 않습니다.");
    }
    const actualDigest = `history-chunk-v1:${sha256(canonicalStringify(chunkDigestPayload(normalized)))}`;
    if (actualDigest !== normalized.digest) {
      fail("CHUNK_DIGEST_MISMATCH", `history chunk ${normalized.chunkId || ""}의 내용이 digest와 다릅니다.`);
    }
    if (normalized.kind === PERFORMANCE && normalized.items.length > PERFORMANCE_CHUNK_MAX_ITEMS) {
      fail("PERFORMANCE_MONTH_LIMIT_EXCEEDED", "성과 평가점 chunk가 월 최대 개수를 초과했습니다.");
    }
    if (normalized.kind === SNAPSHOT) {
      if (normalized.items.length > SNAPSHOT_CHUNK_MAX_ITEMS) {
        fail("SNAPSHOT_CHUNK_ITEM_LIMIT_EXCEEDED", "조회 기록 chunk가 항목 수 한도를 초과했습니다.");
      }
      if (utf8ByteLength(canonicalStringify(normalized)) > SNAPSHOT_CHUNK_MAX_BYTES) {
        fail("SNAPSHOT_CHUNK_BYTE_LIMIT_EXCEEDED", "조회 기록 chunk가 바이트 한도를 초과했습니다.");
      }
    }
    return canonicalClone(normalized);
  }

  function restoreHistory(bundle) {
    if (!isPlainObject(bundle)) fail("INVALID_BUNDLE", "history bundle이 객체가 아닙니다.");
    assertExactKeys(bundle, BUNDLE_KEYS, "INVALID_BUNDLE_FIELDS", "history bundle");
    const manifest = normalizeManifest(bundle.manifest);
    if (!Array.isArray(bundle.chunks)) fail("INVALID_CHUNK_LIST", "history chunks는 목록이어야 합니다.");
    const chunks = bundle.chunks.map((chunk) => normalizeChunk(chunk, manifest.historyId));
    assertUnique(chunks, "chunkId", "DUPLICATE_CHUNK_ID", "chunks");
    if (chunks.length !== manifest.chunkCount) {
      fail("MANIFEST_CHUNK_COUNT_MISMATCH", "history manifest의 chunkCount가 실제 chunk 수와 다릅니다.");
    }
    const snapshots = [];
    const performanceObservations = [];
    chunks.forEach((chunk) => {
      if (chunk.kind === SNAPSHOT) snapshots.push(...chunk.items);
      else performanceObservations.push(...chunk.items);
    });
    const history = normalizeHistory({ snapshots, performanceObservations });
    if (history.snapshots.length !== manifest.snapshotCount
        || history.performanceObservations.length !== manifest.performanceCount) {
      fail("MANIFEST_ITEM_COUNT_MISMATCH", "history manifest의 항목 수가 실제 항목 수와 다릅니다.");
    }
    const expected = createHistoryBundle(history, {
      historyId: manifest.historyId,
      updatedAt: manifest.updatedAt
    });
    const actualSummaries = chunks.map(chunkSummary).sort((left, right) => compareText(left.chunkId, right.chunkId));
    const expectedSummaries = expected.chunks.map(chunkSummary);
    if (canonicalStringify(actualSummaries) !== canonicalStringify(expectedSummaries)) {
      fail("NON_CANONICAL_CHUNK_LAYOUT", "history chunks가 월별 안정적 shard 규칙과 일치하지 않습니다.");
    }
    const actualFingerprint = historyContentFingerprint(chunks);
    if (actualFingerprint !== manifest.contentFingerprint) {
      fail("HISTORY_FINGERPRINT_MISMATCH", "history manifest fingerprint가 chunk 내용과 다릅니다.");
    }
    return history;
  }

  function validateHistoryBundle(bundle) {
    try {
      const history = restoreHistory(bundle);
      return { ok: true, history, errors: [] };
    } catch (error) {
      return {
        ok: false,
        history: null,
        errors: [{ code: error?.code || "UNKNOWN_HISTORY_ERROR", message: String(error?.message || error) }]
      };
    }
  }

  function normalizedScope(value) {
    const scope = String(value || "").trim();
    if (!scope || scope.length > 500) fail("INVALID_HISTORY_SCOPE", "히스토리 저장 범위가 올바르지 않습니다.");
    return scope;
  }

  function cloneBundle(bundle) {
    return canonicalClone({ manifest: bundle.manifest, chunks: bundle.chunks });
  }

  function createMemoryHistoryAdapter() {
    const bundlesByScope = new Map();
    const activeByScope = new Map();

    function scopeBundles(scope) {
      if (!bundlesByScope.has(scope)) bundlesByScope.set(scope, new Map());
      return bundlesByScope.get(scope);
    }

    return Object.freeze({
      async writeBundle(scopeValue, bundle) {
        const scope = normalizedScope(scopeValue);
        restoreHistory(bundle);
        scopeBundles(scope).set(bundle.manifest.historyId, cloneBundle(bundle));
      },
      async readBundle(scopeValue, historyIdValue) {
        const scope = normalizedScope(scopeValue);
        const historyId = normalizeHistoryId(historyIdValue);
        const bundle = scopeBundles(scope).get(historyId);
        return bundle ? cloneBundle(bundle) : null;
      },
      async setActiveHistoryId(scopeValue, historyIdValue) {
        const scope = normalizedScope(scopeValue);
        const historyId = normalizeHistoryId(historyIdValue);
        if (!scopeBundles(scope).has(historyId)) {
          fail("HISTORY_GENERATION_NOT_FOUND", "활성화할 history 세대가 저장되어 있지 않습니다.");
        }
        activeByScope.set(scope, historyId);
      },
      async getActiveHistoryId(scopeValue) {
        const scope = normalizedScope(scopeValue);
        return activeByScope.get(scope) || null;
      },
      async readActiveBundle(scopeValue) {
        const scope = normalizedScope(scopeValue);
        const historyId = activeByScope.get(scope);
        if (!historyId) return null;
        const bundle = scopeBundles(scope).get(historyId);
        if (!bundle) fail("ACTIVE_HISTORY_MISSING", "활성 history 세대가 저장소에 없습니다.");
        return cloneBundle(bundle);
      },
      async deleteBundle(scopeValue, historyIdValue) {
        const scope = normalizedScope(scopeValue);
        const historyId = normalizeHistoryId(historyIdValue);
        if (activeByScope.get(scope) === historyId) {
          fail("ACTIVE_HISTORY_DELETE_BLOCKED", "활성 history 세대는 삭제할 수 없습니다.");
        }
        scopeBundles(scope).delete(historyId);
      },
      async clearScope(scopeValue) {
        const scope = normalizedScope(scopeValue);
        bundlesByScope.delete(scope);
        activeByScope.delete(scope);
      },
      close() {}
    });
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    });
  }

  function manifestStorageKey(scope, historyId) {
    return JSON.stringify([scope, historyId]);
  }

  function chunkStorageKey(scope, historyId, chunkId) {
    return JSON.stringify([scope, historyId, chunkId]);
  }

  function scopeHistoryKey(scope, historyId) {
    return JSON.stringify([scope, historyId]);
  }

  function createIndexedDbHistoryAdapter(options = {}) {
    const indexedDbFactory = options.indexedDB === undefined
      ? (typeof globalThis !== "undefined" ? globalThis.indexedDB : undefined)
      : options.indexedDB;
    if (!indexedDbFactory || typeof indexedDbFactory.open !== "function") {
      fail("INDEXEDDB_UNAVAILABLE", "이 브라우저에서는 IndexedDB 히스토리 저장소를 사용할 수 없습니다.");
    }
    const databaseName = String(options.databaseName || INDEXED_DB_NAME);
    let databasePromise = null;

    function openDatabase() {
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDbFactory.open(databaseName, INDEXED_DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("manifests")) {
            const manifests = database.createObjectStore("manifests", { keyPath: "key" });
            manifests.createIndex("scope", "scope", { unique: false });
          }
          if (!database.objectStoreNames.contains("chunks")) {
            const chunks = database.createObjectStore("chunks", { keyPath: "key" });
            chunks.createIndex("scope", "scope", { unique: false });
            chunks.createIndex("scopeHistory", "scopeHistory", { unique: false });
          }
          if (!database.objectStoreNames.contains("active")) {
            database.createObjectStore("active", { keyPath: "scope" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
        request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
      return databasePromise;
    }

    async function writeBundle(scopeValue, bundle) {
      const scope = normalizedScope(scopeValue);
      restoreHistory(bundle);
      const verified = cloneBundle(bundle);
      const historyId = verified.manifest.historyId;
      const database = await openDatabase();
      const transaction = database.transaction(["manifests", "chunks"], "readwrite");
      const manifests = transaction.objectStore("manifests");
      const chunks = transaction.objectStore("chunks");
      const existingRequest = chunks.index("scopeHistory").getAllKeys(scopeHistoryKey(scope, historyId));
      existingRequest.onsuccess = () => {
        existingRequest.result.forEach((key) => chunks.delete(key));
        manifests.put({
          key: manifestStorageKey(scope, historyId),
          scope,
          historyId,
          manifest: verified.manifest
        });
        verified.chunks.forEach((chunk) => chunks.put({
          key: chunkStorageKey(scope, historyId, chunk.chunkId),
          scope,
          scopeHistory: scopeHistoryKey(scope, historyId),
          historyId,
          chunkId: chunk.chunkId,
          chunk
        }));
      };
      await transactionPromise(transaction);
    }

    async function readBundle(scopeValue, historyIdValue) {
      const scope = normalizedScope(scopeValue);
      const historyId = normalizeHistoryId(historyIdValue);
      const database = await openDatabase();
      const transaction = database.transaction(["manifests", "chunks"], "readonly");
      const manifestRequest = transaction.objectStore("manifests").get(manifestStorageKey(scope, historyId));
      const chunksRequest = transaction.objectStore("chunks").index("scopeHistory")
        .getAll(scopeHistoryKey(scope, historyId));
      const [manifestRecord, chunkRecords] = await Promise.all([
        requestPromise(manifestRequest),
        requestPromise(chunksRequest),
        transactionPromise(transaction)
      ]);
      if (!manifestRecord) return null;
      const bundle = {
        manifest: manifestRecord.manifest,
        chunks: chunkRecords.map((record) => record.chunk)
      };
      restoreHistory(bundle);
      return cloneBundle(bundle);
    }

    async function setActiveHistoryId(scopeValue, historyIdValue) {
      const scope = normalizedScope(scopeValue);
      const historyId = normalizeHistoryId(historyIdValue);
      const database = await openDatabase();
      const transaction = database.transaction(["manifests", "active"], "readwrite");
      const manifestRequest = transaction.objectStore("manifests").get(manifestStorageKey(scope, historyId));
      let manifestFound = null;
      manifestRequest.onsuccess = () => {
        manifestFound = Boolean(manifestRequest.result);
        if (!manifestFound) {
          transaction.abort();
          return;
        }
        transaction.objectStore("active").put({ scope, historyId });
      };
      try {
        await transactionPromise(transaction);
      } catch (error) {
        if (manifestFound === false) {
          fail("HISTORY_GENERATION_NOT_FOUND", "활성화할 history 세대가 저장되어 있지 않습니다.");
        }
        throw error;
      }
    }

    async function getActiveHistoryId(scopeValue) {
      const scope = normalizedScope(scopeValue);
      const database = await openDatabase();
      const transaction = database.transaction("active", "readonly");
      const record = await requestPromise(transaction.objectStore("active").get(scope));
      await transactionPromise(transaction);
      return record?.historyId || null;
    }

    async function readActiveBundle(scopeValue) {
      const scope = normalizedScope(scopeValue);
      const historyId = await getActiveHistoryId(scope);
      if (!historyId) return null;
      const bundle = await readBundle(scope, historyId);
      if (!bundle) fail("ACTIVE_HISTORY_MISSING", "활성 history 세대가 저장소에 없습니다.");
      return bundle;
    }

    async function deleteBundle(scopeValue, historyIdValue) {
      const scope = normalizedScope(scopeValue);
      const historyId = normalizeHistoryId(historyIdValue);
      const database = await openDatabase();
      const transaction = database.transaction(["active", "manifests", "chunks"], "readwrite");
      const activeRequest = transaction.objectStore("active").get(scope);
      let deleteBlocked = false;
      activeRequest.onsuccess = () => {
        deleteBlocked = activeRequest.result?.historyId === historyId;
        if (deleteBlocked) {
          transaction.abort();
          return;
        }
        transaction.objectStore("manifests").delete(manifestStorageKey(scope, historyId));
        const chunks = transaction.objectStore("chunks");
        const request = chunks.index("scopeHistory").getAllKeys(scopeHistoryKey(scope, historyId));
        request.onsuccess = () => request.result.forEach((key) => chunks.delete(key));
      };
      try {
        await transactionPromise(transaction);
      } catch (error) {
        if (deleteBlocked) {
          fail("ACTIVE_HISTORY_DELETE_BLOCKED", "활성 history 세대는 삭제할 수 없습니다.");
        }
        throw error;
      }
    }

    async function clearScope(scopeValue) {
      const scope = normalizedScope(scopeValue);
      const database = await openDatabase();
      const transaction = database.transaction(["manifests", "chunks", "active"], "readwrite");
      const manifests = transaction.objectStore("manifests");
      const manifestKeys = manifests.index("scope").getAllKeys(scope);
      manifestKeys.onsuccess = () => manifestKeys.result.forEach((key) => manifests.delete(key));
      const chunks = transaction.objectStore("chunks");
      const chunkKeys = chunks.index("scope").getAllKeys(scope);
      chunkKeys.onsuccess = () => chunkKeys.result.forEach((key) => chunks.delete(key));
      transaction.objectStore("active").delete(scope);
      await transactionPromise(transaction);
    }

    return Object.freeze({
      writeBundle,
      readBundle,
      setActiveHistoryId,
      getActiveHistoryId,
      readActiveBundle,
      deleteBundle,
      clearScope,
      async close() {
        if (!databasePromise) return;
        const database = await databasePromise;
        database.close();
        databasePromise = null;
      }
    });
  }

  return Object.freeze({
    canonicalStringify,
    constants: CONSTANTS,
    createHistoryBundle,
    createIndexedDbHistoryAdapter,
    createMemoryHistoryAdapter,
    digestCanonical,
    normalizeHistory,
    restoreHistory,
    validateHistoryBundle
  });
});
