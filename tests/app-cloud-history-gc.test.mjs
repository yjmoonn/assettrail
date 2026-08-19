import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const repository = require("../history-repository.js");
const html = readFileSync("index.html", "utf8");
const appCode = [
  readFileSync("ledger-engine.js", "utf8"),
  readFileSync("history-repository.js", "utf8"),
  readFileSync("app.js", "utf8")
].join("\n");

function snapshot(id, createdAt, total) {
  return { id, createdAt, total, note: "", typeTotals: { CASH: total } };
}

function historyMeta(bundle) {
  const { historyId, ...manifest } = bundle.manifest;
  return { ...manifest, activeHistoryId: historyId };
}

function remoteState(bundle, revision = 3) {
  return {
    schemaVersion: 7,
    assets: [],
    decisionProfiles: [],
    watchlist: [],
    realizedTrades: [],
    tradeJournalEntries: [],
    ledgerMeta: {
      activeLedgerId: "ledger-test",
      baselineDate: null,
      eventCount: 0,
      eventFingerprint: ""
    },
    historyMeta: historyMeta(bundle),
    meta: { cloudRevision: revision, lastSavedAt: "2026-08-01T00:00:00.000Z" },
    portfolioTargets: {},
    policyProfile: {},
    contributionPlan: {},
    retirementScenarios: [],
    retirement: {},
    revision,
    updatedAt: "2026-08-01T00:00:00.000Z"
  };
}

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "https://yjmoonn.github.io/assettrail/"
});
const { window } = dom;
window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {},
  beginPath() {},
  clearRect() {},
  closePath() {},
  createLinearGradient: () => ({ addColorStop() {} }),
  fill() {},
  fillRect() {},
  fillText() {},
  lineTo() {},
  measureText: (text) => ({ width: String(text).length * 7 }),
  moveTo() {},
  rect() {},
  restore() {},
  roundRect() {},
  save() {},
  setLineDash() {},
  setTransform() {},
  stroke() {},
  strokeRect() {}
});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = () => {};
window.confirm = () => true;
window.fetch = async () => ({
  ok: true,
  json: async () => ({ generatedAt: "2026-08-01T00:00:00.000Z", fx: {}, prices: { KRX: {}, US: {} }, errors: [] })
});
window.firebaseConfig = {};
window.eval(appCode + "\n" + String.raw`
  window.__cloudHistoryGcTest = {
    reset(input) {
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const config = clone(input);
      const primaryPath = "users/alice/financeData/primary";
      const documents = new Map();
      const operations = [];
      const warnings = [];
      let remote = clone(config.remote);
      let transactionCalls = 0;
      let corruptReadApplied = false;
      let resumeHistoryPersistence = null;

      const addBundle = (bundle) => {
        bundle.chunks.forEach((chunk) => {
          documents.set(
            primaryPath + "/histories/" + bundle.manifest.historyId + "/chunks/" + chunk.chunkId,
            clone(chunk)
          );
        });
      };
      addBundle(config.oldBundle);
      (config.otherBundles || []).forEach(addBundle);
      (config.backups || []).forEach((backup) => {
        documents.set(primaryPath + "/backups/" + backup.id, clone(backup.payload));
      });

      const snapshotFor = (data, exists = true) => ({
        exists: () => exists,
        data: () => clone(data)
      });
      const setStoredDocument = (ref, data) => {
        const saved = clone(data);
        if (ref.path === primaryPath) remote = saved;
        else documents.set(ref.path, saved);
      };

      state.snapshots = (config.localHistory.snapshots || []).map(normalizeSnapshot);
      state.performanceObservations = (config.localHistory.performanceObservations || []).map(normalizePerformanceObservation);
      state.events = [];
      state.meta.cloudRevision = Number(remote.revision || 0);
      state.ledgerMeta.activeLedgerId = "ledger-test";
      historyStorage = {
        ...historyStorage,
        adapter: null,
        blocked: false,
        fallback: true,
        manifest: null,
        pending: Promise.resolve(),
        queuedFingerprint: null,
        ready: true,
        savedHistory: { snapshots: [], performanceObservations: [] },
        savedFingerprint: null,
        scope: "finance-ledger-retirement-v1:user:alice"
      };
      activeStorageKey = historyStorage.scope;
      cloud.authGeneration += 1;
      cloud.db = { name: "test" };
      cloud.doc = (_db, ...path) => ({ path: path.join("/") });
      cloud.collection = (_db, ...path) => ({ path: path.join("/") });
      cloud.getDoc = async (ref) => {
        operations.push({ type: "get", path: ref.path });
        if (ref.path === primaryPath) return snapshotFor(remote);
        return documents.has(ref.path)
          ? snapshotFor(documents.get(ref.path))
          : snapshotFor(undefined, false);
      };
      cloud.getDocs = async (ref) => {
        operations.push({ type: "getDocs", path: ref.path });
        const matches = [];
        for (const [path, data] of documents) {
          if (!path.startsWith(ref.path + "/")) continue;
          if (config.corruptStagedRead
              && !corruptReadApplied
              && ref.path.includes("/histories/")
              && !ref.path.includes("/histories/" + config.oldBundle.manifest.historyId + "/")) {
            corruptReadApplied = true;
            continue;
          }
          matches.push({ path, data: clone(data) });
        }
        return {
          forEach(callback) {
            matches.forEach(({ path, data }) => {
              callback({ id: path.split("/").at(-1), data: () => clone(data) });
            });
          }
        };
      };
      cloud.setDoc = async (ref, data) => {
        operations.push({ type: "stage", path: ref.path });
        setStoredDocument(ref, data);
      };
      cloud.deleteDoc = async (ref) => {
        operations.push({ type: "delete", path: ref.path });
        if (config.failDelete) throw new Error("simulated history delete failure");
        documents.delete(ref.path);
      };
      cloud.runTransaction = async (_db, update) => {
        transactionCalls += 1;
        const pending = [];
        const result = await update({
          get: async (ref) => (ref.path === primaryPath
            ? snapshotFor(remote)
            : documents.has(ref.path)
              ? snapshotFor(documents.get(ref.path))
              : snapshotFor(undefined, false)),
          set: (ref, data, options) => pending.push({ ref, data: clone(data), options })
        });
        pending.forEach(({ ref, data }) => {
          operations.push({ type: "commit", path: ref.path });
          setStoredDocument(ref, data);
        });
        return result;
      };
      cloud.user = { uid: "alice", email: "alice@example.com" };
      cloud.docRef = { path: primaryPath };
      cloud.enabled = true;
      cloud.ready = true;
      cloud.knownEventIds = new Set();
      cloud.activeHistoryMeta = normalizeHistoryMeta(remote.historyMeta);
      cloud.lastPushedFingerprint = null;
      cloud.schemaBlocked = false;
      storageWritesBlocked = false;
      window.console.warn = (...args) => warnings.push(args.map(String).join(" "));

      window.__gcScenario = {
        context: captureCloudContext(),
        documents,
        get remote() { return remote; },
        get transactionCalls() { return transactionCalls; },
        operations,
        warnings,
        setResume(callback) { resumeHistoryPersistence = callback; },
        resume() {
          if (resumeHistoryPersistence) resumeHistoryPersistence();
        }
      };
    },
    async write(options = {}) {
      return writeCloudState({ ...options, context: window.__gcScenario.context });
    },
    pauseHistoryPersistence() {
      historyStorage.pending = new Promise((resolve) => window.__gcScenario.setResume(resolve));
    },
    push() {
      return pushCloudDataForContext("save", { context: window.__gcScenario.context });
    },
    switchUser(uid) {
      cloud.authGeneration += 1;
      cloud.user = { uid };
      cloud.docRef = { path: "users/" + uid + "/financeData/primary" };
      activeStorageKey = "finance-ledger-retirement-v1:user:" + uid;
    },
    resumeHistoryPersistence() {
      window.__gcScenario.resume();
    },
    inspect() {
      const scenario = window.__gcScenario;
      return JSON.parse(JSON.stringify({
        remote: scenario.remote,
        documents: [...scenario.documents.entries()],
        operations: scenario.operations,
        transactionCalls: scenario.transactionCalls,
        warnings: scenario.warnings
      }));
    }
  };
`);

const oldBundle = repository.createHistoryBundle({
  snapshots: [snapshot("old-snapshot", "2026-07-01T00:00:00.000Z", 1_000)]
}, {
  historyId: "history-old",
  updatedAt: "2026-07-01T00:00:00.000Z"
});
const unrelatedBundle = repository.createHistoryBundle({
  snapshots: [snapshot("unrelated-snapshot", "2026-06-01T00:00:00.000Z", 900)]
}, {
  historyId: "history-unrelated",
  updatedAt: "2026-06-01T00:00:00.000Z"
});
const localHistory = {
  snapshots: [snapshot("new-snapshot", "2026-08-01T00:00:00.000Z", 1_200)],
  performanceObservations: []
};

function reset(extra = {}) {
  window.__cloudHistoryGcTest.reset({
    remote: remoteState(oldBundle),
    oldBundle,
    otherBundles: [unrelatedBundle],
    localHistory,
    ...extra
  });
}

function documentPaths(result) {
  return result.documents.map(([path]) => path);
}

// An ordinary save verifies a fresh generation, commits it, then deletes only the previous generation.
reset();
const ordinaryPayload = await window.__cloudHistoryGcTest.write();
const ordinary = window.__cloudHistoryGcTest.inspect();
assert.notEqual(ordinaryPayload.historyMeta.activeHistoryId, oldBundle.manifest.historyId);
assert.equal(ordinary.remote.historyMeta.activeHistoryId, ordinaryPayload.historyMeta.activeHistoryId);
assert.equal(documentPaths(ordinary).some((path) => path.includes("/histories/history-old/chunks/")), false);
assert.equal(documentPaths(ordinary).some((path) => path.includes("/histories/history-unrelated/chunks/")), true);
assert.equal(documentPaths(ordinary).some((path) => path.includes("/histories/" + ordinaryPayload.historyMeta.activeHistoryId + "/chunks/")), true);
assert.ok(
  ordinary.operations.findIndex((item) => item.type === "commit" && item.path.endsWith("/primary"))
    < ordinary.operations.findIndex((item) => item.type === "delete"),
  "previous chunks may only be deleted after the primary pointer commits"
);

// A backup that points at the previous generation protects every one of its chunks.
reset({
  backups: [{
    id: "conflict-v7-revision-2",
    payload: {
      sourceSchemaVersion: 7,
      sourceRevision: 2,
      reason: "FORCED_CONFLICT_UPLOAD",
      createdAt: "2026-07-01T00:00:00.000Z",
      state: remoteState(oldBundle, 2)
    }
  }]
});
await window.__cloudHistoryGcTest.write();
const protectedByBackup = window.__cloudHistoryGcTest.inspect();
assert.equal(documentPaths(protectedByBackup).some((path) => path.includes("/histories/history-old/chunks/")), true);
assert.equal(protectedByBackup.operations.some((item) => item.type === "delete"), false);

// Forced overwrite creates an immutable backup and never garbage-collects its referenced generation.
reset();
const forcedPayload = await window.__cloudHistoryGcTest.write({ expectedRemoteRevision: 3 });
const forced = window.__cloudHistoryGcTest.inspect();
assert.notEqual(forcedPayload.historyMeta.activeHistoryId, oldBundle.manifest.historyId);
assert.equal(documentPaths(forced).some((path) => path.includes("/backups/conflict-v7-revision-3")), true);
assert.equal(documentPaths(forced).some((path) => path.includes("/histories/history-old/chunks/")), true);
assert.equal(forced.operations.some((item) => item.type === "delete"), false);

// Cleanup is best-effort: deletion failure cannot reject or roll back the committed primary save.
reset({ failDelete: true });
const failurePayload = await window.__cloudHistoryGcTest.write();
const failedCleanup = window.__cloudHistoryGcTest.inspect();
assert.equal(failedCleanup.remote.historyMeta.activeHistoryId, failurePayload.historyMeta.activeHistoryId);
assert.equal(documentPaths(failedCleanup).some((path) => path.includes("/histories/history-old/chunks/")), true);
assert.equal(failedCleanup.warnings.some((message) => message.includes("정리하지 못했습니다")), true);

// Missing or corrupt read-back data blocks the pointer transaction and preserves the active generation.
reset({ corruptStagedRead: true });
await assert.rejects(
  window.__cloudHistoryGcTest.write(),
  (error) => error?.code === "assettrail/cloud-history-incomplete"
);
const corruptStage = window.__cloudHistoryGcTest.inspect();
assert.equal(corruptStage.transactionCalls, 0);
assert.equal(corruptStage.remote.historyMeta.activeHistoryId, oldBundle.manifest.historyId);
assert.equal(documentPaths(corruptStage).some((path) => path.includes("/histories/history-old/chunks/")), true);

// A user switch while local history is flushing cancels the captured context before any cloud transaction.
reset();
window.__cloudHistoryGcTest.pauseHistoryPersistence();
const pendingPush = window.__cloudHistoryGcTest.push();
window.__cloudHistoryGcTest.switchUser("bob");
window.__cloudHistoryGcTest.resumeHistoryPersistence();
assert.equal(await pendingPush, false);
assert.equal(window.__cloudHistoryGcTest.inspect().transactionCalls, 0);

dom.window.close();
console.log("cloud history GC tests passed");
