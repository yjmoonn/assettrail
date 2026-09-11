import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createFirestoreReadTransport } from "../scripts/firestore_read_transport.mjs";
import { readOnlySource } from "../scripts/read_only_source.mjs";
const ledger = createRequire(import.meta.url)("../ledger-engine.js");
const primary = "users/test-user/financeData/primary";
const base = "projects/test-project/databases/(default)/documents/";
const response = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
function encode(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k, encode(v)])) } };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: value };
}
const state = { schemaVersion: 9, revision: 1, assets: [], snapshots: [], performanceObservations: [],
  ledgerMeta: { activeLedgerId: "ledger-test", eventCount: 0, eventFingerprint: ledger.fingerprintLedger([]) } };
const doc = () => ({ name: base + primary, updateTime: "2026-09-10T12:00:00.123456Z", fields: encode(state).mapValue.fields });
let requests = [];
const config = { projectId: "test-project", uid: "test-user", getIdToken: async () => "synthetic-test-token",
  fetchImpl: async (url, options) => {
    requests.push([url, options]);
    assert.equal(url.origin, "https://firestore.googleapis.com");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer synthetic-test-token");
    assert.ok(!("body" in options));
    return response(url.pathname.endsWith("primary") ? doc() : {});
  } };
const transport = createFirestoreReadTransport(config);
const actual = await readOnlySource({ transport, uid: "test-user", observedAt: "2026-09-11T00:00:00Z" });
assert.equal(actual.receipt.sourceConsistency, "VERIFIED");
assert.equal(actual.receipt.primaryUpdateTime, "2026-09-10T12:00:00.123456Z");
assert.equal(actual.receipt.reads, 3);
assert.equal(requests.length, 3);
assert.deepEqual(actual.state, { ...state, events: [] });

const before = requests.length;
await assert.rejects(transport.getDocument("users/other/financeData/primary"), /PATH_NOT_ALLOWED/);
await assert.rejects(transport.listDocuments(primary + "/backups"), /PATH_OR_PAGE_NOT_ALLOWED/);
await assert.rejects(transport.listDocuments(primary + "/ledgers/../events"), /PATH_OR_PAGE_NOT_ALLOWED/);
assert.equal(requests.length, before);
const requestWith = fetchImpl => createFirestoreReadTransport({ ...config, fetchImpl }).getDocument(primary);
assert.equal(await requestWith(async () => new Response(null, { status: 404 })), null);
for (const status of [401, 403, 429, 500]) {
  await assert.rejects(requestWith(async () => new Response("sensitive server text", { status })),
    new RegExp(`^Error: FIRESTORE_HTTP_${status}$`));
}
await assert.rejects(requestWith(async () => { throw new Error("sensitive transport text"); }), /FIRESTORE_READ_TRANSPORT_FAILED/);
await assert.rejects(requestWith(async () => new Response("<html>")), /INVALID_FIRESTORE_RESPONSE_TYPE/);
await assert.rejects(requestWith(async () => response({ ...doc(), fields: { amount: { integerValue: "9007199254740993" } } })),
  /FIRESTORE_UNSAFE_INTEGER/);
await assert.rejects(requestWith(async () => response({ ...doc(), fields: { value: { referenceValue: "other" } } })),
  /UNSUPPORTED_FIRESTORE_VALUE/);
await assert.rejects(requestWith(async () => response({ ...doc(), name: doc().name.replace("test-project", "other-project") })),
  /INVALID_FIRESTORE_DOCUMENT/);
await assert.rejects(createFirestoreReadTransport({ ...config, maxResponseBytes: 5 }).getDocument(primary), /FIRESTORE_RESPONSE_TOO_LARGE/);
const pageReader = createFirestoreReadTransport({ ...config, fetchImpl: async url => {
  assert.equal(url.searchParams.get("pageToken"), "opaque+/=token");
  assert.equal(url.searchParams.get("pageSize"), "10");
  return response({ nextPageToken: "next" });
} });
assert.deepEqual(await pageReader.listDocuments(primary + "/ledgers/ledger-test/events", { pageToken: "opaque+/=token" }),
  { documents: [], nextPageToken: "next" });
console.log("Firestore read transport tests passed");
