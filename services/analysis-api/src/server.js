"use strict";

const express = require("express");
const admin = require("firebase-admin");
const puppeteer = require("puppeteer-core");
const { renderReport } = require("./report-template");

admin.initializeApp();
const db = admin.firestore();
const app = express();
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

async function saveAnalysisRun(uid, analysis) {
  const runs = db.collection("users").doc(uid).collection("analysisRuns");
  await runs.doc(analysis.id).set({ ...analysis, reportCreatedAt: new Date().toISOString() }, { merge: true });
  const stale = await runs.orderBy("createdAt", "desc").offset(12).limit(50).get();
  if (!stale.empty) {
    const batch = db.batch();
    stale.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
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
app.post("/v1/analysis-runs", async (request, response) => {
  try {
    const token = await authenticate(request);
    const analysis = validateAnalysis(request.body?.analysis);
    await saveAnalysisRun(token.uid, analysis);
    response.status(201).json({ id: analysis.id });
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "분석 이력을 저장하지 못했습니다." });
  }
});
app.post("/v1/reports/portfolio-analysis", async (request, response) => {
  let browser;
  try {
    const token = await authenticate(request);
    const analysis = validateAnalysis(request.body?.analysis);
    await saveAnalysisRun(token.uid, analysis);
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      headless: true
    });
    const page = await browser.newPage();
    await page.setContent(renderReport(analysis), { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    response.set({
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="assettrail-analysis-${analysis.id}.pdf"`,
      "Content-Type": "application/pdf"
    });
    response.send(pdf);
  } catch (error) {
    console.error(error);
    response.status(error.status || 500).json({ error: error.status ? error.message : "PDF 생성 중 오류가 발생했습니다." });
  } finally {
    if (browser) await browser.close();
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`AssetTrail analysis API listening on ${port}`));
