"use strict";

const AI_REPORT_SCHEMA_VERSION = "assettrail.ai-report.v1";
const DEFAULT_MODEL = "gpt-5.6";

const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "asOf", "executive", "exposure", "risk", "performance", "actionPlan", "marketContext", "evidence", "limitations", "disclaimer"],
  properties: {
    title: { type: "string", maxLength: 80 },
    asOf: { type: "string", maxLength: 40 },
    executive: {
      type: "object",
      additionalProperties: false,
      required: ["diagnosis", "portfolioCharacter", "strengths", "vulnerabilities", "priorities"],
      properties: {
        diagnosis: { type: "string", maxLength: 420 },
        portfolioCharacter: { type: "string", maxLength: 120 },
        strengths: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", maxLength: 180 } },
        vulnerabilities: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", maxLength: 180 } },
        priorities: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["rank", "action", "rationale", "trigger", "evidenceIds"],
            properties: {
              rank: { type: "integer", minimum: 1, maximum: 3 },
              action: { type: "string", maxLength: 120 },
              rationale: { type: "string", maxLength: 220 },
              trigger: { type: "string", maxLength: 180 },
              evidenceIds: { type: "array", maxItems: 4, items: { type: "string", maxLength: 30 } }
            }
          }
        }
      }
    },
    exposure: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "findings", "blindSpots"],
      properties: {
        headline: { type: "string", maxLength: 180 },
        findings: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", maxLength: 220 } },
        blindSpots: { type: "array", maxItems: 4, items: { type: "string", maxLength: 180 } }
      }
    },
    risk: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "factors", "scenarios"],
      properties: {
        headline: { type: "string", maxLength: 180 },
        factors: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "level", "transmission", "monitor", "evidenceIds"],
            properties: {
              name: { type: "string", maxLength: 80 },
              level: { type: "string", enum: ["high", "medium", "low"] },
              transmission: { type: "string", maxLength: 220 },
              monitor: { type: "string", maxLength: 160 },
              evidenceIds: { type: "array", maxItems: 4, items: { type: "string", maxLength: 30 } }
            }
          }
        },
        scenarios: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "direction", "impact", "condition"],
            properties: {
              name: { type: "string", maxLength: 70 },
              direction: { type: "string", enum: ["positive", "neutral", "negative"] },
              impact: { type: "string", maxLength: 220 },
              condition: { type: "string", maxLength: 180 }
            }
          }
        }
      }
    },
    performance: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "findings", "interpretationLimits"],
      properties: {
        headline: { type: "string", maxLength: 180 },
        findings: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", maxLength: 220 } },
        interpretationLimits: { type: "array", maxItems: 4, items: { type: "string", maxLength: 180 } }
      }
    },
    actionPlan: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "newMoney", "pace", "decelerationConditions", "nextChecks"],
      properties: {
        headline: { type: "string", maxLength: 180 },
        newMoney: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["priority", "direction", "reason", "boundary"],
            properties: {
              priority: { type: "integer", minimum: 1, maximum: 4 },
              direction: { type: "string", maxLength: 100 },
              reason: { type: "string", maxLength: 200 },
              boundary: { type: "string", maxLength: 180 }
            }
          }
        },
        pace: { type: "string", maxLength: 220 },
        decelerationConditions: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", maxLength: 180 } },
        nextChecks: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", maxLength: 160 } }
      }
    },
    marketContext: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["headline", "asOf", "catalysts", "risks"],
          properties: {
            headline: { type: "string", maxLength: 200 },
            asOf: { type: "string", maxLength: 40 },
            catalysts: { type: "array", maxItems: 4, items: { type: "string", maxLength: 220 } },
            risks: { type: "array", maxItems: 4, items: { type: "string", maxLength: 220 } }
          }
        }
      ]
    },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 18,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "label", "detail", "url", "asOf"],
        properties: {
          id: { type: "string", maxLength: 30 },
          type: { type: "string", enum: ["portfolio", "calculation", "external"] },
          label: { type: "string", maxLength: 100 },
          detail: { type: "string", maxLength: 220 },
          url: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
          asOf: { anyOf: [{ type: "string", maxLength: 40 }, { type: "null" }] }
        }
      }
    },
    limitations: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", maxLength: 220 } },
    disclaimer: { type: "string", maxLength: 400 }
  }
};

function compactExposure(items, limit = 8) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((item) => ({
    key: item.key,
    label: item.label,
    value: item.value,
    weight: item.weight
  }));
}

function sanitizeAnalysisForAi(analysis) {
  const accountExposure = compactExposure(analysis.exposures?.account, 8)
    .map((item, index) => ({ ...item, key: `ACCOUNT_${index + 1}`, label: `계좌 ${index + 1}` }));
  return {
    schemaVersion: analysis.schemaVersion,
    analysisId: analysis.id,
    createdAt: analysis.createdAt,
    source: analysis.source,
    preferences: analysis.preferences,
    summary: analysis.summary,
    quality: analysis.quality,
    exposures: {
      assetType: compactExposure(analysis.exposures?.assetType),
      country: compactExposure(analysis.exposures?.country || analysis.exposures?.region),
      currency: compactExposure(analysis.exposures?.currency),
      account: accountExposure
    },
    concentration: {
      top1Weight: analysis.concentration?.top1Weight,
      top5Weight: analysis.concentration?.top5Weight,
      hhi: analysis.concentration?.hhi,
      effectivePositionCount: analysis.concentration?.effectivePositionCount,
      positions: compactExposure(analysis.concentration?.positions, 20)
    },
    performance: analysis.performance,
    warnings: analysis.warnings,
    etfLookThrough: analysis.etfLookThrough,
    benchmark: analysis.benchmark,
    limitations: analysis.limitations
  };
}

function systemInstructions(includeMarketContext) {
  return `당신은 AssetTrail의 공통 포트폴리오 진단 엔진이다. 사용자의 원장 계산 결과를 바탕으로 현재 포트폴리오를 분석한다.

원칙:
- 사실, 계산, 추정, 시나리오를 구분한다.
- 계좌 수가 아니라 실질 경제적 노출과 공통 위험요인을 우선한다.
- 기존 보유 매도를 쉽게 권하지 말고 신규자금 방향과 매수 속도 조절을 먼저 제안한다.
- 특정 종목의 매수·매도 수량이나 목표가격을 제시하지 않는다.
- 단기 가격·수급, 중기 실적, 장기 thesis를 섞어 단정하지 않는다.
- 제공되지 않은 수익률, ETF 구성, 상관계수, 현금흐름을 만들어내지 않는다.
- 데이터가 부족하면 한계를 명시하고 판단 강도를 낮춘다.
- 각 핵심 판단은 evidence 배열의 ID와 연결한다.
- portfolio/calculation 근거는 입력값에서 생성하고 URL은 null로 둔다.
${includeMarketContext
    ? "- 웹 검색을 사용해 최신 시장·기업·ETF·거시 맥락을 확인한다. 외부 사실은 반드시 external evidence와 실제 URL·기준일을 기록한다."
    : "- 외부 시장 사실이나 최신 뉴스를 사용하지 않는다. marketContext는 null로 반환한다."}
- 결과는 한국어로 간결하게 작성하며 차트·표 옆에 들어갈 수 있는 길이를 지킨다.`;
}

function extractOutputText(payload) {
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function extractWebSources(payload) {
  const sources = [];
  for (const item of payload?.output || []) {
    for (const source of item?.action?.sources || []) {
      const url = normalizeUrl(source?.url);
      if (url) sources.push({ url, title: source.title || null });
    }
    for (const content of item?.content || []) {
      for (const annotation of content?.annotations || []) {
        const citation = annotation?.url_citation || annotation;
        const url = normalizeUrl(citation?.url);
        if (url) sources.push({ url, title: citation.title || null });
      }
    }
  }
  return [...new Map(sources.map((source) => [source.url, source])).values()];
}

function verifyExternalEvidence(report, payload, includeMarketContext) {
  if (!includeMarketContext) return report;
  const allowed = new Set(extractWebSources(payload).map((source) => source.url));
  if (!allowed.size) {
    throw Object.assign(new Error("최신 시장 근거의 출처 URL을 확인하지 못했습니다."), { status: 502, code: "AI_INVALID_SOURCES" });
  }
  const external = (report.evidence || []).filter((item) => item.type === "external");
  const invalid = external.filter((item) => !allowed.has(normalizeUrl(item.url)));
  if (!external.length || invalid.length) {
    throw Object.assign(new Error("AI 보고서의 외부 근거가 실제 검색 출처와 일치하지 않습니다."), { status: 502, code: "AI_INVALID_SOURCES" });
  }
  return report;
}

async function createAiReport({ analysis, includeMarketContext = false, apiKey, model = DEFAULT_MODEL, fetchImpl = fetch }) {
  if (!apiKey) throw Object.assign(new Error("AI 보고서 API가 아직 설정되지 않았습니다."), { status: 503, code: "AI_NOT_CONFIGURED" });
  const request = {
    model,
    store: false,
    reasoning: { effort: "medium" },
    instructions: systemInstructions(includeMarketContext),
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: `아래 포트폴리오 분석 데이터를 기관형 5페이지 핵심 보고서로 진단하라. 시장 맥락 모드: ${includeMarketContext ? "포함" : "제외"}\n\n${JSON.stringify(sanitizeAnalysisForAi(analysis))}`
      }]
    }],
    text: {
      format: {
        type: "json_schema",
        name: "assettrail_ai_report",
        strict: true,
        schema: REPORT_JSON_SCHEMA
      }
    }
  };
  if (includeMarketContext) {
    request.tools = [{ type: "web_search" }];
    request.include = ["web_search_call.action.sources"];
  }

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI API 요청 실패 (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status >= 500 ? 502 : 400, code: "AI_PROVIDER_ERROR" });
  }
  const outputText = extractOutputText(payload);
  if (!outputText) throw Object.assign(new Error("AI 보고서 응답이 비어 있습니다."), { status: 502, code: "AI_EMPTY_RESPONSE" });
  let report;
  try {
    report = JSON.parse(outputText);
  } catch {
    throw Object.assign(new Error("AI 보고서 응답을 해석하지 못했습니다."), { status: 502, code: "AI_INVALID_RESPONSE" });
  }
  verifyExternalEvidence(report, payload, includeMarketContext);
  return {
    schemaVersion: AI_REPORT_SCHEMA_VERSION,
    reportId: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    analysisId: analysis.id,
    generatedAt: new Date().toISOString(),
    mode: includeMarketContext ? "market-context" : "structure",
    model,
    content: report,
    providerResponseId: payload.id || null
  };
}

module.exports = {
  AI_REPORT_SCHEMA_VERSION,
  DEFAULT_MODEL,
  REPORT_JSON_SCHEMA,
  createAiReport,
  extractOutputText,
  extractWebSources,
  sanitizeAnalysisForAi,
  systemInstructions,
  verifyExternalEvidence
};
