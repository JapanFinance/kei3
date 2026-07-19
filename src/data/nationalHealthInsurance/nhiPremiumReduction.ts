// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * National Health Insurance low-income premium reduction (均等割額・平等割額の軽減) thresholds.
 *
 * Households whose total income (総所得金額等) is at or below statutory thresholds have the
 * per-capita (均等割) and household flat rate (平等割) portions of the premium reduced by
 * 70%, 50%, or 20%. The ratios and thresholds are set nationally (国民健康保険法施行令
 * 第29条の7) and revised per fiscal year; municipalities apply the reduction automatically
 * based on declared income — no application is required. The reduction covers every levy
 * component, including the 子ども・子育て支援金分 introduced in FY2026.
 *
 * Sources:
 * - https://laws.e-gov.go.jp/law/333CO0000000362 (国民健康保険法施行令)
 * - https://www.city.setagaya.lg.jp/02060/300.html (令和8年度 thresholds)
 * - https://www.city.nara.lg.jp/site/kokuminkenkouhoken/9305.html (令和6〜8年度 threshold
 *   series; also confirms the reduction covers 平等割 and the 子ども・子育て支援金分)
 */

export interface NHIPremiumReductionThresholds {
  /** The date from which these thresholds apply (inclusive). Month is 0-indexed (3 = April). */
  effectiveFrom: { year: number; month: number };
  /** Base amount included in every tier's threshold (基礎控除相当の43万円). */
  baseAmount: number;
  /** 5割軽減: additional allowance per insured household member (被保険者数). */
  fiftyPercentPerInsured: number;
  /** 2割軽減: additional allowance per insured household member (被保険者数). */
  twentyPercentPerInsured: number;
  /**
   * Additional allowance of 10万円 × (給与所得者等の数 − 1), included in every tier when the
   * household has two or more salary or public-pension earners. Zero for the single-earner
   * household this calculator models.
   */
  perAdditionalSalaryEarner: number;
}

/**
 * Time-series of reduction thresholds, sorted newest-first. These are national values, not
 * per-region: municipalities may not vary them (per-municipality variation lives entirely in
 * the 均等割/平等割 amounts being reduced).
 *
 * The series starts at FY2025 to match the oldest per-region NHI parameters — both lookups
 * fall back to their oldest entry, so January–March of 2025 is approximated with FY2025
 * values consistently. FY2024 (令和6年度) used 295,000 / 545,000; add it if the per-region
 * parameters ever extend back that far.
 */
export const NHI_PREMIUM_REDUCTION_PERIODS: ReadonlyArray<NHIPremiumReductionThresholds> = [
  // FY2026 (令和8年度): April 2026 – March 2027
  {
    effectiveFrom: { year: 2026, month: 3 },
    baseAmount: 430_000,
    fiftyPercentPerInsured: 310_000,
    twentyPercentPerInsured: 570_000,
    perAdditionalSalaryEarner: 100_000,
  },
  // FY2025 (令和7年度): April 2025 – March 2026
  {
    effectiveFrom: { year: 2025, month: 3 },
    baseAmount: 430_000,
    fiftyPercentPerInsured: 305_000,
    twentyPercentPerInsured: 560_000,
    perAdditionalSalaryEarner: 100_000,
  },
];

if (import.meta.env.DEV) {
  for (let i = 1; i < NHI_PREMIUM_REDUCTION_PERIODS.length; i++) {
    const prev = NHI_PREMIUM_REDUCTION_PERIODS[i - 1]!.effectiveFrom;
    const curr = NHI_PREMIUM_REDUCTION_PERIODS[i]!.effectiveFrom;
    if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
      throw new Error(
        `NHI_PREMIUM_REDUCTION_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
      );
    }
  }
}

/**
 * Returns the reduction thresholds in effect for a given year and month.
 * Falls back to the oldest known thresholds for earlier dates, mirroring
 * getNHIParamsForMonth so both lookups approximate missing history the same way.
 *
 * @param year Calendar year
 * @param month 0-indexed month (0=Jan, 11=Dec)
 */
export function getNHIPremiumReductionThresholdsForMonth(
  year: number,
  month: number,
): NHIPremiumReductionThresholds {
  for (const period of NHI_PREMIUM_REDUCTION_PERIODS) {
    const { effectiveFrom } = period;
    if (
      year > effectiveFrom.year ||
      (year === effectiveFrom.year && month >= effectiveFrom.month)
    ) {
      return period;
    }
  }
  return NHI_PREMIUM_REDUCTION_PERIODS[NHI_PREMIUM_REDUCTION_PERIODS.length - 1]!;
}
