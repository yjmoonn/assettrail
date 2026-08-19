import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appSource = readFileSync("app.js", "utf8");
const appCode = [
  "decision-engine.js",
  "action-engine.js",
  "ledger-engine.js",
  "performance-engine.js",
  "ai-review-export-engine.js",
  "app.js"
].map((path) => readFileSync(path, "utf8")).join("\n");

function sourceBetween(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from + start.length);
  assert.ok(from >= 0, `${start} should exist`);
  assert.ok(to > from, `${end} should follow ${start}`);
  return appSource.slice(from, to);
}

// The settings DOM and static script order expose one explicit, manual export action.
const staticDom = new JSDOM(html);
const staticButton = staticDom.window.document.querySelector("#exportAiCheckPackageBtn");
const staticStatus = staticDom.window.document.querySelector("#aiCheckPackageStatus");
assert.ok(staticButton);
assert.equal(staticButton.type, "button");
assert.match(staticButton.textContent, /AI 점검 패키지 내보내기/);
assert.ok(staticStatus);
assert.equal(staticStatus.getAttribute("role"), "status");
assert.equal(staticStatus.getAttribute("aria-live"), "polite");

const scriptSources = [...staticDom.window.document.querySelectorAll("script[src]")]
  .map((script) => script.getAttribute("src"));
const reviewEngineScriptIndex = scriptSources.findIndex((src) => src.startsWith("ai-review-export-engine.js"));
const appScriptIndex = scriptSources.findIndex((src) => src.startsWith("app.js"));
assert.ok(reviewEngineScriptIndex >= 0);
assert.ok(appScriptIndex > reviewEngineScriptIndex);

// buildAiReviewInput maps existing deterministic calculations into the engine allowlist contract.
const inputSource = sourceBetween("function buildAiReviewInput", "function aiReviewMarkdown");
[
  "generatedAt",
  "asOfDate",
  "dataQuality",
  "marketPositionCount",
  "pricedPositionCount",
  "missingPriceCount",
  "portfolio",
  "allocation",
  "positions",
  "concentration",
  "targetComparison",
  "performance",
  "goal",
  "reviewStatus"
].forEach((field) => assert.match(inputSource, new RegExp(`\\b${field}\\b`), `${field} mapping should exist`));

const positionSource = sourceBetween("function aiReviewMarketPositions", "function aiReviewPerformance");
["market", "ticker", "kind", "weightPct", "priceReturnPct", "priceAsOf", "quality"]
  .forEach((field) => assert.match(positionSource, new RegExp(`\\b${field}\\b`), `${field} position field should exist`));
assert.match(positionSource, /const kind = assetKind\(asset\)/, "position kind must use the price/symbol-aware resolver");

const markdownSource = sourceBetween("function aiReviewMarkdown", "function exportAiReviewPackage");
assert.match(markdownSource, /```json/);
assert.match(markdownSource, /JSON\.stringify\(reviewPackage, null, 2\)/);

const exportSource = sourceBetween("function exportAiReviewPackage", "function externalEvidenceStatus");
assert.match(exportSource, /buildReviewPackage\(buildAiReviewInput\(\)\)/);
assert.match(exportSource, /validateReviewPackage\(reviewPackage\)/);
assert.match(exportSource, /assettrail-ai-review-/);
assert.match(exportSource, /\.md`/);
assert.match(exportSource, /text\/markdown;charset=utf-8/);
assert.match(appSource, /exportAiCheckPackageBtn\?\.addEventListener\("click", exportAiReviewPackage\)/);

const downloads = [];
let activeBlob = null;
let fetchCount = 0;
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

class CapturedBlob {
  constructor(parts, options = {}) {
    this.parts = parts.map((part) => String(part));
    this.type = String(options.type || "");
    this.size = this.parts.join("").length;
  }

  async text() {
    return this.parts.join("");
  }
}

window.Blob = CapturedBlob;
window.URL.createObjectURL = (blob) => {
  activeBlob = blob;
  return `blob:assettrail-ai-review-${downloads.length}`;
};
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function click() {
  downloads.push({ filename: this.download, blob: activeBlob, mimeType: activeBlob?.type || "" });
};
window.alert = (message) => {
  throw new Error(`Unexpected alert: ${message}`);
};
window.confirm = () => true;
window.console.error = () => {};
window.console.warn = () => {};
window.firebaseConfig = {};
window.fetch = async () => {
  fetchCount += 1;
  return {
    ok: true,
    json: async () => ({
      generatedAt: "2026-08-19T00:00:00.000Z",
      fx: { USDKRW: { date: "2026-08-18", rate: 1300 } },
      prices: { KRX: {}, US: {} },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  };
};

window.eval(`${appCode}
  window.__aiReviewExportTestApi = {
    setupPortfolio() {
      state.assets = [
        normalizeAsset({
          id: "sensitive-asset-id-a",
          name: "sensitive-user-company-name",
          ticker: "005930",
          type: "KRX",
          account: "sensitive-retirement-account-a",
          quantity: 2,
          averagePrice: 50000,
          note: "sensitive-asset-note-a",
          kind: "STOCK"
        }),
        normalizeAsset({
          id: "sensitive-asset-id-b",
          name: "sensitive-user-company-name-duplicate",
          ticker: "005930",
          type: "KRX",
          account: "sensitive-retirement-account-b",
          quantity: 1,
          averagePrice: 55000,
          note: "sensitive-asset-note-b",
          kind: "STOCK"
        }),
        normalizeAsset({
          id: "sensitive-us-asset-id",
          name: "sensitive-us-name",
          ticker: "MSFT",
          type: "US",
          account: "sensitive-us-account",
          quantity: 1,
          averagePrice: 180,
          note: "sensitive-us-note",
          kind: "STOCK"
        }),
        normalizeAsset({
          id: "ui-created-etf-id",
          name: "ui-created-etf-name",
          ticker: "069500",
          type: "KRX",
          account: "sensitive-etf-account",
          quantity: 3,
          averagePrice: 90,
          note: "sensitive-etf-note"
        }),
        normalizeAsset({
          id: "sensitive-cash-id",
          name: "sensitive-cash-name",
          type: "CASH",
          account: "sensitive-cash-account",
          amount: 100000,
          note: "sensitive-cash-note"
        }),
        normalizeAsset({
          id: "sensitive-manual-id",
          name: "sensitive-manual-name",
          type: "MANUAL",
          account: "sensitive-manual-account",
          amount: 50000,
          note: "sensitive-manual-note"
        })
      ];
      state.events = [{
        eventId: "sensitive-event-id",
        accountId: "sensitive-event-account",
        note: "sensitive-event-note"
      }];
      state.tradeJournalEntries = [{
        id: "sensitive-journal-id",
        reason: "sensitive-journal-reason",
        risk: "sensitive-journal-risk",
        review: "sensitive-journal-review"
      }];
      state.decisionProfiles = [{
        id: "sensitive-profile-id",
        thesis: "sensitive-investment-thesis",
        catalysts: "sensitive-investment-catalysts"
      }];
      state.snapshots = [{
        id: "sensitive-snapshot-id",
        createdAt: "2026-07-31T00:00:00.000Z",
        total: 1,
        note: "sensitive-snapshot-note",
        typeTotals: {}
      }];
      state.performanceObservations = [];
      state.portfolioTargets = { domestic: 5, overseas: 15, cash: 30, manual: 50 };
      cloud.user = { uid: "sensitive-user-uid", email: "sensitive-user@example.com" };
      priceBook = {
        ...priceBook,
        loaded: true,
        generatedAt: "2026-08-19T00:00:00.000Z",
        fx: { USDKRW: { date: "2026-08-18", rate: 1300 } },
        prices: {
          KRX: {
            "005930": { close: 60000, date: "2026-08-18", kind: "STOCK", source: "TEST" },
            "069500": { close: 100, date: "2026-08-18", kind: "ETF", source: "TEST" }
          },
          US: {
            MSFT: { close: 200, date: "2026-08-18", kind: "STOCK", source: "TEST" }
          }
        },
        symbols: { KRX: {}, US: {} }
      };
      applyPricesToAssets();
    },
    clearPortfolio() {
      state.assets = [];
      state.events = [];
      state.tradeJournalEntries = [];
      state.decisionProfiles = [];
      state.snapshots = [];
      state.performanceObservations = [];
    },
    input() {
      return JSON.parse(JSON.stringify(buildAiReviewInput("2026-08-19T01:02:03.000Z")));
    }
  };
`);

await new Promise((resolve) => window.setTimeout(resolve, 40));
window.__aiReviewExportTestApi.setupPortfolio();

// The app-side mapping aggregates accounts and emits only the engine's derived allowlist.
const mappedInput = window.__aiReviewExportTestApi.input();
assert.deepEqual(Object.keys(mappedInput).sort(), [
  "asOfDate",
  "dataQuality",
  "generatedAt",
  "goal",
  "performance",
  "portfolio",
  "reviewStatus"
]);
assert.equal(mappedInput.portfolio.positions.length, 3);
assert.deepEqual(
  Array.from(mappedInput.portfolio.positions, (position) => `${position.market}:${position.ticker}`),
  ["KRX:005930", "KRX:069500", "US:MSFT"]
);
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.ticker === "069500")?.kind,
  "ETF",
  "an asset created without a persisted kind must inherit ETF metadata from the price book"
);
mappedInput.portfolio.positions.forEach((position) => {
  assert.deepEqual(Object.keys(position).sort(), [
    "kind",
    "market",
    "priceAsOf",
    "priceReturnPct",
    "quality",
    "ticker",
    "weightPct"
  ]);
});
assert.equal(mappedInput.portfolio.targetComparison.status, "DEFAULT_NOT_CONFIRMED");
mappedInput.portfolio.targetComparison.items.forEach((row) => {
  assert.equal(row.targetPct, null, "hidden legacy targets must not be exported");
  assert.equal(row.gapPctPoint, null, "hidden legacy target gaps must not be exported");
});

const mappedSerialized = JSON.stringify(mappedInput);
[
  "sensitive-user-uid",
  "sensitive-user@example.com",
  "sensitive-retirement-account-a",
  "sensitive-retirement-account-b",
  "sensitive-us-account",
  "sensitive-etf-account",
  "sensitive-cash-account",
  "sensitive-manual-account",
  "sensitive-asset-id-a",
  "sensitive-event-id",
  "sensitive-event-note",
  "sensitive-journal-reason",
  "sensitive-investment-thesis",
  "sensitive-snapshot-note"
].forEach((secret) => assert.equal(mappedSerialized.includes(secret), false, `mapped input leaked ${secret}`));

const fetchCountBeforeExport = fetchCount;
const storageBeforeExport = window.localStorage.getItem("finance-ledger-retirement-v1");
window.document.querySelector("#exportAiCheckPackageBtn").click();
assert.equal(downloads.length, 1);
assert.equal(downloads[0].filename, "assettrail-ai-review-2026-08-18.md");
assert.equal(downloads[0].mimeType, "text/markdown;charset=utf-8");
assert.equal(fetchCount, fetchCountBeforeExport);
assert.equal(window.localStorage.getItem("finance-ledger-retirement-v1"), storageBeforeExport);

const markdown = await downloads[0].blob.text();
assert.match(markdown, /^# AssetTrail AI 월간 점검 패키지/m);
const fencedJson = markdown.match(/```json\n([\s\S]+)\n```/);
assert.ok(fencedJson);
assert.match(markdown, /"schemaVersion": "ASSETTRAIL_AI_REVIEW_V1"/);
assert.match(markdown, /"promptVersion": "ASSETTRAIL_MONTHLY_REVIEW_PROMPT_V1"/);
assert.match(markdown, /개인 자산 현황을 월간 점검하는 도우미/);
assert.match(markdown, /각 핵심 주장 뒤에는 근거가 된 JSON 경로를 표시하세요/);
assert.match(markdown, /"networkRequestPerformed": false/);
assert.match(markdown, /"storageWritePerformed": false/);
const downloadedPackage = window.JSON.parse(fencedJson[1]);
assert.equal(window.AssetTrailAiReviewExportEngine.validateReviewPackage(downloadedPackage).ok, true);
assert.equal(downloadedPackage.privacy.absoluteAmountsIncluded, false);
assert.equal(downloadedPackage.privacy.accountNamesIncluded, false);
assert.equal(downloadedPackage.privacy.transactionRowsIncluded, false);
assert.equal(downloadedPackage.privacy.freeTextIncluded, false);
assert.deepEqual(
  Array.from(downloadedPackage.portfolio.positions, (position) => position.instrumentKey),
  ["KRX:005930", "KRX:069500", "US:MSFT"]
);
assert.equal(downloadedPackage.portfolio.targetComparison.status, "DEFAULT_NOT_CONFIRMED");
downloadedPackage.portfolio.targetComparison.items.forEach((row) => {
  assert.equal(row.targetPct, null);
  assert.equal(row.gapPctPoint, null);
});

[
  "sensitive-user-uid",
  "sensitive-user@example.com",
  "sensitive-user-company-name",
  "sensitive-retirement-account-a",
  "sensitive-asset-note-a",
  "sensitive-event-note",
  "sensitive-journal-reason",
  "sensitive-investment-thesis",
  "sensitive-snapshot-note"
].forEach((secret) => assert.equal(markdown.includes(secret), false, `download leaked ${secret}`));
assert.match(window.document.querySelector("#aiCheckPackageStatus").textContent, /점검 파일을 만들었습니다/);

// An empty portfolio is a clear no-op: no file and a useful status message.
window.__aiReviewExportTestApi.clearPortfolio();
const downloadCountBeforeEmptyClick = downloads.length;
window.document.querySelector("#exportAiCheckPackageBtn").click();
assert.equal(downloads.length, downloadCountBeforeEmptyClick);
assert.equal(window.document.querySelector("#aiCheckPackageStatus").textContent, "자산을 먼저 등록하세요.");

console.log("app AI review export tests passed");
