// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  type EmployeeProviderId,
} from '../data/employeesHealthInsurance/providerRateData';
import type { Prefecture } from '../data/prefectures';
import { STATUTORY_AGE_BANDS, type TaxpayerAgeRange, taxpayerAgeCoversBand } from './taxpayerAge';

export const NATIONAL_HEALTH_INSURANCE_ID = 'NationalHealthInsurance' as const;
export const DEPENDENT_COVERAGE_ID = 'DependentCoverage' as const;
export const CUSTOM_PROVIDER_ID = 'CustomProvider' as const;
export const LATTER_STAGE_ELDERLY_ID = 'LatterStageElderly' as const;
export const DEFAULT_PROVIDER = 'KyokaiKenpo' as const;

// Annual income thresholds for dependent coverage eligibility (被扶養者認定): under 1.3
// million yen as a base, 1.8 million yen for dependents aged 60 or over (or with a
// disability-pension-grade disability, which the calculator does not model).
//
// The statutory test is on 年間収入 — a social-insurance concept matching no tax figure: the
// PROSPECTIVE annual amount expected from the certification date onward (monthly guide
// 108,334円未満), counting gross pay including bonuses and 通勤手当 regardless of tax
// non-taxability, plus receipts the tax system ignores (公的年金 including 障害・遺族年金,
// 雇用保険の失業等給付, 傷病手当金・出産手当金). It is NOT the tax-side 合計所得金額.
//
// The 1.5 million yen band for ages 19-22 excluding spouses (effective 2025-10) is not
// modeled: its 19/23 boundaries do not align with the age ranges the calculator collects.
// Sources: https://www.nenkin.go.jp/service/kounen/tekiyo/hihokensha1/20141202.html
//          https://www.mhlw.go.jp/stf/taiou_001_00002.html
//          https://www.kyoukaikenpo.or.jp/about/business/dependent_status/001/index.html
export const DEPENDENT_INCOME_THRESHOLD = 1_300_000;
export const DEPENDENT_INCOME_THRESHOLD_ELDERLY = 1_800_000;

/** The dependent-coverage income threshold applicable to a {@link TaxpayerAgeRange}. */
export function getDependentIncomeThreshold(ageRange: TaxpayerAgeRange): number {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.elderlyDependentIncomeThreshold)
    ? DEPENDENT_INCOME_THRESHOLD_ELDERLY
    : DEPENDENT_INCOME_THRESHOLD;
}

// Exhaustive union type of all valid health insurance provider IDs
export type HealthInsuranceProviderId =
  | EmployeeProviderId
  | typeof NATIONAL_HEALTH_INSURANCE_ID
  | typeof DEPENDENT_COVERAGE_ID
  | typeof CUSTOM_PROVIDER_ID
  | typeof LATTER_STAGE_ELDERLY_ID;

/**
 * Every provider id other than the 後期高齢者医療制度, whose premium is assessed on income by
 * its own module rather than by the shared health insurance calculation. Narrowing a
 * parameter to this makes handing 後期高齢者医療 to that calculation a compile error, where it
 * would otherwise find no rates for any month and quietly total zero.
 */
export type NonLatterStageProviderId = Exclude<
  HealthInsuranceProviderId,
  typeof LATTER_STAGE_ELDERLY_ID
>;

/**
 * Whether the id names one of the employee health insurance providers in
 * {@link PROVIDER_DEFINITIONS}, as opposed to one of the ids standing for a coverage type of
 * its own ({@link NATIONAL_HEALTH_INSURANCE_ID}, {@link DEPENDENT_COVERAGE_ID},
 * {@link CUSTOM_PROVIDER_ID}, {@link LATTER_STAGE_ELDERLY_ID}).
 *
 * The test is membership in {@link PROVIDER_DEFINITIONS} rather than a list of the other ids,
 * so a further coverage type added to {@link HealthInsuranceProviderId} is excluded here
 * without any edit, and the call sites that pair this guard with a switch over the remaining
 * ids stop compiling until they handle it.
 */
export function isEmployeeHealthProvider(id: HealthInsuranceProviderId): id is EmployeeProviderId {
  return getProviderDefinition(id) !== undefined;
}

/**
 * Checks if dependent coverage is eligible against the age-dependent 年間収入 threshold
 * ({@link getDependentIncomeThreshold}).
 *
 * @param grossAnnualIncome  Stands in for the statutory 年間収入 (see
 *   {@link DEPENDENT_INCOME_THRESHOLD}). Callers pass the form's gross annual income —
 *   annualized salary plus bonuses and face-value business/miscellaneous amounts — which
 *   understates 年間収入 where commuting allowance exists (the form excludes it from annual
 *   income) or where the person receives benefits the calculator does not model.
 */
export function isDependentCoverageEligible(
  grossAnnualIncome: number,
  ageRange: TaxpayerAgeRange,
): boolean {
  return grossAnnualIncome < getDependentIncomeThreshold(ageRange);
}

/**
 * Get the display name for any health insurance provider ID
 */
export function getProviderDisplayName(providerId: HealthInsuranceProviderId): string {
  if (isEmployeeHealthProvider(providerId)) {
    return PROVIDER_DEFINITIONS[providerId].providerName;
  }

  switch (providerId) {
    case NATIONAL_HEALTH_INSURANCE_ID:
      return 'National Health Insurance';
    case DEPENDENT_COVERAGE_ID:
      return 'None (dependent of insured employee)';
    case CUSTOM_PROVIDER_ID:
      return 'Custom Employee Health Insurance Provider';
    case LATTER_STAGE_ELDERLY_ID:
      return 'Medical System for the Elderly (75+)';
    default: {
      const unhandledProvider: never = providerId;
      throw new Error(`Unknown provider ID: ${JSON.stringify(unhandledProvider)}`);
    }
  }
}

// A generic type for region. Can be a specific enum or a string for flexibility.
// For providers without distinct regions, you might use a conventional default string.
export type ProviderRegion = string;

export const DEFAULT_PROVIDER_REGION = 'DEFAULT';

/**
 * Parameters for calculating National Health Insurance (NHI) premiums.
 * These values vary by municipality.
 * All rates are annual. Caps are annual. Per-capita amounts are annual.
 */
export interface NationalHealthInsuranceRegionParams {
  regionName: string; // For display or reference, e.g., "Tokyo Special Wards Average"
  // Source information
  source?: string; // URL or reference to the official source for these parameters
  // Income-based portion (所得割) rates
  medicalRate: number; // 医療分保険料率 (e.g., 7.71%)
  supportRate: number; // 後期高齢者支援金等分保険料率 (e.g., 2.69%)
  ltcRateForEligible?: number; // 介護納付金分保険料率 (for those 40-64, e.g., 2.25%)
  // Per-capita portion (均等割) annual amounts
  medicalPerCapita: number; // 医療分均等割額 (e.g., 47,300 JPY)
  supportPerCapita: number; // 後期高齢者支援金等分均等割額 (e.g., 16,800 JPY)
  ltcPerCapitaForEligible?: number; // 介護納付金分均等割額 (e.g., 16,600 JPY)
  // Household flat rate portion (平等割) annual amounts - defaults to 0 if not specified
  medicalHouseholdFlat?: number; // 医療分平等割額 (e.g., 33,574 JPY) - per household
  supportHouseholdFlat?: number; // 後期高齢者支援金等分平等割額 (e.g., 10,761 JPY) - per household
  ltcHouseholdFlatForEligible?: number; // 介護納付金分平等割額 (e.g., 0 JPY) - per household
  // Annual caps for the income-based portion
  medicalCap: number; // 医療分賦課限度額 (e.g., 660,000 JPY)
  supportCap: number; // 後期高齢者支援金等分賦課限度額 (e.g., 260,000 JPY)
  ltcCapForEligible?: number; // 介護納付金分賦課限度額 (e.g., 170,000 JPY)
  // Child/childcare support levy (子ども・子育て支援納付金分) — introduced FY2026
  childSupportRate?: number; // 子ども・子育て支援納付金分所得割率 (e.g., 0.27%)
  childSupportPerCapita?: number; // 子ども・子育て支援納付金分均等割額 (e.g., 73 JPY)
  childSupportHouseholdFlat?: number; // 子ども・子育て支援納付金分平等割額
  childSupportCap?: number; // 子ども・子育て支援納付金分賦課限度額 (e.g., 30,000 JPY)
  // Standard deduction used for calculating NHI taxable income (e.g., 430,000 JPY, often same as residence tax basic deduction)
  nhiStandardDeduction: number;
}

/**
 * A rate period with an effective date and the NHI parameters for that period.
 */
export interface NHIRatePeriod {
  /**
   * The month from which these rates take effect.
   * Month is 0-indexed (0=Jan, 3=Apr). NHI rates typically change in April (month 3).
   */
  effectiveFrom: { year: number; month: number };
  params: Omit<NationalHealthInsuranceRegionParams, 'regionName'>;
}

/**
 * NHI region definition with metadata and time-series rate periods.
 */
export interface NHIRegionDefinition {
  regionName: string;
  /** Rate periods sorted newest-first. Use getNHIParamsForMonth() for lookup. */
  periods: NHIRatePeriod[];
}

/**
 * Parameters for calculating 後期高齢者医療制度 premiums. Rates are uniform across each
 * prefecture (set by its 広域連合 on a two-year cycle). The premium is per-portion:
 * 均等割額 + 所得割率 × (総所得金額等 − 基礎控除), each portion rounded down to ¥100 and
 * capped at its 賦課限度額, then summed.
 * Source: https://www.tokyo-ikiiki.net/seido/1001968/1002520.html (rounding/portions)
 */
export interface LatterStageElderlyRegionParams {
  regionName: string;
  /**
   * Identifies the rate period these parameters come from. Two lookups that return the same
   * id carry the same rates, including any field a future rate cycle adds.
   */
  periodId: string;
  // Medical portion (医療分)
  medicalPerCapita: number; // 均等割額 (annual)
  medicalRate: number; // 所得割率 (e.g. 0.0988)
  medicalCap: number; // 賦課限度額
  /**
   * Child/childcare support levy (子ども・子育て支援納付金分), introduced FY2026 and so
   * absent for earlier rate periods. Its three numbers always arrive together.
   */
  childSupport?: {
    perCapita: number; // 均等割額 (annual)
    rate: number; // 所得割率
    cap: number; // 賦課限度額
  };
}

/**
 * The estimated 介護保険 第1号被保険者 premium (`estimateLongTermCareCategory1Premium` in
 * longTermCareCategory1.ts) and the parameters behind it, for display alongside the figure.
 */
export interface LongTermCareCategory1Estimate {
  /**
   * The 所得段階 under the national standard, 1-13. Judged with the fiscal year starting in the
   * modeled calendar year, as are {@link multiplier}, {@link annualBase}, and
   * {@link baseScope}; {@link total} additionally blends in the previous fiscal year, so
   * around a boundary that moved a tier it can differ from 基準額 × 乗率.
   */
  tier: number;
  multiplier: number;
  /** Annual 基準額 the estimate scaled (average monthly 基準額 × 12). */
  annualBase: number;
  /**
   * Whose average {@link annualBase} is: the prefecture the selected region resolved to, or
   * 'national' when it carries none. No prefecture is keyed 'national', so comparing against
   * it narrows the other branch to a {@link Prefecture}.
   */
  baseScope: Prefecture | 'national';
  /** Estimated annual premium for the calendar year. Always positive. */
  total: number;
}
