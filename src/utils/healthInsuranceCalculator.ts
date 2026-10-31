// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RegionalRates } from '../data/employeesHealthInsurance/providerRateData';
import {
  getCustomProviderRates,
  getEmployeePremiumRate,
  getRegionalRatesForMonth,
  type EmployeeRates,
} from '../data/employeesHealthInsurance/providerRates';
import { findSMRBracket } from '../data/employeesHealthInsurance/smrBrackets';
import { getLatterStageParamsForMonth } from '../data/latterStageElderlyParams';
import {
  getNHIParamsForMonth,
  nhiParamsDiffer,
  type NHIParamsField,
} from '../data/nationalHealthInsurance/nhiParamsData';
import {
  getNHIPremiumReductionThresholdsForMonth,
  type NHIPremiumReductionThresholds,
} from '../data/nationalHealthInsurance/nhiPremiumReduction';
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type {
  ProviderRegion,
  NationalHealthInsuranceRegionParams,
  LatterStageElderlyRegionParams,
  NonLatterStageProviderId,
  NHIPremiumReductionRatio,
} from '../types/healthInsurance';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
} from '../types/healthInsurance';
import type {
  BonusIncomeStream,
  CustomEmployeesHealthInsuranceRates,
  NHIHouseholdSummary,
} from '../types/tax';
import type { NHIHouseholdComposition } from './nhiHousehold';

/** The portions (区分) a National Health Insurance premium is made of. */
export type NationalHealthInsurancePortionKey =
  | 'medical'
  | 'elderlySupport'
  | 'longTermCare'
  | 'childSupport';

/**
 * Breakdown of National Health Insurance premium components: each portion for the calendar year
 * and their total, in yen.
 */
export interface NationalHealthInsuranceBreakdown {
  medicalPortion: number;
  elderlySupportPortion: number;
  longTermCarePortion: number;
  childSupportPortion: number;
  total: number;
  /**
   * Low-income reduction (均等割額・平等割額の軽減) ratio applied in each fiscal year of the
   * calendar year (0 = no reduction, 0.7 = 7割軽減). The two can differ when the annual
   * threshold revision moves the same income into a different tier across the April boundary.
   */
  reductionRatios: { prevFY: NHIPremiumReductionRatio; currFY: NHIPremiumReductionRatio };
  /**
   * Whether each portion has stopped rising with income: at its 賦課限度額 in every fiscal year
   * that levies it. A portion no fiscal year levies is not capped.
   */
  medicalCapped: boolean;
  elderlySupportCapped: boolean;
  longTermCareCapped: boolean;
  childSupportCapped: boolean;
}

/** The parameter fields each portion is calculated from. */
const NHI_PORTION_FIELDS: Record<
  NationalHealthInsurancePortionKey,
  {
    rate: NHIParamsField;
    perCapita: NHIParamsField;
    householdFlat: NHIParamsField;
    cap: NHIParamsField;
  }
> = {
  medical: {
    rate: 'medicalRate',
    perCapita: 'medicalPerCapita',
    householdFlat: 'medicalHouseholdFlat',
    cap: 'medicalCap',
  },
  elderlySupport: {
    rate: 'supportRate',
    perCapita: 'supportPerCapita',
    householdFlat: 'supportHouseholdFlat',
    cap: 'supportCap',
  },
  longTermCare: {
    rate: 'ltcRateForEligible',
    perCapita: 'ltcPerCapitaForEligible',
    householdFlat: 'ltcHouseholdFlatForEligible',
    cap: 'ltcCapForEligible',
  },
  childSupport: {
    rate: 'childSupportRate',
    perCapita: 'childSupportPerCapita',
    householdFlat: 'childSupportHouseholdFlat',
    cap: 'childSupportCap',
  },
};

/**
 * Options for calculating a portion's per-capita and household flat amounts
 * in multi-member households.
 */
export interface NHIPortionHouseholdOptions {
  /** Total number of insured members subject to this portion's per-capita levy (default 1) */
  insuredCount?: number;
  /** Number of preschool children under 6 receiving 50% discount on per-capita (default 0) */
  preschoolCount?: number;
  /** Number of children under 19 exempt from child support per-capita levy (default 0) */
  childSupportExemptCount?: number;
}

/** One portion of a National Health Insurance premium for one fiscal year's parameters. */
export interface NationalHealthInsurancePortion {
  /** The 所得割率. */
  rate: number;
  /** 所得割: the calculation base times {@link rate}. */
  incomeBased: number;
  /** 均等割額 after any low-income reduction and preschool discount. */
  perCapita: number;
  /** 平等割額 after any low-income reduction, 0 where the region levies none. */
  householdFlat: number;
  /** Unreduced 均等割額 from the regional parameters. */
  perCapitaFull: number;
  /** Unreduced 平等割額 from the regional parameters. */
  householdFlatFull: number;
  /** Low-income reduction ratio applied to 均等割 and 平等割 (0, 0.2, 0.5, or 0.7). */
  reductionRatio: NHIPremiumReductionRatio;
  /** The three added, before the 賦課限度額. */
  uncapped: number;
  /** 賦課限度額. */
  cap: number;
  /** The lower of {@link uncapped} and {@link cap}, rounded to yen: the portion for the fiscal year. */
  premium: number;
  /** Whether {@link uncapped} reached {@link cap}, so that more income would not raise the portion. */
  isCapped: boolean;
  /** Number of insured individuals subject to this portion's per-capita levy */
  insuredCount: number;
  /** Number of preschool children subject to the 50% discount on this portion's per-capita levy */
  preschoolCount: number;
  /** Number of children exempt from this portion's per-capita levy */
  childSupportExemptCount: number;
  /** Per-capita amount per adult/standard insured member after reduction */
  perCapitaPerAdult: number;
  /** Per-capita amount per preschool child after reduction */
  perCapitaPerPreschool: number;
}

/**
 * The 基礎控除後の総所得金額等 that National Health Insurance and 後期高齢者医療 assess their
 * 所得割 on: 総所得金額等 less the 地方税法第314条の2第2項 basic deduction (¥430,000, stepping
 * down above ¥24,000,000 of 合計所得金額), never below 0. Both statutes point at that deduction
 * rather than fixing an amount: 国民健康保険法施行令第29条の7第2項第4号 for premiums,
 * 地方税法第703条の4第6項 for the tax form, and 高齢者の医療の確保に関する法律 for the elderly
 * system, so no region's parameters carry one. This calculator judges the base on the income
 * year's own income, where a municipality judges it on the previous year's.
 */
export function premiumCalculationBase(netIncome: number): number {
  return Math.max(0, netIncome - calculateResidenceTaxBasicDeduction(netIncome));
}

/**
 * One portion of the premium for one fiscal year's parameters: 所得割 + 均等割 + 平等割, capped
 * at the 賦課限度額. Undefined where the parameters have no 所得割率 or no 賦課限度額 for it,
 * which is how a region states that it does not levy the portion; the data gives a levied portion
 * its rate, per-capita amount and cap together. Shared by the premium calculation and the tooltip
 * that explains it, so the two cannot round or cap differently.
 */
export function calculateNationalHealthInsurancePortion(
  calculationBase: number,
  params: NationalHealthInsuranceRegionParams,
  portion: NationalHealthInsurancePortionKey,
  reductionRatio: NHIPremiumReductionRatio = 0,
  options?: NHIPortionHouseholdOptions,
): NationalHealthInsurancePortion | undefined {
  const fields = NHI_PORTION_FIELDS[portion];
  const rate = params[fields.rate];
  const cap = params[fields.cap];
  if (!rate || !cap) return undefined;

  const totalInsured = options?.insuredCount ?? 1;
  if (totalInsured <= 0) return undefined;

  const preschoolCount =
    portion === 'longTermCare' ? 0 : Math.min(totalInsured, options?.preschoolCount ?? 0);
  const childSupportExemptCount =
    portion === 'childSupport' ? Math.min(totalInsured, options?.childSupportExemptCount ?? 0) : 0;

  const perCapitaFull = params[fields.perCapita] ?? 0;
  const householdFlatFull = params[fields.householdFlat] ?? 0;
  const reductionKeepFactor = 1 - reductionRatio;

  const perCapitaPerAdult = perCapitaFull * reductionKeepFactor;
  const perCapitaPerPreschool = perCapitaPerAdult * 0.5;

  let perCapita = 0;
  if (portion === 'childSupport') {
    // Under FY2026 rules (国民健康保険法施行令第29条の7第5項), children through age 18
    // are 100% exempt from the child support per-capita levy.
    const nonExemptAdultCount = Math.max(0, totalInsured - childSupportExemptCount);
    perCapita = nonExemptAdultCount * perCapitaPerAdult;
  } else if (portion === 'longTermCare') {
    perCapita = totalInsured * perCapitaPerAdult;
  } else {
    const adultCount = Math.max(0, totalInsured - preschoolCount);
    perCapita = adultCount * perCapitaPerAdult + preschoolCount * perCapitaPerPreschool;
  }

  const householdFlat = householdFlatFull * reductionKeepFactor;
  const incomeBased = calculationBase * rate;
  const uncapped = incomeBased + perCapita + householdFlat;
  const premium = Math.round(Math.min(uncapped, cap));

  return {
    rate,
    incomeBased,
    perCapita,
    householdFlat,
    perCapitaFull,
    householdFlatFull,
    reductionRatio,
    uncapped,
    cap,
    premium,
    isCapped: uncapped >= cap,
    insuredCount: totalInsured,
    preschoolCount,
    childSupportExemptCount,
    perCapitaPerAdult,
    perCapitaPerPreschool:
      portion === 'childSupport' && childSupportExemptCount > 0 ? 0 : perCapitaPerPreschool,
  };
}

/**
 * Whether a portion's own parameters differ between two fiscal years' parameters, so that the
 * portion's premium can differ between the two years.
 */
export function nationalHealthInsurancePortionDiffers(
  a: NationalHealthInsuranceRegionParams,
  b: NationalHealthInsuranceRegionParams,
  portion: NationalHealthInsurancePortionKey,
): boolean {
  const fields = NHI_PORTION_FIELDS[portion];
  return nhiParamsDiffer(a, b, [fields.rate, fields.perCapita, fields.householdFlat, fields.cap]);
}

/**
 * Determines the NHI low-income premium reduction (均等割額・平等割額の軽減) ratio.
 *
 * The statutory test compares the reduction test income (軽減判定所得) of the reduction test group
 * (household head + all NHI-insured members) to the thresholds.
 */
export function calculateNHIPremiumReductionRatio(
  reductionTestIncome: number,
  thresholds: NHIPremiumReductionThresholds,
  options?: { insuredCount?: number; salaryEarnersCount?: number },
): NHIPremiumReductionRatio {
  const insuredCount = options?.insuredCount ?? 1;
  const salaryEarnersCount = options?.salaryEarnersCount ?? 1;
  const earnerAllowance =
    thresholds.perAdditionalSalaryEarner * Math.max(0, salaryEarnersCount - 1);

  if (reductionTestIncome <= thresholds.baseAmount + earnerAllowance) {
    return 0.7;
  }
  if (
    reductionTestIncome <=
    thresholds.baseAmount + thresholds.fiftyPercentPerInsured * insuredCount + earnerAllowance
  ) {
    return 0.5;
  }
  if (
    reductionTestIncome <=
    thresholds.baseAmount + thresholds.twentyPercentPerInsured * insuredCount + earnerAllowance
  ) {
    return 0.2;
  }
  return 0;
}

/**
 * Reduction ratio for the fiscal year in effect at the given year and month.
 * Used by the engine (per fiscal year of the blend) and by the NHI tooltips, which must
 * reproduce the engine's arithmetic exactly.
 */
export function getNHIPremiumReductionRatioForMonth(
  reductionTestIncome: number,
  year: number,
  month: number,
  options?: { insuredCount?: number; salaryEarnersCount?: number },
): NHIPremiumReductionRatio {
  return calculateNHIPremiumReductionRatio(
    reductionTestIncome,
    getNHIPremiumReductionThresholdsForMonth(year, month),
    options,
  );
}

/**
 * Breakdown of Health Insurance premium components
 */
export interface HealthInsuranceBreakdown {
  total: number;
  bonusPortion: number;
}

/**
 * Calculates the annual health insurance premium breakdown.
 */
export function calculateHealthInsuranceBreakdown(
  annualIncome: number,
  isSubjectToLongTermCarePremium: boolean,
  provider: NonLatterStageProviderId,
  year: number,
  region: ProviderRegion = DEFAULT_PROVIDER_REGION,
  customRates?: CustomEmployeesHealthInsuranceRates,
  bonuses: BonusIncomeStream[] = [],
): HealthInsuranceBreakdown {
  // Dependent coverage has no premium
  if (provider === DEPENDENT_COVERAGE_ID) {
    return { total: 0, bonusPortion: 0 };
  }

  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    // For NHI, bonuses are part of the total net income.
    const total = calculateNationalHealthInsurancePremiumWithBreakdown(
      annualIncome,
      isSubjectToLongTermCarePremium,
      year,
      region,
    ).total;
    return { total, bonusPortion: 0 };
  }

  if (annualIncome < 0) {
    throw new Error("Income for Employees' Health Insurance cannot be negative.");
  }

  const monthlyIncome = annualIncome / 12;

  // Find the SMR bracket for this income (findSMRBracket always returns one: the
  // brackets cover [0, ∞) and it throws on negative income).
  const smrBracket = findSMRBracket(monthlyIncome);

  if (provider === CUSTOM_PROVIDER_ID) {
    if (!customRates) {
      // Fallback if custom rates are missing but provider is custom
      return { total: 0, bonusPortion: 0 };
    }
    const staticRates = getCustomProviderRates(customRates);

    // Custom rates don't vary by month
    const monthlyPremium = getEmployeePremiumRate(
      staticRates,
      isSubjectToLongTermCarePremium,
    ).premiumOn(smrBracket.smrAmount);
    let totalPremium = monthlyPremium * 12;
    let bonusPortion = 0;

    if (bonuses.some(b => b.amount > 0)) {
      const bonusDetails = calculateEmployeesHealthInsuranceBonusBreakdown(
        bonuses,
        staticRates,
        isSubjectToLongTermCarePremium,
        year,
      );
      bonusPortion = bonusDetails.reduce((sum, item) => sum + item.premium, 0);
      totalPremium += bonusPortion;
    }

    return { total: totalPremium, bonusPortion };
  }

  // Calculate per-month premiums — rates may differ by month within a calendar year, and every
  // month of one rate period shares the rates object the lookup returns, so the premium is
  // computed once per period.
  let totalPremium = 0;
  let periodRates: RegionalRates | undefined;
  let premium = 0;
  for (let month = 0; month < 12; month++) {
    const monthRates = getRegionalRatesForMonth(provider, region, year, month);
    if (monthRates) {
      if (monthRates !== periodRates) {
        premium = getEmployeePremiumRate(monthRates, isSubjectToLongTermCarePremium).premiumOn(
          smrBracket.smrAmount,
        );
        periodRates = monthRates;
      }
      totalPremium += premium;
    }
  }

  let bonusPortion = 0;

  if (bonuses.some(b => b.amount > 0)) {
    const bonusDetails = calculateEmployeesHealthInsuranceBonusBreakdown(
      bonuses,
      provider,
      region,
      year,
      isSubjectToLongTermCarePremium,
    );

    bonusPortion = bonusDetails.reduce((sum, item) => sum + item.premium, 0);
    totalPremium += bonusPortion;
  }

  return { total: totalPremium, bonusPortion };
}

/**
 * Breakdown of a single bonus payment's employee health insurance premium
 */
export interface EmployeesHealthInsuranceBonusBreakdownItem {
  month: number;
  bonusAmount: number;
  standardBonusAmount: number; // The rounded down, potentially capped amount
  /** Annual cumulative standard bonus amount */
  cumulativeStandardBonus: number;
  premium: number;
  includesLongTermCare: boolean;
}

/**
 * The cumulative maximum amount of bonus income that is subject to health insurance premiums in a year (April to March).
 * Source: https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20141203.html
 */
export const ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP = 5_730_000;

/**
 * Calculates detailed breakdown for health insurance bonuses.
 *
 * Accepts either provider/region/year for time-series rate lookup,
 * or a static rates object (for custom providers).
 */
export function calculateEmployeesHealthInsuranceBonusBreakdown(
  bonuses: BonusIncomeStream[],
  providerOrRates: string | EmployeeRates,
  regionOrLTC: string | boolean,
  year: number,
  isSubjectToLongTermCarePremium?: boolean,
): EmployeesHealthInsuranceBonusBreakdownItem[] {
  // Determine whether we're using time-series lookup or static rates
  const useTimeSeries = typeof providerOrRates === 'string';
  const providerId = useTimeSeries ? providerOrRates : undefined;
  const region = useTimeSeries ? (regionOrLTC as string) : undefined;
  const staticRates = useTimeSeries ? undefined : providerOrRates;
  const includeLTC = useTimeSeries ? isSubjectToLongTermCarePremium! : (regionOrLTC as boolean);

  // Sort bonuses by month to apply cumulative cap correctly
  const sortedBonuses = [...bonuses].sort((a, b) => a.month - b.month);

  const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [];
  let cumulativeStandardBonus = 0;

  for (const bonus of sortedBonuses) {
    const roundedBonus = Math.floor(bonus.amount / 1000) * 1000;

    // Calculate how much room is left in the cap
    const remainingCap = Math.max(
      0,
      ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP - cumulativeStandardBonus,
    );

    // The standard bonus amount for this payment is the rounded amount,
    // limited by the remaining cap space.
    const standardBonusAmount = Math.min(roundedBonus, remainingCap);

    cumulativeStandardBonus += standardBonusAmount;

    // Look up rates for this bonus's month (or use static rates)
    const rates = useTimeSeries
      ? getRegionalRatesForMonth(providerId!, region!, year, bonus.month)
      : staticRates!;

    if (!rates) {
      breakdown.push({
        month: bonus.month,
        bonusAmount: bonus.amount,
        standardBonusAmount,
        cumulativeStandardBonus,
        premium: 0,
        includesLongTermCare: includeLTC,
      });
      continue;
    }

    const premium = getEmployeePremiumRate(rates, includeLTC).premiumOn(standardBonusAmount);

    breakdown.push({
      month: bonus.month,
      bonusAmount: bonus.amount,
      standardBonusAmount,
      cumulativeStandardBonus,
      premium,
      includesLongTermCare: includeLTC,
    });
  }

  return breakdown;
}

type NationalHealthInsuranceFiscalYearPortions = Record<
  NationalHealthInsurancePortionKey,
  NationalHealthInsurancePortion | undefined
>;

/**
 * Calculates all portions for one fiscal year's parameters for a household.
 */
export function calculateNationalHealthInsuranceFiscalYearPortionsForHousehold(
  calculationBase: number,
  ltcCalculationBase: number,
  params: NationalHealthInsuranceRegionParams,
  reductionRatio: NHIPremiumReductionRatio,
  counts: {
    insuredCount: number;
    ltcInsuredCount: number;
    preschoolCount: number;
    childSupportExemptCount: number;
  },
): NationalHealthInsuranceFiscalYearPortions {
  return {
    medical: calculateNationalHealthInsurancePortion(
      calculationBase,
      params,
      'medical',
      reductionRatio,
      {
        insuredCount: counts.insuredCount,
        preschoolCount: counts.preschoolCount,
        childSupportExemptCount: 0,
      },
    ),
    elderlySupport: calculateNationalHealthInsurancePortion(
      calculationBase,
      params,
      'elderlySupport',
      reductionRatio,
      {
        insuredCount: counts.insuredCount,
        preschoolCount: counts.preschoolCount,
        childSupportExemptCount: 0,
      },
    ),
    longTermCare:
      counts.ltcInsuredCount > 0
        ? calculateNationalHealthInsurancePortion(
            ltcCalculationBase,
            params,
            'longTermCare',
            reductionRatio,
            {
              insuredCount: counts.ltcInsuredCount,
              preschoolCount: 0,
              childSupportExemptCount: 0,
            },
          )
        : undefined,
    childSupport: calculateNationalHealthInsurancePortion(
      calculationBase,
      params,
      'childSupport',
      reductionRatio,
      {
        insuredCount: counts.insuredCount,
        preschoolCount: counts.preschoolCount,
        childSupportExemptCount: counts.childSupportExemptCount,
      },
    ),
  };
}

/**
 * Every portion for one fiscal year's parameters for a single individual.
 */
function calculateNationalHealthInsuranceFiscalYearPortions(
  netIncome: number,
  isSubjectToLongTermCarePremium: boolean,
  params: NationalHealthInsuranceRegionParams,
  reductionRatio: NHIPremiumReductionRatio,
): NationalHealthInsuranceFiscalYearPortions {
  const base = premiumCalculationBase(netIncome);
  return calculateNationalHealthInsuranceFiscalYearPortionsForHousehold(
    base,
    base,
    params,
    reductionRatio,
    {
      insuredCount: 1,
      ltcInsuredCount: isSubjectToLongTermCarePremium ? 1 : 0,
      preschoolCount: 0,
      childSupportExemptCount: 0,
    },
  );
}

/**
 * Calculates National Health Insurance premium with breakdown, blending two fiscal years.
 *
 * NHI premiums for non-pensioners (普通徴収) are paid in 10 equal installments from June
 * through March. A calendar year therefore straddles two fiscal years:
 *   - Jan, Feb, Mar: 3 remaining installments of the *previous* FY → 3/10 of that annual premium
 *   - Apr, May: no NHI payments
 *   - Jun–Dec: 7 of 10 installments of the *current* FY → 7/10 of that annual premium
 *
 * Formula: CY amount = FY(N-1) annual × 3/10 + FY(N) annual × 7/10
 *
 * When both fiscal years resolve to the same parameters (or previous fiscal year data is absent),
 * 3/10 + 7/10 = 1 produces the single-fiscal-year calculation.
 */
export function calculateNationalHealthInsurancePremiumWithBreakdown(
  netIncome: number,
  isSubjectToLongTermCarePremium: boolean,
  year: number,
  region?: string,
): NationalHealthInsuranceBreakdown {
  const regionKey = region as string;

  // Look up rates for the two fiscal years that overlap this calendar year:
  // - January (month 0) resolves to the previous fiscal year's rates
  // - April (month 3) resolves to the current fiscal year's rates
  const prevFYParams = getNHIParamsForMonth(regionKey, year, 0);
  const currFYParams = getNHIParamsForMonth(regionKey, year, 3);

  // The low-income reduction tier is judged per fiscal year: the annual threshold revision
  // can move the same income into a different tier across the April boundary.
  const prevReductionRatio = getNHIPremiumReductionRatioForMonth(netIncome, year, 0);
  const currReductionRatio = getNHIPremiumReductionRatioForMonth(netIncome, year, 3);

  if (!currFYParams) {
    console.error(
      `National Health Insurance parameters not found for region: ${region}. Returning zero breakdown.`,
    );
    return {
      medicalPortion: 0,
      elderlySupportPortion: 0,
      longTermCarePortion: 0,
      childSupportPortion: 0,
      total: 0,
      reductionRatios: { prevFY: 0, currFY: 0 },
      medicalCapped: false,
      elderlySupportCapped: false,
      longTermCareCapped: false,
      childSupportCapped: false,
    };
  }

  // Calculate every portion for each fiscal year
  const currFY = calculateNationalHealthInsuranceFiscalYearPortions(
    netIncome,
    isSubjectToLongTermCarePremium,
    currFYParams,
    currReductionRatio,
  );
  const prevFY =
    prevFYParams &&
    (nhiParamsDiffer(prevFYParams, currFYParams) || prevReductionRatio !== currReductionRatio)
      ? calculateNationalHealthInsuranceFiscalYearPortions(
          netIncome,
          isSubjectToLongTermCarePremium,
          prevFYParams,
          prevReductionRatio,
        )
      : currFY;

  // Blend: 3/10 of previous FY + 7/10 of current FY (10-installment payment schedule), from each
  // fiscal year's rounded premium
  const blend = (portion: NationalHealthInsurancePortionKey): number =>
    Math.round(
      ((prevFY[portion]?.premium ?? 0) * 3) / 10 + ((currFY[portion]?.premium ?? 0) * 7) / 10,
    );
  // A portion has stopped rising with income once every fiscal year that levies it has it at its
  // 賦課限度額; one that neither year levies has nothing to cap.
  const blendCapped = (portion: NationalHealthInsurancePortionKey): boolean => {
    const levied = [prevFY[portion], currFY[portion]].filter(
      (fiscalYear): fiscalYear is NationalHealthInsurancePortion => fiscalYear !== undefined,
    );
    return levied.length > 0 && levied.every(fiscalYear => fiscalYear.isCapped);
  };

  const medicalPortion = blend('medical');
  const elderlySupportPortion = blend('elderlySupport');
  const longTermCarePortion = blend('longTermCare');
  const childSupportPortion = blend('childSupport');
  const total = medicalPortion + elderlySupportPortion + longTermCarePortion + childSupportPortion;

  return {
    medicalPortion,
    elderlySupportPortion,
    longTermCarePortion,
    childSupportPortion,
    total,
    reductionRatios: { prevFY: prevReductionRatio, currFY: currReductionRatio },
    medicalCapped: blendCapped('medical'),
    elderlySupportCapped: blendCapped('elderlySupport'),
    longTermCareCapped: blendCapped('longTermCare'),
    childSupportCapped: blendCapped('childSupport'),
  };
}

/**
 * Result of household-level National Health Insurance calculations,
 * containing both full-household and taxpayer-attributed breakdowns plus summary.
 */
export interface HouseholdNHICalculationResult {
  householdBreakdown: NationalHealthInsuranceBreakdown;
  taxpayerBreakdown: NationalHealthInsuranceBreakdown;
  summary: NHIHouseholdSummary;
}

/**
 * Calculates household National Health Insurance premiums, applying statutory household rules:
 * - Sums calculation bases across NHI-insured members (40-64 only for long-term care)
 * - Multiplies per-capita by insured headcount, applying low-income reduction and preschool 50% discount
 * - Adds 1x household flat rate (平等割) per levied portion
 * - Caps each portion once at the household level before blending 3/10 prevFY + 7/10 currFY
 * - Calculates taxpayer payment attribution (100% full, apportioned share, or none/0)
 */
export function calculateHouseholdNHIBreakdown(
  household: NHIHouseholdComposition,
  year: number,
): HouseholdNHICalculationResult {
  const regionKey = household.effectiveRegion;
  const prevFYParams = getNHIParamsForMonth(regionKey, year, 0);
  const currFYParams = getNHIParamsForMonth(regionKey, year, 3);

  const reductionOptions = {
    insuredCount: household.insuredCount,
    salaryEarnersCount: household.salaryEarnersCount,
  };
  const prevReductionRatio = getNHIPremiumReductionRatioForMonth(
    household.reductionTestIncome,
    year,
    0,
    reductionOptions,
  );
  const currReductionRatio = getNHIPremiumReductionRatioForMonth(
    household.reductionTestIncome,
    year,
    3,
    reductionOptions,
  );

  const zeroBreakdown: NationalHealthInsuranceBreakdown = {
    medicalPortion: 0,
    elderlySupportPortion: 0,
    longTermCarePortion: 0,
    childSupportPortion: 0,
    total: 0,
    reductionRatios: { prevFY: 0, currFY: 0 },
    medicalCapped: false,
    elderlySupportCapped: false,
    longTermCareCapped: false,
    childSupportCapped: false,
  };

  const zeroSummary: NHIHouseholdSummary = {
    insuredCount: household.insuredCount,
    ltcInsuredCount: household.ltcInsuredCount,
    preschoolCount: household.preschoolCount,
    childSupportExemptCount: household.childSupportExemptCount,
    calculationBase: household.calculationBase,
    ltcCalculationBase: household.ltcCalculationBase,
    isDeemedHead: household.isDeemedHead,
    householdHeadRelationship: household.householdHead.relationship,
    reductionTestIncome: household.reductionTestIncome,
    salaryEarnersCount: household.salaryEarnersCount,
    reductionRatios: { prevFY: 0, currFY: 0 },
    householdTotal: 0,
    householdPortions: { medical: 0, elderlySupport: 0, longTermCare: 0, childSupport: 0 },
    taxpayerTotal: 0,
    taxpayerPortions: { medical: 0, elderlySupport: 0, longTermCare: 0, childSupport: 0 },
    paymentAttribution: household.paymentAttribution,
    effectiveRegion: household.effectiveRegion,
  };

  if (!currFYParams || household.insuredCount === 0) {
    return {
      householdBreakdown: zeroBreakdown,
      taxpayerBreakdown: zeroBreakdown,
      summary: zeroSummary,
    };
  }

  const counts = {
    insuredCount: household.insuredCount,
    ltcInsuredCount: household.ltcInsuredCount,
    preschoolCount: household.preschoolCount,
    childSupportExemptCount: household.childSupportExemptCount,
  };

  const currFY = calculateNationalHealthInsuranceFiscalYearPortionsForHousehold(
    household.calculationBase,
    household.ltcCalculationBase,
    currFYParams,
    currReductionRatio,
    counts,
  );

  const prevFY =
    prevFYParams &&
    (nhiParamsDiffer(prevFYParams, currFYParams) || prevReductionRatio !== currReductionRatio)
      ? calculateNationalHealthInsuranceFiscalYearPortionsForHousehold(
          household.calculationBase,
          household.ltcCalculationBase,
          prevFYParams,
          prevReductionRatio,
          counts,
        )
      : currFY;

  const blend = (portion: NationalHealthInsurancePortionKey): number =>
    Math.round(
      ((prevFY[portion]?.premium ?? 0) * 3) / 10 + ((currFY[portion]?.premium ?? 0) * 7) / 10,
    );

  const blendCapped = (portion: NationalHealthInsurancePortionKey): boolean => {
    const levied = [prevFY[portion], currFY[portion]].filter(
      (fiscalYear): fiscalYear is NationalHealthInsurancePortion => fiscalYear !== undefined,
    );
    return levied.length > 0 && levied.every(fiscalYear => fiscalYear.isCapped);
  };

  const householdPortions = {
    medical: blend('medical'),
    elderlySupport: blend('elderlySupport'),
    longTermCare: blend('longTermCare'),
    childSupport: blend('childSupport'),
  };
  const householdTotal =
    householdPortions.medical +
    householdPortions.elderlySupport +
    householdPortions.longTermCare +
    householdPortions.childSupport;

  const householdBreakdown: NationalHealthInsuranceBreakdown = {
    medicalPortion: householdPortions.medical,
    elderlySupportPortion: householdPortions.elderlySupport,
    longTermCarePortion: householdPortions.longTermCare,
    childSupportPortion: householdPortions.childSupport,
    total: householdTotal,
    reductionRatios: { prevFY: prevReductionRatio, currFY: currReductionRatio },
    medicalCapped: blendCapped('medical'),
    elderlySupportCapped: blendCapped('elderlySupport'),
    longTermCareCapped: blendCapped('longTermCare'),
    childSupportCapped: blendCapped('childSupport'),
  };

  // Attribution calculation
  let taxpayerPortions = { medical: 0, elderlySupport: 0, longTermCare: 0, childSupport: 0 };

  if (household.paymentAttribution === 'none') {
    taxpayerPortions = { medical: 0, elderlySupport: 0, longTermCare: 0, childSupport: 0 };
  } else if (household.paymentAttribution === 'fullHousehold') {
    taxpayerPortions = { ...householdPortions };
  } else if (household.paymentAttribution === 'taxpayerShare') {
    if (!household.taxpayerMember.isNHIInsured) {
      taxpayerPortions = { medical: 0, elderlySupport: 0, longTermCare: 0, childSupport: 0 };
    } else {
      const getPortionShare = (portion: NationalHealthInsurancePortionKey): number => {
        const portionData = currFY[portion];
        const blendedHouseholdAmount = householdPortions[portion];
        if (!portionData || blendedHouseholdAmount === 0) return 0;

        const rate = portionData.rate;
        const perCapitaAdult = portionData.perCapitaPerAdult;
        const perCapitaPreschool = portionData.perCapitaPerPreschool;
        const householdFlat = portionData.householdFlat;

        const insuredMembers = household.members.filter(m => m.isNHIInsured);
        if (insuredMembers.length === 0) return 0;

        if (portion === 'longTermCare') {
          const ltcMembers = insuredMembers.filter(m => m.isLtcCat2);
          if (ltcMembers.length === 0 || !household.taxpayerMember.isLtcCat2) return 0;
          const flatPerMember = householdFlat / ltcMembers.length;
          const memberUncapped = ltcMembers.map(
            m => m.calculationBase * rate + perCapitaAdult + flatPerMember,
          );
          const totalUncapped = memberUncapped.reduce((sum, u) => sum + u, 0);
          if (totalUncapped <= 0) return 0;
          const taxpayerUncapped =
            household.taxpayerMember.calculationBase * rate + perCapitaAdult + flatPerMember;
          return Math.round(blendedHouseholdAmount * (taxpayerUncapped / totalUncapped));
        }

        const flatPerMember = householdFlat / insuredMembers.length;
        const memberUncapped = insuredMembers.map(m => {
          let perCapita = perCapitaAdult;
          if (portion === 'childSupport') {
            perCapita = m.isChildSupportExempt ? 0 : perCapitaAdult;
          } else if (m.isPreschool) {
            perCapita = perCapitaPreschool;
          }
          return m.calculationBase * rate + perCapita + flatPerMember;
        });

        const totalUncapped = memberUncapped.reduce((sum, u) => sum + u, 0);
        if (totalUncapped <= 0) return 0;

        let tpPerCapita = perCapitaAdult;
        if (portion === 'childSupport') {
          tpPerCapita = household.taxpayerMember.isChildSupportExempt ? 0 : perCapitaAdult;
        } else if (household.taxpayerMember.isPreschool) {
          tpPerCapita = perCapitaPreschool;
        }
        const tpUncapped =
          household.taxpayerMember.calculationBase * rate + tpPerCapita + flatPerMember;
        return Math.round(blendedHouseholdAmount * (tpUncapped / totalUncapped));
      };

      taxpayerPortions = {
        medical: getPortionShare('medical'),
        elderlySupport: getPortionShare('elderlySupport'),
        longTermCare: getPortionShare('longTermCare'),
        childSupport: getPortionShare('childSupport'),
      };
    }
  }

  const taxpayerTotal =
    taxpayerPortions.medical +
    taxpayerPortions.elderlySupport +
    taxpayerPortions.longTermCare +
    taxpayerPortions.childSupport;

  const taxpayerBreakdown: NationalHealthInsuranceBreakdown = {
    medicalPortion: taxpayerPortions.medical,
    elderlySupportPortion: taxpayerPortions.elderlySupport,
    longTermCarePortion: taxpayerPortions.longTermCare,
    childSupportPortion: taxpayerPortions.childSupport,
    total: taxpayerTotal,
    reductionRatios: { prevFY: prevReductionRatio, currFY: currReductionRatio },
    medicalCapped:
      household.paymentAttribution === 'none' ? false : householdBreakdown.medicalCapped,
    elderlySupportCapped:
      household.paymentAttribution === 'none' ? false : householdBreakdown.elderlySupportCapped,
    longTermCareCapped:
      household.paymentAttribution === 'none' ? false : householdBreakdown.longTermCareCapped,
    childSupportCapped:
      household.paymentAttribution === 'none' ? false : householdBreakdown.childSupportCapped,
  };

  const summary: NHIHouseholdSummary = {
    insuredCount: household.insuredCount,
    ltcInsuredCount: household.ltcInsuredCount,
    preschoolCount: household.preschoolCount,
    childSupportExemptCount: household.childSupportExemptCount,
    calculationBase: household.calculationBase,
    ltcCalculationBase: household.ltcCalculationBase,
    isDeemedHead: household.isDeemedHead,
    householdHeadRelationship: household.householdHead.relationship,
    reductionTestIncome: household.reductionTestIncome,
    salaryEarnersCount: household.salaryEarnersCount,
    reductionRatios: { prevFY: prevReductionRatio, currFY: currReductionRatio },
    householdTotal,
    householdPortions,
    taxpayerTotal,
    taxpayerPortions,
    paymentAttribution: household.paymentAttribution,
    effectiveRegion: household.effectiveRegion,
  };

  return {
    householdBreakdown,
    taxpayerBreakdown,
    summary,
  };
}

/** Breakdown of 後期高齢者医療制度 premium components. */
export interface LatterStageElderlyBreakdown {
  medicalPortion: number;
  childSupportPortion: number;
  total: number;
  /**
   * Whether the medical portion has stopped rising with income. For a calendar year that
   * blends two fiscal years this needs both of them to be at their 賦課限度額: while only the
   * current one is capped, the previous fiscal year's third still grows.
   */
  medicalCapped: boolean;
}

const ZERO_LATTER_STAGE_BREAKDOWN: LatterStageElderlyBreakdown = {
  medicalPortion: 0,
  childSupportPortion: 0,
  total: 0,
  medicalCapped: false,
};

/**
 * Rates are published to 0.01% (e.g. 9.88%), so scaling by this factor turns every rate into
 * an integer and keeps 均等割額 + 所得割率 × base in integer arithmetic. Multiplying by the
 * decimal rate directly can land just below an exact ¥100 multiple (5,000,000 × 0.0928 =
 * 463,999.99999999994 in binary floating point), and the statutory floor would then lose ¥100.
 */
const RATE_SCALE = 1_000_000;

/** 均等割額 + 所得割率 × base, rounded down to ¥100 (100円未満切り捨て). */
function portionFlooredToHundred(perCapita: number, base: number, rate: number): number {
  const scaled = perCapita * RATE_SCALE + base * Math.round(rate * RATE_SCALE);
  return Math.floor(scaled / (RATE_SCALE * 100)) * 100;
}

/**
 * Premium for one fiscal year's parameters: per portion, 均等割額 + 所得割率 × base,
 * rounded down to ¥100 and capped at the portion's 賦課限度額, then summed.
 * The low-income 均等割軽減 (7/5/2割) and the 元被扶養者 reduction are not applied,
 * matching the calculator's current NHI treatment.
 */
function calculateLatterStagePremiumForParams(
  netIncome: number,
  params: LatterStageElderlyRegionParams,
): LatterStageElderlyBreakdown {
  const base = premiumCalculationBase(netIncome);

  const medicalPortion = Math.min(
    portionFlooredToHundred(params.medicalPerCapita, base, params.medicalRate),
    params.medicalCap,
  );

  const { childSupport } = params;
  const childSupportPortion = childSupport
    ? Math.min(
        portionFlooredToHundred(childSupport.perCapita, base, childSupport.rate),
        childSupport.cap,
      )
    : 0;

  return {
    medicalPortion,
    childSupportPortion,
    total: medicalPortion + childSupportPortion,
    medicalCapped: medicalPortion === params.medicalCap,
  };
}

/**
 * Calculates the annual 後期高齢者医療制度 premium for a calendar year.
 *
 * A calendar year straddles two fiscal years, and both collection routes weight them
 * 1/3 previous FY : 2/3 current FY:
 * - 特別徴収 (the default): six bimonthly pension deductions, April through February. The
 *   April, June, and August payments are 仮徴収, each set to the same amount as the
 *   previous February's deduction — the fiscal year's premium is only determined in July —
 *   and the October, December, and February 本徴収 payments make up the difference. Counting
 *   the calendar year's own February payment, four payments are at the previous fiscal
 *   year's level and the two in-year 本徴収 payments are large enough to cover the rest of
 *   the new annual total, which works out to 1/3 : 2/3.
 * - 普通徴収: nine installments, July through March (Tokyo), so January-March pay 3/9 of
 *   the previous fiscal year and July-December 6/9 of the current one — the same fraction.
 * Municipalities may smooth the June/August 仮徴収 (平準化) when the gap is large; that
 * shifts individual installments, not fiscal-year totals, and is not modeled.
 * Sources:
 * - https://www.city.tachikawa.lg.jp/kurashi/nenkin/1002477/1002485/1002501.html
 * - https://www.city.koto.lg.jp/250107/fukushi/kokikoresha/hokenryo/209.html
 *
 * When both fiscal years resolve to the same rate period the blend collapses to a single
 * calculation.
 */
export function calculateLatterStageElderlyPremium(
  netIncome: number,
  year: number,
  region: string,
): LatterStageElderlyBreakdown {
  // January resolves to the previous fiscal year's rates, April to the current ones.
  const prevFYParams = getLatterStageParamsForMonth(region, year, 0);
  const currFYParams = getLatterStageParamsForMonth(region, year, 3);

  if (!currFYParams) {
    console.error(
      `後期高齢者医療 parameters not found for region: ${region}. Returning zero breakdown.`,
    );
    return ZERO_LATTER_STAGE_BREAKDOWN;
  }

  const currFY = calculateLatterStagePremiumForParams(netIncome, currFYParams);
  if (!prevFYParams || prevFYParams.periodId === currFYParams.periodId) {
    return currFY;
  }

  const prevFY = calculateLatterStagePremiumForParams(netIncome, prevFYParams);
  const medicalPortion = Math.round(prevFY.medicalPortion / 3 + (currFY.medicalPortion * 2) / 3);
  const childSupportPortion = Math.round(
    prevFY.childSupportPortion / 3 + (currFY.childSupportPortion * 2) / 3,
  );
  return {
    medicalPortion,
    childSupportPortion,
    total: medicalPortion + childSupportPortion,
    medicalCapped: prevFY.medicalCapped && currFY.medicalCapped,
  };
}
