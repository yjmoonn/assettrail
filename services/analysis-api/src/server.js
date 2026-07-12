"use strict";

const express = require("express");
const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");
const puppeteer = require("puppeteer-core");
const { renderReport } = require("./report-template");
const { createAiReport, DEFAULT_MODEL } = require("./ai-report");

const firebaseApp = admin.initializeApp({
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "assettrail-6f676.firebasestorage.app"
});
const db = admin.firestore();
const bucket = getStorage(firebaseApp).bucket();
const app = express();
const defaultMonthlyLimit = Math.max(0, Number(process.env.AI_REPORT_DEFAULT_MONTHLY_LIMIT || 2));
const adminUids = new Set(String(process.env.AI_REPORT_ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean));
const allowedOrigins = new Set([
  "https://yjmoonn.github.io",
  "http://localhost:4178",
  "http://127.0.0.1:4178"
]);

app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const origin = request.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (request.method === "OPTIONS") return response.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  return next();
});

async function authenticate(request) {
  const match = request.get("Authorization")?.match(/^Bearer (.+)$/);
  if (!match) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });
  return admin.auth().verifyIdToken(match[1], true);
}

function validateAnalysis(value) {
  if (!value || typeof value !== "object") throw Object.assign(new Error("분석 결과가 필요합니다."), { status: 400 });
  if (value.schemaVersion !== "assettrail.analysis.v1") throw Object.assign(new Error("지원하지 않는 분석 스키마입니다."), { status: 400 });
  if (!value.id || !value.createdAt || !value.summary || !value.quality) throw Object.assign(new Error("분석 결과의 필수 항목이 없습니다."), { status: 400 });
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id) || Number.isNaN(new Date(value.createdAt).getTime())) {
    throw Object.assign(new Error("분석 식별자 또는 생성 시각이 올바르지 않습니다."), { status: 400 });
  }
  return value;
}

function stripServerFields(analysis) {
  const { aiReport: _aiReport, pdfObjectPath: _pdfObjectPath, reportCreatedAt: _reportCreatedAt, ...safeAnalysis } = analysis;
  return safeAnalysis;
}

async function saveAnalysisRun(uid, analysis) {
  const runs = db.collection("users").doc(uid).collection("analysisRuns");
  await runs.doc(analysis.id).set({ ...analysis, reportCreatedAt: new Date().toISOString() }, { merge: true });
  const stale = await runs.orderBy("createdAt", "desc").offset(12).limit(50).get();
  if (!stale.empty) {
    const batch = db.batch();
    stale.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    await Promise.all(stale.docs
      .map((document) => document.data()?.pdfObjectPath)
      .filter(Boolean)
      .map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch((error) => console.error("stale PDF delete failed", error))));
  }
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function quotaSnapshot(uid) {
  const period = monthKey();
  if (adminUids.has(uid)) return { period, limit: null, used: 0, remaining: null, unlimited: true };
  const userRef = db.collection("users").doc(uid);
  const [entitlement, usage] = await Promise.all([
    userRef.collection("analysisEntitlements").doc("primary").get(),
    userRef.collection("analysisUsage").doc(period).get()
  ]);
  const configured = Number(entitlement.data()?.monthlyLimit);
  const limit = Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : defaultMonthlyLimit;
  const used = Math.max(0, Number(usage.data()?.aiReportCount || 0));
  return { period, limit, used, remaining: Math.max(0, limit - used), unlimited: false };
}

async function reserveQuota(uid) {
  if (adminUids.has(uid)) return { period: monthKey(), limit: null, used: 0, remaining: null, unlimited: true };
  const period = monthKey();
  const userRef = db.collection("users").doc(uid);
  const entitlementRef = userRef.collection("analysisEntitlements").doc("primary");
  const usageRef = userRef.collection("analysisUsage").doc(period);
  return db.runTransaction(async (transaction) => {
    const [entitlement, usage] = await Promise.all([transaction.get(entitlementRef), transaction.get(usageRef)]);
    const configured = Number(entitlement.data()?.monthlyLimit);
    const limit = Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : defaultMonthlyLimit;
    const used = Math.max(0, Number(usage.data()?.aiReportCount || 0));
    if (used >= limit) {
      throw Object.assign(new Error(`이번 달 AI 보고서 한도 ${limit}회를 모두 사용했습니다.`), {
        status: 429,
        code: "AI_QUOTA_EXCEEDED",
        quota: { period, limit, used, remaining: 0, unlimited: false }
      });
    }
    transaction.set(usageRef, {
      aiReportCount: used + 1,
      period,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { period, limit, used: used + 1, remaining: limit - used - 1, unlimited: false };
  });
}

async function releaseQuota(uid, quota) {
  if (!quota || quota.unlimited) return;
  const usageRef = db.collection("users").doc(uid).collection("analysisUsage").doc(quota.period);
  await db.runTransaction(async (transaction) => {
    const usage = await transaction.get(usageRef);
    const used = Math.max(0, Number(usage.data()?.aiReportCount || 0));
    transaction.set(usageRef, { aiReportCount: Math.max(0, used - 1), updatedAt: new Date().toISOString() }, { merge: true });
  });
}

async function renderPdf(analysis, aiReport) {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderReport(analysis, aiReport), { waitUntil: "load" });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close();
  }
}

app.get("/healthz", (_request, response) => response.json({ ok: true }));
app.get("/v1/status", (_request, response) => response.json({ ok: true }));
app.get("/v1/analysis-runs", async (request, response) => {
  try {
    const token = await authenticate(request);
    const snapshot = await db.collection("users").doc(token.uid).collection("analysisRuns")
      .orderBy("createdAt", "desc").limit(12).get();
    response.set("Cache-Control", "no-store");
    response.json({ runs: snapshot.docs.map((document) => document.data()) });
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "분석 이력을 불러오지 못했습니다." });
  }
});
app.get("/v1/ai-quota", async (request, response) => {
  try {
    const token = await authenticate(request);
    response.set("Cache-Control", "no-store");
    response.json({ quota: await quotaSnapshot(token.uid) });
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "AI 사용량을 불러오지 못했습니다.", code: error.code || null });
  }
});
app.post("/v1/analysis-runs", async (request, response) => {
  try {
    const token = await authenticate(request);
    const analysis = stripServerFields(validateAnalysis(request.body?.analysis));
    await saveAnalysisRun(token.uid, analysis);
    response.status(201).json({ id: analysis.id });
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "분석 이력을 저장하지 못했습니다." });
  }
});
app.post("/v1/ai-reports", async (request, response) => {
  let quota;
  let token;
  let pdfObjectPath;
  try {
    token = await authenticate(request);
    const analysis = validateAnalysis(request.body?.analysis);
    const includeMarketContext = request.body?.mode === "market-context";
    quota = await reserveQuota(token.uid);
    const aiReport = await createAiReport({
      analysis,
      includeMarketContext,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL
    });
    const pdf = await renderPdf(analysis, aiReport);
    pdfObjectPath = `users/${token.uid}/analysisReports/${aiReport.reportId}.pdf`;
    await bucket.file(pdfObjectPath).save(pdf, {
      resumable: false,
      contentType: "application/pdf",
      metadata: { cacheControl: "private, no-store" }
    });
    const storedRun = {
      ...analysis,
      aiReport: { ...aiReport, usage: quota, pdfAvailable: true },
      pdfObjectPath,
      reportCreatedAt: new Date().toISOString()
    };
    await saveAnalysisRun(token.uid, storedRun);
    response.set("Cache-Control", "no-store");
    response.status(201).json({ report: storedRun.aiReport, quota });
  } catch (error) {
    console.error(error);
    if (pdfObjectPath) await bucket.file(pdfObjectPath).delete({ ignoreNotFound: true }).catch((deleteError) => console.error("orphan PDF delete failed", deleteError));
    if (token && quota) await releaseQuota(token.uid, quota).catch((releaseError) => console.error("quota rollback failed", releaseError));
    response.status(error.status || 500).json({
      error: error.status ? error.message : "AI 보고서를 생성하지 못했습니다.",
      code: error.code || null,
      quota: error.quota || null
    });
  }
});
app.get("/v1/ai-reports/:analysisId/pdf", async (request, response) => {
  try {
    const token = await authenticate(request);
    const analysisId = String(request.params.analysisId || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(analysisId)) throw Object.assign(new Error("분석 식별자가 올바르지 않습니다."), { status: 400 });
    const snapshot = await db.collection("users").doc(token.uid).collection("analysisRuns").doc(analysisId).get();
    const run = snapshot.data();
    if (!snapshot.exists || !run?.pdfObjectPath || !run?.aiReport?.pdfAvailable) {
      throw Object.assign(new Error("저장된 AI 보고서 PDF가 없습니다."), { status: 404 });
    }
    const [pdf] = await bucket.file(run.pdfObjectPath).download();
    response.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="assettrail-ai-report-${analysisId}.pdf"`,
      "Content-Type": "application/pdf"
    });
    response.send(pdf);
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "PDF를 불러오지 못했습니다.", code: error.code || null });
  }
});
app.post("/v1/reports/portfolio-analysis", (_request, response) => {
  response.status(410).json({ error: "기존 규칙 기반 PDF는 종료되었습니다. AI 보고서 생성을 사용하세요.", code: "LEGACY_REPORT_RETIRED" });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`AssetTrail analysis API listening on ${port}`));
