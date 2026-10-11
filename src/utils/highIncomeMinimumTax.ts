// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getHighIncomeMinimumTaxParams } from '../data/highIncomeMinimumTax';
import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import { RECONSTRUCTION_SURTAX_RATE } from '../data/nationalIncomeTaxBrackets';
import type { HighIncomeMinimumTaxResult } from '../types/tax';
import { floorTaxableIncome } from './investmentIncome';

/**
 * Calculates 基準所得金額 (baseline income amount, box ⑬ on Form 01.pdf).
 * Sum of aggregate net income (総所得金額) and separate investment income
 * (including amounts eligible for 確定申告不要制度; excluding domestic deposit interest).
 */
export const calculateHighIncomeBaselineIncome = (
  aggregateNetIncome: number,
  separateNetIncome: { capitalGains: number; dividends: number },
  listedWithholdingBase: number = 0,
): number =>
  aggregateNetIncome +
  separateNetIncome.capitalGains +
  separateNetIncome.dividends +
  listedWithholdingBase;

/**
 * Calculates baseline income tax under normal filing (box ⑱ on Form 01.pdf):
 * normal income tax on the return + 2.1% surtax (box ⑯) plus national withholding tax
 * (15.315% including surtax) on amounts left to withholding (box ⑰).
 */
export const calculateNormalBaselineTax = (
  baseIncomeTax: number,
  incomeYear: number,
  listedWithholdingBase: number = 0,
): number => {
  const surtax = RECONSTRUCTION_SURTAX_RATE.taxOn(baseIncomeTax);
  const withholdingTax =
    listedWithholdingBase > 0
      ? getInvestmentIncomeTaxRates(incomeYear).listedWithholdingNationalRate.taxOn(
          listedWithholdingBase,
        )
      : 0;
  return baseIncomeTax + surtax + withholdingTax;
};

/**
 * Tests whether the Minimum Tax on High Income Taxpayers applies (box ⑲ on Form 01.pdf).
 *
 * The measure applies when:
 * 1. Statutory parameters exist for the given year (2025+).
 * 2. 基準所得金額 (box ⑬) exceeds the statutory threshold (¥330M in 2025/2026, ¥165M in 2027+).
 * 3. Target tax on excess (box ⑮) exceeds baseline tax under normal filing (box ⑱).
 *
 * @param baselineIncome 基準所得金額 (box ⑬)
 * @param incomeYear Income calendar year
 * @param baseIncomeTax Income tax after home loan credit under normal filing
 * @param listedWithholdingBase National withholding tax base on amounts left to withholding
 * @param normalBaselineTax Optional pre-computed normal baseline tax (box ⑱) if already known
 */
export const isHighIncomeMinimumTaxApplicable = (
  baselineIncome: number,
  incomeYear: number,
  baseIncomeTax: number,
  listedWithholdingBase: number = 0,
  normalBaselineTax?: number,
): boolean => {
  const params = getHighIncomeMinimumTaxParams(incomeYear);
  if (!params) {
    return false;
  }

  const taxableExcess = floorTaxableIncome(baselineIncome - params.threshold);
  if (taxableExcess <= 0) {
    return false;
  }

  const taxOnExcess = params.rate.taxOn(taxableExcess);
  const baselineTax =
    normalBaselineTax ??
    calculateNormalBaselineTax(baseIncomeTax, incomeYear, listedWithholdingBase);

  return taxOnExcess > baselineTax;
};

/**
 * Computes the minimum tax on high income taxpayers under Special Tax Measures Act Art. 41-19
 * (租税特別措置法第41条の19「特定の基準所得金額の課税の特例」,
 * 措法通達41の19-2 https://www.nta.go.jp/law/tsutatsu/kobetsu/shotoku/sochiho/801226/sinkoku/57/41/20.htm).
 *
 * Follows Form 「特定の基準所得金額の課税の特例に関する適用判定表兼税額計算書」 (Form 01.pdf).
 *
 * Steps:
 * 1. Box ⑭: Taxable excess = floorTaxableIncome(baselineIncome - threshold), floored to ¥1,000.
 * 2. Box ⑮: Target tax = Math.floor(taxableExcess × rate) (22.5% in 2025/2026, 30.0% in 2027+).
 * 3. Box ⑲: Applicability test: compares box ⑮ with normal baseline tax (box ⑱). If ⑮ ≤ ⑱, returns undefined.
 * 4. Box ㉒: Baseline income tax without 確定申告不要制度 = base income tax (box ⑳) + 2.1% surtax (box ㉑).
 * 5. Box ㉓: Additional income tax = Math.max(0, box ⑮ - box ㉒).
 *
 * @param baselineIncome 基準所得金額: baseline income amount (box ⑬ on Form 01.pdf)
 * @param incomeYear Income calendar year
 * @param baseIncomeTax ⑳: Income tax after home loan credit (差引所得税額) computed with all income reported
 * @param listedWithholdingBase National withholding tax base on amounts left to withholding
 * @param normalBaselineTax ⑱: Baseline income tax under normal filing. If omitted, computed automatically
 * @returns {@link HighIncomeMinimumTaxResult} when the measure applies, or `undefined` when it does not.
 */
export const calculateHighIncomeMinimumTax = (
  baselineIncome: number,
  incomeYear: number,
  baseIncomeTax: number,
  listedWithholdingBase: number = 0,
  normalBaselineTax?: number,
): HighIncomeMinimumTaxResult | undefined => {
  const params = getHighIncomeMinimumTaxParams(incomeYear);
  if (!params) {
    return undefined;
  }

  // Box ⑭: (基準所得金額 - 控除額), floored to ¥1,000 (千円未満の端数切捨て)
  const taxableExcess = floorTaxableIncome(baselineIncome - params.threshold);
  if (taxableExcess <= 0) {
    return undefined;
  }

  // Box ⑮: ⑭ × 税率 (22.5% in 2025/2026, 30.0% in 2027+)
  const taxOnExcess = params.rate.taxOn(taxableExcess);

  const baselineTax =
    normalBaselineTax ??
    calculateNormalBaselineTax(baseIncomeTax, incomeYear, listedWithholdingBase);

  // Box ⑲: ⑮ - ⑱ (Applicability test). If ⑮ ≤ ⑱, the measure does not apply.
  if (taxOnExcess <= baselineTax) {
    return undefined;
  }

  // Box ㉑: reconstruction special income tax on base income tax
  const baseReconstructionSurtax = RECONSTRUCTION_SURTAX_RATE.taxOn(baseIncomeTax);

  // Box ㉒: Statutory baseline income tax including surtax (措法41条の19の基準所得税額)
  const baselineIncomeTax = baseIncomeTax + baseReconstructionSurtax;

  // Box ㉓: Additional income tax under the minimum tax
  const additionalIncomeTax = Math.max(0, taxOnExcess - baselineIncomeTax);
  if (additionalIncomeTax <= 0) {
    return undefined;
  }

  // Reconstruction surtax on the additional tax
  const additionalReconstructionSurtax = RECONSTRUCTION_SURTAX_RATE.taxOn(additionalIncomeTax);

  return {
    baselineIncome,
    threshold: params.threshold,
    taxableExcess,
    rate: params.rate,
    taxOnExcess,
    baselineIncomeTax,
    additionalIncomeTax,
    additionalReconstructionSurtax,
    totalAdditionalTax: additionalIncomeTax + additionalReconstructionSurtax,
  };
};
