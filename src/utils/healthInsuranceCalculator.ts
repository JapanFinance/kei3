// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  calculateMonthlyEmployeePremium,
  getRegionalRatesForMonth,
} from '../data/employeesHealthInsurance/providerRates';
import { findSMRBracket } from '../data/employeesHealthInsurance/smrBrackets';
import { getLatterStageParamsForMonth } from '../data/latterStageElderlyParams';
import { getNHIParamsForMonth } from '../data/nationalHealthInsurance/nhiParamsData';
import { RESIDENCE_TAX_BASIC_DEDUCTION_TIERS } from '../data/residenceTaxBasicDeduction';
import type {
  ProviderRegion,
  NationalHealthInsuranceRegionParams,
  LatterStageElderlyRegionParams,
  HealthInsuranceProviderId,
} from '../types/healthInsurance';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
} from '../types/healthInsurance';
import type { BonusIncomeStream } from '../types/tax';
import { roundSocialInsurancePremium } from './taxCalculations';

/**
 * Breakdown of National Health Insurance premium components
 */
export interface NationalHealthInsuranceBreakdown {
  medicalPortion: number;
  elderlySupportPortion: number;
  longTermCarePortion: number;
  childSupportPortion: number;
  total: number;
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
  provider: HealthInsuranceProviderId,
  year: number,
  region: ProviderRegion = DEFAULT_PROVIDER_REGION,
  customRates?: { healthRate: number; ltcRate: number },
  bonuses: BonusIncomeStream[] = [],
): HealthInsuranceBreakdown {
  if (annualIncome < 0) {
    throw new Error('Income cannot be negative.');
  }

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
  } else {
    const monthlyIncome = annualIncome / 12;

    // Find the SMR bracket for this income (findSMRBracket always returns one: the
    // brackets cover [0, ∞) and it throws on negative income).
    const smrBracket = findSMRBracket(monthlyIncome);

    if (provider === CUSTOM_PROVIDER_ID) {
      if (!customRates) {
        // Fallback if custom rates are missing but provider is custom
        return { total: 0, bonusPortion: 0 };
      }
      const staticRates = {
        employeeHealthInsuranceRate: customRates.healthRate / 100,
        employeeLongTermCareRate: customRates.ltcRate / 100,
        employerHealthInsuranceRate: 0,
        employerLongTermCareRate: 0,
      };

      // Custom rates don't vary by month
      const monthlyPremium = calculateMonthlyEmployeePremium(
        smrBracket.smrAmount,
        staticRates,
        isSubjectToLongTermCarePremium,
      );
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

    // Calculate per-month premiums — rate may differ by month within a calendar year
    let totalPremium = 0;
    for (let month = 0; month < 12; month++) {
      const monthRates = getRegionalRatesForMonth(provider, region, year, month);
      if (monthRates) {
        totalPremium += calculateMonthlyEmployeePremium(
          smrBracket.smrAmount,
          monthRates,
          isSubjectToLongTermCarePremium,
        );
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
  providerOrRates:
    | string
    | { employeeHealthInsuranceRate: number; employeeLongTermCareRate: number },
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

    const rate =
      rates.employeeHealthInsuranceRate + (includeLTC ? rates.employeeLongTermCareRate : 0);
    const premium = roundSocialInsurancePremium(standardBonusAmount * rate);

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

/**
 * Calculates the annual health insurance premium.
 *
 * @param annualIncome total annual income (gross for employees health insurance, net for NHI)
 * @param isSubjectToLongTermCarePremium True if the person is required to pay long-term care insurance
 * premiums as a Category 2 insured (介護保険第２号被保険者). This applies to people aged 40-64.
 * @param provider The health insurance provider.
 * @param region The region for the provider.
 * @param customRates Custom rates if provider is custom.
 * @param bonuses List of bonus payments.
 * @returns The annual health insurance premium.
 */
export function calculateHealthInsurancePremium(
  annualIncome: number,
  isSubjectToLongTermCarePremium: boolean,
  provider: HealthInsuranceProviderId,
  year: number,
  region: ProviderRegion = DEFAULT_PROVIDER_REGION,
  customRates?: { healthRate: number; ltcRate: number },
  bonuses: BonusIncomeStream[] = [],
): number {
  return calculateHealthInsuranceBreakdown(
    annualIncome,
    isSubjectToLongTermCarePremium,
    provider,
    year,
    region,
    customRates,
    bonuses,
  ).total;
}

/**
 * Calculates National Health Insurance premium breakdown based on regional parameters.
 */
function calculateNationalHealthInsurancePremiumBreakdown(
  annualIncome: number,
  isSubjectToLongTermCarePremium: boolean, // Person is 40-64 years old
  params: NationalHealthInsuranceRegionParams,
): NationalHealthInsuranceBreakdown {
  // Calculate NHI taxable income (住民税算定基礎額等 - often previous year's income minus a standard deduction)
  // For simplicity, using current annual income minus the NHI standard deduction.
  // Real-world calculations might use prior year's certified income.
  const nhiTaxableIncome = Math.max(0, annualIncome - params.nhiStandardDeduction);

  // 1. Medical Portion (医療分)
  const incomeBasedMedical = nhiTaxableIncome * params.medicalRate;
  const perCapitaMedical = params.medicalPerCapita;
  const householdFlatMedical = params.medicalHouseholdFlat || 0;
  const totalMedicalPremium = Math.min(
    incomeBasedMedical + perCapitaMedical + householdFlatMedical,
    params.medicalCap,
  );

  // 2. Elderly Support Portion (後期高齢者支援金分)
  const incomeBasedSupport = nhiTaxableIncome * params.supportRate;
  const perCapitaSupport = params.supportPerCapita;
  const householdFlatSupport = params.supportHouseholdFlat || 0;
  const totalSupportPremium = Math.min(
    incomeBasedSupport + perCapitaSupport + householdFlatSupport,
    params.supportCap,
  );

  // 3. Long-Term Care Portion (介護納付金分) - only for those aged 40-64
  let totalLtcPremium = 0;
  if (
    isSubjectToLongTermCarePremium &&
    params.ltcRateForEligible &&
    params.ltcPerCapitaForEligible &&
    params.ltcCapForEligible
  ) {
    const incomeBasedLtc = nhiTaxableIncome * params.ltcRateForEligible;
    const perCapitaLtc = params.ltcPerCapitaForEligible;
    const householdFlatLtc = params.ltcHouseholdFlatForEligible || 0;
    totalLtcPremium = Math.min(
      incomeBasedLtc + perCapitaLtc + householdFlatLtc,
      params.ltcCapForEligible,
    );
  }

  // 4. Child/Childcare Support Portion (子ども・子育て支援納付金分) - from FY2026
  let totalChildSupportPremium = 0;
  if (params.childSupportRate && params.childSupportCap) {
    const incomeBasedChildSupport = nhiTaxableIncome * params.childSupportRate;
    const perCapitaChildSupport = params.childSupportPerCapita || 0;
    const householdFlatChildSupport = params.childSupportHouseholdFlat || 0;
    totalChildSupportPremium = Math.min(
      incomeBasedChildSupport + perCapitaChildSupport + householdFlatChildSupport,
      params.childSupportCap,
    );
  }

  const totalPremium =
    totalMedicalPremium + totalSupportPremium + totalLtcPremium + totalChildSupportPremium;

  return {
    medicalPortion: Math.round(totalMedicalPremium),
    elderlySupportPortion: Math.round(totalSupportPremium),
    longTermCarePortion: Math.round(totalLtcPremium),
    childSupportPortion: Math.round(totalChildSupportPremium),
    total: Math.round(totalPremium),
  };
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
 * When both fiscal years resolve to the same parameters (no rate change), this produces
 * the same result as a single-FY calculation (3/10 + 7/10 = 1).
 */
export function calculateNationalHealthInsurancePremiumWithBreakdown(
  annualIncome: number,
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
    };
  }

  // If both fiscal years have the same params (no rate change), use single calculation
  // to avoid rounding artifacts from the blending arithmetic.
  if (!prevFYParams || prevFYParams === currFYParams) {
    return calculateNationalHealthInsurancePremiumBreakdown(
      annualIncome,
      isSubjectToLongTermCarePremium,
      currFYParams,
    );
  }

  // Check if the params are actually different by comparing key rate fields
  const paramsMatch =
    prevFYParams.medicalRate === currFYParams.medicalRate &&
    prevFYParams.supportRate === currFYParams.supportRate &&
    prevFYParams.medicalPerCapita === currFYParams.medicalPerCapita &&
    prevFYParams.supportPerCapita === currFYParams.supportPerCapita &&
    prevFYParams.medicalCap === currFYParams.medicalCap &&
    prevFYParams.supportCap === currFYParams.supportCap &&
    prevFYParams.ltcRateForEligible === currFYParams.ltcRateForEligible &&
    prevFYParams.ltcPerCapitaForEligible === currFYParams.ltcPerCapitaForEligible &&
    prevFYParams.ltcCapForEligible === currFYParams.ltcCapForEligible &&
    prevFYParams.childSupportRate === currFYParams.childSupportRate &&
    prevFYParams.childSupportPerCapita === currFYParams.childSupportPerCapita &&
    prevFYParams.childSupportCap === currFYParams.childSupportCap;

  if (paramsMatch) {
    return calculateNationalHealthInsurancePremiumBreakdown(
      annualIncome,
      isSubjectToLongTermCarePremium,
      currFYParams,
    );
  }

  // Calculate full annual breakdown for each fiscal year
  const prevFY = calculateNationalHealthInsurancePremiumBreakdown(
    annualIncome,
    isSubjectToLongTermCarePremium,
    prevFYParams,
  );
  const currFY = calculateNationalHealthInsurancePremiumBreakdown(
    annualIncome,
    isSubjectToLongTermCarePremium,
    currFYParams,
  );

  // Blend: 3/10 of previous FY + 7/10 of current FY (10-installment payment schedule)
  const medicalPortion = Math.round(
    (prevFY.medicalPortion * 3) / 10 + (currFY.medicalPortion * 7) / 10,
  );
  const elderlySupportPortion = Math.round(
    (prevFY.elderlySupportPortion * 3) / 10 + (currFY.elderlySupportPortion * 7) / 10,
  );
  const longTermCarePortion = Math.round(
    (prevFY.longTermCarePortion * 3) / 10 + (currFY.longTermCarePortion * 7) / 10,
  );
  const childSupportPortion = Math.round(
    (prevFY.childSupportPortion * 3) / 10 + (currFY.childSupportPortion * 7) / 10,
  );
  const total = medicalPortion + elderlySupportPortion + longTermCarePortion + childSupportPortion;

  return { medicalPortion, elderlySupportPortion, longTermCarePortion, childSupportPortion, total };
}

/** Breakdown of 後期高齢者医療制度 premium components. */
export interface LatterStageElderlyBreakdown {
  medicalPortion: number;
  childSupportPortion: number;
  total: number;
}

const ZERO_LATTER_STAGE_BREAKDOWN: LatterStageElderlyBreakdown = {
  medicalPortion: 0,
  childSupportPortion: 0,
  total: 0,
};

/**
 * The 賦課のもととなる所得金額: 総所得金額等 minus the 地方税法 basic deduction (43万円,
 * stepping down above 合計所得金額 2,400万円 like the residence-tax basic deduction).
 * Source: https://www.tokyo-ikiiki.net/seido/1001968/1001975/index.html
 */
function latterStagePremiumBase(netIncome: number): number {
  let deduction = 0;
  for (const tier of RESIDENCE_TAX_BASIC_DEDUCTION_TIERS) {
    if (netIncome <= tier.maxIncomeInclusive) {
      deduction = tier.deduction;
      break;
    }
  }
  return Math.max(0, netIncome - deduction);
}

const floorToHundred = (value: number): number => Math.floor(value / 100) * 100;

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
  const base = latterStagePremiumBase(netIncome);

  const medicalPortion = Math.min(
    floorToHundred(params.medicalPerCapita + base * params.medicalRate),
    params.medicalCap,
  );

  let childSupportPortion = 0;
  if (params.childSupportRate !== undefined && params.childSupportCap !== undefined) {
    childSupportPortion = Math.min(
      floorToHundred((params.childSupportPerCapita ?? 0) + base * params.childSupportRate),
      params.childSupportCap,
    );
  }

  return {
    medicalPortion,
    childSupportPortion,
    total: medicalPortion + childSupportPortion,
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
 *   and the October/December/February 本徴収 payments absorb the entire true-up. Counting
 *   the calendar year's own February payment, four payments sit at the previous fiscal
 *   year's level and the two in-year 本徴収 payments over-correct toward the new annual
 *   total, netting to 1/3 : 2/3.
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
  region?: string,
): LatterStageElderlyBreakdown {
  const regionKey = region as string;
  // January resolves to the previous fiscal year's rates, April to the current ones.
  const prevFYParams = getLatterStageParamsForMonth(regionKey, year, 0);
  const currFYParams = getLatterStageParamsForMonth(regionKey, year, 3);

  if (!currFYParams) {
    console.error(
      `後期高齢者医療 parameters not found for region: ${region}. Returning zero breakdown.`,
    );
    return ZERO_LATTER_STAGE_BREAKDOWN;
  }

  const currFY = calculateLatterStagePremiumForParams(netIncome, currFYParams);
  if (
    !prevFYParams ||
    (prevFYParams.medicalPerCapita === currFYParams.medicalPerCapita &&
      prevFYParams.medicalRate === currFYParams.medicalRate &&
      prevFYParams.medicalCap === currFYParams.medicalCap &&
      prevFYParams.childSupportPerCapita === currFYParams.childSupportPerCapita &&
      prevFYParams.childSupportRate === currFYParams.childSupportRate &&
      prevFYParams.childSupportCap === currFYParams.childSupportCap)
  ) {
    return currFY;
  }

  const prevFY = calculateLatterStagePremiumForParams(netIncome, prevFYParams);
  const medicalPortion = Math.round(
    (prevFY.medicalPortion * 1) / 3 + (currFY.medicalPortion * 2) / 3,
  );
  const childSupportPortion = Math.round(
    (prevFY.childSupportPortion * 1) / 3 + (currFY.childSupportPortion * 2) / 3,
  );
  return {
    medicalPortion,
    childSupportPortion,
    total: medicalPortion + childSupportPortion,
  };
}
