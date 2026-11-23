// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { percentTo } from '../data/rate';
import type { HighIncomeMinimumTaxResult } from '../types/tax';
import {
  estimateFurusatoEconomicBenefit,
  estimateFurusatoTemporaryIncome,
  hasTaxableFurusatoTemporaryIncome,
} from '../utils/furusatoNozei';
import {
  makeFurusatoNozeiDetails,
  makeResidenceTaxDetails,
  makeTakeHomeResults,
} from './fixtures/takeHomeResults';

describe('estimateFurusatoEconomicBenefit', () => {
  it('returns zeros when donation limit is zero or negative', () => {
    expect(estimateFurusatoEconomicBenefit(0)).toEqual({
      estimatedGoodsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    });
    expect(estimateFurusatoEconomicBenefit(-10_000)).toEqual({
      estimatedGoodsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    });
  });

  it('estimates goods (26.5%) and shipping (5.7%) and reconciles total economic benefit', () => {
    const benefit = estimateFurusatoEconomicBenefit(60_000);

    expect(benefit.estimatedGoodsValue).toBe(15_900);
    expect(benefit.estimatedShippingCost).toBe(3_420);
    expect(benefit.estimatedEconomicBenefit).toBe(19_320);
    expect(benefit.estimatedGoodsValue + benefit.estimatedShippingCost).toBe(
      benefit.estimatedEconomicBenefit,
    );
  });
});

describe('hasTaxableFurusatoTemporaryIncome', () => {
  it('returns false right below the ¥500,000 deduction threshold and true right above it', () => {
    const below = makeFurusatoNozeiDetails({ limit: 1_552_000 });
    const above = makeFurusatoNozeiDetails({ limit: 1_553_000 });

    expect(estimateFurusatoEconomicBenefit(below.limit).estimatedEconomicBenefit).toBe(499_744);
    expect(estimateFurusatoEconomicBenefit(above.limit).estimatedEconomicBenefit).toBe(500_066);
    expect(hasTaxableFurusatoTemporaryIncome(below)).toBe(false);
    expect(hasTaxableFurusatoTemporaryIncome(above)).toBe(true);
  });
});

describe('estimateFurusatoTemporaryIncome', () => {
  it('leaves taxable temporary income and additional tax at zero below ¥500,000', () => {
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 3_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 60_000, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    expect(estimate.isTaxable).toBe(false);
    expect(estimate.remainingDeductionAllowance).toBe(480_680);
    expect(estimate.netTemporaryIncome).toBe(0);
    expect(estimate.taxableTemporaryIncome).toBe(0);
    expect(estimate.estimatedTotalTax).toBe(0);
    expect(estimate.usesMinimumTaxRate).toBe(false);
  });

  it('computes ½ taxable temporary income and marginal tax in the top 45% bracket', () => {
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 45_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 2_200_000, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    expect(estimate.estimatedGoodsValue).toBe(583_000);
    expect(estimate.estimatedShippingCost).toBe(125_400);
    expect(estimate.estimatedEconomicBenefit).toBe(708_400);
    expect(estimate.netTemporaryIncome).toBe(208_400);
    expect(estimate.taxableTemporaryIncome).toBe(104_200);
    expect(estimate.isTaxable).toBe(true);
    expect(estimate.estimatedNationalIncomeTax).toBe(47_874);
    expect(estimate.estimatedResidenceTax).toBe(10_420);
    expect(estimate.estimatedTotalTax).toBe(58_294);
    expect(estimate.usesMinimumTaxRate).toBe(false);
  });

  it('prices incremental national tax accurately across a progressive bracket boundary', () => {
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 39_950_000,
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 2_200_000, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    // ¥50,000 taxed at 40% (¥20,000) + ¥54,200 taxed at 45% (¥24,390) = ¥44,390 base + ¥932 surtax
    expect(estimate.estimatedNationalIncomeTax).toBe(45_322);
    expect(estimate.estimatedResidenceTax).toBe(10_420);
    expect(estimate.estimatedTotalTax).toBe(55_742);
  });

  it('floors ½ taxable temporary income to whole yen for odd net temporary income', () => {
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 45_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 1_553_005, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    expect(estimate.estimatedEconomicBenefit).toBe(500_067);
    expect(estimate.netTemporaryIncome).toBe(67);
    expect(estimate.taxableTemporaryIncome).toBe(33);
  });

  it('accounts for the high-income minimum tax floor when active', () => {
    const minimumTax: HighIncomeMinimumTaxResult = {
      baselineIncome: 353_560_000,
      threshold: 165_000_000,
      taxableExcess: 188_560_000,
      rate: percentTo(1)(30),
      taxOnExcess: 56_568_000,
      baselineIncomeTax: 53_788_526,
      additionalIncomeTax: 2_837_842,
      additionalReconstructionSurtax: 58_368,
      totalAdditionalTax: 2_896_210,
    };
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 0,
      highIncomeMinimumTax: minimumTax,
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 2_200_000, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    expect(estimate.usesMinimumTaxRate).toBe(true);
    expect(estimate.estimatedNationalIncomeTax).toBe(31_805);
    expect(estimate.estimatedResidenceTax).toBe(10_420);
    expect(estimate.estimatedTotalTax).toBe(42_225);
  });

  it('omits residence tax when residence tax is exempt', () => {
    const results = makeTakeHomeResults({
      taxableIncomeForNationalIncomeTax: 45_000_000,
      residenceTax: makeResidenceTaxDetails({ nonTaxableStatus: 'incomeThreshold' }),
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 2_200_000, outOfPocketCost: 2_000 }),
    });

    const estimate = estimateFurusatoTemporaryIncome(results);

    expect(estimate.estimatedResidenceTax).toBe(0);
    expect(estimate.estimatedTotalTax).toBe(estimate.estimatedNationalIncomeTax);
  });
});
