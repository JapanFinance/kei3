// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  HOUSEHOLD_INCOME_DISTRIBUTIONS,
  HOUSEHOLD_TYPE_ORDER,
  QUINTILE_DATA,
  DEFAULT_HOUSEHOLD_TYPE,
  type HouseholdType,
} from '../data/income';
import { estimateIncomePercentile, estimateIncomeAtPercentile } from '../utils/incomeDistribution';

const ALL_TYPES = Object.values(HOUSEHOLD_INCOME_DISTRIBUTIONS);

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

  // The load-bearing check on the transcription. The source table (mirrored by DISTRIBUTION_TABLE)
  // prints all six household types side by side, so a mistake that assigns one type's percentages
  // to a neighboring type still yields plausible-looking data. Each type's published 中央値 is an
  // independent number such a mix-up cannot reproduce: interpolating another type's percentages
  // misses it by 50万 or more, far outside the tolerance here.
  it.each(ALL_TYPES)('$labelJa interpolates to its published 中央値', ({ ranges, median }) => {
    // Interpolation sits slightly high of the published medians (up to +4.2万 measured across the
    // six types), because the survey computes them from ungrouped responses while the brackets
    // spread each bucket evenly; 5万 covers that bias with little room beyond it.
    const interpolated = estimateIncomeAtPercentile(50, ranges);
    expect(Math.abs(interpolated - median)).toBeLessThanOrEqual(50_000);
  });

  it('keeps the published 中央値 in the survey ranking across types', () => {
    // The checksum above ties each type's ranges to its own median, but it cannot notice two whole
    // entries being swapped, since a median travels with its ranges. Pinning the medians' relative
    // order ties each household-type id to data of the right magnitude:
    // 高齢者世帯 273 < 母子世帯 299 < 65歳以上 349 < 全世帯 451 < 高齢者世帯以外 600 < 児童 766万.
    const surveyOrder: HouseholdType[] = [
      'elderly',
      'singleMother',
      'with65Plus',
      'all',
      'nonElderly',
      'withChildren',
    ];
    for (let i = 1; i < surveyOrder.length; i++) {
      expect(HOUSEHOLD_INCOME_DISTRIBUTIONS[surveyOrder[i - 1]!].median).toBeLessThan(
        HOUSEHOLD_INCOME_DISTRIBUTIONS[surveyOrder[i]!].median,
      );
    }
  });

  it('defaults to 全世帯, whose median is the survey headline value', () => {
    expect(DEFAULT_HOUSEHOLD_TYPE).toBe('all');
    expect(HOUSEHOLD_INCOME_DISTRIBUTIONS.all.median).toBe(4_510_000);
  });
});

describe('estimateIncomePercentile', () => {
  const { ranges } = HOUSEHOLD_INCOME_DISTRIBUTIONS.all;

  it('reports zero at or below no income', () => {
    expect(estimateIncomePercentile(0, ranges).percentile).toBe(0);
    expect(estimateIncomePercentile(-1, ranges).percentile).toBe(0);
  });

  // Per type, because 母子世帯 has zero-percent brackets: the estimate must plateau across those,
  // not decrease or jump.
  it.each(ALL_TYPES)(
    '$labelJa increases monotonically across incomes',
    ({ ranges: typeRanges }) => {
      let previous = -1;
      for (let income = 0; income <= 25_000_000; income += 250_000) {
        const { percentile } = estimateIncomePercentile(income, typeRanges);
        expect(percentile).toBeGreaterThanOrEqual(previous);
        previous = percentile;
      }
    },
  );

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
    // The bound is the 24 finite brackets' sum: the published 100.1 total minus the 1.6 top share.
    // toBeCloseTo rather than toBe because summing 24 decimals accumulates float error.
    expect(estimate.percentile).toBeCloseTo(98.5, 6);
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

describe('estimateIncomeAtPercentile', () => {
  it('reports zero at or below the 0th percentile', () => {
    const { ranges } = HOUSEHOLD_INCOME_DISTRIBUTIONS.all;
    expect(estimateIncomeAtPercentile(0, ranges)).toBe(0);
    expect(estimateIncomeAtPercentile(-1, ranges)).toBe(0);
  });

  // The bands derived from these boundaries must agree with the percentile estimate exactly:
  // hovering an income inside the "40-60th" band must always estimate between 40 and 60. This
  // exactness is also what lets the 中央値 and 五分位値 checksum tests above invert through this
  // function instead of bisecting the forward estimate, so 50 is included alongside the quintiles.
  it.each(ALL_TYPES)('$labelJa inverts the forward estimate exactly', ({ ranges: typeRanges }) => {
    for (const percentile of [10, 20, 40, 50, 60, 80, 90]) {
      const income = estimateIncomeAtPercentile(percentile, typeRanges);
      const roundTrip = estimateIncomePercentile(income, typeRanges).percentile;
      expect(roundTrip).toBeCloseTo(percentile, 6);
    }
  });

  it.each(ALL_TYPES)('$labelJa quintile boundaries increase in order', ({ ranges: typeRanges }) => {
    const [q20, q40, q60, q80] = [20, 40, 60, 80].map(p =>
      estimateIncomeAtPercentile(p, typeRanges),
    );
    expect(q20).toBeGreaterThan(0);
    expect(q40).toBeGreaterThan(q20!);
    expect(q60).toBeGreaterThan(q40!);
    expect(q80).toBeGreaterThan(q60!);
    // Every type's quintiles sit below the open-ended top bracket, so none degenerate to its floor.
    expect(q80).toBeLessThan(20_000_000);
  });

  // Serves double duty: it measures the estimator on the one type where the survey publishes the
  // true 五分位値 — the bound that justifies estimating the other types' band boundaries from
  // their buckets — and it pins QUINTILE_DATA to the 全世帯 distribution it must accompany.
  it('reproduces the published 全世帯 五分位値 within 5万', () => {
    const { ranges } = HOUSEHOLD_INCOME_DISTRIBUTIONS.all;
    for (const [percentile, published] of Object.entries(QUINTILE_DATA)) {
      const estimated = estimateIncomeAtPercentile(Number(percentile), ranges);
      expect(Math.abs(estimated - published)).toBeLessThanOrEqual(50_000);
    }
  });

  it.each(ALL_TYPES)('$labelJa income increases with percentile', ({ ranges: typeRanges }) => {
    let previous = 0;
    for (let percentile = 1; percentile <= 99; percentile++) {
      const income = estimateIncomeAtPercentile(percentile, typeRanges);
      expect(income).toBeGreaterThanOrEqual(previous);
      previous = income;
    }
  });

  it('returns the top bracket floor for a percentile inside the open-ended bracket', () => {
    // 全世帯's 24 finite brackets sum to 98.5, so 99 lands inside 2000万円以上, which has no width
    // to interpolate across.
    expect(estimateIncomeAtPercentile(99, HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges)).toBe(
      20_000_000,
    );
  });

  // The rounded bucket percentages sum to 99.7-100.1, not exactly 100, so a requested percentile
  // can exceed a type's total outright. The top bracket's floor is the only supportable answer.
  it.each(ALL_TYPES)(
    '$labelJa caps at the top bracket floor beyond its total',
    ({ ranges: typeRanges }) => {
      expect(estimateIncomeAtPercentile(101, typeRanges)).toBe(20_000_000);
    },
  );
});
