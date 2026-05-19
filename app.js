const STORAGE_KEY = "finance-ledger-retirement-v1";
const CLOUD_DOC_ID = "primary";
const PRICE_FILE_PATH = "prices.json";
const PUBLIC_PRICE_FILE_URL = "https://yjmoonn.github.io/assettrail/prices.json";
const PIE_COLORS = ["#1f7a4d", "#2f6fbb", "#d58a1f", "#8b5cf6", "#0f766e", "#be123c", "#64748b"];
const firebaseConfig = window.firebaseConfig || {};
const ASSET_TYPE_LABELS = {
  KRX: "KRX 국내",
  US: "US 미국",
  CASH: "CASH 현금",
  MANUAL: "MANUAL 수동"
};

let cloud = {
  auth: null,
  db: null,
  docRef: null,
  enabled: false,
  ready: false,
  user: null
};

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
  totalAsset: document.querySelector("#totalAsset"),
  assetCount: document.querySelector("#assetCount"),
  lastDelta: document.querySelector("#lastDelta"),
  lastDeltaRate: document.querySelector("#lastDeltaRate"),
  firstDelta: document.querySelector("#firstDelta"),
  firstDeltaRate: document.querySelector("#firstDeltaRate"),
  retireGap: document.querySelector("#retireGap"),
  retireGapLabel: document.querySelector("#retireGapLabel"),
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
  saveAssetBtn: document.querySelector("#saveAssetBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  snapshotBtn: document.querySelector("#snapshotBtn"),
  assetRows: document.querySelector("#assetRows"),
  assetSearch: document.querySelector("#assetSearch"),
  assetTypeFilter: document.querySelector("#assetTypeFilter"),
  priceAlert: document.querySelector("#priceAlert"),
  visibleAssetCount: document.querySelector("#visibleAssetCount"),
  categoryBreakdown: document.querySelector("#categoryBreakdown"),
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
  syncStatus: document.querySelector("#syncStatus"),
  toggleAssetFormBtn: document.querySelector("#toggleAssetFormBtn"),
  loginBtn: document.querySelector("#loginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  cloudSyncBtn: document.querySelector("#cloudSyncBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  emptyAssetTemplate: document.querySelector("#emptyAssetTemplate"),
  emptyHistoryTemplate: document.querySelector("#emptyHistoryTemplate")
};

const state = loadState();
const uiState = {
  assetSearch: "",
  assetType: "ALL",
  autofilledAssetName: ""
};

function loadState() {
  const fallback = {
    assets: [],
    snapshots: [],
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

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      ...fallback,
      ...saved,
      assets: Array.isArray(saved.assets) ? saved.assets.map(normalizeAsset) : [],
      snapshots: Array.isArray(saved.snapshots) ? saved.snapshots : [],
      retirement: { ...fallback.retirement, ...(saved.retirement || {}) }
    };
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storageSafeState()));
}

function hasFirebaseConfig() {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(firebaseConfig[key]));
}

function cloudSafeState() {
  return {
    ...storageSafeState(),
    updatedAt: new Date().toISOString()
  };
}

function storageSafeState() {
  return {
    assets: state.assets.map(serializeAsset),
    snapshots: state.snapshots,
    retirement: state.retirement
  };
}

function replaceState(nextState) {
  state.assets = Array.isArray(nextState.assets) ? nextState.assets.map(normalizeAsset) : [];
  state.snapshots = Array.isArray(nextState.snapshots) ? nextState.snapshots : [];
  state.retirement = { ...state.retirement, ...(nextState.retirement || {}) };
  applyPricesToAssets();
  hydrateRetirementInputs();
}

function setSyncStatus(text, online = false) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.classList.toggle("online", online);
}

function setPriceStatus(text, online = false) {
  if (!els.priceStatus) return;
  els.priceStatus.textContent = text;
  els.priceStatus.classList.toggle("online", online);
}

async function initPrices() {
  setPriceStatus("Prices loading...");

  try {
    const loaded = await loadPriceBook();
    priceBook = normalizePriceBook(loaded.data);
    activePriceFileUrl = loaded.url;
    applyPricesToAssets();
    setPriceStatus(priceBook.generatedAt ? `Prices: ${shortDate(priceBook.generatedAt)}` : "Prices loaded", true);
    render(false);
  } catch (error) {
    console.error(error);
    applyPricesToAssets();
    setPriceStatus("Prices unavailable");
    render(false);
  }
}

async function loadPriceBook() {
  let lastError = null;

  for (const url of priceFileCandidates()) {
    try {
      const response = await fetch(cacheBustedUrl(url), { cache: "no-store" });
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
  return `${url}${separator}v=${Date.now()}`;
}

async function initFirebase() {
  if (!hasFirebaseConfig()) {
    setSyncStatus("Local only");
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
        setSyncStatus("Cloud load failed");
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
        setSyncStatus(`Login failed: ${error.code || "unknown"}`);
      });
  } catch (error) {
    console.error(error);
    setSyncStatus("Firebase load failed");
  }
}

async function completeCloudSignIn(user) {
  cloud.user = user;
  cloud.docRef = null;
  updateAuthUi();
  if (!user) return;

  cloud.docRef = cloud.doc(cloud.db, "users", user.uid, "financeData", CLOUD_DOC_ID);
  await pullCloudData();
}

function updateAuthUi() {
  const signedIn = Boolean(cloud.user);
  els.loginBtn.hidden = signedIn || !cloud.enabled;
  els.logoutBtn.hidden = !signedIn;
  els.cloudSyncBtn.hidden = !signedIn;

  if (!cloud.enabled) {
    setSyncStatus("Local only");
  } else if (signedIn) {
    setSyncStatus(`Cloud: ${cloud.user.email || "signed in"}`, true);
  } else {
    setSyncStatus("Cloud ready");
  }
}

async function pullCloudData() {
  if (!cloud.docRef) return;
  setSyncStatus("Cloud loading...", true);
  const snapshot = await cloud.getDoc(cloud.docRef);
  if (snapshot.exists()) {
    replaceState(snapshot.data());
    render(false);
    await syncPriceRequests();
  } else {
    await pushCloudData();
  }
  updateAuthUi();
}

async function pushCloudData() {
  if (!cloud.docRef) return;
  setSyncStatus("Cloud saving...", true);
  await cloud.setDoc(cloud.docRef, cloudSafeState(), { merge: true });
  await syncPriceRequests();
  updateAuthUi();
}

async function syncPriceRequests() {
  if (!cloud.db || !cloud.user || !cloud.doc || !cloud.setDoc) return;
  const tickers = usTickersInState();
  if (!tickers.length) return;

  const ref = cloud.doc(cloud.db, "priceRequests", "us");
  const tickerValue = typeof cloud.arrayUnion === "function" ? cloud.arrayUnion(...tickers) : tickers;
  await cloud.setDoc(ref, {
    tickers: tickerValue,
    updatedAt: new Date().toISOString()
  }, { merge: true });
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

function money(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function usd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPlainNumber(value) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 6
  }).format(Number(value || 0));
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
  if (type === "MANUAL") return "MANUAL";
  return String(asset.kind || priceForAsset(asset)?.kind || symbolForAsset(asset)?.kind || "STOCK").toUpperCase();
}

function productKindLabel(kind) {
  const labels = {
    STOCK: "개별종목",
    ETF: "ETF",
    ETN: "ETN",
    CASH: "현금",
    MANUAL: "수동평가"
  };
  return labels[kind] || kind;
}

function regionLabel(asset) {
  const type = assetType(asset);
  if (type === "KRX") return "국내";
  if (type === "US") return "해외";
  return "기타";
}

function accountClassLabel(asset) {
  const text = `${asset.account || ""} ${asset.name || ""} ${asset.note || ""}`.toLowerCase();
  if (/(연금|irp|퇴직)/i.test(text)) return "연금계좌";
  if (asset.account) return "일반계좌";
  return "계좌 미지정";
}

function assetGain(asset) {
  const cost = assetCost(asset);
  if (!cost || marketPriceMissing(asset)) return null;
  return assetValue(asset) - cost;
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
    if (els[key]) els[key].value = value;
  });
}

function render(syncCloud = true) {
  renderAssets();
  renderBreakdown();
  renderPriceNotice();
  renderHistory();
  renderRetirement();
  renderSummary();
  persist();
  if (syncCloud && cloud.docRef) {
    pushCloudData().catch((error) => {
      console.error(error);
      setSyncStatus("Cloud save failed");
    });
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
}

function renderAssets() {
  els.assetRows.textContent = "";
  updateVisibleAssetCount(state.assets.length, state.assets.length);
  if (!state.assets.length) {
    els.assetRows.append(els.emptyAssetTemplate.content.cloneNode(true));
    return;
  }

  const sorted = [...state.assets].sort((a, b) => assetValue(b) - assetValue(a));
  const filtered = sorted.filter(assetMatchesFilters);
  updateVisibleAssetCount(filtered.length, state.assets.length);

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="9" class="empty">조건에 맞는 자산이 없습니다.</td>`;
    els.assetRows.append(row);
    return;
  }

  filtered.forEach((asset) => {
    const gain = assetGain(asset);
    const gainRate = gain === null ? null : gain / assetCost(asset);
    const valueDetail = assetValueDetail(asset);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(asset.name)}</strong></td>
      <td>${escapeHtml(asset.account || "")}</td>
      <td>${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}</td>
      <td><span class="badge">${escapeHtml(assetTypeLabel(asset))}</span></td>
      <td class="number">${asset.quantity ? formatPlainNumber(asset.quantity) : "-"}</td>
      <td class="number">${money(assetValue(asset))}${valueDetail}</td>
      <td class="number ${gain > 0 ? "positive" : gain < 0 ? "negative" : ""}">${gain === null ? "-" : `${gain > 0 ? "+" : ""}${money(gain)}${gainRate ? ` (${gainRate > 0 ? "+" : ""}${percent(gainRate)})` : ""}`}</td>
      <td>${escapeHtml(asset.note || "")}</td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" title="수정" data-action="edit" data-id="${asset.id}">✎</button>
          <button class="icon-button" type="button" title="삭제" data-action="delete" data-id="${asset.id}">×</button>
        </div>
      </td>
    `;
    els.assetRows.append(row);
  });
}

function assetMatchesFilters(asset) {
  const type = assetType(asset);
  if (uiState.assetType !== "ALL" && type !== uiState.assetType) return false;

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

  if (!missing.length && !errors.length) {
    els.priceAlert.hidden = true;
    els.priceAlert.textContent = "";
    return;
  }

  const parts = [];
  if (missing.length) {
    const krxMissing = missing.filter((item) => item.startsWith("KRX:"));
    const usMissing = missing.filter((item) => item.startsWith("US:"));
    if (krxMissing.length) parts.push(`KRX 가격 대기: ${krxMissing.join(", ")}. 다음 가격표 업데이트 후 다시 확인하세요.`);
    if (usMissing.length) parts.push(`US 가격 대기: ${usMissing.join(", ")}. 가격표 생성 대상(tickers.json)에 추가해야 평가금액이 계산됩니다.`);
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
}

function assetValueDetail(asset) {
  const type = assetType(asset);
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
}

function addBreakdownValue(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function renderBreakdownSection(title, entries, total, limit = Infinity) {
  const section = document.createElement("section");
  section.className = "breakdown-section";
  section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;

  const displayEntries = limitedBreakdownEntries(entries, limit);
  const body = document.createElement("div");
  body.className = "pie-breakdown";
  body.innerHTML = `
    <div class="pie-chart" role="img" aria-label="${escapeHtml(title)} 파이차트"></div>
    <div class="pie-legend"></div>
  `;

  const chart = body.querySelector(".pie-chart");
  const legend = body.querySelector(".pie-legend");
  chart.style.background = pieGradient(displayEntries);

  displayEntries.forEach(([category, value], index) => {
    const ratio = total ? value / total : 0;
    const item = document.createElement("div");
    item.className = "pie-legend-item";
    item.innerHTML = `
      <span class="pie-swatch" style="background: ${PIE_COLORS[index % PIE_COLORS.length]}"></span>
      <span class="breakdown-name">${escapeHtml(category)}</span>
      <span class="breakdown-value">${money(value)} · ${(ratio * 100).toFixed(1)}%</span>
    `;
    legend.append(item);
  });

  section.append(body);
  els.categoryBreakdown.append(section);
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

function renderHistory() {
  els.historyRows.textContent = "";
  renderHistorySummary();
  if (!state.snapshots.length) {
    els.historyRows.append(els.emptyHistoryTemplate.content.cloneNode(true));
  } else {
    [...state.snapshots].reverse().forEach((snapshot, index, reversed) => {
      const previous = reversed[index + 1];
      const change = previous ? snapshot.total - previous.total : 0;
      const rate = previous ? deltaRate(snapshot.total, previous.total) : 0;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${formatDate(snapshot.createdAt)}</td>
        <td class="number">${money(snapshot.total)}</td>
        <td class="number ${change > 0 ? "positive" : change < 0 ? "negative" : ""}">${change > 0 ? "+" : ""}${money(change)}</td>
        <td class="number ${rate > 0 ? "positive" : rate < 0 ? "negative" : ""}">${rate > 0 ? "+" : ""}${percent(rate)}</td>
      `;
      els.historyRows.append(row);
    });
  }
  drawChart();
}

function renderHistorySummary() {
  if (!els.historySummary) return;
  els.historySummary.textContent = "";

  if (!state.snapshots.length) {
    const item = document.createElement("div");
    item.className = "history-summary-item";
    item.innerHTML = `<span>기록 상태</span><strong>대기</strong><small>첫 조회 기록을 저장하세요.</small>`;
    els.historySummary.append(item);
    return;
  }

  const totals = state.snapshots.map((snapshot) => Number(snapshot.total || 0));
  const first = totals[0];
  const latest = totals.at(-1);
  const high = Math.max(...totals);
  const low = Math.min(...totals);
  const change = latest - first;
  const items = [
    ["기록 수", `${state.snapshots.length}회`, "저장된 조회 시점"],
    ["최고 총자산", money(high), "조회 기록 기준"],
    ["최저 총자산", money(low), "조회 기록 기준"],
    ["누적 변화", `${change > 0 ? "+" : ""}${money(change)}`, percent(deltaRate(latest, first))]
  ];

  items.forEach(([label, value, detail]) => {
    const item = document.createElement("div");
    item.className = "history-summary-item";
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small>`;
    els.historySummary.append(item);
  });
}

function drawChart() {
  const canvas = els.historyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = 42;
  const points = state.snapshots.map((snapshot) => snapshot.total);
  const values = points.length ? points : [totalAssets()];
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  ctx.strokeStyle = "#dbe2dc";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#65716a";
  ctx.font = "13px Segoe UI, Arial";

  for (let i = 0; i <= 4; i += 1) {
    const y = pad + ((height - pad * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    const value = max - (range / 4) * i;
    ctx.fillText(compactMoney(value), 8, y + 4);
  }

  if (!points.length) {
    ctx.fillStyle = "#65716a";
    ctx.textAlign = "center";
    ctx.fillText("조회 기록을 저장하면 차트가 표시됩니다.", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  const xFor = (index) => {
    if (points.length === 1) return width / 2;
    return pad + ((width - pad * 2) / (points.length - 1)) * index;
  };
  const yFor = (value) => height - pad - ((value - min) / range) * (height - pad * 2);

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#1f7a4d";
  ctx.lineWidth = 4;
  ctx.stroke();

  points.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#1f7a4d";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function renderRetirement() {
  saveRetirementInputs();
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

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(date);
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
    els.toggleAssetFormBtn.textContent = "닫기";
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
  if (!manualValued) els.assetAmount.value = "";
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
  const normalized = raw.replace(/[₩원,\s()]/g, "");
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

els.assetRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const asset = state.assets.find((item) => item.id === button.dataset.id);
  if (!asset) return;

  if (button.dataset.action === "edit") {
    showAssetForm("edit");
    els.assetId.value = asset.id;
    els.assetName.value = asset.name;
    els.assetAccount.value = asset.account || "";
    els.assetTicker.value = asset.ticker || "";
    els.assetCategory.value = assetType(asset);
    els.assetAmount.value = isManualValuedType(assetType(asset)) ? formatPlainNumber(asset.amount || 0) : "";
    els.assetQuantity.value = asset.quantity || "";
    els.assetAveragePrice.value = asset.averagePrice || "";
    els.assetNote.value = asset.note || "";
    uiState.autofilledAssetName = "";
    els.saveAssetBtn.textContent = "수정 저장";
    updateAssetFormForType();
    els.assetName.focus();
  }

  if (button.dataset.action === "delete" && confirm(`${asset.name} 자산을 삭제할까요?`)) {
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    resetAssetForm();
    render();
  }
});

els.toggleAssetFormBtn.addEventListener("click", () => {
  if (els.assetFormPanel.hidden) {
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
    setSyncStatus("Opening Google login...");
    if (cloud.signInWithPopup) {
      const result = await cloud.signInWithPopup(cloud.auth, cloud.provider);
      if (result?.user) {
        await completeCloudSignIn(result.user);
      } else {
        setSyncStatus("Login completing...", true);
      }
      return;
    }
    await cloud.signInWithRedirect(cloud.auth, cloud.provider);
  } catch (error) {
    console.error(error);
    if (cloud.signInWithRedirect && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      setSyncStatus("Redirecting to Google login...");
      await cloud.signInWithRedirect(cloud.auth, cloud.provider);
      return;
    }
    setSyncStatus(`Login failed: ${error.code || "unknown"}`);
    alert(`로그인에 실패했습니다: ${error.code || "unknown"}`);
  }
});

els.logoutBtn.addEventListener("click", async () => {
  if (!cloud.enabled) return;
  await cloud.signOut(cloud.auth);
  cloud.docRef = null;
  updateAuthUi();
});

els.cloudSyncBtn.addEventListener("click", async () => {
  if (!cloud.docRef) return;
  try {
    await pushCloudData();
    setSyncStatus("Cloud synced", true);
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud sync failed");
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
  render(false);
});

els.assetTypeFilter.addEventListener("change", () => {
  uiState.assetType = normalizeAssetType(els.assetTypeFilter.value);
  if (els.assetTypeFilter.value === "ALL") uiState.assetType = "ALL";
  render(false);
});

els.snapshotBtn.addEventListener("click", () => {
  const now = new Date().toISOString();
  state.snapshots.push({
    id: uid(),
    createdAt: now,
    total: totalAssets(),
    assets: state.assets.map((asset) => ({ ...asset })),
    typeTotals: Object.fromEntries(
      state.assets.reduce((map, asset) => {
        const type = assetType(asset);
        map.set(type, (map.get(type) || 0) + assetValue(asset));
        return map;
      }, new Map())
    )
  });
  render();
});

els.clearHistoryBtn.addEventListener("click", () => {
  if (!state.snapshots.length) return;
  if (confirm("조회 히스토리를 모두 삭제할까요? 자산 원장은 유지됩니다.")) {
    state.snapshots = [];
    render();
  }
});

els.retirementForm.addEventListener("input", render);

els.syncAssetsBtn.addEventListener("click", () => {
  els.currentInvestable.value = totalAssets();
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
      if (els[key]) els[key].value = value;
    });
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
    state.assets = imported.assets;
    state.snapshots = imported.snapshots;
    state.retirement = { ...state.retirement, ...(imported.retirement || {}) };
    applyPricesToAssets();
    hydrateRetirementInputs();
    render();
  } catch {
    alert("가져올 수 없는 JSON 파일입니다.");
  } finally {
    event.target.value = "";
  }
});

hydrateRetirementInputs();
state.assets = state.assets.map(normalizeAsset);
applyPricesToAssets();
updateAssetFormForType();
render();
updateAuthUi();
initPrices();
initFirebase();
