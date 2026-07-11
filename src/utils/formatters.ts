// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream } from '../types/tax';

export const formatJPY = (amount: number) => {
  return new Intl.NumberFormat('en-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
};

/**
 * Format a number with grouped thousands and no currency sign (e.g. 1234567 -> "1,234,567").
 * Pins the 'en' locale so grouping does not vary with the runtime locale.
 */
export const formatNumber = (n: number): string => n.toLocaleString('en');

export const formatYenCompact = (amount: number, locale: string = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'JPY',
    notation: 'compact',
    compactDisplay: 'short',
  }).format(amount);
};

/**
 * Returns the multiplier to convert a per-period commuting allowance amount to an annual total.
 * e.g. a monthly payment × 12 = annual; a 3-month payment × 4 = annual.
 */
export const getFrequencyAnnualMultiplier = (
  frequency: 'monthly' | '3-months' | '6-months' | 'annual',
): number => {
  switch (frequency) {
    case 'monthly':
      return 12;
    case '3-months':
      return 4;
    case '6-months':
      return 2;
    case 'annual':
      return 1;
  }
};

/**
 * Returns the annualized amount for a commuting allowance income stream.
 */
export const getCommutingAllowanceAnnualAmount = (stream: CommutingAllowanceIncomeStream): number =>
  stream.amount * getFrequencyAnnualMultiplier(stream.frequency);

/**
 * Format a decimal rate as a percentage string.
 * @param rate The rate as a decimal (e.g., 0.05 for 5%).
 * @param decimals Maximum number of fraction digits. Defaults to 3.
 */
export const formatPercent = (rate: number, decimals: number = 3) => {
  return new Intl.NumberFormat('en-JP', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  }).format(rate);
};

/**
 * Format a zero-based month index (0 = January) as its short English name.
 *
 * @param monthIndex - Zero-based month index (0 = January, 11 = December).
 *
 * @remarks
 * Builds the date with a fixed safe day (the 1st) so the result never depends
 * on the current date. Seeding from `new Date()` and calling `setMonth` can
 * roll into the next month when today's day-of-month exceeds the target
 * month's length (e.g. the 31st with February), so avoid that pattern here.
 */
export const formatMonthShort = (monthIndex: number): string =>
  new Date(2000, monthIndex, 1).toLocaleString('en', { month: 'short' });

/**
 * Format a zero-based month index (0 = January) as its full English name.
 *
 * @param monthIndex - Zero-based month index (0 = January, 11 = December).
 *
 * @remarks
 * Builds the date with a fixed safe day (the 1st) so the result never depends
 * on the current date. Seeding from `new Date()` and calling `setMonth` can
 * roll into the next month when today's day-of-month exceeds the target
 * month's length (e.g. the 31st with February), so avoid that pattern here.
 */
export const formatMonthLong = (monthIndex: number): string =>
  new Date(2000, monthIndex, 1).toLocaleString('en', { month: 'long' });
