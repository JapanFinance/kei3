// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  TEMPORARY_INCOME_INCLUSION_DIVISOR,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../data/furusatoNozei';
import type { FurusatoNozeiDetails } from '../types/tax';

// The nominal out-of-pocket cost at the limit is 2,000 yen. The residence tax
// credits are floored to 100 yen separately for the municipal and prefectural
// portions, so an ordinary result lands up to about 200 yen above the nominal
// figure; only a cost above that margin means the bracket shift described on
// the Furusato Nozei tab has actually raised the cost.
const OUT_OF_POCKET_WARNING_THRESHOLD = 2200;

export const hasHighOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): boolean =>
  furusatoNozei.outOfPocketCost > OUT_OF_POCKET_WARNING_THRESHOLD;

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
