import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const standardAdapter = require("../broker-csv-adapter-standard.js");
const HEADERS = standardAdapter.format.requiredHeaders;
const STORAGE_KEY = "finance-ledger-retirement-v1";
const html = readFileSync("index.html", "utf8");
const appCode = [
  readFileSync("ledger-engine.js", "utf8"),
  readFileSync("broker-csv-engine.js", "utf8"),
  readFileSync("broker-csv-adapter-standard.js", "utf8"),
  readFileSync("app.js", "utf8")
].join("\n");

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  const records = [HEADERS, ...rows.map((item) => HEADERS.map((header) => item[header] ?? ""))];
  return `\uFEFF${records.map((record) => record.map(csvCell).join(",")).join("\r\n")}`;
}

function buyRow(overrides = {}) {
  return {
    assettrail_version: "1",
    transaction_id: "BUY-1",
    type: "BUY",
    trade_date: "2026-08-02",
    settlement_date: "2026-08-04",
    account: "증권계좌",
    cash_account: "증권계좌",
    market: "KRX",
    ticker: "005930",
    quantity: "1",
    price: "1000",
    currency: "KRW",
    fx_rate: "1",
    amount: "",
    fee_krw: "10",
    tax_krw: "5",
    ...overrides
  };
}

function depositRow(overrides = {}) {
  return buyRow({
    transaction_id: "DEPOSIT-1",
    type: "DEPOSIT",
    trade_date: "2026-08-02",
    settlement_date: "",
    account: "",
    market: "",
    ticker: "",
    quantity: "",
    price: "",
    currency: "KRW",
    fx_rate: "1",
    amount: "500",
    fee_krw: "",
    tax_krw: "",
    ...overrides
  });
}

function defaultLegacyAssets() {
  return [
    {
      id: "stock-1",
      name: "테스트 주식",
      ticker: "005930",
      type: "KRX",
      account: "증권계좌",
      quantity: 10,
      averagePrice: 1000
    },
    {
      id: "cash-1",
      name: "증권 예수금",
      type: "CASH",
      account: "증권계좌",
      amount: 1_000_000
    }
  ];
}

function installBrowserStubs(window, { downloads, alerts, consoleErrors }) {
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.HTMLCanvasElement.prototype.getContext = () => ({
    arc() {}, beginPath() {}, clearRect() {}, closePath() {},
    createLinearGradient: () => ({ addColorStop() {} }), fill() {}, fillRect() {}, fillText() {},
    lineTo() {}, measureText: () => ({ width: 20 }), moveTo() {}, rect() {}, restore() {}, roundRect() {},
    save() {}, setLineDash() {}, setTransform() {}, stroke() {}, strokeRect() {}
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  if (window.HTMLDialogElement) {
    window.HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    window.HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new window.Event("close"));
    };
  }
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push(this.download || "");
  };
  window.URL.createObjectURL = () => `blob:assettrail-test-${downloads.length + 1}`;
  window.URL.revokeObjectURL = () => {};
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.console.error = (...values) => consoleErrors.push(values.map(String).join(" "));
  window.console.warn = () => {};
  window.firebaseConfig = {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatedAt: "2026-08-06T00:00:00.000Z",
      fx: {},
      prices: { KRX: {}, US: {} },
      symbols: { KRX: {}, US: {} },
      errors: []
    })
  });
}

async function makeScenario({ assets = defaultLegacyAssets() } = {}) {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://localhost/"
  });
  const { window } = dom;
  const downloads = [];
  const alerts = [];
  const consoleErrors = [];
  installBrowserStubs(window, { downloads, alerts, consoleErrors });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 4,
    assets,
    snapshots: [],
    meta: { lastSavedAt: "2026-08-01T00:00:00.000Z" },
    retirement: {}
  }));
  window.eval(`${appCode}
    const brokerCsvTestOriginalDownload = downloadStateFile;
    const brokerCsvTestOriginalPersist = persist;
    window.__brokerCsvTestApi = {
      async previewText(text) {
        const bytes = new TextEncoder().encode(text);
        await readBrokerCsvFile({ size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
        return this.previewInfo();
      },
      readFile: (file) => readBrokerCsvFile(file),
      previewInfo() {
        return {
          summary: brokerCsvPreview?.prepared?.summary || null,
          mappingRequests: brokerCsvPreview?.prepared?.mappingRequests || [],
          candidates: brokerCsvPreview?.validation?.candidateEvents || [],
          validation: brokerCsvPreview?.validation || null,
          applicable: brokerCsvApplicability().ok,
          hasRaw: Boolean(brokerCsvPreview?.text)
        };
      },
      state: () => storageSafeState(),
      open: () => openBrokerCsvDialog(document.querySelector("#openBrokerCsvImportBtn")),
      close: () => closeBrokerCsvDialog(),
      apply: () => applyBrokerCsvPreview(),
      mutateAssetName() {
        if (state.assets[0]) state.assets[0].name += " 변경";
        renderBrokerCsvPreview();
      },
      failBackup: () => { downloadStateFile = () => false; },
      failPersist: () => { persist = () => false; },
      restoreFunctions() {
        downloadStateFile = brokerCsvTestOriginalDownload;
        persist = brokerCsvTestOriginalPersist;
      },
      eventLimitBlocked(candidate) {
        const originalEvents = state.events;
        try {
          state.events = new Array(IMPORT_LIMITS.events);
          const result = validateBrokerCsvCandidates({ candidateEvents: [candidate], rows: [] });
          return { exceeded: result.eventLimitExceeded, projection: result.projection, message: result.projectionError };
        } finally {
          state.events = originalEvents;
        }
      }
    };
  `);
  await new Promise((resolve) => window.setTimeout(resolve, 40));
  return { dom, window, downloads, alerts, consoleErrors, api: window.__brokerCsvTestApi };
}

{
  const scenario = await makeScenario();
  const { window, api, downloads } = scenario;
  const input = csv([
    depositRow({ transaction_id: "PRIVATE-DEPOSIT-1" }),
    buyRow({ transaction_id: "PRIVATE-BUY-1" }),
    buyRow({ transaction_id: "INVALID-DATE", trade_date: "2026-02-30" })
  ]);
  api.open();
  const beforePreview = window.localStorage.getItem(STORAGE_KEY);
  const preview = await api.previewText(input);
  assert.equal(preview.summary.ready, 2);
  assert.equal(preview.summary.invalid, 1);
  assert.equal(preview.candidates.length, 2);
  assert.equal(preview.applicable, true);
  assert.equal(window.document.querySelector("#applyBrokerCsvImportBtn").disabled, false);
  assert.equal(window.localStorage.getItem(STORAGE_KEY), beforePreview, "preview must not persist candidate rows");
  assert.equal(window.localStorage.getItem(STORAGE_KEY).includes("PRIVATE-DEPOSIT-1"), false);
  assert.match(window.document.querySelector("#brokerCsvPreviewSummary").textContent, /현금/);

  const eventCountBefore = api.state().events.length;
  const limit = api.eventLimitBlocked(preview.candidates[0]);
  assert.equal(limit.exceeded, true);
  assert.equal(limit.projection, null);
  assert.match(limit.message, /50,000/);

  api.apply();
  const applied = api.state();
  assert.equal(applied.events.length, eventCountBefore + 2);
  assert.equal(applied.assets.find((asset) => asset.id === "stock-1").quantity, 11);
  assert.equal(applied.assets.find((asset) => asset.id === "cash-1").amount, 999_485);
  assert.equal(downloads.some((name) => name.startsWith("finance-ledger-before-csv-")), true);
  assert.equal(api.previewInfo().hasRaw, false, "successful close must release the raw CSV text");
  assert.equal(window.document.querySelector("#brokerCsvImportDialog").hasAttribute("open"), false);

  api.open();
  const changedAndNew = csv([
    buyRow({ transaction_id: "PRIVATE-BUY-1", price: "1100" }),
    depositRow({ transaction_id: "NEW-DEPOSIT", trade_date: "2026-08-05" })
  ]);
  const conflict = await api.previewText(changedAndNew);
  assert.equal(conflict.summary.conflict, 1);
  assert.equal(conflict.summary.ready, 1);
  assert.equal(conflict.applicable, false);
  const beforeConflictApply = api.state().events.length;
  api.apply();
  assert.equal(api.state().events.length, beforeConflictApply, "a conflict must block the otherwise valid subset");
  assert.match(window.document.querySelector("#brokerCsvImportStatus").textContent, /원본 거래 ID/);

  api.close();
  api.open();
  const duplicate = await api.previewText(input);
  assert.equal(duplicate.summary.duplicate, 2);
  assert.equal(duplicate.candidates.length, 0);
  assert.equal(duplicate.applicable, false);
  scenario.dom.window.close();
}

{
  const scenario = await makeScenario();
  const { window, api, downloads } = scenario;
  api.open();
  await api.previewText(csv([depositRow({ transaction_id: "STALE-1" })]));
  const before = api.state().events.length;
  api.mutateAssetName();
  assert.equal(window.document.querySelector("#applyBrokerCsvImportBtn").disabled, true);
  api.apply();
  assert.equal(api.state().events.length, before);
  assert.equal(downloads.length, 0);
  assert.match(window.document.querySelector("#brokerCsvImportStatus").textContent, /원장이 바뀌/);
  scenario.dom.window.close();
}

{
  const scenario = await makeScenario();
  const { window, api, downloads } = scenario;
  api.open();
  await api.previewText(csv([depositRow({ transaction_id: "BACKUP-FAIL" })]));
  const before = api.state().events.length;
  api.failBackup();
  api.apply();
  assert.equal(api.state().events.length, before);
  assert.equal(downloads.length, 0);
  assert.match(window.document.querySelector("#brokerCsvImportStatus").textContent, /백업에 실패/);
  assert.equal(api.previewInfo().hasRaw, true);
  scenario.dom.window.close();
}

{
  const scenario = await makeScenario();
  const { api, alerts, consoleErrors } = scenario;
  api.open();
  await api.previewText(csv([depositRow({ transaction_id: "PERSIST-FAIL-PRIVATE" })]));
  const before = JSON.stringify(api.state());
  api.failPersist();
  api.apply();
  api.restoreFunctions();
  assert.equal(JSON.stringify(api.state()), before, "failed persistence must roll back the full ledger state");
  assert.match(alerts.at(-1), /거래 원장을 저장하지 않았습니다/);
  assert.equal(consoleErrors.some((message) => message.includes("PERSIST-FAIL-PRIVATE")), false);
  scenario.dom.window.close();
}

{
  const ambiguousAssets = [
    { id: "stock-a", name: "주식 A", ticker: "005930", type: "KRX", account: "별칭 A", quantity: 5, averagePrice: 1000 },
    { id: "stock-b", name: "주식 B", ticker: "005930", type: "KRX", account: "별칭 B", quantity: 5, averagePrice: 1000 },
    { id: "cash-a", name: "현금 A", type: "CASH", account: "별칭 A", amount: 100_000 },
    { id: "cash-b", name: "현금 B", type: "CASH", account: "별칭 B", amount: 100_000 }
  ];
  const scenario = await makeScenario({ assets: ambiguousAssets });
  const { window, api } = scenario;
  const piiAccount = "고객 홍길동 123-456-7890";
  const input = csv([buyRow({ transaction_id: "MAPPING-1", account: piiAccount, cash_account: piiAccount })]);
  api.open();
  const before = window.localStorage.getItem(STORAGE_KEY);
  const unresolved = await api.previewText(input);
  assert.equal(unresolved.summary.unresolved, 1);
  assert.equal(unresolved.mappingRequests.length, 2);
  assert.equal(window.document.body.textContent.includes(piiAccount), false);
  assert.equal(window.localStorage.getItem(STORAGE_KEY), before);
  assert.equal(window.localStorage.getItem(STORAGE_KEY).includes(piiAccount), false);

  let assetSelect = window.document.querySelector('[data-broker-csv-mapping-kind="assets"]');
  assetSelect.value = "stock-b";
  assetSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  let cashSelect = window.document.querySelector('[data-broker-csv-mapping-kind="cash"]');
  cashSelect.value = "cash-b";
  cashSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(api.previewInfo().applicable, true);
  assert.equal(api.previewInfo().candidates[0].assetId, "stock-b");
  assert.equal(api.previewInfo().candidates[0].cashAssetId, "cash-b");
  scenario.dom.window.close();
}

{
  const ambiguousAssets = [
    { id: "stock-a", name: "주식 A", ticker: "005930", type: "KRX", account: "별칭 A", quantity: 5, averagePrice: 1000 },
    { id: "stock-b", name: "주식 B", ticker: "005930", type: "KRX", account: "별칭 B", quantity: 5, averagePrice: 1000 },
    { id: "cash-a", name: "현금 A", type: "CASH", account: "별칭 A", amount: 1_000_000 },
    { id: "cash-b", name: "현금 B", type: "CASH", account: "별칭 B", amount: 1_000_000 }
  ];
  const scenario = await makeScenario({ assets: ambiguousAssets });
  const { window, api } = scenario;
  const rows = Array.from({ length: 201 }, (_, index) => buyRow({
    transaction_id: `MAP-CAP-${index}`,
    account: `원본 계좌 ${index}`,
    cash_account: `원본 계좌 ${index}`
  }));
  api.open();
  const preview = await api.previewText(csv(rows));
  assert.equal(preview.mappingRequests.length, 402);
  assert.equal(window.document.querySelectorAll('[data-broker-csv-mapping-kind="assets"]').length, 200);
  assert.equal(window.document.querySelectorAll('[data-broker-csv-mapping-kind="cash"]').length, 200);
  assert.match(window.document.querySelector("#brokerCsvAccountMappings").textContent, /200개씩/);
  scenario.dom.window.close();
}

{
  const scenario = await makeScenario();
  const { window, api } = scenario;
  const rows = Array.from({ length: 501 }, (_, index) => depositRow({
    transaction_id: `ROW-CAP-${index}`,
    amount: "1"
  }));
  api.open();
  const preview = await api.previewText(csv(rows));
  assert.equal(preview.summary.ready, 501);
  assert.equal(window.document.querySelectorAll("#brokerCsvPreviewRows [data-csv-status]").length, 500);
  assert.match(window.document.querySelector("#brokerCsvPreviewRows").textContent, /처음 500건/);
  scenario.dom.window.close();
}

{
  const scenario = await makeScenario();
  const { api } = scenario;
  const slowText = csv([depositRow({ transaction_id: "SLOW-A", trade_date: "2026-08-02" })]);
  const fastText = csv([depositRow({ transaction_id: "FAST-B", trade_date: "2026-08-05" })]);
  const slowBytes = new TextEncoder().encode(slowText);
  let resolveSlow;
  const slowFile = {
    size: slowBytes.byteLength,
    arrayBuffer: () => new Promise((resolve) => { resolveSlow = resolve; })
  };
  const slowRead = api.readFile(slowFile);
  await api.previewText(fastText);
  resolveSlow(slowBytes.buffer);
  await slowRead;
  assert.equal(api.previewInfo().candidates[0].sourceId, "FAST-B");
  scenario.dom.window.close();
}

console.log("app broker CSV tests passed");
