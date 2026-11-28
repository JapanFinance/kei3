// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  MANDATORY_RETURN_PENSION_THRESHOLD,
  MANDATORY_RETURN_SALARY_THRESHOLD,
} from '../data/furusatoNozei';
import {
  TEMPORARY_INCOME_INCLUSION_DIVISOR,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../data/temporaryIncome';
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
 * reductions, plus any incremental tax and social insurance effect on temporary income from
 * return gifts.
 */
export const getFurusatoOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): number =>
  getFurusatoDonationOutOfPocketCost(furusatoNozei) +
  (furusatoNozei.temporaryIncomeEffect?.total ?? 0);

/**
 * Returns true when the base donation out-of-pocket cost (before temporary income effect)
 * exceeds the nominal ¥2,200 rounding margin.
 */
export const hasHighDonationOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  getFurusatoDonationOutOfPocketCost(furusatoNozei) > OUT_OF_POCKET_WARNING_THRESHOLD;

export const hasHighOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  getFurusatoOutOfPocketCost(furusatoNozei) > OUT_OF_POCKET_WARNING_THRESHOLD;

export interface FurusatoEconomicBenefitEstimate {
  /** Estimated procurement value of return gifts (26.5% of donation limit). */
  estimatedGiftsValue: number;
  /** Estimated shipping/delivery cost of return gifts (5.7% of donation limit). */
  estimatedShippingCost: number;
  /** Combined estimated economic benefit (gifts + shipping = 32.2%). */
  estimatedEconomicBenefit: number;
}

export interface FurusatoTemporaryIncomeEstimate extends FurusatoEconomicBenefitEstimate {
  /** Statutory annual special deduction for temporary income (¥500,000). */
  specialDeduction: number;
  /** Unused portion of the ¥500,000 special deduction when total temporary income is at or below ¥500,000. */
  remainingDeductionAllowance: number;
  /** Incremental net temporary income after the ¥500,000 special deduction (一時所得の金額). */
  netTemporaryIncome: number;
  /** Incremental amount included in aggregate taxable income: floor((prior + gifts) net / 2) - floor(prior net / 2). */
  taxableTemporaryIncome: number;
  /** Whether the engine evaluated Furusato Nozei return gifts as creating taxable temporary income. */
  isTaxable: boolean;
  /** Engine-computed incremental national income tax + reconstruction surtax (0 when not taxable). */
  additionalNationalIncomeTax: number;
  /** Engine-computed incremental residence tax (0 when not taxable). */
  additionalResidenceTax: number;
  /** Engine-computed incremental social insurance premiums (0 when not taxable or capped). */
  additionalSocialInsurance: number;
  /** Total engine-computed net cost change (`additionalNationalIncomeTax + additionalResidenceTax + additionalSocialInsurance`). */
  additionalTotalCost: number;
}

/**
 * Estimates the economic benefit (return gifts + shipping) from donating at the given Furusato
 * Nozei limit, using FY2025 MIC survey averages (26.5% goods procurement + 5.7% shipping).
 */
export const estimateFurusatoEconomicBenefit = (limit: number): FurusatoEconomicBenefitEstimate => {
  if (limit <= 0 || !Number.isFinite(limit)) {
    return {
      estimatedGiftsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    };
  }

  const estimatedGiftsValue = Math.round(limit * FURUSATO_AVERAGE_GIFT_COST_RATE.toDecimal());
  const estimatedShippingCost = Math.round(limit * FURUSATO_AVERAGE_SHIPPING_COST_RATE.toDecimal());

  return {
    estimatedGiftsValue,
    estimatedShippingCost,
    // Sum the rounded components so displayed breakdown rows always reconcile exactly.
    estimatedEconomicBenefit: estimatedGiftsValue + estimatedShippingCost,
  };
};

/**
 * Returns true when the tax engine evaluated Furusato Nozei return gifts as creating taxable
 * temporary income (i.e. {@link FurusatoNozeiDetails.temporaryIncomeEffect} is populated).
 */
export const hasTaxableFurusatoTemporaryIncome = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  furusatoNozei.temporaryIncomeEffect !== undefined;

/**
 * Returns true when Furusato Nozei return gifts create a non-zero net cost change
 * (income tax, residence tax, and/or social insurance).
 */
export const hasFurusatoTemporaryIncomeCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  (furusatoNozei.temporaryIncomeEffect?.total ?? 0) !== 0;

/**
 * Summarizes the temporary income (一時所得) estimate and reads the engine-computed incremental
 * effect from {@link FurusatoNozeiDetails.temporaryIncomeEffect}.
 */
export const estimateFurusatoTemporaryIncome = (
  furusatoNozei: FurusatoNozeiDetails,
  existingTemporaryIncome: number = 0,
): FurusatoTemporaryIncomeEstimate => {
  const prior = Math.max(0, existingTemporaryIncome);
  const benefit = estimateFurusatoEconomicBenefit(furusatoNozei.limit);
  const specialDeduction = TEMPORARY_INCOME_SPECIAL_DEDUCTION;
  const totalBenefit = prior + benefit.estimatedEconomicBenefit;
  const remainingDeductionAllowance = Math.max(0, specialDeduction - totalBenefit);
  const netBeforeGifts = Math.max(0, prior - specialDeduction);
  const netWithGifts = Math.max(0, totalBenefit - specialDeduction);
  const netTemporaryIncome = netWithGifts - netBeforeGifts;
  const taxableTemporaryIncome =
    Math.floor(netWithGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR) -
    Math.floor(netBeforeGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR);
  const isTaxable = hasTaxableFurusatoTemporaryIncome(furusatoNozei);
  const effect = furusatoNozei.temporaryIncomeEffect;

  return {
    ...benefit,
    specialDeduction,
    remainingDeductionAllowance,
    netTemporaryIncome,
    taxableTemporaryIncome,
    isTaxable,
    additionalNationalIncomeTax: effect?.nationalIncomeTax ?? 0,
    additionalResidenceTax: effect?.residenceTax ?? 0,
    additionalSocialInsurance: effect?.socialInsurance ?? 0,
    additionalTotalCost: effect?.total ?? 0,
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
