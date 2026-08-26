// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { calculateNetEmploymentIncome } from '../data/netEmploymentIncome';

describe('calculateNetEmploymentIncome', () => {
  describe('2026 tiers (R8)', () => {
    it('deduction of 740,000 yen for income up to 2,200,000 yen (R8 temporary provision)', () => {
      expect(calculateNetEmploymentIncome(1_500_000, 2026)).toBe(760_000);
      expect(calculateNetEmploymentIncome(1_899_999, 2026)).toBe(1_159_999);
    });

    it('between 2,200,000 and 6,600,000 yen, income is rounded down to the nearest 4000 yen', () => {
      expect(calculateNetEmploymentIncome(2_200_000, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_201_123, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_203_333, 2026)).toBe(1_460_000);
      expect(calculateNetEmploymentIncome(2_204_000, 2026)).toBe(1_462_800);

      expect(calculateNetEmploymentIncome(3_600_000, 2026)).toBe(2_440_000);
      expect(calculateNetEmploymentIncome(3_603_999, 2026)).toBe(2_440_000);
      expect(calculateNetEmploymentIncome(3_604_000, 2026)).toBe(2_443_200);
    });

    it('calculates deduction correctly for income between 2,200,000 and 3,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(2_500_000, 2026)).toBe(
        2_500_000 - (2_500_000 * 0.3 + 80_000),
      );
    });

    it('calculates deduction correctly for income between 3,600,001 and 6,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(5_000_000, 2026)).toBe(
        5_000_000 - (5_000_000 * 0.2 + 440_000),
      );
    });

    it('calculates deduction correctly for income between 6,600,001 and 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(7_500_000, 2026)).toBe(
        7_500_000 - (7_500_000 * 0.1 + 1_100_000),
      );
    });

    it('From 6.6 million yen, income is not rounded down to the nearest 4000 yen', () => {
      expect(calculateNetEmploymentIncome(6_600_100, 2026)).toBe(
        Math.floor(6_600_100 * 0.9) - 1_100_000,
      );
      expect(calculateNetEmploymentIncome(6_600_123, 2026)).toBe(
        Math.floor(6_600_123 * 0.9) - 1_100_000,
      );
      expect(calculateNetEmploymentIncome(6_601_000, 2026)).not.toBe(
        calculateNetEmploymentIncome(6_600_100, 2026),
      );
    });

    it('returns maximum deduction of 1,950,000 yen for income above 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(9_000_000, 2026)).toBe(9_000_000 - 1_950_000);
      expect(calculateNetEmploymentIncome(10_000_000, 2026)).toBe(10_000_000 - 1_950_000);
    });
  });

  describe('2025 tiers (R7)', () => {
    it('returns 0 for income at or below 650,000 yen', () => {
      expect(calculateNetEmploymentIncome(0, 2025)).toBe(0);
      expect(calculateNetEmploymentIncome(650_000, 2025)).toBe(0);
    });

    it('deduction of 650,000 yen for income up to 1,900,000 yen', () => {
      expect(calculateNetEmploymentIncome(650_001, 2025)).toBe(1);
      expect(calculateNetEmploymentIncome(1_500_000, 2025)).toBe(850_000);
      expect(calculateNetEmploymentIncome(1_900_000, 2025)).toBe(1_250_000);
    });

    it('smooth join at 1,900,000 yen: flat floor and standard formula give same result', () => {
      // Floor formula: 1,900,000 - 650,000 = 1,250,000
      // Standard formula: floor(1,900,000 / 4000) * 4000 * 0.7 - 80,000 = 1,900,000 * 0.7 - 80,000 = 1,250,000
      expect(calculateNetEmploymentIncome(1_900_000, 2025)).toBe(1_250_000);
      expect(calculateNetEmploymentIncome(1_900_001, 2025)).toBe(1_250_000); // rounds down to 1,900,000
    });

    it('calculates deduction correctly for income between 1,900,001 and 3,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(2_200_000, 2025)).toBe(1_460_000); // 2,200,000 * 0.7 - 80,000
      expect(calculateNetEmploymentIncome(2_500_000, 2025)).toBe(
        2_500_000 - (2_500_000 * 0.3 + 80_000),
      );
    });

    it('calculates deduction correctly for income between 3,600,001 and 6,600,000 yen', () => {
      expect(calculateNetEmploymentIncome(5_000_000, 2025)).toBe(
        5_000_000 - (5_000_000 * 0.2 + 440_000),
      );
    });

    it('calculates deduction correctly for income between 6,600,001 and 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(7_500_000, 2025)).toBe(
        7_500_000 - (7_500_000 * 0.1 + 1_100_000),
      );
    });

    it('returns maximum deduction of 1,950,000 yen for income above 8,500,000 yen', () => {
      expect(calculateNetEmploymentIncome(9_000_000, 2025)).toBe(9_000_000 - 1_950_000);
      expect(calculateNetEmploymentIncome(10_000_000, 2025)).toBe(10_000_000 - 1_950_000);
    });
  });
});
