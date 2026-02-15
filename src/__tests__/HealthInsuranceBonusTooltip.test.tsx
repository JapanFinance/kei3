// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import HealthInsuranceBonusTooltip from '../components/TakeHomeCalculator/tabs/HealthInsuranceBonusTooltip';
import { DEFAULT_PROVIDER_REGION, CUSTOM_PROVIDER_ID, type HealthInsuranceProviderId } from '../types/healthInsurance';
import type { TakeHomeInputs, TakeHomeResults } from '../types/tax';

// Mock the provider data
vi.mock('../data/employeesHealthInsurance/providerRateData', () => ({
    PROVIDER_DEFINITIONS: {
        'TestProvider': {
            providerName: 'Test Provider',
            regions: {
                'DEFAULT': {
                    employeeHealthInsuranceRate: 0.05,
                    employerHealthInsuranceRate: 0.06,
                    employeeLongTermCareRate: 0.01,
                    employerLongTermCareRate: 0.01,
                }
            }
        },
        'TestProviderNoEmployerRate': { // Emulate case where employer rate is missing (should fallback to employee)
            providerName: 'Test Provider No Employer',
            regions: {
                'DEFAULT': {
                    employeeHealthInsuranceRate: 0.04,
                    employeeLongTermCareRate: 0.01,
                }
            }
        }
    }
}));

describe('HealthInsuranceBonusTooltip', () => {
    const mockInputs: TakeHomeInputs = {
        incomeStreams: [],
        isSubjectToLongTermCarePremium: false,
        region: DEFAULT_PROVIDER_REGION,
        healthInsuranceProvider: 'TestProvider' as unknown as HealthInsuranceProviderId,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
    };

    const mockResults: TakeHomeResults = {
        annualIncome: 0,
        hasEmploymentIncome: true,
        nationalIncomeTax: 0,
        residenceTax: {} as unknown as TakeHomeResults['residenceTax'],
        healthInsurance: 0,
        pensionPayments: 0,
        takeHomeIncome: 0,
        totalNetIncome: 0,
        salaryIncome: 0,
        furusatoNozei: {} as unknown as TakeHomeResults['furusatoNozei'],
        dcPlanContributions: 0,
        healthInsuranceProvider: 'TestProvider' as unknown as HealthInsuranceProviderId,
        region: DEFAULT_PROVIDER_REGION,
        isSubjectToLongTermCarePremium: false,
    };

    test('displays correct employer rate for standard provider', () => {
        render(<HealthInsuranceBonusTooltip inputs={mockInputs} results={mockResults} />);

        // Employee rate: 5% -> 5%
        // Employer rate: 6% -> 6%
        expect(screen.getByText(/The employer also pays at a rate of 6.0%./)).toBeInTheDocument();
    });

    test('displays correct employer rate with LTC', () => {
        const ltcInputs = { ...mockInputs, isSubjectToLongTermCarePremium: true };
        render(<HealthInsuranceBonusTooltip inputs={ltcInputs} results={mockResults} />);

        // Employee: 5% + 1% = 6%
        // Employer: 6% + 1% = 7%
        expect(screen.getByText(/The employer also pays at a rate of 7.0%./)).toBeInTheDocument();
    });

    test('falls back to employee rate when employer rate is not defined (standard provider)', () => {
        const inputs = { ...mockInputs, healthInsuranceProvider: 'TestProviderNoEmployerRate' as unknown as HealthInsuranceProviderId };
        render(<HealthInsuranceBonusTooltip inputs={inputs} results={mockResults} />);

        // Employee: 4%
        // Employer: 4% (fallback)
        expect(screen.getByText(/The employer also pays at a rate of 4.0%./)).toBeInTheDocument();
    });

    test('displays correct rate for custom provider', () => {
        const customInputs: TakeHomeInputs = {
            ...mockInputs,
            healthInsuranceProvider: CUSTOM_PROVIDER_ID,
            customEHIRates: {
                healthInsuranceRate: 3.5, // 3.5%
                longTermCareRate: 1.2,
            },
            isSubjectToLongTermCarePremium: false,
        };

        render(<HealthInsuranceBonusTooltip inputs={customInputs} results={mockResults} />);

        // Custom provider assumes symmetric rates currently
        expect(screen.getByText(/The employer also contributes separately./)).toBeInTheDocument();
    });
});
