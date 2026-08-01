// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Taxpayer age ranges, in ascending order. Each boundary changes at least one calculation:
 * 18 (未成年者 residence-tax non-taxation), 20 and 60 (国民年金 enrollment), 40
 * (介護保険第2号被保険者 premiums via health insurance).
 * Ages 65 and over are not supported: from 65, long-term care premiums switch to the
 * separately billed 第1号被保険者 system, and from 75 health coverage moves to the
 * 後期高齢者医療制度 — neither premium system is modeled yet.
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export const AGE_RANGES = ['under18', 'age18to19', 'age20to39', 'age40to59', 'age60to64'] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

export const DEFAULT_AGE_RANGE: AgeRange = 'age20to39';

/** Dropdown labels for each {@link AgeRange}. */
export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  under18: 'Under 18',
  age18to19: '18-19',
  age20to39: '20-39',
  age40to59: '40-59',
  age60to64: '60-64',
};

/**
 * Whether long-term care insurance premiums (介護保険料) are collected as part of health
 * insurance premiums: ages 40-64 (介護保険第2号被保険者). From age 65 (第1号被保険者) the
 * premiums are billed separately by the municipality and are not modeled by the calculator.
 * Source: https://www.kyoukaikenpo.or.jp/g7/cat330/1995-298/
 */
export function isSubjectToLongTermCarePremium(ageRange: AgeRange): boolean {
  return ageRange === 'age40to59' || ageRange === 'age60to64';
}

/**
 * Whether National Pension (国民年金) contributions are due when not in the employees'
 * pension system: enrollment covers ages 20 through 59 (20歳以上60歳未満).
 * Source: https://www.nenkin.go.jp/section/faq/kokunen/seido/kanyu/seidosetsumei/20140602-01.html
 */
export function isSubjectToNationalPension(ageRange: AgeRange): boolean {
  return ageRange === 'age20to39' || ageRange === 'age40to59';
}
