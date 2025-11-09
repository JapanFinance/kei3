/**
 * Types for dependent-related deductions in Japanese tax system
 */

/**
 * Income level thresholds for non-spouse dependents
 * - under48: Income up to ¥480,000 (eligible for dependent deduction)
 * - 48to95: Income ¥480,000 to ¥950,000 (not eligible for dependent deduction, but age 19-23 may get specific relative special deduction)
 * - 95to133: Income ¥950,000 to ¥1,330,000 (age 19-23 may get specific relative special deduction)
 * - over133: Income over ¥1,330,000 (not eligible for any dependent deductions)
 */
export type IncomeLevel = 'under48' | '48to95' | '95to133' | 'over133';

/**
 * Income level thresholds for spouse
 * - under95: Income up to ¥950,000 (eligible for spouse deduction 配偶者控除)
 * - 95to133: Income ¥950,000 to ¥1,330,000 (eligible for spouse special deduction 配偶者特別控除)
 * - over133: Income over ¥1,330,000 (not eligible for any deductions)
 */
export type SpouseIncomeLevel = 'under95' | '95to133' | 'over133';

/**
 * Disability levels for dependent deductions
 * - none: Not disabled
 * - regular: Regular disability (一般の障害者)
 * - special: Special disability (特別障害者)
 * 
 * Note: Special disability with cohabitation (同居特別障害者) is determined by
 * combining disability='special' with isCohabiting=true
 */
export type DisabilityLevel = 'none' | 'regular' | 'special';

/**
 * Relationship type for dependent
 */
export type DependentRelationship = 'spouse' | 'child' | 'parent' | 'other';

/**
 * Age category for spouse
 * - under70: Under 70 years old
 * - 70plus: 70 years or older (elderly spouse)
 */
export type SpouseAgeCategory = 'under70' | '70plus';

/**
 * Age category for non-spouse dependents
 * - under16: Under 16 years old (not eligible for dependent deduction)
 * - 16to18: Age 16-18 (eligible for standard dependent deduction)
 * - 19to22: Age 19-22 (eligible for special dependent deduction if income ≤48万, or specific relative special deduction if income 48-133万)
 * - 23to69: Age 23-69 (eligible for standard dependent deduction if income ≤48万, or specific relative special deduction age 23 only if income 48-133万)
 * - 70plus: 70 years or older (eligible for elderly dependent deduction)
 */
export type DependentAgeCategory = 'under16' | '16to18' | '19to22' | '23to69' | '70plus';

/**
 * Represents a spouse for tax deduction purposes
 */
export interface Spouse {
  /** Unique identifier */
  id: string;
  
  /** Relationship - always 'spouse' */
  relationship: 'spouse';
  
  /** Age category of the spouse */
  ageCategory: SpouseAgeCategory;
  
  /** Income level bracket of the spouse */
  incomeLevel: SpouseIncomeLevel;
  
  /** Disability status and level */
  disability: DisabilityLevel;
  
  /** Whether the spouse lives with the taxpayer */
  isCohabiting: boolean;
}

/**
 * Represents a non-spouse dependent for tax deduction purposes
 */
export interface OtherDependent {
  /** Unique identifier */
  id: string;
  
  /** Relationship to the taxpayer (not spouse) */
  relationship: Exclude<DependentRelationship, 'spouse'>;
  
  /** Age category of the dependent */
  ageCategory: DependentAgeCategory;
  
  /** Income level bracket of the dependent */
  incomeLevel: IncomeLevel;
  
  /** Disability status and level */
  disability: DisabilityLevel;
  
  /** Whether the dependent lives with the taxpayer */
  isCohabiting: boolean;
}

/**
 * Union type for any dependent
 */
export type Dependent = Spouse | OtherDependent;

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
 * Spouse income level display information
 */
export interface SpouseIncomeLevelInfo {
  value: SpouseIncomeLevel;
  label: string;
  description: string;
  maxAmount: number | null; // null means no upper limit
}

/**
 * Income level definitions with labels and thresholds
 */
export const INCOME_LEVELS: IncomeLevelInfo[] = [
  {
    value: 'under48',
    label: 'Up to ¥480,000',
    description: '¥0 - ¥480,000',
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
 * Spouse income level definitions with labels and thresholds
 * Simplified thresholds specific to spouse deductions
 */
export const SPOUSE_INCOME_LEVELS: SpouseIncomeLevelInfo[] = [
  {
    value: 'under95',
    label: 'Up to ¥950,000',
    description: '¥0 - ¥950,000 (eligible for spouse deduction)',
    maxAmount: 950_000,
  },
  {
    value: '95to133',
    label: '¥950,000 - ¥1,330,000',
    description: '¥950,001 - ¥1,330,000 (eligible for spouse special deduction)',
    maxAmount: 1_330_000,
  },
  {
    value: 'over133',
    label: 'Over ¥1,330,000',
    description: 'Over ¥1,330,000 (not eligible for deduction)',
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
    description: '特別障害者 - Special disability status (additional deduction if living together)',
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
 * Get income level from slider value (0-3)
 */
export function getIncomeLevelFromSlider(value: number): IncomeLevel {
  const levels: IncomeLevel[] = ['under48', '48to95', '95to133', 'over133'];
  return levels[value] || 'under48';
}

/**
 * Get slider value (0-3) from income level
 */
export function getSliderValueFromIncomeLevel(level: IncomeLevel): number {
  const levels: IncomeLevel[] = ['under48', '48to95', '95to133', 'over133'];
  return levels.indexOf(level);
}

/**
 * Spouse age category display information
 */
export interface SpouseAgeCategoryInfo {
  value: SpouseAgeCategory;
  label: string;
}

/**
 * Spouse age category definitions
 */
export const SPOUSE_AGE_CATEGORIES: SpouseAgeCategoryInfo[] = [
  {
    value: 'under70',
    label: 'Under 70',
  },
  {
    value: '70plus',
    label: '70 or Older',
  },
];

/**
 * Dependent age category display information
 */
export interface DependentAgeCategoryInfo {
  value: DependentAgeCategory;
  label: string;
}

/**
 * Dependent age category definitions
 */
export const DEPENDENT_AGE_CATEGORIES: DependentAgeCategoryInfo[] = [
  {
    value: 'under16',
    label: 'Under 16',
  },
  {
    value: '16to18',
    label: '16 - 18',
  },
  {
    value: '19to22',
    label: '19 - 22',
  },
  {
    value: '23to69',
    label: '23 - 69',
  },
  {
    value: '70plus',
    label: '70 or Older',
  },
];

/**
 * Check if a dependent qualifies for any deduction based on their income level
 */
export function hasEligibleIncome(dependent: Dependent): boolean {
  // Spouse is eligible for deductions up to 133万円
  if (dependent.relationship === 'spouse') {
    return dependent.incomeLevel !== 'over133';
  }
  
  // Others (age 19-23) are eligible for specific relative special deduction if income is 48-133万円
  const ageCategory = (dependent as OtherDependent).ageCategory;
  if (ageCategory === '19to22' || ageCategory === '23to69') {
    // Age 19-23 can get specific relative special deduction with higher income
    // For 23to69 category, we conservatively allow since age 23 qualifies
    return dependent.incomeLevel === '48to95' || dependent.incomeLevel === '95to133' || dependent.incomeLevel === 'under48';
  }
  
  // Others are only eligible if income is under 48万円
  return dependent.incomeLevel === 'under48';
}

/**
 * Check if dependent is eligible for standard dependent deduction (扶養控除)
 * Must have income ≤ 48万円 and not be a spouse
 */
export function isEligibleForDependentDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  return dependent.incomeLevel === 'under48';
}

/**
 * Check if dependent is a special dependent (特定扶養親族)
 * Age 19-22 on December 31st, with income ≤ 48万円
 */
export function isSpecialDependent(dependent: Dependent): boolean {
  if (!isEligibleForDependentDeduction(dependent)) {
    return false;
  }
  if (dependent.relationship === 'spouse') {
    return false;
  }
  return (dependent as OtherDependent).ageCategory === '19to22';
}

/**
 * Check if dependent is an elderly dependent (老人扶養親族)
 * Age 70+ on December 31st, with income ≤ 48万円
 */
export function isElderlyDependent(dependent: Dependent): boolean {
  if (!isEligibleForDependentDeduction(dependent)) {
    return false;
  }
  if (dependent.relationship === 'spouse') {
    return false;
  }
  return (dependent as OtherDependent).ageCategory === '70plus';
}

/**
 * Check if dependent is eligible for spouse deduction (配偶者控除)
 * Spouse with income ≤ 95万円
 */
export function isEligibleForSpouseDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  return (dependent as Spouse).incomeLevel === 'under95';
}

/**
 * Check if dependent is eligible for spouse special deduction (配偶者特別控除)
 * Spouse with income 95万円 < income ≤ 133万円
 */
export function isEligibleForSpouseSpecialDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  return (dependent as Spouse).incomeLevel === '95to133';
}

/**
 * Check if dependent is eligible for specific relative special deduction (特定親族特別控除)
 * Age 19-23 on December 31st, not spouse, with income 48万円 < income ≤ 133万円
 */
export function isEligibleForSpecificRelativeDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  const otherDependent = dependent as OtherDependent;
  const ageCategory = otherDependent.ageCategory;
  
  // Age 19-22 are fully eligible, age 23 in the 23to69 category is also eligible
  if (ageCategory !== '19to22' && ageCategory !== '23to69') {
    return false;
  }
  return dependent.incomeLevel === '48to95' || dependent.incomeLevel === '95to133';
}
