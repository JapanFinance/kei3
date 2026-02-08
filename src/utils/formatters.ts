// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
