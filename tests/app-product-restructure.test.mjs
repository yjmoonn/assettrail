import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const engineCode = [
  "decision-engine.js",
  "action-engine.js",
  "ledger-engine.js",
  "performance-engine.js",
  "external-data-engine.js",
  "history-repository.js"
].map((path) => readFileSync(path, "utf8")).join("\n");
const appSource = readFileSync("app.js", "utf8");

const STORAGE_KEY = "finance-ledger-retirement-v1";
const EXTERNAL_DATA_KEY = `${STORAGE_KEY}:external-data-v1`;
const ETF_CATALOG_KEY = `${STORAGE_KEY}:etf-catalog-v1`;
const FIXED_NOW = "2026-08-19T03:00:00.000Z";

function installBrowserStubs(window, alerts) {
  const RealDate = window.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FIXED_NOW]));
    }

    static now() {
      return new RealDate(FIXED_NOW).getTime();
    }
  }
  window.Date = FixedDate;
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
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.console.error = () => {};
  window.console.warn = () => {};
  window.firebaseConfig = {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: FIXED_NOW,
      methodology: {
        distributionTreatment: "excluded",
        priceBasis: "unadjusted_close"
      },
      fx: {},
      prices: {
        KRX: {
          "000660": { close: 100, date: "2026-08-19", kind: "STOCK", name: "SK하이닉스", source: "TEST" },
          "035420": { close: 100, date: "2026-08-19", kind: "STOCK", name: "NAVER", source: "TEST" },
          "005930": { close: 100, date: "2026-08-19", kind: "STOCK", name: "삼성전자", source: "TEST" },
          "051910": { close: 100, date: "2026-08-19", kind: "STOCK", name: "LG화학", source: "TEST" },
          "068270": { close: 100, date: "2026-08-19", kind: "STOCK", name: "셀트리온", source: "TEST" },
          "207940": { close: 100, date: "2026-08-19", kind: "STOCK", name: "삼성바이오로직스", source: "TEST" }
        },
        US: {}
      },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  });
}

async function waitUntil(window, predicate, timeoutMs = 1000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("AssetTrail bootstrap timed out");
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  }
}

// Static product contract: four primary destinations and one separately labelled settings action.
const staticDom = new JSDOM(html);
const staticDocument = staticDom.window.document;
const primaryNav = [...staticDocument.querySelectorAll(".app-nav > .app-nav-item")];
assert.deepEqual(primaryNav.map((button) => button.dataset.navView), [
  "DASHBOARD",
  "ASSETS",
  "JOURNAL",
  "GOALS"
]);
assert.deepEqual(primaryNav.map((button) => button.textContent.trim()), ["홈", "자산", "기록", "목표"]);
primaryNav.forEach((button, index) => {
  assert.equal(button.type, "button");
  assert.equal(button.tabIndex, index === 0 ? 0 : -1);
  assert.equal(button.querySelector("svg")?.getAttribute("aria-hidden"), "true");
});

const settingsButton = staticDocument.querySelector("#settingsBtn");
assert.ok(settingsButton);
assert.equal(settingsButton.closest(".app-nav"), null);
assert.equal(settingsButton.dataset.navView, "SETTINGS");
assert.equal(settingsButton.type, "button");
assert.equal(settingsButton.getAttribute("aria-label"), "설정");
assert.equal(settingsButton.querySelector("svg")?.getAttribute("aria-hidden"), "true");
const mobileSettingsRule = css.slice(css.lastIndexOf(".topbar .action-cluster > .settings-button"));
assert.match(mobileSettingsRule, /height:\s*44px/);
assert.match(mobileSettingsRule, /min-height:\s*44px/);
assert.match(mobileSettingsRule, /min-width:\s*44px/);
assert.match(mobileSettingsRule, /width:\s*44px/);
const primaryImportInput = staticDocument.querySelector("#importInput");
assert.ok(primaryImportInput);
assert.equal(primaryImportInput.hidden, true);
assert.equal(staticDocument.querySelector("#jsonImportBtn")?.getAttribute("aria-controls"), "importInput");

[
  ["importExternalDataBtn", "externalDataBackupInput", "settingsExternalDataStatus"],
  ["importEtfCatalogBtn", "etfCatalogInput", "settingsEtfCatalogStatus"]
].forEach(([buttonId, inputId, statusId]) => {
  const button = staticDocument.querySelector(`#${buttonId}`);
  const input = staticDocument.querySelector(`#${inputId}`);
  const status = staticDocument.querySelector(`#${statusId}`);
  assert.equal(button?.tagName, "BUTTON");
  assert.equal(button?.type, "button");
  assert.equal(button?.getAttribute("aria-controls"), inputId);
  assert.equal(input?.hidden, true);
  assert.equal(status?.getAttribute("role"), "status");
  assert.equal(status?.getAttribute("aria-live"), "polite");
});

const heroChipRule = css.slice(css.indexOf(".hero-change-row"), css.indexOf(".hero-chip.chip-up"));
assert.match(heroChipRule, /flex-wrap:\s*wrap/);
assert.match(heroChipRule, /max-width:\s*100%/);
assert.match(heroChipRule, /min-width:\s*0/);
assert.doesNotMatch(heroChipRule, /\.hero-chip,\s*\.hero-chip-label\s*\{\s*white-space:\s*nowrap/);

// Removed products stay in the DOM only as three explicitly hidden legacy areas.
const legacySections = [...staticDocument.querySelectorAll('[data-app-section="LEGACY"]')];
assert.equal(legacySections.length, 3);
assert.deepEqual(legacySections.map((section) => section.classList.contains("decision-center-panel")
  ? "decision"
  : section.classList.contains("portfolio-panel")
    ? "portfolio"
    : section.classList.contains("analysis-workspace")
      ? "analysis"
      : "unknown").sort(), ["analysis", "decision", "portfolio"]);
assert.equal(legacySections.every((section) => section.hidden), true);
assert.equal(staticDocument.querySelectorAll('[data-app-section="PORTFOLIO"], [data-app-section="ANALYSIS"]').length, 0);

// History belongs to Journal; Goals contains retirement and no longer has a mobile sub-tab switcher.
assert.equal(staticDocument.querySelector("#historyPanel")?.dataset.appSection, "JOURNAL");
assert.equal(staticDocument.querySelector(".investment-record-panel")?.dataset.appSection, "JOURNAL");
const goalSections = [...staticDocument.querySelectorAll('[data-app-section="GOALS"]')];
assert.equal(goalSections.length, 1);
assert.equal(goalSections[0].id, "retirementPanel");
assert.equal(staticDocument.querySelectorAll(".goal-mobile-tabs, [data-goal-mobile-panel]").length, 0);

// Home exposes an actionable monthly review, accessible progress, and merged-position concentration.
const monthlyCard = staticDocument.querySelector('[data-app-section="DASHBOARD"] .monthly-review-card');
assert.ok(monthlyCard);
const monthlyProgress = monthlyCard.querySelector('[role="progressbar"]');
assert.ok(monthlyProgress);
assert.equal(monthlyProgress.getAttribute("aria-valuemin"), "0");
assert.equal(monthlyProgress.getAttribute("aria-valuemax"), "100");
assert.equal(monthlyProgress.getAttribute("aria-valuenow"), "0");
assert.ok(monthlyCard.querySelector("textarea#dashboardMonthlyConclusion"));
assert.equal(monthlyCard.querySelector("input#dashboardNextReviewDate")?.type, "date");
["dashboardTop1Weight", "dashboardTop1Name", "dashboardTop5Weight"]
  .forEach((id) => assert.ok(monthlyCard.querySelector(`#${id}`), `missing #${id}`));
assert.match(
  appSource,
  /els\.dashboardSnapshotBtn\?\.addEventListener\("click",[\s\S]*?saveAssetSnapshot\(\{ monthlyReview: true \}\)/
);

// Home explains the complete operating rhythm without adding another top-level destination.
const usageGuide = staticDocument.querySelector('[data-app-section="DASHBOARD"] .usage-guide');
assert.ok(usageGuide);
assert.equal(usageGuide.tagName, "DETAILS");
assert.equal(usageGuide.open, false, "usage guide stays compact until the user opens it");
assert.equal(usageGuide.closest("section")?.getAttribute("aria-labelledby"), "usageGuideTitle");
const usageCopy = usageGuide.textContent.replace(/\s+/g, " ");
["일별 자산 변화", "조회 기록을 저장", "조회 히스토리", "입출금을 포함", "기간 성과", "이번 달 점검", "AI 점검 패키지"]
  .forEach((copy) => assert.match(usageCopy, new RegExp(copy)));
const usageDestinations = [...usageGuide.querySelectorAll("button[data-go-view]")];
assert.deepEqual(usageDestinations.map((button) => button.dataset.goView), [
  "ASSETS",
  "JOURNAL",
  "GOALS",
  "SETTINGS"
]);
usageDestinations.forEach((button) => assert.equal(button.type, "button"));
assert.match(css, /\.usage-guide-flows\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.usage-guide-flows\s*\{\s*grid-template-columns:\s*1fr/);
assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.usage-guide-actions \.text-link-button\s*\{[\s\S]*?min-height:\s*44px/);
const usageGuideCss = css.slice(css.indexOf(".usage-guide-panel"), css.indexOf(".dashboard-focus"));
assert.match(usageGuideCss, /\.usage-guide-heading strong\s*\{[^}]*font-size:\s*var\(--fs-h3\)[^}]*font-weight:\s*var\(--fw-bold\)[^}]*line-height:\s*var\(--lh-h3\)/s);
assert.match(usageGuideCss, /\.usage-guide-heading small\s*\{[^}]*font-size:\s*var\(--fs-body-sm\)[^}]*font-weight:\s*var\(--fw-semibold\)/s);
assert.match(usageGuideCss, /\.usage-guide h3\s*\{[^}]*font-size:\s*16px[^}]*font-weight:\s*var\(--fw-bold\)/s);
assert.match(usageGuideCss, /\.usage-guide ol\s*\{[^}]*font-size:\s*var\(--fs-body-sm\)[^}]*line-height:\s*1\.65/s);
assert.match(usageGuideCss, /\.usage-guide-note p,[\s\S]*?\.usage-guide-more p\s*\{[^}]*font-size:\s*var\(--fs-caption\)[^}]*font-weight:\s*var\(--fw-medium\)[^}]*line-height:\s*1\.6/s);
assert.doesNotMatch(usageGuideCss, /font-weight:\s*(?:650|750)/);
assert.match(staticDocument.querySelector('link[rel="stylesheet"]')?.getAttribute("href") || "", /styles\.css\?v=20260819-usage-guide-type/);

const historyEmpty = staticDocument.querySelector("#historyChartEmpty");
assert.match(historyEmpty?.textContent || "", /자산 화면에서 현재 자산을 기록/);
assert.equal(historyEmpty?.querySelector("button")?.dataset.goView, "ASSETS");

const legacyState = {
  schemaVersion: 6,
  assets: [],
  decisionProfiles: [{
    id: "legacy-profile",
    subjectKey: "INSTRUMENT:KRX:005930",
    name: "보존할 분석 데이터",
    type: "KRX",
    ticker: "005930",
    investmentRole: "CORE",
    thesis: "hidden UI must not delete stored data"
  }],
  watchlist: [{ id: "legacy-watch", name: "보존할 관심종목", type: "KRX", ticker: "035420" }],
  realizedTrades: [{ id: "legacy-realized", name: "보존할 실현손익", soldAt: "2026-07-01" }],
  tradeJournalEntries: [{ id: "legacy-journal", name: "보존할 매매일지", date: "2026-07-02", action: "WATCH" }],
  events: [],
  ledgerMeta: { activeLedgerId: "legacy-ledger", baselineDate: "2026-07-01" },
  snapshots: [{
    id: "legacy-snapshot",
    createdAt: "2026-07-15T00:00:00.000Z",
    total: 777,
    note: "보존할 기존 스냅샷",
    source: "LEGACY_SNAPSHOT",
    typeTotals: { CASH: 777 }
  }],
  performanceObservations: [],
  retirementScenarios: [{
    id: "legacy-retirement-scenario",
    name: "보존할 은퇴 시나리오",
    updatedAt: "2026-07-01T00:00:00.000Z"
  }],
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
const legacyRaw = JSON.stringify(legacyState);
const legacyExternalRaw = JSON.stringify({ marker: "preserve-butler-extension" });
const legacyEtfRaw = JSON.stringify({ marker: "preserve-etf-extension" });
const alerts = [];
const runtimeDom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "https://yjmoonn.github.io/assettrail/#home"
});
const { window } = runtimeDom;
installBrowserStubs(window, alerts);
window.localStorage.setItem(STORAGE_KEY, legacyRaw);
window.localStorage.setItem(EXTERNAL_DATA_KEY, legacyExternalRaw);
window.localStorage.setItem(ETF_CATALOG_KEY, legacyEtfRaw);
window.indexedDB = {};
window.eval(engineCode);
const memoryHistoryAdapter = window.AssetTrailHistoryRepository.createMemoryHistoryAdapter();
window.AssetTrailHistoryRepository = {
  ...window.AssetTrailHistoryRepository,
  createIndexedDbHistoryAdapter: () => memoryHistoryAdapter
};

window.eval(`${appSource}
  window.__productRestructureTestApi = {
    ready() {
      return historyStorage.ready && !historyStorage.blocked;
    },
    setupPortfolio() {
      priceBook = normalizePriceBook({
        generatedAt: "${FIXED_NOW}",
        methodology: {
          distributionTreatment: "excluded",
          priceBasis: "unadjusted_close"
        },
        fx: {},
        prices: {
          KRX: {
            "000660": { close: 100, date: "2026-08-19", kind: "STOCK", name: "SK하이닉스", source: "TEST" },
            "035420": { close: 100, date: "2026-08-19", kind: "STOCK", name: "NAVER", source: "TEST" },
            "005930": { close: 100, date: "2026-08-19", kind: "STOCK", name: "삼성전자", source: "TEST" },
            "051910": { close: 100, date: "2026-08-19", kind: "STOCK", name: "LG화학", source: "TEST" },
            "068270": { close: 100, date: "2026-08-19", kind: "STOCK", name: "셀트리온", source: "TEST" },
            "207940": { close: 100, date: "2026-08-19", kind: "STOCK", name: "삼성바이오로직스", source: "TEST" }
          },
          US: {}
        },
        symbols: { KRX: {}, US: {} },
        errors: []
      });
      state.assets = [
        normalizeAsset({ id: "samsung-general", name: "삼성전자", ticker: "005930", type: "KRX", account: "일반계좌", quantity: 20, averagePrice: 80 }),
        normalizeAsset({ id: "samsung-pension", name: "삼성전자", ticker: "005930", type: "KRX", account: "연금계좌", quantity: 10, averagePrice: 90 }),
        normalizeAsset({ id: "hynix", name: "SK하이닉스", ticker: "000660", type: "KRX", account: "일반계좌", quantity: 14, averagePrice: 70 }),
        normalizeAsset({ id: "naver", name: "NAVER", ticker: "035420", type: "KRX", account: "일반계좌", quantity: 14, averagePrice: 70 }),
        normalizeAsset({ id: "lgchem", name: "LG화학", ticker: "051910", type: "KRX", account: "일반계좌", quantity: 14, averagePrice: 70 }),
        normalizeAsset({ id: "celltrion", name: "셀트리온", ticker: "068270", type: "KRX", account: "일반계좌", quantity: 14, averagePrice: 70 }),
        normalizeAsset({ id: "samsung-biologics", name: "삼성바이오로직스", ticker: "207940", type: "KRX", account: "일반계좌", quantity: 14, averagePrice: 70 })
      ];
      state.retirement = { ...state.retirement, currentInvestable: 1 };
      applyPricesToAssets();
      renderDashboard();
    },
    activate(view) {
      setActiveView(view, { scroll: false, updateHash: false });
    },
    activeView() {
      return uiState.activeView;
    },
    concentration() {
      return JSON.parse(JSON.stringify(portfolioConcentration()));
    },
    snapshots() {
      return JSON.parse(JSON.stringify(state.snapshots));
    },
    monthlySteps() {
      return JSON.parse(JSON.stringify(monthlyReviewSteps()));
    },
    renderMonthly() {
      renderMonthlyReview();
    },
    monthlyFormKey(review, scope, month) {
      return monthlyReviewFormKey(review, scope, month);
    },
    prepareMonthlyUpdateOrdering() {
      const review = state.snapshots.find((snapshot) => snapshot.source === "MONTHLY_REVIEW");
      review.createdAt = "2026-08-01T00:00:00.000Z";
      state.snapshots.push(normalizeSnapshot({
        id: "quick-after-monthly",
        createdAt: "2026-08-18T00:00:00.000Z",
        total: 6500,
        note: "later quick snapshot",
        source: "QUICK_SNAPSHOT",
        typeTotals: {}
      }));
    },
    switchMonthlyContext(scope, snapshots) {
      activeStorageKey = scope;
      state.snapshots = snapshots.map(normalizeSnapshot);
      renderMonthlyReview();
    },
    replaceMonthlyAuthoritative(snapshots) {
      const candidate = storageSafeState();
      candidate.snapshots = snapshots.map(normalizeSnapshot);
      replaceState(candidate);
      renderMonthlyReview();
    },
    async saveMonthly(note, nextReviewAt) {
      els.dashboardMonthlyConclusion.value = note;
      els.dashboardNextReviewDate.value = nextReviewAt;
      return saveAssetSnapshot({ monthlyReview: true });
    },
    async saveQuickAtCapacity() {
      state.snapshots = Array.from({ length: IMPORT_LIMITS.snapshots }, (_, index) => ({
        id: "capacity-" + index,
        createdAt: "2026-01-01T00:00:00.000Z",
        total: index,
        note: "",
        typeTotals: {}
      }));
      return saveAssetSnapshot({ monthlyReview: false });
    },
    async persistedHistory() {
      await flushHistoryPersistence();
      const bundle = await historyStorage.adapter.readActiveBundle(activeStorageKey);
      return {
        flat: JSON.parse(JSON.stringify(window.AssetTrailHistoryRepository.restoreHistory(bundle))),
        primary: JSON.parse(localStorage.getItem(activeStorageKey))
      };
    },
    safeState() {
      return JSON.parse(JSON.stringify(storageSafeState()));
    },
    prepareExternalRestore() {
      const key = externalDataStorageKey();
      localStorage.removeItem(key);
      analysisStorageIssues.external = null;
      analysisStorageRevisions.external = null;
      externalDataStore = defaultExternalDataStore();
    }
  };
`);

await waitUntil(window, () => window.__productRestructureTestApi?.ready());
window.__productRestructureTestApi.setupPortfolio();

let externalFileChooserClicks = 0;
let etfFileChooserClicks = 0;
window.document.querySelector("#externalDataBackupInput").addEventListener("click", () => {
  externalFileChooserClicks += 1;
});
window.document.querySelector("#etfCatalogInput").addEventListener("click", () => {
  etfFileChooserClicks += 1;
});
window.document.querySelector("#importExternalDataBtn").click();
window.document.querySelector("#importEtfCatalogBtn").click();
assert.equal(externalFileChooserClicks, 1, "Butler restore button must open its hidden file input");
assert.equal(etfFileChooserClicks, 1, "ETF restore button must open its hidden file input");

// The guide reuses the app's existing view navigation and lands on the daily snapshot action.
const runtimeUsageGuide = window.document.querySelector(".usage-guide");
runtimeUsageGuide.open = true;
runtimeUsageGuide.querySelector('[data-go-view="ASSETS"]').click();
assert.equal(window.__productRestructureTestApi.activeView(), "ASSETS");
assert.equal(window.location.hash, "#assets");
assert.equal(window.document.querySelector('[data-app-section="ASSETS"]').hidden, false);
assert.equal(window.document.querySelector("#snapshotBtn").hidden, false);
assert.equal(window.document.querySelector("#viewAnnounce").textContent, "자산 화면");
window.document.querySelector('.app-nav-item[data-nav-view="DASHBOARD"]').click();

// Roving keyboard navigation remains limited to the four primary tabs.
const runtimeNav = [...window.document.querySelectorAll(".app-nav > .app-nav-item")];
runtimeNav[0].focus();
runtimeNav[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
assert.equal(window.document.activeElement, runtimeNav[1]);
assert.equal(runtimeNav[1].getAttribute("aria-current"), "page");
assert.equal(window.location.hash, "#assets");
assert.equal(window.document.querySelectorAll(".decision-role-badge").length, 0, "legacy investment roles stay out of the current asset UI");

window.__productRestructureTestApi.activate("JOURNAL");
assert.equal(window.document.querySelector("#historyPanel").hidden, false);
assert.equal(window.document.querySelector(".investment-record-panel").hidden, false);
assert.equal(window.document.querySelector("#retirementPanel").hidden, true);
assert.equal([...window.document.querySelectorAll('[data-app-section="LEGACY"]')].every((section) => section.hidden), true);

window.__productRestructureTestApi.activate("GOALS");
assert.equal(window.document.querySelector("#retirementPanel").hidden, false);
assert.equal(window.document.querySelector("#historyPanel").hidden, true);
assert.equal(window.document.querySelectorAll('[data-app-section="GOALS"]:not([hidden])').length, 1);

window.document.querySelector("#settingsBtn").click();
assert.equal(window.document.querySelector(".settings-panel").hidden, false);
assert.equal(window.document.querySelector("#settingsBtn").getAttribute("aria-current"), "page");
assert.equal(runtimeNav[0].tabIndex, 0, "settings keeps a primary-nav keyboard return point");
assert.equal(runtimeNav.slice(1).every((button) => button.tabIndex === -1), true);

runtimeNav[0].click();
assert.equal(window.__productRestructureTestApi.activeView(), "DASHBOARD");
assert.equal(window.document.querySelector(".dashboard-panel").hidden, false);
const concentration = window.__productRestructureTestApi.concentration();
assert.equal(concentration.top1.value, 3000, "same ticker must merge across accounts");
assert.equal(concentration.top1Rate, 0.3);
assert.equal(concentration.top5Rate, 0.86, "Top 5 must exclude the sixth economic position");
assert.equal(window.document.querySelector("#dashboardTop1Weight").textContent, "30.00%");
assert.equal(window.document.querySelector("#dashboardTop1Name").textContent, "삼성전자");
assert.equal(window.document.querySelector("#dashboardTop5Weight").textContent, "86.00%");

const progress = window.document.querySelector(".monthly-review-progress");
assert.equal(window.document.querySelector("#dashboardMonthlyReviewProgress").style.width, "50%");
assert.equal(progress.getAttribute("aria-valuenow"), "50");
assert.equal(window.document.querySelector("#dashboardNextReviewDate").value, "2026-09-19");

window.document.querySelector("#dashboardMonthlyConclusion").value = "같은 컨텍스트의 미저장 초안";
window.document.querySelector("#dashboardNextReviewDate").value = "2026-09-30";
window.__productRestructureTestApi.renderMonthly();
assert.equal(window.document.querySelector("#dashboardMonthlyConclusion").value, "같은 컨텍스트의 미저장 초안");
assert.equal(window.document.querySelector("#dashboardNextReviewDate").value, "2026-09-30");
assert.notEqual(
  window.__productRestructureTestApi.monthlyFormKey(null, STORAGE_KEY, "2026-08"),
  window.__productRestructureTestApi.monthlyFormKey(null, STORAGE_KEY, "2026-09"),
  "calendar month must be part of the monthly form context"
);
assert.notEqual(
  window.__productRestructureTestApi.monthlyFormKey({ id: "review-a" }, STORAGE_KEY, "2026-08"),
  window.__productRestructureTestApi.monthlyFormKey({ id: "review-b" }, STORAGE_KEY, "2026-08"),
  "review id must be part of the monthly form context"
);

assert.equal(
  await window.__productRestructureTestApi.saveMonthly("첫 점검 결론", "2026-09-20"),
  true
);
let snapshots = window.__productRestructureTestApi.snapshots();
assert.equal(snapshots.filter((snapshot) => snapshot.source === "MONTHLY_REVIEW").length, 1);
assert.equal(snapshots.some((snapshot) => snapshot.id === "legacy-snapshot" && snapshot.note === "보존할 기존 스냅샷"), true);
const firstMonthly = snapshots.find((snapshot) => snapshot.source === "MONTHLY_REVIEW");
assert.equal(firstMonthly.note, "첫 점검 결론");
assert.equal(firstMonthly.nextReviewAt, "2026-09-20");
assert.equal(
  window.document.querySelector("#dashboardMonthlyReviewProgress").style.width,
  "100%",
  JSON.stringify(window.__productRestructureTestApi.monthlySteps())
);
assert.equal(progress.getAttribute("aria-valuenow"), "100");

window.__productRestructureTestApi.prepareMonthlyUpdateOrdering();
assert.equal(
  await window.__productRestructureTestApi.saveMonthly("업데이트한 점검 결론", "2026-09-25"),
  true
);
snapshots = window.__productRestructureTestApi.snapshots();
const monthlyReviews = snapshots.filter((snapshot) => snapshot.source === "MONTHLY_REVIEW");
assert.equal(monthlyReviews.length, 1, "same month must upsert instead of append");
assert.equal(monthlyReviews[0].id, firstMonthly.id);
assert.equal(monthlyReviews[0].note, "업데이트한 점검 결론");
assert.equal(monthlyReviews[0].nextReviewAt, "2026-09-25");
assert.equal(snapshots.at(-1).id, firstMonthly.id, "updated monthly review must move to its canonical chronological position");

// v6 migration, hidden legacy state, and separate extension stores survive the restructure and monthly upsert.
assert.equal(window.localStorage.getItem(`${STORAGE_KEY}:migration-backup:v6-to-v7`), legacyRaw);
assert.equal(window.localStorage.getItem(EXTERNAL_DATA_KEY), legacyExternalRaw);
assert.equal(window.localStorage.getItem(ETF_CATALOG_KEY), legacyEtfRaw);
const safeState = window.__productRestructureTestApi.safeState();
assert.equal(safeState.schemaVersion, 7);
assert.equal(safeState.decisionProfiles.some((profile) => profile.id === "legacy-profile"), true);
assert.equal(safeState.watchlist.some((item) => item.id === "legacy-watch"), true);
assert.equal(safeState.realizedTrades.some((trade) => trade.id === "legacy-realized"), true);
assert.equal(safeState.tradeJournalEntries.some((entry) => entry.id === "legacy-journal"), true);
assert.equal(safeState.retirementScenarios.some((scenario) => scenario.id === "legacy-retirement-scenario"), true);
assert.equal(safeState.snapshots.some((snapshot) => snapshot.id === "legacy-snapshot"), true);
const persistedHistory = await window.__productRestructureTestApi.persistedHistory();
assert.equal(persistedHistory.flat.snapshots.some((snapshot) => snapshot.id === "legacy-snapshot"), true);
assert.equal(persistedHistory.flat.snapshots.filter((snapshot) => snapshot.source === "MONTHLY_REVIEW").length, 1);
assert.equal(persistedHistory.primary.historyMeta.schemaVersion, "assettrail.history.v1");
assert.equal(Object.hasOwn(persistedHistory.primary, "snapshots"), false);
assert.equal(Object.hasOwn(persistedHistory.primary, "performanceObservations"), false);
assert.deepEqual(alerts, []);

window.document.querySelector("#dashboardMonthlyConclusion").value = "교체 전에 남아 있던 미저장 초안";
window.document.querySelector("#dashboardNextReviewDate").value = "2026-10-31";
window.__productRestructureTestApi.replaceMonthlyAuthoritative(snapshots.map((snapshot) => (
  snapshot.id === firstMonthly.id
    ? { ...snapshot, note: "권위 상태에서 교체된 결론", nextReviewAt: "2026-09-29" }
    : snapshot
)));
assert.equal(
  window.document.querySelector("#dashboardMonthlyConclusion").value,
  "권위 상태에서 교체된 결론",
  "authoritative state replacement must rehydrate the same review id"
);
assert.equal(window.document.querySelector("#dashboardNextReviewDate").value, "2026-09-29");

window.__productRestructureTestApi.prepareExternalRestore();
const externalRestoreText = JSON.stringify({
  schemaVersion: "assettrail.external-store.v1",
  snapshots: [],
  updatedAt: FIXED_NOW
});
const externalRestoreInput = window.document.querySelector("#externalDataBackupInput");
Object.defineProperty(externalRestoreInput, "files", {
  configurable: true,
  value: [{ size: externalRestoreText.length, text: async () => externalRestoreText }]
});
externalRestoreInput.dispatchEvent(new window.Event("change", { bubbles: true }));
await waitUntil(window, () => window.document.querySelector("#settingsExternalDataStatus").textContent.includes("교체했습니다"));
assert.equal(
  window.document.querySelector("#settingsExternalDataStatus").textContent,
  window.document.querySelector("#butlerImportStatus").textContent,
  "visible and legacy Butler statuses must stay synchronized"
);

const etfRestoreInput = window.document.querySelector("#etfCatalogInput");
Object.defineProperty(etfRestoreInput, "files", {
  configurable: true,
  value: [{ size: 1, text: async () => "{" }]
});
etfRestoreInput.dispatchEvent(new window.Event("change", { bubbles: true }));
await waitUntil(window, () => window.document.querySelector("#settingsEtfCatalogStatus").textContent.includes("올바른 JSON"));
assert.equal(
  window.document.querySelector("#settingsEtfCatalogStatus").textContent,
  window.document.querySelector("#etfCatalogStatus").textContent,
  "visible and legacy ETF statuses must stay synchronized"
);

assert.equal(await window.__productRestructureTestApi.saveQuickAtCapacity(), false);
assert.match(alerts.at(-1), /조회 기록은 최대 10,000개/);

window.document.querySelector("#dashboardMonthlyConclusion").value = "첫 사용자에게만 속한 초안";
window.document.querySelector("#dashboardNextReviewDate").value = "2026-10-01";
window.__productRestructureTestApi.switchMonthlyContext(`${STORAGE_KEY}:user-other`, []);
assert.equal(window.document.querySelector("#dashboardMonthlyConclusion").value, "");
assert.equal(window.document.querySelector("#dashboardNextReviewDate").value, "2026-09-19");
window.__productRestructureTestApi.switchMonthlyContext(`${STORAGE_KEY}:user-other`, [{
  id: "other-review",
  createdAt: "2026-08-18T00:00:00.000Z",
  total: 100,
  note: "다른 컨텍스트의 저장된 결론",
  source: "MONTHLY_REVIEW",
  nextReviewAt: "2026-09-28",
  typeTotals: {}
}]);
assert.equal(window.document.querySelector("#dashboardMonthlyConclusion").value, "다른 컨텍스트의 저장된 결론");
assert.equal(window.document.querySelector("#dashboardNextReviewDate").value, "2026-09-28");

console.log("app product restructure tests passed");
