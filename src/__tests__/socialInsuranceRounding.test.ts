// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { percent } from '../data/employeesHealthInsurance/providerRateData';
import {
  calculateEmployeeHealthInsurancePremium,
  getCustomProviderRates,
  getRegionalRatesForMonth,
} from '../data/employeesHealthInsurance/providerRates';
import {
  calculateEmployeesHealthInsuranceBonusBreakdown,
  calculateHealthInsuranceBreakdown,
} from '../utils/healthInsuranceCalculator';
import { calculatePensionBonusBreakdown } from '../utils/pensionCalculator';
import {
  calculateBonusEmploymentInsurancePremium,
  calculateMonthlyEmploymentInsurancePremium,
  roundSocialInsurancePremium,
} from '../utils/taxCalculations';

describe('Social Insurance Rounding', () => {
  describe('roundSocialInsurancePremium', () => {
    it('rounds 0.50 yen down and more than 0.50 yen up', () => {
      expect(roundSocialInsurancePremium(915, 10)).toBe(91);
      expect(roundSocialInsurancePremium(9151, 100)).toBe(92);
      expect(roundSocialInsurancePremium(91_500_001, 1_000_000)).toBe(92);
    });

    it('rounds an amount below 0.50 yen to positive zero', () => {
      expect(roundSocialInsurancePremium(0, 100_000)).toBe(0);
      expect(roundSocialInsurancePremium(3, 10)).toBe(0);
      expect(Object.is(roundSocialInsurancePremium(3, 10), 0)).toBe(true);
    });

    it('rounds exactly up to 2^53', () => {
      expect(roundSocialInsurancePremium(2 ** 53 - 1, 2)).toBe(2 ** 52 - 1);
      expect(roundSocialInsurancePremium(2 ** 53 - 3, 2)).toBe(2 ** 52 - 2);
      expect(roundSocialInsurancePremium(2 ** 53 - 1, 100_000)).toBe(90_071_992_547);
    });

    it('throws for a negative, NaN or infinite amount', () => {
      expect(() => roundSocialInsurancePremium(-3, 10)).toThrow('must be non-negative');
      expect(() => roundSocialInsurancePremium(-500, 1)).toThrow('must be non-negative');
      expect(() => roundSocialInsurancePremium(Number.NaN, 1)).toThrow('must be non-negative');
      expect(() => roundSocialInsurancePremium(Infinity, 1)).toThrow('must be non-negative');
    });
  });

  describe('Pension Bonus Rounding', () => {
    it('rounds 0.50 yen down', () => {
      // 1,000 yen × 18.3% / 2 = 91.5 yen
      const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
      const result = calculatePensionBonusBreakdown(bonuses, true);

      expect(result[0]?.premium).toBe(91);
    });
  });

  describe('Health Insurance Bonus Rounding', () => {
    it('rounds 0.50 yen down', () => {
      // 1,000 yen × 0.15% = 1.5 yen
      const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
      const rates = { employeeHealthInsuranceRate: percent(0.15), employeeLongTermCareRate: 0 };

      const result = calculateEmployeesHealthInsuranceBonusBreakdown(bonuses, rates, false, 2026);

      expect(result[0]?.premium).toBe(1);
    });

    it('rounds total premium, not each component', () => {
      // 1,000 yen × 0.16% = 1.6 yen and 1,000 yen × 0.06% = 0.6 yen: rounding each gives
      // 2 + 1 = 3, rounding the 2.2 yen total gives 2.
      const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
      const rates = {
        employeeHealthInsuranceRate: percent(0.16),
        employeeLongTermCareRate: percent(0.06),
      };

      const result = calculateEmployeesHealthInsuranceBonusBreakdown(bonuses, rates, true, 2026);

      expect(result[0]?.premium).toBe(2);
    });

    it('rounds an exact 0.50 yen tie down where the product in binary lies above it', () => {
      // Kanagawa from the May 2026 paycheck: 550,000 × 5.075% = 27,912.50 exactly, while
      // 550000 * 0.05075 is 27912.500000000004 in binary floating point.
      const bonuses = [{ amount: 550_000, month: 6, id: 'test', type: 'bonus' as const }];

      const result = calculateEmployeesHealthInsuranceBonusBreakdown(
        bonuses,
        'KyokaiKenpo',
        'Kanagawa',
        2026,
        false,
      );

      expect(result[0]?.premium).toBe(27_912);
    });
  });

  describe('Monthly Employees Health Insurance Premium Rounding', () => {
    it('rounds 0.50 yen down', () => {
      // 410,000 × 4.955% (Kyokai Kenpo Tokyo, FY2025) = 20,315.5 yen
      const rates = { employeeHealthInsuranceRate: percent(4.955), employeeLongTermCareRate: 0 };

      expect(calculateEmployeeHealthInsurancePremium(410_000, rates, false)).toBe(20_315);
    });

    // In binary floating point, 150000 * 0.05075 is 7612.500000000001, and
    // 0.04755 + 0.0081 is 0.055650000000000005, so 110000 times it is 6121.500000000001.
    it('rounds an exact 0.50 yen tie down where the product in binary lies above it', () => {
      // Kanagawa from the May 2026 paycheck: 150,000 × 5.075% = 7,612.50
      const kanagawa = getRegionalRatesForMonth('KyokaiKenpo', 'Kanagawa', 2026, 4)!;
      expect(calculateEmployeeHealthInsurancePremium(150_000, kanagawa, false)).toBe(7_612);

      // Iwate, ages 40-64, April 2026 paycheck: 110,000 × (4.755% + 0.81%) = 6,121.50
      const iwate = getRegionalRatesForMonth('KyokaiKenpo', 'Iwate', 2026, 3)!;
      expect(calculateEmployeeHealthInsurancePremium(110_000, iwate, true)).toBe(6_121);
    });

    it('sums the tie months into the annual premium', () => {
      // Kanagawa 2026, SMR 150,000: January-April 4.96% (7,440), May-December 5.075% (7,612)
      expect(
        calculateHealthInsuranceBreakdown(1_800_000, false, 'KyokaiKenpo', 2026, 'Kanagawa').total,
      ).toBe(4 * 7_440 + 8 * 7_612);

      // Iwate 2026, ages 40-64, SMR 110,000: January-March 4.81% + 0.795% (6,165.50 → 6,165),
      // April 4.755% + 0.81% (6,121), May-December 4.87% + 0.81% (6,248)
      expect(
        calculateHealthInsuranceBreakdown(1_320_000, true, 'KyokaiKenpo', 2026, 'Iwate').total,
      ).toBe(3 * 6_165 + 6_121 + 8 * 6_248);
    });

    it('rounds an exact 0.50 yen tie down for custom rates entered as percentages', () => {
      // 190,000 × (4.755% + 0.81%) = 10,573.50
      const rates = getCustomProviderRates({ healthInsuranceRate: 4.755, longTermCareRate: 0.81 });

      expect(calculateEmployeeHealthInsurancePremium(190_000, rates, true)).toBe(10_573);
    });

    it('keeps a custom rate with four decimal places exact', () => {
      // プリマハム健康保険組合: 39.947/1,000 for the employee, and 500,000 × 3.9947% = 19,973.50
      const rates = getCustomProviderRates({ healthInsuranceRate: 3.9947, longTermCareRate: 0.9 });

      expect(rates.employeeHealthInsuranceRate).toBe(percent(3.9947));
      expect(calculateEmployeeHealthInsurancePremium(500_000, rates, false)).toBe(19_973);
    });
  });

  describe('Employment Insurance Premium Rounding', () => {
    it('rounds an exact 0.50 yen tie down', () => {
      // 301,000 yen a month × 5.5/1,000 = 1,655.50
      expect(calculateMonthlyEmploymentInsurancePremium(12 * 301_000, 55)).toBe(1_655);
      expect(calculateBonusEmploymentInsurancePremium(301_000, 55)).toBe(1_655);
    });

    it('takes one twelfth of the annual wage without rounding the division first', () => {
      // 999,600 / 12 × 5/1,000 = 416.50 exactly
      expect(calculateMonthlyEmploymentInsurancePremium(999_600, 50)).toBe(416);
      // 999,601 / 12 × 5/1,000 = 416.5004...
      expect(calculateMonthlyEmploymentInsurancePremium(999_601, 50)).toBe(417);
      // 999,599 / 12 × 5/1,000 = 416.4995...
      expect(calculateMonthlyEmploymentInsurancePremium(999_599, 50)).toBe(416);
    });
  });
});
