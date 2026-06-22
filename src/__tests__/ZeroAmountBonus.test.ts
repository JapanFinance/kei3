// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calculateEmploymentInsurance as calculateEmploymentInsuranceForYear } from '../utils/taxCalculations';
import { calculateHealthInsuranceBreakdown as calculateHealthInsuranceBreakdownForYear } from '../utils/healthInsuranceCalculator';
import { calculatePensionBreakdown as calculatePensionBreakdownForYear } from '../utils/pensionCalculator';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';

// These calculators now require an income year. Thin wrappers default it to 2026 (the suite's
// prior behavior under a 2026 clock) while honoring an explicit year, so call sites stay unchanged.
const TEST_INCOME_YEAR = 2026;
const calculateEmploymentInsurance = (
  salaryIncome: Parameters<typeof calculateEmploymentInsuranceForYear>[0],
  bonuses?: Parameters<typeof calculateEmploymentInsuranceForYear>[1], year: number = TEST_INCOME_YEAR,
) => calculateEmploymentInsuranceForYear(salaryIncome, bonuses, year);
type HIBreakdownArgs = Parameters<typeof calculateHealthInsuranceBreakdownForYear>;
const calculateHealthInsuranceBreakdown = (
  income: HIBreakdownArgs[0], ltc: HIBreakdownArgs[1], provider: HIBreakdownArgs[2], region?: HIBreakdownArgs[3],
  customRates?: HIBreakdownArgs[4], bonuses?: HIBreakdownArgs[5], year: number = TEST_INCOME_YEAR,
) => calculateHealthInsuranceBreakdownForYear(income, ltc, provider, region, customRates, bonuses, year);
type PenBreakdownArgs = Parameters<typeof calculatePensionBreakdownForYear>;
const calculatePensionBreakdown = (
  isEmployeesPension?: PenBreakdownArgs[0], monthlyIncome?: PenBreakdownArgs[1], isHalfAmount?: PenBreakdownArgs[2],
  bonuses?: PenBreakdownArgs[3], year: number = TEST_INCOME_YEAR,
) => calculatePensionBreakdownForYear(isEmployeesPension, monthlyIncome, isHalfAmount, bonuses, year);

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
