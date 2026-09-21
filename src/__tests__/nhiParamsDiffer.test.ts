// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';

import {
  nhiParamsDiffer,
  type NHIParamsField,
} from '../data/nationalHealthInsurance/nhiParamsData';
import type { NationalHealthInsuranceRegionParams } from '../types/healthInsurance';
import { calculateNationalHealthInsurancePremiumWithBreakdown } from '../utils/healthInsuranceCalculator';

const BASE: NationalHealthInsuranceRegionParams = {
  regionName: 'Test',
  source: 'https://example.com/fy2025',
  medicalRate: 0.08,
  supportRate: 0.03,
  ltcRateForEligible: 0.025,
  medicalPerCapita: 30000,
  supportPerCapita: 10000,
  ltcPerCapitaForEligible: 15000,
  medicalHouseholdFlat: 20000,
  supportHouseholdFlat: 8000,
  ltcHouseholdFlatForEligible: 5000,
  medicalCap: 660000,
  supportCap: 260000,
  ltcCapForEligible: 170000,
  childSupportRate: 0.003,
  childSupportPerCapita: 1000,
  childSupportHouseholdFlat: 500,
  childSupportCap: 30000,
  nhiStandardDeduction: 430000,
};

// Periods for a region whose FY2026 differs from FY2025 only in the medical household flat.
const FLAT_ONLY_PREV: NationalHealthInsuranceRegionParams = { ...BASE };
const FLAT_ONLY_CURR: NationalHealthInsuranceRegionParams = {
  ...BASE,
  medicalHouseholdFlat: 30000,
};

vi.mock('../data/nationalHealthInsurance/nhiParamsData', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../data/nationalHealthInsurance/nhiParamsData')>();
  return {
    ...actual,
    getNHIParamsForMonth: (region: string, year: number, month: number) =>
      region === 'Test-FlatOnly'
        ? year > 2026 || (year === 2026 && month >= 3)
          ? FLAT_ONLY_CURR
          : FLAT_ONLY_PREV
        : actual.getNHIParamsForMonth(region, year, month),
  };
});

describe('nhiParamsDiffer', () => {
  it('is false for the same object and for a copy with equal values', () => {
    expect(nhiParamsDiffer(BASE, BASE)).toBe(false);
    expect(nhiParamsDiffer(BASE, { ...BASE })).toBe(false);
  });

  it('ignores the region name and source', () => {
    expect(
      nhiParamsDiffer(BASE, { ...BASE, regionName: 'Other', source: 'https://example.com/fy2026' }),
    ).toBe(false);
  });

  it.each<NHIParamsField>([
    'medicalHouseholdFlat',
    'supportHouseholdFlat',
    'ltcHouseholdFlatForEligible',
    'childSupportHouseholdFlat',
    'nhiStandardDeduction',
  ])('detects a change in %s alone', field => {
    expect(nhiParamsDiffer(BASE, { ...BASE, [field]: (BASE[field] ?? 0) + 100 })).toBe(true);
  });

  it('treats a missing field as 0', () => {
    const { childSupportHouseholdFlat: _, ...withoutFlat } = BASE;
    expect(nhiParamsDiffer(withoutFlat, { ...BASE, childSupportHouseholdFlat: 0 })).toBe(false);
    expect(nhiParamsDiffer(withoutFlat, BASE)).toBe(true);
  });

  it('compares only the given fields', () => {
    const changed = { ...BASE, supportHouseholdFlat: 9000 };
    expect(nhiParamsDiffer(BASE, changed, ['medicalRate', 'medicalHouseholdFlat'])).toBe(false);
    expect(nhiParamsDiffer(BASE, changed, ['supportRate', 'supportHouseholdFlat'])).toBe(true);
  });
});

describe('NHI fiscal-year blending when only a household flat changes', () => {
  it('blends 3/10 of the previous fiscal year with 7/10 of the current one', () => {
    const result = calculateNationalHealthInsurancePremiumWithBreakdown(
      5_000_000,
      false,
      2026,
      'Test-FlatOnly',
    );
    // (5,000,000 − 430,000) × 8% + 30,000 per capita = 395,600
    // FY2025: 395,600 + 20,000 = 415,600; FY2026: 395,600 + 30,000 = 425,600
    // 415,600 × 3/10 + 425,600 × 7/10 = 422,600
    expect(result.medicalPortion).toBe(422_600);
  });
});
