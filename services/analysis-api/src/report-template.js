"use strict";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function percent(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}

function textOr(value, fallback = "확인 가능한 데이터가 없습니다.") {
  return escapeHtml(value || fallback);
}

function toneLabel(level) {
  return { high: "높음", medium: "중간", low: "낮음", positive: "긍정", neutral: "중립", negative: "부정" }[level] || level;
}

function list(items, className = "bullet-list") {
  if (!items?.length) return `<p class="empty">표시할 내용이 없습니다.</p>`;
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function evidenceBadges(ids) {
  if (!ids?.length) return "";
  return `<span class="evidence-badges">${ids.map((id) => `<b>${escapeHtml(id)}</b>`).join("")}</span>`;
}

function exposureBars(items, limit = 6) {
  if (!items?.length) return `<p class="empty">표시할 노출 데이터가 없습니다.</p>`;
  return `<div class="bar-list">${items.slice(0, limit).map((item, index) => {
    const width = Math.max(1, Math.min(100, (Number(item.weight) || 0) * 100));
    return `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(item.label)}</span><strong>${percent(item.weight)}</strong></div><div class="bar-track"><i style="width:${width}%;--bar-index:${index}"></i></div><small>${money(item.value)}</small></div>`;
  }).join("")}</div>`;
}

function page(title, eyebrow, body, pageNumber, totalPages) {
  return `<section class="page">
    <header><div><span>${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1></div><b>${String(pageNumber).padStart(2, "0")}</b></header>
    <main>${body}</main>
    <footer><span>AssetTrail AI Portfolio Report</span><span>${pageNumber} / ${totalPages}</span><span>정보 제공 목적 · 조건부 진단</span></footer>
  </section>`;
}

function executivePage(analysis, report) {
  const executive = report.executive || {};
  const concentration = analysis.concentration || {};
  const performance = analysis.performance || {};
  return `
    <div class="verdict"><span>AI 종합 판단</span><h2>${textOr(executive.portfolioCharacter)}</h2><p>${textOr(executive.diagnosis)}</p></div>
    <div class="metric-strip">
      <div><span>총 평가금액</span><strong>${money(analysis.summary?.totalValue)}</strong></div>
      <div><span>상위 1개 집중도</span><strong>${percent(concentration.top1Weight)}</strong></div>
      <div><span>상위 5개 집중도</span><strong>${percent(concentration.top5Weight)}</strong></div>
      <div><span>관측 최대낙폭</span><strong>${performance.maxObservedDrawdown == null ? "계산 대기" : percent(performance.maxObservedDrawdown)}</strong></div>
    </div>
    <div class="two-column compact">
      <section class="panel positive"><h3>구조적 강점</h3>${list(executive.strengths)}</section>
      <section class="panel negative"><h3>핵심 취약점</h3>${list(executive.vulnerabilities)}</section>
    </div>
    <section class="priority-section"><div class="section-head"><h3>우선순위</h3><span>기존 보유 매도보다 신규자금과 속도 조절 우선</span></div>
      <div class="priority-list">${(executive.priorities || []).map((item) => `<article><b>${item.rank}</b><div><h4>${escapeHtml(item.action)}</h4><p>${escapeHtml(item.rationale)}</p><small>확인 조건 · ${escapeHtml(item.trigger)}</small></div>${evidenceBadges(item.evidenceIds)}</article>`).join("")}</div>
    </section>`;
}

function exposurePage(analysis, report) {
  const positions = analysis.concentration?.positions || [];
  return `
    <div class="page-lead"><h2>${textOr(report.exposure?.headline)}</h2><p>계좌 수가 아니라 평가금액과 동일 티커 합산 기준으로 읽습니다.</p></div>
    <div class="two-column exposure-layout">
      <section><div class="section-head"><h3>자산 유형</h3><span>평가금액 기준</span></div>${exposureBars(analysis.exposures?.assetType, 6)}</section>
      <section><div class="section-head"><h3>상장시장 노출</h3><span>실질 매출 국가와 다를 수 있음</span></div>${exposureBars(analysis.exposures?.country || analysis.exposures?.region, 6)}</section>
    </div>
    <div class="two-column exposure-layout lower">
      <section><div class="section-head"><h3>통화 노출</h3><span>원화 성과 민감도</span></div>${exposureBars(analysis.exposures?.currency, 5)}</section>
      <section><div class="section-head"><h3>상위 경제적 포지션</h3><span>계좌 간 중복 합산</span></div><table class="positions"><tbody>${positions.slice(0, 7).map((item, index) => `<tr><td><b>${index + 1}</b></td><td>${escapeHtml(item.label)}</td><td>${percent(item.weight)}</td><td>${money(item.value)}</td></tr>`).join("")}</tbody></table></section>
    </div>
    <section class="insight-box"><h3>AI 해석</h3>${list(report.exposure?.findings, "numbered-list")} ${report.exposure?.blindSpots?.length ? `<div class="blind-spots"><b>데이터 사각지대</b><span>${report.exposure.blindSpots.map((item) => escapeHtml(item)).join(" · ")}</span></div>` : ""}</section>`;
}

function riskPage(analysis, report) {
  const risk = report.risk || {};
  return `
    <div class="page-lead"><h2>${textOr(risk.headline)}</h2><p>위험요인이 여러 종목과 ETF에 동시에 전달되는 경로를 우선합니다.</p></div>
    <section class="risk-table-wrap"><table class="risk-table"><thead><tr><th>위험요인</th><th>수준</th><th>전이 경로</th><th>모니터링</th><th>근거</th></tr></thead><tbody>${(risk.factors || []).map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td><span class="tone ${escapeHtml(item.level)}">${escapeHtml(toneLabel(item.level))}</span></td><td>${escapeHtml(item.transmission)}</td><td>${escapeHtml(item.monitor)}</td><td>${evidenceBadges(item.evidenceIds)}</td></tr>`).join("")}</tbody></table></section>
    <div class="section-head scenario-head"><h3>시나리오 스트레스</h3><span>예측이 아니라 조건별 영향 경로</span></div>
    <div class="scenario-grid">${(risk.scenarios || []).map((item) => `<article class="scenario ${escapeHtml(item.direction)}"><span>${escapeHtml(toneLabel(item.direction))}</span><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.impact)}</p><small>${escapeHtml(item.condition)}</small></article>`).join("")}</div>
    <div class="concentration-note"><div><span>HHI</span><strong>${escapeHtml(analysis.concentration?.hhi ?? "-")}</strong></div><div><span>유효 포지션 수</span><strong>${escapeHtml(analysis.concentration?.effectivePositionCount ?? "-")}</strong></div><p>종목 수가 많아도 동일 위험요인에 노출되면 실질 분산효과는 작을 수 있습니다.</p></div>`;
}

function performancePage(analysis, report) {
  const performance = analysis.performance || {};
  const quality = analysis.quality || {};
  return `
    <div class="page-lead"><h2>${textOr(report.performance?.headline)}</h2><p>입출금이 섞인 총자산 변화와 투자수익률을 구분합니다.</p></div>
    <div class="metric-strip performance-strip">
      <div><span>조회 기록</span><strong>${performance.snapshotCount || 0}회</strong></div>
      <div><span>총자산 관측 변화</span><strong>${performance.observedChangeRate == null ? "계산 대기" : percent(performance.observedChangeRate)}</strong></div>
      <div><span>관측 최대낙폭</span><strong>${performance.maxObservedDrawdown == null ? "계산 대기" : percent(performance.maxObservedDrawdown)}</strong></div>
      <div><span>데이터 신뢰도</span><strong>${quality.score || 0}점</strong></div>
    </div>
    <div class="two-column performance-layout">
      <section class="panel"><h3>확인된 변화</h3>${list(report.performance?.findings, "numbered-list")}</section>
      <section class="panel muted"><h3>해석 제한</h3>${list(report.performance?.interpretationLimits)}</section>
    </div>
    <section class="quality-table"><div class="section-head"><h3>데이터 품질 점검</h3><span>계산 불가 항목은 추정하지 않음</span></div><table><tbody>${(quality.checks || []).slice(0, 8).map((check) => `<tr><td><span class="check ${escapeHtml(check.status)}">${escapeHtml(check.status)}</span></td><td>${escapeHtml(check.code.replaceAll("_", " "))}</td><td>${escapeHtml(check.detail)}</td></tr>`).join("")}</tbody></table></section>
    <div class="method-note"><b>TWR · XIRR · 위험조정 성과</b><span>${escapeHtml(performance.twr?.reason || performance.reason || "현금흐름과 벤치마크 시계열이 연결되면 계산합니다.")}</span></div>`;
}

function actionPage(_analysis, report) {
  const plan = report.actionPlan || {};
  return `
    <div class="page-lead action-lead"><span>조건부 대응 계획</span><h2>${textOr(plan.headline)}</h2><p>특정 종목의 매수·매도 수량이 아니라 신규자금 방향과 속도, 감속 조건을 제시합니다.</p></div>
    <section><div class="section-head"><h3>신규자금 우선순위</h3><span>높은 순서부터 검토</span></div><table class="action-table"><thead><tr><th>순위</th><th>방향</th><th>이유</th><th>경계 조건</th></tr></thead><tbody>${(plan.newMoney || []).map((item) => `<tr><td><b>${item.priority}</b></td><td><strong>${escapeHtml(item.direction)}</strong></td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.boundary)}</td></tr>`).join("")}</tbody></table></section>
    <section class="pace-box"><span>매수 속도</span><p>${textOr(plan.pace)}</p></section>
    <div class="two-column action-lists">
      <section class="panel negative"><h3>감속 조건</h3>${list(plan.decelerationConditions)}</section>
      <section class="panel"><h3>다음 점검</h3>${list(plan.nextChecks, "check-list")}</section>
    </div>
    <div class="decision-rule"><b>실행 원칙</b><p>비중·낙폭만으로 결론을 내리지 않고, thesis 훼손과 공통 위험요인의 확대가 확인될 때 판단 강도를 높입니다.</p></div>`;
}

function marketPage(report) {
  const market = report.marketContext;
  const external = (report.evidence || []).filter((item) => item.type === "external");
  return `
    <div class="page-lead"><span>기준일 ${escapeHtml(market.asOf || report.asOf)}</span><h2>${textOr(market.headline)}</h2><p>최신 외부정보는 포트폴리오 구조 진단과 분리해 표시합니다.</p></div>
    <div class="two-column market-layout">
      <section class="panel positive"><h3>상방 촉매</h3>${list(market.catalysts)}</section>
      <section class="panel negative"><h3>하방 위험</h3>${list(market.risks)}</section>
    </div>
    <section class="sources"><div class="section-head"><h3>외부 근거</h3><span>AI 판단 옆 ID와 연결</span></div>${external.length ? external.slice(0, 10).map((item) => `<article><b>${escapeHtml(item.id)}</b><div><h4>${escapeHtml(item.label)}</h4><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.asOf || "기준일 미표시")} · ${item.url ? escapeHtml(item.url) : "내부 근거"}</small></div></article>`).join("") : `<p class="empty">연결된 외부 근거가 없습니다.</p>`}</section>`;
}

function appendixPage(analysis, report) {
  const evidence = report.evidence || [];
  const positions = analysis.concentration?.positions || [];
  return `
    <div class="page-lead"><h2>보유자산과 근거 색인</h2><p>핵심 페이지의 판단을 다시 확인하기 위한 부록입니다.</p></div>
    <section><div class="section-head"><h3>경제적 포지션</h3><span>최대 12개 표시</span></div><table class="appendix-table"><thead><tr><th>순위</th><th>포지션</th><th>비중</th><th>평가금액</th></tr></thead><tbody>${positions.slice(0, 12).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.label)}</td><td>${percent(item.weight)}</td><td>${money(item.value)}</td></tr>`).join("")}</tbody></table></section>
    <section class="evidence-index"><div class="section-head"><h3>내부 근거</h3><span>보고서 판단 배지와 연결</span></div><div>${evidence.filter((item) => item.type !== "external").slice(0, 12).map((item) => `<article><b>${escapeHtml(item.id)}</b><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span></article>`).join("")}</div></section>
    <section class="limitations"><h3>방법론과 한계</h3>${list(report.limitations)}<p>${textOr(report.disclaimer)}</p></section>`;
}

function renderReport(analysis, aiReport) {
  const report = aiReport?.content || aiReport;
  if (!report?.executive || !report?.actionPlan) throw new TypeError("구조화된 AI 보고서가 필요합니다.");
  const includeMarket = Boolean(report.marketContext);
  const includeAppendix = (analysis.concentration?.positions || []).length > 6
    || (report.evidence || []).length > 8
    || Number(analysis.quality?.score || 0) < 80;
  const builders = [
    ["현재 포트폴리오 AI 분석", "01 · Executive diagnosis", executivePage(analysis, report)],
    ["실질 경제적 노출", "02 · Economic exposure", exposurePage(analysis, report)],
    ["집중도와 위험 구조", "03 · Risk transmission", riskPage(analysis, report)],
    ["성과와 투자 행동", "04 · Performance context", performancePage(analysis, report)],
    ["조건부 대응 계획", "05 · Conditional action", actionPage(analysis, report)]
  ];
  if (includeMarket) builders.push(["최신 시장 맥락", "06 · Market context", marketPage(report)]);
  if (includeAppendix) builders.push(["보유자산·근거·방법론", `${String(builders.length + 1).padStart(2, "0")} · Appendix`, appendixPage(analysis, report)]);
  const totalPages = builders.length;
  const pages = builders.map(([title, eyebrow, body], index) => page(title, eyebrow, body, index + 1, totalPages));

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#172033;font-family:"Noto Sans CJK KR","Noto Sans KR",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{height:297mm;padding:14mm 15mm 13mm;page-break-after:always;position:relative;overflow:hidden}.page:last-child{page-break-after:auto}header{align-items:flex-start;border-bottom:1.5px solid #172033;display:flex;justify-content:space-between;margin-bottom:7mm;padding-bottom:4mm}header span{color:#64748b;font-size:7.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:21px;letter-spacing:-.04em;margin:1.5mm 0 0}header>b{color:#cbd5e1;font-size:23px}main{height:247mm}footer{align-items:center;border-top:1px solid #e2e8f0;bottom:6mm;color:#94a3b8;display:flex;font-size:7px;justify-content:space-between;left:15mm;padding-top:2.5mm;position:absolute;right:15mm}.page-lead{margin-bottom:6mm}.page-lead>span{color:#2563eb;font-size:8px;font-weight:700}.page-lead h2{font-size:18px;letter-spacing:-.035em;line-height:1.35;margin:1mm 0 1.5mm}.page-lead p{color:#64748b;font-size:9px;margin:0}.verdict{background:#172033;border-radius:4mm;color:#fff;margin-bottom:4mm;padding:7mm 8mm}.verdict>span{color:#93c5fd;font-size:8px;font-weight:700}.verdict h2{font-size:17px;line-height:1.35;margin:2mm 0}.verdict p{color:#dbeafe;font-size:9px;line-height:1.65;margin:0}.metric-strip{display:grid;gap:2.5mm;grid-template-columns:repeat(4,1fr);margin-bottom:4mm}.metric-strip>div{border:1px solid #dbe3ee;border-radius:2.5mm;padding:4mm}.metric-strip span{color:#64748b;display:block;font-size:7.5px}.metric-strip strong{display:block;font-size:13px;margin-top:1.5mm}.two-column{display:grid;gap:4mm;grid-template-columns:1fr 1fr}.two-column.compact{margin-bottom:4mm}.panel{background:#f8fafc;border:1px solid #dbe3ee;border-radius:3mm;padding:4mm}.panel.positive{border-top:2.5px solid #059669}.panel.negative{border-top:2.5px solid #dc2626}.panel.muted{border-top:2.5px solid #64748b}.panel h3,.section-head h3,.insight-box h3,.limitations h3{font-size:10px;margin:0}.bullet-list,.numbered-list,.check-list{font-size:8.5px;line-height:1.55;margin:2.5mm 0 0;padding-left:4.5mm}.bullet-list li,.numbered-list li,.check-list li{margin:1.2mm 0}.numbered-list{counter-reset:item;list-style:none;padding:0}.numbered-list li{counter-increment:item;padding-left:6mm;position:relative}.numbered-list li:before{background:#e0e7ff;border-radius:50%;color:#3730a3;content:counter(item);font-size:7px;font-weight:700;height:4mm;left:0;line-height:4mm;position:absolute;text-align:center;top:.3mm;width:4mm}.priority-section{border:1px solid #dbe3ee;border-radius:3mm;padding:4mm}.section-head{align-items:center;display:flex;justify-content:space-between;margin-bottom:2.5mm}.section-head span{color:#64748b;font-size:7.5px}.priority-list{display:grid;gap:2mm}.priority-list article{align-items:start;background:#f8fafc;border-radius:2mm;display:grid;gap:3mm;grid-template-columns:7mm 1fr auto;padding:3mm}.priority-list article>b,.sources article>b,.evidence-index article>b{background:#172033;border-radius:1.5mm;color:#fff;font-size:8px;padding:1.5mm;text-align:center}.priority-list h4,.sources h4{font-size:9px;margin:0 0 1mm}.priority-list p,.sources p{color:#475569;font-size:8px;line-height:1.45;margin:0}.priority-list small{color:#64748b;display:block;font-size:7.5px;margin-top:1mm}.evidence-badges{display:flex;gap:1mm}.evidence-badges b{background:#dbeafe;border-radius:1mm;color:#1d4ed8;font-size:6.5px;padding:1mm}.exposure-layout section{min-width:0}.exposure-layout.lower{border-top:1px solid #e2e8f0;margin-top:5mm;padding-top:5mm}.bar-list{display:grid;gap:2.4mm}.bar-label{display:flex;font-size:8px;justify-content:space-between;margin-bottom:1mm}.bar-label strong{font-variant-numeric:tabular-nums}.bar-track{background:#e8edf3;border-radius:10mm;height:2.2mm;overflow:hidden}.bar-track i{background:#2563eb;border-radius:inherit;display:block;height:100%}.bar-row:nth-child(2) i{background:#0f766e}.bar-row:nth-child(3) i{background:#7c3aed}.bar-row:nth-child(4) i{background:#d97706}.bar-row:nth-child(5) i{background:#64748b}.bar-row small{color:#64748b;display:block;font-size:7px;margin-top:.7mm;text-align:right}.positions{border-collapse:collapse;width:100%}.positions td{border-bottom:1px solid #e2e8f0;font-size:7.5px;padding:1.7mm}.positions td:nth-child(3),.positions td:nth-child(4){text-align:right}.positions td:first-child b{color:#94a3b8}.insight-box{background:#eff6ff;border-left:3px solid #2563eb;border-radius:2mm;margin-top:5mm;padding:4mm}.blind-spots{border-top:1px solid #bfdbfe;color:#475569;font-size:7.5px;margin-top:3mm;padding-top:2mm}.blind-spots b{color:#1d4ed8;margin-right:2mm}.risk-table,.action-table,.quality-table table,.appendix-table{border-collapse:collapse;width:100%}.risk-table{table-layout:fixed}.risk-table th,.action-table th,.appendix-table th{background:#f1f5f9;color:#64748b;font-size:7px;padding:2mm;text-align:left}.risk-table td,.action-table td,.appendix-table td{border-bottom:1px solid #e2e8f0;font-size:7.2px;line-height:1.45;padding:2mm;vertical-align:top}.risk-table th:nth-child(1){width:21mm}.risk-table th:nth-child(2){width:14mm}.risk-table th:nth-child(4){width:35mm}.risk-table th:nth-child(5){width:20mm}.tone{border-radius:10mm;display:inline-block;font-size:6.5px;font-weight:700;padding:1mm 1.7mm}.tone.high{background:#fee2e2;color:#b91c1c}.tone.medium{background:#fef3c7;color:#92400e}.tone.low{background:#dcfce7;color:#166534}.scenario-head{margin-top:6mm}.scenario-grid{display:grid;gap:3mm;grid-template-columns:repeat(3,1fr)}.scenario{border:1px solid #dbe3ee;border-top:2.5px solid #64748b;border-radius:2.5mm;padding:4mm}.scenario.positive{border-top-color:#059669}.scenario.negative{border-top-color:#dc2626}.scenario>span{color:#64748b;font-size:7px}.scenario h4{font-size:9px;margin:1.5mm 0}.scenario p{color:#475569;font-size:7.5px;line-height:1.45;margin:0}.scenario small{border-top:1px solid #e2e8f0;color:#64748b;display:block;font-size:7px;margin-top:2mm;padding-top:2mm}.concentration-note{align-items:center;background:#172033;border-radius:2.5mm;color:white;display:grid;gap:4mm;grid-template-columns:24mm 28mm 1fr;margin-top:5mm;padding:4mm}.concentration-note span{color:#94a3b8;display:block;font-size:7px}.concentration-note strong{font-size:13px}.concentration-note p{color:#cbd5e1;font-size:8px;line-height:1.5;margin:0}.performance-strip{margin-bottom:6mm}.performance-layout{margin-bottom:5mm}.quality-table{border:1px solid #dbe3ee;border-radius:3mm;padding:4mm}.quality-table td{border-bottom:1px solid #e2e8f0;font-size:7px;padding:1.4mm}.quality-table td:first-child{width:18mm}.quality-table td:nth-child(2){font-weight:700;width:48mm}.check{border-radius:10mm;font-size:6px;font-weight:700;padding:.8mm 1.4mm}.check.pass{background:#dcfce7;color:#166534}.check.warn,.check.missing{background:#fef3c7;color:#92400e}.check.fail{background:#fee2e2;color:#b91c1c}.check.not_applicable{background:#e2e8f0;color:#475569}.method-note{background:#f8fafc;border-left:3px solid #64748b;border-radius:2mm;display:flex;flex-direction:column;gap:1mm;margin-top:4mm;padding:3mm}.method-note b{font-size:8px}.method-note span{color:#64748b;font-size:7.5px}.action-lead{background:#f8fafc;border-radius:3mm;padding:5mm}.action-table th:first-child{width:14mm}.action-table th:nth-child(2){width:40mm}.action-table th:nth-child(4){width:48mm}.pace-box{background:#172033;border-radius:3mm;color:#fff;margin:5mm 0;padding:5mm}.pace-box span{color:#93c5fd;font-size:7.5px;font-weight:700}.pace-box p{font-size:10px;line-height:1.6;margin:1.5mm 0 0}.action-lists{margin-bottom:5mm}.decision-rule{border:1px solid #bfdbfe;border-radius:2.5mm;padding:4mm}.decision-rule b{color:#1d4ed8;font-size:8px}.decision-rule p{color:#475569;font-size:8px;line-height:1.5;margin:1mm 0 0}.market-layout{margin-bottom:6mm}.sources{border:1px solid #dbe3ee;border-radius:3mm;padding:4mm}.sources article{align-items:start;border-bottom:1px solid #e2e8f0;display:grid;gap:3mm;grid-template-columns:10mm 1fr;padding:2.5mm 0}.sources article:last-child{border-bottom:0}.sources small{color:#64748b;display:block;font-size:6.5px;margin-top:1mm;overflow-wrap:anywhere}.appendix-table th:nth-child(1){width:14mm}.appendix-table th:nth-child(3),.appendix-table th:nth-child(4),.appendix-table td:nth-child(3),.appendix-table td:nth-child(4){text-align:right}.evidence-index{margin-top:5mm}.evidence-index>div:last-child{display:grid;gap:2mm;grid-template-columns:1fr 1fr}.evidence-index article{align-items:start;background:#f8fafc;border-radius:2mm;display:grid;gap:2mm;grid-template-columns:9mm 1fr;padding:2.5mm}.evidence-index strong,.evidence-index small{display:block}.evidence-index strong{font-size:7.5px}.evidence-index small{color:#64748b;font-size:6.5px;line-height:1.4;margin-top:.7mm}.limitations{background:#f8fafc;border-radius:3mm;margin-top:5mm;padding:4mm}.limitations p{border-top:1px solid #e2e8f0;color:#64748b;font-size:7px;line-height:1.45;margin:3mm 0 0;padding-top:2mm}.empty{color:#94a3b8;font-size:8px}
  </style></head><body>${pages.join("")}</body></html>`;
}

module.exports = { renderReport };
