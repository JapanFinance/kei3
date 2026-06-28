// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { calculateEarthquakeInsuranceDeduction } from '../data/insuranceDeductions';

describe('calculateEarthquakeInsuranceDeduction — earthquake portion', () => {
  it('deducts the full premium nationally and half for residence, each capped', () => {
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 30_000, longTermOld: 0 })).toEqual({
      national: 30_000,
      residence: 15_000,
    });
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 50_000, longTermOld: 0 })).toEqual({
      national: 50_000,
      residence: 25_000,
    });
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 80_000, longTermOld: 0 })).toEqual({
      national: 50_000,
      residence: 25_000,
    });
  });
});

describe('calculateEarthquakeInsuranceDeduction — 旧長期損害保険料 portion', () => {
  it('applies the old long-term bands', () => {
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 0, longTermOld: 10_000 })).toEqual({
      national: 10_000,
      residence: 7_500,
    });
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 0, longTermOld: 20_000 })).toEqual({
      national: 15_000,
      residence: 10_000,
    });
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 0, longTermOld: 30_000 })).toEqual({
      national: 15_000,
      residence: 10_000,
    });
  });
});

describe('calculateEarthquakeInsuranceDeduction — combined and edge cases', () => {
  it('sums the two portions under the cap', () => {
    expect(
      calculateEarthquakeInsuranceDeduction({ earthquake: 20_000, longTermOld: 10_000 }),
    ).toEqual({ national: 30_000, residence: 17_500 });
  });

  it('caps the combined deduction at the overall maximum', () => {
    expect(
      calculateEarthquakeInsuranceDeduction({ earthquake: 50_000, longTermOld: 30_000 }),
    ).toEqual({ national: 50_000, residence: 25_000 });
  });

  it('rounds the residence half up to the next yen', () => {
    // 25,001 / 2 = 12,500.5 → 12,501 (1円未満切上げ convention).
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 25_001, longTermOld: 0 })).toEqual({
      national: 25_001,
      residence: 12_501,
    });
  });

  it('returns zero for empty input', () => {
    expect(calculateEarthquakeInsuranceDeduction({ earthquake: 0, longTermOld: 0 })).toEqual({
      national: 0,
      residence: 0,
    });
  });
});
