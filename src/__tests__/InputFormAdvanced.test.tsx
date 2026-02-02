// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import type { TakeHomeFormState } from '../types/tax';
import {
    DEFAULT_PROVIDER,
    DEFAULT_PROVIDER_REGION
} from '../types/healthInsurance';
import { calculateNetEmploymentIncome } from '../utils/taxCalculations';
import { vi } from 'vitest';

// Mock DependentsModal to inspect props
vi.mock('../components/TakeHomeCalculator/Dependents/DependentsModal', () => ({
    DependentsModal: ({ taxpayerNetIncome }: { taxpayerNetIncome: number }) => (
        <div data-testid="dependents-modal" data-net-income={taxpayerNetIncome}>
            Mocked Modal
        </div>
    )
}));

describe('TakeHomeInputForm Income Calculation', () => {
    const defaultInputs: TakeHomeFormState = {
        annualIncome: 0,
        incomeMode: 'advanced',
        incomeStreams: [],
        isSubjectToLongTermCarePremium: false,
        region: DEFAULT_PROVIDER_REGION,
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
    };

    test('correctly calculates net income for mixed income streams', () => {
        const inputs: TakeHomeFormState = {
            ...defaultInputs,
            incomeMode: 'advanced',
            incomeStreams: [
                { id: '1', type: 'salary', amount: 5_000_000, frequency: 'annual' },
                { id: '2', type: 'business', amount: 5_000_000 }
            ]
        };

        const mockOnInputChange = vi.fn();

        render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

        const modal = screen.getByTestId('dependents-modal');
        const netIncomePassed = Number(modal.getAttribute('data-net-income'));

        const expectedNetSalary = calculateNetEmploymentIncome(5_000_000);
        const expectedTotalNet = expectedNetSalary + 5_000_000;

        expect(netIncomePassed).toBe(expectedTotalNet);
    });
});
