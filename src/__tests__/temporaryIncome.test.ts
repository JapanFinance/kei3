// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { calculateTaxes } from '../utils/taxCalculations';

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

describe('Temporary Income (一時所得)', () => {
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
});
