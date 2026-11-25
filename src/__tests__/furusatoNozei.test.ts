// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import {
  DEFAULT_INCOME_YEAR,
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type SeparateTaxationReportedIncome,
} from '../types/tax';
import {
  estimateFurusatoEconomicBenefit,
  estimateFurusatoTemporaryIncome,
  getFurusatoDonationOutOfPocketCost,
  getFurusatoOutOfPocketCost,
  getOneStopIneligibilityReasons,
  hasHighDonationOutOfPocketCost,
  hasHighOutOfPocketCost,
  hasTaxableFurusatoTemporaryIncome,
} from '../utils/furusatoNozei';
import { calculateTaxes } from '../utils/taxCalculations';
import { makeFurusatoNozeiDetails, makeTakeHomeResults } from './fixtures/takeHomeResults';

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
      estimatedGiftsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    });
    expect(estimateFurusatoEconomicBenefit(-10_000)).toEqual({
      estimatedGiftsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
    });
  });

  it('estimates gifts (26.5%) and shipping (5.7%) and reconciles total economic benefit', () => {
    const benefit = estimateFurusatoEconomicBenefit(60_000);

    expect(benefit.estimatedGiftsValue).toBe(15_900);
    expect(benefit.estimatedShippingCost).toBe(3_420);
    expect(benefit.estimatedEconomicBenefit).toBe(19_320);
    expect(benefit.estimatedGiftsValue + benefit.estimatedShippingCost).toBe(
      benefit.estimatedEconomicBenefit,
    );
  });
});

describe('hasTaxableFurusatoTemporaryIncome', () => {
  it('reads whether the engine populated temporaryIncomeTax', () => {
    const withoutTax = makeFurusatoNozeiDetails({ limit: 2_200_000 });
    const withZeroTax = makeFurusatoNozeiDetails({
      limit: 2_200_000,
      temporaryIncomeTax: { nationalIncomeTax: 0, residenceTax: 0, total: 0 },
    });
    const withTax = makeFurusatoNozeiDetails({
      limit: 2_200_000,
      temporaryIncomeTax: { nationalIncomeTax: 47_800, residenceTax: 10_400, total: 58_200 },
    });

    expect(hasTaxableFurusatoTemporaryIncome(withoutTax)).toBe(false);
    expect(hasTaxableFurusatoTemporaryIncome(withZeroTax)).toBe(true);
    expect(hasTaxableFurusatoTemporaryIncome(withTax)).toBe(true);
  });

  it('matches the ¥500,000 benefit threshold in the tax engine', () => {
    const below = estimateFurusatoEconomicBenefit(1_552_000);
    const above = estimateFurusatoEconomicBenefit(1_553_000);

    expect(below.estimatedEconomicBenefit).toBe(499_744);
    expect(above.estimatedEconomicBenefit).toBe(500_066);
  });
});

describe('Furusato out-of-pocket cost helpers', () => {
  it('computes donation-only and total out-of-pocket cost with temporary income tax', () => {
    const furusatoNozei = makeFurusatoNozeiDetails({
      limit: 2_101_000,
      incomeTaxReduction: 964_300,
      residenceTaxReduction: 1_134_600,
      temporaryIncomeTax: { nationalIncomeTax: 40_400, residenceTax: 8_800, total: 49_200 },
    });

    expect(getFurusatoDonationOutOfPocketCost(furusatoNozei)).toBe(2_100);
    expect(getFurusatoOutOfPocketCost(furusatoNozei)).toBe(51_300);
    expect(hasHighDonationOutOfPocketCost(furusatoNozei)).toBe(false);
    expect(hasHighOutOfPocketCost(furusatoNozei)).toBe(true);
  });

  it('flags nominal vs high donation out-of-pocket costs at the ¥2,200 margin', () => {
    const nominal = makeFurusatoNozeiDetails({
      limit: 77_000,
      incomeTaxReduction: 7_600,
      residenceTaxReduction: 67_300,
    });
    const highDonation = makeFurusatoNozeiDetails({
      limit: 98_000,
      incomeTaxReduction: 9_800,
      residenceTaxReduction: 76_400,
    });

    expect(hasHighDonationOutOfPocketCost(nominal)).toBe(false);
    expect(hasHighOutOfPocketCost(nominal)).toBe(false);
    expect(hasHighDonationOutOfPocketCost(highDonation)).toBe(true);
    expect(hasHighOutOfPocketCost(highDonation)).toBe(true);
  });
});

describe('estimateFurusatoTemporaryIncome', () => {
  it('leaves taxable temporary income and additional tax at zero below ¥500,000', () => {
    const furusatoNozei = makeFurusatoNozeiDetails({
      limit: 60_000,
      incomeTaxReduction: 5_800,
      residenceTaxReduction: 52_200,
    });

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
      incomeTaxReduction: 633_000,
      residenceTaxReduction: 918_005,
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

describe('getOneStopIneligibilityReasons', () => {
  it('returns empty array for an ordinary salary earner with non-taxable gift benefit', () => {
    const results = makeTakeHomeResults({
      grossEmploymentIncome: 6_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    expect(getOneStopIneligibilityReasons(results)).toEqual([]);
  });

  it('detects taxable temporary income and salary over ¥20,000,000', () => {
    const results = makeTakeHomeResults({
      grossEmploymentIncome: 44_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 1_830_000,
        incomeTaxReduction: 760_600,
        residenceTaxReduction: 988_200,
        temporaryIncomeTax: { nationalIncomeTax: 18_400, residenceTax: 4_000, total: 22_400 },
      }),
    });

    expect(getOneStopIneligibilityReasons(results)).toEqual([
      'taxableTemporaryIncome',
      'employmentIncomeOverThreshold',
    ]);
  });

  it('enforces exact statutory thresholds for employment and public pension income', () => {
    const atThreshold = makeTakeHomeResults({
      grossEmploymentIncome: 20_000_000,
      grossPublicPensionIncome: 4_000_000,
    });
    const overThreshold = makeTakeHomeResults({
      grossEmploymentIncome: 20_000_001,
      grossPublicPensionIncome: 4_000_001,
    });

    expect(getOneStopIneligibilityReasons(atThreshold)).toEqual([]);
    expect(getOneStopIneligibilityReasons(overThreshold)).toEqual([
      'employmentIncomeOverThreshold',
      'publicPensionOverThreshold',
    ]);
  });

  it('detects business/misc, real estate, reported investment, and medical expense triggers', () => {
    const separate: SeparateTaxationReportedIncome = {
      gross: { capitalGains: 200_000, dividends: 0 },
      lossOffsetAgainstDividends: 0,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 200_000, dividends: 0 },
      taxable: { capitalGains: 200_000, dividends: 0 },
      nationalIncomeTaxBase: 30_000,
    };

    const results = makeTakeHomeResults({
      netBusinessAndMiscIncome: -100_000,
      businessBlueFilerDeduction: 100_000,
      realEstate: { netIncome: 500_000, blueFilerDeduction: 0 },
      investmentIncome: {
        reported: { separate },
      },
      additionalDeductions: {
        national: 50_000,
        residence: 50_000,
        items: [{ key: 'medical', national: 50_000, residence: 50_000 }],
      },
    });

    expect(getOneStopIneligibilityReasons(results)).toEqual([
      'businessOrMiscIncome',
      'realEstateIncome',
      'reportedInvestmentIncome',
      'medicalExpensesDeduction',
    ]);
  });
});
