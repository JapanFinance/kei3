// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calculateEmploymentInsurance } from '../utils/taxCalculations';
import { calculateHealthInsuranceBreakdown } from '../utils/healthInsuranceCalculator';
import { calculatePensionBreakdown } from '../utils/pensionCalculator';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';

describe('Zero Amount Bonus Handling', () => {
    const zeroAmountBonus = { amount: 0, type: 'bonus' as const, month: 6, id: '1' };
    const validBonus = { amount: 500000, type: 'bonus' as const, month: 6, id: '2' };

    describe('calculateEmploymentInsurance', () => {
        it('should handle zero amount bonus correctly', () => {
            // Should be 0 if salary is 0 and bonus is 0
            const result = calculateEmploymentInsurance(0, [zeroAmountBonus]);
            expect(result).toBe(0);
        });

        it('should handle mixed zero and non-zero bonuses', () => {
            // Salary 0, one valid bonus
            const resultWithValid = calculateEmploymentInsurance(0, [validBonus]);

            // Salary 0, one valid bonus and one zero bonus
            const resultWithMixed = calculateEmploymentInsurance(0, [validBonus, zeroAmountBonus]);

            expect(resultWithMixed).toBe(resultWithValid);
        });
    });

    describe('calculateHealthInsuranceBreakdown', () => {
        it('should handle zero amount bonus correctly', () => {
            // Calculate with no bonuses first
            const baseResult = calculateHealthInsuranceBreakdown(3000000, false, DEFAULT_PROVIDER, 'Tokyo', undefined, []);

            // Calculate with zero bonus
            const resultWithZeroBonus = calculateHealthInsuranceBreakdown(3000000, false, DEFAULT_PROVIDER, 'Tokyo', undefined, [zeroAmountBonus]);

            expect(resultWithZeroBonus.bonusPortion).toBe(0);
            expect(resultWithZeroBonus.total).toBe(baseResult.total);
        });
    });

    describe('calculatePensionBreakdown', () => {
        it('should handle zero amount bonus correctly', () => {
            // Calculate with no bonuses first
            const baseResult = calculatePensionBreakdown(true, 250000, true, []);

            // Calculate with zero bonus
            const resultWithZeroBonus = calculatePensionBreakdown(true, 250000, true, [zeroAmountBonus]);

            expect(resultWithZeroBonus.bonusPortion).toBe(0);
            expect(resultWithZeroBonus.total).toBe(baseResult.total);
        });
    });
});
