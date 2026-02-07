// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useState } from 'react';
import type { TakeHomeFormState, IncomeStream } from '../types/tax';
import { DEFAULT_PROVIDER, DEFAULT_PROVIDER_REGION } from '../types/healthInsurance';
import { vi } from 'vitest';

// Mock child components to keep the test focused on InputForm logic
vi.mock('../components/TakeHomeCalculator/Dependents/DependentsModal', () => ({
    DependentsModal: () => <div data-testid="dependents-modal" />
}));
// We don't even need IncomeDetailsModal logic because we assert on state directly
vi.mock('../components/TakeHomeCalculator/Income/IncomeDetailsModal', () => ({
    IncomeDetailsModal: () => <div data-testid="income-details-modal" />
}));

// Test wrapper that mimics App.tsx state management
const TestWrapper = ({ initialState }: { initialState?: Partial<TakeHomeFormState> }) => {
    const [inputs, setInputs] = useState<TakeHomeFormState>({
        annualIncome: 5000000,
        incomeMode: 'salary',
        incomeStreams: [{ id: '1', type: 'salary', amount: 5000000, frequency: 'annual' }],
        isSubjectToLongTermCarePremium: false,
        region: DEFAULT_PROVIDER_REGION,
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        ...initialState
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: unknown } }) => {
        const { name, value } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <ThemeProvider theme={createTheme()}>
            <TakeHomeInputForm inputs={inputs} onInputChange={handleInputChange} />
            <div data-testid="debug-state">{JSON.stringify(inputs)}</div>
        </ThemeProvider>
    );
};

describe('Income Mode Transitions (State Assertion)', () => {

    beforeEach(() => {
        render(<TestWrapper />);
    });

    // Helper to get current state from the DOM
    const getState = (): TakeHomeFormState => {
        const el = screen.getByTestId('debug-state');
        return JSON.parse(el.textContent || '{}');
    };

    test('1. Salary -> Business: Should switch mode and preserve amount', () => {
        // Initial state check
        expect(getState().incomeMode).toBe('salary');
        expect(getState().annualIncome).toBe(5000000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);
        expect(getState().incomeStreams[0]?.type).toBe('salary');

        // Switch to Business
        fireEvent.click(screen.getByRole('button', { name: /business/i }));

        expect(getState().incomeMode).toBe('business');
        expect(getState().annualIncome).toBe(5000000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);
        expect(getState().incomeStreams[0]?.type).toBe('business');
    });

    test('2. Business -> Salary: Should switch mode and preserve amount', () => {
        // To Business, change income to 6M
        fireEvent.click(screen.getByRole('button', { name: /business/i }));
        expect(getState().incomeMode).toBe('business');
        expect(getState().annualIncome).toBe(5_000_000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5_000_000);
        expect(getState().incomeStreams[0]?.type).toBe('business');

        fireEvent.change(screen.getByRole('textbox', { name: /annual income/i }), { target: { value: '6000000' } });

        expect(getState().incomeMode).toBe('business');
        expect(getState().annualIncome).toBe(6_000_000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(6_000_000);
        expect(getState().incomeStreams[0]?.type).toBe('business');

        // To Salary
        fireEvent.click(screen.getByRole('button', { name: /salary/i }));

        expect(getState().incomeMode).toBe('salary');
        expect(getState().annualIncome).toBe(6_000_000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(6_000_000);
        expect(getState().incomeStreams[0]?.type).toBe('salary');
    });

    test('3. Salary -> Advanced (Clean): Should create single stream', () => {
        // Switch to Advanced
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        expect(getState().incomeMode).toBe('advanced');
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);
        expect(getState().incomeStreams[0]?.type).toBe('salary');
    });

    test('4. Business -> Advanced (Clean): Should create single business stream', () => {
        // To Business
        fireEvent.click(screen.getByRole('button', { name: /business/i }));

        // To Advanced
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        const state = getState();
        expect(state.incomeMode).toBe('advanced');
        expect(state.incomeStreams).toHaveLength(1);
        expect(state.incomeStreams[0]?.amount).toBe(5000000);
        expect(state.incomeStreams[0]?.type).toBe('business');
    });

    test('5. Advanced -> Salary: Should preserve annual income', () => {
        // To Advanced
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        // To Salary
        fireEvent.click(screen.getByRole('button', { name: /salary/i }));

        expect(getState().incomeMode).toBe('salary');
        expect(getState().annualIncome).toBe(5000000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);
        expect(getState().incomeStreams[0]?.type).toBe('salary');
    });

    test('6. Advanced -> Business: Should preserve annual income', () => {
        // To Advanced -> Business
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));
        fireEvent.click(screen.getByRole('button', { name: /business/i }));

        expect(getState().incomeMode).toBe('business');
        expect(getState().annualIncome).toBe(5000000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);
        expect(getState().incomeStreams[0]?.type).toBe('business');
    });

    test('7. Advanced -> Salary -> Modify -> Advanced: Should RESET streams to match new total', async () => {
        // 1. To Advanced (Total 5M)
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));
        expect(getState().incomeStreams[0]?.amount).toBe(5000000);

        // 2. To Salary
        fireEvent.click(screen.getByRole('button', { name: /salary/i }));

        // 3. Modify Amount to 6M
        const input = await screen.findByLabelText('Gross Annual Salary');
        fireEvent.change(input, { target: { value: '6000000' } });
        expect(getState().annualIncome).toBe(6000000);

        // 4. Switch back to Advanced
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        // CRITICAL CHECK: Streams should be reset to single stream of 6M
        const state = getState();
        expect(state.incomeStreams).toHaveLength(1);
        expect(state.incomeStreams[0]?.amount).toBe(6000000);
    });

    test('8. Advanced -> Salary -> No Change -> Advanced: Should PRESERVE existing streams', () => {
        // Cleanup the default wrapper rendered by beforeEach
        cleanup();

        // Initial state: Advanced mode with complex streams (5M salary + 1M bonus)
        const initialStreams: IncomeStream[] = [
            { id: '1', type: 'salary', amount: 5000000, frequency: 'annual' },
            { id: '2', type: 'bonus', amount: 1000000, month: 1 }
        ];

        render(<TestWrapper initialState={{
            incomeMode: 'advanced',
            annualIncome: 6000000,
            incomeStreams: initialStreams,
        }} />);

        expect(getState().incomeStreams).toHaveLength(2);

        // 1. Switch to Salary
        fireEvent.click(screen.getByRole('button', { name: /salary/i }));

        expect(getState().incomeMode).toBe('salary');
        expect(getState().annualIncome).toBe(6000000);
        expect(getState().incomeStreams).toHaveLength(1);
        expect(getState().incomeStreams[0]?.amount).toBe(6000000);
        expect(getState().incomeStreams[0]?.type).toBe('salary');

        // 2. Switch back to Advanced (No modification to amount)
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        // 3. Verify streams are preserved
        const state = getState();
        expect(state.incomeStreams).toHaveLength(2);
        expect(state.incomeStreams).toEqual(initialStreams);
    });
});
