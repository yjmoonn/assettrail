const assert = require("node:assert/strict");
const { renderReport } = require("../services/analysis-api/src/report-template");

const html = renderReport({
  schemaVersion: "assettrail.analysis.v1",
  id: "run-1",
  createdAt: "2026-07-12T00:00:00Z",
  summary: { totalValue: 1000000, ledgerRowCount: 2, economicPositionCount: 2 },
  quality: { score: 70, checks: [{ code: "ASSETS_PRESENT", status: "pass", detail: "2개" }] },
  exposures: { assetType: [], region: [], currency: [], account: [] },
  concentration: { top1Weight: 0.6, top5Weight: 1, hhi: 0.52, effectivePositionCount: 1.92, positions: [] },
  performance: { snapshotCount: 2, observedChangeRate: 0.1, maxObservedDrawdown: -0.05 },
  warnings: [],
  limitations: ["투자 지시가 아닙니다."],
  etfLookThrough: { reason: "구성 데이터 없음" },
  benchmark: { reason: "시계열 없음" }
});

assert.equal((html.match(/<section class="page">/g) || []).length, 8);
assert.match(html, /포트폴리오 분석 요약/);
assert.match(html, /방법론과 한계/);
assert.doesNotMatch(html, /undefined/);

console.log("analysis report tests passed");
