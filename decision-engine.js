(function attachAssetTrailDecisionEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailDecisionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDecisionEngine() {
  "use strict";

  const MARKET_TYPES = new Set(["KRX", "US"]);
  const INVESTMENT_ROLES = new Set([
    "CORE",
    "STRUCTURAL_GROWTH",
    "CYCLE",
    "TACTICAL",
    "SURVIVAL"
  ]);
  const REVIEW_BUCKETS = ["overdue", "dueToday", "upcoming", "unscheduled", "invalid"];

  function normalizedText(value) {
    return String(value ?? "").trim();
  }

  function normalizedType(value) {
    return normalizedText(value).toUpperCase() || "UNKNOWN";
  }

  function normalizedTicker(type, value) {
    const ticker = normalizedText(value).toUpperCase();
    if (type === "KRX" && /^\d+$/.test(ticker)) return ticker.padStart(6, "0");
    return ticker;
  }

  function normalizedRole(value) {
    const role = normalizedText(value).toUpperCase();
    return INVESTMENT_ROLES.has(role) ? role : "";
  }

  function validDateKey(value) {
    const key = normalizedText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function currentUtcDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function economicPositionKey(row) {
    const type = normalizedType(row?.type);
    const ticker = normalizedTicker(type, row?.ticker);
    if (MARKET_TYPES.has(type) && ticker) return `${type}:${ticker}`;
    const id = normalizedText(row?.id) || "UNIDENTIFIED";
    return `ASSET:${type}:${id}`;
  }

  function reviewTiming(item, options = {}) {
    const rawDate = normalizedText(item?.nextReviewAt);
    if (!rawDate) return "unscheduled";
    const nextReviewAt = validDateKey(rawDate);
    if (!nextReviewAt) return "invalid";
    const todayKey = validDateKey(options.todayKey) || currentUtcDateKey();
    if (nextReviewAt < todayKey) return "overdue";
    if (nextReviewAt === todayKey) return "dueToday";
    return "upcoming";
  }

  function round(value, digits = 6) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function positionSort(left, right) {
    return right.value - left.value || compareText(left.key, right.key);
  }

  function reviewSort(left, right) {
    return compareText(left.nextReviewAt, right.nextReviewAt)
      || compareText(left.name, right.name)
      || compareText(left.id, right.id);
  }

  function warning(code, severity, title, detail) {
    return { code, severity, title, detail };
  }

  function analyzeDecisionPortfolio(inputRows, options = {}) {
    const rows = Array.isArray(inputRows) ? inputRows : [];
    const todayKey = validDateKey(options.todayKey) || currentUtcDateKey();
    const grouped = new Map();
    const reviews = Object.fromEntries(REVIEW_BUCKETS.map((bucket) => [bucket, []]));
    let rawTotalValue = 0;
    let valuedRowCount = 0;
    let roleAssignedCount = 0;
    let thesisCount = 0;
    let reviewScheduledCount = 0;
    let completeDecisionCount = 0;
    let invalidRoleCount = 0;

    rows.forEach((source, index) => {
      const row = source && typeof source === "object" ? source : {};
      const type = normalizedType(row.type);
      const ticker = normalizedTicker(type, row.ticker);
      const id = normalizedText(row.id);
      const name = normalizedText(row.name);
      const numericValue = Number(row.value);
      const finiteValue = Number.isFinite(numericValue) && numericValue >= 0;
      const hasValue = row.hasValue === undefined
        ? finiteValue
        : row.hasValue === true && finiteValue;
      const value = hasValue ? numericValue : 0;
      const role = normalizedRole(row.investmentRole);
      const hasRole = Boolean(role);
      const rawRole = normalizedText(row.investmentRole);
      const hasThesis = Boolean(normalizedText(row.thesis));
      const timing = reviewTiming(row, { todayKey });
      const hasReviewSchedule = !["unscheduled", "invalid"].includes(timing);

      rawTotalValue += value;
      if (hasValue) valuedRowCount += 1;
      if (hasRole) roleAssignedCount += 1;
      else if (rawRole) invalidRoleCount += 1;
      if (hasThesis) thesisCount += 1;
      if (hasReviewSchedule) reviewScheduledCount += 1;
      if (hasRole && hasThesis && hasReviewSchedule) completeDecisionCount += 1;

      const baseKey = economicPositionKey(row);
      const key = !id && baseKey.endsWith(":UNIDENTIFIED") ? `${baseKey}:${index}` : baseKey;
      const current = grouped.get(key) || {
        key,
        type,
        ticker: MARKET_TYPES.has(type) ? ticker : "",
        rawValue: 0,
        assetIds: new Set(),
        accounts: new Set(),
        names: new Set()
      };
      current.rawValue += value;
      if (id) current.assetIds.add(id);
      const account = normalizedText(row.account);
      if (account) current.accounts.add(account);
      if (name) current.names.add(name);
      grouped.set(key, current);

      reviews[timing].push({
        id,
        name,
        type,
        ticker,
        nextReviewAt: normalizedText(row.nextReviewAt),
        reviewStatus: normalizedText(row.reviewStatus).toUpperCase(),
        timing
      });
    });

    const positions = [...grouped.values()]
      .map((position) => {
        const names = [...position.names].sort(compareText);
        const assetIds = [...position.assetIds].sort(compareText);
        const accounts = [...position.accounts].sort(compareText);
        const result = {
          key: position.key,
          name: names[0] || position.ticker || position.key,
          type: position.type,
          ticker: position.ticker,
          value: round(position.rawValue, 2),
          weight: rawTotalValue > 0 ? round(position.rawValue / rawTotalValue) : 0,
          assetIds
        };
        if (accounts.length) result.accounts = accounts;
        return result;
      })
      .sort(positionSort);

    REVIEW_BUCKETS.forEach((bucket) => reviews[bucket].sort(reviewSort));

    const rawWeights = [...grouped.values()]
      .map((position) => rawTotalValue > 0 ? position.rawValue / rawTotalValue : 0)
      .sort((left, right) => right - left);
    const rawTop1Weight = rawWeights[0] || 0;
    const rawTop5Weight = rawWeights.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const rawHhi = rawWeights.reduce((sum, value) => sum + value ** 2, 0);
    const economicPositionCount = positions.length;
    const ledgerRowCount = rows.length;
    const missingValueCount = ledgerRowCount - valuedRowCount;
    const unscheduledCount = reviews.unscheduled.length;
    const invalidReviewCount = reviews.invalid.length;
    const warnings = [];

    if (!ledgerRowCount) {
      warnings.push(warning(
        "EMPTY_PORTFOLIO",
        "high",
        "분석할 자산이 없습니다.",
        "등록된 자산 행이 없어 집중도와 의사결정 데이터 품질을 계산할 수 없습니다."
      ));
    }
    if (missingValueCount) {
      const coverage = ledgerRowCount ? valuedRowCount / ledgerRowCount : 0;
      warnings.push(warning(
        "MISSING_VALUES",
        coverage < 0.8 ? "high" : "medium",
        "평가금액이 확인되지 않은 자산이 있습니다.",
        `${missingValueCount}개 자산의 평가금액이 없어 총액과 집중도가 실제와 다를 수 있습니다.`
      ));
    }
    if (roleAssignedCount < ledgerRowCount) {
      warnings.push(warning(
        "MISSING_INVESTMENT_ROLES",
        "low",
        "투자 역할이 지정되지 않은 자산이 있습니다.",
        `${ledgerRowCount - roleAssignedCount}개 자산의 역할이 비어 있거나 지원 범위를 벗어났습니다.`
      ));
    }
    if (invalidRoleCount) {
      warnings.push(warning(
        "INVALID_INVESTMENT_ROLES",
        "medium",
        "지원하지 않는 투자 역할이 있습니다.",
        `${invalidRoleCount}개 자산의 역할 값을 확인해야 합니다.`
      ));
    }
    if (thesisCount < ledgerRowCount) {
      warnings.push(warning(
        "MISSING_THESES",
        "low",
        "투자 가설이 비어 있는 자산이 있습니다.",
        `${ledgerRowCount - thesisCount}개 자산에 투자 가설이 기록되지 않았습니다.`
      ));
    }
    if (unscheduledCount) {
      warnings.push(warning(
        "UNSCHEDULED_REVIEWS",
        "low",
        "다음 검토일이 없는 자산이 있습니다.",
        `${unscheduledCount}개 자산의 다음 검토일이 지정되지 않았습니다.`
      ));
    }
    if (invalidReviewCount) {
      warnings.push(warning(
        "INVALID_REVIEW_DATES",
        "medium",
        "올바르지 않은 검토일이 있습니다.",
        `${invalidReviewCount}개 자산의 다음 검토일 형식을 확인해야 합니다.`
      ));
    }
    if (rawTop1Weight >= 0.3) {
      warnings.push(warning(
        "TOP1_CONCENTRATION",
        "high",
        "단일 경제적 포지션의 비중이 큽니다.",
        "계좌가 달라도 같은 시장과 티커는 하나의 경제적 포지션으로 합산했습니다."
      ));
    } else if (rawTop1Weight >= 0.2) {
      warnings.push(warning(
        "TOP1_CONCENTRATION",
        "medium",
        "상위 경제적 포지션의 비중을 확인하세요.",
        "단일 경제적 포지션이 전체 평가금액의 20% 이상입니다."
      ));
    }
    if (economicPositionCount > 5 && rawTop5Weight >= 0.75) {
      warnings.push(warning(
        "TOP5_CONCENTRATION",
        "medium",
        "상위 5개 경제적 포지션의 비중이 큽니다.",
        "상위 5개 포지션이 확인된 전체 평가금액의 75% 이상입니다."
      ));
    }

    return {
      totalValue: round(rawTotalValue, 2),
      ledgerRowCount,
      economicPositionCount,
      top1Weight: round(rawTop1Weight),
      top5Weight: round(rawTop5Weight),
      hhi: round(rawHhi),
      effectivePositionCount: rawHhi > 0 ? round(1 / rawHhi, 2) : 0,
      positions,
      reviews,
      quality: {
        valuedRowCount,
        missingValueCount,
        roleAssignedCount,
        thesisCount,
        reviewScheduledCount,
        completeDecisionCount
      },
      warnings
    };
  }

  return {
    analyzeDecisionPortfolio,
    economicPositionKey,
    reviewTiming
  };
});
