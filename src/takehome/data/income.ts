// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Source: 2024（令和６）年 国民生活基礎調査の概況
 * 概況 PDF at https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa24/index.html */
export const MEDIAN_INCOME_VALUE = 4100000;

/** Household income quintile data from 2024（令和６）年 国民生活基礎調査の概況 */
export const QUINTILE_DATA = {
    20: 1_910_000,  // 20th percentile income
    40: 3_260_000,  // 40th percentile income
    60: 5_120_000,  // 60th percentile income
    80: 8_000_000,  // 80th percentile income
};

/** Household income percentile data by income range from 2024（令和６）年 国民生活基礎調査の概況 */
export const INCOME_RANGE_DISTRIBUTION = {
    0: { min_inclusive: 0, max_exclusive: 1_000_000, percent: 6.7 },
    1: { min_inclusive: 1_000_000, max_exclusive: 2_000_000, percent: 14.4 },
    2: { min_inclusive: 2_000_000, max_exclusive: 3_000_000, percent: 14.4 },
    3: { min_inclusive: 3_000_000, max_exclusive: 4_000_000, percent: 13.1 },
    4: { min_inclusive: 4_000_000, max_exclusive: 5_000_000, percent: 9.9 },
    5: { min_inclusive: 5_000_000, max_exclusive: 6_000_000, percent: 8.5 },
    6: { min_inclusive: 6_000_000, max_exclusive: 7_000_000, percent: 7.6 },
    7: { min_inclusive: 7_000_000, max_exclusive: 8_000_000, percent: 5.4 },
    8: { min_inclusive: 8_000_000, max_exclusive: 9_000_000, percent: 4.4 },
    9: { min_inclusive: 9_000_000, max_exclusive: 10_000_000, percent: 3.3 },
    10: { min_inclusive: 10_000_000, max_exclusive: 11_000_000, percent: 2.8 },
    11: { min_inclusive: 11_000_000, max_exclusive: 12_000_000, percent: 2.0 },
    12: { min_inclusive: 12_000_000, max_exclusive: 13_000_000, percent: 1.6 },
    13: { min_inclusive: 13_000_000, max_exclusive: 14_000_000, percent: 1.0 },
    14: { min_inclusive: 14_000_000, max_exclusive: 15_000_000, percent: 0.9 },
    15: { min_inclusive: 15_000_000, max_exclusive: 16_000_000, percent: 0.8 },
    16: { min_inclusive: 16_000_000, max_exclusive: 17_000_000, percent: 0.6 },
    17: { min_inclusive: 17_000_000, max_exclusive: 18_000_000, percent: 0.4 },
    18: { min_inclusive: 18_000_000, max_exclusive: 19_000_000, percent: 0.4 },
    19: { min_inclusive: 19_000_000, max_exclusive: 20_000_000, percent: 0.4 },
    20: { min_inclusive: 20_000_000, max_exclusive: Infinity, percent: 1.4 },
};
