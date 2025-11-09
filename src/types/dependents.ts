/**
 * Types for dependent-related deductions in Japanese tax system
 */

/**
 * Income input for dependents
 * We ask for gross employment income and other net income separately to calculate
 * total net income (合計所得金額) accurately, rather than asking users to calculate it themselves
 */
export interface DependentIncome {
  /** Gross employment income (給与収入) - we'll calculate the net using employment income deduction */
  grossEmploymentIncome: number;
  
  /** Other net income (その他の所得) - business income, pension, capital gains, etc. */
  otherNetIncome: number;
}

/**
 * Calculate net employment income (給与所得) from gross employment income (給与収入)
 * Uses the employment income deduction formula (給与所得控除)
 */
export function calculateNetEmploymentIncome(grossEmploymentIncome: number): number {
  let netEmploymentIncome = 0;
  if (grossEmploymentIncome < 651_000) {
    netEmploymentIncome = 0;
  } else if (grossEmploymentIncome < 1_900_000) {
    netEmploymentIncome = grossEmploymentIncome - 650_000;
  } else {
    // From 1.9M yen through 6.6M yen, gross income is rounded down to the nearest 4,000 yen
    const roundedGrossIncome = Math.floor(grossEmploymentIncome / 4000) * 4000;
    
    if (grossEmploymentIncome <= 3_600_000) {
      netEmploymentIncome = Math.floor(roundedGrossIncome * 0.7) - 80_000;
    } else if (grossEmploymentIncome <= 6_600_000) {
      netEmploymentIncome = Math.floor(roundedGrossIncome * 0.8) - 440_000;
    } else if (grossEmploymentIncome <= 8_500_000) {
      netEmploymentIncome = Math.floor(grossEmploymentIncome * 0.9) - 1_100_000;
    } else {
      netEmploymentIncome = grossEmploymentIncome - 1_950_000;
    }
  }
  
  return netEmploymentIncome;
}

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
  
  /** Income details for calculating total net income */
  income: DependentIncome;
  
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
  
  /** Income details for calculating total net income */
  income: DependentIncome;
  
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
 * Disability level display information
 */
export interface DisabilityLevelInfo {
  value: DisabilityLevel;
  label: string;
}

/**
 * Disability level definitions with labels
 */
export const DISABILITY_LEVELS: DisabilityLevelInfo[] = [
  {
    value: 'none',
    label: 'Not Disabled',
  },
  {
    value: 'regular',
    label: 'Regular Disability (一般の障害者)',
  },
  {
    value: 'special',
    label: 'Special Disability (特別障害者)',
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
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  
  // Spouse is eligible for deductions up to 133万円
  if (dependent.relationship === 'spouse') {
    return totalNetIncome <= 1_330_000;
  }
  
  // Others (age 19-23) are eligible for specific relative special deduction if income is 48-133万円
  const ageCategory = (dependent as OtherDependent).ageCategory;
  if (ageCategory === '19to22' || ageCategory === '23to69') {
    // Age 19-23 can get specific relative special deduction with income up to 133万円
    // For 23to69 category, we conservatively allow since age 23 qualifies
    return totalNetIncome <= 1_330_000;
  }
  
  // Others are only eligible if income is under 48万円
  return totalNetIncome <= 480_000;
}

/**
 * Check if dependent is eligible for standard dependent deduction (扶養控除)
 * Must have income ≤ 48万円 and not be a spouse
 */
export function isEligibleForDependentDeduction(dependent: Dependent): boolean {
  if (dependent.relationship === 'spouse') {
    return false;
  }
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome <= 480_000;
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
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome <= 950_000;
}

/**
 * Check if dependent is eligible for spouse special deduction (配偶者特別控除)
 * Spouse with income 95万円 < income ≤ 133万円
 */
export function isEligibleForSpouseSpecialDeduction(dependent: Dependent): boolean {
  if (dependent.relationship !== 'spouse') {
    return false;
  }
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome > 950_000 && totalNetIncome <= 1_330_000;
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
  
  const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
  return totalNetIncome > 480_000 && totalNetIncome <= 1_330_000;
}
