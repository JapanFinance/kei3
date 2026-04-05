// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NHIPortionTooltip, type NHIPortionType } from '../components/TakeHomeCalculator/tabs/HealthInsurancePremiumTooltip';
import { calculateNationalHealthInsurancePremiumWithBreakdown } from '../utils/healthInsuranceCalculator';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import { formatJPY } from '../utils/formatters';
import type { TakeHomeResults, TakeHomeInputs, ResidenceTaxDetails, FurusatoNozeiDetails } from '../types/tax';

// Pin to June 2026 so rate lookups resolve to FY2026 (current) and FY2025 (previous).
beforeAll(() => { vi.useFakeTimers({ now: new Date(2026, 5, 1) }); });
afterAll(() => { vi.useRealTimers(); });

/**
 * Build minimal TakeHomeResults and TakeHomeInputs for a given NHI scenario,
 * using the real calculator to produce authoritative portion values.
 */
function buildNHIScenario(annualIncome: number, region: string, includeLTC: boolean) {
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
        annualIncome, includeLTC, region, 2026
    );

    const results: TakeHomeResults = {
        annualIncome,
        hasEmploymentIncome: false,
        nationalIncomeTax: 0,
        residenceTax: { totalResidenceTax: 0, city: { cityIncomeTax: 0, cityPerCapitaTax: 0 }, prefecture: { prefectureIncomeTax: 0, prefecturePerCapitaTax: 0 } } as unknown as ResidenceTaxDetails,
        healthInsurance: breakdown.total,
        pensionPayments: 0,
        employmentInsurance: 0,
        takeHomeIncome: 0,
        furusatoNozei: {} as unknown as FurusatoNozeiDetails,
        dcPlanContributions: 0,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
        region,
        isSubjectToLongTermCarePremium: includeLTC,
        residenceTaxBasicDeduction: 430_000,
        totalNetIncome: annualIncome,
        nhiMedicalPortion: breakdown.medicalPortion,
        nhiElderlySupportPortion: breakdown.elderlySupportPortion,
        nhiLongTermCarePortion: breakdown.longTermCarePortion,
        nhiChildSupportPortion: breakdown.childSupportPortion,
        salaryIncome: 0,
    };

    const inputs: TakeHomeInputs = {
        incomeStreams: [{ id: '1', type: 'business', amount: annualIncome }],
        isSubjectToLongTermCarePremium: includeLTC,
        region,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
    };

    return { results, inputs, breakdown };
}

describe('NHIPortionTooltip consistency with calculator', () => {
    // Nakano has both FY2025 and FY2026 data with different rates, triggering blending.
    // FY2025 has no child support; FY2026 introduces it.
    const region = 'Tokyo-Nakano';

    describe('blended year (2026) — tooltip totals match calculator breakdown', () => {
        const { results, inputs, breakdown } = buildNHIScenario(5_000_000, region, false);

        const portionsToTest: { portion: NHIPortionType; expected: number }[] = [
            { portion: 'medical', expected: breakdown.medicalPortion },
            { portion: 'elderlySupport', expected: breakdown.elderlySupportPortion },
            { portion: 'childSupport', expected: breakdown.childSupportPortion },
        ];

        it.each(portionsToTest)('$portion tooltip total matches calculator ($expected)', ({ portion, expected }) => {
            const { container } = render(
                <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />
            );
            // The final bold value after "=" in the Total line should match the calculator
            const boldElements = container.querySelectorAll('strong');
            const values = Array.from(boldElements).map(el => el.textContent);
            expect(values).toContain(formatJPY(expected));
        });

        it('child support is 7/10 of FY2026 annual (not 100%)', () => {
            expect(breakdown.childSupportPortion).toBeGreaterThan(0);
            // If it were 100%, it would be the full FY2026 amount.
            // The blended amount should be roughly 70% of the full amount.
            // Verify it's less than the full FY2026 calculation by checking the ratio.
            // Full FY2026 child support for 5M income in Nakano: 12,412 (from test comments above)
            // Blended: round(0 * 0.3 + 12412 * 0.7) = 8,688
            expect(breakdown.childSupportPortion).toBe(8_688);
        });
    });

    describe('blended year with LTC', () => {
        const { results, inputs, breakdown } = buildNHIScenario(5_000_000, region, true);

        it('LTC tooltip total matches calculator', () => {
            const { container } = render(
                <NHIPortionTooltip portion="longTermCare" results={results} inputs={inputs} />
            );
            const boldElements = container.querySelectorAll('strong');
            const values = Array.from(boldElements).map(el => el.textContent);
            expect(values).toContain(formatJPY(breakdown.longTermCarePortion));
        });
    });

    describe('blended year at high income (caps apply)', () => {
        const { results, inputs, breakdown } = buildNHIScenario(20_000_000, region, false);

        const portionsToTest: { portion: NHIPortionType; expected: number }[] = [
            { portion: 'medical', expected: breakdown.medicalPortion },
            { portion: 'elderlySupport', expected: breakdown.elderlySupportPortion },
            { portion: 'childSupport', expected: breakdown.childSupportPortion },
        ];

        it.each(portionsToTest)('$portion tooltip total matches calculator at high income ($expected)', ({ portion, expected }) => {
            const { container } = render(
                <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />
            );
            const boldElements = container.querySelectorAll('strong');
            const values = Array.from(boldElements).map(el => el.textContent);
            expect(values).toContain(formatJPY(expected));
        });
    });
});
