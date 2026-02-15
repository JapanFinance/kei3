// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import type { TakeHomeResults, TakeHomeInputs, ResidenceTaxDetails } from '../types/tax';
import { vi, describe, it, expect, beforeAll } from 'vitest';

// Mock DetailInfoTooltip to render children directly for easier testing
vi.mock('../components/ui/DetailInfoTooltip', async () => {
    const { createPortal } = await import('react-dom');
    return {
        default: ({ title, children }: { title: string, children?: React.ReactNode }) => (
            <>
                <span data-testid="detail-info-tooltip-trigger" title={title}>ℹ️</span>
                {createPortal(
                    <div data-testid="detail-info-tooltip-content">{children}</div>,
                    document.body
                )}
            </>
        )
    };
});

// Mock content
vi.mock('../utils/formatters', () => ({
    formatJPY: (val: number) => `¥${val.toLocaleString()}`,
    formatPercent: (val: number) => `${(val * 100).toFixed(3)}%`,
}));

// Mock scrollTo for JSDOM
beforeAll(() => {
    Element.prototype.scrollTo = vi.fn();
});

describe('SocialInsuranceTab', () => {
    const mockInputs: TakeHomeInputs = {
        incomeStreams: [
            { id: '1', type: 'salary', amount: 500000, frequency: 'monthly' }, // 6M annual
            { id: '2', type: 'commutingAllowance', amount: 20000, frequency: 'monthly' } // 240k annual
        ],
        isSubjectToLongTermCarePremium: true,
        region: 'Tokyo',
        healthInsuranceProvider: 'KyokaiKenpo',
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
    };

    const mockResidenceTax: ResidenceTaxDetails = {
        taxableIncome: 0, cityProportion: 0, prefecturalProportion: 0, residenceTaxRate: 0, basicDeduction: 0, personalDeductionDifference: 0,
        city: { cityTaxableIncome: 0, cityAdjustmentCredit: 0, cityIncomeTax: 0, cityPerCapitaTax: 0 },
        prefecture: { prefecturalTaxableIncome: 0, prefecturalAdjustmentCredit: 0, prefecturalIncomeTax: 0, prefecturalPerCapitaTax: 0 },
        perCapitaTax: 0, forestEnvironmentTax: 0, totalResidenceTax: 200000
    };

    const mockResults: TakeHomeResults = {
        annualIncome: 6000000,
        healthInsurance: 300000,
        pensionPayments: 500000,
        employmentInsurance: 30000,
        nationalIncomeTax: 100000,
        residenceTax: mockResidenceTax,
        takeHomeIncome: 4870000,
        healthInsuranceProvider: 'KyokaiKenpo',
        region: 'Tokyo',
        isSubjectToLongTermCarePremium: true,
        hasEmploymentIncome: true,
        totalNetIncome: 4200000,
        dcPlanContributions: 0,
        furusatoNozei: {
            limit: 0,
            incomeTaxReduction: 0,
            residenceTaxDonationBasicDeduction: 0,
            residenceTaxSpecialDeduction: 0,
            outOfPocketCost: 0,
            residenceTaxReduction: 0
        },
        residenceTaxBasicDeduction: 430000,
        salaryIncome: 6000000,
    };

    it('displays Monthly Remuneration label', () => {
        render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);
        expect(screen.getAllByText('Monthly Remuneration').length).toBeGreaterThan(0);
    });

    it('shows Monthly Remuneration breakdown in tooltip', async () => {
        render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

        // Detailed Breakdown is rendered directly by mock
        expect(screen.getByText('Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Base Monthly Salary:')).toBeInTheDocument();
        expect(screen.getAllByText('¥500,000').length).toBeGreaterThan(0);
        expect(screen.getByText('Monthly Commuting Allowance:')).toBeInTheDocument();
        expect(screen.getAllByText('¥20,000').length).toBeGreaterThan(0);
        expect(screen.getByText('Total:')).toBeInTheDocument();
        expect(screen.getAllByText('¥520,000').length).toBeGreaterThan(0);
    });

    it('shows calculation and SMR table in Health Insurance tooltip', async () => {
        render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

        // With mock, content is rendered directly
        expect(screen.getAllByText(/Standard Monthly Remuneration/i).length).toBeGreaterThan(0);
        // SMR for 520,000 monthly remuneration is 530,000
        expect(screen.getAllByText('¥530,000').length).toBeGreaterThan(0);
        expect(screen.getByText('Monthly Insurance Premium')).toBeInTheDocument();
        // Health insurance premium for 530,000 SMR is 30,475
        expect(screen.getAllByText('¥30,475').length).toBeGreaterThan(0);
    });

    it('shows calculation and SMR table in Pension tooltip', async () => {
        render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

        // With mock, content is rendered directly
        // "Employees' Pension" is the section header in main tab
        expect(screen.getByText("Employees' Pension")).toBeInTheDocument();

        // Tooltip content:
        expect(screen.getByText('Employees Pension Insurance Calculation')).toBeInTheDocument();

        // Verify Pension SMR is used (Table Column Header)
        expect(screen.getAllByText('Pension SMR').length).toBeGreaterThan(0);

        // Verify Standard Monthly Remuneration is present in calculation box
        expect(screen.getAllByText(/Standard Monthly Remuneration/).length).toBeGreaterThan(0);

        // Verify Monthly Pension Contribution header
        expect(screen.getByText('Monthly Pension Contribution')).toBeInTheDocument();

        // Pension SMR for 520k is also 530k (in the table row)
        expect(screen.getAllByText('¥530,000').length).toBeGreaterThan(0);

        // Verify Table is present title
        expect(screen.getByText('Employees Pension (厚生年金) SMR Table')).toBeInTheDocument();
    });

    it('handles high income caps correctly (Health vs Pension SMR)', async () => {
        const highIncomeInputs = {
            ...mockInputs,
            incomeStreams: [
                { id: '1', type: 'salary', amount: 800000, frequency: 'monthly' } // 800k/month
            ]
        } as TakeHomeInputs;

        // 800k falls into Grade 39 (770k-810k) -> SMR 790k
        // Pension Caps at Grade 32 (635k+) -> SMR 650k
        render(<SocialInsuranceTab inputs={highIncomeInputs} results={mockResults} />);

        // 1. Check Health Insurance Tooltip -> Should show SMR 790,000
        expect(screen.getAllByText(/Your Grade:/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/¥790,000/).length).toBeGreaterThan(0);

        // 2. Check Pension Tooltip -> Should show Pension SMR 650,000
        expect(screen.getByText('Employees Pension Insurance Calculation')).toBeInTheDocument();
        expect(screen.getByText('Pension SMR')).toBeInTheDocument();

        // Check for capped value
        expect(screen.getAllByText('¥650,000').length).toBeGreaterThan(0);
        expect(screen.getByText(/\(Maximum Cap\)/)).toBeInTheDocument();
    });

    it('hides Monthly Commuting Allowance row when 0', async () => {
        const noCommutingInputs = {
            ...mockInputs,
            incomeStreams: [
                { id: '1', type: 'salary', amount: 500000, frequency: 'monthly' }
            ]
        } as TakeHomeInputs;

        render(<SocialInsuranceTab inputs={noCommutingInputs} results={mockResults} />);

        // Breakdown should be present
        expect(screen.getByText('Breakdown')).toBeInTheDocument();

        // Base Salary should be present
        expect(screen.getByText('Base Monthly Salary:')).toBeInTheDocument();

        // Commuting Allowance row should NOT be present
        expect(screen.queryByText('Monthly Commuting Allowance:')).not.toBeInTheDocument();

        // Total should still be present
        expect(screen.getByText('Total:')).toBeInTheDocument();
    });
});
