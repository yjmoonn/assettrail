import assert from "node:assert/strict";
import { createReaderTokenProvider } from "../scripts/firebase_reader_token.mjs";
const at = Date.parse("2026-09-11T07:00:00Z");
const jwt = (changes = {}) => [ { alg: "RS256", kid: "synthetic" }, {
  sub: "reader", aud: "test-project", iss: "https://securetoken.google.com/test-project",
  exp: at / 1000 + 3600, ...changes
} ].map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".") + ".synthetic";
const payload = (changes = {}) => ({ user_id: "reader", project_id: "1234567890", token_type: "Bearer",
  expires_in: "3600", id_token: jwt(), refresh_token: "new-refresh", ...changes });
const response = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
let currentTime = at, stored = "old-refresh", fetches = 0, writes = 0;
const config = { apiKey: "synthetic-api-key-1234567890", projectId: "test-project", projectNumber: "1234567890",
  readerUid: "reader", now: () => currentTime, loadRefreshToken: async () => stored,
  replaceRefreshToken: async ({ previous, next }) => { assert.equal(previous, stored); stored = next; writes++; return true; },
  fetchImpl: async (url, options) => {
    fetches++;
    assert.equal(new URL(url).origin, "https://securetoken.googleapis.com");
    assert.equal(options.method, "POST"); assert.equal(options.redirect, "error");
    assert.equal(new URLSearchParams(options.body).get("grant_type"), "refresh_token");
    assert.equal(new URLSearchParams(options.body).get("refresh_token"), stored);
    return response(payload({ id_token: jwt({ exp: currentTime / 1000 + 3600 }) }));
  } };
const provider = createReaderTokenProvider(config);
const values = await Promise.all([provider.getIdToken(), provider.getIdToken(), provider.getIdToken()]);
assert.ok(values.every(v => v === jwt())); assert.equal(fetches, 1); assert.equal(writes, 1);
currentTime += 3539000; await provider.getIdToken(); assert.equal(fetches, 1);
currentTime += 1000; await provider.getIdToken(); assert.equal(fetches, 2); assert.equal(writes, 1);
provider.invalidate(); await provider.getIdToken(); assert.equal(fetches, 3);
currentTime = at;
const rejects = async (changes, pattern = /READER/) => {
  await assert.rejects(createReaderTokenProvider({ ...config, ...changes }).getIdToken(), pattern);
};
for (const changed of [ { user_id: "owner" }, { project_id: "other" }, { token_type: "Other" },
  { expires_in: "0" }, { expires_in: "7200" }, { id_token: jwt({ sub: "owner" }) },
  { id_token: jwt({ aud: "other" }) }, { id_token: jwt({ iss: "other" }) },
  { id_token: jwt({ exp: at / 1000 }) }, { id_token: "bad" }, { refresh_token: "" } ]) {
  await rejects({ fetchImpl: async () => response(payload(changed)) });
}
await rejects({ loadRefreshToken: async () => { throw new Error("private-credential"); } }, /^Error: READER_REFRESH_UNAVAILABLE$/);
await rejects({ fetchImpl: async () => { throw new Error("private-credential"); } }, /^Error: READER_TOKEN_TRANSPORT_FAILED$/);
for (const status of [400, 401, 403, 429, 500]) {
  await rejects({ fetchImpl: async () => new Response("private-credential", { status }) }, new RegExp(`^Error: READER_TOKEN_HTTP_${status}$`));
}
await rejects({ fetchImpl: async () => response(payload({ refresh_token: "rotated-again" })),
  replaceRefreshToken: async () => false }, /^Error: READER_REFRESH_PERSIST_FAILED$/);
await rejects({ fetchImpl: async () => new Response("x".repeat(70000), { headers: { "content-type": "application/json" } }) });
await rejects({ fetchImpl: async () => new Response("<html>") }, /INVALID_READER_TOKEN_RESPONSE/);
let release;
const delayed = createReaderTokenProvider({ ...config, fetchImpl: async () => {
  await new Promise(resolve => { release = resolve; }); return response(payload());
} });
const pending = delayed.getIdToken();
await new Promise(resolve => setImmediate(resolve));
delayed.invalidate(); release();
await assert.rejects(pending, /READER_TOKEN_INVALIDATED/);
await rejects({ fetchImpl: async () => response(payload({ refresh_token: "late-rotation" })),
  replaceRefreshToken: async () => { currentTime += 3600000; return true; } }, /READER_ID_TOKEN_EXPIRED/);
currentTime = at;
console.log("Firebase reader token: identity, cache, rotation, invalidation and redacted failures passed");
