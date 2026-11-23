// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  TEMPORARY_INCOME_INCLUSION_DIVISOR,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../data/furusatoNozei';
import {
  NATIONAL_INCOME_TAX_BRACKETS,
  RECONSTRUCTION_SURTAX_RATE,
} from '../data/nationalIncomeTaxBrackets';
import { percentTo } from '../data/rate';
import type { FurusatoNozeiDetails, TakeHomeResults } from '../types/tax';

// The nominal out-of-pocket cost at the limit is 2,000 yen. The residence tax
// credits are floored to 100 yen separately for the municipal and prefectural
// portions, so an ordinary result lands up to about 200 yen above the nominal
// figure; only a cost above that margin means the bracket shift described on
// the Furusato Nozei tab has actually raised the cost.
const OUT_OF_POCKET_WARNING_THRESHOLD = 2200;

// Local 10% aggregate residence tax (所得割: 6% municipal + 4% prefectural), kept
// here to avoid importing residenceTax.ts (which interacts with taxCalculations.ts).
const RESIDENCE_TAX_RATE = percentTo(1)(10);

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
  /** Estimated incremental national income tax + 2.1% reconstruction surtax. */
  estimatedNationalIncomeTax: number;
  /** Estimated incremental residence tax (10% 所得割, or 0 if exempt). */
  estimatedResidenceTax: number;
  /** Total estimated additional tax (national + residence). */
  estimatedTotalTax: number;
  /** True when the High-Income Minimum Tax floor governs the marginal national tax rate. */
  usesMinimumTaxRate: boolean;
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

const nationalIncomeTaxBaseFor = (taxableIncome: number): number => {
  const clamped = Math.max(0, taxableIncome);

  for (const bracket of NATIONAL_INCOME_TAX_BRACKETS) {
    if (clamped <= bracket.maxTaxableIncomeInclusive) {
      return bracket.rate.taxOn(clamped) - bracket.deduction;
    }
  }

  return 0;
};

/**
 * Estimates temporary income (一時所得) and marginal additional tax arising from Furusato Nozei
 * return gifts (including shipping) when donating at the calculated limit.
 */
export const estimateFurusatoTemporaryIncome = (
  results: TakeHomeResults,
): FurusatoTemporaryIncomeEstimate => {
  const benefit = estimateFurusatoEconomicBenefit(results.furusatoNozei.limit);
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

  if (taxableTemporaryIncome <= 0) {
    return {
      ...benefit,
      specialDeduction,
      remainingDeductionAllowance,
      netTemporaryIncome,
      taxableTemporaryIncome: 0,
      isTaxable,
      estimatedNationalIncomeTax: 0,
      estimatedResidenceTax: 0,
      estimatedTotalTax: 0,
      usesMinimumTaxRate: false,
    };
  }

  const baseTaxable = Math.max(0, results.taxableIncomeForNationalIncomeTax ?? 0);
  const standardBaseDelta =
    nationalIncomeTaxBaseFor(baseTaxable + taxableTemporaryIncome) -
    nationalIncomeTaxBaseFor(baseTaxable);

  let nationalBaseDelta = standardBaseDelta;
  let usesMinimumTaxRate = false;

  if (results.highIncomeMinimumTax) {
    // Raising 総所得金額 by taxableTemporaryIncome raises 基準所得金額 by the same amount,
    // lifting the minimum-tax target while standard baseline income tax (incl. surtax) offsets it.
    const minTaxFloorDelta = results.highIncomeMinimumTax.rate.taxOn(taxableTemporaryIncome);
    const standardBaselineTaxDelta =
      standardBaseDelta + RECONSTRUCTION_SURTAX_RATE.taxOn(standardBaseDelta);
    const newAdditional = Math.max(
      0,
      results.highIncomeMinimumTax.additionalIncomeTax +
        minTaxFloorDelta -
        standardBaselineTaxDelta,
    );
    nationalBaseDelta =
      standardBaseDelta + (newAdditional - results.highIncomeMinimumTax.additionalIncomeTax);
    usesMinimumTaxRate = newAdditional > 0;
  }

  const surtaxDelta = RECONSTRUCTION_SURTAX_RATE.taxOn(nationalBaseDelta);
  const estimatedNationalIncomeTax = nationalBaseDelta + surtaxDelta;
  const estimatedResidenceTax = results.residenceTax.nonTaxableStatus
    ? 0
    : RESIDENCE_TAX_RATE.taxOn(taxableTemporaryIncome);

  return {
    ...benefit,
    specialDeduction,
    remainingDeductionAllowance,
    netTemporaryIncome,
    taxableTemporaryIncome,
    isTaxable,
    estimatedNationalIncomeTax,
    estimatedResidenceTax,
    estimatedTotalTax: estimatedNationalIncomeTax + estimatedResidenceTax,
    usesMinimumTaxRate,
  };
};
