// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  HOUSEHOLD_INCOME_DISTRIBUTIONS,
  HOUSEHOLD_TYPE_ORDER,
  QUINTILE_DATA,
  MEDIAN_INCOME_VALUE,
  DEFAULT_HOUSEHOLD_TYPE,
  type HouseholdType,
} from '../data/income';
import { estimateIncomePercentile } from '../utils/incomeDistribution';

const ALL_TYPES = Object.values(HOUSEHOLD_INCOME_DISTRIBUTIONS);

/** Solves for the income whose estimated percentile is `target`, by bisection. */
const incomeAtPercentile = (type: HouseholdType, target: number): number => {
  const { ranges } = HOUSEHOLD_INCOME_DISTRIBUTIONS[type];
  let low = 0;
  let high = 20_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (estimateIncomePercentile(mid, ranges).percentile < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

describe('household income distributions', () => {
  it('covers every household type in the selector order exactly once', () => {
    expect([...HOUSEHOLD_TYPE_ORDER].sort()).toEqual(
      Object.keys(HOUSEHOLD_INCOME_DISTRIBUTIONS).sort(),
    );
    expect(HOUSEHOLD_TYPE_ORDER[0]).toBe(DEFAULT_HOUSEHOLD_TYPE);
  });

  it.each(ALL_TYPES)('$labelJa percentages sum to ~100', ({ ranges }) => {
    const sum = ranges.reduce((total, range) => total + range.percent, 0);
    // MHLW rounds each bracket to one decimal, so the published rows land near but not on 100.
    expect(sum).toBeGreaterThanOrEqual(99.5);
    expect(sum).toBeLessThanOrEqual(100.5);
  });

  it.each(ALL_TYPES)('$labelJa brackets are contiguous and open-ended at the top', ({ ranges }) => {
    expect(ranges).toHaveLength(25);
    expect(ranges[0]!.min_inclusive).toBe(0);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.min_inclusive).toBe(ranges[i - 1]!.max_exclusive);
    }
    expect(ranges[ranges.length - 1]!.min_inclusive).toBe(20_000_000);
    expect(ranges[ranges.length - 1]!.max_exclusive).toBe(Infinity);
    expect(ranges.every(range => range.percent >= 0)).toBe(true);
  });

  // The load-bearing check on the extraction: 第０２１表 prints six household-type columns against
  // one set of bracket rows, so a column read off by one would still look plausible. Each type's
  // published 中央値 is the independent value that catches it.
  it.each(ALL_TYPES)('$labelJa interpolates to its published 中央値', ({ id, median }) => {
    // Interpolation runs slightly high against the published median, which the survey computes from
    // ungrouped responses; 10万 leaves room for that bias without admitting a wrong column, whose
    // medians differ from each other by 50万 or more.
    expect(incomeAtPercentile(id, 50)).toBeCloseTo(median, -5);
    expect(Math.abs(incomeAtPercentile(id, 50) - median)).toBeLessThanOrEqual(100_000);
  });

  it('orders the household types as the survey reports them', () => {
    // Guards against silently swapping two types' data: the survey's own medians rank this way.
    const medianOf = (type: HouseholdType) => HOUSEHOLD_INCOME_DISTRIBUTIONS[type].median;
    expect(medianOf('elderly')).toBeLessThan(medianOf('all'));
    expect(medianOf('with65Plus')).toBeLessThan(medianOf('all'));
    expect(medianOf('all')).toBeLessThan(medianOf('nonElderly'));
    expect(medianOf('nonElderly')).toBeLessThan(medianOf('withChildren'));
    expect(medianOf('singleMother')).toBeLessThan(medianOf('all'));
  });

  it('keeps 全世帯 as the exported default distribution', () => {
    expect(MEDIAN_INCOME_VALUE).toBe(4_510_000);
    expect(HOUSEHOLD_INCOME_DISTRIBUTIONS.all.median).toBe(MEDIAN_INCOME_VALUE);
  });

  it('keeps the 全世帯 五分位値 consistent with the 全世帯 distribution', () => {
    // 五分位値 are published on a 全世帯 basis only, so they should line up with that distribution
    // and no other. Tolerance is wide because the survey derives them from ungrouped responses.
    for (const [percentile, income] of Object.entries(QUINTILE_DATA)) {
      const interpolated = incomeAtPercentile('all', Number(percentile));
      expect(Math.abs(interpolated - income)).toBeLessThanOrEqual(400_000);
    }
  });
});

describe('estimateIncomePercentile', () => {
  const { ranges } = HOUSEHOLD_INCOME_DISTRIBUTIONS.all;

  it('reports zero at or below no income', () => {
    expect(estimateIncomePercentile(0, ranges).percentile).toBe(0);
    expect(estimateIncomePercentile(-1, ranges).percentile).toBe(0);
  });

  it('increases monotonically across the distribution', () => {
    let previous = -1;
    for (let income = 0; income <= 25_000_000; income += 250_000) {
      const { percentile } = estimateIncomePercentile(income, ranges);
      expect(percentile).toBeGreaterThanOrEqual(previous);
      previous = percentile;
    }
  });

  it('interpolates within a bracket rather than stepping', () => {
    const low = estimateIncomePercentile(5_100_000, ranges).percentile;
    const high = estimateIncomePercentile(5_400_000, ranges).percentile;
    expect(high).toBeGreaterThan(low);
    expect(estimateIncomePercentile(5_000_000, ranges).isTopBracket).toBe(false);
  });

  // The open-ended 2000万円以上 bracket has no width to interpolate across, so every income above
  // its floor shares one cumulative total. The flag is what lets the UI present that as a bound
  // instead of implying ¥20M and ¥100M sit at meaningfully different points.
  it.each(ALL_TYPES)('$labelJa flags the open-ended top bracket', ({ ranges: typeRanges }) => {
    const belowFloor = estimateIncomePercentile(19_999_999, typeRanges);
    expect(belowFloor.isTopBracket).toBe(false);

    const atFloor = estimateIncomePercentile(20_000_000, typeRanges);
    const wellAbove = estimateIncomePercentile(100_000_000, typeRanges);
    expect(atFloor.isTopBracket).toBe(true);
    expect(wellAbove.isTopBracket).toBe(true);
    expect(wellAbove.percentile).toBe(atFloor.percentile);
    expect(atFloor.topBracketPercent).toBe(typeRanges[typeRanges.length - 1]!.percent);
  });

  it('reports the 全世帯 top bracket as the published 2000万円以上 share', () => {
    const estimate = estimateIncomePercentile(30_000_000, ranges);
    expect(estimate.topBracketPercent).toBe(1.6);
    expect(estimate.percentile).toBeGreaterThan(97);
  });

  it('separates the household types at a working-age income', () => {
    // The complaint this data answers: at ¥6M a working-age household ranks very differently
    // against 全世帯 than against the cut that excludes 高齢者世帯.
    const income = 6_000_000;
    const all = estimateIncomePercentile(income, ranges).percentile;
    const nonElderly = estimateIncomePercentile(
      income,
      HOUSEHOLD_INCOME_DISTRIBUTIONS.nonElderly.ranges,
    ).percentile;
    const elderly = estimateIncomePercentile(
      income,
      HOUSEHOLD_INCOME_DISTRIBUTIONS.elderly.ranges,
    ).percentile;

    expect(nonElderly).toBeLessThan(all);
    expect(all).toBeLessThan(elderly);
    expect(nonElderly).toBeCloseTo(50, 0);
  });
});
