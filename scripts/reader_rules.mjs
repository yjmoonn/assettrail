// Pure proposal renderer. Never deploys rules or enrolls an identity.
export function renderReaderRules({ baseRules, readerUid, ownerUid, expiresOn }) {
  const uid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (!uid(readerUid) || !uid(ownerUid) || readerUid === ownerUid
      || typeof expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)
      || !Number.isFinite(Date.parse(expiresOn))
      || new Date(expiresOn).toISOString().slice(0, 10) !== expiresOn
      || typeof baseRules !== "string") throw new Error("INVALID_READER_RULES_INPUT");
  const [year, month, day] = expiresOn.split("-").map(Number);
  const once = (source, before, after) => {
    if (source.split(before).length !== 2) throw new Error("READER_RULES_BASE_DRIFT");
    return source.replace(before, after);
  };
  let result = once(baseRules,
    "return request.auth != null && request.auth.uid == userId;",
    `return request.auth != null && request.auth.uid == userId\n        && request.auth.uid != '${readerUid}';`);
  result = once(result, "    match /users/{userId}/financeData/primary {", `    function approvedReader(userId) {
      return request.auth != null && request.auth.uid == '${readerUid}'
        && userId == '${ownerUid}'
        && request.time < timestamp.date(${year}, ${month}, ${day});
    }

    match /users/{userId}/financeData/primary {
      allow get: if approvedReader(userId);`);
  for (const path of [
    "/users/{userId}/financeData/primary/ledgers/{ledgerId}/events/{eventId}",
    "/users/{userId}/financeData/primary/histories/{historyId}/chunks/{chunkId}"
  ]) {
    result = once(result, `    match ${path} {`, `    match ${path} {\n      allow read: if approvedReader(userId);`);
  }
  return result;
}
