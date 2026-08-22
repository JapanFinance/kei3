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
    expect(new Set(LATTER_STAGE_REGIONS).size).toBe(47);
    // Spot-checks against the MHLW FY2026 table. Osaka also matches 東大阪市's own page
    // (64,931円 / 11.51%), an independent confirmation of the parsed figures.
    expect(getLatterStageParamsForMonth('Osaka', 2026, 3)?.medicalPerCapita).toBe(64931);
    expect(getLatterStageParamsForMonth('Osaka', 2026, 3)?.medicalRate).toBe(0.1151);
    expect(getLatterStageParamsForMonth('Aomori', 2026, 3)?.medicalPerCapita).toBe(50500);
  });

  it('returns undefined for an unknown region key', () => {
    expect(getLatterStageParamsForMonth('Atlantis', 2026, 3)).toBeUndefined();
  });

  it('carries complete, plausible parameters for every prefecture in both periods', () => {
    // A missing 子ども・子育て支援金分 entry would silently yield a ¥0 portion for that
    // prefecture, so every FY2026 row must carry one; no FY2024 row may.
    for (const region of LATTER_STAGE_REGIONS) {
      const fy2026 = getLatterStageParamsForMonth(region, 2026, 3)!;
      expect(fy2026.medicalPerCapita, region).toBeGreaterThanOrEqual(40_000);
      expect(fy2026.medicalPerCapita, region).toBeLessThanOrEqual(75_000);
      expect(fy2026.medicalRate, region).toBeGreaterThanOrEqual(0.08);
      expect(fy2026.medicalRate, region).toBeLessThanOrEqual(0.125);
      expect(fy2026.medicalCap, region).toBe(850_000);
      expect(fy2026.childSupport?.perCapita, region).toBeGreaterThanOrEqual(1_200);
      expect(fy2026.childSupport?.perCapita, region).toBeLessThanOrEqual(1_500);
      expect(fy2026.childSupport?.rate, region).toBeGreaterThanOrEqual(0.0019);
      expect(fy2026.childSupport?.rate, region).toBeLessThanOrEqual(0.003);
      expect(fy2026.childSupport?.cap, region).toBe(21_000);

      const fy2025 = getLatterStageParamsForMonth(region, 2025, 3)!;
      expect(fy2025.medicalPerCapita, region).toBeGreaterThanOrEqual(40_000);
      expect(fy2025.medicalPerCapita, region).toBeLessThanOrEqual(75_000);
      expect(fy2025.medicalRate, region).toBeGreaterThanOrEqual(0.08);
      expect(fy2025.medicalRate, region).toBeLessThanOrEqual(0.125);
      expect(fy2025.medicalCap, region).toBe(800_000);
      expect(fy2025.childSupport, region).toBeUndefined();
    }
  });

  it('falls back to the oldest period before April 2024', () => {
    expect(getLatterStageParamsForMonth('Tokyo', 2024, 0)?.medicalPerCapita).toBe(47300);
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

  it('blends the per-capita amounts at zero income without re-flooring', () => {
    // FY2025 47,300; FY2026 53,300 + child 1,300. Each fiscal year's amount is floored to
    // ¥100 on its own; the calendar-year blend is not floored again:
    // medical round(47,300/3 + 53,300×2/3) = 51,300; child round(1,300×2/3) = 867.
    const result = calculateLatterStageElderlyPremium(0, 2026, 'Tokyo');
    expect(result.medicalPortion).toBe(51_300);
    expect(result.childSupportPortion).toBe(867);
    expect(result.total).toBe(52_167);
  });

  it('collapses to the oldest period for a calendar year before April 2024', () => {
    // Both January and April 2024 resolve to the 令和6・7年度 period, so no blend.
    expect(calculateLatterStageElderlyPremium(4_000_000, 2024, 'Tokyo').total).toBe(392_500);
  });

  it('returns a zero breakdown for an unknown region key', () => {
    expect(calculateLatterStageElderlyPremium(4_000_000, 2026, 'Atlantis').total).toBe(0);
  });
});

describe('calculateLatterStageElderlyPremium (Osaka)', () => {
  it('blends the Osaka 令和6・7 and 令和8・9 rates for calendar 2026', () => {
    // Base: 4,000,000 − 430,000 = 3,570,000
    // FY2025: floor100(57,172 + 3,570,000 × 11.75%) = floor100(476,647) = 476,600
    // FY2026: floor100(64,931 + 3,570,000 × 11.51%) = floor100(475,838) = 475,800
    //         child floor100(1,373 + 3,570,000 × 0.24%) = floor100(9,941) = 9,900
    // Blend:  medical round(476,600/3 + 475,800×2/3) = 476,067; child round(9,900×2/3) = 6,600
    const result = calculateLatterStageElderlyPremium(4_000_000, 2026, 'Osaka');
    expect(result.medicalPortion).toBe(476_067);
    expect(result.childSupportPortion).toBe(6_600);
    expect(result.total).toBe(482_667);
  });
});

describe('calculateLatterStageElderlyPremium rounding', () => {
  it('does not lose ¥100 when 均等割額 + 所得割 lands exactly on a ¥100 multiple', () => {
    // Miyagi 令和6・7年度: 47,400円 + 9.28%. Base 5,430,000 − 430,000 = 5,000,000;
    // 5,000,000 × 0.0928 = 464,000 exactly, so the portion is 511,400 before flooring.
    // In binary floating point the product is 463,999.99999999994, which a naive
    // Math.floor(x / 100) * 100 turns into 511,300.
    expect(calculateLatterStageElderlyPremium(5_430_000, 2025, 'Miyagi').medicalPortion).toBe(
      511_400,
    );
  });

  it('applies the same exact arithmetic to the child-support portion', () => {
    // Ishikawa 令和8・9年度 child portion: 1,360円 + 0.24%. Base 1,530,000 − 430,000 =
    // 1,100,000; 1,100,000 × 0.0024 = 2,640 exactly, so the portion is 4,000 before flooring.
    // Calendar 2027 resolves both fiscal years to the same period, so no blend.
    expect(
      calculateLatterStageElderlyPremium(1_530_000, 2027, 'Ishikawa').childSupportPortion,
    ).toBe(4_000);
  });
});
