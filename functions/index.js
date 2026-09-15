const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");

initializeApp();

const githubToken = defineSecret("ASSETTRAIL_GITHUB_TOKEN");
const allowedUid = defineString("ASSETTRAIL_PRICE_REFRESH_UID");
const requestRef = getFirestore().doc("system/priceRefresh");
const COOLDOWN_MS = 10 * 60 * 1000;

exports.requestPriceRefresh = onCall(
  { secrets: [githubToken], maxInstances: 1, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    if (!allowedUid.value() || request.auth.uid !== allowedUid.value()) {
      throw new HttpsError("permission-denied", "가격 최신화 권한이 없습니다.");
    }

    const now = Date.now();
    const reservation = await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      const previous = snapshot.exists ? snapshot.data() : {};
      const previousAt = Number(previous.requestedAtMs || 0);
      if (now - previousAt < COOLDOWN_MS && previous.runUrl) {
        return { accepted: false, runUrl: previous.runUrl };
      }
      transaction.set(requestRef, {
        requestedAtMs: now,
        requestedAt: FieldValue.serverTimestamp(),
        runId: null,
        runUrl: null
      });
      return { accepted: true };
    });
    if (!reservation.accepted) return reservation;

    try {
      const response = await fetch(
        "https://api.github.com/repos/yjmoonn/assettrail/actions/workflows/deploy-pages.yml/dispatches",
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken.value()}`,
            "X-GitHub-Api-Version": "2026-03-10",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ref: "main", inputs: { generate_prices: "true" } })
        }
      );
      if (!response.ok) throw new HttpsError("internal", `GitHub Actions 실행 실패: ${response.status}`);
      const body = await response.json().catch(() => ({}));
      await requestRef.set({
        requestedAtMs: now,
        requestedAt: FieldValue.serverTimestamp(),
        runId: body.workflow_run_id || null,
        runUrl: body.html_url || "https://github.com/yjmoonn/assettrail/actions"
      });
      return { accepted: true, runUrl: body.html_url || null };
    } catch (error) {
      await requestRef.set({
        requestedAtMs: 0,
        requestedAt: FieldValue.serverTimestamp(),
        runId: null,
        runUrl: null,
        error: String(error.message || error)
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "가격 최신화 요청에 실패했습니다.");
    }
  }
);
