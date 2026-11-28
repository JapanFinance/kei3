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
// or temporary income effect on the Furusato Nozei tab has actually raised the cost.
const OUT_OF_POCKET_WARNING_THRESHOLD = 2200;

/**
 * Total estimated out-of-pocket cost: donation amount minus income/residence tax
 * reductions, plus any incremental tax and social insurance effect on temporary income from
 * return gifts.
 */
export const getFurusatoOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): number =>
  furusatoNozei.limit -
  furusatoNozei.incomeTaxReduction -
  furusatoNozei.residenceTaxReduction +
  (furusatoNozei.temporaryIncomeEffect?.total ?? 0);

/**
 * Returns true when an out-of-pocket cost exceeds the nominal ¥2,200 rounding margin.
 */
export const isHighOutOfPocketCost = (cost: number): boolean =>
  cost > OUT_OF_POCKET_WARNING_THRESHOLD;

export interface FurusatoTemporaryIncomeEstimate {
  /** Estimated procurement value of return gifts (26.5% of donation amount). */
  estimatedGiftsValue: number;
  /** Estimated shipping/delivery cost of return gifts (5.7% of donation amount). */
  estimatedShippingCost: number;
  /** Combined estimated economic benefit (gifts + shipping = 32.2%). */
  estimatedEconomicBenefit: number;
  /** Statutory annual special deduction for temporary income (¥500,000). */
  specialDeduction: number;
  /** Unused portion of the ¥500,000 special deduction when total temporary income is at or below ¥500,000. */
  remainingDeductionAllowance: number;
  /** Incremental net temporary income after the ¥500,000 special deduction (一時所得の金額). */
  netTemporaryIncome: number;
  /** Incremental amount included in aggregate taxable income: floor((prior + gifts) net / 2) - floor(prior net / 2). */
  taxableTemporaryIncome: number;
}

/**
 * Estimates the temporary income (一時所得) from Furusato Nozei return gifts for a given
 * donation amount, using FY2025 MIC survey averages (26.5% goods procurement + 5.7% shipping)
 * and the shared ¥500,000 annual special deduction.
 */
export const estimateFurusatoTemporaryIncome = (
  donationAmount: number,
  existingTemporaryIncome: number = 0,
): FurusatoTemporaryIncomeEstimate => {
  const prior = Math.max(0, Number.isFinite(existingTemporaryIncome) ? existingTemporaryIncome : 0);
  const specialDeduction = TEMPORARY_INCOME_SPECIAL_DEDUCTION;
  const isPositiveDonation = donationAmount > 0 && Number.isFinite(donationAmount);
  const estimatedGiftsValue = isPositiveDonation
    ? Math.round(donationAmount * FURUSATO_AVERAGE_GIFT_COST_RATE.toDecimal())
    : 0;
  const estimatedShippingCost = isPositiveDonation
    ? Math.round(donationAmount * FURUSATO_AVERAGE_SHIPPING_COST_RATE.toDecimal())
    : 0;
  // Sum the rounded components so displayed breakdown rows always reconcile exactly.
  const estimatedEconomicBenefit = estimatedGiftsValue + estimatedShippingCost;
  const totalBenefit = prior + estimatedEconomicBenefit;
  const remainingDeductionAllowance = Math.max(0, specialDeduction - totalBenefit);
  const netBeforeGifts = Math.max(0, prior - specialDeduction);
  const netWithGifts = Math.max(0, totalBenefit - specialDeduction);
  const netTemporaryIncome = netWithGifts - netBeforeGifts;
  const taxableTemporaryIncome =
    Math.floor(netWithGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR) -
    Math.floor(netBeforeGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR);

  return {
    estimatedGiftsValue,
    estimatedShippingCost,
    estimatedEconomicBenefit,
    specialDeduction,
    remainingDeductionAllowance,
    netTemporaryIncome,
    taxableTemporaryIncome,
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

  if (results.furusatoNozei.temporaryIncomeEffect !== undefined) {
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
