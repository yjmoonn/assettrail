import { createRequire } from "node:module";
import { readFile, open, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readOnlySource } from "./read_only_source.mjs";

const require = createRequire(import.meta.url);
const history = require("../history-repository.js");
const ledger = require("../ledger-engine.js");
const ai = require("../ai-review-export-engine.js");
const retirement = require("../retirement-engine.js");
const performance = require("../performance-source-engine.js");
const fail = code => { throw new Error(code); };
const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value));

// The receipt binds bytes, not credentials or an independent audit of market prices.
export function buildSourceReview(source, { generatedAt, producerCommit, timeZone = "Asia/Seoul" }) {
  const { state, receipt } = source || {};
  if (!object(state) || state.schemaVersion !== 9 || !object(receipt)
      || receipt.schemaVersion !== "assettrail.read-only-source.v1"
      || receipt.stateDigest !== history.digestCanonical(state)
      || receipt.sourceConsistency !== "VERIFIED" || receipt.ledgerStructureValidated !== true
      || receipt.economicStateValidated !== false || receipt.latestValuationVerified !== false
      || receipt.writeCount !== 0 || !Array.isArray(state.events)
      || !Array.isArray(state.snapshots) || !Array.isArray(state.performanceObservations)
      || state.events.length !== receipt.eventCount || state.snapshots.length !== receipt.snapshotCount
      || state.performanceObservations.length !== receipt.performanceCount
      || state.snapshots.length > 10000 || state.performanceObservations.length > 10000
      || state.events.length > 50000 || !object(state.retirement)) fail("INVALID_REVIEW_SOURCE");
  if (!instant(generatedAt) || new Date(generatedAt).toISOString() !== generatedAt
      || !instant(receipt.observedAt) || Date.parse(receipt.observedAt) > Date.parse(generatedAt)
      || !/^[a-f0-9]{40}$/.test(producerCommit || "")) fail("INVALID_REVIEW_RUN_CONTEXT");
  let formatter;
  try {
    if (typeof timeZone !== "string" || !timeZone) throw new Error();
    formatter = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { fail("INVALID_REVIEW_RUN_CONTEXT"); }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(generatedAt)).map(p => [p.type, p.value]));
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  if (!ledger.validateLedger(state.events, { baselineDate: state.ledgerMeta?.baselineDate }).ok
      || state.ledgerMeta?.eventCount !== state.events.length
      || state.ledgerMeta?.eventFingerprint !== ledger.fingerprintLedger(state.events)) fail("INVALID_REVIEW_LEDGER");
  const ids = new Set();
  for (const snapshot of state.snapshots) {
    if (!object(snapshot) || typeof snapshot.id !== "string" || !snapshot.id || ids.has(snapshot.id)
        || !instant(snapshot.createdAt) || new Date(snapshot.createdAt).toISOString() !== snapshot.createdAt
        || Date.parse(snapshot.createdAt) > Date.parse(generatedAt)) fail("INVALID_REVIEW_SNAPSHOT");
    ids.add(snapshot.id);
  }
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const snapshot = [...state.snapshots].sort((a, b) => compare(a.createdAt, b.createdAt) || compare(a.id, b.id)).at(-1);
  if (!snapshot) fail("REVIEW_SNAPSHOT_MISSING");
  const review = ai.buildReviewPackage(ai.buildSnapshotReviewInput({ snapshot, generatedAt, timeZone,
    priceStaleDays: 3, performanceObservationCount: state.performanceObservations.length,
    performance: performance.buildReviewPerformance({ performanceObservations: state.performanceObservations,
      events: state.events, baselineDate: state.ledgerMeta?.baselineDate, todayKey }),
    goal: retirement.buildGoalContext(state.retirement),
    reviewStatus: ai.buildMonthlyReviewStatus({ snapshots: state.snapshots, generatedAt, timeZone }) }));
  const checked = ai.validateReviewPackage(review);
  if (!checked.ok) fail("INVALID_GENERATED_REVIEW");
  return { review, receipt: {
    schemaVersion: "assettrail.read-only-review.v1", generatedAt, timeZone, producerCommit,
    sourceObservedAt: receipt.observedAt, sourceStateDigest: receipt.stateDigest,
    sourceReceiptDigest: history.digestCanonical(receipt), reviewDigest: review.digest,
    snapshotCreatedAt: review.snapshotCreatedAt, declaredQuality: review.dataQuality.status,
    currentAllocationEligible: false, economicStateValidated: false, latestValuationVerified: false,
    authenticationVerifiedByBuilder: false, writeCount: 0,
    limitations: ["SOURCE_RECEIPT_IS_NOT_AUTHENTICATION", "SAVED_VALUATION_NOT_CURRENT_REVALUATION",
      "PRICE_FINGERPRINT_IS_NOT_INDEPENDENT_MARKET_DATA_VERIFICATION"]
  } };
}

export async function readOnlyReview({ transport, uid, observedAt, generatedAt, producerCommit,
  timeZone = "Asia/Seoul", maxAttempts, maxReads, maxBytes }) {
  if (!instant(generatedAt) || new Date(generatedAt).toISOString() !== generatedAt
      || !instant(observedAt) || Date.parse(observedAt) > Date.parse(generatedAt)
      || !/^[a-f0-9]{40}$/.test(producerCommit || "")) fail("INVALID_REVIEW_RUN_CONTEXT");
  try {
    if (typeof timeZone !== "string" || !timeZone) throw new Error();
    new Intl.DateTimeFormat("en", { timeZone });
  } catch { fail("INVALID_REVIEW_RUN_CONTEXT"); }
  const source = await readOnlySource({ transport, uid, observedAt, maxAttempts, maxReads, maxBytes });
  return buildSourceReview(source, { generatedAt, producerCommit, timeZone });
}

// Offline CLI: no credential discovery, browser access, upstream writes or publishing.
async function main(args) {
  if (args.length !== 8 && args.length !== 10) fail("INVALID_EXPORT_ARGUMENTS");
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--source", "--output", "--generated-at", "--producer-commit", "--time-zone"].includes(args[i])
        || !args[i + 1] || options[args[i]]) fail("INVALID_EXPORT_ARGUMENTS");
    options[args[i]] = args[i + 1];
  }
  if (!["--source", "--output", "--generated-at", "--producer-commit"].every(k => options[k])) fail("INVALID_EXPORT_ARGUMENTS");
  const size = await stat(options["--source"]);
  if (!size.isFile() || size.size > 20 * 1024 * 1024) fail("EXPORT_SOURCE_SIZE_LIMIT");
  const raw = await readFile(options["--source"]);
  if (raw.length > 20 * 1024 * 1024) fail("EXPORT_SOURCE_SIZE_LIMIT");
  const result = buildSourceReview(JSON.parse(raw), { generatedAt: options["--generated-at"],
    producerCommit: options["--producer-commit"], timeZone: options["--time-zone"] || "Asia/Seoul" });
  const out = await open(options["--output"], "wx", 0o600);
  try { await out.writeFile(history.canonicalStringify(result)); await out.sync(); }
  finally { await out.close(); }
  process.stdout.write(JSON.stringify({ status: "REVIEW_EXPORTED", reviewDigest: result.review.digest,
    declaredQuality: result.review.dataQuality.status, currentAllocationEligible: false }) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // Never print source contents, credentials or provider exception text.
    process.stderr.write("ASSETTRAIL_EXPORT_FAILED\n"); process.exitCode = 1;
  });
}
