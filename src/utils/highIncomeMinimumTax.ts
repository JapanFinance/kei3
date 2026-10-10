// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getHighIncomeMinimumTaxParams } from '../data/highIncomeMinimumTax';
import type { HighIncomeMinimumTaxResult } from '../types/tax';
import { floorTaxableIncome } from './investmentIncome';

/**
 * Inputs for evaluating the Minimum Tax on High Income Taxpayers
 * (特定の基準所得金額の課税の特例 / 租税特別措置法第41条の19).
 */
export interface HighIncomeMinimumTaxInputs {
  /**
   * 基準所得金額: baseline income amount (box ⑬ on Form 01.pdf).
   * Sum of aggregate net income (総所得金額) and separate investment income
   * (including amounts eligible for 確定申告不要制度; excluding domestic deposit interest).
   */
  baselineIncome: number;
  /** Income year (calendar year). */
  incomeYear: number;
  /**
   * ⑳: Income tax after the home loan credit (差引所得税額) computed with all income reported
   * on the return (without 確定申告不要制度). Box ⑳ on Form 01.pdf.
   */
  baseIncomeTaxAll: number;
  /**
   * ⑱: Baseline income tax under normal filing: normal income tax + surtax on the return (box ⑯)
   * plus national withholding tax (including surtax) on income left to withholding (box ⑰).
   */
  normalBaselineTax: number;
}

/**
 * Computes the minimum tax on high income taxpayers under Special Tax Measures Act Art. 41-19
 * (租税特別措置法第41条の19「特定の基準所得金額の課税の特例」,
 * 措法通達41の19-2 https://www.nta.go.jp/law/tsutatsu/kobetsu/shotoku/sochiho/801226/sinkoku/57/41/20.htm).
 *
 * Follows Form 「特定の基準所得金額の課税の特例に関する適用判定表兼税額計算書」 (Form 01.pdf).
 *
 * Steps:
 * 1. Checks whether baseline income exceeds the statutory threshold (¥330M in 2025/2026, ¥165M in 2027+).
 * 2. Box ⑭: Taxable excess = floorTaxableIncome(baselineIncome - threshold), floored to ¥1,000.
 * 3. Box ⑮: Target tax = Math.floor(taxableExcess × rate) (22.5% in 2025/2026, 30.0% in 2027+).
 * 4. Box ⑲: Applicability test: compares box ⑮ with normal baseline tax (box ⑱). If ⑮ ≤ ⑱, returns undefined.
 * 5. Box ㉒: Baseline income tax without 確定申告不要制度 = box ⑳ + Math.floor(box ⑳ × 2.1%).
 * 6. Box ㉓: Additional income tax = Math.max(0, box ⑮ - box ㉒).
 *
 * @returns {@link HighIncomeMinimumTaxResult} when the measure applies, or `undefined` when it does not.
 */
export const calculateHighIncomeMinimumTax = (
  inputs: HighIncomeMinimumTaxInputs,
): HighIncomeMinimumTaxResult | undefined => {
  const params = getHighIncomeMinimumTaxParams(inputs.incomeYear);
  if (!params) {
    return undefined;
  }
  if (inputs.baselineIncome <= params.threshold) {
    return undefined;
  }

  // Box ⑭: (基準所得金額 - 控除額), floored to ¥1,000 (千円未満の端数切捨て)
  const taxableExcess = floorTaxableIncome(inputs.baselineIncome - params.threshold);
  if (taxableExcess <= 0) {
    return undefined;
  }

  // Box ⑮: ⑭ × 税率 (22.5% in 2025/2026, 30.0% in 2027+)
  const taxOnExcess = params.rate.taxOn(taxableExcess);

  // Box ⑲: ⑮ - ⑱ (Applicability test). If ⑮ ≤ ⑱, the measure does not apply.
  if (taxOnExcess <= inputs.normalBaselineTax) {
    return undefined;
  }

  // Box ⑳: 差引所得税額 without 確定申告不要制度
  const box20 = inputs.baseIncomeTaxAll;

  // Box ㉑: ⑳ × 2.1% (復興特別所得税), floored to 1 yen
  const box21 = Math.floor((box20 * 21) / 1000);

  // Box ㉒: ⑳ + ㉑
  const box22 = box20 + box21;

  // Box ㉓: max(0, ⑮ - ㉒)
  const additionalIncomeTax = Math.max(0, taxOnExcess - box22);
  if (additionalIncomeTax <= 0) {
    return undefined;
  }

  // Reconstruction surtax on the additional tax: Math.floor(additionalIncomeTax × 2.1%)
  const additionalReconstructionSurtax = Math.floor((additionalIncomeTax * 21) / 1000);

  return {
    baselineIncome: inputs.baselineIncome,
    threshold: params.threshold,
    taxableExcess,
    rate: params.rate,
    taxOnExcess,
    baselineIncomeTax: box22,
    additionalIncomeTax,
    additionalReconstructionSurtax,
    totalAdditionalTax: additionalIncomeTax + additionalReconstructionSurtax,
  };
};
