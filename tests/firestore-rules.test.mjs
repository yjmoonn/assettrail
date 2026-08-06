import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "assettrail-6f676";
const DATA_PATH = "users/alice/financeData/primary";
const LEDGER_EVENT_PATH = `${DATA_PATH}/ledgers/ledger-1/events/event-1`;
const LEDGER_BACKUP_PATH = `${DATA_PATH}/backups/schema-v4-revision-1`;
const ANALYSIS_PATH = "users/alice/analysisRuns/run-1";
const ANALYSIS_PREFERENCES_PATH = "users/alice/analysisPreferences/primary";
const ANALYSIS_ENTITLEMENT_PATH = "users/alice/analysisEntitlements/primary";
const ANALYSIS_USAGE_PATH = "users/alice/analysisUsage/2026-07";
const ISO_DATE = "2026-05-19T00:00:00.000Z";

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync("firestore.rules", "utf8")
  }
});

try {
  await testEnv.clearFirestore();

  const aliceDb = testEnv.authenticatedContext("alice", {
    email: "alice@example.com"
  }).firestore();
  const bobDb = testEnv.authenticatedContext("bob", {
    email: "bob@example.com"
  }).firestore();
  const guestDb = testEnv.unauthenticatedContext().firestore();

  const aliceDoc = doc(aliceDb, DATA_PATH);
  const bobViewOfAliceDoc = doc(bobDb, DATA_PATH);
  const guestViewOfAliceDoc = doc(guestDb, DATA_PATH);
  const aliceLedgerEvent = doc(aliceDb, LEDGER_EVENT_PATH);
  const bobViewOfAliceLedgerEvent = doc(bobDb, LEDGER_EVENT_PATH);
  const guestViewOfAliceLedgerEvent = doc(guestDb, LEDGER_EVENT_PATH);
  const aliceLedgerBackup = doc(aliceDb, LEDGER_BACKUP_PATH);
  const unexpectedDirectEvent = doc(aliceDb, `${DATA_PATH}/events/event-1`);
  const aliceAnalysisDoc = doc(aliceDb, ANALYSIS_PATH);
  const bobViewOfAliceAnalysisDoc = doc(bobDb, ANALYSIS_PATH);
  const aliceAnalysisPreferences = doc(aliceDb, ANALYSIS_PREFERENCES_PATH);
  const bobViewOfAliceAnalysisPreferences = doc(bobDb, ANALYSIS_PREFERENCES_PATH);
  const aliceAnalysisEntitlement = doc(aliceDb, ANALYSIS_ENTITLEMENT_PATH);
  const aliceAnalysisUsage = doc(aliceDb, ANALYSIS_USAGE_PATH);
  const unexpectedFinanceDoc = doc(aliceDb, "users/alice/financeData/secondary");
  const unexpectedAlicePath = doc(aliceDb, "users/alice/unexpected/document");
  const alicePriceRequest = doc(aliceDb, "priceRequests/alice");
  const bobViewOfAlicePriceRequest = doc(bobDb, "priceRequests/alice");
  const guestViewOfAlicePriceRequest = doc(guestDb, "priceRequests/alice");
  const legacyPriceRequest = doc(aliceDb, "priceRequests/us");
  const nestedPriceRequest = doc(aliceDb, "priceRequests/alice/history/latest");

  await assertSucceeds(
    setDoc(aliceDoc, {
      assets: [],
      snapshots: [],
      retirement: {
        currentAge: 35,
        retireAge: 55,
        lifeAge: 90
      },
      updatedAt: ISO_DATE
    })
  );

  const snapshot = await assertSucceeds(getDoc(aliceDoc));
  assert.equal(snapshot.exists(), true);
  assert.deepEqual(snapshot.data().assets, []);

  await assertFails(getDoc(bobViewOfAliceDoc));
  await assertFails(setDoc(bobViewOfAliceDoc, { assets: ["blocked"] }));
  await assertFails(getDoc(guestViewOfAliceDoc));
  await assertFails(setDoc(guestViewOfAliceDoc, { assets: ["blocked"] }));
  await assertFails(setDoc(unexpectedFinanceDoc, { assets: [] }));
  await assertFails(setDoc(unexpectedAlicePath, { privateData: true }));
  await assertFails(getDoc(unexpectedAlicePath));

  const eventPayload = {
    eventId: "event-1",
    type: "DEPOSIT",
    accountId: "ACCOUNT:cash-1",
    cashAssetId: "cash-1",
    cashAccountId: "ACCOUNT:cash-1",
    tradeDate: "2026-08-05",
    settlementDate: "2026-08-05",
    amount: 1000,
    currency: "KRW",
    fxRate: 1
  };
  await assertSucceeds(setDoc(aliceLedgerEvent, eventPayload));
  assert.equal((await assertSucceeds(getDoc(aliceLedgerEvent))).data().eventId, "event-1");
  await assertSucceeds(setDoc(aliceLedgerEvent, eventPayload));
  await assertFails(setDoc(aliceLedgerEvent, { ...eventPayload, amount: 2000 }));
  await assertFails(deleteDoc(aliceLedgerEvent));
  await assertFails(getDoc(bobViewOfAliceLedgerEvent));
  await assertFails(setDoc(bobViewOfAliceLedgerEvent, eventPayload));
  await assertFails(getDoc(guestViewOfAliceLedgerEvent));
  await assertFails(setDoc(guestViewOfAliceLedgerEvent, eventPayload));
  await assertFails(setDoc(unexpectedDirectEvent, eventPayload));

  const backupPayload = { sourceSchemaVersion: 4, sourceRevision: 1, createdAt: ISO_DATE, state: { assets: [] } };
  await assertSucceeds(setDoc(aliceLedgerBackup, backupPayload));
  await assertSucceeds(getDoc(aliceLedgerBackup));
  await assertSucceeds(setDoc(aliceLedgerBackup, backupPayload));
  await assertFails(setDoc(aliceLedgerBackup, { ...backupPayload, sourceRevision: 2 }));
  await assertFails(deleteDoc(aliceLedgerBackup));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), ANALYSIS_PATH), {
      schemaVersion: "assettrail.analysis.v1",
      createdAt: ISO_DATE
    });
  });
  await assertSucceeds(getDoc(aliceAnalysisDoc));
  await assertFails(setDoc(aliceAnalysisDoc, { createdAt: "blocked" }));
  await assertFails(getDoc(bobViewOfAliceAnalysisDoc));
  await assertSucceeds(setDoc(aliceAnalysisPreferences, { primaryBenchmark: "SP500" }));
  await assertSucceeds(getDoc(aliceAnalysisPreferences));
  await assertFails(getDoc(bobViewOfAliceAnalysisPreferences));
  await assertFails(setDoc(bobViewOfAliceAnalysisPreferences, { primaryBenchmark: "KOSPI" }));
  await assertFails(getDoc(aliceAnalysisEntitlement));
  await assertFails(setDoc(aliceAnalysisEntitlement, { monthlyLimit: 999 }));
  await assertFails(getDoc(aliceAnalysisUsage));
  await assertFails(setDoc(aliceAnalysisUsage, { aiReportCount: 0 }));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "priceRequests/alice"), {
      tickers: ["AAPL"],
      updatedAt: ISO_DATE
    });
    await setDoc(doc(context.firestore(), "priceRequests/us"), {
      tickers: ["TSLA"],
      updatedAt: ISO_DATE
    });
    await setDoc(doc(context.firestore(), "priceRequests/alice/history/latest"), {
      tickers: ["MSFT"],
      updatedAt: ISO_DATE
    });
  });

  await assertFails(getDoc(alicePriceRequest));
  await assertFails(getDoc(bobViewOfAlicePriceRequest));
  await assertFails(getDoc(guestViewOfAlicePriceRequest));
  await assertFails(getDoc(legacyPriceRequest));
  await assertFails(getDoc(nestedPriceRequest));
  await assertFails(setDoc(alicePriceRequest, { tickers: ["MSFT"], updatedAt: ISO_DATE }));
  await assertFails(deleteDoc(alicePriceRequest));
  await assertFails(deleteDoc(legacyPriceRequest));

  await assertSucceeds(deleteDoc(aliceDoc));
} finally {
  await testEnv.cleanup();
}
