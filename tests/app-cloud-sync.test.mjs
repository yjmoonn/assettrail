import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = readFileSync("app.js", "utf8");

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
  setLineDash() {},
  stroke() {},
  strokeRect() {}
});

window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-05-19T00:00:00.000Z",
    prices: {
      KRX: {
        "005930": {
          close: 74000,
          date: "2026-05-18",
          source: "KRX"
        }
      },
      US: {}
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

assert.equal(window.document.querySelector("#syncStatus").textContent, "Cloud: alice@example.com");
assert.equal(writes.filter((write) => write.path === "users/alice/financeData/primary").length, 0);
assert.doesNotMatch(window.document.querySelector("#assetRows").textContent, /게스트 로컬 자산/);

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
assert.equal(lastWrite.options.merge, true);
assert.equal(lastWrite.path, "users/alice/financeData/primary");
assert.equal(lastWrite.data.assets.length, 2);
assert.equal(lastWrite.data.assets[0].ticker, "005930");
assert.equal(lastWrite.data.assets[0].type, "KRX");
assert.equal(lastWrite.data.assets[0].account, "삼성증권");
assert.equal(lastWrite.data.assets[0].currentPrice, undefined);
assert.equal(lastWrite.data.assets[1].ticker, "TSLA");
assert.equal(lastWrite.data.assets[1].type, "US");
assert.equal(lastWrite.data.snapshots.length, 1);
assert.equal(lastWrite.data.snapshots[0].total, 222000);
assert.equal(lastWrite.data.retirement.monthlySpend, 4200000);
assert.match(lastWrite.data.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
const userLocalState = JSON.parse(window.localStorage.getItem("finance-ledger-retirement-v1:user:alice"));
assert.equal(userLocalState.assets.length, 2);
assert.equal(userLocalState.assets[0].ticker, "005930");

const priceRequestWrite = writes.filter((write) => write.path === "priceRequests/us").at(-1);
assert.deepEqual(priceRequestWrite.data.tickers.__arrayUnion, ["TSLA"]);
assert.equal(priceRequestWrite.options.merge, true);
assert.match(priceRequestWrite.data.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
