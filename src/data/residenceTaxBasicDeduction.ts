// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Residence tax basic deduction (住民税の基礎控除) tiers.
 *
 * The deduction is set by the taxpayer's net income (合計所得金額); net income above the last
 * tier's `maxIncomeInclusive` yields a deduction of 0. Unlike the national basic deduction these
 * amounts are not year-indexed.
 *
 * Single source of truth shared by {@link calculateResidenceTaxBasicDeduction}, the tooltip
 * reference table, and its current-row highlight, so the three cannot drift apart.
 *
 * Source: 令和3年度税制改正 (2021 Tax Reform) — e.g.
 * https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/zeikin/y-shizei/kojin-shiminzei-kenminzei/kaisei/R3zeiseikaisei.html#4
 */

export interface ResidenceTaxBasicDeductionTier {
  /** Maximum net income (inclusive) for this tier, in yen. */
  maxIncomeInclusive: number;
  /** Deduction amount in yen. */
  deduction: number;
}

/** Tiers in ascending order of `maxIncomeInclusive`; above the last one the deduction is 0. */
export const RESIDENCE_TAX_BASIC_DEDUCTION_TIERS: ReadonlyArray<ResidenceTaxBasicDeductionTier> = [
  { maxIncomeInclusive: 24_000_000, deduction: 430_000 },
  { maxIncomeInclusive: 24_500_000, deduction: 290_000 },
  { maxIncomeInclusive: 25_000_000, deduction: 150_000 },
  // Above 25,000,000: deduction = 0
];

/**
 * The basic deduction (基礎控除) for a net income, from {@link RESIDENCE_TAX_BASIC_DEDUCTION_TIERS}
 * (net income above the last tier → 0). Used for residence tax and, by reference in the
 * 高齢者の医療の確保に関する法律, for the 後期高齢者医療 premium base.
 */
export const calculateResidenceTaxBasicDeduction = (netIncome: number): number => {
  for (const tier of RESIDENCE_TAX_BASIC_DEDUCTION_TIERS) {
    if (netIncome <= tier.maxIncomeInclusive) return tier.deduction;
  }
  return 0;
};
