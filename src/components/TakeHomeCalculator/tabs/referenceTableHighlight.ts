// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Pure helpers that map a taxpayer's figures onto the row index of the statutory reference tables
 * rendered in the tax tooltips, so {@link import('../../ui/ReferenceTable').default} can highlight
 * the applicable row. Each helper returns an index into the DISPLAYED rows (which are not always the
 * raw statutory tiers — some are deduplicated or have an extra row appended), and each mirrors the
 * exact inclusive/exclusive boundaries of the calculation it describes.
 */

import type { BasicDeductionTier } from '../../../data/nationalBasicDeduction';

/**
 * The national basic-deduction tooltip collapses consecutive tiers that share a deduction amount
 * into a single "Up to X" row. This returns the surviving tiers in display order; both the tooltip
 * table and {@link getNationalBasicDeductionHighlightIndex} build on it so they can't drift apart.
 */
export const getDedupedNationalBasicDeductionTiers = (
  tiers: ReadonlyArray<BasicDeductionTier>,
): ReadonlyArray<BasicDeductionTier> =>
  tiers.filter((tier, i, arr) => i === arr.length - 1 || tier.deduction !== arr[i + 1]!.deduction);

/**
 * Row index for the national income tax basic-deduction table.
 *
 * The displayed rows are the deduplicated tiers (see {@link getDedupedNationalBasicDeductionTiers})
 * followed by an appended "Over {last tier max}" row. The deduction for a given net income is the
 * first tier whose `maxIncomeInclusive` the income does not exceed (matching
 * `calculateNationalIncomeTaxBasicDeduction`); income above every tier maps to the appended row.
 *
 * @param tiers     The raw statutory tiers for the year (as passed to the tooltip table)
 * @param netIncome 合計所得金額 (results.totalNetIncome), in yen
 */
export const getNationalBasicDeductionHighlightIndex = (
  tiers: ReadonlyArray<BasicDeductionTier>,
  netIncome: number,
): number => {
  const deduped = getDedupedNationalBasicDeductionTiers(tiers);
  const idx = deduped.findIndex(tier => netIncome <= tier.maxIncomeInclusive);
  // Not within any tier → the appended "Over {last}" row, which sits just past the deduped rows.
  return idx === -1 ? deduped.length : idx;
};

/**
 * Row index for the residence tax basic-deduction table, whose four rows are literals:
 *   0: Up to 24,000,000 · 1: 24,000,001–24,500,000 · 2: 24,500,001–25,000,000 · 3: Over 25,000,000
 * Boundaries mirror `calculateResidenceTaxBasicDeduction`.
 *
 * @param netIncome 合計所得金額 (results.totalNetIncome), in yen
 */
export const getResidenceBasicDeductionHighlightIndex = (netIncome: number): number => {
  if (netIncome <= 24_000_000) return 0;
  if (netIncome <= 24_500_000) return 1;
  if (netIncome <= 25_000_000) return 2;
  return 3;
};

/**
 * Row index for the national income tax bracket table (7 rows, 5%–45%). Boundaries mirror
 * `calculateNationalIncomeTaxBase`. Taxable income is already floored to the nearest 1,000 yen by
 * the caller, so the "40,000,000 and above" row (index 6) covers everything past 39,999,000.
 *
 * @param taxableIncome results.taxableIncomeForNationalIncomeTax, in yen
 */
export const getNationalIncomeTaxBracketHighlightIndex = (taxableIncome: number): number => {
  if (taxableIncome <= 1_949_000) return 0;
  if (taxableIncome <= 3_299_000) return 1;
  if (taxableIncome <= 6_949_000) return 2;
  if (taxableIncome <= 8_999_000) return 3;
  if (taxableIncome <= 17_999_000) return 4;
  if (taxableIncome <= 39_999_000) return 5;
  return 6;
};

/**
 * Row index for the 給与所得控除 (employment income deduction) table.
 *
 * The displayed rows are a single "Up to {flatUpperBound}" flat-floor row (index 0) followed by one
 * row per standard tier, in order. Gross at or below `flatUpperBound` is the flat-floor row; above
 * it, the row is the first standard tier whose `grossMaxInclusive` the gross does not exceed.
 *
 * @param grossEmploymentIncome 給与等の収入金額, in yen
 * @param flatUpperBound        Upper edge (inclusive) of the flat-floor "Up to X" row
 * @param standardTiers         Standard tiers in display order (final tier is the Infinity cap)
 */
export const getEmploymentIncomeDeductionHighlightIndex = (
  grossEmploymentIncome: number,
  flatUpperBound: number,
  standardTiers: ReadonlyArray<{ grossMaxInclusive: number }>,
): number => {
  if (grossEmploymentIncome <= flatUpperBound) return 0;
  const tierIdx = standardTiers.findIndex(tier => grossEmploymentIncome <= tier.grossMaxInclusive);
  // The final tier is the Infinity cap, so a positive gross always matches; guard defensively.
  return tierIdx === -1 ? standardTiers.length : tierIdx + 1;
};
