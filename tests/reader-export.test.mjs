import assert from "node:assert/strict";
import { createReaderExporter } from "../scripts/reader_export.mjs";
const at = Date.parse("2026-09-11T07:00:00Z");
const config = { apiKey: "synthetic-api-key-1234567890", projectId: "test-project",
  projectNumber: "1234567890", readerUid: "reader", ownerUid: "owner", now: () => at,
  loadRefreshToken: async () => "synthetic-refresh", replaceRefreshToken: async () => true };
const args = { observedAt: new Date(at).toISOString(), generatedAt: new Date(at).toISOString(),
  producerCommit: "a".repeat(40) };
assert.throws(() => createReaderExporter({ ...config, ownerUid: "reader" }), /OWNER_SCOPE/);
let calls = [];
const jwt = [ { alg: "RS256" }, { sub: "reader", aud: "test-project",
  iss: "https://securetoken.google.com/test-project", exp: at / 1000 + 3600 } ]
  .map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".") + ".synthetic";
const exporter = createReaderExporter({ ...config, fetchImpl: async (url, options) => {
  calls.push([String(url), options.method]);
  if (String(url).startsWith("https://securetoken.googleapis.com/")) {
    assert.equal(options.method, "POST");
    return new Response(JSON.stringify({ user_id: "reader", project_id: "1234567890",
      token_type: "Bearer", expires_in: "3600", id_token: jwt, refresh_token: "synthetic-refresh" }),
    { headers: { "content-type": "application/json" } });
  }
  assert.equal(options.method, "GET");
  assert.equal(options.headers.Authorization, "Bearer " + jwt);
  assert.ok(String(url).endsWith("users/owner/financeData/primary"));
  return new Response(null, { status: 403 });
} });
await assert.rejects(exporter.exportReview({ ...args, producerCommit: "bad" }), /RUN_CONTEXT/);
assert.equal(calls.length, 0);
await assert.rejects(exporter.exportReview(args), /FIRESTORE_HTTP_403/);
await assert.rejects(exporter.exportReview(args), /FIRESTORE_HTTP_403/);
assert.equal(calls.filter(x => x[1] === "POST").length, 1);
assert.equal(calls.filter(x => x[1] === "GET").length, 2);
exporter.invalidate();
await assert.rejects(exporter.exportReview(args), /FIRESTORE_HTTP_403/);
assert.equal(calls.filter(x => x[1] === "POST").length, 2);
console.log("Reader export integration: preflight, scoped identity, caching, invalidation, denied reads passed");
