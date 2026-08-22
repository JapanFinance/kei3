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

/** The ages an {@link AgeRange} spans, as the half-open interval the statutes use. */
interface AgeBand {
  /** 以上: the youngest age in the band. Omitted where the rule has no lower bound. */
  minAgeInclusive?: number;
  /** 未満: the first age outside the band. Omitted where the rule has no upper bound. */
  maxAgeExclusive?: number;
}

const AGE_RANGE_BOUNDS: Record<AgeRange, Required<AgeBand>> = {
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
 * The age bands the calculator's rules are written on, each transcribing its source's
 * 以上/未満 wording. The DEV block at the end of this module rejects any {@link AgeRange}
 * that only partly falls inside one of these, since no single answer would hold for
 * everyone in such a range.
 */
export const STATUTORY_AGE_BANDS = {
  longTermCareCategory2: { minAgeInclusive: 40, maxAgeExclusive: 65 },
  longTermCareCategory1: { minAgeInclusive: 65 },
  nationalPension: { minAgeInclusive: 20, maxAgeExclusive: 60 },
  employeesPension: { maxAgeExclusive: 70 },
  latterStageElderly: { minAgeInclusive: 75 },
  elderlyDependentIncomeThreshold: { minAgeInclusive: 60 },
} satisfies Record<string, AgeBand>;

/**
 * Whether every age in {@link ageRange} falls inside {@link band}. A range that only
 * partly overlaps the band is not covered, so a rule is never answered for a range on the
 * strength of its youngest or oldest member alone.
 */
export function coversAgeBand(ageRange: AgeRange, band: AgeBand): boolean {
  const { minAgeInclusive, maxAgeExclusive } = AGE_RANGE_BOUNDS[ageRange];
  return (
    minAgeInclusive >= (band.minAgeInclusive ?? 0) &&
    maxAgeExclusive <= (band.maxAgeExclusive ?? Infinity)
  );
}

/**
 * Whether the person is a 介護保険第2号被保険者, whose long-term care premiums are
 * collected as part of health insurance premiums. From age 65 the premiums are billed
 * directly by the municipality instead (see {@link isLongTermCareCategory1Insured}).
 * Source: https://www.kyoukaikenpo.or.jp/g7/cat330/1995-298/
 */
export function isLongTermCareCategory2Insured(ageRange: AgeRange): boolean {
  return coversAgeBand(ageRange, STATUTORY_AGE_BANDS.longTermCareCategory2);
}

/**
 * Whether the person is a 介護保険第1号被保険者, whose long-term care premiums are set per
 * municipality on income brackets and billed directly — usually deducted from pension
 * payments (特別徴収). The calculator cannot derive the amount, so it accepts the billed
 * annual amount as an input.
 * Source: https://www.city.shinjuku.lg.jp/fukushi/file07_02_00005.html
 */
export function isLongTermCareCategory1Insured(ageRange: AgeRange): boolean {
  return coversAgeBand(ageRange, STATUTORY_AGE_BANDS.longTermCareCategory1);
}

/**
 * Whether National Pension (国民年金) contributions are due when not in the employees'
 * pension system.
 * Source: https://www.nenkin.go.jp/section/faq/kokunen/seido/kanyu/seidosetsumei/20140602-01.html
 */
export function isSubjectToNationalPension(ageRange: AgeRange): boolean {
  return coversAgeBand(ageRange, STATUTORY_AGE_BANDS.nationalPension);
}

/**
 * Whether employment at an applicable workplace carries Employees' Pension (厚生年金保険)
 * enrollment.
 * Source: https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/20150518.html
 */
export function isSubjectToEmployeesPension(ageRange: AgeRange): boolean {
  return coversAgeBand(ageRange, STATUTORY_AGE_BANDS.employeesPension);
}

/**
 * Whether health coverage is the 後期高齢者医療制度, which everyone joins automatically
 * regardless of employment, so no other health insurance provider applies.
 * Source: https://www.gov-online.go.jp/article/202209/entry-10482.html
 */
export function isLatterStageElderly(ageRange: AgeRange): boolean {
  return coversAgeBand(ageRange, STATUTORY_AGE_BANDS.latterStageElderly);
}

if (import.meta.env.DEV) {
  for (const [bandName, band] of Object.entries<AgeBand>(STATUTORY_AGE_BANDS)) {
    const bandMin = band.minAgeInclusive ?? 0;
    const bandMax = band.maxAgeExclusive ?? Infinity;
    for (const ageRange of AGE_RANGES) {
      const { minAgeInclusive, maxAgeExclusive } = AGE_RANGE_BOUNDS[ageRange];
      const overlapsBand = minAgeInclusive < bandMax && bandMin < maxAgeExclusive;
      if (overlapsBand && !coversAgeBand(ageRange, band)) {
        throw new Error(
          `Age range ${ageRange} (${minAgeInclusive}-${maxAgeExclusive}) crosses the ${bandName} band (${bandMin}-${bandMax}), so the rule has no single answer for it. Split the range at the boundary.`,
        );
      }
    }
  }
}
