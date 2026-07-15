// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Source: 2025（令和７）年 国民生活基礎調査の概況
 * 概況 PDF at https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/index.html
 *
 * The 2025 survey reports income earned over the 2024 calendar year. */
export const MEDIAN_INCOME_VALUE = 4510000;

/** Household income quintile data from 2025（令和７）年 国民生活基礎調査の概況.
 * These are the 五分位値 published in the 統計表, not the 概況 income section:
 * https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/06.pdf */
export const QUINTILE_DATA = {
  20: 2_120_000, // 20th percentile income (第Ⅰ五分位値)
  40: 3_600_000, // 40th percentile income (第Ⅱ五分位値)
  60: 5_560_000, // 60th percentile income (第Ⅲ五分位値)
  80: 8_590_000, // 80th percentile income (第Ⅳ五分位値)
};

/** Household income percentile data by income range from 2025（令和７）年 国民生活基礎調査.
 *
 * The brackets are deliberately non-uniform, because the survey publishes the range
 * where most households sit at a finer granularity than the rest:
 *
 * - Below 500万円: 50万 brackets from 第６表 各種世帯別にみた所得金額階級別世帯数の分布及び中央値
 *   (全世帯 column, 相対度数分布) in the 統計表:
 *   https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/06.pdf
 * - 500万円 and above: 100万 brackets, then 2000万円以上, from 図９ 所得金額階級別世帯数の相対度数分布
 *   in the 概況 income section. 第６表 stops at a single 1000万円以上 bracket, so it cannot
 *   supply this range.
 *
 * The two sources agree where they overlap: each pair of 50万 brackets sums to the
 * corresponding 図９ 100万 bracket (0.7 + 5.1 = 5.8, 5.9 + 6.3 = 12.2, and so on).
 *
 * Percentages sum to 99.9 due to the rounding in the published figures.
 *
 * Keys must stay integer-like strings: the percentile calculation iterates
 * Object.entries() and relies on JS ordering integer-like keys ascending. A
 * fractional key such as '0.5' would be iterated in insertion order instead and
 * silently break the cumulative total. */
export const INCOME_RANGE_DISTRIBUTION = {
  0: { min_inclusive: 0, max_exclusive: 500_000, percent: 0.7 },
  1: { min_inclusive: 500_000, max_exclusive: 1_000_000, percent: 5.1 },
  2: { min_inclusive: 1_000_000, max_exclusive: 1_500_000, percent: 5.9 },
  3: { min_inclusive: 1_500_000, max_exclusive: 2_000_000, percent: 6.3 },
  4: { min_inclusive: 2_000_000, max_exclusive: 2_500_000, percent: 7.0 },
  5: { min_inclusive: 2_500_000, max_exclusive: 3_000_000, percent: 6.5 },
  6: { min_inclusive: 3_000_000, max_exclusive: 3_500_000, percent: 6.9 },
  7: { min_inclusive: 3_500_000, max_exclusive: 4_000_000, percent: 6.1 },
  8: { min_inclusive: 4_000_000, max_exclusive: 4_500_000, percent: 5.1 },
  9: { min_inclusive: 4_500_000, max_exclusive: 5_000_000, percent: 4.5 },
  10: { min_inclusive: 5_000_000, max_exclusive: 6_000_000, percent: 9.1 },
  11: { min_inclusive: 6_000_000, max_exclusive: 7_000_000, percent: 7.5 },
  12: { min_inclusive: 7_000_000, max_exclusive: 8_000_000, percent: 6.2 },
  13: { min_inclusive: 8_000_000, max_exclusive: 9_000_000, percent: 4.9 },
  14: { min_inclusive: 9_000_000, max_exclusive: 10_000_000, percent: 4.3 },
  15: { min_inclusive: 10_000_000, max_exclusive: 11_000_000, percent: 3.1 },
  16: { min_inclusive: 11_000_000, max_exclusive: 12_000_000, percent: 2.3 },
  17: { min_inclusive: 12_000_000, max_exclusive: 13_000_000, percent: 1.9 },
  18: { min_inclusive: 13_000_000, max_exclusive: 14_000_000, percent: 1.4 },
  19: { min_inclusive: 14_000_000, max_exclusive: 15_000_000, percent: 1.0 },
  20: { min_inclusive: 15_000_000, max_exclusive: 16_000_000, percent: 0.7 },
  21: { min_inclusive: 16_000_000, max_exclusive: 17_000_000, percent: 0.7 },
  22: { min_inclusive: 17_000_000, max_exclusive: 18_000_000, percent: 0.3 },
  23: { min_inclusive: 18_000_000, max_exclusive: 19_000_000, percent: 0.5 },
  24: { min_inclusive: 19_000_000, max_exclusive: 20_000_000, percent: 0.3 },
  25: { min_inclusive: 20_000_000, max_exclusive: Infinity, percent: 1.6 },
};
