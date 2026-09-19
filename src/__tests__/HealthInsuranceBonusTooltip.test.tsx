// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';

import HealthInsuranceBonusTooltip from '../components/TakeHomeCalculator/tabs/HealthInsuranceBonusTooltip';
import { DEFAULT_PROVIDER_REGION, CUSTOM_PROVIDER_ID } from '../types/healthInsurance';
import type { TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';

// Mock the provider data (time-series structure: regions map to arrays of rate periods)
vi.mock('../data/employeesHealthInsurance/providerRateData', async importOriginal => {
  const PROVIDER_DEFINITIONS = {
    KyokaiKenpo: {
      providerName: 'Kyokai Kenpo',
      regions: {
        DEFAULT: [
          {
            effectiveFrom: { year: 2025, month: 3 },
            rates: {
              employeeHealthInsuranceRate: 5_000,
              employerHealthInsuranceRate: 6_000,
              employeeLongTermCareRate: 1_000,
              employerLongTermCareRate: 1_000,
            },
          },
        ],
      },
    },
    TestProviderNoEmployerRate: {
      providerName: 'Test Provider No Employer',
      regions: {
        DEFAULT: [
          {
            effectiveFrom: { year: 2025, month: 3 },
            rates: {
              employeeHealthInsuranceRate: 4_000,
              employeeLongTermCareRate: 1_000,
            },
          },
        ],
      },
    },
  };
  return {
    ...(await importOriginal<typeof import('../data/employeesHealthInsurance/providerRateData')>()),
    PROVIDER_DEFINITIONS,
    getProviderDefinition: (id: string) =>
      PROVIDER_DEFINITIONS[id as keyof typeof PROVIDER_DEFINITIONS],
  };
});

// Mock the rate lookup to use the mocked data
vi.mock('../data/employeesHealthInsurance/providerRates', async importOriginal => ({
  ...(await importOriginal<typeof import('../data/employeesHealthInsurance/providerRates')>()),
  getRegionalRatesForMonth: (providerId: string) => {
    const providers: Record<string, Record<string, unknown>> = {
      KyokaiKenpo: {
        employeeHealthInsuranceRate: 5_000,
        employerHealthInsuranceRate: 6_000,
        employeeLongTermCareRate: 1_000,
        employerLongTermCareRate: 1_000,
      },
      TestProviderNoEmployerRate: {
        employeeHealthInsuranceRate: 4_000,
        employeeLongTermCareRate: 1_000,
      },
    };
    return providers[providerId];
  },
}));

describe('HealthInsuranceBonusTooltip', () => {
  const mockInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [],
    ageRange: 'age20to39' as const,
    region: DEFAULT_PROVIDER_REGION,
    healthInsuranceProvider: 'KyokaiKenpo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
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
      ageRange: 'age20to39' as const,
    };

    render(<HealthInsuranceBonusTooltip inputs={customInputs} />);

    expect(screen.getByText(/The employer also contributes separately./)).toBeInTheDocument();
  });

  const breakdown = [
    {
      month: 6,
      bonusAmount: 1_000_000,
      standardBonusAmount: 1_000_000,
      cumulativeStandardBonus: 1_000_000,
      premium: 60_000,
      includesLongTermCare: true,
    },
  ];

  test('shows the rate of a provider as a percentage', () => {
    render(
      <HealthInsuranceBonusTooltip
        inputs={{ ...mockInputs, ageRange: 'age40to59' }}
        breakdown={breakdown}
      />,
    );

    expect(screen.getByText('6.0%')).toBeInTheDocument();
  });

  test('shows the custom rate as a percentage', () => {
    const customInputs: TakeHomeInputs = {
      ...mockInputs,
      healthInsuranceProvider: CUSTOM_PROVIDER_ID,
      customEHIRates: { healthInsuranceRate: 3.505, longTermCareRate: 1.2 },
      ageRange: 'age40to59',
    };

    render(<HealthInsuranceBonusTooltip inputs={customInputs} breakdown={breakdown} />);

    expect(screen.getByText('4.705%')).toBeInTheDocument();
  });
});
