const analysis = {
  schemaVersion: "assettrail.analysis.v1",
  id: "analysis-sample-1",
  createdAt: "2026-07-12T00:00:00Z",
  source: { mode: "current-ledger", priceGeneratedAt: "2026-07-11T23:00:00Z" },
  summary: { totalValue: 250000000, ledgerRowCount: 14, economicPositionCount: 11 },
  quality: {
    score: 72,
    checks: [
      { code: "ASSETS_PRESENT", status: "pass", detail: "14개 원장 행" },
      { code: "MARKET_PRICE_COVERAGE", status: "pass", detail: "12/12개 시장자산 가격 확인" },
      { code: "SNAPSHOT_HISTORY", status: "pass", detail: "9회 조회 기록" },
      { code: "CASH_FLOW_LEDGER", status: "missing", detail: "외부 입출금 원장 없음" },
      { code: "ETF_LOOK_THROUGH", status: "missing", detail: "2개 ETF 구성 데이터 없음" },
      { code: "BENCHMARK_HISTORY", status: "missing", detail: "벤치마크 시계열 미설정" }
    ]
  },
  exposures: {
    assetType: [
      { label: "국내 시장자산", value: 137500000, weight: 0.55 },
      { label: "미국 시장자산", value: 87500000, weight: 0.35 },
      { label: "현금", value: 15000000, weight: 0.06 },
      { label: "수동평가 자산", value: 10000000, weight: 0.04 }
    ],
    country: [
      { label: "한국 상장", value: 137500000, weight: 0.55 },
      { label: "미국 상장", value: 87500000, weight: 0.35 },
      { label: "국가 미분류", value: 25000000, weight: 0.1 }
    ],
    currency: [
      { label: "KRW", value: 162500000, weight: 0.65 },
      { label: "USD", value: 87500000, weight: 0.35 }
    ],
    account: []
  },
  concentration: {
    top1Weight: 0.22,
    top5Weight: 0.68,
    hhi: 0.128,
    effectivePositionCount: 7.81,
    positions: [
      ["삼성전자", 55000000, 0.22], ["에스티팜", 37500000, 0.15], ["SOL AI반도체TOP2플러스", 30000000, 0.12],
      ["NVIDIA", 25000000, 0.1], ["이수페타시스", 22500000, 0.09], ["Broadcom", 17500000, 0.07],
      ["현금", 15000000, 0.06], ["Palantir", 12500000, 0.05], ["LS ELECTRIC", 10000000, 0.04],
      ["Micron", 7500000, 0.03], ["기타", 7500000, 0.03]
    ].map(([label, value, weight]) => ({ label, value, weight }))
  },
  performance: {
    snapshotCount: 9,
    observedChangeRate: 0.043,
    maxObservedDrawdown: -0.087,
    twr: { reason: "외부 입출금 현금흐름이 필요합니다." }
  },
  warnings: [],
  limitations: ["현금흐름 원장이 없어 TWR·XIRR을 계산하지 않습니다."],
  etfLookThrough: { reason: "ETF 구성 데이터 공급원이 연결되지 않았습니다." },
  benchmark: { reason: "벤치마크 시계열이 없습니다." }
};

const aiReport = {
  schemaVersion: "assettrail.ai-report.v1",
  reportId: "report-sample-1",
  analysisId: analysis.id,
  generatedAt: "2026-07-12T08:00:00Z",
  mode: "market-context",
  model: "gpt-5.6",
  pdfAvailable: true,
  content: {
    title: "현재 포트폴리오 AI 분석",
    asOf: "2026-07-12",
    executive: {
      diagnosis: "AI 인프라와 반도체에 성장동력이 집중된 공격형 포트폴리오입니다. 개별 종목 수보다 공통 사이클 노출이 크므로 기존 보유의 일괄 축소보다 신규자금의 분산과 매수 속도 조절이 우선입니다.",
      portfolioCharacter: "AI 인프라 집중형 성장 포트폴리오",
      strengths: ["실적 가시성이 높은 대형 반도체와 전력 인프라를 함께 보유", "현금과 장기 전략자산이 일부 완충 역할", "한국과 미국 시장을 통한 실행 경로 분산"],
      vulnerabilities: ["상위 5개가 전체의 68%를 차지", "AI CAPEX 감속 시 여러 포지션에 동시 충격", "현금흐름 미분리로 성과 판단 정확도 제한"],
      priorities: [
        { rank: 1, action: "신규자금의 AI 하드웨어 추가 집중을 감속", rationale: "기존 보유만으로도 공통 사이클 노출이 충분합니다.", trigger: "상위 5개 집중도 70% 접근", evidenceIds: ["P01", "C01"] },
        { rank: 2, action: "현금성 완충자산을 신규자금으로 보강", rationale: "강제매도 없이 변동성을 견딜 여유를 확보합니다.", trigger: "관측 낙폭 -10% 확대", evidenceIds: ["P02"] },
        { rank: 3, action: "CAPEX와 실적 가이던스를 다음 점검의 핵심으로 설정", rationale: "가격보다 중기 thesis 확인이 우선입니다.", trigger: "하이퍼스케일러 CAPEX 증가율 둔화", evidenceIds: ["E01"] }
      ]
    },
    exposure: {
      headline: "계좌는 분산돼 있지만 경제적 노출은 AI 하드웨어 사이클로 수렴합니다.",
      findings: ["국내 상장자산이 55%로 실행 위험이 한국 수급과 환율에 연결됩니다.", "상위 포지션의 상당수가 반도체·PCB·AI 연산 수요에 동시 노출됩니다.", "달러 노출 35%는 자산 가격과 환율이 함께 성과에 영향을 줍니다."],
      blindSpots: ["ETF 구성종목 투시 미연결", "기업별 매출 지역 미분류"]
    },
    risk: {
      headline: "핵심 위험은 종목별 악재보다 AI CAPEX 감속이 여러 보유자산에 동시에 전이되는 것입니다.",
      factors: [
        { name: "AI CAPEX", level: "high", transmission: "반도체·PCB·전력기기 밸류에이션과 실적 기대에 동시 영향", monitor: "하이퍼스케일러 가이던스", evidenceIds: ["E01", "C01"] },
        { name: "집중도", level: "medium", transmission: "상위 5개 변동이 전체 자산 변화를 지배", monitor: "상위 5개 70%", evidenceIds: ["P01"] },
        { name: "환율", level: "medium", transmission: "미국 자산의 원화 환산성과 변동", monitor: "USD/KRW 방향", evidenceIds: ["P03"] }
      ],
      scenarios: [
        { name: "CAPEX 유지", direction: "positive", impact: "AI 인프라 노출의 실적 가시성이 유지돼 집중도 부담을 일부 상쇄할 수 있습니다.", condition: "주요 사업자의 절대 CAPEX 증가 유지" },
        { name: "증가율 감속", direction: "neutral", impact: "실적은 증가해도 멀티플 압축으로 포트폴리오 회복 속도가 느려질 수 있습니다.", condition: "절대액 유지·증가율 하락" },
        { name: "절대액 축소", direction: "negative", impact: "공통 위험요인이 현실화돼 신규자금 투입 속도를 낮춰야 합니다.", condition: "다수 사업자의 동시 감액" }
      ]
    },
    performance: {
      headline: "총자산은 관측 기간 4.3% 증가했지만 입출금 효과가 분리되지 않아 투자수익률로 단정할 수 없습니다.",
      findings: ["9회 조회 기록에서 최대 관측 낙폭은 -8.7%입니다.", "현재 변화율은 자산 가격과 신규 납입이 함께 반영된 값입니다."],
      interpretationLimits: ["외부 입출금 원장 없음", "벤치마크 시계열 없음", "ETF 투시 데이터 없음"]
    },
    actionPlan: {
      headline: "기존 성장자산을 일괄 매도하기보다 신규자금으로 완충력과 밸류체인 분산을 보강합니다.",
      newMoney: [
        { priority: 1, direction: "현금·생존자산 보강", reason: "강제매도 방지 여력 확보", boundary: "목표 완충비중까지 분할" },
        { priority: 2, direction: "비AI 또는 저중복 노출", reason: "공통 CAPEX 위험 완화", boundary: "기대수익 희석 여부 확인" },
        { priority: 3, direction: "AI 성장자산 추가", reason: "thesis 확인 시 선택적 참여", boundary: "CAPEX·실적 가이던스 유지" }
      ],
      pace: "기본 매수 속도를 유지하되 AI 하드웨어 추가매수는 이벤트 전후로 나눠 실행합니다.",
      decelerationConditions: ["CAPEX 절대액 축소가 복수 기업에서 확인", "상위 5개 집중도 70% 초과", "실적 추정치 하향과 상대강도 약화가 동시 발생"],
      nextChecks: ["하이퍼스케일러 CAPEX 가이던스", "반도체 EPS 추정치", "원달러 환율", "상위 5개 집중도", "현금흐름 원장 연결"]
    },
    marketContext: {
      headline: "현재 시장은 AI 투자 지속성과 자금조달 비용을 동시에 평가하는 구간입니다.",
      asOf: "2026-07-12",
      catalysts: ["주요 사업자의 절대 CAPEX 유지", "메모리·네트워크 실적 가시성 개선"],
      risks: ["타인자본 조달비용 상승", "AI 인프라 투자 증가율 감속"]
    },
    evidence: [
      { id: "P01", type: "portfolio", label: "상위 5개 집중도", detail: "전체 평가금액의 68%", url: null, asOf: "2026-07-12" },
      { id: "P02", type: "calculation", label: "관측 최대낙폭", detail: "9회 조회 기준 -8.7%", url: null, asOf: "2026-07-12" },
      { id: "P03", type: "portfolio", label: "달러 노출", detail: "전체의 35%", url: null, asOf: "2026-07-12" },
      { id: "C01", type: "calculation", label: "유효 포지션 수", detail: "HHI 기준 7.81개", url: null, asOf: "2026-07-12" },
      { id: "E01", type: "external", label: "AI CAPEX 점검", detail: "최신 기업 가이던스 확인이 필요한 핵심 변수", url: "https://example.com/source", asOf: "2026-07-12" }
    ],
    limitations: ["입출금 현금흐름이 분리되지 않아 투자수익률을 계산하지 않았습니다.", "ETF 구성종목과 기업별 실질 지역 매출 데이터가 연결되지 않았습니다."],
    disclaimer: "본 보고서는 현재 포트폴리오 구조를 이해하기 위한 정보 제공 자료이며 개인별 투자자문이나 구체적인 매매 지시가 아닙니다."
  }
};

module.exports = { analysis, aiReport };
