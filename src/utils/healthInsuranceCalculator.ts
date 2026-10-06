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
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type {
  ProviderRegion,
  NationalHealthInsuranceRegionParams,
  LatterStageElderlyRegionParams,
  NonLatterStageProviderId,
} from '../types/healthInsurance';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
} from '../types/healthInsurance';
import type { BonusIncomeStream, CustomEmployeesHealthInsuranceRates } from '../types/tax';

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

/** One portion of a National Health Insurance premium for one fiscal year's parameters. */
export interface NationalHealthInsurancePortion {
  /** The 所得割率. */
  rate: number;
  /** 所得割: the calculation base times {@link rate}. */
  incomeBased: number;
  /** 均等割額. */
  perCapita: number;
  /** 平等割額, 0 where the region levies none. */
  householdFlat: number;
  /** The three added, before the 賦課限度額. */
  uncapped: number;
  /** 賦課限度額. */
  cap: number;
  /** The lower of {@link uncapped} and {@link cap}, before rounding to yen. */
  premium: number;
  /** {@link premium} rounded to yen: the portion for the fiscal year. */
  amount: number;
  /** Whether {@link uncapped} reached {@link cap}, so that more income would not raise the portion. */
  capped: boolean;
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
): NationalHealthInsurancePortion | undefined {
  const fields = NHI_PORTION_FIELDS[portion];
  const rate = params[fields.rate];
  const cap = params[fields.cap];
  if (!rate || !cap) return undefined;

  const perCapita = params[fields.perCapita] ?? 0;
  const householdFlat = params[fields.householdFlat] ?? 0;
  const incomeBased = calculationBase * rate;
  const uncapped = incomeBased + perCapita + householdFlat;
  const premium = Math.min(uncapped, cap);
  return {
    rate,
    incomeBased,
    perCapita,
    householdFlat,
    uncapped,
    cap,
    premium,
    amount: Math.round(premium),
    capped: uncapped >= cap,
  };
}

/**
 * Whether a portion's own parameters differ between two fiscal years' parameters, so that the
 * portion's amount can differ between the two years.
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
  provider: NonLatterStageProviderId,
  year: number,
  region: ProviderRegion = DEFAULT_PROVIDER_REGION,
  customRates?: CustomEmployeesHealthInsuranceRates,
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

type FiscalYearPortions = Record<
  NationalHealthInsurancePortionKey,
  NationalHealthInsurancePortion | undefined
>;

/**
 * Every portion for one fiscal year's parameters. The 介護納付金分 is levied on a Category 2
 * insured person (ages 40-64) only.
 */
function calculateFiscalYearPortions(
  annualIncome: number,
  isSubjectToLongTermCarePremium: boolean,
  params: NationalHealthInsuranceRegionParams,
): FiscalYearPortions {
  const base = premiumCalculationBase(annualIncome);
  return {
    medical: calculateNationalHealthInsurancePortion(base, params, 'medical'),
    elderlySupport: calculateNationalHealthInsurancePortion(base, params, 'elderlySupport'),
    longTermCare: isSubjectToLongTermCarePremium
      ? calculateNationalHealthInsurancePortion(base, params, 'longTermCare')
      : undefined,
    childSupport: calculateNationalHealthInsurancePortion(base, params, 'childSupport'),
  };
}

/**
 * Calculates National Health Insurance premium breakdown based on regional parameters. The total
 * is the sum of the portions before rounding, rounded once.
 */
function calculateNationalHealthInsurancePremiumBreakdown(
  annualIncome: number,
  isSubjectToLongTermCarePremium: boolean, // Person is 40-64 years old
  params: NationalHealthInsuranceRegionParams,
): NationalHealthInsuranceBreakdown {
  const { medical, elderlySupport, longTermCare, childSupport } = calculateFiscalYearPortions(
    annualIncome,
    isSubjectToLongTermCarePremium,
    params,
  );

  const totalPremium =
    (medical?.premium ?? 0) +
    (elderlySupport?.premium ?? 0) +
    (longTermCare?.premium ?? 0) +
    (childSupport?.premium ?? 0);

  return {
    medicalPortion: medical?.amount ?? 0,
    elderlySupportPortion: elderlySupport?.amount ?? 0,
    longTermCarePortion: longTermCare?.amount ?? 0,
    childSupportPortion: childSupport?.amount ?? 0,
    total: Math.round(totalPremium),
    medicalCapped: medical?.capped ?? false,
    elderlySupportCapped: elderlySupport?.capped ?? false,
    longTermCareCapped: longTermCare?.capped ?? false,
    childSupportCapped: childSupport?.capped ?? false,
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
      medicalCapped: false,
      elderlySupportCapped: false,
      longTermCareCapped: false,
      childSupportCapped: false,
    };
  }

  // If both fiscal years have the same params (no rate change), use single calculation
  // to avoid rounding artifacts from the blending arithmetic.
  if (!prevFYParams || !nhiParamsDiffer(prevFYParams, currFYParams)) {
    return calculateNationalHealthInsurancePremiumBreakdown(
      annualIncome,
      isSubjectToLongTermCarePremium,
      currFYParams,
    );
  }

  // Calculate every portion for each fiscal year
  const prevFY = calculateFiscalYearPortions(
    annualIncome,
    isSubjectToLongTermCarePremium,
    prevFYParams,
  );
  const currFY = calculateFiscalYearPortions(
    annualIncome,
    isSubjectToLongTermCarePremium,
    currFYParams,
  );

  // Blend: 3/10 of previous FY + 7/10 of current FY (10-installment payment schedule), from each
  // fiscal year's rounded amount
  const blend = (portion: NationalHealthInsurancePortionKey): number =>
    Math.round(
      ((prevFY[portion]?.amount ?? 0) * 3) / 10 + ((currFY[portion]?.amount ?? 0) * 7) / 10,
    );
  // A portion has stopped rising with income once every fiscal year that levies it has it at its
  // 賦課限度額; one that neither year levies has nothing to cap.
  const blendCapped = (portion: NationalHealthInsurancePortionKey): boolean => {
    const levied = [prevFY[portion], currFY[portion]].filter(
      (fiscalYear): fiscalYear is NationalHealthInsurancePortion => fiscalYear !== undefined,
    );
    return levied.length > 0 && levied.every(fiscalYear => fiscalYear.capped);
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
    medicalCapped: blendCapped('medical'),
    elderlySupportCapped: blendCapped('elderlySupport'),
    longTermCareCapped: blendCapped('longTermCare'),
    childSupportCapped: blendCapped('childSupport'),
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
