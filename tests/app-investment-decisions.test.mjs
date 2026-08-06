import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const decisionEngineCode = readFileSync("decision-engine.js", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
const STORAGE_KEY = "finance-ledger-retirement-v1";

function installBrowserStubs(window) {
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
  window.console.error = () => {};
  window.console.warn = () => {};
  window.firebaseConfig = {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: "2099-01-02T00:00:00.000Z",
      fx: { USDKRW: { date: "2099-01-01", rate: 1300 } },
      prices: {
        KRX: {
          "005930": {
            close: 80000,
            date: "2099-01-01",
            kind: "STOCK",
            name: "삼성전자",
            source: "KRX"
          }
        },
        US: {}
      },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  });
}

function setValue(window, selector, value) {
  const element = window.document.querySelector(selector);
  assert.ok(element, `${selector} element should exist`);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function submit(window, selector) {
  const form = window.document.querySelector(selector);
  assert.ok(form, `${selector} form should exist`);
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

async function waitForApp(window, milliseconds = 50) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});
const { window } = dom;
installBrowserStubs(window);

window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
  schemaVersion: 2,
  assets: [
    {
      id: "asset-samsung-general",
      name: "삼성전자",
      ticker: "5930",
      type: "KRX",
      account: "일반계좌",
      quantity: 10,
      averagePrice: 70000,
      investmentRole: "CORE",
      thesis: "반도체 업황 회복",
      expectedReturnSource: "이익 성장",
      horizon: "LONG",
      conviction: "HIGH",
      monitoringKpis: "메모리 가격",
      catalysts: "실적 발표",
      invalidationRules: "구조적 점유율 하락",
      decelerationRules: "재고 증가",
      nextReviewAt: "2000-01-01",
      reviewStatus: "REVIEW"
    },
    {
      id: "asset-samsung-pension",
      name: "삼성전자",
      ticker: "005930",
      type: "KRX",
      account: "연금계좌",
      quantity: 5,
      averagePrice: 72000,
      investmentRole: "CYCLE",
      thesis: "연금계좌에 남아 있던 다른 반도체 가설",
      conviction: "MEDIUM",
      nextReviewAt: "2099-12-31",
      reviewStatus: "ACTIVE"
    },
    {
      id: "asset-cash",
      name: "현금",
      type: "CASH",
      account: "생활비",
      amount: 300000
    },
    {
      id: "asset-price-wait",
      name: "가격 대기 종목",
      ticker: "999999",
      type: "KRX",
      account: "테스트계좌",
      quantity: 1,
      averagePrice: 1000
    }
  ],
  tradeJournalEntries: [
    {
      id: "journal-review",
      name: "복기할 거래",
      date: "2000-01-01",
      action: "WATCH",
      status: "REVIEW"
    }
  ],
  snapshots: [],
  retirement: {}
}));

window.eval(decisionEngineCode);
window.eval(appCode);
await waitForApp(window);

const migrated = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(migrated.schemaVersion, 5);
assert.equal(migrated.assets.length, 4);
assert.equal(migrated.assets[0].investmentRole, undefined);
assert.equal(migrated.assets[0].thesis, undefined);
assert.equal(migrated.decisionProfiles.length, 1);
assert.equal(migrated.decisionProfiles[0].subjectKey, "INSTRUMENT:KRX:005930");
assert.equal(migrated.decisionProfiles[0].investmentRole, "CORE");
assert.equal(migrated.decisionProfiles[0].returnSource, "이익 성장");
assert.equal(migrated.decisionProfiles[0].kpis, "메모리 가격");
assert.equal(migrated.decisionProfiles[0].nextReviewAt, "2000-01-01");
assert.equal(migrated.decisionProfiles[0].migrationConflicts.length, 2);
assert.deepEqual(
  migrated.decisionProfiles[0].migrationConflicts.map((conflict) => conflict.sourceId).sort(),
  ["asset-samsung-general", "asset-samsung-pension"]
);
assert.equal(
  migrated.decisionProfiles[0].migrationConflicts.find((conflict) => conflict.sourceId === "asset-samsung-pension").fields.thesis,
  "연금계좌에 남아 있던 다른 반도체 가설"
);

assert.equal(
  window.eval("decisionProfileForAsset(storageSafeState().assets[0]) === decisionProfileForAsset(storageSafeState().assets[1])"),
  true
);
const initialAnalysis = window.eval("analyzeDecisionPortfolio('2099-01-01')");
assert.equal(initialAnalysis.totalValue, 1500000);
assert.equal(initialAnalysis.economicPositionCount, 3);
assert.equal(initialAnalysis.top1Weight, 0.8);
assert.equal(initialAnalysis.top5Weight, 1);
assert.equal(initialAnalysis.hhi, 0.68);
const samsungPosition = initialAnalysis.positions.find((position) => position.key === "KRX:005930");
assert.ok(samsungPosition);
assert.equal(samsungPosition.value, 1200000);
assert.deepEqual(
  [...samsungPosition.assetIds],
  ["asset-samsung-general", "asset-samsung-pension"]
);

window.document.querySelector('[data-nav-view="ASSETS"]').click();
const metricText = window.document.querySelector("#decisionMetrics").textContent.replace(/\s+/g, " ");
assert.match(metricText, /Top 1\s*80\.0%/);
assert.match(metricText, /Top 5\s*100\.0%/);
assert.match(metricText, /HHI\s*6,800/);
assert.match(window.document.querySelector("#decisionWarnings").textContent, /이전 계좌별 판단이 서로 달랐습니다/);
const economicItems = [...window.document.querySelectorAll("#economicPositionList .economic-position")];
assert.equal(economicItems.filter((item) => item.textContent.includes("005930")).length, 1);
const samsungEconomicButton = economicItems.find((item) => item.textContent.includes("005930"));
assert.equal(samsungEconomicButton.dataset.positionAssetId, "asset-samsung-general");
assert.match(samsungEconomicButton.textContent, /2개 계좌 행 합산/);

window.document.querySelector('[data-nav-view="DASHBOARD"]').click();
const dashboardTasks = [...window.document.querySelectorAll("#dashboardChecklist > li")];
assert.equal(dashboardTasks.length, 4);
const overdueButton = window.document.querySelector(
  '#dashboardChecklist [data-dashboard-action="review-asset"]'
);
assert.ok(overdueButton, "overdue review must survive the four-task dashboard limit");
assert.equal(overdueButton.dataset.id, "asset-samsung-general");
assert.equal(dashboardTasks[0].contains(overdueButton), true);
overdueButton.click();

const detailOverlay = window.document.querySelector("#assetDetailOverlay");
let decisionForm = window.document.querySelector("[data-asset-decision-form]");
assert.equal(detailOverlay.hidden, false);
assert.equal(decisionForm.dataset.id, "asset-samsung-general");
assert.equal(window.document.activeElement, decisionForm.elements.namedItem("investmentRole"));
assert.match(window.document.querySelector(".decision-profile-guide").textContent, /2개 계좌/);
assert.equal(decisionForm.elements.namedItem("thesis").value, "반도체 업황 회복");
assert.match(window.document.querySelector(".decision-migration-warning").textContent, /이전 계좌별 판단 2건/);
assert.match(window.document.querySelector(".decision-migration-warning").textContent, /연금계좌에 남아 있던 다른 반도체 가설/);

decisionForm.querySelector('[data-decision-action="mark-reviewed"]').click();
let stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
let sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.migrationConflicts.length, 2);
assert.match(window.document.querySelector(".decision-migration-warning").textContent, /이전 계좌별 판단 2건/);
decisionForm = window.document.querySelector("[data-asset-decision-form]");

decisionForm.elements.namedItem("investmentRole").value = "STRUCTURAL_GROWTH";
decisionForm.elements.namedItem("thesis").value = "업데이트한 장기 투자 가설";
decisionForm.elements.namedItem("returnSource").value = "현금흐름 성장";
decisionForm.elements.namedItem("kpis").value = "영업이익률";
decisionForm.elements.namedItem("catalysts").value = "신규 공정 전환";
decisionForm.elements.namedItem("invalidation").value = "경쟁력 상실";
decisionForm.elements.namedItem("deceleration").value = "CAPEX 효율 저하";
decisionForm.elements.namedItem("horizon").value = "LONG";
decisionForm.elements.namedItem("conviction").value = "HIGH";
decisionForm.elements.namedItem("reviewStatus").value = "REVIEW";
decisionForm.elements.namedItem("nextReviewAt").value = "2000-01-01";
submit(window, "[data-asset-decision-form]");

assert.equal(
  window.document.activeElement,
  window.document.querySelector('[data-decision-action="save"]')
);
assert.match(
  window.document.querySelector("[data-decision-status]").textContent,
  /투자 의사결정을 저장했습니다/
);

stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.investmentRole, "STRUCTURAL_GROWTH");
assert.equal(sharedProfile.thesis, "업데이트한 장기 투자 가설");
assert.equal(sharedProfile.returnSource, "현금흐름 성장");
assert.equal(sharedProfile.nextReviewAt, "2000-01-01");
assert.deepEqual(sharedProfile.migrationConflicts, []);
assert.equal(
  window.eval("decisionProfileForAsset(storageSafeState().assets[1]).thesis"),
  "업데이트한 장기 투자 가설"
);

decisionForm = window.document.querySelector("[data-asset-decision-form]");
decisionForm.querySelector('[data-decision-action="mark-reviewed"]').click();
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.nextReviewAt, "");
assert.match(sharedProfile.lastReviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(sharedProfile.reviewStatus, "ACTIVE");
const reviewedAt = sharedProfile.lastReviewedAt;
assert.equal(
  window.document.querySelector('#dashboardChecklist [data-dashboard-action="review-asset"]'),
  null
);
assert.doesNotMatch(window.document.querySelector("#dashboardChecklist").textContent, /검토기한 초과 자산/);

decisionForm = window.document.querySelector("[data-asset-decision-form]");
assert.equal(
  window.document.activeElement,
  decisionForm.querySelector('[data-decision-action="mark-reviewed"]')
);
assert.match(window.document.querySelector("[data-decision-status]").textContent, /오늘 검토를 기록했습니다/);
decisionForm.elements.namedItem("thesis").value = "저장하지 않은 임시 가설";
let discardPromptCount = 0;
window.confirm = () => {
  discardPromptCount += 1;
  return false;
};
window.document.querySelector("[data-detail-close]").click();
assert.equal(detailOverlay.hidden, false);
assert.equal(discardPromptCount, 1);
assert.equal(
  window.document.querySelector('[data-action="edit"]')?.textContent.trim(),
  "자산 정보 수정"
);
window.confirm = () => true;
window.document.querySelector("[data-detail-close]").click();
assert.equal(detailOverlay.hidden, true);
window.document.querySelector('[data-nav-view="ASSETS"]').click();
const totalBeforeWatchlist = window.eval("totalAssets()");
const concentrationBeforeWatchlist = window.eval("analyzeDecisionPortfolio('2099-01-01')");
const maliciousName = '<img src=x data-xss-watchlist onerror="window.__watchlistXss = 1">관심 삼성';
const maliciousThesis = '</textarea><script>window.__watchlistXss = 2</script><b data-xss-watchlist>가설</b>';
setValue(window, "#watchlistName", maliciousName);
setValue(window, "#watchlistTicker", "5930");
setValue(window, "#watchlistType", "KRX");
setValue(window, "#watchlistRole", "CORE");
setValue(window, "#watchlistHorizon", "LONG");
setValue(window, "#watchlistConviction", "MEDIUM");
setValue(window, "#watchlistThesis", maliciousThesis);
submit(window, "#watchlistForm");

stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 0);
assert.match(window.document.querySelector("#watchlistFormStatus").textContent, /이미 보유 중/);
sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.thesis, "업데이트한 장기 투자 가설");
assert.equal(sharedProfile.lastReviewedAt, reviewedAt);

setValue(window, "#watchlistType", "US");
setValue(window, "#watchlistTicker", "AAPL");
submit(window, "#watchlistForm");

stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 1);
assert.equal(stored.watchlist[0].ticker, "AAPL");
assert.equal(stored.watchlist[0].type, "US");
sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.lastReviewedAt, reviewedAt);
assert.equal(sharedProfile.reviewStatus, "ACTIVE");
assert.equal(window.eval("totalAssets()"), totalBeforeWatchlist);
let concentrationAfterWatchlist = window.eval("analyzeDecisionPortfolio('2099-01-01')");
assert.equal(concentrationAfterWatchlist.totalValue, concentrationBeforeWatchlist.totalValue);
assert.equal(concentrationAfterWatchlist.top1Weight, concentrationBeforeWatchlist.top1Weight);
assert.equal(concentrationAfterWatchlist.top5Weight, concentrationBeforeWatchlist.top5Weight);
assert.equal(concentrationAfterWatchlist.hhi, concentrationBeforeWatchlist.hhi);
assert.equal(window.__watchlistXss, undefined);
assert.equal(
  window.document.querySelector("#watchlistList img, #watchlistList script, #watchlistList [data-xss-watchlist]"),
  null
);
assert.match(window.document.querySelector("#watchlistList").textContent, /<img src=x/);

const watchlistEdit = window.document.querySelector('[data-watchlist-action="edit"]');
watchlistEdit.click();
assert.equal(window.document.activeElement, window.document.querySelector("#watchlistName"));
setValue(window, "#watchlistName", "수정된 관심 삼성전자");
setValue(window, "#watchlistThesis", "수정된 관심 가설");
submit(window, "#watchlistForm");
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 1);
assert.equal(stored.watchlist[0].name, "수정된 관심 삼성전자");
sharedProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.equal(sharedProfile.lastReviewedAt, reviewedAt);
assert.equal(sharedProfile.reviewStatus, "ACTIVE");
assert.match(window.document.querySelector("#watchlistList").textContent, /수정된 관심 삼성전자/);

window.document.querySelector('[data-watchlist-action="delete"]').click();
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 0);
assert.equal(window.eval("totalAssets()"), totalBeforeWatchlist);
concentrationAfterWatchlist = window.eval("analyzeDecisionPortfolio('2099-01-01')");
assert.equal(concentrationAfterWatchlist.hhi, concentrationBeforeWatchlist.hhi);
assert.equal(
  stored.decisionProfiles.some((profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"),
  true,
  "deleting a watchlist item must preserve the profile still used by held assets"
);

window.eval(`
  replaceState({
    ...storageSafeState(),
    decisionProfiles: [
      ...storageSafeState().decisionProfiles,
      {
        id: "INSTRUMENT:US:MSFT",
        subjectKey: "INSTRUMENT:US:MSFT",
        name: "Microsoft",
        ticker: "MSFT",
        type: "US",
        investmentRole: "STRUCTURAL_GROWTH",
        thesis: "전량매도 뒤에도 남겨 둔 기존 판단",
        horizon: "LONG",
        conviction: "HIGH",
        lastReviewedAt: "2026-07-31",
        reviewStatus: "ACTIVE",
        migrationConflicts: [
          {
            sourceType: "asset",
            sourceId: "sold-msft-general",
            sourceName: "Microsoft",
            account: "일반계좌",
            fields: {
              investmentRole: "STRUCTURAL_GROWTH",
              thesis: "전량매도 뒤에도 남겨 둔 기존 판단",
              horizon: "LONG",
              conviction: "HIGH",
              reviewStatus: "ACTIVE"
            }
          },
          {
            sourceType: "asset",
            sourceId: "sold-msft-pension",
            sourceName: "Microsoft",
            account: "연금계좌",
            fields: {
              investmentRole: "CORE",
              thesis: "연금계좌에 남아 있던 다른 판단",
              horizon: "MEDIUM",
              conviction: "MEDIUM",
              reviewStatus: "REVIEW"
            }
          }
        ]
      }
    ]
  });
  render(false);
`);
setValue(window, "#watchlistName", "Microsoft");
setValue(window, "#watchlistType", "US");
setValue(window, "#watchlistTicker", "MSFT");
setValue(window, "#watchlistThesis", "기존 기록을 덮을 뻔한 새 입력");
window.confirm = () => false;
submit(window, "#watchlistForm");
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 0);
assert.equal(window.document.querySelector("#watchlistThesis").value, "기존 기록을 덮을 뻔한 새 입력");
assert.equal(window.document.activeElement, window.document.querySelector("#watchlistMigrationConflict summary"));
assert.match(window.document.querySelector("#watchlistFormStatus").textContent, /작성 중인 초안을 유지했습니다/);
assert.match(window.document.querySelector("#watchlistMigrationConflict").textContent, /이전 계좌별 판단 2건/);
assert.match(window.document.querySelector("#watchlistMigrationConflict").textContent, /연금계좌에 남아 있던 다른 판단/);
assert.match(window.document.querySelector("#watchlistMigrationConflict").textContent, /전량매도 뒤에도 남겨 둔 기존 판단/);
window.confirm = () => true;
setValue(window, "#watchlistThesis", "기존 기록을 확인한 뒤 갱신한 판단");
submit(window, "#watchlistForm");
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.watchlist.length, 1);
assert.equal(stored.watchlist[0].ticker, "MSFT");
const restoredOrphanProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:US:MSFT"
);
assert.equal(restoredOrphanProfile.thesis, "기존 기록을 확인한 뒤 갱신한 판단");
assert.equal(restoredOrphanProfile.lastReviewedAt, "2026-07-31");
assert.equal(restoredOrphanProfile.reviewStatus, "ACTIVE");
assert.deepEqual(restoredOrphanProfile.migrationConflicts, []);

window.eval(`
  replaceState({
    ...defaultState(),
    assets: [
      {
        id: "asset-msft",
        name: "Microsoft",
        ticker: "MSFT",
        type: "US",
        account: "일반계좌",
        quantity: 2,
        averagePrice: 300
      },
      {
        id: "asset-aapl",
        name: "Apple",
        ticker: "AAPL",
        type: "US",
        account: "연금계좌",
        quantity: 3,
        averagePrice: 200
      }
    ],
    decisionProfiles: [
      {
        id: "INSTRUMENT:US:MSFT",
        subjectKey: "INSTRUMENT:US:MSFT",
        name: "Microsoft",
        ticker: "MSFT",
        type: "US",
        investmentRole: "STRUCTURAL_GROWTH",
        thesis: "MSFT에만 적용되던 기존 판단",
        horizon: "LONG",
        conviction: "HIGH",
        reviewStatus: "ACTIVE"
      },
      {
        id: "INSTRUMENT:US:AAPL",
        subjectKey: "INSTRUMENT:US:AAPL",
        name: "Apple",
        ticker: "AAPL",
        type: "US",
        investmentRole: "CORE",
        thesis: "AAPL 대상의 기존 판단",
        horizon: "LONG",
        conviction: "MEDIUM",
        reviewStatus: "ACTIVE"
      }
    ]
  });
  render(false);
  handleAssetAction({ dataset: { action: "edit", id: "asset-msft" } });
`);
setValue(window, "#assetName", "Apple 통합 행");
setValue(window, "#assetTicker", "AAPL");
submit(window, "#assetForm");
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
assert.equal(stored.assets.filter((asset) => asset.ticker === "AAPL").length, 2);
assert.equal(
  stored.decisionProfiles.some((profile) => profile.subjectKey === "INSTRUMENT:US:MSFT"),
  false
);
const mergedTargetProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:US:AAPL"
);
assert.equal(mergedTargetProfile.thesis, "AAPL 대상의 기존 판단");
assert.equal(mergedTargetProfile.reviewStatus, "REVIEW");
assert.equal(mergedTargetProfile.migrationConflicts.length, 1);
assert.equal(mergedTargetProfile.migrationConflicts[0].fields.thesis, "MSFT에만 적용되던 기존 판단");
window.eval('openAssetDetail("asset-msft", null, { focusDecision: true })');
assert.match(window.document.querySelector(".decision-migration-warning").textContent, /MSFT에만 적용되던 기존 판단/);
window.document.querySelector("[data-detail-close]").click();

window.eval(`
  replaceState({
    ...defaultState(),
    assets: [
      {
        id: "asset-msft-general",
        name: "Microsoft 일반",
        ticker: "MSFT",
        type: "US",
        account: "일반계좌",
        quantity: 2,
        averagePrice: 300
      },
      {
        id: "asset-msft-pension",
        name: "Microsoft 연금",
        ticker: "MSFT",
        type: "US",
        account: "연금계좌",
        quantity: 1,
        averagePrice: 290
      },
      {
        id: "asset-aapl-existing",
        name: "Apple",
        ticker: "AAPL",
        type: "US",
        account: "AAPL 별도계좌",
        quantity: 3,
        averagePrice: 200
      }
    ],
    decisionProfiles: [
      {
        id: "INSTRUMENT:US:MSFT",
        subjectKey: "INSTRUMENT:US:MSFT",
        name: "Microsoft",
        ticker: "MSFT",
        type: "US",
        investmentRole: "STRUCTURAL_GROWTH",
        thesis: "두 MSFT 계좌가 공유하는 판단",
        horizon: "LONG",
        conviction: "HIGH",
        reviewStatus: "ACTIVE"
      },
      {
        id: "INSTRUMENT:US:AAPL",
        subjectKey: "INSTRUMENT:US:AAPL",
        name: "Apple",
        ticker: "AAPL",
        type: "US",
        investmentRole: "CORE",
        thesis: "AAPL 고유 판단",
        horizon: "LONG",
        conviction: "MEDIUM",
        reviewStatus: "ACTIVE"
      }
    ]
  });
  render(false);
  handleAssetAction({ dataset: { action: "edit", id: "asset-msft-general" } });
`);
setValue(window, "#assetName", "Apple로 변경된 한 계좌");
setValue(window, "#assetTicker", "AAPL");
submit(window, "#assetForm");
stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
const stillSharedMsftProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:US:MSFT"
);
assert.equal(stored.assets.filter((asset) => asset.ticker === "MSFT").length, 1);
assert.equal(stillSharedMsftProfile.thesis, "두 MSFT 계좌가 공유하는 판단");
assert.equal(stillSharedMsftProfile.reviewStatus, "ACTIVE");
const untouchedAaplProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:US:AAPL"
);
assert.equal(untouchedAaplProfile.thesis, "AAPL 고유 판단");
assert.equal(untouchedAaplProfile.reviewStatus, "ACTIVE");
assert.deepEqual(untouchedAaplProfile.migrationConflicts, []);

const emptyFingerprint = window.eval("dataFingerprint(defaultState())");
window.eval(`
  replaceState({
    ...defaultState(),
    watchlist: [{
      id: "watchlist-only",
      name: "관심종목만 있는 상태",
      ticker: "AAPL",
      type: "US"
    }]
  });
`);
assert.equal(window.eval("localHasUserData()"), true);
const watchlistOnlyFingerprint = window.eval("dataFingerprint(storageSafeState())");
assert.notEqual(watchlistOnlyFingerprint, emptyFingerprint);
assert.equal(JSON.parse(watchlistOnlyFingerprint).watchlist.length, 1);

dom.window.close();
console.log("app investment decision tests passed");
