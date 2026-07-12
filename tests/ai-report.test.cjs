const assert = require("node:assert/strict");
const {
  createAiReport,
  extractWebSources,
  extractOutputText,
  sanitizeAnalysisForAi,
  systemInstructions,
  verifyExternalEvidence
} = require("../services/analysis-api/src/ai-report");
const { analysis, aiReport } = require("./fixtures/ai-report-sample.cjs");

const sanitized = sanitizeAnalysisForAi({
  ...analysis,
  exposures: { ...analysis.exposures, account: [{ key: "secret", label: "아내 계좌", value: 1, weight: 1 }] }
});
assert.equal(sanitized.exposures.account[0].label, "계좌 1");
assert.doesNotMatch(JSON.stringify(sanitized), /아내 계좌/);
assert.match(systemInstructions(false), /외부 시장 사실이나 최신 뉴스를 사용하지 않는다/);
assert.match(systemInstructions(true), /웹 검색을 사용해/);
assert.equal(extractOutputText({ output: [{ content: [{ type: "output_text", text: "ok" }] }] }), "ok");
const webPayload = { output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/source/", title: "Source" }] } }] };
assert.deepEqual(extractWebSources(webPayload), [{ url: "https://example.com/source", title: "Source" }]);
assert.equal(verifyExternalEvidence(aiReport.content, webPayload, true), aiReport.content);
assert.throws(() => verifyExternalEvidence(aiReport.content, { output: [] }, true), /출처 URL/);

(async () => {
  const result = await createAiReport({
    analysis,
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.store, false);
      assert.equal(request.text.format.type, "json_schema");
      return {
        ok: true,
        json: async () => ({ id: "resp_test", output: [{ content: [{ type: "output_text", text: JSON.stringify(aiReport.content) }] }] })
      };
    }
  });
  assert.equal(result.analysisId, analysis.id);
  assert.equal(result.model, "test-model");
  assert.equal(result.content.executive.priorities.length, 3);

  await assert.rejects(() => createAiReport({ analysis, apiKey: "" }), /아직 설정되지 않았습니다/);
  console.log("ai report tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
