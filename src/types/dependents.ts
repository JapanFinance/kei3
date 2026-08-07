// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

  /**
   * Gross public pension income (公的年金等の収入金額), as shown on the 公的年金等の源泉徴収票 -
   * we'll calculate the net using the public pension deduction (公的年金等控除), which depends on
   * whether the recipient is 65 or older. Survivor and disability pensions (遺族年金・障害年金) are
   * non-taxable and are not included.
   */
  grossPublicPensionIncome: number;

  /**
   * Other net income (その他の所得) - business income, capital gains, etc., excluding employment
   * and public pension income, which are entered gross in their own fields
   */
  otherNetIncome: number;
}

/**
 * Which 障害者控除 category applies, if any. These name the statutory brackets rather than
 * describing a person, and the labels in {@link DISABILITY_LEVELS} follow suit.
 * - none: the deduction does not apply
 * - regular: 一般の障害者
 * - special: 特別障害者
 *
 * Note: 同居特別障害者 is determined by combining disability='special' with isCohabiting=true
 */
export type DisabilityLevel = 'none' | 'regular' | 'special';

/**
 * Relationship type for dependent
 */
export type DependentRelationship = 'spouse' | 'child' | 'parent' | 'other';

/**
 * Age category for spouse
 * - under65: Under 65 years old
 * - 65to69: Age 65-69
 * - 70plus: 70 years or older (老人控除対象配偶者, higher spouse deduction)
 *
 * The 65 boundary changes a computed amount only through the public pension deduction
 * (公的年金等控除) — see {@link is65OrOlder}.
 */
export type SpouseAgeCategory = 'under65' | '65to69' | '70plus';

/**
 * Age category for non-spouse dependents
 * - under16: Under 16 years old (not eligible for dependent deduction)
 * - 16to18: Age 16-18 (eligible for standard dependent deduction)
 * - 19to22: Age 19-22 (eligible for special dependent deduction if income within the eligibility
 *   threshold, or specific relative special deduction above it)
 * - 23to64, 65to69: Age 23-69 (eligible for standard dependent deduction; the 65 boundary changes
 *   a computed amount only through the public pension deduction — see {@link is65OrOlder})
 * - 70plus: 70 years or older (eligible for elderly dependent deduction)
 */
export type DependentAgeCategory = 'under16' | '16to18' | '19to22' | '23to64' | '65to69' | '70plus';

/**
 * Whether an age category means 65 or older on December 31 of the income year — the boundary at
 * which the public pension deduction (公的年金等控除) switches to its higher minimum deduction
 * (租税特別措置法第41条の15の3; the December 31 judgment date is 同条第4項).
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm
 * @see https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_6-At_41_15_3 — 租税特別措置法第41条の15の3
 */
export function is65OrOlder(ageCategory: SpouseAgeCategory | DependentAgeCategory): boolean {
  return ageCategory === '65to69' || ageCategory === '70plus';
}

/**
 * Deduction amount for national and residence tax
 */
export interface DeductionAmount {
  national: number;
  residence: number;
}

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
 * Dropdown labels for the 障害者控除 categories. Each names the statutory bracket the deduction
 * is claimed under, so that neither the wording nor the default asserts anything about the person
 * — "Not applicable" rather than a "not disabled" label, and no adjective attached to someone.
 */
export const DISABILITY_LEVELS: DisabilityLevelInfo[] = [
  {
    value: 'none',
    label: 'Not applicable',
  },
  {
    value: 'regular',
    label: 'Qualifying disability (一般の障害者)',
  },
  {
    value: 'special',
    label: 'Special disability (特別障害者)',
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
  { value: 'parent', label: 'Parent or Grandparent' },
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
    value: 'under65',
    label: 'Under 65',
  },
  {
    value: '65to69',
    label: '65 - 69',
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
    value: '23to64',
    label: '23 - 64',
  },
  {
    value: '65to69',
    label: '65 - 69',
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
  /** 配偶者控除 */
  SPOUSE: 'Spouse',
  /** 配偶者特別控除 */
  SPOUSE_SPECIAL: 'Spouse Special',
  /** 一般の控除対象扶養親族 (16-18歳, 23-69歳) */
  GENERAL_DEPENDENT: 'General Dependent',
  /** 特定扶養親族 (19-22歳) - Standard deduction for eligible dependents */
  SPECIAL_DEPENDENT: 'Special Dependent',
  /** 老人扶養控除 (70+) that is not 同居老親等 */
  ELDERLY_DEPENDENT: 'Elderly Dependent',
  /** 同居老親等 - cohabiting elderly (70+) 直系尊属 (parent/grandparent), the higher elderly deduction */
  ELDERLY_COHABITING_DEPENDENT: 'Elderly Dependent (Cohabiting)',
  /** 特定親族特別控除 - Phased deduction for 19-22 year olds with income above general dependent threshold */
  SPECIFIC_RELATIVE_SPECIAL: 'Specific Relative Special',
  /** 障害者控除（一般の障害者） */
  DISABILITY: 'Disability',
  /** 障害者控除（特別障害者） */
  SPECIAL_DISABILITY: 'Special Disability',
  /** 障害者控除（同居特別障害者） */
  SPECIAL_DISABILITY_COHABITING: 'Special Disability (Cohabiting)',
  NOT_ELIGIBLE: 'Not Eligible',
} as const;

export type DeductionType = (typeof DEDUCTION_TYPES)[keyof typeof DEDUCTION_TYPES];

/**
 * Represents the breakdown of deductions for a single dependent
 */
export interface DependentDeductionBreakdown {
  dependent: Dependent;
  nationalTaxAmount: number;
  residenceTaxAmount: number;
  deductionType: DeductionType;
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
