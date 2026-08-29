// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND } from '../data/publicPensionDeduction';
import {
  assertAgeRangesDoNotCrossBands,
  ageRangeCoversBand,
  type AgeBand,
  type AgeRange,
} from './age';

/**
 * The taxpayer's age. The form offers one age range per {@link TAXPAYER_AGE_RANGES} entry, and
 * every age-keyed rule about the taxpayer is answered by asking whether the chosen range falls
 * inside the rule's {@link AgeBand}. The spouse and dependent age ranges in `./dependents` are
 * the equivalent choices on that side, and read their own bands the same way.
 */

/**
 * Taxpayer age ranges, in ascending order. Each boundary changes at least one calculation:
 * 18 (未成年者 residence-tax non-taxation), 20 and 60 (国民年金 enrollment), 40 and 65
 * (介護保険 premium collection: 第2号 via health insurance, 第1号 billed directly), 70
 * (厚生年金保険 enrollment), 75 (health coverage moves to the 後期高齢者医療制度).
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export const TAXPAYER_AGE_RANGES = [
  'under18',
  'age18to19',
  'age20to39',
  'age40to59',
  'age60to64',
  'age65to69',
  'age70to74',
  'age75plus',
] as const;

export type TaxpayerAgeRange = (typeof TAXPAYER_AGE_RANGES)[number];

export const DEFAULT_TAXPAYER_AGE_RANGE: TaxpayerAgeRange = 'age20to39';

/** Dropdown labels for each {@link TaxpayerAgeRange}. */
export const TAXPAYER_AGE_RANGE_LABELS: Record<TaxpayerAgeRange, string> = {
  under18: 'Under 18',
  age18to19: '18-19',
  age20to39: '20-39',
  age40to59: '40-59',
  age60to64: '60-64',
  age65to69: '65-69',
  age70to74: '70-74',
  age75plus: '75+',
};

/** The ages each {@link TaxpayerAgeRange} spans. */
const TAXPAYER_AGE_RANGE_BOUNDS: Record<TaxpayerAgeRange, AgeRange> = {
  under18: { minAgeInclusive: 0, maxAgeExclusive: 18 },
  age18to19: { minAgeInclusive: 18, maxAgeExclusive: 20 },
  age20to39: { minAgeInclusive: 20, maxAgeExclusive: 40 },
  age40to59: { minAgeInclusive: 40, maxAgeExclusive: 60 },
  age60to64: { minAgeInclusive: 60, maxAgeExclusive: 65 },
  age65to69: { minAgeInclusive: 65, maxAgeExclusive: 70 },
  age70to74: { minAgeInclusive: 70, maxAgeExclusive: 75 },
  age75plus: { minAgeInclusive: 75, maxAgeExclusive: Infinity },
};

/**
 * The bands the taxpayer's age-keyed rules are written on, each transcribing its source's
 * 以上/未満 wording, except where the module that owns the rule exports the band itself. These
 * are the rules' own boundaries, not choices anyone selects: the DEV block at the end of this
 * module rejects any {@link TaxpayerAgeRange} that only partly falls inside one of them, since no
 * single answer would hold for everyone who picked that range.
 */
export const STATUTORY_AGE_BANDS = {
  longTermCareCategory2: { minAgeInclusive: 40, maxAgeExclusive: 65 },
  longTermCareCategory1: { minAgeInclusive: 65 },
  nationalPension: { minAgeInclusive: 20, maxAgeExclusive: 60 },
  employeesPension: { maxAgeExclusive: 70 },
  latterStageElderly: { minAgeInclusive: 75 },
  publicPensionDeductionElderly: PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
  elderlyDependentIncomeThreshold: { minAgeInclusive: 60 },
} satisfies Record<string, AgeBand>;

/**
 * The ages the taxpayer's chosen {@link ageRange} spans, for the rules that take an
 * {@link AgeRange} because they serve the taxpayer and the dependents alike.
 */
export function taxpayerAgeRangeBounds(ageRange: TaxpayerAgeRange): AgeRange {
  return TAXPAYER_AGE_RANGE_BOUNDS[ageRange];
}

/** Whether every age the taxpayer's chosen {@link ageRange} spans falls inside {@link band}. */
export function taxpayerAgeCoversBand(ageRange: TaxpayerAgeRange, band: AgeBand): boolean {
  return ageRangeCoversBand(taxpayerAgeRangeBounds(ageRange), band);
}

/**
 * Whether the person is a 介護保険第2号被保険者, whose long-term care premiums are
 * collected as part of health insurance premiums. From age 65 the premiums are billed
 * directly by the municipality instead (see {@link isLongTermCareCategory1Insured}).
 * Source: https://www.kyoukaikenpo.or.jp/g7/cat330/1995-298/
 */
export function isLongTermCareCategory2Insured(ageRange: TaxpayerAgeRange): boolean {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.longTermCareCategory2);
}

/**
 * Whether the person is a 介護保険第1号被保険者, whose long-term care premiums are set per
 * municipality on income tiers and billed directly — usually deducted from pension
 * payments (特別徴収). The calculator estimates the amount from the national-standard tier
 * schedule and the prefecture-average 基準額 (`estimateLongTermCareCategory1Premium` in
 * longTermCareCategory1.ts), overridable with the billed annual amount.
 * Source: https://www.city.shinjuku.lg.jp/fukushi/file07_02_00005.html
 */
export function isLongTermCareCategory1Insured(ageRange: TaxpayerAgeRange): boolean {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.longTermCareCategory1);
}

/**
 * Whether National Pension (国民年金) contributions are due when not in the employees'
 * pension system.
 * Source: https://www.nenkin.go.jp/section/faq/kokunen/seido/kanyu/seidosetsumei/20140602-01.html
 */
export function isSubjectToNationalPension(ageRange: TaxpayerAgeRange): boolean {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.nationalPension);
}

/**
 * Whether employment at an applicable workplace carries Employees' Pension (厚生年金保険)
 * enrollment.
 * Source: https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/20150518.html
 */
export function isSubjectToEmployeesPension(ageRange: TaxpayerAgeRange): boolean {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.employeesPension);
}

/**
 * Whether health coverage is the 後期高齢者医療制度, which everyone joins automatically
 * regardless of employment, so no other health insurance provider applies.
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export function isLatterStageElderly(ageRange: TaxpayerAgeRange): boolean {
  return taxpayerAgeCoversBand(ageRange, STATUTORY_AGE_BANDS.latterStageElderly);
}

if (import.meta.env.DEV) {
  assertAgeRangesDoNotCrossBands('Age range', TAXPAYER_AGE_RANGE_BOUNDS, STATUTORY_AGE_BANDS);
}
