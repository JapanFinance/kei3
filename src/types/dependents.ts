// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Types for dependent-related deductions in Japanese tax system
 */

import { PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND } from '../data/publicPensionDeduction';
import {
  assertAgeRangesDoNotCrossBands,
  ageRangeCoversBand,
  type AgeBand,
  type AgeRange,
} from './age';

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
 * Disability levels for dependent deductions
 * - none: No disability
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
 * Age range for spouse
 * - under65: Under 65 years old
 * - 65to69: Age 65-69
 * - 70plus: 70 years or older (老人控除対象配偶者, higher spouse deduction)
 *
 * The 65 boundary changes a computed amount only through the public pension deduction
 * (公的年金等控除) — see {@link DEPENDENT_AGE_BANDS}.
 */
export type SpouseAgeRange = 'under65' | '65to69' | '70plus';

/**
 * Age range for non-spouse dependents
 * - under16: Under 16 years old (not eligible for dependent deduction)
 * - 16to18: Age 16-18 (eligible for standard dependent deduction)
 * - 19to22: Age 19-22 (eligible for special dependent deduction if income within the eligibility
 *   threshold, or specific relative special deduction above it)
 * - 23to64, 65to69: Age 23-69 (eligible for standard dependent deduction; the 65 boundary changes
 *   a computed amount only through the public pension deduction — see {@link DEPENDENT_AGE_BANDS})
 * - 70plus: 70 years or older (eligible for elderly dependent deduction)
 */
export type DependentAgeRange = 'under16' | '16to18' | '19to22' | '23to64' | '65to69' | '70plus';

/** The ages each {@link SpouseAgeRange} and {@link DependentAgeRange} spans. */
const AGE_RANGE_BOUNDS = {
  under16: { minAgeInclusive: 0, maxAgeExclusive: 16 },
  '16to18': { minAgeInclusive: 16, maxAgeExclusive: 19 },
  '19to22': { minAgeInclusive: 19, maxAgeExclusive: 23 },
  '23to64': { minAgeInclusive: 23, maxAgeExclusive: 65 },
  under65: { minAgeInclusive: 0, maxAgeExclusive: 65 },
  '65to69': { minAgeInclusive: 65, maxAgeExclusive: 70 },
  '70plus': { minAgeInclusive: 70, maxAgeExclusive: Infinity },
} satisfies Record<SpouseAgeRange | DependentAgeRange, AgeRange>;

/**
 * The age bands a spouse's rules are written on. The DEV block at the end of this module rejects
 * any {@link SpouseAgeRange} that only partly falls inside one of these, since no single answer
 * would hold for everyone in such a range.
 *
 * @see https://laws.e-gov.go.jp/law/340AC0000000033#Mp-Pa_1-At_2 — 所得税法第2条第1項第33号の4
 */
export const SPOUSE_AGE_BANDS = {
  /** The higher 公的年金等控除 minimum, on the band exported by the module that owns the table. */
  publicPensionDeductionElderly: PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
  /** 老人控除対象配偶者: a 控除対象配偶者 aged 70 or older, who draws the higher 配偶者控除. */
  elderlySpouse: { minAgeInclusive: 70 },
} satisfies Record<string, AgeBand>;

/**
 * The age bands a non-spouse dependent's rules are written on, checked the same way as
 * {@link SPOUSE_AGE_BANDS}.
 *
 * {@link DEPENDENT_AGE_BANDS.elderlyDependent} and {@link SPOUSE_AGE_BANDS.elderlySpouse} are both
 * drawn at 70 but stay separate: 老人扶養親族 and 老人控除対象配偶者 are defined in different
 * provisions.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm — 扶養控除
 * @see https://laws.e-gov.go.jp/law/340AC0000000033#Mp-Pa_1-At_2 — 所得税法第2条第1項第34号の4
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm — 所得金額調整控除
 */
export const DEPENDENT_AGE_BANDS = {
  /** The higher 公的年金等控除 minimum, on the band exported by the module that owns the table. */
  publicPensionDeductionElderly: PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
  /** 老人扶養親族: a 控除対象扶養親族 aged 70 or older. */
  elderlyDependent: { minAgeInclusive: 70 },
  /** 年齢23歳未満の扶養親族, condition ロ of the 所得金額調整控除（子ども・特別障害者等）. */
  dependentUnder23: { maxAgeExclusive: 23 },
} satisfies Record<string, AgeBand>;

/**
 * Whether every age in {@link ageRange} falls inside {@link band}. Spouse and non-spouse
 * ranges are answered by the same predicate, so a rule shared by both reads one band.
 */
export function dependentAgeCoversBand(
  ageRange: SpouseAgeRange | DependentAgeRange,
  band: AgeBand,
): boolean {
  return ageRangeCoversBand(AGE_RANGE_BOUNDS[ageRange], band);
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

  /** Age range of the spouse */
  ageRange: SpouseAgeRange;

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

  /** Age range of the dependent */
  ageRange: DependentAgeRange;

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
  { value: 'parent', label: 'Parent or Grandparent' },
  { value: 'other', label: 'Other Relative' },
];

/**
 * Spouse age range display information
 */
export interface SpouseAgeRangeInfo {
  value: SpouseAgeRange;
  label: string;
}

/**
 * Spouse age range definitions
 */
export const SPOUSE_AGE_RANGES: SpouseAgeRangeInfo[] = [
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
 * Dependent age range display information
 */
export interface DependentAgeRangeInfo {
  value: DependentAgeRange;
  label: string;
}

/**
 * Dependent age range definitions
 */
export const DEPENDENT_AGE_RANGES: DependentAgeRangeInfo[] = [
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

if (import.meta.env.DEV) {
  const boundsOf = <Choice extends SpouseAgeRange | DependentAgeRange>(
    choices: ReadonlyArray<{ value: Choice }>,
  ): Record<Choice, AgeRange> =>
    Object.fromEntries(choices.map(({ value }) => [value, AGE_RANGE_BOUNDS[value]])) as Record<
      Choice,
      AgeRange
    >;

  assertAgeRangesDoNotCrossBands('Spouse age range', boundsOf(SPOUSE_AGE_RANGES), SPOUSE_AGE_BANDS);
  assertAgeRangesDoNotCrossBands(
    'Dependent age range',
    boundsOf(DEPENDENT_AGE_RANGES),
    DEPENDENT_AGE_BANDS,
  );
}
