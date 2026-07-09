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
    prices: {
      KRX: {
        "0092B0": {
          close: 19645,
          date: "2026-05-19",
          name: "SOL 한국원자력SMR",
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
    browserLocalPersistence: {},
    getAuth: () => ({ app: "test" }),
    GoogleAuthProvider: class GoogleAuthProvider {},
    getRedirectResult: async () => null,
    onAuthStateChanged: (_auth, callback) => {
      setTimeout(() => callback({ uid: "alice", email: "alice@example.com" }), 5);
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
      data: () => ({
        assets: [
          {
            id: "smr",
            name: "SOL한국원자력SMR",
            ticker: "0092B0",
            type: "KRX",
            quantity: 2,
            averagePrice: 18000
          }
        ],
        retirement: {},
        snapshots: []
      })
    }),
    getFirestore: () => ({ app: "test" }),
    arrayUnion: (...values) => ({ __arrayUnion: values }),
    setDoc: async () => {}
  }
};

window.eval(appCode);
await new Promise((resolve) => window.setTimeout(resolve, 30));

window.document.querySelector('[data-nav-view="ASSETS"]').click();
const rowText = window.document.querySelector("#assetRows").textContent.replace(/\s+/g, " ").trim();

assert.equal(window.document.querySelector("#syncStatus").textContent, "클라우드: alice@example.com");
assert.equal(window.document.querySelector("#totalAsset").textContent, "₩39,290");
assert.match(rowText, /SOL한국원자력SMR 0092B0 KRX 국내 2 ₩39,290종가 19,645 · 5월 19일 ▲ \+₩3,290/);
assert.doesNotMatch(rowText, /가격 대기/);
