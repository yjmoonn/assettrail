(function attachAssetTrailAnalysis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAssetTrailAnalysis() {
  "use strict";

  const SCHEMA_VERSION = "assettrail.analysis.v1";
  const TYPE_LABELS = {
    KRX: "국내 시장자산",
    US: "미국 시장자산",
    CASH: "현금",
    MANUAL: "수동평가 자산"
  };

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function round(value, digits = 6) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function normalizeTicker(type, ticker) {
    const normalized = String(ticker || "").trim().toUpperCase();
    return type === "KRX" ? normalized.padStart(6, "0") : normalized;
  }

  function priceEntry(priceBook, type, ticker) {
    const entry = priceBook?.prices?.[type]?.[normalizeTicker(type, ticker)];
    if (entry == null) return null;
    if (typeof entry === "number") return { close: entry };
    return entry;
  }

  function valueAsset(asset, priceBook) {
    const type = String(asset?.type || asset?.category || "MANUAL").toUpperCase();
    const explicitValue = Number(asset?.marketValue);
    if (Number.isFinite(explicitValue) && explicitValue >= 0) {
      return { value: explicitValue, priced: true, type, priceDate: asset?.priceDate || null };
    }
    if (type === "CASH" || type === "MANUAL") {
      const value = Math.max(0, finite(asset?.amount));
      return { value, priced: true, type, priceDate: asset?.updatedAt || null };
    }

    const entry = priceEntry(priceBook, type, asset?.ticker);
    const close = finite(entry?.close ?? entry?.price, NaN);
    const quantity = finite(asset?.quantity, NaN);
    const fxRate = type === "US"
      ? finite(priceBook?.fx?.USDKRW?.rate ?? priceBook?.fx?.USDKRW, NaN)
      : 1;
    const priced = Number.isFinite(close) && close > 0 && Number.isFinite(quantity) && quantity >= 0
      && Number.isFinite(fxRate) && fxRate > 0;
    return {
      value: priced ? close * quantity * fxRate : 0,
      priced,
      type,
      priceDate: entry?.date || entry?.asOf || priceBook?.generatedAt || null,
      kind: entry?.kind || null
    };
  }

  function groupRows(rows, keyFor, labelFor) {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = keyFor(row);
      const current = grouped.get(key) || { key, label: labelFor(row, key), value: 0, count: 0 };
      current.value += row.value;
      current.count += 1;
      grouped.set(key, current);
    });
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return [...grouped.values()]
      .map((item) => ({ ...item, value: round(item.value, 2), weight: total > 0 ? round(item.value / total) : 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function positionKey(row) {
    if (row.type === "KRX" || row.type === "US") return `${row.type}:${normalizeTicker(row.type, row.asset.ticker)}`;
    return `${row.type}:${String(row.asset.name || row.asset.id || "기타")}`;
  }

  function positionLabel(row) {
    return String(row.asset.name || row.asset.ticker || TYPE_LABELS[row.type] || "기타 자산");
  }

  function performanceFromSnapshots(snapshots) {
    const valid = safeArray(snapshots)
      .map((snapshot) => ({ createdAt: snapshot?.createdAt || snapshot?.date || null, total: finite(snapshot?.total, NaN) }))
      .filter((snapshot) => snapshot.createdAt && Number.isFinite(snapshot.total) && snapshot.total >= 0)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const unavailable = {
      status: "unavailable",
      reason: "외부 입출금 현금흐름이 원장에 분리되어 있지 않아 정확하게 계산할 수 없습니다."
    };
    if (valid.length < 2) {
      return {
        status: "insufficient_data",
        snapshotCount: valid.length,
        reason: "비교 가능한 조회 기록이 2회 이상 필요합니다.",
        twr: unavailable,
        xirr: unavailable,
        riskAdjusted: { status: "unavailable", reason: "수익률 시계열과 벤치마크가 필요합니다." }
      };
    }

    const first = valid[0];
    const last = valid.at(-1);
    const observedChange = last.total - first.total;
    const observedChangeRate = first.total > 0 ? observedChange / first.total : null;
    let peak = valid[0].total;
    let maxDrawdown = 0;
    const intervalChanges = [];
    valid.forEach((snapshot, index) => {
      peak = Math.max(peak, snapshot.total);
      if (peak > 0) maxDrawdown = Math.min(maxDrawdown, snapshot.total / peak - 1);
      if (index > 0 && valid[index - 1].total > 0) {
        intervalChanges.push(snapshot.total / valid[index - 1].total - 1);
      }
    });

    const mean = intervalChanges.length
      ? intervalChanges.reduce((sum, value) => sum + value, 0) / intervalChanges.length
      : null;
    const snapshotVolatility = intervalChanges.length > 1
      ? Math.sqrt(intervalChanges.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (intervalChanges.length - 1))
      : null;

    return {
      status: "partial",
      snapshotCount: valid.length,
      startAt: first.createdAt,
      endAt: last.createdAt,
      observedChange: round(observedChange, 2),
      observedChangeRate: round(observedChangeRate),
      maxObservedDrawdown: round(maxDrawdown),
      snapshotIntervalVolatility: round(snapshotVolatility),
      note: "입출금이 섞인 총자산 조회 기록의 변화이며 투자수익률로 해석하면 안 됩니다.",
      twr: unavailable,
      xirr: unavailable,
      riskAdjusted: { status: "unavailable", reason: "현금흐름 보정 수익률과 벤치마크 시계열이 필요합니다." }
    };
  }

  function warning(severity, code, title, detail, metric = null) {
    return { severity, code, title, detail, metric };
  }

  function buildWarnings(summary, concentration, exposures, quality) {
    const warnings = [];
    if (quality.marketPriceCoverage < 1) {
      warnings.push(warning(
        quality.marketPriceCoverage < 0.8 ? "high" : "medium",
        "UNPRICED_MARKET_ASSETS",
        "가격이 확인되지 않은 시장자산이 있습니다.",
        "총자산과 비중이 실제보다 작게 표시될 수 있으므로 티커와 가격표 기준일을 확인하세요.",
        quality.marketPriceCoverage
      ));
    }
    if (concentration.top1Weight >= 0.3) {
      warnings.push(warning("high", "TOP1_CONCENTRATION", "단일 경제적 노출이 큽니다.", "계좌가 달라도 같은 티커는 합산했습니다.", concentration.top1Weight));
    } else if (concentration.top1Weight >= 0.2) {
      warnings.push(warning("medium", "TOP1_CONCENTRATION", "상위 노출의 집중도를 확인하세요.", "단일 경제적 노출이 전체의 20%를 넘습니다.", concentration.top1Weight));
    }
    if (concentration.top5Weight >= 0.75 && concentration.positions.length > 5) {
      warnings.push(warning("medium", "TOP5_CONCENTRATION", "상위 5개 노출에 자산이 집중되어 있습니다.", "겉보기 종목 수보다 공통 위험요인이 클 수 있습니다.", concentration.top5Weight));
    }
    const manual = exposures.assetType.find((item) => item.key === "MANUAL");
    if (manual?.weight >= 0.25) {
      warnings.push(warning("medium", "MANUAL_VALUE_SHARE", "수동평가 자산 비중이 큽니다.", "평가 기준일과 환매 가능성·유동성을 함께 점검하세요.", manual.weight));
    }
    const usd = exposures.currency.find((item) => item.key === "USD");
    if (usd?.weight >= 0.5) {
      warnings.push(warning("medium", "USD_EXPOSURE", "달러 경제적 노출이 절반 이상입니다.", "원화 기준 성과는 기초자산과 환율 변화의 영향을 함께 받습니다.", usd.weight));
    }
    if (!summary.totalValue) {
      warnings.push(warning("high", "EMPTY_PORTFOLIO", "분석 가능한 평가금액이 없습니다.", "원장과 가격표를 확인한 뒤 다시 실행하세요."));
    }
    return warnings;
  }

  function analyzePortfolio(ledger, options = {}) {
    if (!ledger || typeof ledger !== "object") throw new TypeError("원장 JSON 객체가 필요합니다.");
    const assets = safeArray(ledger.assets);
    const priceBook = options.priceBook || ledger.priceBook || {};
    const rows = assets.map((asset) => ({ asset, ...valueAsset(asset, priceBook) }));
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const marketRows = rows.filter((row) => row.type === "KRX" || row.type === "US");
    const pricedMarketRows = marketRows.filter((row) => row.priced);
    const marketPriceCoverage = marketRows.length ? pricedMarketRows.length / marketRows.length : 1;

    const positions = groupRows(rows, positionKey, positionLabel);
    const top1Weight = positions[0]?.weight || 0;
    const top5Weight = positions.slice(0, 5).reduce((sum, item) => sum + item.weight, 0);
    const hhi = positions.reduce((sum, item) => sum + item.weight ** 2, 0);
    const etfRows = marketRows.filter((row) => String(row.kind || priceEntry(priceBook, row.type, row.asset.ticker)?.kind || "").toUpperCase().includes("ETF"));

    const exposures = {
      assetType: groupRows(rows, (row) => row.type, (row, key) => TYPE_LABELS[key] || key),
      region: groupRows(rows, (row) => row.type === "US" ? "OVERSEAS" : row.type === "KRX" ? "DOMESTIC" : "OTHER", (_row, key) => ({ DOMESTIC: "국내", OVERSEAS: "해외", OTHER: "현금·수동" }[key])),
      country: groupRows(rows, (row) => row.type === "US" ? "US_LISTED" : row.type === "KRX" ? "KR_LISTED" : "UNCLASSIFIED", (_row, key) => ({ US_LISTED: "미국 상장", KR_LISTED: "한국 상장", UNCLASSIFIED: "국가 미분류" }[key])),
      currency: groupRows(rows, (row) => row.type === "US" ? "USD" : "KRW", (_row, key) => key),
      account: groupRows(rows, (row) => String(row.asset.account || "계좌 미지정"), (_row, key) => key)
    };
    const concentration = {
      positions,
      top1Weight: round(top1Weight),
      top5Weight: round(top5Weight),
      hhi: round(hhi),
      effectivePositionCount: hhi > 0 ? round(1 / hhi, 2) : 0
    };
    const performance = performanceFromSnapshots(ledger.snapshots);
    const qualityChecks = [
      { code: "ASSETS_PRESENT", status: assets.length ? "pass" : "fail", detail: `${assets.length}개 원장 행` },
      { code: "MARKET_PRICE_COVERAGE", status: marketPriceCoverage === 1 ? "pass" : marketPriceCoverage >= 0.8 ? "warn" : "fail", detail: `${pricedMarketRows.length}/${marketRows.length}개 시장자산 가격 확인` },
      { code: "SNAPSHOT_HISTORY", status: safeArray(ledger.snapshots).length >= 2 ? "pass" : "warn", detail: `${safeArray(ledger.snapshots).length}회 조회 기록` },
      { code: "CASH_FLOW_LEDGER", status: "missing", detail: "외부 입출금 원장 없음" },
      { code: "ETF_LOOK_THROUGH", status: etfRows.length ? "missing" : "not_applicable", detail: etfRows.length ? `${etfRows.length}개 ETF 구성 데이터 없음` : "확인된 ETF 없음" },
      { code: "COUNTRY_CLASSIFICATION", status: "warn", detail: "상장시장 기준 대용치이며 실질 매출 국가와 다를 수 있음" },
      { code: "SECTOR_CLASSIFICATION", status: "missing", detail: "기업·ETF 섹터 분류 데이터 없음" },
      { code: "BENCHMARK_HISTORY", status: "missing", detail: "벤치마크 시계열 미설정" }
    ];
    const qualityScore = Math.round(
      (assets.length ? 25 : 0)
      + marketPriceCoverage * 35
      + (safeArray(ledger.snapshots).length >= 2 ? 20 : safeArray(ledger.snapshots).length ? 10 : 0)
      + (safeArray(ledger.snapshots).every((snapshot) => snapshot?.createdAt) ? 10 : 0)
    );
    const quality = {
      score: Math.min(100, qualityScore),
      level: qualityScore >= 80 ? "high" : qualityScore >= 55 ? "medium" : "low",
      marketPriceCoverage: round(marketPriceCoverage),
      checks: qualityChecks
    };
    const summary = {
      totalValue: round(totalValue, 2),
      pricedValue: round(rows.filter((row) => row.priced).reduce((sum, row) => sum + row.value, 0), 2),
      ledgerRowCount: assets.length,
      economicPositionCount: positions.length,
      marketAssetCount: marketRows.length,
      unpricedMarketAssetCount: marketRows.length - pricedMarketRows.length
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      id: options.id || null,
      createdAt: options.createdAt || new Date().toISOString(),
      source: {
        mode: options.sourceMode || "current-ledger",
        ledgerUpdatedAt: ledger.updatedAt || ledger.meta?.lastSavedAt || null,
        priceGeneratedAt: priceBook.generatedAt || null
      },
      summary,
      quality,
      exposures,
      concentration,
      performance,
      etfLookThrough: {
        status: etfRows.length ? "unavailable" : "not_applicable",
        identifiedEtfCount: etfRows.length,
        reason: etfRows.length ? "ETF 구성종목 데이터 공급원이 연결되지 않았습니다." : "가격표에서 ETF로 확인된 자산이 없습니다."
      },
      benchmark: { status: "unavailable", reason: "파일럿에는 벤치마크 가격 시계열이 아직 연결되지 않았습니다." },
      warnings: buildWarnings(summary, concentration, exposures, quality),
      limitations: [
        "이 결과는 공통 규칙 기반 진단이며 매수·매도 지시가 아닙니다.",
        "현금흐름 원장이 없어 TWR·XIRR과 위험조정 성과는 계산하지 않습니다.",
        "ETF 구성 데이터가 없으면 ETF 투시 분석을 제공하지 않습니다.",
        "국가 노출은 상장시장 대용치이며 기업의 매출 지역을 뜻하지 않습니다. 섹터 분류는 데이터 연결 전까지 제공하지 않습니다.",
        "수동평가 자산은 사용자가 입력한 금액과 기준일에 의존합니다."
      ]
    };
  }

  return { SCHEMA_VERSION, analyzePortfolio };
});
