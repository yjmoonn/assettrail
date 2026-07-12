const assert = require("node:assert/strict");
const { renderReport } = require("../services/analysis-api/src/report-template");
const { analysis, aiReport } = require("./fixtures/ai-report-sample.cjs");

const html = renderReport(analysis, aiReport);

assert.equal((html.match(/<section class="page">/g) || []).length, 7);
assert.match(html, /현재 포트폴리오 AI 분석/);
assert.match(html, /조건부 대응 계획/);
assert.match(html, /최신 시장 맥락/);
assert.match(html, /AI CAPEX/);
assert.doesNotMatch(html, /undefined/);
assert.throws(() => renderReport(analysis), /구조화된 AI 보고서/);

console.log("analysis report tests passed");
