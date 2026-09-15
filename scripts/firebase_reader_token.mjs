const fail = code => { throw new Error(code); };
const tokenString = value => typeof value === "string" && value.length > 0
  && value.length <= 16384 && !/[\s]/.test(value);

// Explicit enrolled-reader credentials only; no ADC, browser or user-session discovery.
export function createReaderTokenProvider({ apiKey, projectId, projectNumber, readerUid,
  loadRefreshToken, replaceRefreshToken, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(apiKey)
      || typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
      || typeof projectNumber !== "string" || !/^[0-9]{1,20}$/.test(projectNumber)
      || typeof readerUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(readerUid)
      || [loadRefreshToken, replaceRefreshToken, fetchImpl, now].some(f => typeof f !== "function")) {
    fail("INVALID_READER_TOKEN_CONFIG");
  }
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_READER_TOKEN_CLOCK");
    return value;
  };
  let cache = null, inFlight = null, generation = 0;
  async function refresh(epoch) {
    const startedAt = clock();
    let previous;
    try { previous = await loadRefreshToken(); }
    catch { fail("READER_REFRESH_UNAVAILABLE"); }
    if (!tokenString(previous)) fail("INVALID_READER_REFRESH_TOKEN");
    let response;
    try {
      response = await fetchImpl(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: previous }).toString()
      });
    } catch { fail("READER_TOKEN_TRANSPORT_FAILED"); }
    if (response.status !== 200) {
      await response.body?.cancel();
      fail(`READER_TOKEN_HTTP_${response.status}`);
    }
    if (!response.headers.get("content-type")?.includes("application/json") || !response.body) {
      await response.body?.cancel(); fail("INVALID_READER_TOKEN_RESPONSE");
    }
    const reader = response.body.getReader(), chunks = [];
    let length = 0, data;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 65536) { await reader.cancel(); fail("READER_TOKEN_RESPONSE_TOO_LARGE"); }
        chunks.push(Buffer.from(part.value));
      }
    } catch { fail("READER_TOKEN_RESPONSE_READ_FAILED"); }
    finally { reader.releaseLock(); }
    try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { fail("INVALID_READER_TOKEN_RESPONSE"); }
    if (!data || data.user_id !== readerUid || ![projectId, projectNumber].includes(data.project_id)
        || data.token_type !== "Bearer" || !tokenString(data.id_token) || !tokenString(data.refresh_token)
        || typeof data.expires_in !== "string" || !/^[0-9]{1,4}$/.test(data.expires_in)
        || Number(data.expires_in) <= 60 || Number(data.expires_in) > 3600) fail("INVALID_READER_TOKEN_IDENTITY");
    let claims;
    try {
      const segments = data.id_token.split(".");
      if (segments.length !== 3 || segments.some(s => !/^[A-Za-z0-9_-]+$/.test(s))) throw new Error();
      claims = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    } catch { fail("INVALID_READER_ID_TOKEN"); }
    // Routing/expiry sanity only. Firestore verifies the token signature and Rules.
    if (!claims || claims.sub !== readerUid || claims.aud !== projectId
        || claims.iss !== `https://securetoken.google.com/${projectId}`
        || !Number.isSafeInteger(claims.exp)) fail("INVALID_READER_ID_TOKEN");
    const usableUntil = Math.min(startedAt + Number(data.expires_in) * 1000, claims.exp * 1000) - 60000;
    if (usableUntil <= clock()) fail("READER_ID_TOKEN_EXPIRED");
    if (epoch !== generation) fail("READER_TOKEN_INVALIDATED");
    if (data.refresh_token !== previous) {
      try {
        // The store must perform compare-and-swap and durably persist before returning true.
        if (await replaceRefreshToken({ previous, next: data.refresh_token }) !== true) throw new Error();
      } catch { fail("READER_REFRESH_PERSIST_FAILED"); }
    }
    if (epoch !== generation) fail("READER_TOKEN_INVALIDATED");
    if (usableUntil <= clock()) fail("READER_ID_TOKEN_EXPIRED");
    cache = { token: data.id_token, usableUntil };
    return cache.token;
  }
  return Object.freeze({
    async getIdToken() {
      if (cache && clock() < cache.usableUntil) return cache.token;
      if (inFlight) return inFlight;
      cache = null;
      const pending = refresh(generation);
      inFlight = pending;
      try { return await pending; }
      finally { if (inFlight === pending) inFlight = null; }
    },
    // Local cache invalidation only. Remote credential revocation is a separate admin action.
    invalidate() { generation += 1; cache = null; }
  });
}
