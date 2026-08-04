import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = readFileSync("app.js", "utf8");
const STORAGE_KEY = "finance-ledger-retirement-v1";
const USER_STORAGE_KEY = `${STORAGE_KEY}:user:alice`;

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

function localState() {
  return {
    schemaVersion: 2,
    assets: [{
      id: "local-cash",
      name: "이 기기 현금",
      ticker: "",
      type: "CASH",
      account: "로컬 계좌",
      amount: 2000000,
      quantity: 0,
      averagePrice: 0
    }],
    snapshots: [],
    meta: {
      cloudRevision: 2,
      lastSavedAt: "2026-08-02T12:00:00.000Z"
    },
    retirement: {
      currentAge: 35,
      retireAge: 55,
      lifeAge: 90,
      currentInvestable: 0,
      monthlyInvest: 1000000,
      monthlySpend: 3500000,
      inflationRate: 2,
      postReturnRate: 3.5
    }
  };
}

function remoteState() {
  return {
    schemaVersion: 2,
    revision: 7,
    updatedAt: "2026-08-03T00:00:00.000Z",
    assets: [{
      id: "remote-cash",
      name: "클라우드 현금",
      ticker: "",
      type: "CASH",
      account: "클라우드 계좌",
      amount: 5000000,
      quantity: 0,
      averagePrice: 0
    }],
    snapshots: [{
      id: "remote-snapshot",
      createdAt: "2026-08-03T00:00:00.000Z",
      total: 5000000,
      note: "클라우드 기록",
      typeTotals: { CASH: 5000000 }
    }],
    meta: {
      cloudRevision: 7,
      lastSavedAt: "2026-08-03T00:00:00.000Z"
    },
    retirement: {
      currentAge: 35,
      retireAge: 55,
      lifeAge: 90,
      currentInvestable: 0,
      monthlyInvest: 1000000,
      monthlySpend: 3500000,
      inflationRate: 2,
      postReturnRate: 3.5
    }
  };
}

async function waitUntil(window, predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function createScenario(choice = null) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://yjmoonn.github.io/assettrail/"
  });
  const { window } = dom;
  const writes = [];
  const downloads = [];
  const objectUrls = [];
  const revokedUrls = [];
  const resolverCalls = [];
  const remote = remoteState();

  window.HTMLCanvasElement.prototype.getContext = canvasContext;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push(this.download);
  };
  window.URL.createObjectURL = () => {
    const url = `blob:assettrail-cloud-conflict-${objectUrls.length + 1}`;
    objectUrls.push(url);
    return url;
  };
  window.URL.revokeObjectURL = (url) => revokedUrls.push(String(url));
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
      generatedAt: "2026-08-03T00:00:00.000Z",
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
  if (choice) {
    window.assetTrailCloudConflictResolver = async (payload) => {
      resolverCalls.push(payload);
      return choice;
    };
  }
  window.assetTrailFirebaseModules = {
    app: {
      initializeApp: (config) => ({ config })
    },
    auth: {
      browserLocalPersistence: {},
      getAuth: () => ({ app: "test" }),
      GoogleAuthProvider: class GoogleAuthProvider {},
      getRedirectResult: async () => null,
      onAuthStateChanged: (_auth, callback) => {
        window.queueMicrotask(() => callback({ uid: "alice", email: "alice@example.com" }));
        return () => {};
      },
      setPersistence: async () => {},
      signInWithPopup: async () => {},
      signInWithRedirect: async () => {},
      signOut: async () => {}
    },
    firestore: {
      doc: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => ({
        exists: () => true,
        data: () => JSON.parse(JSON.stringify(remote))
      }),
      getFirestore: () => ({ app: "test" }),
      arrayUnion: (...values) => ({ __arrayUnion: values }),
      setDoc: async (ref, data, options) => {
        writes.push({
          data: JSON.parse(JSON.stringify(data)),
          options,
          path: ref.path
        });
      }
    }
  };
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(localState()));

  window.eval(appCode);

  return {
    dom,
    downloads,
    objectUrls,
    resolverCalls,
    revokedUrls,
    window,
    writes
  };
}

{
  const scenario = createScenario();
  const { window } = scenario;
  const dialog = window.document.querySelector("#cloudConflictDialog");
  await waitUntil(
    window,
    () => dialog.open || dialog.hasAttribute("open"),
    "커스텀 충돌 선택창이 열리지 않았습니다."
  );
  assert.match(window.document.querySelector("#cloudConflictCloudMeta").textContent, /자산 1개 · 기록 1개/);
  assert.match(window.document.querySelector("#cloudConflictLocalMeta").textContent, /자산 1개 · 기록 0개/);
  assert.equal(window.document.querySelector(".app").hasAttribute("inert"), true);
  dialog.querySelector('[data-cloud-conflict-choice="later"]').click();
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "동기화 충돌",
    "커스텀 선택창의 나중에 결정 동작이 완료되지 않았습니다."
  );
  assert.equal(dialog.open || dialog.hasAttribute("open"), false);
  assert.equal(window.document.querySelector(".app").hasAttribute("inert"), false);
  assert.equal(scenario.writes.length, 0);
  scenario.dom.window.close();
}

{
  const scenario = createScenario("download");
  const { window } = scenario;
  await waitUntil(
    window,
    () => JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)).assets[0]?.id === "remote-cash",
    "클라우드 데이터 내려받기가 완료되지 않았습니다."
  );

  assert.equal(scenario.resolverCalls.length, 1);
  assert.equal(scenario.resolverCalls[0].local.assets[0].id, "local-cash");
  assert.equal(scenario.resolverCalls[0].cloud.assets[0].id, "remote-cash");
  assert.equal(scenario.writes.filter((write) => write.path === "users/alice/financeData/primary").length, 0);
  assert.equal(scenario.downloads.length, 1);
  assert.match(scenario.downloads[0], /^assettrail-before-cloud-sync-/);
  assert.deepEqual(scenario.revokedUrls, scenario.objectUrls);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드: alice@example.com");
  scenario.dom.window.close();
}

{
  const scenario = createScenario("upload");
  const { window } = scenario;
  await waitUntil(
    window,
    () => scenario.writes.some((write) => write.path === "users/alice/financeData/primary"),
    "이 기기 데이터 업로드가 완료되지 않았습니다."
  );

  const financeWrites = scenario.writes.filter((write) => write.path === "users/alice/financeData/primary");
  assert.equal(scenario.resolverCalls.length, 1);
  assert.equal(financeWrites.length, 1);
  assert.equal(financeWrites[0].data.assets[0].id, "local-cash");
  assert.equal(financeWrites[0].data.revision, 8);
  assert.equal(financeWrites[0].options.merge, false);
  assert.equal(scenario.downloads.length, 1);
  assert.match(scenario.downloads[0], /^assettrail-before-cloud-sync-/);
  assert.deepEqual(scenario.revokedUrls, scenario.objectUrls);
  assert.equal(JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)).assets[0].id, "local-cash");
  scenario.dom.window.close();
}

{
  const scenario = createScenario("later");
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "동기화 충돌",
    "나중에 결정하기 상태가 표시되지 않았습니다."
  );

  assert.equal(scenario.resolverCalls.length, 1);
  assert.equal(scenario.downloads.length, 0);
  assert.equal(scenario.writes.filter((write) => write.path === "users/alice/financeData/primary").length, 0);

  const monthlySpend = window.document.querySelector("#monthlySpend");
  monthlySpend.value = "4,200,000";
  monthlySpend.dispatchEvent(new window.Event("input", { bubbles: true }));
  monthlySpend.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 25));

  assert.equal(
    JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)).retirement.monthlySpend,
    4200000
  );
  assert.equal(
    scenario.writes.filter((write) => write.path === "users/alice/financeData/primary").length,
    0
  );
  assert.equal(window.document.querySelector("#syncStatus").textContent, "동기화 충돌");
  scenario.dom.window.close();
}
