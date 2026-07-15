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

/** Household income percentile data by income range from 2025（令和７）年 国民生活基礎調査の概況.
 * Mirrors 図９ 所得金額階級別世帯数の相対度数分布; percentages sum to 99.9 due to rounding. */
export const INCOME_RANGE_DISTRIBUTION = {
  0: { min_inclusive: 0, max_exclusive: 1_000_000, percent: 5.8 },
  1: { min_inclusive: 1_000_000, max_exclusive: 2_000_000, percent: 12.2 },
  2: { min_inclusive: 2_000_000, max_exclusive: 3_000_000, percent: 13.5 },
  3: { min_inclusive: 3_000_000, max_exclusive: 4_000_000, percent: 13.0 },
  4: { min_inclusive: 4_000_000, max_exclusive: 5_000_000, percent: 9.6 },
  5: { min_inclusive: 5_000_000, max_exclusive: 6_000_000, percent: 9.1 },
  6: { min_inclusive: 6_000_000, max_exclusive: 7_000_000, percent: 7.5 },
  7: { min_inclusive: 7_000_000, max_exclusive: 8_000_000, percent: 6.2 },
  8: { min_inclusive: 8_000_000, max_exclusive: 9_000_000, percent: 4.9 },
  9: { min_inclusive: 9_000_000, max_exclusive: 10_000_000, percent: 4.3 },
  10: { min_inclusive: 10_000_000, max_exclusive: 11_000_000, percent: 3.1 },
  11: { min_inclusive: 11_000_000, max_exclusive: 12_000_000, percent: 2.3 },
  12: { min_inclusive: 12_000_000, max_exclusive: 13_000_000, percent: 1.9 },
  13: { min_inclusive: 13_000_000, max_exclusive: 14_000_000, percent: 1.4 },
  14: { min_inclusive: 14_000_000, max_exclusive: 15_000_000, percent: 1.0 },
  15: { min_inclusive: 15_000_000, max_exclusive: 16_000_000, percent: 0.7 },
  16: { min_inclusive: 16_000_000, max_exclusive: 17_000_000, percent: 0.7 },
  17: { min_inclusive: 17_000_000, max_exclusive: 18_000_000, percent: 0.3 },
  18: { min_inclusive: 18_000_000, max_exclusive: 19_000_000, percent: 0.5 },
  19: { min_inclusive: 19_000_000, max_exclusive: 20_000_000, percent: 0.3 },
  20: { min_inclusive: 20_000_000, max_exclusive: Infinity, percent: 1.6 },
};
