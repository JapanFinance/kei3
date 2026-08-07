// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  getLatterStageParamsForMonth,
  LATTER_STAGE_REGIONS,
} from '../data/latterStageElderlyParams';
import { calculateLatterStageElderlyPremium } from '../utils/healthInsuranceCalculator';

describe('getLatterStageParamsForMonth', () => {
  it('resolves Tokyo periods by fiscal year', () => {
    // January 2026 is still FY2025 (令和6・7年度 rates); April 2026 starts FY2026.
    expect(getLatterStageParamsForMonth('Tokyo', 2026, 0)?.medicalPerCapita).toBe(47300);
    expect(getLatterStageParamsForMonth('Tokyo', 2026, 3)?.medicalPerCapita).toBe(53300);
    expect(getLatterStageParamsForMonth('Tokyo', 2025, 3)?.medicalPerCapita).toBe(47300);
  });

  it('covers every prefecture', () => {
    expect(LATTER_STAGE_REGIONS).toHaveLength(47);
    // Spot-checks against the MHLW FY2026 table. Osaka also matches 東大阪市's own page
    // (64,931円 / 11.51%), an independent confirmation of the parsed figures.
    expect(getLatterStageParamsForMonth('Osaka', 2026, 3)?.medicalPerCapita).toBe(64931);
    expect(getLatterStageParamsForMonth('Osaka', 2026, 3)?.medicalRate).toBe(0.1151);
    expect(getLatterStageParamsForMonth('Aomori', 2026, 3)?.medicalPerCapita).toBe(50500);
  });

  it('returns undefined for an unknown region key', () => {
    expect(getLatterStageParamsForMonth('Atlantis', 2026, 3)).toBeUndefined();
  });
});

describe('calculateLatterStageElderlyPremium (Tokyo)', () => {
  it('computes the 令和6・7年度 premium for calendar 2025 without blending', () => {
    // Base: 4,000,000 − 430,000 = 3,570,000
    // Medical: floor100(47,300 + 3,570,000 × 9.67%) = floor100(392,519) = 392,500
    const result = calculateLatterStageElderlyPremium(4_000_000, 2025, 'Tokyo');
    expect(result.medicalPortion).toBe(392_500);
    expect(result.childSupportPortion).toBe(0);
    expect(result.total).toBe(392_500);
  });

  it('blends 1/3 of FY2025 and 2/3 of FY2026 for calendar 2026', () => {
    // FY2025: medical 392,500 (above); child 0.
    // FY2026: medical floor100(53,300 + 3,570,000 × 9.88%) = floor100(406,016) = 406,000
    //         child floor100(1,300 + 3,570,000 × 0.26%) = floor100(10,582) = 10,500
    // Blend (仮徴収 April-August at the previous February's amount, trued up from October;
    // identical under the 9-installment 普通徴収):
    //         medical round(392,500/3 + 406,000×2/3) = 401,500
    //         child   round(0/3 + 10,500×2/3) = 7,000
    const result = calculateLatterStageElderlyPremium(4_000_000, 2026, 'Tokyo');
    expect(result.medicalPortion).toBe(401_500);
    expect(result.childSupportPortion).toBe(7_000);
    expect(result.total).toBe(408_500);
  });

  it('applies the 賦課限度額 per portion at high income', () => {
    // 2025: medical would be ~1.94M → capped at 800,000.
    expect(calculateLatterStageElderlyPremium(20_000_000, 2025, 'Tokyo').total).toBe(800_000);

    // 2026: blended caps — medical round(800,000/3 + 850,000×2/3) = 833,333;
    // child round(0/3 + 21,000×2/3) = 14,000.
    const capped2026 = calculateLatterStageElderlyPremium(20_000_000, 2026, 'Tokyo');
    expect(capped2026.medicalPortion).toBe(833_333);
    expect(capped2026.childSupportPortion).toBe(14_000);
  });

  it('charges only the per-capita amount at zero income', () => {
    const result = calculateLatterStageElderlyPremium(0, 2025, 'Tokyo');
    expect(result.total).toBe(47_300);
  });

  it('returns a zero breakdown for an unknown region key', () => {
    expect(calculateLatterStageElderlyPremium(4_000_000, 2026, 'Atlantis').total).toBe(0);
  });
});
