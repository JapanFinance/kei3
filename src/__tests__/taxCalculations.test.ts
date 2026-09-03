// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getNationalPensionAnnualTotal } from '../data/nationalPensionContribution';
import type { Dependent } from '../types/dependents';
import {
  DEFAULT_PROVIDER,
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
} from '../types/healthInsurance';
import {
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  EMPTY_PERSONAL_CIRCUMSTANCES,
  type TakeHomeInputs,
} from '../types/tax';
import type { TaxpayerAgeRange } from '../types/taxpayerAge';
import {
  calculateTaxes,
  calculateEmploymentInsurance,
  calculateNationalIncomeTaxBasicDeduction,
  calculateNationalIncomeTax,
  calculateNetIncomeComponents,
} from '../utils/taxCalculations';

describe('calculateTaxes', () => {
  // Test cases for different income brackets
  it('calculates taxes correctly for income below 1,950,000 yen', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 1_500_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo', // Default for Kyokai Kenpo in tests
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(13_200);
    expect(result.healthInsurance).toBe(75_734);
    expect(result.pensionPayments).toBe(138_348);
    // Employment insurance for calendar 2026 blends fiscal-year rates per month:
    // Jan–Mar at FY2025 (5.5‰), Apr–Dec at FY2026 (5.0‰).
    expect(result.employmentInsurance).toBe(7_686);
    expect(result.takeHomeIncome).toBe(1_265_032);
  });

  it('calculates taxes correctly for income between 1,950,000 and 3,300,000 yen', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 2_500_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(14_100);
    expect(result.residenceTax.totalResidenceTax).toBe(91_100);
    expect(result.healthInsurance).toBe(120_220);
    expect(result.pensionPayments).toBe(219_600);
    // Employment insurance for calendar 2026 blends fiscal-year rates per month:
    // Jan–Mar at FY2025 (5.5‰), Apr–Dec at FY2026 (5.0‰).
    expect(result.employmentInsurance).toBe(12_816);
    expect(result.takeHomeIncome).toBe(2_042_164);
  });

  it('calculates taxes correctly for income between 3,300,000 and 6,950,000 yen', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(91_700);
    expect(result.residenceTax.totalResidenceTax).toBe(243_100);
    expect(result.healthInsurance).toBe(246_449); // 410k SMR at the FY2026 employee rate
    expect(result.pensionPayments).toBe(450_180);
    // Employment insurance for calendar 2026 blends fiscal-year rates per month:
    // Jan–Mar at FY2025 (5.5‰), Apr–Dec at FY2026 (5.0‰).
    expect(result.employmentInsurance).toBe(25_623);
    expect(result.takeHomeIncome).toBe(3_942_948);
  });

  // Test cases for high income brackets
  it('calculates taxes correctly for income above 40,000,000 yen', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 50_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(16_350_000); // 50M − 1.95M employment deduction − social insurance − 0 basic deduction (income > 25M)
    expect(result.residenceTax.totalResidenceTax).toBe(4_629_300);
    expect(result.healthInsurance).toBe(835_527); // Capped at the FY2026 max monthly premium × 12
    expect(result.pensionPayments).toBe(713_700); // Capped at 59,475 * 12
    // Employment insurance for calendar 2026 blends fiscal-year rates per month:
    // Jan–Mar at FY2025 (5.5‰), Apr–Dec at FY2026 (5.0‰).
    expect(result.employmentInsurance).toBe(256_248);
    expect(result.takeHomeIncome).toBe(27_215_225);
  });

  // Test edge cases
  it('handles zero income correctly', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 0, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(0);
    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);
    expect(result.employmentInsurance).toBe(0);
    expect(result.takeHomeIncome).toBe(0);
  });

  it('handles negative income correctly', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: -1_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(0);
    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);
    expect(result.employmentInsurance).toBe(0);
    expect(result.takeHomeIncome).toBe(0);
  });

  it('calculates taxes correctly for non-employment income', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ type: 'miscellaneous' as const, amount: 5_000_000, id: 'test' }],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(292_100);
    expect(result.residenceTax.totalResidenceTax).toBe(383_200);
    expect(result.healthInsurance).toBe(547_219);
    expect(result.pensionPayments).toBe(213_810);
    expect(result.employmentInsurance).toBe(0);
    expect(result.takeHomeIncome).toBe(3_563_671);
  });

  it('calculates taxes correctly for employment income with NHI', () => {
    // Test case for employees who work for small employers or are part-time/low income
    // and are therefore enrolled in National Health Insurance instead of employee insurance
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo', // For NHI
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    // Should pay employment insurance (since it's employment income)
    expect(result.employmentInsurance).toBe(25_623);

    // Should pay NHI premiums (not employee health insurance)
    // NHI should be calculated on net employment income (3,560,000) not gross (5,000,000)
    expect(result.healthInsurance).toBe(395_645);

    // Should pay national pension (not employee pension, since they're on NHI)
    expect(result.pensionPayments).toBe(213_810);

    // Tax calculations should use employment income deduction
    expect(result.netEmploymentIncome).toBe(3_560_000);
    expect(result.nationalIncomeTax).toBe(96_100);
    expect(result.residenceTax.totalResidenceTax).toBe(251_800);

    // Total take-home should reflect employment income with NHI and National Pension
    // NHI calculated on net employment income results in lower premiums and higher take-home
    expect(result.takeHomeIncome).toBe(4_017_022);
  });

  it('calculates taxes correctly with DC plan contributions', () => {
    // Test without DC plan contributions
    const inputsWithoutDcPlan = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const resultWithoutIdeco = calculateTaxes(inputsWithoutDcPlan);

    // Test with 240,000 yen annual iDeCo contributions (20,000 yen monthly)
    const inputsWithIdeco = {
      ...inputsWithoutDcPlan,
      dcPlanContributions: 240_000,
    };
    const resultWithIdeco = calculateTaxes(inputsWithIdeco);

    // iDeCo contributions should reduce taxes
    expect(resultWithIdeco.nationalIncomeTax).toBeLessThan(resultWithoutIdeco.nationalIncomeTax);
    expect(resultWithIdeco.residenceTax.totalResidenceTax).toBeLessThan(
      resultWithoutIdeco.residenceTax.totalResidenceTax,
    );

    // Take-home pay should be higher with iDeCo contributions
    // This is because the tax savings offset part of the contribution
    expect(resultWithIdeco.takeHomeIncome).toBeGreaterThan(resultWithoutIdeco.takeHomeIncome);

    // Verify that the tax savings are calculated correctly
    const incomeTaxSavings =
      resultWithoutIdeco.nationalIncomeTax - resultWithIdeco.nationalIncomeTax;
    const residenceTaxSavings =
      resultWithoutIdeco.residenceTax.totalResidenceTax -
      resultWithIdeco.residenceTax.totalResidenceTax;

    // With 240,000 yen contribution at ~5% marginal tax rate (basic deduction increase reduces taxable income into lower bracket)
    // and around 24,000 yen in residence tax savings (10% rate)
    expect(incomeTaxSavings).equals(12_300);
    expect(residenceTaxSavings).equals(24_000);
  });

  it('calculates taxes correctly with Blue-Filer deduction for business income', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        {
          id: '1',
          type: 'business' as const,
          amount: 5_000_000,
          blueFilerDeduction: 650_000,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    // Net Business Income = 5,000,000 - 650,000 = 4,350,000
    // NHI and Tax should be calculated based on 4,350,000

    // For comparison, let's look at business income of 4,350,000 without deduction
    const inputsReference = {
      ...inputs,
      incomeStreams: [
        {
          id: '1',
          type: 'business' as const,
          amount: 4_350_000,
          blueFilerDeduction: 0,
        },
      ],
    };
    const resultReference = calculateTaxes(inputsReference);

    expect(result.nationalIncomeTax).toBe(resultReference.nationalIncomeTax);
    expect(result.healthInsurance).toBe(resultReference.healthInsurance);
    expect(result.residenceTax.totalResidenceTax).toBe(
      resultReference.residenceTax.totalResidenceTax,
    );

    expect(result.annualIncome).toBe(5_000_000);
    expect(resultReference.annualIncome).toBe(4_350_000);

    // Take Home Income should be higher by the deduction amount (since it's not a real expense)
    // 5M - Tax == 4.35M - Tax + 650k
    expect(result.takeHomeIncome).toBe(resultReference.takeHomeIncome + 650_000);

    // Verify Blue-Filer deduction is returned
    expect(result.blueFilerDeduction).toBe(650_000);
  });
});

describe('calculateEmploymentInsurance', () => {
  // These rounding tests pass an explicit year 2025, whose 12 months all fall under
  // the uniform FY2025 rate (5.5‰), so the per-month rounding can be checked against a
  // single rate. (FY2026 onward blends rates within the calendar year — see the
  // fiscal-year tests below.)
  // Test cases with annual amounts that divide evenly by 12
  it('calculates insurance for employment income with even monthly amounts', () => {
    // 1,200,000 / 12 = 100,000 per month
    // 100,000 * 0.55% = 550 yen per month
    // 550 * 12 = 6,600 yen annually
    expect(calculateEmploymentInsurance(1_200_000, 2025)).toBe(6_600);

    // 2,400,000 / 12 = 200,000 per month
    // 200,000 * 0.55% = 1,100 yen per month
    // 1,100 * 12 = 13,200 yen annually
    expect(calculateEmploymentInsurance(2_400_000, 2025)).toBe(13_200);
  });

  // Test cases with non-even monthly amounts to verify rounding
  it('applies correct rounding for monthly premiums', () => {
    // 1,000,000 / 12 ≈ 83,333.33 per month
    // 83,333.33 * 0.55% ≈ 458.33 per month
    // Rounded to 458 yen per month (decimal .33 < .50 → round down)
    // 458 * 12 = 5,496 yen annually
    expect(calculateEmploymentInsurance(1_000_000, 2025)).toBe(5_496);

    // 1,100,000 / 12 ≈ 91,666.67 per month
    // 91,666.67 * 0.55% ≈ 504.17 per month
    // Rounded to 504 yen per month (decimal .17 < .50 → round down)
    // 504 * 12 = 6,048 yen annually
    expect(calculateEmploymentInsurance(1_100_000, 2025)).toBe(6_048);

    // 1,111,111 / 12 ≈ 92,592.58 per month
    // 92,592.58 * 0.55% ≈ 509.26 per month
    // Rounded to 509 yen per month (decimal .26 < .50 → round down)
    // 509 * 12 = 6,108 yen annually
    expect(calculateEmploymentInsurance(1_111_111, 2025)).toBe(6_108);

    // 1,200,001 / 12 = 100,000.083 per month
    // 100,000.083 * 0.55% ≈ 550.00046 per month
    // Rounded to 550 yen per month (decimal .00046 < .50 → round down)
    // 550 * 12 = 6,600 yen annually
    expect(calculateEmploymentInsurance(1_200_001, 2025)).toBe(6_600);

    // 1,999,999 / 12 ≈ 166,666.58 per month
    // 166,666.58 * 0.55% ≈ 916.67 per month
    // Rounded to 917 yen per month (decimal .67 > .50 → round up)
    // 917 * 12 = 11,004 yen annually
    expect(calculateEmploymentInsurance(1_999_999, 2025)).toBe(11_004);
  });

  it('returns 0 for zero income', () => {
    expect(calculateEmploymentInsurance(0, 2025)).toBe(0);
  });

  it('returns 0 for negative income', () => {
    expect(calculateEmploymentInsurance(-1_000_000, 2025)).toBe(0);
  });

  // Test with very small amounts to ensure rounding works correctly
  it('handles very small amounts correctly', () => {
    // 10,000 / 12 ≈ 833.33 per month
    // 833.33 * 0.55% ≈ 4.58 per month
    // Rounded to 5 yen per month (decimal .58 > .50 → round up)
    // 5 * 12 = 60 yen annually
    expect(calculateEmploymentInsurance(10_000, 2025)).toBe(60);

    // 9,090 / 12 = 757.5 per month
    // 757.5 * 0.55% ≈ 4.17 per month
    // Rounded to 4 yen per month (decimal .17 < .50 → round down)
    // 4 * 12 = 48 yen annually
    expect(calculateEmploymentInsurance(9_090, 2025)).toBe(48);
  });

  it('applies split rates when the rate changes mid-year (2026: 0.55% Jan-Mar, 0.50% Apr-Dec)', () => {
    // 1,200,000 / 12 = 100,000 per month
    // Jan-Mar: 100,000 * 0.55% = 550 × 3 = 1,650
    // Apr-Dec: 100,000 * 0.50% = 500 × 9 = 4,500
    // Total: 6,150
    expect(calculateEmploymentInsurance(1_200_000, 2026)).toBe(6_150);

    // 5,000,000 / 12 ≈ 416,666.67 per month
    // Jan-Mar: 416,666.67 * 0.55% = 2,291.67 → 2,292 × 3 = 6,876
    // Apr-Dec: 416,666.67 * 0.50% = 2,083.33 → 2,083 × 9 = 18,747
    // Total: 25,623
    expect(calculateEmploymentInsurance(5_000_000, 2026)).toBe(25_623);
  });

  it('uses uniform rate for years within a single fiscal year period', () => {
    // Year 2025: all 12 months use 0.55% (FY2025: Apr 2025 – Mar 2026)
    expect(calculateEmploymentInsurance(1_200_000, 2025)).toBe(6_600);

    // Year 2027: all 12 months use 0.50% (FY2026 rate applies to Jan-Mar, FY2026 also Apr-Dec)
    expect(calculateEmploymentInsurance(1_200_000, 2027)).toBe(6_000);
  });

  it('applies the correct rate for bonuses based on their month (2026)', () => {
    // Bonus in February (month 1) → 0.55% rate
    // 500,000 * 0.55% = 2,750
    expect(
      calculateEmploymentInsurance(0, 2026, [
        { id: 'b1', type: 'bonus', amount: 500_000, month: 1 },
      ]),
    ).toBe(2_750);

    // Bonus in June (month 5) → 0.50% rate
    // 500,000 * 0.50% = 2,500
    expect(
      calculateEmploymentInsurance(0, 2026, [
        { id: 'b2', type: 'bonus', amount: 500_000, month: 5 },
      ]),
    ).toBe(2_500);
  });
});

describe('calculateNationalIncomeTaxBasicDeduction', () => {
  describe('2026 tiers (R8: 62万 base + temporary additions via Art. 41-16-2)', () => {
    it('returns 1,040,000 yen for income up to 1,320,000 yen (62万 base + 42万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(0, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(1_000_000, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(1_320_000, 2026)).toBe(1_040_000);
    });

    it('returns 1,040,000 yen for income between 1,320,001 and 3,360,000 yen (62万 base + 42万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(1_320_001, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(2_000_000, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(3_360_000, 2026)).toBe(1_040_000);
    });

    it('returns 1,040,000 yen for income between 3,360,001 and 4,890,000 yen (62万 base + 42万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(3_360_001, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(4_000_000, 2026)).toBe(1_040_000);
      expect(calculateNationalIncomeTaxBasicDeduction(4_890_000, 2026)).toBe(1_040_000);
    });

    it('returns 670,000 yen for income between 4,890,001 and 6,550,000 yen (62万 base + 5万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(4_890_001, 2026)).toBe(670_000);
      expect(calculateNationalIncomeTaxBasicDeduction(5_000_000, 2026)).toBe(670_000);
      expect(calculateNationalIncomeTaxBasicDeduction(6_550_000, 2026)).toBe(670_000);
    });

    it('returns 620,000 yen for income between 6,550,001 and 23,500,000 yen (62万 base)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(6_550_001, 2026)).toBe(620_000);
      expect(calculateNationalIncomeTaxBasicDeduction(10_000_000, 2026)).toBe(620_000);
      expect(calculateNationalIncomeTaxBasicDeduction(23_500_000, 2026)).toBe(620_000);
    });

    it('returns 480,000 yen for income between 23,500,001 and 24,000,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(23_500_001, 2026)).toBe(480_000);
      expect(calculateNationalIncomeTaxBasicDeduction(24_000_000, 2026)).toBe(480_000);
    });

    it('returns 320,000 yen for income between 24,000,001 and 24,500,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(24_000_001, 2026)).toBe(320_000);
      expect(calculateNationalIncomeTaxBasicDeduction(24_500_000, 2026)).toBe(320_000);
    });

    it('returns 160,000 yen for income between 24,500,001 and 25,000,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(24_500_001, 2026)).toBe(160_000);
      expect(calculateNationalIncomeTaxBasicDeduction(25_000_000, 2026)).toBe(160_000);
    });

    it('returns 0 yen for income above 25,000,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(25_000_001, 2026)).toBe(0);
      expect(calculateNationalIncomeTaxBasicDeduction(30_000_000, 2026)).toBe(0);
    });

    it('handles negative income correctly', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(-1_000_000, 2026)).toBe(1_040_000);
    });
  });

  describe('2025 tiers (R7: 58万 base + temporary additions via Art. 41-16-2)', () => {
    it('returns 950,000 yen for income up to 1,320,000 yen (58万 base + 37万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(0, 2025)).toBe(950_000);
      expect(calculateNationalIncomeTaxBasicDeduction(1_000_000, 2025)).toBe(950_000);
      expect(calculateNationalIncomeTaxBasicDeduction(1_320_000, 2025)).toBe(950_000);
    });

    it('returns 880,000 yen for income between 1,320,001 and 3,360,000 yen (58万 base + 30万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(1_320_001, 2025)).toBe(880_000);
      expect(calculateNationalIncomeTaxBasicDeduction(2_000_000, 2025)).toBe(880_000);
      expect(calculateNationalIncomeTaxBasicDeduction(3_360_000, 2025)).toBe(880_000);
    });

    it('returns 680,000 yen for income between 3,360,001 and 4,890,000 yen (58万 base + 10万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(3_360_001, 2025)).toBe(680_000);
      expect(calculateNationalIncomeTaxBasicDeduction(4_000_000, 2025)).toBe(680_000);
      expect(calculateNationalIncomeTaxBasicDeduction(4_890_000, 2025)).toBe(680_000);
    });

    it('returns 630,000 yen for income between 4,890,001 and 6,550,000 yen (58万 base + 5万 temp)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(4_890_001, 2025)).toBe(630_000);
      expect(calculateNationalIncomeTaxBasicDeduction(5_000_000, 2025)).toBe(630_000);
      expect(calculateNationalIncomeTaxBasicDeduction(6_550_000, 2025)).toBe(630_000);
    });

    it('returns 580,000 yen for income between 6,550,001 and 23,500,000 yen (58万 base)', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(6_550_001, 2025)).toBe(580_000);
      expect(calculateNationalIncomeTaxBasicDeduction(10_000_000, 2025)).toBe(580_000);
      expect(calculateNationalIncomeTaxBasicDeduction(23_500_000, 2025)).toBe(580_000);
    });

    it('returns 480,000 yen for income between 23,500,001 and 24,000,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(23_500_001, 2025)).toBe(480_000);
      expect(calculateNationalIncomeTaxBasicDeduction(24_000_000, 2025)).toBe(480_000);
    });

    it('returns 0 yen for income above 25,000,000 yen', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(25_000_001, 2025)).toBe(0);
    });

    it('handles negative income correctly', () => {
      expect(calculateNationalIncomeTaxBasicDeduction(-1_000_000, 2025)).toBe(950_000);
    });
  });
});

describe('calculateNationalIncomeTax', () => {
  it('calculates tax correctly for income below 1,950,000 yen', () => {
    expect(calculateNationalIncomeTax(1_500_000)).toBe(76_500); // 1.5M * 5% = 75K, + 2.1% = 76.575K, rounded down to 76.5K
    expect(calculateNationalIncomeTax(1_949_000)).toBe(99_400); // 1.949M * 5% = 97.45K, + 2.1% = 99.497K, rounded down to 99.4K
  });

  it('calculates tax correctly for income between 1,950,000 and 3,300,000 yen', () => {
    expect(calculateNationalIncomeTax(1_950_000)).toBe(99_500); // 1.95M * 10% - 97.5K = 97.5K, + 2.1% = 99.548K, rounded down to 99.5K
    expect(calculateNationalIncomeTax(3_299_000)).toBe(237_200); // 3.299M * 10% - 97.5K = 232.4K, + 2.1% = 237.280K, rounded down to 237.2K
  });

  it('calculates tax correctly for income between 3,300,000 and 6,950,000 yen', () => {
    expect(calculateNationalIncomeTax(3_300_000)).toBe(237_300); // 3.3M * 20% - 427.5K = 232.5K, + 2.1% = 237.383K, rounded down to 237.3K
    expect(calculateNationalIncomeTax(6_949_000)).toBe(982_500); // 6.949M * 20% - 427.5K = 962.3K, + 2.1% = 982.508K, rounded down to 982.5K
  });

  it('calculates tax correctly for income between 6,950,000 and 9,000,000 yen', () => {
    expect(calculateNationalIncomeTax(6_950_000)).toBe(982_700); // 6.95M * 23% - 636K = 962.5K, + 2.1% = 982.713K, rounded down to 982.7K
    expect(calculateNationalIncomeTax(8_999_000)).toBe(1_463_800); // 8.999M * 23% - 636K = 1.43377M, + 2.1% = 1.46388M, rounded down to 1.4638M
  });

  it('calculates tax correctly for income between 9,000,000 and 18,000,000 yen', () => {
    expect(calculateNationalIncomeTax(9_000_000)).toBe(1_464_100); // 9M * 33% - 1.536M = 1.434M, + 2.1% = 1.46414M, rounded down to 1.4641M
    expect(calculateNationalIncomeTax(17_999_000)).toBe(4_496_100); // 17.999M * 33% - 1.536M = 4.40367M, + 2.1% = 4.49615M, rounded down to 4.4961M
  });

  it('calculates tax correctly for income between 18,000,000 and 40,000,000 yen', () => {
    expect(calculateNationalIncomeTax(18_000_000)).toBe(4_496_400); // 18M * 40% - 2.796M = 4.404M, + 2.1% = 4.49648M, rounded down to 4.4964M
    expect(calculateNationalIncomeTax(39_999_000)).toBe(13_480_800); // 39.999M * 40% - 2.796M = 13.2036M, + 2.1% = 13.48088M, rounded down to 13.4808M
  });

  it('calculates tax correctly for income above 40,000,000 yen', () => {
    expect(calculateNationalIncomeTax(40_000_000)).toBe(13_481_200); // 40M * 45% - 4.796M = 13.204M, + 2.1% = 13.48128M, rounded down to 13.4812M
    expect(calculateNationalIncomeTax(50_000_000)).toBe(18_075_700); // 50M * 45% - 4.796M = 17.704M, + 2.1% = 18.07578M, rounded down to 18.0757M
  });

  it('handles zero income correctly', () => {
    expect(calculateNationalIncomeTax(0)).toBe(0);
  });

  it('handles negative income correctly', () => {
    expect(calculateNationalIncomeTax(-1_000_000)).toBe(0); // Negative income is clamped to 0
  });
});

describe('calculateTaxes with Dependent Coverage', () => {
  it('calculates taxes correctly with dependent coverage below threshold', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 1_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    // With dependent coverage, no health insurance or pension premiums
    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);

    // Employment insurance is still calculated (FY-blended across calendar 2026:
    // Jan–Mar at FY2025 5.5‰, Apr–Dec at FY2026 5.0‰).
    expect(result.employmentInsurance).toBe(5_127);

    // Income tax and residence tax should still be calculated normally
    // Net income: 1,000,000 - 740,000 = 260,000 (R8 minimum deduction)
    // Social insurance deduction: 0 + 0 + 5,127 = 5,127
    // Taxable income: 260,000 - 5,127 - 1,040,000 = negative, so 0
    expect(result.nationalIncomeTax).toBe(0);
  });

  it('calculates taxes correctly with dependent coverage at threshold', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 1_299_999, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    // With dependent coverage, no health insurance or pension premiums
    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);

    // Employment insurance is still calculated (FY-blended across calendar 2026:
    // Jan–Mar at FY2025 5.5‰, Apr–Dec at FY2026 5.0‰).
    expect(result.employmentInsurance).toBe(6_666);
  });

  it('calculates taxes correctly with dependent coverage and long-term care premium eligibility', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 1_200_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age40to59' as const, // Should not matter for dependent coverage
      healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    // Even with LTC eligibility, dependent coverage has no premiums
    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);
  });

  it('calculates taxes correctly with Custom Provider', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age40to59' as const,
      healthInsuranceProvider: CUSTOM_PROVIDER_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
      customEHIRates: {
        healthInsuranceRate: 5, // 5%
        longTermCareRate: 1, // 1%
      },
    };
    const result = calculateTaxes(inputs);

    // SMR for 5M is 410,000.
    // Health Insurance: 410,000 * 0.05 * 12 = 246,000
    // Long Term Care: 410,000 * 0.01 * 12 = 49,200
    expect(result.healthInsurance).toBe(246_000 + 49_200);
  });

  it('uses manual social insurance amount when enabled', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 500_000,
      incomeYear: 2026,
    };
    const result = calculateTaxes(inputs);

    expect(result.healthInsurance).toBe(0);
    expect(result.pensionPayments).toBe(0);
    expect(result.employmentInsurance).toBe(0);
    expect(result.socialInsuranceOverride).toBe(500_000);

    // Verify take home calculation uses the manual amount
    expect(result.takeHomeIncome).toBe(
      5_000_000 - (result.nationalIncomeTax + result.residenceTax.totalResidenceTax + 500_000),
    );
  });

  it('caps Blue-Filer deduction at the amount of business income', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
      incomeStreams: [
        {
          id: '1',
          type: 'business' as const,
          amount: 300_000,
          blueFilerDeduction: 650_000,
        },
      ],
    };
    const result = calculateTaxes(inputs);

    // Deduction (650k) > Income (300k) => Effective deduction should be 300k
    expect(result.blueFilerDeduction).toBe(300_000);

    // Taxable income should be 0
    expect(result.annualIncome).toBe(300_000);
    expect(result.taxableIncomeForNationalIncomeTax).toBe(0);
    expect(result.taxableIncomeForResidenceTax).toBe(0);
    expect(result.nationalIncomeTax).toBe(0);
  });

  it('calculates NHI base correctly with Employment AND Miscellaneous income', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { id: '1', type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const },
        { id: '2', type: 'miscellaneous' as const, amount: 1_000_000 },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. Validate Total Annual Income: 3M + 1M = 4M
    expect(result.annualIncome).toBe(4_000_000);

    // 2. Validate Net Employment Income
    // Deduction for 3M (R8): floor(3M * 0.7) - 80k = 2.1M - 80k = 2.02M
    expect(result.netEmploymentIncome).toBe(2_020_000);

    // 3. Validate Total Net Income (The base for NHI)
    // Total Net = Net Employment (2.02M) + Misc (1M) = 3.02M
    expect(result.totalNetIncome).toBe(3_020_000);

    // 4. Validate NHI Premium is calculated broadly correctly (non-zero)
    // Base = 3.02M - 430k = 2.59M
    // Rough calc: 2.59M * ~10% = ~260k.
    expect(result.healthInsurance).toBeGreaterThan(200_000);
  });
});

describe('calculateNetIncomeComponents totalNetIncome', () => {
  it('calculates total net income correctly for salary only', () => {
    // Salary 5M -> Net Employment Income (R8: floor(5M * 0.8) - 440k = 4M - 440k = 3.56M)
    const incomeStreams = [
      { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(3_560_000);
  });

  it('calculates total net income correctly for business only', () => {
    // Business 5M, Deduction 650k -> Taxable Business Income = 4.35M
    const incomeStreams = [
      { type: 'business' as const, amount: 5_000_000, blueFilerDeduction: 650_000, id: 'test' },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(4_350_000);
  });

  it('calculates total net income correctly for mixed income', () => {
    // Salary 3M -> Net Employment (R8: floor(3M * 0.7) - 80k = 2.1M - 80k = 2.02M)
    // Business 1M -> Taxable Business = 1M
    // Total = 3.02M
    const incomeStreams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
      { type: 'business' as const, amount: 1_000_000, blueFilerDeduction: 0, id: 'b1' },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(3_020_000);
  });

  it('handles business income less than blue-filer deduction and misc income', () => {
    // Salary 3M -> Net Employment (R8: floor(3M * 0.7) - 80k = 2.02M)
    // Business 200k, Deduction 650k -> Net Business = 0 (Deduction limited to 200k)
    // Misc 100k -> Net Misc = 100k (Deduction does NOT apply to Misc)
    // Total Net = 2.02M + 0 + 100k = 2.12M
    const incomeStreams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
      { type: 'business' as const, amount: 200_000, blueFilerDeduction: 650_000, id: 'b1' },
      { type: 'miscellaneous' as const, amount: 100_000, id: 'm1' },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(2_120_000);
  });

  it('reports net business and miscellaneous income separately from the other components', () => {
    // Business 2M, Deduction 100k -> 1.9M; Misc 100k; pension stays in its own component.
    const incomeStreams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
      { type: 'business' as const, amount: 2_000_000, blueFilerDeduction: 100_000, id: 'b1' },
      { type: 'miscellaneous' as const, amount: 100_000, id: 'm1' },
      { type: 'publicPension' as const, amount: 2_400_000, id: 'p1' },
    ];
    const components = calculateNetIncomeComponents(
      incomeStreams,
      2026,
      'age65to69',
      [],
      EMPTY_PERSONAL_CIRCUMSTANCES,
    );
    expect(components.totalNetIncome).toBe(
      components.netEmploymentIncome + 2_000_000 + components.netPublicPensionIncome,
    );
    expect(
      calculateTaxes({
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeStreams,
        ageRange: 'age65to69',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        region: 'Tokyo',
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      }).netBusinessAndMiscIncome,
    ).toBe(2_000_000);
  });
});

describe('Commuting Allowance', () => {
  it('is non-taxable up to 150,000 JPY/month but subject to social insurance', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 150_000,
          frequency: 'monthly' as const,
          id: 'c1',
        }, // at the cap: wholly non-taxable
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. Social Insurance Base
    // Salary 300k + Commuting 150k = 450k
    // Compare with 450k salary
    const inputsComparison = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 450_000, frequency: 'monthly' as const, id: 's2' },
      ],
    };
    const resultComparison = calculateTaxes(inputsComparison);

    expect(result.healthInsurance).toBe(resultComparison.healthInsurance);
    expect(result.pensionPayments).toBe(resultComparison.pensionPayments);

    // 2. Income Tax Base
    // 給与等の収入金額 is the 300k salary alone, so 給与所得 matches a salary-only filer's
    const inputsTaxableEquivalent = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's3' },
      ],
    };
    const resultTaxableEquivalent = calculateTaxes(inputsTaxableEquivalent);

    expect(result.netEmploymentIncome).toBe(resultTaxableEquivalent.netEmploymentIncome);

    // Same 給与所得 as that filer, but social insurance on the 450k base gives a larger
    // 社会保険料控除, so the tax is lower.
    expect(result.nationalIncomeTax).toBeLessThan(resultTaxableEquivalent.nationalIncomeTax);

    expect(result.commutingAllowance).toBe(150_000 * 12);
  });

  it('rejects an allowance above the non-taxable cap, which belongs in salary', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 200_000,
          frequency: 'monthly' as const,
          id: 'c1',
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    expect(() => calculateTaxes(inputs)).toThrow(/non-taxable cap/);
  });

  it('handles 6-month pass correctly', () => {
    // 6-month pass costs 120,000 (20,000/month equivalent).
    // Should be fully non-taxable.
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 120_000,
          frequency: '6-months' as const,
          id: 'c1',
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // Annual Commuting: 120,000 * 2 = 240,000, wholly non-taxable at 20k/month
    expect(result.commutingAllowance).toBe(240_000);
  });
});

describe('Additional income deductions (life, earthquake, medical, other)', () => {
  const baseSalaryInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary' as const, amount: 8_000_000, frequency: 'annual' as const, id: 's1' },
    ],
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  };

  it('subtracts insurance deductions from both taxable incomes without touching 調整控除', () => {
    const base = calculateTaxes(baseSalaryInputs);
    const withDeductions = calculateTaxes({
      ...baseSalaryInputs,
      lifeInsurance: { generalNew: 100_000, medicalCareNew: 0, pensionNew: 100_000 },
      earthquakeInsurance: { earthquake: 50_000, longTermOld: 0 },
    });

    // life 80k/56k + earthquake 50k/25k = 130k national, 81k residence
    expect(withDeductions.additionalDeductions.national).toBe(130_000);
    expect(withDeductions.additionalDeductions.residence).toBe(81_000);
    expect(withDeductions.additionalDeductions.items.map(i => i.key)).toEqual([
      'lifeInsurance',
      'earthquakeInsurance',
    ]);

    // Both taxable incomes drop by exactly the per-tax total (the amounts are multiples of 1,000).
    expect(
      base.taxableIncomeForNationalIncomeTax! - withDeductions.taxableIncomeForNationalIncomeTax!,
    ).toBe(130_000);
    expect(base.taxableIncomeForResidenceTax! - withDeductions.taxableIncomeForResidenceTax!).toBe(
      81_000,
    );

    // These are 物的控除, so the residence 調整控除 (personal deduction difference) is unchanged.
    expect(withDeductions.residenceTax.personalDeductionDifference).toBe(
      base.residenceTax.personalDeductionDifference,
    );

    expect(withDeductions.nationalIncomeTax).toBeLessThan(base.nationalIncomeTax);
    expect(withDeductions.residenceTax.totalResidenceTax).toBeLessThan(
      base.residenceTax.totalResidenceTax,
    );
  });

  it('applies the medical expense income floor and reduces both taxes equally', () => {
    const base = calculateTaxes(baseSalaryInputs);
    const withMedical = calculateTaxes({
      ...baseSalaryInputs,
      medicalExpenses: { paid: 350_000, reimbursed: 100_000 },
    });

    // netIncome 6,100,000 → floor min(¥100k, 5% × 6.1M = ¥305k) = ¥100k → 250k − 100k = ¥150k.
    expect(withMedical.additionalDeductions.national).toBe(150_000);
    expect(withMedical.additionalDeductions.residence).toBe(150_000);
    expect(withMedical.additionalDeductions.items).toHaveLength(1);
    expect(withMedical.additionalDeductions.items[0]!.key).toBe('medical');

    expect(
      base.taxableIncomeForNationalIncomeTax! - withMedical.taxableIncomeForNationalIncomeTax!,
    ).toBe(150_000);
    expect(base.taxableIncomeForResidenceTax! - withMedical.taxableIncomeForResidenceTax!).toBe(
      150_000,
    );
  });

  it('lowers the furusato nozei limit when residence tax falls', () => {
    const base = calculateTaxes(baseSalaryInputs);
    const withDeductions = calculateTaxes({
      ...baseSalaryInputs,
      lifeInsurance: { generalNew: 100_000, medicalCareNew: 80_000, pensionNew: 100_000 },
      earthquakeInsurance: { earthquake: 50_000, longTermOld: 0 },
    });
    expect(withDeductions.furusatoNozei.limit).toBeLessThan(base.furusatoNozei.limit);
  });

  it('subtracts deductions before the home loan credit, shifting it toward the residence spillover', () => {
    // A credit larger than the income tax pins appliedToIncomeTax to the income-tax base. Adding
    // 物的控除 lowers that base, so appliedToIncomeTax must strictly fall and the residence spillover
    // must not decrease — which can only happen if the deductions are applied before the credit.
    const creditOnly = calculateTaxes({
      ...baseSalaryInputs,
      homeLoanTaxCredit: { creditAmount: 800_000, moveInYear: 2024 },
    });
    const withDeductions = calculateTaxes({
      ...baseSalaryInputs,
      homeLoanTaxCredit: { creditAmount: 800_000, moveInYear: 2024 },
      lifeInsurance: { generalNew: 100_000, medicalCareNew: 80_000, pensionNew: 100_000 },
      earthquakeInsurance: { earthquake: 50_000, longTermOld: 0 },
      medicalExpenses: { paid: 600_000, reimbursed: 0 },
    });

    expect(creditOnly.homeLoanTaxCredit).toBeDefined();
    expect(withDeductions.homeLoanTaxCredit!.appliedToIncomeTax).toBeLessThan(
      creditOnly.homeLoanTaxCredit!.appliedToIncomeTax,
    );
    expect(withDeductions.homeLoanTaxCredit!.appliedToResidenceTax).toBeGreaterThanOrEqual(
      creditOnly.homeLoanTaxCredit!.appliedToResidenceTax,
    );
  });

  it('raises the 一般 life-insurance income-tax cap to ¥60,000 for a 2026 household with a <23 dependent', () => {
    const withChild = {
      ...baseSalaryInputs,
      dependents: [
        {
          id: 'c1',
          relationship: 'child' as const,
          ageRange: '19to22' as const,
          income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
          disability: 'none' as const,
          isCohabiting: true,
        },
      ],
      lifeInsurance: { generalNew: 120_000, medicalCareNew: 0, pensionNew: 0 },
    };
    const lifeNational = (inp: typeof withChild) =>
      calculateTaxes(inp).additionalDeductions.items.find(i => i.key === 'lifeInsurance')!.national;

    // With a <23 dependent in 2026 the 一般 (new) income-tax cap is ¥60,000; without it, ¥40,000.
    expect(lifeNational(withChild)).toBe(60_000);
    expect(lifeNational({ ...withChild, dependents: [] })).toBe(40_000);
    // Residence tax is never affected by the measure.
    expect(
      calculateTaxes(withChild).additionalDeductions.items.find(i => i.key === 'lifeInsurance')!
        .residence,
    ).toBe(28_000);
  });
});

describe('RSU (Restricted Stock Unit) income', () => {
  it('calculates foreign RSU income only correctly', () => {
    // RSU foreign income of 2M should be subject to employment income deduction
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. RSU is employment income, so it goes through employment income deduction
    // Gross EI = 2M (below 2.2M): Net = 2M - 740k = 1.26M
    expect(result.netEmploymentIncome).toBe(1_260_000);

    // 2. RSU should be included in total net income
    expect(result.totalNetIncome).toBe(1_260_000);

    // 3. RSU should NOT be in social insurance bases (no salary/bonus/commuting allowance)
    // With 0 salary income, health insurance base for SMR is 0
    // Foreign RSU does NOT contribute to social insurance premium base
    expect(result.healthInsurance).toBeLessThan(40_000); // Minimal premium for 0 salary base

    // 4. Pension should also not include RSU in its base
    expect(result.pensionPayments).toBeLessThan(110_000);

    // 5. Employment insurance requires employment via salary/bonus
    expect(result.employmentInsurance).toBe(0);

    // 6. Income tax should apply
    expect(result.nationalIncomeTax).toBeGreaterThan(0);
  });

  it('calculates salary + RSU foreign income correctly', () => {
    // Salary 3M + RSU 2M should both go through employment income deduction
    // But RSU should NOT be in social insurance base
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const },
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. Total annual income: 3M + 2M = 5M
    expect(result.annualIncome).toBe(5_000_000);

    // 2. Gross employment income: 3M + 2M = 5M (for employment income deduction)
    // 5M is in 3.6M-6.6M range: Net = 5M * 0.8 - 440k = 3.56M
    expect(result.netEmploymentIncome).toBe(3_560_000);

    // 3. Total net income should include both
    expect(result.totalNetIncome).toBe(3_560_000);

    // 4. Social insurance should be based on SALARY ONLY (3M)
    // Not on salary + RSU
    // SMR for 3M / 12 = 250k: should be Grade 27 (SMR 500k bracket)
    // Monthly premium: 500k * rates, approx 118,920
    expect(result.healthInsurance).toBeLessThan(170_000); // Less than if using 5M base

    // 5. Pension should also be based on salary only
    // Monthly: 500k * 18.3% * 0.5 = 45,750 per month
    expect(result.pensionPayments).toBeLessThan(300_000);

    // 6. Employment insurance should be based on salary only
    // 3M salary base, FY-blended 2026 employment insurance (≈ 15.4k)
    expect(result.employmentInsurance).toBe(15_375);

    // 7. Income tax should be applied to full net income
    expect(result.nationalIncomeTax).toBeGreaterThan(0);
  });

  it('calculates salary + bonus + RSU foreign income correctly', () => {
    // Salary 2M + Bonus 1M + RSU 1.5M
    // All three should go through employment income deduction
    // But only salary/bonus in social insurance base
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 2_000_000, frequency: 'annual' as const },
        { id: 'b1', type: 'bonus' as const, amount: 1_000_000, month: 5 },
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 1_500_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. Total annual income: 2M + 1M + 1.5M = 4.5M
    expect(result.annualIncome).toBe(4_500_000);

    // 2. Gross employment income for deduction: 2M + 1M + 1.5M = 4.5M
    // 4.5M is in 3.6M-6.6M range: Net = 4.5M * 0.8 - 440k = 3.16M
    expect(result.netEmploymentIncome).toBe(3_160_000);

    // 3. Social insurance base should be 2M + 1M = 3M (NO RSU)
    // SMR for 3M / 12 ≈ 250k
    expect(result.healthInsurance).toBeGreaterThan(100_000);
    expect(result.healthInsurance).toBeLessThan(240_000);

    // 4. Pension also based on 3M salary + bonus
    expect(result.pensionPayments).toBeGreaterThan(200_000);
    expect(result.pensionPayments).toBeLessThan(350_000);
  });

  it('RSU foreign income with NHI includes RSU in net income base', () => {
    // With NHI, RSU should be included in the net income that forms the NHI base
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // 1. Total net income: RSU 2M below 2.2M: Net = 2M - 740k = 1.26M
    expect(result.totalNetIncome).toBe(1_260_000);

    // 2. NHI is based on total net income (including RSU)
    expect(result.healthInsurance).toBeGreaterThan(0);

    // 3. Pension is National Pension (3 months FY2025 + 9 months FY2026)
    expect(result.pensionPayments).toBe(213_810);

    // 4. No employment insurance for NHI (NHI people don't have employment insurance)
    expect(result.employmentInsurance).toBe(0);
  });

  it('calculateNetIncomeComponents includes RSU in employment income deduction', () => {
    // RSU 2M should receive employment income deduction
    // 2M below 2.2M: Net = 2M - 740k = 1.26M
    const incomeStreams = [
      {
        type: 'stockCompensation' as const,
        amount: 2_000_000,
        issuerDomicile: 'foreign' as const,
        id: 'rsu1',
      },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(1_260_000);
  });

  it('calculateNetIncomeComponents includes RSU with salary correctly', () => {
    // Salary 3M + RSU 2M
    // Gross EI: 5M, 5M in 3.6M-6.6M range: Net = 5M * 0.8 - 440k = 3.56M
    const incomeStreams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
      {
        type: 'stockCompensation' as const,
        amount: 2_000_000,
        issuerDomicile: 'foreign' as const,
        id: 'rsu1',
      },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(3_560_000);
  });

  it('supports multiple stock compensation streams and sums them in tax calculations', () => {
    const inputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const },
        {
          id: 'sc1',
          type: 'stockCompensation' as const,
          amount: 1_200_000,
          issuerDomicile: 'foreign' as const,
        },
        {
          id: 'sc2',
          type: 'stockCompensation' as const,
          amount: 800_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // Annual total includes both stock compensation streams
    expect(result.annualIncome).toBe(5_000_000);

    // Net employment income is based on salary + stock compensation (5M total)
    // 5M in 3.6M-6.6M range: Net = 5M * 0.8 - 440k = 3.56M
    expect(result.netEmploymentIncome).toBe(3_560_000);
    expect(result.totalNetIncome).toBe(3_560_000);

    // Social insurance should still be based on salary-only remuneration base
    expect(result.healthInsurance).toBeLessThan(240_000);
    expect(result.pensionPayments).toBeLessThan(550_000);
  });

  it('calculateNetIncomeComponents sums multiple stock compensation streams', () => {
    const incomeStreams = [
      {
        type: 'stockCompensation' as const,
        amount: 1_200_000,
        issuerDomicile: 'foreign' as const,
        id: 'sc1',
      },
      {
        type: 'stockCompensation' as const,
        amount: 800_000,
        issuerDomicile: 'foreign' as const,
        id: 'sc2',
      },
    ];

    // Combined 2M below 2.2M: net = 2M - 740k = 1.26M
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(1_260_000);
  });
});

describe('所得金額調整控除 (income amount adjustment deduction) integration', () => {
  const childUnder23: Dependent = {
    id: 'c1',
    relationship: 'child',
    ageRange: '19to22',
    isCohabiting: false,
    disability: 'none',
    income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
  };
  const adultChild: Dependent = {
    id: 'c2',
    relationship: 'child',
    ageRange: '23to64',
    isCohabiting: false,
    disability: 'none',
    income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
  };

  const baseInputs = (dependents: Dependent[]) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { id: 's1', type: 'salary' as const, amount: 22_000_000, frequency: 'annual' as const },
    ],
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents,
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  it('reduces 給与所得 / 合計所得金額 by the adjustment for the worked example (¥22M salary, child under 23)', () => {
    const result = calculateTaxes(baseInputs([childUnder23]));
    // 給与所得控除: 22M - 1.95M = 20.05M; 所得金額調整控除: (10M - 8.5M) × 10% = 150k
    expect(result.incomeAdjustmentDeduction).toBe(150_000);
    expect(result.netEmploymentIncome).toBe(19_900_000);
    expect(result.totalNetIncome).toBe(19_900_000);
  });

  it('does NOT apply at or below ¥8,500,000 of salary even with a qualifying dependent', () => {
    const inputs = baseInputs([childUnder23]);
    const result = calculateTaxes({
      ...inputs,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 8_400_000, frequency: 'annual' as const },
      ],
    });
    expect(result.incomeAdjustmentDeduction).toBe(0);
  });

  it('does NOT apply when the only dependent is 23 or older without special disability', () => {
    const result = calculateTaxes(baseInputs([adultChild]));
    expect(result.incomeAdjustmentDeduction).toBe(0);
    expect(result.netEmploymentIncome).toBe(20_050_000);
    expect(result.totalNetIncome).toBe(20_050_000);
  });

  it('does NOT apply with no dependents', () => {
    const result = calculateTaxes(baseInputs([]));
    expect(result.incomeAdjustmentDeduction).toBe(0);
    expect(result.totalNetIncome).toBe(20_050_000);
  });

  it('lets the adjustment bring 合計所得金額 under the ¥20M home-loan-credit limit (the bug in #344)', () => {
    // With the qualifying child, 合計所得金額 = 19.9M ≤ 20M, so the credit applies.
    const eligible = calculateTaxes({
      ...baseInputs([childUnder23]),
      homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
    });
    expect(eligible.totalNetIncome).toBe(19_900_000);
    expect(eligible.homeLoanTaxCredit?.availableCredit).toBe(200_000);
    expect(eligible.homeLoanTaxCredit?.appliedToIncomeTax).toBe(200_000);

    // Without a qualifying dependent, 合計所得金額 = 20.05M > 20M, so the credit is denied.
    const denied = calculateTaxes({
      ...baseInputs([adultChild]),
      homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
    });
    expect(denied.totalNetIncome).toBe(20_050_000);
    expect(denied.homeLoanTaxCredit?.availableCredit).toBe(0);
    expect(denied.homeLoanTaxCredit?.warnings[0]).toContain('eligibility limit');
  });

  it('calculateNetIncomeComponents applies the adjustment when given qualifying dependents', () => {
    const incomeStreams = [
      { id: 's1', type: 'salary' as const, amount: 22_000_000, frequency: 'annual' as const },
    ];
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [childUnder23],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(19_900_000);
    // No dependents argument → no adjustment (backward compatible).
    expect(
      calculateNetIncomeComponents(
        incomeStreams,
        2026,
        'age20to39',
        [],
        EMPTY_PERSONAL_CIRCUMSTANCES,
      ).totalNetIncome,
    ).toBe(20_050_000);
  });
});

describe('grossEmploymentIncome (canonical gross for the Net Employment Income tooltip)', () => {
  const baseInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    ageRange: 'age20to39' as const,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  };

  it('sums salary, bonus and stock compensation, leaving out the commuting allowance', () => {
    const result = calculateTaxes({
      ...baseInputs,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
        // At the non-taxable cap, so none of it is 給与等の収入金額
        {
          id: 'c1',
          type: 'commutingAllowance' as const,
          amount: 150_000,
          frequency: 'monthly' as const,
        },
        { id: 'b1', type: 'bonus' as const, amount: 1_000_000, month: 5 },
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 4_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
    });

    // 6,000,000 + 1,000,000 + 4,000,000 = 11,000,000
    expect(result.grossEmploymentIncome).toBe(11_000_000);

    // The tooltip derives 給与所得控除 as gross − net − adjustment. With the canonical gross this is
    // the real (capped) deduction and is never negative.
    const employmentIncomeDeduction =
      result.grossEmploymentIncome -
      (result.netEmploymentIncome ?? 0) -
      (result.incomeAdjustmentDeduction ?? 0);
    expect(employmentIncomeDeduction).toBe(1_950_000);
    expect(employmentIncomeDeduction).toBeGreaterThanOrEqual(0);
  });

  it('includes stock compensation so the RSU + NHI scenario has no negative deduction', () => {
    // Pre-fix, the Social Insurance tab omitted stock compensation from its gross, so the derived
    // deduction (gross − net) went negative for large RSUs (6M gross < 8.05M net).
    const result = calculateTaxes({
      ...baseInputs,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 4_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
    });

    expect(result.grossEmploymentIncome).toBe(10_000_000); // 6M salary + 4M RSU (NOT 6M)
    expect(result.netEmploymentIncome).toBe(8_050_000); // 10M − 1.95M cap
    expect(result.grossEmploymentIncome - (result.netEmploymentIncome ?? 0)).toBe(1_950_000);
  });

  it('is 0 when there is no employment income', () => {
    const result = calculateTaxes({
      ...baseInputs,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      incomeStreams: [{ id: 'm1', type: 'miscellaneous' as const, amount: 3_000_000 }],
    });
    expect(result.grossEmploymentIncome).toBe(0);
  });
});

describe('calculateTaxes age-range rules', () => {
  const employeeInputs = (ageRange: TaxpayerAgeRange) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      { type: 'bonus' as const, amount: 1_000_000, month: 5, id: 'bonus' },
    ],
    ageRange,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  const nhiInputs = (ageRange: TaxpayerAgeRange) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ type: 'miscellaneous' as const, amount: 4_000_000, id: 'test' }],
    ageRange,
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    region: 'Tokyo-Shinjuku',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  it('charges employee pension below age 20 (no lower enrollment bound)', () => {
    const under18 = calculateTaxes(employeeInputs('under18'));
    const at20to39 = calculateTaxes(employeeInputs('age20to39'));
    expect(under18.pensionPayments).toBe(at20to39.pensionPayments);
    expect(under18.pensionPayments).toBeGreaterThan(0);
  });

  describe('National Pension covers ages 20-59', () => {
    it.each(['age20to39', 'age40to59'] as const)('charges the fixed amount at %s', ageRange => {
      const result = calculateTaxes(nhiInputs(ageRange));
      expect(result.pensionPayments).toBe(getNationalPensionAnnualTotal(2026));
    });

    it.each(['under18', 'age18to19', 'age60to64'] as const)('charges nothing at %s', ageRange => {
      const result = calculateTaxes(nhiInputs(ageRange));
      expect(result.pensionPayments).toBe(0);
      // NHI premiums themselves still apply.
      expect(result.healthInsurance).toBeGreaterThan(0);
    });
  });

  describe('long-term care premium ages 40-64', () => {
    it('matches the 40-59 premium at 60-64 and exceeds the 20-39 premium', () => {
      expect(calculateTaxes(employeeInputs('age60to64')).healthInsurance).toBe(
        calculateTaxes(employeeInputs('age40to59')).healthInsurance,
      );
      expect(calculateTaxes(employeeInputs('age40to59')).healthInsurance).toBeGreaterThan(
        calculateTaxes(employeeInputs('age20to39')).healthInsurance,
      );
    });
  });

  describe('minor (未成年者) residence-tax non-taxation', () => {
    const minorInputs = (ageRange: TaxpayerAgeRange, amount: number) => ({
      ...nhiInputs(ageRange),
      incomeStreams: [{ type: 'miscellaneous' as const, amount, id: 'test' }],
    });

    it('exempts residence tax entirely for a minor with 合計所得金額 at or below 1.35M', () => {
      // Miscellaneous income counts at face value, so 合計所得金額 = 1,350,000 exactly.
      const result = calculateTaxes(minorInputs('under18', 1_350_000));
      expect(result.residenceTax.totalResidenceTax).toBe(0);
      expect(result.residenceTax.perCapitaTax).toBe(0);
      expect(result.residenceTax.nonTaxableStatus).toBe('minor');
      expect(result.furusatoNozei.limit).toBe(0);
    });

    it('taxes a minor normally above the 1.35M limit', () => {
      const result = calculateTaxes(minorInputs('under18', 1_350_001));
      expect(result.residenceTax.totalResidenceTax).toBeGreaterThan(0);
    });

    it('does not exempt an 18-19 year old at the same income', () => {
      const minor = calculateTaxes(minorInputs('under18', 1_350_000));
      const adult = calculateTaxes(minorInputs('age18to19', 1_350_000));
      expect(minor.residenceTax.totalResidenceTax).toBe(0);
      expect(adult.residenceTax.totalResidenceTax).toBeGreaterThan(0);
    });
  });

  it('echoes the age range into the results for cap detection', () => {
    expect(calculateTaxes(employeeInputs('age60to64')).ageRange).toBe('age60to64');
  });
});

describe('calculateTaxes at ages 65 and over', () => {
  const employeeInputs65 = (ageRange: TaxpayerAgeRange) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      { type: 'bonus' as const, amount: 1_000_000, month: 5, id: 'bonus' },
    ],
    ageRange,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  describe("Employees' Pension enrollment ends at age 70", () => {
    it('charges no employee pension at 70-74, including on bonuses', () => {
      const result = calculateTaxes(employeeInputs65('age70to74'));
      expect(result.pensionPayments).toBe(0);
      expect(result.pensionOnBonus).toBe(0);
      // Health and employment insurance still apply.
      expect(result.healthInsurance).toBeGreaterThan(0);
      expect(result.employmentInsurance).toBeGreaterThan(0);
    });

    it('charges the same employee pension at 65-69 as at 20-39', () => {
      const at65to69 = calculateTaxes(employeeInputs65('age65to69'));
      const at20to39 = calculateTaxes(employeeInputs65('age20to39'));
      expect(at65to69.pensionPayments).toBe(at20to39.pensionPayments);
      expect(at65to69.pensionPayments).toBeGreaterThan(0);
      // No long-term care premium via health insurance at 65-69.
      expect(at65to69.healthInsurance).toBe(at20to39.healthInsurance);
    });
  });

  describe('no long-term care premium via health insurance from age 65', () => {
    // From 65 the person is a 介護保険第1号被保険者 and the municipality bills the premium,
    // so the employer-deducted premium and NHI no longer include the 介護保険料率 / 介護分.
    it.each(['age65to69', 'age70to74'] as const)(
      'charges the employee premium at %s without the 介護保険料率',
      ageRange => {
        const premium = calculateTaxes(employeeInputs65(ageRange)).healthInsurance;
        expect(premium).toBe(calculateTaxes(employeeInputs65('age20to39')).healthInsurance);
        expect(premium).toBeLessThan(calculateTaxes(employeeInputs65('age60to64')).healthInsurance);
      },
    );

    it('matches the Kyokai Kenpo Tokyo health-only rates at 65-69', () => {
      // Salary 5,000,000 → 416,667 per month → SMR 410,000. Employee rates in 2026:
      // Jan-Mar 4.955% (FY2025), Apr 4.925%, May-Dec 5.04% (incl. 子ども・子育て支援金).
      // Monthly premiums round 50銭以下切り捨て: 410,000 × 4.955% = 20,315.5 → 20,315;
      // × 4.925% = 20,192.5 → 20,192; × 5.04% = 20,664.
      // Salary: 20,315 × 3 + 20,192 + 20,664 × 8 = 246,449. Bonus 1,000,000 in June at
      // 5.04% = 50,400. Total 296,849, with no 介護保険料率 applied in any month.
      expect(calculateTaxes(employeeInputs65('age65to69')).healthInsurance).toBe(296_849);
    });

    it('charges NHI without the 介護分 at 65-69', () => {
      const nhiInputs65 = (ageRange: TaxpayerAgeRange) => ({
        ...employeeInputs65(ageRange),
        incomeStreams: [{ type: 'miscellaneous' as const, amount: 4_000_000, id: 'test' }],
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shinjuku',
      });
      const at65to69 = calculateTaxes(nhiInputs65('age65to69'));
      expect(at65to69.nhiLongTermCarePortion ?? 0).toBe(0);
      expect(at65to69.healthInsurance).toBeLessThan(
        calculateTaxes(nhiInputs65('age60to64')).healthInsurance,
      );
    });
  });

  describe('介護保険第1号 premium input (ages 65+)', () => {
    it('adds the entered annual amount to social insurance and the deduction', () => {
      const without = calculateTaxes({
        ...employeeInputs65('age65to69'),
        longTermCareCategory1ManualEntry: true,
      });
      const withPremium = calculateTaxes({
        ...employeeInputs65('age65to69'),
        longTermCareCategory1ManualEntry: true,
        longTermCareCategory1Premium: 120_000,
      });

      expect(withPremium.longTermCareCategory1Premium).toBe(120_000);
      // The 社会保険料控除 grows by exactly the premium, so taxable income falls by exactly
      // that amount (a multiple of 1,000, so the 課税所得 rounding does not interfere).
      expect(
        without.taxableIncomeForNationalIncomeTax! - withPremium.taxableIncomeForNationalIncomeTax!,
      ).toBe(120_000);
      // Both taxable incomes (2,450,000 → 2,330,000) sit in the 10% national bracket:
      // income tax falls by 12,000 × 1.021 = 12,252 → 12,200 after rounding to ¥100, and
      // residence tax by 10% = 12,000, so take-home falls by 120,000 − 12,200 − 12,000.
      expect(without.nationalIncomeTax - withPremium.nationalIncomeTax).toBe(12_200);
      expect(
        without.residenceTax.totalResidenceTax - withPremium.residenceTax.totalResidenceTax,
      ).toBe(12_000);
      expect(without.takeHomeIncome - withPremium.takeHomeIncome).toBe(95_800);
      // Health insurance itself is unchanged; the premium is its own component.
      expect(withPremium.healthInsurance).toBe(without.healthInsurance);
    });

    it('ignores the entered amount below age 65', () => {
      for (const ageRange of ['age40to59', 'age60to64'] as const) {
        const result = calculateTaxes({
          ...employeeInputs65(ageRange),
          longTermCareCategory1ManualEntry: true,
          longTermCareCategory1Premium: 120_000,
        });
        expect(result.longTermCareCategory1Premium, ageRange).toBeUndefined();
      }
    });

    it('treats a negative entered amount as nothing entered', () => {
      const without = calculateTaxes({
        ...employeeInputs65('age65to69'),
        longTermCareCategory1ManualEntry: true,
      });
      const negative = calculateTaxes({
        ...employeeInputs65('age65to69'),
        longTermCareCategory1ManualEntry: true,
        longTermCareCategory1Premium: -5_000,
      });
      expect(negative.longTermCareCategory1Premium).toBeUndefined();
      expect(negative.takeHomeIncome).toBe(without.takeHomeIncome);
    });

    it('ignores the entered amount under manual social insurance entry', () => {
      const result = calculateTaxes({
        ...employeeInputs65('age65to69'),
        longTermCareCategory1ManualEntry: true,
        longTermCareCategory1Premium: 120_000,
        manualSocialInsuranceEntry: true,
        manualSocialInsuranceAmount: 500_000,
      });
      expect(result.longTermCareCategory1Premium).toBeUndefined();
      expect(result.socialInsuranceOverride).toBe(500_000);
    });

    it('estimates nothing under manual social insurance entry', () => {
      // The estimate is the default, so this is the case that would leak a premium into the
      // results alongside socialInsuranceOverride if it were ever computed outside the
      // automatic branch. Asserting it from manual entry instead would pass vacuously.
      const result = calculateTaxes({
        ...employeeInputs65('age65to69'),
        manualSocialInsuranceEntry: true,
        manualSocialInsuranceAmount: 500_000,
      });
      expect(result.longTermCareCategory1Estimate).toBeUndefined();
      expect(result.longTermCareCategory1Premium).toBeUndefined();
      expect(result.socialInsuranceOverride).toBe(500_000);
    });
  });

  describe('介護保険第1号 estimate (ages 65+)', () => {
    const nhiPensionInputs = (pensionAmount: number) => ({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ type: 'publicPension' as const, amount: pensionAmount, id: 'p1' }],
      ageRange: 'age65to69' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    });

    it('estimates the premium from the tier judgment by default', () => {
      // 2,400,000 pension → 雑所得 1,300,000 = 合計所得金額 → 住民税課税, tier 7
      // (120万-210万) → Tokyo 基準額 6,320 × 12 = 75,840 × 1.3 = 98,592 → 98,500.
      const result = calculateTaxes(nhiPensionInputs(2_400_000));
      expect(result.longTermCareCategory1Estimate).toEqual({
        currentFiscalYear: { tier: 7, multiplier: 1.3, annualBase: 75_840, premium: 98_500 },
        baseScope: 'Tokyo',
        total: 98_500,
      });
      expect(result.longTermCareCategory1Premium).toBe(98_500);
    });

    it('moves from tiers 1-3 to 4-5 when an entered dependent is 住民税課税', () => {
      // 1,500,000 pension → 雑所得 400,000, within the 均等割 limit → 本人非課税;
      // 年金収入等 1,500,000 exceeds 120万.
      // Alone: 世帯全員非課税 → tier 3 → 75,840 × 0.685 = 51,950.4 → 51,900.
      const alone = calculateTaxes(nhiPensionInputs(1_500_000));
      expect(alone.longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(3);
      expect(alone.longTermCareCategory1Premium).toBe(51_900);

      // With a spouse whose own 合計所得金額 500,000 exceeds the 45万 均等割 limit:
      // 世帯に課税者がいる → tier 5 → 75,840 × 1.0 = 75,800.
      const withTaxableSpouse = calculateTaxes({
        ...nhiPensionInputs(1_500_000),
        dependents: [
          {
            id: 'spouse-1',
            relationship: 'spouse' as const,
            ageRange: 'under65' as const,
            income: {
              grossEmploymentIncome: 0,
              grossPublicPensionIncome: 0,
              otherNetIncome: 500_000,
            },
            disability: 'none' as const,
            isCohabiting: true,
          },
        ],
      });
      expect(withTaxableSpouse.longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(5);
      expect(withTaxableSpouse.longTermCareCategory1Premium).toBe(75_800);
    });

    // The 均等割 limit the tier judgment tests the taxpayer against takes a dependent count and
    // the taxpayer's own circumstances. Both are positional arguments carrying no unit, so a
    // dropped or transposed one would move the taxpayer several tiers with nothing else failing.
    // 1,700,000 of pension leaves 合計所得金額 600,000: above the 450,000 limit alone, below the
    // 1,010,000 limit one qualified dependent buys, and below the 1,350,000 status limit.
    const taxableAlone = () => calculateTaxes(nhiPensionInputs(1_700_000));

    it('raises the taxpayer’s 均等割 limit by the qualified dependent count', () => {
      expect(taxableAlone().longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(6);
      expect(taxableAlone().longTermCareCategory1Premium).toBe(91_000);

      const withDependent = calculateTaxes({
        ...nhiPensionInputs(1_700_000),
        dependents: [
          {
            id: 'spouse-1',
            relationship: 'spouse' as const,
            ageRange: 'under65' as const,
            income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
            disability: 'none' as const,
            isCohabiting: true,
          },
        ],
      });
      // Now 非課税, and the spouse has no income of their own, so the whole 世帯 is untaxed.
      expect(withDependent.longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(3);
      expect(withDependent.longTermCareCategory1Premium).toBe(51_900);
    });

    it('applies the taxpayer’s own 地方税法295条1項2号 status to the same limit', () => {
      const withDisability = calculateTaxes({
        ...nhiPensionInputs(1_700_000),
        personalCircumstances: { disability: 'regular', widowOrSingleParent: 'none' },
      });
      expect(withDisability.longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(3);
      expect(withDisability.longTermCareCategory1Premium).toBe(51_900);
    });
  });

  describe('後期高齢者医療制度 (ages 75+)', () => {
    const latterStageInputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ type: 'miscellaneous' as const, amount: 4_000_000, id: 'test' }],
      ageRange: 'age75plus' as const,
      healthInsuranceProvider: LATTER_STAGE_ELDERLY_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    it('uses the Tokyo premium table and pays no pension', () => {
      const result = calculateTaxes(latterStageInputs);
      // Matches calculateLatterStageElderlyPremium(4,000,000, 2026, 'Tokyo'):
      // blended medical 401,500 + child support 7,000.
      expect(result.latterStageMedicalPortion).toBe(401_500);
      expect(result.latterStageChildSupportPortion).toBe(7_000);
      expect(result.healthInsurance).toBe(408_500);
      expect(result.pensionPayments).toBe(0);
    });

    it('still charges employment insurance on salary income at 75+', () => {
      const result = calculateTaxes({
        ...latterStageInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 4_000_000, frequency: 'annual' as const, id: 's' },
        ],
      });
      expect(result.employmentInsurance).toBeGreaterThan(0);
      expect(result.pensionPayments).toBe(0);
      expect(result.healthInsurance).toBeGreaterThan(0);
    });

    it('charges employment insurance but no health or pension premium on a bonus at 75+', () => {
      const result = calculateTaxes({
        ...latterStageInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 4_000_000, frequency: 'annual' as const, id: 's' },
          { type: 'bonus' as const, amount: 1_000_000, month: 5, id: 'b' },
        ],
      });
      // Gross employment income 5,000,000 → net 3,560,000 → base 3,130,000.
      // FY2025: floor100(47,300 + 3,130,000 × 9.67%) = 349,900
      // FY2026: floor100(53,300 + 3,130,000 × 9.88%) = 362,500; child floor100(1,300 +
      //         3,130,000 × 0.26%) = 9,400
      // Blend:  medical round(349,900/3 + 362,500×2/3) = 358,300; child round(9,400×2/3) = 6,267
      expect(result.latterStageMedicalPortion).toBe(358_300);
      expect(result.latterStageChildSupportPortion).toBe(6_267);
      expect(result.healthInsurance).toBe(364_567);
      expect(result.healthInsuranceOnBonus ?? 0).toBe(0);
      // Employment insurance at the 0.5% rate in force from April 2026.
      expect(result.employmentInsuranceOnBonus).toBe(5_000);
      expect(result.pensionOnBonus ?? 0).toBe(0);
      expect(result.pensionPayments).toBe(0);
    });

    it('combines the latter-stage premium with the entered 第1号 amount', () => {
      const result = calculateTaxes({
        ...latterStageInputs,
        longTermCareCategory1ManualEntry: true,
        longTermCareCategory1Premium: 150_000,
      });
      expect(result.longTermCareCategory1Premium).toBe(150_000);
      expect(result.healthInsurance).toBe(408_500);
    });

    it('estimates the 第1号 amount by default at 75+', () => {
      // 合計所得金額 4,000,000 → 課税, tier 9 (320万-420万) → Tokyo 75,840 × 1.7 =
      // 128,928 → 128,900, its own component beside the latter-stage premium.
      const result = calculateTaxes(latterStageInputs);
      expect(result.longTermCareCategory1Estimate?.currentFiscalYear.tier).toBe(9);
      expect(result.longTermCareCategory1Premium).toBe(128_900);
      expect(result.healthInsurance).toBe(408_500);
    });
  });
});

describe('calculateTaxes with public pension income', () => {
  const pensionInputs = (ageRange: TaxpayerAgeRange) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ type: 'publicPension' as const, amount: 2_400_000, id: 'p1' }],
    ageRange,
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  it('applies the 65+ minimum deduction from the age range (公的年金等控除)', () => {
    const result = calculateTaxes(pensionInputs('age65to69'));
    // 2,400,000 gross − 1,100,000 minimum deduction (65+, band 1)
    expect(result.grossPublicPensionIncome).toBe(2_400_000);
    expect(result.netPublicPensionIncome).toBe(1_300_000);
    expect(result.totalNetIncome).toBe(1_300_000);
    expect(result.annualIncome).toBe(2_400_000);
    // Pension income is not employment income.
    expect(result.hasEmploymentIncome).toBe(false);
    expect(result.grossEmploymentIncome).toBe(0);
    expect(result.employmentInsurance).toBe(0);
  });

  it('applies the under-65 deduction below age 65', () => {
    const result = calculateTaxes(pensionInputs('age60to64'));
    // Deduction 400,000 + 25% × (2,400,000 − 500,000) = 875,000 (above the 600,000 minimum)
    expect(result.netPublicPensionIncome).toBe(1_525_000);
    expect(result.totalNetIncome).toBe(1_525_000);
  });

  it('applies the deduction once to the combined gross of multiple pension streams', () => {
    const result = calculateTaxes({
      ...pensionInputs('age65to69'),
      incomeStreams: [
        { type: 'publicPension' as const, amount: 1_200_000, id: 'p1' },
        { type: 'publicPension' as const, amount: 1_200_000, id: 'p2' },
      ],
    });
    expect(result.grossPublicPensionIncome).toBe(2_400_000);
    expect(result.netPublicPensionIncome).toBe(1_300_000);
  });

  it('bases NHI premiums on the net pension income', () => {
    const pension = calculateTaxes(pensionInputs('age65to69'));
    const equivalentMisc = calculateTaxes({
      ...pensionInputs('age65to69'),
      incomeStreams: [{ type: 'miscellaneous' as const, amount: 1_300_000, id: 'm1' }],
    });
    expect(pension.healthInsurance).toBe(equivalentMisc.healthInsurance);
    expect(pension.healthInsurance).toBeGreaterThan(0);
    // 所法22② and 地法32①: both taxes are levied on the 合計所得金額, which the 公的年金等控除
    // brings to the same 1,300,000 either way, and the social insurance deduction (所法74) is the
    // same premium, so every downstream figure matches.
    expect(pension.nationalIncomeTax).toBe(equivalentMisc.nationalIncomeTax);
    expect(pension.residenceTax.totalResidenceTax).toBe(
      equivalentMisc.residenceTax.totalResidenceTax,
    );
    expect(pension.furusatoNozei.limit).toBe(equivalentMisc.furusatoNozei.limit);
    expect(pension.nationalIncomeTax).toBeGreaterThan(0);
    // No National Pension contributions at 65-69, and no employment insurance,
    // so take-home is income minus taxes, the health premium, and the estimated
    // 介護保険第1号 premium (identical on both sides, so every comparison above holds).
    expect(pension.pensionPayments).toBe(0);
    // Pinned positive so the equivalence below cannot be satisfied by both sides being absent.
    expect(pension.longTermCareCategory1Premium).toBeGreaterThan(0);
    expect(pension.longTermCareCategory1Premium).toBe(equivalentMisc.longTermCareCategory1Premium);
    expect(pension.takeHomeIncome).toBe(
      pension.annualIncome -
        pension.nationalIncomeTax -
        pension.residenceTax.totalResidenceTax -
        pension.healthInsurance -
        (pension.longTermCareCategory1Premium ?? 0),
    );
  });

  it('bases the 後期高齢者医療 premium on the net pension income at 75+', () => {
    const pension = calculateTaxes({
      ...pensionInputs('age75plus'),
      healthInsuranceProvider: LATTER_STAGE_ELDERLY_ID,
    });
    const equivalentMisc = calculateTaxes({
      ...pensionInputs('age75plus'),
      healthInsuranceProvider: LATTER_STAGE_ELDERLY_ID,
      incomeStreams: [{ type: 'miscellaneous' as const, amount: 1_300_000, id: 'm1' }],
    });
    expect(pension.healthInsurance).toBe(equivalentMisc.healthInsurance);
    // Same 合計所得金額 and same premium, so the taxes computed on them agree too.
    expect(pension.nationalIncomeTax).toBe(equivalentMisc.nationalIncomeTax);
    expect(pension.residenceTax.totalResidenceTax).toBe(
      equivalentMisc.residenceTax.totalResidenceTax,
    );
    expect(pension.furusatoNozei.limit).toBe(equivalentMisc.furusatoNozei.limit);
  });

  it('reduces the deduction band when other net income exceeds ¥10,000,000', () => {
    const result = calculateTaxes({
      ...pensionInputs('age60to64'),
      incomeStreams: [
        { type: 'miscellaneous' as const, amount: 10_000_001, id: 'm1' },
        { type: 'publicPension' as const, amount: 3_000_000, id: 'p1' },
      ],
    });
    // Band 2 deduction: 300,000 + 25% × (3,000,000 − 500,000) = 925,000
    expect(result.netPublicPensionIncome).toBe(2_075_000);
    expect(result.totalNetIncome).toBe(12_075_001);
  });

  it('applies the 65+ band-2 minimum when other net income exceeds ¥10,000,000', () => {
    const result = calculateTaxes({
      ...pensionInputs('age65to69'),
      incomeStreams: [
        { type: 'miscellaneous' as const, amount: 10_000_001, id: 'm1' },
        { type: 'publicPension' as const, amount: 2_400_000, id: 'p1' },
      ],
    });
    // 所法35④二: band 2 gives 300,000 + 25% × (2,400,000 − 500,000) = 775,000, but 措法41の15の3
    // guarantees 1,000,000 for a recipient 65 or older, so the minimum governs.
    expect(result.netPublicPensionIncome).toBe(1_400_000);
    expect(result.totalNetIncome).toBe(11_400_001);
  });

  it('applies the band-3 deduction when other net income exceeds ¥20,000,000', () => {
    const result = calculateTaxes({
      ...pensionInputs('age60to64'),
      incomeStreams: [
        { type: 'miscellaneous' as const, amount: 20_000_001, id: 'm1' },
        { type: 'publicPension' as const, amount: 3_000_000, id: 'p1' },
      ],
    });
    // 所法35④三: band 3 gives 200,000 + 25% × (3,000,000 − 500,000) = 825,000, above the band's
    // 400,000 under-65 minimum, so the computed amount governs.
    expect(result.netPublicPensionIncome).toBe(2_175_000);
    expect(result.totalNetIncome).toBe(22_175_001);
  });

  it('omits the pension fields entirely when there is no pension stream', () => {
    const result = calculateTaxes({
      ...pensionInputs('age65to69'),
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 's1' },
      ],
    });
    expect(result.grossPublicPensionIncome).toBeUndefined();
    expect(result.netPublicPensionIncome).toBeUndefined();
    expect(result.pensionIncomeAdjustmentDeduction).toBeUndefined();
  });

  it('omits the 双方 adjustment for pension-only income', () => {
    // 措法41の3の11①一 requires both 給与所得 and 年金雑所得, so pension alone never qualifies.
    const result = calculateTaxes(pensionInputs('age65to69'));
    expect(result.pensionIncomeAdjustmentDeduction).toBeUndefined();
  });

  it('judges the deduction band on net employment income, not the gross salary', () => {
    const result = calculateTaxes({
      ...pensionInputs('age65to69'),
      incomeStreams: [
        { type: 'salary' as const, amount: 11_000_000, frequency: 'annual' as const, id: 's1' },
        { type: 'publicPension' as const, amount: 2_400_000, id: 'p1' },
      ],
    });
    // 給与所得 11,000,000 − 1,950,000 = 9,050,000 stays in band 1 (≤ ¥10,000,000) even though the
    // gross salary exceeds it, so the 65+ minimum deduction of 1,100,000 applies.
    expect(result.netPublicPensionIncome).toBe(1_300_000);
    expect(result.pensionIncomeAdjustmentDeduction).toBe(100_000);
    expect(result.netEmploymentIncome).toBe(8_950_000);
    expect(result.totalNetIncome).toBe(10_250_000);
  });

  describe('所得金額調整控除（給与所得と年金所得の双方を有する者）', () => {
    const salaryAndPensionInputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
        { type: 'publicPension' as const, amount: 2_400_000, id: 'p1' },
      ],
      ageRange: 'age65to69' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    it('deducts the full ¥100,000 from net employment income when both exceed the cap', () => {
      const result = calculateTaxes(salaryAndPensionInputs);
      expect(result.pensionIncomeAdjustmentDeduction).toBe(100_000);
      // 給与所得 2,020,000 − 100,000 adjustment
      expect(result.netEmploymentIncome).toBe(1_920_000);
      expect(result.netPublicPensionIncome).toBe(1_300_000);
      expect(result.totalNetIncome).toBe(3_220_000);
    });

    it('caps the adjustment at the net employment income when it is below ¥100,000', () => {
      const result = calculateTaxes({
        ...salaryAndPensionInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 800_000, frequency: 'annual' as const, id: 's1' },
          { type: 'publicPension' as const, amount: 2_000_000, id: 'p1' },
        ],
      });
      // 給与所得 60,000: adjustment = 60,000 + 100,000 − 100,000, zeroing employment income
      expect(result.pensionIncomeAdjustmentDeduction).toBe(60_000);
      expect(result.netEmploymentIncome).toBe(0);
      expect(result.netPublicPensionIncome).toBe(900_000);
      expect(result.totalNetIncome).toBe(900_000);
    });

    it('caps the adjustment at the net pension income when it is below ¥100,000', () => {
      const result = calculateTaxes({
        ...salaryAndPensionInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
          { type: 'publicPension' as const, amount: 1_150_000, id: 'p1' },
        ],
      });
      // 雑所得 1,150,000 − 1,100,000 = 50,000: adjustment = 100,000 + 50,000 − 100,000
      expect(result.netPublicPensionIncome).toBe(50_000);
      expect(result.pensionIncomeAdjustmentDeduction).toBe(50_000);
      expect(result.netEmploymentIncome).toBe(1_970_000);
      expect(result.totalNetIncome).toBe(2_020_000);
    });

    it('sums the shortfalls when both incomes are below ¥100,000', () => {
      const result = calculateTaxes({
        ...salaryAndPensionInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 800_000, frequency: 'annual' as const, id: 's1' },
          { type: 'publicPension' as const, amount: 1_150_000, id: 'p1' },
        ],
      });
      // 給与所得 60,000 and 雑所得 50,000: adjustment = 60,000 + 50,000 − 100,000
      expect(result.pensionIncomeAdjustmentDeduction).toBe(10_000);
      expect(result.netEmploymentIncome).toBe(50_000);
      expect(result.netPublicPensionIncome).toBe(50_000);
      expect(result.totalNetIncome).toBe(100_000);
    });

    it('does not apply when the pension deduction already zeroes the pension income', () => {
      const result = calculateTaxes({
        ...salaryAndPensionInputs,
        incomeStreams: [
          { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
          { type: 'publicPension' as const, amount: 1_100_000, id: 'p1' },
        ],
      });
      expect(result.pensionIncomeAdjustmentDeduction).toBeUndefined();
      expect(result.grossPublicPensionIncome).toBe(1_100_000);
      expect(result.netPublicPensionIncome).toBe(0);
      expect(result.netEmploymentIncome).toBe(2_020_000);
      expect(result.totalNetIncome).toBe(2_020_000);
    });
  });
});

describe('calculateNetIncomeComponents with public pension income', () => {
  const streams = [{ type: 'publicPension' as const, amount: 3_000_000, id: 'p1' }];

  it('uses the 65+ minimum deduction when the taxpayer is 65 or older', () => {
    expect(
      calculateNetIncomeComponents(streams, 2026, 'age65to69', [], EMPTY_PERSONAL_CIRCUMSTANCES)
        .totalNetIncome,
    ).toBe(1_900_000);
  });

  it('uses the under-65 deduction otherwise', () => {
    // Deduction 400,000 + 25% × (3,000,000 − 500,000) = 1,025,000
    expect(
      calculateNetIncomeComponents(streams, 2026, 'age60to64', [], EMPTY_PERSONAL_CIRCUMSTANCES)
        .totalNetIncome,
    ).toBe(1_975_000);
  });
});

describe('calculateTaxes with investment income streams', () => {
  // Baseline: the 5,000,000-yen salary case from the top-level describe block above.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []) => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'salary' },
      ...streams,
    ],
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });

  it('leaves every earned-income field unchanged and adds investment income on top', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        { type: 'listedCapitalGains', amount: 1_000_000, id: 'gains' },
        { type: 'listedDividends', amount: 200_000, id: 'dividends' },
      ]),
    );

    expect(result.nationalIncomeTax).toBe(baseline.nationalIncomeTax);
    expect(result.residenceTax.totalResidenceTax).toBe(baseline.residenceTax.totalResidenceTax);
    expect(result.healthInsurance).toBe(baseline.healthInsurance);
    expect(result.pensionPayments).toBe(baseline.pensionPayments);
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);

    // base = max(0, 1,000,000 + 200,000) = 1,200,000; 15.315% = 183,780; 5% = 60,000
    expect(result.investmentIncome).toEqual({
      gross: { listedCapitalGains: 1_000_000, listedDividends: 200_000, depositInterest: 0 },
      grossTotal: 1_200_000,
      withheld: {
        listed: { base: 1_200_000, national: 183_780, residence: 60_000 },
        depositInterest: { base: 0, national: 0, residence: 0 },
        national: 183_780,
        residence: 60_000,
        total: 243_780,
      },
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 1_200_000 - 243_780);
  });

  it('nets a capital loss against dividends down to zero tax when the loss is larger', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        { type: 'listedCapitalGains', amount: -500_000, id: 'gains' },
        { type: 'listedDividends', amount: 300_000, id: 'dividends' },
      ]),
    );

    expect(result.investmentIncome?.withheld.total).toBe(0);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome - 200_000);
  });

  it('taxes only the remainder when a capital loss partially offsets dividends', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        { type: 'listedCapitalGains', amount: -500_000, id: 'gains' },
        { type: 'listedDividends', amount: 800_000, id: 'dividends' },
      ]),
    );

    // base = 300,000; national = 45,945; residence = 15,000; total = 60,945
    expect(result.investmentIncome?.withheld.total).toBe(60_945);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 300_000 - 60_945);
  });

  it('does not change National Health Insurance when only deposit interest is reported', () => {
    // Non-employment-income NHI baseline: 5,000,000-yen miscellaneous income.
    const nhiInputs = (streams: TakeHomeInputs['incomeStreams'] = []) => ({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { type: 'miscellaneous' as const, amount: 5_000_000, id: 'misc' },
        ...streams,
      ],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    });
    const baseline = calculateTaxes(nhiInputs());
    const result = calculateTaxes(
      nhiInputs([{ type: 'depositInterest', amount: 100_000, id: 'interest' }]),
    );

    expect(result.healthInsurance).toBe(baseline.healthInsurance);
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);
    expect(result.investmentIncome?.withheld).toEqual({
      listed: { base: 0, national: 0, residence: 0 },
      depositInterest: { base: 100_000, national: 15_315, residence: 5_000 },
      national: 15_315,
      residence: 5_000,
      total: 20_315,
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 100_000 - 20_315);
  });

  it('handles a capital loss with no dividends to net against (withheld tax is zero)', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([{ type: 'listedCapitalGains', amount: -300_000, id: 'gains' }]),
    );

    expect(result.investmentIncome).toEqual({
      gross: { listedCapitalGains: -300_000, listedDividends: 0, depositInterest: 0 },
      grossTotal: -300_000,
      withheld: {
        listed: { base: 0, national: 0, residence: 0 },
        depositInterest: { base: 0, national: 0, residence: 0 },
        national: 0,
        residence: 0,
        total: 0,
      },
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome - 300_000);
  });

  it('truncates withholding to the whole yen on top of earned income', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([{ type: 'listedDividends', amount: 1_234_567, id: 'dividends' }]),
    );

    // 1,234,567 * 0.15315 = 189,073.93...; 1,234,567 * 0.05 = 61,728.35
    expect(result.investmentIncome?.withheld.listed).toEqual({
      base: 1_234_567,
      national: 189_073,
      residence: 61_728,
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 1_234_567 - 189_073 - 61_728);
  });

  it('leaves investmentIncome absent and results identical when every stream amount is zero', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        { type: 'listedCapitalGains', amount: 0, id: 'gains' },
        { type: 'listedDividends', amount: 0, id: 'dividends' },
        { type: 'depositInterest', amount: 0, id: 'interest' },
      ]),
    );

    expect(result.investmentIncome).toBeUndefined();
    expect(result).toEqual(baseline);
  });

  it('computes real results for an investment-only taxpayer with no earned income', () => {
    const result = calculateTaxes({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ type: 'listedDividends', amount: 1_000_000, id: 'dividends' }],
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      // Manual social insurance entry isolates this case from the NHI/pension data tables,
      // which are unaffected by 申告不要 investment income and are exercised elsewhere.
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    });

    expect(result.annualIncome).toBe(0);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(0);
    // base = 1,000,000; national = 153,150; residence = 50,000
    expect(result.investmentIncome?.withheld.total).toBe(203_150);
    expect(result.takeHomeIncome).toBe(1_000_000 - 203_150);
  });
});
