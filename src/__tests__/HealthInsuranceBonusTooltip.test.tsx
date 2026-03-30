// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import HealthInsuranceBonusTooltip from '../components/TakeHomeCalculator/tabs/HealthInsuranceBonusTooltip';
import { DEFAULT_PROVIDER_REGION, CUSTOM_PROVIDER_ID, type HealthInsuranceProviderId } from '../types/healthInsurance';
import type { TakeHomeInputs } from '../types/tax';

// Mock the provider data (time-series structure: regions map to arrays of rate periods)
vi.mock('../data/employeesHealthInsurance/providerRateData', () => ({
    PROVIDER_DEFINITIONS: {
        'TestProvider': {
            providerName: 'Test Provider',
            regions: {
                'DEFAULT': [
                    { effectiveFrom: { year: 2025, month: 3 }, rates: {
                        employeeHealthInsuranceRate: 0.05,
                        employerHealthInsuranceRate: 0.06,
                        employeeLongTermCareRate: 0.01,
                        employerLongTermCareRate: 0.01,
                    }}
                ]
            }
        },
        'TestProviderNoEmployerRate': {
            providerName: 'Test Provider No Employer',
            regions: {
                'DEFAULT': [
                    { effectiveFrom: { year: 2025, month: 3 }, rates: {
                        employeeHealthInsuranceRate: 0.04,
                        employeeLongTermCareRate: 0.01,
                    }}
                ]
            }
        }
    }
}));

// Mock the rate lookup to use the mocked data
vi.mock('../data/employeesHealthInsurance/providerRates', () => ({
    getRegionalRatesForMonth: (providerId: string) => {
        const providers: Record<string, Record<string, unknown>> = {
            'TestProvider': {
                employeeHealthInsuranceRate: 0.05,
                employerHealthInsuranceRate: 0.06,
                employeeLongTermCareRate: 0.01,
                employerLongTermCareRate: 0.01,
            },
            'TestProviderNoEmployerRate': {
                employeeHealthInsuranceRate: 0.04,
                employeeLongTermCareRate: 0.01,
            }
        };
        return providers[providerId];
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

    test('displays generic employer note for standard provider', () => {
        render(<HealthInsuranceBonusTooltip inputs={mockInputs} />);

        expect(screen.getByText(/The employer also contributes separately./)).toBeInTheDocument();
    });

    test('displays generic employer note for custom provider', () => {
        const customInputs: TakeHomeInputs = {
            ...mockInputs,
            healthInsuranceProvider: CUSTOM_PROVIDER_ID,
            customEHIRates: {
                healthInsuranceRate: 3.5, // 3.5%
                longTermCareRate: 1.2,
            },
            isSubjectToLongTermCarePremium: false,
        };

        render(<HealthInsuranceBonusTooltip inputs={customInputs} />);

        expect(screen.getByText(/The employer also contributes separately./)).toBeInTheDocument();
    });
});
