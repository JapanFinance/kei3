// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { calculateNetPublicPensionIncome } from '../data/publicPensionDeduction';

const YEAR = 2026;

// The implementation is parameterized from the statute (所得税法35条4項 + 措置法41条の15の3);
// the expectations below are transcribed from the NTA's precomputed 速算表, so the two official
// sources cross-validate each other. https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm

describe('calculateNetPublicPensionIncome', () => {
  describe('under 65', () => {
    const isElderlyRecipient = false;

    it('returns zero at or below the ¥600,000 minimum deduction', () => {
      // The statutory table's first row: gross ≤ 600,000 → 雑所得 0
      expect(calculateNetPublicPensionIncome(600_000, isElderlyRecipient, 0, YEAR)).toBe(0);
      expect(calculateNetPublicPensionIncome(600_001, isElderlyRecipient, 0, YEAR)).toBe(1);
    });

    it('applies the minimum deduction up to the first tier boundary', () => {
      // 1,300,000 − 600,000 = 700,000 (the next tier agrees: 1,300,000 × 75% − 275,000 = 700,000)
      expect(calculateNetPublicPensionIncome(1_300_000, isElderlyRecipient, 0, YEAR)).toBe(700_000);
    });

    it('applies the 75% tier', () => {
      // 1,400,000 × 75% − 275,000 = 775,000
      expect(calculateNetPublicPensionIncome(1_400_000, isElderlyRecipient, 0, YEAR)).toBe(775_000);
    });

    it('is continuous at the 75%/85% boundary', () => {
      // 4,100,000 × 75% − 275,000 = 2,800,000 = 4,100,000 × 85% − 685,000
      expect(calculateNetPublicPensionIncome(4_100_000, isElderlyRecipient, 0, YEAR)).toBe(
        2_800_000,
      );
    });

    it('is continuous at the 85%/95% boundary', () => {
      // 7,700,000 × 85% − 685,000 = 5,860,000 = 7,700,000 × 95% − 1,455,000
      expect(calculateNetPublicPensionIncome(7_700_000, isElderlyRecipient, 0, YEAR)).toBe(
        5_860_000,
      );
    });

    it('drops any fraction of a yen from the 雑所得', () => {
      // 2,500,001 × 75% − 275,000 = 1,600,000.75 → 1,600,000 (手引き: 1円未満の端数切り捨て)
      expect(calculateNetPublicPensionIncome(2_500_001, isElderlyRecipient, 0, YEAR)).toBe(
        1_600_000,
      );
      // 2,500,003 × 75% − 275,000 = 1,600,002.25 → 1,600,002
      expect(calculateNetPublicPensionIncome(2_500_003, isElderlyRecipient, 0, YEAR)).toBe(
        1_600_002,
      );
    });

    it('caps the deduction at ¥1,955,000 above ¥10,000,000', () => {
      // 10,000,000 × 95% − 1,455,000 = 8,045,000 = 10,000,000 − 1,955,000
      expect(calculateNetPublicPensionIncome(10_000_000, isElderlyRecipient, 0, YEAR)).toBe(
        8_045_000,
      );
      // 12,000,000 − 1,955,000 = 10,045,000
      expect(calculateNetPublicPensionIncome(12_000_000, isElderlyRecipient, 0, YEAR)).toBe(
        10_045_000,
      );
    });
  });

  describe('65 or older', () => {
    const isElderlyRecipient = true;

    it('returns zero at or below the ¥1,100,000 minimum deduction', () => {
      // The statutory table's first row: gross ≤ 1,100,000 → 雑所得 0
      expect(calculateNetPublicPensionIncome(1_100_000, isElderlyRecipient, 0, YEAR)).toBe(0);
      expect(calculateNetPublicPensionIncome(1_100_001, isElderlyRecipient, 0, YEAR)).toBe(1);
    });

    it('applies the higher ¥1,100,000 minimum deduction', () => {
      // 1,500,000 − 1,100,000 = 400,000
      expect(calculateNetPublicPensionIncome(1_500_000, isElderlyRecipient, 0, YEAR)).toBe(400_000);
    });

    it('is continuous at the minimum/75% boundary', () => {
      // 3,300,000 − 1,100,000 = 2,200,000 = 3,300,000 × 75% − 275,000
      expect(calculateNetPublicPensionIncome(3_300_000, isElderlyRecipient, 0, YEAR)).toBe(
        2_200_000,
      );
    });

    it('matches the under-65 table above the minimum tiers', () => {
      // 4,000,000 × 75% − 275,000 = 2,725,000 for both age bands
      expect(calculateNetPublicPensionIncome(4_000_000, isElderlyRecipient, 0, YEAR)).toBe(
        2_725_000,
      );
      expect(calculateNetPublicPensionIncome(4_000_000, false, 0, YEAR)).toBe(2_725_000);
    });
  });

  describe('non-pension income bands', () => {
    it('keeps the full deduction at exactly ¥10,000,000 of other income', () => {
      // The reduced table applies above (超) ¥10,000,000, so exactly ¥10,000,000 keeps the base:
      // 4,000,000 × 75% − 275,000 = 2,725,000, same as with no other income
      const atThreshold = calculateNetPublicPensionIncome(4_000_000, false, 10_000_000, YEAR);
      expect(atThreshold).toBe(calculateNetPublicPensionIncome(4_000_000, false, 0, YEAR));
      expect(atThreshold).toBe(2_725_000);
    });

    it('reduces the deduction by ¥100,000 above ¥10,000,000 of other income', () => {
      // The >¥10,000,000 速算表 row: 4,000,000 × 75% − 175,000 = 2,825,000
      expect(calculateNetPublicPensionIncome(4_000_000, false, 10_000_001, YEAR)).toBe(2_825_000);
    });

    it('reduces the deduction by ¥200,000 above ¥20,000,000 of other income', () => {
      // The >¥20,000,000 速算表 row: 4,000,000 × 75% − 75,000 = 2,925,000
      expect(calculateNetPublicPensionIncome(4_000_000, false, 20_000_001, YEAR)).toBe(2_925_000);
    });

    it('applies the reduced band floor to small pensions', () => {
      // The >¥10,000,000 band's minimum deduction is the statutory 500,000円 floor
      // (所得税法35条4項2号), so 550,000 − 500,000 = 50,000
      expect(calculateNetPublicPensionIncome(550_000, false, 10_000_001, YEAR)).toBe(50_000);
    });

    it('shifts the zero threshold down along with the deduction', () => {
      // The >¥20,000,000 band's minimum deduction is the statutory 400,000円 floor
      // (所得税法35条4項3号), so its zero row ends at 400,000: 400,000 → 0, 400,001 → 1
      expect(calculateNetPublicPensionIncome(400_000, false, 20_000_001, YEAR)).toBe(0);
      expect(calculateNetPublicPensionIncome(400_001, false, 20_000_001, YEAR)).toBe(1);
    });
  });
});
