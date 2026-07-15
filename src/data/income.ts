// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Source: 2025（令和７）年 国民生活基礎調査
 * 概況 at https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/index.html
 *
 * The 2025 survey reports income earned over the 2024 calendar year. */

/** Household income quintile data from 2025（令和７）年 国民生活基礎調査.
 * These are the 五分位値 published in 第５表 of the 統計表:
 * https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/06.pdf
 *
 * 五分位値 divide the whole surveyed population, so they exist on a 全世帯 basis only. 第５表
 * reports how each 世帯類型 spreads across these fixed bands rather than giving each type its own
 * boundaries, so these values must not be paired with a household-type distribution. */
export const QUINTILE_DATA = {
  20: 2_120_000, // 20th percentile income (第Ⅰ五分位値)
  40: 3_600_000, // 40th percentile income (第Ⅱ五分位値)
  60: 5_560_000, // 60th percentile income (第Ⅲ五分位値)
  80: 8_590_000, // 80th percentile income (第Ⅳ五分位値)
};

/** One 所得金額階級 bucket. `max_exclusive` is Infinity for the open-ended top bucket. */
export interface IncomeRange {
  min_inclusive: number;
  max_exclusive: number;
  percent: number;
}

/** The 世帯類型 cuts published alongside 全世帯. */
export type HouseholdType =
  'all' | 'elderly' | 'nonElderly' | 'with65Plus' | 'withChildren' | 'singleMother';

/** Upper bound (exclusive) of each 所得金額階級, in yen.
 *
 * Every household type is tabulated against these same 25 brackets: 50万 steps to 1000万, then
 * 1000～1100 / 1100～1200 / 1200～1500 / 1500～2000, then the open-ended 2000万円以上. */
const BRACKET_MAX_EXCLUSIVE: readonly number[] = [
  500_000,
  1_000_000,
  1_500_000,
  2_000_000,
  2_500_000,
  3_000_000,
  3_500_000,
  4_000_000,
  4_500_000,
  5_000_000,
  5_500_000,
  6_000_000,
  6_500_000,
  7_000_000,
  7_500_000,
  8_000_000,
  8_500_000,
  9_000_000,
  9_500_000,
  10_000_000,
  11_000_000,
  12_000_000,
  15_000_000,
  20_000_000,
  Infinity,
];

/** Pairs a type's 相対度数分布 row with the shared bracket edges.
 *
 * MHLW prints 「-」 (no applicable cases) for some 母子世帯 brackets; those are carried as 0. */
const toRanges = (percents: readonly number[]): IncomeRange[] => {
  if (percents.length !== BRACKET_MAX_EXCLUSIVE.length) {
    throw new Error(
      `Expected ${BRACKET_MAX_EXCLUSIVE.length} bracket percentages, received ${percents.length}`,
    );
  }
  return percents.map((percent, i) => ({
    min_inclusive: i === 0 ? 0 : BRACKET_MAX_EXCLUSIVE[i - 1]!,
    max_exclusive: BRACKET_MAX_EXCLUSIVE[i]!,
    percent,
  }));
};

export interface HouseholdIncomeDistribution {
  id: HouseholdType;
  /** Selector label: English wording followed by the official Japanese 世帯類型 name. */
  label: string;
  /** Same wording as `label`, cased to sit mid-sentence ("…higher than ~50% of {sentenceLabel}"). */
  sentenceLabel: string;
  /** The 世帯類型 name exactly as printed in the 統計表. */
  labelJa: string;
  /** Definition from 用語の説明, restated in English:
   * https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/07.pdf */
  definition: string;
  /** Published 中央値, in yen. Interpolating `ranges` reproduces this to within ~5万. */
  median: number;
  ranges: IncomeRange[];
}

/** 世帯数の相対度数分布 (%) per 世帯類型, from 所得票 第０２１表 of the 2025 統計表 on e-Stat:
 * https://www.e-stat.go.jp/stat-search/files?toukei=00450061&tstat=000001244376&cycle=7&tclass1=000001244380
 *
 * The 概況's 第６表 shows the same cuts but stops at 「1000万円以上」; 第０２１表 carries the same
 * rows out to 2000万円以上, the bracket the 全世帯 chart has always used.
 *
 * Ordered for the selector: 全世帯 first, then the two-way 高齢者世帯 split, then the two 再掲
 * regroupings, then 母子世帯. */
export const HOUSEHOLD_INCOME_DISTRIBUTIONS: Record<HouseholdType, HouseholdIncomeDistribution> = {
  all: {
    id: 'all',
    label: 'All households (全世帯)',
    sentenceLabel: 'all households (全世帯)',
    labelJa: '全世帯',
    definition: 'Every surveyed household, with no restriction on age or composition.',
    median: 4_510_000,
    ranges: toRanges([
      0.7, 5.1, 5.9, 6.3, 7.0, 6.5, 6.9, 6.1, 5.1, 4.5, 5.1, 4.1, 4.1, 3.3, 3.3, 2.9, 2.7, 2.3, 2.3,
      2.0, 3.1, 2.3, 4.3, 2.6, 1.6,
    ]),
  },
  elderly: {
    id: 'elderly',
    label: 'Elderly households (高齢者世帯)',
    sentenceLabel: 'elderly households (高齢者世帯)',
    labelJa: '高齢者世帯',
    definition:
      'Households made up only of people aged 65 or over, or of such people plus children under 18.',
    median: 2_730_000,
    ranges: toRanges([
      0.9, 9.6, 10.6, 12.2, 11.5, 10.5, 10.3, 8.0, 5.1, 4.1, 3.8, 2.5, 2.0, 1.6, 1.2, 1.3, 0.5, 0.6,
      0.4, 0.5, 0.6, 0.4, 0.8, 0.3, 0.4,
    ]),
  },
  nonElderly: {
    id: 'nonElderly',
    label: 'Non-elderly households (高齢者世帯以外の世帯)',
    sentenceLabel: 'non-elderly households (高齢者世帯以外の世帯)',
    labelJa: '高齢者世帯以外の世帯',
    definition:
      'Every household that is not a 高齢者世帯. This is not the same as a household with no older members: a household where someone under 65 lives with a person aged 65 or over is counted here.',
    median: 6_000_000,
    ranges: toRanges([
      0.6, 2.8, 3.5, 3.2, 4.6, 4.4, 5.0, 5.1, 5.0, 4.8, 5.7, 4.9, 5.3, 4.2, 4.4, 3.7, 3.8, 3.1, 3.2,
      2.8, 4.4, 3.3, 6.1, 3.7, 2.2,
    ]),
  },
  with65Plus: {
    id: 'with65Plus',
    label: 'Households with a member aged 65 or over (65歳以上の者のいる世帯)',
    sentenceLabel: 'households with a member aged 65 or over (65歳以上の者のいる世帯)',
    labelJa: '65歳以上の者のいる世帯',
    definition:
      'Any household with at least one member aged 65 or over. Published as a 再掲 (regrouping), so it overlaps both 高齢者世帯 and 高齢者世帯以外の世帯.',
    median: 3_490_000,
    ranges: toRanges([
      0.6, 6.7, 7.7, 9.0, 9.1, 8.3, 8.5, 7.5, 5.1, 4.4, 4.6, 3.6, 3.1, 2.8, 2.2, 2.2, 1.5, 1.6, 1.3,
      1.3, 2.0, 1.4, 2.8, 1.6, 1.0,
    ]),
  },
  withChildren: {
    id: 'withChildren',
    label: 'Households with children (児童のいる世帯)',
    sentenceLabel: 'households with children (児童のいる世帯)',
    labelJa: '児童のいる世帯',
    definition:
      'Households with at least one 児童, defined in the 2025 survey as a person under 18. Published as a 再掲 (regrouping).',
    median: 7_660_000,
    ranges: toRanges([
      0.0, 0.6, 1.5, 1.4, 2.6, 2.3, 1.9, 2.7, 3.2, 3.9, 5.3, 5.1, 6.2, 4.7, 6.5, 5.2, 5.9, 4.4, 4.8,
      4.0, 6.5, 5.1, 8.0, 4.8, 3.3,
    ]),
  },
  singleMother: {
    id: 'singleMother',
    label: 'Single-mother households (母子世帯)',
    sentenceLabel: 'single-mother households (母子世帯)',
    labelJa: '母子世帯',
    definition:
      'Households made up only of a woman under 65 who has no spouse, through death, separation, or never having married, together with her children under 20, including adopted children.',
    median: 2_990_000,
    ranges: toRanges([
      0.0, 2.6, 6.9, 9.2, 20.5, 10.7, 8.2, 13.9, 6.6, 6.3, 4.1, 2.0, 0.8, 2.5, 0.4, 2.9, 0.5, 0.5,
      0.0, 0.0, 0.0, 0.0, 1.4, 0.0, 0.0,
    ]),
  },
};

/** Selector order for the household-type distributions. */
export const HOUSEHOLD_TYPE_ORDER: readonly HouseholdType[] = [
  'all',
  'elderly',
  'nonElderly',
  'with65Plus',
  'withChildren',
  'singleMother',
];

/** The distribution shown until another 世帯類型 is picked. */
export const DEFAULT_HOUSEHOLD_TYPE: HouseholdType = 'all';

/** 全世帯 中央値, in yen. */
export const MEDIAN_INCOME_VALUE = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.median;

/** 全世帯 相対度数分布. */
export const INCOME_RANGE_DISTRIBUTION = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges;
