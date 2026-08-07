import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
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

function createScenario(choice = null, {
  local = localState(),
  remote = remoteState()
} = {}) {
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
  const eventDocs = new Map();

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
      collection: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => ({
        exists: () => true,
        data: () => JSON.parse(JSON.stringify(remote))
      }),
      getDocs: async (ref) => ({
        forEach(callback) {
          for (const [path, data] of eventDocs) {
            if (!path.startsWith(`${ref.path}/`)) continue;
            callback({ id: path.split("/").at(-1), data: () => JSON.parse(JSON.stringify(data)) });
          }
        }
      }),
      getFirestore: () => ({ app: "test" }),
      arrayUnion: (...values) => ({ __arrayUnion: values }),
      runTransaction: async (_db, update) => update({
        get: async () => ({
          exists: () => true,
          data: () => JSON.parse(JSON.stringify(remote))
        }),
        set: (ref, data, options) => {
          const saved = JSON.parse(JSON.stringify(data));
          writes.push({ data: saved, options, path: ref.path });
          if (ref.path === "users/alice/financeData/primary") {
            Object.keys(remote).forEach((key) => delete remote[key]);
            Object.assign(remote, saved);
          }
          if (ref.path.includes("/events/")) eventDocs.set(ref.path, saved);
        }
      }),
      setDoc: async (ref, data, options) => {
        const saved = JSON.parse(JSON.stringify(data));
        writes.push({
          data: saved,
          options,
          path: ref.path
        });
        if (ref.path.includes("/events/")) eventDocs.set(ref.path, saved);
      }
    }
  };
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(local));

  window.eval(appCode);

  return {
    dom,
    downloads,
    eventDocs,
    objectUrls,
    resolverCalls,
    remote,
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
  assert.equal(window.document.querySelector("#syncStatus").textContent, "충돌 확인 필요");
  assert.match(window.document.querySelector("#cloudConflictCloudMeta").textContent, /자산 1개 · 기록 1개/);
  assert.match(window.document.querySelector("#cloudConflictLocalMeta").textContent, /자산 1개 · 기록 1개/);
  assert.equal(window.document.querySelector(".app").hasAttribute("inert"), true);
  dialog.querySelector('[data-cloud-conflict-choice="later"]').click();
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "충돌 확인 필요",
    "커스텀 선택창의 나중에 결정 동작이 완료되지 않았습니다."
  );
  assert.equal(dialog.open || dialog.hasAttribute("open"), false);
  assert.equal(window.document.querySelector(".app").hasAttribute("inert"), false);
  assert.equal(scenario.writes.length, 0);
  scenario.dom.window.close();
}

{
  const legacy = remoteState();
  const scenario = createScenario(null, {
    local: JSON.parse(JSON.stringify(legacy)),
    remote: JSON.parse(JSON.stringify(legacy))
  });
  const { window } = scenario;
  await waitUntil(
    window,
    () => scenario.remote.schemaVersion === 6,
    "동일한 legacy 데이터를 충돌 선택 없이 v6로 승격하지 못했습니다."
  );

  const stored = JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY));
  const dialog = window.document.querySelector("#cloudConflictDialog");
  assert.equal(dialog.open || dialog.hasAttribute("open"), false);
  assert.equal(scenario.resolverCalls.length, 0);
  assert.equal(scenario.downloads.length, 0);
  assert.equal(stored.schemaVersion, 6);
  assert.equal(stored.assets[0].id, "remote-cash");
  assert.equal(stored.events.length, 1);
  assert.equal(stored.meta.cloudRevision, 8);
  assert.equal(scenario.eventDocs.size, 1);
  assert.equal(
    scenario.writes.filter((write) => write.path === "users/alice/financeData/primary").length,
    1
  );
  assert.equal(
    scenario.writes.some((write) => write.path.includes("/backups/schema-v2-revision-7")),
    true
  );
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드와 동기화됨");
  scenario.dom.window.close();
}

{
  const local = remoteState();
  const remote = JSON.parse(JSON.stringify(local));
  local.meta.lastSavedAt = "2026-08-01T00:00:00.000Z";
  remote.meta.lastSavedAt = "2026-08-03T00:00:00.000Z";
  const scenario = createScenario(null, { local, remote });
  const { window } = scenario;
  await waitUntil(
    window,
    () => scenario.remote.schemaVersion === 6,
    "저장 시각만 다른 동일 legacy 데이터를 자동 승격하지 못했습니다."
  );

  assert.equal(scenario.resolverCalls.length, 0);
  assert.equal(scenario.downloads.length, 0);
  assert.equal(scenario.eventDocs.size, 1);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드와 동기화됨");
  scenario.dom.window.close();
}

{
  const local = remoteState();
  const remote = JSON.parse(JSON.stringify(local));
  remote.assets[0].amount += 1;
  const scenario = createScenario("later", { local, remote });
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "충돌 확인 필요",
    "실제 값이 다른 legacy 데이터의 충돌 선택을 유지하지 못했습니다."
  );

  assert.equal(scenario.resolverCalls.length, 1);
  assert.equal(scenario.remote.schemaVersion, 2);
  assert.equal(scenario.writes.length, 0);
  scenario.dom.window.close();
}

{
  const futureLocal = {
    ...localState(),
    schemaVersion: 7,
    assets: [{
      id: "future-local-only",
      name: "미래 버전 로컬 자산",
      type: "CASH",
      amount: 9000000
    }]
  };
  const originalRaw = JSON.stringify(futureLocal);
  const scenario = createScenario(null, { local: futureLocal });
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "동기화 중단",
    "미지원 로컬 스키마의 동기화 차단 상태가 표시되지 않았습니다."
  );

  assert.equal(window.localStorage.getItem(USER_STORAGE_KEY), originalRaw);
  assert.equal(scenario.resolverCalls.length, 0);
  assert.equal(scenario.writes.length, 0);
  const monthlySpend = window.document.querySelector("#monthlySpend");
  monthlySpend.value = "4,500,000";
  monthlySpend.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  assert.equal(window.localStorage.getItem(USER_STORAGE_KEY), originalRaw);
  assert.equal(scenario.writes.length, 0);
  scenario.dom.window.close();
}

{
  const futureRemote = {
    ...remoteState(),
    schemaVersion: 7,
    assets: [{
      id: "future-remote-only",
      name: "미래 버전 클라우드 자산",
      type: "CASH",
      amount: 12000000
    }]
  };
  const scenario = createScenario(null, { remote: futureRemote });
  const { window } = scenario;
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "동기화 중단",
    "미지원 클라우드 스키마의 동기화 차단 상태가 표시되지 않았습니다."
  );

  assert.equal(scenario.resolverCalls.length, 0);
  assert.equal(scenario.writes.length, 0);
  const monthlySpend = window.document.querySelector("#monthlySpend");
  monthlySpend.value = "4,600,000";
  monthlySpend.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  assert.equal(scenario.writes.length, 0);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "동기화 중단");
  scenario.dom.window.close();
}

{
  const scenario = createScenario("download");
  const { window } = scenario;
  await waitUntil(
    window,
    () => JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)).assets[0]?.id === "remote-cash",
    "원격 스키마 변경 전 초기 내려받기가 완료되지 않았습니다."
  );
  await waitUntil(
    window,
    () => scenario.remote.schemaVersion === 6,
    "원격 legacy 데이터를 v6 원장으로 승격하지 못했습니다."
  );
  const writesAfterPromotion = scenario.writes.length;
  scenario.remote.schemaVersion = 7;
  const monthlySpend = window.document.querySelector("#monthlySpend");
  monthlySpend.value = "4,700,000";
  monthlySpend.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitUntil(
    window,
    () => window.document.querySelector("#syncStatus").textContent === "동기화 중단",
    "쓰기 직전 변경된 원격 스키마를 차단하지 못했습니다."
  );

  assert.equal(scenario.writes.length, writesAfterPromotion);
  assert.equal(scenario.remote.schemaVersion, 7);
  scenario.dom.window.close();
}

{
  const scenario = createScenario("download");
  const { window } = scenario;
  await waitUntil(
    window,
    () => scenario.remote.schemaVersion === 6
      && JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)).assets[0]?.id === "remote-cash",
    "클라우드 데이터 내려받기가 완료되지 않았습니다."
  );

  assert.equal(scenario.resolverCalls.length, 1);
  assert.equal(scenario.resolverCalls[0].local.assets[0].id, "local-cash");
  assert.equal(scenario.resolverCalls[0].cloud.assets[0].id, "remote-cash");
  const promotedPrimaryWrites = scenario.writes.filter((write) => write.path === "users/alice/financeData/primary");
  assert.equal(promotedPrimaryWrites.length, 1);
  assert.equal(promotedPrimaryWrites[0].data.schemaVersion, 6);
  assert.equal(scenario.writes.some((write) => write.path.includes("/backups/schema-v2-revision-7")), true);
  assert.equal(scenario.writes.some((write) => write.path.includes("/ledgers/") && write.path.includes("/events/")), true);
  assert.equal(scenario.downloads.length, 1);
  assert.match(scenario.downloads[0], /^assettrail-before-cloud-sync-/);
  assert.deepEqual(scenario.revokedUrls, scenario.objectUrls);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드와 동기화됨");
  window.document.querySelector("#cloudSyncBtn").click();
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  assert.equal(scenario.resolverCalls.length, 1, "the next pull after legacy promotion must not reopen a conflict");
  assert.equal(
    scenario.writes.filter((write) => write.path === "users/alice/financeData/primary").length,
    1,
    "the next pull after promotion must not write another revision"
  );
  scenario.dom.window.close();
}

{
  const scenario = createScenario("upload", {
    remote: {
      ...remoteState(),
      schemaVersion: 6,
      events: [],
      performanceObservations: [],
      ledgerMeta: {
        activeLedgerId: "ledger-remote-v6",
        baselineDate: "2026-08-03",
        eventCount: 0,
        eventFingerprint: ""
      }
    }
  });
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
  const remoteBackup = scenario.writes.find((write) => write.path.includes("/backups/conflict-v6-revision-7"));
  assert.ok(remoteBackup, "forced v6 upload must preserve the previous remote primary");
  assert.equal(remoteBackup.data.reason, "FORCED_CONFLICT_UPLOAD");
  assert.equal(remoteBackup.data.state.ledgerMeta.activeLedgerId, "ledger-remote-v6");
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
    () => window.document.querySelector("#syncStatus").textContent === "충돌 확인 필요",
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
  assert.equal(window.document.querySelector("#syncStatus").textContent, "충돌 확인 필요");
  scenario.dom.window.close();
}
