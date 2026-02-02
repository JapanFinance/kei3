// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { TakeHomeResults, TakeHomeInputs, ResidenceTaxDetails, FurusatoNozeiDetails } from '../types/tax';

// Mock dependencies
vi.mock('../components/ui/InfoTooltip', () => ({
    default: () => <div data-testid="info-tooltip" />
}));
// Updated mock to return span for inline usage
vi.mock('../components/ui/DetailInfoTooltip', () => ({
    default: ({ title }: { title: string }) => <span data-testid="detail-info-tooltip" title={title} />
}));

const mockResults: TakeHomeResults = {
    annualIncome: 5_000_000,
    isEmploymentIncome: false,
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
    // Skipped due to test environment rendering issues with dynamic content injection
    // Manual verification required for TaxesTab layout
    it('displays Net Business Income and Blue-Filer info in TaxesTab (Single Income)', () => {
        render(<TaxesTab results={mockResults} inputs={mockInputs} />);

        // Verify the component renders header
        expect(screen.getByText(/Tax Calculation Details/)).toBeInTheDocument();

        // Should NOT display "Total Net Income" for single income source
        expect(screen.queryByText('Total Net Income')).not.toBeInTheDocument();

        // Should display "Net Business / Misc Income"
        expect(screen.getByText(/Net Business.*Misc Income/)).toBeInTheDocument();
        // Value should appear once (for Net Business Income)
        expect(screen.getAllByText('¥4,350,000')).toHaveLength(1);

        // Should NOT display a standalone "Blue-Filer Deduction" row anymore
        expect(screen.queryByText(/Blue-Filer Deduction/, { selector: '.MuiTypography-root' })).not.toBeInTheDocument();
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
            isEmploymentIncome: true, // Has employment income
            // Mocking other necessary values
            netEmploymentIncome: 2_000_000, // Dummy
            totalNetIncome: 3_900_000 // Dummy total
        };

        render(<TaxesTab results={mixedResults} inputs={mixedInputs} />);

        // Should display "Total Net Income" for mixed income
        expect(screen.getByText('Total Net Income')).toBeInTheDocument();
        expect(screen.getByText('¥3,900,000')).toBeInTheDocument();
    });

    it('displays Blue-Filer Deduction in SocialInsuranceTab for NHI', () => {
        render(<SocialInsuranceTab results={mockResults} inputs={mockInputs} />);
        // Should show deduction row
        expect(screen.getByText('Blue-Filer Deduction')).toBeInTheDocument();
        expect(screen.getByText('-¥650,000')).toBeInTheDocument();

        // Should affect NHI Base Calculation visually?
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
            annualIncome: 5_000_000, // Total
            healthInsuranceProvider: 'KyokaiKenpo'
        };

        render(<SocialInsuranceTab results={mixedResults} inputs={mixedInputs} />);

        // Should NOT show "Annual Income" in the header rows (it's conditionally rendered for NHI)
        expect(screen.queryByText('Annual Income', { exact: true })).not.toBeInTheDocument();

        // Should show "Annual Salary Income"
        expect(screen.getByText('Annual Salary Income')).toBeInTheDocument();
        expect(screen.getByText('¥3,000,000')).toBeInTheDocument();

        // Should show "Monthly Salary Income"
        expect(screen.getByText('Monthly Salary Income')).toBeInTheDocument();
        expect(screen.getByText('¥250,000')).toBeInTheDocument(); // 3M / 12
    });
});
