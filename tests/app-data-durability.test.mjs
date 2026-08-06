import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
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

function ledgerDepositEvent(index, overrides = {}) {
  return {
    eventId: `deposit-${String(index).padStart(5, "0")}`,
    type: "DEPOSIT",
    accountId: "ACCOUNT:cash",
    cashAssetId: "cash",
    cashAccountId: "ACCOUNT:cash",
    tradeDate: "2026-08-01",
    settlementDate: "2026-08-01",
    sequence: index,
    amount: 1000 + index,
    currency: "KRW",
    fxRate: 1,
    ...overrides
  };
}

function emptyCloudState({
  revision = 1,
  ledgerId = "ledger-active-old",
  eventCount = 0,
  eventFingerprint = ""
} = {}) {
  return {
    schemaVersion: 5,
    revision,
    updatedAt: "2026-08-05T00:00:00.000Z",
    ledgerMeta: {
      activeLedgerId: ledgerId,
      baselineDate: "2026-08-01",
      eventCount,
      eventFingerprint
    },
    assets: [],
    events: [],
    snapshots: [],
    retirement: {},
    meta: {
      cloudRevision: revision,
      lastSavedAt: "2026-08-05T00:00:00.000Z"
    }
  };
}

function evalAppWithLedgerCloudTestApi(window) {
  window.eval(`${appCode}
    window.__ledgerCloudTestApi = {
      fingerprint: (events) => ledgerEventFingerprint(events),
      dataFingerprint: (data) => dataFingerprint(data),
      cloudSafeState: (revision, updatedAt) => cloudSafeState(revision, updatedAt),
      setLedgerState(events, ledgerId, revision = 0) {
        state.events = events;
        state.ledgerMeta.activeLedgerId = ledgerId;
        state.ledgerMeta.baselineDate = "2026-08-01";
        state.meta.cloudRevision = revision;
        cloud.knownEventIds = new Set();
      },
      writeCloudState: (options) => writeCloudState(options),
      readCloudStateConsistently: (maxAttempts) => readCloudStateConsistently(maxAttempts)
    };
  `);
  return window.__ledgerCloudTestApi;
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
      investmentRole: "SURVIVAL",
      thesis: "예상하지 못한 지출 대응",
      returnSource: "유동성",
      horizon: "LONG",
      conviction: "HIGH",
      kpis: "생활비 개월 수",
      catalysts: "월말 점검",
      invalidation: "필수 생활비 부족",
      deceleration: "목표 현금 초과",
      nextReviewAt: "2026-08-31",
      lastReviewedAt: "2026-07-31",
      reviewStatus: "ACTIVE",
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
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.assets[0].updatedAt, "2026-07-29T12:00:00.000Z");
  assert.equal(migrated.assets[0].investmentRole, undefined);
  assert.equal(migrated.decisionProfiles.length, 1);
  assert.equal(migrated.decisionProfiles[0].subjectKey, "ASSET:legacy-cash");
  assert.equal(migrated.decisionProfiles[0].investmentRole, "SURVIVAL");
  assert.equal(migrated.decisionProfiles[0].thesis, "예상하지 못한 지출 대응");
  assert.deepEqual(migrated.decisionProfiles[0].riskTags, {
    industry: [],
    country: [],
    currency: [],
    rate: [],
    duration: [],
    customer: [],
    aiValueChain: []
  });
  assert.equal(migrated.policyProfile.allocationBands.domestic.targetPct, 50);
  assert.deepEqual(migrated.contributionPlan, { mode: "ONE_TIME", amount: 0 });
  assert.deepEqual(migrated.watchlist, []);
  assert.deepEqual(
    Object.keys(migrated.snapshots[0]).sort(),
    ["createdAt", "id", "note", "total", "typeTotals"]
  );
  assert.equal(migrated.snapshots[0].assets, undefined);
  assert.deepEqual(migrated.snapshots[0].typeTotals, { CASH: 3000000 });

  await dispatchImport(window, jsonFile(window, migrated, "round-trip-v2.json"));
  const roundTripped = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(roundTripped.schemaVersion, 5);
  assert.equal(roundTripped.assets[0].id, "legacy-cash");
  assert.equal(roundTripped.snapshots[0].id, "legacy-snapshot");
  assert.equal(roundTripped.decisionProfiles[0].nextReviewAt, "2026-08-31");
  assert.equal(roundTripped.policyProfile.riskBudgets.coreMinPct, 40);
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
  installBrowserStubs(window);
  window.firebaseConfig = {};
  const legacyRaw = JSON.stringify({
    schemaVersion: 4,
    assets: [{ id: "quota-cash", name: "원본 현금", type: "CASH", amount: 1234567 }],
    snapshots: [],
    retirement: {}
  });
  window.localStorage.setItem(STORAGE_KEY, legacyRaw);
  const storagePrototype = Object.getPrototypeOf(window.localStorage);
  const originalSetItem = storagePrototype.setItem;
  storagePrototype.setItem = function setItemWithMigrationFailure(key, value) {
    if (key === STORAGE_KEY && JSON.parse(String(value)).schemaVersion === 5) {
      throw new window.DOMException("quota", "QuotaExceededError");
    }
    return originalSetItem.call(this, key, value);
  };

  window.eval(appCode);
  await waitForApp(window);

  assert.equal(window.localStorage.getItem(STORAGE_KEY), legacyRaw, "failed migration must keep the active v4 payload");
  assert.equal(window.localStorage.getItem(`${STORAGE_KEY}:migration-backup:v4-to-v5`), legacyRaw);
  assert.equal(window.eval("persist()"), false);
  assert.match(window.document.querySelector("#appNotice").textContent, /자동 저장을 중단|보호/);
  window.document.querySelector("#assetForm").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true })
  );
  assert.equal(window.localStorage.getItem(STORAGE_KEY), legacyRaw, "protected migration state must reject form mutations");

  storagePrototype.setItem = originalSetItem;
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  installBrowserStubs(window);
  window.firebaseConfig = {};
  window.eval(appCode);
  await waitForApp(window);
  const engine = window.AssetTrailLedgerEngine;
  const cash = { id: "cash-1", name: "현금", type: "CASH", account: "계좌", amount: 100000 };
  const manual = { id: "manual-1", name: "수동 펀드", type: "MANUAL", account: "계좌", amount: 200000 };
  const openingCash = engine.createOpeningBalanceEvent(cash, {
    eventId: "opening-cash-1",
    openingDate: "2026-08-01",
    accountId: "ACCOUNT:cash-1"
  }).event;
  const openingManual = engine.createOpeningBalanceEvent({ ...manual, amount: 100000 }, {
    eventId: "opening-manual-1",
    openingDate: "2026-08-01",
    accountId: "ACCOUNT:manual-1"
  }).event;
  const base = {
    schemaVersion: 5,
    assets: [cash, manual],
    events: [openingCash, openingManual],
    ledgerMeta: { activeLedgerId: "ledger-import-check", baselineDate: "2026-08-01" },
    snapshots: [],
    retirement: {}
  };
  const validate = (payload) => window.eval(`validateImportPayload(${JSON.stringify(payload)})`);

  assert.throws(
    () => validate({
      ...base,
      events: [...base.events, ledgerDepositEvent(9000, { cashAssetId: "ghost-cash", cashAccountId: "ACCOUNT:ghost-cash" })]
    }),
    /ghost-cash|자산 목록/
  );
  assert.throws(
    () => validate(base),
    /수동 펀드 평가금액/,
    "manual asset amount must match its latest valuation event"
  );
  const validManual = { ...base, assets: [cash, { ...manual, amount: 100000 }] };
  assert.doesNotThrow(() => validate(validManual));
  assert.throws(
    () => validate({
      ...validManual,
      assets: [cash, { ...cash, name: "중복 ID 현금" }, { ...manual, amount: 100000 }]
    }),
    /assets\[1\]\.id가 중복/
  );
  const duplicateIdentityCash = { ...cash, id: "cash-duplicate-identity" };
  const duplicateIdentityOpening = engine.createOpeningBalanceEvent(duplicateIdentityCash, {
    eventId: "opening-cash-duplicate-identity",
    openingDate: "2026-08-01",
    accountId: "ACCOUNT:cash-duplicate-identity"
  }).event;
  assert.throws(
    () => validate({
      ...validManual,
      assets: [cash, duplicateIdentityCash, { ...manual, amount: 100000 }],
      events: [...base.events, duplicateIdentityOpening]
    }),
    /자산 유형·종목·계좌가 중복/
  );
  assert.throws(
    () => validate({
      ...validManual,
      assets: [
        ...validManual.assets,
        {
          id: "stock-short-code",
          name: "단축 코드 주식",
          ticker: "5930",
          type: "KRX",
          account: "중복 코드 계좌",
          quantity: 1,
          averagePrice: 1000
        },
        {
          id: "stock-padded-code",
          name: "패딩 코드 주식",
          ticker: "005930",
          type: "KRX",
          account: "중복 코드 계좌",
          quantity: 1,
          averagePrice: 1000
        }
      ]
    }),
    /자산 유형·종목·계좌가 중복/
  );
  assert.throws(
    () => validate({
      ...validManual,
      tradeJournalEntries: [{
        id: "journal-broken-link",
        assetId: "",
        realizedTradeId: "",
        ledgerEventId: "missing-event",
        name: "연결 오류",
        ticker: "",
        type: "MANUAL",
        region: "OTHER",
        account: "",
        action: "WATCH",
        status: "OPEN",
        tags: "",
        reason: "",
        risk: "",
        review: "",
        date: "2026-08-05",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        quantity: 0,
        price: 0
      }]
    }),
    /매매일지.*원장 연결/
  );

  const importedStockBeforeSell = {
    id: "stock-import-link",
    name: "연결 검증 주식",
    ticker: "005930",
    type: "KRX",
    account: "계좌",
    quantity: 2,
    averagePrice: 1000
  };
  const importedStockOpening = engine.createOpeningBalanceEvent(importedStockBeforeSell, {
    eventId: "opening-stock-import-link",
    openingDate: "2026-08-01",
    accountId: "ACCOUNT:stock-import-link",
    instrumentKey: "INSTRUMENT:KRX:005930"
  }).event;
  const importedSell = engine.normalizeLedgerEvent({
    eventId: "sell-import-link",
    type: "SELL",
    accountId: "ACCOUNT:stock-import-link",
    cashAssetId: "cash-1",
    cashAccountId: "ACCOUNT:cash-1",
    assetId: "stock-import-link",
    instrumentKey: "INSTRUMENT:KRX:005930",
    tradeDate: "2026-08-05",
    settlementDate: "2026-08-05",
    sequence: 1,
    quantity: 1,
    price: 1500,
    currency: "KRW",
    fxRate: 1,
    feeKRW: 0,
    taxKRW: 0
  }).event;
  const validLinkedTrade = {
    id: "trade-import-link",
    assetId: "stock-import-link",
    ledgerEventId: importedSell.eventId,
    soldAt: "2026-08-05",
    name: "연결 검증 주식",
    ticker: "005930",
    type: "KRX",
    account: "계좌",
    quantity: 1,
    averagePrice: 1000,
    sellPrice: 1500,
    fxRate: 1,
    grossAmount: 1500,
    costAmount: 1000,
    fees: 0,
    tax: 0,
    realizedGain: 500,
    realizedGainRate: 0.5,
    memo: "",
    createdAt: "2026-08-05T00:00:00.000Z"
  };
  const validLinkedPayload = {
    ...validManual,
    assets: [
      { ...cash, amount: 101500 },
      { ...manual, amount: 100000 },
      { ...importedStockBeforeSell, quantity: 1 }
    ],
    events: [...base.events, importedStockOpening, importedSell],
    realizedTrades: [validLinkedTrade]
  };
  assert.doesNotThrow(() => validate(validLinkedPayload));
  assert.throws(
    () => validate({
      ...validLinkedPayload,
      realizedTrades: [{ ...validLinkedTrade, assetId: "manual-1" }]
    }),
    /실현손익.*자산이 연결된 매도 이벤트와 다릅니다/
  );
  assert.throws(
    () => validate({
      ...validLinkedPayload,
      realizedTrades: [{ ...validLinkedTrade, cancelledAt: "2026-08-05T01:00:00.000Z" }]
    }),
    /실현손익.*취소 상태/
  );
  assert.throws(
    () => validate({
      ...validLinkedPayload,
      tradeJournalEntries: [{
        id: "journal-import-link",
        assetId: "stock-import-link",
        realizedTradeId: "trade-import-link",
        ledgerEventId: importedSell.eventId,
        name: "연결 검증 주식",
        ticker: "005930",
        type: "KRX",
        region: "KR",
        account: "계좌",
        action: "BUY",
        status: "DONE",
        tags: "",
        reason: "",
        risk: "",
        review: "",
        date: "2026-08-05",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        quantity: 1,
        price: 1500
      }]
    }),
    /매매일지.*자산·행동/
  );
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  installBrowserStubs(window);
  window.firebaseConfig = {};
  const testApi = evalAppWithLedgerCloudTestApi(window);
  await waitForApp(window);

  const smallEvents = Array.from({ length: 10 }, (_, index) => ledgerDepositEvent(index));
  const largeEvents = Array.from({ length: 5000 }, (_, index) => ledgerDepositEvent(index));
  const smallFingerprint = testApi.fingerprint(smallEvents);
  const largeFingerprint = testApi.fingerprint(largeEvents);

  assert.equal(typeof largeFingerprint, "string");
  assert.equal(largeFingerprint.length, smallFingerprint.length, "fingerprint length must not grow with event count");
  assert.equal(largeFingerprint.length > 0 && largeFingerprint.length <= 128, true);
  assert.notEqual(largeFingerprint, smallFingerprint);
  assert.equal(testApi.fingerprint([...largeEvents].reverse()), largeFingerprint, "event digest must not depend on collection order");
  assert.equal(
    testApi.dataFingerprint({ ...emptyCloudState(), events: largeEvents }),
    testApi.dataFingerprint({ ...emptyCloudState(), events: [...largeEvents].reverse() }),
    "state conflict fingerprint must use canonical event order"
  );

  testApi.setLedgerState(largeEvents, "ledger-bounded-manifest");
  const manifest = testApi.cloudSafeState(12, "2026-08-05T01:00:00.000Z");
  assert.equal(manifest.events, undefined);
  assert.equal(manifest.ledgerMeta.eventCount, 5000);
  assert.equal(manifest.ledgerMeta.eventFingerprint, largeFingerprint);
  assert.equal(
    Buffer.byteLength(JSON.stringify(manifest), "utf8") < 100_000,
    true,
    "primary manifest must stay safely bounded even with thousands of events"
  );
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  installBrowserStubs(window);
  let remoteData = emptyCloudState({ revision: 7 });
  const eventDocs = new Map();
  const stagedWrites = [];
  let transactionAttempts = 0;

  const snapshotFor = (data) => ({
    exists: () => true,
    data: () => JSON.parse(JSON.stringify(data))
  });

  window.firebaseConfig = {
    apiKey: "test",
    authDomain: "test.firebaseapp.com",
    projectId: "assettrail-6f676",
    appId: "test"
  };
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
      collection: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => snapshotFor(remoteData),
      getFirestore: () => ({ app: "test" }),
      getDocs: async (ref) => ({
        forEach(callback) {
          for (const [path, data] of eventDocs) {
            if (!path.startsWith(`${ref.path}/`)) continue;
            callback({ id: path.split("/").at(-1), data: () => JSON.parse(JSON.stringify(data)) });
          }
        }
      }),
      setDoc: async (ref, data, options) => {
        stagedWrites.push({
          data: JSON.parse(JSON.stringify(data)),
          options,
          path: ref.path
        });
        if (ref.path.includes("/events/")) {
          eventDocs.set(ref.path, JSON.parse(JSON.stringify(data)));
        }
      },
      runTransaction: async () => {
        transactionAttempts += 1;
        throw new Error("simulated manifest swap failure");
      }
    }
  };

  const testApi = evalAppWithLedgerCloudTestApi(window);
  await waitForApp(window, 50);

  const oldEvent = ledgerDepositEvent(9000, { eventId: "old-existing-event" });
  const oldFingerprint = testApi.fingerprint([oldEvent]);
  remoteData = emptyCloudState({
    revision: 7,
    ledgerId: "ledger-active-old",
    eventCount: 1,
    eventFingerprint: oldFingerprint
  });
  eventDocs.set(
    "users/alice/financeData/primary/ledgers/ledger-active-old/events/old-existing-event",
    oldEvent
  );

  const bulkEvents = Array.from({ length: 401 }, (_, index) => ledgerDepositEvent(index));
  testApi.setLedgerState(bulkEvents, "ledger-active-old", 7);

  await assert.rejects(
    testApi.writeCloudState(),
    /simulated manifest swap failure/
  );
  assert.equal(transactionAttempts, 1);
  const stagedEventWrites = stagedWrites.filter((write) => write.path.includes("/events/"));
  assert.equal(stagedEventWrites.length, 401);
  const stagedLedgerIds = new Set(stagedEventWrites.map((write) => (
    write.path.split("/ledgers/")[1].split("/events/")[0]
  )));
  assert.equal(stagedLedgerIds.size, 1, "one isolated generation must receive the entire bulk write");
  assert.notEqual([...stagedLedgerIds][0], "ledger-active-old");
  assert.equal(remoteData.ledgerMeta.activeLedgerId, "ledger-active-old");
  assert.equal(remoteData.ledgerMeta.eventFingerprint, oldFingerprint);

  const readAfterFailure = await testApi.readCloudStateConsistently();
  assert.equal(readAfterFailure.data.ledgerMeta.activeLedgerId, "ledger-active-old");
  assert.deepEqual(
    JSON.parse(JSON.stringify(readAfterFailure.data.events.map((event) => event.eventId))),
    ["old-existing-event"],
    "failed staging must not contaminate reads from the active generation"
  );
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  installBrowserStubs(window);
  const bootstrapHead = emptyCloudState({ revision: 1 });
  let retryMode = "bootstrap";
  let retryHeads = [];
  let retryEvents = [];
  let getDocsAttempts = 0;

  const snapshotFor = (data) => ({
    exists: () => true,
    data: () => JSON.parse(JSON.stringify(data))
  });
  const currentRetryHead = () => retryHeads[Math.min(getDocsAttempts, retryHeads.length - 1)];

  window.firebaseConfig = {
    apiKey: "test",
    authDomain: "test.firebaseapp.com",
    projectId: "assettrail-6f676",
    appId: "test"
  };
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
      collection: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => snapshotFor(retryMode === "bootstrap" ? bootstrapHead : currentRetryHead()),
      getFirestore: () => ({ app: "test" }),
      getDocs: async (ref) => {
        const attempt = getDocsAttempts;
        getDocsAttempts += 1;
        const shouldRecover = retryMode === "recover"
          && attempt === 2
          && ref.path.includes("/ledgers/ledger-retry-c/events");
        return {
          forEach(callback) {
            if (!shouldRecover) return;
            const data = retryEvents[2];
            callback({ id: data.eventId, data: () => JSON.parse(JSON.stringify(data)) });
          }
        };
      }
    }
  };

  const testApi = evalAppWithLedgerCloudTestApi(window);
  await waitForApp(window, 50);

  retryEvents = ["a", "b", "c"].map((suffix, index) => ledgerDepositEvent(8000 + index, {
    eventId: `retry-event-${suffix}`
  }));
  const retryFingerprints = retryEvents.map((_event, index) => (
    testApi.fingerprint([retryEvents[index]])
  ));
  retryHeads = ["a", "b", "c"].map((suffix, index) => emptyCloudState({
    revision: index + 10,
    ledgerId: `ledger-retry-${suffix}`,
    eventCount: 1,
    eventFingerprint: retryFingerprints[index]
  }));

  retryMode = "recover";
  getDocsAttempts = 0;
  const recovered = await testApi.readCloudStateConsistently();
  assert.equal(getDocsAttempts, 3, "an incomplete moving head must be retried instead of failing immediately");
  assert.equal(recovered.data.ledgerMeta.activeLedgerId, "ledger-retry-c");
  assert.deepEqual(
    JSON.parse(JSON.stringify(recovered.data.events.map((event) => event.eventId))),
    ["retry-event-c"]
  );

  retryMode = "exhaust";
  getDocsAttempts = 0;
  await assert.rejects(
    testApi.readCloudStateConsistently(),
    (error) => ["assettrail/cloud-ledger-incomplete", "assettrail/cloud-ledger-moving"].includes(error?.code)
  );
  assert.equal(getDocsAttempts, 3, "incomplete cloud reads must stop after three attempts");
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
    schemaVersion: 6,
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

  await dispatchImport(window, jsonFile(window, {
    assets: [],
    snapshots: [],
    watchlist: [{ id: "invalid-watch", name: "잘못된 관심종목", type: "CASH", ticker: "CASH" }]
  }, "invalid-watchlist.json"));
  assert.equal(window.localStorage.getItem(STORAGE_KEY), beforeInvalidImport);
  assert.equal(downloads.length, 0);
  assert.match(alerts.at(-1), /watchlist\[0\]\.type/);

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
    watchlist: [{
      id: "legacy-watch",
      name: "Microsoft",
      type: "US",
      ticker: "msft",
      investmentRole: "STRUCTURAL_GROWTH",
      thesis: "클라우드 성장",
      nextReviewAt: "2026-09-01"
    }],
    retirement: {}
  }, "valid-v1.json"));

  const recovered = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /^finance-ledger-recovery-before-import-/);
  assert.equal(recovered.schemaVersion, 5);
  assert.equal(recovered.assets[0].id, "recovered-cash");
  assert.equal(recovered.watchlist[0].ticker, "MSFT");
  assert.equal(recovered.decisionProfiles[0].subjectKey, "INSTRUMENT:US:MSFT");
  assert.equal(recovered.decisionProfiles[0].thesis, "클라우드 성장");
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
  const eventDocs = new Map();
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
      collection: (_db, ...path) => ({ path: path.join("/") }),
      getDoc: async () => ({
        exists: () => true,
        data: () => JSON.parse(JSON.stringify(remoteData))
      }),
      getFirestore: () => ({ app: "test" }),
      getDocs: async (ref) => ({
        forEach(callback) {
          for (const [path, data] of eventDocs) {
            if (!path.startsWith(`${ref.path}/`)) continue;
            callback({ id: path.split("/").at(-1), data: () => JSON.parse(JSON.stringify(data)) });
          }
        }
      }),
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
          if (ref.path === "users/alice/financeData/primary") {
            remoteData = JSON.parse(JSON.stringify(data));
          }
          if (ref.path.includes("/events/")) eventDocs.set(ref.path, JSON.parse(JSON.stringify(data)));
        }
      }),
      setDoc: async (ref, data) => {
        if (ref.path.includes("/events/")) eventDocs.set(ref.path, JSON.parse(JSON.stringify(data)));
      }
    }
  };

  window.eval(appCode);
  await waitForApp(window, 50);
  const primaryTransactionWrites = () => transactionWrites.filter((write) => write.path === "users/alice/financeData/primary");
  assert.equal(primaryTransactionWrites().length, 1, "legacy remote state must be promoted immediately after download");
  assert.equal(primaryTransactionWrites()[0].data.schemaVersion, 5);
  assert.equal(primaryTransactionWrites()[0].data.revision, 5);
  assert.equal(primaryTransactionWrites()[0].data.meta.cloudRevision, 5);
  assert.equal(primaryTransactionWrites()[0].options.merge, false);
  assert.equal(transactionWrites.filter((write) => write.path.includes("/ledgers/") && write.path.includes("/events/")).length, 1);
  assert.equal(transactionWrites.some((write) => write.path.includes("/backups/schema-v2-revision-4")), true);

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
  assert.equal(primaryTransactionWrites().length, 2);
  assert.equal(primaryTransactionWrites()[1].data.schemaVersion, 5);
  assert.equal(primaryTransactionWrites()[1].data.revision, 6);
  assert.equal(primaryTransactionWrites()[1].data.meta.cloudRevision, 6);
  assert.equal(primaryTransactionWrites()[1].options.merge, false);
  const firstLedgerWrites = transactionWrites.filter((write) => write.path.includes("/ledgers/") && write.path.includes("/events/"));
  assert.equal(firstLedgerWrites.length, 2);
  assert.equal(firstLedgerWrites.every((write) => write.path.endsWith(`/${write.data.eventId}`)), true);
  assert.equal(transactionWrites.at(-1).path, "users/alice/financeData/primary");

  remoteData = {
    ...remoteData,
    revision: 7,
    meta: { ...remoteData.meta, cloudRevision: 7 },
    updatedAt: "2026-07-30T01:00:00.000Z"
  };
  addCash("충돌 중 로컬 현금", 3000000);
  await waitForApp(window, 50);
  assert.equal(primaryTransactionWrites().length, 2);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "동기화 충돌");
  let localState = JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:user:alice`));
  assert.equal(localState.meta.cloudRevision, 6);
  assert.equal(localState.meta.syncErrorCode, "assettrail/cloud-conflict");
  assert.equal(localState.assets.some((asset) => asset.name === "충돌 중 로컬 현금"), true);

  remoteData = {
    ...remoteData,
    revision: 6,
    meta: { ...remoteData.meta, cloudRevision: 6 }
  };
  conflictChoice = "upload";
  window.document.querySelector("#cloudSyncBtn").click();
  await waitForApp(window, 50);
  assert.equal(primaryTransactionWrites().length, 3);
  transactionWrites.length = 0;
  for (let index = 0; index < 92; index += 1) {
    addCash(`대용량 메모 ${index + 1}`, 1000, "x".repeat(10000));
  }
  await waitForApp(window, 200);
  assert.equal(primaryTransactionWrites().length, 0);
  assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드 용량 초과");
  assert.match(window.document.querySelector("#appNotice").textContent, /900KB/);
  localState = JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:user:alice`));
  assert.equal(localState.meta.syncErrorCode, "assettrail/cloud-payload-too-large");
  assert.equal(alerts.length, 0);
  dom.window.close();
}
