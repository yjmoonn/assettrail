import { createReaderTokenProvider } from "./firebase_reader_token.mjs";
import { createFirestoreReadTransport } from "./firestore_read_transport.mjs";
import { readOnlyReview } from "./export_review.mjs";

// One enrolled identity for authentication, one independently selected owner path.
// Credential persistence is injected; no discovery of browser, ADC or owner tokens.
export function createReaderExporter({ projectId, projectNumber, apiKey, readerUid, ownerUid,
  loadRefreshToken, replaceRefreshToken, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (typeof ownerUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid)
      || ownerUid === readerUid) throw new Error("READER_OWNER_SCOPE_INVALID");
  const token = createReaderTokenProvider({ projectId, projectNumber, apiKey, readerUid,
    loadRefreshToken, replaceRefreshToken, fetchImpl, now });
  const transport = createFirestoreReadTransport({ projectId, uid: ownerUid,
    getIdToken: token.getIdToken, fetchImpl });
  let running = false;
  return Object.freeze({
    async exportReview({ observedAt, generatedAt, producerCommit, timeZone = "Asia/Seoul" }) {
      if (running) throw new Error("READER_EXPORT_ALREADY_RUNNING");
      running = true;
      try {
        return await readOnlyReview({ transport, uid: ownerUid, observedAt, generatedAt,
          producerCommit, timeZone, maxAttempts: 3, maxReads: 200, maxBytes: 20 * 1024 * 1024 });
      } finally { running = false; }
    },
    invalidate: token.invalidate
  });
}
