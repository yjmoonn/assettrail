import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { IDBFactory } from "fake-indexeddb";

const require = createRequire(import.meta.url);
const repository = require("../history-repository.js");

const API = [
  "canonicalStringify",
  "constants",
  "createHistoryBundle",
  "createIndexedDbHistoryAdapter",
  "createMemoryHistoryAdapter",
  "digestCanonical",
  "normalizeHistory",
  "restoreHistory",
  "validateHistoryBundle"
];

assert.deepEqual(Object.keys(repository).sort(), API);
assert.equal(repository.constants.snapshotMaxItems, 10_000);
assert.equal(repository.constants.performanceMaxItems, 10_000);

{
  const context = vm.createContext({});
  vm.runInContext(readFileSync("history-repository.js", "utf8"), context);
  assert.deepEqual(Object.keys(context.AssetTrailHistoryRepository).sort(), API);
}

function snapshot(id, createdAt, extra = {}) {
  return {
    id,
    createdAt,
    total: 1_000,
    note: "",
    typeTotals: { CASH: 1_000 },
    ...extra
  };
}

function performance(id, date, extra = {}) {
  return {
    id,
    date,
    capturedAt: `${date}T15:00:00+09:00`,
    cutoff: "END_OF_DAY_POST_FLOW",
    navKRW: 1_000,
    ...extra
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function itemChunkMap(bundle, kind) {
  return Object.fromEntries(bundle.chunks
    .filter((chunk) => chunk.kind === kind)
    .flatMap((chunk) => chunk.items.map((item) => [item.id, chunk.chunkId])));
}

// Canonical JSON and digests are deterministic across object insertion order.
{
  assert.equal(repository.canonicalStringify({ z: 1, a: -0 }), '{"a":0,"z":1}');
  assert.equal(
    repository.digestCanonical(""),
    "sha256:12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126"
  );
  assert.equal(
    repository.digestCanonical({ b: [2, 1], a: "한글" }),
    repository.digestCanonical({ a: "한글", b: [2, 1] })
  );
  assert.throws(
    () => repository.canonicalStringify({ bad: Number.NaN }),
    (error) => error.code === "NON_FINITE_NUMBER"
  );
}

// v6 portable JSON flat arrays normalize without mutation and keep snapshots
// distinct from performance observations.
const v6 = {
  schemaVersion: 6,
  snapshots: [
    snapshot("s-2", "2026-02-02T00:00:00+09:00"),
    snapshot("s-1", "2026-01-01T00:00:00Z")
  ],
  performanceObservations: [
    performance("p-2", "2026-02-02"),
    performance("p-1", "2026-01-01")
  ]
};

{
  const before = clone(v6);
  const normalized = repository.normalizeHistory(v6);
  assert.deepEqual(v6, before);
  assert.deepEqual(normalized.snapshots.map((item) => item.id), ["s-1", "s-2"]);
  assert.deepEqual(normalized.performanceObservations.map((item) => item.id), ["p-1", "p-2"]);
  assert.equal(normalized.snapshots[1].createdAt, "2026-02-01T15:00:00.000Z");
  assert.equal(normalized.performanceObservations[0].capturedAt, "2026-01-01T06:00:00.000Z");
}

// Duplicate identity and same-date performance observations fail closed.
{
  assert.throws(
    () => repository.normalizeHistory({
      snapshots: [snapshot("same", "2026-01-01T00:00:00Z"), snapshot("same", "2026-01-02T00:00:00Z")]
    }),
    (error) => error.code === "DUPLICATE_SNAPSHOT_ID"
  );
  assert.throws(
    () => repository.normalizeHistory({
      performanceObservations: [performance("p-1", "2026-01-01"), performance("p-2", "2026-01-01")]
    }),
    (error) => error.code === "DUPLICATE_PERFORMANCE_DATE"
  );
}

// Performance observations are one canonical chunk per month, with no more
// than the number of possible unique calendar dates.
{
  const january = Array.from({ length: 31 }, (_, index) => (
    performance(`jan-${index + 1}`, `2026-01-${String(index + 1).padStart(2, "0")}`)
  ));
  const february = Array.from({ length: 3 }, (_, index) => (
    performance(`feb-${index + 1}`, `2026-02-${String(index + 1).padStart(2, "0")}`)
  ));
  const bundle = repository.createHistoryBundle(
    { performanceObservations: [...february, ...january] },
    { historyId: "history-performance", updatedAt: "2026-03-01T00:00:00Z" }
  );
  const chunks = bundle.chunks.filter((chunk) => chunk.kind === "PERFORMANCE");
  assert.deepEqual(chunks.map((chunk) => chunk.chunkId), ["performance:2026-01", "performance:2026-02"]);
  assert.deepEqual(chunks.map((chunk) => chunk.itemCount), [31, 3]);
  assert.equal(bundle.manifest.performanceCount, 34);
}

// Snapshot shards split deterministically when either the 50-item or 256 KiB
// boundary is reached. Existing items retain their shard after an unrelated add.
{
  const fifty = Array.from({ length: 50 }, (_, index) => (
    snapshot(`snapshot-${index}`, `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`)
  ));
  const fiftyBundle = repository.createHistoryBundle(
    { snapshots: fifty },
    { historyId: "history-snapshots", updatedAt: "2026-02-01T00:00:00Z" }
  );
  assert.deepEqual(
    fiftyBundle.chunks.filter((chunk) => chunk.kind === "SNAPSHOT").map((chunk) => chunk.chunkId),
    ["snapshot:2026-01:root"]
  );

  const sixty = [...fifty, ...Array.from({ length: 10 }, (_, index) => (
    snapshot(`snapshot-${50 + index}`, `2026-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00Z`)
  ))];
  const sixtyBundle = repository.createHistoryBundle(
    { snapshots: sixty },
    { historyId: "history-snapshots", updatedAt: "2026-02-01T00:00:00Z" }
  );
  const sixtyOneBundle = repository.createHistoryBundle(
    { snapshots: [...sixty, snapshot("snapshot-60", "2026-01-31T23:59:59Z")] },
    { historyId: "history-snapshots", updatedAt: "2026-02-01T00:00:00Z" }
  );
  assert.ok(sixtyBundle.chunks.filter((chunk) => chunk.kind === "SNAPSHOT").length > 1);
  sixtyBundle.chunks.filter((chunk) => chunk.kind === "SNAPSHOT").forEach((chunk) => {
    assert.ok(chunk.itemCount <= repository.constants.snapshotChunkMaxItems);
    assert.ok(Buffer.byteLength(repository.canonicalStringify(chunk), "utf8")
      <= repository.constants.snapshotChunkMaxBytes);
  });
  const beforeMap = itemChunkMap(sixtyBundle, "SNAPSHOT");
  const afterMap = itemChunkMap(sixtyOneBundle, "SNAPSHOT");
  Object.entries(beforeMap).forEach(([id, chunkId]) => assert.equal(afterMap[id], chunkId));

  const largeNotes = Array.from({ length: 30 }, (_, index) => snapshot(
    `large-${index}`,
    `2026-03-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    { note: "가".repeat(10_000) }
  ));
  const byteSplitBundle = repository.createHistoryBundle(
    { snapshots: largeNotes },
    { historyId: "history-large-notes", updatedAt: "2026-04-01T00:00:00Z" }
  );
  const byteChunks = byteSplitBundle.chunks.filter((chunk) => chunk.kind === "SNAPSHOT");
  assert.ok(byteChunks.length > 1);
  byteChunks.forEach((chunk) => {
    assert.ok(Buffer.byteLength(repository.canonicalStringify(chunk), "utf8")
      <= repository.constants.snapshotChunkMaxBytes);
  });

  assert.throws(
    () => repository.createHistoryBundle({
      snapshots: [snapshot("too-large", "2026-04-01T00:00:00Z", { note: "x".repeat(300_000) })]
    }, { historyId: "history-too-large" }),
    (error) => error.code === "SNAPSHOT_ITEM_TOO_LARGE"
  );
}

// Input ordering does not change the manifest or chunk layout, and flat data
// survives a chunks round trip exactly after canonical normalization.
const roundTripInput = {
  snapshots: [
    snapshot("s-feb", "2026-02-02T01:00:00Z", { note: "둘" }),
    snapshot("s-jan", "2026-01-01T01:00:00Z", { note: "하나" })
  ],
  performanceObservations: [
    performance("p-feb", "2026-02-02", { navKRW: 1_200 }),
    performance("p-jan", "2026-01-01", { navKRW: 1_000 })
  ]
};

const roundTripBundle = repository.createHistoryBundle(roundTripInput, {
  historyId: "history-roundtrip",
  updatedAt: "2026-08-19T00:00:00Z"
});

{
  const reversed = repository.createHistoryBundle({
    snapshots: [...roundTripInput.snapshots].reverse(),
    performanceObservations: [...roundTripInput.performanceObservations].reverse()
  }, {
    historyId: "history-roundtrip",
    updatedAt: "2026-08-19T00:00:00Z"
  });
  assert.deepEqual(reversed, roundTripBundle);
  assert.deepEqual(repository.restoreHistory(roundTripBundle), repository.normalizeHistory(roundTripInput));
  assert.equal(repository.validateHistoryBundle(roundTripBundle).ok, true);
  assert.match(roundTripBundle.manifest.contentFingerprint, /^history-v1:[a-f0-9]{64}$/);
  roundTripBundle.chunks.forEach((chunk) => assert.match(chunk.digest, /^history-chunk-v1:[a-f0-9]{64}$/));
}

// The documented maximum survives a full flat -> chunks -> flat round trip
// for both lists. The next item fails closed at both input and manifest
// boundaries instead of being silently truncated.
const stressStart = Date.UTC(1990, 0, 1);
const stressDate = (index) => new Date(stressStart + index * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
const maximumSnapshots = Array.from({ length: repository.constants.snapshotMaxItems }, (_, index) => (
  snapshot(`maximum-snapshot-${index}`, `${stressDate(index)}T12:00:00.000Z`, { total: index })
));
const maximumPerformance = Array.from({ length: repository.constants.performanceMaxItems }, (_, index) => (
  performance(`maximum-performance-${index}`, stressDate(index), { navKRW: index })
));
const maximumHistory = {
  snapshots: maximumSnapshots,
  performanceObservations: maximumPerformance
};
const maximumBundle = repository.createHistoryBundle(maximumHistory, {
  historyId: "history-maximum",
  updatedAt: "2026-08-19T00:00:00Z"
});

{
  const restored = repository.restoreHistory(maximumBundle);
  assert.deepEqual(restored, repository.normalizeHistory(maximumHistory));
  assert.equal(maximumBundle.manifest.snapshotCount, repository.constants.snapshotMaxItems);
  assert.equal(maximumBundle.manifest.performanceCount, repository.constants.performanceMaxItems);
  maximumBundle.chunks.forEach((chunk) => {
    if (chunk.kind === "PERFORMANCE") {
      assert.ok(chunk.itemCount <= repository.constants.performanceChunkMaxItems);
    } else {
      assert.ok(chunk.itemCount <= repository.constants.snapshotChunkMaxItems);
      assert.ok(Buffer.byteLength(repository.canonicalStringify(chunk), "utf8")
        <= repository.constants.snapshotChunkMaxBytes);
    }
  });

  assert.throws(
    () => repository.createHistoryBundle({
      snapshots: [
        ...maximumSnapshots,
        snapshot("maximum-snapshot-overflow", `${stressDate(maximumSnapshots.length)}T12:00:00.000Z`)
      ]
    }),
    (error) => error.code === "SNAPSHOT_LIMIT_EXCEEDED"
  );
  assert.throws(
    () => repository.createHistoryBundle({
      performanceObservations: [
        ...maximumPerformance,
        performance("maximum-performance-overflow", stressDate(maximumPerformance.length))
      ]
    }),
    (error) => error.code === "PERFORMANCE_LIMIT_EXCEEDED"
  );

  const oversizedSnapshotManifest = clone(roundTripBundle);
  oversizedSnapshotManifest.manifest.snapshotCount = repository.constants.snapshotMaxItems + 1;
  assert.throws(
    () => repository.restoreHistory(oversizedSnapshotManifest),
    (error) => error.code === "SNAPSHOT_LIMIT_EXCEEDED"
  );
  const oversizedPerformanceManifest = clone(roundTripBundle);
  oversizedPerformanceManifest.manifest.performanceCount = repository.constants.performanceMaxItems + 1;
  assert.throws(
    () => repository.restoreHistory(oversizedPerformanceManifest),
    (error) => error.code === "PERFORMANCE_LIMIT_EXCEEDED"
  );
}

// A modified or incomplete generation is rejected before it can be activated.
{
  const tampered = clone(roundTripBundle);
  tampered.chunks[0].items[0].navKRW = 9_999;
  assert.throws(
    () => repository.restoreHistory(tampered),
    (error) => error.code === "CHUNK_DIGEST_MISMATCH"
  );
  const missing = clone(roundTripBundle);
  missing.chunks.pop();
  assert.throws(
    () => repository.restoreHistory(missing),
    (error) => error.code === "MANIFEST_CHUNK_COUNT_MISMATCH"
  );
  const result = repository.validateHistoryBundle(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "CHUNK_DIGEST_MISMATCH");

  const unsignedExtra = clone(roundTripBundle);
  unsignedExtra.chunks[0].unverified = "must not survive";
  assert.throws(
    () => repository.restoreHistory(unsignedExtra),
    (error) => error.code === "INVALID_CHUNK_FIELDS"
  );
}

// The in-memory adapter models local two-phase persistence: a verified bundle
// is staged first, then its generation pointer is activated atomically.
{
  const adapter = repository.createMemoryHistoryAdapter();
  const scope = "finance-ledger-retirement-v1:user-a";
  await adapter.writeBundle(scope, roundTripBundle);
  assert.equal(await adapter.getActiveHistoryId(scope), null);
  assert.equal(await adapter.readActiveBundle(scope), null);
  await adapter.setActiveHistoryId(scope, "history-roundtrip");
  assert.equal(await adapter.getActiveHistoryId(scope), "history-roundtrip");
  assert.deepEqual(await adapter.readActiveBundle(scope), roundTripBundle);

  const callerCopy = await adapter.readBundle(scope, "history-roundtrip");
  callerCopy.manifest.snapshotCount = 999;
  assert.equal((await adapter.readBundle(scope, "history-roundtrip")).manifest.snapshotCount, 2);
  assert.equal(await adapter.getActiveHistoryId("finance-ledger-retirement-v1:user-b"), null);
  await assert.rejects(
    adapter.deleteBundle(scope, "history-roundtrip"),
    (error) => error.code === "ACTIVE_HISTORY_DELETE_BLOCKED"
  );

  const empty = repository.createHistoryBundle({}, {
    historyId: "history-empty",
    updatedAt: "2026-08-20T00:00:00Z"
  });
  await adapter.writeBundle(scope, empty);
  assert.equal(await adapter.getActiveHistoryId(scope), "history-roundtrip");
  await adapter.setActiveHistoryId(scope, "history-empty");
  await adapter.deleteBundle(scope, "history-roundtrip");
  assert.equal(await adapter.readBundle(scope, "history-roundtrip"), null);
  await adapter.clearScope(scope);
  assert.equal(await adapter.getActiveHistoryId(scope), null);
}

// IndexedDB absence is explicit so callers can block writes instead of silently
// dropping long-term history into a smaller localStorage fallback.
{
  assert.throws(
    () => repository.createIndexedDbHistoryAdapter({ indexedDB: null }),
    (error) => error.code === "INDEXEDDB_UNAVAILABLE"
  );
}

// The production IndexedDB adapter upgrades a new database, persists the
// maximum bundle across close/reopen, replaces a generation without stale
// chunks, and never deletes the active generation.
{
  const indexedDB = new IDBFactory();
  const databaseName = "assettrail-history-v1-integration";
  const scope = "finance-ledger-retirement-v1:indexeddb-integration";
  let adapter = repository.createIndexedDbHistoryAdapter({ indexedDB, databaseName });

  await adapter.writeBundle(scope, maximumBundle);
  assert.equal(await adapter.getActiveHistoryId(scope), null);
  assert.equal((await adapter.readBundle(scope, "history-maximum")).manifest.snapshotCount, 10_000);
  await adapter.setActiveHistoryId(scope, "history-maximum");
  await adapter.close();

  adapter = repository.createIndexedDbHistoryAdapter({ indexedDB, databaseName });
  const reopenedMaximum = await adapter.readActiveBundle(scope);
  const reopenedHistory = repository.restoreHistory(reopenedMaximum);
  assert.equal(reopenedHistory.snapshots.length, 10_000);
  assert.equal(reopenedHistory.performanceObservations.length, 10_000);
  await assert.rejects(
    adapter.deleteBundle(scope, "history-maximum"),
    (error) => error.code === "ACTIVE_HISTORY_DELETE_BLOCKED"
  );

  const replacement = repository.createHistoryBundle({
    snapshots: [snapshot("replacement-snapshot", "2026-08-20T00:00:00Z")]
  }, {
    historyId: "history-maximum",
    updatedAt: "2026-08-20T00:00:00Z"
  });
  await adapter.writeBundle(scope, replacement);
  assert.deepEqual(await adapter.readActiveBundle(scope), replacement);
  await adapter.close();

  adapter = repository.createIndexedDbHistoryAdapter({ indexedDB, databaseName });
  assert.deepEqual(await adapter.readActiveBundle(scope), replacement);
  const nextGeneration = repository.createHistoryBundle({}, {
    historyId: "history-next",
    updatedAt: "2026-08-21T00:00:00Z"
  });
  await adapter.writeBundle(scope, nextGeneration);
  await adapter.setActiveHistoryId(scope, "history-next");
  await adapter.deleteBundle(scope, "history-maximum");
  assert.equal(await adapter.readBundle(scope, "history-maximum"), null);
  await adapter.clearScope(scope);
  assert.equal(await adapter.getActiveHistoryId(scope), null);
  await adapter.close();
}

console.log("history repository tests passed");
