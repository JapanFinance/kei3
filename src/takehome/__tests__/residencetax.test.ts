// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest"
import { calculateResidenceTax, calculateResidenceTaxBasicDeduction, NON_TAXABLE_RESIDENCE_TAX_DETAIL } from "../utils/residenceTax"
import { calculateDependentDeductions } from "../utils/dependentDeductions"
import type { DependentDeductionResults, Dependent } from "../types/dependents"

/**
 * An empty dependent deduction result object with all values set to zero.
 * Useful for initialization or when no dependents exist.
 */
const EMPTY_DEPENDENT_DEDUCTIONS: DependentDeductionResults = {
  nationalTax: {
    dependentDeduction: 0,
    spouseDeduction: 0,
    spouseSpecialDeduction: 0,
    specificRelativeDeduction: 0,
    disabilityDeduction: 0,
    total: 0,
  },
  residenceTax: {
    dependentDeduction: 0,
    spouseDeduction: 0,
    spouseSpecialDeduction: 0,
    specificRelativeDeduction: 0,
    disabilityDeduction: 0,
    total: 0,
  },
  breakdown: [],
};

describe('calculateResidenceTaxBasicDeduction', () => {
  it('returns 430,000 yen for income up to 24,000,000 yen', () => {
    expect(calculateResidenceTaxBasicDeduction(0)).toBe(430_000)
    expect(calculateResidenceTaxBasicDeduction(10_000_000)).toBe(430_000)
    expect(calculateResidenceTaxBasicDeduction(24_000_000)).toBe(430_000)
  })

  it('returns 290,000 yen for income between 24,000,001 and 24,500,000 yen', () => {
    expect(calculateResidenceTaxBasicDeduction(24_000_001)).toBe(290_000)
    expect(calculateResidenceTaxBasicDeduction(24_500_000)).toBe(290_000)
  })

  it('returns 150,000 yen for income between 24,500,001 and 25,000,000 yen', () => {
    expect(calculateResidenceTaxBasicDeduction(24_500_001)).toBe(150_000)
    expect(calculateResidenceTaxBasicDeduction(25_000_000)).toBe(150_000)
  })

  it('returns 0 yen for income above 25,000,000 yen', () => {
    expect(calculateResidenceTaxBasicDeduction(25_000_001)).toBe(0)
    expect(calculateResidenceTaxBasicDeduction(30_000_000)).toBe(0)
  })

  it('handles negative income correctly', () => {
    expect(calculateResidenceTaxBasicDeduction(-1_000_000)).toBe(430_000)
  })
})

describe('calculateResidenceTax', () => {
  it('calculates tax correctly for income with full deductions', () => {
    // Example: 5M income, 1M social insurance
    // Taxable: (5M - 1M - 430K) = 3,570,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Adjustment credit: max((50K - (3.57M - 2M)) * 0.05, 50K * 0.05) = 2,500
    // Tax: 3,570,000 * 0.1 - 2,500 + 5,000 = 359,500
    expect(calculateResidenceTax(5_000_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(359_500)
  })

  it('calculates tax correctly for income with partial basic deduction', () => {
    // Example: 24.2M income, 1M social insurance
    // Taxable: (24.2M - 1M - 290K) = 22,910,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Adjustment credit: max((50K - (22.91M - 2M)) * 0.05, 50K * 0.05) = 2,500
    // Tax: 22,910,000 * 0.1 - 2,500 + 5,000 = 2,293,500
    expect(calculateResidenceTax(24_200_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(2_293_500)
  })

  it('calculates tax correctly for income with minimum basic deduction', () => {
    // Example: 24.7M income, 1M social insurance
    // Taxable: (24.7M - 1M - 150K) = 23,550,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Adjustment credit: max((50K - (23.55M - 2M)) * 0.05, 50K * 0.05) = 2,500
    // Tax: 23,550,000 * 0.1 - 2,500 + 5,000 = 2,357,500
    expect(calculateResidenceTax(24_700_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(2_357_500)
  })

  it('calculates tax correctly for income with no basic deduction', () => {
    // Example: 26M income, 1M social insurance
    expect(calculateResidenceTax(26_000_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(2_505_000) // (26M - 1M - 0) * 0.1 + 5000
  })

  it('returns minimum tax amount when deductions exceed net income', () => {
    // Example: 1M income, 2M social insurance
    expect(calculateResidenceTax(1_000_000, 2_000_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(5_000) // Only 5000 yen 均等割 when taxable income is 0
  })

  it('returns 0 yen when net income is 450,000 yen or less due to 非課税制度', () => {
    expect(calculateResidenceTax(449_999, 0, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(0)
    expect(calculateResidenceTax(450_000, 0, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(0)
  })

  it('returns 5000 yen 均等割 when taxable income is 0', () => {
    expect(calculateResidenceTax(450_001, 20_001, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(5_000)
    expect(calculateResidenceTax(1_000_000, 600_000, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(5_000)
  })

  it('handles zero income correctly', () => {
    expect(calculateResidenceTax(0, 0, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(0)
  })

  it('handles negative income correctly', () => {
    expect(calculateResidenceTax(-1_000_000, 0, EMPTY_DEPENDENT_DEDUCTIONS).totalResidenceTax).toBe(0)
  })
})

describe('calculateResidenceTax - 調整控除額 (Adjustment Credit)', () => {
  it('calculates adjustment credit correctly for taxable income <= 2M yen', () => {
    // Net income: 2,020,000, Social insurance: 450,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Taxable income: 2,020,000 - 450,000 - 430,000 = 1,140,000
    // Adjustment credit: Math.min(50,000 * 0.05, 1,140,000 * 0.05) = Math.min(2,500, 57,000) = 2,500
    const result = calculateResidenceTax(2_020_000, 450_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit correctly for taxable income > 2M yen', () => {
    // Net income: 3,640,000, Social insurance: ~700,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Taxable income: 3,640,000 - 700,000 - 430,000 = 2,510,000
    // Adjustment credit: Math.max((50,000 - (2,510,000 - 2,000,000)) * 0.05, 50,000 * 0.05)
    //                  = Math.max((50,000 - 510,000) * 0.05, 2,500)
    //                  = Math.max(-23,000, 2,500) = 2,500
    const result = calculateResidenceTax(3_640_000, 700_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit as zero for netIncome > 25M yen', () => {
    // Net income: 28,050,000, Social insurance: 2,000,000
    // Should have zero adjustment credit because netIncome > 25M (no basic deduction)
    const result = calculateResidenceTax(28_050_000, 2_000_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.city.cityAdjustmentCredit).toBe(0);
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(0);
  })

  it('calculates adjustment credit correctly at the 2M taxable income boundary', () => {
    // Net income: 2,860,000, Social insurance: 430,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Taxable income: 2,860,000 - 430,000 - 430,000 = 2,000,000 (exactly at boundary)
    // Adjustment credit: Math.min(50,000 * 0.05, 2,000,000 * 0.05) = Math.min(2,500, 100,000) = 2,500
    const result = calculateResidenceTax(2_860_000, 430_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit correctly just over 2M taxable income', () => {
    // Net income: 2,861,000, Social insurance: 430,000
    // Per Article 314-6: Basic deduction difference = 50,000 (fixed for income ≤ 25M)
    // Taxable income: 2,861,000 - 430,000 - 430,000 = 2,001,000 (just over boundary, rounded to 2,001,000)
    // Adjustment credit: Math.max((50,000 - (2,001,000 - 2,000,000)) * 0.05, 50,000 * 0.05)
    //                  = Math.max((50,000 - 1,000) * 0.05, 2,500)
    //                  = Math.max(2,450, 2,500) = 2,500
    const result = calculateResidenceTax(2_861_000, 430_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })
})

describe('Residence Tax - Non-Taxable Limit', () => {
  it('should be non-taxable for single person with income <= 450,000', () => {
    const result = calculateResidenceTax(450_000, 0, calculateDependentDeductions([]))
    expect(result).toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should be taxable for single person with income > 450,000', () => {
    const result = calculateResidenceTax(450_001, 0, calculateDependentDeductions([]))
    expect(result).not.toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should be non-taxable for person with 1 dependent (spouse) with income <= 1,010,000', () => {
    // Limit = 350k * (1+1) + 100k + 210k = 700k + 310k = 1,010,000
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([spouse])
    
    const result = calculateResidenceTax(1_010_000, 0, dependents)
    expect(result).toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should be taxable for person with 1 dependent (spouse) with income > 1,010,000', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([spouse])
    
    const result = calculateResidenceTax(1_010_001, 0, dependents)
    expect(result).not.toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })
  
  it('should count under 16 dependent for non-taxable limit', () => {
    // Limit = 350k * (1+1) + 100k + 210k = 1,010,000
    const child: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([child])
    
    const result = calculateResidenceTax(1_010_000, 0, dependents)
    expect(result).toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should be non-taxable for person with spouse and under 16 dependent (2 dependents) with income <= 1,360,000', () => {
    // Limit = 350k * (2+1) + 100k + 210k = 1,050k + 310k = 1,360,000
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const child: Dependent = {
      id: '2',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([spouse, child])
    
    const result = calculateResidenceTax(1_360_000, 0, dependents)
    expect(result).toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should be taxable for person with spouse and under 16 dependent (2 dependents) with income > 1,360,000', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const child: Dependent = {
      id: '2',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([spouse, child])
    
    const result = calculateResidenceTax(1_360_001, 0, dependents)
    expect(result).not.toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should NOT count spouse with income > 580,000 (Spouse Special Deduction) for non-taxable limit', () => {
    // Spouse with 1,000,000 income qualifies for Spouse Special Deduction but is NOT a "Same Livelihood Spouse"
    // So qualifiedDependentsCount should be 0.
    // Limit for single person = 450,000
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 1_000_000 },
    }
    const dependents = calculateDependentDeductions([spouse])
    
    // If spouse counted: Limit would be 350k*(1+1)+310k = 1,010,000 -> 500,000 would be non-taxable
    // If spouse NOT counted: Limit is 450,000 -> 500,000 is taxable
    
    const result = calculateResidenceTax(500_000, 0, dependents)
    expect(result).not.toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should count under 16 dependent even though deduction amount is 0', () => {
    // Under 16 dependent has 0 deduction, but counts for non-taxable limit
    // Limit = 350k*(1+1)+310k = 1,010,000
    const child: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([child])
    
    // Verify deduction is actually 0 first
    expect(dependents.residenceTax.dependentDeduction).toBe(0)
    
    // Should be non-taxable at 1,000,000
    const result = calculateResidenceTax(1_000_000, 0, dependents)
    expect(result).toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })

  it('should apply only per capita tax when income is between Per Capita Limit and Income Portion Limit', () => {
    // 1 dependent (spouse)
    // Per Capita Limit: 350k*(2)+100k+210k = 1,010,000
    // Income Levy Limit: 350k*(2)+100k+320k = 1,120,000
    
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: true,
      disability: 'none',
      income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
    }
    const dependents = calculateDependentDeductions([spouse])
    
    // Test income: 1,050,000 (Between 1,010,000 and 1,120,000)
    const result = calculateResidenceTax(1_050_000, 0, dependents)
    
    // Should have 0 income tax
    expect(result.city.cityIncomeTax).toBe(0)
    expect(result.prefecture.prefecturalIncomeTax).toBe(0)
    
    // But should have per capita tax (5,000 yen)
    expect(result.perCapitaTax).toBe(5_000)
    expect(result.totalResidenceTax).toBe(5_000)
    
    // And should NOT be the non-taxable object
    expect(result).not.toEqual(NON_TAXABLE_RESIDENCE_TAX_DETAIL)
  })
})

describe('calculateResidenceTax - Personal Deduction Difference', () => {
  it('returns correct personal deduction difference for income <= 25M', () => {
    const result = calculateResidenceTax(25_000_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.personalDeductionDifference).toBe(50_000);
  })

  it('returns correct personal deduction difference for income > 25M', () => {
    const result = calculateResidenceTax(26_000_000, 1_000_000, EMPTY_DEPENDENT_DEDUCTIONS);
    expect(result.personalDeductionDifference).toBe(50_000);
  })
})
