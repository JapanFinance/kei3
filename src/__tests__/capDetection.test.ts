// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { detectCaps } from '../utils/capDetection';
import type { TakeHomeResults, ResidenceTaxDetails, FurusatoNozeiDetails } from '../types/tax';
import { DEFAULT_PROVIDER, NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { EmployeesHealthInsuranceBonusBreakdownItem } from '../utils/healthInsuranceCalculator';

// Mock TakeHomeResults with necessary fields
const createMockResults = (overrides: Partial<TakeHomeResults>): TakeHomeResults => ({
    annualIncome: 0,
    hasEmploymentIncome: true,
    nationalIncomeTax: 0,
    residenceTax: {} as unknown as ResidenceTaxDetails, // Mock complex object if needed
    healthInsurance: 0,
    pensionPayments: 0,
    takeHomeIncome: 0,
    furusatoNozei: {} as unknown as FurusatoNozeiDetails,
    dcPlanContributions: 0,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    isSubjectToLongTermCarePremium: false,
    totalNetIncome: 0,
    salaryIncome: 0,
    ...overrides,
} as TakeHomeResults);

describe('detectCaps', () => {
    it('should explicitly fail or return false positive currently when high business income is present', () => {
        // Scenario: Low salary (should NOT be capped), High Business Income (makes total high)
        // Salary: 3,600,000 (300k/month) -> Not capped (Cap is ~1.39M/month for Health, ~650k for Pension)
        // Business: 100,000,000 -> Total 103.6M

        const results = createMockResults({
            annualIncome: 103600000, // 103.6M
            salaryIncome: 3600000, // 3.6M
            healthInsuranceProvider: DEFAULT_PROVIDER,
        });

        const caps = detectCaps(results);

        expect(caps.healthInsuranceCapped).toBe(false);
        expect(caps.pensionCapped).toBe(false);
    });

    it('should correctly detect caps when salary is high', () => {
        // Scenario: High salary (should be capped)
        // Salary: 24,000,000 (2M/month) -> Capped

        const results = createMockResults({
            annualIncome: 24000000,
            salaryIncome: 24000000,
            healthInsuranceProvider: DEFAULT_PROVIDER,
        });

        const caps = detectCaps(results);

        expect(caps.healthInsuranceCapped).toBe(true);
        expect(caps.pensionCapped).toBe(true);
    });

    it('should correctly handle NHI caps (capped case)', () => {
        // NHI caps rely on the calculated portions in the result matching the params
        // For Tokyo-Chiyoda: Medical Cap 660,000, Support Cap 260,000

        const results = createMockResults({
            healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
            region: 'Tokyo-Chiyoda',
            nhiMedicalPortion: 660000,
            nhiElderlySupportPortion: 260000,
            nhiLongTermCarePortion: 170000, // Optional, but let's set it
            isSubjectToLongTermCarePremium: true,
        });

        const caps = detectCaps(results);

        expect(caps.healthInsuranceCapped).toBe(true);
        // NHI Pension is never "capped" in the same sense (fixed rate), or checkPensionCap returns false
        expect(caps.pensionCapped).toBe(false);
        expect(caps.healthInsuranceCapDetails?.medicalCapped).toBe(true);
        expect(caps.healthInsuranceCapDetails?.supportCapped).toBe(true);
    });

    it('should correctly handle NHI caps (uncapped case)', () => {
        const results = createMockResults({
            healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
            region: 'Tokyo-Chiyoda',
            nhiMedicalPortion: 500000, // Below 660,000
            nhiElderlySupportPortion: 200000, // Below 260,000
            isSubjectToLongTermCarePremium: false,
        });

        const caps = detectCaps(results);

        expect(caps.healthInsuranceCapped).toBe(false);
        expect(caps.pensionCapped).toBe(false);
    });

    it('should NOT trigger pension cap when only bonus is high (salary is normal)', () => {
        // Scenario: 
        // Salary: 3,600,000 (300k/month) -> Normal, Not Capped
        // Bonus: 10,000,000 (10M) -> High
        // Resulting Annual Income: 13.6M

        const results = createMockResults({
            annualIncome: 13600000,
            salaryIncome: 3600000,
            healthInsuranceProvider: DEFAULT_PROVIDER,
        });

        const caps = detectCaps(results);

        expect(caps.pensionCapped).toBe(false);
        expect(caps.healthInsuranceCapped).toBe(false);
    });

    it('should correctly detect health insurance bonus cap', () => {
        const results = createMockResults({
            healthInsuranceProvider: DEFAULT_PROVIDER,
        });

        // Mock a breakdown where the bonus is capped
        // Bonus amount 6,000,000 -> Rounded 6,000,000 -> Standard 5,730,000 (Cap)
        const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [{
            month: 6,
            bonusAmount: 6000000,
            standardBonusAmount: 5730000, // Capped
            cumulativeStandardBonus: 5730000,
            premium: 10000,
            includesLongTermCare: false
        }];

        const caps = detectCaps(results, breakdown);

        expect(caps.healthInsuranceBonusCapped).toBe(true);
    });

    it('should NOT detect health insurance bonus cap when under limit', () => {
        const results = createMockResults({
            healthInsuranceProvider: DEFAULT_PROVIDER,
        });

        // Bonus amount 1,000,000 -> Standard 1,000,000 (Not capped)
        const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [{
            month: 6,
            bonusAmount: 1000000,
            standardBonusAmount: 1000000,
            cumulativeStandardBonus: 1000000,
            premium: 1000,
            includesLongTermCare: false
        }];

        const caps = detectCaps(results, breakdown);

        expect(caps.healthInsuranceBonusCapped).toBe(false);
    });
});
