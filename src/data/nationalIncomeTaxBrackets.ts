// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * National income tax brackets (所得税の速算表) — the progressive rate schedule used to compute the
 * base income tax from taxable income.
 *
 * Taxable income is floored to the nearest 1,000 yen before lookup, so each bound is the statutory
 * "速算表" value (…,999,000). The final bracket uses Infinity. `deduction` is the 速算控除額
 * subtracted after applying `rate` (net tax = taxableIncome × rate − deduction).
 *
 * Single source of truth shared by {@link import('../utils/taxCalculations').calculateNationalIncomeTaxBase},
 * the tooltip reference table, and its current-row highlight, so the three cannot drift apart.
 *
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 */

export interface NationalIncomeTaxBracket {
  /** Upper bound of taxable income (inclusive) for this bracket, in yen (Infinity for the top). */
  maxTaxableIncomeInclusive: number;
  /** Marginal rate applied to taxable income (e.g. 0.2 for 20%). */
  rate: number;
  /** 速算控除額 subtracted after applying `rate`, in yen. */
  deduction: number;
}

/** Brackets in ascending order of `maxTaxableIncomeInclusive`; the final bound is Infinity. */
export const NATIONAL_INCOME_TAX_BRACKETS: ReadonlyArray<NationalIncomeTaxBracket> = [
  { maxTaxableIncomeInclusive: 1_949_000, rate: 0.05, deduction: 0 },
  { maxTaxableIncomeInclusive: 3_299_000, rate: 0.1, deduction: 97_500 },
  { maxTaxableIncomeInclusive: 6_949_000, rate: 0.2, deduction: 427_500 },
  { maxTaxableIncomeInclusive: 8_999_000, rate: 0.23, deduction: 636_000 },
  { maxTaxableIncomeInclusive: 17_999_000, rate: 0.33, deduction: 1_536_000 },
  { maxTaxableIncomeInclusive: 39_999_000, rate: 0.4, deduction: 2_796_000 },
  { maxTaxableIncomeInclusive: Infinity, rate: 0.45, deduction: 4_796_000 },
];
