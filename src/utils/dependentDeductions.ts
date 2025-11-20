/**
 * Calculation utilities for dependent-related tax deductions in Japan
 * 
 * References:
 * - 扶養控除 (Dependent Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 * - 配偶者控除 (Spouse Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * - 配偶者特別控除 (Spouse Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * - 特定親族特別控除 (Specific Relative Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 * - 障害者控除 (Disability Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
 */

import type { 
  Dependent, 
  DisabilityLevel,
} from '../types/dependents';
import {
  isEligibleForDependentDeduction,
  isSpecialDependent,
  isElderlyDependent,
  isEligibleForSpouseDeduction,
  isEligibleForSpouseSpecialDeduction,
  isEligibleForSpecificRelativeDeduction,
  calculateDependentTotalNetIncome,
} from '../types/dependents';

/**
 * Income thresholds for dependent deductions (2025 tax year - 令和7年)
 * 
 * These thresholds determine eligibility for various dependent deductions.
 * Updated December 1, 2025 per 令和7年度税制改正.
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm - 扶養控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm - 配偶者控除  
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm - 配偶者特別控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm - 特定親族特別控除
 */
export const DEPENDENT_INCOME_THRESHOLDS = {
  /**
   * Maximum total net income for dependent deduction eligibility (扶養控除)
   * Changed from 480,000 yen to 580,000 yen in 2025 tax reform
   */
  DEPENDENT_DEDUCTION_MAX: 580_000,
  
  /**
   * Maximum total net income for spouse deduction eligibility (配偶者控除)
   * Changed from 480,000 yen to 580,000 yen in 2025 tax reform
   */
  SPOUSE_DEDUCTION_MAX: 580_000,
  
  /**
   * Maximum total net income for spouse special deduction eligibility (配偶者特別控除)
   * Upper limit remains at 1,330,000 yen (no change in 2025)
   */
  SPOUSE_SPECIAL_DEDUCTION_MAX: 1_330_000,
  
  /**
   * Maximum total net income for specific relative special deduction (特定親族特別控除)
   * Upper limit is 1,230,000 yen (123万円)
   * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
   */
  SPECIFIC_RELATIVE_DEDUCTION_MAX: 1_230_000,
} as const;

/**
 * Bracket thresholds for spouse special deduction (配偶者特別控除)
 * These define the income ranges for different deduction amounts.
 * 
 * For 2025 tax year, the lower bound starts at 58万円超 (above SPOUSE_DEDUCTION_MAX).
 * Brackets remain at traditional values: 95万円, 100万円, 105万円, etc.
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 */
export const SPOUSE_SPECIAL_DEDUCTION_BRACKETS = {
  BRACKET_95: 950_000,
  BRACKET_100: 1_000_000,
  BRACKET_105: 1_050_000,
  BRACKET_110: 1_100_000,
  BRACKET_115: 1_150_000,
  BRACKET_120: 1_200_000,
  BRACKET_125: 1_250_000,
  BRACKET_130: 1_300_000,
} as const;

/**
 * Bracket thresholds for specific relative special deduction (特定親族特別控除)
 * These define the income ranges for different deduction amounts for age 19-23 dependents.
 * 
 * For 2025 tax year, the lower bound starts at 58万円超 (above DEPENDENT_DEDUCTION_MAX).
 * Upper limit is 123万円 (different from spouse special deduction's 133万円).
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */
export const SPECIFIC_RELATIVE_DEDUCTION_BRACKETS = {
  BRACKET_85: 850_000,
  BRACKET_90: 900_000,
  BRACKET_95: 950_000,
  BRACKET_100: 1_000_000,
  BRACKET_105: 1_050_000,
  BRACKET_110: 1_100_000,
  BRACKET_115: 1_150_000,
  BRACKET_120: 1_200_000,
  BRACKET_123: 1_230_000,
} as const;

/**
 * Deduction amounts for national income tax (国税)
 */
export const NATIONAL_TAX_DEDUCTIONS = {
  // 扶養控除 (Dependent Deduction)
  GENERAL_DEPENDENT: 380_000, // 一般の控除対象扶養親族
  SPECIAL_DEPENDENT: 630_000, // 特定扶養親族 (age 19-22)
  ELDERLY_DEPENDENT: 480_000, // 老人扶養親族 (age 70+)
  ELDERLY_COHABITING: 580_000, // 同居老親等 (age 70+, cohabiting parent/grandparent)
  
  // 配偶者控除 (Spouse Deduction) - assumes taxpayer income ≤ 9,000,000
  SPOUSE: 380_000, // 配偶者控除
  ELDERLY_SPOUSE: 480_000, // 老人配偶者控除 (age 70+)
  
  // 特定親族特別控除 (Specific Relative Special Deduction) - age 19-23, income 58-123万円 (2025 reform)
  SPECIFIC_RELATIVE_58TO85: 630_000,
  SPECIFIC_RELATIVE_85TO90: 610_000,
  SPECIFIC_RELATIVE_90TO95: 510_000,
  SPECIFIC_RELATIVE_95TO100: 410_000,
  SPECIFIC_RELATIVE_100TO105: 310_000,
  SPECIFIC_RELATIVE_105TO110: 210_000,
  SPECIFIC_RELATIVE_110TO115: 110_000,
  SPECIFIC_RELATIVE_115TO120: 60_000,
  SPECIFIC_RELATIVE_120TO123: 30_000,
  
  // 障害者控除 (Disability Deduction)
  DISABILITY_REGULAR: 270_000, // 一般の障害者
  DISABILITY_SPECIAL: 400_000, // 特別障害者
  DISABILITY_SPECIAL_COHABITING: 750_000, // 同居特別障害者
} as const;

/**
 * Deduction amounts for residence tax (住民税)
 * These are typically 1万円 less than national tax amounts
 */
export const RESIDENCE_TAX_DEDUCTIONS = {
  // 扶養控除
  GENERAL_DEPENDENT: 330_000,
  SPECIAL_DEPENDENT: 450_000, // age 19-22
  ELDERLY_DEPENDENT: 380_000, // age 70+
  ELDERLY_COHABITING: 450_000, // age 70+, cohabiting parent/grandparent
  
  // 配偶者控除
  SPOUSE: 330_000,
  ELDERLY_SPOUSE: 380_000, // age 70+
  
  // 特定親族特別控除
  // https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/seido/8zeiseikaisei.html
  SPECIFIC_RELATIVE_58TO85: 450_000,
  SPECIFIC_RELATIVE_85TO90: 450_000,
  SPECIFIC_RELATIVE_90TO95: 450_000,
  SPECIFIC_RELATIVE_95TO100: 410_000,
  SPECIFIC_RELATIVE_100TO105: 310_000,
  SPECIFIC_RELATIVE_105TO110: 210_000,
  SPECIFIC_RELATIVE_110TO115: 110_000,
  SPECIFIC_RELATIVE_115TO120: 60_000,
  SPECIFIC_RELATIVE_120TO123: 30_000,
  
  // 障害者控除
  DISABILITY_REGULAR: 260_000,
  DISABILITY_SPECIAL: 300_000,
  DISABILITY_SPECIAL_COHABITING: 530_000,
} as const;

/**
 * Results of dependent deduction calculations
 */
export interface DependentDeductionResults {
  // National income tax deductions
  nationalTax: {
    dependentDeduction: number; // 扶養控除
    spouseDeduction: number; // 配偶者控除
    spouseSpecialDeduction: number; // 配偶者特別控除
    specificRelativeDeduction: number; // 特定親族特別控除
    disabilityDeduction: number; // 障害者控除
    total: number;
  };
  
  // Residence tax deductions
  residenceTax: {
    dependentDeduction: number;
    spouseDeduction: number;
    spouseSpecialDeduction: number;
    specificRelativeDeduction: number;
    disabilityDeduction: number;
    total: number;
  };
  
  // Breakdown by dependent
  breakdown: DependentDeductionBreakdown[];
}

/**
 * Deduction type constants to ensure consistency across the codebase
 */
export const DEDUCTION_TYPES = {
  SPOUSE: 'Spouse',
  SPOUSE_SPECIAL: 'Spouse Special',
  DEPENDENT: 'Dependent',
  SPECIAL_DEPENDENT: 'Special Dependent',
  ELDERLY_DEPENDENT: 'Elderly Dependent',
  GENERAL_DEPENDENT: 'General Dependent',
  SPECIFIC_RELATIVE_SPECIAL: 'Specific Relative Special',
  NOT_ELIGIBLE: 'Not Eligible',
} as const;

export type DeductionType = typeof DEDUCTION_TYPES[keyof typeof DEDUCTION_TYPES];

/**
 * Represents the breakdown of deductions for a single dependent
 */
export interface DependentDeductionBreakdown {
  dependent: Dependent;
  nationalTaxAmount: number;
  residenceTaxAmount: number;
  deductionType: DeductionType | '';
  notes: string[];
}

/**
 * Get disability deduction amount for a given disability level
 * @param disability - The disability level
 * @param isCohabiting - Whether the dependent lives with the taxpayer
 * @param forResidenceTax - Whether this is for residence tax (vs national tax)
 */
export function getDisabilityDeduction(
  disability: DisabilityLevel, 
  isCohabiting: boolean,
  forResidenceTax: boolean
): number {
  if (disability === 'none') {
    return 0;
  }
  
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  switch (disability) {
    case 'regular':
      return deductions.DISABILITY_REGULAR;
    case 'special':
      // Special disability with cohabitation gets higher deduction
      return isCohabiting 
        ? deductions.DISABILITY_SPECIAL_COHABITING 
        : deductions.DISABILITY_SPECIAL;
    default:
      return 0;
  }
}

/**
 * Taxpayer income phase-out table for spouse deduction (配偶者控除)
 * Based on official tables from NTA and local government sources.
 * 
 * National Tax (income tax):
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * 
 * | Taxpayer Income    | Regular Spouse | Elderly Spouse (70+) |
 * |--------------------|----------------|----------------------|
 * | ≤900万円           | 38万円         | 48万円               |
 * | 900万円超950万円以下 | 26万円         | 32万円               |
 * | 950万円超1,000万円以下| 13万円        | 16万円               |
 * 
 * Residence Tax:
 * https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
 * 
 * | Taxpayer Income    | Regular Spouse | Elderly Spouse (70+) |
 * |--------------------|----------------|----------------------|
 * | ≤900万円           | 33万円         | 38万円               |
 * | 900万円超950万円以下 | 22万円         | 26万円               |
 * | 950万円超1,000万円以下| 11万円        | 13万円               |
 */
const SPOUSE_DEDUCTION_PHASE_OUT = {
  // National tax amounts by taxpayer income bracket
  NATIONAL: {
    REGULAR: {
      UNDER_900: 380_000,    // ≤900万円
      BRACKET_900_950: 260_000,   // 900万円超950万円以下
      BRACKET_950_1000: 130_000,  // 950万円超1,000万円以下
    },
    ELDERLY: {
      UNDER_900: 480_000,    // ≤900万円
      BRACKET_900_950: 320_000,   // 900万円超950万円以下
      BRACKET_950_1000: 160_000,  // 950万円超1,000万円以下
    },
  },
  // Residence tax amounts by taxpayer income bracket
  RESIDENCE: {
    REGULAR: {
      UNDER_900: 330_000,    // ≤900万円
      BRACKET_900_950: 220_000,   // 900万円超950万円以下
      BRACKET_950_1000: 110_000,  // 950万円超1,000万円以下
    },
    ELDERLY: {
      UNDER_900: 380_000,    // ≤900万円
      BRACKET_900_950: 260_000,   // 900万円超950万円以下
      BRACKET_950_1000: 130_000,  // 950万円超1,000万円以下
    },
  },
} as const;

/**
 * Get spouse deduction amount based on age and taxpayer income
 * Spouse deduction applies when spouse income is ≤ 58万円 (changed from 48万円 in 2025 tax reform)
 * 
 * The deduction amount phases out based on taxpayer's total net income:
 * - ≤ 9,000,000: Full amount
 * - 9,000,001 - 9,500,000: Reduced amount
 * - 9,500,001 - 10,000,000: Further reduced amount
 * - > 10,000,000: No deduction (0)
 * 
 * @param isElderly - Whether spouse is 70+ years old
 * @param forResidenceTax - Whether calculating for residence tax (vs national tax)
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額)
 * @returns Spouse deduction amount
 * 
 * @see SPOUSE_DEDUCTION_PHASE_OUT for official source references and exact amounts
 */
export function getSpouseDeduction(isElderly: boolean, forResidenceTax: boolean, taxpayerNetIncome: number): number {
  // No spouse deduction if taxpayer income exceeds 10,000,000
  if (taxpayerNetIncome > 10_000_000) {
    return 0;
  }
  
  // Select the appropriate table based on tax type and spouse age
  const taxTypeTable = forResidenceTax ? SPOUSE_DEDUCTION_PHASE_OUT.RESIDENCE : SPOUSE_DEDUCTION_PHASE_OUT.NATIONAL;
  const ageTable = isElderly ? taxTypeTable.ELDERLY : taxTypeTable.REGULAR;
  
  // Return amount based on taxpayer income bracket
  if (taxpayerNetIncome <= 9_000_000) {
    return ageTable.UNDER_900;
  } else if (taxpayerNetIncome <= 9_500_000) {
    return ageTable.BRACKET_900_950;
  } else {
    return ageTable.BRACKET_950_1000;
  }
}

/**
 * Spouse special deduction brackets and amounts
 * 
 * National Tax: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * Residence Tax: https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
 * 
 * The deduction amounts are legislated values from the tax tables, not calculated ratios.
 * National tax and residence tax have different bracket structures and phase-out patterns.
 * 
 * Each entry specifies:
 * - minIncome: Lower bound of spouse income bracket (exclusive, in yen)
 * - maxIncome: Upper bound of spouse income bracket (inclusive, in yen)
 * - amounts: Deduction amounts for each taxpayer income level
 */
const SPOUSE_SPECIAL_DEDUCTION_TABLE = {
  NATIONAL: [
    { minIncome: 580_000, maxIncome: 950_000, amounts: { under900: 380_000, bracket900_950: 260_000, bracket950_1000: 130_000 } },
    { minIncome: 950_000, maxIncome: 1_000_000, amounts: { under900: 360_000, bracket900_950: 240_000, bracket950_1000: 120_000 } },
    { minIncome: 1_000_000, maxIncome: 1_050_000, amounts: { under900: 310_000, bracket900_950: 210_000, bracket950_1000: 110_000 } },
    { minIncome: 1_050_000, maxIncome: 1_100_000, amounts: { under900: 260_000, bracket900_950: 180_000, bracket950_1000: 90_000 } },
    { minIncome: 1_100_000, maxIncome: 1_150_000, amounts: { under900: 210_000, bracket900_950: 140_000, bracket950_1000: 70_000 } },
    { minIncome: 1_150_000, maxIncome: 1_200_000, amounts: { under900: 160_000, bracket900_950: 110_000, bracket950_1000: 60_000 } },
    { minIncome: 1_200_000, maxIncome: 1_250_000, amounts: { under900: 110_000, bracket900_950: 80_000, bracket950_1000: 40_000 } },
    { minIncome: 1_250_000, maxIncome: 1_300_000, amounts: { under900: 60_000, bracket900_950: 40_000, bracket950_1000: 20_000 } },
    { minIncome: 1_300_000, maxIncome: 1_330_000, amounts: { under900: 30_000, bracket900_950: 20_000, bracket950_1000: 10_000 } },
  ],
  RESIDENCE: [
    { minIncome: 580_000, maxIncome: 1_000_000, amounts: { under900: 330_000, bracket900_950: 220_000, bracket950_1000: 110_000 } },
    { minIncome: 1_000_000, maxIncome: 1_050_000, amounts: { under900: 310_000, bracket900_950: 210_000, bracket950_1000: 110_000 } },
    { minIncome: 1_050_000, maxIncome: 1_100_000, amounts: { under900: 260_000, bracket900_950: 180_000, bracket950_1000: 90_000 } },
    { minIncome: 1_100_000, maxIncome: 1_150_000, amounts: { under900: 210_000, bracket900_950: 140_000, bracket950_1000: 70_000 } },
    { minIncome: 1_150_000, maxIncome: 1_200_000, amounts: { under900: 160_000, bracket900_950: 110_000, bracket950_1000: 60_000 } },
    { minIncome: 1_200_000, maxIncome: 1_250_000, amounts: { under900: 110_000, bracket900_950: 80_000, bracket950_1000: 40_000 } },
    { minIncome: 1_250_000, maxIncome: 1_300_000, amounts: { under900: 60_000, bracket900_950: 40_000, bracket950_1000: 20_000 } },
    { minIncome: 1_300_000, maxIncome: 1_330_000, amounts: { under900: 30_000, bracket900_950: 20_000, bracket950_1000: 10_000 } },
  ],
} as const;

/**
 * Get spouse special deduction amount based on spouse's total net income and taxpayer's income
 * Spouse special deduction applies when spouse income is between 58万円 and 133万円 (2025 tax reform)
 * 
 * The deduction amount varies by both spouse income (in brackets) and taxpayer income.
 * Uses official NTA table values which don't follow a simple mathematical formula.
 * 
 * @param spouseNetIncome - Spouse's total net income
 * @param forResidenceTax - Whether calculating for residence tax (vs national tax)
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額)
 * @returns Spouse special deduction amount
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 */
export function getSpouseSpecialDeduction(spouseNetIncome: number, forResidenceTax: boolean, taxpayerNetIncome: number): number {
  // No deduction if taxpayer income exceeds 10,000,000
  if (taxpayerNetIncome > 10_000_000) {
    return 0;
  }
  
  // Must be in spouse special deduction income range
  if (spouseNetIncome <= DEPENDENT_INCOME_THRESHOLDS.SPOUSE_DEDUCTION_MAX || 
      spouseNetIncome > DEPENDENT_INCOME_THRESHOLDS.SPOUSE_SPECIAL_DEDUCTION_MAX) {
    return 0;
  }
  
  // Select the appropriate table (national or residence tax)
  const table = forResidenceTax ? SPOUSE_SPECIAL_DEDUCTION_TABLE.RESIDENCE : SPOUSE_SPECIAL_DEDUCTION_TABLE.NATIONAL;
  
  // Find the bracket that matches the spouse's income
  const bracket = table.find(b => spouseNetIncome > b.minIncome && spouseNetIncome <= b.maxIncome);
  
  if (!bracket) {
    return 0;
  }
  
  // Return the amount based on taxpayer's income level
  if (taxpayerNetIncome <= 9_000_000) {
    return bracket.amounts.under900;
  } else if (taxpayerNetIncome <= 9_500_000) {
    return bracket.amounts.bracket900_950;
  } else {
    return bracket.amounts.bracket950_1000;
  }
}

/**
 * Get specific relative special deduction amount based on actual total net income
 * Applies to age 19-22 dependents with income between 58万円 and 123万円 (2025 tax reform)
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */
export function getSpecificRelativeDeduction(totalNetIncome: number, forResidenceTax: boolean): number {
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // Specific relative special deduction brackets (all values in yen)
  if (totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.DEPENDENT_DEDUCTION_MAX || 
      totalNetIncome > DEPENDENT_INCOME_THRESHOLDS.SPECIFIC_RELATIVE_DEDUCTION_MAX) {
    return 0;
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_85) {
    return deductions.SPECIFIC_RELATIVE_58TO85; // 58万円超～85万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_90) {
    return deductions.SPECIFIC_RELATIVE_85TO90; // 85万円超～90万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_95) {
    return deductions.SPECIFIC_RELATIVE_90TO95; // 90万円超～95万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_100) {
    return deductions.SPECIFIC_RELATIVE_95TO100; // 95万円超～100万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_105) {
    return deductions.SPECIFIC_RELATIVE_100TO105; // 100万円超～105万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_110) {
    return deductions.SPECIFIC_RELATIVE_105TO110; // 105万円超～110万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_115) {
    return deductions.SPECIFIC_RELATIVE_110TO115; // 110万円超～115万円以下
  } else if (totalNetIncome <= SPECIFIC_RELATIVE_DEDUCTION_BRACKETS.BRACKET_120) {
    return deductions.SPECIFIC_RELATIVE_115TO120; // 115万円超～120万円以下
  } else {
    return deductions.SPECIFIC_RELATIVE_120TO123; // 120万円超～123万円以下
  }
}

/**
 * Get dependent deduction amount based on age category and relationship
 * Used for preview before dependent is fully created
 */
export function getDependentDeduction(
  ageCategory: string,
  relationship: string,
  isCohabiting: boolean,
  forResidenceTax: boolean
): number {
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // Check for special dependent (age 19-22)
  if (ageCategory === '19to22') {
    return deductions.SPECIAL_DEPENDENT;
  }
  
  // Check for elderly dependent (age 70+)
  if (ageCategory === '70plus') {
    // Additional deduction if cohabiting parent or grandparent
    if (isCohabiting && relationship === 'parent') {
      return deductions.ELDERLY_COHABITING;
    }
    return deductions.ELDERLY_DEPENDENT;
  }
  
  // General dependent deduction
  return deductions.GENERAL_DEPENDENT;
}

/**
 * Calculate dependent deduction for a single dependent (excluding spouse)
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 */
function calculateDependentDeduction(dependent: Dependent, forResidenceTax: boolean): number {
  if (!isEligibleForDependentDeduction(dependent)) {
    return 0;
  }
  
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // Check for special dependent (age 19-22)
  if (isSpecialDependent(dependent)) {
    return deductions.SPECIAL_DEPENDENT;
  }
  
  // Check for elderly dependent (age 70+)
  if (isElderlyDependent(dependent)) {
    // Additional deduction if cohabiting parent or grandparent
    if (dependent.isCohabiting && (dependent.relationship === 'parent')) {
      return deductions.ELDERLY_COHABITING;
    }
    return deductions.ELDERLY_DEPENDENT;
  }
  
  // General dependent deduction
  return deductions.GENERAL_DEPENDENT;
}

/**
 * Calculate spouse deduction
 */
function calculateSpouseDeduction(dependent: Dependent, forResidenceTax: boolean, taxpayerNetIncome: number): number {
  if (!isEligibleForSpouseDeduction(dependent)) {
    return 0;
  }
  
  if (dependent.relationship !== 'spouse') {
    return 0;
  }
  
  const isElderly = dependent.ageCategory === '70plus';
  return getSpouseDeduction(isElderly, forResidenceTax, taxpayerNetIncome);
}

/**
 * Calculate all dependent-related deductions
 * 
 * @param dependents - Array of dependents
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額), used for spouse deduction phase-out
 * @returns Detailed breakdown of all deductions
 * 
 * Spouse deductions (both regular and special) are reduced based on taxpayer income:
 * - ≤ 9,000,000: Full amounts
 * - 9,000,001 - 9,500,000: Reduced amounts
 * - 9,500,001 - 10,000,000: Further reduced amounts  
 * - > 10,000,000: No spouse deductions
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 */
export function calculateDependentDeductions(
  dependents: Dependent[],
  taxpayerNetIncome: number = 0
): DependentDeductionResults {
  const results: DependentDeductionResults = {
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
  
  // Process each dependent
  for (const dependent of dependents) {
    const breakdown: DependentDeductionBreakdown = {
      dependent,
      nationalTaxAmount: 0,
      residenceTaxAmount: 0,
      deductionType: '',
      notes: [],
    };
    
    // Calculate disability deduction (applies to all dependents regardless of other status)
    if (dependent.disability !== 'none') {
      const natDisability = getDisabilityDeduction(dependent.disability, dependent.isCohabiting, false);
      const resDisability = getDisabilityDeduction(dependent.disability, dependent.isCohabiting, true);
      
      results.nationalTax.disabilityDeduction += natDisability;
      results.residenceTax.disabilityDeduction += resDisability;
      
      breakdown.nationalTaxAmount += natDisability;
      breakdown.residenceTaxAmount += resDisability;
      
      // Build disability note with cohabiting info if special disability
      let disabilityNote = `Disability deduction (${dependent.disability})`;
      if (dependent.disability === 'special' && dependent.isCohabiting) {
        disabilityNote += ' - cohabiting';
      }
      breakdown.notes.push(disabilityNote);
    }
    
    // Spouse deductions
    if (dependent.relationship === 'spouse') {
      if (isEligibleForSpouseDeduction(dependent)) {
        const natSpouse = calculateSpouseDeduction(dependent, false, taxpayerNetIncome);
        const resSpouse = calculateSpouseDeduction(dependent, true, taxpayerNetIncome);
        
        results.nationalTax.spouseDeduction += natSpouse;
        results.residenceTax.spouseDeduction += resSpouse;
        
        breakdown.nationalTaxAmount += natSpouse;
        breakdown.residenceTaxAmount += resSpouse;
        breakdown.deductionType = DEDUCTION_TYPES.SPOUSE;
        breakdown.notes.push(dependent.ageCategory === '70plus' ? 'Elderly spouse' : 'Spouse deduction');
      } else if (isEligibleForSpouseSpecialDeduction(dependent)) {
        const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
        const natSpouseSpecial = getSpouseSpecialDeduction(totalNetIncome, false, taxpayerNetIncome);
        const resSpouseSpecial = getSpouseSpecialDeduction(totalNetIncome, true, taxpayerNetIncome);
        
        results.nationalTax.spouseSpecialDeduction += natSpouseSpecial;
        results.residenceTax.spouseSpecialDeduction += resSpouseSpecial;
        
        breakdown.nationalTaxAmount += natSpouseSpecial;
        breakdown.residenceTaxAmount += resSpouseSpecial;
        breakdown.deductionType = DEDUCTION_TYPES.SPOUSE_SPECIAL;
        breakdown.notes.push('Spouse special deduction (income 58-133万円)');
      }
    }
    // Specific relative special deduction (age 19-22, income 58-123万円)
    else if (isEligibleForSpecificRelativeDeduction(dependent)) {
      const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
      const natSpecific = getSpecificRelativeDeduction(totalNetIncome, false);
      const resSpecific = getSpecificRelativeDeduction(totalNetIncome, true);
      
      results.nationalTax.specificRelativeDeduction += natSpecific;
      results.residenceTax.specificRelativeDeduction += resSpecific;
      
      breakdown.nationalTaxAmount += natSpecific;
      breakdown.residenceTaxAmount += resSpecific;
      breakdown.deductionType = DEDUCTION_TYPES.SPECIFIC_RELATIVE_SPECIAL;
      breakdown.notes.push('Age 19-22 with income 58-123万円');
    }
    // Standard dependent deduction
    else if (isEligibleForDependentDeduction(dependent)) {
      const natDependent = calculateDependentDeduction(dependent, false);
      const resDependent = calculateDependentDeduction(dependent, true);
      
      results.nationalTax.dependentDeduction += natDependent;
      results.residenceTax.dependentDeduction += resDependent;
      
      breakdown.nationalTaxAmount += natDependent;
      breakdown.residenceTaxAmount += resDependent;
      
      if (isSpecialDependent(dependent)) {
        breakdown.deductionType = DEDUCTION_TYPES.SPECIAL_DEPENDENT;
        breakdown.notes.push('Age 19-22 (Special dependent)');
      } else if (isElderlyDependent(dependent)) {
        breakdown.deductionType = DEDUCTION_TYPES.ELDERLY_DEPENDENT;
        if (dependent.isCohabiting && dependent.relationship === 'parent') {
          breakdown.notes.push('Age 70+ cohabiting parent');
        } else {
          breakdown.notes.push('Age 70+ elderly dependent');
        }
      } else {
        breakdown.deductionType = DEDUCTION_TYPES.GENERAL_DEPENDENT;
        breakdown.notes.push('General dependent');
      }
    } else {
      // Not eligible for any deduction (except disability which was already handled)
      if (dependent.disability === 'none') {
        breakdown.deductionType = DEDUCTION_TYPES.NOT_ELIGIBLE;
        breakdown.notes.push('Income exceeds threshold for deductions');
      }
    }
    
    results.breakdown.push(breakdown);
  }
  
  // Calculate totals
  results.nationalTax.total = 
    results.nationalTax.dependentDeduction +
    results.nationalTax.spouseDeduction +
    results.nationalTax.spouseSpecialDeduction +
    results.nationalTax.specificRelativeDeduction +
    results.nationalTax.disabilityDeduction;
    
  results.residenceTax.total = 
    results.residenceTax.dependentDeduction +
    results.residenceTax.spouseDeduction +
    results.residenceTax.spouseSpecialDeduction +
    results.residenceTax.specificRelativeDeduction +
    results.residenceTax.disabilityDeduction;
  
  return results;
}

/**
 * Get a human-readable summary of dependent deductions
 */
export function getDependentDeductionSummary(results: DependentDeductionResults): string {
  const parts: string[] = [];
  
  if (results.nationalTax.spouseDeduction > 0) {
    parts.push('Spouse deduction');
  }
  if (results.nationalTax.spouseSpecialDeduction > 0) {
    parts.push('Spouse special deduction');
  }
  if (results.nationalTax.dependentDeduction > 0) {
    const count = results.breakdown.filter(b => 
      b.deductionType === DEDUCTION_TYPES.SPECIAL_DEPENDENT ||
      b.deductionType === DEDUCTION_TYPES.ELDERLY_DEPENDENT ||
      b.deductionType === DEDUCTION_TYPES.GENERAL_DEPENDENT
    ).length;
    parts.push(`${count} dependent${count > 1 ? 's' : ''}`);
  }
  if (results.nationalTax.specificRelativeDeduction > 0) {
    const count = results.breakdown.filter(b => 
      b.deductionType === DEDUCTION_TYPES.SPECIFIC_RELATIVE_SPECIAL
    ).length;
    parts.push(`${count} specific relative${count > 1 ? 's' : ''}`);
  }
  if (results.nationalTax.disabilityDeduction > 0) {
    const count = results.breakdown.filter(b => 
      b.dependent.disability !== 'none'
    ).length;
    parts.push(`${count} disability deduction${count > 1 ? 's' : ''}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No dependent deductions';
}
