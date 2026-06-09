// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import { calculateNationalHealthInsurancePremiumWithBreakdown } from '../utils/healthInsuranceCalculator';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { TakeHomeResults, TakeHomeInputs, ResidenceTaxDetails, FurusatoNozeiDetails } from '../types/tax';

// Mock scrollTo (used by SMRTableTooltip)
Element.prototype.scrollTo = vi.fn();

// Pin to June 2026 for deterministic NHI rate lookups
beforeAll(() => { vi.useFakeTimers({ now: new Date(2026, 5, 1) }); });
afterAll(() => { vi.useRealTimers(); });

/**
 * Build realistic TakeHomeResults and TakeHomeInputs using the real NHI calculator,
 * so cap detection operates on the same data the UI would display.
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

describe('NHI cap indicators in SocialInsuranceTab', () => {
    it('shows cap indicator for all NHI portions at very high income', () => {
        const { results, inputs } = buildNHIScenario(50_000_000, 'Tokyo-Chiyoda', true);

        render(<SocialInsuranceTab results={results} inputs={inputs} />);

        // Each capped portion should have a CapIndicator which renders a VerticalAlignTop icon.
        // At very high income with Chiyoda FY2026 rates, all 4 portions should be capped
        // (medical, elderly support, LTC, child support), plus pension has a "Fixed" indicator.
        const capIndicators = screen.getAllByTestId('VerticalAlignTopIcon');

        // At very high income with Chiyoda FY2026 rates, all 4 portions should be capped
        // (medical, elderly support, LTC, child support)
        expect(capIndicators.length).toBeGreaterThanOrEqual(4);
    });

    it('shows cap indicator specifically for child support portion when capped', () => {
        const { results, inputs } = buildNHIScenario(50_000_000, 'Tokyo-Chiyoda', false);

        render(<SocialInsuranceTab results={results} inputs={inputs} />);

        // Find the Child Support Portion row and verify it has a cap indicator
        const childSupportText = screen.getByText('Child Support Portion');
        // The cap indicator is a sibling within the same labelSuffix Box
        const row = childSupportText.closest('[class*="MuiBox-root"]')!.parentElement!;
        const capIcon = row.querySelector('[data-testid="VerticalAlignTopIcon"]');
        expect(capIcon).not.toBeNull();
    });

    it('does not show NHI portion cap indicators at moderate income', () => {
        const { results, inputs } = buildNHIScenario(5_000_000, 'Tokyo-Chiyoda', false);

        render(<SocialInsuranceTab results={results} inputs={inputs} />);

        // At moderate income, no NHI portions should be capped.
        // Find the NHI portion rows (Medical, Elderly Support, Child Support) and verify
        // none of them contain a cap indicator.
        // Note: there may be a pension "Fixed" indicator (VerticalAlignTopIcon) elsewhere,
        // so we check specifically within the NHI portion area.
        const nhiPortionLabels = ['Medical Portion', 'Elderly Support Portion', 'Child Support Portion'];
        for (const label of nhiPortionLabels) {
            const el = screen.queryByText(label);
            if (el) {
                const row = el.closest('[class*="MuiBox-root"]')!.parentElement!;
                const capIcon = row.querySelector('[data-testid="VerticalAlignTopIcon"]');
                expect(capIcon).toBeNull();
            }
        }
    });
});
