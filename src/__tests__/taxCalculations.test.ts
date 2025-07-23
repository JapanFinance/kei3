import { describe, it, expect } from 'vitest'
import { calculateTaxes, calculateNetEmploymentIncome, calculateEmploymentInsurance, calculateNationalIncomeTaxBasicDeduction, calculateNationalIncomeTax } from '../utils/taxCalculations'
import { HealthInsuranceProvider } from '../types/healthInsurance'

describe('calculateNetEmploymentIncome', () => {
  it('deduction of 650,000 yen for income up to 1,900,000 yen', () => {
    expect(calculateNetEmploymentIncome(1_500_000)).toBe(850_000)
    expect(calculateNetEmploymentIncome(1_899_999)).toBe(1_249_999)
  })

  it('between 1,900,000 and 6,600,000 yen, income is rounded down to the nearest 4000 yen', () => {
    expect(calculateNetEmploymentIncome(1_900_000)).toBe(1_250_000)
    expect(calculateNetEmploymentIncome(1_901_123)).toBe(1_250_000)
    expect(calculateNetEmploymentIncome(1_903_333)).toBe(1_250_000)
    expect(calculateNetEmploymentIncome(1_904_000)).toBe(1_252_800)

    expect(calculateNetEmploymentIncome(3_600_000)).toBe(2_440_000)
    expect(calculateNetEmploymentIncome(3_603_999)).toBe(2_440_000)
    expect(calculateNetEmploymentIncome(3_604_000)).toBe(2_443_200)
  })

  it('calculates deduction correctly for income between 1,900,001 and 3,600,000 yen', () => {
    expect(calculateNetEmploymentIncome(2_500_000)).toBe(2_500_000 - (2_500_000 * 0.3 + 80_000))
  })

  it('calculates deduction correctly for income between 3,600,001 and 6,600,000 yen', () => {
    expect(calculateNetEmploymentIncome(5_000_000)).toBe(5_000_000 - (5_000_000 * 0.2 + 440_000))
  })

  it('calculates deduction correctly for income between 6,600,001 and 8,500,000 yen', () => {
    expect(calculateNetEmploymentIncome(7_500_000)).toBe(7_500_000 - (7_500_000 * 0.1 + 1_100_000))
  })

  it('From 6.6 million yen, income is not rounded down to the nearest 4000 yen', () => {
    expect(calculateNetEmploymentIncome(6_600_100)).toBe(6_600_100 - (6_600_100 * 0.1 + 1_100_000))
    expect(calculateNetEmploymentIncome(6_600_123)).toBe((Math.floor(6_600_123 * 0.9) - 1_100_000))
    expect(calculateNetEmploymentIncome(6_601_000)).not.toBe(calculateNetEmploymentIncome(6_600_100))
  })

  it('returns maximum deduction of 1,950,000 yen for income above 8,500,000 yen', () => {
    expect(calculateNetEmploymentIncome(9_000_000)).toBe(9_000_000 - 1_950_000)
    expect(calculateNetEmploymentIncome(10_000_000)).toBe(10_000_000 - 1_950_000)
  })
})

describe('calculateTaxes', () => {
  // Test cases for different income brackets
  it('calculates taxes correctly for income below 1,950,000 yen', () => {
    const inputs = {
      annualIncome: 1_500_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo", // Default for Kyokai Kenpo in tests
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0)
    expect(result.residenceTax.totalResidenceTax).toBe(22_200)
    expect(result.healthInsurance).toBe(74_916)
    expect(result.pensionPayments).toBe(138_348)
    // 1,500,000 / 12 = 125,000 per month
    // 125,000 * 0.55% = 687.5 per month → 687 yen (exactly 0.5 yen → round down)
    // 687 * 12 = 8,244 yen annually
    expect(result.employmentInsurance).toBe(8_244)
    expect(result.takeHomeIncome).toBe(1_256_292)
  })

  it('calculates taxes correctly for income between 1,950,000 and 3,300,000 yen', () => {
    const inputs = {
      annualIncome: 2_500_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(22_300)
    expect(result.residenceTax.totalResidenceTax).toBe(91_100)
    expect(result.healthInsurance).toBe(118_920)
    expect(result.pensionPayments).toBe(219_600)
    // 2,500,000 / 12 ≈ 208,333.33 per month
    // 208,333.33 * 0.55% ≈ 1,145.83 per month → 1,146 yen (round up)
    // 1,146 * 12 = 13,752 yen annually
    expect(result.employmentInsurance).toBe(13_752)
    expect(result.takeHomeIncome).toBe(2_034_328)
  })

  it('calculates taxes correctly for income between 3,300,000 and 6,950,000 yen', () => {
    const inputs = {
      annualIncome: 5_000_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(120_700)
    expect(result.residenceTax.totalResidenceTax).toBe(243_200)
    expect(result.healthInsurance).toBe(243_792)
    expect(result.pensionPayments).toBe(450_180)
    // 5,000,000 / 12 ≈ 416,666.67 per month
    // 416,666.67 * 0.55% ≈ 2,291.67 per month → 2,292 yen (round up)
    // 2,292 * 12 = 27,504 yen annually
    expect(result.employmentInsurance).toBe(27_504)
    expect(result.takeHomeIncome).toBe(3_914_624)
  })

  // Test cases for high income brackets
  it('calculates taxes correctly for income above 40,000,000 yen', () => {
    const inputs = {
      annualIncome: 50_000_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(16_345_400) // 50M - 1.95M (employment deduction) - 1.815194M (social insurance) - 0 (basic deduction) = 46.234806M, rounded to 46.234M, then 45% - 4.796M = 16.0093M, + 2.1% = 16.345495M, rounded down to 16.3454M
    expect(result.residenceTax.totalResidenceTax).toBe(4_628_300) // (50M - 1.95M - 1.815194M - 0) = 46.234806M, rounded to 46.234M, then 6% city tax (2.774M) + 4% prefectural tax (1.8493M) + 5K 均等割
    expect(result.healthInsurance).toBe(826_500) // Capped at 68,874.5 * 12
    expect(result.pensionPayments).toBe(713_700) // Capped at 59,475 * 12
    // 50,000,000 / 12 ≈ 4,166,666.67 per month
    // 4,166,666.67 * 0.55% = 22,916.67 per month → 22,917 yen (round up)
    // 22,917 * 12 = 275,004 yen annually
    expect(result.employmentInsurance).toBe(275_004)
    expect(result.takeHomeIncome).toBe(27_211_096)
  })

  // Test edge cases
  it('handles zero income correctly', () => {
    const inputs = {
      annualIncome: 0,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0)
    expect(result.residenceTax.totalResidenceTax).toBe(0)
    expect(result.healthInsurance).toBe(0)
    expect(result.pensionPayments).toBe(0)
    expect(result.employmentInsurance).toBe(0)
    expect(result.takeHomeIncome).toBe(0)
  })

  it('handles negative income correctly', () => {
    const inputs = {
      annualIncome: -1_000_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(0)
    expect(result.residenceTax.totalResidenceTax).toBe(0)
    expect(result.healthInsurance).toBe(0)
    expect(result.pensionPayments).toBe(0)
    expect(result.employmentInsurance).toBe(0)
    expect(result.takeHomeIncome).toBe(0)
  })

  it('calculates taxes correctly for non-employment income', () => {
    const inputs = {
      annualIncome: 5_000_000,
      isEmploymentIncome: false,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE,
      prefecture: "Tokyo", // For NHI
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    expect(result.nationalIncomeTax).toBe(302_700)
    expect(result.residenceTax.totalResidenceTax).toBe(384_500)
    expect(result.healthInsurance).toBe(539_380)
    expect(result.pensionPayments).toBe(210_120)
    expect(result.employmentInsurance).toBe(0)
    expect(result.takeHomeIncome).toBe(3_563_300)
  })

  it('calculates taxes correctly for employment income with NHI', () => {
    // Test case for employees who work for small employers or are part-time/low income
    // and are therefore enrolled in National Health Insurance instead of employee insurance
    const inputs = {
      annualIncome: 5_000_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE,
      prefecture: "Tokyo", // For NHI
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
    };
    const result = calculateTaxes(inputs);
    
    // Should pay employment insurance (since it's employment income)
    expect(result.employmentInsurance).toBe(27_504);
    
    // Should pay NHI premiums (not employee health insurance)
    // NHI should be calculated on net employment income (3,560,000) not gross (5,000,000)
    expect(result.healthInsurance).toBe(389_620)
    
    // Should pay national pension (not employee pension, since they're on NHI)
    expect(result.pensionPayments).toBe(210_120)
    
    // Tax calculations should use employment income deduction
    expect(result.netEmploymentIncome).toBe(3_560_000)
    expect(result.nationalIncomeTax).toBe(130_300)
    expect(result.residenceTax.totalResidenceTax).toBe(252_600)
    
    // Total take-home should reflect employment income with NHI and National Pension
    // NHI calculated on net employment income results in lower premiums and higher take-home
    expect(result.takeHomeIncome).toBe(3_989_856)
  })

  it('calculates taxes correctly with DC plan contributions', () => {
    // Test without DC plan contributions
    const inputsWithoutDcPlan = {
      annualIncome: 5_000_000,
      isEmploymentIncome: true,
      isSubjectToLongTermCarePremium: false,
      healthInsuranceProvider: HealthInsuranceProvider.KYOKAI_KENPO,
      prefecture: "Tokyo",
      numberOfDependents: 0, showDetailedInput: false, dcPlanContributions: 0,
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
    expect(resultWithIdeco.residenceTax.totalResidenceTax).toBeLessThan(resultWithoutIdeco.residenceTax.totalResidenceTax);
    
    // Take-home pay should be higher with iDeCo contributions
    // This is because the tax savings offset part of the contribution
    expect(resultWithIdeco.takeHomeIncome).toBeGreaterThan(resultWithoutIdeco.takeHomeIncome);
    
    // Verify that the tax savings are calculated correctly
    const incomeTaxSavings = resultWithoutIdeco.nationalIncomeTax - resultWithIdeco.nationalIncomeTax;
    const residenceTaxSavings = resultWithoutIdeco.residenceTax.totalResidenceTax - resultWithIdeco.residenceTax.totalResidenceTax;
    
    // With 240,000 yen contribution at ~10% marginal tax rate, we expect around 24,000 yen in income tax savings
    // and around 24,000 yen in residence tax savings (10% rate)
    expect(incomeTaxSavings).equals(22_800); // less because it crosses into the 5% bracket
    expect(residenceTaxSavings).equals(24_000);
  });
})

describe('calculateEmploymentInsurance', () => {
  // Test cases with annual amounts that divide evenly by 12
  it('calculates insurance for employment income with even monthly amounts', () => {
    // 1,200,000 / 12 = 100,000 per month
    // 100,000 * 0.55% = 550 yen per month
    // 550 * 12 = 6,600 yen annually
    expect(calculateEmploymentInsurance(1_200_000, true)).toBe(6_600)
    
    // 2,400,000 / 12 = 200,000 per month
    // 200,000 * 0.55% = 1,100 yen per month
    // 1,100 * 12 = 13,200 yen annually
    expect(calculateEmploymentInsurance(2_400_000, true)).toBe(13_200)
  })

  // Test cases with non-even monthly amounts to verify rounding
  it('applies correct rounding for monthly premiums', () => {
    // 1,000,000 / 12 ≈ 83,333.33 per month
    // 83,333.33 * 0.55% ≈ 458.33 per month
    // Rounded to 458 yen per month (decimal .33 < .50 → round down)
    // 458 * 12 = 5,496 yen annually
    expect(calculateEmploymentInsurance(1_000_000, true)).toBe(5_496)
    
    // 1,100,000 / 12 ≈ 91,666.67 per month
    // 91,666.67 * 0.55% ≈ 504.17 per month
    // Rounded to 504 yen per month (decimal .17 < .50 → round down)
    // 504 * 12 = 6,048 yen annually
    expect(calculateEmploymentInsurance(1_100_000, true)).toBe(6_048)
    
    // 1,111,111 / 12 ≈ 92,592.58 per month
    // 92,592.58 * 0.55% ≈ 509.26 per month
    // Rounded to 509 yen per month (decimal .26 < .50 → round down)
    // 509 * 12 = 6,108 yen annually
    expect(calculateEmploymentInsurance(1_111_111, true)).toBe(6_108)
    
    // 1,200,001 / 12 = 100,000.083 per month
    // 100,000.083 * 0.55% ≈ 550.00046 per month
    // Rounded to 550 yen per month (decimal .00046 < .50 → round down)
    // 550 * 12 = 6,600 yen annually
    expect(calculateEmploymentInsurance(1_200_001, true)).toBe(6_600)
    
    // 1,999,999 / 12 ≈ 166,666.58 per month
    // 166,666.58 * 0.55% ≈ 916.67 per month
    // Rounded to 917 yen per month (decimal .67 > .50 → round up)
    // 917 * 12 = 11,004 yen annually
    expect(calculateEmploymentInsurance(1_999_999, true)).toBe(11_004)
  })

  // Test edge cases
  it('returns 0 for non-employment income', () => {
    expect(calculateEmploymentInsurance(5_000_000, false)).toBe(0)
    expect(calculateEmploymentInsurance(10_000_000, false)).toBe(0)
  })

  it('returns 0 for zero income', () => {
    expect(calculateEmploymentInsurance(0, true)).toBe(0)
    expect(calculateEmploymentInsurance(0, false)).toBe(0)
  })

  it('returns 0 for negative income', () => {
    expect(calculateEmploymentInsurance(-1_000_000, true)).toBe(0)
    expect(calculateEmploymentInsurance(-1_000_000, false)).toBe(0)
  })
  
  // Test with very small amounts to ensure rounding works correctly
  it('handles very small amounts correctly', () => {
    // 10,000 / 12 ≈ 833.33 per month
    // 833.33 * 0.55% ≈ 4.58 per month
    // Rounded to 5 yen per month (decimal .58 > .50 → round up)
    // 5 * 12 = 60 yen annually
    expect(calculateEmploymentInsurance(10_000, true)).toBe(60)
    
    // 9,090 / 12 = 757.5 per month
    // 757.5 * 0.55% ≈ 4.17 per month
    // Rounded to 4 yen per month (decimal .17 < .50 → round down)
    // 4 * 12 = 48 yen annually
    expect(calculateEmploymentInsurance(9_090, true)).toBe(48)
  })
})

describe('calculateNationalIncomeTaxBasicDeduction', () => {
  it('returns 950,000 yen for income up to 1,320,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(0)).toBe(950_000)
    expect(calculateNationalIncomeTaxBasicDeduction(1_000_000)).toBe(950_000)
    expect(calculateNationalIncomeTaxBasicDeduction(1_320_000)).toBe(950_000)
  })

  it('returns 880,000 yen for income between 1,320,001 and 3,360,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(1_320_001)).toBe(880_000)
    expect(calculateNationalIncomeTaxBasicDeduction(2_000_000)).toBe(880_000)
    expect(calculateNationalIncomeTaxBasicDeduction(3_360_000)).toBe(880_000)
  })

  it('returns 680,000 yen for income between 3,360,001 and 4,890,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(3_360_001)).toBe(680_000)
    expect(calculateNationalIncomeTaxBasicDeduction(4_000_000)).toBe(680_000)
    expect(calculateNationalIncomeTaxBasicDeduction(4_890_000)).toBe(680_000)
  })

  it('returns 630,000 yen for income between 4,890,001 and 6,550,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(4_890_001)).toBe(630_000)
    expect(calculateNationalIncomeTaxBasicDeduction(5_000_000)).toBe(630_000)
    expect(calculateNationalIncomeTaxBasicDeduction(6_550_000)).toBe(630_000)
  })

  it('returns 580,000 yen for income between 6,550,001 and 23,500,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(6_550_001)).toBe(580_000)
    expect(calculateNationalIncomeTaxBasicDeduction(10_000_000)).toBe(580_000)
    expect(calculateNationalIncomeTaxBasicDeduction(23_500_000)).toBe(580_000)
  })

  it('returns 480,000 yen for income between 23,500,001 and 24,000,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(23_500_001)).toBe(480_000)
    expect(calculateNationalIncomeTaxBasicDeduction(24_000_000)).toBe(480_000)
  })

  it('returns 320,000 yen for income between 24,000,001 and 24,500,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(24_000_001)).toBe(320_000)
    expect(calculateNationalIncomeTaxBasicDeduction(24_500_000)).toBe(320_000)
  })

  it('returns 160,000 yen for income between 24,500,001 and 25,000,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(24_500_001)).toBe(160_000)
    expect(calculateNationalIncomeTaxBasicDeduction(25_000_000)).toBe(160_000)
  })

  it('returns 0 yen for income above 25,000,000 yen', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(25_000_001)).toBe(0)
    expect(calculateNationalIncomeTaxBasicDeduction(30_000_000)).toBe(0)
  })

  it('handles negative income correctly', () => {
    expect(calculateNationalIncomeTaxBasicDeduction(-1_000_000)).toBe(950_000)
  })
})

describe('calculateNationalIncomeTax', () => {
  it('calculates tax correctly for income below 1,950,000 yen', () => {
    expect(calculateNationalIncomeTax(1_500_000)).toBe(76_500) // 1.5M * 5% = 75K, + 2.1% = 76.575K, rounded down to 76.5K
    expect(calculateNationalIncomeTax(1_949_000)).toBe(99_400) // 1.949M * 5% = 97.45K, + 2.1% = 99.497K, rounded down to 99.4K
  })

  it('calculates tax correctly for income between 1,950,000 and 3,300,000 yen', () => {
    expect(calculateNationalIncomeTax(1_950_000)).toBe(99_500) // 1.95M * 10% - 97.5K = 97.5K, + 2.1% = 99.548K, rounded down to 99.5K
    expect(calculateNationalIncomeTax(3_299_000)).toBe(237_200) // 3.299M * 10% - 97.5K = 232.4K, + 2.1% = 237.280K, rounded down to 237.2K
  })

  it('calculates tax correctly for income between 3,300,000 and 6,950,000 yen', () => {
    expect(calculateNationalIncomeTax(3_300_000)).toBe(237_300) // 3.3M * 20% - 427.5K = 232.5K, + 2.1% = 237.383K, rounded down to 237.3K
    expect(calculateNationalIncomeTax(6_949_000)).toBe(982_500) // 6.949M * 20% - 427.5K = 962.3K, + 2.1% = 982.508K, rounded down to 982.5K
  })

  it('calculates tax correctly for income between 6,950,000 and 9,000,000 yen', () => {
    expect(calculateNationalIncomeTax(6_950_000)).toBe(982_700) // 6.95M * 23% - 636K = 962.5K, + 2.1% = 982.713K, rounded down to 982.7K
    expect(calculateNationalIncomeTax(8_999_000)).toBe(1_463_800) // 8.999M * 23% - 636K = 1.43377M, + 2.1% = 1.46388M, rounded down to 1.4638M
  })

  it('calculates tax correctly for income between 9,000,000 and 18,000,000 yen', () => {
    expect(calculateNationalIncomeTax(9_000_000)).toBe(1_464_100) // 9M * 33% - 1.536M = 1.434M, + 2.1% = 1.46414M, rounded down to 1.4641M
    expect(calculateNationalIncomeTax(17_999_000)).toBe(4_496_100) // 17.999M * 33% - 1.536M = 4.40367M, + 2.1% = 4.49615M, rounded down to 4.4961M
  })

  it('calculates tax correctly for income between 18,000,000 and 40,000,000 yen', () => {
    expect(calculateNationalIncomeTax(18_000_000)).toBe(4_496_400) // 18M * 40% - 2.796M = 4.404M, + 2.1% = 4.49648M, rounded down to 4.4964M
    expect(calculateNationalIncomeTax(39_999_000)).toBe(13_480_800) // 39.999M * 40% - 2.796M = 13.2036M, + 2.1% = 13.48088M, rounded down to 13.4808M
  })

  it('calculates tax correctly for income above 40,000,000 yen', () => {
    expect(calculateNationalIncomeTax(40_000_000)).toBe(13_481_200) // 40M * 45% - 4.796M = 13.204M, + 2.1% = 13.48128M, rounded down to 13.4812M
    expect(calculateNationalIncomeTax(50_000_000)).toBe(18_075_700) // 50M * 45% - 4.796M = 17.704M, + 2.1% = 18.07578M, rounded down to 18.0757M
  })

  it('handles zero income correctly', () => {
    expect(calculateNationalIncomeTax(0)).toBe(0)
  })

  it('handles negative income correctly', () => {
    expect(calculateNationalIncomeTax(-1_000_000)).toBe(0) // Negative income is clamped to 0
  })
})
