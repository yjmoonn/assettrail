import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [
  readFileSync("ledger-engine.js", "utf8"),
  readFileSync("app.js", "utf8"),
  `window.__assetTrailAuthRaceTest = {
    captureCloudContext,
    cloudContextIsCurrent,
    completeCloudSignIn,
    defaultState,
    pushCloudData,
    holdCloudWrites(promise) {
      const held = Promise.resolve(promise).finally(() => {
        if (cloudWriteInFlight === held) cloudWriteInFlight = null;
      });
      cloudWriteInFlight = held;
      return held;
    },
    snapshot() {
      return {
        activeStorageKey,
        authGeneration: cloud.authGeneration,
        cloudReady: cloud.ready,
        state: storageSafeState(),
        uid: cloud.user?.uid || null
      };
    }
  };`
].join("\n");

const STORAGE_KEY = "finance-ledger-retirement-v1";
const ALICE_KEY = `${STORAGE_KEY}:user:alice`;
const BOB_KEY = `${STORAGE_KEY}:user:bob`;

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotFor(value) {
  return {
    exists: () => Boolean(value),
    data: () => clone(value)
  };
}

async function waitUntil(window, predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "https://yjmoonn.github.io/assettrail/"
});
const { window } = dom;
const downloads = [];
const writes = [];
const remotes = new Map();

window.HTMLCanvasElement.prototype.getContext = canvasContext;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLAnchorElement.prototype.click = function click() {
  downloads.push(this.download);
};
window.URL.createObjectURL = () => "blob:assettrail-auth-race";
window.URL.revokeObjectURL = () => {};
window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = (message) => {
  throw new Error(`Unexpected native confirm: ${message}`);
};
window.console.error = () => {};
window.console.warn = () => {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-08-07T00:00:00.000Z",
    fx: {},
    prices: { KRX: {}, US: {} },
    errors: []
  })
});
window.firebaseConfig = {
  apiKey: "test",
  authDomain: "test.firebaseapp.com",
  projectId: "assettrail-6f676",
  appId: "test"
};
window.assetTrailCloudPushDelayMs = 0;
window.assetTrailFirebaseModules = {
  app: {
    initializeApp: (config) => ({ config })
  },
  auth: {
    getAuth: () => ({ app: "test" }),
    GoogleAuthProvider: class GoogleAuthProvider {},
    getRedirectResult: async () => null,
    onAuthStateChanged: () => () => {},
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {},
    signOut: async () => {}
  },
  firestore: {
    doc: (_db, ...path) => ({ path: path.join("/") }),
    collection: (_db, ...path) => ({ path: path.join("/") }),
    getDoc: async (ref) => snapshotFor(remotes.get(ref.path)),
    getDocs: async () => ({ forEach() {} }),
    getFirestore: () => ({ app: "test" }),
    arrayUnion: (...values) => ({ __arrayUnion: values }),
    runTransaction: async () => {
      throw new Error("Unexpected cloud write transaction");
    },
    setDoc: async (ref, data, options) => {
      writes.push({ ref, data: clone(data), options });
    }
  }
};

window.eval(appCode);
const hooks = window.__assetTrailAuthRaceTest;
await waitUntil(window, () => hooks.snapshot().cloudReady, "Firebase mock 초기화가 완료되지 않았습니다.");

function stateWithCashAsset({ id, name, amount, savedAt, revision }) {
  const next = clone(hooks.defaultState());
  next.assets = [{
    id,
    name,
    ticker: "",
    type: "CASH",
    account: `${name} 계좌`,
    amount,
    quantity: 0,
    averagePrice: 0
  }];
  next.meta.lastSavedAt = savedAt;
  next.meta.cloudRevision = revision;
  return next;
}

const aliceLocal = stateWithCashAsset({
  id: "alice-local-cash",
  name: "Alice 로컬 자산",
  amount: 1000000,
  savedAt: "2026-08-05T00:00:00.000Z",
  revision: 2
});
const aliceRemote = stateWithCashAsset({
  id: "alice-remote-secret",
  name: "Alice 클라우드 비밀 자산",
  amount: 9000000,
  savedAt: "2026-08-06T00:00:00.000Z",
  revision: 7
});
aliceRemote.revision = 7;
aliceRemote.updatedAt = "2026-08-06T00:00:00.000Z";

const bobLocal = stateWithCashAsset({
  id: "bob-local-cash",
  name: "Bob 자산",
  amount: 3000000,
  savedAt: "2026-08-07T00:00:00.000Z",
  revision: 4
});
const bobRemote = clone(bobLocal);
bobRemote.revision = 4;
bobRemote.updatedAt = "2026-08-07T00:00:00.000Z";

window.localStorage.setItem(ALICE_KEY, JSON.stringify(aliceLocal));
window.localStorage.setItem(BOB_KEY, JSON.stringify(bobLocal));
remotes.set("users/alice/financeData/primary", aliceRemote);
remotes.set("users/bob/financeData/primary", bobRemote);

let resolveAliceConflict;
let markAliceConflictStarted;
const aliceConflictStarted = new Promise((resolve) => {
  markAliceConflictStarted = resolve;
});
const aliceConflictChoice = new Promise((resolve) => {
  resolveAliceConflict = resolve;
});
let conflictPayload = null;
window.assetTrailCloudConflictResolver = async (payload) => {
  conflictPayload = clone(payload);
  markAliceConflictStarted();
  return aliceConflictChoice;
};

const aliceSignIn = hooks.completeCloudSignIn({ uid: "alice", email: "alice@example.com" });
await aliceConflictStarted;

const aliceContext = hooks.captureCloudContext();
const aliceGeneration = hooks.snapshot().authGeneration;
assert.equal(aliceContext.uid, "alice");
assert.equal(conflictPayload.local.assets[0].id, "alice-local-cash");
assert.equal(conflictPayload.cloud.assets[0].id, "alice-remote-secret");

await hooks.completeCloudSignIn({ uid: "bob", email: "bob@example.com" });
const bobBeforeDelayedResult = hooks.snapshot();
assert.equal(bobBeforeDelayedResult.uid, "bob");
assert.equal(bobBeforeDelayedResult.activeStorageKey, BOB_KEY);
assert.equal(bobBeforeDelayedResult.authGeneration, aliceGeneration + 1);
assert.deepEqual(bobBeforeDelayedResult.state.assets.map((asset) => asset.id), ["bob-local-cash"]);
assert.equal(hooks.cloudContextIsCurrent(aliceContext), false);

resolveAliceConflict("download");
await aliceSignIn;
await new Promise((resolve) => window.setTimeout(resolve, 20));

const finalSnapshot = hooks.snapshot();
const storedAlice = JSON.parse(window.localStorage.getItem(ALICE_KEY));
const storedBob = JSON.parse(window.localStorage.getItem(BOB_KEY));
assert.equal(finalSnapshot.uid, "bob");
assert.equal(finalSnapshot.activeStorageKey, BOB_KEY);
assert.deepEqual(finalSnapshot.state.assets.map((asset) => asset.id), ["bob-local-cash"]);
assert.deepEqual(storedBob.assets.map((asset) => asset.id), ["bob-local-cash"]);
assert.deepEqual(storedAlice.assets.map((asset) => asset.id), ["alice-local-cash"]);
assert.equal(JSON.stringify(finalSnapshot.state).includes("alice-remote-secret"), false);
assert.equal(JSON.stringify(storedBob).includes("alice-remote-secret"), false);
assert.equal(downloads.length, 0, "취소된 Alice 충돌 결과가 백업 다운로드까지 진행하면 안 됩니다.");
assert.equal(writes.length, 0, "사용자 전환 중 이전 사용자 데이터가 클라우드에 기록되면 안 됩니다.");
assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드와 동기화됨");

// A save request queued behind an older write must retain Bob's request-time
// context and stop after Carol signs in. It must never recapture Carol's state.
const carolLocal = stateWithCashAsset({
  id: "carol-local-cash",
  name: "Carol 자산",
  amount: 5000000,
  savedAt: "2026-08-07T00:30:00.000Z",
  revision: 5
});
const carolRemote = clone(carolLocal);
carolRemote.revision = 5;
carolRemote.updatedAt = "2026-08-07T00:30:00.000Z";
const carolKey = `${STORAGE_KEY}:user:carol`;
window.localStorage.setItem(carolKey, JSON.stringify(carolLocal));
remotes.set("users/carol/financeData/primary", carolRemote);

let releaseHeldWrite;
const heldWrite = new Promise((resolve) => {
  releaseHeldWrite = resolve;
});
hooks.holdCloudWrites(heldWrite);
const queuedBobPush = hooks.pushCloudData("save");
const carolSignIn = hooks.completeCloudSignIn({ uid: "carol", email: "carol@example.com" });
assert.equal(hooks.snapshot().authGeneration, finalSnapshot.authGeneration + 1);
releaseHeldWrite();
assert.equal(await queuedBobPush, false);
await carolSignIn;

const afterQueuedPushRace = hooks.snapshot();
assert.equal(afterQueuedPushRace.uid, "carol");
assert.equal(afterQueuedPushRace.activeStorageKey, carolKey);
assert.deepEqual(afterQueuedPushRace.state.assets.map((asset) => asset.id), ["carol-local-cash"]);
assert.equal(writes.length, 0, "Bob의 대기 저장이 Carol 문맥으로 다시 실행되면 안 됩니다.");
assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드와 동기화됨");

dom.window.close();
console.log("cloud auth race tests passed");
