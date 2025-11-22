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


