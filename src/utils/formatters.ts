// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Creating and first using a formatter costs 30 to 70 times as much as reusing it.
const JPY_FORMATTER = new Intl.NumberFormat('en-JP', {
  style: 'currency',
  currency: 'JPY',
});
const YEN_COMPACT_FORMATTERS = new Map<string, Intl.NumberFormat>();
const PERCENT_FORMATTERS = new Map<number, Intl.NumberFormat>();

export const formatJPY = (amount: number) => JPY_FORMATTER.format(amount);

/**
 * Format a number with grouped thousands and no currency sign (e.g. 1234567 -> "1,234,567").
 * Pins the 'en' locale so grouping does not vary with the runtime locale.
 */
export const formatNumber = (n: number): string => n.toLocaleString('en');

export const formatYenCompact = (amount: number, locale: string = 'en-US') => {
  let formatter = YEN_COMPACT_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'JPY',
      notation: 'compact',
      compactDisplay: 'short',
    });
    YEN_COMPACT_FORMATTERS.set(locale, formatter);
  }
  return formatter.format(amount);
};

/**
 * Format a decimal rate as a percentage string.
 * @param rate The rate as a decimal (e.g., 0.05 for 5%).
 * @param decimals Maximum number of fraction digits. Defaults to 3.
 */
export const formatPercent = (rate: number, decimals: number = 3) => {
  let formatter = PERCENT_FORMATTERS.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-JP', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: decimals,
    });
    PERCENT_FORMATTERS.set(decimals, formatter);
  }
  return formatter.format(rate);
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
