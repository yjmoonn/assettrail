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
assert.equal(scriptSources[reviewEngineScriptIndex], "ai-review-export-engine.js?v=20260911-shared-review-input-v3");
assert.equal(scriptSources[appScriptIndex], "app.js?v=20260911-shared-review-input-v9");

// The browser delegates saved-valuation assembly to the same pure producer API.
const inputSource = sourceBetween("function buildAiReviewInput", "function aiReviewMarkdown");
assert.match(inputSource, /buildSnapshotReviewInput/);
assert.match(inputSource, /latestAiReviewSnapshot/);
assert.doesNotMatch(inputSource, /assetValue\(|priceForAsset\(/);

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
        total: 552785,
        note: "sensitive-snapshot-note",
        typeTotals: { KRX: 165285, US: 237500, CASH: 100000, MANUAL: 50000 },
        source: "QUICK_SNAPSHOT",
        nextReviewAt: null,
        qualityIssues: [],
        valuation: {
          schemaVersion: "assettrail.snapshot-valuation.v2",
          priceBookGeneratedAt: "2026-07-31T00:00:00.000Z",
          priceBasis: "UNADJUSTED_CLOSE",
          distributionTreatment: "EXCLUDED",
          valuationTiming: "LATEST_COMPLETED_SESSION",
          fx: {
            USDKRW: {
              rate: 1250,
              date: "2026-07-30",
              sessionStatus: "FINAL_CLOSE",
              source: "SNAPSHOT_TEST"
            }
          },
          positions: [
            {
              assetId: "sensitive-asset-id-a",
              assetType: "KRX",
              ticker: "005930",
              kind: "STOCK",
              accountClass: "ISA",
              accountName: "키움증권 ISA",
              valuationMode: "FINAL_CLOSE",
              quantity: 2,
              appliedPrice: 55000,
              priceCurrency: "KRW",
              priceAsOf: "2026-07-30",
              sessionStatus: "FINAL_CLOSE",
              marketValueKRW: 110000
            },
            {
              assetId: "sensitive-asset-id-b",
              assetType: "KRX",
              ticker: "005930",
              kind: "STOCK",
              accountClass: "GENERAL",
              accountName: "키움증권 일반",
              valuationMode: "FINAL_CLOSE",
              quantity: 1,
              appliedPrice: 55000,
              priceCurrency: "KRW",
              priceAsOf: "2026-07-30",
              sessionStatus: "FINAL_CLOSE",
              marketValueKRW: 55000
            },
            {
              assetId: "sensitive-us-asset-id",
              assetType: "US",
              ticker: "MSFT",
              kind: "STOCK",
              accountClass: "GENERAL",
              accountName: "미국주식 계좌",
              valuationMode: "FINAL_CLOSE",
              quantity: 1,
              appliedPrice: 190,
              priceCurrency: "USD",
              priceAsOf: "2026-07-30",
              sessionStatus: "FINAL_CLOSE",
              fxRate: 1250,
              fxAsOf: "2026-07-30",
              fxSessionStatus: "FINAL_CLOSE",
              marketValueKRW: 237500
            },
            {
              assetId: "ui-created-etf-id",
              assetType: "KRX",
              ticker: "069500",
              kind: "ETF",
              accountClass: "GENERAL",
              accountName: "국내 ETF 계좌",
              valuationMode: "FINAL_CLOSE",
              quantity: 3,
              appliedPrice: 95,
              priceCurrency: "KRW",
              priceAsOf: "2026-07-30",
              sessionStatus: "FINAL_CLOSE",
              marketValueKRW: 285
            },
            {
              assetId: "sensitive-cash-id",
              assetType: "CASH",
              accountClass: "GENERAL",
              accountName: "생활비 계좌",
              valuationMode: "MANUAL_AMOUNT",
              marketValueKRW: 100000
            },
            {
              assetId: "sensitive-manual-id",
              assetType: "MANUAL",
              accountClass: "PENSION",
              accountName: "퇴직연금 계좌",
              valuationMode: "MANUAL_AMOUNT",
              marketValueKRW: 50000
            }
          ]
        }
      }];
      state.assets[0].account = "조회 기록 저장 후 바뀐 계좌명";
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
            "069500": { close: 100, date: "2026-08-18", kind: "STOCK", source: "TEST" }
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
    setAccountlessValuationSnapshot() {
      const snapshot = JSON.parse(JSON.stringify(state.snapshots[0]));
      snapshot.id = "accountless-valuation-snapshot-id";
      snapshot.valuation.schemaVersion = "assettrail.snapshot-valuation.v1";
      snapshot.valuation.positions.forEach((position) => delete position.accountName);
      state.snapshots = [normalizeSnapshot(snapshot)];
    },
    setLegacySnapshot() {
      state.snapshots = [{
        id: "legacy-snapshot-id",
        createdAt: "2026-07-30T00:00:00.000Z",
        total: 777000,
        note: "legacy-sensitive-note",
        typeTotals: { KRX: 777000 },
        source: "LEGACY_SNAPSHOT",
        nextReviewAt: null,
        qualityIssues: []
      }];
    },
    input() {
      return JSON.parse(JSON.stringify(buildAiReviewInput("2026-08-19T01:02:03.000Z")));
    }
  };
`);

await new Promise((resolve) => window.setTimeout(resolve, 40));
window.__aiReviewExportTestApi.setupPortfolio();

// The app-side mapping uses the latest stored valuation, keeps saved account rows separate,
// and never substitutes current account labels or the newer in-memory price book.
const mappedInput = window.__aiReviewExportTestApi.input();
assert.deepEqual(Object.keys(mappedInput).sort(), [
  "asOfDate",
  "dataQuality",
  "generatedAt",
  "goal",
  "performance",
  "portfolio",
  "reviewStatus",
  "snapshotCreatedAt",
  "snapshotId",
  "valuationStatus"
]);
assert.equal(mappedInput.snapshotId, "sensitive-snapshot-id");
assert.equal(mappedInput.snapshotCreatedAt, "2026-07-31T00:00:00.000Z");
assert.equal(mappedInput.valuationStatus, "SNAPSHOT_VALUATION_AVAILABLE");
assert.equal(mappedInput.asOfDate, "2026-07-31");
assert.equal(mappedInput.dataQuality.status, "STALE", "an old saved price date must remain stale at export time");
assert.equal(mappedInput.portfolio.totalMarketValueKRW, 552785);
assert.equal(mappedInput.portfolio.positions.length, 6);
assert.deepEqual(
  Array.from(mappedInput.portfolio.positions, (position) => (
    `${position.assetType}:${position.ticker || ""}:${position.accountClass}:${position.accountName}`
  )),
  [
    "CASH::GENERAL:생활비 계좌",
    "KRX:005930:GENERAL:키움증권 일반",
    "KRX:005930:ISA:키움증권 ISA",
    "KRX:069500:GENERAL:국내 ETF 계좌",
    "MANUAL::PENSION:퇴직연금 계좌",
    "US:MSFT:GENERAL:미국주식 계좌"
  ]
);
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.ticker === "069500")?.kind,
  "ETF",
  "the saved valuation must preserve ETF metadata independently of the current price book"
);
mappedInput.portfolio.positions.forEach((position) => {
  assert.deepEqual(Object.keys(position).sort(), [
    "kind",
    "accountClass",
    "accountName",
    "appliedPrice",
    "assetType",
    "fxAsOf",
    "fxRate",
    "fxSessionStatus",
    "market",
    "marketValueKRW",
    "priceAsOf",
    "priceCurrency",
    "priceReturnPct",
    "quality",
    "quantity",
    "sessionStatus",
    "ticker",
    "valuationMode",
    "weightPct"
  ].sort());
});
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.quantity,
  2
);
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.appliedPrice,
  55000
);
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.marketValueKRW,
  110000
);
assert.equal(
  mappedInput.portfolio.positions.find((position) => position.accountName === "키움증권 일반")?.marketValueKRW,
  55000
);
assert.equal(mappedInput.portfolio.positions.find((position) => position.ticker === "MSFT")?.marketValueKRW, 237500);
assert.equal(mappedInput.portfolio.positions.find((position) => position.ticker === "MSFT")?.fxRate, 1250);
assert.equal(mappedInput.portfolio.positions.find((position) => position.assetType === "CASH")?.marketValueKRW, 100000);
assert.equal(mappedInput.portfolio.positions.find((position) => position.assetType === "MANUAL")?.accountClass, "PENSION");
assert.equal(
  mappedInput.portfolio.positions.reduce((sum, position) => sum + position.marketValueKRW, 0),
  mappedInput.portfolio.totalMarketValueKRW
);
assert.equal(mappedInput.portfolio.targetComparison.status, "DEFAULT_NOT_CONFIRMED");
mappedInput.portfolio.targetComparison.items.forEach((row) => {
  assert.equal(row.targetPct, null, "hidden legacy targets must not be exported");
  assert.equal(row.gapPctPoint, null, "hidden legacy target gaps must not be exported");
});

const mappedSerialized = JSON.stringify(mappedInput);
[
  "sensitive-user-uid",
  "sensitive-user@example.com",
  "조회 기록 저장 후 바뀐 계좌명",
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
assert.equal(downloads[0].filename, "assettrail-ai-review-2026-07-31.md");
assert.equal(downloads[0].mimeType, "text/markdown;charset=utf-8");
assert.equal(fetchCount, fetchCountBeforeExport);
assert.equal(window.localStorage.getItem("finance-ledger-retirement-v1"), storageBeforeExport);

const markdown = await downloads[0].blob.text();
assert.match(markdown, /^# AssetTrail AI 월간 점검 패키지/m);
const fencedJson = markdown.match(/```json\n([\s\S]+)\n```/);
assert.ok(fencedJson);
assert.match(markdown, /"schemaVersion": "ASSETTRAIL_AI_REVIEW_V3"/);
assert.match(markdown, /"promptVersion": "ASSETTRAIL_MONTHLY_REVIEW_PROMPT_V3"/);
assert.match(markdown, /개인 자산 현황을 월간 점검하는 도우미/);
assert.match(markdown, /각 핵심 주장 뒤에는 근거가 된 JSON 경로를 표시하세요/);
assert.match(markdown, /"networkRequestPerformed": false/);
assert.match(markdown, /"storageWritePerformed": false/);
const downloadedPackage = window.JSON.parse(fencedJson[1]);
assert.equal(window.AssetTrailAiReviewExportEngine.validateReviewPackage(downloadedPackage).ok, true);
assert.equal(downloadedPackage.privacy.absoluteAmountsIncluded, true);
assert.equal(downloadedPackage.privacy.quantitiesIncluded, true);
assert.equal(downloadedPackage.privacy.accountNamesIncluded, true);
assert.equal(downloadedPackage.privacy.transactionRowsIncluded, false);
assert.equal(downloadedPackage.privacy.freeTextIncluded, false);
assert.equal(downloadedPackage.snapshotId, "sensitive-snapshot-id");
assert.equal(downloadedPackage.snapshotCreatedAt, "2026-07-31T00:00:00.000Z");
assert.equal(downloadedPackage.valuationStatus, "SNAPSHOT_VALUATION_AVAILABLE");
assert.equal(downloadedPackage.portfolio.totalMarketValueKRW, 552785);
assert.deepEqual(
  Array.from(downloadedPackage.portfolio.positions, (position) => position.instrumentKey),
  ["CASH", "KRX:005930", "KRX:005930", "KRX:069500", "MANUAL", "US:MSFT"]
);
assert.equal(downloadedPackage.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.quantity, 2);
assert.equal(downloadedPackage.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.appliedPrice, 55000);
assert.equal(downloadedPackage.portfolio.positions.find((position) => position.accountName === "키움증권 ISA")?.accountClass, "ISA");
assert.equal(downloadedPackage.portfolio.positions.find((position) => position.ticker === "MSFT")?.fxRate, 1250);
assert.equal(downloadedPackage.portfolio.positions.find((position) => position.assetType === "CASH")?.market, null);
assert.equal(downloadedPackage.portfolio.targetComparison.status, "DEFAULT_NOT_CONFIRMED");
downloadedPackage.portfolio.targetComparison.items.forEach((row) => {
  assert.equal(row.targetPct, null);
  assert.equal(row.gapPctPoint, null);
});

[
  "sensitive-user-uid",
  "sensitive-user@example.com",
  "sensitive-user-company-name",
  "조회 기록 저장 후 바뀐 계좌명",
  "sensitive-asset-note-a",
  "sensitive-event-note",
  "sensitive-journal-reason",
  "sensitive-investment-thesis",
  "sensitive-snapshot-note"
].forEach((secret) => assert.equal(markdown.includes(secret), false, `download leaked ${secret}`));
[
  "키움증권 ISA",
  "키움증권 일반",
  "미국주식 계좌",
  "국내 ETF 계좌",
  "생활비 계좌",
  "퇴직연금 계좌"
].forEach((accountName) => assert.equal(markdown.includes(accountName), true, `saved account name missing: ${accountName}`));
assert.match(window.document.querySelector("#aiCheckPackageStatus").textContent, /점검 파일을 만들었습니다/);

// A v1 valuation keeps its saved quantities and values, but never guesses historical account names.
window.__aiReviewExportTestApi.setAccountlessValuationSnapshot();
const accountlessInput = window.__aiReviewExportTestApi.input();
assert.equal(accountlessInput.valuationStatus, "MISSING_SNAPSHOT_ACCOUNT_NAMES");
assert.equal(accountlessInput.portfolio.positions.length, 6);
accountlessInput.portfolio.positions.forEach((position) => assert.equal(position.accountName, ""));
const accountlessDownloadsBefore = downloads.length;
window.document.querySelector("#exportAiCheckPackageBtn").click();
assert.equal(downloads.length, accountlessDownloadsBefore + 1);
const accountlessMarkdown = await downloads.at(-1).blob.text();
const accountlessFencedJson = accountlessMarkdown.match(/```json\n([\s\S]+)\n```/);
assert.ok(accountlessFencedJson);
const accountlessPackage = window.JSON.parse(accountlessFencedJson[1]);
assert.equal(accountlessPackage.valuationStatus, "MISSING_SNAPSHOT_ACCOUNT_NAMES");
assert.equal(accountlessPackage.dataQuality.issues.includes("MISSING_SNAPSHOT_ACCOUNT_NAMES"), true);
assert.equal(accountlessPackage.portfolio.positions.reduce((sum, position) => sum + position.marketValueKRW, 0), 552785);
assert.equal(accountlessMarkdown.includes("조회 기록 저장 후 바뀐 계좌명"), false);
assert.match(window.document.querySelector("#aiCheckPackageStatus").textContent, /저장 당시 계좌명이 없습니다/);

// A legacy latest snapshot stays explicit and never falls back to current assets or prices.
window.__aiReviewExportTestApi.setLegacySnapshot();
const legacyMappedInput = window.__aiReviewExportTestApi.input();
assert.equal(legacyMappedInput.snapshotId, "legacy-snapshot-id");
assert.equal(legacyMappedInput.valuationStatus, "MISSING_LEGACY_SNAPSHOT_VALUATION");
assert.equal(legacyMappedInput.portfolio.totalMarketValueKRW, 777000);
assert.deepEqual(Array.from(legacyMappedInput.portfolio.positions), []);
const downloadsBeforeLegacy = downloads.length;
window.document.querySelector("#exportAiCheckPackageBtn").click();
assert.equal(downloads.length, downloadsBeforeLegacy + 1);
const legacyMarkdown = await downloads.at(-1).blob.text();
const legacyFencedJson = legacyMarkdown.match(/```json\n([\s\S]+)\n```/);
assert.ok(legacyFencedJson);
const legacyPackage = window.JSON.parse(legacyFencedJson[1]);
assert.equal(legacyPackage.valuationStatus, "MISSING_LEGACY_SNAPSHOT_VALUATION");
assert.deepEqual(Array.from(legacyPackage.portfolio.positions), []);
assert.equal(legacyPackage.dataQuality.status, "INCOMPLETE");
assert.equal(legacyPackage.dataQuality.issues.includes("MISSING_SNAPSHOT_VALUATION"), true);
assert.equal(legacyMarkdown.includes("MSFT"), false, "legacy package must not use current holdings as a fallback");
assert.match(window.document.querySelector("#aiCheckPackageStatus").textContent, /조회 기록을 다시 저장/);

// With no snapshot at all, export is a clear no-op and asks for the required authority record.
window.__aiReviewExportTestApi.clearPortfolio();
const downloadCountBeforeEmptyClick = downloads.length;
window.document.querySelector("#exportAiCheckPackageBtn").click();
assert.equal(downloads.length, downloadCountBeforeEmptyClick);
assert.equal(
  window.document.querySelector("#aiCheckPackageStatus").textContent,
  "AI 점검에 사용할 최신 조회 기록을 먼저 저장하세요."
);

console.log("app AI review export tests passed");
