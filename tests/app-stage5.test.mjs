import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("index.html", "utf8");
const appCode = [
  "ledger-engine.js",
  "performance-engine.js",
  "external-data-engine.js",
  "etf-exposure-engine.js",
  "ai-report-engine.js",
  "app.js"
].map((path) => readFileSync(path, "utf8")).join("\n");

const dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/"
});
const { window } = dom;

window.HTMLCanvasElement.prototype.getContext = () => ({
  arc() {}, beginPath() {}, clearRect() {}, closePath() {}, createLinearGradient: () => ({ addColorStop() {} }),
  fill() {}, fillRect() {}, fillText() {}, lineTo() {}, measureText: () => ({ width: 20 }), moveTo() {},
  rect() {}, restore() {}, roundRect() {}, save() {}, setLineDash() {}, setTransform() {}, stroke() {}, strokeRect() {}
});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLAnchorElement.prototype.click = () => {};
window.URL.createObjectURL = () => "blob:stage5-test";
window.URL.revokeObjectURL = () => {};
window.alert = (message) => { throw new Error(`Unexpected alert: ${message}`); };
window.confirm = () => true;
window.console.error = () => {};
window.firebaseConfig = {};
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    generatedAt: "2026-08-07T00:00:00.000Z",
    fx: {},
    prices: { KRX: {}, US: {} },
    errors: []
  })
});

window.eval(`${appCode}
  window.__stage5TestApi = {
    setupPortfolio() {
      state.assets = [
        normalizeAsset({ id: "stock-1", name: "비공개 회사명", ticker: "005930", type: "KRX", account: "비공개 계좌", quantity: 1, averagePrice: 90, currentPrice: 100, kind: "STOCK" }),
        normalizeAsset({ id: "etf-1", name: "비공개 ETF명", ticker: "069500", type: "KRX", account: "비공개 계좌", quantity: 1, averagePrice: 45, currentPrice: 50, kind: "ETF" }),
        normalizeAsset({ id: "cash-1", name: "비공개 현금", ticker: "CASH", type: "CASH", account: "비공개 계좌", amount: 25 })
      ];
      state.watchlist = [];
      state.performanceObservations = [];
      renderAnalysisWorkspace();
    },
    saveButler(table) {
      renderButlerInstrumentOptions();
      els.butlerAssetSelect.value = "INSTRUMENT:KRX:005930";
      els.butlerCurrency.value = "KRW";
      els.butlerSourceUrl.value = "https://www.butler.works/ko/companies/00126380";
      els.butlerClipboardText.value = table;
      const preview = previewButlerImport();
      saveButlerPreview();
      return JSON.parse(JSON.stringify(preview));
    },
    async importEtf(catalog) {
      const serialized = JSON.stringify(catalog);
      await importEtfCatalogFile({ size: serialized.length, text: async () => serialized });
      renderAnalysisWorkspace();
    },
    externalRaw() {
      return localStorage.getItem(externalDataStorageKey());
    },
    catalogRaw() {
      return localStorage.getItem(etfCatalogStorageKey());
    },
    mainRaw() {
      return localStorage.getItem(activeStorageKey);
    },
    analysis() {
      return JSON.parse(JSON.stringify(etfAnalysis));
    },
    envelope() {
      return JSON.parse(JSON.stringify(currentEvidenceEnvelope));
    },
    deterministicReport() {
      return JSON.parse(JSON.stringify(currentDeterministicReport));
    },
    validateTradeInstruction() {
      const envelope = currentEvidenceEnvelope;
      const fact = envelope.facts.find((item) => item.metric === "DOMESTIC_WEIGHT");
      const report = {
        schemaVersion: "ASSETTRAIL_AI_REPORT_V1",
        sourceEnvelopeDigest: envelope.digest,
        generatedBy: "CHATGPT_MANUAL",
        items: [{
          section: "ALLOCATION",
          kind: "INTERPRETATION",
          text: "이 종목을 지금 매수하세요.",
          factIds: [fact.factId],
          evidenceIds: fact.evidenceIds
        }]
      };
      return AssetTrailAiReportEngine.validateAiReport(report, envelope);
    },
    handoff() {
      return AssetTrailAiReportEngine.buildChatGptHandoff(currentEvidenceEnvelope);
    },
    missingCatalogEvidence() {
      const previous = etfCatalog;
      etfCatalog = null;
      renderAnalysisWorkspace();
      const totals = etfLookThroughTotals(etfAnalysis);
      const unmapped = currentEvidenceEnvelope.facts.find((fact) => fact.metric === "ETF_UNMAPPED_WEIGHT");
      const mapped = currentEvidenceEnvelope.facts.find((fact) => fact.metric === "ETF_MAPPED_WEIGHT");
      const result = { totals, unmapped, mapped };
      etfCatalog = previous;
      renderAnalysisWorkspace();
      return JSON.parse(JSON.stringify(result));
    },
    templateValidation() {
      return AssetTrailEtfExposureEngine.validateHoldingsCatalog(buildEtfCatalogTemplate());
    },
    catalogFreshnessFor(catalog) {
      const previous = etfCatalog;
      const validation = AssetTrailEtfExposureEngine.validateHoldingsCatalog(catalog);
      if (!validation.ok) return { validation };
      etfCatalog = canonicalEtfCatalog(validation);
      const freshness = relevantEtfCatalogFreshness();
      etfCatalog = previous;
      return JSON.parse(JSON.stringify({ validation, freshness }));
    },
    canonicalExternalReload() {
      const key = externalDataStorageKey();
      const original = localStorage.getItem(key);
      const parsed = JSON.parse(original);
      parsed.snapshots[0].unexpectedField = "must-not-survive";
      localStorage.setItem(key, JSON.stringify(parsed));
      const loaded = loadExternalDataStore();
      const result = JSON.stringify(loaded);
      localStorage.setItem(key, original);
      externalDataStore = loadExternalDataStore();
      return result;
    },
    externalLimitProtection() {
      const rawBefore = localStorage.getItem(externalDataStorageKey());
      let message = "";
      try {
        persistExternalDataStore({
          schemaVersion: EXTERNAL_DATA_STORE_SCHEMA,
          snapshots: Array.from({ length: EXTERNAL_DATA_SNAPSHOT_LIMIT + 1 }, () => externalDataStore.snapshots[0]),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        message = error.message;
      }
      return { message, unchanged: localStorage.getItem(externalDataStorageKey()) === rawBefore };
    },
    corruptedStoreProtection(catalog) {
      const originalKey = activeStorageKey;
      const corruptKey = storageKeyForUser({ uid: "corrupt-stage5-test" });
      activeStorageKey = corruptKey;
      localStorage.setItem(externalDataStorageKey(), "{broken-external");
      localStorage.setItem(etfCatalogStorageKey(), "{broken-etf");
      switchAnalysisStores();
      let externalError = "";
      let etfError = "";
      try {
        persistExternalDataStore({ schemaVersion: EXTERNAL_DATA_STORE_SCHEMA, snapshots: [], updatedAt: new Date().toISOString() });
      } catch (error) {
        externalError = error.message;
      }
      try {
        persistEtfCatalog(catalog);
      } catch (error) {
        etfError = error.message;
      }
      const result = {
        externalIssue: Boolean(analysisStorageIssues.external),
        etfIssue: Boolean(analysisStorageIssues.etf),
        externalPreserved: localStorage.getItem(externalDataStorageKey()) === "{broken-external",
        etfPreserved: localStorage.getItem(etfCatalogStorageKey()) === "{broken-etf",
        externalError,
        etfError
      };
      localStorage.removeItem(externalDataStorageKey());
      localStorage.removeItem(etfCatalogStorageKey());
      activeStorageKey = originalKey;
      switchAnalysisStores();
      renderAnalysisWorkspace();
      return result;
    },
    userSwitchClearsStage5Dom() {
      const originalKey = activeStorageKey;
      els.butlerSourceUrl.value = "https://www.butler.works/private-user-a";
      els.aiReportJson.value = "private-user-a-json";
      els.validatedAiReport.textContent = "private-user-a-report";
      els.aiReportValidationStatus.textContent = "private-user-a-status";
      activeStorageKey = storageKeyForUser({ uid: "different-stage5-user" });
      switchAnalysisStores();
      const result = {
        sourceUrl: els.butlerSourceUrl.value,
        reportJson: els.aiReportJson.value,
        validatedReport: els.validatedAiReport.textContent,
        validationStatus: els.aiReportValidationStatus.textContent,
        optionText: els.butlerAssetSelect.textContent,
        externalCount: externalDataStore.snapshots.length,
        hasCatalog: Boolean(etfCatalog)
      };
      activeStorageKey = originalKey;
      switchAnalysisStores();
      renderAnalysisWorkspace();
      return result;
    },
    async externalBackupRoundTrip() {
      const raw = localStorage.getItem(externalDataStorageKey());
      const imported = await importExternalDataBackupFile({ size: raw.length, text: async () => raw });
      return { imported, count: externalDataStore.snapshots.length };
    },
    async delayedEtfImportAfterUserSwitch(catalog) {
      const originalKey = activeStorageKey;
      const serialized = JSON.stringify(catalog);
      let releaseText;
      const pending = importEtfCatalogFile({
        size: serialized.length,
        text: () => new Promise((resolve) => { releaseText = resolve; })
      });
      activeStorageKey = storageKeyForUser({ uid: "stage5-race-target" });
      switchAnalysisStores();
      releaseText(serialized);
      let message = "";
      try {
        await pending;
      } catch (error) {
        message = error.message;
      }
      const leaked = localStorage.getItem(etfCatalogStorageKey());
      localStorage.removeItem(externalDataStorageKey());
      localStorage.removeItem(etfCatalogStorageKey());
      activeStorageKey = originalKey;
      switchAnalysisStores();
      renderAnalysisWorkspace();
      return { message, leaked };
    },
    async delayedExternalImportAfterClear() {
      const key = externalDataStorageKey();
      const original = localStorage.getItem(key);
      let releaseText;
      const pending = importExternalDataBackupFile({
        size: original.length,
        text: () => new Promise((resolve) => { releaseText = resolve; })
      });
      clearAnalysisStore("external");
      releaseText(original);
      let message = "";
      try {
        await pending;
      } catch (error) {
        message = error.message;
      }
      const resurrected = localStorage.getItem(key);
      localStorage.setItem(key, original);
      externalDataStore = loadExternalDataStore();
      renderAnalysisWorkspace();
      return { message, resurrected };
    },
    async delayedEtfImportAfterClear(catalog) {
      const key = etfCatalogStorageKey();
      const original = localStorage.getItem(key);
      const serialized = JSON.stringify(catalog);
      let releaseText;
      const pending = importEtfCatalogFile({
        size: serialized.length,
        text: () => new Promise((resolve) => { releaseText = resolve; })
      });
      clearAnalysisStore("etf");
      releaseText(serialized);
      let message = "";
      try {
        await pending;
      } catch (error) {
        message = error.message;
      }
      const resurrected = localStorage.getItem(key);
      localStorage.setItem(key, original);
      etfCatalog = loadStoredEtfCatalog();
      renderAnalysisWorkspace();
      return { message, resurrected };
    },
    crossTabWriteProtection() {
      const externalKey = externalDataStorageKey();
      const etfKey = etfCatalogStorageKey();
      const originalExternal = localStorage.getItem(externalKey);
      const originalEtf = localStorage.getItem(etfKey);
      const otherExternal = JSON.stringify({ ...JSON.parse(originalExternal), updatedAt: "2026-08-07T01:00:00.000Z" });
      const otherEtf = JSON.stringify({ ...JSON.parse(originalEtf), generatedAt: "2026-08-07T01:00:00.000Z" });
      localStorage.setItem(externalKey, otherExternal);
      localStorage.setItem(etfKey, otherEtf);
      let externalMessage = "";
      let etfMessage = "";
      try {
        persistExternalDataStore(externalDataStore);
      } catch (error) {
        externalMessage = error.message;
      }
      try {
        persistEtfCatalog(etfCatalog);
      } catch (error) {
        etfMessage = error.message;
      }
      const result = {
        externalMessage,
        etfMessage,
        externalPreserved: localStorage.getItem(externalKey) === otherExternal,
        etfPreserved: localStorage.getItem(etfKey) === otherEtf
      };
      localStorage.setItem(externalKey, originalExternal);
      localStorage.setItem(etfKey, originalEtf);
      externalDataStore = loadExternalDataStore();
      etfCatalog = loadStoredEtfCatalog();
      renderAnalysisWorkspace();
      return result;
    },
    missingPriceEtfStatus() {
      const asset = state.assets.find((item) => item.id === "etf-1");
      const previousPrice = asset.currentPrice;
      asset.currentPrice = 0;
      renderAnalysisWorkspace();
      const fact = currentEvidenceEnvelope.facts.find((item) => item.metric === "ETF_COVERAGE");
      const quality = etfValuationQuality();
      const result = { fact, quality };
      asset.currentPrice = previousPrice;
      renderAnalysisWorkspace();
      return JSON.parse(JSON.stringify(result));
    }
  };
`);

await new Promise((resolve) => window.setTimeout(resolve, 30));
const api = window.__stage5TestApi;
api.setupPortfolio();

const butlerTable = [
  "연도\t2024\t2025",
  "손익계산서",
  "매출액\t100\t120",
  "영업이익\t10\t18",
  "순이익\t8\t12",
  "재무상태표",
  "자산총계\t200\t240",
  "부채총계\t80\t90",
  "자본총계\t120\t150",
  "현금흐름표",
  "영업현금흐름\t20\t24",
  "CAPEX\t5\t6",
  "FCF\t15\t18"
].join("\n");

const preview = api.saveButler(butlerTable);
assert.equal(preview.ok, true);
assert.equal(preview.snapshot.source.acquisitionMethod, "BUTLER_MANUAL");
assert.equal(api.externalRaw().includes("4분기누적"), false);
assert.equal(api.externalRaw().includes(butlerTable), false);
assert.equal(JSON.parse(api.externalRaw()).snapshots.length, 1);

const catalog = {
  schemaVersion: "assettrail.etf-holdings.v1",
  generatedAt: "2026-08-07T00:00:00.000Z",
  source: {
    name: "사용자 제공 테스트",
    url: "https://example.com/holdings",
    retrievedAt: "2026-08-07T00:00:00.000Z"
  },
  redistribution: { status: "USER_SUPPLIED", notice: "테스트용 사용자 제공" },
  funds: [{
    instrumentId: "KRX:069500",
    name: "테스트 ETF",
    structure: "PHYSICAL_LONG_ONLY",
    asOf: "2026-08-07",
    holdings: [
      { instrumentId: "KRX:005930", instrumentKind: "STOCK", weight: 0.8 },
      { bucket: "CASH", weight: 0.2 }
    ]
  }]
};
await api.importEtf(catalog);

const analysis = api.analysis();
assert.equal(analysis.ok, true);
assert.equal(analysis.totalValueKRW, 175);
assert.equal(analysis.invariantDeltaKRW, 0);
const stockExposure = analysis.exposures.find((row) => row.instrumentId === "KRX:005930");
assert.equal(stockExposure.directValueKRW, 100);
assert.equal(stockExposure.lookThroughValueKRW, 40);
assert.equal(analysis.totals.cashKRW, 35);
assert.equal(JSON.parse(api.catalogRaw()).funds.length, 1);
assert.equal(JSON.parse(api.catalogRaw()).funds[0].holdings[0].instrumentKind, "STOCK");

const envelope = api.envelope();
assert.equal(window.AssetTrailAiReportEngine.validateEvidenceEnvelope(envelope).ok, true);
assert.equal(envelope.policy, "RELATIVE_METRICS_ONLY");
assert.equal(envelope.facts.some((fact) => fact.metric === "DIRECT_OVERLAP_WEIGHT"), true);
assert.ok(Math.abs(envelope.facts.find((fact) => fact.metric === "ETF_TOTAL_WEIGHT").valuePct - (50 / 175 * 100)) < 1e-8);
assert.ok(Math.abs(envelope.facts.find((fact) => fact.metric === "ETF_CASH_OTHER_WEIGHT").valuePct - (10 / 175 * 100)) < 1e-8);
assert.equal(envelope.facts.some((fact) => fact.kind === "RATIO"), false);
const companyStatus = envelope.facts.find((fact) => fact.metric === "COMPANY_DATA");
assert.equal(companyStatus.state, "LIMITED");
assert.equal(companyStatus.quality, "LIMITED");
assert.equal(companyStatus.evidenceIds.length, 1);
assert.equal(envelope.evidence.find((item) => item.id === companyStatus.evidenceIds[0]).kind, "BUTLER_SNAPSHOT");
const serializedEnvelope = JSON.stringify(envelope);
["비공개 회사명", "비공개 ETF명", "비공개 계좌", "005930", "069500", "valueKRW", "amountKRW"]
  .forEach((secret) => assert.equal(serializedEnvelope.includes(secret), false, secret));

const deterministic = api.deterministicReport();
const deterministicValidation = window.AssetTrailAiReportEngine.validateAiReport(deterministic, envelope);
assert.equal(deterministicValidation.ok, true, JSON.stringify(deterministicValidation.errors));
const tradeInstruction = api.validateTradeInstruction();
assert.equal(tradeInstruction.ok, false);
assert.equal(tradeInstruction.errors.some((error) => error.code === "TRADE_INSTRUCTION_BLOCKED"), true);

const handoff = api.handoff();
assert.equal(handoff.mode, "MANUAL_COPY_ONLY");
assert.equal(handoff.apiKeyUsed, false);
assert.equal(handoff.networkRequestPerformed, false);
assert.equal(JSON.stringify(handoff).includes("비공개"), false);
assert.deepEqual(Array.from(handoff.responseContract.itemFields), ["section", "kind", "text", "factIds", "evidenceIds"]);

const missingCatalog = api.missingCatalogEvidence();
assert.equal(missingCatalog.totals.lookThroughTotal, 50);
assert.equal(missingCatalog.totals.mappedLookThrough, 0);
assert.equal(missingCatalog.totals.opaqueLookThrough, 50);
assert.ok(Math.abs(missingCatalog.unmapped.valuePct - (50 / 175 * 100)) < 1e-8);
assert.equal(missingCatalog.mapped.valuePct, 0);

const unchangedTemplate = api.templateValidation();
assert.equal(unchangedTemplate.ok, false);
assert.equal(unchangedTemplate.diagnostics.some((item) => item.code === "INVALID_FUND_INSTRUMENT_ID"), true);

const nestedFreshnessCatalog = {
  ...catalog,
  funds: [
    {
      ...catalog.funds[0],
      holdings: [{ instrumentId: "US:CHILD", instrumentKind: "STOCK", weight: 1 }]
    },
    {
      instrumentId: "US:CHILD",
      name: "ID 충돌 테스트",
      structure: "PHYSICAL_LONG_ONLY",
      asOf: "2020-01-01",
      holdings: [{ bucket: "CASH", weight: 1 }]
    }
  ]
};
const stockCollisionFreshness = api.catalogFreshnessFor(nestedFreshnessCatalog);
assert.equal(stockCollisionFreshness.validation.ok, true);
assert.equal(stockCollisionFreshness.freshness.asOfDate, "2026-08-07");
const nestedFundFreshness = api.catalogFreshnessFor({
  ...nestedFreshnessCatalog,
  funds: nestedFreshnessCatalog.funds.map((fund, index) => index === 0
    ? { ...fund, holdings: [{ instrumentId: "US:CHILD", instrumentKind: "ETF", weight: 1 }] }
    : fund)
});
assert.equal(nestedFundFreshness.validation.ok, true);
assert.equal(nestedFundFreshness.freshness.asOfDate, "2020-01-01");

assert.equal(api.canonicalExternalReload().includes("must-not-survive"), false);
const backupRoundTrip = await api.externalBackupRoundTrip();
assert.equal(backupRoundTrip.imported, true);
assert.equal(backupRoundTrip.count, 1);
const limitProtection = api.externalLimitProtection();
assert.match(limitProtection.message, /최대 60개/);
assert.equal(limitProtection.unchanged, true);

const corrupted = api.corruptedStoreProtection(catalog);
assert.equal(corrupted.externalIssue, true);
assert.equal(corrupted.etfIssue, true);
assert.equal(corrupted.externalPreserved, true);
assert.equal(corrupted.etfPreserved, true);
assert.match(corrupted.externalError, /원본을 보호/);
assert.match(corrupted.etfError, /원본을 보호/);

const crossTab = api.crossTabWriteProtection();
assert.match(crossTab.externalMessage, /다른 탭/);
assert.match(crossTab.etfMessage, /다른 탭/);
assert.equal(crossTab.externalPreserved, true);
assert.equal(crossTab.etfPreserved, true);

const delayedExternalAfterClear = await api.delayedExternalImportAfterClear();
assert.match(delayedExternalAfterClear.message, /가져오기를 취소/);
assert.equal(delayedExternalAfterClear.resurrected, null);
const delayedEtfAfterClear = await api.delayedEtfImportAfterClear(catalog);
assert.match(delayedEtfAfterClear.message, /가져오기를 취소/);
assert.equal(delayedEtfAfterClear.resurrected, null);

const missingPriceEtf = api.missingPriceEtfStatus();
assert.equal(missingPriceEtf.quality.etfAssetCount, 1);
assert.equal(missingPriceEtf.quality.valuedEtfAssetCount, 0);
assert.equal(missingPriceEtf.quality.missingEtfValuationCount, 1);
assert.equal(missingPriceEtf.fact.state, "INCOMPLETE");
assert.equal(missingPriceEtf.fact.quality, "INCOMPLETE");

const switched = api.userSwitchClearsStage5Dom();
assert.equal(switched.sourceUrl, "");
assert.equal(switched.reportJson, "");
assert.equal(switched.validatedReport, "");
assert.equal(switched.validationStatus.includes("private-user-a"), false);
assert.equal(switched.optionText.includes("비공개"), false);
assert.equal(switched.externalCount, 0);
assert.equal(switched.hasCatalog, false);

const delayedImport = await api.delayedEtfImportAfterUserSwitch(catalog);
assert.match(delayedImport.message, /사용자 데이터 영역이 바뀌어/);
assert.equal(delayedImport.leaked, null);

assert.equal(api.mainRaw().includes("BUTLER_MANUAL"), false);
assert.equal(readFileSync("ai-report-engine.js", "utf8").includes("api.openai.com"), false);

console.log("app stage5 integration tests passed");
