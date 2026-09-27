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
  incomeTaxPaid,
  residenceTaxPaid,
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
    expect(result.salaryIncome).toBe(6_000_000);
    expect(result.bonusIncome).toBe(1_000_000);

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

  it('counts a withheld-only amount in annual income and in take-home net of the tax withheld', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: 1_000_000,
          dividends: 200_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
          id: 'account',
        },
      ]),
    );

    expect(result.nationalIncomeTax).toBe(baseline.nationalIncomeTax);
    expect(result.residenceTax.totalResidenceTax).toBe(baseline.residenceTax.totalResidenceTax);
    expect(result.healthInsurance).toBe(baseline.healthInsurance);
    expect(result.pensionPayments).toBe(baseline.pensionPayments);
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);

    // base = max(0, 1,000,000 + 200,000) = 1,200,000; 15.315% = 183,780; 5% = 60,000
    expect(result.investmentIncome).toEqual({
      withheld: {
        accounts: [{ position: 1, capitalGains: 1_000_000, dividends: 200_000, base: 1_200_000 }],
        dividends: 0,
        interest: 0,
        received: 1_200_000,
        taxedAmount: 1_200_000,
        tax: { national: 183_780, residence: 60_000, total: 243_780 },
      },
    });
    // The 1,200,000 is income received; the 243,780 withheld on it is a tax like any other.
    expect(result.annualIncome).toBe(baseline.annualIncome + 1_200_000);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 1_200_000 - 243_780);
  });

  it('nets a capital loss against dividends down to zero tax when the loss is larger', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: -500_000,
          dividends: 300_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
          id: 'account',
        },
      ]),
    );

    expect(result.investmentIncome?.withheld?.tax.total).toBe(0);
    // The net loss of 200,000 is money gone, so it lowers take-home with nothing withheld.
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome - 200_000);
  });

  it('taxes only the remainder when a capital loss partially offsets dividends', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: -500_000,
          dividends: 800_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
          id: 'account',
        },
      ]),
    );

    // base = 300,000; national = 45,945; residence = 15,000; total = 60,945
    expect(result.investmentIncome?.withheld?.tax.total).toBe(60_945);
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
      nhiInputs([
        {
          type: 'interest',
          payerDomicile: 'domestic',
          amount: 100_000,
          id: 'interest',
          foreignTax: 0,
        },
      ]),
    );

    expect(result.healthInsurance).toBe(baseline.healthInsurance);
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);
    expect(result.investmentIncome?.withheld?.tax).toEqual({
      national: 15_315,
      residence: 5_000,
      total: 20_315,
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 100_000 - 20_315);
  });

  it('handles a capital loss with no dividends to net against (withheld tax is zero)', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: -300_000,
          dividends: 0,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
          id: 'account',
        },
      ]),
    );

    // The loss has no dividends in its account to net against, so the base is max(0, −300,000).
    expect(result.investmentIncome).toEqual({
      withheld: {
        accounts: [{ position: 1, capitalGains: -300_000, dividends: 0, base: 0 }],
        dividends: 0,
        interest: 0,
        received: -300_000,
        taxedAmount: 0,
        tax: { national: 0, residence: 0, total: 0 },
      },
    });
    expect(result.annualIncome).toBe(baseline.annualIncome - 300_000);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome - 300_000);
  });

  it('truncates withholding to the whole yen on top of earned income', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 1_234_567,
          id: 'dividends',
        },
      ]),
    );

    // 1,234,567 * 0.15315 = 189,073.93...; 1,234,567 * 0.05 = 61,728.35
    expect(result.investmentIncome?.withheld?.tax).toEqual({
      national: 189_073,
      residence: 61_728,
      total: 250_801,
    });
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 1_234_567 - 250_801);
  });

  it('leaves investmentIncome absent and results identical when every stream amount is zero', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: 0,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
          id: 'account',
        },
        { type: 'interest', payerDomicile: 'domestic', amount: 0, id: 'interest', foreignTax: 0 },
      ]),
    );

    expect(result.investmentIncome).toBeUndefined();
    expect(result).toEqual(baseline);
  });

  it('gives an investment-only taxpayer the dividend net of the withholding as take-home', () => {
    const result = calculateTaxes({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        {
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 1_000_000,
          id: 'dividends',
        },
      ],
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

    expect(result.annualIncome).toBe(1_000_000);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(0);
    // base = 1,000,000; national = 153,150; residence = 50,000
    expect(result.investmentIncome?.withheld?.tax.total).toBe(203_150);
    expect(result.takeHomeIncome).toBe(1_000_000 - 203_150);
  });

  // The UI offers only the supported variant, so these guard the engine against a stream
  // built elsewhere being silently taxed under the wrong regime.
  it('rejects 一般株式等 gains and dividends, which are a separate 分離課税 class', () => {
    expect(() =>
      calculateTaxes(
        salaryInputs([
          {
            type: 'capitalGains',
            shareType: 'other',
            account: 'domesticNoWithholding',
            amount: 500_000,
            id: 'gains',
          },
        ]),
      ),
    ).toThrow(/一般株式等/);
    expect(() =>
      calculateTaxes(
        salaryInputs([
          {
            type: 'dividends',
            shareType: 'other',
            paymentChannel: 'domestic',
            isReported: false,
            issuerDomicile: 'domestic',
            foreignTax: 0,
            amount: 500_000,
            id: 'dividends',
          },
        ]),
      ),
    ).toThrow(/一般株式等/);
  });

  it('rejects a dividend paid abroad left off the return, which 措令4条の3② excludes from 申告不要', () => {
    expect(() =>
      calculateTaxes(
        salaryInputs([
          {
            type: 'dividends',
            shareType: 'listed',
            paymentChannel: 'abroad',
            isReported: false,
            issuerDomicile: 'domestic',
            foreignTax: 0,
            amount: 1_000_000,
            id: 'dividends',
          },
        ]),
      ),
    ).toThrow(/措令4条の3/);
  });

  it('rejects a negative interest amount, paid in Japan or outside it', () => {
    expect(() =>
      calculateTaxes(
        salaryInputs([
          {
            type: 'interest',
            payerDomicile: 'domestic',
            amount: -1,
            id: 'interest',
            foreignTax: 0,
          },
        ]),
      ),
    ).toThrow(/Interest cannot be negative/);
    expect(() =>
      calculateTaxes(
        salaryInputs([
          { type: 'interest', payerDomicile: 'foreign', amount: -1, id: 'interest', foreignTax: 0 },
        ]),
      ),
    ).toThrow(/Interest cannot be negative/);
  });
});

describe('calculateTaxes with interest paid outside Japan', () => {
  // The same 5,000,000-yen employee, income year 2026: 給与所得 3,560,000; social insurance
  // 722,252; 所得税 91,700; 住民税 243,100; take-home 3,942,948. 措法3条① settles by
  // 源泉分離課税 only the 一般利子等 国内において支払を受けるべき, so interest with no Japanese
  // payer is 利子所得 inside 総所得金額 (所法22条②一) and is taxed with the rest.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
      ...streams,
    ],
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });
  const foreignInterest = (amount: number, id = 'interest') => ({
    type: 'interest' as const,
    payerDomicile: 'foreign' as const,
    foreignTax: 0,
    amount,
    id,
  });

  it('taxes it in the brackets as 利子所得 inside 総所得金額, with nothing withheld', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(salaryInputs([foreignInterest(100_000)]));

    // 合計所得金額 3,560,000 + 100,000 = 3,660,000, still inside the 1,040,000 基礎控除 tier
    // (up to 4,890,000).
    expect(result.annualIncome).toBe(5_100_000);
    expect(result.totalNetIncome).toBe(3_660_000);
    expect(result.nationalIncomeTaxBasicDeduction).toBe(1_040_000);
    // Nothing is left to withholding, so only the reported part is present.
    expect(result.investmentIncome).toEqual({
      reported: { aggregate: { dividends: 0, interest: 100_000 } },
    });

    // 課税総所得金額 3,660,000 − 722,252 − 1,040,000 = 1,897,748 → 1,897,000, in the 5% bracket:
    // 94,850; with the 2.1% 復興特別所得税 96,841.85 → 96,800.
    expect(result.taxableIncomeForNationalIncomeTax).toBe(1_897_000);
    expect(result.nationalIncomeTaxBase).toBe(94_850);
    expect(result.nationalIncomeTax).toBe(96_800);
    // 住民税: 3,660,000 − 722,252 − 430,000 = 2,507,748 → 2,507,000. The 調整控除 stays 2,500:
    // 課税総所得金額 is over 2,000,000, so it is 5% of max(50,000 人的控除差 − (2,507,000 −
    // 2,000,000), 50,000). 市 150,420 − 1,500 = 148,920 → 148,900; 県 100,280 − 1,000 = 99,280
    // → 99,200; plus the 5,000 均等割 = 253,100.
    expect(result.taxableIncomeForResidenceTax).toBe(2_507_000);
    expect(result.residenceTax.city.cityAdjustmentCredit).toBe(1_500);
    expect(result.residenceTax.prefecture.prefecturalAdjustmentCredit).toBe(1_000);
    expect(result.residenceTax.separate).toBeUndefined();
    expect(result.residenceTax.totalResidenceTax).toBe(253_100);

    // Only the two assessed taxes move: 96,800 − 91,700 and 253,100 − 243,100.
    expect(baseline.nationalIncomeTax).toBe(91_700);
    expect(baseline.residenceTax.totalResidenceTax).toBe(243_100);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome + 100_000 - 5_100 - 10_000);
    expect(result.takeHomeIncome).toBe(4_027_848);
  });

  it('raises the National Health Insurance base, unlike the same interest paid in Japan', () => {
    // 5,000,000 of miscellaneous income in Chiyoda Ward, where the calendar year blends the
    // FY2025 and FY2026 rate tables (3/10 + 7/10).
    const nhiInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: [{ type: 'miscellaneous', amount: 5_000_000, id: 'misc' }, ...streams],
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo-Chiyoda',
    });
    const baseline = calculateTaxes(nhiInputs());
    const result = calculateTaxes(nhiInputs([foreignInterest(100_000)]));
    const domestic = calculateTaxes(
      nhiInputs([
        {
          type: 'interest',
          payerDomicile: 'domestic',
          amount: 100_000,
          id: 'interest',
          foreignTax: 0,
        },
      ]),
    );

    expect(result.totalNetIncome).toBe(baseline.totalNetIncome + 100_000);
    // NHI base 4,570,000 → 4,670,000 (総所得金額等 less the 430,000 基礎控除). The extra
    // 100,000 adds, per fiscal year: FY2025 7,710 medical (7.71%) + 2,690 support (2.69%);
    // FY2026 7,510 medical (7.51%) + 2,800 support (2.8%) + 270 child support (0.27%). Blended,
    // 3/10 × 10,400 + 7/10 × 10,580 = 3,120 + 7,406 = 10,526.
    expect(result.healthInsurance - baseline.healthInsurance).toBe(10_526);

    // Interest paid in Japan is settled by the 20.315% withholding and reaches neither figure.
    expect(domestic.totalNetIncome).toBe(baseline.totalNetIncome);
    expect(domestic.healthInsurance).toBe(baseline.healthInsurance);
  });

  it('computes real results for a taxpayer with foreign interest and no other income', () => {
    const result = calculateTaxes({
      ...salaryInputs(),
      incomeStreams: [foreignInterest(1_000_000)],
      // Manual social insurance keeps the NHI and pension tables out of this case.
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
    });

    // 合計所得金額 1,000,000 (所法23条②: the whole receipt, no deduction). The 1,040,000
    // 基礎控除 leaves no 課税総所得金額, so no 所得税. 住民税: over the 450,000 非課税限度額
    // at 1級地, 課税総所得金額 1,000,000 − 430,000 = 570,000 → 市 34,200 / 県 22,800 less the
    // 1,500 / 1,000 調整控除 (5% of the 50,000 人的控除差) → 32,700 / 21,800; plus the 5,000
    // 均等割 = 59,500.
    expect(result.annualIncome).toBe(1_000_000);
    expect(result.totalNetIncome).toBe(1_000_000);
    expect(result.investmentIncome?.reported?.aggregate?.interest).toBe(1_000_000);
    expect(result.investmentIncome?.withheld).toBeUndefined();
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(59_500);
    expect(result.takeHomeIncome).toBe(940_500);
  });

  it('counts it in the 公的年金等控除 band base (所法35条④一) and in 総所得金額', () => {
    const components = calculateNetIncomeComponents(
      [{ type: 'publicPension', amount: 3_000_000, id: 'pension' }, foreignInterest(10_500_000)],
      2026,
      'age65to69',
      [],
      EMPTY_PERSONAL_CIRCUMSTANCES,
    );

    // 公的年金等に係る雑所得以外の合計所得金額 of 10,500,000 is over 10,000,000, so the 65+
    // deduction is 300,000 + 25% × (3,000,000 − 500,000) = 925,000, raised to its 1,000,000
    // floor → 雑所得 2,000,000.
    expect(components.aggregateInterestIncome).toBe(10_500_000);
    expect(components.netPublicPensionIncome).toBe(2_000_000);
    expect(components.aggregateNetIncome).toBe(12_500_000);
    expect(components.totalNetIncome).toBe(12_500_000);
  });
});

describe('calculateTaxes with a 特定口座（源泉徴収あり）', () => {
  // Same 5,000,000-yen employee baseline as above: 所得税 91,700, 住民税 243,100, social
  // insurance 722,252, take-home 3,942,948.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
      ...streams,
    ],
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });
  const account = (
    capitalGains: number,
    dividends: number,
    reportsCapitalGains = false,
    reportsDividends = false,
    id = 'account',
  ) => ({
    type: 'withholdingAccount' as const,
    id,
    capitalGains,
    dividends,
    foreignDividends: 0,
    foreignTax: 0,
    reportsCapitalGains,
    reportsDividends,
  });

  it('does not net one account against another', () => {
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        account(-500_000, 300_000, false, false, 'a'),
        account(0, 600_000, false, false, 'b'),
      ]),
    );

    // base = max(0, −500,000 + 300,000) + max(0, 0 + 600,000) = 0 + 600,000 = 600,000;
    // 600,000 × 15.315% = 91,890; 600,000 × 5% = 30,000.
    // Each account's own base, so the taxed 600,000 differs from the 400,000 received.
    expect(result.investmentIncome).toEqual({
      withheld: {
        accounts: [
          { position: 1, capitalGains: -500_000, dividends: 300_000, base: 0 },
          { position: 2, capitalGains: 0, dividends: 600_000, base: 600_000 },
        ],
        dividends: 0,
        interest: 0,
        received: 400_000,
        taxedAmount: 600_000,
        tax: { national: 91_890, residence: 30_000, total: 121_890 },
      },
    });
    expect(result.nationalIncomeTax).toBe(baseline.nationalIncomeTax);
    expect(result.residenceTax.totalResidenceTax).toBe(baseline.residenceTax.totalResidenceTax);
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);
    // −500,000 + 300,000 + 600,000 received on top of the salary.
    expect(result.annualIncome).toBe(5_400_000);
  });

  it('leaves a withheld loss in the account when only the dividends are reported', () => {
    // The migrated "does not net a withheld loss against reported dividends" case: the loss
    // stays in the account (base max(0, −500,000) = 0), so the return taxes the 800,000 whole.
    const result = calculateTaxes(salaryInputs([account(-500_000, 800_000, false, true)]));

    expect(result.investmentIncome?.withheld?.tax).toEqual({ national: 0, residence: 0, total: 0 });
    expect(result.investmentIncome?.reported?.separate).toMatchObject({
      gross: { capitalGains: 0, dividends: 800_000 },
      lossOffsetAgainstDividends: 0,
      taxable: { capitalGains: 0, dividends: 800_000 },
      nationalIncomeTaxBase: 120_000,
    });
    // 5,000,000 + 800,000 reported − 500,000 lost in the account.
    expect(result.annualIncome).toBe(5_300_000);
  });

  it('taxes each account on its own base when a loss in one exceeds its dividends', () => {
    // Account 1: max(0, −18,000 + 8,000) = 0; account 2: max(0, 0 + 10,000) = 10,000. The pooled
    // gross amounts net to 0, but the rates apply to 10,000: floor(10,000 × 15.315%) = 1,531 and
    // 10,000 × 5% = 500.
    const result = calculateTaxes(
      salaryInputs([
        account(-18_000, 8_000, false, false, 'a'),
        account(0, 10_000, false, false, 'b'),
      ]),
    );

    expect(result.investmentIncome?.withheld?.received).toBe(0);
    expect(result.investmentIncome?.withheld?.tax).toEqual({
      national: 1_531,
      residence: 500,
      total: 2_031,
    });
    expect(result.investmentIncome?.withheld?.accounts).toEqual([
      { position: 1, capitalGains: -18_000, dividends: 8_000, base: 0 },
      { position: 2, capitalGains: 0, dividends: 10_000, base: 10_000 },
    ]);
    expect(result.investmentIncome?.withheld?.taxedAmount).toBe(10_000);
  });

  it('numbers accounts among all account entries and leaves out a fully reported one', () => {
    // Account 1 is reported in full, so nothing of it is withheld; account 2 keeps its number.
    const result = calculateTaxes(
      salaryInputs([
        account(1_000_000, 0, true, false, 'a'),
        account(0, 50_000, false, false, 'b'),
      ]),
    );

    expect(result.investmentIncome?.withheld?.accounts).toEqual([
      { position: 2, capitalGains: 0, dividends: 50_000, base: 50_000 },
    ]);
  });

  it('has to report the dividends when a reported loss reduced their withholding (措法37条の11の6⑩)', () => {
    expect(() => calculateTaxes(salaryInputs([account(-500_000, 800_000, true, false)]))).toThrow(
      /措法37条の11の6/,
    );
  });

  it('nets a qualifying loss against reported dividends from the same account (損益通算)', () => {
    // The migrated 損益通算 case.
    const result = calculateTaxes(salaryInputs([account(-500_000, 800_000, true, true)]));

    expect(result.investmentIncome?.reported?.separate).toEqual({
      gross: { capitalGains: -500_000, dividends: 800_000 },
      lossOffsetAgainstDividends: 500_000,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 0, dividends: 300_000 },
      taxable: { capitalGains: 0, dividends: 300_000 },
      nationalIncomeTaxBase: 45_000,
    });
    expect(result.annualIncome).toBe(5_300_000);
    // 89,850 + 45,000 = 134,850 × 1.021 = 137,681.85 → 137,600; 住民税 243,100 + (9,000 + 6,000) =
    // 258,100.
    expect(result.nationalIncomeTax).toBe(137_600);
    expect(result.residenceTax.totalResidenceTax).toBe(258_100);
    expect(result.takeHomeIncome).toBe(5_300_000 - 137_600 - 258_100 - 722_252);
  });

  it('reports a gain alone, leaving the dividends withheld', () => {
    const result = calculateTaxes(salaryInputs([account(1_000_000, 200_000, true, false)]));

    expect(result.investmentIncome?.reported?.separate?.taxable).toEqual({
      capitalGains: 1_000_000,
      dividends: 0,
    });
    // The sales are reported, so only the dividends are left to withholding.
    expect(result.investmentIncome?.withheld?.accounts).toEqual([
      { position: 1, capitalGains: 0, dividends: 200_000, base: 200_000 },
    ]);
    // 89,850 + 15% of 1,000,000 (150,000) = 239,850; × 1.021 = 244,886.85 → 244,800.
    expect(result.nationalIncomeTax).toBe(244_800);
    // 243,100 + 3%/2% of 1,000,000 (30,000 + 20,000) = 293,100.
    expect(result.residenceTax.totalResidenceTax).toBe(293_100);
    // base = 200,000; national = 30,630; residence = 10,000.
    expect(result.investmentIncome?.withheld?.tax).toEqual({
      national: 30_630,
      residence: 10_000,
      total: 40_630,
    });
    expect(result.annualIncome).toBe(6_200_000);
    // 6,000,000 − 244,800 − 293,100 − 722,252 = 4,739,848 on the return, plus the 200,000 of
    // dividends net of the 40,630 withheld on them.
    expect(result.takeHomeIncome).toBe(4_739_848 + 200_000 - 40_630);
  });
});

describe('calculateTaxes with investment income reported under 申告分離課税', () => {
  // The 5,000,000-yen employee of the 申告不要 cases above, income year 2026: 給与所得 3,560,000;
  // social insurance 246,449 + 450,180 + 25,623 = 722,252; 基礎控除 1,040,000 (合計所得金額 ≤
  // 4,890,000); 課税総所得金額 1,797,000 → 所得税 89,850 (91,700 with the 復興特別所得税);
  // 住民税 課税総所得金額 2,407,000 → 市 144,420 / 県 96,280 less the 2,500 調整控除 split 60/40 →
  // 142,900 / 95,200, plus 5,000 均等割 = 243,100.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
      ...streams,
    ],
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });
  const reportedDividends = (amount: number, id = 'dividends') => ({
    type: 'dividends' as const,
    shareType: 'listed' as const,
    paymentChannel: 'domestic' as const,
    isReported: true as const,
    issuerDomicile: 'domestic' as const,
    foreignTax: 0,
    amount,
    id,
  });
  const reportedGains = (
    amount: number,
    account: 'domesticNoWithholding' | 'foreign',
    id = 'gains',
  ) => ({
    type: 'capitalGains' as const,
    shareType: 'listed' as const,
    account,
    amount,
    id,
  });

  it('taxes reported dividends at 15% + 5% beside the earned income, inside take-home', () => {
    const result = calculateTaxes(salaryInputs([reportedDividends(1_000_000)]));

    // 合計所得金額 takes the reported amount (措法8条の4③一): 4,560,000, still ≤ 4,890,000, so the
    // 基礎控除 is unchanged. The income on the return is 6,000,000.
    expect(result.annualIncome).toBe(6_000_000);
    expect(result.totalNetIncome).toBe(4_560_000);
    expect(result.nationalIncomeTaxBasicDeduction).toBe(1_040_000);
    expect(result.investmentIncome?.reported?.separate).toEqual({
      gross: { capitalGains: 0, dividends: 1_000_000 },
      lossOffsetAgainstDividends: 0,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 0, dividends: 1_000_000 },
      taxable: { capitalGains: 0, dividends: 1_000_000 },
      nationalIncomeTaxBase: 150_000,
    });
    // 所得税: 89,850 on 課税総所得金額 plus 1,000,000 × 15% (措法8条の4①); the 2.1% 復興特別所得税
    // is on the 239,850 together (5,036.85); 244,886 → 244,800.
    expect(result.taxableIncomeForNationalIncomeTax).toBe(1_797_000);
    expect(result.nationalIncomeTaxBase).toBe(89_850);
    expect(result.nationalIncomeTax).toBe(244_800);
    // 住民税: 3% 市 / 2% 県 on the 1,000,000 (地方税法附則第33条の2第1項・第5項) join each side's
    // 所得割 before its ¥100 floor: 144,420 + 30,000 − 1,500 → 172,900; 96,280 + 20,000 − 1,000 →
    // 115,200; with the 5,000 均等割, 293,100.
    expect(result.residenceTax.separate).toEqual({
      taxableDividends: 1_000_000,
      taxableCapitalGains: 0,
      cityIncomeTax: 30_000,
      prefecturalIncomeTax: 20_000,
    });
    expect(result.residenceTax.city.cityIncomeTax).toBe(172_900);
    expect(result.residenceTax.prefecture.prefecturalIncomeTax).toBe(115_200);
    expect(result.residenceTax.totalResidenceTax).toBe(293_100);
    // Nothing is withheld: the amount is assessed on the return, and take-home covers it:
    // 6,000,000 − 244,800 − 293,100 − 722,252.
    expect(result.investmentIncome?.withheld).toBeUndefined();
    expect(result.takeHomeIncome).toBe(4_739_848);
  });

  it('taxes a dividend paid abroad the same way once it is reported', () => {
    // 措令4条の3② excludes a dividend paid abroad from 申告不要, but says nothing about how a
    // reported one is taxed once it is on the return.
    const result = calculateTaxes(
      salaryInputs([{ ...reportedDividends(1_000_000), paymentChannel: 'abroad' as const }]),
    );

    expect(result.nationalIncomeTax).toBe(244_800);
    expect(result.residenceTax.totalResidenceTax).toBe(293_100);
  });

  it('taxes a reported capital gain the same way, in its own class', () => {
    const result = calculateTaxes(
      salaryInputs([reportedGains(1_000_000, 'domesticNoWithholding')]),
    );

    expect(result.investmentIncome?.reported?.separate?.taxable).toEqual({
      capitalGains: 1_000_000,
      dividends: 0,
    });
    expect(result.investmentIncome?.reported?.separate?.nationalIncomeTaxBase).toBe(150_000);
    expect(result.residenceTax.separate?.taxableCapitalGains).toBe(1_000_000);
    expect(result.nationalIncomeTax).toBe(244_800);
    expect(result.residenceTax.totalResidenceTax).toBe(293_100);
    expect(result.takeHomeIncome).toBe(4_739_848);
  });

  it('raises the furusato nozei limit through the 所得割 on the reported income', () => {
    const result = calculateTaxes(salaryInputs([reportedDividends(1_000_000)]));

    // 所得割 172,900 + 115,200 = 288,100 is the cap base (附則第33条の2第3項第4号); 20% = 57,620.
    // 特例控除割合 for 課税総所得金額 2,407,000 − 50,000 人的控除差 in the 10% band: 1 − 0.1 −
    // 0.1021 = 0.7979; 57,620 / 0.7979 + 2,000 = 74,214 → 74,000 (61,000 without the dividends).
    expect(result.furusatoNozei.limit).toBe(74_000);
    // The 72,000 寄附金控除 comes off 課税総所得金額 (1,797,748 → 1,725,000 → 86,250) and leaves
    // the 15% class alone: (239,850 − 236,250) × 1.021 at the ¥100 floor is 244,800 − 241,200.
    expect(result.furusatoNozei.incomeTaxReduction).toBe(3_600);
  });

  it('counts the reported income toward the NHI premium, like any other 所得', () => {
    // 国保法施行令第29条の7第2項第4号: the 所得割 base is 総所得金額 plus the amounts taxed apart
    // from it, less 430,000 — so 5,000,000 of 雑所得 with 1,000,000 of reported dividends pays
    // what 6,000,000 of 雑所得 pays, and the same dividends under 申告不要 change nothing.
    const nhiInputs = (streams: TakeHomeInputs['incomeStreams']): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: streams,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    });
    const miscellaneous = (amount: number) => ({
      type: 'miscellaneous' as const,
      amount,
      id: 'misc',
    });

    const reported = calculateTaxes(
      nhiInputs([miscellaneous(5_000_000), reportedDividends(1_000_000)]),
    );
    const sameIncomeEarned = calculateTaxes(nhiInputs([miscellaneous(6_000_000)]));
    expect(reported.totalNetIncome).toBe(6_000_000);
    expect(reported.healthInsurance).toBe(sameIncomeEarned.healthInsurance);
    expect(reported.healthInsurance).toBe(652_479);

    const withheld = calculateTaxes(
      nhiInputs([miscellaneous(5_000_000), { ...reportedDividends(1_000_000), isReported: false }]),
    );
    expect(withheld.healthInsurance).toBe(
      calculateTaxes(nhiInputs([miscellaneous(5_000_000)])).healthInsurance,
    );
    expect(withheld.healthInsurance).toBe(547_219);
  });

  describe('a 65–69 pensioner on NHI, whose 所得控除 exceed the other income', () => {
    const pensionerInputs = (
      grossPension: number,
      streams: TakeHomeInputs['incomeStreams'],
    ): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: [{ type: 'publicPension', amount: grossPension, id: 'pension' }, ...streams],
      ageRange: 'age65to69',
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    });

    it('lets the deductions the other income cannot use come off the reported income', () => {
      // 2,000,000 of pension at 65+: 公的年金等控除 1,100,000 — the band judged on the 1,000,000
      // of other 合計所得金額 (所法35条④) — leaves 雑所得 900,000; 合計所得金額 1,900,000. NHI
      // 220,913 on 1,900,000 − 430,000, and the 介護保険第1号 premium moves to tier 7 (合計所得金額
      // 1,200,000〜2,100,000) → 98,500: social insurance 319,413.
      const result = calculateTaxes(pensionerInputs(2_000_000, [reportedDividends(1_000_000)]));

      expect(result.totalNetIncome).toBe(1_900_000);
      expect(result.healthInsurance).toBe(220_913);
      expect(result.longTermCareCategory1Premium).toBe(98_500);
      // 所得税: 900,000 − 319,413 − 1,040,000 leaves 459,413 of deductions unused, which come off
      // the dividends (措法8条の4③三): 1,000,000 − 459,413 = 540,587 → 540,000 × 15% = 81,000;
      // 復興税 1,701 → 82,700.
      expect(result.taxableIncomeForNationalIncomeTax).toBe(0);
      expect(result.investmentIncome?.reported?.separate?.taxable).toEqual({
        capitalGains: 0,
        dividends: 540_000,
      });
      expect(result.nationalIncomeTax).toBe(82_700);
      // 住民税: 900,000 − 319,413 − 430,000 = 150,587 → 150,000 課税総所得金額, the dividends
      // untouched: 9,000 + 30,000 − 1,500 調整控除 → 37,500; 6,000 + 20,000 − 1,000 → 25,000; with
      // the 均等割, 67,500.
      expect(result.residenceTax.taxableIncome).toBe(150_000);
      expect(result.residenceTax.separate?.taxableDividends).toBe(1_000_000);
      expect(result.residenceTax.totalResidenceTax).toBe(67_500);
    });

    it('sets the furusato 特例控除割合 from the 15% rate once no 課税総所得金額 is left (附則第5条の5第1項第5号)', () => {
      // 1,500,000 of pension → 雑所得 400,000; 合計所得金額 1,400,000; NHI 168,283 + 第1号 98,500 =
      // 266,783. 住民税: 400,000 − 266,783 − 430,000 < 0 → 課税総所得金額 0, the 296,783 left over
      // comes off the dividends: 703,217 → 703,000, 所得割 21,090 + 14,060 → 21,000 + 14,000.
      const result = calculateTaxes(pensionerInputs(1_500_000, [reportedDividends(1_000_000)]));

      expect(result.residenceTax.taxableIncome).toBe(0);
      expect(result.residenceTax.separate?.taxableDividends).toBe(703_000);
      expect(result.residenceTax.totalResidenceTax).toBe(40_000);
      // 20% of the 35,000 所得割 is 7,000; the ratio is 1 − 0.1 − 0.15 × 1.021 = 0.74685 (附則第5条
      // の6 folds the 復興税 into the 100分の75); 7,000 / 0.74685 + 2,000 = 11,372 → 11,000.
      expect(result.furusatoNozei.limit).toBe(11_000);
      // 所得税 on the dividends: 1,000,000 − (1,040,000 + 266,783 − 400,000) = 93,217 → 93,000 ×
      // 15% = 13,950, 復興税 292.95 → 14,200; the 9,000 donation takes it to 84,000 × 15% × 1.021
      // → 12,800.
      expect(result.nationalIncomeTax).toBe(14_200);
      expect(result.furusatoNozei.incomeTaxReduction).toBe(1_400);
    });
  });

  it('judges the 障害者 住民税 exemption on 合計所得金額 with the reported income, and exempts its 所得割 too', () => {
    // 1,200,000 of salary → 給与所得 460,000 (the 2026 floor of 740,000); 890,000 of dividends
    // makes 合計所得金額 exactly the 1,350,000 limit (地方税法第24条の5第1項第2号).
    const inputs = (dividends: number): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: [
        { type: 'salary', amount: 1_200_000, frequency: 'annual', id: 'salary' },
        reportedDividends(dividends),
      ],
      personalCircumstances: { disability: 'regular', widowOrSingleParent: 'none' },
    });

    const atLimit = calculateTaxes(inputs(890_000));
    expect(atLimit.totalNetIncome).toBe(1_350_000);
    expect(atLimit.residenceTax.nonTaxableStatus).toBe('disability');
    expect(atLimit.residenceTax.totalResidenceTax).toBe(0);
    expect(atLimit.residenceTax.separate).toBeUndefined();

    // One yen over: social insurance 58,906 + 107,604 + 6,150 = 172,660; 460,000 − 172,660 −
    // 430,000 − 260,000 障害者控除 < 0 leaves 402,660 for the dividends: 890,001 − 402,660 =
    // 487,341 → 487,000; 14,610 + 9,740 → 14,600 + 9,700 + 5,000 = 29,300.
    const overLimit = calculateTaxes(inputs(890_001));
    expect(overLimit.residenceTax.nonTaxableStatus).toBeUndefined();
    expect(overLimit.residenceTax.taxableIncome).toBe(0);
    expect(overLimit.residenceTax.separate?.taxableDividends).toBe(487_000);
    expect(overLimit.residenceTax.totalResidenceTax).toBe(29_300);
  });

  it('moves the 基礎控除 tier when the reported income carries 合計所得金額 past 1,320,000 (2025)', () => {
    // 1,900,000 of salary in 2025 → 給与所得 1,250,000 (the 650,000 floor). 100,000 of dividends
    // withheld leaves 合計所得金額 at 1,250,000 → 950,000; reported, 1,350,000 → 880,000
    // (措法41条の16の2, 2025 amounts).
    const inputs = (dividends: TakeHomeInputs['incomeStreams'][number]): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: [
        { type: 'salary', amount: 1_900_000, frequency: 'annual', id: 'salary' },
        dividends,
      ],
      incomeYear: 2025,
    });

    const withheld = calculateTaxes(inputs({ ...reportedDividends(100_000), isReported: false }));
    expect(withheld.totalNetIncome).toBe(1_250_000);
    expect(withheld.nationalIncomeTaxBasicDeduction).toBe(950_000);

    const reported = calculateTaxes(inputs(reportedDividends(100_000)));
    expect(reported.totalNetIncome).toBe(1_350_000);
    expect(reported.nationalIncomeTaxBasicDeduction).toBe(880_000);
    // Social insurance 95,136 + 175,680 + 10,452 = 281,268: 1,250,000 − 281,268 − 880,000 =
    // 88,732 → 88,000 × 5% = 4,400, plus 15,000 on the dividends; × 1.021 = 19,807 → 19,800.
    expect(reported.taxableIncomeForNationalIncomeTax).toBe(88_000);
    expect(reported.nationalIncomeTax).toBe(19_800);
  });

  it('moves the 配偶者控除 tier when the reported income carries 合計所得金額 past 9,000,000', () => {
    // 10,500,000 of salary → 給与所得 8,550,000 (the 1,950,000 cap), spouse without income.
    // 500,000 of dividends withheld → 配偶者控除 380,000; reported → 9,050,000 → 260,000
    // (所法83条①二), 330,000 → 220,000 for the 住民税 (地方税法第314条の2第1項第10号の2).
    const inputs = (dividends: TakeHomeInputs['incomeStreams'][number]): TakeHomeInputs => ({
      ...salaryInputs(),
      incomeStreams: [
        { type: 'salary', amount: 10_500_000, frequency: 'annual', id: 'salary' },
        dividends,
      ],
      dependents: [
        {
          id: 'spouse',
          relationship: 'spouse',
          ageRange: 'under65',
          income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
          disability: 'none',
          isCohabiting: true,
        },
      ],
    });

    // Social insurance 528,968 + 713,700 + 53,811 = 1,296,479; 基礎控除 620,000 either way.
    const withheld = calculateTaxes(inputs({ ...reportedDividends(500_000), isReported: false }));
    expect(withheld.totalNetIncome).toBe(8_550_000);
    // 8,550,000 − 1,296,479 − 620,000 − 380,000 = 6,253,521 → 6,253,000.
    expect(withheld.taxableIncomeForNationalIncomeTax).toBe(6_253_000);
    expect(withheld.taxableIncomeForResidenceTax).toBe(6_493_000);

    const reported = calculateTaxes(inputs(reportedDividends(500_000)));
    expect(reported.totalNetIncome).toBe(9_050_000);
    // … − 260,000 = 6,373,521 → 6,373,000 × 20% − 427,500 = 847,100, plus 75,000; × 1.021 →
    // 941,400.
    expect(reported.taxableIncomeForNationalIncomeTax).toBe(6_373_000);
    expect(reported.taxableIncomeForResidenceTax).toBe(6_603_000);
    expect(reported.nationalIncomeTax).toBe(941_400);
  });

  // The single-account loss/dividends 損益通算 cases (both reported, and a withheld loss beside
  // reported dividends) moved to 'calculateTaxes with a 特定口座（源泉徴収あり）' above, since a
  // 特定口座 is now its own entry type.

  it('leaves a loss the dividends cannot absorb unused, changing no assessed figure', () => {
    // −500,000 and 300,000 of dividends in one account, both reported: 300,000 offsets, the
    // other 200,000 would carry forward (措法37条の12の2⑤), which is not modelled.
    const baseline = calculateTaxes(salaryInputs());
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'withholdingAccount',
          capitalGains: -500_000,
          dividends: 300_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: true,
          reportsDividends: true,
          id: 'account',
        },
      ]),
    );

    expect(result.investmentIncome?.reported?.separate).toMatchObject({
      lossOffsetAgainstDividends: 300_000,
      unabsorbedQualifyingLoss: 200_000,
      netIncome: { capitalGains: 0, dividends: 0 },
      nationalIncomeTaxBase: 0,
    });
    expect(result.totalNetIncome).toBe(baseline.totalNetIncome);
    expect(result.nationalIncomeTax).toBe(baseline.nationalIncomeTax);
    expect(result.residenceTax).toEqual(baseline.residenceTax);
    // The income on the return is 200,000 lower, and so is take-home.
    expect(result.annualIncome).toBe(4_800_000);
    expect(result.takeHomeIncome).toBe(baseline.takeHomeIncome - 200_000);
  });

  it('caps the loss that offsets dividends at the losses realized through a Japanese account', () => {
    // A 1,000,000 gain and a −500,000 loss in domestic accounts, a −2,000,000 loss in a foreign
    // account, 1,000,000 of dividends. Every sale nets into one 譲渡所得等の金額 first (−1,500,000),
    // but only 500,000 of that is 上場株式等に係る譲渡損失の金額 — the losses through a licensed
    // 金融商品取引業者 (措法37条の12の2②一〜三; 措令25条の11の2②③) — so 500,000 offsets the
    // dividends; the 1,000,000 of the foreign-account loss offsets nothing and cannot carry forward.
    const result = calculateTaxes(
      salaryInputs([
        reportedGains(1_000_000, 'domesticNoWithholding', 'gain'),
        reportedGains(-500_000, 'domesticNoWithholding', 'loss'),
        reportedGains(-2_000_000, 'foreign', 'foreign-loss'),
        reportedDividends(1_000_000),
      ]),
    );

    expect(result.investmentIncome?.reported?.separate).toEqual({
      gross: { capitalGains: -1_500_000, dividends: 1_000_000 },
      lossOffsetAgainstDividends: 500_000,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 1_000_000,
      netIncome: { capitalGains: 0, dividends: 500_000 },
      taxable: { capitalGains: 0, dividends: 500_000 },
      nationalIncomeTaxBase: 75_000,
    });
    expect(result.annualIncome).toBe(4_500_000);
    expect(result.totalNetIncome).toBe(4_060_000);
  });

  it('applies the home loan credit to the 15% tax too, but caps the residence spillover on 課税総所得金額 alone', () => {
    // 3,000,000 of salary → 給与所得 2,020,000; 1,000,000 of dividends. Social insurance 156,286 +
    // 285,480 + 15,375 = 457,141; 課税総所得金額 522,000 → 26,100, plus 150,000 on the dividends.
    const result = calculateTaxes({
      ...salaryInputs([reportedDividends(1_000_000)]),
      incomeStreams: [
        { type: 'salary', amount: 3_000_000, frequency: 'annual', id: 'salary' },
        reportedDividends(1_000_000),
      ],
      homeLoanTaxCredit: { creditAmount: 300_000, moveInYear: 2024 },
    });

    expect(result.nationalIncomeTaxBase).toBe(26_100);
    expect(result.investmentIncome?.reported?.separate?.nationalIncomeTaxBase).toBe(150_000);
    // 176,100 comes off the whole 所得税額; the spillover is 5% of the 522,000 課税総所得金額
    // (地方税法附則第5条の4第1項), not of the classes together; 97,800 goes unused.
    expect(result.homeLoanTaxCredit).toMatchObject({
      appliedToIncomeTax: 176_100,
      appliedToResidenceTax: 26_100,
      unusedCredit: 97_800,
    });
    expect(result.nationalIncomeTax).toBe(0);
    // 住民税 課税総所得金額 1,132,000: 67,920 + 30,000 − 1,500 − 15,660 → 80,700; 45,280 + 20,000
    // − 1,000 − 10,440 → 53,800; plus 5,000 = 139,500.
    expect(result.residenceTax.totalResidenceTax).toBe(139_500);
  });
});

describe('calculateTaxes with dividends reported under 総合課税', () => {
  // The same 5,000,000-yen employee, income year 2026: 給与所得 3,560,000; social insurance
  // 722,252; 基礎控除 1,040,000 up to a 合計所得金額 of 4,890,000; 住民税 基礎控除 430,000 and
  // 調整控除 2,500 (人的控除差 50,000, 課税総所得金額 over 2,000,000). The election is made once
  // for every reported dividend (措法8条の4②), so it is an input beside the streams.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
      ...streams,
    ],
    reportedDividendsTaxation: 'aggregate',
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });
  const aggregateDividends = (amount: number, id = 'dividends') => ({
    type: 'dividends' as const,
    shareType: 'listed' as const,
    paymentChannel: 'domestic' as const,
    isReported: true as const,
    issuerDomicile: 'domestic' as const,
    foreignTax: 0,
    amount,
    id,
  });

  it('applies the election to every reported dividend and to no withheld-only one', () => {
    // 1,000,000 reported and 300,000 left to withholding: the reported amount is 配当所得 in
    // 総所得金額 and the withheld amount stays outside the return, as under 申告分離課税. With the
    // election absent, the same reported dividend is 申告分離課税.
    const streams = [
      aggregateDividends(600_000, 'd1'),
      aggregateDividends(400_000, 'd2'),
      { ...aggregateDividends(300_000, 'd3'), isReported: false as const },
    ];
    const elected = calculateTaxes(salaryInputs(streams));
    expect(elected.investmentIncome).toEqual({
      withheld: {
        accounts: [],
        dividends: 300_000,
        interest: 0,
        received: 300_000,
        taxedAmount: 300_000,
        tax: { national: 45_945, residence: 15_000, total: 60_945 },
      },
      reported: { aggregate: { dividends: 1_000_000, interest: 0 } },
    });
    expect(elected.nationalIncomeTax).toBe(186_000);

    const { reportedDividendsTaxation: _unused, ...withoutElection } = salaryInputs(streams);
    const separate = calculateTaxes(withoutElection);
    expect(separate.investmentIncome?.reported?.aggregate).toBeUndefined();
    expect(separate.investmentIncome?.reported?.separate?.taxable).toEqual({
      capitalGains: 0,
      dividends: 1_000_000,
    });
    expect(separate.nationalIncomeTax).toBe(244_800);
  });

  it('taxes them in the brackets as 配当所得 inside 総所得金額, with no 配当控除', () => {
    const result = calculateTaxes(salaryInputs([aggregateDividends(1_000_000)]));

    // 所法22条②一 counts the 配当所得 in 総所得金額, so 総所得金額 = 合計所得金額 = 4,560,000, still
    // within the 1,040,000 基礎控除 tier; the return covers 6,000,000.
    expect(result.annualIncome).toBe(6_000_000);
    expect(result.totalNetIncome).toBe(4_560_000);
    expect(result.nationalIncomeTaxBasicDeduction).toBe(1_040_000);
    expect(result.investmentIncome).toEqual({
      reported: { aggregate: { dividends: 1_000_000, interest: 0 } },
    });
    // 課税総所得金額 4,560,000 − 722,252 − 1,040,000 = 2,797,748 → 2,797,000; in the 10% bracket
    // 279,700 − 97,500 = 182,200; with the 2.1% 復興特別所得税 186,026.2 → 186,000.
    expect(result.taxableIncomeForNationalIncomeTax).toBe(2_797_000);
    expect(result.nationalIncomeTaxBase).toBe(182_200);
    expect(result.nationalIncomeTax).toBe(186_000);
    // 住民税: 4,560,000 − 722,252 − 430,000 = 3,407,748 → 3,407,000; 市 204,420 / 県 136,280 less
    // the 調整控除 split 60/40 → 202,900 / 135,200; plus the 5,000 均等割 = 343,100. Nothing is
    // taxed apart from the brackets.
    expect(result.taxableIncomeForResidenceTax).toBe(3_407_000);
    expect(result.residenceTax.separate).toBeUndefined();
    expect(result.residenceTax.totalResidenceTax).toBe(343_100);
    expect(result.takeHomeIncome).toBe(6_000_000 - 186_000 - 343_100 - 722_252);
    // Furusato: 所得割 338,100 × 20% = 67,620; 3,407,000 − 50,000 人的控除差 is in the 20% band, so
    // the 特例控除割合 is 1 − 0.1 − 0.2 × 1.021 = 0.6958; 67,620 / 0.6958 + 2,000 = 99,183 → 99,000.
    expect(result.furusatoNozei.limit).toBe(99_000);
  });

  it('moves the 基礎控除 tier when they carry 合計所得金額 past 4,890,000', () => {
    // 3,560,000 + 1,500,000 = 5,060,000 → the 670,000 tier (2026).
    const result = calculateTaxes(salaryInputs([aggregateDividends(1_500_000)]));
    expect(result.totalNetIncome).toBe(5_060_000);
    expect(result.nationalIncomeTaxBasicDeduction).toBe(670_000);
  });

  it('nets no reported capital loss against them (措法37条の12の2① reaches 申告分離課税 dividends only)', () => {
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'capitalGains',
          shareType: 'listed',
          account: 'domesticNoWithholding',
          amount: -400_000,
          id: 'gains',
        },
        aggregateDividends(1_000_000),
      ]),
    );

    // The loss is a qualifying 上場株式等に係る譲渡損失の金額 with no 申告分離課税 dividends to
    // offset, so it is left over in full and the 配当所得 is taxed as if it were not there.
    expect(result.investmentIncome?.reported?.separate).toEqual({
      gross: { capitalGains: -400_000, dividends: 0 },
      lossOffsetAgainstDividends: 0,
      unabsorbedQualifyingLoss: 400_000,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 0, dividends: 0 },
      taxable: { capitalGains: 0, dividends: 0 },
      nationalIncomeTaxBase: 0,
    });
    expect(result.investmentIncome?.reported?.aggregate?.dividends).toBe(1_000_000);
    expect(result.totalNetIncome).toBe(4_560_000);
    expect(result.nationalIncomeTax).toBe(186_000);
    expect(result.residenceTax.totalResidenceTax).toBe(343_100);
    // The return covers 5,000,000 − 400,000 + 1,000,000.
    expect(result.annualIncome).toBe(5_600_000);
    expect(result.takeHomeIncome).toBe(5_600_000 - 186_000 - 343_100 - 722_252);
  });

  it('sits beside a reported capital gain, each taxed in its own class', () => {
    const result = calculateTaxes(
      salaryInputs([
        {
          type: 'capitalGains',
          shareType: 'listed',
          account: 'domesticNoWithholding',
          amount: 500_000,
          id: 'gains',
        },
        aggregateDividends(200_000),
      ]),
    );

    // 総所得金額 3,760,000 plus the 500,000 分離 class: 合計所得金額 4,260,000. 課税総所得金額
    // 3,760,000 − 1,762,252 = 1,997,748 → 1,997,000, in the 10% bracket: 199,700 − 97,500 =
    // 102,200; plus 15% of 500,000 = 75,000; 177,200 × 1.021 = 180,921.2 → 180,900.
    expect(result.totalNetIncome).toBe(4_260_000);
    expect(result.taxableIncomeForNationalIncomeTax).toBe(1_997_000);
    expect(result.investmentIncome?.reported?.separate?.taxable).toEqual({
      capitalGains: 500_000,
      dividends: 0,
    });
    expect(result.investmentIncome?.reported?.aggregate?.dividends).toBe(200_000);
    expect(result.nationalIncomeTax).toBe(180_900);
    // 住民税: 3,760,000 − 722,252 − 430,000 = 2,607,748 → 2,607,000: 156,420 / 104,280, plus
    // 15,000 / 10,000 on the gain, less 1,500 / 1,000 → 169,900 / 113,200; plus 5,000 = 288,100.
    expect(result.residenceTax.separate?.taxableCapitalGains).toBe(500_000);
    expect(result.residenceTax.totalResidenceTax).toBe(288_100);
    expect(result.annualIncome).toBe(5_700_000);
    expect(result.takeHomeIncome).toBe(5_700_000 - 180_900 - 288_100 - 722_252);
  });

  it('computes real results for a taxpayer with 総合課税 dividends and no earned income', () => {
    const result = calculateTaxes({
      ...salaryInputs(),
      incomeStreams: [aggregateDividends(1_000_000)],
      // Manual social insurance keeps the NHI and pension tables out of this case.
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
    });

    // 合計所得金額 1,000,000: the 1,040,000 基礎控除 leaves no 課税総所得金額. 住民税 課税総所得金額
    // 570,000 → 34,200 / 22,800 less the 1,500 / 1,000 調整控除 → 32,700 / 21,800; plus 5,000 =
    // 59,500.
    expect(result.annualIncome).toBe(1_000_000);
    expect(result.totalNetIncome).toBe(1_000_000);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.totalResidenceTax).toBe(59_500);
    expect(result.takeHomeIncome).toBe(940_500);
  });

  it('counts them in the 公的年金等控除 band base (所法35条④一)', () => {
    const components = calculateNetIncomeComponents(
      [{ type: 'publicPension', amount: 3_000_000, id: 'pension' }, aggregateDividends(10_500_000)],
      2026,
      'age65to69',
      [],
      EMPTY_PERSONAL_CIRCUMSTANCES,
      'aggregate',
    );

    // 公的年金等に係る雑所得以外の合計所得金額 of 10,500,000 is over 10,000,000, so the 65+ deduction
    // is 300,000 + 25% × (3,000,000 − 500,000) = 925,000, raised to its 1,000,000 floor → 雑所得
    // 2,000,000 (1,900,000 in the 1,000万円以下 band).
    expect(components.aggregateDividendIncome).toBe(10_500_000);
    expect(components.netPublicPensionIncome).toBe(2_000_000);
    expect(components.aggregateNetIncome).toBe(12_500_000);
    expect(components.totalNetIncome).toBe(12_500_000);
  });
});

describe('calculateTaxes with foreign tax (外国税額控除)', () => {
  // The 5,000,000-yen employee of the investment cases, income year 2026: 給与所得 3,560,000;
  // social insurance 722,252; 基礎控除 1,040,000 up to a 合計所得金額 of 4,890,000; 所得税 91,700;
  // 住民税 課税総所得金額 2,407,000 → 市 144,420 − 1,500 = 142,920 / 県 96,280 − 1,000 = 95,280,
  // floored to 142,900 / 95,200, plus 5,000 均等割 = 243,100; take-home 3,942,948.
  //
  // The credit (所法95条①, 復興財確法14条①, 地方税法37条の3・314条の8): B is the 所得税額 after the
  // home loan credit, R = ⌊B × 2.1%⌋, T the 合計所得金額 and A the foreign-source income capped at
  // T; L = ⌊B × A / T⌋ and L_R = ⌊R × A / T⌋; the residence limits are ⌊L × 12%⌋ (道府県) and
  // ⌊L × 18%⌋ (市町村). National tax is ⌊(B + R − credits) / 100⌋ × 100; each residence side is
  // floored to ¥100 after its credit.
  const salaryInputs = (streams: TakeHomeInputs['incomeStreams'] = []): TakeHomeInputs => ({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
      ...streams,
    ],
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  });
  // A dividend from a foreign company, paid in Japan through a Japanese broker.
  const foreignDividend = (isReported: boolean, foreignTax = 100_000, amount = 1_000_000) => ({
    type: 'dividends' as const,
    shareType: 'listed' as const,
    paymentChannel: 'domestic' as const,
    isReported,
    issuerDomicile: 'foreign' as const,
    foreignTax,
    amount,
    id: 'dividends',
  });
  const foreignInterest = (amount: number, foreignTax: number) => ({
    type: 'interest' as const,
    payerDomicile: 'foreign' as const,
    foreignTax,
    amount,
    id: 'interest',
  });
  const account = (
    capitalGains: number,
    dividends: number,
    foreignDividends: number,
    foreignTax: number,
    reported: boolean,
  ) => ({
    type: 'withholdingAccount' as const,
    id: 'account',
    capitalGains,
    dividends,
    foreignDividends,
    foreignTax,
    reportsCapitalGains: reported,
    reportsDividends: reported,
  });
  // Interest only, with manual social insurance of 0 to keep the premium tables out.
  const interestOnly = (amount: number, foreignTax: number): TakeHomeInputs => ({
    ...salaryInputs(),
    incomeStreams: [foreignInterest(amount, foreignTax)],
    manualSocialInsuranceEntry: true,
    manualSocialInsuranceAmount: 0,
  });

  describe('case A: a foreign dividend of 1,000,000 with 100,000 foreign tax, reported under 申告分離課税', () => {
    const result = calculateTaxes(salaryInputs([foreignDividend(true)]));

    it('credits the foreign tax up to each limit', () => {
      // T = 3,560,000 + 1,000,000 = 4,560,000; B = 89,850 (課税総所得金額 1,797,000 at 5%) +
      // 150,000 (15% of the dividend) = 239,850; R = ⌊5,036.85⌋ = 5,036; A = 1,000,000.
      // L = ⌊239,850 × 1,000,000 / 4,560,000⌋ = ⌊52,598.68⌋ = 52,598;
      // L_R = ⌊5,036 × 1,000,000 / 4,560,000⌋ = ⌊1,104.39⌋ = 1,104;
      // 道府県 ⌊52,598 × 12%⌋ = ⌊6,311.76⌋ = 6,311; 市町村 ⌊52,598 × 18%⌋ = ⌊9,467.64⌋ = 9,467.
      // All used: 100,000 − 52,598 − 1,104 − 6,311 − 9,467 = 30,520 left over.
      const limits = {
        incomeTax: 52_598,
        reconstructionSurtax: 1_104,
        prefecture: 6_311,
        city: 9_467,
      };
      expect(result.foreignTaxCredit).toEqual({
        foreignTax: 100_000,
        foreignSourceIncome: 1_000_000,
        adjustedForeignSourceIncome: 1_000_000,
        totalIncome: 4_560_000,
        incomeTax: 239_850,
        limit: limits,
        credit: limits,
        excess: 30_520,
      });
      expect(result.reconstructionSurtax).toBe(5_036);
    });

    it('takes the credits off both taxes', () => {
      // ⌊(239,850 + 5,036 − 52,598 − 1,104) / 100⌋ × 100 = ⌊191,184 / 100⌋ × 100 = 191,100.
      expect(result.nationalIncomeTax).toBe(191_100);
      // 市 144,420 + 30,000 − 1,500 = 172,920 − 9,467 = 163,453 → 163,400;
      // 県 96,280 + 20,000 − 1,000 = 115,280 − 6,311 = 108,969 → 108,900; + 5,000 = 277,300. The
      // 所得割 before the credit is 172,900 + 115,200 = 288,100.
      expect(result.residenceTax.foreignTaxCredit).toEqual({ city: 9_467, prefecture: 6_311 });
      expect(result.residenceTax.city.cityIncomeTax).toBe(163_400);
      expect(result.residenceTax.prefecture.prefecturalIncomeTax).toBe(108_900);
      expect(result.residenceTax.totalResidenceTax).toBe(277_300);
      expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBe(288_100);
      expect(result.residenceTaxIncomeBasedBeforeHomeLoanCredit).toBeUndefined();
    });

    it('subtracts the foreign tax paid from take-home and folds it into the income tax paid', () => {
      expect(result.foreignTaxPaid).toBe(100_000);
      expect(result.annualIncome).toBe(6_000_000);
      // 191,100 + 100,000 foreign tax; the residence tax has nothing withheld beside it.
      expect(incomeTaxPaid(result)).toBe(291_100);
      expect(residenceTaxPaid(result)).toBe(277_300);
      // 6,000,000 − 191,100 − 277,300 − 722,252 − 100,000.
      expect(result.takeHomeIncome).toBe(4_709_348);
    });

    it('applies the residence credit after the furusato donation credits', () => {
      // Limit as without the foreign tax (74,000; the 20% cap is on the 所得割 before either
      // credit), and so the 3,600 income tax reduction. Donation 72,000: 基本控除 7,200; 特例控除
      // 72,000 × 0.7979 = 57,448.8 → ⌈34,469.28⌉ + ⌈22,979.52⌉ = 34,470 + 22,980 = 57,450; the
      // donation credits 64,650 split ⌈38,790⌉ / ⌈25,860⌉. 市 172,920 − 38,790 − 9,467 = 124,663 →
      // 124,600; 県 115,280 − 25,860 − 6,311 = 83,109 → 83,100; 277,300 − (124,600 + 83,100 +
      // 5,000) = 64,600, the same reduction as without the foreign tax. Out of pocket 74,000 −
      // 64,600 − 3,600 = 5,800.
      expect(result.furusatoNozei).toEqual({
        limit: 74_000,
        incomeTaxReduction: 3_600,
        residenceTaxDonationBasicDeduction: 7_200,
        residenceTaxSpecialDeduction: 57_450,
        residenceTaxReduction: 64_600,
        outOfPocketCost: 5_800,
      });
      expect(
        calculateTaxes(salaryInputs([{ ...foreignDividend(true), foreignTax: 0 }])).furusatoNozei
          .residenceTaxReduction,
      ).toBe(64_600);
    });

    it('credits nothing more once every limit is used (case A plus 5,000 entered by hand)', () => {
      const withManual = calculateTaxes({
        ...salaryInputs([foreignDividend(true)]),
        foreignTaxCredit: { foreignTax: 5_000, foreignSourceIncome: 0 },
      });
      // F = 105,000 with the same limits: 30,520 + 5,000 left over, taxes unchanged.
      expect(withManual.foreignTaxCredit).toMatchObject({
        foreignTax: 105_000,
        manualForeignTax: 5_000,
        excess: 35_520,
      });
      expect(withManual.foreignTaxCredit?.manualForeignSourceIncome).toBeUndefined();
      expect(withManual.nationalIncomeTax).toBe(191_100);
      expect(withManual.residenceTax.totalResidenceTax).toBe(277_300);
      expect(withManual.foreignTaxPaid).toBe(105_000);
      // 4,709,348 − 5,000.
      expect(withManual.takeHomeIncome).toBe(4_704_348);
    });
  });

  it('case B: charges the withholding on the dividend after the foreign tax and credits none of it', () => {
    const result = calculateTaxes(salaryInputs([foreignDividend(false)]));

    // 措法9条の2③: base 1,000,000 − 100,000 = 900,000; ⌊900,000 × 15.315%⌋ = 137,835 and 45,000.
    // 措令4条の5⑫: no credit for a dividend left to withholding.
    expect(result.investmentIncome).toEqual({
      withheld: {
        accounts: [],
        dividends: 1_000_000,
        dividendsForeignTax: 100_000,
        interest: 0,
        received: 1_000_000,
        foreignTax: 100_000,
        taxedAmount: 900_000,
        tax: { national: 137_835, residence: 45_000, total: 182_835 },
      },
    });
    expect(result.foreignTaxCredit).toBeUndefined();
    expect(result.nationalIncomeTax).toBe(91_700);
    expect(result.residenceTax.totalResidenceTax).toBe(243_100);
    expect(result.foreignTaxPaid).toBe(100_000);
    // 91,700 + 137,835 + 100,000; 243,100 + 45,000.
    expect(incomeTaxPaid(result)).toBe(329_535);
    expect(residenceTaxPaid(result)).toBe(288_100);
    // 6,000,000 − 91,700 − 243,100 − 722,252 − 182,835 − 100,000.
    expect(result.takeHomeIncome).toBe(4_660_113);
  });

  it('case C: credits it under 総合課税 against the tax on the brackets', () => {
    const result = calculateTaxes({
      ...salaryInputs([foreignDividend(true)]),
      reportedDividendsTaxation: 'aggregate',
    });

    // 課税総所得金額 4,560,000 − 722,252 − 1,040,000 = 2,797,748 → 2,797,000 at 10%: B = 279,700 −
    // 97,500 = 182,200; R = ⌊3,826.2⌋ = 3,826. L = ⌊182,200 × 1,000,000 / 4,560,000⌋ =
    // ⌊39,956.14⌋ = 39,956; L_R = ⌊3,826 / 4.56⌋ = ⌊839.04⌋ = 839; ⌊39,956 × 12%⌋ = ⌊4,794.72⌋ =
    // 4,794; ⌊39,956 × 18%⌋ = ⌊7,192.08⌋ = 7,192. Left over: 100,000 − 39,956 − 839 − 4,794 −
    // 7,192 = 47,219.
    const limits = { incomeTax: 39_956, reconstructionSurtax: 839, prefecture: 4_794, city: 7_192 };
    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 100_000,
      foreignSourceIncome: 1_000_000,
      adjustedForeignSourceIncome: 1_000_000,
      totalIncome: 4_560_000,
      incomeTax: 182_200,
      limit: limits,
      credit: limits,
      excess: 47_219,
    });
    // ⌊(182,200 + 3,826 − 39,956 − 839) / 100⌋ × 100 = ⌊145,231 / 100⌋ × 100 = 145,200.
    expect(result.nationalIncomeTax).toBe(145_200);
    // 3,407,000: 市 204,420 − 1,500 − 7,192 = 195,728 → 195,700; 県 136,280 − 1,000 − 4,794 =
    // 130,486 → 130,400; + 5,000 = 331,100 (before the credit 202,900 + 135,200 = 338,100).
    expect(result.residenceTax.totalResidenceTax).toBe(331_100);
    expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBe(338_100);
    // 6,000,000 − 145,200 − 331,100 − 722,252 − 100,000.
    expect(result.takeHomeIncome).toBe(4_701_448);
  });

  it('case D: charges an account left to withholding on its dividends after the foreign tax', () => {
    // 措法9条の2③ with 37条の11の6⑥: base 0 + 800,000 − 50,000 = 750,000; ⌊750,000 × 15.315%⌋ =
    // ⌊114,862.5⌋ = 114,862 and 37,500.
    const result = calculateTaxes(salaryInputs([account(0, 800_000, 500_000, 50_000, false)]));
    expect(result.investmentIncome).toEqual({
      withheld: {
        accounts: [
          { position: 1, capitalGains: 0, dividends: 800_000, foreignTax: 50_000, base: 750_000 },
        ],
        dividends: 0,
        interest: 0,
        received: 800_000,
        foreignTax: 50_000,
        taxedAmount: 750_000,
        tax: { national: 114_862, residence: 37_500, total: 152_362 },
      },
    });
    expect(result.foreignTaxCredit).toBeUndefined();
    expect(result.foreignTaxPaid).toBe(50_000);
    // 3,942,948 + 800,000 − 152,362 − 50,000.
    expect(result.takeHomeIncome).toBe(4_540_586);

    // A −500,000 loss nets against the dividends after the foreign tax: −500,000 + 800,000 −
    // 50,000 = 250,000; ⌊38,287.5⌋ = 38,287 and 12,500.
    const withLoss = calculateTaxes(
      salaryInputs([account(-500_000, 800_000, 500_000, 50_000, false)]),
    );
    expect(withLoss.investmentIncome?.withheld?.accounts).toEqual([
      {
        position: 1,
        capitalGains: -500_000,
        dividends: 800_000,
        foreignTax: 50_000,
        base: 250_000,
      },
    ]);
    expect(withLoss.investmentIncome?.withheld?.tax).toEqual({
      national: 38_287,
      residence: 12_500,
      total: 50_787,
    });
    // 3,942,948 + 300,000 − 50,787 − 50,000.
    expect(withLoss.takeHomeIncome).toBe(4_142_161);
  });

  it('case E: keeps the whole foreign dividend as foreign-source income when a reported loss nets against it', () => {
    const result = calculateTaxes(
      salaryInputs([account(-500_000, 800_000, 800_000, 80_000, true)]),
    );
    const withoutForeignTax = calculateTaxes(
      salaryInputs([account(-500_000, 800_000, 0, 0, true)]),
    );

    // The loss offsets 500,000 of the dividends, so T = 3,560,000 + 300,000 = 3,860,000, but it is
    // not foreign-source and does not reduce A = 800,000. B = 89,850 + 45,000 = 134,850;
    // R = ⌊2,831.85⌋ = 2,831. L = ⌊134,850 × 800,000 / 3,860,000⌋ = ⌊27,948.19⌋ = 27,948;
    // L_R = ⌊2,831 × 800,000 / 3,860,000⌋ = ⌊586.74⌋ = 586; ⌊27,948 × 12%⌋ = ⌊3,353.76⌋ = 3,353;
    // ⌊27,948 × 18%⌋ = ⌊5,030.64⌋ = 5,030. Left over 80,000 − 27,948 − 586 − 3,353 − 5,030 = 43,083.
    const limits = { incomeTax: 27_948, reconstructionSurtax: 586, prefecture: 3_353, city: 5_030 };
    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 80_000,
      foreignSourceIncome: 800_000,
      adjustedForeignSourceIncome: 800_000,
      totalIncome: 3_860_000,
      incomeTax: 134_850,
      limit: limits,
      credit: limits,
      excess: 43_083,
    });
    // The surtax on the return drops the fraction: 2,831, not 2,831.85.
    expect(result.reconstructionSurtax).toBe(2_831);
    // ⌊(134,850 + 2,831 − 27,948 − 586) / 100⌋ × 100 = ⌊109,147 / 100⌋ × 100 = 109,100; without
    // the credit ⌊137,681 / 100⌋ × 100 = 137,600.
    expect(result.nationalIncomeTax).toBe(109_100);
    expect(withoutForeignTax.nationalIncomeTax).toBe(137_600);
    // 市 144,420 + 9,000 − 1,500 = 151,920 − 5,030 = 146,890 → 146,800; 県 96,280 + 6,000 − 1,000 =
    // 101,280 − 3,353 = 97,927 → 97,900; + 5,000 = 249,700; without it 151,900 + 101,200 + 5,000 =
    // 258,100.
    expect(result.residenceTax.totalResidenceTax).toBe(249_700);
    expect(withoutForeignTax.residenceTax.totalResidenceTax).toBe(258_100);
    expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBe(253_100);
    // 5,300,000 − 109,100 − 249,700 − 722,252 − 80,000.
    expect(result.takeHomeIncome).toBe(4_138_948);
  });

  describe('case F: interest of 100,000 paid outside Japan with 10,000 foreign tax', () => {
    it('credits the foreign tax against every tax in turn', () => {
      const result = calculateTaxes(salaryInputs([foreignInterest(100_000, 10_000)]));

      // T = 3,660,000; 課税総所得金額 1,897,000 → B = 94,850; R = ⌊1,991.85⌋ = 1,991.
      // L = ⌊94,850 × 100,000 / 3,660,000⌋ = ⌊2,591.53⌋ = 2,591; L_R = ⌊1,991 / 36.6⌋ = ⌊54.40⌋ =
      // 54; ⌊2,591 × 12%⌋ = ⌊310.92⌋ = 310; ⌊2,591 × 18%⌋ = ⌊466.38⌋ = 466. Left over 10,000 −
      // 2,591 − 54 − 310 − 466 = 6,579.
      const limits = { incomeTax: 2_591, reconstructionSurtax: 54, prefecture: 310, city: 466 };
      expect(result.foreignTaxCredit).toEqual({
        foreignTax: 10_000,
        foreignSourceIncome: 100_000,
        adjustedForeignSourceIncome: 100_000,
        totalIncome: 3_660_000,
        incomeTax: 94_850,
        limit: limits,
        credit: limits,
        excess: 6_579,
      });
      // ⌊(94,850 + 1,991 − 2,591 − 54) / 100⌋ × 100 = ⌊94,196 / 100⌋ × 100 = 94,100.
      expect(result.nationalIncomeTax).toBe(94_100);
      // 2,507,000: 市 150,420 − 1,500 − 466 = 148,454 → 148,400; 県 100,280 − 1,000 − 310 =
      // 98,970 → 98,900; + 5,000 = 252,300.
      expect(result.residenceTax.totalResidenceTax).toBe(252_300);
      // 5,100,000 − 94,100 − 252,300 − 722,252 − 10,000.
      expect(result.takeHomeIncome).toBe(4_021_348);
    });

    it('measures the limits on the income tax after a home loan credit it absorbs', () => {
      const result = calculateTaxes({
        ...salaryInputs([foreignInterest(100_000, 10_000)]),
        homeLoanTaxCredit: { creditAmount: 50_000, moveInYear: 2024 },
      });

      // B = 94,850 − 50,000 = 44,850; R = ⌊941.85⌋ = 941. L = ⌊44,850 × 100,000 / 3,660,000⌋ =
      // ⌊1,225.41⌋ = 1,225; L_R = ⌊941 / 36.6⌋ = ⌊25.71⌋ = 25; ⌊1,225 × 12%⌋ = 147; ⌊1,225 ×
      // 18%⌋ = ⌊220.5⌋ = 220.
      expect(result.homeLoanTaxCredit).toMatchObject({
        appliedToIncomeTax: 50_000,
        appliedToResidenceTax: 0,
      });
      expect(result.foreignTaxCredit).toMatchObject({
        incomeTax: 44_850,
        limit: { incomeTax: 1_225, reconstructionSurtax: 25, prefecture: 147, city: 220 },
        credit: { incomeTax: 1_225, reconstructionSurtax: 25, prefecture: 147, city: 220 },
      });
      // ⌊(44,850 + 941 − 1,225 − 25) / 100⌋ × 100 = ⌊44,541 / 100⌋ × 100 = 44,500.
      expect(result.nationalIncomeTax).toBe(44_500);
      // 市 148,920 − 220 = 148,700; 県 99,280 − 147 = 99,133 → 99,100; + 5,000 = 252,800.
      expect(result.residenceTax.totalResidenceTax).toBe(252_800);
    });

    it('credits nothing when a home loan credit takes all the income tax and spills over', () => {
      const result = calculateTaxes({
        ...salaryInputs([foreignInterest(100_000, 10_000)]),
        homeLoanTaxCredit: { creditAmount: 200_000, moveInYear: 2024 },
      });

      // 94,850 comes off the income tax, so B = 0 and there is no limit; the other 105,150 spills
      // over up to min(97,500, ⌊1,897,000 × 5%⌋ = 94,850) = 94,850.
      expect(result.foreignTaxCredit).toMatchObject({
        incomeTax: 0,
        limit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
        credit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
        excess: 10_000,
      });
      expect(result.nationalIncomeTax).toBe(0);
      // Spillover 94,850 splits 56,910 / 37,940: 市 148,920 − 56,910 = 92,010 → 92,000; 県 99,280 −
      // 37,940 = 61,340 → 61,300; + 5,000 = 158,300. Only the home loan's reconciliation figure
      // (148,900 + 99,200) is present.
      expect(result.residenceTax.totalResidenceTax).toBe(158_300);
      expect(result.residenceTax.foreignTaxCredit).toBeUndefined();
      expect(result.residenceTaxIncomeBasedBeforeHomeLoanCredit).toBe(248_100);
      expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBeUndefined();
    });
  });

  it('case G: credits nothing with no income tax to credit against', () => {
    const result = calculateTaxes(interestOnly(1_000_000, 100_000));

    // 合計所得金額 1,000,000 is under the 1,040,000 基礎控除, so B = 0 and every limit is 0.
    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 100_000,
      foreignSourceIncome: 1_000_000,
      adjustedForeignSourceIncome: 1_000_000,
      totalIncome: 1_000_000,
      incomeTax: 0,
      limit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      credit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      excess: 100_000,
    });
    expect(result.nationalIncomeTax).toBe(0);
    // As without foreign tax: 32,700 + 21,800 + 5,000.
    expect(result.residenceTax.totalResidenceTax).toBe(59_500);
    // 1,000,000 − 59,500 − 100,000.
    expect(result.takeHomeIncome).toBe(840_500);
  });

  it('case H: caps each residence side at its own 所得割', () => {
    const result = calculateTaxes(interestOnly(60_000_000, 30_000_000));

    // Over 25,000,000 there is no 基礎控除 and no 調整控除. B = 60,000,000 × 45% − 4,796,000 =
    // 22,204,000; R = 466,284; A = T, so L = B and L_R = R; 道府県 ⌊22,204,000 × 12%⌋ = 2,664,480,
    // 市町村 ⌊22,204,000 × 18%⌋ = 3,996,720. The 所得割 is 3,600,000 / 2,400,000, under both
    // residence credits, so each is capped at it.
    expect(result.foreignTaxCredit?.credit).toEqual({
      incomeTax: 22_204_000,
      reconstructionSurtax: 466_284,
      prefecture: 2_664_480,
      city: 3_996_720,
    });
    // 30,000,000 − 22,204,000 − 466,284 − 2,664,480 − 3,996,720.
    expect(result.foreignTaxCredit?.excess).toBe(668_516);
    expect(result.nationalIncomeTax).toBe(0);
    expect(result.residenceTax.foreignTaxCredit).toEqual({
      city: 3_600_000,
      prefecture: 2_400_000,
    });
    expect(result.residenceTax.totalResidenceTax).toBe(5_000);
    expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBe(6_000_000);
    // With nothing left to reduce, the furusato donation reduces neither tax.
    expect(result.furusatoNozei.incomeTaxReduction).toBe(0);
    expect(result.furusatoNozei.residenceTaxReduction).toBe(0);
  });

  it('case H′: does not move a prefectural credit the 所得割 cannot absorb to the municipal side', () => {
    const result = calculateTaxes(interestOnly(50_000_000, 22_000_000));

    // B = 50,000,000 × 45% − 4,796,000 = 17,704,000; R = 371,784; 道府県 limit ⌊17,704,000 × 12%⌋ =
    // 2,124,480, 市町村 ⌊17,704,000 × 18%⌋ = 3,186,720. Left for residence tax: 22,000,000 −
    // 17,704,000 − 371,784 = 3,924,216 → 2,124,480 prefectural, 1,799,736 municipal.
    expect(result.foreignTaxCredit?.credit).toEqual({
      incomeTax: 17_704_000,
      reconstructionSurtax: 371_784,
      prefecture: 2_124_480,
      city: 1_799_736,
    });
    // 県 2,000,000 absorbs 2,000,000 of its 2,124,480; the other 124,480 is not added to the city's
    // 1,799,736: 市 3,000,000 − 1,799,736 = 1,200,264 → 1,200,200; + 5,000 = 1,205,200.
    expect(result.residenceTax.foreignTaxCredit).toEqual({
      city: 1_799_736,
      prefecture: 2_000_000,
    });
    expect(result.residenceTax.totalResidenceTax).toBe(1_205_200);
    // 50,000,000 − 1,205,200 − 22,000,000.
    expect(result.takeHomeIncome).toBe(26_794_800);
  });

  it('case I: counts a foreign dividend with no foreign tax toward the limit', () => {
    const result = calculateTaxes(
      salaryInputs([foreignInterest(100_000, 10_000), foreignDividend(true, 0)]),
    );

    // A = 100,000 + 1,000,000; T = 4,660,000; B = 94,850 + 150,000 = 244,850; R = ⌊5,141.85⌋ =
    // 5,141. L = ⌊244,850 × 1,100,000 / 4,660,000⌋ = ⌊57,797.21⌋ = 57,797 ≥ 10,000, so all of it
    // comes off the income tax. L_R = ⌊5,141 × 1,100,000 / 4,660,000⌋ = ⌊1,213.54⌋ = 1,213;
    // ⌊57,797 × 12%⌋ = ⌊6,935.64⌋ = 6,935; ⌊57,797 × 18%⌋ = ⌊10,403.46⌋ = 10,403.
    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 10_000,
      foreignSourceIncome: 1_100_000,
      adjustedForeignSourceIncome: 1_100_000,
      totalIncome: 4_660_000,
      incomeTax: 244_850,
      limit: { incomeTax: 57_797, reconstructionSurtax: 1_213, prefecture: 6_935, city: 10_403 },
      credit: { incomeTax: 10_000, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      excess: 0,
    });
    // ⌊(244,850 + 5,141 − 10,000) / 100⌋ × 100 = ⌊239,991 / 100⌋ × 100 = 239,900.
    expect(result.nationalIncomeTax).toBe(239_900);
    // No residence credit: 市 150,420 + 30,000 − 1,500 = 178,920 → 178,900; 県 100,280 + 20,000 −
    // 1,000 = 119,280 → 119,200; + 5,000 = 303,100.
    expect(result.residenceTax.foreignTaxCredit).toBeUndefined();
    expect(result.residenceTax.totalResidenceTax).toBe(303_100);
    expect(result.residenceTaxIncomeBasedBeforeForeignTaxCredit).toBeUndefined();
  });

  it('case J: treats a foreign dividend with no foreign tax as a Japanese one', () => {
    for (const isReported of [true, false]) {
      expect(calculateTaxes(salaryInputs([foreignDividend(isReported, 0)]))).toEqual(
        calculateTaxes(
          salaryInputs([{ ...foreignDividend(isReported, 0), issuerDomicile: 'domestic' }]),
        ),
      );
    }
  });

  it('case K: credits foreign tax entered by hand with no investment entry', () => {
    const result = calculateTaxes({
      ...salaryInputs(),
      foreignTaxCredit: { foreignTax: 20_000, foreignSourceIncome: 500_000 },
    });

    // T = 3,560,000; B = 89,850; R = ⌊1,886.85⌋ = 1,886. L = ⌊89,850 × 500,000 / 3,560,000⌋ =
    // ⌊12,619.38⌋ = 12,619; L_R = ⌊1,886 × 500,000 / 3,560,000⌋ = ⌊264.89⌋ = 264; ⌊12,619 × 12%⌋ =
    // ⌊1,514.28⌋ = 1,514; ⌊12,619 × 18%⌋ = ⌊2,271.42⌋ = 2,271. Left over 20,000 − 12,619 − 264 −
    // 1,514 − 2,271 = 3,332.
    const limits = { incomeTax: 12_619, reconstructionSurtax: 264, prefecture: 1_514, city: 2_271 };
    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 20_000,
      foreignSourceIncome: 500_000,
      adjustedForeignSourceIncome: 500_000,
      totalIncome: 3_560_000,
      incomeTax: 89_850,
      manualForeignTax: 20_000,
      manualForeignSourceIncome: 500_000,
      limit: limits,
      credit: limits,
      excess: 3_332,
    });
    // ⌊(89,850 + 1,886 − 12,619 − 264) / 100⌋ × 100 = ⌊78,853 / 100⌋ × 100 = 78,800.
    expect(result.nationalIncomeTax).toBe(78_800);
    // 市 142,920 − 2,271 = 140,649 → 140,600; 県 95,280 − 1,514 = 93,766 → 93,700; + 5,000.
    expect(result.residenceTax.city.cityIncomeTax).toBe(140_600);
    expect(result.residenceTax.prefecture.prefecturalIncomeTax).toBe(93_700);
    expect(result.residenceTax.totalResidenceTax).toBe(239_300);
    expect(result.investmentIncome).toBeUndefined();
    expect(result.foreignTaxPaid).toBe(20_000);
    // 78,800 + 20,000.
    expect(incomeTaxPaid(result)).toBe(98_800);
    // 5,000,000 − 78,800 − 239,300 − 722,252 − 20,000.
    expect(result.takeHomeIncome).toBe(3_939_648);
  });

  it('case K′: has no limit with no foreign-source income, so the foreign tax is only paid', () => {
    const result = calculateTaxes({
      ...salaryInputs(),
      foreignTaxCredit: { foreignTax: 20_000, foreignSourceIncome: 0 },
    });

    expect(result.foreignTaxCredit).toEqual({
      foreignTax: 20_000,
      foreignSourceIncome: 0,
      adjustedForeignSourceIncome: 0,
      totalIncome: 3_560_000,
      incomeTax: 89_850,
      manualForeignTax: 20_000,
      limit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      credit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      excess: 20_000,
    });
    expect(result.nationalIncomeTax).toBe(91_700);
    expect(result.residenceTax.totalResidenceTax).toBe(243_100);
    // 3,942,948 − 20,000.
    expect(result.takeHomeIncome).toBe(3_922_948);
  });

  it('leaves the results unchanged when nothing is entered by hand', () => {
    expect(
      calculateTaxes({
        ...salaryInputs(),
        foreignTaxCredit: { foreignTax: 0, foreignSourceIncome: 0 },
      }),
    ).toEqual(calculateTaxes(salaryInputs()));
  });

  it('rejects foreign-tax figures that cannot apply', () => {
    expect(() =>
      calculateTaxes(salaryInputs([{ ...foreignDividend(true), issuerDomicile: 'domestic' }])),
    ).toThrow('Only a dividend from a foreign company or fund has foreign tax withheld.');
    expect(() => calculateTaxes(salaryInputs([foreignDividend(true, 1_000_001)]))).toThrow(
      'Foreign tax cannot be more than the gross dividend.',
    );
    expect(() => calculateTaxes(salaryInputs([foreignDividend(false, -1)]))).toThrow(
      'Foreign tax cannot be negative.',
    );
    expect(() =>
      calculateTaxes(
        salaryInputs([{ ...foreignInterest(100_000, 10_000), payerDomicile: 'domestic' }]),
      ),
    ).toThrow('Foreign tax on interest paid in Japan is not supported.');
    expect(() => calculateTaxes(salaryInputs([foreignInterest(100_000, 100_001)]))).toThrow(
      'Foreign tax cannot be more than the gross interest.',
    );
    expect(() => calculateTaxes(salaryInputs([account(0, 800_000, 800_001, 0, false)]))).toThrow(
      'Foreign dividends cannot be more than the dividends received into the account.',
    );
    expect(() =>
      calculateTaxes(salaryInputs([account(0, 800_000, 500_000, 500_001, true)])),
    ).toThrow('Foreign tax cannot be more than the foreign dividends.');
    expect(() =>
      calculateTaxes({
        ...salaryInputs(),
        foreignTaxCredit: { foreignTax: -1, foreignSourceIncome: 0 },
      }),
    ).toThrow('Foreign tax and foreign-source income cannot be negative.');
  });
});
