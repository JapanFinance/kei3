// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { IncomeRange } from '../data/income';

export interface IncomePercentileEstimate {
  /** Share of households below `income`, in percent. */
  percentile: number;
  /**
   * True when `income` falls in the open-ended top 所得金額階級 (2000万円以上). The survey publishes
   * no detail inside that bracket, so `percentile` is only a lower bound there and callers should
   * present it as one rather than as a point estimate.
   */
  isTopBracket: boolean;
  /** Published share of households in the open-ended top bracket, in percent. */
  topBracketPercent: number;
}

/**
 * Estimates where an income sits in a 所得金額階級別世帯数の相対度数分布, interpolating linearly
 * within the bracket that contains it.
 *
 * Interpolation runs slightly high against the published 中央値 (by roughly 2万-5万), because the
 * survey computes its median from ungrouped responses while this spreads each bracket evenly.
 */
export const estimateIncomePercentile = (
  income: number,
  ranges: readonly IncomeRange[],
): IncomePercentileEstimate => {
  const topBracket = ranges[ranges.length - 1]!;
  const topBracketPercent = topBracket.percent;

  if (income <= 0) {
    return { percentile: 0, isTopBracket: false, topBracketPercent };
  }

  let cumulativePercent = 0;

  for (const range of ranges) {
    if (income >= range.max_exclusive) {
      cumulativePercent += range.percent;
      continue;
    }
    if (income < range.min_inclusive) {
      return { percentile: cumulativePercent, isTopBracket: false, topBracketPercent };
    }

    const rangeSpan = range.max_exclusive - range.min_inclusive;
    // The open-ended top bracket has no width to interpolate across, so the cumulative total up to
    // its floor is the most the data supports: every income above the floor shares that bound.
    if (!Number.isFinite(rangeSpan)) {
      return { percentile: cumulativePercent, isTopBracket: true, topBracketPercent };
    }

    const percentWithinRange = ((income - range.min_inclusive) / rangeSpan) * range.percent;
    return {
      percentile: cumulativePercent + percentWithinRange,
      isTopBracket: false,
      topBracketPercent,
    };
  }

  // ranges ends with an open-ended bracket, so the loop always returns before falling through.
  throw new Error(`Income ${income} is not within the distribution's range`);
};
