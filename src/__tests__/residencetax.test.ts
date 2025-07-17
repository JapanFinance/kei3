import { describe, expect, it } from "vitest"
import { calculateResidenceTax, calculateResidenceTaxBasicDeduction } from "../utils/residenceTax"

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
    expect(calculateResidenceTax(5_000_000, 1_000_000).totalResidenceTax).toBe(359_500) // (5M - 1M - 430K) * 0.1 + 5000
  })

  it('calculates tax correctly for income with partial basic deduction', () => {
    // Example: 24.2M income, 1M social insurance
    expect(calculateResidenceTax(24_200_000, 1_000_000).totalResidenceTax).toBe(2_293_500) // (24.2M - 1M - 290K) * 0.1 + 5000
  })

  it('calculates tax correctly for income with minimum basic deduction', () => {
    // Example: 24.7M income, 1M social insurance
    expect(calculateResidenceTax(24_700_000, 1_000_000).totalResidenceTax).toBe(2_357_500) // (24.7M - 1M - 150K) * 0.1 + 5000
  })

  it('calculates tax correctly for income with no basic deduction', () => {
    // Example: 26M income, 1M social insurance
    expect(calculateResidenceTax(26_000_000, 1_000_000).totalResidenceTax).toBe(2_505_000) // (26M - 1M - 0) * 0.1 + 5000
  })

  it('returns minimum tax amount when deductions exceed net income', () => {
    // Example: 1M income, 2M social insurance
    expect(calculateResidenceTax(1_000_000, 2_000_000).totalResidenceTax).toBe(5_000) // Only 5000 yen 均等割 when taxable income is 0
  })

  it('returns 0 yen when net income is 450,000 yen or less due to 非課税制度', () => {
    expect(calculateResidenceTax(449_999, 0).totalResidenceTax).toBe(0)
    expect(calculateResidenceTax(450_000, 0).totalResidenceTax).toBe(0)
  })

  it('returns 5000 yen 均等割 when taxable income is 0', () => {
    expect(calculateResidenceTax(450_001, 20_001).totalResidenceTax).toBe(5_000)
    expect(calculateResidenceTax(1_000_000, 600_000).totalResidenceTax).toBe(5_000)
  })

  it('handles zero income correctly', () => {
    expect(calculateResidenceTax(0, 0).totalResidenceTax).toBe(0)
  })

  it('handles negative income correctly', () => {
    expect(calculateResidenceTax(-1_000_000, 0).totalResidenceTax).toBe(0)
  })
})

describe('calculateResidenceTax - 調整控除額 (Adjustment Credit)', () => {
  it('calculates adjustment credit correctly for taxable income <= 2M yen', () => {
    // 3M gross employment income case
    // Net income: 2,020,000, Social insurance: 450,000, Basic deduction: 430,000
    // Taxable income: 1,140,000 (rounded down from 1,140,000)
    // Should use: Math.min(50,000 * 0.05, 1,140,000 * 0.05) = Math.min(2,500, 57,000) = 2,500
    const result = calculateResidenceTax(2_020_000, 450_000);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit correctly for taxable income > 2M yen', () => {
    // 5M gross employment income case
    // Net income: 3,640,000, Social insurance: ~700,000, Basic deduction: 430,000  
    // Taxable income: 2,510,000 (rounded down)
    // Should use: Math.max((50,000 - (2,510,000 - 2,000,000)) * 0.05, 50,000 * 0.05)
    //           = Math.max((50,000 - 510,000) * 0.05, 2,500)
    //           = Math.max(-23,000, 2,500) = 2,500
    const result = calculateResidenceTax(3_640_000, 700_000);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit as zero for netIncome > 25M yen', () => {
    // 30M gross employment income case
    // Net income: 28,050,000 (30M - 1.95M max deduction)
    // Should have zero adjustment credit because netIncome > 25M
    const result = calculateResidenceTax(28_050_000, 2_000_000);
    expect(result.city.cityAdjustmentCredit).toBe(0);
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(0);
  })

  it('calculates adjustment credit correctly at the 2M taxable income boundary', () => {
    // Test case where taxable income is exactly 2M
    // Net income: 2,860,000, Social insurance: 430,000, Basic deduction: 430,000
    // Taxable income: 2,000,000 (exactly at boundary)
    // Should use: Math.min(50,000 * 0.05, 2,000,000 * 0.05) = Math.min(2,500, 100,000) = 2,500
    const result = calculateResidenceTax(2_860_000, 430_000);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })

  it('calculates adjustment credit correctly just over 2M taxable income', () => {
    // Test case where taxable income is just over 2M
    // Net income: 2,861,000, Social insurance: 430,000, Basic deduction: 430,000
    // Taxable income: 2,001,000 (just over boundary, rounded down to 2,001,000)
    // Should use: Math.max((50,000 - (2,001,000 - 2,000,000)) * 0.05, 50,000 * 0.05)
    //           = Math.max((50,000 - 1,000) * 0.05, 2,500)
    //           = Math.max(2,450, 2,500) = 2,500
    const result = calculateResidenceTax(2_861_000, 430_000);
    expect(result.city.cityAdjustmentCredit).toBe(2_500 * 0.6); // 1,500
    expect(result.prefecture.prefecturalAdjustmentCredit).toBe(2_500 * 0.4); // 1,000
  })
})
