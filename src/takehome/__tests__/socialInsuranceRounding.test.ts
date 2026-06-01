// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { calculatePensionBonusBreakdown } from '../utils/pensionCalculator';
import { calculateEmployeesHealthInsuranceBonusBreakdown } from '../utils/healthInsuranceCalculator';
import { calculateMonthlyEmployeePremium } from '../data/employeesHealthInsurance/providerRates';

describe('Social Insurance Rounding', () => {
    describe('Pension Bonus Rounding', () => {
        it('rounds 0.50 yen down (halfTrunc)', () => {
            // Rate is 18.3%. Half is 9.15%.
            // Bonus 1000 yen.
            // Premium = 1000 * 9.15% = 91.5 yen.
            // Math.round(91.5) = 92 (Current/Old behavior)
            // roundSocialInsurancePremium(91.5) = 91 (New/Desired behavior)

            const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
            const result = calculatePensionBonusBreakdown(bonuses, true);

            expect(result[0]?.premium).toBe(91);
        });
    });

    describe('Health Insurance Bonus Rounding', () => {
        it('rounds 0.50 yen down (halfTrunc)', () => {
            // Test with a custom rate that produces .5
            // Let's use a rate of 0.3% (0.003). Employee share 0.15% (0.0015).
            // Bonus 1000 yen.
            // 1000 * 0.0015 = 1.5 yen.
            // Math.round(1.5) = 2.
            // Desired: 1.

            const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
            const regionalRates = {
                employeeHealthInsuranceRate: 0.0015,
                employeeLongTermCareRate: 0,
            };

            const result = calculateEmployeesHealthInsuranceBonusBreakdown(
                bonuses,
                regionalRates,
                false
            );

            expect(result[0]?.premium).toBe(1);
        });

        it('rounds total premium, not each component', () => {
            // Bonus 1000 yen.
            // 1000 * 0.0016 = 1.6 yen (rounded => 2)
            // 1000 * 0.0006 = 0.6 yen (rounded => 1)
            // Total = 2.2 yen (round each => 3, round total => 2)

            const bonuses = [{ amount: 1000, month: 6, id: 'test', type: 'bonus' as const }];
            const regionalRates = {
                employeeHealthInsuranceRate: 0.0016,
                employeeLongTermCareRate: 0.0006,
            };

            const result = calculateEmployeesHealthInsuranceBonusBreakdown(
                bonuses,
                regionalRates,
                true
            );

            expect(result[0]?.premium).toBe(2);
        });
    });

    describe('Monthly Employees Health Insurance Premium Rounding', () => {
        it('rounds 0.50 yen down (halfTrunc)', () => {
            // Test case: 410k SMR bracket with Kyokai Kenpo Tokyo rate (9.91% -> 4.955% employee share)
            // 410,000 * 4.955% = 20,315.5 yen
            // Math.round(20,315.5) = 20,316 (Old)
            // roundSocialInsurancePremium(20,315.5) = 20,315 (New)

            const smrAmount = 410_000;
            const rates = {
                employeeHealthInsuranceRate: 0.04955,
                employeeLongTermCareRate: 0,
            };

            const premium = calculateMonthlyEmployeePremium(smrAmount, rates, false);

            expect(premium).toBe(20_315);
        });
    });
});
