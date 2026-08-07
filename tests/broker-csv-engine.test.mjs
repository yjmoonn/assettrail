import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../broker-csv-engine.js");
const standard = require("../broker-csv-adapter-standard.js");

const HEADERS = standard.format.requiredHeaders;

function csvCell(value, delimiter = ",") {
  const text = String(value ?? "");
  return /["\r\n]/.test(text) || text.includes(delimiter)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function csv(rows, { delimiter = ",", bom = false, eol = "\n" } = {}) {
  const records = [HEADERS, ...rows.map((row) => HEADERS.map((header) => row[header] ?? ""))];
  return `${bom ? "\uFEFF" : ""}${records.map((record) => record.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join(eol)}`;
}

function row(overrides = {}) {
  return {
    assettrail_version: "1",
    transaction_id: "TX-1",
    type: "BUY",
    trade_date: "2026-08-02",
    settlement_date: "2026-08-04",
    account: "연금",
    cash_account: "연금",
    market: "KRX",
    ticker: "005930",
    quantity: "10",
    price: "1000",
    currency: "KRW",
    fx_rate: "1",
    amount: "",
    fee_krw: "10",
    tax_krw: "5",
    ...overrides
  };
}

const baseAssets = [
  { id: "krx-pension", type: "KRX", ticker: "005930", account: "연금", name: "국내 자산" },
  { id: "us-general", type: "US", ticker: "MSFT", account: "일반", name: "미국 자산" },
  { id: "cash-pension", type: "CASH", ticker: "", account: "연금", name: "연금 현금" },
  { id: "cash-general", type: "CASH", ticker: "", account: "일반", name: "일반 현금" }
];

function preview(text, overrides = {}) {
  return engine.preparePreview({
    text,
    assets: baseAssets,
    events: [],
    baselineDate: "2026-08-01",
    ...overrides
  });
}

assert.equal(engine.MAX_FILE_BYTES, 15 * 1024 * 1024);
assert.equal(engine.MAX_DATA_ROWS, 50_000);
assert.equal(engine.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(engine.listAdapters().some((item) => item.id === "assettrail-standard-v1"), true);
assert.deepEqual(standard.format.supportedTypes, [
  "BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX"
]);
assert.match(standard.format.amountSemantics.amount, /양수 총액/);
assert.match(standard.format.amountSemantics.price, /총액이나 순액이 아님/);

{
  const context = vm.createContext({
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    DataView,
    Map,
    Set,
    Date,
    Object,
    String,
    Number,
    Math,
    RegExp,
    Error,
    TypeError
  });
  vm.runInContext(readFileSync("broker-csv-engine.js", "utf8"), context);
  vm.runInContext(readFileSync("broker-csv-adapter-standard.js", "utf8"), context);
  assert.equal(typeof context.AssetTrailBrokerCsvEngine?.preparePreview, "function");
  assert.equal(context.AssetTrailBrokerCsvEngine.listAdapters().length, 1);
  assert.equal(context.AssetTrailBrokerCsvStandardAdapter.id, "assettrail-standard-v1");
}

{
  const parsed = engine.parseCsv('\uFEFFa,b\r\n"첫 줄\r\n둘째 줄","쉼표, 값"\r\nplain,value');
  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.dataRowCount, 2);
  assert.equal(parsed.rows[0].values.a, "첫 줄\n둘째 줄");
  assert.equal(parsed.rows[0].values.b, "쉼표, 값");
  assert.equal(parsed.rows[1].values.a, "plain");
}

{
  const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("a,b\n1,2")]);
  assert.deepEqual(engine.decodeCsv(utf8), { text: "a,b\n1,2", encoding: "utf-8" });
  const utf16Bytes = new Uint8Array([0xff, 0xfe, ...new Uint8Array(Buffer.from("a,b\n1,2", "utf16le"))]);
  assert.deepEqual(engine.decodeCsv(utf16Bytes), { text: "a,b\n1,2", encoding: "utf-16le" });
  const cp949 = new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0xb0, 0xa1, 0x2c, 0x31]);
  assert.deepEqual(engine.decodeCsv(cp949), { text: "a,b\n가,1", encoding: "euc-kr" });
}

{
  assert.throws(
    () => engine.parseCsv("a,b\n1,2", { byteLength: engine.MAX_FILE_BYTES + 1 }),
    (error) => error.code === "FILE_TOO_LARGE" && !/1,2/.test(error.message)
  );
  const tooMany = `a\n${Array.from({ length: engine.MAX_DATA_ROWS + 1 }, () => "x").join("\n")}`;
  assert.throws(() => engine.parseCsv(tooMany), (error) => error.code === "TOO_MANY_ROWS");
  assert.throws(() => engine.parseCsv('a,b\n"not closed,2'), (error) => error.code === "CSV_UNCLOSED_QUOTE");
  assert.throws(() => engine.parseCsv('a,b\n"closed" trailing,2'), (error) => error.code === "CSV_INVALID_QUOTE");
}

{
  const validCsv = csv([
    row(),
    row({
      transaction_id: "DIV-1",
      type: "DIVIDEND",
      trade_date: "2026.08.03",
      settlement_date: "",
      quantity: "",
      price: "",
      amount: "100",
      fee_krw: "",
      tax_krw: ""
    }),
    row({
      transaction_id: "DEP-1",
      type: "DEPOSIT",
      trade_date: "20260804",
      settlement_date: "",
      account: "",
      market: "",
      ticker: "",
      quantity: "",
      price: "",
      amount: "1000",
      fee_krw: "",
      tax_krw: ""
    }),
    row({
      transaction_id: "SELL-US-1",
      type: "SELL",
      trade_date: "2026/08/05",
      settlement_date: "2026/08/07",
      account: "일반",
      cash_account: "일반",
      market: "US",
      ticker: "msft",
      quantity: "2",
      price: "100",
      currency: "USD",
      fx_rate: "1400",
      fee_krw: "100",
      tax_krw: "0"
    })
  ], { bom: true, eol: "\r\n" });
  const result = preview(validCsv);
  assert.equal(result.adapter.id, "assettrail-standard-v1");
  assert.equal(result.summary.totalRows, 4);
  assert.equal(result.summary.ready, 4);
  assert.equal(result.summary.invalid, 0);
  assert.deepEqual(result.summary.period, { from: "2026-08-02", to: "2026-08-05" });
  assert.equal(result.summary.accountCount, 2);
  assert.equal(result.summary.mappingRequestCount, 0);
  assert.equal(result.summary.cashDeltaKRW, 270_985);
  assert.equal(result.summary.feesKRW, 110);
  assert.equal(result.summary.taxesKRW, 5);
  assert.deepEqual(result.summary.typeCounts, { BUY: 1, DIVIDEND: 1, DEPOSIT: 1, SELL: 1 });
  assert.deepEqual(
    result.summary.positionChanges.map((item) => [item.assetId, item.quantityDelta]),
    [["krx-pension", 10], ["us-general", -2]]
  );
  assert.equal(result.candidateEvents[0].instrumentKey, "INSTRUMENT:KRX:005930");
  assert.equal(result.candidateEvents[0].cashAccountId, "ACCOUNT:cash-pension");
  assert.equal(result.candidateEvents[3].grossAmountKRW, 280_000);
  assert.equal(Object.isFrozen(result), true);

  const repeated = preview(validCsv, { events: result.candidateEvents });
  assert.equal(repeated.summary.ready, 0);
  assert.equal(repeated.summary.duplicate, 4);
  assert.equal(repeated.candidateEvents.length, 0);

  const changedRows = [
    row({ price: "1001" }),
    row({
      transaction_id: "DIV-1", type: "DIVIDEND", trade_date: "2026.08.03", settlement_date: "",
      quantity: "", price: "", amount: "100", fee_krw: "", tax_krw: ""
    }),
    row({
      transaction_id: "DEP-1", type: "DEPOSIT", trade_date: "20260804", settlement_date: "", account: "",
      market: "", ticker: "", quantity: "", price: "", amount: "1000", fee_krw: "", tax_krw: ""
    }),
    row({
      transaction_id: "SELL-US-1", type: "SELL", trade_date: "2026/08/05", settlement_date: "2026/08/07",
      account: "일반", cash_account: "일반", market: "US", ticker: "msft", quantity: "2", price: "100",
      currency: "USD", fx_rate: "1400", fee_krw: "100", tax_krw: "0"
    })
  ];
  const changed = preview(csv(changedRows), { events: result.candidateEvents });
  assert.equal(changed.summary.conflict, 1);
  assert.equal(changed.summary.duplicate, 3);
  assert.equal(changed.issues.some((item) => item.code === "SOURCE_CHANGED"), true);
}

{
  const fallbackCsv = csv([
    row({ transaction_id: "" }),
    row({ transaction_id: "" })
  ]);
  const first = preview(fallbackCsv);
  assert.equal(first.summary.ready, 2);
  assert.notEqual(first.candidateEvents[0].sourceId, first.candidateEvents[1].sourceId);
  assert.match(first.candidateEvents[0].sourceId, /^fallback:v1:[a-f0-9]{64}:1$/);
  assert.match(first.candidateEvents[1].sourceId, /:2$/);
  const second = preview(fallbackCsv, { events: first.candidateEvents });
  assert.equal(second.summary.duplicate, 2);
  assert.equal(second.summary.ready, 0);
  const renumberedExisting = first.candidateEvents.map((event, index) => ({
    ...event,
    sourceId: event.sourceId.replace(/:\d+$/, `:${index + 90}`)
  }));
  const multisetMatch = preview(fallbackCsv, { events: renumberedExisting });
  assert.equal(multisetMatch.summary.duplicate, 2, "fallback dedupe must compare the economic fingerprint multiset");
}

{
  const partialCsv = csv([
    row({
      transaction_id: "VALID-DEP", type: "DEPOSIT", account: "", market: "", ticker: "", quantity: "", price: "",
      amount: "500", fee_krw: "", tax_krw: ""
    }),
    row({ transaction_id: "BAD-DATE", trade_date: "2026-02-30" }),
    row({
      transaction_id: "BAD-FX", market: "US", ticker: "MSFT", account: "일반", cash_account: "일반",
      currency: "USD", fx_rate: ""
    }),
    row({ transaction_id: "BAD-TYPE", type: "GIFT" }),
    row({ transaction_id: "OLD", trade_date: "2026-07-31" })
  ]);
  const result = preview(partialCsv);
  assert.equal(result.summary.ready, 1);
  assert.equal(result.summary.invalid, 3);
  assert.equal(result.summary.excluded, 1);
  assert.equal(result.candidateEvents.length, 1);
  assert.equal(result.issues.some((item) => item.code === "MISSING_FX_RATE"), true);
  assert.equal(result.issues.some((item) => item.code === "BEFORE_BASELINE"), true);
}

{
  const ambiguousAssets = [
    { id: "stock-a", type: "KRX", ticker: "005930", account: "별칭 A" },
    { id: "stock-b", type: "KRX", ticker: "005930", account: "별칭 B" },
    { id: "cash-a", type: "CASH", account: "별칭 A" },
    { id: "cash-b", type: "CASH", account: "별칭 B" }
  ];
  const piiAccount = "고객 홍길동 123-456-7890";
  const sensitiveCell = "절대-로그에-남기지-말것";
  const input = csv([row({ account: piiAccount, cash_account: piiAccount, price: sensitiveCell })]);
  const invalid = preview(input, { assets: ambiguousAssets });
  const serializedInvalid = JSON.stringify(invalid);
  assert.equal(serializedInvalid.includes(piiAccount), false);
  assert.equal(serializedInvalid.includes(sensitiveCell), false);
  assert.equal(invalid.summary.invalid, 1);

  const mappingInput = csv([row({ account: piiAccount, cash_account: piiAccount })]);
  const unresolved = preview(mappingInput, { assets: ambiguousAssets });
  assert.equal(unresolved.summary.unresolved, 1);
  assert.equal(unresolved.mappingRequests.length, 2);
  assert.equal(unresolved.summary.accountCount, 1);
  assert.equal(unresolved.summary.mappingRequestCount, 2);
  assert.equal(JSON.stringify(unresolved).includes(piiAccount), false);
  assert.equal(unresolved.mappingRequests.every((request) => /7890|참조/.test(request.hint)), true);
  const assetRequest = unresolved.mappingRequests.find((request) => request.kind === "asset");
  const cashRequest = unresolved.mappingRequests.find((request) => request.kind === "cash");
  const resolved = preview(mappingInput, {
    assets: ambiguousAssets,
    mappings: {
      assets: { [assetRequest.key]: "stock-b" },
      cash: { [cashRequest.key]: "cash-b" }
    }
  });
  assert.equal(resolved.summary.ready, 1);
  assert.equal(resolved.candidateEvents[0].assetId, "stock-b");
  assert.equal(resolved.candidateEvents[0].cashAssetId, "cash-b");

  const badMapping = preview(mappingInput, {
    assets: ambiguousAssets,
    mappings: {
      assets: { [assetRequest.key]: "cash-a" },
      cash: { [cashRequest.key]: "stock-a" }
    }
  });
  assert.equal(badMapping.summary.unresolved, 1);
  assert.equal(badMapping.issues.some((item) => item.code === "INVALID_ASSET_MAPPING"), true);
  assert.equal(badMapping.issues.some((item) => item.code === "INVALID_CASH_MAPPING"), true);
}

{
  const noAsset = preview(csv([row({ ticker: "999999" })]), {
    assets: [{ id: "cash-only", type: "CASH", account: "연금" }]
  });
  assert.equal(noAsset.summary.unresolved, 1);
  assert.equal(noAsset.issues.some((item) => item.code === "ASSET_NOT_FOUND"), true);
}

{
  const unexpected = preview(csv([
    row({ amount: "100" }),
    row({
      transaction_id: "FEE-1", type: "FEE", account: "", market: "", ticker: "", quantity: "", price: "",
      amount: "10", fee_krw: "10", tax_krw: ""
    })
  ]));
  assert.equal(unexpected.summary.invalid, 2);
  assert.equal(unexpected.issues.filter((item) => item.code === "UNEXPECTED_FIELD").length, 2);
}

{
  const tabSeparated = csv([row()], { delimiter: "\t" });
  assert.equal(preview(tabSeparated).summary.ready, 1);
  const malformedWidth = `${csv([row()])}\n1,2,3`;
  const result = preview(malformedWidth);
  assert.equal(result.summary.ready, 1);
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.issues.some((item) => item.code === "COLUMN_COUNT_MISMATCH"), true);
}

{
  const reducedHeaders = HEADERS.filter((header) => header !== "cash_account");
  const missingHeader = reducedHeaders.join(",")
    + `\n${reducedHeaders.map((header) => header === "assettrail_version" ? "1" : "").join(",")}`;
  assert.throws(
    () => preview(missingHeader),
    (error) => error.code === "MISSING_REQUIRED_HEADER" && error.field === "cash_account"
  );

  const emptyRegistry = engine.createRegistry();
  assert.throws(() => preview(csv([row()]), { registry: emptyRegistry }), (error) => error.code === "UNSUPPORTED_FORMAT");

  const ambiguousRegistry = engine.createRegistry();
  const adapterShape = (id) => ({
    id,
    brokerCode: id.toUpperCase(),
    version: 1,
    priority: 0,
    detect: () => ({ confidence: 0.9 }),
    parse: () => ({ rows: [] })
  });
  ambiguousRegistry.register(adapterShape("format-a"));
  ambiguousRegistry.register(adapterShape("format-b"));
  assert.throws(
    () => preview(csv([row()]), { registry: ambiguousRegistry }),
    (error) => error.code === "AMBIGUOUS_FORMAT"
  );
}

console.log("broker CSV engine tests passed");
