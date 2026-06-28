// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  calculateTaxes,
  calculateNetEmploymentIncome,
  calculateEmploymentInsurance,
  calculateNationalIncomeTaxBasicDeduction,
  calculateNationalIncomeTax,
  calculateTotalNetIncome,
} from '../utils/taxCalculations';
import {
  DEFAULT_PROVIDER,
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
} from '../types/healthInsurance';
import type { Dependent } from '../types/dependents';

describe('calculateNetEmploymentIncome', () => {
  describe('2026 tiers (R8)', () => {
    it('deduction of 740,000 yen for income up to 2,200,000 yen (R8 temporary provision)', () => {
      expect(calculateNetEmploymentIncome(1_500_000, 2026)).toBe(760_000);
      expect(calculateNetEmploymentIncome(1_899_999, 2026)).toBe(1_159_999);
    });

    it('between 2,200,000 and 6,600,000 yen, income is rounded down to the nearest 4000 yen', () => {
      expect(calculateNetEmploymentIncome(2_200_000, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_201_123, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_203_333, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_204_000, 2026)).toBe(1_462_800);

      expect(calculateNetEmploymentIncome(3_600_000, 2026)).toBe(2_440_000);
      expect(calculateNetEmploymentIncome(3_603_999, 2026)).toBe(2_440_000);
      expect(calculateNetEmploymentIncome(3_604_000, 2026)).toBe(2_443_200);
    });

    it('calculates deduction correctly for income between 2,200,000 and 3,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(2_500_000, 2026)).toBe(
        2_500_000 - (2_500_000 * 0.3 + 80_000),
      );
    });

    it('calculates deduction correctly for income between 3,600,001 and 6,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(5_000_000, 2026)).toBe(
        5_000_000 - (5_000_000 * 0.2 + 440_000),
      );
    });

    it('calculates deduction correctly for income between 6,600,001 and 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(7_500_000, 2026)).toBe(
        7_500_000 - (7_500_000 * 0.1 + 1_100_000),
      );
    });

    it('From 6.6 million yen, income is not rounded down to the nearest 4000 yen', () => {
      expect(calculateNetEmploymentIncome(6_600_100, 2026)).toBe(
        Math.floor(6_600_100 * 0.9) - 1_100_000,
      );
      expect(calculateNetEmploymentIncome(6_600_123, 2026)).toBe(
        Math.floor(6_600_123 * 0.9) - 1_100_000,
      );
      expect(calculateNetEmploymentIncome(6_601_000, 2026)).not.toBe(
        calculateNetEmploymentIncome(6_600_100, 2026),
      );
    });

    it('returns maximum deduction of 1,950,000 yen for income above 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(9_000_000, 2026)).toBe(9_000_000 - 1_950_000);
      expect(calculateNetEmploymentIncome(10_000_000, 2026)).toBe(10_000_000 - 1_950_000);
    });
  });

  describe('2025 tiers (R7)', () => {
    it('returns 0 for income at or below 650,000 yen', () => {
      expect(calculateNetEmploymentIncome(0, 2025)).toBe(0);
      expect(calculateNetEmploymentIncome(650_000, 2025)).toBe(0);
    });

    it('deduction of 650,000 yen for income up to 1,900,000 yen', () => {
      expect(calculateNetEmploymentIncome(650_001, 2025)).toBe(1);
      expect(calculateNetEmploymentIncome(1_500_000, 2025)).toBe(850_000);
      expect(calculateNetEmploymentIncome(1_900_000, 2025)).toBe(1_250_000);
    });

    it('smooth join at 1,900,000 yen: flat floor and standard formula give same result', () => {
      // Floor formula: 1,900,000 - 650,000 = 1,250,000
      // Standard formula: floor(1,900,000 / 4000) * 4000 * 0.7 - 80,000 = 1,900,000 * 0.7 - 80,000 = 1,250,000
      expect(calculateNetEmploymentIncome(1_900_000, 2025)).toBe(1_250_000);
      expect(calculateNetEmploymentIncome(1_900_001, 2025)).toBe(1_250_000); // rounds down to 1,900,000
    });

    it('calculates deduction correctly for income between 1,900,001 and 3,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(2_200_000, 2025)).toBe(1_460_000); // 2,200,000 * 0.7 - 80,000
      expect(calculateNetEmploymentIncome(2_500_000, 2025)).toBe(
        2_500_000 - (2_500_000 * 0.3 + 80_000),
      );
    });

    it('calculates deduction correctly for income between 3,600,001 and 6,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(5_000_000, 2025)).toBe(
        5_000_000 - (5_000_000 * 0.2 + 440_000),
      );
    });

    it('calculates deduction correctly for income between 6,600,001 and 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(7_500_000, 2025)).toBe(
        7_500_000 - (7_500_000 * 0.1 + 1_100_000),
      );
    });

    it('returns maximum deduction of 1,950,000 yen for income above 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(9_000_000, 2025)).toBe(9_000_000 - 1_950_000);
      expect(calculateNetEmploymentIncome(10_000_000, 2025)).toBe(10_000_000 - 1_950_000);
    });
  });

  describe('income amount adjustment (所得金額調整控除)', () => {
    const childUnder23: Dependent = {
      id: 'c',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: false,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    };

    it('subtracts the 所得金額調整控除 when a qualifying dependent is passed and salary exceeds ¥8.5M', () => {
      // 22M (R8): 給与所得控除 → 20,050,000; 所得金額調整控除 → 150,000; net = 19,900,000
      expect(calculateNetEmploymentIncome(22_000_000, 2026, [childUnder23])).toBe(19_900_000);
    });

    it('applies no adjustment without dependents (the default)', () => {
      expect(calculateNetEmploymentIncome(22_000_000, 2026)).toBe(20_050_000);
    });

    it('applies no adjustment at or below ¥8.5M even with a qualifying dependent', () => {
      expect(calculateNetEmploymentIncome(8_400_000, 2026, [childUnder23])).toBe(
        calculateNetEmploymentIncome(8_400_000, 2026),
      );
    });
  });
});

describe('calculateTaxes', () => {
  // Test cases for different income brackets
  it('calculates taxes correctly for income below 1,950,000 yen', () => {
    const inputs = {
      incomeStreams: [
        { type: 'salary' as const, amount: 1_500_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 2_500_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 50_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 0, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: -1_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [{ type: 'miscellaneous' as const, amount: 5_000_000, id: 'test' }],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        {
          id: '1',
          type: 'business' as const,
          amount: 5_000_000,
          blueFilerDeduction: 650_000,
        },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 1_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: 'DependentCoverage',
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
      incomeStreams: [
        { type: 'salary' as const, amount: 1_299_999, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: 'DependentCoverage',
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
      incomeStreams: [
        { type: 'salary' as const, amount: 1_200_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: true, // Should not matter for dependent coverage
      healthInsuranceProvider: 'DependentCoverage',
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
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: true,
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
      incomeStreams: [
        { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
      ],
      isSubjectToLongTermCarePremium: false,
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
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { id: '1', type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const },
        { id: '2', type: 'miscellaneous' as const, amount: 1_000_000 },
      ],
      isSubjectToLongTermCarePremium: false,
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

describe('calculateTotalNetIncome', () => {
  it('calculates total net income correctly for salary only', () => {
    // Salary 5M -> Net Employment Income (R8: floor(5M * 0.8) - 440k = 4M - 440k = 3.56M)
    const incomeStreams = [
      { type: 'salary' as const, amount: 5_000_000, frequency: 'annual' as const, id: 'test' },
    ];
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(3_560_000);
  });

  it('calculates total net income correctly for business only', () => {
    // Business 5M, Deduction 650k -> Taxable Business Income = 4.35M
    const incomeStreams = [
      { type: 'business' as const, amount: 5_000_000, blueFilerDeduction: 650_000, id: 'test' },
    ];
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(4_350_000);
  });

  it('calculates total net income correctly for mixed income', () => {
    // Salary 3M -> Net Employment (R8: floor(3M * 0.7) - 80k = 2.1M - 80k = 2.02M)
    // Business 1M -> Taxable Business = 1M
    // Total = 3.02M
    const incomeStreams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
      { type: 'business' as const, amount: 1_000_000, blueFilerDeduction: 0, id: 'b1' },
    ];
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(3_020_000);
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
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(2_120_000);
  });
});

describe('Commuting Allowance', () => {
  it('is non-taxable up to 150,000 JPY/month but subject to social insurance', () => {
    const inputs = {
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 20_000,
          frequency: 'monthly' as const,
          id: 'c1',
        },
      ],
      isSubjectToLongTermCarePremium: false,
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
    // Salary 300k + Commuting 20k = 320k
    // SMR for 320k is 320k (Bracket 23: 310k-330k -> 320k)
    // Health Insurance (Tokyo, Kyokai Kenpo ~9.98% split? No, total rate. Employee pays half.)
    // Let's verify against standard calculation without commuting but with higher salary
    const inputsComparison = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 320_000, frequency: 'monthly' as const, id: 's2' },
      ],
    };
    const resultComparison = calculateTaxes(inputsComparison);

    expect(result.healthInsurance).toBe(resultComparison.healthInsurance);
    expect(result.pensionPayments).toBe(resultComparison.pensionPayments);
    expect(result.employmentInsurance).toBe(resultComparison.employmentInsurance);

    // 2. Income Tax Base
    // CommutingAllowance (20k) is fully non-taxable (<= 150k)
    // Tax Base should be based on 300k salary only (3.6M annual)
    // Compare with 300k salary case
    const inputsSalaryOnly = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's3' },
      ],
    };
    const resultSalaryOnly = calculateTaxes(inputsSalaryOnly);

    // Tax should be identical to salary-only case
    // expect(result.nationalIncomeTax).toBe(resultSalaryOnly.nationalIncomeTax);
    // ^ INCORRECT: Higher social insurance (from commuting) means larger deduction -> lower tax.

    // Instead, verify that the Net Employment Income (base for tax) is identical
    // This confirms that the Commuting Allowance was excluded from the tax base.
    expect(result.netEmploymentIncome).toBe(resultSalaryOnly.netEmploymentIncome);

    // And verify Tax is LOWER than salary-only case due to higher Social Insurance deduction
    expect(result.nationalIncomeTax).toBeLessThan(resultSalaryOnly.nationalIncomeTax);

    // And different from the 320k salary case (which has higher tax due to higher income)
    expect(result.nationalIncomeTax).toBeLessThan(resultComparison.nationalIncomeTax);
  });

  it('excess over 150,000 JPY/month is taxable', () => {
    const inputs = {
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 200_000,
          frequency: 'monthly' as const,
          id: 'c1',
        }, // 50k taxable excess
      ],
      isSubjectToLongTermCarePremium: false,
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
    // Salary 300k + Commuting 200k = 500k
    // Compare with 500k salary
    const inputsComparison = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 500_000, frequency: 'monthly' as const, id: 's2' },
      ],
    };
    const resultComparison = calculateTaxes(inputsComparison);

    expect(result.healthInsurance).toBe(resultComparison.healthInsurance);
    expect(result.pensionPayments).toBe(resultComparison.pensionPayments);

    // 2. Income Tax Base
    // Taxable Income = Salary 300k + (Commuting 200k - 150k) = 350k
    // Compare with 350k salary
    const inputsTaxableEquivalent = {
      ...inputs,
      incomeStreams: [
        { type: 'salary' as const, amount: 350_000, frequency: 'monthly' as const, id: 's3' },
      ],
    };
    const resultTaxableEquivalent = calculateTaxes(inputsTaxableEquivalent);

    // Verify Net Employment Income is identical
    expect(result.netEmploymentIncome).toBe(resultTaxableEquivalent.netEmploymentIncome);

    // Tax will be lower because Social Insurance on 500k base > Social Insurance on 350k base
    expect(result.nationalIncomeTax).toBeLessThan(resultTaxableEquivalent.nationalIncomeTax);

    // Verify breakdown fields
    expect(result.commutingAllowanceIncome).toBe(200_000 * 12);
    expect(result.commutingAllowanceTaxable).toBe(50_000 * 12);
    expect(result.commutingAllowanceNonTaxable).toBe(150_000 * 12);
  });

  it('handles 6-month pass correctly', () => {
    // 6-month pass costs 120,000 (20,000/month equivalent).
    // Should be fully non-taxable.
    const inputs = {
      incomeStreams: [
        { type: 'salary' as const, amount: 300_000, frequency: 'monthly' as const, id: 's1' },
        {
          type: 'commutingAllowance' as const,
          amount: 120_000,
          frequency: '6-months' as const,
          id: 'c1',
        },
      ],
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const result = calculateTaxes(inputs);

    // Annual Commuting: 120,000 * 2 = 240,000
    // Taxable part: 0 (20k/month < 150k/month)
    expect(result.commutingAllowanceIncome).toBe(240_000);
    expect(result.commutingAllowanceTaxable).toBe(0);
    expect(result.commutingAllowanceNonTaxable).toBe(240_000);
  });
});

describe('Additional income deductions (life, earthquake, medical, other)', () => {
  const baseSalaryInputs = {
    incomeStreams: [
      { type: 'salary' as const, amount: 8_000_000, frequency: 'annual' as const, id: 's1' },
    ],
    isSubjectToLongTermCarePremium: false,
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
      earthquakeInsurance: { earthquake: 50_000 },
    });

    // life 80k/56k + earthquake 50k/25k = 130k national, 81k residence
    expect(withDeductions.additionalDeductions).toBeDefined();
    expect(withDeductions.additionalDeductions!.national).toBe(130_000);
    expect(withDeductions.additionalDeductions!.residence).toBe(81_000);
    expect(withDeductions.additionalDeductions!.items.map(i => i.key)).toEqual([
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
    expect(withMedical.additionalDeductions!.national).toBe(150_000);
    expect(withMedical.additionalDeductions!.residence).toBe(150_000);
    expect(withMedical.additionalDeductions!.items).toHaveLength(1);
    expect(withMedical.additionalDeductions!.items[0]!.key).toBe('medical');

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
      earthquakeInsurance: { earthquake: 50_000 },
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
      earthquakeInsurance: { earthquake: 50_000 },
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
});

describe('RSU (Restricted Stock Unit) income', () => {
  it('calculates foreign RSU income only correctly', () => {
    // RSU foreign income of 2M should be subject to employment income deduction
    const inputs = {
      incomeStreams: [
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const },
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      isSubjectToLongTermCarePremium: false,
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
      isSubjectToLongTermCarePremium: false,
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
      incomeStreams: [
        {
          id: 'rsu1',
          type: 'stockCompensation' as const,
          amount: 2_000_000,
          issuerDomicile: 'foreign' as const,
        },
      ],
      isSubjectToLongTermCarePremium: false,
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

  it('calculateTotalNetIncome includes RSU in employment income deduction', () => {
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
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(1_260_000);
  });

  it('calculateTotalNetIncome includes RSU with salary correctly', () => {
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
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(3_560_000);
  });

  it('supports multiple stock compensation streams and sums them in tax calculations', () => {
    const inputs = {
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
      isSubjectToLongTermCarePremium: false,
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

  it('calculateTotalNetIncome sums multiple stock compensation streams', () => {
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
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(1_260_000);
  });
});

describe('所得金額調整控除 (income amount adjustment deduction) integration', () => {
  const childUnder23: Dependent = {
    id: 'c1',
    relationship: 'child',
    ageCategory: '19to22',
    isCohabiting: false,
    disability: 'none',
    income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
  };
  const adultChild: Dependent = {
    id: 'c2',
    relationship: 'child',
    ageCategory: '23to69',
    isCohabiting: false,
    disability: 'none',
    income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
  };

  const baseInputs = (dependents: Dependent[]) => ({
    incomeStreams: [
      { id: 's1', type: 'salary' as const, amount: 22_000_000, frequency: 'annual' as const },
    ],
    isSubjectToLongTermCarePremium: false,
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

  it('calculateTotalNetIncome applies the adjustment when given qualifying dependents', () => {
    const incomeStreams = [
      { id: 's1', type: 'salary' as const, amount: 22_000_000, frequency: 'annual' as const },
    ];
    expect(calculateTotalNetIncome(incomeStreams, 2026, [childUnder23])).toBe(19_900_000);
    // No dependents argument → no adjustment (backward compatible).
    expect(calculateTotalNetIncome(incomeStreams, 2026)).toBe(20_050_000);
  });
});

describe('grossEmploymentIncome (canonical gross for the Net Employment Income tooltip)', () => {
  const baseInputs = {
    isSubjectToLongTermCarePremium: false,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  };

  it('sums salary, taxable commuting allowance, bonus, and stock compensation', () => {
    const result = calculateTaxes({
      ...baseInputs,
      healthInsuranceProvider: DEFAULT_PROVIDER,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
        // 200k/mo commuting = 2.4M/yr; non-taxable cap is 1.8M/yr → 600k taxable
        {
          id: 'c1',
          type: 'commutingAllowance' as const,
          amount: 200_000,
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

    // 6,000,000 + (2,400,000 − 1,800,000) + 1,000,000 + 4,000,000 = 11,600,000
    expect(result.grossEmploymentIncome).toBe(11_600_000);

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
