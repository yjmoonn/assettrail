(function attachAssetTrailActionEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailActionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createActionEngine() {
  "use strict";

  const BUCKET_KEYS = ["domestic", "overseas", "cash", "manual"];
  const MARKET_TYPES = new Set(["KRX", "US"]);
  const VALID_MODES = new Set(["ONE_TIME", "MONTHLY"]);
  const VALID_ROLES = new Set([
    "CORE",
    "STRUCTURAL_GROWTH",
    "CYCLE",
    "TACTICAL",
    "SURVIVAL"
  ]);
  const SATELLITE_ROLES = new Set(["STRUCTURAL_GROWTH", "CYCLE", "TACTICAL"]);
  const RISK_DIMENSIONS = [
    "industry",
    "country",
    "currency",
    "rate",
    "duration",
    "customer",
    "aiValueChain"
  ];
  const EPSILON = 1e-8;
  const TARGET_TOTAL_TOLERANCE = 0.01;
  const DAY_MS = 24 * 60 * 60 * 1000;

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
    return VALID_ROLES.has(role) ? role : "";
  }

  function compareText(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function round(value, digits = 8) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function validDateKey(value) {
    const key = normalizedText(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
    const parsed = new Date(`${key}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : "";
  }

  function currentUtcDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function failPlan(code, message, details = {}) {
    return {
      ok: false,
      code,
      message,
      allocations: [],
      totalAllocated: 0,
      ...details
    };
  }

  function normalizeBucketInput(input) {
    if (Array.isArray(input)) {
      const source = new Map();
      for (const entry of input) {
        const key = normalizedText(entry?.key).toLowerCase();
        if (!BUCKET_KEYS.includes(key) || source.has(key)) return null;
        source.set(key, entry);
      }
      if (source.size !== BUCKET_KEYS.length) return null;
      return BUCKET_KEYS.map((key) => ({ key, source: source.get(key) }));
    }

    if (!input || typeof input !== "object") return null;
    const keys = Object.keys(input);
    if (keys.length !== BUCKET_KEYS.length || keys.some((key) => !BUCKET_KEYS.includes(key))) return null;
    return BUCKET_KEYS.map((key) => ({ key, source: input[key] }));
  }

  function validateBuckets(input) {
    const bucketSources = normalizeBucketInput(input);
    if (!bucketSources) {
      return failPlan(
        "INVALID_BUCKETS",
        "domestic, overseas, cash, manual 네 자산군을 중복 없이 모두 입력해야 합니다."
      );
    }

    const buckets = [];
    for (const { key, source } of bucketSources) {
      if (!source || typeof source !== "object") {
        return failPlan("INVALID_BUCKET", `${key} 자산군 정보가 객체가 아닙니다.`, { bucketKey: key });
      }
      const currentValue = Number(source.currentValue);
      const minPct = Number(source.minPct);
      const targetPct = Number(source.targetPct);
      const maxPct = Number(source.maxPct);
      const reviewRequiredCount = source.reviewRequiredCount === undefined
        ? 0
        : Number(source.reviewRequiredCount);
      const positionCount = source.positionCount === undefined ? 0 : Number(source.positionCount);

      if (!Number.isFinite(currentValue) || currentValue < 0) {
        return failPlan("INVALID_CURRENT_VALUE", `${key} 현재 금액은 0 이상의 유한한 숫자여야 합니다.`, { bucketKey: key });
      }
      if (![minPct, targetPct, maxPct].every((value) => Number.isFinite(value))) {
        return failPlan("INVALID_BAND", `${key} 최소·목표·최대 비중을 모두 숫자로 입력해야 합니다.`, { bucketKey: key });
      }
      if (minPct < 0 || minPct > targetPct || targetPct > maxPct || maxPct > 100) {
        return failPlan(
          "INVALID_BAND",
          `${key} 비중은 0% 이상이며 최소 ≤ 목표 ≤ 최대 ≤ 100 조건을 만족해야 합니다.`,
          { bucketKey: key }
        );
      }
      if (!Number.isSafeInteger(reviewRequiredCount) || reviewRequiredCount < 0) {
        return failPlan("INVALID_REVIEW_COUNT", `${key} 검토 필요 개수는 0 이상의 정수여야 합니다.`, { bucketKey: key });
      }
      if (!Number.isSafeInteger(positionCount) || positionCount < 0) {
        return failPlan("INVALID_POSITION_COUNT", `${key} 포지션 개수는 0 이상의 정수여야 합니다.`, { bucketKey: key });
      }

      buckets.push({
        key,
        currentValue,
        minPct,
        targetPct,
        maxPct,
        reviewRequiredCount,
        positionCount
      });
    }

    const minTotal = buckets.reduce((sum, bucket) => sum + bucket.minPct, 0);
    const targetTotal = buckets.reduce((sum, bucket) => sum + bucket.targetPct, 0);
    const maxTotal = buckets.reduce((sum, bucket) => sum + bucket.maxPct, 0);
    if (Math.abs(targetTotal - 100) > TARGET_TOTAL_TOLERANCE) {
      return failPlan("INVALID_TARGET_TOTAL", `목표 비중 합계는 100%여야 합니다. 현재 ${round(targetTotal, 6)}%입니다.`);
    }
    if (minTotal > 100 + EPSILON) {
      return failPlan("INVALID_MIN_TOTAL", `최소 비중 합계는 100% 이하여야 합니다. 현재 ${round(minTotal, 6)}%입니다.`);
    }
    if (maxTotal < 100 - EPSILON) {
      return failPlan("INVALID_MAX_TOTAL", `최대 비중 합계는 100% 이상이어야 합니다. 현재 ${round(maxTotal, 6)}%입니다.`);
    }

    return { ok: true, buckets };
  }

  function proportionalIntegerDistribution(totalUnits, entries) {
    const result = new Map(entries.map((entry) => [entry.key, 0]));
    if (!Number.isSafeInteger(totalUnits) || totalUnits <= 0) return result;

    const working = entries
      .map((entry) => ({
        key: entry.key,
        weight: Math.max(0, Number(entry.weight) || 0),
        capacity: Math.max(0, Math.floor(Number(entry.capacity) || 0)),
        continuous: 0
      }))
      .filter((entry) => entry.weight > 0 && entry.capacity > 0)
      .sort((left, right) => compareText(left.key, right.key));

    let remaining = totalUnits;
    let active = working.slice();
    while (remaining > EPSILON && active.length) {
      const weightTotal = active.reduce((sum, entry) => sum + entry.weight, 0);
      if (!(weightTotal > 0)) break;
      const saturated = active.filter((entry) => {
        const desired = remaining * entry.weight / weightTotal;
        return desired >= entry.capacity - entry.continuous - EPSILON;
      });
      if (!saturated.length) {
        active.forEach((entry) => {
          entry.continuous += remaining * entry.weight / weightTotal;
        });
        remaining = 0;
        break;
      }
      saturated.forEach((entry) => {
        const addition = entry.capacity - entry.continuous;
        entry.continuous = entry.capacity;
        remaining -= addition;
      });
      const saturatedKeys = new Set(saturated.map((entry) => entry.key));
      active = active.filter((entry) => !saturatedKeys.has(entry.key));
    }

    working.forEach((entry) => result.set(entry.key, Math.floor(entry.continuous + EPSILON)));
    let integerRemainder = totalUnits - [...result.values()].reduce((sum, value) => sum + value, 0);
    const remainderOrder = working
      .map((entry) => ({
        ...entry,
        remainder: entry.continuous - Math.floor(entry.continuous + EPSILON)
      }))
      .sort((left, right) => right.remainder - left.remainder || compareText(left.key, right.key));

    while (integerRemainder > 0) {
      let progressed = false;
      for (const entry of remainderOrder) {
        if (integerRemainder <= 0) break;
        const allocated = result.get(entry.key) || 0;
        if (allocated >= entry.capacity) continue;
        result.set(entry.key, allocated + 1);
        integerRemainder -= 1;
        progressed = true;
      }
      if (!progressed) break;
    }
    return result;
  }

  function planContribution(input = {}) {
    const mode = normalizedText(input.mode).toUpperCase();
    if (!VALID_MODES.has(mode)) {
      return failPlan("INVALID_MODE", "신규자금 유형은 ONE_TIME 또는 MONTHLY여야 합니다.");
    }
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return failPlan("INVALID_AMOUNT", "신규자금은 1원 이상의 정수로 입력해야 합니다.", { mode });
    }

    const validated = validateBuckets(input.buckets);
    if (!validated.ok) return { ...validated, mode, amount };
    const buckets = validated.buckets;
    const currentTotal = buckets.reduce((sum, bucket) => sum + bucket.currentValue, 0);
    const projectedTotal = currentTotal + amount;
    if (!Number.isFinite(projectedTotal) || projectedTotal <= 0) {
      return failPlan("INVALID_TOTAL", "배분 후 총자산을 계산할 수 없습니다.", { mode, amount });
    }

    const constraints = buckets.map((bucket) => {
      const rawMinimum = projectedTotal * bucket.minPct / 100 - bucket.currentValue;
      const rawTarget = projectedTotal * bucket.targetPct / 100 - bucket.currentValue;
      const rawMaximum = projectedTotal * bucket.maxPct / 100 - bucket.currentValue;
      return {
        ...bucket,
        minimumUnits: Math.max(0, Math.ceil(rawMinimum - EPSILON)),
        targetDeficit: Math.max(0, rawTarget),
        maximumUnits: Math.floor(rawMaximum + EPSILON),
        rawMaximum
      };
    });

    const currentMaxBreaches = constraints
      .filter((bucket) => bucket.rawMaximum < -EPSILON)
      .map((bucket) => bucket.key);
    if (currentMaxBreaches.length) {
      return failPlan(
        "CURRENT_MAX_UNREACHABLE",
        `매도 없이 신규자금만으로 최대 비중을 맞출 수 없는 자산군이 있습니다: ${currentMaxBreaches.join(", ")}.`,
        { mode, amount, currentTotal, projectedTotal, bucketKeys: currentMaxBreaches }
      );
    }

    const minimumRequired = constraints.reduce((sum, bucket) => sum + bucket.minimumUnits, 0);
    if (minimumRequired > amount) {
      const bucketKeys = constraints.filter((bucket) => bucket.minimumUnits > 0).map((bucket) => bucket.key);
      return failPlan(
        "MINIMUMS_UNREACHABLE",
        `최소 비중 충족에 ${minimumRequired}원이 필요해 신규자금 ${amount}원을 초과합니다.`,
        { mode, amount, currentTotal, projectedTotal, minimumRequired, bucketKeys }
      );
    }

    const maximumCapacity = constraints.reduce((sum, bucket) => sum + Math.max(0, bucket.maximumUnits), 0);
    if (maximumCapacity < amount) {
      return failPlan(
        "MAXIMUMS_UNREACHABLE",
        `원 단위 최대 비중 여유는 ${maximumCapacity}원으로 신규자금 ${amount}원을 모두 배분할 수 없습니다.`,
        { mode, amount, currentTotal, projectedTotal, maximumCapacity }
      );
    }

    const allocated = new Map(constraints.map((bucket) => [bucket.key, bucket.minimumUnits]));
    const phases = new Map(constraints.map((bucket) => [bucket.key, {
      minimum: bucket.minimumUnits,
      target: 0,
      maximum: 0
    }]));
    let remaining = amount - minimumRequired;

    const targetEntries = constraints.map((bucket) => {
      const currentAllocation = allocated.get(bucket.key) || 0;
      const capacity = Math.max(0, Math.min(
        bucket.maximumUnits - currentAllocation,
        Math.floor(bucket.targetDeficit - currentAllocation + EPSILON)
      ));
      return { key: bucket.key, weight: Math.max(0, bucket.targetDeficit - currentAllocation), capacity };
    });
    const targetCapacity = targetEntries.reduce((sum, entry) => sum + entry.capacity, 0);
    const targetPhaseAmount = Math.min(remaining, targetCapacity);
    const targetDistribution = proportionalIntegerDistribution(targetPhaseAmount, targetEntries);
    constraints.forEach((bucket) => {
      const addition = targetDistribution.get(bucket.key) || 0;
      allocated.set(bucket.key, (allocated.get(bucket.key) || 0) + addition);
      phases.get(bucket.key).target = addition;
    });
    remaining -= targetPhaseAmount;

    if (remaining > 0) {
      const maximumEntries = constraints.map((bucket) => {
        const capacity = Math.max(0, bucket.maximumUnits - (allocated.get(bucket.key) || 0));
        return { key: bucket.key, weight: capacity, capacity };
      });
      const maximumDistribution = proportionalIntegerDistribution(remaining, maximumEntries);
      let distributed = 0;
      constraints.forEach((bucket) => {
        const addition = maximumDistribution.get(bucket.key) || 0;
        allocated.set(bucket.key, (allocated.get(bucket.key) || 0) + addition);
        phases.get(bucket.key).maximum = addition;
        distributed += addition;
      });
      if (distributed !== remaining) {
        return failPlan(
          "MAXIMUMS_UNREACHABLE",
          "최대 비중 제약 안에서 신규자금을 원 단위로 모두 배분할 수 없습니다.",
          { mode, amount, currentTotal, projectedTotal, maximumCapacity }
        );
      }
      remaining = 0;
    }

    const allocations = constraints.map((bucket) => {
      const contribution = allocated.get(bucket.key) || 0;
      const projectedValue = bucket.currentValue + contribution;
      const phase = phases.get(bucket.key);
      const reasons = [];
      if (phase.minimum > 0) reasons.push("최소 비중 충족");
      if (phase.target > 0) reasons.push("목표 비중 부족");
      if (phase.maximum > 0) reasons.push("목표 충족 후 최대 비중 내 여유");
      if (!reasons.length) reasons.push("목표 이상 또는 배분 여유 없음");
      if (bucket.reviewRequiredCount > 0) reasons.push(`검토 필요 포지션 ${bucket.reviewRequiredCount}개`);
      return {
        key: bucket.key,
        currentValue: bucket.currentValue,
        currentWeight: currentTotal > 0 ? round(bucket.currentValue / currentTotal) : 0,
        minPct: bucket.minPct,
        targetPct: bucket.targetPct,
        maxPct: bucket.maxPct,
        amount: contribution,
        projectedValue: round(projectedValue, 8),
        projectedWeight: round(projectedValue / projectedTotal),
        positionCount: bucket.positionCount,
        reviewRequiredCount: bucket.reviewRequiredCount,
        reviewRequired: bucket.reviewRequiredCount > 0,
        reasons
      };
    });
    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const maxExceeded = constraints.some((bucket) => {
      const projectedWeightPct = (bucket.currentValue + (allocated.get(bucket.key) || 0)) / projectedTotal * 100;
      return projectedWeightPct > bucket.maxPct + EPSILON;
    });
    const minMissed = constraints.some((bucket) => {
      const projectedWeightPct = (bucket.currentValue + (allocated.get(bucket.key) || 0)) / projectedTotal * 100;
      return projectedWeightPct < bucket.minPct - EPSILON;
    });
    if (totalAllocated !== amount || maxExceeded || minMissed) {
      return failPlan(
        "ALLOCATION_INVARIANT_FAILED",
        "배분 결과가 총액 또는 최소·최대 비중 제약을 만족하지 않아 제안을 만들지 않았습니다.",
        { mode, amount, currentTotal, projectedTotal }
      );
    }

    const reviewBucketKeys = allocations.filter((allocation) => allocation.reviewRequired).map((allocation) => allocation.key);
    return {
      ok: true,
      code: "OK",
      mode,
      amount,
      currentTotal: round(currentTotal, 8),
      projectedTotal: round(projectedTotal, 8),
      totalAllocated,
      allocations,
      warnings: reviewBucketKeys.length
        ? [{
            code: "REVIEW_REQUIRED",
            bucketKeys: reviewBucketKeys,
            message: `배분 대상을 정하기 전에 검토가 필요한 자산군이 있습니다: ${reviewBucketKeys.join(", ")}.`
          }]
        : []
    };
  }

  function economicPositionKey(row) {
    const type = normalizedType(row?.type);
    const ticker = normalizedTicker(type, row?.ticker);
    if (MARKET_TYPES.has(type) && ticker) return `${type}:${ticker}`;
    const id = normalizedText(row?.id) || "UNIDENTIFIED";
    return `ASSET:${type}:${id}`;
  }

  function normalizedDimension(value) {
    const compact = normalizedText(value).replace(/[\s_-]+/g, "").toLowerCase();
    return ({
      industry: "industry",
      country: "country",
      currency: "currency",
      rate: "rate",
      duration: "duration",
      customer: "customer",
      aivaluechain: "aiValueChain"
    })[compact] || "";
  }

  function normalizedTagValue(value) {
    const source = value && typeof value === "object"
      ? value.label ?? value.value ?? value.key
      : value;
    return normalizedText(source).normalize("NFKC").replace(/\s+/g, " ").slice(0, 500);
  }

  function tagIdentity(value) {
    return normalizedTagValue(value).toLocaleUpperCase("en-US");
  }

  function emptyRiskTags() {
    return Object.fromEntries(RISK_DIMENSIONS.map((dimension) => [dimension, new Map()]));
  }

  function addRiskTag(target, dimensionValue, rawValue) {
    const dimension = normalizedDimension(dimensionValue);
    const label = normalizedTagValue(rawValue);
    if (!dimension || !label) return;
    const key = tagIdentity(label);
    const previous = target[dimension].get(key);
    if (!previous || compareText(label, previous) < 0) target[dimension].set(key, label);
  }

  function riskTagsFromRow(row) {
    const result = emptyRiskTags();
    const source = row?.riskTags;
    if (Array.isArray(source)) {
      source.forEach((tag) => {
        if (!tag || typeof tag !== "object") return;
        const values = Array.isArray(tag.values) ? tag.values : [tag.value ?? tag.label ?? tag.key];
        values.forEach((value) => addRiskTag(result, tag.dimension ?? tag.category, value));
      });
      return result;
    }
    if (!source || typeof source !== "object") return result;
    Object.entries(source).forEach(([rawDimension, rawValues]) => {
      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      values.forEach((value) => addRiskTag(result, rawDimension, value));
    });
    return result;
  }

  function mergeRiskTags(target, source) {
    RISK_DIMENSIONS.forEach((dimension) => {
      source[dimension].forEach((label, key) => {
        const previous = target[dimension].get(key);
        if (!previous || compareText(label, previous) < 0) target[dimension].set(key, label);
      });
    });
  }

  function riskTagsSignature(row) {
    const tags = riskTagsFromRow(row);
    return RISK_DIMENSIONS.map((dimension) => [
      dimension,
      [...tags[dimension].keys()].sort(compareText)
    ]);
  }

  function rowSortKey(row) {
    const type = normalizedType(row?.type);
    return JSON.stringify([
      economicPositionKey(row),
      normalizedText(row?.id),
      normalizedTicker(type, row?.ticker),
      normalizedText(row?.name),
      normalizedText(row?.account),
      Number.isFinite(Number(row?.value)) ? Number(row.value) : null,
      row?.hasValue === false ? 0 : 1,
      normalizedText(row?.investmentRole).toUpperCase(),
      normalizedText(row?.reviewStatus).toUpperCase(),
      normalizedText(row?.riskTagsReviewedAt || row?.lastReviewedAt),
      normalizedText(row?.nextReviewAt),
      riskTagsSignature(row)
    ]);
  }

  function reviewReasons(row, todayKey, staleDays) {
    const reasons = [];
    const status = normalizedText(row?.reviewStatus).toUpperCase();
    if (status === "REVIEW") reasons.push("STATUS_REVIEW");
    if (status === "INVALIDATED") reasons.push("STATUS_INVALIDATED");
    if (Number(row?.migrationConflictCount || 0) > 0) reasons.push("MIGRATION_CONFLICT");

    const rawNextReviewAt = normalizedText(row?.nextReviewAt);
    const nextReviewAt = validDateKey(rawNextReviewAt);
    if (rawNextReviewAt && !nextReviewAt) reasons.push("INVALID_NEXT_REVIEW");
    else if (nextReviewAt && nextReviewAt < todayKey) reasons.push("OVERDUE_REVIEW");
    else if (nextReviewAt === todayKey) reasons.push("DUE_REVIEW");

    const rawReviewedAt = normalizedText(row?.riskTagsReviewedAt || row?.lastReviewedAt);
    const reviewedAt = validDateKey(rawReviewedAt);
    if (!rawReviewedAt) {
      reasons.push("NEVER_REVIEWED");
    } else if (!reviewedAt) {
      reasons.push("INVALID_REVIEW_DATE");
    } else {
      const ageDays = (Date.parse(`${todayKey}T00:00:00.000Z`) - Date.parse(`${reviewedAt}T00:00:00.000Z`)) / DAY_MS;
      if (ageDays > staleDays) reasons.push("STALE_REVIEW");
    }
    return reasons;
  }

  function warning(code, message, extra = {}) {
    return { code, message, ...extra };
  }

  function budgetInput(source, key) {
    const raw = source?.[key];
    if (raw === undefined || raw === null || raw === "") return { value: null, invalid: false };
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) return { value: null, invalid: true };
    return { value, invalid: false };
  }

  function analyzeRiskExposure(inputRows, riskBudgets = {}, options = {}) {
    const rows = Array.isArray(inputRows) ? inputRows : [];
    const todayKey = validDateKey(options.todayKey) || currentUtcDateKey();
    const staleDaysValue = Number(options.staleDays ?? options.staleAfterDays);
    const staleDays = Number.isSafeInteger(staleDaysValue) && staleDaysValue >= 0 ? staleDaysValue : 180;
    const grouped = new Map();

    rows
      .map((source) => source && typeof source === "object" ? source : {})
      .sort((left, right) => compareText(rowSortKey(left), rowSortKey(right)))
      .forEach((source, index) => {
        const row = source && typeof source === "object" ? source : {};
        const baseKey = economicPositionKey(row);
        const key = baseKey.endsWith(":UNIDENTIFIED") ? `${baseKey}:${index}` : baseKey;
        const type = normalizedType(row.type);
        const ticker = normalizedTicker(type, row.ticker);
        const numericValue = Number(row.value);
        const validValue = Number.isFinite(numericValue) && numericValue >= 0
          && (row.hasValue === undefined || row.hasValue === true);
        const value = validValue ? numericValue : 0;
        const current = grouped.get(key) || {
          key,
          type,
          ticker: MARKET_TYPES.has(type) ? ticker : "",
          rawValue: 0,
          hasMissingValue: false,
          assetIds: new Set(),
          accounts: new Set(),
          names: new Set(),
          roles: new Set(),
          rawRoles: new Set(),
          riskTags: emptyRiskTags(),
          reviewReasons: new Set()
        };
        current.rawValue += value;
        if (!validValue) current.hasMissingValue = true;
        const id = normalizedText(row.id);
        const account = normalizedText(row.account);
        const name = normalizedText(row.name);
        if (id) current.assetIds.add(id);
        if (account) current.accounts.add(account);
        if (name) current.names.add(name);
        const role = normalizedRole(row.investmentRole);
        const rawRole = normalizedText(row.investmentRole).toUpperCase();
        if (role) current.roles.add(role);
        if (rawRole) current.rawRoles.add(rawRole);
        mergeRiskTags(current.riskTags, riskTagsFromRow(row));
        reviewReasons(row, todayKey, staleDays).forEach((reason) => current.reviewReasons.add(reason));
        grouped.set(key, current);
      });

    const totalValue = [...grouped.values()].reduce((sum, position) => sum + position.rawValue, 0);
    const positions = [...grouped.values()]
      .map((position) => {
        const riskTags = Object.fromEntries(RISK_DIMENSIONS.map((dimension) => [
          dimension,
          [...position.riskTags[dimension].entries()]
            .sort((left, right) => compareText(left[0], right[0]))
            .map(([, label]) => label)
        ]));
        const roles = [...position.roles].sort(compareText);
        const names = [...position.names].sort(compareText);
        return {
          key: position.key,
          type: position.type,
          ticker: position.ticker,
          name: names[0] || position.ticker || position.key,
          value: round(position.rawValue, 8),
          weight: totalValue > 0 ? round(position.rawValue / totalValue) : 0,
          assetIds: [...position.assetIds].sort(compareText),
          accounts: [...position.accounts].sort(compareText),
          investmentRoles: roles,
          riskTags,
          reviewRequired: position.reviewReasons.size > 0,
          reviewReasons: [...position.reviewReasons].sort(compareText),
          hasMissingValue: position.hasMissingValue,
          hasMissingRole: roles.length === 0,
          hasInconsistentRoles: roles.length > 1 || [...position.rawRoles].some((role) => !VALID_ROLES.has(role)),
          isUntagged: RISK_DIMENSIONS.every((dimension) => riskTags[dimension].length === 0)
        };
      })
      .sort((left, right) => compareText(left.key, right.key));

    const tagMap = new Map();
    const nonAdditiveByDimension = new Map();
    positions.forEach((position) => {
      RISK_DIMENSIONS.forEach((dimension) => {
        const tags = position.riskTags[dimension];
        if (tags.length > 1) {
          if (!nonAdditiveByDimension.has(dimension)) nonAdditiveByDimension.set(dimension, []);
          nonAdditiveByDimension.get(dimension).push(position.key);
        }
        tags.forEach((tag) => {
          const identity = `${dimension}\u0000${tagIdentity(tag)}`;
          const current = tagMap.get(identity) || {
            dimension,
            tag,
            rawValue: 0,
            positionKeys: new Set()
          };
          current.rawValue += position.value;
          current.positionKeys.add(position.key);
          if (compareText(tag, current.tag) < 0) current.tag = tag;
          tagMap.set(identity, current);
        });
      });
    });
    const dimensionOrder = new Map(RISK_DIMENSIONS.map((dimension, index) => [dimension, index]));
    const tagExposures = [...tagMap.values()]
      .map((exposure) => ({
        dimension: exposure.dimension,
        tag: exposure.tag,
        value: round(exposure.rawValue, 8),
        weight: totalValue > 0 ? round(exposure.rawValue / totalValue) : 0,
        positionCount: exposure.positionKeys.size,
        positionKeys: [...exposure.positionKeys].sort(compareText)
      }))
      .sort((left, right) => dimensionOrder.get(left.dimension) - dimensionOrder.get(right.dimension)
        || compareText(tagIdentity(left.tag), tagIdentity(right.tag)));

    const groupValue = {
      core: positions.filter((position) => position.investmentRoles.includes("CORE")).reduce((sum, position) => sum + position.value, 0),
      satellite: positions.filter((position) => position.investmentRoles.some((role) => SATELLITE_ROLES.has(role))).reduce((sum, position) => sum + position.value, 0),
      aiStructural: positions.filter((position) => position.investmentRoles.includes("STRUCTURAL_GROWTH")
        && position.riskTags.aiValueChain.length > 0).reduce((sum, position) => sum + position.value, 0),
      cycle: positions.filter((position) => position.investmentRoles.includes("CYCLE")).reduce((sum, position) => sum + position.value, 0)
    };
    const budgetSpecs = [
      { key: "core", inputKey: "coreMinPct", rule: "MIN" },
      { key: "satellite", inputKey: "satelliteMaxPct", rule: "MAX" },
      { key: "aiStructural", inputKey: "aiStructuralMaxPct", rule: "MAX" },
      { key: "cycle", inputKey: "cycleMaxPct", rule: "MAX" }
    ];
    const invalidBudgetKeys = [];
    const budgets = Object.fromEntries(budgetSpecs.map((spec) => {
      const input = budgetInput(riskBudgets, spec.inputKey);
      if (input.invalid) invalidBudgetKeys.push(spec.inputKey);
      const actualValue = groupValue[spec.key];
      const actualWeight = totalValue > 0 ? actualValue / totalValue : 0;
      let status = "UNSET";
      if (input.invalid) status = "INVALID";
      else if (input.value !== null && totalValue <= 0) status = "NO_DATA";
      else if (input.value !== null) {
        const actualPct = actualWeight * 100;
        const satisfies = spec.rule === "MIN"
          ? actualPct + EPSILON >= input.value
          : actualPct <= input.value + EPSILON;
        status = satisfies ? "OK" : "BREACHED";
      }
      return [spec.key, {
        inputKey: spec.inputKey,
        rule: spec.rule,
        limitPct: input.value,
        actualValue: round(actualValue, 8),
        actualWeight: round(actualWeight),
        actualPct: round(actualWeight * 100, 6),
        status
      }];
    }));

    const untaggedPositionKeys = positions.filter((position) => position.isUntagged).map((position) => position.key);
    const missingRolePositionKeys = positions.filter((position) => position.hasMissingRole).map((position) => position.key);
    const staleReviewPositionKeys = positions.filter((position) => position.reviewRequired).map((position) => position.key);
    const missingValuePositionKeys = positions.filter((position) => position.hasMissingValue).map((position) => position.key);
    const warnings = [];
    if (!positions.length) warnings.push(warning("EMPTY_PORTFOLIO", "분석할 경제적 포지션이 없습니다."));
    if (untaggedPositionKeys.length) warnings.push(warning(
      "UNTAGGED_POSITIONS",
      `위험 태그가 없는 포지션이 ${untaggedPositionKeys.length}개 있습니다.`,
      { positionKeys: untaggedPositionKeys }
    ));
    if (missingRolePositionKeys.length) warnings.push(warning(
      "MISSING_INVESTMENT_ROLES",
      `투자 역할이 없는 포지션이 ${missingRolePositionKeys.length}개 있습니다.`,
      { positionKeys: missingRolePositionKeys }
    ));
    if (staleReviewPositionKeys.length) warnings.push(warning(
      "STALE_REVIEWS",
      `검토가 필요하거나 ${staleDays}일보다 오래된 포지션이 ${staleReviewPositionKeys.length}개 있습니다.`,
      { positionKeys: staleReviewPositionKeys, staleDays }
    ));
    if (missingValuePositionKeys.length) warnings.push(warning(
      "MISSING_VALUES",
      `평가금액이 확인되지 않은 포지션이 ${missingValuePositionKeys.length}개 있습니다.`,
      { positionKeys: missingValuePositionKeys }
    ));
    nonAdditiveByDimension.forEach((positionKeys, dimension) => warnings.push(warning(
      "NON_ADDITIVE_TAGS",
      `${dimension} 차원의 다중 태그 노출은 서로 겹칠 수 있어 합산할 수 없습니다.`,
      { dimension, positionKeys: [...positionKeys].sort(compareText) }
    )));
    const inconsistentRoleKeys = positions.filter((position) => position.hasInconsistentRoles).map((position) => position.key);
    if (inconsistentRoleKeys.length) warnings.push(warning(
      "INCONSISTENT_INVESTMENT_ROLES",
      "같은 경제적 포지션에 서로 다른 역할 또는 지원하지 않는 역할이 있습니다.",
      { positionKeys: inconsistentRoleKeys }
    ));
    invalidBudgetKeys.forEach((inputKey) => warnings.push(warning(
      "INVALID_RISK_BUDGET",
      `${inputKey} 위험 예산은 0~100 사이 숫자여야 합니다.`,
      { inputKey }
    )));
    Object.entries(budgets).forEach(([key, budget]) => {
      if (budget.status !== "BREACHED") return;
      warnings.push(warning(
        "RISK_BUDGET_BREACH",
        `${key} 실제 비중 ${budget.actualPct}%가 ${budget.rule === "MIN" ? "최소" : "최대"} 예산 ${budget.limitPct}%를 충족하지 못합니다.`,
        { budgetKey: key }
      ));
    });
    warnings.sort((left, right) => compareText(left.code, right.code)
      || compareText(left.dimension, right.dimension)
      || compareText(left.budgetKey, right.budgetKey)
      || compareText(left.inputKey, right.inputKey)
      || compareText(left.message, right.message));

    return {
      totalValue: round(totalValue, 8),
      rowCount: rows.length,
      economicPositionCount: positions.length,
      positions,
      tagExposures,
      budgets,
      quality: {
        economicPositionCount: positions.length,
        valuedPositionCount: positions.length - missingValuePositionKeys.length,
        missingValuePositionCount: missingValuePositionKeys.length,
        untaggedPositionCount: untaggedPositionKeys.length,
        missingRolePositionCount: missingRolePositionKeys.length,
        staleReviewPositionCount: staleReviewPositionKeys.length,
        untaggedPositionKeys,
        missingRolePositionKeys,
        staleReviewPositionKeys
      },
      warnings,
      options: { todayKey, staleDays }
    };
  }

  return {
    analyzeRiskExposure,
    planContribution
  };
});
