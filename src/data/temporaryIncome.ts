// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Annual special deduction for temporary income (一時所得の特別控除額: ¥500,000),
 * shared across all temporary income received in the calendar year.
 * Source: Income Tax Act Art. 34(3) (所得税法第34条第3項).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1490.htm
 */
export const TEMPORARY_INCOME_SPECIAL_DEDUCTION = 500_000;

/**
 * Divisor for including net temporary income in aggregate taxable income (総所得金額: 1/2).
 * Source: Income Tax Act Art. 22(2)(ii) (所得税法第22条第2項第2号);
 * Local Tax Act Arts. 32(2) & 313(2) (地方税法第32条第2項・第313条第2項).
 */
export const TEMPORARY_INCOME_INCLUSION_DIVISOR = 2;
