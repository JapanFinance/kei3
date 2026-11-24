// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  estimateFurusatoEconomicBenefit,
  estimateFurusatoTemporaryIncome,
  hasTaxableFurusatoTemporaryIncome,
} from '../utils/furusatoNozei';
import { calculateTaxes } from '../utils/taxCalculations';
import { makeFurusatoNozeiDetails } from './fixtures/takeHomeResults';

const baseInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { id: 's1', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
  ],
  ageRange: 'age20to39' as const,
  region: 'Tokyo',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: DEFAULT_INCOME_YEAR,
};

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
    const furusatoNozei = makeFurusatoNozeiDetails({ limit: 60_000, outOfPocketCost: 2_000 });

    const estimate = estimateFurusatoTemporaryIncome(furusatoNozei);

    expect(estimate.isTaxable).toBe(false);
    expect(estimate.remainingDeductionAllowance).toBe(480_680);
    expect(estimate.netTemporaryIncome).toBe(0);
    expect(estimate.taxableTemporaryIncome).toBe(0);
    expect(estimate.additionalNationalIncomeTax).toBe(0);
    expect(estimate.additionalResidenceTax).toBe(0);
    expect(estimate.additionalTotalTax).toBe(0);
  });

  it('floors ½ taxable temporary income to whole yen and surfaces engine tax breakdown', () => {
    const furusatoNozei = makeFurusatoNozeiDetails({
      limit: 1_553_005,
      outOfPocketCost: 2_000,
      temporaryIncomeTax: { nationalIncomeTax: 100, residenceTax: 0, total: 100 },
    });

    const estimate = estimateFurusatoTemporaryIncome(furusatoNozei);

    expect(estimate.estimatedEconomicBenefit).toBe(500_067);
    expect(estimate.netTemporaryIncome).toBe(67);
    expect(estimate.taxableTemporaryIncome).toBe(33);
    expect(estimate.isTaxable).toBe(true);
    expect(estimate.additionalNationalIncomeTax).toBe(100);
    expect(estimate.additionalResidenceTax).toBe(0);
    expect(estimate.additionalTotalTax).toBe(100);
  });
});

describe('taxCalculations temporaryIncome and Furusato Nozei integration', () => {
  it('leaves taxes unchanged when temporaryIncome is at or below ¥500,000', () => {
    const baseline = calculateTaxes(baseInputs);
    const withExemptTemp = calculateTaxes({ ...baseInputs, temporaryIncome: 500_000 });

    expect(withExemptTemp.totalNetIncome).toBe(baseline.totalNetIncome);
    expect(withExemptTemp.nationalIncomeTax).toBe(baseline.nationalIncomeTax);
    expect(withExemptTemp.residenceTax.totalResidenceTax).toBe(
      baseline.residenceTax.totalResidenceTax,
    );
  });

  it('includes ½ of net temporary income above ¥500,000 in totalNetIncome and taxable bases', () => {
    const baseline = calculateTaxes(baseInputs);
    const withTemp = calculateTaxes({ ...baseInputs, temporaryIncome: 1_500_001 });

    // net = 1,000,001; floor(net / 2) = 500,000
    expect(withTemp.totalNetIncome).toBe(baseline.totalNetIncome + 500_000);
    expect(withTemp.taxableIncomeForNationalIncomeTax).toBe(
      baseline.taxableIncomeForNationalIncomeTax! + 500_000,
    );
    expect(withTemp.residenceTax.taxableIncome).toBe(baseline.residenceTax.taxableIncome + 500_000);
    expect(withTemp.nationalIncomeTax).toBeGreaterThan(baseline.nationalIncomeTax);
    expect(withTemp.residenceTax.totalResidenceTax).toBeGreaterThan(
      baseline.residenceTax.totalResidenceTax,
    );
  });

  it('offsets ordinary operating losses against temporary income before ½ inclusion', () => {
    const results = calculateTaxes({
      ...baseInputs,
      incomeStreams: [{ id: 'b1', type: 'business', amount: -400_000 }],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
      temporaryIncome: 1_200_000,
    });

    // Net temporary income = 700,000; loss-netted before halving = 700,000 - 400,000 = 300,000;
    // ½ inclusion -> 150,000 (not floor(700,000 / 2) - 400,000 = 0).
    expect(results.totalNetIncome).toBe(150_000);
  });

  it('leaves furusatoNozei.temporaryIncomeTax undefined for typical incomes', () => {
    const results = calculateTaxes(baseInputs);

    expect(results.furusatoNozei.temporaryIncomeTax).toBeUndefined();
  });

  it('computes exact furusatoNozei.temporaryIncomeTax via the engine for high-limit salaries', () => {
    const highInputs = {
      ...baseInputs,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 55_000_000, frequency: 'annual' as const },
      ],
    };

    const results = calculateTaxes(highInputs);
    const limit = results.furusatoNozei.limit;
    const benefit = estimateFurusatoEconomicBenefit(limit);
    const withDonationOnly = calculateTaxes({ ...highInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...highInputs,
      furusatoDonation: limit,
      temporaryIncome: benefit.estimatedEconomicBenefit,
    });

    expect(benefit.estimatedEconomicBenefit).toBeGreaterThan(500_000);
    expect(results.furusatoNozei.temporaryIncomeTax).toEqual({
      nationalIncomeTax: withDonationAndTemp.nationalIncomeTax - withDonationOnly.nationalIncomeTax,
      residenceTax:
        withDonationAndTemp.residenceTax.totalResidenceTax -
        withDonationOnly.residenceTax.totalResidenceTax,
      total:
        withDonationAndTemp.nationalIncomeTax -
        withDonationOnly.nationalIncomeTax +
        (withDonationAndTemp.residenceTax.totalResidenceTax -
          withDonationOnly.residenceTax.totalResidenceTax),
    });
    expect(results.furusatoNozei.temporaryIncomeTax!.total).toBeGreaterThan(0);
  });

  it('computes exact furusatoNozei.temporaryIncomeTax when high-income minimum tax applies', () => {
    const minTaxInputs = {
      ...baseInputs,
      incomeStreams: [
        {
          id: 'cg1',
          type: 'capitalGains' as const,
          amount: 1_500_000_000,
          shareType: 'listed' as const,
          account: 'domesticNoWithholding' as const,
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
    };

    const results = calculateTaxes(minTaxInputs);
    const limit = results.furusatoNozei.limit;
    const benefit = estimateFurusatoEconomicBenefit(limit);
    const withDonationOnly = calculateTaxes({ ...minTaxInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...minTaxInputs,
      furusatoDonation: limit,
      temporaryIncome: benefit.estimatedEconomicBenefit,
    });

    expect(results.highIncomeMinimumTax).toBeDefined();
    expect(results.furusatoNozei.temporaryIncomeTax).toEqual({
      nationalIncomeTax: withDonationAndTemp.nationalIncomeTax - withDonationOnly.nationalIncomeTax,
      residenceTax:
        withDonationAndTemp.residenceTax.totalResidenceTax -
        withDonationOnly.residenceTax.totalResidenceTax,
      total:
        withDonationAndTemp.nationalIncomeTax -
        withDonationOnly.nationalIncomeTax +
        (withDonationAndTemp.residenceTax.totalResidenceTax -
          withDonationOnly.residenceTax.totalResidenceTax),
    });
  });
});
