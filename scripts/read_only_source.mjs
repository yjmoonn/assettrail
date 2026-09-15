import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ledger = require("../ledger-engine.js");
const history = require("../history-repository.js");
const fail = code => { throw new Error(code); };
const digest = value => history.digestCanonical(value);
const clone = value => JSON.parse(history.canonicalStringify(value));
const identifier = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const documentId = value => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value)
  && value !== "." && value !== "..";
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

// Transport must supply authenticated server reads, decoded JSON, exact relative
// document paths and updateTime. There is deliberately no write capability here.
export async function readOnlySource({ transport, uid, observedAt, maxAttempts = 3,
  maxReads = 200, maxBytes = 20 * 1024 * 1024 }) {
  if (!identifier(uid) || !instant(observedAt) || !count(maxAttempts, 3) || !maxAttempts
      || !count(maxReads, 1000) || !maxReads || !count(maxBytes, 100 * 1024 * 1024) || !maxBytes
      || typeof transport?.getDocument !== "function" || typeof transport?.listDocuments !== "function") {
    fail("INVALID_READ_ONLY_SOURCE_REQUEST");
  }
  const primaryPath = `users/${uid}/financeData/primary`;
  let reads = 0;
  let bytes = 0;
  async function read(method, ...args) {
    if (reads >= maxReads) fail("SOURCE_READ_BUDGET_EXCEEDED");
    reads += 1;
    const result = await transport[method](...args);
    const serialized = history.canonicalStringify(result);
    bytes += Buffer.byteLength(serialized, "utf8");
    if (bytes > maxBytes) fail("SOURCE_BYTE_BUDGET_EXCEEDED");
    return JSON.parse(serialized);
  }
  function document(row, path) {
    if (!row || row.path !== path || !instant(row.updateTime)
        || Date.parse(row.updateTime) > Date.parse(observedAt)
        || !row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
      fail("INVALID_SOURCE_DOCUMENT");
    }
    return row;
  }
  async function list(collection, expectedCount) {
    const rows = [];
    const paths = new Set();
    const tokens = new Set();
    let pageToken = null;
    do {
      const page = await read("listDocuments", collection, { pageToken, pageSize: 10 });
      if (!page || !Array.isArray(page.documents) || page.documents.length > 100
          || !(page.nextPageToken === null || typeof page.nextPageToken === "string" && page.nextPageToken)) {
        fail("INVALID_SOURCE_PAGE");
      }
      for (const row of page.documents) {
        const id = typeof row?.path === "string" ? row.path.slice(collection.length + 1) : "";
        if (!documentId(id)) fail("INVALID_SOURCE_DOCUMENT_PATH");
        document(row, `${collection}/${id}`);
        if (paths.has(row.path)) fail("DUPLICATE_SOURCE_DOCUMENT");
        paths.add(row.path);
        rows.push(row);
        if (rows.length > expectedCount) fail("SOURCE_DOCUMENT_COUNT_MISMATCH");
      }
      pageToken = page.nextPageToken;
      if (pageToken && tokens.has(pageToken)) fail("SOURCE_PAGE_TOKEN_LOOP");
      tokens.add(pageToken);
    } while (pageToken);
    if (rows.length !== expectedCount) fail("SOURCE_DOCUMENT_COUNT_MISMATCH");
    return rows;
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const firstRaw = await read("getDocument", primaryPath);
    if (firstRaw === null) fail("SOURCE_PRIMARY_MISSING");
    const first = document(firstRaw, primaryPath);
    const data = first.data;
    if (data.schemaVersion !== 9 || !count(data.revision, Number.MAX_SAFE_INTEGER)) {
      fail("UNSUPPORTED_SOURCE_SCHEMA_OR_REVISION");
    }
    const meta = data.ledgerMeta;
    if (!meta || !identifier(meta.activeLedgerId) || !count(meta.eventCount, 100000)
        || !/^cyrb128-v1:[a-f0-9]{32}$/.test(meta.eventFingerprint || "")) {
      fail("INVALID_SOURCE_LEDGER_METADATA");
    }
    const ledgerRows = await list(`${primaryPath}/ledgers/${meta.activeLedgerId}/events`, meta.eventCount);
    const hm = data.historyMeta;
    let historyRows = [];
    let bundle = null;
    if (hm !== undefined) {
      if (!hm || !identifier(hm.activeHistoryId) || !count(hm.chunkCount, 10000)) {
        fail("INVALID_SOURCE_HISTORY_METADATA");
      }
      historyRows = await list(`${primaryPath}/histories/${hm.activeHistoryId}/chunks`, hm.chunkCount);
      bundle = { manifest: {
        schemaVersion: hm.schemaVersion, historyId: hm.activeHistoryId,
        snapshotCount: hm.snapshotCount, performanceCount: hm.performanceCount,
        chunkCount: hm.chunkCount, contentFingerprint: hm.contentFingerprint, updatedAt: hm.updatedAt
      }, chunks: historyRows.map(row => {
        if (row.data.chunkId !== row.path.split("/").at(-1)) fail("SOURCE_CHUNK_ID_MISMATCH");
        return row.data;
      }) };
    } else if (!Array.isArray(data.snapshots) || !Array.isArray(data.performanceObservations)) {
      fail("SOURCE_INLINE_HISTORY_MISSING");
    }
    const secondRaw = await read("getDocument", primaryPath);
    if (secondRaw === null) continue;
    const second = document(secondRaw, primaryPath);
    // updateTime detects an ABA replacement even if revision/body are restored.
    if (digest(first) !== digest(second)) continue;
    const events = ledgerRows.map(row => {
      if (row.data.eventId !== row.path.split("/").at(-1)) fail("SOURCE_EVENT_ID_MISMATCH");
      const normalized = ledger.normalizeLedgerEvent(row.data);
      if (!normalized.ok) fail("INVALID_SOURCE_LEDGER_EVENT");
      return normalized.event;
    });
    if (ledger.fingerprintLedger(events) !== meta.eventFingerprint) fail("SOURCE_LEDGER_FINGERPRINT_MISMATCH");
    if (!ledger.validateLedger(events, { baselineDate: meta.baselineDate }).ok) fail("INVALID_SOURCE_LEDGER");
    const restored = bundle ? history.restoreHistory(bundle)
      : history.normalizeHistory({ snapshots: data.snapshots, performanceObservations: data.performanceObservations });
    const state = { ...clone(data), events, ...restored };
    return {
      state,
      receipt: {
        schemaVersion: "assettrail.read-only-source.v1", observedAt,
        primaryRevision: data.revision, primaryUpdateTime: first.updateTime,
        primaryDigest: digest(first), partsDigest: digest({ ledgerRows, historyRows }),
        stateDigest: digest(state), eventCount: events.length,
        snapshotCount: restored.snapshots.length, performanceCount: restored.performanceObservations.length,
        attempts: attempt, reads, bytes, sourceConsistency: "VERIFIED",
        ledgerStructureValidated: true, economicStateValidated: false,
        latestValuationVerified: false, writeCount: 0
      }
    };
  }
  fail("SOURCE_STATE_MOVING");
}
