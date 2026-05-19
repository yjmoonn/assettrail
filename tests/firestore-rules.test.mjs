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
  const priceRequestsForAlice = doc(aliceDb, "priceRequests/us");
  const priceRequestsForGuest = doc(guestDb, "priceRequests/us");
  const blockedPriceRequests = doc(aliceDb, "priceRequests/eu");

  await assertSucceeds(
    setDoc(aliceDoc, {
      assets: [],
      snapshots: [],
      retirement: {
        currentAge: 35,
        retireAge: 55,
        lifeAge: 90
      },
      updatedAt: new Date("2026-05-19T00:00:00.000Z").toISOString()
    })
  );

  const snapshot = await assertSucceeds(getDoc(aliceDoc));
  assert.equal(snapshot.exists(), true);
  assert.deepEqual(snapshot.data().assets, []);

  await assertFails(getDoc(bobViewOfAliceDoc));
  await assertFails(setDoc(bobViewOfAliceDoc, { assets: ["blocked"] }));
  await assertFails(getDoc(guestViewOfAliceDoc));
  await assertFails(setDoc(guestViewOfAliceDoc, { assets: ["blocked"] }));

  await assertSucceeds(getDoc(priceRequestsForGuest));
  await assertSucceeds(
    setDoc(priceRequestsForAlice, {
      tickers: ["TSLA"],
      updatedAt: new Date("2026-05-19T00:00:00.000Z").toISOString()
    })
  );
  await assertSucceeds(getDoc(priceRequestsForGuest));
  await assertFails(setDoc(priceRequestsForGuest, { tickers: ["MSFT"], updatedAt: "2026-05-19T00:00:00.000Z" }));
  await assertFails(setDoc(blockedPriceRequests, { tickers: ["TSLA"], updatedAt: "2026-05-19T00:00:00.000Z" }));
  await assertFails(setDoc(priceRequestsForAlice, { tickers: Array(501).fill("AAPL"), updatedAt: "2026-05-19T00:00:00.000Z" }));
  await assertFails(setDoc(priceRequestsForAlice, { tickers: ["AAPL"], extra: true, updatedAt: "2026-05-19T00:00:00.000Z" }));

  await assertSucceeds(deleteDoc(aliceDoc));
} finally {
  await testEnv.cleanup();
}
