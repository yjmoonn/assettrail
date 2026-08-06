const STORAGE_KEY = "finance-ledger-retirement-v1";
const STATE_SCHEMA_VERSION = 5;
const CLOUD_DOC_ID = "primary";
const CLOUD_PAYLOAD_MAX_BYTES = 900 * 1024;
const CLOUD_TRANSACTION_EVENT_LIMIT = 400;
const IMPORT_FILE_MAX_BYTES = 15 * 1024 * 1024;
const IMPORT_LIMITS = {
  assets: 2000,
  decisionProfiles: 4000,
  watchlist: 2000,
  realizedTrades: 10000,
  tradeJournalEntries: 10000,
  events: 50000,
  snapshots: 10000,
  retirementScenarios: 200
};
const IMPORT_STRING_LIMITS = {
  id: 160,
  short: 500,
  note: 10000
};
const DECISION_MIGRATION_CONFLICT_LIMIT = IMPORT_LIMITS.assets + IMPORT_LIMITS.watchlist + 1;
const PRICE_FILE_PATH = "prices.json";
const PUBLIC_PRICE_FILE_URL = "https://yjmoonn.github.io/assettrail/prices.json";
const SYMBOL_FILE_PATH = "symbols.json";
const PUBLIC_SYMBOL_FILE_URL = "https://yjmoonn.github.io/assettrail/symbols.json";
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
const LEDGER_EVENT_LABELS = {
  BUY: "매수",
  SELL: "매도",
  DEPOSIT: "입금",
  WITHDRAWAL: "출금",
  DIVIDEND: "배당",
  INTEREST: "이자",
  FEE: "수수료",
  TAX: "세금",
  SPLIT: "주식분할",
  VALUATION: "평가조정",
  FX: "환율조정",
  OPENING_BALANCE: "기초잔액",
  CANCEL: "취소"
};
const CASH_FLOW_EVENT_TYPES = new Set(["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX"]);
const INVESTMENT_ROLE_LABELS = {
  UNASSIGNED: "역할 미지정",
  CORE: "코어",
  STRUCTURAL_GROWTH: "구조적 성장",
  CYCLE: "사이클",
  TACTICAL: "전술",
  SURVIVAL: "생존"
};
const INVESTMENT_HORIZON_LABELS = {
  UNSET: "기간 미설정",
  SHORT: "1년 이내",
  MEDIUM: "1~3년",
  LONG: "3년 이상"
};
const CONVICTION_LABELS = {
  UNSET: "확신도 미설정",
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음"
};
const REVIEW_STATUS_LABELS = {
  UNSET: "상태 미설정",
  ACTIVE: "가설 유효",
  REVIEW: "재검토",
  INVALIDATED: "가설 훼손"
};
const RISK_TAG_DIMENSION_LABELS = {
  industry: "업종",
  country: "국가",
  currency: "통화",
  rate: "금리 민감도",
  duration: "듀레이션",
  customer: "고객·매출처",
  aiValueChain: "AI 가치사슬"
};
const RISK_TAG_INPUT_NAMES = {
  industry: "riskTagIndustry",
  country: "riskTagCountry",
  currency: "riskTagCurrency",
  rate: "riskTagRate",
  duration: "riskTagDuration",
  customer: "riskTagCustomer",
  aiValueChain: "riskTagAiValueChain"
};
const DEFAULT_RISK_BUDGETS = {
  coreMinPct: 40,
  satelliteMaxPct: 60,
  aiStructuralMaxPct: 25,
  cycleMaxPct: 25
};
const CONTRIBUTION_MODES = new Set(["ONE_TIME", "MONTHLY"]);
const ALLOCATION_BUCKET_KEYS = ["domestic", "overseas", "cash", "manual"];
const PERCENT_TARGET_TOLERANCE = 0.01;
const PERCENT_CONSTRAINT_EPSILON = 1e-8;
const RISK_TAGS_PER_DIMENSION_LIMIT = 30;
const RISK_TAG_LENGTH_LIMIT = 80;
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
  lastErrorCode: null,
  conflictPending: false,
  schemaBlocked: false,
  schemaBlockSource: null,
  schemaBlockVersion: null,
  runTransaction: null,
  collection: null,
  getDocs: null,
  knownEventIds: new Set()
};
let activeStorageKey = STORAGE_KEY;

let priceBook = {
  errors: [],
  fx: {},
  generatedAt: null,
  loaded: false,
  symbolFile: null,
  symbolsGeneratedAt: null,
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
let symbolLoadPromise = null;
let symbolsLoaded = false;
let symbolLoadFailed = false;

const els = {
  app: document.querySelector(".app"),
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
  appNavItems: [...document.querySelectorAll(".app-nav .app-nav-item")],
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
  dashboardGoalCard: document.querySelector("#dashboardGoalCard"),
  dashboardGoalGuide: document.querySelector("#dashboardGoalGuide"),
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
  sellSettlementDate: document.querySelector("#sellSettlementDate"),
  sellCashAssetId: document.querySelector("#sellCashAssetId"),
  sellCashHelp: document.querySelector("#sellCashHelp"),
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
  buySettlementDate: document.querySelector("#buySettlementDate"),
  buyCashAssetId: document.querySelector("#buyCashAssetId"),
  buyCashHelp: document.querySelector("#buyCashHelp"),
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
  portfolioBreakdownToggle: document.querySelector("#portfolioBreakdownToggle"),
  realizedSummary: document.querySelector("#realizedSummary"),
  realizedChart: document.querySelector("#realizedChart"),
  realizedRows: document.querySelector("#realizedRows"),
  realizedYearFilter: document.querySelector("#realizedYearFilter"),
  investmentJournalTab: document.querySelector("#investmentJournalTab"),
  investmentLedgerTab: document.querySelector("#investmentLedgerTab"),
  investmentRealizedTab: document.querySelector("#investmentRealizedTab"),
  journalTabPanel: document.querySelector("#journalTabPanel"),
  ledgerTabPanel: document.querySelector("#ledgerTabPanel"),
  realizedTabPanel: document.querySelector("#realizedTabPanel"),
  journalTabCount: document.querySelector("#journalTabCount"),
  ledgerTabCount: document.querySelector("#ledgerTabCount"),
  realizedTabCount: document.querySelector("#realizedTabCount"),
  ledgerTypeFilter: document.querySelector("#ledgerTypeFilter"),
  toggleCashFlowFormBtn: document.querySelector("#toggleCashFlowFormBtn"),
  cashFlowFormPanel: document.querySelector("#cashFlowFormPanel"),
  cashFlowForm: document.querySelector("#cashFlowForm"),
  cashFlowType: document.querySelector("#cashFlowType"),
  cashFlowDate: document.querySelector("#cashFlowDate"),
  cashFlowSettlementDate: document.querySelector("#cashFlowSettlementDate"),
  cashFlowCashAssetId: document.querySelector("#cashFlowCashAssetId"),
  cashFlowAmount: document.querySelector("#cashFlowAmount"),
  cashFlowCurrency: document.querySelector("#cashFlowCurrency"),
  cashFlowFxRateField: document.querySelector("#cashFlowFxRateField"),
  cashFlowFxRate: document.querySelector("#cashFlowFxRate"),
  cashFlowSourceAssetId: document.querySelector("#cashFlowSourceAssetId"),
  cashFlowMemo: document.querySelector("#cashFlowMemo"),
  cashFlowPreview: document.querySelector("#cashFlowPreview"),
  cancelCashFlowBtn: document.querySelector("#cancelCashFlowBtn"),
  ledgerReconciliation: document.querySelector("#ledgerReconciliation"),
  ledgerEventSummary: document.querySelector("#ledgerEventSummary"),
  ledgerEventRows: document.querySelector("#ledgerEventRows"),
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
  cloudConflictDialog: document.querySelector("#cloudConflictDialog"),
  cloudConflictCloudMeta: document.querySelector("#cloudConflictCloudMeta"),
  cloudConflictLocalMeta: document.querySelector("#cloudConflictLocalMeta"),
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
  bandDomesticMin: document.querySelector("#bandDomesticMin"),
  bandDomesticMax: document.querySelector("#bandDomesticMax"),
  bandOverseasMin: document.querySelector("#bandOverseasMin"),
  bandOverseasMax: document.querySelector("#bandOverseasMax"),
  bandCashMin: document.querySelector("#bandCashMin"),
  bandCashMax: document.querySelector("#bandCashMax"),
  bandManualMin: document.querySelector("#bandManualMin"),
  bandManualMax: document.querySelector("#bandManualMax"),
  targetValidation: document.querySelector("#targetValidation"),
  rebalanceSummary: document.querySelector("#rebalanceSummary"),
  contributionPlannerForm: document.querySelector("#contributionPlannerForm"),
  contributionAmount: document.querySelector("#contributionAmount"),
  contributionModeInputs: [...document.querySelectorAll('[name="contributionMode"]')],
  contributionValidation: document.querySelector("#contributionValidation"),
  contributionResult: document.querySelector("#contributionResult"),
  contributionResultStatus: document.querySelector("#contributionResultStatus"),
  riskBudgetForm: document.querySelector("#riskBudgetForm"),
  riskBudgetCoreMin: document.querySelector("#riskBudgetCoreMin"),
  riskBudgetSatelliteMax: document.querySelector("#riskBudgetSatelliteMax"),
  riskBudgetAiMax: document.querySelector("#riskBudgetAiMax"),
  riskBudgetCycleMax: document.querySelector("#riskBudgetCycleMax"),
  riskBudgetValidation: document.querySelector("#riskBudgetValidation"),
  riskBudgetSummary: document.querySelector("#riskBudgetSummary"),
  riskExposureWarnings: document.querySelector("#riskExposureWarnings"),
  manualExposureMap: document.querySelector("#manualExposureMap"),
  historyRange: document.querySelector("#historyRange"),
  snapshotNote: document.querySelector("#snapshotNote"),
  historyChartDescription: document.querySelector("#historyChartDescription"),
  goalMobileButtons: [...document.querySelectorAll("[data-goal-mobile-panel]")],
  historyPanel: document.querySelector("#historyPanel"),
  retirementPanel: document.querySelector("#retirementPanel"),
  viewAnnounce: document.querySelector("#viewAnnounce"),
  retirementScenarioName: document.querySelector("#retirementScenarioName"),
  retirementScenarioSelect: document.querySelector("#retirementScenarioSelect"),
  saveScenarioBtn: document.querySelector("#saveScenarioBtn"),
  loadScenarioBtn: document.querySelector("#loadScenarioBtn"),
  deleteScenarioBtn: document.querySelector("#deleteScenarioBtn"),
  retirementSensitivity: document.querySelector("#retirementSensitivity"),
  retirementValidation: document.querySelector("#retirementValidation"),
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
  saveJournalBtn: document.querySelector("#saveJournalBtn"),
  decisionMetrics: document.querySelector("#decisionMetrics"),
  decisionWarnings: document.querySelector("#decisionWarnings"),
  economicPositionList: document.querySelector("#economicPositionList"),
  watchlistFormStatus: document.querySelector("#watchlistFormStatus"),
  watchlistForm: document.querySelector("#watchlistForm"),
  watchlistId: document.querySelector("#watchlistId"),
  watchlistName: document.querySelector("#watchlistName"),
  watchlistTicker: document.querySelector("#watchlistTicker"),
  watchlistType: document.querySelector("#watchlistType"),
  watchlistRole: document.querySelector("#watchlistRole"),
  watchlistHorizon: document.querySelector("#watchlistHorizon"),
  watchlistConviction: document.querySelector("#watchlistConviction"),
  watchlistThesis: document.querySelector("#watchlistThesis"),
  watchlistReturnSource: document.querySelector("#watchlistReturnSource"),
  watchlistKpis: document.querySelector("#watchlistKpis"),
  watchlistCatalysts: document.querySelector("#watchlistCatalysts"),
  watchlistInvalidation: document.querySelector("#watchlistInvalidation"),
  watchlistDeceleration: document.querySelector("#watchlistDeceleration"),
  watchlistNextReviewAt: document.querySelector("#watchlistNextReviewAt"),
  watchlistMigrationConflict: document.querySelector("#watchlistMigrationConflict"),
  saveWatchlistBtn: document.querySelector("#saveWatchlistBtn"),
  cancelWatchlistBtn: document.querySelector("#cancelWatchlistBtn"),
  watchlistList: document.querySelector("#watchlistList")
};

const initialStateLoad = loadState();
const state = initialStateLoad.state;
let storageWritesBlocked = !initialStateLoad.ok;
let protectedStorageRaw = initialStateLoad.ok ? null : initialStateLoad.raw;
document.addEventListener("submit", (event) => {
  if (!storageWritesBlocked) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  reportStorageFailure("보호 중인 원본 데이터가 있어 변경을 저장할 수 없습니다. 올바른 백업 파일을 가져오거나 클라우드 데이터를 다시 불러오세요.");
}, true);
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
  ledgerType: "ALL",
  activeView: "DASHBOARD",
  historyRange: "ALL",
  realizedYear: "ALL",
  goalMobilePanel: "HISTORY",
  portfolioBreakdownExpanded: false,
  autofilledAssetName: ""
};
let assetDetailOpener = null;

function defaultAllocationBands(targets = {}) {
  const fallbackTargets = { domestic: 50, overseas: 30, cash: 10, manual: 10 };
  return Object.fromEntries(Object.keys(fallbackTargets).map((key) => {
    const target = Number.isFinite(Number(targets[key])) ? Number(targets[key]) : fallbackTargets[key];
    return [key, {
      minPct: Math.max(0, target - 10),
      targetPct: target,
      maxPct: Math.min(100, target + 10)
    }];
  }));
}

function defaultState() {
  const portfolioTargets = {
    domestic: 50,
    overseas: 30,
    cash: 10,
    manual: 10
  };
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    assets: [],
    decisionProfiles: [],
    watchlist: [],
    realizedTrades: [],
    tradeJournalEntries: [],
    events: [],
    ledgerMeta: defaultLedgerMeta(),
    snapshots: [],
    meta: {
      cloudUpdatedAt: null,
      cloudRevision: 0,
      lastSavedAt: null,
      lastSyncDirection: "local",
      syncErrorCode: null
    },
    portfolioTargets,
    policyProfile: {
      allocationBands: defaultAllocationBands(portfolioTargets),
      riskBudgets: { ...DEFAULT_RISK_BUDGETS }
    },
    contributionPlan: {
      mode: "ONE_TIME",
      amount: 0
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

function ledgerEngine() {
  const engine = window.AssetTrailLedgerEngine;
  if (!engine) throw new Error("거래 원장 엔진을 불러오지 못했습니다.");
  return engine;
}

function unwrapLedgerResult(result, context = "거래 원장") {
  if (result?.ok && result.event) return result.event;
  const details = (result?.errors || []).map((error) => error.message).filter(Boolean).join(" ");
  throw new Error(`${context} 데이터가 올바르지 않습니다.${details ? ` ${details}` : ""}`);
}

function normalizeLedgerEvent(event) {
  return unwrapLedgerResult(ledgerEngine().normalizeLedgerEvent(event), "거래 원장 이벤트");
}

function defaultLedgerMeta() {
  return {
    activeLedgerId: `ledger-${uid()}`,
    baselineDate: null,
    migratedAt: null,
    migratedFromSchema: null
  };
}

function normalizeLedgerMeta(value, fallback = defaultLedgerMeta()) {
  const source = isPlainObject(value) ? value : {};
  const activeLedgerId = String(source.activeLedgerId || fallback.activeLedgerId || `ledger-${uid()}`).slice(0, IMPORT_STRING_LIMITS.id);
  return {
    activeLedgerId,
    baselineDate: normalizeDateKey(source.baselineDate || fallback.baselineDate) || null,
    migratedAt: normalizeStoredDate(source.migratedAt) || fallback.migratedAt || null,
    migratedFromSchema: Number.isSafeInteger(Number(source.migratedFromSchema))
      ? Number(source.migratedFromSchema)
      : fallback.migratedFromSchema ?? null
  };
}

function ledgerBaselineDate(source = {}) {
  return normalizeStoredDate(source?.meta?.lastSavedAt || source?.updatedAt)?.slice(0, 10)
    || localDateInputValue();
}

function openingEventsFromAssets(assets, source = {}) {
  const engine = ledgerEngine();
  const migrationDate = ledgerBaselineDate(source);
  return assets.map((asset, index) => unwrapLedgerResult(engine.createOpeningBalanceEvent(asset, {
    eventId: `opening-${String(asset.id || index).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 120)}-${index}`,
    openingDate: migrationDate,
    accountId: accountIdForAsset(asset),
    ...(isMarketType(assetType(asset)) ? { instrumentKey: decisionSubjectKeyForAsset(asset) } : {}),
    sourceSystem: "ASSETTRAIL_SCHEMA_MIGRATION",
    sourceId: String(asset.id || `asset-${index}`),
    note: "기존 보유 자산을 매수로 추정하지 않고 기초잔액으로 이전"
  }), "기초잔액 이벤트"));
}

function normalizeLedgerEvents(source, assets) {
  const engine = ledgerEngine();
  if (Array.isArray(source.events)) return source.events.map(normalizeLedgerEvent);
  return openingEventsFromAssets(assets, source);
}

function storageKeyForUser(user) {
  return user?.uid ? `${STORAGE_KEY}:user:${user.uid}` : STORAGE_KEY;
}

function loadState(storageKey = activeStorageKey) {
  const fallback = defaultState();
  let raw = null;

  try {
    raw = localStorage.getItem(storageKey);
    if (!raw) return { ok: true, state: fallback, error: null, raw: null };
    const saved = JSON.parse(raw);
    if (!isPlainObject(saved)) throw new Error("저장 데이터가 객체가 아닙니다.");
    const sourceVersion = Number(saved.schemaVersion || 1);
    const migrated = migrateState(saved);
    if (Number.isSafeInteger(sourceVersion) && sourceVersion < STATE_SCHEMA_VERSION) {
      const backupKey = `${storageKey}:migration-backup:v${sourceVersion}-to-v${STATE_SCHEMA_VERSION}`;
      try {
        localStorage.setItem(backupKey, raw);
        if (localStorage.getItem(backupKey) !== raw) throw new Error("마이그레이션 백업 검증에 실패했습니다.");
        const migratedRaw = JSON.stringify(storageSafeState(migrated));
        localStorage.setItem(storageKey, migratedRaw);
        if (localStorage.getItem(storageKey) !== migratedRaw) throw new Error("v5 데이터 저장 검증에 실패했습니다.");
      } catch (error) {
        if (localStorage.getItem(storageKey) !== raw) {
          try {
            localStorage.setItem(storageKey, raw);
          } catch (restoreError) {
            console.error("AssetTrail migration rollback failed", restoreError);
          }
        }
        reportStorageFailure("기존 데이터 백업 후 v5 전환 저장에 실패했습니다. 원본은 보존했으며 자동 저장을 중단했습니다.");
        return { ok: false, state: migrated, error, raw };
      }
    }
    return { ok: true, state: migrated, error: null, raw };
  } catch (error) {
    reportStorageFailure("로컬 데이터를 읽지 못했습니다. 브라우저 저장 권한과 저장 공간을 확인하세요.");
    return { ok: false, state: fallback, error, raw };
  }
}

function persist() {
  if (storageWritesBlocked) {
    reportStorageFailure("기존 로컬 데이터를 보호하기 위해 자동 저장을 중단했습니다. 올바른 백업 파일을 가져오거나 클라우드 데이터를 다시 불러오세요.");
    return false;
  }
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(storageSafeState()));
    return true;
  } catch (error) {
    console.error(error);
    reportStorageFailure("변경 내용을 이 기기에 저장하지 못했습니다. 브라우저 저장 권한 또는 남은 공간을 확인하고 데이터를 내보내세요.");
    return false;
  }
}

function hasFirebaseConfig() {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(firebaseConfig[key]));
}

function cloudSafeState(revision, updatedAt = new Date().toISOString(), { activeLedgerId = null } = {}) {
  const safeState = storageSafeState();
  const { events, ...primaryState } = safeState;
  const cloudRevision = normalizeRevision(revision);
  return {
    ...primaryState,
    ledgerMeta: {
      ...safeState.ledgerMeta,
      ...(activeLedgerId ? { activeLedgerId } : {}),
      eventCount: events.length,
      eventFingerprint: ledgerEventFingerprint(events)
    },
    revision: cloudRevision,
    meta: {
      ...safeState.meta,
      cloudRevision,
      lastSavedAt: updatedAt,
      syncErrorCode: null
    },
    updatedAt
  };
}

function ledgerEventFingerprint(events = state.events) {
  const canonical = JSON.stringify((events || [])
    .map(normalizeLedgerEvent)
    .sort(compareLedgerEventIds));
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const digest = [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
  return `cyrb128-v1:${digest}`;
}

function compareLedgerEventIds(a, b) {
  const left = String(a?.eventId || "");
  const right = String(b?.eventId || "");
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function storageSafeState(source = state) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    assets: source.assets.map(serializeAsset),
    decisionProfiles: source.decisionProfiles.map(serializeDecisionProfile),
    watchlist: source.watchlist.map(serializeWatchlistItem),
    realizedTrades: source.realizedTrades.map(serializeRealizedTrade),
    tradeJournalEntries: source.tradeJournalEntries.map(serializeTradeJournalEntry),
    events: source.events.map(normalizeLedgerEvent),
    ledgerMeta: normalizeLedgerMeta(source.ledgerMeta),
    snapshots: source.snapshots.map(normalizeSnapshot),
    meta: { ...source.meta },
    portfolioTargets: { ...source.portfolioTargets },
    policyProfile: normalizePolicyProfile(source.policyProfile, source.portfolioTargets),
    contributionPlan: normalizeContributionPlan(source.contributionPlan),
    retirementScenarios: source.retirementScenarios.map(normalizeRetirementScenario),
    retirement: { ...source.retirement }
  };
}

function migrateState(nextState) {
  const fallback = defaultState();
  const source = isPlainObject(nextState) ? nextState : {};
  assertSupportedStateSchema(source);
  const meta = isPlainObject(source.meta) ? source.meta : {};
  const assets = Array.isArray(source.assets)
    ? source.assets.map((asset, index) => {
        const serialized = serializeAsset(asset);
        if (!serialized.id) serialized.id = `legacy-asset-${index}`;
        return normalizeAsset(serialized);
      })
    : [];
  const watchlist = Array.isArray(source.watchlist)
    ? source.watchlist.map((item, index) => normalizeWatchlistItem(item, index))
    : [];
  const decisionProfiles = migrateDecisionProfiles(source, assets, watchlist);
  const legacyPortfolioTargets = normalizePortfolioTargets(source.portfolioTargets, fallback.portfolioTargets);
  const policyProfile = normalizePolicyProfile(source.policyProfile, legacyPortfolioTargets);
  const portfolioTargets = Object.fromEntries(
    Object.entries(policyProfile.allocationBands).map(([key, band]) => [key, band.targetPct])
  );
  const sourceVersion = Number.isSafeInteger(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 1;
  if (sourceVersion >= 5 && !Array.isArray(source.events)) {
    throw new Error("v5 거래 원장 이벤트 목록이 없습니다.");
  }
  const events = normalizeLedgerEvents(source, assets);
  const ledgerMeta = normalizeLedgerMeta(source.ledgerMeta, {
    ...defaultLedgerMeta(),
    baselineDate: sourceVersion < STATE_SCHEMA_VERSION && assets.length ? ledgerBaselineDate(source) : null,
    migratedAt: sourceVersion < STATE_SCHEMA_VERSION ? new Date().toISOString() : null,
    migratedFromSchema: sourceVersion < STATE_SCHEMA_VERSION ? sourceVersion : null
  });
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    assets,
    decisionProfiles,
    watchlist,
    realizedTrades: Array.isArray(source.realizedTrades) ? source.realizedTrades.map(normalizeRealizedTrade) : [],
    tradeJournalEntries: Array.isArray(source.tradeJournalEntries) ? source.tradeJournalEntries.map(normalizeTradeJournalEntry) : [],
    events,
    ledgerMeta,
    snapshots: Array.isArray(source.snapshots) ? source.snapshots.map(normalizeSnapshot) : [],
    meta: {
      cloudUpdatedAt: normalizeStoredDate(source.updatedAt || meta.cloudUpdatedAt),
      cloudRevision: normalizeRevision(source.revision ?? meta.cloudRevision),
      lastSavedAt: normalizeStoredDate(meta.lastSavedAt),
      lastSyncDirection: ["local", "download", "upload", "save"].includes(meta.lastSyncDirection)
        ? meta.lastSyncDirection
        : fallback.meta.lastSyncDirection,
      syncErrorCode: null
    },
    portfolioTargets,
    policyProfile,
    contributionPlan: normalizeContributionPlan(source.contributionPlan, fallback.contributionPlan),
    retirementScenarios: Array.isArray(source.retirementScenarios)
      ? source.retirementScenarios.map(normalizeRetirementScenario)
      : [],
    retirement: normalizeRetirementState(source.retirement, fallback.retirement)
  };
}

function replaceState(nextState) {
  const migrated = migrateState(nextState);
  state.schemaVersion = STATE_SCHEMA_VERSION;
  state.assets = migrated.assets;
  state.decisionProfiles = migrated.decisionProfiles;
  state.watchlist = migrated.watchlist;
  state.realizedTrades = migrated.realizedTrades;
  state.tradeJournalEntries = migrated.tradeJournalEntries;
  state.events = migrated.events;
  state.ledgerMeta = migrated.ledgerMeta;
  state.snapshots = migrated.snapshots;
  state.meta = migrated.meta;
  state.portfolioTargets = migrated.portfolioTargets;
  state.policyProfile = migrated.policyProfile;
  state.contributionPlan = migrated.contributionPlan;
  state.retirementScenarios = migrated.retirementScenarios;
  state.retirement = migrated.retirement;
  applyPricesToAssets();
  hydrateRetirementInputs();
  hydratePortfolioTargetInputs();
  hydrateActionSupportInputs();
  renderRetirementScenarioOptions();
  return true;
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function assertSupportedStateSchema(source) {
  if (source.schemaVersion === undefined || source.schemaVersion === null) return;
  const version = Number(source.schemaVersion);
  if (!Number.isSafeInteger(version) || version < 1 || version > STATE_SCHEMA_VERSION) {
    throw new Error(`지원하지 않는 데이터 스키마 버전입니다: ${source.schemaVersion}`);
  }
}

function normalizeStoredDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizePortfolioTargets(targets, fallback = defaultState().portfolioTargets) {
  const source = isPlainObject(targets) ? targets : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const value = Number(source[key]);
      return [key, Number.isFinite(value) ? value : fallbackValue];
    })
  );
}

function normalizedPercentage(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback;
}

function normalizeAllocationBands(bands, portfolioTargets) {
  const targets = normalizePortfolioTargets(portfolioTargets, {
    domestic: 50,
    overseas: 30,
    cash: 10,
    manual: 10
  });
  const source = isPlainObject(bands) ? bands : {};
  const defaults = defaultAllocationBands(targets);
  const candidateTargets = Object.fromEntries(ALLOCATION_BUCKET_KEYS.map((key) => {
    const band = isPlainObject(source[key]) ? source[key] : {};
    return [key, normalizedPercentage(band.targetPct ?? band.target, targets[key])];
  }));
  const candidateTargetTotal = Object.values(candidateTargets).reduce((sum, value) => sum + value, 0);
  const normalizedTargets = Math.abs(candidateTargetTotal - 100) <= PERCENT_TARGET_TOLERANCE ? candidateTargets : targets;
  let normalized = Object.fromEntries(ALLOCATION_BUCKET_KEYS.map((key) => {
    const band = isPlainObject(source[key]) ? source[key] : {};
    const targetPct = normalizedTargets[key];
    const fallbackBand = defaultAllocationBands(normalizedTargets)[key];
    const minPct = normalizedPercentage(band.minPct ?? band.min, fallbackBand.minPct);
    const maxPct = normalizedPercentage(band.maxPct ?? band.max, fallbackBand.maxPct);
    return [key, {
      minPct: minPct <= targetPct ? minPct : fallbackBand.minPct,
      targetPct,
      maxPct: maxPct >= targetPct ? maxPct : fallbackBand.maxPct
    }];
  }));
  const minTotal = Object.values(normalized).reduce((sum, band) => sum + band.minPct, 0);
  const maxTotal = Object.values(normalized).reduce((sum, band) => sum + band.maxPct, 0);
  if (minTotal > 100 + PERCENT_CONSTRAINT_EPSILON || maxTotal < 100 - PERCENT_CONSTRAINT_EPSILON) {
    const safeDefaults = defaultAllocationBands(normalizedTargets);
    normalized = Object.fromEntries(ALLOCATION_BUCKET_KEYS.map((key) => [key, {
      minPct: safeDefaults[key].minPct,
      targetPct: normalizedTargets[key],
      maxPct: safeDefaults[key].maxPct
    }]));
  }
  return normalized;
}

function normalizeRiskBudgets(riskBudgets, fallback = DEFAULT_RISK_BUDGETS) {
  const source = isPlainObject(riskBudgets) ? riskBudgets : {};
  return Object.fromEntries(Object.entries(fallback).map(([key, fallbackValue]) => [
    key,
    normalizedPercentage(source[key], fallbackValue)
  ]));
}

function normalizePolicyProfile(policyProfile, portfolioTargets) {
  const source = isPlainObject(policyProfile) ? policyProfile : {};
  return {
    allocationBands: normalizeAllocationBands(source.allocationBands, portfolioTargets),
    riskBudgets: normalizeRiskBudgets(source.riskBudgets)
  };
}

function normalizeContributionPlan(contributionPlan, fallback = { mode: "ONE_TIME", amount: 0 }) {
  const source = isPlainObject(contributionPlan) ? contributionPlan : {};
  const rawMode = String(source.mode || fallback.mode || "ONE_TIME").trim().toUpperCase();
  const rawAmount = Number(source.amount);
  const fallbackAmount = Number(fallback.amount);
  return {
    mode: CONTRIBUTION_MODES.has(rawMode) ? rawMode : "ONE_TIME",
    amount: Number.isSafeInteger(rawAmount) && rawAmount >= 0 && rawAmount <= 1e15
      ? rawAmount
      : Number.isSafeInteger(fallbackAmount) && fallbackAmount >= 0 && fallbackAmount <= 1e15
        ? fallbackAmount
        : 0
  };
}

function normalizeRetirementState(retirement, fallback = defaultState().retirement) {
  const source = isPlainObject(retirement) ? retirement : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const value = Number(source[key]);
      return [key, Number.isFinite(value) ? value : fallbackValue];
    })
  );
}

function normalizeRetirementScenario(scenario, index = 0) {
  const source = isPlainObject(scenario) ? scenario : {};
  return {
    id: String(source.id || `retirement-scenario-${index}`).slice(0, IMPORT_STRING_LIMITS.id),
    name: String(source.name || "").slice(0, IMPORT_STRING_LIMITS.short),
    input: normalizeRetirementState(source.input),
    updatedAt: normalizeStoredDate(source.updatedAt) || new Date(0).toISOString()
  };
}

function normalizeSnapshot(snapshot, index = 0) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  const createdAtValue = String(source.createdAt || "");
  const createdAt = Number.isFinite(Date.parse(createdAtValue))
    ? new Date(createdAtValue).toISOString()
    : new Date(0).toISOString();
  const typeTotals = {};
  if (isPlainObject(source.typeTotals)) {
    ["KRX", "US", "CASH", "MANUAL"].forEach((type) => {
      const value = Number(source.typeTotals[type]);
      if (Number.isFinite(value) && value >= 0) typeTotals[type] = value;
    });
  }
  return {
    id: String(source.id || `snapshot-${createdAt}-${index}`).slice(0, IMPORT_STRING_LIMITS.id),
    createdAt,
    total: Number.isFinite(Number(source.total)) && Number(source.total) >= 0 ? Number(source.total) : 0,
    note: String(source.note || "").slice(0, IMPORT_STRING_LIMITS.note),
    typeTotals
  };
}

function reportStorageFailure(message) {
  if (!els?.appNotice) return;
  els.appNotice.hidden = false;
  els.appNotice.setAttribute("role", "alert");
  els.appNotice.textContent = message;
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

function showStatusNotice(message) {
  if (!els.appNotice) return;
  els.appNotice.hidden = false;
  els.appNotice.setAttribute("role", "status");
  els.appNotice.textContent = message;
}

async function initPrices() {
  setPriceStatus("가격 확인중");
  if (els.priceRefreshBtn) els.priceRefreshBtn.disabled = true;
  symbolLoadPromise = null;
  symbolsLoaded = false;
  symbolLoadFailed = false;

  try {
    const loaded = await loadPriceBook();
    priceBook = normalizePriceBook(loaded.data);
    activePriceFileUrl = loaded.url;
    symbolsLoaded = !priceBook.symbolFile;
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

function symbolFileUrl() {
  const manifestPath = String(priceBook.symbolFile || SYMBOL_FILE_PATH).trim() || SYMBOL_FILE_PATH;
  try {
    if (/^https?:\/\//i.test(activePriceFileUrl)) {
      return new URL(manifestPath, activePriceFileUrl).href;
    }
    if (activePriceFileUrl === PUBLIC_PRICE_FILE_URL) {
      return PUBLIC_SYMBOL_FILE_URL;
    }
    return new URL(manifestPath, window.location.href).href;
  } catch {
    return manifestPath;
  }
}

function versionedSymbolUrl(url) {
  const version = priceBook.symbolsGeneratedAt || priceBook.generatedAt;
  if (!version) return url;
  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

async function ensureSymbolsLoaded() {
  if (symbolsLoaded || !priceBook.loaded || !priceBook.symbolFile) return priceBook.symbols;
  if (symbolLoadPromise) return symbolLoadPromise;

  symbolLoadPromise = (async () => {
    try {
      const response = await fetch(versionedSymbolUrl(symbolFileUrl()));
      if (!response.ok) throw new Error(`Symbols unavailable: ${response.status}`);
      const data = await response.json();
      if (!isPlainObject(data?.symbols)) throw new Error("Symbols payload is invalid");
      addSymbolGroup(priceBook, "KRX", data.symbols.KRX);
      addSymbolGroup(priceBook, "US", data.symbols.US);
      symbolsLoaded = true;
      symbolLoadFailed = false;
      return priceBook.symbols;
    } catch (error) {
      symbolLoadFailed = true;
      console.warn("Asset symbol directory unavailable", error);
      return priceBook.symbols;
    }
  })();

  return symbolLoadPromise;
}

function loadSymbolsForAssetForm() {
  fillAssetNameFromTicker();
  return ensureSymbolsLoaded().then(() => {
    fillAssetNameFromTicker();
    if (symbolLoadFailed && els.assetTickerHelp && isMarketType(normalizeAssetType(els.assetCategory?.value))) {
      els.assetTickerHelp.textContent = `${tickerHelpForType(normalizeAssetType(els.assetCategory.value))} 종목명은 직접 입력할 수 있습니다.`;
    }
  });
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
    cloud.collection = firestoreModule.collection || null;
    cloud.getDoc = firestoreModule.getDoc;
    cloud.getDocs = firestoreModule.getDocs || null;
    cloud.setDoc = firestoreModule.setDoc;
    cloud.runTransaction = firestoreModule.runTransaction || null;
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

  if (cloud.docRef && (cloudPushPending || cloudPushInFlight)) {
    try {
      await flushCloudPush();
    } catch (error) {
      console.error(error);
    }
  }
  persist();
  cancelCloudPush();
  cloud.user = user;
  cloud.docRef = null;
  cloud.lastPushedFingerprint = null;
  cloud.knownEventIds = new Set();
  cloud.conflictPending = false;
  cloud.schemaBlocked = false;
  cloud.schemaBlockSource = null;
  cloud.schemaBlockVersion = null;
  activeStorageKey = storageKeyForUser(user);
  const localLoad = loadState(activeStorageKey);
  storageWritesBlocked = !localLoad.ok;
  protectedStorageRaw = localLoad.ok ? null : localLoad.raw;
  replaceState(localLoad.state);
  render(false);
  updateAuthUi();
  if (!user) {
    setSyncStatus(cloud.enabled ? "클라우드 준비" : "로컬 저장", false);
    return;
  }

  cloud.docRef = cloud.doc(cloud.db, "users", user.uid, "financeData", CLOUD_DOC_ID);
  if (storageWritesBlocked) {
    setCloudSchemaBlock("local");
    updateAuthUi();
    return;
  }
  await pullCloudData();
}

function cloudEventRef(eventId, ledgerId = state.ledgerMeta?.activeLedgerId) {
  if (!cloud.docRef || !cloud.doc || !ledgerId || !eventId) return null;
  return cloud.doc(cloud.db, "users", cloud.user.uid, "financeData", CLOUD_DOC_ID, "ledgers", ledgerId, "events", eventId);
}

function cloudLedgerCollectionRef(ledgerId) {
  if (!cloud.docRef || !cloud.collection || !ledgerId) return null;
  return cloud.collection(cloud.db, "users", cloud.user.uid, "financeData", CLOUD_DOC_ID, "ledgers", ledgerId, "events");
}

function cloudBackupRef(backupId) {
  if (!cloud.docRef || !cloud.doc || !backupId) return null;
  return cloud.doc(cloud.db, "users", cloud.user.uid, "financeData", CLOUD_DOC_ID, "backups", backupId);
}

function cloudRemoteBackup(snapshot, remoteRevision, { forcedOverwrite = false } = {}) {
  if (!snapshot?.exists?.()) return null;
  const data = snapshot.data();
  const version = Number(data?.schemaVersion || 1);
  if (!Number.isSafeInteger(version)) return null;
  if (version >= STATE_SCHEMA_VERSION && !forcedOverwrite) return null;
  const kind = version < STATE_SCHEMA_VERSION ? "schema" : "conflict";
  return {
    id: `${kind}-v${version}-revision-${remoteRevision}`,
    payload: {
      sourceSchemaVersion: version,
      sourceRevision: remoteRevision,
      reason: version < STATE_SCHEMA_VERSION ? "SCHEMA_MIGRATION" : "FORCED_CONFLICT_UPLOAD",
      createdAt: normalizeStoredDate(data?.updatedAt || data?.meta?.lastSavedAt) || "1970-01-01T00:00:00.000Z",
      state: data
    }
  };
}

async function pullCloudEvents(cloudData) {
  const ledgerId = String(cloudData?.ledgerMeta?.activeLedgerId || "");
  if (!ledgerId) {
    const events = Array.isArray(cloudData?.events) ? cloudData.events.map(normalizeLedgerEvent) : [];
    return { events, complete: true };
  }
  const collectionRef = cloudLedgerCollectionRef(ledgerId);
  const expectedCount = Number(cloudData?.ledgerMeta?.eventCount || 0);
  if (!collectionRef || typeof cloud.getDocs !== "function") {
    if (expectedCount === 0) {
      return { events: [], complete: true };
    }
    throw createCloudSyncError(
      "assettrail/cloud-ledger-unavailable",
      "클라우드 원장 하위 컬렉션을 읽을 수 없어 동기화를 중단했습니다."
    );
  }
  const snapshot = await cloud.getDocs(collectionRef);
  const events = [];
  snapshot.forEach((documentSnapshot) => {
    events.push(normalizeLedgerEvent({
      ...documentSnapshot.data(),
      eventId: documentSnapshot.id || documentSnapshot.data()?.eventId
    }));
  });
  const expectedFingerprint = String(cloudData?.ledgerMeta?.eventFingerprint || "");
  const complete = events.length === expectedCount
    && (!expectedFingerprint || ledgerEventFingerprint(events) === expectedFingerprint);
  return { events, complete };
}

function cloudLedgerHead(data) {
  return JSON.stringify({
    revision: normalizeRevision(data?.revision ?? data?.meta?.cloudRevision),
    schemaVersion: Number(data?.schemaVersion || 1),
    activeLedgerId: String(data?.ledgerMeta?.activeLedgerId || ""),
    eventCount: Number(data?.ledgerMeta?.eventCount || 0),
    eventFingerprint: String(data?.ledgerMeta?.eventFingerprint || "")
  });
}

async function readCloudStateConsistently(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const firstSnapshot = await cloud.getDoc(cloud.docRef);
    if (!firstSnapshot.exists()) return { snapshot: firstSnapshot, data: null };
    const firstData = firstSnapshot.data();
    try {
      assertSupportedStateSchema(firstData);
    } catch {
      const error = createCloudSyncError(
        "assettrail/cloud-schema-unsupported",
        `현재 앱이 지원하지 않는 클라우드 데이터 버전(${firstData?.schemaVersion ?? "알 수 없음"})입니다.`
      );
      error.schemaVersion = firstData?.schemaVersion;
      throw error;
    }
    const pulled = await pullCloudEvents(firstData);
    const secondSnapshot = await cloud.getDoc(cloud.docRef);
    if (secondSnapshot.exists() && cloudLedgerHead(firstData) === cloudLedgerHead(secondSnapshot.data())) {
      if (!pulled.complete) {
        throw createCloudSyncError(
          "assettrail/cloud-ledger-incomplete",
          "클라우드 거래 원장이 완전하지 않아 기존 데이터를 유지했습니다."
        );
      }
      const data = { ...secondSnapshot.data() };
      if (data.ledgerMeta?.activeLedgerId || Array.isArray(data.events)) data.events = pulled.events;
      cloud.knownEventIds = new Set(pulled.events.map((event) => event.eventId));
      return { snapshot: secondSnapshot, data };
    }
  }
  throw createCloudSyncError(
    "assettrail/cloud-ledger-moving",
    "다른 기기에서 원장이 계속 변경되어 세 번 확인 후 동기화를 중단했습니다."
  );
}

function rotateLedgerGeneration() {
  state.ledgerMeta = {
    ...normalizeLedgerMeta(state.ledgerMeta),
    activeLedgerId: `ledger-${uid()}`
  };
  cloud.knownEventIds = new Set();
}

function setCloudSchemaBlock(source, version = null) {
  cloud.schemaBlocked = true;
  cloud.schemaBlockSource = source;
  cloud.schemaBlockVersion = Number.isSafeInteger(Number(version)) ? Number(version) : null;
  cloud.lastErrorCode = "assettrail/cloud-schema-unsupported";
  cancelCloudPush();
  updateAuthUi();
}

function clearCloudSchemaBlock(source = null) {
  if (source && cloud.schemaBlockSource !== source) return;
  cloud.schemaBlocked = false;
  cloud.schemaBlockSource = null;
  cloud.schemaBlockVersion = null;
  if (cloud.lastErrorCode === "assettrail/cloud-schema-unsupported") cloud.lastErrorCode = null;
}

function updateAuthUi() {
  const signedIn = Boolean(cloud.user);
  els.loginBtn.hidden = signedIn || !cloud.enabled;
  els.logoutBtn.hidden = !signedIn;
  els.cloudSyncBtn.hidden = !signedIn;

  if (!cloud.enabled) {
    setSyncStatus("로컬 저장");
  } else if (signedIn) {
    if (cloud.schemaBlocked) {
      setSyncStatus("데이터 버전 보호");
      const versionText = cloud.schemaBlockVersion ? ` v${cloud.schemaBlockVersion}` : "";
      setSyncDetail(cloud.schemaBlockSource === "remote"
        ? `현재 앱이 지원하지 않는 클라우드 데이터${versionText}를 감지해 읽기·쓰기를 중단했습니다.`
        : "이 기기의 저장 데이터를 안전하게 읽을 수 없어 클라우드 동기화를 중단했습니다.");
    } else if (cloud.conflictPending) {
      setSyncStatus("동기화 충돌");
      setSyncDetail("클라우드와 이 기기 중 사용할 데이터를 선택해야 합니다.");
    } else {
      setSyncStatus(`클라우드: ${cloud.user.email || "로그인됨"}`, true);
      setSyncDetail(syncDetailText(), true);
    }
  } else {
    setSyncStatus("클라우드 준비");
    setSyncDetail("");
  }
}

function cloudConflictRecordCount(data) {
  return ["decisionProfiles", "watchlist", "snapshots", "realizedTrades", "tradeJournalEntries", "events", "retirementScenarios"]
    .reduce((sum, key) => sum + (Array.isArray(data?.[key]) ? data[key].length : 0), 0);
}

function cloudConflictMetaText(data, { remote = false } = {}) {
  const savedAt = remote
    ? data?.updatedAt || data?.meta?.lastSavedAt
    : data?.meta?.lastSavedAt;
  const assetCount = Array.isArray(data?.assets) ? data.assets.length : 0;
  return `${formatDate(savedAt)} · 자산 ${assetCount.toLocaleString("ko-KR")}개 · 기록 ${cloudConflictRecordCount(data).toLocaleString("ko-KR")}개`;
}

async function chooseCloudConflict(cloudData) {
  const localData = storageSafeState();
  const resolver = window.assetTrailCloudConflictResolver;
  if (typeof resolver === "function") {
    const choice = await resolver({
      cloud: cloudData,
      local: localData
    });
    return ["download", "upload", "later"].includes(choice) ? choice : "later";
  }

  const dialog = els.cloudConflictDialog;
  if (!dialog) return "later";
  if (els.cloudConflictCloudMeta) {
    els.cloudConflictCloudMeta.textContent = cloudConflictMetaText(cloudData, { remote: true });
  }
  if (els.cloudConflictLocalMeta) {
    els.cloudConflictLocalMeta.textContent = cloudConflictMetaText(localData);
  }

  return new Promise((resolve) => {
    let settled = false;
    const previousFocus = document.activeElement;
    const appWasInert = els.app?.hasAttribute("inert") || false;
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      dialog.removeEventListener("click", handleClick);
      dialog.removeEventListener("cancel", handleCancel);
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      if (!appWasInert) els.app?.removeAttribute("inert");
      if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
      resolve(choice);
    };
    const handleClick = (event) => {
      const button = event.target.closest("[data-cloud-conflict-choice]");
      if (!button) return;
      finish(button.dataset.cloudConflictChoice);
    };
    const handleCancel = (event) => {
      event.preventDefault();
      finish("later");
    };

    dialog.addEventListener("click", handleClick);
    dialog.addEventListener("cancel", handleCancel);
    els.app?.setAttribute("inert", "");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector('[data-cloud-conflict-choice="download"]')?.focus();
  });
}

function backupBeforeCloudConflictResolution() {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return downloadStateFile(storageSafeState(), `assettrail-before-cloud-sync-${timestamp}.json`);
}

async function pullCloudData() {
  if (!cloud.docRef) return false;
  if (storageWritesBlocked) {
    setCloudSchemaBlock("local");
    return false;
  }
  setSyncStatus("클라우드 확인중", true);
  let cloudRead;
  try {
    cloudRead = await readCloudStateConsistently();
  } catch (error) {
    if (error?.code === "assettrail/cloud-schema-unsupported") {
      setCloudSchemaBlock("remote", error.schemaVersion);
      return false;
    }
    throw error;
  }
  const { snapshot, data: consistentCloudData } = cloudRead;
  if (snapshot.exists()) {
    const cloudData = consistentCloudData;
    const remoteSchemaVersion = Number(cloudData?.schemaVersion || 1);
    const remoteRevision = normalizeRevision(cloudData?.revision ?? cloudData?.meta?.cloudRevision);
    try {
      assertSupportedStateSchema(cloudData);
    } catch (error) {
      console.error(error);
      setCloudSchemaBlock("remote", cloudData?.schemaVersion);
      return false;
    }
    clearCloudSchemaBlock("remote");
    if (shouldWarnCloudConflict(cloudData)) {
      setSyncStatus("동기화 선택 필요");
      setSyncDetail("클라우드와 이 기기 중 사용할 데이터를 선택하세요.");
      const choice = await chooseCloudConflict(cloudData);
      if (choice === "later") {
        cloud.conflictPending = true;
        cancelCloudPush();
        updateAuthUi();
        return false;
      }
      if (!backupBeforeCloudConflictResolution()) {
        cloud.conflictPending = true;
        reportStorageFailure("현재 데이터 자동 백업에 실패해 클라우드 동기화를 중단했습니다.");
        updateAuthUi();
        return false;
      }
      cloud.conflictPending = false;
      if (choice === "upload") {
        rotateLedgerGeneration();
        await pushCloudData("upload", {
          expectedRemoteRevision: normalizeRevision(cloudData.revision ?? cloudData.meta?.cloudRevision)
        });
        return true;
      }
    }
    replaceState(cloudData);
    cloud.conflictPending = false;
    storageWritesBlocked = false;
    protectedStorageRaw = null;
    state.meta.lastSyncDirection = "download";
    render(false);
    if (remoteSchemaVersion < STATE_SCHEMA_VERSION) {
      try {
        await pushCloudData("upload", { expectedRemoteRevision: remoteRevision });
      } catch (error) {
        console.error(error);
        setSyncStatus("원장 이전 실패");
        setSyncDetail("로컬 v5 데이터는 보존했지만 클라우드 원장 승격에 실패했습니다. 다시 동기화하세요.");
        reportStorageFailure("클라우드 구버전 백업·원장 승격을 완료하지 못했습니다. 이 기기의 v5 데이터는 보존했습니다.");
        updateAuthUi();
        return false;
      }
    } else {
      cloud.lastPushedFingerprint = dataFingerprint(storageSafeState());
    }
  } else {
    state.meta.cloudUpdatedAt = null;
    state.meta.cloudRevision = 0;
    if (localHasUserData()) {
      await pushCloudData("upload", { expectedRemoteRevision: 0 });
    } else {
      replaceState(defaultState());
      state.meta.lastSyncDirection = "local";
      persist();
      render(false);
    }
  }
  updateAuthUi();
  return true;
}

async function pushCloudData(direction = "save", options = {}) {
  if (!cloud.docRef || storageWritesBlocked || cloud.schemaBlocked) {
    updateAuthUi();
    return false;
  }
  const fingerprintBeforeWrite = dataFingerprint(storageSafeState());
  if (direction !== "upload" && fingerprintBeforeWrite === cloud.lastPushedFingerprint) {
    updateAuthUi();
    return;
  }
  setSyncStatus("클라우드 저장중", true);
  try {
    const payload = await writeCloudState(options);
    cloud.lastPushedFingerprint = dataFingerprint(storageSafeState());
    cloud.lastErrorCode = null;
    state.meta.cloudUpdatedAt = payload.updatedAt;
    state.meta.cloudRevision = normalizeRevision(payload.revision);
    state.meta.lastSavedAt = payload.updatedAt;
    state.meta.lastSyncDirection = direction;
    state.meta.syncErrorCode = null;
    persist();
    updateAuthUi();
    return true;
  } catch (error) {
    exposeCloudSyncError(error);
    throw error;
  }
}

async function writeCloudState({ expectedRemoteRevision = null } = {}) {
  const db = cloud.db;
  const docRef = cloud.docRef;
  if (!docRef) throw createCloudSyncError("assettrail/cloud-unavailable", "클라우드 연결이 없습니다.");
  const localRevision = normalizeRevision(state.meta.cloudRevision);
  const localEvents = state.events.map(normalizeLedgerEvent);
  const pendingEvents = localEvents.filter((event) => !cloud.knownEventIds.has(event.eventId));
  const writeEvent = (writer, event, ledgerId = state.ledgerMeta?.activeLedgerId) => {
    const eventRef = cloudEventRef(event.eventId, ledgerId);
    if (!eventRef) throw createCloudSyncError("assettrail/cloud-ledger-unavailable", "클라우드 원장 저장 경로를 만들 수 없습니다.");
    writer.set(eventRef, event, { merge: false });
  };
  if (typeof cloud.runTransaction === "function") {
    const isBulkGeneration = pendingEvents.length > CLOUD_TRANSACTION_EVENT_LIMIT;
    const writeLedgerId = isBulkGeneration ? `ledger-${uid()}` : state.ledgerMeta.activeLedgerId;
    if (isBulkGeneration) {
      if (typeof cloud.setDoc !== "function") {
        throw createCloudSyncError("assettrail/cloud-ledger-unavailable", "대량 원장 이전을 지원하지 않는 클라우드 연결입니다.");
      }
      assertCloudPayloadSize(cloudSafeState(localRevision + 1, undefined, { activeLedgerId: writeLedgerId }));
      for (let index = 0; index < localEvents.length; index += 100) {
        const chunk = localEvents.slice(index, index + 100);
        await Promise.all(chunk.map((event) => cloud.setDoc(
          cloudEventRef(event.eventId, writeLedgerId),
          event,
          { merge: false }
        )));
      }
    }
    const transactionEvents = isBulkGeneration ? [] : pendingEvents;
    const payload = await cloud.runTransaction(db, async (transaction) => {
      const remoteSnapshot = await transaction.get(docRef);
      assertRemoteSchemaSupported(remoteSnapshot);
      const remoteRevision = revisionFromSnapshot(remoteSnapshot);
      assertRemoteRevisionIsCurrent(localRevision, remoteRevision, expectedRemoteRevision);
      const payload = cloudSafeState(Math.max(localRevision, remoteRevision) + 1, undefined, {
        activeLedgerId: writeLedgerId
      });
      assertCloudPayloadSize(payload);
      const backup = cloudRemoteBackup(remoteSnapshot, remoteRevision, {
        forcedOverwrite: expectedRemoteRevision !== null
      });
      if (backup) transaction.set(cloudBackupRef(backup.id), backup.payload, { merge: false });
      transactionEvents.forEach((event) => writeEvent(transaction, event, writeLedgerId));
      transaction.set(docRef, payload, { merge: false });
      return payload;
    });
    if (isBulkGeneration) {
      state.ledgerMeta.activeLedgerId = writeLedgerId;
      cloud.knownEventIds = new Set(localEvents.map((event) => event.eventId));
    } else {
      pendingEvents.forEach((event) => cloud.knownEventIds.add(event.eventId));
    }
    return payload;
  }

  let remoteRevision = 0;
  let remoteSnapshot = null;
  if (typeof cloud.getDoc === "function") {
    remoteSnapshot = await cloud.getDoc(docRef);
    assertRemoteSchemaSupported(remoteSnapshot);
    remoteRevision = revisionFromSnapshot(remoteSnapshot);
  }
  assertRemoteRevisionIsCurrent(localRevision, remoteRevision, expectedRemoteRevision);
  if (expectedRemoteRevision !== null && remoteSnapshot?.exists?.()) {
    throw createCloudSyncError(
      "assettrail/cloud-atomicity-required",
      "원격 데이터를 보존하는 강제 업로드에는 Firestore transaction 지원이 필요합니다."
    );
  }
  if (pendingEvents.length > CLOUD_TRANSACTION_EVENT_LIMIT) {
    throw createCloudSyncError(
      "assettrail/cloud-atomicity-required",
      "대량 원장은 새 세대로 안전하게 전환해야 하므로 Firestore transaction 지원이 필요합니다."
    );
  }
  const payload = cloudSafeState(Math.max(localRevision, remoteRevision) + 1);
  assertCloudPayloadSize(payload);
  const backup = cloudRemoteBackup(remoteSnapshot, remoteRevision);
  if (backup) await cloud.setDoc(cloudBackupRef(backup.id), backup.payload, { merge: false });
  for (let index = 0; index < pendingEvents.length; index += 100) {
    const chunk = pendingEvents.slice(index, index + 100);
    await Promise.all(chunk.map((event) => cloud.setDoc(cloudEventRef(event.eventId), event, { merge: false })));
  }
  await cloud.setDoc(docRef, payload, { merge: false });
  pendingEvents.forEach((event) => cloud.knownEventIds.add(event.eventId));
  return payload;
}

function assertRemoteSchemaSupported(snapshot) {
  if (!snapshot?.exists?.()) return;
  const remoteData = snapshot.data();
  try {
    assertSupportedStateSchema(remoteData);
  } catch (error) {
    throw createCloudSyncError(
      "assettrail/cloud-schema-unsupported",
      `현재 앱이 지원하지 않는 클라우드 데이터 버전(${remoteData?.schemaVersion ?? "알 수 없음"})이라 저장을 중단했습니다.`
    );
  }
}

function revisionFromSnapshot(snapshot) {
  if (!snapshot?.exists?.()) return 0;
  const data = snapshot.data();
  return normalizeRevision(data?.revision ?? data?.meta?.cloudRevision);
}

function assertRemoteRevisionIsCurrent(localRevision, remoteRevision, expectedRemoteRevision = null) {
  if (expectedRemoteRevision !== null) {
    if (remoteRevision === normalizeRevision(expectedRemoteRevision)) return;
  } else if (remoteRevision <= localRevision) {
    return;
  }
  throw createCloudSyncError(
    "assettrail/cloud-conflict",
    "다른 기기에 더 최신 데이터가 있어 자동 저장을 중단했습니다."
  );
}

function serializedByteLength(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof TextEncoder === "function") return new TextEncoder().encode(serialized).byteLength;
  return new Blob([serialized]).size;
}

function assertCloudPayloadSize(payload) {
  const bytes = serializedByteLength(payload);
  if (bytes <= CLOUD_PAYLOAD_MAX_BYTES) return;
  throw createCloudSyncError(
    "assettrail/cloud-payload-too-large",
    `클라우드 저장 데이터가 ${Math.ceil(bytes / 1024)}KB로 안전 한도 900KB를 넘었습니다. 데이터를 내보낸 뒤 기록을 정리하세요.`
  );
}

function createCloudSyncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exposeCloudSyncError(error) {
  const code = String(error?.code || "assettrail/cloud-save-failed");
  cloud.lastErrorCode = code;
  state.meta.syncErrorCode = code;
  persist();
  if (code === "assettrail/cloud-conflict") {
    setSyncStatus("동기화 충돌");
    setSyncDetail(error.message);
    return;
  }
  if (code === "assettrail/cloud-schema-unsupported") {
    setCloudSchemaBlock("remote");
    setSyncDetail(error.message);
    return;
  }
  if (code === "assettrail/cloud-payload-too-large") {
    setSyncStatus("클라우드 용량 초과");
    setSyncDetail(error.message);
    reportStorageFailure(error.message);
    return;
  }
  if (["assettrail/cloud-ledger-unavailable", "assettrail/cloud-ledger-incomplete", "assettrail/cloud-ledger-moving"].includes(code)) {
    setSyncStatus("원장 동기화 중단");
    setSyncDetail(error.message);
    reportStorageFailure(error.message);
    return;
  }
  setSyncStatus("저장 실패");
  setSyncDetail("클라우드 저장에 실패했습니다. 네트워크 상태를 확인하세요.");
}

let cloudPushTimer = null;
let cloudPushPending = false;
let cloudPushInFlight = null;

function cloudPushDelayMs() {
  const value = window.assetTrailCloudPushDelayMs;
  return Number.isFinite(value) ? value : 2000;
}

function scheduleCloudPush() {
  if (!cloud.docRef || cloud.conflictPending || cloud.schemaBlocked || storageWritesBlocked) return;
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
  if (cloud.conflictPending || cloud.schemaBlocked || storageWritesBlocked) {
    cloudPushPending = false;
    return;
  }

  while (cloud.docRef) {
    if (cloudPushInFlight) {
      try {
        await cloudPushInFlight;
      } catch (error) {
        console.error(error);
      }
      continue;
    }
    if (!cloudPushPending) return;

    cloudPushPending = false;
    const activePush = pushCloudData();
    cloudPushInFlight = activePush;
    try {
      await activePush;
    } catch (error) {
      console.error(error);
      if (error?.code === "assettrail/cloud-conflict") {
        cloud.conflictPending = true;
      } else if (!cloud.lastErrorCode) {
        setSyncStatus("저장 실패");
      }
    } finally {
      if (cloudPushInFlight === activePush) cloudPushInFlight = null;
    }
    if (cloud.conflictPending) {
      try {
        await pullCloudData();
      } catch (error) {
        console.error(error);
      }
      return;
    }
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
  if (!localHasUserData() || !cloudData) return false;
  return dataFingerprint(storageSafeState()) !== dataFingerprint(cloudConflictComparisonState(cloudData));
}

function cloudConflictComparisonState(cloudData) {
  const remoteSchemaVersion = Number(cloudData?.schemaVersion || 1);
  const localLedgerMeta = normalizeLedgerMeta(state.ledgerMeta);
  if (remoteSchemaVersion >= STATE_SCHEMA_VERSION
    || localLedgerMeta.migratedFromSchema !== remoteSchemaVersion) {
    return cloudData;
  }

  try {
    const comparisonCloudData = localLedgerMeta.baselineDate
      ? {
        ...cloudData,
        meta: {
          ...(isPlainObject(cloudData.meta) ? cloudData.meta : {}),
          lastSavedAt: `${localLedgerMeta.baselineDate}T00:00:00.000Z`
        }
      }
      : cloudData;
    const migratedCloudData = migrateState(comparisonCloudData);
    // Legacy migration synthesizes these values locally. Align only those values
    // while preserving every economic field in the conflict comparison.
    migratedCloudData.ledgerMeta = {
      ...normalizeLedgerMeta(migratedCloudData.ledgerMeta),
      activeLedgerId: localLedgerMeta.activeLedgerId,
      migratedAt: localLedgerMeta.migratedAt
    };
    return migratedCloudData;
  } catch (error) {
    console.error(error);
    return cloudData;
  }
}

function localHasUserData() {
  const defaults = defaultState();
  return Boolean(
    state.assets.length
    || state.decisionProfiles.length
    || state.watchlist.length
    || state.realizedTrades.length
    || state.tradeJournalEntries.length
    || state.events.length
    || state.snapshots.length
    || state.retirementScenarios.length
    || JSON.stringify(state.portfolioTargets) !== JSON.stringify(defaults.portfolioTargets)
    || JSON.stringify(state.policyProfile) !== JSON.stringify(defaults.policyProfile)
    || JSON.stringify(state.contributionPlan) !== JSON.stringify(defaults.contributionPlan)
    || JSON.stringify(state.retirement) !== JSON.stringify(defaults.retirement)
  );
}

function dataFingerprint(data) {
  return JSON.stringify({
    assets: (data.assets || []).map(normalizeAsset).map(serializeAsset),
    decisionProfiles: (data.decisionProfiles || []).map(normalizeDecisionProfile).map(serializeDecisionProfile),
    watchlist: (data.watchlist || []).map(normalizeWatchlistItem).map(serializeWatchlistItem),
    realizedTrades: (data.realizedTrades || []).map(normalizeRealizedTrade).map(serializeRealizedTrade),
    tradeJournalEntries: (data.tradeJournalEntries || []).map(normalizeTradeJournalEntry).map(serializeTradeJournalEntry),
    events: (data.events || []).map(normalizeLedgerEvent).sort(compareLedgerEventIds),
    ledgerMeta: normalizeLedgerMeta(data.ledgerMeta),
    snapshots: (data.snapshots || []).map(normalizeSnapshot),
    portfolioTargets: normalizePortfolioTargets(data.portfolioTargets),
    policyProfile: normalizePolicyProfile(data.policyProfile, data.portfolioTargets),
    contributionPlan: normalizeContributionPlan(data.contributionPlan),
    retirement: normalizeRetirementState(data.retirement),
    retirementScenarios: (data.retirementScenarios || []).map(normalizeRetirementScenario)
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

function normalizeEnum(value, labels, fallback) {
  const key = String(value || fallback).trim().toUpperCase();
  return Object.hasOwn(labels, key) ? key : fallback;
}

function normalizeDateKey(value) {
  const key = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const parsed = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
}

function normalizeRiskTagList(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  const unique = new Map();
  values.slice(0, RISK_TAGS_PER_DIMENSION_LIMIT * 2).forEach((entry) => {
    const tag = String(entry || "").trim().replace(/\s+/g, " ").slice(0, RISK_TAG_LENGTH_LIMIT);
    if (!tag) return;
    const key = tag.toLocaleLowerCase("ko-KR");
    if (!unique.has(key) && unique.size < RISK_TAGS_PER_DIMENSION_LIMIT) unique.set(key, tag);
  });
  return [...unique.values()];
}

function normalizeRiskTags(value) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(Object.keys(RISK_TAG_DIMENSION_LABELS).map((key) => [
    key,
    normalizeRiskTagList(source[key])
  ]));
}

function riskTagsHaveData(value) {
  return Object.values(normalizeRiskTags(value)).some((tags) => tags.length);
}

function normalizeDecisionProfileFields(source) {
  const profile = isPlainObject(source) ? source : {};
  return {
    investmentRole: normalizeEnum(profile.investmentRole || profile.role, INVESTMENT_ROLE_LABELS, "UNASSIGNED"),
    thesis: String(profile.thesis || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    returnSource: String(profile.returnSource || profile.expectedReturnSource || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    horizon: normalizeEnum(profile.horizon, INVESTMENT_HORIZON_LABELS, "UNSET"),
    conviction: normalizeEnum(profile.conviction, CONVICTION_LABELS, "UNSET"),
    kpis: String(profile.kpis || profile.monitoringKpis || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    catalysts: String(profile.catalysts || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    invalidation: String(profile.invalidation || profile.invalidationRules || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    deceleration: String(profile.deceleration || profile.decelerationRules || "").trim().slice(0, IMPORT_STRING_LIMITS.note),
    nextReviewAt: normalizeDateKey(profile.nextReviewAt),
    lastReviewedAt: normalizeDateKey(profile.lastReviewedAt),
    reviewStatus: normalizeEnum(profile.reviewStatus, REVIEW_STATUS_LABELS, "UNSET")
  };
}

function normalizeDecisionMigrationConflict(conflict, index = 0) {
  const source = isPlainObject(conflict) ? conflict : {};
  const sourceType = ["asset", "watchlist", "profile"].includes(source.sourceType)
    ? source.sourceType
    : "profile";
  return {
    sourceType,
    sourceId: String(source.sourceId || `legacy-source-${index}`).trim().slice(0, IMPORT_STRING_LIMITS.id),
    sourceName: String(source.sourceName || "").trim().slice(0, IMPORT_STRING_LIMITS.short),
    account: String(source.account || "").trim().slice(0, IMPORT_STRING_LIMITS.short),
    fields: {
      ...normalizeDecisionProfileFields(source.fields),
      riskTags: normalizeRiskTags(source.fields?.riskTags)
    }
  };
}

function normalizeDecisionMigrationConflicts(conflicts) {
  if (!Array.isArray(conflicts)) return [];
  const unique = new Map();
  conflicts.slice(0, DECISION_MIGRATION_CONFLICT_LIMIT).forEach((conflict, index) => {
    const normalized = normalizeDecisionMigrationConflict(conflict, index);
    unique.set(JSON.stringify(normalized), normalized);
  });
  return [...unique.values()];
}

function decisionProfileFieldsFingerprint(source) {
  return JSON.stringify({
    ...normalizeDecisionProfileFields(source),
    riskTags: normalizeRiskTags(source?.riskTags)
  });
}

function decisionMigrationConflictFor(sourceType, rawSource, subject = {}) {
  return normalizeDecisionMigrationConflict({
    sourceType,
    sourceId: subject.id || rawSource?.id,
    sourceName: subject.name || rawSource?.name,
    account: subject.account || rawSource?.account,
    fields: rawSource
  });
}

function hasDecisionProfileData(source) {
  const profile = normalizeDecisionProfileFields(source);
  return profile.investmentRole !== "UNASSIGNED"
    || profile.horizon !== "UNSET"
    || profile.conviction !== "UNSET"
    || profile.reviewStatus !== "UNSET"
    || [
      profile.thesis,
      profile.returnSource,
      profile.kpis,
      profile.catalysts,
      profile.invalidation,
      profile.deceleration,
      profile.nextReviewAt,
      profile.lastReviewedAt
    ].some(Boolean)
    || riskTagsHaveData(source?.riskTags);
}

function decisionSubjectKeyForAsset(asset) {
  const type = assetType(asset);
  const ticker = normalizeTicker(type, asset?.ticker);
  if (isMarketType(type) && ticker) return `INSTRUMENT:${type}:${ticker}`;
  return `ASSET:${String(asset?.id || "")}`;
}

function decisionSubjectKeyForWatchlist(item) {
  const type = ["KRX", "US"].includes(String(item?.type || "").toUpperCase())
    ? String(item.type).toUpperCase()
    : "KRX";
  return `INSTRUMENT:${type}:${normalizeTicker(type, item?.ticker)}`;
}

function normalizeDecisionProfile(profile, index = 0) {
  const source = isPlainObject(profile) ? profile : {};
  const subjectKey = String(source.subjectKey || source.id || `PROFILE:legacy-${index}`)
    .trim()
    .slice(0, IMPORT_STRING_LIMITS.short);
  const type = ["KRX", "US", "CASH", "MANUAL"].includes(String(source.type || "").toUpperCase())
    ? String(source.type).toUpperCase()
    : "MANUAL";
  return {
    id: String(source.id || subjectKey).slice(0, IMPORT_STRING_LIMITS.short),
    subjectKey,
    name: String(source.name || "").trim().slice(0, IMPORT_STRING_LIMITS.short),
    type,
    ticker: normalizeTicker(type, source.ticker),
    ...normalizeDecisionProfileFields(source),
    riskTags: normalizeRiskTags(source.riskTags),
    migrationConflicts: normalizeDecisionMigrationConflicts(source.migrationConflicts),
    createdAt: normalizeStoredDate(source.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeStoredDate(source.updatedAt) || new Date(0).toISOString()
  };
}

function serializeDecisionProfile(profile) {
  return normalizeDecisionProfile(profile);
}

function normalizeWatchlistItem(item, index = 0) {
  const source = isPlainObject(item) ? item : {};
  const rawType = String(source.type || "KRX").trim().toUpperCase();
  const type = ["KRX", "US"].includes(rawType) ? rawType : "KRX";
  return {
    id: String(source.id || `legacy-watchlist-${index}`).trim().slice(0, IMPORT_STRING_LIMITS.id),
    name: String(source.name || "").trim().slice(0, IMPORT_STRING_LIMITS.short),
    ticker: normalizeTicker(type, source.ticker),
    type,
    createdAt: normalizeStoredDate(source.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeStoredDate(source.updatedAt) || new Date(0).toISOString()
  };
}

function serializeWatchlistItem(item) {
  return normalizeWatchlistItem(item);
}

function migrateDecisionProfiles(source, assets, watchlist) {
  const profiles = new Map();
  const origins = new Map();
  const addProfile = (profile, index) => {
    const normalized = normalizeDecisionProfile(profile, index);
    if (!normalized.subjectKey) return null;
    profiles.set(normalized.subjectKey, normalized);
    return normalized;
  };

  const mergeLegacyProfile = (profile, origin, index) => {
    const normalized = normalizeDecisionProfile(profile, index);
    const existing = profiles.get(normalized.subjectKey);
    if (!existing) {
      profiles.set(normalized.subjectKey, normalized);
      origins.set(normalized.subjectKey, origin);
      return;
    }
    if (decisionProfileFieldsFingerprint(existing) === decisionProfileFieldsFingerprint(normalized)) return;
    const conflicts = [...existing.migrationConflicts];
    const existingOrigin = origins.get(normalized.subjectKey)
      || decisionMigrationConflictFor("profile", existing, existing);
    conflicts.push(existingOrigin, origin);
    profiles.set(normalized.subjectKey, normalizeDecisionProfile({
      ...existing,
      reviewStatus: existing.reviewStatus === "INVALIDATED" ? "INVALIDATED" : "REVIEW",
      migrationConflicts: conflicts
    }, index));
  };

  (Array.isArray(source.decisionProfiles) ? source.decisionProfiles : []).forEach((profile, index) => {
    const normalized = addProfile(profile, index);
    if (normalized) origins.set(
      normalized.subjectKey,
      decisionMigrationConflictFor("profile", profile, normalized)
    );
  });
  (Array.isArray(source.assets) ? source.assets : []).forEach((rawAsset, index) => {
    if (!hasDecisionProfileData(rawAsset)) return;
    const asset = assets[index];
    if (!asset) return;
    const subjectKey = decisionSubjectKeyForAsset(asset);
    mergeLegacyProfile({
      ...rawAsset,
      id: subjectKey,
      subjectKey,
      name: asset.name,
      type: assetType(asset),
      ticker: asset.ticker
    }, decisionMigrationConflictFor("asset", rawAsset, asset), profiles.size);
  });
  (Array.isArray(source.watchlist) ? source.watchlist : []).forEach((rawItem, index) => {
    if (!hasDecisionProfileData(rawItem)) return;
    const item = watchlist[index];
    if (!item) return;
    const subjectKey = decisionSubjectKeyForWatchlist(item);
    mergeLegacyProfile({
      ...rawItem,
      id: subjectKey,
      subjectKey,
      name: item.name,
      type: item.type,
      ticker: item.ticker
    }, decisionMigrationConflictFor("watchlist", rawItem, item), profiles.size);
  });

  return [...profiles.values()];
}

function decisionProfileForSubject(subjectKey, fallback = {}) {
  const profile = state.decisionProfiles.find((item) => item.subjectKey === subjectKey);
  return profile || normalizeDecisionProfile({
    id: subjectKey,
    subjectKey,
    ...fallback
  });
}

function decisionProfileForAsset(asset) {
  return decisionProfileForSubject(decisionSubjectKeyForAsset(asset), {
    name: asset?.name,
    type: assetType(asset),
    ticker: asset?.ticker
  });
}

function decisionProfileForWatchlist(item) {
  return decisionProfileForSubject(decisionSubjectKeyForWatchlist(item), {
    name: item?.name,
    type: item?.type,
    ticker: item?.ticker
  });
}

function upsertDecisionProfile(subjectKey, nextFields, subject = {}) {
  const index = state.decisionProfiles.findIndex((item) => item.subjectKey === subjectKey);
  const previous = index >= 0 ? state.decisionProfiles[index] : null;
  const now = new Date().toISOString();
  const profile = normalizeDecisionProfile({
    ...(previous || {}),
    ...nextFields,
    id: previous?.id || subjectKey,
    subjectKey,
    name: subject.name || previous?.name || "",
    type: subject.type || previous?.type || "MANUAL",
    ticker: subject.ticker || previous?.ticker || "",
    createdAt: previous?.createdAt || now,
    updatedAt: now
  });
  if (index >= 0) state.decisionProfiles[index] = profile;
  else state.decisionProfiles.push(profile);
  return profile;
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
  return {
    id: String(normalized.id || ""),
    name: String(normalized.name || ""),
    ticker: String(normalized.ticker || ""),
    type: normalized.type,
    account: String(normalized.account || ""),
    accountClass: normalized.accountClass,
    manualSubtype: normalized.manualSubtype,
    amount: Number(normalized.amount || 0),
    quantity: Number(normalized.quantity || 0),
    averagePrice: Number(normalized.averagePrice || 0),
    note: String(normalized.note || ""),
    ...(normalized.createdAt ? { createdAt: String(normalized.createdAt) } : {}),
    ...(normalized.updatedAt ? { updatedAt: String(normalized.updatedAt) } : {}),
    ...(normalized.kind ? { kind: String(normalized.kind) } : {})
  };
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
    ledgerEventId: String(trade?.ledgerEventId || ""),
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
    createdAt: trade?.createdAt || new Date().toISOString(),
    cancelledAt: normalizeStoredDate(trade?.cancelledAt)
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
    ledgerEventId: String(entry?.ledgerEventId || ""),
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
  const ticker = normalizeAssetKey(normalizeTicker(type, asset.ticker));
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
    symbolFile: typeof data?.symbolFile === "string" && data.symbolFile.trim()
      ? data.symbolFile.trim()
      : null,
    symbolsGeneratedAt: data?.symbolsGeneratedAt || data?.generatedAt || null,
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
      priceDate: price?.date || null,
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

function emptyDecisionAnalysis() {
  return {
    totalValue: 0,
    ledgerRowCount: state.assets.length,
    economicPositionCount: 0,
    top1Weight: 0,
    top5Weight: 0,
    hhi: 0,
    effectivePositionCount: 0,
    positions: [],
    reviews: { overdue: [], dueToday: [], upcoming: [], unscheduled: [], invalid: [] },
    quality: {
      valuedRowCount: 0,
      missingValueCount: state.assets.length,
      roleAssignedCount: 0,
      thesisCount: 0,
      reviewScheduledCount: 0,
      completeDecisionCount: 0
    },
    warnings: []
  };
}

function decisionRows() {
  return state.assets.map((asset) => {
    const profile = decisionProfileForAsset(asset);
    const value = assetValue(asset);
    return {
      id: asset.id,
      type: assetType(asset),
      ticker: asset.ticker,
      name: asset.name,
      account: asset.account || "",
      value,
      hasValue: value > 0,
      ...normalizeDecisionProfileFields(profile)
    };
  });
}

function allocationBucketKeyForAsset(asset) {
  return { KRX: "domestic", US: "overseas", CASH: "cash", MANUAL: "manual" }[assetType(asset)] || "manual";
}

function assetHasUsableValuation(asset) {
  const type = assetType(asset);
  if (isMarketType(type)) return !marketPriceMissing(asset) && Number.isFinite(assetValue(asset));
  return Number.isFinite(Number(asset.amount)) && Number(asset.amount) >= 0;
}

function actionSupportRows() {
  return state.assets.map((asset) => {
    const profile = decisionProfileForAsset(asset);
    return {
      id: asset.id,
      type: assetType(asset),
      ticker: asset.ticker,
      name: asset.name,
      account: asset.account || "",
      bucket: allocationBucketKeyForAsset(asset),
      value: assetValue(asset),
      hasValue: assetHasUsableValuation(asset),
      investmentRole: profile.investmentRole,
      conviction: profile.conviction,
      reviewStatus: profile.reviewStatus,
      nextReviewAt: profile.nextReviewAt,
      lastReviewedAt: profile.lastReviewedAt,
      thesis: profile.thesis,
      riskTags: normalizeRiskTags(profile.riskTags),
      migrationConflictCount: normalizeDecisionMigrationConflicts(profile.migrationConflicts).length
    };
  });
}

function analyzeDecisionPortfolio(todayKey = localDateInputValue()) {
  const engine = window.AssetTrailDecisionEngine;
  if (!engine?.analyzeDecisionPortfolio) return emptyDecisionAnalysis();
  return engine.analyzeDecisionPortfolio(decisionRows(), { todayKey });
}

function reviewTimingForProfile(profile, todayKey = localDateInputValue()) {
  const engine = window.AssetTrailDecisionEngine;
  if (engine?.reviewTiming) return engine.reviewTiming(profile, { todayKey });
  const reviewDate = normalizeDateKey(profile?.nextReviewAt);
  if (!reviewDate) return "unscheduled";
  if (reviewDate < todayKey) return "overdue";
  if (reviewDate === todayKey) return "dueToday";
  return "upcoming";
}

function roleLabel(profile) {
  return INVESTMENT_ROLE_LABELS[normalizeEnum(profile?.investmentRole, INVESTMENT_ROLE_LABELS, "UNASSIGNED")];
}

function decisionRoleBadge(profile) {
  const role = normalizeEnum(profile?.investmentRole, INVESTMENT_ROLE_LABELS, "UNASSIGNED");
  if (role === "UNASSIGNED") return "";
  return `<span class="role-badge decision-role-badge role-${escapeHtml(role.toLowerCase())}">${escapeHtml(INVESTMENT_ROLE_LABELS[role])}</span>`;
}

function decisionSelectOptions(labels, selected) {
  return Object.entries(labels)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

const DECISION_MIGRATION_SOURCE_LABELS = { asset: "보유 자산", watchlist: "관심종목", profile: "공유 프로필" };

function riskTagSummary(value) {
  return Object.entries(normalizeRiskTags(value))
    .filter(([, tags]) => tags.length)
    .map(([key, tags]) => `${RISK_TAG_DIMENSION_LABELS[key]}: ${tags.join(", ")}`)
    .join(" / ");
}

function riskTagEditorHtml(profile) {
  const riskTags = normalizeRiskTags(profile?.riskTags);
  const tagCount = Object.values(riskTags).reduce((sum, tags) => sum + tags.length, 0);
  const placeholders = {
    industry: "예: 반도체, 클라우드",
    country: "예: 한국, 미국, 중국",
    currency: "예: KRW, USD",
    rate: "예: 금리 상승 취약, 변동금리 수혜",
    duration: "예: 단기, 장기",
    customer: "예: 데이터센터, 스마트폰 제조사",
    aiValueChain: "예: AI 반도체, 클라우드, 응용 서비스"
  };
  return `
    <details class="risk-tag-editor"${tagCount ? " open" : ""}>
      <summary>수동 위험 태그${tagCount ? ` · ${tagCount}개` : ""}</summary>
      <fieldset>
        <legend class="sr-only">업종 국가 통화 금리 듀레이션 고객 AI 가치사슬 태그</legend>
        <p class="field-help">쉼표 또는 줄바꿈으로 구분합니다. 같은 종목을 보유한 모든 계좌가 이 태그를 공유합니다.</p>
        <div class="risk-tag-grid">
          ${Object.entries(RISK_TAG_DIMENSION_LABELS).map(([key, label]) => `
            <label>
              ${escapeHtml(label)}
              <textarea name="${escapeHtml(RISK_TAG_INPUT_NAMES[key])}" rows="2" maxlength="5000" placeholder="${escapeHtml(placeholders[key])}">${escapeHtml(riskTags[key].join(", "))}</textarea>
            </label>
          `).join("")}
        </div>
        <p class="field-help">각 태그는 연결된 포지션의 전체 평가금액으로 집계되며 여러 태그의 합계는 비가산입니다.</p>
      </fieldset>
    </details>
  `;
}

function decisionMigrationRecordHtml(conflict) {
  const fields = conflict.fields;
  const values = [
    ["역할", INVESTMENT_ROLE_LABELS[fields.investmentRole]],
    ["투자 기간", INVESTMENT_HORIZON_LABELS[fields.horizon]],
    ["확신도", CONVICTION_LABELS[fields.conviction]],
    ["검토 상태", REVIEW_STATUS_LABELS[fields.reviewStatus]],
    ["투자 가설", fields.thesis],
    ["기대수익 원천", fields.returnSource],
    ["관찰 KPI", fields.kpis],
    ["촉매", fields.catalysts],
    ["무효화 조건", fields.invalidation],
    ["감속 조건", fields.deceleration],
    ["다음 검토일", fields.nextReviewAt],
    ["마지막 검토일", fields.lastReviewedAt],
    ["수동 위험 태그", riskTagSummary(fields.riskTags)]
  ].filter(([, value]) => value && !["역할 미지정", "기간 미지정", "미설정"].includes(value));
  const sourceLabel = [conflict.sourceName, conflict.account, conflict.sourceId]
    .filter(Boolean)
    .join(" · ") || DECISION_MIGRATION_SOURCE_LABELS[conflict.sourceType];
  return `
    <article class="decision-migration-record">
      <strong>${escapeHtml(DECISION_MIGRATION_SOURCE_LABELS[conflict.sourceType])} · ${escapeHtml(sourceLabel)}</strong>
      ${values.length ? `<dl>${values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : "<p>기록된 판단 값이 없습니다.</p>"}
    </article>
  `;
}

function decisionMigrationConflictHtml(profile) {
  const conflicts = normalizeDecisionMigrationConflicts(profile?.migrationConflicts);
  if (!conflicts.length) return "";
  const cards = conflicts.map(decisionMigrationRecordHtml).join("");
  return `
    <aside class="decision-migration-warning" role="status">
      <strong>이전 계좌별 판단 ${conflicts.length}건이 서로 달랐습니다.</strong>
      <p>첫 기록을 현재값으로 표시했습니다. 아래 원본을 비교해 현재 기준을 정한 뒤 저장하면 이 충돌 표시가 해소됩니다.</p>
      <details>
        <summary>이전 판단 원본 보기</summary>
        <div class="decision-migration-records">${cards}</div>
      </details>
    </aside>
  `;
}

function existingDecisionProfileHtml(profile) {
  const current = decisionMigrationConflictFor("profile", profile, profile);
  return `
    <div class="watchlist-existing-decision">
      <aside class="decision-migration-warning" role="status">
        <strong>이 종목의 기존 판단 기록이 있습니다.</strong>
        <p>현재 작성 중인 초안은 유지했습니다. 아래 기존 기록을 확인한 뒤 다시 저장하면 초안 내용으로 갱신됩니다.</p>
        <details open>
          <summary>기존 판단 기록 보기</summary>
          <div class="decision-migration-records">${decisionMigrationRecordHtml(current)}</div>
        </details>
      </aside>
      ${decisionMigrationConflictHtml(profile)}
    </div>
  `;
}

function decisionCoverageLabel(analysis) {
  const total = analysis.ledgerRowCount || 0;
  const complete = analysis.quality?.completeDecisionCount || 0;
  return total ? `${complete}/${total}개 완성` : "자산 등록 대기";
}

function renderDecisionCenter() {
  if (!els.decisionMetrics || !els.economicPositionList || !els.watchlistList) return;
  const analysis = analyzeDecisionPortfolio();
  const topPosition = analysis.positions[0];
  const top1Name = topPosition?.name || "포지션 없음";
  const weightText = (weight) => `${(Number(weight || 0) * 100).toFixed(1)}%`;
  const hhiPoints = Math.round(Number(analysis.hhi || 0) * 10000);
  els.decisionMetrics.innerHTML = `
    <article class="decision-metric">
      <span>Top 1</span>
      <strong>${weightText(analysis.top1Weight)}</strong>
      <small>${escapeHtml(top1Name)}</small>
    </article>
    <article class="decision-metric">
      <span>Top 5</span>
      <strong>${weightText(analysis.top5Weight)}</strong>
      <small>상위 5개 경제적 포지션</small>
    </article>
    <article class="decision-metric">
      <span>HHI</span>
      <strong>${hhiPoints.toLocaleString("ko-KR")}</strong>
      <small>유효 포지션 ${Number(analysis.effectivePositionCount || 0).toFixed(1)}개</small>
    </article>
    <article class="decision-metric">
      <span>의사결정 데이터</span>
      <strong>${escapeHtml(decisionCoverageLabel(analysis))}</strong>
      <small>역할·가설·다음 검토일 기준</small>
    </article>
  `;
  const warnings = [...(analysis.warnings || [])];
  const migratedConflictCount = state.decisionProfiles.reduce(
    (sum, profile) => sum + normalizeDecisionMigrationConflicts(profile.migrationConflicts).length,
    0
  );
  if (migratedConflictCount) {
    warnings.unshift({
      severity: "medium",
      title: "이전 계좌별 판단이 서로 달랐습니다.",
      detail: `${migratedConflictCount}개 원본을 보존했습니다. 자산 상세 또는 관심종목 수정에서 비교하고 현재 기준을 저장하세요.`
    });
  }
  if (!window.AssetTrailDecisionEngine) {
    warnings.unshift({
      severity: "high",
      title: "집중도 엔진을 불러오지 못했습니다",
      detail: "페이지를 새로고침한 뒤 다시 확인하세요."
    });
  }
  els.decisionWarnings.innerHTML = warnings.length
    ? warnings.map((warning) => `
        <li class="decision-warning warning-${escapeHtml(warning.severity || "info")}">
          <strong>${escapeHtml(warning.title || "확인 필요")}</strong>
          <span>${escapeHtml(warning.detail || "")}</span>
        </li>
      `).join("")
    : `<li class="decision-warning decision-warning-ok"><strong>계산 데이터가 준비됐습니다</strong><span>현재 입력 기준으로 별도 품질 경고가 없습니다.</span></li>`;

  els.economicPositionList.innerHTML = analysis.positions.length
    ? analysis.positions.slice(0, 20).map((position) => {
        const assetId = position.assetIds?.[0] || "";
        const merged = position.assetIds?.length > 1 ? ` · ${position.assetIds.length}개 계좌 행 합산` : "";
        const content = `
          <span class="position-name"><strong>${escapeHtml(position.name || position.ticker || "이름 없음")}</strong><small>${escapeHtml(position.type || "")} ${escapeHtml(position.ticker || "")}${escapeHtml(merged)}</small></span>
          <span class="position-value"><strong>${money(position.value)}</strong><small>${weightText(position.weight)}</small></span>
        `;
        return assetId
          ? `<li><button class="economic-position" type="button" data-position-asset-id="${escapeHtml(assetId)}">${content}</button></li>`
          : `<li><div class="economic-position">${content}</div></li>`;
      }).join("")
    : `<li class="decision-empty">보유 자산을 등록하면 계좌를 합친 경제적 포지션이 표시됩니다.</li>`;

  renderWatchlist();
}

function renderWatchlist() {
  if (!els.watchlistList) return;
  const sorted = [...state.watchlist].sort((a, b) => {
    const aProfile = decisionProfileForWatchlist(a);
    const bProfile = decisionProfileForWatchlist(b);
    const rank = { overdue: 0, dueToday: 1, upcoming: 2, unscheduled: 3, invalid: 4 };
    return (rank[reviewTimingForProfile(aProfile)] ?? 5) - (rank[reviewTimingForProfile(bProfile)] ?? 5)
      || KO_COLLATOR.compare(a.name, b.name);
  });
  els.watchlistList.innerHTML = sorted.length
    ? sorted.map((item) => {
        const profile = decisionProfileForWatchlist(item);
        const timing = reviewTimingForProfile(profile);
        const reviewLabel = timing === "overdue"
          ? `검토기한 초과 · ${profile.nextReviewAt}`
          : timing === "dueToday"
            ? "오늘 검토"
            : profile.nextReviewAt
              ? `다음 검토 ${profile.nextReviewAt}`
              : "검토일 미설정";
        return `
          <article class="watchlist-card ${timing === "overdue" ? "review-overdue" : ""}" data-watchlist-id="${escapeHtml(item.id)}">
            <div class="watchlist-card-head">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span><b>${escapeHtml(item.ticker)}</b> · ${escapeHtml(item.type)} · ${escapeHtml(roleLabel(profile))}</span>
              </div>
              <span class="decision-status status-${escapeHtml(timing)}">${escapeHtml(reviewLabel)}</span>
            </div>
            <p>${profile.thesis ? escapeHtml(profile.thesis) : "투자 가설을 아직 작성하지 않았습니다."}</p>
            <div class="watchlist-actions watchlist-card-actions">
              <button class="ghost-button" type="button" data-watchlist-action="edit" data-id="${escapeHtml(item.id)}">수정</button>
              <button class="ghost-button danger-action" type="button" data-watchlist-action="delete" data-id="${escapeHtml(item.id)}">삭제</button>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="decision-empty">관심종목은 보유 자산과 별도로 관리됩니다. 검토하고 싶은 종목을 추가하세요.</div>`;
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
  return "현금·수동";
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

function readRetirementInputs() {
  return {
    currentAge: parseNumericValue(els.currentAge?.value),
    retireAge: parseNumericValue(els.retireAge?.value),
    lifeAge: parseNumericValue(els.lifeAge?.value),
    currentInvestable: parseNumericValue(els.currentInvestable?.value),
    monthlyInvest: parseNumericValue(els.monthlyInvest?.value),
    monthlySpend: parseNumericValue(els.monthlySpend?.value),
    inflationRate: parseNumericValue(els.inflationRate?.value),
    postReturnRate: parseNumericValue(els.postReturnRate?.value)
  };
}

function validateRetirementInput(input) {
  const fields = [
    "currentAge",
    "retireAge",
    "lifeAge",
    "currentInvestable",
    "monthlyInvest",
    "monthlySpend",
    "inflationRate",
    "postReturnRate"
  ];
  if (fields.some((field) => !Number.isFinite(Number(input?.[field])))) {
    return "은퇴 가정을 모두 숫자로 입력하세요.";
  }

  const currentAge = Number(input.currentAge);
  const retireAge = Number(input.retireAge);
  const lifeAge = Number(input.lifeAge);
  if (!Number.isInteger(currentAge) || currentAge < 0 || currentAge > 100) {
    return "현재 나이는 0~100세의 정수로 입력하세요.";
  }
  if (!Number.isInteger(retireAge) || retireAge < 1 || retireAge > 100) {
    return "은퇴 나이는 1~100세의 정수로 입력하세요.";
  }
  if (!Number.isInteger(lifeAge) || lifeAge < 1 || lifeAge > 120) {
    return "예상 수명은 1~120세의 정수로 입력하세요.";
  }
  if (retireAge < currentAge) return "은퇴 나이는 현재 나이보다 빠를 수 없습니다.";
  if (lifeAge <= retireAge) return "예상 수명은 은퇴 나이보다 커야 합니다.";
  if (Number(input.currentInvestable) < 0) return "현재 투자 가능 자산은 0원 이상이어야 합니다.";
  if (Number(input.monthlyInvest) < 0) return "매월 추가 투자금은 0원 이상이어야 합니다.";
  if (!(Number(input.monthlySpend) > 0)) return "은퇴 후 월 지출은 0원보다 커야 합니다.";
  if (Number(input.inflationRate) < 0 || Number(input.inflationRate) > 20) {
    return "물가상승률은 0~20% 범위로 입력하세요.";
  }
  if (Number(input.postReturnRate) < 0 || Number(input.postReturnRate) > 30) {
    return "은퇴 후 연수익률은 0~30% 범위로 입력하세요.";
  }
  return "";
}

function setRetirementValidation(message) {
  if (!els.retirementValidation) return;
  const hasError = Boolean(message);
  els.retirementValidation.textContent = message || "나이는 정수, 금액은 0원 이상, 물가상승률은 0~20%, 연수익률은 0~30%로 입력하세요.";
  els.retirementValidation.classList.toggle("warning", hasError);
  els.retirementForm?.setAttribute("aria-invalid", hasError ? "true" : "false");
}

function renderRetirementInputError(message) {
  setRetirementValidation(message);
  els.requiredNestEgg.textContent = "계산 불가";
  els.requiredSpendInfo.textContent = message;
  els.returnNoContrib.textContent = "계산 불가";
  els.returnWithContrib.textContent = "계산 불가";
  els.targetStatus.textContent = "입력 확인";
  els.targetStatus.className = "warning";
  els.targetStatusDetail.textContent = message;
  els.retireGap.textContent = "₩0";
  els.retireGapLabel.textContent = "계산 대기";
  renderRetirementProgress({ error: message });
  if (els.retirementSensitivity) els.retirementSensitivity.textContent = "";
}

function saveRetirementInputs() {
  const nextRetirement = readRetirementInputs();
  const error = validateRetirementInput(nextRetirement);
  if (error) {
    renderRetirementInputError(error);
    return false;
  }
  state.retirement = nextRetirement;
  setRetirementValidation("");
  return true;
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
    renderDecisionCenter();
  },
  JOURNAL: () => {
    renderJournal();
    renderRealized();
    renderLedger();
    renderInvestmentRecordTabs();
  },
  PORTFOLIO: () => {
    renderBreakdown();
    renderPortfolioBreakdownToggle();
    renderActionSupport();
  },
  GOALS: () => {
    renderHistory();
    renderRetirement();
    renderGoalMobilePanels();
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
  const persisted = persist();
  if (persisted && syncCloud && cloud.docRef) {
    scheduleCloudPush();
  }
  return persisted;
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
  if (typeof ctx.setTransform === "function") ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
          (task) => {
            const content = `<span class="check-icon kind-${escapeHtml(task.kind || "snapshot")}" aria-hidden="true">${CHECK_ICON_GLYPHS[task.kind] || "•"}</span><span class="check-text"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.detail)}</span></span>`;
            return task.action
              ? `<li class="check-card"><button class="check-action" type="button" data-dashboard-action="${escapeHtml(task.action)}"${task.assetId ? ` data-id="${escapeHtml(task.assetId)}"` : ""}>${content}</button></li>`
              : `<li class="check-card">${content}</li>`;
          }
        )
        .join("")
    : `<li class="check-card check-card-ok"><span class="check-icon kind-ok" aria-hidden="true">✓</span><div class="check-text"><strong>모두 정상이에요</strong><span>가격, 목표 비중, 복기 기록이 안정적인 상태예요.</span></div></li>`;

  const configured = retirementConfigured();
  if (els.dashboardGoalCard) els.dashboardGoalCard.classList.toggle("goal-unset", !configured);
  if (els.dashboardGoalGuide) els.dashboardGoalGuide.hidden = configured;

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

function retirementConfigured() {
  const defaults = defaultState().retirement;
  const current = state.retirement || {};
  return Object.keys(defaults).some((key) => Number(current[key]) !== Number(defaults[key]));
}

const PORTFOLIO_BUCKETS = [
  { key: "domestic", label: "국내", type: "KRX" },
  { key: "overseas", label: "해외", type: "US" },
  { key: "cash", label: "현금", type: "CASH" },
  { key: "manual", label: "수동", type: "MANUAL" }
];

function bucketTotals() {
  const totals = { domestic: 0, overseas: 0, cash: 0, manual: 0 };
  const keyByType = { KRX: "domestic", US: "overseas", CASH: "cash", MANUAL: "manual" };
  state.assets.forEach((asset) => {
    const key = keyByType[assetType(asset)];
    if (key) totals[key] += assetValue(asset);
  });
  return totals;
}

function renderDashboardComposition() {
  if (!els.dashboardComposition) return;
  const total = totalAssets();
  if (!state.assets.length || !total) {
    els.dashboardComposition.innerHTML = `<p class="dashboard-module-empty">자산을 등록하면 국내·해외·현금·수동 비중이 표시됩니다.</p>`;
    return;
  }

  const totals = bucketTotals();
  els.dashboardComposition.innerHTML = PORTFOLIO_BUCKETS
    .map((bucket) => {
      const value = totals[bucket.key];
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
  activeRealizedTrades().forEach((trade) => {
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
  const reviewSubjects = new Map();
  state.assets.forEach((asset) => {
    const subjectKey = decisionSubjectKeyForAsset(asset);
    if (!reviewSubjects.has(subjectKey)) {
      reviewSubjects.set(subjectKey, { asset, profile: decisionProfileForAsset(asset) });
    }
  });
  const overdueReviews = [...reviewSubjects.values()]
    .filter(({ profile }) => reviewTimingForProfile(profile) === "overdue")
    .sort((a, b) => a.profile.nextReviewAt.localeCompare(b.profile.nextReviewAt));
  if (overdueReviews.length) {
    const first = overdueReviews[0];
    tasks.push({
      kind: "review",
      action: "review-asset",
      assetId: first.asset.id,
      title: `검토기한 초과 자산 ${overdueReviews.length}개`,
      detail: `${first.asset.name}부터 투자 가설과 다음 행동을 확인하세요.`
    });
  }

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
  const current = bucketTotals();
  return PORTFOLIO_BUCKETS
    .map(({ key, label }) => {
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
    if (selected && !activeSection && section.querySelector("h1, h2, h3")) activeSection = section;
  });
  els.appNavButtons.forEach((button) => {
    const selected = button.dataset.navView === nextView;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  els.appNavItems.forEach((button) => {
    button.tabIndex = button.dataset.navView === nextView ? 0 : -1;
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
  if (nextView === "GOALS") {
    requestAnimationFrame(() => drawChart(filteredHistorySnapshots()));
  }
}

function rovingTargetIndex(event, items) {
  const currentIndex = Math.max(0, items.indexOf(event.currentTarget));
  if (event.key === "Home") return 0;
  if (event.key === "End") return items.length - 1;
  if (event.key === "ArrowRight") return (currentIndex + 1) % items.length;
  if (event.key === "ArrowLeft") return (currentIndex - 1 + items.length) % items.length;
  return -1;
}

function handleAppNavKeydown(event) {
  const targetIndex = rovingTargetIndex(event, els.appNavItems);
  if (targetIndex < 0) return;
  event.preventDefault();
  const target = els.appNavItems[targetIndex];
  setActiveView(target.dataset.navView, { scroll: true, updateHash: true });
  target.focus();
}

function renderGoalMobilePanels() {
  const active = uiState.goalMobilePanel === "RETIREMENT" ? "RETIREMENT" : "HISTORY";
  const historyWasHidden = els.historyPanel?.classList.contains("goal-panel-mobile-hidden");
  uiState.goalMobilePanel = active;
  els.goalMobileButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.goalMobilePanel === active));
  });
  els.historyPanel?.classList.toggle("goal-panel-mobile-hidden", active !== "HISTORY");
  els.retirementPanel?.classList.toggle("goal-panel-mobile-hidden", active !== "RETIREMENT");
  if (active === "HISTORY" && historyWasHidden) {
    requestAnimationFrame(() => drawChart(filteredHistorySnapshots()));
  }
}

function renderPortfolioBreakdownToggle() {
  if (!els.categoryBreakdown || !els.portfolioBreakdownToggle) return;
  const hasAdditionalSections = els.categoryBreakdown.querySelectorAll(".breakdown-section").length > 1;
  els.portfolioBreakdownToggle.hidden = !hasAdditionalSections;
  els.categoryBreakdown.classList.toggle("mobile-collapsed", !uiState.portfolioBreakdownExpanded);
  els.portfolioBreakdownToggle.setAttribute("aria-expanded", String(uiState.portfolioBreakdownExpanded));
  els.portfolioBreakdownToggle.textContent = uiState.portfolioBreakdownExpanded
    ? "첫 분석만 보기"
    : "나머지 분석 펼치기";
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
    const decisionProfile = decisionProfileForAsset(asset);
    const gain = assetGain(asset);
    const gainRate = gain === null ? null : gain / assetCost(asset);
    const valueDetail = assetValueDetail(asset);
    const buyButton = canBuyAsset(asset)
      ? `<button class="text-icon-button buy-action" type="button" title="추가매수" aria-label="${escapeHtml(asset.name)} 추가매수" data-action="buy" data-id="${escapeHtml(asset.id)}">추가매수</button>`
      : "";
    const sellButton = canSellAsset(asset)
      ? `<button class="text-icon-button" type="button" title="매도 기록" aria-label="${escapeHtml(asset.name)} 매도 기록" data-action="sell" data-id="${escapeHtml(asset.id)}">매도</button>`
      : "";
    const journalButton = `<button class="table-action quiet-action" type="button" title="일지 작성" aria-label="${escapeHtml(asset.name)} 일지 작성" data-action="journal" data-id="${escapeHtml(asset.id)}">일지</button>`;
    const row = document.createElement("tr");
    row.dataset.id = asset.id;
    const gainArrow = gain > 0 ? "▲ " : gain < 0 ? "▼ " : "";
    row.innerHTML = `
      <td class="asset-cell">
        <strong>${escapeHtml(asset.name)}</strong>
        <span class="asset-sub">
          ${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}
          <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
          ${decisionRoleBadge(decisionProfile)}
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
          <button class="table-action quiet-action" type="button" title="상세 · 수정 · 삭제" aria-label="${escapeHtml(asset.name)} 상세" data-action="detail" data-id="${escapeHtml(asset.id)}">상세</button>
        </div>
      </td>
    `;
    els.assetRows.append(row);
    renderAssetCard(asset, decisionProfile, gain, gainRate, valueDetail, buyButton, sellButton, journalButton);
  });
}

function renderAssetCard(asset, decisionProfile, gain, gainRate, valueDetail, buyButton, sellButton, journalButton) {
  if (!els.assetCards) return;
  const type = assetType(asset);
  const gainTone = gain > 0 ? "positive" : gain < 0 ? "negative" : "";
  const card = document.createElement("article");
  card.className = "asset-card";
  card.dataset.id = asset.id;
  const gainText = gain === null
    ? ""
    : `${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`;
  const metaParts = [];
  if (asset.ticker) metaParts.push(`<span><b>${escapeHtml(asset.ticker)}</b></span>`);
  if (asset.quantity) metaParts.push(`<span>수량 ${formatPlainNumber(asset.quantity)}</span>`);
  card.innerHTML = `
    <div class="asset-card-head">
      <div>
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(asset.account || "계좌 미지정")}</span>
      </div>
      <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
    </div>
    <div class="asset-card-value">
      <div class="asset-card-value-row">
        <strong>${money(assetValue(asset))}</strong>
        ${gainText ? `<span class="asset-card-gain ${gainTone}">${gainText}</span>` : ""}
      </div>
      ${valueDetail}
    </div>
    ${decisionProfile.investmentRole !== "UNASSIGNED" || metaParts.length ? `<div class="asset-card-meta">${decisionRoleBadge(decisionProfile)}${metaParts.join("")}</div>` : ""}
    ${asset.note ? `<p class="asset-card-note">${escapeHtml(asset.note)}</p>` : ""}
    <div class="asset-card-actions">
      ${isMarketType(type) ? `${buyButton}${sellButton}` : ""}
      ${journalButton}
      <button class="table-action quiet-action" type="button" data-action="detail" data-id="${escapeHtml(asset.id)}">상세</button>
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
  const profile = decisionProfileForAsset(asset);

  const haystack = [
    asset.name,
    asset.account,
    asset.ticker,
    asset.note,
    profile.investmentRole,
    roleLabel(profile),
    profile.thesis,
    profile.returnSource,
    profile.kpis,
    profile.catalysts,
    profile.invalidation,
    profile.deceleration,
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

function heldMarketPriceFreshness() {
  const stale = [];
  const undated = [];
  state.assets
    .map(normalizeAsset)
    .filter((asset) => isMarketType(assetType(asset)) && Number(asset.quantity || 0) > 0)
    .forEach((asset) => {
      const price = priceForAsset(asset);
      if (!price) return;
      const age = daysSince(price.date);
      if (!Number.isFinite(age)) {
        undated.push(asset);
      } else if (age > PRICE_STALE_DAYS) {
        stale.push({ age, asset });
      }
    });
  return { stale, undated };
}

function latestMarketPriceDate() {
  const timestamps = ["KRX", "US"]
    .flatMap((type) => Object.values(priceBook.prices[type] || {}))
    .map((price) => toDate(price?.date)?.getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function snapshotReadiness() {
  if (!state.assets.length) {
    return { ok: false, message: "조회 기록을 저장하려면 자산을 먼저 등록하세요.", warnings: [] };
  }
  if (!priceBook.loaded) {
    return {
      ok: false,
      message: "가격표를 아직 불러오지 못했습니다. 설정에서 최신 가격을 확인한 뒤 다시 저장하세요.",
      warnings: []
    };
  }

  const heldMarketAssets = state.assets.filter((asset) =>
    isMarketType(assetType(asset)) && Number(asset.quantity || 0) > 0
  );
  const missing = heldMarketAssets.filter((asset) => marketPriceMissing(asset));
  const hasUsAssets = heldMarketAssets.some((asset) => assetType(asset) === "US");
  const issues = [];

  if (missing.length) {
    const labels = missing.map((asset) => {
      const type = assetType(asset);
      return `${asset.name || normalizeTicker(type, asset.ticker)} (${type}:${normalizeTicker(type, asset.ticker)})`;
    });
    issues.push(`가격이 없는 보유 자산: ${labels.join(", ")}`);
  }
  if (hasUsAssets && !(usdKrwRate() > 0)) {
    issues.push("미국 자산 평가에 필요한 USD/KRW 환율이 없습니다.");
  }
  if (issues.length) {
    return {
      ok: false,
      message: `${issues.join(" ")} 정확한 총자산을 계산할 수 없어 조회 기록을 저장하지 않았습니다.`,
      warnings: []
    };
  }

  const warnings = [];
  const freshness = heldMarketPriceFreshness();
  if (freshness.stale.length) {
    const oldestDays = Math.max(...freshness.stale.map((item) => item.age));
    warnings.push(`보유 종목 종가 ${freshness.stale.length}개가 최대 ${Math.floor(oldestDays)}일 전 기준입니다.`);
  }
  if (freshness.undated.length) {
    warnings.push(`보유 종목 종가 ${freshness.undated.length}개의 기준일을 확인할 수 없습니다.`);
  }
  const fxDays = daysSince(priceBook.fx?.USDKRW?.date);
  if (hasUsAssets && Number.isFinite(fxDays) && fxDays > PRICE_STALE_DAYS) {
    warnings.push(`환율이 ${Math.floor(fxDays)}일 전 기준입니다.`);
  }
  return { ok: true, message: "", warnings };
}

function renderPriceNotice() {
  if (!els.priceAlert) return;

  const missing = [...new Set(marketAssetsMissingPrices())].filter((item) => !item.endsWith(":"));
  const errors = Array.isArray(priceBook.errors) ? priceBook.errors : [];
  const freshness = heldMarketPriceFreshness();
  const fxDays = daysSince(priceBook.fx?.USDKRW?.date);
  const isFxStale = Number.isFinite(fxDays) && fxDays > PRICE_STALE_DAYS;

  if (!missing.length && !errors.length && !freshness.stale.length && !freshness.undated.length && !isFxStale) {
    els.priceAlert.hidden = true;
    els.priceAlert.textContent = "";
    renderOpsStatus();
    return;
  }

  const parts = [];
  if (freshness.stale.length) {
    const oldestDays = Math.max(...freshness.stale.map((item) => item.age));
    parts.push(`보유 종목 종가 ${freshness.stale.length}개가 최대 ${Math.floor(oldestDays)}일 전 기준입니다.`);
  }
  if (freshness.undated.length) {
    parts.push(`보유 종목 종가 ${freshness.undated.length}개의 기준일을 확인할 수 없습니다.`);
  }
  if (isFxStale) parts.push(`환율이 ${Math.floor(fxDays)}일 전 기준입니다.`);
  if (missing.length) {
    const krxMissing = missing.filter((item) => item.startsWith("KRX:"));
    const usMissing = missing.filter((item) => item.startsWith("US:"));
    if (krxMissing.length) parts.push(`KRX 가격 대기: ${krxMissing.join(", ")}. 다음 가격표 업데이트 후 다시 확인하세요.`);
    if (usMissing.length) parts.push(`US 가격 대기: ${usMissing.join(", ")}. 운영자가 tickers.json에 추가한 뒤 가격표를 다시 생성해야 합니다.`);
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
  const latestPriceDate = latestMarketPriceDate();
  const staleDays = daysSince(latestPriceDate);
  const fxDays = daysSince(fx?.date);
  const hasIssues = errorCount > 0
    || !priceBook.generatedAt
    || !latestPriceDate
    || (Number.isFinite(staleDays) && staleDays > PRICE_STALE_DAYS)
    || !fx?.rate
    || (Number.isFinite(fxDays) && fxDays > PRICE_STALE_DAYS);
  const items = [
    `가격표 ${priceBook.generatedAt ? shortDateTime(priceBook.generatedAt) : "생성일 없음"}`,
    `최근 종가 ${latestPriceDate ? shortDate(latestPriceDate) : "기준일 없음"}`,
    `오류 ${errorCount}건`,
    fx?.rate ? `환율 ${formatPlainNumber(fx.rate)}원${fx.date ? ` · ${shortDate(fx.date)}` : ""}` : "환율 없음"
  ];
  els.opsStatus.hidden = false;
  els.opsStatus.classList.toggle("has-issues", hasIssues);
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
  const bands = normalizePolicyProfile(state.policyProfile, targets).allocationBands;
  if (els.targetDomestic) els.targetDomestic.value = targets.domestic ?? 50;
  if (els.targetOverseas) els.targetOverseas.value = targets.overseas ?? 30;
  if (els.targetCash) els.targetCash.value = targets.cash ?? 10;
  if (els.targetManual) els.targetManual.value = targets.manual ?? 10;
  if (els.bandDomesticMin) els.bandDomesticMin.value = bands.domestic.minPct;
  if (els.bandDomesticMax) els.bandDomesticMax.value = bands.domestic.maxPct;
  if (els.bandOverseasMin) els.bandOverseasMin.value = bands.overseas.minPct;
  if (els.bandOverseasMax) els.bandOverseasMax.value = bands.overseas.maxPct;
  if (els.bandCashMin) els.bandCashMin.value = bands.cash.minPct;
  if (els.bandCashMax) els.bandCashMax.value = bands.cash.maxPct;
  if (els.bandManualMin) els.bandManualMin.value = bands.manual.minPct;
  if (els.bandManualMax) els.bandManualMax.value = bands.manual.maxPct;
  setTargetValidation("");
}

function allocationBandInputs() {
  return {
    domestic: { min: els.bandDomesticMin, target: els.targetDomestic, max: els.bandDomesticMax },
    overseas: { min: els.bandOverseasMin, target: els.targetOverseas, max: els.bandOverseasMax },
    cash: { min: els.bandCashMin, target: els.targetCash, max: els.bandCashMax },
    manual: { min: els.bandManualMin, target: els.targetManual, max: els.bandManualMax }
  };
}

function hydrateActionSupportInputs() {
  const contributionPlan = normalizeContributionPlan(state.contributionPlan);
  if (els.contributionAmount) els.contributionAmount.value = formatIntegerNumber(contributionPlan.amount);
  els.contributionModeInputs.forEach((input) => {
    input.checked = input.value === contributionPlan.mode;
  });
  const budgets = normalizeRiskBudgets(state.policyProfile?.riskBudgets);
  if (els.riskBudgetCoreMin) els.riskBudgetCoreMin.value = budgets.coreMinPct;
  if (els.riskBudgetSatelliteMax) els.riskBudgetSatelliteMax.value = budgets.satelliteMaxPct;
  if (els.riskBudgetAiMax) els.riskBudgetAiMax.value = budgets.aiStructuralMaxPct;
  if (els.riskBudgetCycleMax) els.riskBudgetCycleMax.value = budgets.cycleMaxPct;
  setContributionValidation("");
  setRiskBudgetValidation("");
}

function setTargetValidation(message) {
  if (!els.targetValidation) return;
  const hasError = Boolean(message);
  els.targetValidation.textContent = message || "각 행은 최소≤목표≤최대, 목표 합계는 100%로 입력하세요.";
  els.targetValidation.classList.toggle("warning", hasError);
  Object.values(allocationBandInputs()).flatMap((band) => Object.values(band)).forEach((input) => {
    input?.setAttribute("aria-invalid", hasError ? "true" : "false");
  });
}

function savePortfolioTargets() {
  const nextBands = Object.fromEntries(Object.entries(allocationBandInputs()).map(([key, inputs]) => [key, {
    minPct: parseNumericValue(inputs.min?.value),
    targetPct: parseNumericValue(inputs.target?.value),
    maxPct: parseNumericValue(inputs.max?.value)
  }]));
  const values = Object.values(nextBands).flatMap((band) => Object.values(band));
  if (values.some((value) => !Number.isFinite(value))) {
    setTargetValidation("최소·목표·최대 비중을 모두 숫자로 입력하세요.");
    return false;
  }
  if (values.some((value) => value < 0 || value > 100)) {
    setTargetValidation("비중은 각각 0% 이상 100% 이하로 입력하세요.");
    return false;
  }
  const invalidBand = Object.entries(nextBands).find(([, band]) => band.minPct > band.targetPct || band.targetPct > band.maxPct);
  if (invalidBand) {
    const label = PORTFOLIO_BUCKETS.find((bucket) => bucket.key === invalidBand[0])?.label || invalidBand[0];
    setTargetValidation(`${label} 비중은 최소≤목표≤최대 순서로 입력하세요.`);
    return false;
  }
  const targetTotal = Object.values(nextBands).reduce((sum, band) => sum + band.targetPct, 0);
  if (Math.abs(targetTotal - 100) > PERCENT_TARGET_TOLERANCE) {
    setTargetValidation(`현재 합계는 ${Number(targetTotal.toFixed(2))}%입니다. 목표 합계를 100%로 맞춰주세요.`);
    return false;
  }
  const minTotal = Object.values(nextBands).reduce((sum, band) => sum + band.minPct, 0);
  if (minTotal > 100 + PERCENT_CONSTRAINT_EPSILON) {
    setTargetValidation(`최소 비중 합계가 ${Number(minTotal.toFixed(2))}%입니다. 100% 이하로 맞춰주세요.`);
    return false;
  }
  const maxTotal = Object.values(nextBands).reduce((sum, band) => sum + band.maxPct, 0);
  if (maxTotal < 100 - PERCENT_CONSTRAINT_EPSILON) {
    setTargetValidation(`최대 비중 합계가 ${Number(maxTotal.toFixed(2))}%입니다. 100% 이상이어야 합니다.`);
    return false;
  }
  const nextTargets = Object.fromEntries(Object.entries(nextBands).map(([key, band]) => [key, band.targetPct]));
  state.portfolioTargets = nextTargets;
  state.policyProfile = {
    ...normalizePolicyProfile(state.policyProfile, nextTargets),
    allocationBands: nextBands
  };
  setTargetValidation("");
  return true;
}

function setContributionValidation(message, { invalid = Boolean(message) } = {}) {
  if (!els.contributionValidation) return;
  els.contributionValidation.textContent = message || "1원 이상 금액을 입력하면 자산군별 검토 예산을 계산합니다.";
  els.contributionValidation.classList.toggle("warning", invalid);
  els.contributionAmount?.setAttribute("aria-invalid", invalid ? "true" : "false");
}

function selectedContributionMode() {
  const selected = els.contributionModeInputs.find((input) => input.checked)?.value || "ONE_TIME";
  return CONTRIBUTION_MODES.has(selected) ? selected : "ONE_TIME";
}

function saveContributionPlan() {
  const amount = parseAmount(els.contributionAmount?.value || "0");
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e15) {
    setContributionValidation("신규자금은 1원 단위 정수로 1원 이상 1,000조원 이하까지 입력하세요.");
    els.contributionAmount?.focus();
    return false;
  }
  state.contributionPlan = normalizeContributionPlan({
    mode: selectedContributionMode(),
    amount
  });
  if (els.contributionAmount) els.contributionAmount.value = formatIntegerNumber(state.contributionPlan.amount);
  setContributionValidation("");
  return true;
}

function setRiskBudgetValidation(message, { invalid = Boolean(message) } = {}) {
  if (!els.riskBudgetValidation) return;
  els.riskBudgetValidation.textContent = message
    || "각 기준은 0~100%로 입력하세요. AI·사이클은 위성 자산과 중복되는 오버레이입니다.";
  els.riskBudgetValidation.classList.toggle("warning", invalid);
  [
    els.riskBudgetCoreMin,
    els.riskBudgetSatelliteMax,
    els.riskBudgetAiMax,
    els.riskBudgetCycleMax
  ].forEach((input) => input?.setAttribute("aria-invalid", invalid ? "true" : "false"));
}

function saveRiskBudgets() {
  const riskBudgets = {
    coreMinPct: parseNumericValue(els.riskBudgetCoreMin?.value),
    satelliteMaxPct: parseNumericValue(els.riskBudgetSatelliteMax?.value),
    aiStructuralMaxPct: parseNumericValue(els.riskBudgetAiMax?.value),
    cycleMaxPct: parseNumericValue(els.riskBudgetCycleMax?.value)
  };
  const invalidEntry = Object.entries(riskBudgets).find(([, value]) => !Number.isFinite(value) || value < 0 || value > 100);
  if (invalidEntry) {
    setRiskBudgetValidation("위험예산 기준은 각각 0% 이상 100% 이하로 입력하세요.");
    ({
      coreMinPct: els.riskBudgetCoreMin,
      satelliteMaxPct: els.riskBudgetSatelliteMax,
      aiStructuralMaxPct: els.riskBudgetAiMax,
      cycleMaxPct: els.riskBudgetCycleMax
    })[invalidEntry[0]]?.focus();
    return false;
  }
  state.policyProfile = {
    ...normalizePolicyProfile(state.policyProfile, state.portfolioTargets),
    riskBudgets
  };
  setRiskBudgetValidation("");
  return true;
}

function renderRebalanceSummary() {
  if (!els.rebalanceSummary) return;
  const total = totalAssets();
  if (!total) {
    els.rebalanceSummary.innerHTML = `<div class="empty small-empty">목표 비중은 자산 등록 후 비교됩니다.</div>`;
    return;
  }

  const totals = bucketTotals();
  els.rebalanceSummary.innerHTML = PORTFOLIO_BUCKETS.map((bucket) => {
    const value = totals[bucket.key];
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

function allocationBucketsForEngine(riskAnalysis) {
  const bands = normalizePolicyProfile(state.policyProfile, state.portfolioTargets).allocationBands;
  const totals = bucketTotals();
  const positionStats = Object.fromEntries(ALLOCATION_BUCKET_KEYS.map((key) => [key, {
    positionCount: 0,
    reviewRequiredCount: 0
  }]));
  (riskAnalysis?.positions || []).forEach((position) => {
    const key = { KRX: "domestic", US: "overseas", CASH: "cash", MANUAL: "manual" }[position.type] || "manual";
    positionStats[key].positionCount += 1;
    if (position.reviewRequired) positionStats[key].reviewRequiredCount += 1;
  });
  return Object.fromEntries(ALLOCATION_BUCKET_KEYS.map((key) => [key, {
    currentValue: Math.max(0, Number(totals[key] || 0)),
    ...bands[key],
    ...positionStats[key]
  }]));
}

function contributionModeLabel(mode) {
  return mode === "MONTHLY" ? "월 정기" : "일회성";
}

function renderContributionResult(riskAnalysis) {
  if (!els.contributionResult || !els.contributionResultStatus) return;
  const plan = normalizeContributionPlan(state.contributionPlan);
  if (!plan.amount) {
    els.contributionResultStatus.textContent = "금액 입력 대기";
    els.contributionResult.innerHTML = `<p class="decision-empty">신규자금과 비중 밴드를 입력하면 현재 비중, 배분액과 배분 후 비중을 비교합니다.</p>`;
    return;
  }
  const missingValueCount = Math.max(0, Number(riskAnalysis?.quality?.missingValuePositionCount || 0));
  if (missingValueCount > 0) {
    els.contributionResultStatus.textContent = "평가금액 확인 필요";
    els.contributionResult.innerHTML = `
      <div class="allocation-failure" role="alert">
        <strong>평가금액이 확인되지 않은 시장 자산이 ${missingValueCount}개 있습니다.</strong>
        <p>가격표가 준비된 뒤 다시 계산하세요. 불완전한 총자산으로 배분안을 만들지 않았습니다.</p>
      </div>
    `;
    return;
  }
  const engine = window.AssetTrailActionEngine;
  if (!engine?.planContribution) {
    els.contributionResultStatus.textContent = "계산 엔진 오류";
    els.contributionResult.innerHTML = `<div class="allocation-failure" role="alert"><strong>행동 지원 계산 엔진을 불러오지 못했습니다.</strong><p>페이지를 새로고침한 뒤 다시 확인하세요.</p></div>`;
    return;
  }
  const result = engine.planContribution({
    mode: plan.mode,
    amount: plan.amount,
    buckets: allocationBucketsForEngine(riskAnalysis)
  });
  if (!result.ok) {
    els.contributionResultStatus.textContent = "배분 불가";
    els.contributionResult.innerHTML = `
      <div class="allocation-failure" role="alert">
        <strong>현재 조건으로는 신규자금 전액을 안전하게 배분할 수 없습니다.</strong>
        <p>${escapeHtml(result.message || "비중 밴드와 현재 평가금액을 확인하세요.")}</p>
        <small>부분 금액을 임의로 제안하지 않았습니다. 최소·최대 비중 또는 신규자금 금액을 조정하세요.</small>
      </div>
    `;
    return;
  }
  const bucketLabels = Object.fromEntries(PORTFOLIO_BUCKETS.map((bucket) => [bucket.key, bucket.label]));
  const allocations = (result.allocations || []).map((allocation) => `
    <article class="allocation-result-card ${allocation.reviewRequired && allocation.amount > 0 ? "needs-review" : ""}">
      <div class="allocation-result-title">
        <div><span>${escapeHtml(bucketLabels[allocation.key] || allocation.key)}</span><strong>${escapeHtml(money(allocation.amount))}</strong></div>
        <span>${(Number(allocation.currentWeight || 0) * 100).toFixed(1)}% → ${(Number(allocation.projectedWeight || 0) * 100).toFixed(1)}%</span>
      </div>
      <div class="allocation-band-track" role="img" aria-label="${escapeHtml(bucketLabels[allocation.key] || allocation.key)} 배분 후 ${(Number(allocation.projectedWeight || 0) * 100).toFixed(1)}%, 최소 ${allocation.minPct}%, 목표 ${allocation.targetPct}%, 최대 ${allocation.maxPct}%">
        <span class="allocation-band-range" style="left:${Math.max(0, Number(allocation.minPct || 0))}%;width:${Math.max(0, Number(allocation.maxPct || 0) - Number(allocation.minPct || 0))}%"></span>
        <span class="allocation-band-target" style="left:${Math.max(0, Math.min(100, Number(allocation.targetPct || 0)))}%"></span>
        <span class="allocation-band-current" style="left:${Math.max(0, Math.min(100, Number(allocation.projectedWeight || 0) * 100))}%"></span>
      </div>
      <p>${escapeHtml((allocation.reasons || []).join(" · "))}</p>
      ${allocation.reviewRequired && allocation.amount > 0
        ? `<small class="allocation-review-note">이 자산군에 검토가 필요한 포지션 ${allocation.reviewRequiredCount}개가 있습니다. 종목 선택 전에 가설과 검토 상태를 확인하세요.</small>`
        : ""}
    </article>
  `).join("");
  els.contributionResultStatus.textContent = `${contributionModeLabel(plan.mode)} · ${money(result.totalAllocated)} 배분`;
  els.contributionResult.innerHTML = `
    <div class="allocation-result-summary">
      <span>신규자금</span><strong>${escapeHtml(money(result.amount))}</strong>
      <span>배분 후 총자산</span><strong>${escapeHtml(money(result.projectedTotal))}</strong>
    </div>
    <div class="allocation-result-list">${allocations}</div>
    ${(result.warnings || []).length ? `<div class="allocation-warning"><strong>종목 선택 전 검토 필요</strong><p>${escapeHtml(result.warnings.map((warning) => warning.message).join(" "))}</p></div>` : ""}
  `;
}

function riskBudgetDisplayLabel(key) {
  return {
    core: "코어",
    satellite: "위성",
    aiStructural: "AI 구조적 성장",
    cycle: "사이클"
  }[key] || key;
}

function renderRiskExposure(riskAnalysis) {
  if (!els.riskBudgetSummary || !els.riskExposureWarnings || !els.manualExposureMap) return;
  if (!riskAnalysis) {
    els.riskBudgetSummary.innerHTML = `<p class="decision-empty">위험 노출 계산 엔진을 불러오지 못했습니다.</p>`;
    els.riskExposureWarnings.innerHTML = "";
    els.manualExposureMap.innerHTML = "";
    return;
  }
  els.riskBudgetSummary.innerHTML = Object.entries(riskAnalysis.budgets || {}).map(([key, budget]) => {
    const actualPct = Math.max(0, Number(budget.actualPct || 0));
    const limitPct = Number(budget.limitPct);
    const statusText = budget.status === "BREACHED"
      ? budget.rule === "MIN" ? "최소 미달" : "최대 초과"
      : budget.status === "NO_DATA" ? "평가 대기"
        : budget.status === "UNSET" || budget.status === "INVALID" ? "기준 미설정"
          : "예산 범위";
    const limitText = Number.isFinite(limitPct)
      ? `${budget.rule === "MIN" ? "최소" : "최대"} ${limitPct}%`
      : "기준 없음";
    return `
      <article class="risk-budget-card ${budget.status === "BREACHED" ? "budget-breached" : ""}">
        <div><span>${escapeHtml(riskBudgetDisplayLabel(key))}${["aiStructural", "cycle"].includes(key) ? " · 오버레이" : ""}</span><strong>${actualPct.toFixed(1)}%</strong></div>
        <meter min="0" max="100" value="${Math.min(100, actualPct)}" aria-label="${escapeHtml(riskBudgetDisplayLabel(key))} 현재 ${actualPct.toFixed(1)}%, ${escapeHtml(limitText)}"></meter>
        <p>${escapeHtml(statusText)} · ${escapeHtml(limitText)} · ${escapeHtml(money(budget.actualValue))}</p>
      </article>
    `;
  }).join("");
  const warningItems = (riskAnalysis.warnings || []).filter((warning) => warning.code !== "NON_ADDITIVE_TAGS");
  els.riskExposureWarnings.innerHTML = warningItems.length
    ? warningItems.map((warning) => `
        <li class="decision-warning warning-${warning.code === "RISK_BUDGET_BREACH" ? "medium" : "low"}">
          <strong>${escapeHtml(warning.code === "RISK_BUDGET_BREACH" ? "위험예산 확인" : "데이터 품질 확인")}</strong>
          <span>${escapeHtml(warning.message || "입력값을 확인하세요.")}</span>
        </li>
      `).join("")
    : `<li class="decision-warning decision-warning-ok"><strong>위험 지도 데이터가 준비됐습니다</strong><span>현재 입력 기준으로 별도 품질 경고가 없습니다.</span></li>`;

  const grouped = new Map();
  (riskAnalysis.tagExposures || []).forEach((exposure) => {
    if (!grouped.has(exposure.dimension)) grouped.set(exposure.dimension, []);
    grouped.get(exposure.dimension).push(exposure);
  });
  const sections = Object.entries(RISK_TAG_DIMENSION_LABELS).map(([dimension, label]) => {
    const exposures = (grouped.get(dimension) || []).sort((a, b) => b.value - a.value || String(a.tag).localeCompare(String(b.tag), "ko-KR"));
    if (!exposures.length) return "";
    return `
      <section class="exposure-dimension-card">
        <div class="exposure-dimension-head"><h4>${escapeHtml(label)}</h4><span>${exposures.length}개 태그</span></div>
        <div class="exposure-tag-list">
          ${exposures.map((exposure) => `
            <div class="exposure-tag-row">
              <div><strong>${escapeHtml(exposure.tag)}</strong><span>${exposure.positionCount}개 경제적 포지션</span></div>
              <div><strong>${escapeHtml(money(exposure.value))}</strong><span>${(Number(exposure.weight || 0) * 100).toFixed(1)}%</span></div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }).filter(Boolean).join("");
  els.manualExposureMap.innerHTML = sections || `
    <div class="decision-empty exposure-empty">
      <strong>아직 수동 위험 태그가 없습니다.</strong>
      <p>자산 상세의 투자 의사결정에서 태그를 추가하면 ${riskAnalysis.economicPositionCount || 0}개 경제적 포지션의 공통 노출을 확인할 수 있습니다.</p>
    </div>
  `;
}

function renderActionSupport() {
  const engine = window.AssetTrailActionEngine;
  const riskAnalysis = engine?.analyzeRiskExposure
    ? engine.analyzeRiskExposure(actionSupportRows(), state.policyProfile?.riskBudgets, {
        todayKey: localDateInputValue(),
        staleDays: 180
      })
    : null;
  renderContributionResult(riskAnalysis);
  renderRiskExposure(riskAnalysis);
}

function renderInvestmentRecordTabs() {
  const active = ["JOURNAL", "REALIZED", "LEDGER"].includes(uiState.investmentRecordTab)
    ? uiState.investmentRecordTab
    : "JOURNAL";
  uiState.investmentRecordTab = active;
  const tabPairs = [
    ["JOURNAL", els.investmentJournalTab, els.journalTabPanel],
    ["REALIZED", els.investmentRealizedTab, els.realizedTabPanel],
    ["LEDGER", els.investmentLedgerTab, els.ledgerTabPanel]
  ];

  tabPairs.forEach(([tab, button, panel]) => {
    const selected = tab === active;
    button?.classList.toggle("active", selected);
    button?.setAttribute("aria-selected", String(selected));
    if (button) button.tabIndex = selected ? 0 : -1;
    if (panel) panel.hidden = !selected;
  });

  if (els.journalTabCount) els.journalTabCount.textContent = `${state.tradeJournalEntries.length}건`;
  if (els.realizedTabCount) els.realizedTabCount.textContent = `${activeRealizedTrades().length}건`;
  if (els.ledgerTabCount) els.ledgerTabCount.textContent = `${state.events.length}건`;
}

function activeRealizedTrades() {
  return (state.realizedTrades || []).filter((trade) => !trade.cancelledAt);
}

function setInvestmentRecordTab(tab, { scroll = false } = {}) {
  if (!["JOURNAL", "REALIZED", "LEDGER"].includes(tab)) return;
  uiState.investmentRecordTab = tab;
  renderInvestmentRecordTabs();
  if (scroll) {
    const panel = tab === "REALIZED"
      ? els.realizedTabPanel
      : tab === "LEDGER"
        ? els.ledgerTabPanel
        : els.journalTabPanel;
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
}

function handleInvestmentTabKeydown(event) {
  const items = [els.investmentJournalTab, els.investmentRealizedTab, els.investmentLedgerTab].filter(Boolean);
  const targetIndex = rovingTargetIndex(event, items);
  if (targetIndex < 0) return;
  event.preventDefault();
  const target = items[targetIndex];
  setInvestmentRecordTab(target.dataset.investmentTab);
  target.focus();
}

function ledgerIntegrityIssue(code, message, details = {}) {
  return { code, message, ...details };
}

function ledgerReferenceErrors(events, assets, realizedTrades = [], tradeJournalEntries = [], auditTrail = {}) {
  const errors = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  const cancelledEventIds = new Set((auditTrail.cancellations || []).map((item) => item.targetEventId));
  const supersededEventIds = new Set(auditTrail.supersededEventIds || []);
  const assetEventTypes = new Set(["BUY", "SELL", "DIVIDEND", "SPLIT", "VALUATION"]);
  const cashEventTypes = new Set(["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX", "FX"]);

  function requireAsset(event, assetId, expectedType, field = "assetId") {
    const asset = assetsById.get(assetId);
    if (!asset) {
      errors.push(ledgerIntegrityIssue(
        "LEDGER_ASSET_NOT_FOUND",
        `이벤트 ${event.eventId}의 ${field}(${assetId || "없음"})가 자산 목록에 없습니다.`,
        { eventId: event.eventId, field, assetId }
      ));
      return null;
    }
    const type = assetType(asset);
    if (expectedType === "MARKET" && !isMarketType(type)) {
      errors.push(ledgerIntegrityIssue("LEDGER_ASSET_TYPE_MISMATCH", `이벤트 ${event.eventId}는 KRX/US 자산을 참조해야 합니다.`, { eventId: event.eventId, assetId }));
    }
    if (expectedType && expectedType !== "MARKET" && type !== expectedType) {
      errors.push(ledgerIntegrityIssue("LEDGER_ASSET_TYPE_MISMATCH", `이벤트 ${event.eventId}의 ${field}는 ${expectedType} 자산이어야 합니다.`, { eventId: event.eventId, assetId }));
    }
    return asset;
  }

  events.forEach((event) => {
    if (supersededEventIds.has(event.eventId)) return;
    let expectedAssetType = null;
    if (["BUY", "SELL", "DIVIDEND", "SPLIT"].includes(event.type)) expectedAssetType = "MARKET";
    if (event.type === "VALUATION") expectedAssetType = "MANUAL";
    if (event.type === "OPENING_BALANCE") {
      if (event.balanceKind === "POSITION") expectedAssetType = "MARKET";
      if (event.balanceKind === "VALUATION") expectedAssetType = "MANUAL";
    }
    if (assetEventTypes.has(event.type) || expectedAssetType) {
      const asset = requireAsset(event, event.assetId, expectedAssetType);
      if (asset) {
        if (event.accountId !== accountIdForAsset(asset)) {
          errors.push(ledgerIntegrityIssue("LEDGER_ACCOUNT_MISMATCH", `이벤트 ${event.eventId}의 자산 계좌 ID가 현재 자산과 일치하지 않습니다.`, { eventId: event.eventId, assetId: asset.id }));
        }
        if (isMarketType(assetType(asset)) && event.instrumentKey !== decisionSubjectKeyForAsset(asset)) {
          errors.push(ledgerIntegrityIssue("LEDGER_INSTRUMENT_KEY_MISMATCH", `이벤트 ${event.eventId}의 종목 식별자가 현재 자산과 일치하지 않습니다.`, { eventId: event.eventId, assetId: asset.id }));
        }
      }
    }

    const openingCash = event.type === "OPENING_BALANCE" && event.balanceKind === "CASH";
    if (cashEventTypes.has(event.type) || openingCash) {
      const cashAsset = requireAsset(event, event.cashAssetId, "CASH", "cashAssetId");
      if (cashAsset && event.cashAccountId !== accountIdForAsset(cashAsset)) {
        errors.push(ledgerIntegrityIssue("LEDGER_CASH_ACCOUNT_MISMATCH", `이벤트 ${event.eventId}의 CASH 계좌 ID가 현재 자산과 일치하지 않습니다.`, { eventId: event.eventId, cashAssetId: cashAsset.id }));
      }
    }
    if (event.type === "FX") {
      const counterCash = requireAsset(event, event.counterCashAssetId, "CASH", "counterCashAssetId");
      if (counterCash && event.counterCashAccountId !== accountIdForAsset(counterCash)) {
        errors.push(ledgerIntegrityIssue("LEDGER_COUNTER_CASH_ACCOUNT_MISMATCH", `이벤트 ${event.eventId}의 상대 CASH 계좌 ID가 현재 자산과 일치하지 않습니다.`, { eventId: event.eventId, cashAssetId: counterCash.id }));
      }
    }
  });

  realizedTrades.forEach((trade) => {
    if (!trade.ledgerEventId) return;
    const linked = eventsById.get(trade.ledgerEventId);
    if (!linked || linked.type !== "SELL") {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_LINK_INVALID", `실현손익 ${trade.id}의 원장 연결이 유효한 매도 이벤트가 아닙니다.`, { tradeId: trade.id, eventId: trade.ledgerEventId }));
      return;
    }
    const linkedAsset = assetsById.get(linked.assetId);
    if (trade.assetId !== linked.assetId) {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_ASSET_MISMATCH", `실현손익 ${trade.id}의 자산이 연결된 매도 이벤트와 다릅니다.`, { tradeId: trade.id, eventId: linked.eventId }));
    }
    if (trade.soldAt !== linked.tradeDate
      || Math.abs(Number(trade.quantity || 0) - Number(linked.quantity || 0)) > 1e-8
      || Math.abs(Number(trade.sellPrice || 0) - Number(linked.price || 0)) > 1e-8
      || Math.abs(Number(trade.fxRate || 1) - Number(linked.fxRate || 1)) > 1e-8
      || Math.abs(Number(trade.fees || 0) - Number(linked.feeKRW || 0)) > 0.01
      || Math.abs(Number(trade.tax || 0) - Number(linked.taxKRW || 0)) > 0.01) {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_FIELDS_MISMATCH", `실현손익 ${trade.id}의 거래일·수량·가격·환율·비용이 연결된 매도 이벤트와 다릅니다.`, { tradeId: trade.id, eventId: linked.eventId }));
    }
    if (linkedAsset && (trade.type !== assetType(linkedAsset)
      || normalizeTicker(assetType(linkedAsset), trade.ticker) !== normalizeTicker(assetType(linkedAsset), linkedAsset.ticker))) {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_SUBJECT_MISMATCH", `실현손익 ${trade.id}의 종목·계좌 정보가 연결된 자산과 다릅니다.`, { tradeId: trade.id, eventId: linked.eventId }));
    }
    const cancelled = cancelledEventIds.has(linked.eventId);
    if (cancelled !== Boolean(trade.cancelledAt)) {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_CANCEL_MISMATCH", `실현손익 ${trade.id}의 취소 상태가 연결된 매도 이벤트와 다릅니다.`, { tradeId: trade.id, eventId: linked.eventId }));
    }
    if (supersededEventIds.has(linked.eventId) && !cancelled) {
      errors.push(ledgerIntegrityIssue("REALIZED_LEDGER_SUPERSEDED", `실현손익 ${trade.id}가 정정으로 대체된 원본 매도 이벤트를 가리킵니다.`, { tradeId: trade.id, eventId: linked.eventId }));
    }
  });
  tradeJournalEntries.forEach((entry) => {
    if (!entry.ledgerEventId) return;
    const linked = eventsById.get(entry.ledgerEventId);
    if (!linked || !["BUY", "SELL"].includes(linked.type)) {
      errors.push(ledgerIntegrityIssue("JOURNAL_LEDGER_LINK_INVALID", `매매일지 ${entry.id}의 원장 연결이 유효하지 않습니다.`, { journalId: entry.id, eventId: entry.ledgerEventId }));
      return;
    }
    if (entry.assetId !== linked.assetId || entry.action !== linked.type) {
      errors.push(ledgerIntegrityIssue("JOURNAL_LEDGER_SUBJECT_MISMATCH", `매매일지 ${entry.id}의 자산·행동이 연결된 거래 이벤트와 다릅니다.`, { journalId: entry.id, eventId: linked.eventId }));
    }
    if (entry.date !== linked.tradeDate
      || Math.abs(Number(entry.quantity || 0) - Number(linked.quantity || 0)) > 1e-8
      || Math.abs(Number(entry.price || 0) - Number(linked.price || 0)) > 1e-8) {
      errors.push(ledgerIntegrityIssue("JOURNAL_LEDGER_FIELDS_MISMATCH", `매매일지 ${entry.id}의 거래일·수량·가격이 연결된 거래 이벤트와 다릅니다.`, { journalId: entry.id, eventId: linked.eventId }));
    }
    if (cancelledEventIds.has(linked.eventId) && entry.status !== "REVIEW") {
      errors.push(ledgerIntegrityIssue("JOURNAL_LEDGER_CANCEL_MISMATCH", `취소된 거래와 연결된 매매일지 ${entry.id}는 복기필요 상태여야 합니다.`, { journalId: entry.id, eventId: linked.eventId }));
    }
    if (entry.realizedTradeId) {
      const trade = realizedTrades.find((item) => item.id === entry.realizedTradeId);
      if (!trade || trade.ledgerEventId !== linked.eventId) {
        errors.push(ledgerIntegrityIssue("JOURNAL_REALIZED_LINK_MISMATCH", `매매일지 ${entry.id}의 실현손익 연결이 같은 매도 이벤트를 가리키지 않습니다.`, { journalId: entry.id, eventId: linked.eventId }));
      }
    }
  });
  return errors;
}

function projectLedgerState({
  events,
  assets,
  ledgerMeta,
  realizedTrades = [],
  tradeJournalEntries = []
}) {
  const projection = ledgerEngine().projectLedger(events, {
    baselineDate: ledgerMeta?.baselineDate || undefined
  });
  const referenceErrors = ledgerReferenceErrors(events, assets, realizedTrades, tradeJournalEntries, projection.auditTrail);
  const errors = [...(projection.errors || []), ...referenceErrors];
  return { ...projection, ok: errors.length === 0, errors };
}

function ledgerProjection(events = state.events) {
  return projectLedgerState({
    events,
    assets: state.assets,
    ledgerMeta: state.ledgerMeta,
    realizedTrades: state.realizedTrades,
    tradeJournalEntries: state.tradeJournalEntries
  });
}

function ledgerProjectionErrorMessage(projection) {
  return (projection?.errors || []).map((error) => error.message).filter(Boolean).join(" ")
    || "원장 계산에 실패했습니다.";
}

function applyLedgerProjectionToAssets(projection) {
  if (!projection?.ok) throw new Error(ledgerProjectionErrorMessage(projection));
  const positions = new Map(projection.positions.map((position) => [position.assetId, position]));
  const cashBalances = new Map(projection.cashBalances.map((balance) => [balance.cashAssetId, balance]));
  const valuations = new Map(projection.valuations.map((valuation) => [valuation.assetId, valuation]));
  state.assets = state.assets.map((asset) => {
    const type = assetType(asset);
    if (isMarketType(type)) {
      const position = positions.get(asset.id);
      return normalizeAsset({
        ...asset,
        quantity: position?.quantity || 0,
        averagePrice: position?.averageCostNative || 0
      });
    }
    if (type === "CASH") {
      return normalizeAsset({ ...asset, amount: cashBalances.get(asset.id)?.amountKRW || 0 });
    }
    if (type === "MANUAL") {
      return normalizeAsset({ ...asset, amount: valuations.get(asset.id)?.valueKRW || 0 });
    }
    return asset;
  });
}

function appendLedgerEvents(rawEvents, { materialize = true } = {}) {
  const normalized = rawEvents.map(normalizeLedgerEvent);
  const eventIds = new Set(state.events.map((event) => event.eventId));
  normalized.forEach((event) => {
    if (eventIds.has(event.eventId)) throw new Error(`이미 저장된 원장 이벤트입니다: ${event.eventId}`);
    eventIds.add(event.eventId);
  });
  const candidate = [...state.events, ...normalized];
  const projection = ledgerProjection(candidate);
  if (!projection.ok) throw new Error(ledgerProjectionErrorMessage(projection));
  state.events = candidate;
  if (materialize) applyLedgerProjectionToAssets(projection);
  return { events: normalized, projection };
}

function ledgerSequence() {
  return Date.now();
}

function createBuyLedgerEvent(result) {
  const type = assetType(result.asset);
  return normalizeLedgerEvent({
    eventId: `event-${uid()}`,
    type: "BUY",
    accountId: accountIdForAsset(result.asset),
    cashAssetId: result.cashAsset.id,
    cashAccountId: accountIdForAsset(result.cashAsset),
    assetId: result.asset.id,
    instrumentKey: decisionSubjectKeyForAsset(result.asset),
    tradeDate: result.boughtAt,
    settlementDate: result.settlementDate,
    sequence: ledgerSequence(),
    quantity: result.quantity,
    price: result.buyPrice,
    currency: type === "US" ? "USD" : "KRW",
    fxRate: result.fxRate,
    feeKRW: result.fees,
    taxKRW: 0,
    note: result.memo,
    createdAt: new Date().toISOString()
  });
}

function createSellLedgerEvent(result) {
  const type = assetType(result.asset);
  return normalizeLedgerEvent({
    eventId: `event-${uid()}`,
    type: "SELL",
    accountId: accountIdForAsset(result.asset),
    cashAssetId: result.cashAsset.id,
    cashAccountId: accountIdForAsset(result.cashAsset),
    assetId: result.asset.id,
    instrumentKey: decisionSubjectKeyForAsset(result.asset),
    tradeDate: result.trade.soldAt,
    settlementDate: result.settlementDate,
    sequence: ledgerSequence(),
    quantity: result.trade.quantity,
    price: result.trade.sellPrice,
    currency: type === "US" ? "USD" : "KRW",
    fxRate: result.trade.fxRate,
    feeKRW: result.trade.fees,
    taxKRW: result.trade.tax,
    note: result.trade.memo,
    createdAt: new Date().toISOString()
  });
}

function renderCurrentViewWithoutPersist() {
  markAllViewsDirty();
  renderView(uiState.activeView);
  setActiveView(uiState.activeView, { scroll: false });
}

function commitLedgerMutation(mutator) {
  const before = storageSafeState();
  try {
    const output = mutator();
    applyPricesToAssets();
    if (!render()) throw new Error("변경 내용을 로컬 저장소에 기록하지 못했습니다.");
    return { ok: true, output };
  } catch (error) {
    console.error(error);
    replaceState(before);
    renderCurrentViewWithoutPersist();
    alert(`거래 원장을 저장하지 않았습니다. ${error.message}`);
    return { ok: false, error };
  }
}

function cancelLedgerEvent(eventId, reason = "사용자 요청으로 취소") {
  const target = state.events.find((event) => event.eventId === eventId);
  if (!target || ["CANCEL", "OPENING_BALANCE"].includes(target.type)) return false;
  const auditDate = localDateInputValue();
  const cancellation = normalizeLedgerEvent({
    eventId: `event-${uid()}`,
    type: "CANCEL",
    accountId: target.accountId,
    targetEventId: target.eventId,
    tradeDate: auditDate,
    settlementDate: auditDate,
    auditDate,
    sequence: ledgerSequence(),
    reason,
    createdAt: new Date().toISOString()
  });
  const result = commitLedgerMutation(() => {
    state.realizedTrades = state.realizedTrades.map((trade) => trade.ledgerEventId === target.eventId
      ? normalizeRealizedTrade({ ...trade, cancelledAt: new Date().toISOString() })
      : trade);
    state.tradeJournalEntries = state.tradeJournalEntries.map((entry) => entry.ledgerEventId === target.eventId
      ? normalizeTradeJournalEntry({ ...entry, status: "REVIEW", review: `${entry.review}${entry.review ? "\n" : ""}연결 거래가 취소되었습니다.` })
      : entry);
    appendLedgerEvents([cancellation]);
    return cancellation;
  });
  return result.ok;
}

function ledgerReconciliationForAssets(projection, assets) {
  const mismatches = [];
  const positions = new Map(projection.positions.map((position) => [position.assetId, position]));
  const cashBalances = new Map(projection.cashBalances.map((balance) => [balance.cashAssetId, balance]));
  const valuations = new Map(projection.valuations.map((valuation) => [valuation.assetId, valuation]));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  projection.positions.forEach((position) => {
    if (!assetsById.has(position.assetId)) mismatches.push(`미등록 자산 ${position.assetId} 포지션`);
  });
  projection.cashBalances.forEach((balance) => {
    if (!assetsById.has(balance.cashAssetId)) mismatches.push(`미등록 CASH ${balance.cashAssetId} 잔액`);
  });
  projection.valuations.forEach((valuation) => {
    if (!assetsById.has(valuation.assetId)) mismatches.push(`미등록 수동 자산 ${valuation.assetId} 평가`);
  });
  assets.forEach((asset) => {
    const type = assetType(asset);
    if (isMarketType(type)) {
      const position = positions.get(asset.id);
      if (!position) mismatches.push(`${asset.name} 포지션 누락`);
      if (Math.abs(Number(asset.quantity || 0) - Number(position?.quantity || 0)) > 1e-8) {
        mismatches.push(`${asset.name} 수량`);
      }
      if (Math.abs(Number(asset.averagePrice || 0) - Number(position?.averageCostNative || 0)) > 1e-6) {
        mismatches.push(`${asset.name} 평단`);
      }
    } else if (type === "CASH") {
      if (!cashBalances.has(asset.id)) mismatches.push(`${asset.name} 현금 원장 누락`);
      if (Math.abs(Number(asset.amount || 0) - Number(cashBalances.get(asset.id)?.amountKRW || 0)) > 0.01) {
        mismatches.push(`${asset.name} 현금`);
      }
    } else if (type === "MANUAL") {
      if (!valuations.has(asset.id)) mismatches.push(`${asset.name} 평가 원장 누락`);
      if (Math.abs(Number(asset.amount || 0) - Number(valuations.get(asset.id)?.valueKRW || 0)) > 0.01) {
        mismatches.push(`${asset.name} 평가금액`);
      }
    }
  });
  return {
    ok: projection.ok && mismatches.length === 0,
    mismatches,
    errors: projection.errors || [],
    warnings: projection.warnings || []
  };
}

function ledgerReconciliation(projection = ledgerProjection()) {
  return ledgerReconciliationForAssets(projection, state.assets);
}

function ledgerCashChange(event) {
  if (event.type === "BUY") return -(event.grossAmountKRW + event.feeKRW + event.taxKRW);
  if (event.type === "SELL") return event.grossAmountKRW - event.feeKRW - event.taxKRW;
  if (["DEPOSIT", "DIVIDEND", "INTEREST"].includes(event.type)) return event.amountKRW;
  if (["WITHDRAWAL", "FEE", "TAX"].includes(event.type)) return -event.amountKRW;
  if (event.type === "FX") return event.counterAmountKRW - event.amountKRW - event.feeKRW;
  if (event.type === "OPENING_BALANCE" && event.balanceKind === "CASH") return event.amount;
  return 0;
}

function ledgerEventAsset(event) {
  return state.assets.find((asset) => asset.id === event.assetId)
    || state.assets.find((asset) => asset.id === event.cashAssetId)
    || null;
}

function renderLedger() {
  if (!els.ledgerEventRows || !els.ledgerEventSummary || !els.ledgerReconciliation) return;
  renderCashFlowOptions();
  let projection;
  try {
    projection = ledgerProjection();
  } catch (error) {
    els.ledgerReconciliation.className = "ledger-reconciliation is-error";
    els.ledgerReconciliation.textContent = error.message;
    return;
  }
  const reconciliation = ledgerReconciliation(projection);
  els.ledgerReconciliation.className = `ledger-reconciliation ${reconciliation.ok ? "is-balanced" : "is-error"}`;
  els.ledgerReconciliation.innerHTML = reconciliation.ok
    ? `<strong>원장 정합성 정상</strong><span>보유수량·평단·CASH 잔액이 활성 이벤트 합계와 일치합니다.${reconciliation.warnings.length ? ` 확인사항 ${reconciliation.warnings.length}건` : ""}</span>`
    : `<strong>원장 정합성 확인 필요</strong><span>${escapeHtml([
        ...reconciliation.mismatches,
        ...reconciliation.errors.map((error) => error.message)
      ].join(" · ") || "원장과 자산 상태가 일치하지 않습니다.")}</span>`;

  const summary = projection.summary;
  const income = Number(summary.dividendsKRW || 0) + Number(summary.interestKRW || 0);
  const expenses = Number(summary.feesKRW || 0) + Number(summary.taxesKRW || 0);
  els.ledgerEventSummary.innerHTML = [
    ["외부 순현금흐름", money(summary.externalCashFlowKRW || 0), "입금 − 출금"],
    ["배당·이자", money(income), "현금 수익"],
    ["비용·세금", money(expenses), "누적 지출"],
    ["활성 이벤트", `${projection.reconciliation.activeEventCount}건`, `전체 ${state.events.length}건`]
  ].map(([label, value, detail]) => `<div class="ledger-summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`).join("");

  const superseded = new Set(projection.auditTrail.supersededEventIds || []);
  const filter = uiState.ledgerType || "ALL";
  const events = [...state.events]
    .filter((event) => filter === "ALL" || event.type === filter)
    .sort((a, b) => String(b.tradeDate).localeCompare(String(a.tradeDate)) || String(b.eventId).localeCompare(String(a.eventId)));
  els.ledgerEventRows.textContent = "";
  if (!events.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" class="empty">${state.events.length ? "선택한 유형의 이벤트가 없습니다." : "아직 원장 이벤트가 없습니다."}</td>`;
    els.ledgerEventRows.append(row);
    return;
  }
  events.forEach((event) => {
    const asset = ledgerEventAsset(event);
    const cashAsset = state.assets.find((item) => item.id === event.cashAssetId);
    const cashChange = ledgerCashChange(event);
    const cancelled = superseded.has(event.eventId);
    const row = document.createElement("tr");
    row.dataset.eventId = event.eventId;
    row.dataset.status = cancelled ? "reversed" : "active";
    row.className = cancelled ? "is-cancelled" : "";
    const quantityText = event.quantity
      ? `${formatPlainNumber(event.quantity)} × ${event.currency === "USD" ? usd(event.price || event.unitCost) : formatPlainNumber(event.price || event.unitCost)}`
      : event.amount
        ? `${event.currency || "KRW"} ${formatPlainNumber(event.amount)}`
        : "—";
    const sourceText = [event.sourceSystem, event.sourceId].filter(Boolean).join(" · ");
    const canCancel = !cancelled && !["CANCEL", "OPENING_BALANCE"].includes(event.type);
    const canCorrect = !cancelled && CASH_FLOW_EVENT_TYPES.has(event.type);
    row.innerHTML = `
      <td><span class="ledger-cell-primary">${escapeHtml(formatTradeDate(event.tradeDate))}</span><span class="ledger-event-type" data-event-type="${escapeHtml(event.type)}">${escapeHtml(LEDGER_EVENT_LABELS[event.type] || event.type)}</span>${cancelled ? `<span class="ledger-status-badge">취소됨</span>` : ""}</td>
      <td><span class="ledger-cell-primary">${escapeHtml(asset?.name || event.assetId || cashAsset?.name || "현금흐름")}</span><span class="ledger-cell-secondary">${escapeHtml(cashAsset?.name || event.cashAccountId || event.accountId || "계좌 미지정")}</span></td>
      <td class="number"><span class="ledger-cell-primary">${escapeHtml(quantityText)}</span><span class="ledger-cell-secondary">결제 ${escapeHtml(formatTradeDate(event.settlementDate))}</span></td>
      <td class="number ${cashChange > 0 ? "positive" : cashChange < 0 ? "negative" : ""}">${cashChange ? `${cashChange > 0 ? "+" : ""}${money(cashChange)}` : "—"}</td>
      <td><span class="ledger-cell-primary">${escapeHtml(sourceText || (event.type === "OPENING_BALANCE" ? "시스템 생성" : "직접 입력"))}</span><span class="ledger-cell-secondary">${escapeHtml(event.note || event.reason || (event.targetEventId ? `대상 ${event.targetEventId}` : "메모 없음"))}</span></td>
      <td><div class="row-actions">${canCorrect ? `<button class="table-action quiet-action" type="button" data-ledger-action="correct" data-event-id="${escapeHtml(event.eventId)}">정정</button>` : ""}${canCancel ? `<button class="table-action quiet-action ledger-cancel-button" type="button" data-ledger-action="cancel" data-event-id="${escapeHtml(event.eventId)}">취소</button>` : ""}</div></td>
    `;
    els.ledgerEventRows.append(row);
  });
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
  const label = trade.type === "US" ? "실현손익(환차손익 제외)" : "실현손익";
  return `<span class="journal-badge gain-badge ${tone}">${label} ${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}</span>`;
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
        <button class="table-action quiet-action" type="button" data-journal-action="copy-ai" data-id="${escapeHtml(entry.id)}">AI 질문 복사</button>
        ${linkedTrade ? `<button class="table-action quiet-action" type="button" data-journal-action="view-realized" data-id="${escapeHtml(entry.id)}">손익 보기</button>` : ""}
        <button class="table-action quiet-action" type="button" data-journal-action="edit" data-id="${escapeHtml(entry.id)}">수정</button>
        <button class="table-action quiet-action" type="button" data-journal-action="delete" data-id="${escapeHtml(entry.id)}">삭제</button>
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
  [
    els.journalDate,
    els.journalAssetId,
    els.journalAssetName,
    els.journalTicker,
    els.journalRegion,
    els.journalAccount,
    els.journalAction,
    els.journalQuantity,
    els.journalPrice
  ].filter(Boolean).forEach((field) => { field.disabled = false; });
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
  [
    els.journalDate,
    els.journalAssetId,
    els.journalAssetName,
    els.journalTicker,
    els.journalRegion,
    els.journalAccount,
    els.journalAction,
    els.journalQuantity,
    els.journalPrice
  ].filter(Boolean).forEach((field) => { field.disabled = Boolean(normalized.ledgerEventId); });
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
  const existingEntry = state.tradeJournalEntries.find((entry) => entry.id === els.journalId.value);
  const linkedEvent = state.events.find((event) => event.eventId === existingEntry?.ledgerEventId) || null;
  const linkedAsset = linkedEvent ? state.assets.find((asset) => asset.id === linkedEvent.assetId) || null : null;
  const type = selectedAsset ? assetType(selectedAsset) : normalizeAssetType(els.journalRegion.value === "OVERSEAS" ? "US" : els.journalRegion.value === "DOMESTIC" ? "KRX" : "MANUAL");
  return normalizeTradeJournalEntry({
    id: els.journalId.value || uid(),
    assetId: selectedAsset?.id || "",
    realizedTradeId: els.journalRealizedTradeId.value || "",
    ledgerEventId: existingEntry?.ledgerEventId || "",
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
    createdAt: existingEntry?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(linkedEvent && linkedAsset ? {
      assetId: linkedAsset.id,
      date: linkedEvent.tradeDate,
      name: linkedAsset.name,
      ticker: linkedAsset.ticker,
      type: assetType(linkedAsset),
      region: regionCodeForAsset(linkedAsset),
      account: linkedAsset.account || "",
      action: linkedEvent.type,
      quantity: linkedEvent.quantity,
      price: linkedEvent.price,
      status: (state.events.some((item) => item.type === "CANCEL" && item.targetEventId === linkedEvent.eventId))
        ? "REVIEW"
        : els.journalStatus.value
    } : {})
  });
}

function createJournalEntryFromTrade(asset, trade, ledgerEventId = trade.ledgerEventId || "") {
  trade.ledgerEventId = ledgerEventId;
  return createJournalEntryFromRealizedTrade(trade, asset);
}

function createJournalEntryFromRealizedTrade(trade, asset = null) {
  const gainText = `${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}`;
  return normalizeTradeJournalEntry({
    id: uid(),
    assetId: asset?.id || trade.assetId || "",
    realizedTradeId: trade.id,
    ledgerEventId: trade.ledgerEventId || "",
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

function createJournalEntryFromBuy(asset, buy, ledgerEventId = "") {
  const type = assetType(asset);
  const priceText = type === "US" ? usd(buy.buyPrice) : formatPlainNumber(buy.buyPrice);
  const averageText = type === "US" ? usd(buy.nextAveragePrice) : formatPlainNumber(buy.nextAveragePrice);
  return normalizeTradeJournalEntry({
    id: uid(),
    assetId: asset.id,
    ledgerEventId,
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

  const trades = [...activeRealizedTrades()].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
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
  const years = [...new Set(activeRealizedTrades().map(tradeYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  const current = years.includes(uiState.realizedYear) ? uiState.realizedYear : "ALL";
  els.realizedYearFilter.innerHTML = `<option value="ALL">전체 기간</option>${years.map((year) => `<option value="${year}">${year}년</option>`).join("")}`;
  els.realizedYearFilter.value = current;
  uiState.realizedYear = current;
}

function renderRealizedChart(year) {
  const monthly = Array.from({ length: 12 }, () => 0);
  activeRealizedTrades()
    .filter((trade) => tradeYear(trade) === year)
    .forEach((trade) => {
      const month = Number(String(trade.soldAt || "").slice(5, 7));
      if (month >= 1 && month <= 12) monthly[month - 1] += Number(trade.realizedGain || 0);
    });

  const max = Math.max(1, ...monthly.map((value) => Math.abs(value)));
  const hasData = monthly.some((value) => value !== 0);
  const accessibleSummary = monthly
    .map((value, index) => value === 0 ? "" : `${index + 1}월 ${money(value)}`)
    .filter(Boolean)
    .join(", ");
  els.realizedChart.setAttribute(
    "aria-label",
    hasData
      ? `${year}년 월별 실현손익 차트. ${accessibleSummary}`
      : `${year}년 월별 실현손익 차트. 기록 없음`
  );
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
      ? `<button class="table-action quiet-action" type="button" data-realized-action="view-journal" data-id="${escapeHtml(trade.id)}">일지 보기</button>`
      : `<button class="table-action quiet-action" type="button" data-realized-action="create-journal" data-id="${escapeHtml(trade.id)}">일지 작성</button>`;
    const realizedArrow = trade.realizedGain > 0 ? "▲ " : trade.realizedGain < 0 ? "▼ " : "";
    const gainDetail = [
      trade.type === "US" ? "환차손익 제외" : "",
      rate === null ? "" : `${rate > 0 ? "+" : ""}${percent(rate)}`
    ].filter(Boolean).join(" · ");
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
      <td class="number ${tone}">${realizedArrow}${trade.realizedGain > 0 ? "+" : ""}${money(trade.realizedGain)}${gainDetail ? `<small class="sub-value">${gainDetail}</small>` : ""}</td>
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
      const when = historyDateParts(snapshot.createdAt);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="history-when">${escapeHtml(when.day)}${when.time ? `<small>${escapeHtml(when.time)}</small>` : ""}</td>
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

function historyDateParts(value) {
  const date = toDate(value);
  if (!date) return { day: String(value || ""), time: "" };
  const day = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return { day, time: `${hours}:${minutes}` };
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
  const panel = canvas.closest(".history-panel");
  if (panel && getComputedStyle(panel).display === "none") return false;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.round(canvas.clientWidth || bounds.width);
  const height = Math.round(canvas.clientHeight || bounds.height);
  if (!(width > 0) || !(height > 0)) return false;
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, Number(window.devicePixelRatio) || 1));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  if (typeof ctx.setTransform === "function") ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const palette = chartPalette();
  const compact = width < 520;
  const topPad = compact ? 38 : 50;
  const leftPad = compact ? 46 : 58;
  const rightPad = compact ? 18 : 44;
  const bottomPad = compact ? 50 : 66;
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
    if (els.historyChartDescription) {
      els.historyChartDescription.textContent = "선택 기간에 저장된 조회 기록이 없습니다.";
    }
    return true;
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
  return true;
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
  setRetirementValidation(result.error || "");

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
  const validationError = validateRetirementInput(input);
  if (validationError) return { error: validationError };

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

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWithDateFormatter(formatter, value) {
  if (!value) return "";
  const date = toDate(value);
  return date ? formatter.format(date) : String(value);
}

function formatTradeDate(value) {
  if (!value) return "";
  const date = toDate(`${value}T00:00:00`);
  return date ? TRADE_DATE_FORMATTER.format(date) : String(value);
}

function formatDate(value) {
  if (!value) return "없음";
  return formatWithDateFormatter(DATE_TIME_FORMATTER, value);
}

function shortDay(value) {
  const date = toDate(value);
  if (!date) return "";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}.${d}`;
}

function shortDate(value) {
  return formatWithDateFormatter(SHORT_DATE_FORMATTER, value);
}

function chartDateLabel(value) {
  return formatWithDateFormatter(CHART_DATE_FORMATTER, value);
}

function shortDateTime(value) {
  return formatWithDateFormatter(SHORT_DATE_TIME_FORMATTER, value);
}

function compactDateTime(value) {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return String(value);
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
  delete els.assetForm.dataset.mode;
  [els.assetCategory, els.assetAmount, els.assetQuantity, els.assetAveragePrice].forEach((input) => {
    if (input) input.disabled = false;
  });
  uiState.autofilledAssetName = "";
  if (els.assetFormTitle) els.assetFormTitle.textContent = "자산 추가";
  els.saveAssetBtn.textContent = "자산 저장";
  updateAssetFormForType();
  hideAssetForm();
}

function showAssetForm(mode = "create") {
  if (els.assetForm) els.assetForm.dataset.mode = mode;
  if (els.assetFormPanel) els.assetFormPanel.hidden = false;
  if (els.assetFormTitle) els.assetFormTitle.textContent = mode === "edit" ? "자산 수정" : "자산 추가";
  if (els.toggleAssetFormBtn) {
    els.toggleAssetFormBtn.textContent = "접기";
    els.toggleAssetFormBtn.setAttribute("aria-expanded", "true");
  }
  loadSymbolsForAssetForm();
}

function hideAssetForm() {
  if (els.assetFormPanel) els.assetFormPanel.hidden = true;
  if (els.toggleAssetFormBtn) {
    els.toggleAssetFormBtn.textContent = "자산 추가";
    els.toggleAssetFormBtn.setAttribute("aria-expanded", "false");
  }
}

function resetTradeForm({ form, idInput, preview, panel }) {
  if (!form) return;
  form.reset();
  if (idInput) idInput.value = "";
  if (preview) preview.textContent = "";
  if (panel) panel.hidden = true;
}

function resetSellForm() {
  resetTradeForm({ form: els.sellForm, idInput: els.sellAssetId, preview: els.sellPreview, panel: els.sellFormPanel });
}

function hideSellForm() {
  if (els.sellFormPanel) els.sellFormPanel.hidden = true;
}

function resetBuyForm() {
  resetTradeForm({ form: els.buyForm, idInput: els.buyAssetId, preview: els.buyPreview, panel: els.buyFormPanel });
}

function hideBuyForm() {
  if (els.buyFormPanel) els.buyFormPanel.hidden = true;
}

function accountIdForAsset(asset) {
  return `ACCOUNT:${String(asset?.id || "UNKNOWN")}`;
}

function openingOnlyLedgerEventForAsset(asset) {
  if (!asset?.id) return null;
  const validation = ledgerEngine().validateLedger(state.events, {
    baselineDate: state.ledgerMeta?.baselineDate || undefined
  });
  if (!validation.ok) return null;
  const referencesAsset = (event) => (
    event.assetId === asset.id
      || event.cashAssetId === asset.id
      || event.counterCashAssetId === asset.id
  );
  const hasDependentHistory = validation.events.some((event) => (
    !["OPENING_BALANCE", "CANCEL"].includes(event.type) && referencesAsset(event)
  ));
  if (hasDependentHistory) return null;
  const related = validation.activeEvents.filter(referencesAsset);
  if (related.length !== 1 || related[0].type !== "OPENING_BALANCE") return null;
  const opening = related[0];
  if (assetType(asset) === "CASH") return opening.balanceKind === "CASH" ? opening : null;
  if (assetType(asset) === "MANUAL") return opening.balanceKind === "VALUATION" ? opening : null;
  return opening.balanceKind === "POSITION" ? opening : null;
}

function cashAssets() {
  return state.assets.filter((asset) => assetType(asset) === "CASH");
}

function renderCashAssetOptions(select, { preferredAccount = "", preserve = true } = {}) {
  if (!select) return "";
  const previous = preserve ? select.value : "";
  const options = cashAssets();
  select.innerHTML = options.length
    ? `<option value="">CASH 계좌 선택</option>${options.map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)} · ${escapeHtml(asset.account || "계좌 미지정")} · ${escapeHtml(money(asset.amount || 0))}</option>`).join("")}`
    : `<option value="">먼저 CASH 자산을 추가하세요</option>`;
  let selected = options.some((asset) => asset.id === previous) ? previous : "";
  if (!selected && preferredAccount) {
    const exact = options.filter((asset) => asset.account === preferredAccount);
    if (exact.length === 1) selected = exact[0].id;
  }
  if (!selected && options.length === 1) selected = options[0].id;
  select.value = selected;
  select.disabled = options.length === 0;
  return selected;
}

function cashAssetFromSelect(select) {
  return state.assets.find((asset) => asset.id === select?.value && assetType(asset) === "CASH") || null;
}

function renderCashFlowOptions({ preserve = true } = {}) {
  renderCashAssetOptions(els.cashFlowCashAssetId, { preserve });
  if (!els.cashFlowSourceAssetId) return;
  const previous = preserve ? els.cashFlowSourceAssetId.value : "";
  const options = state.assets
    .filter((asset) => assetType(asset) !== "CASH")
    .map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}${asset.ticker ? ` · ${escapeHtml(asset.ticker)}` : ""}</option>`)
    .join("");
  els.cashFlowSourceAssetId.innerHTML = `<option value="">없음</option>${options}`;
  els.cashFlowSourceAssetId.value = state.assets.some((asset) => asset.id === previous) ? previous : "";
}

function resetCashFlowForm() {
  if (!els.cashFlowForm) return;
  els.cashFlowForm.reset();
  delete els.cashFlowForm.dataset.correctsEventId;
  delete els.cashFlowForm.dataset.correctionReason;
  els.cashFlowType.disabled = false;
  const today = localDateInputValue();
  els.cashFlowDate.value = today;
  els.cashFlowSettlementDate.value = today;
  els.cashFlowCurrency.value = "KRW";
  els.cashFlowFxRate.value = "1";
  if (els.cashFlowFxRateField) els.cashFlowFxRateField.hidden = true;
  renderCashFlowOptions({ preserve: false });
  renderCashFlowPreview();
  if (els.cashFlowFormPanel) els.cashFlowFormPanel.hidden = true;
  if (els.toggleCashFlowFormBtn) {
    els.toggleCashFlowFormBtn.textContent = "현금흐름 기록";
    els.toggleCashFlowFormBtn.setAttribute("aria-expanded", "false");
  }
}

function showCashFlowForm() {
  if (!els.cashFlowFormPanel) return;
  renderCashFlowOptions();
  if (!els.cashFlowDate.value) els.cashFlowDate.value = localDateInputValue();
  if (!els.cashFlowSettlementDate.value) els.cashFlowSettlementDate.value = els.cashFlowDate.value;
  els.cashFlowFormPanel.hidden = false;
  els.toggleCashFlowFormBtn.textContent = "접기";
  els.toggleCashFlowFormBtn.setAttribute("aria-expanded", "true");
  els.cashFlowType.focus();
  renderCashFlowPreview();
}

function parseCashFlowForm(strict = true) {
  const type = String(els.cashFlowType?.value || "").toUpperCase();
  const tradeDate = els.cashFlowDate?.value || localDateInputValue();
  const settlementDate = els.cashFlowSettlementDate?.value || tradeDate;
  const cashAsset = cashAssetFromSelect(els.cashFlowCashAssetId);
  const sourceAsset = state.assets.find((asset) => asset.id === els.cashFlowSourceAssetId?.value) || null;
  const amount = parseAmount(els.cashFlowAmount?.value || 0);
  const currency = els.cashFlowCurrency?.value === "USD" ? "USD" : "KRW";
  const fxRate = currency === "USD" ? parseAmount(els.cashFlowFxRate?.value || 0) : 1;
  const amountKRW = amount * fxRate;
  const memo = els.cashFlowMemo?.value.trim() || "";
  const correctsEventId = els.cashFlowForm?.dataset.correctsEventId || "";
  const correctedEvent = state.events.find((event) => event.eventId === correctsEventId) || null;
  if (!CASH_FLOW_EVENT_TYPES.has(type)) return { ok: false, message: "지원하지 않는 현금흐름 유형입니다." };
  if (!cashAsset) return { ok: false, message: strict ? "현금흐름을 반영할 CASH 계좌를 선택하세요." : "" };
  if (!(amount > 0)) return { ok: false, message: strict ? "현금흐름 금액은 0보다 커야 합니다." : "" };
  if (currency === "USD" && !(fxRate > 0)) return { ok: false, message: strict ? "적용 환율을 입력하세요." : "" };
  if (settlementDate < tradeDate) return { ok: false, message: strict ? "반영일은 발생일보다 빠를 수 없습니다." : "" };
  if (type === "DIVIDEND" && !sourceAsset) return { ok: false, message: strict ? "배당의 원천 자산을 선택하세요." : "" };
  if (type === "DIVIDEND" && !isMarketType(assetType(sourceAsset))) {
    return { ok: false, message: strict ? "배당의 원천은 KRX/US 자산이어야 합니다." : "" };
  }
  if (memo.length > IMPORT_STRING_LIMITS.note) return { ok: false, message: strict ? "현금흐름 메모는 10,000자 이하로 입력하세요." : "" };
  const outgoing = ["WITHDRAWAL", "FEE", "TAX"].includes(type);
  const correctedCashDeltaKRW = correctedEvent && correctedEvent.cashAssetId === cashAsset.id
    ? ledgerCashChange(correctedEvent)
    : 0;
  const availableCashKRW = Number(cashAsset.amount || 0) - correctedCashDeltaKRW;
  if (outgoing && amountKRW > availableCashKRW + 0.0001) {
    const balanceLabel = correctedEvent ? "정정 전 원본 복원을 반영한 CASH 가용잔액" : "선택한 CASH 잔액";
    return { ok: false, message: `${balanceLabel}(${money(availableCashKRW)})보다 차감액(${money(amountKRW)})이 큽니다.` };
  }
  return {
    ok: true,
    type,
    tradeDate,
    settlementDate,
    cashAsset,
    sourceAsset,
    amount,
    currency,
    fxRate,
    amountKRW,
    memo,
    outgoing,
    previewBaseCashKRW: availableCashKRW
  };
}

function createCashFlowLedgerEvent(result) {
  const correctsEventId = els.cashFlowForm?.dataset.correctsEventId || "";
  const corrected = state.events.find((event) => event.eventId === correctsEventId);
  return normalizeLedgerEvent({
    eventId: `event-${uid()}`,
    type: result.type,
    accountId: corrected?.accountId || accountIdForAsset(result.sourceAsset || result.cashAsset),
    cashAssetId: result.cashAsset.id,
    cashAccountId: accountIdForAsset(result.cashAsset),
    ...(result.sourceAsset ? { assetId: result.sourceAsset.id } : {}),
    ...(result.sourceAsset && isMarketType(assetType(result.sourceAsset))
      ? { instrumentKey: decisionSubjectKeyForAsset(result.sourceAsset) }
      : {}),
    tradeDate: result.tradeDate,
    settlementDate: result.settlementDate,
    sequence: ledgerSequence(),
    amount: result.amount,
    currency: result.currency,
    fxRate: result.fxRate,
    note: result.memo,
    ...(corrected ? {
      correctsEventId: corrected.eventId,
      reason: els.cashFlowForm.dataset.correctionReason,
      auditDate: localDateInputValue()
    } : {}),
    createdAt: new Date().toISOString()
  });
}

function showCashFlowCorrection(target, reason) {
  if (!CASH_FLOW_EVENT_TYPES.has(target?.type)) return;
  showCashFlowForm();
  els.cashFlowForm.dataset.correctsEventId = target.eventId;
  els.cashFlowForm.dataset.correctionReason = reason;
  els.cashFlowType.value = target.type;
  els.cashFlowType.disabled = true;
  els.cashFlowDate.value = target.tradeDate;
  els.cashFlowSettlementDate.value = target.settlementDate;
  renderCashFlowOptions({ preserve: false });
  els.cashFlowCashAssetId.value = target.cashAssetId;
  els.cashFlowSourceAssetId.value = target.assetId || "";
  els.cashFlowAmount.value = formatPlainNumber(target.amount || 0);
  els.cashFlowCurrency.value = target.currency || "KRW";
  els.cashFlowFxRate.value = formatPlainNumber(target.fxRate || 1);
  els.cashFlowFxRateField.hidden = target.currency !== "USD";
  els.cashFlowMemo.value = target.note || "";
  renderCashFlowPreview();
  els.cashFlowAmount.focus();
}

function renderCashFlowPreview() {
  if (!els.cashFlowPreview) return;
  const result = parseCashFlowForm(false);
  if (!result.ok) {
    els.cashFlowPreview.className = "cash-flow-preview";
    els.cashFlowPreview.textContent = result.message || "금액을 입력하면 CASH 잔액 변화를 확인할 수 있습니다.";
    return;
  }
  const delta = result.outgoing ? -result.amountKRW : result.amountKRW;
  const baseCash = Number(result.previewBaseCashKRW ?? result.cashAsset.amount ?? 0);
  els.cashFlowPreview.className = `cash-flow-preview ${delta >= 0 ? "positive" : "negative"}`;
  els.cashFlowPreview.textContent = `${result.cashAsset.name} ${money(baseCash)} → ${money(baseCash + delta)} · 원화 반영 ${delta > 0 ? "+" : ""}${money(delta)}`;
}

function showSellForm(asset) {
  if (!els.sellFormPanel || !els.sellForm) return;
  resetAssetForm();
  resetBuyForm();
  els.sellFormPanel.hidden = false;
  els.sellAssetId.value = asset.id;
  els.sellDate.value = localDateInputValue();
  if (els.sellSettlementDate) els.sellSettlementDate.value = localDateInputValue();
  renderCashAssetOptions(els.sellCashAssetId, { preferredAccount: asset.account, preserve: false });
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
  if (els.buySettlementDate) els.buySettlementDate.value = localDateInputValue();
  renderCashAssetOptions(els.buyCashAssetId, { preferredAccount: asset.account, preserve: false });
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
  const gainLabel = assetType(preview.asset) === "US" ? "실현손익(환차손익 제외)" : "실현손익";
  els.sellPreview.className = `sell-preview ${gain > 0 ? "positive" : gain < 0 ? "negative" : ""}`;
  els.sellPreview.textContent = [
    `매도금액 ${money(preview.trade.grossAmount)}`,
    `원가 ${money(preview.trade.costAmount)}`,
    `비용 ${money(preview.trade.fees + preview.trade.tax)}`,
    `${preview.cashAsset.name} ${money(preview.cashAsset.amount || 0)} → ${money(Number(preview.cashAsset.amount || 0) + preview.netCashAmountKRW)}`,
    `${gainLabel} ${gain > 0 ? "+" : ""}${money(gain)}${rate === null ? "" : ` (${rate > 0 ? "+" : ""}${percent(rate)})`}`
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
    `${preview.cashAsset.name} ${money(preview.cashAsset.amount || 0)} → ${money(Number(preview.cashAsset.amount || 0) - preview.netCashAmountKRW)}`,
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
  const settlementDate = els.sellSettlementDate?.value || soldAt;
  const cashAsset = cashAssetFromSelect(els.sellCashAssetId);
  const memo = els.sellMemo?.value.trim() || "";

  if (quantity <= 0) return { ok: false, message: strict ? "매도 수량은 0보다 커야 합니다." : "" };
  if (quantity > holdingQuantity + 0.0000001) return { ok: false, message: `보유 수량 ${formatPlainNumber(holdingQuantity)}주보다 많이 매도할 수 없습니다.` };
  if (sellPrice <= 0) return { ok: false, message: strict ? "매도가를 입력하세요." : "" };
  if (type === "US" && fxRate <= 0) return { ok: false, message: strict ? "달러 환율을 입력하세요." : "" };
  if (!cashAsset) return { ok: false, message: strict ? "매도대금을 받을 CASH 계좌를 선택하세요." : "" };
  if (settlementDate < soldAt) return { ok: false, message: strict ? "결제일은 매도일보다 빠를 수 없습니다." : "" };
  if (memo.length > IMPORT_STRING_LIMITS.note) {
    return { ok: false, message: strict ? "매도 메모는 10,000자 이하로 입력하세요." : "" };
  }

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
    memo,
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    asset,
    cashAsset,
    settlementDate,
    netCashAmountKRW: grossAmount - fees - tax,
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
  const settlementDate = els.buySettlementDate?.value || boughtAt;
  const cashAsset = cashAssetFromSelect(els.buyCashAssetId);
  const memo = els.buyMemo?.value.trim() || "";

  if (quantity <= 0) return { ok: false, message: strict ? "추가매수 수량은 0보다 커야 합니다." : "" };
  if (buyPrice <= 0) return { ok: false, message: strict ? "매수가를 입력하세요." : "" };
  if (type === "US" && fxRate <= 0) return { ok: false, message: strict ? "달러 환율을 입력하세요." : "" };
  if (!cashAsset) return { ok: false, message: strict ? "매수대금을 결제할 CASH 계좌를 선택하세요." : "" };
  if (settlementDate < boughtAt) return { ok: false, message: strict ? "결제일은 매수일보다 빠를 수 없습니다." : "" };
  if (memo.length > IMPORT_STRING_LIMITS.note) {
    return { ok: false, message: strict ? "추가매수 메모는 10,000자 이하로 입력하세요." : "" };
  }

  const effectiveFx = type === "US" ? fxRate : 1;
  const previousQuantity = Number(asset.quantity || 0);
  const previousAveragePrice = Number(asset.averagePrice || 0);
  const nextQuantity = previousQuantity + quantity;
  const previousCost = previousQuantity * previousAveragePrice;
  const addedCost = quantity * buyPrice;
  const nextAveragePrice = nextQuantity > 0 ? (previousCost + addedCost) / nextQuantity : buyPrice;
  const grossAmount = quantity * buyPrice * effectiveFx;
  const netCashAmountKRW = grossAmount + fees;
  if (netCashAmountKRW > Number(cashAsset.amount || 0) + 0.0001) {
    return {
      ok: false,
      message: `선택한 CASH 잔액(${money(cashAsset.amount || 0)})보다 결제금액(${money(netCashAmountKRW)})이 큽니다.`
    };
  }

  return {
    ok: true,
    asset,
    cashAsset,
    boughtAt,
    settlementDate,
    quantity,
    buyPrice,
    fxRate: effectiveFx,
    fees,
    grossAmount,
    netCashAmountKRW,
    previousQuantity,
    previousAveragePrice,
    nextQuantity,
    nextAveragePrice,
    memo
  };
}

function normalizeAssetKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function updateAssetFormForType() {
  const type = normalizeAssetType(els.assetCategory.value);
  const manualValued = isManualValuedType(type);
  const marketValued = isMarketType(type);
  const lockedForLedger = els.assetForm?.dataset.mode === "edit";
  const editingAsset = lockedForLedger
    ? state.assets.find((asset) => asset.id === els.assetId?.value) || null
    : null;
  const hasLedgerHistory = Boolean(editingAsset) && state.events.some((event) => (
    event.assetId === editingAsset.id
      || event.cashAssetId === editingAsset.id
      || event.counterCashAssetId === editingAsset.id
  ));
  const tickerLockedForLedger = hasLedgerHistory && !openingOnlyLedgerEventForAsset(editingAsset);
  els.assetAmount.disabled = !manualValued || (lockedForLedger && type !== "MANUAL");
  els.assetAmount.required = manualValued;
  els.assetAmount.placeholder = "금액 입력";
  if (els.assetAmountField) els.assetAmountField.hidden = !manualValued;
  if (els.manualSubtypeField) els.manualSubtypeField.hidden = type !== "MANUAL";
  if (!manualValued) els.assetAmount.value = "";
  els.assetQuantity.disabled = !marketValued || lockedForLedger;
  els.assetQuantity.required = marketValued;
  els.assetAveragePrice.disabled = !marketValued || lockedForLedger;
  els.assetAveragePrice.required = marketValued;
  if (!marketValued) {
    els.assetQuantity.value = "";
    els.assetAveragePrice.value = "";
  }
  if (type !== "MANUAL" && els.assetManualSubtype) els.assetManualSubtype.value = "AUTO";
  els.assetTicker.disabled = !marketValued || tickerLockedForLedger;
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

function parseNumericValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return Number.NaN;
  const negative = /^\(.*\)$/.test(raw);
  const normalized = raw.replace(/[₩$원,\s()]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed * (negative ? -1 : 1) : Number.NaN;
}

function parseAmount(value) {
  const parsed = parseNumericValue(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateAssetInput(asset, { allowZeroBalance = false } = {}) {
  const type = assetType(asset);
  if (!asset.name) return "자산명을 입력하세요.";
  if (String(asset.name).length > IMPORT_STRING_LIMITS.short) return "자산명은 500자 이하로 입력하세요.";
  if (String(asset.account || "").length > IMPORT_STRING_LIMITS.short) return "계좌명은 500자 이하로 입력하세요.";
  if (String(asset.note || "").length > IMPORT_STRING_LIMITS.note) return "자산 메모는 10,000자 이하로 입력하세요.";
  if (isManualValuedType(type) && !(asset.amount > 0) && !allowZeroBalance) {
    return "현금·수동 자산의 평가금액은 0보다 커야 합니다.";
  }
  if (isMarketType(type) && !(asset.quantity > 0) && !allowZeroBalance) {
    return "시장가격 자산의 보유수량은 0보다 커야 합니다.";
  }
  if (isMarketType(type) && !(asset.averagePrice > 0) && !allowZeroBalance) {
    return "시장가격 자산의 평단가는 0보다 커야 합니다.";
  }
  return "";
}

function watchlistDecisionFieldsFromForm() {
  const fields = normalizeDecisionProfileFields({
    investmentRole: els.watchlistRole?.value,
    thesis: els.watchlistThesis?.value,
    returnSource: els.watchlistReturnSource?.value,
    horizon: els.watchlistHorizon?.value,
    conviction: els.watchlistConviction?.value,
    kpis: els.watchlistKpis?.value,
    catalysts: els.watchlistCatalysts?.value,
    invalidation: els.watchlistInvalidation?.value,
    deceleration: els.watchlistDeceleration?.value,
    nextReviewAt: els.watchlistNextReviewAt?.value
  });
  delete fields.lastReviewedAt;
  delete fields.reviewStatus;
  return fields;
}

function setWatchlistFormStatus(message, error = false) {
  if (!els.watchlistFormStatus) return;
  els.watchlistFormStatus.textContent = message;
  els.watchlistFormStatus.classList.toggle("negative", error);
}

function resetWatchlistForm() {
  els.watchlistForm?.reset();
  if (els.watchlistForm) delete els.watchlistForm.dataset.loadedSubjectKey;
  if (els.watchlistId) els.watchlistId.value = "";
  if (els.watchlistType) els.watchlistType.value = "KRX";
  if (els.watchlistRole) els.watchlistRole.value = "UNASSIGNED";
  if (els.watchlistHorizon) els.watchlistHorizon.value = "UNSET";
  if (els.watchlistConviction) els.watchlistConviction.value = "UNSET";
  if (els.saveWatchlistBtn) els.saveWatchlistBtn.textContent = "관심종목 저장";
  if (els.watchlistMigrationConflict) els.watchlistMigrationConflict.innerHTML = "";
  setWatchlistFormStatus("관심종목은 보유 자산과 포트폴리오 집중도에 포함되지 않습니다.");
}

function fillWatchlistDecisionFields(profile) {
  els.watchlistRole.value = profile.investmentRole;
  els.watchlistHorizon.value = profile.horizon;
  els.watchlistConviction.value = profile.conviction;
  els.watchlistThesis.value = profile.thesis;
  els.watchlistReturnSource.value = profile.returnSource;
  els.watchlistKpis.value = profile.kpis;
  els.watchlistCatalysts.value = profile.catalysts;
  els.watchlistInvalidation.value = profile.invalidation;
  els.watchlistDeceleration.value = profile.deceleration;
  els.watchlistNextReviewAt.value = profile.nextReviewAt;
  if (els.watchlistMigrationConflict) {
    els.watchlistMigrationConflict.innerHTML = decisionMigrationConflictHtml(profile);
  }
}

function fillWatchlistForm(item) {
  if (!item || !els.watchlistForm) return;
  const profile = decisionProfileForWatchlist(item);
  els.watchlistId.value = item.id;
  els.watchlistName.value = item.name;
  els.watchlistTicker.value = item.ticker;
  els.watchlistType.value = item.type;
  fillWatchlistDecisionFields(profile);
  els.watchlistForm.dataset.loadedSubjectKey = decisionSubjectKeyForWatchlist(item);
  if (els.saveWatchlistBtn) els.saveWatchlistBtn.textContent = "관심종목 수정 저장";
  setWatchlistFormStatus(`${item.name} 판단 기준을 수정하고 있습니다.`);
  els.watchlistName.focus();
  els.watchlistForm.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function decisionSubjectInUse(subjectKey, { excludingWatchlistId = "" } = {}) {
  return state.assets.some((asset) => decisionSubjectKeyForAsset(asset) === subjectKey)
    || state.watchlist.some((item) => item.id !== excludingWatchlistId && decisionSubjectKeyForWatchlist(item) === subjectKey);
}

els.watchlistForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = ["KRX", "US"].includes(els.watchlistType.value) ? els.watchlistType.value : "KRX";
  const ticker = normalizeTicker(type, els.watchlistTicker.value);
  const tickerError = validateTicker(type, ticker);
  if (tickerError) {
    setWatchlistFormStatus(tickerError, true);
    els.watchlistTicker.focus();
    return;
  }
  const name = els.watchlistName.value.trim() || priceNameForTicker(type, ticker);
  if (!name) {
    setWatchlistFormStatus("종목명을 입력하세요.", true);
    els.watchlistName.focus();
    return;
  }
  const editingId = els.watchlistId.value;
  const previous = state.watchlist.find((item) => item.id === editingId);
  const nextItem = normalizeWatchlistItem({
    id: editingId || `watch-${uid()}`,
    name,
    ticker,
    type,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const nextSubjectKey = decisionSubjectKeyForWatchlist(nextItem);
  const previousSubjectKey = previous ? decisionSubjectKeyForWatchlist(previous) : "";
  const duplicate = state.watchlist.find((item) => item.id !== editingId && decisionSubjectKeyForWatchlist(item) === nextSubjectKey);
  if (duplicate) {
    setWatchlistFormStatus(`${duplicate.name}과 같은 시장·티커가 이미 관심종목에 있습니다.`, true);
    return;
  }
  const heldAsset = state.assets.find((asset) => decisionSubjectKeyForAsset(asset) === nextSubjectKey);
  if (heldAsset && previousSubjectKey !== nextSubjectKey) {
    setWatchlistFormStatus(`${heldAsset.name}은(는) 이미 보유 중입니다. 자산 상세에서 판단 기준을 관리하세요.`, true);
    els.watchlistTicker.focus();
    return;
  }
  const targetProfile = state.decisionProfiles.find((profile) => profile.subjectKey === nextSubjectKey);
  if (targetProfile
    && previousSubjectKey !== nextSubjectKey
    && els.watchlistForm.dataset.loadedSubjectKey !== nextSubjectKey) {
    const loadExisting = confirm(
      "이 종목의 기존 판단 기록이 있습니다. 기존 기록을 폼에 불러올까요?\n\n확인: 기존 판단 불러오기\n취소: 현재 작성한 초안 유지"
    );
    if (loadExisting) fillWatchlistDecisionFields(targetProfile);
    else if (els.watchlistMigrationConflict) {
      els.watchlistMigrationConflict.innerHTML = existingDecisionProfileHtml(targetProfile);
    }
    els.watchlistForm.dataset.loadedSubjectKey = nextSubjectKey;
    setWatchlistFormStatus(loadExisting
      ? "이 종목의 기존 판단 기록을 불러왔습니다. 내용을 확인한 뒤 다시 저장하세요."
      : "작성 중인 초안을 유지했습니다. 아래 기존 기록과 비교한 뒤 다시 저장하세요.");
    if (loadExisting) els.watchlistRole.focus();
    else els.watchlistMigrationConflict?.querySelector("summary")?.focus();
    return;
  }

  const index = state.watchlist.findIndex((item) => item.id === editingId);
  if (index >= 0) state.watchlist[index] = nextItem;
  else state.watchlist.push(nextItem);
  const existingProfile = targetProfile || (previous ? decisionProfileForWatchlist(previous) : {});
  upsertDecisionProfile(nextSubjectKey, {
    ...existingProfile,
    ...watchlistDecisionFieldsFromForm(),
    migrationConflicts: []
  }, {
    name: nextItem.name,
    type: nextItem.type,
    ticker: nextItem.ticker
  });
  if (previousSubjectKey && previousSubjectKey !== nextSubjectKey && !decisionSubjectInUse(previousSubjectKey)) {
    state.decisionProfiles = state.decisionProfiles.filter((profile) => profile.subjectKey !== previousSubjectKey);
  }
  resetWatchlistForm();
  render();
  showStatusNotice(index >= 0 ? "관심종목 판단 기준을 수정했습니다." : "관심종목을 추가했습니다.");
});

els.cancelWatchlistBtn?.addEventListener("click", resetWatchlistForm);

els.watchlistType?.addEventListener("change", () => {
  if (!els.watchlistTicker) return;
  if (els.watchlistForm) delete els.watchlistForm.dataset.loadedSubjectKey;
  if (els.watchlistMigrationConflict) els.watchlistMigrationConflict.innerHTML = "";
  els.watchlistTicker.placeholder = els.watchlistType.value === "US" ? "예: AAPL, QQQ" : "예: 005930, 0092B0";
});

els.watchlistTicker?.addEventListener("input", () => {
  if (els.watchlistForm) delete els.watchlistForm.dataset.loadedSubjectKey;
  if (els.watchlistMigrationConflict) els.watchlistMigrationConflict.innerHTML = "";
});

els.watchlistList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-watchlist-action]");
  if (!button) return;
  const item = state.watchlist.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.watchlistAction === "edit") {
    fillWatchlistForm(item);
    return;
  }
  if (button.dataset.watchlistAction !== "delete" || !confirm(`${item.name} 관심종목을 삭제할까요?`)) return;
  const itemIndex = state.watchlist.findIndex((entry) => entry.id === item.id);
  const subjectKey = decisionSubjectKeyForWatchlist(item);
  const profile = state.decisionProfiles.find((entry) => entry.subjectKey === subjectKey);
  state.watchlist.splice(itemIndex, 1);
  const profileRemoved = !decisionSubjectInUse(subjectKey);
  if (profileRemoved) state.decisionProfiles = state.decisionProfiles.filter((entry) => entry.subjectKey !== subjectKey);
  resetWatchlistForm();
  render();
  showUndoNotice(`${item.name} 관심종목을 삭제했습니다.`, () => {
    state.watchlist.splice(Math.max(0, itemIndex), 0, item);
    if (profileRemoved && profile && !state.decisionProfiles.some((entry) => entry.subjectKey === subjectKey)) {
      state.decisionProfiles.push(profile);
    }
    render();
  });
});

els.assetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const editingId = els.assetId.value;
  const editingAsset = state.assets.find((item) => item.id === editingId) || null;
  const type = editingAsset ? assetType(editingAsset) : normalizeAssetType(els.assetCategory.value);
  const openingEventToCorrect = openingOnlyLedgerEventForAsset(editingAsset);
  const hasLedgerHistory = Boolean(editingAsset) && state.events.some((ledgerEvent) => (
    ledgerEvent.assetId === editingAsset.id
      || ledgerEvent.cashAssetId === editingAsset.id
      || ledgerEvent.counterCashAssetId === editingAsset.id
  ));
  const tickerLockedForLedger = hasLedgerHistory && !openingEventToCorrect;
  const ticker = tickerLockedForLedger && isMarketType(type)
    ? editingAsset.ticker
    : normalizeTicker(type, els.assetTicker.value);
  const asset = {
    id: els.assetId.value || uid(),
    name: els.assetName.value.trim() || priceNameForTicker(type, ticker),
    ticker,
	    type,
	    account: els.assetAccount.value.trim(),
	    accountClass: normalizeAccountClass(els.assetAccountClass?.value),
	    manualSubtype: type === "MANUAL" ? normalizeManualSubtype(els.assetManualSubtype?.value) : "AUTO",
	    amount: editingAsset
      ? type === "MANUAL" ? numberValue(els.assetAmount) : Number(editingAsset.amount || 0)
      : isManualValuedType(type) ? numberValue(els.assetAmount) : 0,
    quantity: editingAsset ? Number(editingAsset.quantity || 0) : decimalValue(els.assetQuantity),
    averagePrice: editingAsset ? Number(editingAsset.averagePrice || 0) : decimalValue(els.assetAveragePrice),
    note: els.assetNote.value.trim(),
    updatedAt: new Date().toISOString()
  };

  const tickerError = validateTicker(type, asset.ticker);
  if (tickerError) {
    alert(tickerError);
    return;
  }
  const assetError = validateAssetInput(asset, { allowZeroBalance: Boolean(editingAsset) });
  if (assetError) {
    alert(assetError);
    return;
  }

  const duplicateAsset = state.assets.find((item) => (
    item.id !== editingId && assetIdentity(item) === assetIdentity(asset)
  ));
  if (duplicateAsset) {
    alert(`이미 같은 자산이 등록되어 있습니다: ${duplicateAsset.name} · ${duplicateAsset.account || "계좌 미지정"}. 기존 자산에서 매수·매도 또는 현금흐름을 기록하세요.`);
    return;
  }

  const beforeMutation = storageSafeState();
  try {
    const index = editingId
      ? state.assets.findIndex((item) => item.id === editingId)
      : -1;
    const previousAsset = index >= 0 ? state.assets[index] : null;
    const previousSubjectKey = previousAsset ? decisionSubjectKeyForAsset(previousAsset) : "";
    const previousProfile = previousSubjectKey
      ? state.decisionProfiles.find((profile) => profile.subjectKey === previousSubjectKey)
      : null;
    if (index >= 0) state.assets[index] = normalizeAsset({ ...state.assets[index], ...asset, id: state.assets[index].id });
    else state.assets.push(normalizeAsset(asset));

    const savedAsset = index >= 0 ? state.assets[index] : state.assets.at(-1);
    let valuationChanged = false;
    let openingCorrected = false;
    if (index < 0) {
      const openingDate = localDateInputValue();
      if (!state.ledgerMeta.baselineDate) state.ledgerMeta.baselineDate = openingDate;
      const openingEvent = unwrapLedgerResult(ledgerEngine().createOpeningBalanceEvent(savedAsset, {
        eventId: `opening-${savedAsset.id}`,
        openingDate,
        accountId: accountIdForAsset(savedAsset),
        ...(isMarketType(assetType(savedAsset)) ? { instrumentKey: decisionSubjectKeyForAsset(savedAsset) } : {}),
        sourceSystem: "ASSETTRAIL_ASSET_OPENING",
        sourceId: savedAsset.id,
        note: "자산 등록 시 사용자가 입력한 명시적 기초잔액"
      }), "자산 기초잔액");
      appendLedgerEvents([openingEvent]);
    } else if (openingEventToCorrect
      && isMarketType(type)
      && normalizeTicker(type, previousAsset.ticker) !== normalizeTicker(type, savedAsset.ticker)) {
      const auditDate = [localDateInputValue(), openingEventToCorrect.tradeDate].sort().at(-1);
      const replacementBase = unwrapLedgerResult(ledgerEngine().createOpeningBalanceEvent(savedAsset, {
        eventId: `event-${uid()}`,
        openingDate: openingEventToCorrect.tradeDate,
        accountId: accountIdForAsset(savedAsset),
        instrumentKey: decisionSubjectKeyForAsset(savedAsset),
        currency: openingEventToCorrect.currency,
        ...(openingEventToCorrect.fxRateKnown
          ? { fxRate: openingEventToCorrect.fxRate }
          : {}),
        sequence: ledgerSequence(),
        ...(openingEventToCorrect.sourceSystem && openingEventToCorrect.sourceId
          ? {
              sourceSystem: openingEventToCorrect.sourceSystem,
              sourceId: openingEventToCorrect.sourceId
            }
          : {}),
        note: "기초잔액 종목 식별자 정정"
      }), "자산 기초잔액 정정");
      const replacement = normalizeLedgerEvent({
        ...replacementBase,
        correctsEventId: openingEventToCorrect.eventId,
        reason: "자산 종목 식별자 수정",
        auditDate,
        createdAt: new Date().toISOString()
      });
      appendLedgerEvents([replacement]);
      openingCorrected = true;
    } else if (type === "MANUAL" && Math.abs(Number(previousAsset.amount || 0) - Number(savedAsset.amount || 0)) > 0.01) {
      const valuationDate = localDateInputValue();
      const valuationEvent = normalizeLedgerEvent({
        eventId: `event-${uid()}`,
        type: "VALUATION",
        accountId: accountIdForAsset(savedAsset),
        assetId: savedAsset.id,
        tradeDate: valuationDate,
        settlementDate: valuationDate,
        sequence: ledgerSequence(),
        amount: savedAsset.amount,
        currency: "KRW",
        fxRate: 1,
        note: `수동 평가금액 조정 (${money(previousAsset.amount || 0)} → ${money(savedAsset.amount || 0)})`,
        createdAt: new Date().toISOString()
      });
      appendLedgerEvents([valuationEvent]);
      valuationChanged = true;
    }
    const nextSubjectKey = decisionSubjectKeyForAsset(savedAsset);
    let preservedProfileConflict = false;
    const previousSubjectStillInUse = previousSubjectKey
      ? decisionSubjectInUse(previousSubjectKey)
      : false;
    if (previousProfile && previousSubjectKey !== nextSubjectKey && !previousSubjectStillInUse) {
      const targetProfileIndex = state.decisionProfiles.findIndex((profile) => profile.subjectKey === nextSubjectKey);
      if (targetProfileIndex < 0) {
        upsertDecisionProfile(nextSubjectKey, previousProfile, {
          name: savedAsset.name,
          type: assetType(savedAsset),
          ticker: savedAsset.ticker
        });
      } else {
        const targetProfile = state.decisionProfiles[targetProfileIndex];
        const previousConflicts = normalizeDecisionMigrationConflicts(previousProfile.migrationConflicts);
        if (decisionProfileFieldsFingerprint(targetProfile) !== decisionProfileFieldsFingerprint(previousProfile)
          || previousConflicts.length) {
          const previousSource = decisionMigrationConflictFor("asset", previousProfile, {
            ...previousAsset,
            name: `${previousAsset.name}${previousAsset.ticker ? ` (${previousAsset.ticker})` : ""}`
          });
          state.decisionProfiles[targetProfileIndex] = normalizeDecisionProfile({
            ...targetProfile,
            reviewStatus: targetProfile.reviewStatus === "INVALIDATED" ? "INVALIDATED" : "REVIEW",
            migrationConflicts: [
              ...normalizeDecisionMigrationConflicts(targetProfile.migrationConflicts),
              ...previousConflicts,
              previousSource
            ]
          });
          preservedProfileConflict = true;
        }
      }
      state.decisionProfiles = state.decisionProfiles.filter((profile) => profile.subjectKey !== previousSubjectKey);
    }

    applyPricesToAssets();
    resetAssetForm();
    if (!render()) throw new Error("변경 내용을 로컬 저장소에 기록하지 못했습니다.");
    if (preservedProfileConflict) {
      showStatusNotice("대상 종목의 기존 판단은 유지하고, 이전 종목의 판단은 비교할 원본으로 보존했습니다.");
    } else if (openingCorrected) {
      showStatusNotice("기초잔액 원본을 보존하고 종목 식별자 정정 이벤트를 저장했습니다.");
    } else if (valuationChanged) {
      showStatusNotice("원본 평가 이력을 보존하고 수동 자산 평가조정 이벤트를 저장했습니다.");
    }
  } catch (error) {
    console.error(error);
    replaceState(beforeMutation);
    renderCurrentViewWithoutPersist();
    alert(`자산 변경을 저장하지 않았습니다. ${error.message}`);
  }
});

els.buyForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseBuyForm(true);
  if (!result.ok) {
    alert(result.message);
    return;
  }

  const ledgerEvent = createBuyLedgerEvent(result);
  const journalCreated = Boolean(els.buyJournalEnabled?.checked);
  const saved = commitLedgerMutation(() => {
    appendLedgerEvents([ledgerEvent]);
    const updatedAsset = state.assets.find((asset) => asset.id === result.asset.id);
    if (journalCreated) state.tradeJournalEntries.push(createJournalEntryFromBuy(updatedAsset, result, ledgerEvent.eventId));
    return ledgerEvent;
  });
  if (!saved.ok) return;
  resetBuyForm();
  uiState.investmentRecordTab = "LEDGER";
  showUndoNotice(journalCreated ? "추가매수와 매매일지를 함께 저장했습니다." : "추가매수를 저장했습니다.", () => {
    cancelLedgerEvent(ledgerEvent.eventId, "추가매수 저장 직후 되돌리기");
  });
});

els.sellForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseSellForm(true);
  if (!result.ok) {
    alert(result.message);
    return;
  }

  const { asset } = result;
  const ledgerEvent = createSellLedgerEvent(result);
  const trade = normalizeRealizedTrade({ ...result.trade, ledgerEventId: ledgerEvent.eventId });
  const journalCreated = Boolean(els.sellJournalEnabled?.checked);
  const saved = commitLedgerMutation(() => {
    appendLedgerEvents([ledgerEvent]);
    state.realizedTrades.push(trade);
    if (journalCreated) state.tradeJournalEntries.push(createJournalEntryFromTrade(asset, trade, ledgerEvent.eventId));
    return ledgerEvent;
  });
  if (!saved.ok) return;
  resetSellForm();
  uiState.investmentRecordTab = "LEDGER";
  showUndoNotice(journalCreated ? "매도 기록과 매매일지를 함께 저장했습니다." : "매도 기록을 저장했습니다. 실현손익에서 일지를 연결할 수 있습니다.", () => {
    cancelLedgerEvent(ledgerEvent.eventId, "매도 저장 직후 되돌리기");
  });
});

function handleAssetAction(button) {
  const asset = state.assets.find((item) => item.id === button.dataset.id);
  if (!asset) return;

  if (button.dataset.action === "detail") {
    openAssetDetail(asset.id, button);
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
    els.assetCategory.disabled = true;
    els.assetName.focus();
  }

  if (button.dataset.action !== "delete") return;

  const hasLedgerHistory = state.events.some((event) => (
    event.assetId === asset.id
      || event.cashAssetId === asset.id
      || event.counterCashAssetId === asset.id
  ));
  const openingEventToCancel = openingOnlyLedgerEventForAsset(asset);
  if (hasLedgerHistory && !openingEventToCancel) {
    alert("거래·현금흐름 이력이 연결된 자산은 삭제할 수 없습니다. 보유수량과 현금잔액은 원장 이벤트로 0까지 조정하고 기록은 보존하세요.");
    return;
  }

  const confirmation = openingEventToCancel
    ? `${asset.name} 자산을 삭제할까요?\n\n계좌: ${asset.account || "계좌 미지정"}\n평가금액: ${money(assetValue(asset))}\n\n기초잔액은 삭제하지 않고 취소 이력으로 보존됩니다.`
    : `${asset.name} 자산을 삭제할까요?\n\n계좌: ${asset.account || "계좌 미지정"}\n평가금액: ${money(assetValue(asset))}\n\n삭제 직후에는 되돌리기 버튼으로 복구할 수 있습니다.`;
  if (!confirm(confirmation)) return;

  if (openingEventToCancel) {
    const auditDate = [localDateInputValue(), openingEventToCancel.tradeDate].sort().at(-1);
    const cancellation = normalizeLedgerEvent({
      eventId: `event-${uid()}`,
      type: "CANCEL",
      accountId: openingEventToCancel.accountId,
      targetEventId: openingEventToCancel.eventId,
      tradeDate: auditDate,
      settlementDate: auditDate,
      auditDate,
      sequence: ledgerSequence(),
      reason: "잘못 등록한 자산의 기초잔액 취소",
      createdAt: new Date().toISOString()
    });
    const saved = commitLedgerMutation(() => {
      appendLedgerEvents([cancellation]);
      state.assets = state.assets.filter((item) => item.id !== asset.id);
      return cancellation;
    });
    if (!saved.ok) return;
    resetAssetForm();
    resetSellForm();
    resetBuyForm();
    showStatusNotice(`${asset.name} 자산을 정리하고 기초잔액 취소 이력을 보존했습니다.`);
    return;
  }

  if (!hasLedgerHistory) {
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

function openAssetDetail(assetId, opener = document.activeElement, {
  focusDecision = false,
  focusSelector = "",
  bodyScrollTop = null,
  statusMessage = ""
} = {}) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (!asset || !els.assetDetailDrawer || !els.assetDetailOverlay) return;
  assetDetailOpener = opener && typeof opener.focus === "function" ? opener : null;
  const decisionProfile = decisionProfileForAsset(asset);
  const subjectKey = decisionSubjectKeyForAsset(asset);
  const sharedAssetCount = state.assets.filter((item) => decisionSubjectKeyForAsset(item) === subjectKey).length;
  const reviewTiming = reviewTimingForProfile(decisionProfile);
  const reviewTimingLabel = reviewTiming === "overdue"
    ? `검토기한 초과 · ${decisionProfile.nextReviewAt}`
    : reviewTiming === "dueToday"
      ? "오늘 검토"
      : decisionProfile.nextReviewAt
        ? `다음 검토 ${decisionProfile.nextReviewAt}`
        : "검토일 미설정";
  const value = assetValue(asset);
  const gain = assetGain(asset);
  const cost = assetCost(asset);
  const gainRate = gain === null || !cost ? null : gain / cost;
  const tone = gain > 0 ? "positive" : gain < 0 ? "negative" : "";
  const arrow = gain > 0 ? "▲ " : gain < 0 ? "▼ " : "";
  const gainLabel = assetType(asset) === "US" ? "평가손익(환차손익 제외)" : "평가손익";
  const gainText = gain === null
    ? "—"
    : `${arrow}${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`;
  const noteHtml = asset.note
    ? `<p>${escapeHtml(asset.note)}</p>`
    : `<p class="detail-empty">작성된 메모가 없어요. 일지에서 판단을 기록해 보세요.</p>`;
  els.assetDetailDrawer.innerHTML = `
    <div class="detail-head">
      <div class="detail-id">
        <strong id="assetDetailTitle">${escapeHtml(asset.name)}</strong>
        <span class="asset-sub">
          ${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}
          <span class="badge">${escapeHtml(assetTypeLabel(asset))}</span>
          ${decisionRoleBadge(decisionProfile)}
          ${asset.account ? `<span class="asset-account">${escapeHtml(asset.account)}</span>` : ""}
        </span>
      </div>
      <button class="icon-button detail-close" type="button" data-detail-close aria-label="상세 닫기">✕</button>
    </div>
    <div class="detail-body">
      <div class="detail-value-card">
        <span class="detail-kicker">평가금액</span>
        <strong class="detail-value">${money(value)}</strong>
        <span class="detail-gain ${tone}">${gainLabel} ${gainText}</span>
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
      <section class="decision-section detail-decision-section ${reviewTiming === "overdue" ? "review-overdue" : ""}" aria-labelledby="assetDecisionHeading">
        <div class="decision-section-head detail-decision-head">
          <div>
            <span class="detail-kicker">Investment decision</span>
            <h3 id="assetDecisionHeading">투자 의사결정</h3>
          </div>
          <span class="decision-status status-${escapeHtml(reviewTiming)}">${escapeHtml(reviewTimingLabel)}</span>
        </div>
        <p class="decision-profile-guide">${sharedAssetCount > 1
          ? `같은 종목의 ${sharedAssetCount}개 계좌 보유가 이 가설을 함께 사용합니다.`
          : "보유 이유와 확인 조건을 구조화해 다음 검토 때 같은 기준으로 판단합니다."}</p>
        ${decisionMigrationConflictHtml(decisionProfile)}
        <form class="decision-form" data-asset-decision-form data-id="${escapeHtml(asset.id)}">
          <div class="decision-form-grid">
            <label>
              자산 역할
              <select name="investmentRole">${decisionSelectOptions(INVESTMENT_ROLE_LABELS, decisionProfile.investmentRole)}</select>
            </label>
            <label>
              투자 기간
              <select name="horizon">${decisionSelectOptions(INVESTMENT_HORIZON_LABELS, decisionProfile.horizon)}</select>
            </label>
            <label>
              확신도
              <select name="conviction">${decisionSelectOptions(CONVICTION_LABELS, decisionProfile.conviction)}</select>
            </label>
            <label>
              검토 상태
              <select name="reviewStatus">${decisionSelectOptions(REVIEW_STATUS_LABELS, decisionProfile.reviewStatus)}</select>
            </label>
            <label class="wide-field">
              투자 가설
              <textarea name="thesis" rows="3" maxlength="10000" placeholder="왜 이 자산을 보유하는지 적어두세요.">${escapeHtml(decisionProfile.thesis)}</textarea>
            </label>
            <label class="wide-field">
              기대수익 원천
              <textarea name="returnSource" rows="2" maxlength="10000" placeholder="실적 성장, 밸류에이션 정상화, 배당 등">${escapeHtml(decisionProfile.returnSource)}</textarea>
            </label>
            <label class="wide-field">
              관찰 KPI
              <textarea name="kpis" rows="2" maxlength="10000" placeholder="매출, 마진, 수주, 점유율처럼 반복 확인할 지표">${escapeHtml(decisionProfile.kpis)}</textarea>
            </label>
            <label class="wide-field">
              촉매
              <textarea name="catalysts" rows="2" maxlength="10000" placeholder="가설이 현실화될 계기와 예상 시점">${escapeHtml(decisionProfile.catalysts)}</textarea>
            </label>
            <label class="wide-field">
              가설 무효화 조건
              <textarea name="invalidation" rows="2" maxlength="10000" placeholder="더는 기존 가설을 유지할 수 없는 조건">${escapeHtml(decisionProfile.invalidation)}</textarea>
            </label>
            <label class="wide-field">
              감속 조건
              <textarea name="deceleration" rows="2" maxlength="10000" placeholder="비중 확대를 멈추거나 판단을 보류할 조건">${escapeHtml(decisionProfile.deceleration)}</textarea>
            </label>
            <label>
              다음 검토일
              <input name="nextReviewAt" type="date" value="${escapeHtml(decisionProfile.nextReviewAt)}">
            </label>
            <label>
              마지막 검토일
              <input name="lastReviewedAt" type="date" value="${escapeHtml(decisionProfile.lastReviewedAt)}">
            </label>
          </div>
          ${riskTagEditorHtml(decisionProfile)}
          <p class="field-help">집중도 계산은 계좌별 보유 행을 합치지만, 매수·매도 결론을 자동으로 만들지 않습니다.</p>
          <p class="decision-form-status" data-decision-status role="status" aria-live="polite"></p>
          <div class="decision-form-actions">
            <button class="primary-button" type="submit" data-decision-action="save">의사결정 저장</button>
            <button class="ghost-button" type="button" data-decision-action="mark-reviewed">오늘 검토 완료</button>
          </div>
        </form>
      </section>
    </div>
    <div class="detail-actions">
      ${canBuyAsset(asset) ? `<button class="primary-button compact-button" type="button" data-action="buy" data-id="${escapeHtml(asset.id)}">추가매수</button>` : ""}
      ${canSellAsset(asset) ? `<button class="ghost-button" type="button" data-action="sell" data-id="${escapeHtml(asset.id)}">매도</button>` : ""}
      <button class="ghost-button" type="button" data-action="journal" data-id="${escapeHtml(asset.id)}">일지</button>
      <button class="ghost-button" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}">자산 정보 수정</button>
      <button class="ghost-button danger-action" type="button" data-action="delete" data-id="${escapeHtml(asset.id)}">삭제</button>
    </div>
  `;
  const decisionForm = els.assetDetailDrawer.querySelector("[data-asset-decision-form]");
  if (decisionForm) decisionForm.dataset.initialSnapshot = decisionFormSnapshot(decisionForm);
  const detailBody = els.assetDetailDrawer.querySelector(".detail-body");
  if (detailBody && Number.isFinite(bodyScrollTop)) detailBody.scrollTop = Math.max(0, bodyScrollTop);
  const detailStatus = els.assetDetailDrawer.querySelector("[data-decision-status]");
  els.assetDetailOverlay.hidden = false;
  els.app?.setAttribute("inert", "");
  if (detailStatus) detailStatus.textContent = statusMessage;
  const focusTarget = (focusSelector && els.assetDetailDrawer.querySelector(focusSelector))
    || (focusDecision
      ? els.assetDetailDrawer.querySelector('[name="investmentRole"]')
      : els.assetDetailDrawer.querySelector("[data-detail-close]"));
  focusTarget?.focus();
}

function decisionFormSnapshot(form) {
  return JSON.stringify(assetDecisionFieldsFromForm(form));
}

function hasUnsavedAssetDecisionChanges() {
  const form = els.assetDetailDrawer?.querySelector("[data-asset-decision-form]");
  if (!form?.dataset.initialSnapshot) return false;
  return form.dataset.initialSnapshot !== decisionFormSnapshot(form);
}

function confirmDiscardAssetDecisionChanges() {
  return !hasUnsavedAssetDecisionChanges()
    || confirm("저장하지 않은 투자 의사결정 변경이 있습니다. 변경을 버리고 계속할까요?");
}

function closeAssetDetail({ restoreFocus = true, discardChanges = false } = {}) {
  if (!els.assetDetailOverlay || els.assetDetailOverlay.hidden) return;
  if (!discardChanges && !confirmDiscardAssetDecisionChanges()) return false;
  els.assetDetailOverlay.hidden = true;
  els.app?.removeAttribute("inert");
  const opener = assetDetailOpener;
  assetDetailOpener = null;
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  return true;
}

function assetDecisionFieldsFromForm(form) {
  const value = (name) => form.elements.namedItem(name)?.value || "";
  return {
    ...normalizeDecisionProfileFields({
      investmentRole: value("investmentRole"),
      thesis: value("thesis"),
      returnSource: value("returnSource"),
      horizon: value("horizon"),
      conviction: value("conviction"),
      kpis: value("kpis"),
      catalysts: value("catalysts"),
      invalidation: value("invalidation"),
      deceleration: value("deceleration"),
      nextReviewAt: value("nextReviewAt"),
      lastReviewedAt: value("lastReviewedAt"),
      reviewStatus: value("reviewStatus")
    }),
    riskTags: normalizeRiskTags(Object.fromEntries(Object.entries(RISK_TAG_INPUT_NAMES).map(([key, name]) => [
      key,
      value(name)
    ])))
  };
}

function saveAssetDecisionForm(form, { markReviewed = false } = {}) {
  const asset = state.assets.find((item) => item.id === form?.dataset.id);
  if (!asset) return false;
  const bodyScrollTop = els.assetDetailDrawer?.querySelector(".detail-body")?.scrollTop || 0;
  const nextFields = assetDecisionFieldsFromForm(form);
  if (!markReviewed) nextFields.migrationConflicts = [];
  let clearedPastReviewDate = false;
  if (markReviewed) {
    const todayKey = localDateInputValue();
    nextFields.lastReviewedAt = todayKey;
    if (nextFields.nextReviewAt && nextFields.nextReviewAt <= todayKey) {
      nextFields.nextReviewAt = "";
      clearedPastReviewDate = true;
    }
    if (["UNSET", "REVIEW"].includes(nextFields.reviewStatus)) nextFields.reviewStatus = "ACTIVE";
  }
  upsertDecisionProfile(decisionSubjectKeyForAsset(asset), nextFields, {
    name: asset.name,
    type: assetType(asset),
    ticker: asset.ticker
  });
  render();
  const refreshedAssetOpener = uiState.activeView === "ASSETS"
    ? [...document.querySelectorAll('[data-action="detail"][data-id]')]
        .find((button) => button.dataset.id === asset.id)
    : null;
  const opener = assetDetailOpener?.isConnected
    ? assetDetailOpener
    : refreshedAssetOpener
      || document.querySelector(`[data-nav-view="${uiState.activeView}"]`);
  const statusMessage = markReviewed
    ? clearedPastReviewDate
      ? "오늘 검토를 기록했습니다. 지난 검토일은 비웠으니 새 검토일을 정할 수 있습니다."
      : "오늘 검토를 기록했습니다."
    : "투자 의사결정을 저장했습니다.";
  openAssetDetail(asset.id, opener, {
    bodyScrollTop,
    focusSelector: markReviewed
      ? '[data-decision-action="mark-reviewed"]'
      : '[data-decision-action="save"]',
    statusMessage
  });
  showStatusNotice(statusMessage);
  return true;
}

function assetDetailFocusableElements() {
  if (!els.assetDetailDrawer) return [];
  return [...els.assetDetailDrawer.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.closest("[hidden]"));
}

function trapAssetDetailFocus(event) {
  if (event.key !== "Tab" || !els.assetDetailOverlay || els.assetDetailOverlay.hidden) return;
  const focusable = assetDetailFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    els.assetDetailDrawer?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!els.assetDetailDrawer.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
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
  const decisionButton = event.target.closest("[data-decision-action]");
  if (decisionButton?.dataset.decisionAction === "mark-reviewed") {
    const form = decisionButton.closest("[data-asset-decision-form]");
    saveAssetDecisionForm(form, { markReviewed: true });
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (button) {
    if (!closeAssetDetail()) return;
    handleAssetAction(button);
    return;
  }
  if (event.target.closest("[data-detail-close]")) closeAssetDetail();
});

els.assetDetailOverlay?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-asset-decision-form]");
  if (!form) return;
  event.preventDefault();
  saveAssetDecisionForm(form);
});

els.economicPositionList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-position-asset-id]");
  if (!button) return;
  openAssetDetail(button.dataset.positionAssetId, button, { focusDecision: true });
});

document.addEventListener("keydown", (event) => {
  if (!els.assetDetailOverlay || els.assetDetailOverlay.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeAssetDetail();
    return;
  }
  trapAssetDetailFocus(event);
});

els.appNavItems.forEach((button) => {
  button.addEventListener("keydown", handleAppNavKeydown);
});

els.investmentJournalTab?.addEventListener("click", () => {
  setInvestmentRecordTab("JOURNAL");
});

els.investmentRealizedTab?.addEventListener("click", () => {
  setInvestmentRecordTab("REALIZED");
});

els.investmentLedgerTab?.addEventListener("click", () => {
  setInvestmentRecordTab("LEDGER");
});

[els.investmentJournalTab, els.investmentRealizedTab, els.investmentLedgerTab].filter(Boolean).forEach((button) => {
  button.addEventListener("keydown", handleInvestmentTabKeydown);
});

els.goalMobileButtons.forEach((button) => {
  button.addEventListener("click", () => {
    uiState.goalMobilePanel = button.dataset.goalMobilePanel === "RETIREMENT" ? "RETIREMENT" : "HISTORY";
    renderGoalMobilePanels();
  });
});

els.portfolioBreakdownToggle?.addEventListener("click", () => {
  uiState.portfolioBreakdownExpanded = !uiState.portfolioBreakdownExpanded;
  renderPortfolioBreakdownToggle();
});

els.toggleJournalFormBtn?.addEventListener("click", () => {
  if (els.journalFormPanel?.hidden) showJournalForm();
  else resetJournalForm();
});

els.cancelJournalBtn?.addEventListener("click", resetJournalForm);

els.ledgerTypeFilter?.addEventListener("change", () => {
  uiState.ledgerType = els.ledgerTypeFilter.value;
  renderLedger();
});

els.toggleCashFlowFormBtn?.addEventListener("click", () => {
  if (els.cashFlowFormPanel?.hidden) showCashFlowForm();
  else resetCashFlowForm();
});

els.cancelCashFlowBtn?.addEventListener("click", resetCashFlowForm);

[els.cashFlowType, els.cashFlowDate, els.cashFlowSettlementDate, els.cashFlowCashAssetId, els.cashFlowAmount, els.cashFlowCurrency, els.cashFlowFxRate, els.cashFlowSourceAssetId]
  .filter(Boolean)
  .forEach((input) => {
    input.addEventListener("input", renderCashFlowPreview);
    input.addEventListener("change", () => {
      if (input === els.cashFlowCurrency && els.cashFlowFxRateField) {
        const usesFx = els.cashFlowCurrency.value === "USD";
        els.cashFlowFxRateField.hidden = !usesFx;
        if (usesFx && !(parseAmount(els.cashFlowFxRate.value) > 0)) els.cashFlowFxRate.value = formatPlainNumber(usdKrwRate());
        if (!usesFx) els.cashFlowFxRate.value = "1";
      }
      if (input === els.cashFlowDate && els.cashFlowSettlementDate) {
        els.cashFlowSettlementDate.value = els.cashFlowDate.value;
      }
      renderCashFlowPreview();
    });
  });

els.cashFlowForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = parseCashFlowForm(true);
  if (!result.ok) {
    alert(result.message);
    return;
  }
  const ledgerEvent = createCashFlowLedgerEvent(result);
  const correcting = Boolean(ledgerEvent.correctsEventId);
  const saved = commitLedgerMutation(() => appendLedgerEvents([ledgerEvent]));
  if (!saved.ok) return;
  resetCashFlowForm();
  uiState.investmentRecordTab = "LEDGER";
  if (correcting) {
    showStatusNotice(`${LEDGER_EVENT_LABELS[result.type]} 원본을 보존하고 정정 이벤트를 저장했습니다.`);
  } else {
    showUndoNotice(`${LEDGER_EVENT_LABELS[result.type]} 현금흐름을 저장했습니다.`, () => {
      cancelLedgerEvent(ledgerEvent.eventId, `${LEDGER_EVENT_LABELS[result.type]} 저장 직후 되돌리기`);
    });
  }
});

els.ledgerEventRows?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-ledger-action]");
  if (!button) return;
  const target = state.events.find((item) => item.eventId === button.dataset.eventId);
  if (!target) return;
  if (button.dataset.ledgerAction === "correct") {
    const correctionReason = window.prompt(`${LEDGER_EVENT_LABELS[target.type] || target.type} 이벤트를 정정하는 이유를 입력하세요.`);
    if (correctionReason === null) return;
    if (!correctionReason.trim()) {
      alert("정정 사유를 입력하세요.");
      return;
    }
    if (correctionReason.trim().length > IMPORT_STRING_LIMITS.note) {
      alert("정정 사유는 10,000자 이하로 입력하세요.");
      return;
    }
    showCashFlowCorrection(target, correctionReason.trim());
    return;
  }
  const reason = window.prompt(`${LEDGER_EVENT_LABELS[target.type] || target.type} 이벤트를 취소하는 이유를 입력하세요.`);
  if (reason === null) return;
  if (!reason.trim()) {
    alert("취소 사유를 입력하세요.");
    return;
  }
  if (reason.trim().length > IMPORT_STRING_LIMITS.note) {
    alert("취소 사유는 10,000자 이하로 입력하세요.");
    return;
  }
  if (cancelLedgerEvent(target.eventId, reason.trim())) {
    showStatusNotice("원본 이벤트를 보존하고 취소 이벤트를 추가했습니다.");
  }
});

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
  const longShortField = [entry.name, entry.ticker, entry.account, entry.tags]
    .some((value) => String(value || "").length > IMPORT_STRING_LIMITS.short);
  const longNoteField = [entry.reason, entry.risk, entry.review]
    .some((value) => String(value || "").length > IMPORT_STRING_LIMITS.note);
  if (longShortField || longNoteField) {
    alert("매매일지의 기본 정보는 500자, 본문 메모는 10,000자 이하로 입력하세요.");
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
  els.sellSettlementDate,
  els.sellCashAssetId,
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
  els.buySettlementDate,
  els.buyCashAssetId,
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
    const completed = await pullCloudData();
    if (completed) setSyncStatus("동기화 완료", true);
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

els.assetTicker.addEventListener("input", loadSymbolsForAssetForm);

els.assetTicker.addEventListener("blur", loadSymbolsForAssetForm);

els.assetTicker.addEventListener("change", loadSymbolsForAssetForm);

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

els.dashboardChecklist?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-action]");
  if (!button || button.dataset.dashboardAction !== "review-asset") return;
  openAssetDetail(button.dataset.id, button, { focusDecision: true });
});

Object.values(allocationBandInputs()).flatMap((band) => Object.values(band)).forEach((input) => {
  input?.addEventListener("input", () => {
    if (savePortfolioTargets()) render(false);
  });
  input?.addEventListener("change", () => {
    if (savePortfolioTargets()) render();
  });
});

els.contributionPlannerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!saveContributionPlan()) return;
  render();
  window.requestAnimationFrame(() => document.querySelector("#contributionResultTitle")?.focus({ preventScroll: true }));
});

els.contributionAmount?.addEventListener("blur", () => {
  const amount = parseAmount(els.contributionAmount.value);
  if (Number.isFinite(amount) && amount >= 0) els.contributionAmount.value = formatIntegerNumber(amount);
});

els.riskBudgetForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!saveRiskBudgets()) return;
  render();
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
  const readiness = snapshotReadiness();
  if (!readiness.ok) {
    alert(readiness.message);
    return;
  }

  const now = new Date().toISOString();
  const snapshotNote = els.snapshotNote?.value.trim() || "";
  if (snapshotNote.length > IMPORT_STRING_LIMITS.note) {
    alert("조회 기록 메모는 10,000자 이하로 입력하세요.");
    return;
  }
  const snapshot = {
    id: uid(),
    createdAt: now,
    total: totalAssets(),
    note: snapshotNote,
    typeTotals: Object.fromEntries(
      state.assets.reduce((map, asset) => {
        const type = assetType(asset);
        map.set(type, (map.get(type) || 0) + assetValue(asset));
        return map;
      }, new Map())
    )
  };
  state.snapshots.push(normalizeSnapshot(snapshot));
  if (els.snapshotNote) els.snapshotNote.value = "";
  render();
  const warning = readiness.warnings.length ? ` ${readiness.warnings.join(" ")}` : "";
  showUndoNotice(`조회 기록을 저장했습니다.${warning}`, () => {
    state.snapshots = state.snapshots.filter((item) => item.id !== snapshot.id);
    render();
  });
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
  if (saveRetirementInputs()) render(false);
});
els.retirementForm.addEventListener("change", () => {
  if (saveRetirementInputs()) render();
});

els.retirementForm.addEventListener("focusout", (event) => {
  formatRetirementMoneyInput(event.target);
});

els.syncAssetsBtn.addEventListener("click", () => {
  els.currentInvestable.value = formatIntegerNumber(Math.ceil(totalAssets()));
  if (saveRetirementInputs()) render();
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
    if (saveRetirementInputs()) render();
  });
});

els.saveScenarioBtn.addEventListener("click", () => {
  const name = els.retirementScenarioName.value.trim();
  if (!name) {
    alert("시나리오명을 입력하세요.");
    return;
  }
  if (name.length > IMPORT_STRING_LIMITS.short) {
    alert("시나리오명은 500자 이하로 입력하세요.");
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

function downloadTextFile(content, filename) {
  try {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function downloadStateFile(data, filename) {
  return downloadTextFile(JSON.stringify(data, null, 2), filename);
}

function assertImportString(value, label, limit = IMPORT_STRING_LIMITS.short) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") throw new Error(`${label}은(는) 문자열이어야 합니다.`);
  if (value.length > limit) throw new Error(`${label}이(가) 허용 길이 ${limit}자를 넘었습니다.`);
}

function assertImportNumber(value, label, { min = -1e18, max = 1e18 } = {}) {
  if (value === undefined || value === null) return;
  if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim())) {
    throw new Error(`${label}은(는) 숫자여야 합니다.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label}에 허용되지 않는 숫자가 있습니다.`);
  }
}

function assertImportDate(value, label) {
  if (value === undefined || value === null || value === "") return;
  assertImportString(value, label, IMPORT_STRING_LIMITS.short);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label}에 올바르지 않은 날짜가 있습니다.`);
}

function validateImportCollection(data, key, validateItem) {
  if (!Array.isArray(data[key])) throw new Error(`${key} 목록이 없습니다.`);
  if (data[key].length > IMPORT_LIMITS[key]) {
    throw new Error(`${key} 항목이 허용 개수 ${IMPORT_LIMITS[key].toLocaleString("ko-KR")}개를 넘었습니다.`);
  }
  data[key].forEach((item, index) => {
    if (!isPlainObject(item)) throw new Error(`${key}[${index}] 항목이 객체가 아닙니다.`);
    validateItem(item, index);
  });
}

function validateUniqueImportField(items, field, collectionLabel, { ignoreEmpty = false } = {}) {
  const seen = new Set();
  items.forEach((item, index) => {
    const value = String(item?.[field] || "").trim();
    if (!value && ignoreEmpty) return;
    if (seen.has(value)) throw new Error(`${collectionLabel}[${index}].${field}가 중복되었습니다.`);
    seen.add(value);
  });
}

function validateImportedDecisionFields(item, prefix) {
  ["investmentRole", "role", "horizon", "conviction", "reviewStatus"].forEach((field) => {
    assertImportString(item[field], `${prefix}.${field}`);
  });
  [
    "thesis",
    "returnSource",
    "expectedReturnSource",
    "kpis",
    "monitoringKpis",
    "catalysts",
    "invalidation",
    "invalidationRules",
    "deceleration",
    "decelerationRules"
  ].forEach((field) => assertImportString(item[field], `${prefix}.${field}`, IMPORT_STRING_LIMITS.note));
  assertImportDate(item.nextReviewAt, `${prefix}.nextReviewAt`);
  assertImportDate(item.lastReviewedAt, `${prefix}.lastReviewedAt`);

  const enumChecks = [
    [item.investmentRole ?? item.role, INVESTMENT_ROLE_LABELS, `${prefix}.investmentRole`],
    [item.horizon, INVESTMENT_HORIZON_LABELS, `${prefix}.horizon`],
    [item.conviction, CONVICTION_LABELS, `${prefix}.conviction`],
    [item.reviewStatus, REVIEW_STATUS_LABELS, `${prefix}.reviewStatus`]
  ];
  enumChecks.forEach(([value, labels, label]) => {
    if (value === undefined || value === null || value === "") return;
    if (!Object.hasOwn(labels, String(value).trim().toUpperCase())) {
      throw new Error(`${label}에 알 수 없는 값이 있습니다.`);
    }
  });
  if (item.riskTags !== undefined) {
    if (!isPlainObject(item.riskTags)) throw new Error(`${prefix}.riskTags가 객체가 아닙니다.`);
    Object.entries(item.riskTags).forEach(([key, tags]) => {
      if (!Object.hasOwn(RISK_TAG_DIMENSION_LABELS, key)) {
        throw new Error(`${prefix}.riskTags.${key}에 알 수 없는 태그 차원이 있습니다.`);
      }
      if (!Array.isArray(tags)) throw new Error(`${prefix}.riskTags.${key}가 목록이 아닙니다.`);
      if (tags.length > RISK_TAGS_PER_DIMENSION_LIMIT) {
        throw new Error(`${prefix}.riskTags.${key}가 허용 개수 ${RISK_TAGS_PER_DIMENSION_LIMIT}개를 넘었습니다.`);
      }
      tags.forEach((tag, index) => assertImportString(
        tag,
        `${prefix}.riskTags.${key}[${index}]`,
        RISK_TAG_LENGTH_LIMIT
      ));
    });
  }
}

function validateImportedAsset(asset, index) {
  const prefix = `assets[${index}]`;
  ["id", "name", "ticker", "type", "account", "accountClass", "manualSubtype"].forEach((field) => {
    assertImportString(asset[field], `${prefix}.${field}`, field === "id" ? IMPORT_STRING_LIMITS.id : IMPORT_STRING_LIMITS.short);
  });
  assertImportString(asset.note, `${prefix}.note`, IMPORT_STRING_LIMITS.note);
  validateImportedDecisionFields(asset, prefix);
  assertImportDate(asset.createdAt, `${prefix}.createdAt`);
  assertImportDate(asset.updatedAt, `${prefix}.updatedAt`);
  ["amount", "quantity", "averagePrice"].forEach((field) => {
    assertImportNumber(asset[field], `${prefix}.${field}`, { min: 0, max: 1e15 });
  });
  if (!String(asset.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
  if (!String(asset.name || "").trim()) throw new Error(`${prefix}.name이 없습니다.`);
  if (asset.type !== undefined && !["KRX", "US", "CASH", "MANUAL"].includes(String(asset.type).toUpperCase())) {
    throw new Error(`${prefix}.type에 알 수 없는 자산 유형이 있습니다.`);
  }
  const type = asset.type ? String(asset.type).toUpperCase() : inferLegacyAssetType(asset);
  if (isMarketType(type)) {
    const tickerError = validateTicker(type, asset.ticker);
    if (tickerError) throw new Error(`${prefix}: ${tickerError}`);
    if (!Object.hasOwn(asset, "quantity") || !Object.hasOwn(asset, "averagePrice")) {
      throw new Error(`${prefix}의 보유수량과 평단가가 없습니다.`);
    }
  } else if (!Object.hasOwn(asset, "amount") || Number(asset.amount) < 0) {
    throw new Error(`${prefix}.amount에 올바른 수동 평가금액이 필요합니다.`);
  }
}

function validateImportedDecisionProfile(profile, index) {
  const prefix = `decisionProfiles[${index}]`;
  ["id", "subjectKey", "name", "type", "ticker"].forEach((field) => {
    assertImportString(profile[field], `${prefix}.${field}`, IMPORT_STRING_LIMITS.short);
  });
  if (!String(profile.subjectKey || "").trim()) throw new Error(`${prefix}.subjectKey가 없습니다.`);
  if (profile.type !== undefined && !["KRX", "US", "CASH", "MANUAL"].includes(String(profile.type).toUpperCase())) {
    throw new Error(`${prefix}.type에 알 수 없는 자산 유형이 있습니다.`);
  }
  validateImportedDecisionFields(profile, prefix);
  if (profile.migrationConflicts !== undefined) {
    if (!Array.isArray(profile.migrationConflicts)) {
      throw new Error(`${prefix}.migrationConflicts가 목록이 아닙니다.`);
    }
    if (profile.migrationConflicts.length > DECISION_MIGRATION_CONFLICT_LIMIT) {
      throw new Error(`${prefix}.migrationConflicts가 허용 개수 ${DECISION_MIGRATION_CONFLICT_LIMIT}개를 넘었습니다.`);
    }
    profile.migrationConflicts.forEach((conflict, conflictIndex) => {
      const conflictPrefix = `${prefix}.migrationConflicts[${conflictIndex}]`;
      if (!isPlainObject(conflict)) throw new Error(`${conflictPrefix}가 객체가 아닙니다.`);
      ["sourceType", "sourceId", "sourceName", "account"].forEach((field) => {
        assertImportString(conflict[field], `${conflictPrefix}.${field}`, field === "sourceId" ? IMPORT_STRING_LIMITS.id : IMPORT_STRING_LIMITS.short);
      });
      if (conflict.sourceType !== undefined && !["asset", "watchlist", "profile"].includes(conflict.sourceType)) {
        throw new Error(`${conflictPrefix}.sourceType에 알 수 없는 값이 있습니다.`);
      }
      if (!isPlainObject(conflict.fields)) throw new Error(`${conflictPrefix}.fields가 객체가 아닙니다.`);
      validateImportedDecisionFields(conflict.fields, `${conflictPrefix}.fields`);
    });
  }
  assertImportDate(profile.createdAt, `${prefix}.createdAt`);
  assertImportDate(profile.updatedAt, `${prefix}.updatedAt`);
}

function validateImportedWatchlistItem(item, index) {
  const prefix = `watchlist[${index}]`;
  ["id", "name", "ticker", "type"].forEach((field) => {
    assertImportString(item[field], `${prefix}.${field}`, field === "id" ? IMPORT_STRING_LIMITS.id : IMPORT_STRING_LIMITS.short);
  });
  if (!String(item.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
  if (!String(item.name || "").trim()) throw new Error(`${prefix}.name이 없습니다.`);
  const type = String(item.type || "").trim().toUpperCase();
  if (!["KRX", "US"].includes(type)) throw new Error(`${prefix}.type은 KRX 또는 US여야 합니다.`);
  const tickerError = validateTicker(type, item.ticker);
  if (tickerError) throw new Error(`${prefix}: ${tickerError}`);
  validateImportedDecisionFields(item, prefix);
  assertImportDate(item.createdAt, `${prefix}.createdAt`);
  assertImportDate(item.updatedAt, `${prefix}.updatedAt`);
}

function validateImportedTrade(trade, index) {
  const prefix = `realizedTrades[${index}]`;
  ["id", "assetId", "ledgerEventId", "name", "ticker", "type", "account"].forEach((field) => {
    assertImportString(trade[field], `${prefix}.${field}`, field.endsWith("Id") || field === "id" ? IMPORT_STRING_LIMITS.id : IMPORT_STRING_LIMITS.short);
  });
  assertImportString(trade.memo, `${prefix}.memo`, IMPORT_STRING_LIMITS.note);
  assertImportDate(trade.soldAt || trade.date, `${prefix}.soldAt`);
  assertImportDate(trade.createdAt, `${prefix}.createdAt`);
  assertImportDate(trade.cancelledAt, `${prefix}.cancelledAt`);
  ["quantity", "averagePrice", "sellPrice", "fxRate", "fees", "tax", "grossAmount", "costAmount"].forEach((field) => {
    assertImportNumber(trade[field], `${prefix}.${field}`, { min: 0, max: 1e18 });
  });
  ["realizedGain", "realizedGainRate"].forEach((field) => {
    assertImportNumber(trade[field], `${prefix}.${field}`);
  });
  if (!String(trade.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
}

function validateImportedJournal(entry, index) {
  const prefix = `tradeJournalEntries[${index}]`;
  ["id", "assetId", "realizedTradeId", "ledgerEventId"].forEach((field) => {
    assertImportString(entry[field], `${prefix}.${field}`, IMPORT_STRING_LIMITS.id);
  });
  ["name", "ticker", "type", "region", "account", "action", "status", "tags"].forEach((field) => {
    assertImportString(entry[field], `${prefix}.${field}`);
  });
  ["reason", "risk", "review"].forEach((field) => {
    assertImportString(entry[field], `${prefix}.${field}`, IMPORT_STRING_LIMITS.note);
  });
  assertImportDate(entry.date, `${prefix}.date`);
  assertImportDate(entry.createdAt, `${prefix}.createdAt`);
  assertImportDate(entry.updatedAt, `${prefix}.updatedAt`);
  ["quantity", "price"].forEach((field) => {
    assertImportNumber(entry[field], `${prefix}.${field}`, { min: 0, max: 1e18 });
  });
  if (!String(entry.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
  if (!String(entry.name || "").trim()) throw new Error(`${prefix}.name이 없습니다.`);
}

function validateImportedLedgerEvent(event, index) {
  try {
    normalizeLedgerEvent(event);
  } catch (error) {
    throw new Error(`events[${index}]: ${error.message}`);
  }
}

function validateImportedLedgerMeta(ledgerMeta, { required = false } = {}) {
  if (ledgerMeta === undefined) {
    if (required) throw new Error("ledgerMeta가 없습니다.");
    return;
  }
  if (!isPlainObject(ledgerMeta)) throw new Error("ledgerMeta가 객체가 아닙니다.");
  assertImportString(ledgerMeta.activeLedgerId, "ledgerMeta.activeLedgerId", IMPORT_STRING_LIMITS.id);
  assertImportString(ledgerMeta.baselineDate, "ledgerMeta.baselineDate", IMPORT_STRING_LIMITS.short);
  assertImportDate(ledgerMeta.migratedAt, "ledgerMeta.migratedAt");
  if (!String(ledgerMeta.activeLedgerId || "").trim()) throw new Error("ledgerMeta.activeLedgerId가 없습니다.");
  if (ledgerMeta.baselineDate && !normalizeDateKey(ledgerMeta.baselineDate)) {
    throw new Error("ledgerMeta.baselineDate가 올바른 YYYY-MM-DD 날짜가 아닙니다.");
  }
}

function validateImportedSnapshot(snapshot, index) {
  const prefix = `snapshots[${index}]`;
  assertImportString(snapshot.id, `${prefix}.id`, IMPORT_STRING_LIMITS.id);
  assertImportDate(snapshot.createdAt, `${prefix}.createdAt`);
  assertImportString(snapshot.note, `${prefix}.note`, IMPORT_STRING_LIMITS.note);
  assertImportNumber(snapshot.total, `${prefix}.total`, { min: 0, max: 1e18 });
  if (!String(snapshot.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
  if (!snapshot.createdAt || !Number.isFinite(Date.parse(snapshot.createdAt))) {
    throw new Error(`${prefix}.createdAt이 없습니다.`);
  }
  if (!Object.hasOwn(snapshot, "total")) throw new Error(`${prefix}.total이 없습니다.`);
  if (snapshot.typeTotals !== undefined && !isPlainObject(snapshot.typeTotals)) {
    throw new Error(`${prefix}.typeTotals가 객체가 아닙니다.`);
  }
  Object.entries(snapshot.typeTotals || {}).forEach(([type, value]) => {
    if (!["KRX", "US", "CASH", "MANUAL"].includes(type)) {
      throw new Error(`${prefix}.typeTotals에 알 수 없는 자산 유형이 있습니다.`);
    }
    assertImportNumber(value, `${prefix}.typeTotals.${type}`, { min: 0, max: 1e18 });
  });
  if (snapshot.assets !== undefined && !Array.isArray(snapshot.assets)) {
    throw new Error(`${prefix}.assets가 목록이 아닙니다.`);
  }
}

function validateImportedScenario(scenario, index) {
  const prefix = `retirementScenarios[${index}]`;
  assertImportString(scenario.id, `${prefix}.id`, IMPORT_STRING_LIMITS.id);
  assertImportString(scenario.name, `${prefix}.name`);
  assertImportDate(scenario.updatedAt, `${prefix}.updatedAt`);
  if (scenario.input !== undefined && !isPlainObject(scenario.input)) {
    throw new Error(`${prefix}.input이 객체가 아닙니다.`);
  }
  if (!String(scenario.id || "").trim()) throw new Error(`${prefix}.id가 없습니다.`);
  if (!String(scenario.name || "").trim()) throw new Error(`${prefix}.name이 없습니다.`);
}

function validateImportedPolicyProfile(policyProfile) {
  if (policyProfile === undefined) return;
  if (!isPlainObject(policyProfile)) throw new Error("policyProfile이 객체가 아닙니다.");
  if (policyProfile.allocationBands !== undefined) {
    if (!isPlainObject(policyProfile.allocationBands)) {
      throw new Error("policyProfile.allocationBands가 객체가 아닙니다.");
    }
    const targetValues = [];
    const minValues = [];
    const maxValues = [];
    ALLOCATION_BUCKET_KEYS.forEach((key) => {
      const band = policyProfile.allocationBands[key];
      if (!isPlainObject(band)) throw new Error(`policyProfile.allocationBands.${key}가 객체가 아닙니다.`);
      const minPct = Number(band.minPct);
      const targetPct = Number(band.targetPct);
      const maxPct = Number(band.maxPct);
      assertImportNumber(band.minPct, `policyProfile.allocationBands.${key}.minPct`, { min: 0, max: 100 });
      assertImportNumber(band.targetPct, `policyProfile.allocationBands.${key}.targetPct`, { min: 0, max: 100 });
      assertImportNumber(band.maxPct, `policyProfile.allocationBands.${key}.maxPct`, { min: 0, max: 100 });
      if (minPct > targetPct || targetPct > maxPct) {
        throw new Error(`policyProfile.allocationBands.${key}는 최소≤목표≤최대여야 합니다.`);
      }
      minValues.push(minPct);
      targetValues.push(targetPct);
      maxValues.push(maxPct);
    });
    const targetTotal = targetValues.reduce((sum, value) => sum + value, 0);
    const minTotal = minValues.reduce((sum, value) => sum + value, 0);
    const maxTotal = maxValues.reduce((sum, value) => sum + value, 0);
    if (Math.abs(targetTotal - 100) > PERCENT_TARGET_TOLERANCE) throw new Error("자산군 목표 비중 합계는 100%여야 합니다.");
    if (minTotal > 100 + PERCENT_CONSTRAINT_EPSILON) throw new Error("자산군 최소 비중 합계는 100% 이하여야 합니다.");
    if (maxTotal < 100 - PERCENT_CONSTRAINT_EPSILON) throw new Error("자산군 최대 비중 합계는 100% 이상이어야 합니다.");
  }
  if (policyProfile.riskBudgets !== undefined) {
    if (!isPlainObject(policyProfile.riskBudgets)) {
      throw new Error("policyProfile.riskBudgets가 객체가 아닙니다.");
    }
    Object.keys(DEFAULT_RISK_BUDGETS).forEach((key) => {
      if (policyProfile.riskBudgets[key] === undefined) return;
      assertImportNumber(policyProfile.riskBudgets[key], `policyProfile.riskBudgets.${key}`, { min: 0, max: 100 });
    });
  }
}

function validateImportedContributionPlan(contributionPlan) {
  if (contributionPlan === undefined) return;
  if (!isPlainObject(contributionPlan)) throw new Error("contributionPlan이 객체가 아닙니다.");
  assertImportString(contributionPlan.mode, "contributionPlan.mode");
  if (contributionPlan.mode !== undefined && !CONTRIBUTION_MODES.has(String(contributionPlan.mode).toUpperCase())) {
    throw new Error("contributionPlan.mode에 알 수 없는 값이 있습니다.");
  }
  assertImportNumber(contributionPlan.amount, "contributionPlan.amount", { min: 0, max: 1e15 });
  if (contributionPlan.amount !== undefined && contributionPlan.amount !== null
      && !Number.isSafeInteger(Number(contributionPlan.amount))) {
    throw new Error("contributionPlan.amount는 1원 단위 정수여야 합니다.");
  }
}

function validateImportPayload(imported) {
  if (!isPlainObject(imported)) throw new Error("가져오기 파일의 최상위 값은 객체여야 합니다.");
  if (imported.schemaVersion !== undefined) {
    const version = Number(imported.schemaVersion);
    if (!Number.isSafeInteger(version) || version < 1 || version > STATE_SCHEMA_VERSION) {
      throw new Error(`지원하지 않는 데이터 스키마 버전입니다. 현재 지원 버전은 ${STATE_SCHEMA_VERSION}입니다.`);
    }
  }

  validateImportCollection(imported, "assets", validateImportedAsset);
  validateImportCollection(imported, "snapshots", validateImportedSnapshot);
  validateUniqueImportField(imported.assets, "id", "assets");
  validateUniqueImportField(imported.snapshots, "id", "snapshots");
  const assetKeys = new Set();
  imported.assets.forEach((asset, index) => {
    const key = assetIdentity(asset);
    if (assetKeys.has(key)) throw new Error(`assets[${index}]의 자산 유형·종목·계좌가 중복되었습니다.`);
    assetKeys.add(key);
  });

  ["decisionProfiles", "watchlist", "realizedTrades", "tradeJournalEntries", "retirementScenarios"].forEach((key) => {
    if (imported[key] === undefined) imported[key] = [];
  });
  validateImportCollection(imported, "decisionProfiles", validateImportedDecisionProfile);
  validateImportCollection(imported, "watchlist", validateImportedWatchlistItem);
  validateUniqueImportField(imported.decisionProfiles, "id", "decisionProfiles", { ignoreEmpty: true });
  validateUniqueImportField(imported.watchlist, "id", "watchlist");
  const profileKeys = new Set();
  imported.decisionProfiles.forEach((profile, index) => {
    const key = String(profile.subjectKey || "").trim();
    if (profileKeys.has(key)) throw new Error(`decisionProfiles[${index}].subjectKey가 중복되었습니다.`);
    profileKeys.add(key);
  });
  const watchlistKeys = new Set();
  imported.watchlist.forEach((item, index) => {
    const key = decisionSubjectKeyForWatchlist(item);
    if (watchlistKeys.has(key)) throw new Error(`watchlist[${index}]의 시장·티커가 중복되었습니다.`);
    watchlistKeys.add(key);
  });
  validateImportCollection(imported, "realizedTrades", validateImportedTrade);
  validateImportCollection(imported, "tradeJournalEntries", validateImportedJournal);
  validateImportCollection(imported, "retirementScenarios", validateImportedScenario);
  validateUniqueImportField(imported.realizedTrades, "id", "realizedTrades");
  validateUniqueImportField(imported.tradeJournalEntries, "id", "tradeJournalEntries");
  validateUniqueImportField(imported.retirementScenarios, "id", "retirementScenarios");
  const importedVersion = Number(imported.schemaVersion || 1);
  if (imported.events !== undefined) validateImportCollection(imported, "events", validateImportedLedgerEvent);
  else if (importedVersion >= 5) throw new Error("events 목록이 없습니다.");
  validateImportedLedgerMeta(imported.ledgerMeta, { required: importedVersion >= 5 });

  if (imported.meta !== undefined && !isPlainObject(imported.meta)) throw new Error("meta가 객체가 아닙니다.");
  if (imported.portfolioTargets !== undefined && !isPlainObject(imported.portfolioTargets)) {
    throw new Error("portfolioTargets가 객체가 아닙니다.");
  }
  if (imported.retirement !== undefined && !isPlainObject(imported.retirement)) {
    throw new Error("retirement가 객체가 아닙니다.");
  }
  validateImportedPolicyProfile(imported.policyProfile);
  validateImportedContributionPlan(imported.contributionPlan);

  Object.entries(imported.portfolioTargets || {}).forEach(([key, value]) => {
    if (!Object.hasOwn(defaultState().portfolioTargets, key)) return;
    assertImportNumber(value, `portfolioTargets.${key}`, { min: 0, max: 100 });
  });
  Object.entries(imported.retirement || {}).forEach(([key, value]) => {
    if (!Object.hasOwn(defaultState().retirement, key)) return;
    assertImportNumber(value, `retirement.${key}`, { min: 0, max: 1e15 });
  });
  imported.retirementScenarios.forEach((scenario, index) => {
    Object.entries(scenario.input || {}).forEach(([key, value]) => {
      if (!Object.hasOwn(defaultState().retirement, key)) return;
      assertImportNumber(value, `retirementScenarios[${index}].input.${key}`, { min: 0, max: 1e15 });
    });
  });

  const migrated = migrateState(imported);
  const projected = projectLedgerState({
    events: migrated.events,
    assets: migrated.assets,
    ledgerMeta: migrated.ledgerMeta,
    realizedTrades: migrated.realizedTrades,
    tradeJournalEntries: migrated.tradeJournalEntries
  });
  if (!projected.ok) throw new Error(`거래 원장 정합성 오류: ${ledgerProjectionErrorMessage(projected)}`);
  const reconciliation = ledgerReconciliationForAssets(projected, migrated.assets);
  if (!reconciliation.ok) {
    throw new Error(`거래 원장 정합성 오류: ${reconciliation.mismatches.join(", ") || ledgerProjectionErrorMessage(projected)}`);
  }
  Object.entries(migrated.portfolioTargets).forEach(([key, value]) => {
    assertImportNumber(value, `portfolioTargets.${key}`, { min: 0, max: 100 });
  });
  const targetTotal = Object.values(migrated.portfolioTargets).reduce((sum, value) => sum + Number(value), 0);
  if (Math.abs(targetTotal - 100) > PERCENT_TARGET_TOLERANCE) throw new Error("포트폴리오 목표 비중 합계는 100%여야 합니다.");

  const retirementError = validateRetirementInput(migrated.retirement);
  if (retirementError) throw new Error(`은퇴 설정 오류: ${retirementError}`);
  migrated.retirementScenarios.forEach((scenario, index) => {
    const scenarioInput = { ...defaultState().retirement, ...(scenario.input || {}) };
    const error = validateRetirementInput(scenarioInput);
    if (error) throw new Error(`은퇴 시나리오 ${index + 1} 오류: ${error}`);
  });
  return migrated;
}

els.exportBtn.addEventListener("click", () => {
  const exported = downloadStateFile(
    storageSafeState(),
    `finance-ledger-${new Date().toISOString().slice(0, 10)}.json`
  );
  if (!exported) alert("데이터 내보내기 파일을 만들지 못했습니다.");
});

els.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    if (file.size > IMPORT_FILE_MAX_BYTES) {
      throw new Error(`가져오기 파일은 ${IMPORT_FILE_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`);
    }
    const imported = JSON.parse(await file.text());
    const candidate = validateImportPayload(imported);
    const summary = [
      `자산 ${candidate.assets.length}개`,
      `의사결정 프로필 ${candidate.decisionProfiles.length}개`,
      `관심종목 ${candidate.watchlist.length}개`,
      `히스토리 ${candidate.snapshots.length}개`,
      `매매일지 ${candidate.tradeJournalEntries.length}개`,
      `원장 이벤트 ${candidate.events.length}개`,
      "은퇴 설정 포함",
      `은퇴 시나리오 ${candidate.retirementScenarios.length}개`
    ].join("\n");
    if (!confirm(`가져올 데이터:\n${summary}\n\n현재 화면 데이터를 자동 백업한 뒤 이 파일 내용으로 교체할까요?`)) return;
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupCreated = protectedStorageRaw
      ? downloadTextFile(protectedStorageRaw, `finance-ledger-recovery-before-import-${backupTimestamp}.json`)
      : downloadStateFile(storageSafeState(), `finance-ledger-before-import-${backupTimestamp}.json`);
    if (!backupCreated) throw new Error("현재 데이터 자동 백업에 실패해 가져오기를 중단했습니다.");
    const previousState = storageSafeState();
    const previousStorageWritesBlocked = storageWritesBlocked;
    const previousProtectedStorageRaw = protectedStorageRaw;
    candidate.meta.cloudRevision = normalizeRevision(state.meta.cloudRevision);
    candidate.meta.cloudUpdatedAt = state.meta.cloudUpdatedAt;
    candidate.meta.lastSavedAt = null;
    candidate.meta.lastSyncDirection = "local";
    candidate.meta.syncErrorCode = null;
    candidate.ledgerMeta.activeLedgerId = `ledger-${uid()}`;
    cloud.knownEventIds = new Set();
    storageWritesBlocked = false;
    protectedStorageRaw = null;
    replaceState(candidate);
    applyPricesToAssets();
    if (!render(false)) {
      storageWritesBlocked = previousStorageWritesBlocked;
      protectedStorageRaw = previousProtectedStorageRaw;
      replaceState(previousState);
      render(false);
      throw new Error("가져온 데이터를 이 기기에 저장하지 못해 기존 화면 데이터로 되돌렸습니다.");
    }
    const recoveredBlockedLocalData = cloud.schemaBlockSource === "local";
    if (recoveredBlockedLocalData) clearCloudSchemaBlock("local");
    if (cloud.docRef) {
      if (recoveredBlockedLocalData) await pullCloudData();
      else scheduleCloudPush();
    }
    if (els.appNotice) {
      els.appNotice.hidden = false;
      els.appNotice.setAttribute("role", "status");
      els.appNotice.textContent = "현재 데이터를 자동 백업하고 새 데이터를 가져왔습니다.";
    }
  } catch (error) {
    console.error(error);
    alert(error instanceof SyntaxError ? "가져올 수 없는 JSON 파일입니다." : error.message || "가져오기 파일을 확인하세요.");
  } finally {
    event.target.value = "";
  }
});

hydrateRetirementInputs();
hydratePortfolioTargetInputs();
hydrateActionSupportInputs();
renderRetirementScenarioOptions();
state.assets = state.assets.map(normalizeAsset);
state.decisionProfiles = state.decisionProfiles.map(normalizeDecisionProfile);
state.watchlist = state.watchlist.map(normalizeWatchlistItem);
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
let responsiveChartResizeRaf = 0;
window.addEventListener("resize", () => {
  if (!["DASHBOARD", "GOALS"].includes(uiState.activeView)) return;
  cancelAnimationFrame(responsiveChartResizeRaf);
  responsiveChartResizeRaf = requestAnimationFrame(() => {
    if (uiState.activeView === "DASHBOARD") drawHeroSparkline();
    if (uiState.activeView === "GOALS") drawChart(filteredHistorySnapshots());
  });
});
renderAllViews();
updateAuthUi();
initPrices();
initFirebase();
