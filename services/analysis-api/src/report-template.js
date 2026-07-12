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

function page(title, subtitle, body, pageNumber) {
  return `<section class="page"><header><div><span>AssetTrail Portfolio Analysis</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><b>${pageNumber}</b></header>${body}<footer>공통 규칙 기반 진단 · 매수·매도 지시가 아님</footer></section>`;
}

function rows(items, valueFormatter = percent) {
  if (!items?.length) return "<p class=\"empty\">표시할 데이터가 없습니다.</p>";
  return `<div class="rows">${items.map((item) => `<div><span>${escapeHtml(item.label)}</span><i><em style="width:${Math.max(0, Math.min(100, Number(item.weight) * 100))}%"></em></i><strong>${escapeHtml(valueFormatter(item.weight))}</strong><small>${escapeHtml(money(item.value))}</small></div>`).join("")}</div>`;
}

function renderReport(analysis) {
  const summary = analysis.summary || {};
  const concentration = analysis.concentration || {};
  const performance = analysis.performance || {};
  const checks = analysis.quality?.checks || [];
  const warnings = analysis.warnings || [];
  const pages = [
    page("포트폴리오 분석 요약", `생성 시각 ${new Date(analysis.createdAt).toLocaleString("ko-KR")}`, `
      <div class="hero"><span>총 평가금액</span><strong>${money(summary.totalValue)}</strong><p>${summary.ledgerRowCount || 0}개 원장 행 · ${summary.economicPositionCount || 0}개 경제적 포지션</p></div>
      <div class="metrics"><div><span>데이터 신뢰도</span><strong>${analysis.quality?.score || 0}점</strong></div><div><span>상위 1개 집중도</span><strong>${percent(concentration.top1Weight)}</strong></div><div><span>상위 5개 집중도</span><strong>${percent(concentration.top5Weight)}</strong></div><div><span>관측 최대낙폭</span><strong>${performance.maxObservedDrawdown == null ? "계산 대기" : percent(performance.maxObservedDrawdown)}</strong></div></div>
      <div class="callout"><h2>읽는 법</h2><p>가격과 원장으로 확인 가능한 값만 계산했습니다. 현금흐름·ETF 구성·벤치마크가 없으면 해당 지표를 추정하지 않습니다.</p></div>`, 1),
    page("데이터 신뢰도", "분석 범위와 누락 데이터", `<div class="check-list">${checks.map((check) => `<article class="${escapeHtml(check.status)}"><b>${escapeHtml(check.status)}</b><div><h2>${escapeHtml(check.code.replaceAll("_", " "))}</h2><p>${escapeHtml(check.detail)}</p></div></article>`).join("")}</div>`, 2),
    page("자산 유형과 지역 노출", "계좌명이 아닌 평가금액 기준", `<h2>자산 유형</h2>${rows(analysis.exposures?.assetType)}<h2>상장시장 기준 국가 대용치</h2>${rows(analysis.exposures?.country || analysis.exposures?.region)}`, 3),
    page("통화와 계좌 노출", "원화 성과에 영향을 주는 통화·계좌 구성", `<h2>통화</h2>${rows(analysis.exposures?.currency)}<h2>계좌</h2>${rows((analysis.exposures?.account || []).slice(0, 10))}`, 4),
    page("경제적 노출 집중도", "같은 티커는 계좌가 달라도 합산", `<div class="metrics"><div><span>HHI</span><strong>${escapeHtml(concentration.hhi)}</strong></div><div><span>유효 포지션 수</span><strong>${escapeHtml(concentration.effectivePositionCount)}</strong></div></div><table><thead><tr><th>순위</th><th>경제적 포지션</th><th>평가금액</th><th>비중</th></tr></thead><tbody>${(concentration.positions || []).slice(0, 15).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.label)}</td><td>${money(item.value)}</td><td>${percent(item.weight)}</td></tr>`).join("")}</tbody></table>`, 5),
    page("성과와 낙폭", "조회 기록 기반 관측치와 계산 불가 지표를 구분", `<div class="metrics"><div><span>조회 기록</span><strong>${performance.snapshotCount || 0}회</strong></div><div><span>총자산 관측 변화</span><strong>${performance.observedChangeRate == null ? "계산 대기" : percent(performance.observedChangeRate)}</strong></div><div><span>관측 최대낙폭</span><strong>${performance.maxObservedDrawdown == null ? "계산 대기" : percent(performance.maxObservedDrawdown)}</strong></div></div><div class="callout"><h2>TWR·XIRR</h2><p>${escapeHtml(performance.twr?.reason || "외부 입출금 현금흐름이 필요합니다.")}</p></div><div class="callout"><h2>위험조정 성과</h2><p>${escapeHtml(performance.riskAdjusted?.reason || "벤치마크 시계열이 필요합니다.")}</p></div>`, 6),
    page("위험 경고", "규칙 기반 점검 항목", warnings.length ? `<div class="warnings">${warnings.map((item) => `<article class="${escapeHtml(item.severity)}"><span>${escapeHtml(item.severity)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.detail)}</p></article>`).join("")}</div>` : "<div class=\"callout ok\"><h2>중요 경고 없음</h2><p>미연결 데이터는 신뢰도 페이지에서 별도로 확인하세요.</p></div>", 7),
    page("방법론과 한계", "결과를 투자 판단에 사용할 때의 경계", `<ol class="limitations">${(analysis.limitations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol><div class="callout"><h2>ETF 투시</h2><p>${escapeHtml(analysis.etfLookThrough?.reason)}</p></div><div class="callout"><h2>벤치마크</h2><p>${escapeHtml(analysis.benchmark?.reason)}</p></div><p class="disclaimer">본 보고서는 사용자가 제공한 자산 원장과 가격표를 구조화한 정보 제공 자료입니다. 투자자문·세무·법률 의견이 아니며, 구체적인 매매 실행 전에는 데이터 기준일과 사용자 제약을 다시 확인해야 합니다.</p>`, 8)
  ];

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#172033;font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;background:#fff}.page{height:297mm;padding:18mm 18mm 15mm;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:8mm;margin-bottom:10mm}header span{font-size:9px;letter-spacing:.1em;color:#64748b;text-transform:uppercase}h1{font-size:25px;margin:3mm 0 1mm}header p{font-size:11px;color:#64748b;margin:0}header>b{font-size:24px;color:#cbd5e1}.hero{background:#172033;color:white;border-radius:18px;padding:12mm;margin-bottom:8mm}.hero span{font-size:11px;color:#cbd5e1}.hero strong{display:block;font-size:35px;margin:4mm 0}.hero p{font-size:11px;margin:0}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin-bottom:8mm}.metrics>div{border:1px solid #dbe3ee;border-radius:12px;padding:6mm}.metrics span{font-size:10px;color:#64748b}.metrics strong{display:block;font-size:20px;margin-top:3mm}.callout{background:#f5f7fa;border:1px solid #dbe3ee;border-radius:12px;padding:6mm;margin:5mm 0}.callout h2,.page>h2{font-size:14px;margin:0 0 3mm}.callout p{font-size:11px;line-height:1.7;margin:0}.rows{margin:3mm 0 8mm}.rows>div{display:grid;grid-template-columns:38mm 1fr 18mm 28mm;align-items:center;gap:3mm;margin:3mm 0;font-size:10px}.rows i{height:6px;background:#e8edf3;border-radius:999px;overflow:hidden}.rows em{display:block;height:100%;background:#2563eb}.rows strong,.rows small{text-align:right}.rows small{color:#64748b}.check-list,.warnings{display:grid;gap:4mm}.check-list article{display:grid;grid-template-columns:22mm 1fr;gap:5mm;border:1px solid #dbe3ee;border-radius:12px;padding:5mm}.check-list article>b{font-size:9px;text-transform:uppercase}.check-list h2,.warnings h2{font-size:14px;margin:0 0 2mm}.check-list p,.warnings p{font-size:11px;color:#64748b;margin:0}.warnings article{border-left:4px solid #d97706;background:#f8fafc;padding:5mm}.warnings article.high{border-color:#dc2626}.warnings span{font-size:9px;text-transform:uppercase;color:#64748b}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border-bottom:1px solid #dbe3ee;padding:3mm;text-align:left}th{color:#64748b}td:nth-child(3),td:nth-child(4),th:nth-child(3),th:nth-child(4){text-align:right}.limitations{font-size:12px;line-height:1.8;padding-left:6mm}.disclaimer{font-size:10px;color:#64748b;line-height:1.8;margin-top:10mm}.empty{color:#64748b;font-size:11px}footer{position:absolute;bottom:8mm;left:18mm;right:18mm;border-top:1px solid #e2e8f0;padding-top:3mm;color:#94a3b8;font-size:8px}.ok{border-color:#a7f3d0;background:#ecfdf5}
  </style></head><body>${pages.join("")}</body></html>`;
}

module.exports = { renderReport };
