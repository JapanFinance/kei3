// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { calculateEstimatedIncomePercentile } from '../components/TakeHomeCalculator/TakeHomeChart';
import { INCOME_RANGE_DISTRIBUTION, MEDIAN_INCOME_VALUE } from '../data/income';

const RANGES = Object.values(INCOME_RANGE_DISTRIBUTION);

/** Cumulative percent below each bracket's lower bound. */
const cumulativeBelow = (index: number): number =>
  RANGES.slice(0, index).reduce((sum, range) => sum + range.percent, 0);

describe('INCOME_RANGE_DISTRIBUTION', () => {
  it('sums to the published total of 99.9 (the survey rounds each bracket)', () => {
    const total = RANGES.reduce((sum, range) => sum + range.percent, 0);
    expect(total).toBeCloseTo(99.9, 5);
  });

  it('is iterated in ascending order by the percentile calculation', () => {
    // The calculation walks Object.entries() and accumulates as it goes, so it
    // depends on the keys being integer-like and therefore iterated ascending.
    // A fractional key such as '0.5' would silently reorder this.
    const keys = Object.keys(INCOME_RANGE_DISTRIBUTION);
    const numericKeys = keys.map(Number);

    // Integer-like: every key survives a String(Number(key)) round trip.
    expect(keys).toEqual(numericKeys.map(String));
    expect(numericKeys).toEqual([...numericKeys].sort((a, b) => a - b));
  });

  it('covers the whole income axis with contiguous, non-empty brackets', () => {
    expect(RANGES[0]!.min_inclusive).toBe(0);
    expect(RANGES[RANGES.length - 1]!.max_exclusive).toBe(Infinity);

    RANGES.forEach((range, index) => {
      expect(range.max_exclusive).toBeGreaterThan(range.min_inclusive);
      if (index > 0) {
        expect(range.min_inclusive).toBe(RANGES[index - 1]!.max_exclusive);
      }
    });
  });

  it('uses 50万 brackets below ¥5M and 100万 brackets above, as published', () => {
    const widthsBelow5M = RANGES.filter(r => r.max_exclusive <= 5_000_000).map(
      r => r.max_exclusive - r.min_inclusive,
    );
    const widthsAbove5M = RANGES.filter(
      r => r.min_inclusive >= 5_000_000 && r.max_exclusive !== Infinity,
    ).map(r => r.max_exclusive - r.min_inclusive);

    expect(widthsBelow5M).toEqual(Array(10).fill(500_000));
    expect(widthsAbove5M).toEqual(Array(15).fill(1_000_000));
  });

  it('reconciles the 第６表 50万 brackets against the 図９ 100万 buckets', () => {
    // Each adjacent pair of 50万 brackets from the 統計表 must sum to the
    // corresponding 100万 bucket published in 図９ of the 概況.
    const zu9BucketsBelow5M = [5.8, 12.2, 13.5, 13.0, 9.6];

    zu9BucketsBelow5M.forEach((expected, bucket) => {
      const lower = RANGES[bucket * 2]!;
      const upper = RANGES[bucket * 2 + 1]!;
      expect(lower.percent + upper.percent).toBeCloseTo(expected, 5);
    });
  });
});

describe('calculateEstimatedIncomePercentile', () => {
  it('returns 0 at or below zero income', () => {
    expect(calculateEstimatedIncomePercentile(0)).toBe(0);
    expect(calculateEstimatedIncomePercentile(-1)).toBe(0);
  });

  it('returns the cumulative total at every bracket boundary', () => {
    RANGES.forEach((range, index) => {
      expect(calculateEstimatedIncomePercentile(range.min_inclusive)).toBeCloseTo(
        cumulativeBelow(index),
        5,
      );
    });
  });

  it('interpolates across a 50万 bracket using its own width', () => {
    // ¥4,250,000 is the midpoint of the 400～450万 bracket (5.1%), so it must add
    // half of 5.1. Assuming a uniform 100万 width would add only a quarter of it.
    const index = RANGES.findIndex(r => r.min_inclusive === 4_000_000);
    const expected = cumulativeBelow(index) + 0.5 * RANGES[index]!.percent;

    expect(calculateEstimatedIncomePercentile(4_250_000)).toBeCloseTo(expected, 5);
    expect(calculateEstimatedIncomePercentile(4_250_000)).toBeCloseTo(47.05, 5);
  });

  it('interpolates across a 100万 bracket using its own width', () => {
    // ¥5,500,000 is the midpoint of the 500～600万 bracket (9.1%).
    const index = RANGES.findIndex(r => r.min_inclusive === 5_000_000);
    const expected = cumulativeBelow(index) + 0.5 * RANGES[index]!.percent;

    expect(calculateEstimatedIncomePercentile(5_500_000)).toBeCloseTo(expected, 5);
    expect(calculateEstimatedIncomePercentile(5_500_000)).toBeCloseTo(58.65, 5);
  });

  it('scales interpolation by bracket width rather than a fixed step', () => {
    // Quarter-way into a 50万 bracket and quarter-way into a 100万 bracket must
    // each add a quarter of their own bracket, despite the differing widths.
    const fineIndex = RANGES.findIndex(r => r.min_inclusive === 4_000_000);
    const coarseIndex = RANGES.findIndex(r => r.min_inclusive === 5_000_000);

    expect(calculateEstimatedIncomePercentile(4_125_000)).toBeCloseTo(
      cumulativeBelow(fineIndex) + 0.25 * RANGES[fineIndex]!.percent,
      5,
    );
    expect(calculateEstimatedIncomePercentile(5_250_000)).toBeCloseTo(
      cumulativeBelow(coarseIndex) + 0.25 * RANGES[coarseIndex]!.percent,
      5,
    );
  });

  it('stays continuous across the ¥5M seam where the bracket width changes', () => {
    const atSeam = calculateEstimatedIncomePercentile(5_000_000);
    const justBelow = calculateEstimatedIncomePercentile(4_999_999);
    const justAbove = calculateEstimatedIncomePercentile(5_000_001);

    expect(atSeam).toBeCloseTo(54.1, 5);
    expect(justBelow).toBeCloseTo(atSeam, 3);
    expect(justAbove).toBeCloseTo(atSeam, 3);
    expect(justBelow).toBeLessThan(atSeam);
    expect(justAbove).toBeGreaterThan(atSeam);
  });

  it('stays continuous across every bracket boundary', () => {
    RANGES.slice(1).forEach((range, index) => {
      const boundary = range.min_inclusive;
      expect(calculateEstimatedIncomePercentile(boundary - 1)).toBeCloseTo(
        cumulativeBelow(index + 1),
        3,
      );
    });
  });

  it('increases monotonically with income', () => {
    let previous = -1;
    for (let income = 0; income <= 20_000_000; income += 100_000) {
      const percentile = calculateEstimatedIncomePercentile(income);
      expect(percentile).toBeGreaterThanOrEqual(previous);
      previous = percentile;
    }
  });

  it('places the published median household income near the 50th percentile', () => {
    // 中央値 451万円 is published alongside the brackets in 第６表, so interpolating
    // the brackets at that income should land close to 50%.
    expect(calculateEstimatedIncomePercentile(MEDIAN_INCOME_VALUE)).toBeCloseTo(50, 0);
  });

  it('does not interpolate within the open-ended top bracket', () => {
    // Pre-existing behaviour: the top bracket's span is Infinity, so any income at
    // or above ¥20M reports the cumulative total at ¥20M instead of interpolating.
    const cumulativeAt20M = cumulativeBelow(RANGES.length - 1);

    expect(calculateEstimatedIncomePercentile(20_000_000)).toBeCloseTo(cumulativeAt20M, 5);
    expect(calculateEstimatedIncomePercentile(100_000_000)).toBeCloseTo(cumulativeAt20M, 5);
    expect(cumulativeAt20M).toBeCloseTo(98.3, 5);
  });
});
