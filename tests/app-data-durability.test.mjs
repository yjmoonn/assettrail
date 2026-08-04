import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = readFileSync("app.js", "utf8");
const STORAGE_KEY = "finance-ledger-retirement-v1";

function installBrowserStubs(window, { alerts = [], downloads = [] } = {}) {
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
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push(this.download);
  };
  window.URL.createObjectURL = () => "blob:assettrail-test";
  window.URL.revokeObjectURL = () => {};
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.console.error = () => {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: "2026-07-30T00:00:00.000Z",
      fx: { USDKRW: { date: "2026-07-30", rate: 1300 } },
      prices: { KRX: {}, US: {} },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  });
}

function makeDom(url = "https://yjmoonn.github.io/assettrail/") {
  return new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url
  });
}

async function waitForApp(window, milliseconds = 30) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function dispatchImport(window, file) {
  const input = window.document.querySelector("#importInput");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file]
  });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitForApp(window);
}

function jsonFile(window, data, name = "assettrail.json") {
  const text = JSON.stringify(data);
  return {
    name,
    size: new window.Blob([text]).size,
    text: async () => text
  };
}

{
  const dom = makeDom();
  const { window } = dom;
  const alerts = [];
  const downloads = [];
  installBrowserStubs(window, { alerts, downloads });
  window.firebaseConfig = {};
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    assets: [{
      id: "legacy-cash",
      name: "비상금",
      type: "CASH",
      amount: 3000000,
      updatedAt: "2026-07-29T12:00:00.000Z"
    }],
    snapshots: [{
      id: "legacy-snapshot",
      createdAt: "2026-07-29T12:00:00.000Z",
      total: 3000000,
      note: "기존 전체 자산 복제",
      assets: [{ id: "duplicated", note: "저장하면 안 되는 전체 자산" }],
      typeTotals: { CASH: 3000000, UNKNOWN: 1 }
    }],
    retirement: {}
  }));

  window.eval(appCode);
  await waitForApp(window);

  const migrated = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.assets[0].updatedAt, "2026-07-29T12:00:00.000Z");
  assert.deepEqual(
    Object.keys(migrated.snapshots[0]).sort(),
    ["createdAt", "id", "note", "total", "typeTotals"]
  );
  assert.equal(migrated.snapshots[0].assets, undefined);
  assert.deepEqual(migrated.snapshots[0].typeTotals, { CASH: 3000000 });

  await dispatchImport(window, jsonFile(window, migrated, "round-trip-v2.json"));
  const roundTripped = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(roundTripped.schemaVersion, 2);
  assert.equal(roundTripped.assets[0].id, "legacy-cash");
  assert.equal(roundTripped.snapshots[0].id, "legacy-snapshot");
  assert.equal(downloads.length, 1);

  const storagePrototype = Object.getPrototypeOf(window.localStorage);
  const originalSetItem = storagePrototype.setItem;
  storagePrototype.setItem = () => {
    throw new window.DOMException("quota", "QuotaExceededError");
  };
  assert.equal(window.eval("persist()"), false);
  assert.match(window.document.querySelector("#appNotice").textContent, /저장하지 못했습니다/);
  const beforeFailedImport = window.localStorage.getItem(STORAGE_KEY);
  await dispatchImport(window, jsonFile(window, {
    assets: [{
      id: "unsaved-import",
      name: "저장되지 않아야 할 현금",
      type: "CASH",
      amount: 2
    }],
    snapshots: [],
    retirement: {}
  }, "quota-failure.json"));
  assert.equal(window.localStorage.getItem(STORAGE_KEY), beforeFailedImport);
  assert.equal(window.document.querySelector("#totalAsset").textContent, "₩3,000,000");
  assert.equal(downloads.length, 2);
  assert.match(alerts.at(-1), /저장하지 못해 기존 화면 데이터로 되돌렸습니다/);
  assert.doesNotMatch(window.document.querySelector("#appNotice").textContent, /새 데이터를 가져왔습니다/);
  storagePrototype.setItem = originalSetItem;
  assert.equal(alerts.length, 1);
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  const alerts = [];
  const downloads = [];
  installBrowserStubs(window, { alerts, downloads });
  window.firebaseConfig = {};
  const futureRaw = JSON.stringify({
    schemaVersion: 3,
    futureOnlyData: { mustRemain: true },
    assets: [],
    snapshots: []
  });
  window.localStorage.setItem(STORAGE_KEY, futureRaw);

  window.eval(appCode);
  await waitForApp(window);

  assert.equal(window.localStorage.getItem(STORAGE_KEY), futureRaw);
  assert.match(window.document.querySelector("#appNotice").textContent, /자동 저장을 중단/);
  assert.equal(window.eval("persist()"), false);

  const beforeInvalidImport = window.localStorage.getItem(STORAGE_KEY);
  await dispatchImport(window, jsonFile(window, {
    assets: [{}],
    snapshots: []
  }, "invalid.json"));
  assert.equal(window.localStorage.getItem(STORAGE_KEY), beforeInvalidImport);
  assert.equal(downloads.length, 0);
  assert.match(alerts.at(-1), /assets\[0\]\.id|assets\[0\]\.name/);

  await dispatchImport(window, {
    name: "oversized.json",
    size: 15 * 1024 * 1024 + 1,
    text: async () => "{}"
  });
  assert.equal(window.localStorage.getItem(STORAGE_KEY), beforeInvalidImport);
  assert.equal(downloads.length, 0);
  assert.match(alerts.at(-1), /15MB 이하/);

  await dispatchImport(window, jsonFile(window, {
    assets: [{
      id: "recovered-cash",
      name: "복구 현금",
      type: "CASH",
      amount: 5000000
    }],
    snapshots: [{
      id: "recovered-snapshot",
      createdAt: "2026-07-30T00:00:00.000Z",
      total: 5000000,
      note: "복구",
      assets: [{ id: "legacy-copy" }],
      typeTotals: { CASH: 5000000 }
    }],
    retirement: {}
  }, "valid-v1.json"));

  const recovered = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /^finance-ledger-recovery-before-import-/);
  assert.equal(recovered.schemaVersion, 2);
  assert.equal(recovered.assets[0].id, "recovered-cash");
  assert.equal(recovered.snapshots[0].assets, undefined);
  assert.equal(window.eval("persist()"), true);
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  const alerts = [];
  installBrowserStubs(window, { alerts });
  let remoteData = {
    schemaVersion: 2,
    revision: 4,
    updatedAt: "2026-07-30T00:00:00.000Z",
    assets: [{
      id: "remote-cash",
      name: "원격 현금",
      type: "CASH",
      amount: 1000000
    }],
    snapshots: [],
    retirement: {}
  };
  const transactionWrites = [];
  let conflictChoice = "later";

  window.firebaseConfig = {
    apiKey: "test",
    authDomain: "test.firebaseapp.com",
    projectId: "assettrail-6f676",
    appId: "test"
  };
  window.assetTrailCloudPushDelayMs = 0;
  window.assetTrailCloudConflictResolver = () => conflictChoice;
  window.assetTrailFirebaseModules = {
    app: {
      initializeApp: (config) => ({ config })
    },
    auth: {
      getAuth: () => ({ app: "test" }),
      GoogleAuthProvider: class GoogleAuthProvider {},
      getRedirectResult: async () => null,
      onAuthStateChanged: (_auth, callback) => {
        queueMicrotask(() => callback({ uid: "alice", email: "alice@example.com" }));
        return () => {};
      },
      signInWithRedirect: async () => {},
      signOut: async () => {}
    },
    firestore: {
      doc: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => ({
        exists: () => true,
        data: () => JSON.parse(JSON.stringify(remoteData))
      }),
      getFirestore: () => ({ app: "test" }),
      arrayUnion: (...values) => ({ __arrayUnion: values }),
      runTransaction: async (_db, update) => update({
        get: async () => ({
          exists: () => true,
          data: () => JSON.parse(JSON.stringify(remoteData))
        }),
        set: (ref, data, options) => {
          transactionWrites.push({
            data: JSON.parse(JSON.stringify(data)),
            options,
            path: ref.path
          });
          remoteData = JSON.parse(JSON.stringify(data));
        }
      }),
      setDoc: async () => {}
    }
  };

  window.eval(appCode);
  await waitForApp(window, 50);

  function setValue(selector, value) {
    const element = window.document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
  }

  function addCash(name, amount, note = "") {
    setValue("#assetCategory", "CASH");
    setValue("#assetName", name);
    setValue("#assetAmount", String(amount));
    setValue("#assetNote", note);
    window.document.querySelector("#assetForm").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true })
    );
  }

  addCash("추가 현금", 2000000);
  await waitForApp(window, 50);
  assert.equal(transactionWrites.length, 1);
  assert.equal(transactionWrites[0].data.schemaVersion, 2);
  assert.equal(transactionWrites[0].data.revision, 5);
  assert.equal(transactionWrites[0].data.meta.cloudRevision, 5);
  assert.equal(transactionWrites[0].options.merge, false);

  remoteData = {
    ...remoteData,
    revision: 6,
    meta: { ...remoteData.meta, cloudRevision: 6 },
    updatedAt: "2026-07-30T01:00:00.000Z"
  };
  addCash("충돌 중 로컬 현금", 3000000);
  await waitForApp(window, 50);
  assert.equal(transactionWrites.length, 1);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "동기화 충돌");
  let localState = JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:user:alice`));
  assert.equal(localState.meta.cloudRevision, 5);
  assert.equal(localState.meta.syncErrorCode, "assettrail/cloud-conflict");
  assert.equal(localState.assets.some((asset) => asset.name === "충돌 중 로컬 현금"), true);

  remoteData = {
    ...remoteData,
    revision: 5,
    meta: { ...remoteData.meta, cloudRevision: 5 }
  };
  conflictChoice = "upload";
  window.document.querySelector("#cloudSyncBtn").click();
  await waitForApp(window, 50);
  assert.equal(transactionWrites.length, 2);
  transactionWrites.length = 0;
  for (let index = 0; index < 92; index += 1) {
    addCash(`대용량 메모 ${index + 1}`, 1000, "x".repeat(10000));
  }
  await waitForApp(window, 200);
  assert.equal(transactionWrites.length, 0);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드 용량 초과");
  assert.match(window.document.querySelector("#appNotice").textContent, /900KB/);
  localState = JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:user:alice`));
  assert.equal(localState.meta.syncErrorCode, "assettrail/cloud-payload-too-large");
  assert.equal(alerts.length, 0);
  dom.window.close();
}
