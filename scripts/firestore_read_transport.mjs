const fail = code => { throw new Error(code); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

function decode(value, depth = 0) {
  if (!object(value) || Object.keys(value).length !== 1 || depth > 40) fail("INVALID_FIRESTORE_VALUE");
  const [kind, raw] = Object.entries(value)[0];
  if (kind === "nullValue" && raw === null) return null;
  if (kind === "booleanValue" && typeof raw === "boolean") return raw;
  if (kind === "stringValue" && typeof raw === "string") return raw;
  if (kind === "timestampValue" && typeof raw === "string" && Number.isFinite(Date.parse(raw))) return raw;
  if (kind === "integerValue" && typeof raw === "string" && /^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isSafeInteger(n)) fail("FIRESTORE_UNSAFE_INTEGER");
    return n;
  }
  if (kind === "doubleValue" && typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (kind === "arrayValue" && object(raw) && (raw.values === undefined || Array.isArray(raw.values))) {
    return (raw.values || []).map(v => decode(v, depth + 1));
  }
  if (kind === "mapValue" && object(raw) && (raw.fields === undefined || object(raw.fields))) {
    return Object.fromEntries(Object.entries(raw.fields || {}).map(([k, v]) => [k, decode(v, depth + 1)]));
  }
  fail("UNSUPPORTED_FIRESTORE_VALUE");
}

export function createFirestoreReadTransport({ projectId, uid, getIdToken,
  fetchImpl = globalThis.fetch, timeoutMs = 20000, maxResponseBytes = 4 * 1024 * 1024 }) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
      || typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(uid)
      || typeof getIdToken !== "function" || typeof fetchImpl !== "function"
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000
      || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 32 * 1024 * 1024) {
    fail("INVALID_FIRESTORE_READER_CONFIG");
  }
  const base = `projects/${projectId}/databases/(default)/documents/`;
  const primary = `users/${uid}/financeData/primary`;
  function row(raw) {
    if (!object(raw) || typeof raw.name !== "string" || !raw.name.startsWith(base)
        || typeof raw.updateTime !== "string" || !Number.isFinite(Date.parse(raw.updateTime))) {
      fail("INVALID_FIRESTORE_DOCUMENT");
    }
    return { path: raw.name.slice(base.length), updateTime: raw.updateTime,
      data: decode({ mapValue: { fields: raw.fields || {} } }) };
  }
  async function request(path, query, missingAllowed = false) {
    const url = new URL(`https://firestore.googleapis.com/v1/${base}${path.split("/").map(encodeURIComponent).join("/")}`);
    for (const [k, v] of Object.entries(query)) if (v !== null) url.searchParams.set(k, String(v));
    let token;
    try { token = await getIdToken(); }
    catch { fail("FIRESTORE_ID_TOKEN_UNAVAILABLE"); }
    if (typeof token !== "string" || !token || token.length > 16384 || /[\r\n]/.test(token)) fail("INVALID_FIRESTORE_ID_TOKEN");
    let response;
    try {
      response = await fetchImpl(url, { method: "GET", redirect: "error",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      fail("FIRESTORE_READ_TRANSPORT_FAILED");
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      if (response.status === 404 && missingAllowed) return null;
      fail(`FIRESTORE_HTTP_${response.status}`);
    }
    if (!response.headers.get("content-type")?.includes("application/json") || !response.body) {
      await response.body?.cancel();
      fail("INVALID_FIRESTORE_RESPONSE_TYPE");
    }
    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maxResponseBytes) {
          await reader.cancel();
          fail("FIRESTORE_RESPONSE_TOO_LARGE");
        }
        chunks.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { fail("INVALID_FIRESTORE_RESPONSE_JSON"); }
  }
  return Object.freeze({
    async getDocument(path) {
      if (path !== primary) fail("FIRESTORE_PATH_NOT_ALLOWED");
      const raw = await request(path, {}, true);
      if (raw === null) return null;
      const parsed = row(raw);
      if (parsed.path !== path) fail("FIRESTORE_RESPONSE_PATH_MISMATCH");
      return parsed;
    },
    async listDocuments(path, { pageToken = null, pageSize = 10 } = {}) {
      const suffix = typeof path === "string" && path.startsWith(`${primary}/`) ? path.slice(primary.length + 1) : "";
      if (!/^(ledgers\/[A-Za-z0-9_-]{1,160}\/events|histories\/[A-Za-z0-9_-]{1,160}\/chunks)$/.test(suffix)
          || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
          || !(pageToken === null || typeof pageToken === "string" && pageToken.length > 0 && pageToken.length <= 8192)) {
        fail("FIRESTORE_PATH_OR_PAGE_NOT_ALLOWED");
      }
      const raw = await request(path, { pageSize, pageToken });
      if (!object(raw) || !(raw.documents === undefined || Array.isArray(raw.documents))
          || !(raw.nextPageToken === undefined || typeof raw.nextPageToken === "string")) {
        fail("INVALID_FIRESTORE_RESPONSE_PAGE");
      }
      const documents = (raw.documents || []).map(row);
      if (documents.some(d => !d.path.startsWith(`${path}/`) || d.path.slice(path.length + 1).includes("/"))) {
        fail("FIRESTORE_RESPONSE_PATH_MISMATCH");
      }
      return { documents, nextPageToken: raw.nextPageToken || null };
    }
  });
}
