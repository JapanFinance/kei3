/**
 * Calculation utilities for dependent-related tax deductions in Japan
 * 
 * References:
 * - 扶養控除 (Dependent Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 * - 配偶者控除 (Spouse Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * - 配偶者特別控除 (Spouse Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * - 特定親族特別控除 (Specific Relative Special Deduction): https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191_1.htm
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
} from '../types/dependents';

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
  
  // 配偶者特別控除 (Spouse Special Deduction) - varies by spouse income
  // For spouse income 95-133万円, taxpayer income ≤ 9,000,000
  SPOUSE_SPECIAL_95TO100: 380_000,
  SPOUSE_SPECIAL_100TO105: 360_000,
  SPOUSE_SPECIAL_105TO110: 310_000,
  SPOUSE_SPECIAL_110TO115: 260_000,
  SPOUSE_SPECIAL_115TO120: 210_000,
  SPOUSE_SPECIAL_120TO125: 160_000,
  SPOUSE_SPECIAL_125TO130: 110_000,
  SPOUSE_SPECIAL_130TO133: 60_000,
  
  // 特定親族特別控除 (Specific Relative Special Deduction) - age 19-23, income 48-133万円
  SPECIFIC_RELATIVE_48TO95: 630_000,
  SPECIFIC_RELATIVE_95TO100: 580_000,
  SPECIFIC_RELATIVE_100TO105: 530_000,
  SPECIFIC_RELATIVE_105TO110: 480_000,
  SPECIFIC_RELATIVE_110TO115: 430_000,
  SPECIFIC_RELATIVE_115TO120: 380_000,
  SPECIFIC_RELATIVE_120TO125: 330_000,
  SPECIFIC_RELATIVE_125TO130: 280_000,
  SPECIFIC_RELATIVE_130TO133: 230_000,
  
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
  
  // 配偶者特別控除
  SPOUSE_SPECIAL_95TO100: 330_000,
  SPOUSE_SPECIAL_100TO105: 310_000,
  SPOUSE_SPECIAL_105TO110: 260_000,
  SPOUSE_SPECIAL_110TO115: 210_000,
  SPOUSE_SPECIAL_115TO120: 160_000,
  SPOUSE_SPECIAL_120TO125: 110_000,
  SPOUSE_SPECIAL_125TO130: 60_000,
  SPOUSE_SPECIAL_130TO133: 30_000,
  
  // 特定親族特別控除
  SPECIFIC_RELATIVE_48TO95: 450_000,
  SPECIFIC_RELATIVE_95TO100: 420_000,
  SPECIFIC_RELATIVE_100TO105: 390_000,
  SPECIFIC_RELATIVE_105TO110: 360_000,
  SPECIFIC_RELATIVE_110TO115: 330_000,
  SPECIFIC_RELATIVE_115TO120: 300_000,
  SPECIFIC_RELATIVE_120TO125: 270_000,
  SPECIFIC_RELATIVE_125TO130: 240_000,
  SPECIFIC_RELATIVE_130TO133: 210_000,
  
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
 * Deduction breakdown for a single dependent
 */
export interface DependentDeductionBreakdown {
  dependent: Dependent;
  nationalTaxAmount: number;
  residenceTaxAmount: number;
  deductionType: string;
  notes: string[];
}

/**
 * Get disability deduction amount for a given disability level
 */
function getDisabilityDeduction(disability: DisabilityLevel, forResidenceTax: boolean): number {
  if (disability === 'none') {
    return 0;
  }
  
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  switch (disability) {
    case 'regular':
      return deductions.DISABILITY_REGULAR;
    case 'special':
      return deductions.DISABILITY_SPECIAL;
    case 'specialCohabiting':
      return deductions.DISABILITY_SPECIAL_COHABITING;
    default:
      return 0;
  }
}

/**
 * Get spouse special deduction amount based on income level
 * For simplicity, we use midpoint of each range
 */
function getSpouseSpecialDeduction(incomeLevel: string, forResidenceTax: boolean): number {
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // For income 95to133, we use the 95-100 bracket as representative
  // In a real application, you'd want exact income to calculate this precisely
  if (incomeLevel === '95to133') {
    return deductions.SPOUSE_SPECIAL_95TO100;
  }
  
  return 0;
}

/**
 * Get specific relative special deduction amount based on income level
 */
function getSpecificRelativeDeduction(incomeLevel: string, forResidenceTax: boolean): number {
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // For income ranges, we use the most favorable bracket
  if (incomeLevel === '48to95') {
    return deductions.SPECIFIC_RELATIVE_48TO95;
  } else if (incomeLevel === '95to133') {
    return deductions.SPECIFIC_RELATIVE_95TO100;
  }
  
  return 0;
}

/**
 * Calculate dependent deduction for a single dependent (excluding spouse)
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
function calculateSpouseDeduction(dependent: Dependent, forResidenceTax: boolean): number {
  if (!isEligibleForSpouseDeduction(dependent)) {
    return 0;
  }
  
  const deductions = forResidenceTax ? RESIDENCE_TAX_DEDUCTIONS : NATIONAL_TAX_DEDUCTIONS;
  
  // Check if elderly spouse (age 70+)
  if (dependent.age >= 70) {
    return deductions.ELDERLY_SPOUSE;
  }
  
  return deductions.SPOUSE;
}

/**
 * Calculate all dependent-related deductions
 * 
 * @param dependents - Array of dependents
 * @returns Detailed breakdown of all deductions
 * 
 * Note: Currently assumes taxpayer income is within normal limits (≤ 10,000,000).
 * In future versions, taxpayer income could be used to adjust spouse deduction amounts.
 */
export function calculateDependentDeductions(
  dependents: Dependent[]
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
      const natDisability = getDisabilityDeduction(dependent.disability, false);
      const resDisability = getDisabilityDeduction(dependent.disability, true);
      
      results.nationalTax.disabilityDeduction += natDisability;
      results.residenceTax.disabilityDeduction += resDisability;
      
      breakdown.nationalTaxAmount += natDisability;
      breakdown.residenceTaxAmount += resDisability;
      breakdown.notes.push(`Disability deduction (${dependent.disability})`);
    }
    
    // Spouse deductions
    if (dependent.relationship === 'spouse') {
      if (isEligibleForSpouseDeduction(dependent)) {
        const natSpouse = calculateSpouseDeduction(dependent, false);
        const resSpouse = calculateSpouseDeduction(dependent, true);
        
        results.nationalTax.spouseDeduction += natSpouse;
        results.residenceTax.spouseDeduction += resSpouse;
        
        breakdown.nationalTaxAmount += natSpouse;
        breakdown.residenceTaxAmount += resSpouse;
        breakdown.deductionType = 'Spouse Deduction';
        breakdown.notes.push(dependent.age >= 70 ? 'Elderly spouse' : 'Spouse deduction');
      } else if (isEligibleForSpouseSpecialDeduction(dependent)) {
        const natSpouseSpecial = getSpouseSpecialDeduction(dependent.incomeLevel, false);
        const resSpouseSpecial = getSpouseSpecialDeduction(dependent.incomeLevel, true);
        
        results.nationalTax.spouseSpecialDeduction += natSpouseSpecial;
        results.residenceTax.spouseSpecialDeduction += resSpouseSpecial;
        
        breakdown.nationalTaxAmount += natSpouseSpecial;
        breakdown.residenceTaxAmount += resSpouseSpecial;
        breakdown.deductionType = 'Spouse Special Deduction';
        breakdown.notes.push('Spouse special deduction (income 95-133万円)');
      }
    }
    // Specific relative special deduction (age 19-23, income 48-133万円)
    else if (isEligibleForSpecificRelativeDeduction(dependent)) {
      const natSpecific = getSpecificRelativeDeduction(dependent.incomeLevel, false);
      const resSpecific = getSpecificRelativeDeduction(dependent.incomeLevel, true);
      
      results.nationalTax.specificRelativeDeduction += natSpecific;
      results.residenceTax.specificRelativeDeduction += resSpecific;
      
      breakdown.nationalTaxAmount += natSpecific;
      breakdown.residenceTaxAmount += resSpecific;
      breakdown.deductionType = 'Specific Relative Special Deduction';
      breakdown.notes.push('Age 19-23 with income 48-133万円');
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
        breakdown.deductionType = 'Special Dependent Deduction';
        breakdown.notes.push('Age 19-22 (Special dependent)');
      } else if (isElderlyDependent(dependent)) {
        breakdown.deductionType = 'Elderly Dependent Deduction';
        if (dependent.isCohabiting && dependent.relationship === 'parent') {
          breakdown.notes.push('Age 70+ cohabiting parent');
        } else {
          breakdown.notes.push('Age 70+ elderly dependent');
        }
      } else {
        breakdown.deductionType = 'General Dependent Deduction';
        breakdown.notes.push('General dependent');
      }
    } else {
      // Not eligible for any deduction (except disability which was already handled)
      if (dependent.disability === 'none') {
        breakdown.deductionType = 'Not Eligible';
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
      b.deductionType.includes('Dependent') && 
      !b.deductionType.includes('Specific')
    ).length;
    parts.push(`${count} dependent${count > 1 ? 's' : ''}`);
  }
  if (results.nationalTax.specificRelativeDeduction > 0) {
    const count = results.breakdown.filter(b => 
      b.deductionType.includes('Specific')
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
