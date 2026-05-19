const STORAGE_KEY = "finance-ledger-retirement-v1";
const CLOUD_DOC_ID = "primary";
const firebaseConfig = window.firebaseConfig || {};

let cloud = {
  auth: null,
  db: null,
  docRef: null,
  enabled: false,
  ready: false,
  user: null
};

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
  assetId: document.querySelector("#assetId"),
  assetName: document.querySelector("#assetName"),
  assetTicker: document.querySelector("#assetTicker"),
  assetCategory: document.querySelector("#assetCategory"),
  assetAmount: document.querySelector("#assetAmount"),
  assetQuantity: document.querySelector("#assetQuantity"),
  assetAveragePrice: document.querySelector("#assetAveragePrice"),
  assetNote: document.querySelector("#assetNote"),
  saveAssetBtn: document.querySelector("#saveAssetBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  snapshotBtn: document.querySelector("#snapshotBtn"),
  assetRows: document.querySelector("#assetRows"),
  categoryBreakdown: document.querySelector("#categoryBreakdown"),
  historyChart: document.querySelector("#historyChart"),
  historyRows: document.querySelector("#historyRows"),
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
  syncStatus: document.querySelector("#syncStatus"),
  loginBtn: document.querySelector("#loginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  cloudSyncBtn: document.querySelector("#cloudSyncBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  emptyAssetTemplate: document.querySelector("#emptyAssetTemplate"),
  emptyHistoryTemplate: document.querySelector("#emptyHistoryTemplate")
};

const state = loadState();

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
      assets: Array.isArray(saved.assets) ? saved.assets : [],
      snapshots: Array.isArray(saved.snapshots) ? saved.snapshots : [],
      retirement: { ...fallback.retirement, ...(saved.retirement || {}) }
    };
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hasFirebaseConfig() {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(firebaseConfig[key]));
}

function cloudSafeState() {
  return {
    assets: state.assets,
    snapshots: state.snapshots,
    retirement: state.retirement,
    updatedAt: new Date().toISOString()
  };
}

function replaceState(nextState) {
  state.assets = Array.isArray(nextState.assets) ? nextState.assets : [];
  state.snapshots = Array.isArray(nextState.snapshots) ? nextState.snapshots : [];
  state.retirement = { ...state.retirement, ...(nextState.retirement || {}) };
  hydrateRetirementInputs();
}

function setSyncStatus(text, online = false) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.classList.toggle("online", online);
}

async function initFirebase() {
  if (!hasFirebaseConfig()) {
    setSyncStatus("Local only");
    return;
  }

  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const app = appModule.initializeApp(firebaseConfig);
    cloud.auth = authModule.getAuth(app);
    cloud.db = firestoreModule.getFirestore(app);
    cloud.provider = new authModule.GoogleAuthProvider();
    cloud.signInWithPopup = authModule.signInWithPopup;
    cloud.signOut = authModule.signOut;
    cloud.doc = firestoreModule.doc;
    cloud.getDoc = firestoreModule.getDoc;
    cloud.setDoc = firestoreModule.setDoc;
    cloud.enabled = true;
    cloud.ready = true;

    authModule.onAuthStateChanged(cloud.auth, async (user) => {
      cloud.user = user;
      updateAuthUi();
      if (!user) return;
      cloud.docRef = cloud.doc(cloud.db, "users", user.uid, "financeData", CLOUD_DOC_ID);
      await pullCloudData();
    });
  } catch (error) {
    console.error(error);
    setSyncStatus("Firebase load failed");
  }
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
  } else {
    await pushCloudData();
  }
  updateAuthUi();
}

async function pushCloudData() {
  if (!cloud.docRef) return;
  setSyncStatus("Cloud saving...", true);
  await cloud.setDoc(cloud.docRef, cloudSafeState(), { merge: true });
  updateAuthUi();
}

function money(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
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

function totalAssets() {
  return state.assets.reduce((sum, asset) => sum + assetValue(asset), 0);
}

function assetValue(asset) {
  const quantity = Number(asset.quantity || 0);
  const currentPrice = Number(asset.currentPrice || 0);
  if (quantity > 0 && currentPrice > 0) return quantity * currentPrice;
  return Number(asset.amount || 0);
}

function assetCost(asset) {
  const quantity = Number(asset.quantity || 0);
  const averagePrice = Number(asset.averagePrice || 0);
  if (quantity > 0 && averagePrice > 0) return quantity * averagePrice;
  return 0;
}

function assetGain(asset) {
  const cost = assetCost(asset);
  if (!cost) return null;
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
  if (!state.assets.length) {
    els.assetRows.append(els.emptyAssetTemplate.content.cloneNode(true));
    return;
  }

  const sorted = [...state.assets].sort((a, b) => assetValue(b) - assetValue(a));
  sorted.forEach((asset) => {
    const gain = assetGain(asset);
    const gainRate = gain === null ? null : gain / assetCost(asset);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(asset.name)}</strong></td>
      <td>${asset.ticker ? `<span class="ticker">${escapeHtml(asset.ticker)}</span>` : ""}</td>
      <td><span class="badge">${escapeHtml(asset.category)}</span></td>
      <td class="number">${asset.quantity ? formatPlainNumber(asset.quantity) : "-"}</td>
      <td class="number">${money(assetValue(asset))}</td>
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

  const categories = new Map();
  state.assets.forEach((asset) => {
    categories.set(asset.category, (categories.get(asset.category) || 0) + assetValue(asset));
  });

  [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, value]) => {
      const ratio = total ? value / total : 0;
      const item = document.createElement("div");
      item.className = "breakdown-item";
      item.innerHTML = `
        <div class="breakdown-line">
          <span class="breakdown-name">${escapeHtml(category)}</span>
          <span class="breakdown-value">${money(value)} · ${(ratio * 100).toFixed(1)}%</span>
        </div>
        <div class="bar"><span style="width: ${Math.max(2, ratio * 100)}%"></span></div>
      `;
      els.categoryBreakdown.append(item);
    });
}

function renderHistory() {
  els.historyRows.textContent = "";
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
  els.saveAssetBtn.textContent = "자산 저장";
}

function normalizeAssetKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
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
  const asset = {
    id: els.assetId.value || uid(),
    name: els.assetName.value.trim(),
    ticker: els.assetTicker.value.trim().toUpperCase(),
    category: els.assetCategory.value,
    amount: numberValue(els.assetAmount),
    quantity: decimalValue(els.assetQuantity),
    averagePrice: decimalValue(els.assetAveragePrice),
    note: els.assetNote.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!asset.name) return;

  const index = state.assets.findIndex((item) =>
    els.assetId.value ? item.id === asset.id : normalizeAssetKey(item.name) === normalizeAssetKey(asset.name)
  );
  if (index >= 0) state.assets[index] = { ...state.assets[index], ...asset, id: state.assets[index].id };
  else state.assets.push(asset);

  resetAssetForm();
  render();
});

els.assetRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const asset = state.assets.find((item) => item.id === button.dataset.id);
  if (!asset) return;

  if (button.dataset.action === "edit") {
    els.assetId.value = asset.id;
    els.assetName.value = asset.name;
    els.assetTicker.value = asset.ticker || "";
    els.assetCategory.value = asset.category;
    els.assetAmount.value = formatPlainNumber(asset.amount || assetValue(asset));
    els.assetQuantity.value = asset.quantity || "";
    els.assetAveragePrice.value = asset.averagePrice || "";
    els.assetNote.value = asset.note || "";
    els.saveAssetBtn.textContent = "수정 저장";
    els.assetName.focus();
  }

  if (button.dataset.action === "delete" && confirm(`${asset.name} 자산을 삭제할까요?`)) {
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    resetAssetForm();
    render();
  }
});

els.loginBtn.addEventListener("click", async () => {
  if (!cloud.enabled) {
    alert("firebase-config.js에 Firebase 설정값을 먼저 입력하세요.");
    return;
  }
  try {
    await cloud.signInWithPopup(cloud.auth, cloud.provider);
  } catch (error) {
    console.error(error);
    alert("로그인에 실패했습니다. Firebase Authentication 설정을 확인하세요.");
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

els.snapshotBtn.addEventListener("click", () => {
  const now = new Date().toISOString();
  state.snapshots.push({
    id: uid(),
    createdAt: now,
    total: totalAssets(),
    assets: state.assets.map((asset) => ({ ...asset })),
    categoryTotals: Object.fromEntries(
      state.assets.reduce((map, asset) => {
        map.set(asset.category, (map.get(asset.category) || 0) + assetValue(asset));
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
    hydrateRetirementInputs();
    render();
  } catch {
    alert("가져올 수 없는 JSON 파일입니다.");
  } finally {
    event.target.value = "";
  }
});

hydrateRetirementInputs();
render();
updateAuthUi();
initFirebase();
