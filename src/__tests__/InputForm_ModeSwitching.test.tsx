// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import type { TakeHomeInputs, IncomeStream } from '../types/tax';
import { useState } from 'react';
import { vi } from 'vitest';

// Mock the IncomeDetailsModal to simplify testing
// We don't need to test the modal itself, just the effect of changing streams
vi.mock('../components/TakeHomeCalculator/Income/IncomeDetailsModal', () => ({
  IncomeDetailsModal: ({ open, onStreamsChange, streams }: { open: boolean; onStreamsChange: (streams: IncomeStream[]) => void; streams: IncomeStream[] }) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <button 
          onClick={() => {
            const newStreams = [
              ...streams, 
              { id: 'bonus1', type: 'bonus', amount: 1000000 } as IncomeStream
            ];
            onStreamsChange(newStreams);
          }}
        >
          Add Bonus
        </button>
      </div>
    );
  }
}));

const TestWrapper = () => {
  const [inputs, setInputs] = useState<TakeHomeInputs>({
    annualIncome: 5000000,
    isEmploymentIncome: true,
    incomeMode: 'salary',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    showDetailedInput: false,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: unknown } }) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <TakeHomeInputForm inputs={inputs} onInputChange={handleInputChange} />
      <div data-testid="isEmploymentIncome">{inputs.isEmploymentIncome.toString()}</div>
      <div data-testid="incomeMode">{inputs.incomeMode}</div>
    </div>
  );
};

describe('InputForm Mode Switching Bug', () => {
  it('should restore isEmploymentIncome to true when switching back to Advanced mode with employment streams', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    // 1. Start in Salary mode (default)
    expect(screen.getByTestId('incomeMode')).toHaveTextContent('salary');
    expect(screen.getByTestId('isEmploymentIncome')).toHaveTextContent('true');

    // 2. Switch to Advanced
    await user.click(screen.getByRole('button', { name: /advanced/i }));
    expect(screen.getByTestId('incomeMode')).toHaveTextContent('advanced');

    // 3. Add a bonus (using our mocked modal)
    // First open the modal
    await user.click(screen.getByRole('button', { name: /edit income streams/i }));
    // Click the "Add Bonus" button in our mock
    await user.click(screen.getByRole('button', { name: /add bonus/i }));
    
    // 4. Switch to Business
    await user.click(screen.getByRole('button', { name: /business/i }));
    expect(screen.getByTestId('incomeMode')).toHaveTextContent('business');
    expect(screen.getByTestId('isEmploymentIncome')).toHaveTextContent('false');

    // 5. Switch back to Advanced
    await user.click(screen.getByRole('button', { name: /advanced/i }));
    expect(screen.getByTestId('incomeMode')).toHaveTextContent('advanced');

    // This is the bug: it stays false currently
    expect(screen.getByTestId('isEmploymentIncome')).toHaveTextContent('true');
  });
});
