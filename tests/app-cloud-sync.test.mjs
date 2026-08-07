import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "https://yjmoonn.github.io/assettrail/"
});

const { window } = dom;
const writes = [];

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

window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-05-19T00:00:00.000Z",
    fx: {
      USDKRW: {
        date: "2026-05-18",
        rate: 1300,
        source: "yfinance KRW=X"
      }
    },
    prices: {
      KRX: {
        "005930": {
          close: 74000,
          date: "2026-05-18",
          source: "KRX"
        }
      },
      US: {
        TSLA: {
          close: 250,
          date: "2026-05-18",
          source: "yfinance"
        }
      }
    }
  })
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
    getDoc: async () => ({
      exists: () => false
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

window.localStorage.setItem(
  "finance-ledger-retirement-v1",
  JSON.stringify({
    assets: [
      {
        id: "guest-asset",
        name: "게스트 로컬 자산",
        ticker: "005930",
        type: "KRX",
        account: "공용 브라우저",
        quantity: 1,
        averagePrice: 70000
      }
    ],
    snapshots: [],
    retirement: {}
  })
);
window.localStorage.setItem(
  "finance-ledger-retirement-v1:user:alice",
  JSON.stringify({
    assets: [],
    snapshots: [],
    watchlist: [{
      id: "watch-local",
      name: "Apple",
      ticker: "AAPL",
      type: "US"
    }],
    decisionProfiles: [{
      id: "INSTRUMENT:US:AAPL",
      subjectKey: "INSTRUMENT:US:AAPL",
      name: "Apple",
      ticker: "AAPL",
      type: "US",
      investmentRole: "STRUCTURAL_GROWTH",
      thesis: "서비스 성장",
      nextReviewAt: "2026-09-01",
      riskTags: {
        industry: ["소프트웨어"],
        country: ["미국"],
        aiValueChain: ["AI 응용 서비스"]
      }
    }],
    policyProfile: {
      allocationBands: {
        domestic: { minPct: 35, targetPct: 45, maxPct: 55 },
        overseas: { minPct: 25, targetPct: 35, maxPct: 45 },
        cash: { minPct: 5, targetPct: 10, maxPct: 20 },
        manual: { minPct: 0, targetPct: 10, maxPct: 20 }
      },
      riskBudgets: {
        coreMinPct: 45,
        satelliteMaxPct: 55,
        aiStructuralMaxPct: 20,
        cycleMaxPct: 20
      }
    },
    contributionPlan: { mode: "MONTHLY", amount: 1500000 },
    retirementScenarios: [{
      id: "local-plan",
      name: "로컬 은퇴 계획",
      input: {
        currentAge: 35,
        retireAge: 55,
        lifeAge: 90,
        currentInvestable: 0,
        monthlyInvest: 1000000,
        monthlySpend: 3500000,
        inflationRate: 2,
        postReturnRate: 3.5
      },
      updatedAt: "2026-07-30T00:00:00.000Z"
    }],
    retirement: {}
  })
);

window.assetTrailCloudPushDelayMs = 0;
window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 20));

function setValue(selector, value) {
  const element = window.document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function submitAsset() {
  window.document
    .querySelector("#assetForm")
    .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드: alice@example.com");
const initialUserWrite = writes.filter((write) => write.path === "users/alice/financeData/primary");
assert.equal(initialUserWrite.length, 1);
assert.equal(initialUserWrite[0].data.revision, 1);
assert.equal(initialUserWrite[0].data.watchlist[0].id, "watch-local");
assert.equal(initialUserWrite[0].data.decisionProfiles[0].subjectKey, "INSTRUMENT:US:AAPL");
assert.equal(initialUserWrite[0].data.decisionProfiles[0].thesis, "서비스 성장");
assert.deepEqual(initialUserWrite[0].data.decisionProfiles[0].riskTags.aiValueChain, ["AI 응용 서비스"]);
assert.equal(initialUserWrite[0].data.policyProfile.allocationBands.domestic.targetPct, 45);
assert.equal(initialUserWrite[0].data.portfolioTargets.domestic, 45);
assert.deepEqual(initialUserWrite[0].data.contributionPlan, { mode: "MONTHLY", amount: 1500000 });
assert.equal(initialUserWrite[0].data.retirementScenarios[0].id, "local-plan");
assert.equal(initialUserWrite[0].options.merge, false);
assert.equal(
  JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1:user:alice"))
    .retirementScenarios[0].id,
  "local-plan"
);
writes.length = 0;
window.document.querySelector('[data-nav-view="ASSETS"]').click();
assert.doesNotMatch(window.document.querySelector("#assetRows").textContent, /게스트 로컬 자산/);
assert.doesNotMatch(window.document.querySelector("#assetRows").textContent, /이전 계정 캐시/);

setValue("#assetCategory", "KRX");
setValue("#assetName", "삼성전자");
setValue("#assetAccount", "삼성증권");
setValue("#assetTicker", "5930");
setValue("#assetQuantity", "3");
setValue("#assetAveragePrice", "70000");
submitAsset();
await new Promise((resolve) => window.setTimeout(resolve, 10));

setValue("#assetCategory", "US");
setValue("#assetName", "Tesla Inc.");
setValue("#assetTicker", "TSLA");
setValue("#assetQuantity", "2");
setValue("#assetAveragePrice", "200");
submitAsset();
await new Promise((resolve) => window.setTimeout(resolve, 10));

window.document.querySelector("#snapshotBtn").click();
await new Promise((resolve) => window.setTimeout(resolve, 10));

setValue("#monthlySpend", "4200000");
await new Promise((resolve) => window.setTimeout(resolve, 10));

const lastWrite = writes.filter((write) => write.path === "users/alice/financeData/primary").at(-1);
assert.equal(lastWrite.options.merge, false);
assert.equal(lastWrite.path, "users/alice/financeData/primary");
assert.equal(lastWrite.data.schemaVersion, 6);
assert.equal(lastWrite.data.revision >= 1, true);
assert.equal(lastWrite.data.meta.cloudRevision, lastWrite.data.revision);
assert.equal(lastWrite.data.assets.length, 2);
assert.equal(lastWrite.data.watchlist[0].ticker, "AAPL");
assert.equal(lastWrite.data.decisionProfiles[0].investmentRole, "STRUCTURAL_GROWTH");
assert.equal(lastWrite.data.assets[0].ticker, "005930");
assert.equal(lastWrite.data.assets[0].type, "KRX");
assert.equal(lastWrite.data.assets[0].account, "삼성증권");
assert.equal(lastWrite.data.assets[0].currentPrice, undefined);
assert.equal(lastWrite.data.assets[1].ticker, "TSLA");
assert.equal(lastWrite.data.assets[1].type, "US");
assert.equal(lastWrite.data.snapshots.length, 1);
assert.equal(lastWrite.data.snapshots[0].total, 872000);
assert.equal(lastWrite.data.snapshots[0].assets, undefined);
assert.deepEqual(
  Object.keys(lastWrite.data.snapshots[0]).sort(),
  ["createdAt", "id", "note", "total", "typeTotals"]
);
assert.equal(lastWrite.data.retirement.monthlySpend, 4200000);
assert.match(lastWrite.data.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
const userLocalState = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1:user:alice"));
assert.equal(userLocalState.schemaVersion, 6);
assert.equal(userLocalState.assets.length, 2);
assert.equal(userLocalState.assets[0].ticker, "005930");

assert.equal(
  writes.some((write) => write.path.startsWith("priceRequests/")),
  false,
  "client holdings must not be copied into a shared price-request document"
);
