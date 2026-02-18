// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { TakeHomeResults, TakeHomeInputs, ResidenceTaxDetails, FurusatoNozeiDetails } from '../types/tax';

// Mock dependencies
vi.mock('../components/ui/Tooltips', () => ({
    SimpleTooltip: () => <div data-testid="info-tooltip" />,
    DetailedTooltip: ({ title, children }: { title: string, children: React.ReactNode }) => (
        <span data-testid="detail-info-tooltip" title={title}>
            {children}
        </span>
    )
}));

// Mock scrollTo
Element.prototype.scrollTo = vi.fn();

const mockResults: TakeHomeResults = {
    annualIncome: 5_000_000,
    hasEmploymentIncome: false,
    blueFilerDeduction: 650_000,
    nationalIncomeTax: 100_000,
    residenceTax: {
        totalResidenceTax: 200_000,
        city: { cityIncomeTax: 100_000, cityPerCapitaTax: 0 },
        prefecture: { prefectureIncomeTax: 100_000, prefecturePerCapitaTax: 0 }
    } as unknown as ResidenceTaxDetails,
    healthInsurance: 300_000,
    pensionPayments: 180_000,
    employmentInsurance: 0,
    takeHomeIncome: 4_220_000,
    furusatoNozei: {} as unknown as FurusatoNozeiDetails,
    dcPlanContributions: 0,
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    region: 'Tokyo',
    isSubjectToLongTermCarePremium: false,
    residenceTaxBasicDeduction: 430_000,
    totalNetIncome: 4_350_000,
    nhiMedicalPortion: 150_000,
    nhiElderlySupportPortion: 50_000,
    nhiLongTermCarePortion: 0,
    salaryIncome: 0,
};

const mockInputs: TakeHomeInputs = {
    incomeStreams: [{
        id: 'mock-advanced-business',
        type: 'business',
        amount: 5_000_000,
        blueFilerDeduction: 650_000
    }],
    isSubjectToLongTermCarePremium: false,
    region: 'Tokyo',
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0
};

describe('Blue-Filer Deduction Display', () => {
    it('displays Net Business Income and Blue-Filer info in TaxesTab (Single Income)', () => {
        render(<TaxesTab results={mockResults} inputs={mockInputs} />);

        // Verify the component renders header
        expect(screen.getByText(/Tax Calculation Details/)).toBeInTheDocument();

        // Should NOT display "Total Net Income" for single income source
        expect(screen.queryByText('Total Net Income')).not.toBeInTheDocument();

        // Should display "Net Business / Misc Income"
        // Since mock renders tooltip content inline, it might appear twice.
        const elements = screen.getAllByText(/Net Business.*Misc Income/);
        expect(elements.length).toBeGreaterThan(0);
        expect(elements[0]).toBeInTheDocument();

        // Value should appear multiple times (main row + tooltip)
        expect(screen.getAllByText('¥4,350,000').length).toBeGreaterThanOrEqual(1);

        // Should NOT display a standalone "Blue-Filer Deduction" row anymore
        // However, it IS present inside the tooltip because of our mock.
        // We verify it exists but is contained within the tooltip.
        const deductionText = screen.getByText(/Blue-Filer Deduction/);
        expect(deductionText).toBeInTheDocument();
        expect(screen.getAllByTestId('detail-info-tooltip')[0]).toContainElement(deductionText);

        // Ensure it appears only once (indicating no standalone row exists outside the tooltip)
        expect(screen.getAllByText(/Blue-Filer Deduction/).length).toBe(1);
    });

    it('displays Total Net Income row when there are mixed income sources', () => {
        const mixedInputs: TakeHomeInputs = {
            ...mockInputs,
            incomeStreams: [
                { id: '1', type: 'salary', amount: 3_000_000, frequency: 'annual' },
                { id: '2', type: 'business', amount: 2_000_000, blueFilerDeduction: 100_000 }
            ]
        };

        const mixedResults: TakeHomeResults = {
            ...mockResults,
            hasEmploymentIncome: true, // Has employment income
            // Mocking other necessary values
            netEmploymentIncome: 2_000_000, // Dummy
            totalNetIncome: 3_900_000, // Dummy total
            salaryIncome: 3_000_000,
        };

        render(<TaxesTab results={mixedResults} inputs={mixedInputs} />);

        // Should display "Total Net Income" for mixed income
        expect(screen.getByText('Total Net Income')).toBeInTheDocument();
        expect(screen.getByText('¥3,900,000')).toBeInTheDocument();
    });

    it('Blue-Filer Deduction affects NHI Calculation Base in SocialInsuranceTab for NHI', () => {
        render(<SocialInsuranceTab results={mockResults} inputs={mockInputs} />);

        // Should show Net Business / Misc Income row (consistent with TaxesTab)
        // Note: It appears in the main row and inside the tooltip (rendered by mock)
        const netBusinessElements = screen.getAllByText(/Net Business.*Misc Income/);
        expect(netBusinessElements.length).toBeGreaterThan(0);
        expect(netBusinessElements[0]).toBeInTheDocument();

        const netIncomeValues = screen.getAllByText('¥4,350,000'); // 5M - 650k
        expect(netIncomeValues.length).toBeGreaterThan(0);

        // Should NOT show standalone deduction row (it's in the tooltip now)
        expect(screen.queryByText('Blue-Filer Deduction', { selector: '.MuiTypography-root' })).not.toBeInTheDocument();

        // Should affect NHI Calculation Base visually
        // Base = 5,000,000 - 650,000 - 430,000 = 3,920,000
        expect(screen.getByText('NHI Calculation Base')).toBeInTheDocument();
        expect(screen.getByText('¥3,920,000')).toBeInTheDocument();
    });

    it('displays Salary Income specifically for Employee Insurance with mixed income', () => {
        const mixedInputs: TakeHomeInputs = {
            ...mockInputs,
            healthInsuranceProvider: 'KyokaiKenpo', // Not NHI
            incomeStreams: [
                { id: '1', type: 'salary', amount: 3_000_000, frequency: 'annual' },
                { id: '2', type: 'business', amount: 2_000_000 }
            ]
        };

        // Results don't matter much for this display test as logic is in component using inputs
        const mixedResults: TakeHomeResults = {
            ...mockResults,
            annualIncome: 5_000_000,
            healthInsuranceProvider: 'KyokaiKenpo'
        };

        render(<SocialInsuranceTab results={mixedResults} inputs={mixedInputs} />);

        // Should NOT show "Annual Income" in the header rows (it's conditionally rendered for NHI)
        expect(screen.queryByText('Annual Income', { exact: true })).not.toBeInTheDocument();

        expect(screen.getByText('Annual Salary Income')).toBeInTheDocument();
        // Check for specific rows that should appear for Employee Insurance
        expect(screen.getAllByText('Monthly Remuneration').length).toBeGreaterThan(0);
        expect(screen.getAllByText('¥250,000').length).toBeGreaterThan(0); // 3M / 12
    });

    it('does not display instructions tooltip for Net Business / Misc Income when there is no Blue-Filer deduction', () => {
        const noBlueFilerResults: TakeHomeResults = {
            ...mockResults,
            blueFilerDeduction: 0,
        };
        const noBlueFilerInputs: TakeHomeInputs = {
            ...mockInputs,
            incomeStreams: [{
                id: 'mock-advanced-business',
                type: 'business',
                amount: 5_000_000,
                blueFilerDeduction: 0
            }]
        };

        render(<TaxesTab results={noBlueFilerResults} inputs={noBlueFilerInputs} />);

        // Verify the row exists
        const rowLabel = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'span' && content.includes('Net Business / Misc Income');
        });
        expect(rowLabel).toBeInTheDocument();

        // Verify the tooltip is NOT present within that area
        expect(screen.queryByTitle("Business & Miscellaneous Income Details")).not.toBeInTheDocument();
    });

    it('displays instructions tooltip for Net Business / Misc Income when there IS a Blue-Filer deduction', () => {
        // mockResults already has blueFilerDeduction: 650_000
        render(<TaxesTab results={mockResults} inputs={mockInputs} />);

        expect(screen.getByTitle("Business & Miscellaneous Income")).toBeInTheDocument();
    });
});
