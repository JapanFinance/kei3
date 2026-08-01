// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Taxpayer age ranges, in ascending order. Each boundary changes at least one calculation:
 * 18 (未成年者 residence-tax non-taxation), 20 and 60 (国民年金 enrollment), 40 and 65
 * (介護保険 premium collection: 第2号 via health insurance, 第1号 billed directly), 70
 * (厚生年金保険 enrollment), 75 (health coverage moves to the 後期高齢者医療制度).
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export const AGE_RANGES = [
  'under18',
  'age18to19',
  'age20to39',
  'age40to59',
  'age60to64',
  'age65to69',
  'age70to74',
  'age75plus',
] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

export const DEFAULT_AGE_RANGE: AgeRange = 'age20to39';

/** Dropdown labels for each {@link AgeRange}. */
export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  under18: 'Under 18',
  age18to19: '18-19',
  age20to39: '20-39',
  age40to59: '40-59',
  age60to64: '60-64',
  age65to69: '65-69',
  age70to74: '70-74',
  age75plus: '75+',
};

/**
 * Whether long-term care insurance premiums (介護保険料) are collected as part of health
 * insurance premiums: ages 40-64 (介護保険第2号被保険者). From age 65 the premiums are
 * billed directly by the municipality instead (see {@link isLongTermCareCategory1Insured}).
 * Source: https://www.kyoukaikenpo.or.jp/g7/cat330/1995-298/
 */
export function isSubjectToLongTermCarePremium(ageRange: AgeRange): boolean {
  return ageRange === 'age40to59' || ageRange === 'age60to64';
}

/**
 * Whether the person is a 介護保険第1号被保険者 (ages 65 and over), whose long-term care
 * premiums are set per municipality on income brackets and billed directly — usually
 * deducted from pension payments (特別徴収). The calculator cannot derive the amount, so
 * it accepts the billed annual amount as an input.
 * Source: https://www.city.shinjuku.lg.jp/fukushi/file07_02_00005.html
 */
export function isLongTermCareCategory1Insured(ageRange: AgeRange): boolean {
  return ageRange === 'age65to69' || ageRange === 'age70to74' || ageRange === 'age75plus';
}

/**
 * Whether National Pension (国民年金) contributions are due when not in the employees'
 * pension system: enrollment covers ages 20 through 59 (20歳以上60歳未満).
 * Source: https://www.nenkin.go.jp/section/faq/kokunen/seido/kanyu/seidosetsumei/20140602-01.html
 */
export function isSubjectToNationalPension(ageRange: AgeRange): boolean {
  return ageRange === 'age20to39' || ageRange === 'age40to59';
}

/**
 * Whether employment at an applicable workplace carries Employees' Pension (厚生年金保険)
 * enrollment: everyone under age 70, with no lower age bound.
 * Source: https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/20150518.html
 */
export function isSubjectToEmployeesPension(ageRange: AgeRange): boolean {
  return ageRange !== 'age70to74' && ageRange !== 'age75plus';
}

/**
 * Whether health coverage is the 後期高齢者医療制度: from age 75, everyone moves to it
 * automatically regardless of employment, so no other health insurance provider applies.
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export function isLatterStageElderly(ageRange: AgeRange): boolean {
  return ageRange === 'age75plus';
}

/**
 * Whether the selected range means the taxpayer is 65 or older by the end of the income year —
 * the boundary the public pension deduction's higher minimums use (租税特別措置法第41条の15の3,
 * judged as of December 31 of the income year, matching how the ranges are selected). A plain
 * age fact rather than a rule of any one statute, so other year-end 65 tests may share it.
 */
export function isAge65OrOlder(ageRange: AgeRange): boolean {
  return ageRange === 'age65to69' || ageRange === 'age70to74' || ageRange === 'age75plus';
}

/**
 * Whether the taxpayer is a minor (未成年者) for residence-tax purposes. Minors whose
 * 合計所得金額 is at or below the statutory limit are exempt from residence tax entirely;
 * the income test lives with the residence-tax calculation.
 * Source: https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju#gaiyo_06
 */
export function isResidenceTaxMinor(ageRange: AgeRange): boolean {
  return ageRange === 'under18';
}
