/**
 * Calculation utilities for dependent-related tax deductions in Japan
 * 
 * Income Tax References:
 * - 扶養控除 (Dependent Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 * - 配偶者控除 (Spouse Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * - 配偶者特別控除 (Spouse Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * - 特定親族特別控除 (Specific Relative Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 * - 障害者控除 (Disability Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
 * 
 * Residence Tax References:
 * - 住民税の人的控除 (Residence Tax Personal Deductions): https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
 * - 令和8年度住民税から適用される税制改正: https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/seido/8zeiseikaisei.html
 */

import type { 
  Dependent, 
  DisabilityLevel,
  DependentIncome,
  OtherDependent,
  DependentDeductionResults,
  DeductionAmount,
  DeductionType,
} from '../types/dependents';
import { DEDUCTION_TYPES } from '../types/dependents';
import { calculateNetEmploymentIncome } from './taxCalculations';

/**
 * Income thresholds for dependent deductions (2025 tax year - 令和7年)
 * 
 * These thresholds determine eligibility for various dependent deductions.
 * The amounts are inclusive, meaning the dependent can have income up to and including these values.
 * Updated December 1, 2025 per 令和7年度税制改正.
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm - 扶養控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm - 配偶者控除  
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm - 配偶者特別控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm - 特定親族特別控除
 */
const DEPENDENT_INCOME_THRESHOLDS = {
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
 * Calculate total net income (合計所得金額) for a dependent
 * This is used to determine eligibility for various dependent deductions
 */
export function calculateDependentTotalNetIncome(income: DependentIncome): number {
  const { grossEmploymentIncome, otherNetIncome } = income;
  
  // Calculate net employment income using employment income deduction formula
  const netEmploymentIncome = calculateNetEmploymentIncome(grossEmploymentIncome);
  
  // Total net income = net employment income + other net income
  return netEmploymentIncome + otherNetIncome;
}

/**
 * Check if dependent is eligible for Dependent Deduction (扶養控除).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 */
function isEligibleForDependentDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    // Spouse is a special case because of the spouse deduction and spouse special deduction.
    return false;
  }
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.DEPENDENT_DEDUCTION_MAX;
}

/**
 * Check if dependent is a special dependent (特定扶養親族)
 * Eligible for the Dependent Deduction and is age 19-22 on December 31st.
 * 控除対象扶養親族のうち、その年12月31日現在の年齢が19歳以上23歳未満の方をいいます。
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/yogo/senmon.htm#word9
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 */
function isSpecialDependent(dependent: Dependent): boolean {
  return isEligibleForDependentDeduction(dependent) && 
         (dependent as OtherDependent).ageCategory === '19to22';
}

/**
 * Check if dependent is an elderly dependent (老人扶養親族)
 * Eligible for the Dependent Deduction and is age 70+ on December 31st.
 * 控除対象扶養親族のうち、その年12月31日現在の年齢が70歳以上の方をいいます。
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/yogo/senmon.htm#word10
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 */
function isElderlyDependent(dependent: Dependent): boolean {
  return isEligibleForDependentDeduction(dependent) &&
         (dependent as OtherDependent).ageCategory === '70plus';
}

/**
 * Check if dependent is eligible for Spouse Deduction (配偶者控除).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 */
function isEligibleForSpouseDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.SPOUSE_DEDUCTION_MAX;
}

/**
 * Check if dependent is eligible for Spouse Special Deduction (配偶者特別控除).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 */
function isEligibleForSpouseSpecialDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome > DEPENDENT_INCOME_THRESHOLDS.SPOUSE_DEDUCTION_MAX && 
         totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.SPOUSE_SPECIAL_DEDUCTION_MAX;
}

/**
 * Check if dependent is eligible for Specific Relative Special Deduction (特定親族特別控除).
 * Age 19-22 (19歳以上23歳未満) on December 31st, not spouse.
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */
function isEligibleForSpecificRelativeSpecialDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  const otherDependent = dependent as OtherDependent;
  const ageCategory = otherDependent.ageCategory;
  
  // Only age 19-22 are eligible (19歳以上23歳未満)
  if (ageCategory !== '19to22') {
    return false;
  }
  
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome > DEPENDENT_INCOME_THRESHOLDS.DEPENDENT_DEDUCTION_MAX && 
         totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.SPECIFIC_RELATIVE_DEDUCTION_MAX;
}

/**
 * Bracket thresholds for specific relative special deduction (特定親族特別控除)
 * These define the income ranges for different deduction amounts for age 19-23 dependents.
 * 
 * For 2025 tax year, the lower bound starts at 58万円超 (above DEPENDENT_DEDUCTION_MAX).
 * Upper limit is 123万円 (different from spouse special deduction's 133万円).
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */
const SPECIFIC_RELATIVE_DEDUCTION_BRACKETS = {
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
const NATIONAL_TAX_DEDUCTIONS = {
  // 扶養控除 (Dependent Deduction) https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
  GENERAL_DEPENDENT: 380_000, // 一般の控除対象扶養親族
  SPECIAL_DEPENDENT: 630_000, // 特定扶養親族 (age 19-22)
  ELDERLY_DEPENDENT: 480_000, // 老人扶養親族 (age 70+)
  ELDERLY_COHABITING: 580_000, // 同居老親等 (age 70+, cohabiting parent/grandparent)
  
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
  
  // 障害者控除 (Disability Deduction) https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
  DISABILITY_REGULAR: 270_000, // 一般の障害者
  DISABILITY_SPECIAL: 400_000, // 特別障害者
  DISABILITY_SPECIAL_COHABITING: 750_000, // 同居特別障害者
} as const;

/**
 * Deduction amounts for residence tax (住民税)
 */
const RESIDENCE_TAX_DEDUCTIONS = {
  // 扶養控除 https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
  GENERAL_DEPENDENT: 330_000,
  SPECIAL_DEPENDENT: 450_000, // age 19-22
  ELDERLY_DEPENDENT: 380_000, // age 70+
  ELDERLY_COHABITING: 450_000, // age 70+, cohabiting parent/grandparent
  
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
  
  // 障害者控除 https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
  DISABILITY_REGULAR: 260_000,
  DISABILITY_SPECIAL: 300_000,
  DISABILITY_SPECIAL_COHABITING: 530_000,
} as const;



/**
 * Get disability deduction amount for a given disability level
 * @param disability - The disability level
 * @param isCohabiting - Whether the dependent lives with the taxpayer
 * @param forResidenceTax - Whether this is for residence tax (vs national tax)
 */
export function getDisabilityDeduction(
  disability: DisabilityLevel, 
  isCohabiting: boolean
): DeductionAmount {
  if (disability === 'none') {
    return { national: 0, residence: 0 };
  }
  
  const getAmount = (deductions: typeof NATIONAL_TAX_DEDUCTIONS | typeof RESIDENCE_TAX_DEDUCTIONS) => {
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
  };

  return {
    national: getAmount(NATIONAL_TAX_DEDUCTIONS),
    residence: getAmount(RESIDENCE_TAX_DEDUCTIONS)
  };
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
 * Get Spouse Special Deduction amount based on spouse's total net income and taxpayer's total net income.
 * Spouse Special Deduction applies when a spouse makes too much for the regular Spouse Deduction but below a threshold.
 * 
 * @param spouseNetIncome - Spouse's total net income (合計所得金額)
 * @param forResidenceTax - Whether calculating for residence tax (vs national tax)
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額)
 * @returns Spouse Special Deduction amount
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 */
function getSpouseSpecialDeduction(spouseNetIncome: number, taxpayerNetIncome: number): DeductionAmount {
  // No deduction if taxpayer income exceeds 10,000,000
  if (taxpayerNetIncome > 10_000_000) {
    return { national: 0, residence: 0 };
  }
  
  // Must be in spouse special deduction income range
  if (spouseNetIncome <= DEPENDENT_INCOME_THRESHOLDS.SPOUSE_DEDUCTION_MAX || 
      spouseNetIncome > DEPENDENT_INCOME_THRESHOLDS.SPOUSE_SPECIAL_DEDUCTION_MAX) {
    return { national: 0, residence: 0 };
  }
  
  const getAmount = (table: typeof SPOUSE_SPECIAL_DEDUCTION_TABLE.NATIONAL | typeof SPOUSE_SPECIAL_DEDUCTION_TABLE.RESIDENCE) => {
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
  };

  return {
    national: getAmount(SPOUSE_SPECIAL_DEDUCTION_TABLE.NATIONAL),
    residence: getAmount(SPOUSE_SPECIAL_DEDUCTION_TABLE.RESIDENCE)
  };
}

/**
 * Get specific relative special deduction amount based on actual total net income
 * Applies to age 19-22 dependents with income between 58万円 and 123万円 (2025 tax reform)
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */
function getSpecificRelativeDeduction(totalNetIncome: number): DeductionAmount {
  const getAmount = (deductions: typeof NATIONAL_TAX_DEDUCTIONS | typeof RESIDENCE_TAX_DEDUCTIONS) => {
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
  };

  return {
    national: getAmount(NATIONAL_TAX_DEDUCTIONS),
    residence: getAmount(RESIDENCE_TAX_DEDUCTIONS)
  };
}

/**
 * Calculate Dependent Deduction (扶養控除) for a dependent (excluding spouse)
 * @param dependent - The dependent to calculate deduction for
 * @returns Deduction amounts for national and residence tax
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 */
function calculateDependentDeduction(dependent: Dependent): DeductionAmount {
  if (!isEligibleForDependentDeduction(dependent)) {
    return { national: 0, residence: 0 };
  }
  
  const getAmount = (deductions: typeof NATIONAL_TAX_DEDUCTIONS | typeof RESIDENCE_TAX_DEDUCTIONS) => {
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
  };

  return {
    national: getAmount(NATIONAL_TAX_DEDUCTIONS),
    residence: getAmount(RESIDENCE_TAX_DEDUCTIONS)
  };
}

/**
 * Calculate Spouse Deduction (配偶者控除) for a spouse dependent
 * @param dependent - The spouse dependent
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額), used for phase-out calculation
 * @returns Deduction amounts for national and residence tax
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 */
function calculateSpouseDeduction(dependent: Dependent, taxpayerNetIncome: number): DeductionAmount {
  if (!isEligibleForSpouseDeduction(dependent) || taxpayerNetIncome > 10_000_000) {
    return { national: 0, residence: 0 };
  }

  const isElderly = dependent.ageCategory === '70plus';
  
  const getAmount = (taxTypeTable: typeof SPOUSE_DEDUCTION_PHASE_OUT.NATIONAL | typeof SPOUSE_DEDUCTION_PHASE_OUT.RESIDENCE) => {
    const ageTable = isElderly ? taxTypeTable.ELDERLY : taxTypeTable.REGULAR;
    
    // Return amount based on taxpayer income bracket
    if (taxpayerNetIncome <= 9_000_000) {
      return ageTable.UNDER_900;
    } else if (taxpayerNetIncome <= 9_500_000) {
      return ageTable.BRACKET_900_950;
    } else {
      return ageTable.BRACKET_950_1000;
    }
  };

  return {
    national: getAmount(SPOUSE_DEDUCTION_PHASE_OUT.NATIONAL),
    residence: getAmount(SPOUSE_DEDUCTION_PHASE_OUT.RESIDENCE)
  };
}

/**
 * Calculate all dependent-related deductions
 * 
 * @param dependents - user input array of dependents
 * @param taxpayerNetIncome - Taxpayer's total net income (合計所得金額)
 * @returns Detailed breakdown of all deductions
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
      get total() {
        return this.dependentDeduction +
               this.spouseDeduction +
               this.spouseSpecialDeduction +
               this.specificRelativeDeduction +
               this.disabilityDeduction;
      },
    },
    residenceTax: {
      dependentDeduction: 0,
      spouseDeduction: 0,
      spouseSpecialDeduction: 0,
      specificRelativeDeduction: 0,
      disabilityDeduction: 0,
      get total() {
        return this.dependentDeduction +
               this.spouseDeduction +
               this.spouseSpecialDeduction +
               this.specificRelativeDeduction +
               this.disabilityDeduction;
      },
    },
    breakdown: [],
  };
  
  // Process each dependent
  for (const dependent of dependents) {
    // 1. Handle Disability Deduction (separate entry)
    if (dependent.disability !== 'none') {
      const disabilityDeduction = getDisabilityDeduction(dependent.disability, dependent.isCohabiting);
      
      results.nationalTax.disabilityDeduction += disabilityDeduction.national;
      results.residenceTax.disabilityDeduction += disabilityDeduction.residence;
      
      let disabilityType: DeductionType = DEDUCTION_TYPES.DISABILITY;
      if (dependent.disability === 'special') {
        disabilityType = dependent.isCohabiting 
          ? DEDUCTION_TYPES.SPECIAL_DISABILITY_COHABITING 
          : DEDUCTION_TYPES.SPECIAL_DISABILITY;
      }
      
      results.breakdown.push({
        dependent,
        nationalTaxAmount: disabilityDeduction.national,
        residenceTaxAmount: disabilityDeduction.residence,
        deductionType: disabilityType,
      });
    }
    
    // 2. Handle Main Deduction (Spouse, Dependent, etc.)

    // Spouse deductions
    if (dependent.relationship === 'spouse') {
      if (isEligibleForSpouseDeduction(dependent)) {
        const spouseDeduction = calculateSpouseDeduction(dependent, taxpayerNetIncome);
        
        results.nationalTax.spouseDeduction += spouseDeduction.national;
        results.residenceTax.spouseDeduction += spouseDeduction.residence;

        results.breakdown.push({
          dependent,
          nationalTaxAmount: spouseDeduction.national,
          residenceTaxAmount: spouseDeduction.residence,
          deductionType: DEDUCTION_TYPES.SPOUSE,
        });
      } else if (isEligibleForSpouseSpecialDeduction(dependent)) {
        const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
        const spouseSpecialDeduction = getSpouseSpecialDeduction(totalNetIncome, taxpayerNetIncome);
        
        results.nationalTax.spouseSpecialDeduction += spouseSpecialDeduction.national;
        results.residenceTax.spouseSpecialDeduction += spouseSpecialDeduction.residence;
        
        results.breakdown.push({
          dependent,
          nationalTaxAmount: spouseSpecialDeduction.national,
          residenceTaxAmount: spouseSpecialDeduction.residence,
          deductionType: DEDUCTION_TYPES.SPOUSE_SPECIAL,
        });
      }
    }
    // Specific relative special deduction
    else if (isEligibleForSpecificRelativeSpecialDeduction(dependent)) {
      const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
      const specificRelativeDeduction = getSpecificRelativeDeduction(totalNetIncome);
      
      results.nationalTax.specificRelativeDeduction += specificRelativeDeduction.national;
      results.residenceTax.specificRelativeDeduction += specificRelativeDeduction.residence;
      
      results.breakdown.push({
        dependent,
        nationalTaxAmount: specificRelativeDeduction.national,
        residenceTaxAmount: specificRelativeDeduction.residence,
        deductionType: DEDUCTION_TYPES.SPECIFIC_RELATIVE_SPECIAL,
      });
    }
    // Standard dependent deduction
    else if (isEligibleForDependentDeduction(dependent)) {
      const dependentDeduction = calculateDependentDeduction(dependent);
      
      results.nationalTax.dependentDeduction += dependentDeduction.national;
      results.residenceTax.dependentDeduction += dependentDeduction.residence;
      
      results.breakdown.push({
        dependent,
        nationalTaxAmount: dependentDeduction.national,
        residenceTaxAmount: dependentDeduction.residence,
        deductionType: isSpecialDependent(dependent) ? DEDUCTION_TYPES.SPECIAL_DEPENDENT :
                       isElderlyDependent(dependent) ? DEDUCTION_TYPES.ELDERLY_DEPENDENT :
                       DEDUCTION_TYPES.GENERAL_DEPENDENT,
      });
    } else {
      // Not eligible for any deduction (except disability which was already handled)
      // Only add a "Not Eligible" entry if there was no disability deduction either.
      if (dependent.disability === 'none') {
        results.breakdown.push({
          dependent,
          nationalTaxAmount: 0,
          residenceTaxAmount: 0,
          deductionType: DEDUCTION_TYPES.NOT_ELIGIBLE,
        });
      }
    }
  }
  
  return results;
}
