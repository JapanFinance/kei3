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
  20: 2_120_000, // 20th percentile income
  40: 3_600_000, // 40th percentile income
  60: 5_560_000, // 60th percentile income
  80: 8_590_000, // 80th percentile income
};

/** One 所得金額階級 bucket. `max_exclusive` is Infinity for the open-ended top bucket. */
export interface IncomeRange {
  min_inclusive: number;
  max_exclusive: number;
  percent: number;
}

/** The 世帯類型 cuts published alongside 全世帯. */
export type HouseholdType =
  | 'all'
  | 'elderly'
  | 'nonElderly'
  | 'with65Plus'
  | 'withChildren'
  | 'singleMother';

/** One row of 第０２１表: a bracket's upper bound (exclusive, yen) followed by the 相対度数分布
 * percentage for each household type, in `DISTRIBUTION_COLUMNS` order. */
type DistributionRow = [
  maxExclusive: number,
  all: number,
  elderly: number,
  nonElderly: number,
  with65Plus: number,
  withChildren: number,
  singleMother: number,
];

/** Which table column belongs to which household type. */
const DISTRIBUTION_COLUMNS: Record<HouseholdType, 1 | 2 | 3 | 4 | 5 | 6> = {
  all: 1,
  elderly: 2,
  nonElderly: 3,
  with65Plus: 4,
  withChildren: 5,
  singleMother: 6,
};

/** 世帯数の相対度数分布 (%) by 所得金額階級, from 所得票 第０２１表 of the 2025 統計表 on e-Stat:
 * https://www.e-stat.go.jp/stat-search/files?toukei=00450061&tstat=000001244376&cycle=7&tclass1=000001244380
 *
 * Laid out as the table prints it: one row per bracket, one column per household type. The
 * brackets run in 50万 steps to 1000万, then 1000～1100 / 1100～1200 / 1200～1500 / 1500～2000,
 * then the open-ended 2000万円以上. (The 概況's 第６表 shows the same cuts but stops at
 * 「1000万円以上」; 第０２１表 carries the same rows out to 2000万円以上, the bracket the 全世帯
 * chart has always used. 全世帯 alone gets finer 1200万〜2000万 rows swapped in from 図９ — see
 * {@link ALL_HOUSEHOLDS_TAIL_DETAIL}.)
 *
 * MHLW prints 「-」 (no applicable cases) for some 母子世帯 brackets; those are carried as 0. */
// oxfmt-ignore
const DISTRIBUTION_TABLE: readonly DistributionRow[] = [
  // upper bound   all  elderly  non-  65+ in  with  single
  //   (yen)            (高齢者) elderly household children mother
  [   500_000,  0.7,  0.9,  0.6,  0.6,  0.0,  0.0],
  [ 1_000_000,  5.1,  9.6,  2.8,  6.7,  0.6,  2.6],
  [ 1_500_000,  5.9, 10.6,  3.5,  7.7,  1.5,  6.9],
  [ 2_000_000,  6.3, 12.2,  3.2,  9.0,  1.4,  9.2],
  [ 2_500_000,  7.0, 11.5,  4.6,  9.1,  2.6, 20.5],
  [ 3_000_000,  6.5, 10.5,  4.4,  8.3,  2.3, 10.7],
  [ 3_500_000,  6.9, 10.3,  5.0,  8.5,  1.9,  8.2],
  [ 4_000_000,  6.1,  8.0,  5.1,  7.5,  2.7, 13.9],
  [ 4_500_000,  5.1,  5.1,  5.0,  5.1,  3.2,  6.6],
  [ 5_000_000,  4.5,  4.1,  4.8,  4.4,  3.9,  6.3],
  [ 5_500_000,  5.1,  3.8,  5.7,  4.6,  5.3,  4.1],
  [ 6_000_000,  4.1,  2.5,  4.9,  3.6,  5.1,  2.0],
  [ 6_500_000,  4.1,  2.0,  5.3,  3.1,  6.2,  0.8],
  [ 7_000_000,  3.3,  1.6,  4.2,  2.8,  4.7,  2.5],
  [ 7_500_000,  3.3,  1.2,  4.4,  2.2,  6.5,  0.4],
  [ 8_000_000,  2.9,  1.3,  3.7,  2.2,  5.2,  2.9],
  [ 8_500_000,  2.7,  0.5,  3.8,  1.5,  5.9,  0.5],
  [ 9_000_000,  2.3,  0.6,  3.1,  1.6,  4.4,  0.5],
  [ 9_500_000,  2.3,  0.4,  3.2,  1.3,  4.8,  0.0],
  [10_000_000,  2.0,  0.5,  2.8,  1.3,  4.0,  0.0],
  [11_000_000,  3.1,  0.6,  4.4,  2.0,  6.5,  0.0],
  [12_000_000,  2.3,  0.4,  3.3,  1.4,  5.1,  0.0],
  [15_000_000,  4.3,  0.8,  6.1,  2.8,  8.0,  1.4],
  [20_000_000,  2.6,  0.3,  3.7,  1.6,  4.8,  0.0],
  [  Infinity,  1.6,  0.4,  2.2,  1.0,  3.3,  0.0],
];

/** 図９'s finer 全世帯 tail: 1M-yen steps over 1200万〜2000万, from the 概況's
 * 図９ 所得金額階級別世帯数の相対度数分布, which publishes this detail for 全世帯 only:
 * https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/index.html
 *
 * The 12〜15M rows sum to 第０２１表's 1200～1500 bracket exactly (4.3); the 15〜20M rows sum to
 * 2.5 against 第０２１表's 2.6 — a rounding difference between the two published tables, carried
 * here as 図９ prints it rather than rescaled to match. */
// oxfmt-ignore
const ALL_HOUSEHOLDS_TAIL_DETAIL: readonly [maxExclusive: number, percent: number][] = [
  [13_000_000, 1.9],
  [14_000_000, 1.4],
  [15_000_000, 1.0],
  [16_000_000, 0.7],
  [17_000_000, 0.7],
  [18_000_000, 0.3],
  [19_000_000, 0.5],
  [20_000_000, 0.3],
];

/** Reads one household type's column off the table as bracket ranges. 全世帯 additionally swaps
 * the two coarse 1200万〜2000万 brackets for 図９'s 1M-yen steps, the finest published data;
 * the other types are only published against the shared table's brackets. */
const toRanges = (type: HouseholdType): IncomeRange[] => {
  const column = DISTRIBUTION_COLUMNS[type];
  const ranges: IncomeRange[] = DISTRIBUTION_TABLE.map((row, i) => ({
    min_inclusive: i === 0 ? 0 : DISTRIBUTION_TABLE[i - 1]![0],
    max_exclusive: row[0],
    percent: row[column],
  }));
  if (type !== 'all') return ranges;

  const finerTail: IncomeRange[] = ALL_HOUSEHOLDS_TAIL_DETAIL.map(([maxExclusive, percent], i) => ({
    min_inclusive: i === 0 ? 12_000_000 : ALL_HOUSEHOLDS_TAIL_DETAIL[i - 1]![0],
    max_exclusive: maxExclusive,
    percent,
  }));
  return [
    ...ranges.filter(range => range.max_exclusive <= 12_000_000),
    ...finerTail,
    ranges[ranges.length - 1]!,
  ];
};

export interface HouseholdIncomeDistribution {
  id: HouseholdType;
  /** Selector label, in English. The tooltip pairs this with the Japanese `labelJa`. */
  label: string;
  /** The 世帯類型 name exactly as printed in the 統計表, for the tooltip's `label (labelJa)` form. */
  labelJa: string;
  /** Definition from 用語の説明, restated in English:
   * https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/07.pdf */
  definition: string;
  /** Published 中央値, in yen. Interpolating `ranges` reproduces this to within ~5万. */
  median: number;
  ranges: IncomeRange[];
}

/** Each 世帯類型's labels, definition, published 中央値, and its column of
 * {@link DISTRIBUTION_TABLE}.
 *
 * The declaration order is the selector order ({@link HOUSEHOLD_TYPE_ORDER} derives from it):
 * 全世帯 first, then the two-way 高齢者世帯 split, the two overlapping 再掲 regroupings, then
 * 母子世帯. */
export const HOUSEHOLD_INCOME_DISTRIBUTIONS: Record<HouseholdType, HouseholdIncomeDistribution> = {
  all: {
    id: 'all',
    label: 'All households',
    labelJa: '全世帯',
    definition: 'Every surveyed household, with no restriction on age or composition.',
    median: 4_510_000,
    ranges: toRanges('all'),
  },
  elderly: {
    id: 'elderly',
    label: 'Only elderly households',
    labelJa: '高齢者世帯',
    definition:
      'Households made up only of people aged 65 or over, or of such people plus children under 18.',
    median: 2_730_000,
    ranges: toRanges('elderly'),
  },
  nonElderly: {
    id: 'nonElderly',
    label: 'Non-elderly households',
    labelJa: '高齢者世帯以外の世帯',
    definition:
      'Every household that is not a 高齢者世帯. This is not the same as a household with no older members: a household where someone under 65 lives with a person aged 65 or over is counted here.',
    median: 6_000_000,
    ranges: toRanges('nonElderly'),
  },
  with65Plus: {
    id: 'with65Plus',
    label: 'Households with elderly',
    labelJa: '65歳以上の者のいる世帯',
    definition: 'Any household with at least one member aged 65 or over.',
    median: 3_490_000,
    ranges: toRanges('with65Plus'),
  },
  withChildren: {
    id: 'withChildren',
    label: 'Households with children',
    labelJa: '児童のいる世帯',
    definition:
      'Households with at least one 児童, defined in the 2025 survey as a person under 18.',
    median: 7_660_000,
    ranges: toRanges('withChildren'),
  },
  singleMother: {
    id: 'singleMother',
    label: 'Single-mother households',
    labelJa: '母子世帯',
    definition:
      'Households made up only of a woman under 65 who has no spouse, through death, separation, or never having married, together with her children under 20, including adopted children.',
    median: 2_990_000,
    ranges: toRanges('singleMother'),
  },
};

/** Selector order for the household types, derived from the declaration order of
 * {@link HOUSEHOLD_INCOME_DISTRIBUTIONS} so the two cannot drift apart. */
export const HOUSEHOLD_TYPE_ORDER = Object.keys(
  HOUSEHOLD_INCOME_DISTRIBUTIONS,
) as readonly HouseholdType[];

/** The distribution shown until another 世帯類型 is picked. */
export const DEFAULT_HOUSEHOLD_TYPE: HouseholdType = 'all';
