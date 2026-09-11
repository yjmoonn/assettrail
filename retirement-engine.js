(function attachRetirementEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AssetTrailRetirementEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRetirementEngine() {
  "use strict";
  const defaults = Object.freeze({ currentAge: 35, retireAge: 55, lifeAge: 90,
    currentInvestable: 0, monthlyInvest: 1000000, monthlySpend: 3500000,
    inflationRate: 2, postReturnRate: 3.5 });

  function validateRetirementInput(input) {
    const fields = [
      "currentAge",
      "retireAge",
      "lifeAge",
      "currentInvestable",
      "monthlyInvest",
      "monthlySpend",
      "inflationRate",
      "postReturnRate"
    ];
    if (fields.some((field) => !Number.isFinite(Number(input?.[field])))) {
      return "은퇴 가정을 모두 숫자로 입력하세요.";
    }
  
    const currentAge = Number(input.currentAge);
    const retireAge = Number(input.retireAge);
    const lifeAge = Number(input.lifeAge);
    if (!Number.isInteger(currentAge) || currentAge < 0 || currentAge > 100) {
      return "현재 나이는 0~100세의 정수로 입력하세요.";
    }
    if (!Number.isInteger(retireAge) || retireAge < 1 || retireAge > 100) {
      return "은퇴 나이는 1~100세의 정수로 입력하세요.";
    }
    if (!Number.isInteger(lifeAge) || lifeAge < 1 || lifeAge > 120) {
      return "예상 수명은 1~120세의 정수로 입력하세요.";
    }
    if (retireAge < currentAge) return "은퇴 나이는 현재 나이보다 빠를 수 없습니다.";
    if (lifeAge <= retireAge) return "예상 수명은 은퇴 나이보다 커야 합니다.";
    if (Number(input.currentInvestable) < 0) return "현재 투자 가능 자산은 0원 이상이어야 합니다.";
    if (Number(input.monthlyInvest) < 0) return "매월 추가 투자금은 0원 이상이어야 합니다.";
    if (!(Number(input.monthlySpend) > 0)) return "은퇴 후 월 지출은 0원보다 커야 합니다.";
    if (Number(input.inflationRate) < 0 || Number(input.inflationRate) > 20) {
      return "물가상승률은 0~20% 범위로 입력하세요.";
    }
    if (Number(input.postReturnRate) < 0 || Number(input.postReturnRate) > 30) {
      return "은퇴 후 연수익률은 0~30% 범위로 입력하세요.";
    }
    return "";
  }

  function calculateRetirement(input) {
    const validationError = validateRetirementInput(input);
    if (validationError) return { error: validationError };
  
    const currentAge = Number(input.currentAge);
    const retireAge = Number(input.retireAge);
    const lifeAge = Number(input.lifeAge);
    const currentInvestable = Number(input.currentInvestable);
    const monthlyInvest = Number(input.monthlyInvest);
    const monthlySpend = Number(input.monthlySpend);
    const inflation = Number(input.inflationRate) / 100;
    const postReturn = Number(input.postReturnRate) / 100;
    const yearsToRetire = retireAge - currentAge;
    const retirementYears = lifeAge - retireAge;
  
    const firstAnnualSpend = monthlySpend * 12 * Math.pow(1 + inflation, yearsToRetire);
    const nestEgg = presentValueGrowingAnnuity(firstAnnualSpend, postReturn, inflation, retirementYears);
    const months = yearsToRetire * 12;
    const requiredNoContribution = requiredAnnualReturn(currentInvestable, 0, nestEgg, months);
    const requiredWithContribution = requiredAnnualReturn(currentInvestable, monthlyInvest, nestEgg, months);
    const gap = nestEgg - currentInvestable;
  
    return {
      firstAnnualSpend,
      gap,
      nestEgg,
      requiredNoContribution,
      requiredWithContribution,
      yearsToRetire
    };
  }

  function presentValueGrowingAnnuity(firstPayment, rate, growth, years) {
    if (Math.abs(rate - growth) < 0.000001) {
      return (firstPayment * years) / (1 + rate);
    }
    return (firstPayment / (rate - growth)) * (1 - Math.pow((1 + growth) / (1 + rate), years));
  }

  function requiredAnnualReturn(principal, monthlyContribution, target, months) {
    if (target <= 0) return 0;
    if (months <= 0) return principal >= target ? 0 : Number.POSITIVE_INFINITY;
    if (principal <= 0 && monthlyContribution <= 0) return Number.POSITIVE_INFINITY;
  
    const futureValue = (monthlyRate) => {
      if (Math.abs(monthlyRate) < 0.0000001) {
        return principal + monthlyContribution * months;
      }
      return (
        principal * Math.pow(1 + monthlyRate, months) +
        monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      );
    };
  
    let low = -0.99;
    let high = 1;
    if (futureValue(high) < target) return Number.POSITIVE_INFINITY;
  
    for (let i = 0; i < 120; i += 1) {
      const mid = (low + high) / 2;
      if (futureValue(mid) >= target) high = mid;
      else low = mid;
    }
  
    return Math.pow(1 + high, 12) - 1;
  }

  function isConfigured(input) {
    return Object.keys(defaults).some(key => Number(input?.[key]) !== Number(defaults[key]));
  }

  function buildGoalContext(input) {
    const empty = { yearsToRetirement: null, fundedRatioPct: null, requiredAnnualReturnPct: null };
    if (!isConfigured(input)) return { status: "DEFAULT_NOT_CONFIRMED", ...empty };
    const result = calculateRetirement(input);
    if (result.error || !(result.nestEgg > 0)) return { status: "INVALID", ...empty };
    return { status: "CONFIGURED", yearsToRetirement: result.yearsToRetire,
      fundedRatioPct: Math.max(0, Number(input.currentInvestable || 0) / result.nestEgg) * 100,
      requiredAnnualReturnPct: Number.isFinite(result.requiredWithContribution)
        ? result.requiredWithContribution * 100 : null };
  }

  return Object.freeze({ defaults, isConfigured, buildGoalContext, validateRetirementInput,
    calculateRetirement, presentValueGrowingAnnuity, requiredAnnualReturn });
});
