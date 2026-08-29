// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getLongTermCareCategory1ParamsForMonth } from '../data/longTermCareCategory1Params';
import { PREFECTURE_NAMES, prefectureForRegion, type Prefecture } from '../data/prefectures';

const PREFECTURES = Object.keys(PREFECTURE_NAMES) as Prefecture[];

describe('prefectureForRegion', () => {
  it('passes a prefecture key through', () => {
    expect(prefectureForRegion('Tokyo')).toBe('Tokyo');
    expect(prefectureForRegion('Osaka')).toBe('Osaka');
  });

  it('reads the prefecture out of a municipal NHI key', () => {
    expect(prefectureForRegion('Tokyo-Chiyoda')).toBe('Tokyo');
    expect(prefectureForRegion('Tokyo-Edogawa')).toBe('Tokyo');
  });

  it('returns undefined when no prefecture can be read', () => {
    expect(prefectureForRegion('DEFAULT')).toBeUndefined();
    expect(prefectureForRegion('')).toBeUndefined();
    expect(prefectureForRegion('Atlantis-Tokyo')).toBeUndefined();
  });
});

describe('getLongTermCareCategory1ParamsForMonth', () => {
  it('matches the MHLW 第9期 averages for spot-checked prefectures', () => {
    // Osaka (highest) and Yamaguchi (lowest) also match gemmed.ghc-j.com's report of the
    // same publication (7,486円 / 5,568円), an independent confirmation of the parsed column.
    expect(getLongTermCareCategory1ParamsForMonth('Osaka', 2026, 3).annualBase).toBe(7_486 * 12);
    expect(getLongTermCareCategory1ParamsForMonth('Yamaguchi', 2026, 3).annualBase).toBe(
      5_568 * 12,
    );
    // 北海道 5,738円 and 東京 6,320円 as printed in the publication's 集計結果 PDF.
    expect(getLongTermCareCategory1ParamsForMonth('Hokkaido', 2026, 3).annualBase).toBe(5_738 * 12);
    expect(getLongTermCareCategory1ParamsForMonth('Tokyo', 2026, 3).annualBase).toBe(6_320 * 12);
  });

  it('carries a plausible 基準額 for every prefecture', () => {
    // A missing prefecture would fail to compile, so this guards against a mistyped amount:
    // every average must lie between the published lowest (山口 5,568円) and highest (大阪
    // 7,486円) prefecture averages.
    for (const region of PREFECTURES) {
      const params = getLongTermCareCategory1ParamsForMonth(region, 2026, 3);
      expect(params.baseScope, region).toBe(region);
      expect(params.annualBase, region).toBeGreaterThanOrEqual(5_568 * 12);
      expect(params.annualBase, region).toBeLessThanOrEqual(7_486 * 12);
      expect(params.annualBase % 12, region).toBe(0);
    }
  });

  it('falls back to the national average when the region carries no prefecture', () => {
    for (const region of ['DEFAULT', 'Atlantis', '']) {
      const params = getLongTermCareCategory1ParamsForMonth(region, 2026, 3);
      expect(params.baseScope, region).toBe('national');
      expect(params.annualBase, region).toBe(6_225 * 12);
    }
  });

  it('resolves municipal NHI region keys to their prefecture', () => {
    const params = getLongTermCareCategory1ParamsForMonth('Tokyo-Chiyoda', 2026, 3);
    expect(params.baseScope).toBe('Tokyo');
    expect(params.annualBase).toBe(6_320 * 12);
  });

  it('resolves periods by fiscal year and tags each lookup', () => {
    // January 2026 is still FY2025; April 2026 starts FY2026.
    const januaryOf2026 = getLongTermCareCategory1ParamsForMonth('Tokyo', 2026, 0);
    const aprilOf2026 = getLongTermCareCategory1ParamsForMonth('Tokyo', 2026, 3);
    expect(januaryOf2026.periodId).not.toBe(aprilOf2026.periodId);
    expect(getLongTermCareCategory1ParamsForMonth('Tokyo', 2025, 3).periodId).toBe(
      januaryOf2026.periodId,
    );
    // The 第9期 has no FY2027 successor yet, so April 2027 still resolves to FY2026.
    expect(getLongTermCareCategory1ParamsForMonth('Tokyo', 2027, 3).periodId).toBe(
      aprilOf2026.periodId,
    );
  });

  it('falls back to the oldest period before April 2024', () => {
    const params = getLongTermCareCategory1ParamsForMonth('Tokyo', 2024, 0);
    expect(params.periodId).toBe(getLongTermCareCategory1ParamsForMonth('Tokyo', 2024, 3).periodId);
    expect(params.tiers.tier1PensionIncomeEtcMax).toBe(800_000);
  });

  it('tracks the 年金収入等 boundary by fiscal year within the 第9期', () => {
    // 施行令第38条第1項第1号ハ as in force in each fiscal year: 80万 (FY2024) → 80万9千
    // (FY2025) → 82万6千500 (FY2026); the tier-2 bound stays 120万 throughout.
    for (const [year, expected] of [
      [2024, 800_000],
      [2025, 809_000],
      [2026, 826_500],
    ] as const) {
      const { tiers } = getLongTermCareCategory1ParamsForMonth('Tokyo', year, 3);
      expect(tiers.tier1PensionIncomeEtcMax, `FY${year}`).toBe(expected);
      expect(tiers.tier2PensionIncomeEtcMax, `FY${year}`).toBe(1_200_000);
    }
  });

  it('ships the standard 13-tier schedule in ascending order', () => {
    const { tiers } = getLongTermCareCategory1ParamsForMonth('Tokyo', 2026, 3);
    expect(tiers.multipliers).toHaveLength(13);
    expect(tiers.multipliers[0]).toBe(0.285);
    expect(tiers.multipliers[4]).toBe(1.0);
    expect(tiers.multipliers[12]).toBe(2.4);
    for (let i = 1; i < tiers.multipliers.length; i++) {
      expect(tiers.multipliers[i]!, `multiplier ${i}`).toBeGreaterThan(tiers.multipliers[i - 1]!);
    }
    expect(tiers.taxedIncomeBracketUpperBounds).toHaveLength(7);
    expect(tiers.taxedIncomeBracketUpperBounds[0]).toBe(1_200_000);
    expect(tiers.taxedIncomeBracketUpperBounds[6]).toBe(7_200_000);
    for (let i = 1; i < tiers.taxedIncomeBracketUpperBounds.length; i++) {
      expect(tiers.taxedIncomeBracketUpperBounds[i]!, `bracket ${i}`).toBeGreaterThan(
        tiers.taxedIncomeBracketUpperBounds[i - 1]!,
      );
    }
  });
});
