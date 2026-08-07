import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const decisionEngineCode = readFileSync("decision-engine.js", "utf8");
const actionEngineCode = readFileSync("action-engine.js", "utf8");
const appCode = [readFileSync("ledger-engine.js", "utf8"), readFileSync("app.js", "utf8")].join("\n");
const STORAGE_KEY = "finance-ledger-retirement-v1";
const TODAY = "2026-08-05";

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
      fx: { USDKRW: { date: "2099-01-01", rate: 1000 } },
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
        US: {
          AAPL: {
            close: 200,
            date: "2099-01-01",
            kind: "STOCK",
            name: "Apple",
            source: "TEST"
          }
        }
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
  return element;
}

function setFormValue(window, form, name, value) {
  const element = form.elements.namedItem(name);
  assert.ok(element, `${name} form control should exist`);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
  return element;
}

function submit(window, selector) {
  const form = window.document.querySelector(selector);
  assert.ok(form, `${selector} form should exist`);
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

async function waitForApp(window, milliseconds = 60) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function storedState(window) {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
}

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});
const { window } = dom;
installBrowserStubs(window);

window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
  schemaVersion: 3,
  assets: [
    {
      id: "asset-samsung-general",
      name: "삼성전자",
      ticker: "5930",
      type: "KRX",
      account: "일반계좌",
      quantity: 10,
      averagePrice: 70000
    },
    {
      id: "asset-samsung-pension",
      name: "삼성전자",
      ticker: "005930",
      type: "KRX",
      account: "연금계좌",
      quantity: 5,
      averagePrice: 72000
    },
    {
      id: "asset-apple",
      name: "Apple",
      ticker: "AAPL",
      type: "US",
      account: "해외계좌",
      quantity: 2,
      averagePrice: 180
    },
    {
      id: "asset-cash",
      name: "대기 현금",
      type: "CASH",
      account: "현금계좌",
      amount: 300000
    },
    {
      id: "asset-cycle",
      name: "사이클 수동자산",
      type: "MANUAL",
      account: "대체자산",
      amount: 100000
    }
  ],
  decisionProfiles: [
    {
      id: "INSTRUMENT:KRX:005930",
      subjectKey: "INSTRUMENT:KRX:005930",
      name: "삼성전자",
      ticker: "005930",
      type: "KRX",
      investmentRole: "STRUCTURAL_GROWTH",
      thesis: "AI 메모리 구조적 성장",
      horizon: "LONG",
      conviction: "HIGH",
      lastReviewedAt: "2026-08-01",
      nextReviewAt: "2099-12-31",
      reviewStatus: "ACTIVE"
    },
    {
      id: "INSTRUMENT:US:AAPL",
      subjectKey: "INSTRUMENT:US:AAPL",
      name: "Apple",
      ticker: "AAPL",
      type: "US",
      investmentRole: "CORE",
      thesis: "서비스 현금흐름",
      horizon: "LONG",
      conviction: "HIGH",
      lastReviewedAt: "2026-08-01",
      nextReviewAt: "2099-12-31",
      reviewStatus: "ACTIVE"
    },
    {
      id: "ASSET:asset-cash",
      subjectKey: "ASSET:asset-cash",
      name: "대기 현금",
      type: "CASH",
      investmentRole: "CORE",
      thesis: "신규자금 대기",
      horizon: "SHORT",
      conviction: "HIGH",
      lastReviewedAt: "2026-08-01",
      nextReviewAt: "2099-12-31",
      reviewStatus: "ACTIVE"
    },
    {
      id: "ASSET:asset-cycle",
      subjectKey: "ASSET:asset-cycle",
      name: "사이클 수동자산",
      type: "MANUAL",
      investmentRole: "CYCLE",
      thesis: "원자재 사이클",
      horizon: "MEDIUM",
      conviction: "MEDIUM",
      lastReviewedAt: "2026-08-01",
      nextReviewAt: "2099-12-31",
      reviewStatus: "REVIEW"
    },
    {
      id: "INSTRUMENT:US:MSFT",
      subjectKey: "INSTRUMENT:US:MSFT",
      name: "Microsoft",
      ticker: "MSFT",
      type: "US",
      investmentRole: "CORE",
      thesis: "클라우드 관찰",
      horizon: "LONG",
      conviction: "MEDIUM",
      nextReviewAt: "2099-12-31",
      reviewStatus: "ACTIVE",
      riskTags: {
        industry: ["클라우드"],
        country: ["미국"]
      }
    }
  ],
  watchlist: [{
    id: "watch-msft",
    name: "Microsoft",
    ticker: "MSFT",
    type: "US"
  }],
  portfolioTargets: {
    domestic: 50,
    overseas: 20,
    cash: 20,
    manual: 10
  },
  snapshots: [],
  realizedTrades: [],
  tradeJournalEntries: [],
  retirementScenarios: [],
  retirement: {}
}));

window.eval(decisionEngineCode);
window.eval(actionEngineCode);
window.eval(appCode);
await waitForApp(window);

// schema v3 -> v4: 기존 목표를 band 목표로 계승하고 새 정책/계획/태그 기본값을 만든다.
let stored = storedState(window);
assert.equal(stored.schemaVersion, 6);
assert.deepEqual(
  Object.fromEntries(Object.entries(stored.policyProfile.allocationBands).map(([key, band]) => [key, band.targetPct])),
  { domestic: 50, overseas: 20, cash: 20, manual: 10 }
);
assert.deepEqual(stored.policyProfile.allocationBands.domestic, { minPct: 40, targetPct: 50, maxPct: 60 });
assert.deepEqual(stored.policyProfile.allocationBands.overseas, { minPct: 10, targetPct: 20, maxPct: 30 });
assert.deepEqual(stored.contributionPlan, { mode: "ONE_TIME", amount: 0 });
const samsungProfileAfterMigration = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.deepEqual(samsungProfileAfterMigration.riskTags, {
  industry: [],
  country: [],
  currency: [],
  rate: [],
  duration: [],
  customer: [],
  aiValueChain: []
});

// 자산 상세에서 7차원 태그를 쉼표/줄바꿈으로 저장하고 dirty snapshot에 포함한다.
window.eval('openAssetDetail("asset-samsung-general", null, { focusDecision: true })');
let decisionForm = window.document.querySelector("[data-asset-decision-form]");
assert.ok(decisionForm);
assert.match(window.document.querySelector(".decision-profile-guide").textContent, /2개 계좌/);
const maliciousTag = '<img src=x data-risk-xss onerror="window.__riskXss=1">';
setFormValue(window, decisionForm, "riskTagIndustry", "반도체, AI 인프라\n반도체");
assert.equal(window.eval("hasUnsavedAssetDecisionChanges()"), true);
let discardPrompts = 0;
window.confirm = () => {
  discardPrompts += 1;
  return false;
};
window.document.querySelector("[data-detail-close]").click();
assert.equal(discardPrompts, 1);
assert.equal(window.document.querySelector("#assetDetailOverlay").hidden, false);
window.confirm = () => true;
setFormValue(window, decisionForm, "riskTagCountry", "한국\n아시아");
setFormValue(window, decisionForm, "riskTagCurrency", "KRW, USD");
setFormValue(window, decisionForm, "riskTagRate", "금리 상승 취약\n금리 하락 수혜");
setFormValue(window, decisionForm, "riskTagDuration", "장기, 중기");
setFormValue(window, decisionForm, "riskTagCustomer", "데이터센터\n스마트폰 제조사");
setFormValue(window, decisionForm, "riskTagAiValueChain", `AI 메모리, 클라우드\n${maliciousTag}`);
submit(window, "[data-asset-decision-form]");

stored = storedState(window);
let sharedSamsungProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
);
assert.deepEqual(sharedSamsungProfile.riskTags.industry, ["반도체", "AI 인프라"]);
assert.deepEqual(sharedSamsungProfile.riskTags.country, ["한국", "아시아"]);
assert.deepEqual(sharedSamsungProfile.riskTags.currency, ["KRW", "USD"]);
assert.deepEqual(sharedSamsungProfile.riskTags.rate, ["금리 상승 취약", "금리 하락 수혜"]);
assert.deepEqual(sharedSamsungProfile.riskTags.duration, ["장기", "중기"]);
assert.deepEqual(sharedSamsungProfile.riskTags.customer, ["데이터센터", "스마트폰 제조사"]);
assert.deepEqual(sharedSamsungProfile.riskTags.aiValueChain, ["AI 메모리", "클라우드", maliciousTag]);
assert.equal(window.eval("hasUnsavedAssetDecisionChanges()"), false);

// 같은 티커의 다른 계좌에서도 하나의 공유 프로필 태그를 다시 읽는다.
window.document.querySelector("[data-detail-close]").click();
window.eval('openAssetDetail("asset-samsung-pension", null, { focusDecision: true })');
decisionForm = window.document.querySelector("[data-asset-decision-form]");
assert.match(decisionForm.elements.namedItem("riskTagIndustry").value, /반도체/);
assert.match(decisionForm.elements.namedItem("riskTagAiValueChain").value, /AI 메모리/);
window.document.querySelector("[data-detail-close]").click();

// 위험 지도는 동일 티커 계좌를 하나의 120만원 경제적 포지션으로 합산한다.
const riskAnalysis = window.eval(`AssetTrailActionEngine.analyzeRiskExposure(
  actionSupportRows(),
  storageSafeState().policyProfile.riskBudgets,
  { todayKey: "${TODAY}", staleDays: 180 }
)`);
assert.equal(riskAnalysis.totalValue, 2000000);
assert.equal(riskAnalysis.economicPositionCount, 4);
const samsungPosition = riskAnalysis.positions.find((position) => position.key === "KRX:005930");
assert.equal(samsungPosition.value, 1200000);
assert.deepEqual(Array.from(samsungPosition.assetIds), ["asset-samsung-general", "asset-samsung-pension"]);
const semiconductorExposure = riskAnalysis.tagExposures.find(
  (exposure) => exposure.dimension === "industry" && exposure.tag === "반도체"
);
assert.equal(semiconductorExposure.value, 1200000);
assert.equal(semiconductorExposure.weight, 0.6);
assert.equal(semiconductorExposure.positionCount, 1);
assert.equal(riskAnalysis.budgets.core.actualValue, 700000);
assert.equal(riskAnalysis.budgets.core.actualPct, 35);
assert.equal(riskAnalysis.budgets.satellite.actualValue, 1300000);
assert.equal(riskAnalysis.budgets.satellite.actualPct, 65);
assert.equal(riskAnalysis.budgets.aiStructural.actualValue, 1200000);
assert.equal(riskAnalysis.budgets.aiStructural.actualPct, 60);
assert.equal(riskAnalysis.budgets.cycle.actualValue, 100000);
assert.equal(riskAnalysis.budgets.cycle.actualPct, 5);

window.document.querySelector('[data-nav-view="PORTFOLIO"]').click();
assert.equal(window.document.querySelector("#bandDomesticMin").getAttribute("aria-label"), "국내 최소 비중");
assert.equal(window.document.querySelector("#targetOverseas").getAttribute("aria-label"), "해외 목표 비중");
assert.equal(window.document.querySelector("#bandManualMax").getAttribute("aria-label"), "수동 최대 비중");
const exposureText = window.document.querySelector("#manualExposureMap").textContent.replace(/\s+/g, " ");
assert.match(exposureText, /반도체/);
assert.match(exposureText, /₩1,200,000/);
assert.match(exposureText, /60\.0%/);
assert.match(exposureText, /1개 경제적 포지션/);
const budgetText = window.document.querySelector("#riskBudgetSummary").textContent.replace(/\s+/g, " ");
assert.match(budgetText, /코어\s*35\.0%/);
assert.match(budgetText, /위성\s*65\.0%/);
assert.match(budgetText, /AI 구조적 성장 · 오버레이\s*60\.0%/);
assert.match(budgetText, /사이클 · 오버레이\s*5\.0%/);
assert.equal(window.__riskXss, undefined);
assert.equal(
  window.document.querySelector("#manualExposureMap img, #manualExposureMap script, #manualExposureMap [data-risk-xss]"),
  null
);
assert.match(window.document.querySelector("#manualExposureMap").textContent, /<img src=x/);

// 비중 band를 저장하고 일회성 신규자금 전액을 최소/최대 안에서 배분한다.
setValue(window, "#bandDomesticMin", "45");
setValue(window, "#bandDomesticMax", "65");
setValue(window, "#bandOverseasMin", "5");
setValue(window, "#bandOverseasMax", "35");
setValue(window, "#bandCashMin", "5");
setValue(window, "#bandCashMax", "35");
setValue(window, "#bandManualMax", "25");
stored = storedState(window);
assert.deepEqual(stored.policyProfile.allocationBands.domestic, { minPct: 45, targetPct: 50, maxPct: 65 });
assert.deepEqual(stored.policyProfile.allocationBands.overseas, { minPct: 5, targetPct: 20, maxPct: 35 });

const oneTime = window.document.querySelector('[name="contributionMode"][value="ONE_TIME"]');
oneTime.checked = true;
oneTime.dispatchEvent(new window.Event("change", { bubbles: true }));
setValue(window, "#contributionAmount", "500000");
submit(window, "#contributionPlannerForm");
stored = storedState(window);
assert.deepEqual(stored.contributionPlan, { mode: "ONE_TIME", amount: 500000 });
const feasible = window.eval(`(() => {
  const analysis = AssetTrailActionEngine.analyzeRiskExposure(
    actionSupportRows(),
    storageSafeState().policyProfile.riskBudgets,
    { todayKey: "${TODAY}", staleDays: 180 }
  );
  return AssetTrailActionEngine.planContribution({
    ...storageSafeState().contributionPlan,
    buckets: allocationBucketsForEngine(analysis)
  });
})()`);
assert.equal(feasible.ok, true);
assert.equal(feasible.totalAllocated, 500000);
assert.equal(
  Array.from(feasible.allocations).reduce((sum, allocation) => sum + allocation.amount, 0),
  500000
);
assert.equal(Array.from(feasible.allocations).every(
  (allocation) => allocation.projectedWeight * 100 <= allocation.maxPct + 1e-8
), true);
assert.match(window.document.querySelector("#contributionResultStatus").textContent, /일회성.*₩500,000.*배분/);
const allocationText = window.document.querySelector("#contributionResult").textContent.replace(/\s+/g, " ");
assert.match(allocationText, /60\.0% → 50\.0%/);
assert.match(allocationText, /20\.0% → 20\.0%/);
assert.match(allocationText, /종목 선택 전 검토 필요/);
assert.match(allocationText, /검토가 필요한 자산군/);
assert.match(window.document.querySelector(".action-disclaimer").textContent, /실제 주문.*아니/);

// 같은 금액을 월 정기로도 저장할 수 있다.
const monthly = window.document.querySelector('[name="contributionMode"][value="MONTHLY"]');
monthly.checked = true;
monthly.dispatchEvent(new window.Event("change", { bubbles: true }));
submit(window, "#contributionPlannerForm");
stored = storedState(window);
assert.deepEqual(stored.contributionPlan, { mode: "MONTHLY", amount: 500000 });
assert.match(window.document.querySelector("#contributionResultStatus").textContent, /월 정기.*₩500,000.*배분/);

// 원화 신규자금은 조용히 반올림하지 않고 1원 단위 정수만 허용한다.
setValue(window, "#contributionAmount", "0.4");
submit(window, "#contributionPlannerForm");
assert.deepEqual(storedState(window).contributionPlan, { mode: "MONTHLY", amount: 500000 });
assert.match(window.document.querySelector("#contributionValidation").textContent, /1원 단위 정수/);
assert.equal(window.document.querySelector("#contributionAmount").getAttribute("aria-invalid"), "true");
assert.throws(
  () => window.eval('validateImportedContributionPlan({ mode: "ONE_TIME", amount: 1.5 })'),
  /1원 단위 정수/
);

// 현재 비중이 post max를 넘는 불가능 조건은 부분 제안 없이 실패한다.
setValue(window, "#bandDomesticMax", "50");
setValue(window, "#contributionAmount", "100000");
submit(window, "#contributionPlannerForm");
const impossible = window.eval(`(() => {
  const analysis = AssetTrailActionEngine.analyzeRiskExposure(
    actionSupportRows(),
    storageSafeState().policyProfile.riskBudgets,
    { todayKey: "${TODAY}", staleDays: 180 }
  );
  return AssetTrailActionEngine.planContribution({
    ...storageSafeState().contributionPlan,
    buckets: allocationBucketsForEngine(analysis)
  });
})()`);
assert.equal(impossible.ok, false);
assert.equal(impossible.code, "CURRENT_MAX_UNREACHABLE");
assert.deepEqual(Array.from(impossible.allocations), []);
assert.equal(impossible.totalAllocated, 0);
assert.equal(window.document.querySelector("#contributionResultStatus").textContent, "배분 불가");
assert.equal(window.document.querySelectorAll("#contributionResult .allocation-result-card").length, 0);
assert.match(window.document.querySelector("#contributionResult").textContent, /부분 금액을 임의로 제안하지 않았습니다/);

// 관심종목 폼에 태그 입력란이 없어도 기존 공유 프로필 riskTags를 지우지 않는다.
window.document.querySelector('[data-nav-view="ASSETS"]').click();
const watchEdit = window.document.querySelector('[data-watchlist-action="edit"][data-id="watch-msft"]');
assert.ok(watchEdit);
watchEdit.click();
setValue(window, "#watchlistName", "Microsoft 관찰");
setValue(window, "#watchlistThesis", "클라우드 성장성 재확인");
submit(window, "#watchlistForm");
stored = storedState(window);
const msftProfile = stored.decisionProfiles.find(
  (profile) => profile.subjectKey === "INSTRUMENT:US:MSFT"
);
assert.deepEqual(msftProfile.riskTags.industry, ["클라우드"]);
assert.deepEqual(msftProfile.riskTags.country, ["미국"]);

// 정책, 신규자금 계획, riskTags 각각이 로컬 충돌 fingerprint에 포함된다.
const fingerprintCoverage = window.eval(`(() => {
  const current = storageSafeState();
  const currentFingerprint = dataFingerprint(current);

  const contributionReset = JSON.parse(JSON.stringify(current));
  contributionReset.contributionPlan = { mode: "ONE_TIME", amount: 0 };

  const policyReset = JSON.parse(JSON.stringify(current));
  policyReset.policyProfile = normalizePolicyProfile(null, policyReset.portfolioTargets);

  const riskTagsReset = JSON.parse(JSON.stringify(current));
  const samsung = riskTagsReset.decisionProfiles.find(
    (profile) => profile.subjectKey === "INSTRUMENT:KRX:005930"
  );
  samsung.riskTags = normalizeRiskTags({});

  return {
    contribution: currentFingerprint !== dataFingerprint(contributionReset),
    policy: currentFingerprint !== dataFingerprint(policyReset),
    riskTags: currentFingerprint !== dataFingerprint(riskTagsReset)
  };
})()`);
assert.equal(fingerprintCoverage.contribution, true);
assert.equal(fingerprintCoverage.policy, true);
assert.equal(fingerprintCoverage.riskTags, true);

// 빈 포트폴리오는 임의 배분을 만들지 않고 입력 대기와 데이터 없음 상태를 안내한다.
window.eval("replaceState({ schemaVersion: 4 }); renderAllViews();");
window.document.querySelector('[data-nav-view="PORTFOLIO"]').click();
assert.equal(window.document.querySelector("#contributionResultStatus").textContent, "금액 입력 대기");
assert.equal(window.document.querySelectorAll("#contributionResult .allocation-result-card").length, 0);
assert.match(window.document.querySelector("#contributionResult").textContent, /신규자금과 비중 밴드/);
assert.match(window.document.querySelector("#riskExposureWarnings").textContent, /분석할 경제적 포지션이 없습니다/);
assert.match(window.document.querySelector("#manualExposureMap").textContent, /아직 수동 위험 태그가 없습니다/);

// 가격 누락 시장 자산이 있으면 불완전한 총액으로 신규자금 배분안을 만들지 않는다.
window.eval(`replaceState({
  schemaVersion: 4,
  assets: [
    { id: "missing-price", name: "가격 누락 종목", ticker: "MISSING", type: "US", account: "해외계좌", quantity: 1, averagePrice: 10 },
    { id: "known-cash", name: "현금", type: "CASH", account: "현금계좌", amount: 1000000 }
  ],
  contributionPlan: { mode: "ONE_TIME", amount: 100000 }
}); renderAllViews();`);
window.document.querySelector('[data-nav-view="PORTFOLIO"]').click();
assert.equal(window.document.querySelector("#contributionResultStatus").textContent, "평가금액 확인 필요");
assert.equal(window.document.querySelectorAll("#contributionResult .allocation-result-card").length, 0);
assert.match(window.document.querySelector("#contributionResult").textContent, /불완전한 총자산으로 배분안을 만들지 않았습니다/);
assert.match(window.document.querySelector("#riskExposureWarnings").textContent, /평가금액이 확인되지 않은 포지션이 1개/);

// 목표 합계의 표시 오차는 허용해도 수학적으로 불가능한 최소·최대 합계는 즉시 거부한다.
[
  "bandDomesticMin", "targetDomestic",
  "bandOverseasMin", "targetOverseas",
  "bandCashMin", "targetCash",
  "bandManualMin", "targetManual"
].forEach((id) => { window.document.querySelector(`#${id}`).value = "25.002"; });
["bandDomesticMax", "bandOverseasMax", "bandCashMax", "bandManualMax"]
  .forEach((id) => { window.document.querySelector(`#${id}`).value = "100"; });
assert.equal(window.eval("savePortfolioTargets()"), false);
assert.match(window.document.querySelector("#targetValidation").textContent, /최소 비중 합계/);

["bandDomesticMin", "bandOverseasMin", "bandCashMin", "bandManualMin"]
  .forEach((id) => { window.document.querySelector(`#${id}`).value = "0"; });
[
  "targetDomestic", "bandDomesticMax",
  "targetOverseas", "bandOverseasMax",
  "targetCash", "bandCashMax",
  "targetManual", "bandManualMax"
].forEach((id) => { window.document.querySelector(`#${id}`).value = "24.998"; });
assert.equal(window.eval("savePortfolioTargets()"), false);
assert.match(window.document.querySelector("#targetValidation").textContent, /최대 비중 합계/);

dom.window.close();
console.log("app action support tests passed");
