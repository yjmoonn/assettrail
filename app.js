const STORAGE_KEY = "finance-ledger-retirement-v1";
const CLOUD_DOC_ID = "primary";
const PRICE_FILE_PATH = "prices.json";
const PUBLIC_PRICE_FILE_URL = "https://yjmoonn.github.io/assettrail/prices.json";
const PIE_COLORS = ["#2563eb", "#059669", "#d97706", "#64748b", "#8b5cf6"];
const BREAKDOWN_ICONS = {
  "계좌 분석": "wallet",
  "계좌별": "layers",
  "상품 유형 분석": "chart",
  "국내/해외 비중": "globe"
};
const RETIREMENT_MONEY_FIELDS = new Set(["currentInvestable", "monthlyInvest", "monthlySpend"]);
const PRICE_STALE_DAYS = 3;
const firebaseConfig = window.firebaseConfig || {};
const ASSET_TYPE_LABELS = {
  KRX: "KRX 국내",
  US: "US 미국",
  CASH: "CASH 현금",
  MANUAL: "MANUAL 수동"
};
const ACCOUNT_CLASS_LABELS = {
  AUTO: "자동 분류",
  GENERAL: "일반계좌",
  PENSION: "연금계좌",
  SAVINGS: "적금",
  UNASSIGNED: "계좌 미지정"
};
const MANUAL_SUBTYPE_LABELS = {
  AUTO: "자동 추정",
  SAVINGS: "적금",
  DEPOSIT: "예금",
  FUND: "펀드",
  INSURANCE: "보험",
  OTHER: "기타"
};
const REGION_LABELS = {
  DOMESTIC: "국내",
  OVERSEAS: "해외",
  OTHER: "기타"
};
const JOURNAL_ACTION_LABELS = {
  BUY: "매수",
  SELL: "매도",
  REBALANCE: "리밸런싱",
  WATCH: "관찰"
};
const JOURNAL_STATUS_LABELS = {
  OPEN: "진행중",
  REVIEW: "복기필요",
  DONE: "완료"
};
const CHECK_ICON_GLYPHS = {
  price: "₩",
  review: "↻",
  target: "%",
  snapshot: "✦"
};
const APP_VIEWS = new Set(["DASHBOARD", "ASSETS", "JOURNAL", "PORTFOLIO", "GOALS", "SETTINGS"]);
const VIEW_LABELS = {
  DASHBOARD: "대시보드",
  ASSETS: "자산",
  JOURNAL: "투자 기록",
  PORTFOLIO: "포트폴리오",
  GOALS: "목표",
  SETTINGS: "설정",
};
// 상단바 제목/부제 — 뷰마다 갱신(고정 "대시보드" 표기 방지)
const VIEW_HEADINGS = {
  DASHBOARD: { title: "나의 자산 대시보드", subtitle: "가격, 포트폴리오, 매매일지, 은퇴 목표를 가볍게 훑어보세요." },
  ASSETS: { title: "자산", subtitle: "보유 자산과 매수·매도를 한 곳에서 관리해요." },
  JOURNAL: { title: "투자 기록", subtitle: "매매 판단과 매도 결과를 기록하고 복기해요." },
  PORTFOLIO: { title: "포트폴리오", subtitle: "계좌·상품·국내외 배분과 목표 비중 차이를 봐요." },
  GOALS: { title: "목표", subtitle: "자산 추이와 은퇴 계획을 함께 점검해요." },
  SETTINGS: { title: "설정", subtitle: "동기화, 가격표, 데이터, 운영 작업을 관리해요." },
};

function viewHash(view) {
  return "#" + String(view).toLowerCase();
}

function viewFromHash() {
  const slug = (location.hash || "").replace(/^#/, "").toUpperCase();
  return APP_VIEWS.has(slug) ? slug : "DASHBOARD";
}

let cloud = {
  auth: null,
  db: null,
  docRef: null,
  enabled: false,
  ready: false,
  user: null,
  lastPushedFingerprint: null,
  lastSyncedPriceTickers: null
};
let activeStorageKey = STORAGE_KEY;

let priceBook = {
  errors: [],
  fx: {},
  generatedAt: null,
  loaded: false,
  prices: {
    KRX: {},
    US: {}
  },
  symbols: {
    KRX: {},
    US: {}
  }
};
let activePriceFileUrl = PRICE_FILE_PATH;

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  totalAsset: document.querySelector("#totalAsset"),
  assetCount: document.querySelector("#assetCount"),
  lastDelta: document.querySelector("#lastDelta"),
  lastDeltaRate: document.querySelector("#lastDeltaRate"),
  lastDeltaChip: document.querySelector("#lastDeltaChip"),
  firstDelta: document.querySelector("#firstDelta"),
  firstDeltaRate: document.querySelector("#firstDeltaRate"),
  firstDeltaChip: document.querySelector("#firstDeltaChip"),
  heroSparkline: document.querySelector("#heroSparkline"),
  heroSparklineEmpty: document.querySelector("#heroSparklineEmpty"),
  retireGap: document.querySelector("#retireGap"),
  retireGapLabel: document.querySelector("#retireGapLabel"),
  appNavButtons: [...document.querySelectorAll("[data-nav-view]")],
  appSections: [...document.querySelectorAll("[data-app-section]")],
  dashboardSnapshotBtn: document.querySelector("#dashboardSnapshotBtn"),
  dashboardReviewCount: document.querySelector("#dashboardReviewCount"),
  dashboardChecklist: document.querySelector("#dashboardChecklist"),
  dashboardTopAsset: document.querySelector("#dashboardTopAsset"),
  dashboardTopAssetMeta: document.querySelector("#dashboardTopAssetMeta"),
  dashboardRecentRecord: document.querySelector("#dashboardRecentRecord"),
  dashboardRecentRecordMeta: document.querySelector("#dashboardRecentRecordMeta"),
  dashboardPortfolioFocus: document.querySelector("#dashboardPortfolioFocus"),
  dashboardGoalProgress: document.querySelector("#dashboardGoalProgress"),
  dashboardGoalBar: document.querySelector("#dashboardGoalBar"),
  dashboardComposition: document.querySelector("#dashboardComposition"),
  dashboardRecentList: document.querySelector("#dashboardRecentList"),
  settingsCloudStatus: document.querySelector("#settingsCloudStatus"),
  settingsPriceStatus: document.querySelector("#settingsPriceStatus"),
  assetForm: document.querySelector("#assetForm"),
  assetFormPanel: document.querySelector("#assetFormPanel"),
  assetFormTitle: document.querySelector("#assetFormTitle"),
  assetId: document.querySelector("#assetId"),
  assetName: document.querySelector("#assetName"),
  assetTicker: document.querySelector("#assetTicker"),
  assetTickerHelp: document.querySelector("#assetTickerHelp"),
  assetCategory: document.querySelector("#assetCategory"),
  assetAccount: document.querySelector("#assetAccount"),
  assetAmount: document.querySelector("#assetAmount"),
  assetAmountField: document.querySelector("#assetAmountField"),
  assetQuantity: document.querySelector("#assetQuantity"),
  assetAveragePrice: document.querySelector("#assetAveragePrice"),
  assetNote: document.querySelector("#assetNote"),
  sellFormPanel: document.querySelector("#sellFormPanel"),
  sellAssetSummary: document.querySelector("#sellAssetSummary"),
  sellForm: document.querySelector("#sellForm"),
  sellAssetId: document.querySelector("#sellAssetId"),
  sellDate: document.querySelector("#sellDate"),
  sellQuantity: document.querySelector("#sellQuantity"),
  sellPrice: document.querySelector("#sellPrice"),
  sellFxRateField: document.querySelector("#sellFxRateField"),
  sellFxRate: document.querySelector("#sellFxRate"),
  sellFees: document.querySelector("#sellFees"),
  sellTax: document.querySelector("#sellTax"),
  sellMemo: document.querySelector("#sellMemo"),
  sellJournalEnabled: document.querySelector("#sellJournalEnabled"),
  sellPreview: document.querySelector("#sellPreview"),
  cancelSellBtn: document.querySelector("#cancelSellBtn"),
  buyFormPanel: document.querySelector("#buyFormPanel"),
  buyAssetSummary: document.querySelector("#buyAssetSummary"),
  buyForm: document.querySelector("#buyForm"),
  buyAssetId: document.querySelector("#buyAssetId"),
  buyDate: document.querySelector("#buyDate"),
  buyQuantity: document.querySelector("#buyQuantity"),
  buyPrice: document.querySelector("#buyPrice"),
  buyFxRateField: document.querySelector("#buyFxRateField"),
  buyFxRate: document.querySelector("#buyFxRate"),
  buyFees: document.querySelector("#buyFees"),
  buyMemo: document.querySelector("#buyMemo"),
  buyJournalEnabled: document.querySelector("#buyJournalEnabled"),
  buyPreview: document.querySelector("#buyPreview"),
  cancelBuyBtn: document.querySelector("#cancelBuyBtn"),
  saveAssetBtn: document.querySelector("#saveAssetBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  snapshotBtn: document.querySelector("#snapshotBtn"),
  assetRows: document.querySelector("#assetRows"),
  assetCards: document.querySelector("#assetCards"),
  assetSearch: document.querySelector("#assetSearch"),
  assetTypeFilter: document.querySelector("#assetTypeFilter"),
  priceAlert: document.querySelector("#priceAlert"),
  visibleAssetCount: document.querySelector("#visibleAssetCount"),
  categoryBreakdown: document.querySelector("#categoryBreakdown"),
  realizedSummary: document.querySelector("#realizedSummary"),
  realizedChart: document.querySelector("#realizedChart"),
  realizedRows: document.querySelector("#realizedRows"),
  realizedYearFilter: document.querySelector("#realizedYearFilter"),
  investmentJournalTab: document.querySelector("#investmentJournalTab"),
  investmentRealizedTab: document.querySelector("#investmentRealizedTab"),
  journalTabPanel: document.querySelector("#journalTabPanel"),
  realizedTabPanel: document.querySelector("#realizedTabPanel"),
  journalTabCount: document.querySelector("#journalTabCount"),
  realizedTabCount: document.querySelector("#realizedTabCount"),
  historyChart: document.querySelector("#historyChart"),
  historyRows: document.querySelector("#historyRows"),
  historySummary: document.querySelector("#historySummary"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  syncAssetsBtn: document.querySelector("#syncAssetsBtn"),
  retirementForm: document.querySelector("#retirementForm"),
  currentAge: document.querySelector("#currentAge"),
  retireAge: document.querySelector("#retireAge"),
  lifeAge: document.querySelector("#lifeAge"),
  currentInvestable: document.querySelector("#currentInvestable"),
  monthlyInvest: document.querySelector("#monthlyInvest"),
  monthlySpend: document.querySelector("#monthlySpend"),
  inflationRate: document.querySelector("#inflationRate"),
  postReturnRate: document.querySelector("#postReturnRate"),
  requiredNestEgg: document.querySelector("#requiredNestEgg"),
  requiredSpendInfo: document.querySelector("#requiredSpendInfo"),
  returnNoContrib: document.querySelector("#returnNoContrib"),
  returnWithContrib: document.querySelector("#returnWithContrib"),
  targetStatus: document.querySelector("#targetStatus"),
  targetStatusDetail: document.querySelector("#targetStatusDetail"),
  retirementProgressBar: document.querySelector("#retirementProgressBar"),
  retirementProgressLabel: document.querySelector("#retirementProgressLabel"),
  priceStatus: document.querySelector("#priceStatus"),
  priceRefreshBtn: document.querySelector("#priceRefreshBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  toggleAssetFormBtn: document.querySelector("#toggleAssetFormBtn"),
  loginBtn: document.querySelector("#loginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  cloudSyncBtn: document.querySelector("#cloudSyncBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  appNotice: document.querySelector("#appNotice"),
  syncDetail: document.querySelector("#syncDetail"),
  assetAccountClass: document.querySelector("#assetAccountClass"),
  assetManualSubtype: document.querySelector("#assetManualSubtype"),
  manualSubtypeField: document.querySelector("#manualSubtypeField"),
  assetAccountFilter: document.querySelector("#assetAccountFilter"),
  assetStatusFilter: document.querySelector("#assetStatusFilter"),
  assetGainFilter: document.querySelector("#assetGainFilter"),
  assetSort: document.querySelector("#assetSort"),
  ledgerFilterToggle: document.querySelector("#ledgerFilterToggle"),
  ledgerAdvancedFilters: document.querySelector("#ledgerAdvancedFilters"),
  assetRegionSegment: document.querySelector("#assetRegionSegment"),
  opsStatus: document.querySelector("#opsStatus"),
  targetDomestic: document.querySelector("#targetDomestic"),
  targetOverseas: document.querySelector("#targetOverseas"),
  targetCash: document.querySelector("#targetCash"),
  targetManual: document.querySelector("#targetManual"),
  rebalanceSummary: document.querySelector("#rebalanceSummary"),
  historyRange: document.querySelector("#historyRange"),
  snapshotNote: document.querySelector("#snapshotNote"),
  historyChartDescription: document.querySelector("#historyChartDescription"),
  viewAnnounce: document.querySelector("#viewAnnounce"),
  retirementScenarioName: document.querySelector("#retirementScenarioName"),
  retirementScenarioSelect: document.querySelector("#retirementScenarioSelect"),
  saveScenarioBtn: document.querySelector("#saveScenarioBtn"),
  loadScenarioBtn: document.querySelector("#loadScenarioBtn"),
  deleteScenarioBtn: document.querySelector("#deleteScenarioBtn"),
  retirementSensitivity: document.querySelector("#retirementSensitivity"),
  emptyAssetTemplate: document.querySelector("#emptyAssetTemplate"),
  assetDetailOverlay: document.querySelector("#assetDetailOverlay"),
  assetDetailDrawer: document.querySelector("#assetDetailDrawer"),
  emptyRealizedTemplate: document.querySelector("#emptyRealizedTemplate"),
  emptyHistoryTemplate: document.querySelector("#emptyHistoryTemplate"),
  journalFormPanel: document.querySelector("#journalFormPanel"),
  journalForm: document.querySelector("#journalForm"),
  journalFormTitle: document.querySelector("#journalFormTitle"),
  toggleJournalFormBtn: document.querySelector("#toggleJournalFormBtn"),
  journalId: document.querySelector("#journalId"),
  journalRealizedTradeId: document.querySelector("#journalRealizedTradeId"),
  journalDate: document.querySelector("#journalDate"),
  journalAssetId: document.querySelector("#journalAssetId"),
  journalAssetName: document.querySelector("#journalAssetName"),
  journalTicker: document.querySelector("#journalTicker"),
  journalRegion: document.querySelector("#journalRegion"),
  journalAccount: document.querySelector("#journalAccount"),
  journalAction: document.querySelector("#journalAction"),
  journalStatus: document.querySelector("#journalStatus"),
  journalQuantity: document.querySelector("#journalQuantity"),
  journalPrice: document.querySelector("#journalPrice"),
  journalReason: document.querySelector("#journalReason"),
  journalRisk: document.querySelector("#journalRisk"),
  journalReview: document.querySelector("#journalReview"),
  journalTags: document.querySelector("#journalTags"),
  journalFilter: document.querySelector("#journalFilter"),
  journalSummary: document.querySelector("#journalSummary"),
  journalList: document.querySelector("#journalList"),
  cancelJournalBtn: document.querySelector("#cancelJournalBtn"),
  saveJournalBtn: document.querySelector("#saveJournalBtn")
};

const state = loadState();
const uiState = {
  assetSearch: "",
  assetType: "ALL",
  accountFilter: "ALL",
  statusFilter: "ALL",
  gainFilter: "ALL",
  assetSort: "VALUE_DESC",
  regionFilter: "ALL",
  journalFilter: "ALL",
  investmentRecordTab: "JOURNAL",
  activeView: "DASHBOARD",
  historyRange: "ALL",
  realizedYear: "ALL",
  autofilledAssetName: ""
};

function defaultState() {
  return {
    assets: [],
    realizedTrades: [],
    tradeJournalEntries: [],
    snapshots: [],
    meta: {
      cloudUpdatedAt: null,
      lastSavedAt: null,
      lastSyncDirection: "local"
    },
    portfolioTargets: {
      domestic: 50,
      overseas: 30,
      cash: 10,
      manual: 10
    },
    retirementScenarios: [],
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

function storageKeyForUser(user) {
  return user?.uid ? `${STORAGE_KEY}:user:${user.uid}` : STORAGE_KEY;
}

function loadState(storageKey = activeStorageKey) {
  const fallback = defaultState();

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      ...fallback,
      ...saved,
      assets: Array.isArray(saved.assets) ? saved.assets.map(normalizeAsset) : [],
      realizedTrades: Array.isArray(saved.realizedTrades) ? saved.realizedTrades.map(normalizeRealizedTrade) : [],
      tradeJournalEntries: Array.isArray(saved.tradeJournalEntries) ? saved.tradeJournalEntries.map(normalizeTradeJournalEntry) : [],
      snapshots: Array.isArray(saved.snapshots) ? saved.snapshots : [],
      meta: { ...fallback.meta, ...(saved.meta || {}) },
      portfolioTargets: { ...fallback.portfolioTargets, ...(saved.portfolioTargets || {}) },
      retirementScenarios: Array.isArray(saved.retirementScenarios) ? saved.retirementScenarios : [],
      retirement: { ...fallback.retirement, ...(saved.retirement || {}) }
    };
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(activeStorageKey, JSON.stringify(storageSafeState()));
}

function hasFirebaseConfig() {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(firebaseConfig[key]));
}

function cloudSafeState() {
  const updatedAt = new Date().toISOString();
  state.meta.lastSavedAt = updatedAt;
  return {
	    ...storageSafeState(),
	    updatedAt
	  };
	}

function storageSafeState() {
	  return {
	    assets: state.assets.map(serializeAsset),
	    realizedTrades: state.realizedTrades.map(serializeRealizedTrade),
	    tradeJournalEntries: state.tradeJournalEntries.map(serializeTradeJournalEntry),
	    snapshots: state.snapshots,
	    meta: state.meta,
	    portfolioTargets: state.portfolioTargets,
	    retirementScenarios: state.retirementScenarios,
	    retirement: state.retirement
	  };
	}

function replaceState(nextState) {
  const fallback = defaultState();
  state.assets = Array.isArray(nextState.assets) ? nextState.assets.map(normalizeAsset) : [];
  state.realizedTrades = Array.isArray(nextState.realizedTrades) ? nextState.realizedTrades.map(normalizeRealizedTrade) : [];
  state.tradeJournalEntries = Array.isArray(nextState.tradeJournalEntries) ? nextState.tradeJournalEntries.map(normalizeTradeJournalEntry) : [];
  state.snapshots = Array.isArray(nextState.snapshots) ? nextState.snapshots : [];
  state.meta = {
    ...fallback.meta,
    ...(nextState.meta || {}),
    cloudUpdatedAt: nextState.updatedAt || nextState.meta?.cloudUpdatedAt || null
  };
  state.portfolioTargets = { ...fallback.portfolioTargets, ...(nextState.portfolioTargets || {}) };
  state.retirementScenarios = Array.isArray(nextState.retirementScenarios) ? nextState.retirementScenarios : [];
  state.retirement = { ...fallback.retirement, ...(nextState.retirement || {}) };
  applyPricesToAssets();
  hydrateRetirementInputs();
  hydratePortfolioTargetInputs();
  renderRetirementScenarioOptions();
}

function setSyncStatus(text, online = false) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.classList.toggle("online", online);
}

function setSyncDetail(text, online = false) {
  if (!els.syncDetail) return;
  els.syncDetail.hidden = !text;
  els.syncDetail.textContent = text || "";
  els.syncDetail.classList.toggle("online", online);
}

function setPriceStatus(text, online = false) {
  if (!els.priceStatus) return;
  els.priceStatus.textContent = text;
  els.priceStatus.classList.toggle("online", online);
}

function showUndoNotice(message, undo) {
  if (!els.appNotice) return;
  els.appNotice.hidden = false;
  els.appNotice.innerHTML = `<span>${escapeHtml(message)}</span> <button class="ghost-button" type="button">되돌리기</button>`;
  const button = els.appNotice.querySelector("button");
  button.addEventListener("click", () => {
    undo();
    els.appNotice.hidden = true;
    els.appNotice.textContent = "";
  }, { once: true });
}

async function initPrices() {
  setPriceStatus("가격 확인중");
  if (els.priceRefreshBtn) els.priceRefreshBtn.disabled = true;

  try {
    const loaded = await loadPriceBook();
    priceBook = normalizePriceBook(loaded.data);
    activePriceFileUrl = loaded.url;
    applyPricesToAssets();
    setPriceStatus(priceBook.generatedAt ? `가격 ${compactDateTime(priceBook.generatedAt)}` : "가격 완료", true);
    render(false);
  } catch (error) {
    console.error(error);
    applyPricesToAssets();
    setPriceStatus("가격 불가");
    render(false);
  } finally {
    if (els.priceRefreshBtn) els.priceRefreshBtn.disabled = false;
  }
}

async function loadPriceBook() {
  let lastError = null;

  for (const url of priceFileCandidates()) {
    try {
      const response = await fetch(cacheBustedUrl(url), priceFetchOptions(url));
      if (!response.ok) {
        lastError = new Error(response.status === 404 ? "Prices not found" : `Prices unavailable: ${response.status}`);
        continue;
      }
      return { data: await response.json(), url };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Prices unavailable");
}

function priceFileCandidates() {
  const candidates = [PRICE_FILE_PATH];
  const protocol = window.location?.protocol || "";
  const host = window.location?.hostname || "";
  const needsPublicFallback = protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "";
  if (needsPublicFallback) candidates.push(PUBLIC_PRICE_FILE_URL);
  return [...new Set(candidates)];
}

function cacheBustedUrl(url) {
  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function priceFetchOptions(url) {
  const options = { cache: "no-store" };
  if (isSameOriginUrl(url)) {
    options.headers = {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };
  }
  return options;
}

function isSameOriginUrl(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function initFirebase() {
  if (!hasFirebaseConfig()) {
    setSyncStatus("로컬 저장");
    return;
  }

  try {
    const modules = window.assetTrailFirebaseModules || {};
    const appModule = modules.app || await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = modules.auth || await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const firestoreModule = modules.firestore || await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const app = appModule.initializeApp(firebaseConfig);
    cloud.auth = authModule.getAuth(app);
    cloud.db = firestoreModule.getFirestore(app);
    cloud.provider = new authModule.GoogleAuthProvider();
    cloud.signInWithPopup = authModule.signInWithPopup;
    cloud.signInWithRedirect = authModule.signInWithRedirect;
    cloud.getRedirectResult = authModule.getRedirectResult;
    cloud.signOut = authModule.signOut;
    cloud.doc = firestoreModule.doc;
    cloud.getDoc = firestoreModule.getDoc;
    cloud.setDoc = firestoreModule.setDoc;
    cloud.arrayUnion = firestoreModule.arrayUnion;
    cloud.enabled = true;
    cloud.ready = true;

    if (authModule.setPersistence && authModule.browserLocalPersistence) {
      await authModule.setPersistence(cloud.auth, authModule.browserLocalPersistence);
    }

    authModule.onAuthStateChanged(cloud.auth, (user) => {
      completeCloudSignIn(user).catch((error) => {
        console.error(error);
        setSyncStatus("불러오기 실패");
      });
    });

    cloud.getRedirectResult(cloud.auth)
      .then(async (result) => {
        if (result?.user) {
          await completeCloudSignIn(result.user);
        }
      })
      .catch((error) => {
        console.error(error);
        setSyncStatus(`로그인 실패: ${error.code || "unknown"}`);
      });
  } catch (error) {
    console.error(error);
    setSyncStatus("클라우드 준비 실패");
  }
}

async function completeCloudSignIn(user) {
  if (cloud.user?.uid === user?.uid && cloud.docRef) return;

  persist();
  cancelCloudPush();
  cloud.user = user;
  cloud.docRef = null;
  cloud.lastPushedFingerprint = null;
  cloud.lastSyncedPriceTickers = null;
  activeStorageKey = storageKeyForUser(user);
  replaceState(loadState(activeStorageKey));
  render(false);
  updateAuthUi();
  if (!user) {
    setSyncStatus(cloud.enabled ? "클라우드 준비" : "로컬 저장", false);
    return;
  }

  cloud.docRef = cloud.doc(cloud.db, "users", user.uid, "financeData", CLOUD_DOC_ID);
  await pullCloudData();
}

function updateAuthUi() {
  const signedIn = Boolean(cloud.user);
  els.loginBtn.hidden = signedIn || !cloud.enabled;
  els.logoutBtn.hidden = !signedIn;
  els.cloudSyncBtn.hidden = !signedIn;

  if (!cloud.enabled) {
    setSyncStatus("로컬 저장");
  } else if (signedIn) {
    setSyncStatus(`클라우드: ${cloud.user.email || "로그인됨"}`, true);
    setSyncDetail(syncDetailText(), true);
  } else {
    setSyncStatus("클라우드 준비");
    setSyncDetail("");
  }
}

async function pullCloudData() {
  if (!cloud.docRef) return;
  setSyncStatus("클라우드 확인중", true);
  const snapshot = await cloud.getDoc(cloud.docRef);
  if (snapshot.exists()) {
    const cloudData = snapshot.data();
    if (shouldWarnCloudConflict(cloudData)) {
      const useCloud = confirm(
        `클라우드와 현재 화면 데이터가 서로 다릅니다.\n\n클라우드 저장 시각: ${formatDate(cloudData.updatedAt || cloudData.meta?.lastSavedAt)}\n현재 화면 저장 시각: ${formatDate(state.meta.lastSavedAt)}\n\n확인: 클라우드 데이터를 가져옵니다.\n취소: 현재 화면 데이터를 클라우드에 저장합니다.`
      );
      if (!useCloud) {
        await pushCloudData("upload");
        return;
      }
    }
    replaceState(cloudData);
    state.meta.lastSyncDirection = "download";
    cloud.lastPushedFingerprint = dataFingerprint(storageSafeState());
    render(false);
    await syncPriceRequests();
  } else {
    replaceState(defaultState());
    state.meta.cloudUpdatedAt = null;
    state.meta.lastSyncDirection = "local";
    persist();
    render(false);
  }
  updateAuthUi();
}

async function pushCloudData(direction = "save") {
  if (!cloud.docRef) return;
  const fingerprint = dataFingerprint(storageSafeState());
  if (direction !== "upload" && fingerprint === cloud.lastPushedFingerprint) {
    updateAuthUi();
    return;
  }
  setSyncStatus("클라우드 저장중", true);
  const payload = cloudSafeState();
  await cloud.setDoc(cloud.docRef, payload, { merge: true });
  cloud.lastPushedFingerprint = fingerprint;
  state.meta.cloudUpdatedAt = payload.updatedAt;
  state.meta.lastSyncDirection = direction;
  persist();
  await syncPriceRequests();
  updateAuthUi();
}

let cloudPushTimer = null;
let cloudPushPending = false;

function cloudPushDelayMs() {
  const value = window.assetTrailCloudPushDelayMs;
  return Number.isFinite(value) ? value : 2000;
}

function scheduleCloudPush() {
  if (!cloud.docRef) return;
  cloudPushPending = true;
  if (cloudPushTimer !== null) window.clearTimeout(cloudPushTimer);
  cloudPushTimer = window.setTimeout(() => {
    cloudPushTimer = null;
    flushCloudPush();
  }, cloudPushDelayMs());
}

async function flushCloudPush() {
  if (cloudPushTimer !== null) {
    window.clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
  }
  if (!cloudPushPending || !cloud.docRef) return;
  cloudPushPending = false;
  try {
    await pushCloudData();
  } catch (error) {
    console.error(error);
    setSyncStatus("저장 실패");
  }
}

function cancelCloudPush() {
  cloudPushPending = false;
  if (cloudPushTimer !== null) {
    window.clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
  }
}

function shouldWarnCloudConflict(cloudData) {
  if (!localHasUserData() || !cloudData || !cloudData.updatedAt) return false;
  if (state.meta.cloudUpdatedAt && state.meta.cloudUpdatedAt === cloudData.updatedAt) return false;
  return dataFingerprint(storageSafeState()) !== dataFingerprint(cloudData);
}

function localHasUserData() {
  return Boolean(state.assets.length || state.realizedTrades.length || state.tradeJournalEntries.length || state.snapshots.length);
}

function dataFingerprint(data) {
  return JSON.stringify({
    assets: (data.assets || []).map(normalizeAsset).map(serializeAsset),
    realizedTrades: (data.realizedTrades || []).map(normalizeRealizedTrade).map(serializeRealizedTrade),
    tradeJournalEntries: (data.tradeJournalEntries || []).map(normalizeTradeJournalEntry).map(serializeTradeJournalEntry),
    snapshots: data.snapshots || [],
    portfolioTargets: data.portfolioTargets || {},
    retirement: data.retirement || {},
    retirementScenarios: data.retirementScenarios || []
  });
}

function syncDetailText() {
  const saved = state.meta.lastSavedAt || state.meta.cloudUpdatedAt;
  if (!saved) return "저장 대기";
  const direction = {
    download: "가져옴",
    upload: "올림",
    save: "저장"
  }[state.meta.lastSyncDirection] || "저장";
  return `${direction}: ${compactDateTime(saved)}`;
}

async function syncPriceRequests() {
  if (!cloud.db || !cloud.user || !cloud.doc || !cloud.setDoc) return;
  const tickers = usTickersInState();
  if (!tickers.length) return;
  const tickerKey = tickers.join(",");
  if (tickerKey === cloud.lastSyncedPriceTickers) return;

  const ref = cloud.doc(cloud.db, "priceRequests", "us");
  const tickerValue = typeof cloud.arrayUnion === "function" ? cloud.arrayUnion(...tickers) : tickers;
  await cloud.setDoc(ref, {
    tickers: tickerValue,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  cloud.lastSyncedPriceTickers = tickerKey;
}

function usTickersInState() {
  return [...new Set(
    state.assets
      .map(normalizeAsset)
      .filter((asset) => assetType(asset) === "US")
      .map((asset) => normalizeTicker("US", asset.ticker))
      .filter(Boolean)
  )].sort();
}

const KRW_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});
const PLAIN_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 6
});
const INTEGER_NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0
});
const KO_COLLATOR = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
const TRADE_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric"
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short"
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric"
});
const CHART_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric"
});
const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function money(value) {
  return KRW_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function usd(value) {
  return USD_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatPlainNumber(value) {
  return PLAIN_NUMBER_FORMATTER.format(Number(value || 0));
}

function formatIntegerNumber(value) {
  return INTEGER_NUMBER_FORMATTER.format(Number(value || 0));
}

function percent(value) {
  if (!Number.isFinite(value)) return "계산 불가";
  return `${(value * 100).toFixed(2)}%`;
}

function numberValue(input) {
  return parseAmount(input.value);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAsset(asset) {
  const { category, ...rest } = asset || {};
  const type = normalizeAssetType(rest.type || inferLegacyAssetType(asset));
  const currentPrice = Number(rest.currentPrice || 0);
  return {
    ...rest,
	    type,
	    account: String(rest.account || "").trim(),
	    accountClass: normalizeAccountClass(rest.accountClass),
	    manualSubtype: normalizeManualSubtype(rest.manualSubtype),
	    ticker: String(rest.ticker || "").trim().toUpperCase(),
    amount: isManualValuedType(type) ? Number(rest.amount || 0) : 0,
    currentPrice: isMarketType(type) && Number.isFinite(currentPrice) ? currentPrice : 0,
    quantity: Number(rest.quantity || 0),
    averagePrice: Number(rest.averagePrice || 0)
  };
}

function serializeAsset(asset) {
  const normalized = normalizeAsset(asset);
  const { currentPrice, priceDate, priceSource, priceUpdatedAt, ...saved } = normalized;
  return saved;
}

function normalizeRealizedTrade(trade) {
  const soldAt = trade?.soldAt || trade?.date || new Date().toISOString().slice(0, 10);
  const quantity = Number(trade?.quantity || 0);
  const averagePrice = Number(trade?.averagePrice || 0);
  const sellPrice = Number(trade?.sellPrice || 0);
  const fxRate = Number(trade?.fxRate || 1) || 1;
  const fees = Number(trade?.fees || 0);
  const tax = Number(trade?.tax || 0);
  const grossAmount = Number.isFinite(Number(trade?.grossAmount))
    ? Number(trade.grossAmount)
    : quantity * sellPrice * fxRate;
  const costAmount = Number.isFinite(Number(trade?.costAmount))
    ? Number(trade.costAmount)
    : quantity * averagePrice * fxRate;
  const realizedGain = Number.isFinite(Number(trade?.realizedGain))
    ? Number(trade.realizedGain)
    : grossAmount - costAmount - fees - tax;
  const realizedGainRate = costAmount > 0 ? realizedGain / costAmount : null;

  return {
    id: trade?.id || uid(),
    assetId: trade?.assetId || "",
    soldAt,
    name: String(trade?.name || "").trim(),
    ticker: String(trade?.ticker || "").trim().toUpperCase(),
    type: normalizeAssetType(trade?.type),
    account: String(trade?.account || "").trim(),
    quantity,
    averagePrice,
    sellPrice,
    fxRate,
    grossAmount,
    costAmount,
    fees,
    tax,
    realizedGain,
    realizedGainRate,
    memo: String(trade?.memo || "").trim(),
    createdAt: trade?.createdAt || new Date().toISOString()
  };
}

function serializeRealizedTrade(trade) {
  return normalizeRealizedTrade(trade);
}

function normalizeTradeJournalEntry(entry) {
  const assetTypeValue = normalizeAssetType(entry?.type);
  return {
    id: entry?.id || uid(),
    assetId: String(entry?.assetId || ""),
    realizedTradeId: String(entry?.realizedTradeId || ""),
    date: normalizeJournalDate(entry?.date || entry?.createdAt),
    name: String(entry?.name || "").trim(),
    ticker: String(entry?.ticker || "").trim().toUpperCase(),
    type: assetTypeValue,
    region: normalizeRegion(entry?.region || regionCodeForType(assetTypeValue)),
    account: String(entry?.account || "").trim(),
    action: normalizeJournalAction(entry?.action),
    quantity: Number(entry?.quantity || 0),
    price: Number(entry?.price || 0),
    reason: String(entry?.reason || "").trim(),
    risk: String(entry?.risk || "").trim(),
    review: String(entry?.review || "").trim(),
    tags: String(entry?.tags || "").trim(),
    status: normalizeJournalStatus(entry?.status),
    createdAt: entry?.createdAt || new Date().toISOString(),
    updatedAt: entry?.updatedAt || entry?.createdAt || new Date().toISOString()
  };
}

function serializeTradeJournalEntry(entry) {
  return normalizeTradeJournalEntry(entry);
}

function normalizeJournalDate(value) {
  const raw = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : localDateInputValue();
}

function normalizeRegion(value) {
  const region = String(value || "").trim().toUpperCase();
  return REGION_LABELS[region] ? region : "OTHER";
}

function normalizeJournalAction(value) {
  const action = String(value || "").trim().toUpperCase();
  return JOURNAL_ACTION_LABELS[action] ? action : "WATCH";
}

function normalizeJournalStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return JOURNAL_STATUS_LABELS[status] ? status : "OPEN";
}

function inferLegacyAssetType(asset) {
  const category = String(asset?.category || "").trim();
  const ticker = String(asset?.ticker || "").trim().toUpperCase();
  if (category === "현금" || category === "예금") return "CASH";
  if (category === "주식" || category === "ETF") return /^[A-Z.]+$/.test(ticker) ? "US" : "KRX";
  return "MANUAL";
}

function normalizeAssetType(value) {
  const type = String(value || "").trim().toUpperCase();
  return ASSET_TYPE_LABELS[type] ? type : "MANUAL";
}

function normalizeAccountClass(value) {
  const accountClass = String(value || "AUTO").trim().toUpperCase();
  return ACCOUNT_CLASS_LABELS[accountClass] ? accountClass : "AUTO";
}

function normalizeManualSubtype(value) {
  const subtype = String(value || "AUTO").trim().toUpperCase();
  return MANUAL_SUBTYPE_LABELS[subtype] ? subtype : "AUTO";
}

function assetType(asset) {
  return normalizeAssetType(asset?.type || inferLegacyAssetType(asset));
}

function assetTypeLabel(asset) {
  return ASSET_TYPE_LABELS[assetType(asset)];
}

function isMarketType(type) {
  return type === "KRX" || type === "US";
}

function isManualValuedType(type) {
  return type === "CASH" || type === "MANUAL";
}

function marketPriceMissing(asset) {
  return isMarketType(assetType(asset)) && !(Number(asset.currentPrice || 0) > 0);
}

function assetIdentity(asset) {
  const type = assetType(asset);
  const ticker = normalizeAssetKey(asset.ticker);
  const account = normalizeAssetKey(asset.account);
  if (isMarketType(type) && ticker) return `${type}:${ticker}:${account}`;
  return `${type}:${normalizeAssetKey(asset.name)}:${account}`;
}

function normalizeTicker(type, ticker) {
  const normalized = String(ticker || "").trim().toUpperCase();
  if (type === "KRX" && /^\d+$/.test(normalized)) return normalized.padStart(6, "0");
  return normalized;
}

function tickerHelpForType(type) {
  if (type === "KRX") return "KRX 가격은 매일 전체 자동 수집됩니다. 6자리 영문/숫자 코드를 입력하세요.";
  if (type === "US") return "US 이름은 자동완성됩니다. 평가금액은 가격표에 포함된 티커만 계산됩니다. 평단가는 달러 기준으로 입력하세요.";
  return "CASH/MANUAL은 티커 없이 수동평가금액으로 계산합니다.";
}

function validateTicker(type, ticker) {
  if (!isMarketType(type)) return "";
  const normalized = normalizeTicker(type, ticker);
  if (!normalized) return "KRX/US 자산은 티커를 입력하세요.";
  if (type === "KRX" && !/^[0-9A-Z]{6}$/.test(normalized)) return "KRX 종목코드는 영문/숫자 6자리로 입력하세요.";
  if (type === "US" && !/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized)) return "US 티커는 영문, 숫자, 점, 하이픈만 입력하세요.";
  return "";
}

function normalizePriceBook(data) {
  const nextBook = {
    errors: Array.isArray(data?.errors) ? data.errors : [],
    fx: normalizeFx(data?.fx),
    generatedAt: data?.generatedAt || data?.updatedAt || data?.date || null,
    loaded: true,
    prices: {
      KRX: {},
      US: {}
    },
    symbols: {
      KRX: {},
      US: {}
    }
  };

  addPriceGroup(nextBook, "KRX", data?.prices?.KRX || data?.KRX);
  addPriceGroup(nextBook, "US", data?.prices?.US || data?.US);
  addSymbolGroup(nextBook, "KRX", data?.symbols?.KRX);
  addSymbolGroup(nextBook, "US", data?.symbols?.US);

  if (data?.prices && !data.prices.KRX && !data.prices.US) {
    Object.entries(data.prices).forEach(([key, entry]) => {
      const [type, ticker] = String(key).split(":");
      addPriceEntry(nextBook, normalizeAssetType(type), ticker, entry);
    });
  }

  return nextBook;
}

function normalizeFx(fx) {
  const usdkrw = typeof fx?.USDKRW === "number" ? { rate: fx.USDKRW } : fx?.USDKRW;
  const rate = Number(usdkrw?.rate || usdkrw?.close || usdkrw?.value || 0);
  return {
    USDKRW: Number.isFinite(rate) && rate > 0
      ? {
          date: usdkrw?.date || usdkrw?.asOf || usdkrw?.updatedAt || null,
          rate,
          source: usdkrw?.source || null
        }
      : null
  };
}

function addSymbolGroup(book, type, group) {
  if (!group || typeof group !== "object") return;
  Object.entries(group).forEach(([ticker, entry]) => addSymbolEntry(book, type, ticker, entry));
}

function addSymbolEntry(book, type, ticker, entry) {
  if (!isMarketType(type)) return;
  const key = normalizeTicker(type, ticker);
  const symbol = parseSymbolEntry(entry);
  if (!key || !symbol) return;
  book.symbols[type][key] = symbol;
}

function parseSymbolEntry(entry) {
  if (typeof entry === "string") {
    const name = entry.trim();
    return name ? { name } : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const name = String(entry.name || entry.shortName || entry.longName || "").trim();
  if (!name) return null;
  return {
    kind: entry.kind || null,
    name,
    source: entry.source || null
  };
}

function addPriceGroup(book, type, group) {
  if (!group || typeof group !== "object") return;
  Object.entries(group).forEach(([ticker, entry]) => addPriceEntry(book, type, ticker, entry));
}

function addPriceEntry(book, type, ticker, entry) {
  if (!isMarketType(type)) return;
  const key = normalizeTicker(type, ticker);
  const price = parsePriceEntry(entry);
  if (!key || !price) return;
  book.prices[type][key] = price;
}

function parsePriceEntry(entry) {
  if (typeof entry === "number") return Number.isFinite(entry) ? { close: entry } : null;
  if (!entry || typeof entry !== "object") return null;

  const close = Number(entry.close ?? entry.price ?? entry.value ?? entry.last);
  if (!Number.isFinite(close) || close <= 0) return null;

  return {
    close,
    date: entry.date || entry.asOf || entry.updatedAt || null,
    kind: entry.kind || null,
    name: entry.name || entry.shortName || entry.longName || null,
    source: entry.source || null
  };
}

function priceForAsset(asset) {
  const type = assetType(asset);
  if (!isMarketType(type)) return null;

  const ticker = normalizeTicker(type, asset.ticker);
  return priceBook.prices[type][ticker] || null;
}

function priceNameForTicker(type, ticker) {
  if (!isMarketType(type)) return "";
  const key = normalizeTicker(type, ticker);
  const price = priceBook.prices[type][key];
  const symbol = priceBook.symbols[type][key];
  return String(price?.name || symbol?.name || "").trim();
}

function applyPricesToAssets() {
  state.assets = state.assets.map((asset) => {
    const normalized = normalizeAsset(asset);
    const type = assetType(normalized);
    if (!isMarketType(type)) return normalized;

    const price = priceForAsset(normalized);
    return {
      ...normalized,
      currentPrice: price ? price.close : 0,
      kind: price?.kind || symbolForAsset(normalized)?.kind || null,
      priceDate: price?.date || priceBook.generatedAt || null,
      priceSource: price?.source || activePriceFileUrl,
      priceUpdatedAt: priceBook.generatedAt
    };
  });
}

function totalAssets() {
  return state.assets.reduce((sum, asset) => sum + assetValue(asset), 0);
}

function assetValue(asset) {
  const type = assetType(asset);
  if (isManualValuedType(type)) return Number(asset.amount || 0);

  const quantity = Number(asset.quantity || 0);
  const currentPrice = Number(asset.currentPrice || 0);
  if (quantity > 0 && currentPrice > 0) return quantity * currentPrice * priceMultiplier(type);
  return 0;
}

function assetCost(asset) {
  const type = assetType(asset);
  if (!isMarketType(type)) return 0;

  const quantity = Number(asset.quantity || 0);
  const averagePrice = Number(asset.averagePrice || 0);
  if (quantity > 0 && averagePrice > 0) return quantity * averagePrice * priceMultiplier(type);
  return 0;
}

function priceMultiplier(type) {
  return type === "US" ? usdKrwRate() : 1;
}

function usdKrwRate() {
  return Number(priceBook.fx?.USDKRW?.rate || 0) || 0;
}

function symbolForAsset(asset) {
  const type = assetType(asset);
  if (!isMarketType(type)) return null;
  return priceBook.symbols[type][normalizeTicker(type, asset.ticker)] || null;
}

function assetKind(asset) {
  const type = assetType(asset);
  if (type === "CASH") return "CASH";
  if (type === "MANUAL") {
    const subtype = normalizeManualSubtype(asset.manualSubtype);
    return subtype === "AUTO" ? `MANUAL_${inferManualSubtype(asset)}` : `MANUAL_${subtype}`;
  }
  return String(asset.kind || priceForAsset(asset)?.kind || symbolForAsset(asset)?.kind || "STOCK").toUpperCase();
}

function productKindLabel(kind) {
  const labels = {
    STOCK: "개별종목",
    ETF: "ETF",
    ETN: "ETN",
    CASH: "현금",
    MANUAL: "수동평가",
    MANUAL_SAVINGS: "적금",
    MANUAL_DEPOSIT: "예금",
    MANUAL_FUND: "펀드",
    MANUAL_INSURANCE: "보험",
    MANUAL_OTHER: "기타 수동평가"
  };
  return labels[kind] || kind;
}

function regionLabel(asset) {
  const type = assetType(asset);
  if (type === "KRX") return "국내";
  if (type === "US") return "해외";
  return "기타";
}

function regionCodeForType(type) {
  if (type === "KRX") return "DOMESTIC";
  if (type === "US") return "OVERSEAS";
  return "OTHER";
}

function regionCodeForAsset(asset) {
  return regionCodeForType(assetType(asset));
}

function accountClassLabel(asset) {
  const explicit = normalizeAccountClass(asset.accountClass);
  if (explicit !== "AUTO") return ACCOUNT_CLASS_LABELS[explicit];
  const text = `${asset.account || ""} ${asset.name || ""} ${asset.note || ""}`.toLowerCase();
  if (/(적금|청약)/i.test(text)) return "적금";
  if (/(연금|irp|퇴직|개인형퇴직연금|확정기여형|(^|\s)dc(형)?(\s|$))/i.test(text)) return "연금계좌";
  if (asset.account) return "일반계좌";
  return "계좌 미지정";
}

function inferManualSubtype(asset) {
  const text = `${asset.account || ""} ${asset.name || ""} ${asset.note || ""}`.toLowerCase();
  if (/(적금|청약)/i.test(text)) return "SAVINGS";
  if (/예금/i.test(text)) return "DEPOSIT";
  if (/펀드|fund/i.test(text)) return "FUND";
  if (/보험/i.test(text)) return "INSURANCE";
  return "OTHER";
}

function assetGain(asset) {
  const cost = assetCost(asset);
  if (!cost || marketPriceMissing(asset)) return null;
  return assetValue(asset) - cost;
}

function canSellAsset(asset) {
  const type = assetType(asset);
  return isMarketType(type) && Number(asset.quantity || 0) > 0;
}

function canBuyAsset(asset) {
  return isMarketType(assetType(asset));
}

function decimalValue(input) {
  return parseAmount(input.value);
}

function setSigned(el, value, formatter = money) {
  el.textContent = `${value > 0 ? "+" : ""}${formatter(value)}`;
  el.classList.toggle("positive", value > 0);
  el.classList.toggle("negative", value < 0);
}

function deltaRate(current, previous) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}

function saveRetirementInputs() {
  state.retirement = {
    currentAge: numberValue(els.currentAge),
    retireAge: numberValue(els.retireAge),
    lifeAge: numberValue(els.lifeAge),
    currentInvestable: numberValue(els.currentInvestable),
    monthlyInvest: numberValue(els.monthlyInvest),
    monthlySpend: numberValue(els.monthlySpend),
    inflationRate: numberValue(els.inflationRate),
    postReturnRate: numberValue(els.postReturnRate)
  };
}

function hydrateRetirementInputs() {
  Object.entries(state.retirement).forEach(([key, value]) => {
    if (!els[key]) return;
    els[key].value = RETIREMENT_MONEY_FIELDS.has(key) ? formatIntegerNumber(value) : value;
  });
}

function formatRetirementMoneyInput(input) {
  if (!input || !RETIREMENT_MONEY_FIELDS.has(input.id)) return;
  input.value = formatIntegerNumber(parseAmount(input.value));
}

const VIEW_RENDERERS = {
  DASHBOARD: () => {
    renderSummary();
    renderDashboard();
  },
  ASSETS: () => {
    renderAssets();
    renderPriceNotice();
  },
  JOURNAL: () => {
    renderJournal();
    renderRealized();
    renderInvestmentRecordTabs();
  },
  PORTFOLIO: () => {
    renderBreakdown();
  },
  GOALS: () => {
    renderHistory();
    renderRetirement();
  },
  SETTINGS: () => {
    renderSettingsSummary();
  }
};

const dirtyViews = new Set();

function markAllViewsDirty() {
  APP_VIEWS.forEach((view) => dirtyViews.add(view));
}

function renderView(view) {
  VIEW_RENDERERS[view]?.();
  dirtyViews.delete(view);
}

function renderAllViews() {
  markAllViewsDirty();
  APP_VIEWS.forEach((view) => renderView(view));
  setActiveView(uiState.activeView, { scroll: false });
  persist();
}

function render(syncCloud = true) {
  markAllViewsDirty();
  renderView(uiState.activeView);
  setActiveView(uiState.activeView, { scroll: false });
  persist();
  if (syncCloud && cloud.docRef) {
    scheduleCloudPush();
  }
}

function renderSummary() {
  const currentTotal = totalAssets();
  const lastSnapshot = state.snapshots.at(-1);
  const firstSnapshot = state.snapshots[0];
  const lastBase = lastSnapshot ? lastSnapshot.total : currentTotal;
  const firstBase = firstSnapshot ? firstSnapshot.total : currentTotal;
  const lastChange = currentTotal - lastBase;
  const firstChange = currentTotal - firstBase;

  els.totalAsset.textContent = money(currentTotal);
  els.assetCount.textContent = `${state.assets.length}개 자산`;
  setSigned(els.lastDelta, lastChange);
  setSigned(els.lastDeltaRate, deltaRate(currentTotal, lastBase), percent);
  setSigned(els.firstDelta, firstChange);
  setSigned(els.firstDeltaRate, deltaRate(currentTotal, firstBase), percent);
  setChipTone(els.lastDeltaChip, lastChange);
  setChipTone(els.firstDeltaChip, firstChange);
  drawHeroSparkline();
}

function setChipTone(chip, value) {
  if (!chip) return;
  chip.classList.toggle("chip-up", value > 0);
  chip.classList.toggle("chip-down", value < 0);
}

function drawHeroSparkline() {
  const canvas = els.heroSparkline;
  if (!canvas) return;
  const points = state.snapshots.slice(-12).map((snapshot) => Number(snapshot.total) || 0);
  const hasTrend = points.length >= 2;
  if (els.heroSparklineEmpty) els.heroSparklineEmpty.hidden = hasTrend;
  canvas.hidden = !hasTrend;
  if (!hasTrend) return;

  const wrap = canvas.parentElement;
  // Use the canvas's actual rendered width (CSS controls display size to avoid overflow).
  const measured = canvas.clientWidth || (wrap ? wrap.clientWidth : 0);
  const cssWidth = Math.max(160, measured || 320);
  const cssHeight = canvas.clientHeight || 132;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cs = getComputedStyle(document.documentElement);
  const cssVar = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padX = 6;
  const padTop = 12;
  const padBottom = 10;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || Math.abs(max) || 1;
  const plotW = cssWidth - padX * 2;
  const plotH = cssHeight - padTop - padBottom;
  const xFor = (i) => padX + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const yFor = (v) => padTop + plotH - ((v - min) / span) * plotH;

  const up = points[points.length - 1] >= points[0];
  const line = up ? cssVar("--green", "#059669") : cssVar("--red", "#dc2626");

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const fill = ctx.createLinearGradient(0, padTop, 0, cssHeight - padBottom);
  fill.addColorStop(0, hexToRgba(line, 0.18));
  fill.addColorStop(1, hexToRgba(line, 0));
  ctx.save();
  ctx.lineTo(xFor(points.length - 1), cssHeight - padBottom);
  ctx.lineTo(xFor(0), cssHeight - padBottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  const lastX = xFor(points.length - 1);
  const lastY = yFor(points[points.length - 1]);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--surface", "#ffffff");
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = line;
  ctx.stroke();
}

function renderDashboard() {
  if (!els.dashboardChecklist) return;
  const tasks = dashboardTasks();
  els.dashboardReviewCount.textContent = `${tasks.length}건`;
  els.dashboardChecklist.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `<li class="check-card"><span class="check-icon kind-${escapeHtml(task.kind || "snapshot")}" aria-hidden="true">${CHECK_ICON_GLYPHS[task.kind] || "•"}</span><div class="check-text"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.detail)}</span></div></li>`
        )
        .join("")
    : `<li class="check-card check-card-ok"><span class="check-icon kind-ok" aria-hidden="true">✓</span><div class="check-text"><strong>모두 정상이에요</strong><span>가격, 목표 비중, 복기 기록이 안정적인 상태예요.</span></div></li>`;

  const retirement = calculateRetirement(state.retirement);
  if (retirement?.nestEgg) {
    const progress = Math.max(0, Math.min(1, Number(state.retirement.currentInvestable || 0) / retirement.nestEgg));
    els.dashboardGoalProgress.textContent = `${(progress * 100).toFixed(0)}%`;
    if (els.dashboardGoalBar) els.dashboardGoalBar.style.width = `${Math.max(2, progress * 100)}%`;
  } else {
    els.dashboardGoalProgress.textContent = "계산 대기";
    if (els.dashboardGoalBar) els.dashboardGoalBar.style.width = "0%";
  }

  renderDashboardComposition();
  renderDashboardRecentList();
}

function renderDashboardComposition() {
  if (!els.dashboardComposition) return;
  const total = totalAssets();
  if (!state.assets.length || !total) {
    els.dashboardComposition.innerHTML = `<p class="dashboard-module-empty">자산을 등록하면 국내·해외·현금·수동 비중이 표시됩니다.</p>`;
    return;
  }

  const buckets = [
    { key: "domestic", label: "국내", type: "KRX" },
    { key: "overseas", label: "해외", type: "US" },
    { key: "cash", label: "현금", type: "CASH" },
    { key: "manual", label: "수동", type: "MANUAL" }
  ];

  els.dashboardComposition.innerHTML = buckets
    .map((bucket) => {
      const value = state.assets
        .filter((asset) => assetType(asset) === bucket.type)
        .reduce((sum, asset) => sum + assetValue(asset), 0);
      const currentRate = total ? value / total : 0;
      const targetRate = Math.max(0, Number(state.portfolioTargets?.[bucket.key] || 0)) / 100;
      const diff = currentRate - targetRate;
      const diffLabel = Math.abs(diff) < 0.005
        ? "목표 충족"
        : `목표 ${diff > 0 ? "초과" : "부족"} ${(Math.abs(diff) * 100).toFixed(1)}%p`;
      const width = Math.max(0, Math.min(100, currentRate * 100));
      const markerPos = Math.max(0, Math.min(100, targetRate * 100));
      return `
        <div class="composition-row">
          <div class="composition-row-head">
            <span class="composition-label">${escapeHtml(bucket.label)}</span>
            <span class="composition-value">${(currentRate * 100).toFixed(1)}%</span>
          </div>
          <div class="composition-track" role="img" aria-label="${escapeHtml(bucket.label)} 현재 ${(currentRate * 100).toFixed(1)}%, 목표 ${(targetRate * 100).toFixed(0)}%">
            <span class="composition-fill" style="width:${width}%"></span>
            <span class="composition-target" style="left:${markerPos}%" title="목표 ${(targetRate * 100).toFixed(0)}%"></span>
          </div>
          <div class="composition-meta">${escapeHtml(money(value))} · ${escapeHtml(diffLabel)}</div>
        </div>
      `;
    })
    .join("");
}

function renderDashboardRecentList() {
  if (!els.dashboardRecentList) return;
  const records = [];
  (state.tradeJournalEntries || []).forEach((entry) => {
    const when = entry.date || entry.createdAt;
    records.push({
      time: new Date(when).getTime() || 0,
      action: entry.action || "WATCH",
      title: entry.name || "자산",
      sub: entry.reason || JOURNAL_STATUS_LABELS[entry.status] || "",
      day: shortDay(when)
    });
  });
  (state.realizedTrades || []).forEach((trade) => {
    records.push({
      time: new Date(trade.soldAt).getTime() || 0,
      action: "SELL",
      title: trade.name || "자산",
      sub: `실현손익 ${money(trade.realizedGain || 0)}`,
      day: shortDay(trade.soldAt)
    });
  });

  const top = records.sort((a, b) => b.time - a.time).slice(0, 5);
  els.dashboardRecentList.innerHTML = top.length
    ? top
        .map((record) => {
          const label = JOURNAL_ACTION_LABELS[record.action] || "기록";
          const sub = record.sub ? ` · ${record.sub}` : "";
          return `<li class="recent-item"><span class="recent-badge badge-${escapeHtml(record.action.toLowerCase())}">${escapeHtml(label)}</span><div class="recent-text"><strong>${escapeHtml(record.title)}${escapeHtml(sub)}</strong></div><span class="recent-day">${escapeHtml(record.day)}</span></li>`;
        })
        .join("")
    : `<li class="recent-record-empty"><strong>기록 없음</strong><span>매매일지를 작성하면 최근 기록이 쌓입니다.</span></li>`;
}

function dashboardTasks() {
  const tasks = [];
  const missingPrices = marketAssetsMissingPrices();
  if (missingPrices.length) {
    tasks.push({
      kind: "price",
      title: `가격 대기 자산 ${missingPrices.length}개`,
      detail: "다음 가격표 생성을 기다리는 티커가 있어요."
    });
  }

  const reviewCount = (state.tradeJournalEntries || []).filter((entry) => entry.status === "REVIEW").length;
  if (reviewCount) {
    tasks.push({
      kind: "review",
      title: `복기 필요한 기록 ${reviewCount}건`,
      detail: "매매일지를 다시 볼 차례예요."
    });
  }

  const targetGap = largestTargetGap();
  if (targetGap && targetGap.absRate >= 0.05) {
    tasks.push({
      kind: "target",
      title: "목표 비중 차이",
      detail: `${targetGap.label} 비중이 목표보다 ${targetGap.direction} ${Math.abs(targetGap.rate * 100).toFixed(1)}%p예요.`
    });
  }

  if (!state.snapshots.length) {
    tasks.push({
      kind: "snapshot",
      title: "첫 조회 기록",
      detail: "오늘 총자산을 저장하면 변화 추적이 시작돼요."
    });
  }

  return tasks.slice(0, 4);
}

function largestTargetGap() {
  const total = totalAssets();
  if (!total) return null;
  const current = {
    domestic: state.assets.filter((asset) => assetType(asset) === "KRX").reduce((sum, asset) => sum + assetValue(asset), 0),
    overseas: state.assets.filter((asset) => assetType(asset) === "US").reduce((sum, asset) => sum + assetValue(asset), 0),
    cash: state.assets.filter((asset) => assetType(asset) === "CASH").reduce((sum, asset) => sum + assetValue(asset), 0),
    manual: state.assets.filter((asset) => assetType(asset) === "MANUAL").reduce((sum, asset) => sum + assetValue(asset), 0)
  };
  const labels = { domestic: "국내", overseas: "해외", cash: "현금", manual: "수동" };
  return Object.entries(labels)
    .map(([key, label]) => {
      const currentRate = current[key] / total;
      const targetRate = Math.max(0, Number(state.portfolioTargets?.[key] || 0)) / 100;
      const rate = currentRate - targetRate;
      return { label, rate, absRate: Math.abs(rate), direction: rate > 0 ? "초과" : "부족" };
    })
    .sort((a, b) => b.absRate - a.absRate)[0];
}

function renderSettingsSummary() {
  if (els.settingsCloudStatus) {
    els.settingsCloudStatus.textContent = cloud.user?.email ? `클라우드: ${cloud.user.email}` : "로컬 저장";
  }
  if (els.settingsPriceStatus) {
    els.settingsPriceStatus.textContent = els.priceStatus?.textContent || "가격 대기";
  }
}

function setActiveView(view, options = {}) {
  const nextView = APP_VIEWS.has(view) ? view : "DASHBOARD";
  if (dirtyViews.has(nextView)) renderView(nextView);
  uiState.activeView = nextView;
  const heading = VIEW_HEADINGS[nextView] || VIEW_HEADINGS.DASHBOARD;
  if (els.pageTitle) els.pageTitle.textContent = heading.title;
  if (els.pageSubtitle) els.pageSubtitle.textContent = heading.subtitle;
  let activeSection = null;
  els.appSections.forEach((section) => {
    const selected = section.dataset.appSection === nextView;
    section.hidden = !selected;
    if (selected && !activeSection) activeSection = section;
  });
  els.appNavButtons.forEach((button) => {
    const selected = button.dataset.navView === nextView;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (options.updateHash) {
    const target = viewHash(nextView);
    if (location.hash !== target) {
      history.pushState({ view: nextView }, "", target);
    }
  }
  if (options.scroll) {
    document.querySelector("main")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  if (options.focus && activeSection) {
    const focusTarget = activeSection.querySelector("h1, h2, h3") || activeSection;
    focusTarget.setAttribute("tabindex", "-1");
    focusTarget.focus({ preventScroll: true });
    if (els.viewAnnounce) els.viewAnnounce.textContent = `${VIEW_LABELS[nextView] || nextView} 화면`;
  }
  if (nextView === "DASHBOARD") {
    requestAnimationFrame(() => drawHeroSparkline());
  }
}

function renderAssets() {
  els.assetRows.textContent = "";
  if (els.assetCards) els.assetCards.textContent = "";
  renderAccountFilterOptions();
  renderRegionSegment();
  updateLedgerFilterIndicator();
  updateVisibleAssetCount(state.assets.length, state.assets.length);
  if (!state.assets.length) {
    els.assetRows.append(els.emptyAssetTemplate.content.cloneNode(true));
    renderAssetCardEmpty("등록된 자산이 없습니다. 자산 추가로 첫 자산을 등록하세요.");
    return;
  }

  const sorted = sortAssets([...state.assets]);
  const filtered = sorted.filter(assetMatchesFilters);
  updateVisibleAssetCount(filtered.length, state.assets.length);

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5" class="empty">조건에 맞는 자산이 없습니다.</td>`;
    els.assetRows.append(row);
    renderAssetCardEmpty("조건에 맞는 자산이 없습니다.");
    return;
  }

  filtered.forEach((asset) => {
    const gain = assetGain(asset);
    const gainRate = gain === null ? null : gain / assetCost(asset);
    const valueDetail = assetValueDetail(asset);
    const buyButton = canBuyAsset(asset)
      ? `<button class="text-icon-button buy-action" type="button" title="추가매수" aria-label="${escapeHtml(asset.name)} 추가매수" data-action="buy" data-id="${asset.id}">추가매수</button>`
      : "";
    const sellButton = canSellAsset(asset)
      ? `<button class="text-icon-button" type="button" title="매도 기록" aria-label="${escapeHtml(asset.name)} 매도 기록" data-action="sell" data-id="${asset.id}">매도</button>`
      : "";
    const journalButton = `<button class="table-action quiet-action" type="button" title="일지 작성" aria-label="${escapeHtml(asset.name)} 일지 작성" data-action="journal" data-id="${asset.id}">일지</button>`;
    const row = document.createElement("tr");
    row.dataset.id = asset.id;
    const gainArrow = gain > 0 ? "▲ " : gain < 0 ? "▼ " : "";
    row.innerHTML = `
      <td class="asset-cell">
        <strong>${escapeHtml(asset.name)}</strong>
        <span class="asset-sub">
          ${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}
          <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
          ${asset.account ? `<span class="asset-account">${escapeHtml(asset.account)}</span>` : ""}
        </span>
        ${asset.note ? `<span class="asset-note-line">${escapeHtml(asset.note)}</span>` : ""}
      </td>
      <td class="number">${asset.quantity ? formatPlainNumber(asset.quantity) : "-"}</td>
      <td class="number">${money(assetValue(asset))}${valueDetail}</td>
      <td class="number ${gain > 0 ? "positive" : gain < 0 ? "negative" : ""}">${gain === null ? "-" : `${gainArrow}${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`}</td>
      <td>
        <div class="row-actions">
          ${buyButton}
          ${sellButton}
          ${journalButton}
          <button class="table-action quiet-action" type="button" title="상세 · 수정 · 삭제" aria-label="${escapeHtml(asset.name)} 상세" data-action="detail" data-id="${asset.id}">상세</button>
        </div>
      </td>
    `;
    els.assetRows.append(row);
    renderAssetCard(asset, gain, gainRate, valueDetail, buyButton, sellButton, journalButton);
  });
}

function renderAssetCard(asset, gain, gainRate, valueDetail, buyButton, sellButton, journalButton) {
  if (!els.assetCards) return;
  const type = assetType(asset);
  const gainTone = gain > 0 ? "positive" : gain < 0 ? "negative" : "";
  const card = document.createElement("article");
  card.className = "asset-card";
  card.dataset.id = asset.id;
  card.innerHTML = `
    <div class="asset-card-head">
      <div>
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(asset.account || "계좌 미지정")}</span>
      </div>
      <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
    </div>
    <div class="asset-card-value">
      <span>평가금액</span>
      <strong>${money(assetValue(asset))}</strong>
      ${valueDetail}
    </div>
    <div class="asset-card-meta">
      <span>${asset.ticker ? `<b>${escapeHtml(asset.ticker)}</b>` : "티커 없음"}</span>
      <span>수량 ${asset.quantity ? formatPlainNumber(asset.quantity) : "-"}</span>
      <span class="${gainTone}">손익 ${gain === null ? "-" : `${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`}</span>
    </div>
    ${asset.note ? `<p class="asset-card-note">${escapeHtml(asset.note)}</p>` : ""}
    <div class="asset-card-actions">
      ${isMarketType(type) ? `${buyButton}${sellButton || `<button class="text-icon-button disabled-action" type="button" disabled>매도</button>`}` : `<button class="text-icon-button disabled-action" type="button" disabled>잠금</button>`}
      ${journalButton}
      <button class="table-action quiet-action" type="button" data-action="detail" data-id="${asset.id}">상세</button>
    </div>
  `;
  els.assetCards.append(card);
}

function updateLedgerFilterIndicator() {
  if (!els.ledgerFilterToggle) return;
  const activeCount = [
    uiState.assetType !== "ALL",
    uiState.accountFilter !== "ALL",
    uiState.statusFilter !== "ALL",
    uiState.gainFilter !== "ALL"
  ].filter(Boolean).length;
  els.ledgerFilterToggle.textContent = activeCount ? `필터 · ${activeCount}` : "필터";
  els.ledgerFilterToggle.classList.toggle("has-active", activeCount > 0);
}

function renderAssetCardEmpty(message) {
  if (!els.assetCards) return;
  const empty = document.createElement("div");
  empty.className = "asset-card-empty";
  empty.textContent = message;
  els.assetCards.append(empty);
}

function assetMatchesFilters(asset) {
  const type = assetType(asset);
  if (uiState.assetType !== "ALL" && type !== uiState.assetType) return false;
  if (uiState.regionFilter !== "ALL" && regionCodeForAsset(asset) !== uiState.regionFilter) return false;
  if (uiState.accountFilter !== "ALL" && (asset.account || "계좌 미지정") !== uiState.accountFilter) return false;
  if (uiState.statusFilter === "PRICE_WAIT" && !marketPriceMissing(asset)) return false;
  if (uiState.statusFilter === "READY" && marketPriceMissing(asset)) return false;
  const gain = assetGain(asset);
  if (uiState.gainFilter === "GAIN" && !(gain > 0)) return false;
  if (uiState.gainFilter === "LOSS" && !(gain < 0)) return false;
  if (uiState.gainFilter === "NONE" && gain !== null && gain !== 0) return false;

  const query = normalizeAssetKey(uiState.assetSearch);
  if (!query) return true;

  const haystack = [
    asset.name,
    asset.account,
    asset.ticker,
    asset.note,
    type,
    assetTypeLabel(asset)
  ].map(normalizeAssetKey).join(" ");
  return haystack.includes(query);
}

function renderRegionSegment() {
  if (!els.assetRegionSegment) return;
  els.assetRegionSegment.querySelectorAll("[data-region-filter]").forEach((button) => {
    const active = button.dataset.regionFilter === uiState.regionFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function sortAssets(assets) {
  return assets.sort((a, b) => {
    if (uiState.assetSort === "VALUE_ASC") return assetValue(a) - assetValue(b);
    if (uiState.assetSort === "GAIN_DESC") return (assetGain(b) ?? -Infinity) - (assetGain(a) ?? -Infinity);
    if (uiState.assetSort === "GAIN_ASC") return (assetGain(a) ?? Infinity) - (assetGain(b) ?? Infinity);
    if (uiState.assetSort === "NAME_ASC") return KO_COLLATOR.compare(a.name || "", b.name || "");
    if (uiState.assetSort === "ACCOUNT_ASC") return KO_COLLATOR.compare(a.account || "", b.account || "") || KO_COLLATOR.compare(a.name || "", b.name || "");
    return assetValue(b) - assetValue(a);
  });
}

function renderAccountFilterOptions() {
  if (!els.assetAccountFilter) return;
  const current = uiState.accountFilter;
  const accounts = [...new Set(state.assets.map((asset) => asset.account || "계좌 미지정"))].sort((a, b) => a.localeCompare(b, "ko-KR"));
  els.assetAccountFilter.innerHTML = `<option value="ALL">전체 계좌</option>${accounts.map((account) => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join("")}`;
  els.assetAccountFilter.value = accounts.includes(current) ? current : "ALL";
  uiState.accountFilter = els.assetAccountFilter.value;
}

function updateVisibleAssetCount(visible, total) {
  if (!els.visibleAssetCount) return;
  els.visibleAssetCount.textContent = visible === total ? `전체 ${total}개` : `${visible} / ${total}개`;
}

function marketAssetsMissingPrices() {
  return state.assets
    .map(normalizeAsset)
    .filter((asset) => marketPriceMissing(asset))
    .map((asset) => `${assetType(asset)}:${normalizeTicker(assetType(asset), asset.ticker)}`);
}

function renderPriceNotice() {
  if (!els.priceAlert) return;

  const missing = [...new Set(marketAssetsMissingPrices())].filter((item) => !item.endsWith(":"));
  const errors = Array.isArray(priceBook.errors) ? priceBook.errors : [];
  const staleDays = daysSince(priceBook.generatedAt);
  const isStale = Number.isFinite(staleDays) && staleDays > PRICE_STALE_DAYS;
  const fxDays = daysSince(priceBook.fx?.USDKRW?.date);
  const isFxStale = Number.isFinite(fxDays) && fxDays > PRICE_STALE_DAYS;

  if (!missing.length && !errors.length && !isStale && !isFxStale) {
    els.priceAlert.hidden = true;
    els.priceAlert.textContent = "";
    renderOpsStatus();
    return;
  }

  const parts = [];
  if (isStale) parts.push(`가격표가 ${Math.floor(staleDays)}일 전 기준입니다. GitHub Actions 가격표 생성 상태를 확인하세요.`);
  if (isFxStale) parts.push(`환율이 ${Math.floor(fxDays)}일 전 기준입니다.`);
  if (missing.length) {
    const krxMissing = missing.filter((item) => item.startsWith("KRX:"));
    const usMissing = missing.filter((item) => item.startsWith("US:"));
    if (krxMissing.length) parts.push(`KRX 가격 대기: ${krxMissing.join(", ")}. 다음 가격표 업데이트 후 다시 확인하세요.`);
    if (usMissing.length) parts.push(`US 가격 대기: ${usMissing.join(", ")}. 로그인 후 저장/Sync하면 요청 목록에 올라가고 다음 가격표 생성 후 반영됩니다.`);
  }
  if (errors.length) {
    const errorText = errors
      .slice(0, 3)
      .map((error) => `${error.type || "?"}:${error.ticker || "?"}`)
      .join(", ");
    parts.push(`가격 수집 실패: ${errorText}${errors.length > 3 ? ` 외 ${errors.length - 3}건` : ""}.`);
  }

  els.priceAlert.hidden = false;
  els.priceAlert.textContent = parts.join(" ");
  renderOpsStatus();
}

function renderOpsStatus() {
  if (!els.opsStatus) return;
  if (!priceBook.loaded) {
    els.opsStatus.hidden = true;
    return;
  }
  const errorCount = Array.isArray(priceBook.errors) ? priceBook.errors.length : 0;
  const fx = priceBook.fx?.USDKRW;
  const items = [
    `가격표 ${priceBook.generatedAt ? shortDateTime(priceBook.generatedAt) : "생성일 없음"}`,
    `오류 ${errorCount}건`,
    fx?.rate ? `환율 ${formatPlainNumber(fx.rate)}원${fx.date ? ` · ${shortDate(fx.date)}` : ""}` : "환율 없음"
  ];
  els.opsStatus.hidden = false;
  els.opsStatus.textContent = items.join(" · ");
}

function assetValueDetail(asset) {
  const type = assetType(asset);
  if (type === "MANUAL") return `<small class="sub-value warning">수동평가 · 조회 시 직접 갱신 필요</small>`;
  if (type === "CASH") return `<small class="sub-value">수동 입력 금액</small>`;
  if (!isMarketType(type)) return "";
  if (marketPriceMissing(asset)) {
    const ticker = normalizeTicker(type, asset.ticker);
    const code = ticker ? `${type}:${ticker}` : type;
    const help = type === "KRX" ? "다음 가격표 업데이트 후 확인" : `${code} 가격표 생성 대상 아님`;
    return `<small class="sub-value warning">가격 대기 · ${escapeHtml(help)}</small>`;
  }

  const price = type === "US" ? usd(Number(asset.currentPrice || 0)) : formatPlainNumber(asset.currentPrice);
  const fx = type === "US" && usdKrwRate() ? ` · 환율 ${formatPlainNumber(usdKrwRate())}원` : "";
  const date = asset.priceDate ? ` · ${escapeHtml(shortDate(asset.priceDate))}` : "";
  return `<small class="sub-value">종가 ${price}${fx}${date}</small>`;
}

function renderBreakdown() {
  els.categoryBreakdown.textContent = "";
  const total = totalAssets();
  if (!state.assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "구성 데이터가 없습니다.";
    els.categoryBreakdown.append(empty);
    renderRebalanceSummary();
    return;
  }

  const accountClasses = new Map();
  const accounts = new Map();
  const kinds = new Map();
  const regions = new Map();
  state.assets.forEach((asset) => {
    const value = assetValue(asset);
    addBreakdownValue(accountClasses, accountClassLabel(asset), value);
    addBreakdownValue(accounts, asset.account || "계좌 미지정", value);
    addBreakdownValue(kinds, productKindLabel(assetKind(asset)), value);
    addBreakdownValue(regions, regionLabel(asset), value);
  });

  renderBreakdownSection("계좌 분석", accountClasses, total);
  renderBreakdownSection("계좌별", accounts, total, 6);
  renderBreakdownSection("상품 유형 분석", kinds, total);
  renderBreakdownSection("국내/해외 비중", regions, total);
  renderRebalanceSummary();
}

function addBreakdownValue(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function renderBreakdownSection(title, entries, total, limit = Infinity) {
  const section = document.createElement("section");
  section.className = "breakdown-section";
  section.innerHTML = `
    <h3>
      <span class="breakdown-icon" aria-hidden="true">${breakdownIcon(title)}</span>
      <span>${escapeHtml(title)}</span>
    </h3>
  `;

  const displayEntries = limitedBreakdownEntries(entries, limit);
  const sectionTotal = displayEntries.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  const body = document.createElement("div");
  body.className = "pie-breakdown";
  body.innerHTML = `
    <div class="pie-chart" role="img" aria-label="${escapeHtml(title)} 도넛 차트">
      <span class="donut-center">
        <span>총액</span>
        <strong>${escapeHtml(compactMoney(sectionTotal))}</strong>
      </span>
    </div>
    <div class="pie-legend"></div>
  `;

  const chart = body.querySelector(".pie-chart");
  const legend = body.querySelector(".pie-legend");
  const gradient = pieGradient(displayEntries);
  chart.style.background = gradient;
  chart.style.setProperty("--donut-fill", gradient);

  displayEntries.forEach(([category, value], index) => {
    const ratio = total ? value / total : 0;
    const item = document.createElement("div");
    item.className = "pie-legend-item";
    item.innerHTML = `
      <span class="pie-swatch" style="background: ${PIE_COLORS[index % PIE_COLORS.length]}"></span>
      <span class="breakdown-name">${escapeHtml(category)}</span>
      <span class="breakdown-value">${money(value)}</span>
      <span class="breakdown-percent">${(ratio * 100).toFixed(1)}%</span>
    `;
    legend.append(item);
  });

  section.append(body);
  els.categoryBreakdown.append(section);
}

function breakdownIcon(title) {
  const icon = BREAKDOWN_ICONS[title] || "chart";
  const paths = {
    wallet: '<path d="M4.5 7.5h15v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h12"/><path d="M16.5 12h3v3h-3a1.5 1.5 0 0 1 0-3Z"/>',
    layers: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
    chart: '<path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5"/><path d="M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5"/>'
  };

  return `<svg viewBox="0 0 24 24" focusable="false">${paths[icon]}</svg>`;
}

function limitedBreakdownEntries(entries, limit = Infinity) {
  const sorted = [...entries.entries()].sort((a, b) => b[1] - a[1]);
  if (!Number.isFinite(limit) || sorted.length <= limit) return sorted;

  const visible = sorted.slice(0, Math.max(1, limit - 1));
  const otherValue = sorted.slice(Math.max(1, limit - 1)).reduce((sum, [, value]) => sum + value, 0);
  return otherValue > 0 ? [...visible, ["기타", otherValue]] : visible;
}

function pieGradient(entries) {
  const positiveEntries = entries
    .map((entry, index) => ({ category: entry[0], value: Math.max(0, entry[1]), color: PIE_COLORS[index % PIE_COLORS.length] }))
    .filter((entry) => entry.value > 0);

  const total = positiveEntries.reduce((sum, entry) => sum + entry.value, 0);
  if (!total) return "#edf0ee";

  let cursor = 0;
  const segments = positiveEntries.map((entry, index) => {
    const start = cursor;
    const end = index === positiveEntries.length - 1 ? 100 : cursor + (entry.value / total) * 100;
    cursor = end;
    return `${entry.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function hydratePortfolioTargetInputs() {
  const targets = state.portfolioTargets || {};
  if (els.targetDomestic) els.targetDomestic.value = targets.domestic ?? 50;
  if (els.targetOverseas) els.targetOverseas.value = targets.overseas ?? 30;
  if (els.targetCash) els.targetCash.value = targets.cash ?? 10;
  if (els.targetManual) els.targetManual.value = targets.manual ?? 10;
}

function savePortfolioTargets() {
  state.portfolioTargets = {
    domestic: parseAmount(els.targetDomestic?.value || 0),
    overseas: parseAmount(els.targetOverseas?.value || 0),
    cash: parseAmount(els.targetCash?.value || 0),
    manual: parseAmount(els.targetManual?.value || 0)
  };
}

function renderRebalanceSummary() {
  if (!els.rebalanceSummary) return;
  const total = totalAssets();
  if (!total) {
    els.rebalanceSummary.innerHTML = `<div class="empty small-empty">목표 비중은 자산 등록 후 비교됩니다.</div>`;
    return;
  }

  const buckets = [
    { key: "domestic", label: "국내", type: "KRX" },
    { key: "overseas", label: "해외", type: "US" },
    { key: "cash", label: "현금", type: "CASH" },
    { key: "manual", label: "수동", type: "MANUAL" }
  ];

  els.rebalanceSummary.innerHTML = buckets.map((bucket) => {
    const value = state.assets
      .filter((asset) => assetType(asset) === bucket.type)
      .reduce((sum, asset) => sum + assetValue(asset), 0);
    const currentRate = total ? value / total : 0;
    const targetRate = Math.max(0, Number(state.portfolioTargets[bucket.key] || 0)) / 100;
    const targetValue = total * targetRate;
    const gap = targetValue - value;
    const rateDiff = currentRate - targetRate;
    const onTarget = Math.abs(rateDiff) < 0.005;
    // 목표 대비 차이는 손익(초록/빨강)과 다른 의미이므로 중립/앰버 톤을 쓴다.
    const tone = onTarget ? "on-target" : "off-target";
    const action = onTarget ? "목표 충족" : `${gap > 0 ? "부족" : "초과"} ${money(Math.abs(gap))}`;
    const width = Math.max(0, Math.min(100, currentRate * 100));
    const markerPos = Math.max(0, Math.min(100, targetRate * 100));
    return `
      <div class="composition-row">
        <div class="composition-row-head">
          <span class="composition-label">${escapeHtml(bucket.label)}</span>
          <span class="composition-value ${tone}">${escapeHtml(action)}</span>
        </div>
        <div class="composition-track" role="img" aria-label="${escapeHtml(bucket.label)} 현재 ${(currentRate * 100).toFixed(1)}%, 목표 ${(targetRate * 100).toFixed(0)}%">
          <span class="composition-fill" style="width:${width}%"></span>
          <span class="composition-target" style="left:${markerPos}%" title="목표 ${(targetRate * 100).toFixed(0)}%"></span>
        </div>
        <div class="composition-meta">현재 ${(currentRate * 100).toFixed(1)}% · 목표 ${(targetRate * 100).toFixed(0)}% · ${escapeHtml(money(value))}</div>
      </div>
    `;
  }).join("");
}

function renderInvestmentRecordTabs() {
  const active = uiState.investmentRecordTab === "REALIZED" ? "REALIZED" : "JOURNAL";
  uiState.investmentRecordTab = active;
  const tabPairs = [
    ["JOURNAL", els.investmentJournalTab, els.journalTabPanel],
    ["REALIZED", els.investmentRealizedTab, els.realizedTabPanel]
  ];

  tabPairs.forEach(([tab, button, panel]) => {
    const selected = tab === active;
    button?.classList.toggle("active", selected);
    button?.setAttribute("aria-selected", String(selected));
    if (panel) panel.hidden = !selected;
  });

  if (els.journalTabCount) els.journalTabCount.textContent = `${state.tradeJournalEntries.length}건`;
  if (els.realizedTabCount) els.realizedTabCount.textContent = `${state.realizedTrades.length}건`;
}

function setInvestmentRecordTab(tab, { scroll = false } = {}) {
  if (!["JOURNAL", "REALIZED"].includes(tab)) return;
  uiState.investmentRecordTab = tab;
  renderInvestmentRecordTabs();
  if (scroll) {
    const panel = tab === "REALIZED" ? els.realizedTabPanel : els.journalTabPanel;
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
}

function realizedTradeForJournal(entry) {
  const realizedTradeId = String(entry?.realizedTradeId || "");
  if (!realizedTradeId) return null;
  return state.realizedTrades.find((trade) => trade.id === realizedTradeId) || null;
}

function journalForRealizedTrade(trade) {
  const tradeId = String(trade?.id || "");
  if (!tradeId) return null;
  return state.tradeJournalEntries.find((entry) => entry.realizedTradeId === tradeId) || null;
}

function realizedGainBadge(trade) {
  if (!trade) return "";
  const tone = trade.realizedGain > 0 ? "positive" : trade.realizedGain < 0 ? "negative" : "";
  return `<span class="journal-badge gain-badge ${tone}">실현손익 ${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}</span>`;
}

function renderJournal() {
  if (!els.journalSummary || !els.journalList) return;
  state.tradeJournalEntries = (state.tradeJournalEntries || []).map(normalizeTradeJournalEntry);
  renderJournalAssetOptions();

  const entries = [...state.tradeJournalEntries]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .filter(journalEntryMatchesFilter);

  const total = state.tradeJournalEntries.length;
  const reviewCount = state.tradeJournalEntries.filter((entry) => entry.status === "REVIEW").length;
  const doneCount = state.tradeJournalEntries.filter((entry) => entry.status === "DONE").length;
  const linkedSellCount = state.tradeJournalEntries.filter((entry) => realizedTradeForJournal(entry)).length;
  els.journalSummary.innerHTML = [
    ["전체 일지", `${total}건`, "판단 기록"],
    ["복기 필요", `${reviewCount}건`, "다시 볼 기록"],
    ["완료", `${doneCount}건`, "복기 완료"],
    ["매도 연결", `${linkedSellCount}건`, "실현손익 참고"]
  ].map(([label, value, detail]) => `
    <div class="history-summary-item journal-summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `).join("");

  els.journalList.textContent = "";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "journal-empty";
    empty.innerHTML = `<div class="empty-state"><span class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"></path><path d="M4 4v16"></path><path d="M9 7h5M9 11h5"></path></svg></span><strong>${total ? "조건에 맞는 일지가 없어요" : "아직 매매일지가 없어요"}</strong><p>${total ? "필터를 바꿔서 다시 찾아보세요." : "자산 원장의 일지 버튼이나 일지 작성으로 첫 판단을 기록해 보세요. 투자 추천이 아니라 스스로의 복기를 위한 공간이에요."}</p></div>`;
    els.journalList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const linkedTrade = realizedTradeForJournal(entry);
    const card = document.createElement("article");
    card.className = `journal-card ${entry.status.toLowerCase()}`;
    card.innerHTML = `
      <div class="journal-card-main">
        <div class="journal-card-top">
          <span class="journal-date">${escapeHtml(formatTradeDate(entry.date))}</span>
          <span class="journal-badge">${escapeHtml(JOURNAL_ACTION_LABELS[entry.action])}</span>
          <span class="journal-badge muted">${escapeHtml(REGION_LABELS[entry.region])}</span>
          <span class="journal-badge status-${entry.status.toLowerCase()}">${escapeHtml(JOURNAL_STATUS_LABELS[entry.status])}</span>
          ${realizedGainBadge(linkedTrade)}
        </div>
        <h3>${escapeHtml(entry.name || entry.ticker || "자산 미지정")}</h3>
        <p class="journal-meta">
          ${entry.ticker ? `<span>${escapeHtml(entry.ticker)}</span>` : ""}
          ${entry.account ? `<span>${escapeHtml(entry.account)}</span>` : ""}
          ${entry.quantity ? `<span>수량 ${escapeHtml(formatPlainNumber(entry.quantity))}</span>` : ""}
          ${entry.price ? `<span>가격 ${escapeHtml(entry.type === "US" ? usd(entry.price) : formatPlainNumber(entry.price))}</span>` : ""}
        </p>
        ${entry.reason ? `<div class="journal-note"><span class="journal-note-label">이유</span><p>${escapeHtml(entry.reason)}</p></div>` : ""}
        ${entry.risk ? `<div class="journal-note"><span class="journal-note-label">리스크</span><p>${escapeHtml(entry.risk)}</p></div>` : ""}
        ${entry.review ? `<div class="journal-note"><span class="journal-note-label">복기</span><p>${escapeHtml(entry.review)}</p></div>` : ""}
        ${entry.tags ? `<div class="journal-tags">${entry.tags.split(",").map((tag) => `<span>${escapeHtml(tag.trim())}</span>`).join("")}</div>` : ""}
      </div>
      <div class="journal-actions">
        <button class="table-action quiet-action" type="button" data-journal-action="copy-ai" data-id="${entry.id}">AI 질문 복사</button>
        ${linkedTrade ? `<button class="table-action quiet-action" type="button" data-journal-action="view-realized" data-id="${entry.id}">손익 보기</button>` : ""}
        <button class="table-action quiet-action" type="button" data-journal-action="edit" data-id="${entry.id}">수정</button>
        <button class="table-action danger-action" type="button" data-journal-action="delete" data-id="${entry.id}">삭제</button>
      </div>
    `;
    els.journalList.append(card);
  });
}

function journalEntryMatchesFilter(entry) {
  const filter = uiState.journalFilter;
  if (filter === "ALL") return true;
  if (REGION_LABELS[filter]) return entry.region === filter;
  if (JOURNAL_ACTION_LABELS[filter]) return entry.action === filter;
  if (JOURNAL_STATUS_LABELS[filter]) return entry.status === filter;
  return true;
}

function renderJournalAssetOptions() {
  if (!els.journalAssetId) return;
  const current = els.journalAssetId.value;
  const options = state.assets
    .map(normalizeAsset)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko-KR"))
    .map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}${asset.ticker ? ` · ${escapeHtml(asset.ticker)}` : ""}</option>`)
    .join("");
  els.journalAssetId.innerHTML = `<option value="">직접 입력</option>${options}`;
  els.journalAssetId.value = state.assets.some((asset) => asset.id === current) ? current : "";
}

function resetJournalForm() {
  if (!els.journalForm) return;
  els.journalForm.reset();
  els.journalId.value = "";
  els.journalRealizedTradeId.value = "";
  els.journalDate.value = localDateInputValue();
  els.journalRegion.value = "DOMESTIC";
  els.journalAction.value = "BUY";
  els.journalStatus.value = "OPEN";
  els.saveJournalBtn.textContent = "일지 저장";
  if (els.journalFormTitle) els.journalFormTitle.textContent = "매매일지 작성";
  hideJournalForm();
}

function showJournalForm(entry = null) {
  if (!els.journalFormPanel || !els.journalForm) return;
  setInvestmentRecordTab("JOURNAL");
  resetAssetForm();
  resetSellForm();
  resetBuyForm();
  els.journalFormPanel.hidden = false;
  if (els.toggleJournalFormBtn) {
    els.toggleJournalFormBtn.textContent = "접기";
    els.toggleJournalFormBtn.setAttribute("aria-expanded", "true");
  }
  if (!entry) {
    resetJournalForm();
    els.journalFormPanel.hidden = false;
    if (els.toggleJournalFormBtn) {
      els.toggleJournalFormBtn.textContent = "접기";
      els.toggleJournalFormBtn.setAttribute("aria-expanded", "true");
    }
    els.journalAssetName.focus();
    return;
  }

  const normalized = normalizeTradeJournalEntry(entry);
  els.journalId.value = normalized.id;
  els.journalRealizedTradeId.value = normalized.realizedTradeId || "";
  els.journalDate.value = normalized.date;
  els.journalAssetId.value = state.assets.some((asset) => asset.id === normalized.assetId) ? normalized.assetId : "";
  els.journalAssetName.value = normalized.name;
  els.journalTicker.value = normalized.ticker;
  els.journalRegion.value = normalized.region;
  els.journalAccount.value = normalized.account;
  els.journalAction.value = normalized.action;
  els.journalStatus.value = normalized.status;
  els.journalQuantity.value = normalized.quantity ? formatPlainNumber(normalized.quantity) : "";
  els.journalPrice.value = normalized.price ? formatPlainNumber(normalized.price) : "";
  els.journalReason.value = normalized.reason;
  els.journalRisk.value = normalized.risk;
  els.journalReview.value = normalized.review;
  els.journalTags.value = normalized.tags;
  els.saveJournalBtn.textContent = "수정 저장";
  if (els.journalFormTitle) els.journalFormTitle.textContent = "매매일지 수정";
  els.journalAssetName.focus();
}

function hideJournalForm() {
  if (els.journalFormPanel) els.journalFormPanel.hidden = true;
  if (els.toggleJournalFormBtn) {
    els.toggleJournalFormBtn.textContent = "일지 작성";
    els.toggleJournalFormBtn.setAttribute("aria-expanded", "false");
  }
}

function fillJournalFromAsset(asset) {
  if (!asset) return;
  const type = assetType(asset);
  els.journalAssetId.value = asset.id;
  els.journalAssetName.value = asset.name || "";
  els.journalTicker.value = asset.ticker || "";
  els.journalRegion.value = regionCodeForAsset(asset);
  els.journalAccount.value = asset.account || "";
  els.journalQuantity.value = asset.quantity ? formatPlainNumber(asset.quantity) : "";
  els.journalPrice.value = asset.currentPrice ? formatPlainNumber(asset.currentPrice) : "";
  if (els.journalAction.value === "WATCH") return;
  if (type === "US" && !els.journalTags.value) els.journalTags.value = "해외";
  if (type === "KRX" && !els.journalTags.value) els.journalTags.value = "국내";
}

function journalEntryFromForm() {
  const selectedAsset = state.assets.find((asset) => asset.id === els.journalAssetId?.value);
  const type = selectedAsset ? assetType(selectedAsset) : normalizeAssetType(els.journalRegion.value === "OVERSEAS" ? "US" : els.journalRegion.value === "DOMESTIC" ? "KRX" : "MANUAL");
  return normalizeTradeJournalEntry({
    id: els.journalId.value || uid(),
    assetId: selectedAsset?.id || "",
    realizedTradeId: els.journalRealizedTradeId.value || "",
    date: els.journalDate.value,
    name: els.journalAssetName.value.trim(),
    ticker: els.journalTicker.value.trim().toUpperCase(),
    type,
    region: els.journalRegion.value,
    account: els.journalAccount.value.trim(),
    action: els.journalAction.value,
    status: els.journalStatus.value,
    quantity: parseAmount(els.journalQuantity.value),
    price: parseAmount(els.journalPrice.value),
    reason: els.journalReason.value.trim(),
    risk: els.journalRisk.value.trim(),
    review: els.journalReview.value.trim(),
    tags: els.journalTags.value.trim(),
    createdAt: state.tradeJournalEntries.find((entry) => entry.id === els.journalId.value)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createJournalEntryFromTrade(asset, trade) {
  return createJournalEntryFromRealizedTrade(trade, asset);
}

function createJournalEntryFromRealizedTrade(trade, asset = null) {
  const gainText = `${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}`;
  return normalizeTradeJournalEntry({
    id: uid(),
    assetId: asset?.id || trade.assetId || "",
    realizedTradeId: trade.id,
    date: trade.soldAt,
    name: trade.name || asset?.name || "",
    ticker: trade.ticker || asset?.ticker || "",
    type: trade.type,
    region: regionCodeForType(trade.type),
    account: trade.account || asset?.account || "",
    action: "SELL",
    status: "REVIEW",
    quantity: trade.quantity,
    price: trade.sellPrice,
    reason: trade.memo || "매도 처리와 함께 자동 생성된 일지입니다.",
    risk: "",
    review: `실현손익 ${gainText}. 매도 이유와 배운 점을 나중에 보완하세요.`,
    tags: "매도,복기",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createJournalEntryFromBuy(asset, buy) {
  const type = assetType(asset);
  const priceText = type === "US" ? usd(buy.buyPrice) : formatPlainNumber(buy.buyPrice);
  const averageText = type === "US" ? usd(buy.nextAveragePrice) : formatPlainNumber(buy.nextAveragePrice);
  return normalizeTradeJournalEntry({
    id: uid(),
    assetId: asset.id,
    date: buy.boughtAt,
    name: asset.name || "",
    ticker: asset.ticker || "",
    type,
    region: regionCodeForType(type),
    account: asset.account || "",
    action: "BUY",
    status: "OPEN",
    quantity: buy.quantity,
    price: buy.buyPrice,
    reason: buy.memo || "추가매수와 함께 자동 생성된 일지입니다.",
    risk: "",
    review: `추가매수 ${formatPlainNumber(buy.quantity)}주 @ ${priceText}. 보유 ${formatPlainNumber(buy.nextQuantity)}주, 새 평단 ${averageText}.`,
    tags: type === "US" ? "매수,해외" : "매수,국내",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function aiPromptForJournal(entry) {
  const normalized = normalizeTradeJournalEntry(entry);
  return [
    "아래 매매일지를 투자 추천이 아니라 복기 관점에서 검토해줘.",
    "",
    `자산: ${normalized.name || "-"} (${normalized.ticker || "-"})`,
    `구분: ${JOURNAL_ACTION_LABELS[normalized.action]} / ${REGION_LABELS[normalized.region]} / ${JOURNAL_STATUS_LABELS[normalized.status]}`,
    `날짜: ${normalized.date}`,
    `수량/가격: ${normalized.quantity || "-"} / ${normalized.price || "-"}`,
    `투자 이유: ${normalized.reason || "-"}`,
    `리스크: ${normalized.risk || "-"}`,
    `복기 메모: ${normalized.review || "-"}`,
    "",
    "1. 이 판단의 약점 3가지를 찾아줘.",
    "2. 놓친 리스크나 확인해야 할 데이터를 정리해줘.",
    "3. 다음 매매 전에 체크리스트로 바꿔줘."
  ].join("\n");
}

function openRealizedTradeFromJournal(entry) {
  const trade = realizedTradeForJournal(entry);
  if (!trade) return;
  uiState.realizedYear = tradeYear(trade) || "ALL";
  if (els.realizedYearFilter) els.realizedYearFilter.value = uiState.realizedYear;
  render(false);
  setInvestmentRecordTab("REALIZED", { scroll: true });
}

function openJournalForRealizedTrade(trade) {
  const linkedJournal = journalForRealizedTrade(trade);
  uiState.journalFilter = "ALL";
  if (els.journalFilter) els.journalFilter.value = "ALL";
  showJournalForm(linkedJournal || createJournalEntryFromRealizedTrade(trade));
}

function renderRealized() {
  if (!els.realizedSummary || !els.realizedChart || !els.realizedRows) return;
  state.realizedTrades = (state.realizedTrades || []).map(normalizeRealizedTrade);
  renderRealizedYearOptions();

  const trades = [...state.realizedTrades].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedYear = uiState.realizedYear === "ALL" ? currentYear : uiState.realizedYear;
  const filtered = uiState.realizedYear === "ALL"
    ? trades
    : trades.filter((trade) => tradeYear(trade) === uiState.realizedYear);

  const yearGain = trades
    .filter((trade) => tradeYear(trade) === currentYear)
    .reduce((sum, trade) => sum + trade.realizedGain, 0);
  const monthGain = trades
    .filter((trade) => tradeMonth(trade) === currentMonth)
    .reduce((sum, trade) => sum + trade.realizedGain, 0);
  const totalGain = trades.reduce((sum, trade) => sum + trade.realizedGain, 0);
  const totalGross = trades.reduce((sum, trade) => sum + trade.grossAmount, 0);

  const summaryItems = [
    ["올해 실현손익", yearGain, `${currentYear}년 매도 기준`],
    ["이번 달 실현손익", monthGain, `${Number(currentMonth.slice(5))}월 매도 기준`],
    ["누적 실현손익", totalGain, `${trades.length}건 기록`],
    ["총 매도금액", totalGross, "수수료/세금 차감 전"]
  ];
  els.realizedSummary.innerHTML = summaryItems.map(([label, value, detail], index) => {
    const tone = index === 3 ? "" : value > 0 ? "positive" : value < 0 ? "negative" : "";
    return `<div class="history-summary-item realized-summary-item ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${money(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>`;
  }).join("");

  renderRealizedChart(selectedYear);
  renderRealizedRows(filtered);
}

function renderRealizedYearOptions() {
  if (!els.realizedYearFilter) return;
  const years = [...new Set((state.realizedTrades || []).map(tradeYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  const current = years.includes(uiState.realizedYear) ? uiState.realizedYear : "ALL";
  els.realizedYearFilter.innerHTML = `<option value="ALL">전체 기간</option>${years.map((year) => `<option value="${year}">${year}년</option>`).join("")}`;
  els.realizedYearFilter.value = current;
  uiState.realizedYear = current;
}

function renderRealizedChart(year) {
  const monthly = Array.from({ length: 12 }, () => 0);
  (state.realizedTrades || [])
    .filter((trade) => tradeYear(trade) === year)
    .forEach((trade) => {
      const month = Number(String(trade.soldAt || "").slice(5, 7));
      if (month >= 1 && month <= 12) monthly[month - 1] += Number(trade.realizedGain || 0);
    });

  const max = Math.max(1, ...monthly.map((value) => Math.abs(value)));
  const hasData = monthly.some((value) => value !== 0);
  els.realizedChart.innerHTML = `
    <div class="realized-chart-title">
      <strong>${escapeHtml(year)}년 월별 실현손익</strong>
      <span>${hasData ? "매도일 기준" : "기록 없음"}</span>
    </div>
    <div class="realized-bars">
      ${monthly.map((value, index) => {
        const height = hasData ? Math.max(6, Math.abs(value) / max * 100) : 0;
        const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
        return `<div class="realized-bar-wrap" title="${index + 1}월 ${money(value)}">
          <div class="realized-bar-space">
            <span class="realized-bar ${tone}" style="height: ${height}%"></span>
          </div>
          <small>${index + 1}월</small>
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderRealizedRows(trades) {
  els.realizedRows.textContent = "";
  if (!trades.length) {
    els.realizedRows.append(els.emptyRealizedTemplate.content.cloneNode(true));
    return;
  }

  trades.forEach((trade) => {
    const linkedJournal = journalForRealizedTrade(trade);
    const rate = Number.isFinite(trade.realizedGainRate) ? trade.realizedGainRate : null;
    const tone = trade.realizedGain > 0 ? "positive" : trade.realizedGain < 0 ? "negative" : "";
    const price = trade.type === "US" ? usd(trade.sellPrice) : formatPlainNumber(trade.sellPrice);
    const journalAction = linkedJournal
      ? `<button class="table-action quiet-action" type="button" data-realized-action="view-journal" data-id="${trade.id}">일지 보기</button>`
      : `<button class="table-action quiet-action" type="button" data-realized-action="create-journal" data-id="${trade.id}">일지 작성</button>`;
    const realizedArrow = trade.realizedGain > 0 ? "▲ " : trade.realizedGain < 0 ? "▼ " : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${escapeHtml(trade.name || trade.ticker)}</strong>
        <span class="realized-sub">
          <span class="realized-date">${escapeHtml(formatTradeDate(trade.soldAt))}</span>
          ${trade.ticker ? `<span class="ticker">${escapeHtml(trade.ticker)}</span>` : ""}
          <span class="realized-account">${escapeHtml(trade.account || "계좌 미지정")}</span>
        </span>
      </td>
      <td class="number">${formatPlainNumber(trade.quantity)}<small class="sub-value">${price}${trade.type === "US" ? ` · 환율 ${formatPlainNumber(trade.fxRate)}` : ""}</small></td>
      <td class="number">${money(trade.grossAmount)}</td>
      <td class="number ${tone}">${realizedArrow}${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}${rate === null ? "" : `<small class="sub-value">${rate > 0 ? "+" : ""}${percent(rate)}</small>`}</td>
      <td><div class="row-actions">${journalAction}</div></td>
    `;
    els.realizedRows.append(row);
  });
}

function tradeYear(trade) {
  const year = String(trade?.soldAt || "").slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

function tradeMonth(trade) {
  const month = String(trade?.soldAt || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

function renderHistory() {
  els.historyRows.textContent = "";
  const snapshots = filteredHistorySnapshots();
  renderHistorySummary(snapshots);
  if (!snapshots.length) {
    els.historyRows.append(els.emptyHistoryTemplate.content.cloneNode(true));
  } else {
    [...snapshots].reverse().forEach((snapshot, index, reversed) => {
      const previous = reversed[index + 1];
      const change = previous ? snapshot.total - previous.total : 0;
      const rate = previous ? deltaRate(snapshot.total, previous.total) : 0;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatDate(snapshot.createdAt)}</td>
        <td class="number">${money(snapshot.total)}</td>
        <td class="number ${change > 0 ? "positive" : change < 0 ? "negative" : ""}">${change > 0 ? "+" : ""}${money(change)}</td>
        <td class="number ${rate > 0 ? "positive" : rate < 0 ? "negative" : ""}">${rate > 0 ? "+" : ""}${percent(rate)}</td>
        <td>${escapeHtml(snapshot.note || "")}</td>
        <td><button class="icon-button" type="button" title="기록 삭제" aria-label="${formatDate(snapshot.createdAt)} 기록 삭제" data-history-delete="${escapeHtml(snapshot.id)}">×</button></td>
      `;
      els.historyRows.append(row);
    });
  }
  drawChart(snapshots);
}

function filteredHistorySnapshots() {
  const range = uiState.historyRange;
  if (range === "ALL") return state.snapshots;
  const now = new Date();
  const start = new Date(0);
  if (range === "30D") start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === "90D") start.setTime(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (range === "YTD") start.setFullYear(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  return state.snapshots.filter((snapshot) => new Date(snapshot.createdAt) >= start);
}

function renderHistorySummary(snapshots = state.snapshots) {
  if (!els.historySummary) return;
  els.historySummary.textContent = "";

  if (!snapshots.length) {
    const item = document.createElement("div");
    item.className = "history-summary-item";
    item.innerHTML = `<span>기록 상태</span><strong>대기</strong><small>${state.snapshots.length ? "선택 기간에 기록이 없습니다." : "첫 조회 기록을 저장하세요."}</small>`;
    els.historySummary.append(item);
    return;
  }

  const totals = snapshots.map((snapshot) => Number(snapshot.total || 0));
  const first = totals[0];
  const latest = totals.at(-1);
  const high = Math.max(...totals);
  const low = Math.min(...totals);
  const change = latest - first;
  const items = [
    ["기록 수", `${snapshots.length}회`, uiState.historyRange === "ALL" ? "저장된 조회 시점" : "선택 기간 기준", ""],
    ["최고 총자산", money(high), "조회 기록 기준", ""],
    ["최저 총자산", money(low), "조회 기록 기준", ""],
    ["누적 변화", `${change > 0 ? "+" : ""}${money(change)}`, percent(deltaRate(latest, first)), change > 0 ? "positive" : change < 0 ? "negative" : ""]
  ];

  items.forEach(([label, value, detail, tone]) => {
    const item = document.createElement("div");
    item.className = "history-summary-item";
    if (tone) item.classList.add(tone);
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small>`;
    els.historySummary.append(item);
  });
}

const CHART_FONT = '"Pretendard Variable", Pretendard, "Segoe UI", "Malgun Gothic", Arial, sans-serif';

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").trim().replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;
  const value = parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chartPalette() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    grid: read("--line", "#e2e8f0"),
    muted: read("--muted", "#64748b"),
    slate: read("--slate", "#334155"),
    green: read("--green", "#059669"),
    red: read("--red", "#dc2626"),
    surface: read("--surface", "#ffffff"),
  };
}

function drawChart(snapshots = state.snapshots) {
  const canvas = els.historyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const palette = chartPalette();
  const topPad = 50;
  const leftPad = 58;
  const rightPad = 44;
  const bottomPad = 66;
  const plotBottom = height - bottomPad;
  const plotWidth = width - leftPad - rightPad;
  const plotHeight = height - topPad - bottomPad;
  const points = snapshots.map((snapshot) => snapshot.total);
  const values = points.length ? points : [totalAssets()];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin;
  const padding = rawRange ? rawRange * 0.18 : Math.max(rawMax * 0.04, 1);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const range = max - min || 1;

  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = palette.muted;
  ctx.font = `13px ${CHART_FONT}`;

  for (let i = 0; i <= 4; i += 1) {
    const y = topPad + (plotHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(width - rightPad, y);
    ctx.stroke();
    const value = max - (range / 4) * i;
    ctx.fillText(compactMoney(value), 8, y + 4);
  }

  if (!points.length) {
    ctx.fillStyle = palette.muted;
    ctx.textAlign = "center";
    ctx.fillText("조회 기록을 저장하면 차트가 표시됩니다.", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  const xFor = (index) => {
    if (points.length === 1) return width / 2;
    return leftPad + (plotWidth / (points.length - 1)) * index;
  };
  const yFor = (value) => plotBottom - ((value - min) / range) * plotHeight;
  const first = points[0];
  const latest = points.at(-1);
  const change = latest - first;
  const lineColor = change < 0 ? palette.red : palette.green;
  const fillColor = hexToRgba(lineColor, 0.18);
  const accentColor = lineColor;
  const fill = ctx.createLinearGradient(0, topPad, 0, plotBottom);
  fill.addColorStop(0, fillColor);
  fill.addColorStop(1, "rgba(255, 255, 255, 0)");

  drawXAxisLabels(ctx, snapshots, xFor, leftPad, width - rightPad, plotBottom, height, palette);

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xFor(points.length - 1), plotBottom);
  ctx.lineTo(xFor(0), plotBottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = lineColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  [0, points.length - 1].forEach((index) => {
    const x = xFor(index);
    const y = yFor(points[index]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = index === points.length - 1 ? accentColor : palette.slate;
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  drawChartBadge(ctx, xFor(0), yFor(first), "시작", money(first), palette.slate, width, height, palette);
  drawChartBadge(ctx, xFor(points.length - 1), yFor(latest), "최근", money(latest), accentColor, width, height, palette);
  if (els.historyChartDescription) {
    els.historyChartDescription.textContent = `선택 기간 첫 기록 ${money(first)}, 최근 기록 ${money(latest)}, 변화 ${change > 0 ? "+" : ""}${money(change)}입니다.`;
  }
}

function drawXAxisLabels(ctx, snapshots, xFor, left, right, plotBottom, height, palette = chartPalette()) {
  const lastIndex = snapshots.length - 1;
  const axisY = plotBottom + 8;
  const labelY = Math.min(height - 18, plotBottom + 30);
  const availableWidth = Math.max(1, right - left);
  const maxLabels = Math.max(2, Math.floor(availableWidth / 110) + 1);
  const step = lastIndex <= 0 ? 1 : Math.ceil(lastIndex / (maxLabels - 1));
  const indexes = new Set([0, lastIndex]);

  for (let index = 0; index <= lastIndex; index += step) {
    indexes.add(index);
  }

  ctx.strokeStyle = hexToRgba(palette.muted, 0.26);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, plotBottom);
  ctx.lineTo(right, plotBottom);
  ctx.stroke();

  ctx.fillStyle = palette.muted;
  ctx.font = `600 11px ${CHART_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [...indexes].sort((a, b) => a - b).forEach((index) => {
    const x = xFor(index);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, axisY);
    ctx.stroke();
    ctx.fillText(chartDateLabel(snapshots[index]?.createdAt), x, labelY);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawChartBadge(ctx, x, y, label, value, color, width, height, palette = chartPalette()) {
  const text = `${label} ${value}`;
  ctx.font = `700 12px ${CHART_FONT}`;
  const textWidth = ctx.measureText(text).width;
  const boxWidth = Math.min(textWidth + 20, width - 20);
  const boxHeight = 26;
  const boxX = Math.min(Math.max(10, x - boxWidth / 2), width - boxWidth - 10);
  const boxY = Math.min(Math.max(8, y - 40), height - boxHeight - 8);

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 9);
  else ctx.rect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.strokeStyle = hexToRgba(palette.muted, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function renderRetirement() {
  const result = calculateRetirement(state.retirement);

  els.requiredNestEgg.textContent = result.error ? "계산 불가" : money(result.nestEgg);
  els.requiredSpendInfo.textContent = result.error
    ? result.error
    : `은퇴 첫해 연 지출 ${money(result.firstAnnualSpend)} 기준`;
  els.returnNoContrib.textContent = formatReturnResult(result.requiredNoContribution);
  els.returnWithContrib.textContent = formatReturnResult(result.requiredWithContribution);

  if (result.error) {
    els.targetStatus.textContent = "입력 확인";
    els.targetStatus.className = "warning";
    els.targetStatusDetail.textContent = result.error;
  } else if (result.gap <= 0) {
    els.targetStatus.textContent = "이미 충족";
    els.targetStatus.className = "positive";
    els.targetStatusDetail.textContent = `${money(Math.abs(result.gap))} 여유`;
  } else {
    els.targetStatus.textContent = "추가 성장 필요";
    els.targetStatus.className = result.requiredWithContribution > 0.12 ? "warning" : "";
    els.targetStatusDetail.textContent = `${money(result.gap)} 부족`;
  }

  els.retireGap.textContent = result.error ? "₩0" : money(Math.max(0, result.gap));
  els.retireGapLabel.textContent = result.error ? "계산 대기" : `${result.yearsToRetire}년 남음`;
  renderRetirementProgress(result);
  renderRetirementSensitivity();
}

function renderRetirementProgress(result) {
  if (!els.retirementProgressBar || !els.retirementProgressLabel) return;
  if (result.error || !Number.isFinite(result.nestEgg) || result.nestEgg <= 0) {
    els.retirementProgressBar.style.width = "0%";
    els.retirementProgressLabel.textContent = "0%";
    return;
  }

  const progress = Math.max(0, Math.min(1, Number(state.retirement.currentInvestable || 0) / result.nestEgg));
  els.retirementProgressBar.style.width = `${Math.max(2, progress * 100)}%`;
  els.retirementProgressLabel.textContent = `${Math.round(progress * 100)}%`;
}

function calculateRetirement(input) {
  const currentAge = Number(input.currentAge);
  const retireAge = Number(input.retireAge);
  const lifeAge = Number(input.lifeAge);
  const currentInvestable = Number(input.currentInvestable);
  const monthlyInvest = Number(input.monthlyInvest);
  const monthlySpend = Number(input.monthlySpend);
  const inflation = Number(input.inflationRate) / 100;
  const postReturn = Number(input.postReturnRate) / 100;
  const yearsToRetire = retireAge - currentAge;
  const retirementYears = lifeAge - retireAge;

  if (yearsToRetire < 0) return { error: "은퇴 나이는 현재 나이보다 커야 합니다." };
  if (retirementYears <= 0) return { error: "예상 수명은 은퇴 나이보다 커야 합니다." };
  if (monthlySpend <= 0) return { error: "은퇴 후 월 지출을 입력하세요." };

  const firstAnnualSpend = monthlySpend * 12 * Math.pow(1 + inflation, yearsToRetire);
  const nestEgg = presentValueGrowingAnnuity(firstAnnualSpend, postReturn, inflation, retirementYears);
  const months = yearsToRetire * 12;
  const requiredNoContribution = requiredAnnualReturn(currentInvestable, 0, nestEgg, months);
  const requiredWithContribution = requiredAnnualReturn(currentInvestable, monthlyInvest, nestEgg, months);
  const gap = nestEgg - currentInvestable;

  return {
    firstAnnualSpend,
    gap,
    nestEgg,
    requiredNoContribution,
    requiredWithContribution,
    yearsToRetire
  };
}

function presentValueGrowingAnnuity(firstPayment, rate, growth, years) {
  if (Math.abs(rate - growth) < 0.000001) {
    return (firstPayment * years) / (1 + rate);
  }
  return (firstPayment / (rate - growth)) * (1 - Math.pow((1 + growth) / (1 + rate), years));
}

function requiredAnnualReturn(principal, monthlyContribution, target, months) {
  if (target <= 0) return 0;
  if (months <= 0) return principal >= target ? 0 : Number.POSITIVE_INFINITY;
  if (principal <= 0 && monthlyContribution <= 0) return Number.POSITIVE_INFINITY;

  const futureValue = (monthlyRate) => {
    if (Math.abs(monthlyRate) < 0.0000001) {
      return principal + monthlyContribution * months;
    }
    return (
      principal * Math.pow(1 + monthlyRate, months) +
      monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    );
  };

  let low = -0.99;
  let high = 1;
  if (futureValue(high) < target) return Number.POSITIVE_INFINITY;

  for (let i = 0; i < 120; i += 1) {
    const mid = (low + high) / 2;
    if (futureValue(mid) >= target) high = mid;
    else low = mid;
  }

  return Math.pow(1 + high, 12) - 1;
}

function formatReturnResult(value) {
  if (value === Number.POSITIVE_INFINITY || !Number.isFinite(value)) return "달성 불가";
  return percent(value);
}

function renderRetirementScenarioOptions() {
  if (!els.retirementScenarioSelect) return;
  const current = els.retirementScenarioSelect.value;
  els.retirementScenarioSelect.innerHTML = `<option value="">시나리오 선택</option>${state.retirementScenarios.map((scenario) => `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.name)}</option>`).join("")}`;
  els.retirementScenarioSelect.value = state.retirementScenarios.some((scenario) => scenario.id === current) ? current : "";
}

function currentRetirementScenarioInput() {
  return { ...state.retirement };
}

function renderRetirementSensitivity() {
  if (!els.retirementSensitivity) return;
  const base = currentRetirementScenarioInput();
  const cases = [
    ["물가 +1%p", { ...base, inflationRate: Number(base.inflationRate) + 1 }],
    ["물가 -1%p", { ...base, inflationRate: Number(base.inflationRate) - 1 }],
    ["수익률 +1%p", { ...base, postReturnRate: Number(base.postReturnRate) + 1 }],
    ["수익률 -1%p", { ...base, postReturnRate: Number(base.postReturnRate) - 1 }],
    ["지출 +10%", { ...base, monthlySpend: Number(base.monthlySpend) * 1.1 }]
  ];
  els.retirementSensitivity.innerHTML = cases.map(([label, input]) => {
    const result = calculateRetirement(input);
    return `<div class="sensitivity-item">
      <span>${escapeHtml(label)}</span>
      <strong>${result.error ? "계산 불가" : money(result.nestEgg)}</strong>
    </div>`;
  }).join("");
}

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function formatTradeDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return TRADE_DATE_FORMATTER.format(date);
}

function formatDate(value) {
  if (!value) return "없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return DATE_TIME_FORMATTER.format(date);
}

function shortDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}.${d}`;
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return SHORT_DATE_FORMATTER.format(date);
}

function chartDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return CHART_DATE_FORMATTER.format(date);
}

function shortDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return SHORT_DATE_TIME_FORMATTER.format(date);
}

function compactDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function daysSince(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

function compactMoney(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
  return `${Math.round(value)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetAssetForm() {
  els.assetId.value = "";
  els.assetForm.reset();
  uiState.autofilledAssetName = "";
  if (els.assetFormTitle) els.assetFormTitle.textContent = "자산 추가";
  els.saveAssetBtn.textContent = "자산 저장";
  updateAssetFormForType();
  hideAssetForm();
}

function showAssetForm(mode = "create") {
  if (els.assetFormPanel) els.assetFormPanel.hidden = false;
  if (els.assetFormTitle) els.assetFormTitle.textContent = mode === "edit" ? "자산 수정" : "자산 추가";
  if (els.toggleAssetFormBtn) {
    els.toggleAssetFormBtn.textContent = "접기";
    els.toggleAssetFormBtn.setAttribute("aria-expanded", "true");
  }
}

function hideAssetForm() {
  if (els.assetFormPanel) els.assetFormPanel.hidden = true;
  if (els.toggleAssetFormBtn) {
    els.toggleAssetFormBtn.textContent = "자산 추가";
    els.toggleAssetFormBtn.setAttribute("aria-expanded", "false");
  }
}

function resetSellForm() {
  if (!els.sellForm) return;
  els.sellForm.reset();
  if (els.sellAssetId) els.sellAssetId.value = "";
  if (els.sellPreview) els.sellPreview.textContent = "";
  hideSellForm();
}

function hideSellForm() {
  if (els.sellFormPanel) els.sellFormPanel.hidden = true;
}

function resetBuyForm() {
  if (!els.buyForm) return;
  els.buyForm.reset();
  if (els.buyAssetId) els.buyAssetId.value = "";
  if (els.buyPreview) els.buyPreview.textContent = "";
  hideBuyForm();
}

function hideBuyForm() {
  if (els.buyFormPanel) els.buyFormPanel.hidden = true;
}

function showSellForm(asset) {
  if (!els.sellFormPanel || !els.sellForm) return;
  resetAssetForm();
  resetBuyForm();
  els.sellFormPanel.hidden = false;
  els.sellAssetId.value = asset.id;
  els.sellDate.value = localDateInputValue();
  els.sellQuantity.value = formatPlainNumber(asset.quantity || 0);
  els.sellPrice.value = asset.currentPrice ? formatPlainNumber(asset.currentPrice) : "";
  els.sellFees.value = "";
  els.sellTax.value = "";
  els.sellMemo.value = "";
  if (els.sellJournalEnabled) els.sellJournalEnabled.checked = true;
  const type = assetType(asset);
  if (els.sellFxRateField) els.sellFxRateField.hidden = type !== "US";
  els.sellFxRate.value = type === "US" ? formatPlainNumber(usdKrwRate()) : "1";
  els.sellAssetSummary.textContent = `${asset.name} · ${asset.account || "계좌 미지정"} · 보유 ${formatPlainNumber(asset.quantity)}주 · 평단 ${type === "US" ? usd(asset.averagePrice) : formatPlainNumber(asset.averagePrice)}`;
  renderSellPreview();
  els.sellQuantity.focus();
}

function showBuyForm(asset) {
  if (!els.buyFormPanel || !els.buyForm) return;
  resetAssetForm();
  resetSellForm();
  resetJournalForm();
  els.buyFormPanel.hidden = false;
  els.buyAssetId.value = asset.id;
  els.buyDate.value = localDateInputValue();
  els.buyQuantity.value = "";
  els.buyPrice.value = asset.currentPrice ? formatPlainNumber(asset.currentPrice) : "";
  els.buyFees.value = "";
  els.buyMemo.value = "";
  if (els.buyJournalEnabled) els.buyJournalEnabled.checked = true;
  const type = assetType(asset);
  if (els.buyFxRateField) els.buyFxRateField.hidden = type !== "US";
  els.buyFxRate.value = type === "US" ? formatPlainNumber(usdKrwRate()) : "1";
  els.buyAssetSummary.textContent = `${asset.name} · ${asset.account || "계좌 미지정"} · 현재 ${formatPlainNumber(asset.quantity)}주 · 평단 ${type === "US" ? usd(asset.averagePrice) : formatPlainNumber(asset.averagePrice)}`;
  renderBuyPreview();
  els.buyQuantity.focus();
}

function renderSellPreview() {
  if (!els.sellPreview) return;
  const preview = parseSellForm(false);
  if (!preview.ok) {
    els.sellPreview.textContent = preview.message || "💡 매도 정보를 입력하면 예상 실현손익이 표시됩니다.";
    els.sellPreview.className = "sell-preview";
    return;
  }
  const gain = preview.trade.realizedGain;
  const rate = preview.trade.realizedGainRate;
  els.sellPreview.className = `sell-preview ${gain > 0 ? "positive" : gain < 0 ? "negative" : ""}`;
  els.sellPreview.textContent = [
    `매도금액 ${money(preview.trade.grossAmount)}`,
    `원가 ${money(preview.trade.costAmount)}`,
    `비용 ${money(preview.trade.fees + preview.trade.tax)}`,
    `실현손익 ${gain > 0 ? "+" : ""}${money(gain)}${rate === null ? "" : ` (${rate > 0 ? "+" : ""}${percent(rate)})`}`
  ].join(" · ");
}

function renderBuyPreview() {
  if (!els.buyPreview) return;
  const preview = parseBuyForm(false);
  if (!preview.ok) {
    els.buyPreview.textContent = preview.message || "추가매수 정보를 입력하면 새 보유수량과 평단이 표시됩니다.";
    els.buyPreview.className = "buy-preview";
    return;
  }
  const type = assetType(preview.asset);
  const averageText = type === "US" ? usd(preview.nextAveragePrice) : formatPlainNumber(preview.nextAveragePrice);
  const previousAverageText = type === "US" ? usd(Number(preview.asset.averagePrice || 0)) : formatPlainNumber(preview.asset.averagePrice || 0);
  els.buyPreview.className = "buy-preview positive";
  els.buyPreview.textContent = [
    `매수금액 ${money(preview.grossAmount + preview.fees)}`,
    `보유 ${formatPlainNumber(preview.previousQuantity)}주 → ${formatPlainNumber(preview.nextQuantity)}주`,
    `평단 ${previousAverageText} → ${averageText}`
  ].join(" · ");
}

function parseSellForm(strict = true) {
  const asset = state.assets.find((item) => item.id === els.sellAssetId?.value);
  if (!asset) return { ok: false, message: "매도할 자산을 찾을 수 없습니다." };
  const type = assetType(asset);
  if (!isMarketType(type)) return { ok: false, message: "KRX/US 자산만 매도 기록을 남길 수 있습니다." };

  const quantity = parseAmount(els.sellQuantity?.value || 0);
  const holdingQuantity = Number(asset.quantity || 0);
  const sellPrice = parseAmount(els.sellPrice?.value || 0);
  const fxRate = type === "US" ? parseAmount(els.sellFxRate?.value || 0) : 1;
  const fees = Math.max(0, parseAmount(els.sellFees?.value || 0));
  const tax = Math.max(0, parseAmount(els.sellTax?.value || 0));
  const soldAt = els.sellDate?.value || localDateInputValue();

  if (quantity <= 0) return { ok: false, message: strict ? "매도 수량은 0보다 커야 합니다." : "" };
  if (quantity > holdingQuantity + 0.0000001) return { ok: false, message: `보유 수량 ${formatPlainNumber(holdingQuantity)}주보다 많이 매도할 수 없습니다.` };
  if (sellPrice <= 0) return { ok: false, message: strict ? "매도가를 입력하세요." : "" };
  if (type === "US" && fxRate <= 0) return { ok: false, message: strict ? "달러 환율을 입력하세요." : "" };

  const effectiveFx = type === "US" ? fxRate : 1;
  const costAmount = quantity * Number(asset.averagePrice || 0) * effectiveFx;
  const grossAmount = quantity * sellPrice * effectiveFx;
  const realizedGain = grossAmount - costAmount - fees - tax;
  const trade = normalizeRealizedTrade({
    id: uid(),
    assetId: asset.id,
    soldAt,
    name: asset.name,
    ticker: normalizeTicker(type, asset.ticker),
    type,
    account: asset.account || "",
    quantity,
    averagePrice: Number(asset.averagePrice || 0),
    sellPrice,
    fxRate: effectiveFx,
    grossAmount,
    costAmount,
    fees,
    tax,
    realizedGain,
    memo: els.sellMemo?.value.trim() || "",
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    asset,
    remainingQuantity: Math.max(0, holdingQuantity - quantity),
    trade
  };
}

function parseBuyForm(strict = true) {
  const asset = state.assets.find((item) => item.id === els.buyAssetId?.value);
  if (!asset) return { ok: false, message: "추가매수할 자산을 찾을 수 없습니다." };
  const type = assetType(asset);
  if (!isMarketType(type)) return { ok: false, message: "KRX/US 자산만 추가매수할 수 있습니다." };

  const quantity = parseAmount(els.buyQuantity?.value || 0);
  const buyPrice = parseAmount(els.buyPrice?.value || 0);
  const fxRate = type === "US" ? parseAmount(els.buyFxRate?.value || 0) : 1;
  const fees = Math.max(0, parseAmount(els.buyFees?.value || 0));
  const boughtAt = els.buyDate?.value || localDateInputValue();

  if (quantity <= 0) return { ok: false, message: strict ? "추가매수 수량은 0보다 커야 합니다." : "" };
  if (buyPrice <= 0) return { ok: false, message: strict ? "매수가를 입력하세요." : "" };
  if (type === "US" && fxRate <= 0) return { ok: false, message: strict ? "달러 환율을 입력하세요." : "" };

  const effectiveFx = type === "US" ? fxRate : 1;
  const previousQuantity = Number(asset.quantity || 0);
  const previousAveragePrice = Number(asset.averagePrice || 0);
  const nextQuantity = previousQuantity + quantity;
  const feeInPriceCurrency = fees / effectiveFx;
  const previousCost = previousQuantity * previousAveragePrice;
  const addedCost = quantity * buyPrice + feeInPriceCurrency;
  const nextAveragePrice = nextQuantity > 0 ? (previousCost + addedCost) / nextQuantity : buyPrice;
  const grossAmount = quantity * buyPrice * effectiveFx;

  return {
    ok: true,
    asset,
    boughtAt,
    quantity,
    buyPrice,
    fxRate: effectiveFx,
    fees,
    grossAmount,
    previousQuantity,
    previousAveragePrice,
    nextQuantity,
    nextAveragePrice,
    memo: els.buyMemo?.value.trim() || ""
  };
}

function normalizeAssetKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function updateAssetFormForType() {
  const type = normalizeAssetType(els.assetCategory.value);
  const manualValued = isManualValuedType(type);
  const marketValued = isMarketType(type);
  els.assetAmount.disabled = !manualValued;
  els.assetAmount.placeholder = "금액 입력";
  if (els.assetAmountField) els.assetAmountField.hidden = !manualValued;
  if (els.manualSubtypeField) els.manualSubtypeField.hidden = type !== "MANUAL";
  if (!manualValued) els.assetAmount.value = "";
  if (type !== "MANUAL" && els.assetManualSubtype) els.assetManualSubtype.value = "AUTO";
  els.assetTicker.disabled = !marketValued;
  els.assetTicker.placeholder = type === "KRX" ? "예: 005930, 0092B0" : type === "US" ? "예: AAPL, QQQ" : "티커 불필요";
  els.assetAveragePrice.placeholder = type === "US" ? "달러 평단가" : "0";
  if (!marketValued) {
    els.assetTicker.value = "";
    uiState.autofilledAssetName = "";
  }
  if (els.assetTickerHelp) els.assetTickerHelp.textContent = tickerHelpForType(type);
}

function fillAssetNameFromTicker() {
  const currentName = els.assetName.value.trim();
  if (currentName && currentName !== uiState.autofilledAssetName) return;
  const type = normalizeAssetType(els.assetCategory.value);
  const inferredName = priceNameForTicker(type, els.assetTicker.value);
  if (inferredName) {
    els.assetName.value = inferredName;
    uiState.autofilledAssetName = inferredName;
  }
}

function parseAmount(value) {
  const raw = String(value || "").trim();
  const negative = /^\(.*\)$/.test(raw);
  const normalized = raw.replace(/[₩$원,\s()]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed * (negative ? -1 : 1) : 0;
}

els.assetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = normalizeAssetType(els.assetCategory.value);
  const ticker = normalizeTicker(type, els.assetTicker.value);
  const asset = {
    id: els.assetId.value || uid(),
    name: els.assetName.value.trim() || priceNameForTicker(type, ticker),
    ticker,
	    type,
	    account: els.assetAccount.value.trim(),
	    accountClass: normalizeAccountClass(els.assetAccountClass?.value),
	    manualSubtype: type === "MANUAL" ? normalizeManualSubtype(els.assetManualSubtype?.value) : "AUTO",
	    amount: isManualValuedType(type) ? numberValue(els.assetAmount) : 0,
    quantity: decimalValue(els.assetQuantity),
    averagePrice: decimalValue(els.assetAveragePrice),
    note: els.assetNote.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!asset.name) return;
  const tickerError = validateTicker(type, asset.ticker);
  if (tickerError) {
    alert(tickerError);
    return;
  }

  const index = state.assets.findIndex((item) =>
    els.assetId.value ? item.id === asset.id : assetIdentity(item) === assetIdentity(asset)
  );
  if (index >= 0) state.assets[index] = normalizeAsset({ ...state.assets[index], ...asset, id: state.assets[index].id });
  else state.assets.push(normalizeAsset(asset));

  applyPricesToAssets();
  resetAssetForm();
  render();
});

els.buyForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseBuyForm(true);
  if (!result.ok) {
    alert(result.message);
    return;
  }

  const { asset, nextQuantity, nextAveragePrice } = result;
  const previousAssets = state.assets.map((item) => ({ ...item }));
  const previousJournalEntries = state.tradeJournalEntries.map((item) => ({ ...item }));
  const index = state.assets.findIndex((item) => item.id === asset.id);
  if (index < 0) return;

  state.assets[index] = normalizeAsset({
    ...state.assets[index],
    quantity: nextQuantity,
    averagePrice: nextAveragePrice,
    updatedAt: new Date().toISOString()
  });

  const journalCreated = Boolean(els.buyJournalEnabled?.checked);
  if (journalCreated) {
    state.tradeJournalEntries.push(createJournalEntryFromBuy(state.assets[index], result));
  }

  applyPricesToAssets();
  resetBuyForm();
  uiState.investmentRecordTab = journalCreated ? "JOURNAL" : uiState.investmentRecordTab;
  render();
  showUndoNotice(journalCreated ? "추가매수와 매매일지를 함께 저장했습니다." : "추가매수를 저장했습니다.", () => {
    state.assets = previousAssets.map(normalizeAsset);
    state.tradeJournalEntries = previousJournalEntries.map(normalizeTradeJournalEntry);
    applyPricesToAssets();
    render();
  });
});

els.sellForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseSellForm(true);
  if (!result.ok) {
    alert(result.message);
    return;
  }

  const { asset, remainingQuantity, trade } = result;
  const previousAssets = state.assets.map((item) => ({ ...item }));
  const previousTrades = state.realizedTrades.map((item) => ({ ...item }));
  const previousJournalEntries = state.tradeJournalEntries.map((item) => ({ ...item }));
  const index = state.assets.findIndex((item) => item.id === asset.id);
  if (index < 0) return;

  state.realizedTrades.push(trade);
  const journalCreated = Boolean(els.sellJournalEnabled?.checked);
  if (journalCreated) {
    state.tradeJournalEntries.push(createJournalEntryFromTrade(asset, trade));
  }
  if (remainingQuantity <= 0.0000001) {
    state.assets.splice(index, 1);
  } else {
    state.assets[index] = normalizeAsset({
      ...state.assets[index],
      quantity: remainingQuantity,
      updatedAt: new Date().toISOString()
    });
  }

  applyPricesToAssets();
  resetSellForm();
  uiState.investmentRecordTab = "REALIZED";
  render();
  showUndoNotice(journalCreated ? "매도 기록과 매매일지를 함께 저장했습니다." : "매도 기록을 저장했습니다. 실현손익에서 일지를 연결할 수 있습니다.", () => {
    state.assets = previousAssets.map(normalizeAsset);
    state.realizedTrades = previousTrades.map(normalizeRealizedTrade);
    state.tradeJournalEntries = previousJournalEntries.map(normalizeTradeJournalEntry);
    applyPricesToAssets();
    render();
  });
});

function handleAssetAction(button) {
  const asset = state.assets.find((item) => item.id === button.dataset.id);
  if (!asset) return;

  if (button.dataset.action === "detail") {
    openAssetDetail(asset.id);
  }

  if (button.dataset.action === "buy") {
    showBuyForm(asset);
  }

  if (button.dataset.action === "sell") {
    showSellForm(asset);
  }

  if (button.dataset.action === "journal") {
    setActiveView("JOURNAL", { scroll: true, updateHash: true, focus: true });
    showJournalForm();
    fillJournalFromAsset(asset);
    els.journalAction.value = "WATCH";
    els.journalStatus.value = "OPEN";
  }

  if (button.dataset.action === "edit") {
    resetSellForm();
    resetBuyForm();
    showAssetForm("edit");
    els.assetId.value = asset.id;
    els.assetName.value = asset.name;
	    els.assetAccount.value = asset.account || "";
	    if (els.assetAccountClass) els.assetAccountClass.value = normalizeAccountClass(asset.accountClass);
	    els.assetTicker.value = asset.ticker || "";
	    els.assetCategory.value = assetType(asset);
	    if (els.assetManualSubtype) els.assetManualSubtype.value = normalizeManualSubtype(asset.manualSubtype);
    els.assetAmount.value = isManualValuedType(assetType(asset)) ? formatPlainNumber(asset.amount || 0) : "";
    els.assetQuantity.value = asset.quantity || "";
    els.assetAveragePrice.value = asset.averagePrice || "";
    els.assetNote.value = asset.note || "";
    uiState.autofilledAssetName = "";
    els.saveAssetBtn.textContent = "수정 저장";
    updateAssetFormForType();
    els.assetName.focus();
  }

  if (button.dataset.action === "delete" && confirm(`${asset.name} 자산을 삭제할까요?\n\n계좌: ${asset.account || "계좌 미지정"}\n평가금액: ${money(assetValue(asset))}\n\n삭제 직후에는 되돌리기 버튼으로 복구할 수 있습니다.`)) {
    const index = state.assets.findIndex((item) => item.id === asset.id);
    const deleted = { ...asset };
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    resetAssetForm();
    resetSellForm();
    resetBuyForm();
    render();
    showUndoNotice(`${asset.name} 자산을 삭제했습니다.`, () => {
      state.assets.splice(Math.max(0, index), 0, deleted);
      applyPricesToAssets();
      render();
    });
  }
}

function openAssetDetail(assetId) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (!asset || !els.assetDetailDrawer || !els.assetDetailOverlay) return;
  const value = assetValue(asset);
  const gain = assetGain(asset);
  const cost = assetCost(asset);
  const gainRate = gain === null || !cost ? null : gain / cost;
  const tone = gain > 0 ? "positive" : gain < 0 ? "negative" : "";
  const arrow = gain > 0 ? "▲ " : gain < 0 ? "▼ " : "";
  const gainText = gain === null
    ? "—"
    : `${arrow}${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`;
  const noteHtml = asset.note
    ? `<p>${escapeHtml(asset.note)}</p>`
    : `<p class="detail-empty">작성된 메모가 없어요. 일지에서 판단을 기록해 보세요.</p>`;
  els.assetDetailDrawer.innerHTML = `
    <div class="detail-head">
      <div class="detail-id">
        <strong>${escapeHtml(asset.name)}</strong>
        <span class="asset-sub">
          ${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}
          <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
          ${asset.account ? `<span class="asset-account">${escapeHtml(asset.account)}</span>` : ""}
        </span>
      </div>
      <button class="icon-button detail-close" type="button" data-detail-close aria-label="상세 닫기">✕</button>
    </div>
    <div class="detail-body">
      <div class="detail-value-card">
        <span class="detail-kicker">평가금액</span>
        <strong class="detail-value">${money(value)}</strong>
        <span class="detail-gain ${tone}">${gainText}</span>
      </div>
      <div class="detail-grid">
        <div><span>보유수량</span><strong>${asset.quantity ? formatPlainNumber(asset.quantity) : "—"}</strong></div>
        <div><span>평단가</span><strong>${asset.averagePrice ? formatPlainNumber(asset.averagePrice) : "—"}</strong></div>
        <div><span>매입원가</span><strong>${cost ? money(cost) : "—"}</strong></div>
        <div><span>유형</span><strong>${escapeHtml(assetTypeLabel(asset))}</strong></div>
      </div>
      <div class="detail-note">
        <span class="detail-kicker">메모</span>
        ${noteHtml}
      </div>
    </div>
    <div class="detail-actions">
      ${canBuyAsset(asset) ? `<button class="primary-button compact-button" type="button" data-action="buy" data-id="${asset.id}">추가매수</button>` : ""}
      ${canSellAsset(asset) ? `<button class="ghost-button" type="button" data-action="sell" data-id="${asset.id}">매도</button>` : ""}
      <button class="ghost-button" type="button" data-action="journal" data-id="${asset.id}">일지</button>
      <button class="ghost-button" type="button" data-action="edit" data-id="${asset.id}">수정</button>
      <button class="ghost-button danger-action" type="button" data-action="delete" data-id="${asset.id}">삭제</button>
    </div>
  `;
  els.assetDetailOverlay.hidden = false;
  const closeBtn = els.assetDetailDrawer.querySelector("[data-detail-close]");
  if (closeBtn) closeBtn.focus();
}

function closeAssetDetail() {
  if (els.assetDetailOverlay) els.assetDetailOverlay.hidden = true;
}

function handleAssetSurfaceClick(event) {
  const button = event.target.closest("button[data-action]");
  if (button) {
    handleAssetAction(button);
    return;
  }
  const row = event.target.closest("[data-id]");
  if (row && row.dataset.id) openAssetDetail(row.dataset.id);
}

els.assetRows.addEventListener("click", handleAssetSurfaceClick);
els.assetCards?.addEventListener("click", handleAssetSurfaceClick);

els.assetDetailOverlay?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) {
    closeAssetDetail();
    handleAssetAction(button);
    return;
  }
  if (event.target.closest("[data-detail-close]")) closeAssetDetail();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.assetDetailOverlay && !els.assetDetailOverlay.hidden) closeAssetDetail();
});

els.investmentJournalTab?.addEventListener("click", () => {
  setInvestmentRecordTab("JOURNAL");
});

els.investmentRealizedTab?.addEventListener("click", () => {
  setInvestmentRecordTab("REALIZED");
});

els.toggleJournalFormBtn?.addEventListener("click", () => {
  if (els.journalFormPanel?.hidden) showJournalForm();
  else resetJournalForm();
});

els.cancelJournalBtn?.addEventListener("click", resetJournalForm);

els.journalAssetId?.addEventListener("change", () => {
  const asset = state.assets.find((item) => item.id === els.journalAssetId.value);
  if (asset) fillJournalFromAsset(asset);
});

els.journalFilter?.addEventListener("change", () => {
  uiState.journalFilter = els.journalFilter.value;
  renderJournal();
});

els.journalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const entry = journalEntryFromForm();
  if (!entry.name) {
    alert("매매일지의 자산명을 입력하세요.");
    return;
  }
  const index = state.tradeJournalEntries.findIndex((item) => item.id === entry.id);
  if (index >= 0) state.tradeJournalEntries[index] = entry;
  else state.tradeJournalEntries.push(entry);
  resetJournalForm();
  render();
});

els.journalList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-journal-action]");
  if (!button) return;
  const entry = state.tradeJournalEntries.find((item) => item.id === button.dataset.id);
  if (!entry) return;

  if (button.dataset.journalAction === "edit") {
    showJournalForm(entry);
    return;
  }

  if (button.dataset.journalAction === "view-realized") {
    openRealizedTradeFromJournal(entry);
    return;
  }

  if (button.dataset.journalAction === "delete") {
    if (!confirm(`${entry.name || entry.ticker || "매매일지"} 기록을 삭제할까요?`)) return;
    const before = state.tradeJournalEntries.map((item) => ({ ...item }));
    state.tradeJournalEntries = state.tradeJournalEntries.filter((item) => item.id !== entry.id);
    render();
    showUndoNotice("매매일지를 삭제했습니다.", () => {
      state.tradeJournalEntries = before.map(normalizeTradeJournalEntry);
      render();
    });
    return;
  }

  if (button.dataset.journalAction === "copy-ai") {
    const prompt = aiPromptForJournal(entry);
    try {
      await navigator.clipboard.writeText(prompt);
      button.textContent = "복사 완료";
      setTimeout(() => {
        button.textContent = "AI 질문 복사";
      }, 1400);
    } catch {
      window.prompt("AI에게 붙여넣을 질문입니다.", prompt);
    }
  }
});

els.realizedRows?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-realized-action]");
  if (!button) return;
  const trade = state.realizedTrades.find((item) => item.id === button.dataset.id);
  if (!trade) return;
  openJournalForRealizedTrade(trade);
});

[
  els.sellDate,
  els.sellQuantity,
  els.sellPrice,
  els.sellFxRate,
  els.sellFees,
  els.sellTax
].forEach((input) => {
  input?.addEventListener("input", renderSellPreview);
});

[
  els.buyDate,
  els.buyQuantity,
  els.buyPrice,
  els.buyFxRate,
  els.buyFees
].forEach((input) => {
  input?.addEventListener("input", renderBuyPreview);
});

els.cancelSellBtn?.addEventListener("click", resetSellForm);
els.cancelBuyBtn?.addEventListener("click", resetBuyForm);

els.toggleAssetFormBtn.addEventListener("click", () => {
  if (els.assetFormPanel.hidden) {
    resetSellForm();
    resetBuyForm();
    showAssetForm("create");
    els.assetName.focus();
  } else {
    resetAssetForm();
  }
});

els.loginBtn.addEventListener("click", async () => {
  if (!cloud.enabled) {
    alert("firebase-config.js에 Firebase 설정값을 먼저 입력하세요.");
    return;
  }
  try {
    setSyncStatus("로그인 여는 중");
    if (cloud.signInWithPopup) {
      const result = await cloud.signInWithPopup(cloud.auth, cloud.provider);
      if (result?.user) {
        await completeCloudSignIn(result.user);
      } else {
        setSyncStatus("로그인 확인중", true);
      }
      return;
    }
    await cloud.signInWithRedirect(cloud.auth, cloud.provider);
  } catch (error) {
    console.error(error);
    if (cloud.signInWithRedirect && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      setSyncStatus("구글 로그인 이동중");
      await cloud.signInWithRedirect(cloud.auth, cloud.provider);
      return;
    }
    setSyncStatus(`로그인 실패: ${error.code || "unknown"}`);
    alert(`로그인에 실패했습니다: ${error.code || "unknown"}`);
  }
});

els.logoutBtn.addEventListener("click", async () => {
  if (!cloud.enabled) return;
  await flushCloudPush();
  await cloud.signOut(cloud.auth);
  await completeCloudSignIn(null);
});

els.cloudSyncBtn.addEventListener("click", async () => {
  if (!cloud.docRef) return;
  try {
    await flushCloudPush();
    await pullCloudData();
    setSyncStatus("동기화 완료", true);
  } catch (error) {
    console.error(error);
    setSyncStatus("동기화 실패");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushCloudPush();
});

window.addEventListener("pagehide", () => {
  flushCloudPush();
});

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-nav-view], [data-go-view]");
  if (viewButton) {
    const view = viewButton.dataset.navView || viewButton.dataset.goView;
    setActiveView(view, { scroll: true, updateHash: true, focus: true });
    if (viewButton.dataset.openAssetForm === "true") {
      resetSellForm();
      resetBuyForm();
      showAssetForm("create");
      window.setTimeout(() => els.assetName?.focus(), 160);
    }
  }
});

els.cancelEditBtn.addEventListener("click", resetAssetForm);

els.assetCategory.addEventListener("change", updateAssetFormForType);

els.assetName.addEventListener("input", () => {
  if (els.assetName.value.trim() !== uiState.autofilledAssetName) uiState.autofilledAssetName = "";
});

els.assetTicker.addEventListener("input", fillAssetNameFromTicker);

els.assetTicker.addEventListener("blur", fillAssetNameFromTicker);

els.assetTicker.addEventListener("change", fillAssetNameFromTicker);

els.assetSearch.addEventListener("input", () => {
  uiState.assetSearch = els.assetSearch.value;
  renderAssets();
});

els.assetTypeFilter.addEventListener("change", () => {
  uiState.assetType = normalizeAssetType(els.assetTypeFilter.value);
  if (els.assetTypeFilter.value === "ALL") uiState.assetType = "ALL";
  renderAssets();
});

els.assetRegionSegment?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-region-filter]");
  if (!button) return;
  uiState.regionFilter = button.dataset.regionFilter || "ALL";
  renderAssets();
});

els.assetAccountFilter.addEventListener("change", () => {
  uiState.accountFilter = els.assetAccountFilter.value;
  renderAssets();
});

els.assetStatusFilter.addEventListener("change", () => {
  uiState.statusFilter = els.assetStatusFilter.value;
  renderAssets();
});

els.assetGainFilter.addEventListener("change", () => {
  uiState.gainFilter = els.assetGainFilter.value;
  renderAssets();
});

els.assetSort.addEventListener("change", () => {
  uiState.assetSort = els.assetSort.value;
  renderAssets();
});

els.ledgerFilterToggle?.addEventListener("click", () => {
  const panel = els.ledgerAdvancedFilters;
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  els.ledgerFilterToggle.setAttribute("aria-expanded", String(open));
});

els.priceRefreshBtn?.addEventListener("click", () => {
  initPrices();
});

els.dashboardSnapshotBtn?.addEventListener("click", () => {
  els.snapshotBtn?.click();
});

[els.targetDomestic, els.targetOverseas, els.targetCash, els.targetManual].forEach((input) => {
  input?.addEventListener("input", () => {
    savePortfolioTargets();
    render(false);
  });
  input?.addEventListener("change", () => {
    savePortfolioTargets();
    render();
  });
});

els.historyRange.addEventListener("change", () => {
  uiState.historyRange = els.historyRange.value;
  renderHistory();
});

els.realizedYearFilter?.addEventListener("change", () => {
  uiState.realizedYear = els.realizedYearFilter.value;
  renderRealized();
});

els.snapshotBtn.addEventListener("click", () => {
  const now = new Date().toISOString();
	  state.snapshots.push({
	    id: uid(),
	    createdAt: now,
	    total: totalAssets(),
	    note: els.snapshotNote?.value.trim() || "",
	    assets: state.assets.map((asset) => ({ ...asset })),
    typeTotals: Object.fromEntries(
      state.assets.reduce((map, asset) => {
        const type = assetType(asset);
        map.set(type, (map.get(type) || 0) + assetValue(asset));
        return map;
      }, new Map())
    )
	  });
	  if (els.snapshotNote) els.snapshotNote.value = "";
	  render();
	});

els.historyRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-delete]");
  if (!button) return;
  const snapshot = state.snapshots.find((item) => item.id === button.dataset.historyDelete);
  if (!snapshot) return;
  if (!confirm(`${formatDate(snapshot.createdAt)} 조회 기록을 삭제할까요?\n총자산 ${money(snapshot.total)} 기록만 삭제되고 자산 원장은 유지됩니다.`)) return;
  const before = [...state.snapshots];
  state.snapshots = state.snapshots.filter((item) => item.id !== snapshot.id);
  render();
  showUndoNotice("조회 기록을 삭제했습니다.", () => {
    state.snapshots = before;
    render();
  });
});

els.clearHistoryBtn.addEventListener("click", () => {
  if (!state.snapshots.length) return;
  const before = [...state.snapshots];
  if (confirm(`조회 히스토리 ${state.snapshots.length}개를 모두 삭제할까요?\n\n삭제되는 것: 조회 시각별 총자산 기록\n유지되는 것: 자산 원장, 은퇴 설정, 가격표\n\n삭제 직후에는 되돌리기 버튼으로 복구할 수 있습니다.`)) {
    state.snapshots = [];
    render();
    showUndoNotice("조회 히스토리를 비웠습니다.", () => {
      state.snapshots = before;
      render();
    });
  }
});

els.retirementForm.addEventListener("input", () => {
  saveRetirementInputs();
  render(false);
});
els.retirementForm.addEventListener("change", () => {
  saveRetirementInputs();
  render();
});

els.retirementForm.addEventListener("focusout", (event) => {
  formatRetirementMoneyInput(event.target);
});

els.syncAssetsBtn.addEventListener("click", () => {
  els.currentInvestable.value = formatIntegerNumber(Math.ceil(totalAssets()));
  saveRetirementInputs();
  render();
});

document.querySelectorAll("[data-retirement-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const presets = {
      conservative: { inflationRate: 2.5, monthlyInvest: 700000, postReturnRate: 2.5 },
      balanced: { inflationRate: 2, monthlyInvest: 1000000, postReturnRate: 3.5 },
      growth: { inflationRate: 2, monthlyInvest: 1500000, postReturnRate: 4.5 }
    };
    const preset = presets[button.dataset.retirementPreset];
    if (!preset) return;
    Object.entries(preset).forEach(([key, value]) => {
      if (!els[key]) return;
      els[key].value = RETIREMENT_MONEY_FIELDS.has(key) ? formatIntegerNumber(value) : value;
    });
    render();
  });
});

els.saveScenarioBtn.addEventListener("click", () => {
  const name = els.retirementScenarioName.value.trim();
  if (!name) {
    alert("시나리오명을 입력하세요.");
    return;
  }
  const existing = state.retirementScenarios.find((scenario) => scenario.name === name);
  const scenario = {
    id: existing?.id || uid(),
    name,
    input: currentRetirementScenarioInput(),
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, scenario);
  else state.retirementScenarios.push(scenario);
  renderRetirementScenarioOptions();
  els.retirementScenarioSelect.value = scenario.id;
  render();
});

els.loadScenarioBtn.addEventListener("click", () => {
  const scenario = state.retirementScenarios.find((item) => item.id === els.retirementScenarioSelect.value);
  if (!scenario) return;
  state.retirement = { ...state.retirement, ...(scenario.input || {}) };
  hydrateRetirementInputs();
  render();
});

els.deleteScenarioBtn.addEventListener("click", () => {
  const scenario = state.retirementScenarios.find((item) => item.id === els.retirementScenarioSelect.value);
  if (!scenario) return;
  if (!confirm(`${scenario.name} 은퇴 시나리오를 삭제할까요?`)) return;
  const before = [...state.retirementScenarios];
  state.retirementScenarios = state.retirementScenarios.filter((item) => item.id !== scenario.id);
  renderRetirementScenarioOptions();
  render();
  showUndoNotice("은퇴 시나리오를 삭제했습니다.", () => {
    state.retirementScenarios = before;
    renderRetirementScenarioOptions();
    render();
  });
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
	    if (!Array.isArray(imported.assets) || !Array.isArray(imported.snapshots)) {
	      throw new Error("Invalid file");
	    }
	    const summary = [
	      `자산 ${imported.assets.length}개`,
	      `히스토리 ${imported.snapshots.length}개`,
	      Array.isArray(imported.tradeJournalEntries) ? `매매일지 ${imported.tradeJournalEntries.length}개` : "매매일지 없음",
	      imported.retirement ? "은퇴 설정 포함" : "은퇴 설정 없음",
	      Array.isArray(imported.retirementScenarios) ? `은퇴 시나리오 ${imported.retirementScenarios.length}개` : "은퇴 시나리오 없음"
	    ].join("\n");
	    if (!confirm(`가져오기 전에 현재 데이터 내보내기를 권장합니다.\n\n가져올 데이터:\n${summary}\n\n현재 화면 데이터를 이 파일 내용으로 교체할까요?`)) return;
	    replaceState(imported);
	    applyPricesToAssets();
	    render();
  } catch {
    alert("가져올 수 없는 JSON 파일입니다.");
  } finally {
    event.target.value = "";
  }
});

hydrateRetirementInputs();
hydratePortfolioTargetInputs();
renderRetirementScenarioOptions();
state.assets = state.assets.map(normalizeAsset);
applyPricesToAssets();
updateAssetFormForType();
uiState.activeView = viewFromHash();
history.replaceState({ view: uiState.activeView }, "", viewHash(uiState.activeView));
window.addEventListener("popstate", () => {
  setActiveView(viewFromHash(), { scroll: false, focus: true });
});
window.addEventListener("hashchange", () => {
  setActiveView(viewFromHash(), { scroll: false, focus: true });
});
let heroSparkResizeRaf = 0;
window.addEventListener("resize", () => {
  if (uiState.activeView !== "DASHBOARD") return;
  cancelAnimationFrame(heroSparkResizeRaf);
  heroSparkResizeRaf = requestAnimationFrame(() => drawHeroSparkline());
});
renderAllViews();
updateAuthUi();
initPrices();
initFirebase();
