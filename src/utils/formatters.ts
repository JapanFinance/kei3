// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream } from '../types/tax';

export const formatJPY = (amount: number) => {
  return new Intl.NumberFormat('en-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(amount)
}

export const formatYenCompact = (amount: number, locale: string = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'JPY',
    notation: 'compact',
    compactDisplay: 'short'
  }).format(amount)
}

/**
 * Returns the multiplier to convert a per-period commuting allowance amount to an annual total.
 * e.g. a monthly payment × 12 = annual; a 3-month payment × 4 = annual.
 */
export const getFrequencyAnnualMultiplier = (frequency: 'monthly' | '3-months' | '6-months' | 'annual'): number => {
  switch (frequency) {
    case 'monthly':  return 12;
    case '3-months': return 4;
    case '6-months': return 2;
    case 'annual':   return 1;
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
    maximumFractionDigits: decimals
  }).format(rate);
};
