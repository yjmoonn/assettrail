import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { renderReaderRules } from "../scripts/reader_rules.mjs";

const baseRules = readFileSync("firestore.rules", "utf8");
const config = { baseRules, readerUid: "export-reader", ownerUid: "alice", expiresOn: "2099-01-01" };
for (const overrides of [{ readerUid: "alice" }, { readerUid: "x' || true" }, { ownerUid: "../alice" },
  { expiresOn: "2026-02-30" }, { baseRules: "different" }]) {
  assert.throws(() => renderReaderRules({ ...config, ...overrides }), /READER_RULES/);
}
assert.equal(readFileSync("firestore.rules", "utf8"), baseRules);
const primary = "users/alice/financeData/primary";
const event = `${primary}/ledgers/ledger-1/events/event-1`;
const chunk = `${primary}/histories/history-1/chunks/chunk-1`;
const denied = [
  "users/bob/financeData/primary", "users/export-reader/financeData/primary",
  `${primary}/backups/backup-1`, `${primary}/histories/history-1`,
  `${primary}/ledgers/ledger-1`, `${primary}/unexpected/doc`,
  "users/alice/analysisRuns/run-1", "users/alice/analysisPreferences/primary",
  "users/alice/analysisEntitlements/primary", "users/alice/analysisUsage/month", "priceRequests/us"
];
const environment = await initializeTestEnvironment({ projectId: "demo-yia-reader", firestore: {
  rules: renderReaderRules(config)
} });
try {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    for (const path of [primary, event, chunk, ...denied]) {
      await setDoc(doc(context.firestore(), path), { eventId: "event-1", marker: 1 });
    }
  });
  const reader = environment.authenticatedContext("export-reader").firestore();
  const owner = environment.authenticatedContext("alice").firestore();
  const other = environment.authenticatedContext("bob").firestore();
  const guest = environment.unauthenticatedContext().firestore();
  for (const path of [primary, event, chunk]) {
    await assertSucceeds(getDoc(doc(reader, path)));
    await assertSucceeds(getDoc(doc(owner, path)));
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDoc(doc(guest, path)));
  }
  for (const path of [`${primary}/ledgers/ledger-1/events`, `${primary}/histories/history-1/chunks`]) {
    assert.equal((await assertSucceeds(getDocs(collection(reader, path)))).size, 1);
    await assertFails(getDocs(collection(reader, path.replace("alice", "bob"))));
  }
  for (const path of denied) await assertFails(getDoc(doc(reader, path)));
  for (const path of [primary, event, chunk, ...denied]) {
    await assertFails(setDoc(doc(reader, path), { eventId: "event-1", marker: 1 }));
    await assertFails(updateDoc(doc(reader, path), { marker: 2 }));
    await assertFails(deleteDoc(doc(reader, path)));
  }
  await assertFails(setDoc(doc(reader, `${primary}/ledgers/ledger-1/events/new-event`), { eventId: "new-event" }));
  for (const path of ["users", "users/alice/financeData", `${primary}/backups`]) {
    await assertFails(getDocs(collection(reader, path)));
  }
  await assertFails(getDocs(collectionGroup(reader, "events")));
  await assertFails(getDocs(collectionGroup(reader, "chunks")));
  // Existing owners retain their own primary/preferences and append-only ledger behavior.
  await assertSucceeds(setDoc(doc(owner, primary), { marker: 2 }));
  await assertSucceeds(setDoc(doc(owner, "users/alice/analysisPreferences/primary"), { marker: 2 }));
  await assertSucceeds(setDoc(doc(owner, `${primary}/ledgers/ledger-1/events/owner-new`), { eventId: "owner-new" }));
  await assertFails(updateDoc(doc(owner, event), { marker: 2 }));
  await assertFails(deleteDoc(doc(owner, event)));
  await assertSucceeds(setDoc(doc(other, "users/bob/financeData/primary"), { marker: 2 }));
} finally { await environment.cleanup(); }

// Expiry removes all delegated reads, including list; owner access remains intact.
const expired = await initializeTestEnvironment({ projectId: "demo-yia-reader-expired", firestore: {
  rules: renderReaderRules({ ...config, expiresOn: "2000-01-01" })
} });
try {
  const reader = expired.authenticatedContext("export-reader").firestore();
  for (const path of [primary, event, chunk]) await assertFails(getDoc(doc(reader, path)));
  await assertFails(getDocs(collection(reader, `${primary}/ledgers/ledger-1/events`)));
  await assertSucceeds(setDoc(doc(expired.authenticatedContext("alice").firestore(), primary), { marker: 1 }));
} finally { await expired.cleanup(); }
console.log("reader rules: scoped reads, cross-user/write/enumeration denial and expiry passed");
