// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getLongTermCareCategory1ParamsForMonth } from '../data/longTermCareCategory1Params';
import type { Dependent, OtherDependent, Spouse } from '../types/dependents';
import { EMPTY_PERSONAL_CIRCUMSTANCES } from '../types/tax';
import {
  estimateLongTermCareCategory1Premium,
  judgeLongTermCareCategory1Tier,
  type LongTermCareCategory1TierInputs,
} from '../utils/longTermCareCategory1';
import {
  countResidenceTaxQualifiedDependents,
  isDependentResidenceTaxable,
  isResidenceTaxExempt,
} from '../utils/residenceTax';

const tierInputs = (
  overrides: Partial<LongTermCareCategory1TierInputs>,
): LongTermCareCategory1TierInputs => ({
  totalNetIncome: 0,
  grossPublicPensionIncome: 0,
  netPublicPensionIncome: 0,
  taxpayerIsTaxable: false,
  householdHasOtherTaxableMember: false,
  ...overrides,
});

// The FY2026 standard table (年金収入等 boundary 826,500円).
const FY2026_TIERS = getLongTermCareCategory1ParamsForMonth('DEFAULT', 2026, 3).tiers;

describe('judgeLongTermCareCategory1Tier', () => {
  it('splits the 世帯全員非課税 tiers 1-3 on 年金収入等', () => {
    const judge = (grossPublicPensionIncome: number) =>
      judgeLongTermCareCategory1Tier(tierInputs({ grossPublicPensionIncome }), FY2026_TIERS);
    expect(judge(826_500)).toEqual({ tier: 1, multiplier: 0.285 });
    expect(judge(826_501)).toEqual({ tier: 2, multiplier: 0.485 });
    expect(judge(1_200_000)).toEqual({ tier: 2, multiplier: 0.485 });
    expect(judge(1_200_001)).toEqual({ tier: 3, multiplier: 0.685 });
  });

  it('splits the 本人非課税・世帯課税 tiers 4-5 on the same boundary', () => {
    const judge = (grossPublicPensionIncome: number) =>
      judgeLongTermCareCategory1Tier(
        tierInputs({ grossPublicPensionIncome, householdHasOtherTaxableMember: true }),
        FY2026_TIERS,
      );
    expect(judge(826_500)).toEqual({ tier: 4, multiplier: 0.9 });
    expect(judge(826_501)).toEqual({ tier: 5, multiplier: 1.0 });
  });

  // Both cases are the same 65+ pensioner: 課税年金収入 1,150,000 less the 1,100,000 minimum
  // 公的年金等控除 leaves a 年金雑所得 of 50,000, and the rest of 合計所得金額 is other income.
  it('subtracts only the 公的年金等雑所得 from 合計所得金額, not the whole amount', () => {
    // Other income 40,000, so 合計所得金額 is 90,000 and 年金収入等 is
    // 1,150,000 + (90,000 − 50,000) = 1,190,000, inside the 1,200,000 bound.
    // Adding 合計所得金額 whole would give 1,240,000 and wrongly land tier 3.
    const result = judgeLongTermCareCategory1Tier(
      tierInputs({
        grossPublicPensionIncome: 1_150_000,
        netPublicPensionIncome: 50_000,
        totalNetIncome: 90_000,
      }),
      FY2026_TIERS,
    );
    expect(result.tier).toBe(2);
  });

  it('adds non-pension income on top of the 課税年金収入', () => {
    // Other income 60,000 instead, so 年金収入等 is 1,150,000 + 60,000 = 1,210,000 and crosses
    // into tier 3. Counting the pension revenue alone would leave 1,150,000 and stay at tier 2.
    const result = judgeLongTermCareCategory1Tier(
      tierInputs({
        grossPublicPensionIncome: 1_150_000,
        netPublicPensionIncome: 50_000,
        totalNetIncome: 110_000,
      }),
      FY2026_TIERS,
    );
    expect(result.tier).toBe(3);
  });

  it('walks the 合計所得金額 brackets for a 本人課税 person (未満 semantics)', () => {
    const judge = (totalNetIncome: number) =>
      judgeLongTermCareCategory1Tier(
        tierInputs({ totalNetIncome, taxpayerIsTaxable: true }),
        FY2026_TIERS,
      ).tier;
    expect(judge(0)).toBe(6);
    expect(judge(1_199_999)).toBe(6);
    expect(judge(1_200_000)).toBe(7);
    expect(judge(2_099_999)).toBe(7);
    expect(judge(2_100_000)).toBe(8);
    expect(judge(3_200_000)).toBe(9);
    expect(judge(4_200_000)).toBe(10);
    expect(judge(5_200_000)).toBe(11);
    expect(judge(6_200_000)).toBe(12);
    expect(judge(7_199_999)).toBe(12);
    expect(judge(7_200_000)).toBe(13);
  });

  it('uses each fiscal year’s own 年金収入等 boundary', () => {
    // 810,000円 sits differently in each fiscal year: above FY2025's 809,000 but within
    // FY2026's 826,500 (and above FY2024's 800,000).
    const inputs = tierInputs({ grossPublicPensionIncome: 810_000 });
    const tierIn = (year: number) =>
      judgeLongTermCareCategory1Tier(
        inputs,
        getLongTermCareCategory1ParamsForMonth('DEFAULT', year, 3).tiers,
      ).tier;
    expect(tierIn(2024)).toBe(2);
    expect(tierIn(2025)).toBe(2);
    expect(tierIn(2026)).toBe(1);
  });
});

describe('estimateLongTermCareCategory1Premium', () => {
  it('scales the prefecture-average 基準額 by the tier multiplier, floored to ¥100', () => {
    // Tokyo 基準額 6,320円 × 12 = 75,840円; tier 8 (合計所得 3,000,000): × 1.5 = 113,760
    // → 113,700. Both fiscal years of calendar 2026 give the same figure (only the
    // 年金収入等 boundary differs within the 第9期), so the blend is an identity.
    const result = estimateLongTermCareCategory1Premium(
      tierInputs({ totalNetIncome: 3_000_000, taxpayerIsTaxable: true }),
      2026,
      'Tokyo',
    );
    expect(result).toEqual({
      tier: 8,
      multiplier: 1.5,
      annualBase: 75_840,
      baseScope: 'Tokyo',
      total: 113_700,
    });
  });

  it('floors each fiscal year to ¥100 before blending', () => {
    // Tokyo tier 1 for calendar 2027 (both fiscal years in the FY2026 parameters, no blend):
    // 75,840 × 0.285 = 21,614.4 → 21,600.
    const result = estimateLongTermCareCategory1Premium(tierInputs({}), 2027, 'Tokyo');
    expect(result.tier).toBe(1);
    expect(result.total).toBe(21_600);
  });

  it('blends 1/3 : 2/3 across the fiscal-year boundary when the tier moves', () => {
    // A pure pensioner with 820,000円 of pension (公的年金等控除 leaves no 雑所得): FY2025
    // (January-March) judges tier 2 — 74,700 × 0.485 = 36,229.5 → 36,200 — while FY2026
    // judges tier 1 — 74,700 × 0.285 = 21,289.5 → 21,200.
    // Blend: round(36,200/3 + 21,200×2/3) = 26,200; the reported tier is the current FY's.
    const result = estimateLongTermCareCategory1Premium(
      tierInputs({ grossPublicPensionIncome: 820_000 }),
      2026,
      'DEFAULT',
    );
    expect(result.tier).toBe(1);
    expect(result.total).toBe(26_200);
  });

  it('uses the national average when the region has no prefecture', () => {
    // 課税年金収入 1,500,000 with 雑所得 400,000 (within the 均等割 limit) beside a taxed
    // household member → tier 5 at the national 基準額: 6,225 × 12 = 74,700 × 1.0.
    const result = estimateLongTermCareCategory1Premium(
      tierInputs({
        grossPublicPensionIncome: 1_500_000,
        netPublicPensionIncome: 400_000,
        totalNetIncome: 400_000,
        householdHasOtherTaxableMember: true,
      }),
      2027,
      'DEFAULT',
    );
    expect(result).toEqual({
      tier: 5,
      multiplier: 1.0,
      annualBase: 74_700,
      baseScope: 'national',
      total: 74_700,
    });
  });

  it('applies the top multiplier at tier 13', () => {
    // Osaka 基準額 7,486円 × 12 = 89,832円 × 2.4 = 215,596.8 → 215,500.
    const result = estimateLongTermCareCategory1Premium(
      tierInputs({ totalNetIncome: 8_000_000, taxpayerIsTaxable: true }),
      2027,
      'Osaka',
    );
    expect(result.tier).toBe(13);
    expect(result.total).toBe(215_500);
  });

  it('estimates a positive premium even at zero income', () => {
    // Everyone 65 and over with an address in the municipality is a 第1号被保険者 (法第9条第1項
    // 第1号), and the schedule has no zero band: tier 1 is its floor and covers 被保護者 as well,
    // so 74,700 × 0.285 = 21,289.5 → 21,200. A premium of zero comes only from a municipality's
    // own 減免 for 特別の理由 (法第142条), which is discretionary and not modeled.
    const result = estimateLongTermCareCategory1Premium(tierInputs({}), 2027, 'DEFAULT');
    expect(result.total).toBe(21_200);
  });
});

const spouse = (overrides: Partial<Spouse>): Spouse => ({
  id: 'spouse-1',
  relationship: 'spouse',
  ageRange: 'under65',
  income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
  disability: 'none',
  isCohabiting: true,
  ...overrides,
});

const otherDependent = (overrides: Partial<OtherDependent>): OtherDependent => ({
  id: 'dep-1',
  relationship: 'child',
  ageRange: '16to18',
  income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
  disability: 'none',
  isCohabiting: true,
  ...overrides,
});

const withOtherNetIncome = (otherNetIncome: number) => ({
  grossEmploymentIncome: 0,
  grossPublicPensionIncome: 0,
  otherNetIncome,
});

describe('isResidenceTaxExempt', () => {
  it('applies the 級地1 均等割 limit for a taxpayer with no dependents', () => {
    expect(isResidenceTaxExempt(450_000, 0, 'age65to69', EMPTY_PERSONAL_CIRCUMSTANCES)).toBe(true);
    expect(isResidenceTaxExempt(450_001, 0, 'age65to69', EMPTY_PERSONAL_CIRCUMSTANCES)).toBe(false);
  });

  it('raises the limit with qualified dependents', () => {
    // 35万 × (1 + 1) + 10万 + 21万 = 1,010,000.
    expect(isResidenceTaxExempt(1_010_000, 1, 'age65to69', EMPTY_PERSONAL_CIRCUMSTANCES)).toBe(
      true,
    );
    expect(isResidenceTaxExempt(1_010_001, 1, 'age65to69', EMPTY_PERSONAL_CIRCUMSTANCES)).toBe(
      false,
    );
  });

  it('applies the 135万円 status exemption', () => {
    const circumstances = { ...EMPTY_PERSONAL_CIRCUMSTANCES, disability: 'regular' as const };
    expect(isResidenceTaxExempt(1_350_000, 0, 'age65to69', circumstances)).toBe(true);
    expect(isResidenceTaxExempt(1_350_001, 0, 'age65to69', circumstances)).toBe(false);
  });
});

describe('countResidenceTaxQualifiedDependents', () => {
  it('counts only dependents within the eligibility income limit', () => {
    const dependents: Dependent[] = [
      spouse({}),
      otherDependent({ id: 'dep-2', income: withOtherNetIncome(5_000_000) }),
    ];
    expect(countResidenceTaxQualifiedDependents(dependents, 2026)).toBe(1);
  });
});

describe('isDependentResidenceTaxable', () => {
  it('judges a member against the 0-dependent 均等割 limit', () => {
    expect(isDependentResidenceTaxable(spouse({ income: withOtherNetIncome(450_000) }), 2026)).toBe(
      false,
    );
    expect(isDependentResidenceTaxable(spouse({ income: withOtherNetIncome(450_001) }), 2026)).toBe(
      true,
    );
  });

  it('treats an under-16 dependent as a 未成年者 within the 135万円 limit', () => {
    const child = (otherNetIncome: number) =>
      otherDependent({ ageRange: 'under16', income: withOtherNetIncome(otherNetIncome) });
    expect(isDependentResidenceTaxable(child(1_350_000), 2026)).toBe(false);
    expect(isDependentResidenceTaxable(child(1_350_001), 2026)).toBe(true);
  });

  it('resolves the 16-18 range as an adult, which it cannot always be', () => {
    // Pins a limitation rather than a rule: the range spans ages 16 to 18, so it holds
    // 未成年者 and adults alike and cannot decide the 地方税法295条1項2号 exemption. Resolving it
    // as an adult errs toward overstating the premium — at this income a 16- or 17-year-old is
    // really exempt, which would leave the household untaxed and the taxpayer in tiers 1-3.
    expect(
      isDependentResidenceTaxable(otherDependent({ income: withOtherNetIncome(500_000) }), 2026),
    ).toBe(true);
  });

  it('applies the status exemption for a dependent with a disability', () => {
    expect(
      isDependentResidenceTaxable(
        spouse({ disability: 'regular', income: withOtherNetIncome(1_000_000) }),
        2026,
      ),
    ).toBe(false);
  });
});
