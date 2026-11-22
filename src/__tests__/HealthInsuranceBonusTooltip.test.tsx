// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';

import HealthInsuranceBonusTooltip from '../components/TakeHomeCalculator/tabs/HealthInsuranceBonusTooltip';
import {
  getEmployeePremiumRate,
  getRegionalRatesForMonth,
} from '../data/employeesHealthInsurance/providerRates';
import { CUSTOM_PROVIDER_ID } from '../types/healthInsurance';
import type { TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';

describe('HealthInsuranceBonusTooltip', () => {
  const mockInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [],
    ageRange: 'age20to39' as const,
    region: 'Tokyo',
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
    const expectedRate = getEmployeePremiumRate(
      getRegionalRatesForMonth('KyokaiKenpo', 'Tokyo', 2026, 6)!,
      true,
    ).toPercent();

    render(
      <HealthInsuranceBonusTooltip
        inputs={{ ...mockInputs, ageRange: 'age40to59' }}
        breakdown={breakdown}
      />,
    );

    expect(screen.getByText(expectedRate)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Kyokai Kenpo (Tokyo) Premium Rates' }),
    ).toBeInTheDocument();
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
