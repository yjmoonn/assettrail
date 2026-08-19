import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appSource = readFileSync("app.js", "utf8");
const engineSource = [
  "decision-engine.js",
  "action-engine.js",
  "ledger-engine.js",
  "performance-engine.js",
  "history-repository.js",
  "ai-review-export-engine.js"
].map((path) => readFileSync(path, "utf8")).join("\n");

const FIXED_NOW = "2026-08-19T03:00:00.000Z";
const STORAGE_KEY = "finance-ledger-retirement-v1";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function canvasContext() {
  return {
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
  };
}

function installBrowserStubs(window, alerts) {
  const RealDate = window.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FIXED_NOW]));
    }

    static now() {
      return new RealDate(FIXED_NOW).getTime();
    }
  }

  window.Date = FixedDate;
  window.HTMLCanvasElement.prototype.getContext = canvasContext;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
  window.URL.createObjectURL = () => "blob:history-race-test";
  window.URL.revokeObjectURL = () => {};
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.console.error = () => {};
  window.console.warn = () => {};
  window.firebaseConfig = {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: FIXED_NOW,
      fx: {},
      prices: { KRX: {}, US: {} },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  });
}

async function waitUntil(window, predicate, message) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

async function createHarness() {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://yjmoonn.github.io/assettrail/"
  });
  const { window } = dom;
  const alerts = [];
  installBrowserStubs(window, alerts);
  window.indexedDB = {};
  window.eval(engineSource);

  const memoryAdapter = window.AssetTrailHistoryRepository.createMemoryHistoryAdapter();
  const fault = { behavior: null, calls: 0 };
  const adapter = {
    async writeBundle(scope, bundle) {
      if (fault.behavior) {
        fault.calls += 1;
        await fault.behavior({ adapter: memoryAdapter, bundle, call: fault.calls, scope });
      }
      return memoryAdapter.writeBundle(scope, bundle);
    },
    readBundle: (...args) => memoryAdapter.readBundle(...args),
    setActiveHistoryId: (...args) => memoryAdapter.setActiveHistoryId(...args),
    getActiveHistoryId: (...args) => memoryAdapter.getActiveHistoryId(...args),
    readActiveBundle: (...args) => memoryAdapter.readActiveBundle(...args),
    deleteBundle: (...args) => memoryAdapter.deleteBundle(...args),
    clearScope: (...args) => memoryAdapter.clearScope(...args),
    close() {}
  };
  window.assetTrailHistoryAdapterFactory = () => adapter;

  window.eval(`${appSource}
    let uploadProbe = null;
    window.__historyRaceTestApi = {
      ready() {
        return historyStorage.ready && !historyStorage.blocked;
      },
      makeState(assetId, note = "") {
        const next = defaultState();
        next.assets = [normalizeAsset({
          id: assetId,
          name: assetId,
          type: "CASH",
          account: "probe",
          amount: 100,
          quantity: 0,
          averagePrice: 0
        })];
        if (note) {
          next.snapshots = [normalizeSnapshot({
            id: "snapshot-" + note,
            createdAt: "2026-08-01T00:00:00.000Z",
            total: 100,
            note,
            source: "QUICK_SNAPSHOT",
            typeTotals: { CASH: 100 }
          })];
        }
        return JSON.parse(JSON.stringify(next));
      },
      async switchScope(uid, next) {
        cloud.authGeneration += 1;
        cloud.user = { uid, email: uid + "@test" };
        cloud.docRef = { uid };
        cloud.conflictPending = false;
        activeStorageKey = STORAGE_KEY + ":user:" + uid;
        storageWritesBlocked = false;
        protectedStorageRaw = null;
        localStorage.setItem(activeStorageKey, JSON.stringify(next));
        const loaded = loadState(activeStorageKey);
        replaceState(loaded.state);
        await initializeLocalHistoryStorage(loaded, activeStorageKey);
        render(false);
        return !historyStorage.blocked;
      },
      context() {
        return captureCloudContext();
      },
      commit(data, context) {
        return commitDownloadedStateLocally(data, context);
      },
      edit(assetId) {
        state.assets = [normalizeAsset({
          id: assetId,
          name: assetId,
          type: "CASH",
          account: "probe",
          amount: 200,
          quantity: 0,
          averagePrice: 0
        })];
        render(false);
      },
      configureRemote(data) {
        const snapshot = {
          exists: () => true,
          data: () => JSON.parse(JSON.stringify(data))
        };
        cloud.getDoc = async () => snapshot;
        cloud.collection = () => ({});
        cloud.getDocs = async () => ({ forEach() {} });
        window.assetTrailCloudConflictResolver = async () => "download";
      },
      pull() {
        return pullCloudData({ context: captureCloudContext() });
      },
      assetId() {
        return state.assets[0]?.id || null;
      },
      conflictPending() {
        return cloud.conflictPending;
      },
      async saveMonthly(note) {
        els.dashboardMonthlyConclusion.value = note;
        els.dashboardNextReviewDate.value = "2026-09-20";
        return saveAssetSnapshot({ monthlyReview: true });
      },
      snapshotNotes() {
        return state.snapshots.map((snapshot) => snapshot.note);
      },
      blocked() {
        return historyStorage.blocked;
      },
      async flush() {
        return flushHistoryPersistence();
      },
      async activeNotes() {
        const bundle = await historyStorage.adapter.readActiveBundle(activeStorageKey);
        if (!bundle) return null;
        return window.AssetTrailHistoryRepository.restoreHistory(bundle).snapshots
          .map((snapshot) => snapshot.note);
      },
      async primaryPointer() {
        const raw = localStorage.getItem(activeStorageKey);
        const primary = raw ? JSON.parse(raw) : null;
        const historyId = primary?.historyMeta?.activeHistoryId || null;
        return {
          historyId,
          pointsToExistingBundle: Boolean(historyId
            && await historyStorage.adapter.readBundle(activeStorageKey, historyId))
        };
      },
      clickUndo() {
        els.appNotice?.querySelector("button")?.click();
      },
      notice() {
        return {
          hidden: els.appNotice.hidden,
          text: els.appNotice.textContent.trim(),
          hasButton: Boolean(els.appNotice.querySelector("button"))
        };
      },
      configureUpload(controller) {
        uploadProbe = {
          chunks: new Map(),
          primary: null,
          transactions: 0
        };
        let historyReadPaused = false;
        cloud.db = {};
        cloud.docRef = { path: "users/user/financeData/primary" };
        cloud.doc = (_db, ...path) => ({ path: path.join("/") });
        cloud.collection = (_db, ...path) => ({ path: path.join("/") });
        cloud.getDoc = async (ref) => ({
          exists: () => ref.path === cloud.docRef.path && Boolean(uploadProbe.primary),
          data: () => uploadProbe.primary
            ? window.JSON.parse(JSON.stringify(uploadProbe.primary))
            : null
        });
        cloud.getDocs = async (ref) => {
          if (controller.pauseAtHistoryRead && !historyReadPaused && ref.path.includes("/histories/")) {
            historyReadPaused = true;
            controller.started();
            await controller.wait();
          }
          return {
            forEach(callback) {
              for (const [path, data] of uploadProbe.chunks) {
                if (!path.startsWith(ref.path + "/")) continue;
                callback({
                  id: path.split("/").at(-1),
                  data: () => window.JSON.parse(JSON.stringify(data))
                });
              }
            }
          };
        };
        cloud.setDoc = async (ref, data) => {
          uploadProbe.chunks.set(ref.path, JSON.parse(JSON.stringify(data)));
        };
        cloud.deleteDoc = async (ref) => {
          uploadProbe.chunks.delete(ref.path);
        };
        cloud.runTransaction = async (_db, callback) => {
          const staged = [];
          const transaction = {
            get: async () => ({
              exists: () => Boolean(uploadProbe.primary),
              data: () => uploadProbe.primary
                ? JSON.parse(JSON.stringify(uploadProbe.primary))
                : null
            }),
            set: (ref, data) => staged.push({
              ref,
              data: JSON.parse(JSON.stringify(data))
            })
          };
          const payload = await callback(transaction);
          uploadProbe.transactions += 1;
          if (uploadProbe.transactions === 1 && !controller.pauseAtHistoryRead) {
            controller.started();
            await controller.wait();
          }
          staged.forEach((item) => {
            if (item.ref.path === cloud.docRef.path) uploadProbe.primary = item.data;
            else uploadProbe.chunks.set(item.ref.path, item.data);
          });
          return payload;
        };
        cloud.knownEventIds = new Set();
        cloud.activeHistoryMeta = null;
        cloud.lastPushedFingerprint = null;
        cloud.conflictPending = false;
        cloud.schemaBlocked = false;
      },
      push() {
        return pushCloudData("save", { context: captureCloudContext() });
      },
      flushPush() {
        return flushCloudPush();
      },
      async editDuringUpload() {
        state.assets = [normalizeAsset({
          id: "after-asset",
          name: "after-asset",
          type: "CASH",
          account: "probe",
          amount: 200,
          quantity: 0,
          averagePrice: 0
        })];
        state.snapshots = [normalizeSnapshot({
          id: "monthly",
          createdAt: "2026-08-19T03:00:00.000Z",
          total: 200,
          note: "after-note",
          source: "MONTHLY_REVIEW",
          nextReviewAt: "2026-09-20",
          typeTotals: { CASH: 200 }
        })];
        if (!persist()) return false;
        return flushHistoryPersistence();
      },
      uploadReport() {
        const historyMeta = normalizeHistoryMeta(uploadProbe.primary?.historyMeta);
        let history = {
          snapshots: uploadProbe.primary?.snapshots || [],
          performanceObservations: uploadProbe.primary?.performanceObservations || []
        };
        if (historyMeta) {
          const chunks = [...uploadProbe.chunks.values()]
            .filter((chunk) => chunk.historyId === historyMeta.activeHistoryId);
          history = window.AssetTrailHistoryRepository.restoreHistory({
            manifest: {
              schemaVersion: historyMeta.schemaVersion,
              historyId: historyMeta.activeHistoryId,
              snapshotCount: historyMeta.snapshotCount,
              performanceCount: historyMeta.performanceCount,
              chunkCount: historyMeta.chunkCount,
              contentFingerprint: historyMeta.contentFingerprint,
              updatedAt: historyMeta.updatedAt
            },
            chunks
          });
        }
        const remote = {
          ...uploadProbe.primary,
          snapshots: history.snapshots,
          performanceObservations: history.performanceObservations
        };
        const local = storageSafeState();
        return {
          lastMatchesLocal: cloud.lastPushedFingerprint === dataFingerprint(local),
          localAsset: local.assets[0]?.id || null,
          localNotes: local.snapshots.map((snapshot) => snapshot.note),
          remoteAsset: remote.assets?.[0]?.id || null,
          remoteNotes: remote.snapshots.map((snapshot) => snapshot.note),
          sameFingerprint: dataFingerprint(remote) === dataFingerprint(local),
          pushPending: cloudPushPending,
          transactions: uploadProbe.transactions
        };
      }
    };
  `);

  await waitUntil(window, () => window.__historyRaceTestApi.ready(), "history bootstrap timed out");
  return { alerts, dom, fault, api: window.__historyRaceTestApi, window };
}

// An in-flight Alice download must never commit after the app switches to Bob.
{
  const harness = await createHarness();
  const { api, fault } = harness;
  await api.switchScope("alice", api.makeState("alice-local"));
  const started = deferred();
  const release = deferred();
  fault.calls = 0;
  fault.behavior = async () => {
    started.resolve();
    await release.promise;
  };

  const context = api.context();
  const pending = api.commit(api.makeState("alice-remote", "remote"), context)
    .then(() => null, (error) => error);
  await started.promise;
  fault.behavior = null;
  await api.switchScope("bob", api.makeState("bob-local"));
  release.resolve();

  const error = await pending;
  assert.equal(error?.code, "assettrail/cloud-context-changed");
  assert.equal(api.assetId(), "bob-local");
  assert.deepEqual(plain(await api.activeNotes()), []);
  assert.equal((await api.primaryPointer()).pointsToExistingBundle, true);
  harness.dom.window.close();
}

// A local edit made while the same user's cloud history is staged wins and raises a conflict.
{
  const harness = await createHarness();
  const { api, fault } = harness;
  await api.switchScope("alice", api.makeState("alice-local"));
  const remote = api.makeState("remote", "remote");
  remote.revision = 1;
  remote.updatedAt = "2026-08-19T02:00:00.000Z";
  api.configureRemote(remote);
  const started = deferred();
  const release = deferred();
  fault.calls = 0;
  fault.behavior = async () => {
    started.resolve();
    await release.promise;
  };

  const pending = api.pull();
  await started.promise;
  api.edit("just-added");
  release.resolve();

  assert.equal(await pending, false);
  assert.equal(api.assetId(), "just-added");
  assert.equal(api.conflictPending(), true);
  assert.deepEqual(plain(await api.activeNotes()), []);
  assert.equal((await api.primaryPointer()).pointsToExistingBundle, true);
  harness.dom.window.close();
}

// A failed first history write cancels the already queued follow-up save.
{
  const harness = await createHarness();
  const { api, fault } = harness;
  await api.switchScope("user", api.makeState("base"));
  const started = deferred();
  const release = deferred();
  fault.calls = 0;
  fault.behavior = async ({ call }) => {
    if (call !== 1) return;
    started.resolve();
    await release.promise;
    throw new Error("first write fails");
  };

  const first = api.saveMonthly("first");
  await started.promise;
  const second = api.saveMonthly("second");
  release.resolve();

  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  await api.flush();
  assert.deepEqual(plain(api.snapshotNotes()), []);
  assert.deepEqual(plain(await api.activeNotes()), []);
  assert.equal((await api.primaryPointer()).pointsToExistingBundle, true);
  assert.equal(api.blocked(), true);
  harness.dom.window.close();
}

// If a queued successor fails, rollback targets the immediately preceding successful generation.
{
  const harness = await createHarness();
  const { api, fault } = harness;
  await api.switchScope("user", api.makeState("base"));
  const started = deferred();
  const release = deferred();
  fault.calls = 0;
  fault.behavior = async ({ call }) => {
    if (call === 1) {
      started.resolve();
      await release.promise;
    }
    if (call === 2) throw new Error("second write fails");
  };

  const first = api.saveMonthly("first");
  await started.promise;
  const second = api.saveMonthly("second");
  release.resolve();

  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  await api.flush();
  assert.deepEqual(plain(api.snapshotNotes()), ["first"]);
  assert.deepEqual(plain(await api.activeNotes()), ["first"]);
  assert.equal((await api.primaryPointer()).pointsToExistingBundle, true);
  assert.equal(api.blocked(), true);
  harness.dom.window.close();
}

// A failed undo write leaves the previously durable snapshot active and keeps the warning visible.
{
  const harness = await createHarness();
  const { alerts, api, fault, window } = harness;
  await api.switchScope("user", api.makeState("base"));
  assert.equal(await api.saveMonthly("saved"), true);
  fault.calls = 0;
  fault.behavior = async () => {
    throw new Error("undo write fails");
  };

  api.clickUndo();
  await waitUntil(window, () => api.blocked(), "undo failure was not observed");
  await api.flush();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.deepEqual(plain(api.snapshotNotes()), ["saved"]);
  assert.deepEqual(plain(await api.activeNotes()), ["saved"]);
  assert.equal((await api.primaryPointer()).pointsToExistingBundle, true);
  assert.equal(api.blocked(), true);
  assert.equal(api.notice().hidden, false);
  assert.equal(api.notice().hasButton, false);
  assert.match(api.notice().text, /자동 저장을 중단했습니다/);
  assert.deepEqual(alerts, ["되돌린 기록을 저장하지 못해 직전 상태를 유지했습니다."]);
  harness.dom.window.close();
}

// An edit made while a cloud history generation is verified must not mix new primary data with old history.
{
  const harness = await createHarness();
  const { api } = harness;
  await api.switchScope("user", api.makeState("before-asset", "before-note"));
  const started = deferred();
  const release = deferred();
  api.configureUpload({
    pauseAtHistoryRead: true,
    started: () => started.resolve(),
    wait: () => release.promise
  });

  const first = api.push();
  await started.promise;
  assert.equal(await api.editDuringUpload(), true);
  release.resolve();
  assert.equal(await first, true);

  let report = plain(api.uploadReport());
  assert.equal(report.transactions, 1);
  assert.equal(report.remoteAsset, "before-asset");
  assert.deepEqual(report.remoteNotes, ["before-note"]);
  assert.equal(report.localAsset, "after-asset");
  assert.deepEqual(report.localNotes, ["after-note"]);
  assert.equal(report.sameFingerprint, false);
  assert.equal(report.lastMatchesLocal, false);
  assert.equal(report.pushPending, true);

  await api.flushPush();
  report = plain(api.uploadReport());
  assert.equal(report.transactions, 2);
  assert.equal(report.remoteAsset, "after-asset");
  assert.deepEqual(report.remoteNotes, ["after-note"]);
  assert.equal(report.sameFingerprint, true);
  assert.equal(report.lastMatchesLocal, true);
  assert.equal(report.pushPending, false);
  harness.dom.window.close();
}

// An edit made after an upload payload is captured must force a follow-up push.
{
  const harness = await createHarness();
  const { api } = harness;
  await api.switchScope("user", api.makeState("before-asset", "before-note"));
  const started = deferred();
  const release = deferred();
  api.configureUpload({
    started: () => started.resolve(),
    wait: () => release.promise
  });

  const first = api.push();
  await started.promise;
  assert.equal(await api.editDuringUpload(), true);
  release.resolve();
  assert.equal(await first, true);

  let report = plain(api.uploadReport());
  assert.equal(report.transactions, 1);
  assert.equal(report.remoteAsset, "before-asset");
  assert.deepEqual(report.remoteNotes, ["before-note"]);
  assert.equal(report.localAsset, "after-asset");
  assert.deepEqual(report.localNotes, ["after-note"]);
  assert.equal(report.sameFingerprint, false);
  assert.equal(report.lastMatchesLocal, false);

  assert.equal(await api.push(), true);
  report = plain(api.uploadReport());
  assert.equal(report.transactions, 2);
  assert.equal(report.remoteAsset, "after-asset");
  assert.deepEqual(report.remoteNotes, ["after-note"]);
  assert.equal(report.sameFingerprint, true);
  assert.equal(report.lastMatchesLocal, true);
  harness.dom.window.close();
}

console.log("app history transaction race tests passed");
