import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../external-data-engine.js");

const API = [
  "buildButlerCompanyUrl",
  "mergeSnapshots",
  "parseButlerClipboard",
  "summarizeCompanyFacts",
  "validateExternalSnapshot"
];
assert.deepEqual(Object.keys(engine).sort(), API);

{
  const context = vm.createContext({ URL, Date, Object, Array, Map, Set, Math, JSON, RegExp, String, Number });
  vm.runInContext(readFileSync("external-data-engine.js", "utf8"), context);
  assert.deepEqual(Object.keys(context.AssetTrailExternalDataEngine).sort(), API);
}

const context = Object.freeze({
  market: "KRX",
  ticker: "005930",
  entityName: "삼성전자",
  currency: "KRW",
  sourceUrl: "https://www.butler.works/ko/companies/00126380",
  retrievedAt: "2026-08-04T01:02:03.000Z"
});

const table = [
  "4분기누적\t24.03 (24Q1)\t25.03 (25Q1)\t25.06 (25Q2E)",
  "손익계산서",
  "매출액\t71,915,600\t79,099,000\t80,000,000(E)",
  "영업이익\t6,606,000\t6,685,300\t7,000,000",
  "순이익\t6,754,700\t8,223,600\t8,500,000",
  "재무상태표",
  "자산총계\t(455,906,000)\t500,000,000\t510,000,000",
  "부채총계\t100,000,000\t110,000,000\t111,000,000",
  "자본총계\t355,906,000\t390,000,000\t399,000,000",
  "현금흐름표",
  "영업현금흐름\t10,000,000\t11,000,000\t12,000,000",
  "CAPEX\t5,000,000\t6,000,000\t6,500,000",
  "FCF\t5,000,000\t5,000,000\t5,500,000",
  "ROE\t10.0\t11.0\t12.0"
].join("\r\n");

// Parsing is deterministic, separates actual and consensus, omits raw clipboard text, and never mutates inputs.
const contextBefore = JSON.parse(JSON.stringify(context));
const result = engine.parseButlerClipboard(table, context);
assert.equal(result.ok, true);
assert.equal(result.snapshot.periodType, "TTM");
assert.equal(result.snapshot.source.acquisitionMethod, "BUTLER_MANUAL");
assert.equal(result.snapshot.source.authority, "SECONDARY_AGGREGATOR");
assert.equal(result.snapshot.source.suppliedBy, "USER_SUPPLIED");
assert.equal(result.snapshot.facts.length, 27);
assert.equal(result.summary.unknownMetricRowCount, 1);
assert.equal(result.snapshot.quality.coverage, "PARTIAL");
assert.match(result.snapshot.contentDigest, /^cyrb128-v1:[a-f0-9]{32}$/);
assert.match(result.snapshot.digestAlgorithm, /NON_CRYPTOGRAPHIC/);
assert.equal(result.snapshot.facts.find((fact) => fact.metric === "REVENUE" && fact.periodEnd === "2025-06-30").valueType, "CONSENSUS");
assert.equal(result.snapshot.facts.find((fact) => fact.metric === "TOTAL_ASSETS" && fact.periodEnd === "2024-03-31").value, -455_906_000);
assert.equal(JSON.stringify(result).includes(table.slice(0, 30)), false);
assert.equal(JSON.stringify(result).includes("ROE"), false);
assert.deepEqual(context, contextBefore);
assert.equal(Object.isFrozen(result.snapshot), true);
assert.equal(Object.isFrozen(result.snapshot.facts), true);

// Repeated parsing has exactly the same canonical content digest.
assert.equal(engine.parseButlerClipboard(table, context).snapshot.contentDigest, result.snapshot.contentDigest);
assert.equal(engine.validateExternalSnapshot(result.snapshot).valid, true);
{
  const stringValue = JSON.parse(JSON.stringify(result.snapshot));
  stringValue.facts[0].value = String(stringValue.facts[0].value);
  assert.equal(engine.validateExternalSnapshot(stringValue).ok, false);
}

// Annual and quarter modes are distinct, and explicit Korean units are scaled without guessing an implicit unit.
{
  const annual = engine.parseButlerClipboard("연도\t2024\t2025E\n손익계산서\n매출액\t1.5조원\t2조원", context);
  assert.equal(annual.ok, true);
  assert.equal(annual.snapshot.periodType, "ANNUAL");
  assert.equal(annual.snapshot.facts[0].value, 1_500_000_000_000);
  assert.equal(annual.snapshot.facts[1].valueType, "CONSENSUS");

  const quarter = engine.parseButlerClipboard("분기\t25Q1\t25년 2분기\n손익계산서\n매출액\t100\t200", context);
  assert.equal(quarter.ok, true);
  assert.deepEqual(quarter.snapshot.periods.map((period) => period.endDate), ["2025-03-31", "2025-06-30"]);
}

// Butler's current clipboard format adds the reporting scope after each period and may include
// empty future columns. The official copy should parse without manual editing.
{
  const currentButlerTable = [
    "4분기누적\t2025.12 25Q4 연결\t2026.06 26Q2 연결\t2026.09 26Q3 연결",
    "매출액\t302231400000000\t171499500000000\t",
    "영업이익\t43376600000000\t89492400000000\t",
    "당기순이익\t55654100000000\t72030600000000\t",
    ...[
      "(-) 매출원가", "매출총이익", "(-) 판매관리비", "(+) 기타손익", "기타수익",
      "기타비용", "(+) 금융손익", "금융수익", "금융비용", "법인세차감전 순이익",
      "(-) 법인세", "지배주주순이익", "비지배주주순이익", "기본 주당이익", "희석 주당이익"
    ].map((label) => `${label}\t1\t2\t`)
  ].join("\n");
  const parsed = engine.parseButlerClipboard(currentButlerTable, {
    ...context,
    retrievedAt: "2026-08-18T01:02:03.000Z"
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.snapshot.periodType, "TTM");
  assert.deepEqual(parsed.snapshot.periods.map((period) => period.endDate), ["2025-12-31", "2026-06-30"]);
  assert.equal(parsed.snapshot.facts.find((fact) => (
    fact.metric === "REVENUE" && fact.periodEnd === "2025-12-31"
  )).value, 302_231_400_000_000);
  assert.equal(parsed.snapshot.facts.find((fact) => (
    fact.metric === "NET_INCOME" && fact.periodEnd === "2026-06-30"
  )).value, 72_030_600_000_000);
  assert.equal(parsed.summary.missingCellCount, 0);
  assert.equal(parsed.summary.unknownMetricRowCount, 0);
  assert.equal(parsed.snapshot.quality.coverage, "COMPLETE");
  assert.equal(parsed.diagnostics.some((item) => item.code === "UNKNOWN_METRIC"), false);

  const butlerClipboardHeader = engine.parseButlerClipboard(
    "4분기누적\t2017.03 17Q1 연결\t2017.06 17Q2 별도\n매출액\t100\t200",
    context
  );
  assert.equal(butlerClipboardHeader.ok, true);
  assert.deepEqual(
    butlerClipboardHeader.snapshot.periods.map((period) => period.endDate),
    ["2017-03-31", "2017-06-30"]
  );

  const mismatchedButlerHeader = engine.parseButlerClipboard(
    "4분기누적\t2017.03 17Q2 연결\n매출액\t100",
    context
  );
  assert.equal(mismatchedButlerHeader.ok, false);
  assert.equal(mismatchedButlerHeader.diagnostics.some((item) => item.code === "INVALID_PERIOD"), true);
}

// Confirmed facts cannot end after the UTC retrieval date; future consensus remains valid.
{
  const futureActual = engine.parseButlerClipboard("연도\t2099\n손익계산서\n매출액\t100", context);
  assert.equal(futureActual.ok, false);
  assert.equal(futureActual.snapshot, null);
  assert.equal(futureActual.diagnostics.some((item) => item.code === "FUTURE_ACTUAL_PERIOD"), true);

  const futureConsensus = engine.parseButlerClipboard("연도\t2099E\n손익계산서\n매출액\t100", context);
  assert.equal(futureConsensus.ok, true);
  assert.equal(futureConsensus.snapshot.facts[0].valueType, "CONSENSUS");
  assert.equal(engine.validateExternalSnapshot(futureConsensus.snapshot).ok, true);

  const futureActualHeaderWithConsensusCell = engine.parseButlerClipboard(
    "연도\t2099\n손익계산서\n매출액\t100E",
    context
  );
  assert.equal(futureActualHeaderWithConsensusCell.ok, true);
  assert.equal(futureActualHeaderWithConsensusCell.snapshot.facts[0].valueType, "CONSENSUS");
  assert.deepEqual(futureActualHeaderWithConsensusCell.snapshot.periods.map((period) => period.valueType), ["CONSENSUS"]);

  const endedCurrentPeriod = engine.parseButlerClipboard(
    "분기\t26Q2\n손익계산서\n매출액\t100",
    { ...context, retrievedAt: "2026-06-30T23:59:59.000Z" }
  );
  assert.equal(endedCurrentPeriod.ok, true);
  assert.equal(endedCurrentPeriod.snapshot.facts[0].periodEnd, "2026-06-30");

  const pastActual = engine.parseButlerClipboard("연도\t2025\n손익계산서\n매출액\t100", context);
  assert.equal(pastActual.ok, true);

  const storedFutureActual = JSON.parse(JSON.stringify(endedCurrentPeriod.snapshot));
  storedFutureActual.source.retrievedAt = "2026-06-29T23:59:59.000Z";
  const storedValidation = engine.validateExternalSnapshot(storedFutureActual);
  assert.equal(storedValidation.ok, false);
  assert.equal(storedValidation.diagnostics.some((item) => item.code === "FUTURE_ACTUAL_PERIOD"), true);

  const futureRetrieval = engine.parseButlerClipboard("연도\t2025\n손익계산서\n매출액\t100", {
    ...context,
    retrievedAt: "2099-01-01T00:00:00.000Z"
  });
  assert.equal(futureRetrieval.ok, false);
  assert.equal(futureRetrieval.diagnostics.some((item) => item.code === "FUTURE_RETRIEVED_AT"), true);

  const storedFutureRetrieval = JSON.parse(JSON.stringify(result.snapshot));
  storedFutureRetrieval.source.retrievedAt = "2099-01-01T00:00:00.000Z";
  const storedFutureRetrievalValidation = engine.validateExternalSnapshot(storedFutureRetrieval);
  assert.equal(storedFutureRetrievalValidation.ok, false);
  assert.equal(storedFutureRetrievalValidation.diagnostics.some((item) => item.code === "FUTURE_RETRIEVED_AT"), true);
}

// Required provenance context and allowlisted source URL fail closed without echoing sensitive input.
{
  const missing = engine.parseButlerClipboard("4분기누적\t25.03 (25Q1)\n매출액\t1", {});
  assert.equal(missing.ok, false);
  assert.equal(missing.snapshot, null);
  assert.equal(missing.diagnostics.some((item) => item.code === "INVALID_SOURCE_URL"), true);

  const maliciousUrl = engine.parseButlerClipboard("4분기누적\t25.03 (25Q1)\n매출액\t1", {
    ...context,
    sourceUrl: "https://evil.example/ko/home?token=private"
  });
  assert.equal(maliciousUrl.ok, false);
  assert.equal(JSON.stringify(maliciousUrl).includes("private"), false);

  const queryUrl = engine.parseButlerClipboard("4분기누적\t25.03 (25Q1)\n매출액\t1", {
    ...context,
    sourceUrl: "https://www.butler.works/ko/home?code=corp&sig=private&token=secret#financials"
  });
  assert.equal(queryUrl.ok, true);
  assert.equal(queryUrl.snapshot.source.url, "https://www.butler.works/ko/home");
  assert.equal(JSON.stringify(queryUrl).includes("private"), false);
  assert.equal(JSON.stringify(queryUrl).includes("secret"), false);
}

// Strict dates, numbers, row limits, period limits, and clipboard size are bounded.
{
  const invalidPeriod = engine.parseButlerClipboard("4분기누적\t25.04\n매출액\t1", context);
  assert.equal(invalidPeriod.ok, false);
  assert.equal(invalidPeriod.diagnostics.some((item) => item.code === "INVALID_PERIOD"), true);

  ["1,23", "1e9", "Infinity", "12%", "1원x"].forEach((bad) => {
    const parsed = engine.parseButlerClipboard(`4분기누적\t25.03 (25Q1)\n매출액\t${bad}`, context);
    assert.equal(parsed.ok, false, bad);
    assert.equal(parsed.diagnostics.some((item) => item.code === "INVALID_NUMBER"), true, bad);
    assert.equal(JSON.stringify(parsed).includes(bad), false, bad);
  });
  const unsafe = engine.parseButlerClipboard("4분기누적\t25.03 (25Q1)\n매출액\t9007199254740992", context);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.diagnostics.some((item) => item.code === "UNSAFE_NUMBER"), true);

  const tooLarge = engine.parseButlerClipboard(`4분기누적\t25.03 (25Q1)\n매출액\t1\n${"가".repeat(70_000)}`, context);
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.diagnostics[0].code, "CLIPBOARD_TOO_LARGE");

  const periodHeaders = Array.from({ length: 81 }, (_, index) => `${20 + Math.floor(index / 4)}Q${index % 4 + 1}`);
  const tooManyPeriods = engine.parseButlerClipboard(`분기\t${periodHeaders.join("\t")}\n매출액\t${periodHeaders.map(() => 1).join("\t")}`, context);
  assert.equal(tooManyPeriods.ok, false);
  assert.equal(tooManyPeriods.diagnostics.some((item) => item.code === "TOO_MANY_PERIODS"), true);

  const tooManyRows = engine.parseButlerClipboard(`4분기누적\t25Q1\n${Array.from({ length: 101 }, () => "매출액\t1").join("\n")}`, context);
  assert.equal(tooManyRows.ok, false);
  assert.equal(tooManyRows.diagnostics.some((item) => item.code === "TOO_MANY_ROWS"), true);
}

// Duplicate facts are de-duplicated; conflicting duplicate facts block the snapshot.
{
  const duplicate = engine.parseButlerClipboard("4분기누적\t25Q1\n매출액\t100\n매출액\t100", context);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.snapshot.facts.length, 1);
  assert.equal(duplicate.diagnostics.some((item) => item.code === "DUPLICATE_FACT"), true);

  const conflict = engine.parseButlerClipboard("4분기누적\t25Q1\n매출액\t100\n매출액\t101", context);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.diagnostics.some((item) => item.code === "CONFLICTING_FACT"), true);
}

// Validation rejects altered values, digest forgery, and any raw-content storage field.
{
  const changed = JSON.parse(JSON.stringify(result.snapshot));
  changed.facts[0].value += 1;
  assert.equal(engine.validateExternalSnapshot(changed).ok, false);
  assert.equal(engine.validateExternalSnapshot(changed).diagnostics.some((item) => item.code === "DIGEST_MISMATCH"), true);

  const withRaw = { ...result.snapshot, rawText: "secret copied table" };
  const validation = engine.validateExternalSnapshot(withRaw);
  assert.equal(validation.ok, false);
  assert.equal(validation.diagnostics.some((item) => item.code === "FORBIDDEN_RAW_CONTENT"), true);
  assert.equal(JSON.stringify(validation).includes("secret"), false);

  const fakeRevision = { ...result.snapshot, revision: 2 };
  assert.equal(engine.validateExternalSnapshot(fakeRevision).ok, false);

  const unknownPayload = { ...result.snapshot, displayOnly: { note: "must be stripped" } };
  const canonical = engine.validateExternalSnapshot(unknownPayload);
  assert.equal(canonical.ok, true);
  assert.equal(Object.hasOwn(canonical.snapshot, "displayOnly"), false);
  assert.equal(JSON.stringify(canonical.snapshot).includes("must be stripped"), false);

  const deepRaw = { ...result.snapshot, extension: { one: { two: { three: { raw_data: "deep secret" } } } } };
  const deepRawValidation = engine.validateExternalSnapshot(deepRaw);
  assert.equal(deepRawValidation.ok, false);
  assert.equal(deepRawValidation.diagnostics.some((item) => item.code === "FORBIDDEN_RAW_CONTENT"), true);
  assert.equal(JSON.stringify(deepRawValidation).includes("deep secret"), false);

  let tooDeep = { leaf: true };
  for (let index = 0; index < 20; index += 1) tooDeep = { child: tooDeep };
  const depthValidation = engine.validateExternalSnapshot({ ...result.snapshot, extension: tooDeep });
  assert.equal(depthValidation.ok, false);
  assert.equal(depthValidation.diagnostics.some((item) => item.code === "SNAPSHOT_STRUCTURE_LIMIT"), true);

  const wideValidation = engine.validateExternalSnapshot({
    ...result.snapshot,
    extension: Array.from({ length: 10_001 }, () => null)
  });
  assert.equal(wideValidation.ok, false);
  assert.equal(wideValidation.diagnostics.some((item) => item.code === "SNAPSHOT_STRUCTURE_LIMIT"), true);
}

// Merge is immutable: exact duplicates are stable, same-time differences conflict, later data creates history.
{
  const duplicate = engine.mergeSnapshots(result.snapshot, result.snapshot);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.status, "DUPLICATE");
  assert.equal(duplicate.snapshot.revision, 1);

  const refreshedSource = engine.parseButlerClipboard(table, { ...context, retrievedAt: "2026-08-06T01:02:03.000Z" });
  const refreshed = engine.mergeSnapshots(result.snapshot, refreshedSource.snapshot);
  assert.equal(refreshed.status, "DUPLICATE");
  assert.equal(refreshed.snapshot.source.retrievedAt, "2026-08-06T01:02:03.000Z");
  assert.equal(refreshed.snapshot.contentDigest, result.snapshot.contentDigest);

  const sameTimeDifferent = engine.parseButlerClipboard(table.replace("79,099,000", "79,099,001"), context);
  assert.equal(sameTimeDifferent.ok, true);
  const conflict = engine.mergeSnapshots(result.snapshot, sameTimeDifferent.snapshot);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, "CONFLICT");

  const later = engine.parseButlerClipboard(table.replace("79,099,000", "79,099,002"), {
    ...context,
    retrievedAt: "2026-08-05T01:02:03.000Z"
  });
  const before = JSON.stringify(result.snapshot);
  const revised = engine.mergeSnapshots(result.snapshot, later.snapshot);
  assert.equal(revised.ok, true);
  assert.equal(revised.status, "REVISED");
  assert.equal(revised.snapshot.revision, 2);
  assert.equal(revised.snapshot.revisionHistory.length, 1);
  assert.equal(revised.snapshot.revisionHistory[0].changeCount, 1);
  assert.equal(revised.snapshot.revisionHistory[0].changes[0].type, "CHANGED");
  assert.equal(engine.validateExternalSnapshot(revised.snapshot).ok, true);
  assert.equal(JSON.stringify(result.snapshot), before);

  const stale = engine.mergeSnapshots(revised.snapshot, result.snapshot);
  assert.equal(stale.ok, false);
  assert.equal(stale.status, "STALE");

  const collection = engine.mergeSnapshots([], result.snapshot);
  assert.equal(collection.ok, true);
  assert.equal(collection.status, "ADDED");
  assert.equal(collection.snapshots.length, 1);
}

// Company summary carries only structured facts and distinguishes actual from consensus.
{
  const summarized = engine.summarizeCompanyFacts(result.snapshot);
  assert.equal(summarized.ok, true);
  assert.equal(summarized.summary.metrics.REVENUE.latestActual.periodEnd, "2025-03-31");
  assert.equal(summarized.summary.metrics.REVENUE.latestConsensus.periodEnd, "2025-06-30");
  assert.ok(summarized.summary.metrics.REVENUE.actualChangeRate > 0);
  assert.equal(summarized.summary.limitations.includes("CONSENSUS_IS_NOT_CONFIRMED_ACTUAL"), true);
  assert.equal(JSON.stringify(summarized).includes(table.slice(0, 20)), false);
}

// URL construction only emits the Butler allowlist and never pretends a ticker is a Butler corpCode.
assert.equal(engine.buildButlerCompanyUrl(), "https://www.butler.works/ko/home");
assert.equal(engine.buildButlerCompanyUrl("00126380"), "https://www.butler.works/ko/companies/00126380");
assert.equal(engine.buildButlerCompanyUrl({ corpCode: "00126380" }), "https://www.butler.works/ko/companies/00126380");
assert.equal(engine.buildButlerCompanyUrl({ sourceUrl: "https://butler.works/ko/home?code=00126380&sig=secret&token=private#tab" }), "https://www.butler.works/ko/home");
assert.equal(engine.buildButlerCompanyUrl("005930"), "");
assert.equal(engine.buildButlerCompanyUrl("https://evil.example/ko/companies/00126380"), "");
assert.equal(engine.buildButlerCompanyUrl("https://www.butler.works.evil.example/ko/home"), "");
assert.equal(engine.buildButlerCompanyUrl("https://evilbutler.works/ko/home"), "");
assert.equal(engine.buildButlerCompanyUrl("https://user:password@www.butler.works/ko/home"), "");
assert.equal(engine.buildButlerCompanyUrl("https://www.butler.works:444/ko/home"), "");
assert.equal(engine.buildButlerCompanyUrl(`https://www.butler.works/ko/home?code=${"x".repeat(2_100)}`), "");

console.log("external data engine tests passed");
