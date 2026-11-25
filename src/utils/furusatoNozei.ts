// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  MANDATORY_RETURN_PENSION_THRESHOLD,
  MANDATORY_RETURN_SALARY_THRESHOLD,
  TEMPORARY_INCOME_INCLUSION_DIVISOR,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../data/furusatoNozei';
import type { FurusatoNozeiDetails, TakeHomeResults } from '../types/tax';

// The nominal out-of-pocket cost at the limit is 2,000 yen. The residence tax
// credits are floored to 100 yen separately for the municipal and prefectural
// portions, so an ordinary result lands up to about 200 yen above the nominal
// figure; only a cost above that margin means the bracket shift, credit interaction,
// or temporary income tax on the Furusato Nozei tab has actually raised the cost.
const OUT_OF_POCKET_WARNING_THRESHOLD = 2200;

/**
 * Out-of-pocket cost from the donation and its tax reductions alone, excluding any
 * temporary income tax on return gifts.
 */
export const getFurusatoDonationOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): number =>
  furusatoNozei.limit - furusatoNozei.incomeTaxReduction - furusatoNozei.residenceTaxReduction;

/**
 * Total estimated out-of-pocket cost: donation amount minus income/residence tax
 * reductions, plus any incremental income and residence tax on temporary income from
 * return gifts.
 */
export const getFurusatoOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): number =>
  getFurusatoDonationOutOfPocketCost(furusatoNozei) +
  (furusatoNozei.temporaryIncomeTax?.total ?? 0);

/**
 * Returns true when the base donation out-of-pocket cost (before temporary income tax)
 * exceeds the nominal ¥2,200 rounding margin.
 */
export const hasHighDonationOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  getFurusatoDonationOutOfPocketCost(furusatoNozei) > OUT_OF_POCKET_WARNING_THRESHOLD;

export const hasHighOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  getFurusatoOutOfPocketCost(furusatoNozei) > OUT_OF_POCKET_WARNING_THRESHOLD;

export interface FurusatoEconomicBenefitEstimate {
  /** Estimated procurement value of return gifts (26.5% of donation limit). */
  estimatedGoodsValue: number;
  /** Estimated shipping/delivery cost of return gifts (5.7% of donation limit). */
  estimatedShippingCost: number;
  /** Combined estimated economic benefit (goods + shipping = 32.2%). */
  estimatedEconomicBenefit: number;
}

export interface FurusatoTemporaryIncomeEstimate extends FurusatoEconomicBenefitEstimate {
  /** Statutory annual special deduction for temporary income (¥500,000). */
  specialDeduction: number;
  /** Unused portion of the ¥500,000 special deduction when benefit is at or below ¥500,000. */
  remainingDeductionAllowance: number;
  /** Net temporary income after the ¥500,000 special deduction (一時所得の金額). */
  netTemporaryIncome: number;
  /** Amount included in aggregate taxable income: floor(netTemporaryIncome / 2). */
  taxableTemporaryIncome: number;
  /** Whether estimated economic benefit alone exceeds the ¥500,000 special deduction. */
  isTaxable: boolean;
  /** Engine-computed incremental national income tax + reconstruction surtax (0 when not taxable). */
  additionalNationalIncomeTax: number;
  /** Engine-computed incremental residence tax (0 when not taxable). */
  additionalResidenceTax: number;
  /** Total engine-computed additional tax (`additionalNationalIncomeTax + additionalResidenceTax`). */
  additionalTotalTax: number;
}

/**
 * Estimates the economic benefit (return gifts + shipping) from donating at the given Furusato
 * Nozei limit, using FY2025 MIC survey averages (26.5% goods procurement + 5.7% shipping).
 */
export const estimateFurusatoEconomicBenefit = (limit: number): FurusatoEconomicBenefitEstimate => {
  if (limit <= 0 || !Number.isFinite(limit)) {
    return {
      estimatedGoodsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    };
  }

  const estimatedGoodsValue = Math.round(limit * FURUSATO_AVERAGE_GIFT_COST_RATE.toDecimal());
  const estimatedShippingCost = Math.round(limit * FURUSATO_AVERAGE_SHIPPING_COST_RATE.toDecimal());

  return {
    estimatedGoodsValue,
    estimatedShippingCost,
    // Sum the rounded components so displayed breakdown rows always reconcile exactly.
    estimatedEconomicBenefit: estimatedGoodsValue + estimatedShippingCost,
  };
};

/**
 * Returns true when estimated economic benefit from Furusato Nozei return gifts alone exceeds the
 * ¥500,000 annual special deduction for temporary income (assuming no other temporary income).
 */
export const hasTaxableFurusatoTemporaryIncome = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  furusatoNozei.limit > 0 &&
  estimateFurusatoEconomicBenefit(furusatoNozei.limit).estimatedEconomicBenefit >
    TEMPORARY_INCOME_SPECIAL_DEDUCTION;

/**
 * Summarizes the temporary income (一時所得) estimate and reads the engine-computed incremental
 * tax from {@link FurusatoNozeiDetails.temporaryIncomeTax}.
 */
export const estimateFurusatoTemporaryIncome = (
  furusatoNozei: FurusatoNozeiDetails,
): FurusatoTemporaryIncomeEstimate => {
  const benefit = estimateFurusatoEconomicBenefit(furusatoNozei.limit);
  const specialDeduction = TEMPORARY_INCOME_SPECIAL_DEDUCTION;
  const remainingDeductionAllowance = Math.max(
    0,
    specialDeduction - benefit.estimatedEconomicBenefit,
  );
  const netTemporaryIncome = Math.max(0, benefit.estimatedEconomicBenefit - specialDeduction);
  const taxableTemporaryIncome = Math.floor(
    netTemporaryIncome / TEMPORARY_INCOME_INCLUSION_DIVISOR,
  );
  const isTaxable = benefit.estimatedEconomicBenefit > specialDeduction;
  const temporaryIncomeTax = furusatoNozei.temporaryIncomeTax;

  return {
    ...benefit,
    specialDeduction,
    remainingDeductionAllowance,
    netTemporaryIncome,
    taxableTemporaryIncome,
    isTaxable,
    additionalNationalIncomeTax: temporaryIncomeTax?.nationalIncomeTax ?? 0,
    additionalResidenceTax: temporaryIncomeTax?.residenceTax ?? 0,
    additionalTotalTax: temporaryIncomeTax?.total ?? 0,
  };
};

export type OneStopIneligibilityReason =
  | 'taxableTemporaryIncome'
  | 'employmentIncomeOverThreshold'
  | 'publicPensionOverThreshold'
  | 'businessOrMiscIncome'
  | 'realEstateIncome'
  | 'reportedInvestmentIncome'
  | 'medicalExpensesDeduction';

/**
 * Returns known reasons why the One-Stop Exception system (ワンストップ特例制度) cannot be used
 * based on {@link TakeHomeResults}, because filing an income or residence tax return is required
 * (Local Tax Act Supplementary Provisions Art. 7(1) / 地方税法附則第7条第1項; Income Tax Act
 * Arts. 120, 121, 73 / 所得税法第120条・第121条・第73条; Local Tax Act Art. 45-2 / 地方税法第45条の2).
 *
 * Returns an empty array when no return-filing trigger is known from the results.
 */
export const getOneStopIneligibilityReasons = (
  results: TakeHomeResults,
): OneStopIneligibilityReason[] => {
  const reasons: OneStopIneligibilityReason[] = [];

  if (hasTaxableFurusatoTemporaryIncome(results.furusatoNozei)) {
    reasons.push('taxableTemporaryIncome');
  }
  if (results.grossEmploymentIncome > MANDATORY_RETURN_SALARY_THRESHOLD) {
    reasons.push('employmentIncomeOverThreshold');
  }
  if ((results.grossPublicPensionIncome ?? 0) > MANDATORY_RETURN_PENSION_THRESHOLD) {
    reasons.push('publicPensionOverThreshold');
  }
  if (results.netBusinessAndMiscIncome !== 0 || (results.businessBlueFilerDeduction ?? 0) > 0) {
    reasons.push('businessOrMiscIncome');
  }
  if (results.realEstate !== undefined) {
    reasons.push('realEstateIncome');
  }
  if (results.investmentIncome?.reported !== undefined) {
    reasons.push('reportedInvestmentIncome');
  }
  if (results.additionalDeductions.items.some(item => item.key === 'medical')) {
    reasons.push('medicalExpensesDeduction');
  }

  return reasons;
};
