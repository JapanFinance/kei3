/**
 * Types for dependent-related deductions in Japanese tax system
 */

/**
 * Income level thresholds for dependent deductions
 * - none: No income (¥0)
 * - under48: Income under ¥480,000 (eligible for dependent deduction)
 * - 48to95: Income ¥480,000 to ¥950,000 (spouse: eligible for spouse deduction; others: not eligible)
 * - 95to133: Income ¥950,000 to ¥1,330,000 (spouse: eligible for spouse special deduction; age 19-23: eligible for specific relative special deduction)
 * - over133: Income over ¥1,330,000 (not eligible for any dependent deductions)
 */
export type IncomeLevel = 'none' | 'under48' | '48to95' | '95to133' | 'over133';

/**
 * Disability levels for dependent deductions
 * - none: Not disabled
 * - regular: Regular disability (一般の障害者)
 * - special: Special disability (特別障害者)
 * - specialCohabiting: Special disability with cohabitation (同居特別障害者)
 */
export type DisabilityLevel = 'none' | 'regular' | 'special' | 'specialCohabiting';

/**
 * Relationship type for dependent
 */
export type DependentRelationship = 'spouse' | 'child' | 'parent' | 'other';

/**
 * Represents a dependent for tax deduction purposes
 */
export interface Dependent {
  /** Unique identifier for the dependent */
  id: string;
  
  /** Relationship to the taxpayer */
  relationship: DependentRelationship;
  
  /** Age of the dependent (as of December 31st of the tax year) */
  age: number;
  
  /** Income level bracket of the dependent */
  incomeLevel: IncomeLevel;
  
  /** Disability status and level */
  disability: DisabilityLevel;
  
  /** Whether the dependent lives with the taxpayer */
  isCohabiting: boolean;
  
  /** Optional name for display purposes (not used in calculations) */
  name?: string;
}

/**
 * Income level display information
 */
export interface IncomeLevelInfo {
  value: IncomeLevel;
  label: string;
  description: string;
  maxAmount: number | null; // null means no upper limit
}

/**
 * Income level definitions with labels and thresholds
 */
export const INCOME_LEVELS: IncomeLevelInfo[] = [
  {
    value: 'none',
    label: 'No Income',
    description: '¥0',
    maxAmount: 0,
  },
  {
    value: 'under48',
    label: 'Under ¥480,000',
    description: '¥1 - ¥480,000',
    maxAmount: 480_000,
  },
  {
    value: '48to95',
    label: '¥480,000 - ¥950,000',
    description: '¥480,001 - ¥950,000',
    maxAmount: 950_000,
  },
  {
    value: '95to133',
    label: '¥950,000 - ¥1,330,000',
    description: '¥950,001 - ¥1,330,000',
    maxAmount: 1_330_000,
  },
  {
    value: 'over133',
    label: 'Over ¥1,330,000',
    description: 'Over ¥1,330,000',
    maxAmount: null,
  },
];

/**
 * Disability level display information
 */
export interface DisabilityLevelInfo {
  value: DisabilityLevel;
  label: string;
  description: string;
}

/**
 * Disability level definitions with labels
 */
export const DISABILITY_LEVELS: DisabilityLevelInfo[] = [
  {
    value: 'none',
    label: 'Not Disabled',
    description: 'No disability status',
  },
  {
    value: 'regular',
    label: 'Regular Disability',
    description: '一般の障害者 - Regular disability status',
  },
  {
    value: 'special',
    label: 'Special Disability',
    description: '特別障害者 - Special disability status',
  },
  {
    value: 'specialCohabiting',
    label: 'Special Disability (Cohabiting)',
    description: '同居特別障害者 - Special disability with cohabitation',
  },
];

/**
 * Relationship display information
 */
export interface RelationshipInfo {
  value: DependentRelationship;
  label: string;
}

/**
 * Relationship definitions
 */
export const RELATIONSHIPS: RelationshipInfo[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other Relative' },
];

/**
 * Get income level from slider value (0-4)
 */
export function getIncomeLevelFromSlider(value: number): IncomeLevel {
  const levels: IncomeLevel[] = ['none', 'under48', '48to95', '95to133', 'over133'];
  return levels[value] || 'none';
}

/**
 * Get slider value (0-4) from income level
 */
export function getSliderValueFromIncomeLevel(level: IncomeLevel): number {
  const levels: IncomeLevel[] = ['none', 'under48', '48to95', '95to133', 'over133'];
  return levels.indexOf(level);
}

/**
 * Check if a dependent qualifies for any deduction based on their income level
 */
export function hasEligibleIncome(dependent: Dependent): boolean {
  // Spouse is eligible for deductions up to 133万円
  if (dependent.relationship === 'spouse') {
    return dependent.incomeLevel !== 'over133';
  }
  
  // Others (age 19-23) are eligible for specific relative special deduction if income is 48-133万円
  if (dependent.age >= 19 && dependent.age <= 23) {
    return dependent.incomeLevel === '48to95' || dependent.incomeLevel === '95to133';
  }
  
  // Others are only eligible if income is under 48万円
  return dependent.incomeLevel === 'none' || dependent.incomeLevel === 'under48';
}

/**
 * Check if dependent is eligible for standard dependent deduction (扶養控除)
 * Must have income ≤ 48万円 and not be a spouse
 */
export function isEligibleForDependentDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  return dependent.incomeLevel === 'none' || dependent.incomeLevel === 'under48';
}

/**
 * Check if dependent is a special dependent (特定扶養親族)
 * Age 19-22 on December 31st, with income ≤ 48万円
 */
export function isSpecialDependent(dependent: Dependent): boolean {
  if (!isEligibleForDependentDeduction(dependent)) {
    return false;
  }
  return dependent.age >= 19 && dependent.age <= 22;
}

/**
 * Check if dependent is an elderly dependent (老人扶養親族)
 * Age 70+ on December 31st, with income ≤ 48万円
 */
export function isElderlyDependent(dependent: Dependent): boolean {
  if (!isEligibleForDependentDeduction(dependent)) {
    return false;
  }
  return dependent.age >= 70;
}

/**
 * Check if dependent is eligible for spouse deduction (配偶者控除)
 * Spouse with income ≤ 95万円
 */
export function isEligibleForSpouseDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  return dependent.incomeLevel === 'none' || 
         dependent.incomeLevel === 'under48' || 
         dependent.incomeLevel === '48to95';
}

/**
 * Check if dependent is eligible for spouse special deduction (配偶者特別控除)
 * Spouse with income 95万円 < income ≤ 133万円
 */
export function isEligibleForSpouseSpecialDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  return dependent.incomeLevel === '95to133';
}

/**
 * Check if dependent is eligible for specific relative special deduction (特定親族特別控除)
 * Age 19-23 on December 31st, not spouse, with income 48万円 < income ≤ 133万円
 */
export function isEligibleForSpecificRelativeDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  if (dependent.age < 19 || dependent.age > 23) {
    return false;
  }
  return dependent.incomeLevel === '48to95' || dependent.incomeLevel === '95to133';
}
