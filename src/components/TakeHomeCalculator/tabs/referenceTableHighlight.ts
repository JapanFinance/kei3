// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Row layout + current-row highlighting for the statutory reference tables in the tax tooltips.
 *
 * Each table's numbers come from ONE shared source (the year-indexed national basic-deduction tiers,
 * {@link RESIDENCE_TAX_BASIC_DEDUCTION_TIERS}, {@link NATIONAL_INCOME_TAX_BRACKETS}) — the same data
 * the calculation functions consume. For every table this module exposes a paired
 * `build…Rows` (what {@link import('../../ui/ReferenceTable').default} renders) and
 * `get…HighlightIndex` (which of those rows applies to the taxpayer), both derived from that data,
 * so the displayed rows and the highlighted row can never drift apart.
 */

import type { BasicDeductionTier } from '../../../data/nationalBasicDeduction';
import { RESIDENCE_TAX_BASIC_DEDUCTION_TIERS } from '../../../data/residenceTaxBasicDeduction';
import { NATIONAL_INCOME_TAX_BRACKETS } from '../../../data/nationalIncomeTaxBrackets';

/** Formats a yen amount the way the tooltip tables do (grouped thousands, no ¥ sign). */
const fmt = (n: number): string => n.toLocaleString('en');

// ── National income tax basic deduction (基礎控除) ─────────────────────────────────────────────

/**
 * The national basic-deduction tooltip collapses consecutive tiers that share a deduction amount
 * into a single "Up to X" row. This returns the surviving tiers in display order; both the row
 * builder and {@link getNationalBasicDeductionHighlightIndex} build on it so they can't drift apart.
 */
export const getDedupedNationalBasicDeductionTiers = (
  tiers: ReadonlyArray<BasicDeductionTier>,
): ReadonlyArray<BasicDeductionTier> =>
  tiers.filter((tier, i, arr) => i === arr.length - 1 || tier.deduction !== arr[i + 1]!.deduction);

/** Displayed rows for the national basic-deduction table: deduped tiers + an appended "Over X". */
export const buildNationalBasicDeductionRows = (
  tiers: ReadonlyArray<BasicDeductionTier>,
): string[][] => [
  ...getDedupedNationalBasicDeductionTiers(tiers).map(tier => [
    `Up to ${fmt(tier.maxIncomeInclusive)}`,
    fmt(tier.deduction),
  ]),
  [`Over ${fmt(tiers[tiers.length - 1]!.maxIncomeInclusive)}`, '0'],
];

/**
 * Row index for the national basic-deduction table. The deduction for a given net income is the
 * first deduped tier whose `maxIncomeInclusive` the income does not exceed (matching
 * `calculateNationalIncomeTaxBasicDeduction`); income above every tier maps to the appended row.
 *
 * @param tiers     The raw statutory tiers for the year (as passed to {@link buildNationalBasicDeductionRows})
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

// ── Residence tax basic deduction (住民税の基礎控除) ────────────────────────────────────────────

/** Displayed rows for the residence basic-deduction table: the tiers + an appended "Over X". */
export const buildResidenceBasicDeductionRows = (): string[][] => {
  const tiers = RESIDENCE_TAX_BASIC_DEDUCTION_TIERS;
  return [
    ...tiers.map((tier, i) => [
      i === 0
        ? `Up to ${fmt(tier.maxIncomeInclusive)}`
        : `${fmt(tiers[i - 1]!.maxIncomeInclusive + 1)} - ${fmt(tier.maxIncomeInclusive)}`,
      fmt(tier.deduction),
    ]),
    [`Over ${fmt(tiers[tiers.length - 1]!.maxIncomeInclusive)}`, '0'],
  ];
};

/**
 * Row index for the residence basic-deduction table — the first tier whose `maxIncomeInclusive` the
 * net income does not exceed, or the appended "Over X" row above the last tier.
 *
 * @param netIncome 合計所得金額 (results.totalNetIncome), in yen
 */
export const getResidenceBasicDeductionHighlightIndex = (netIncome: number): number => {
  const idx = RESIDENCE_TAX_BASIC_DEDUCTION_TIERS.findIndex(
    tier => netIncome <= tier.maxIncomeInclusive,
  );
  return idx === -1 ? RESIDENCE_TAX_BASIC_DEDUCTION_TIERS.length : idx;
};

// ── National income tax brackets (所得税の速算表) ───────────────────────────────────────────────

/** Displayed rows for the income tax bracket table (Taxable Income · Tax Rate · Deduction). */
export const buildNationalIncomeTaxBracketRows = (): string[][] =>
  NATIONAL_INCOME_TAX_BRACKETS.map((bracket, i, arr) => {
    let range: string;
    if (i === 0) {
      range = `Up to ${fmt(bracket.maxTaxableIncomeInclusive)}`;
    } else if (!isFinite(bracket.maxTaxableIncomeInclusive)) {
      // Taxable income is floored to 1,000, so the first amount in the top bracket is the previous
      // bound + 1,000 (e.g. 39,999,000 → 40,000,000), which reads cleaner than the raw +1.
      range = `${fmt(arr[i - 1]!.maxTaxableIncomeInclusive + 1000)} and above`;
    } else {
      range = `${fmt(arr[i - 1]!.maxTaxableIncomeInclusive + 1)} - ${fmt(bracket.maxTaxableIncomeInclusive)}`;
    }
    return [range, `${Math.round(bracket.rate * 100)}%`, fmt(bracket.deduction)];
  });

/**
 * Row index for the income tax bracket table — the taxpayer's marginal bracket. Boundaries come
 * from {@link NATIONAL_INCOME_TAX_BRACKETS} (matching `calculateNationalIncomeTaxBase`); the final
 * bracket's Infinity bound means a match is always found.
 *
 * @param taxableIncome results.taxableIncomeForNationalIncomeTax, in yen
 */
export const getNationalIncomeTaxBracketHighlightIndex = (taxableIncome: number): number =>
  NATIONAL_INCOME_TAX_BRACKETS.findIndex(
    bracket => taxableIncome <= bracket.maxTaxableIncomeInclusive,
  );

// ── Employment income deduction (給与所得控除) ─────────────────────────────────────────────────

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
