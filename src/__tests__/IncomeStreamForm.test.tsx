// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeStreamForm } from '../components/TakeHomeCalculator/Income/IncomeStreamForm';

describe('IncomeStreamForm', () => {
    const mockOnSave = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        mockOnSave.mockClear();
        mockOnCancel.mockClear();
    });

    it('should default frequency to Annual for Salary', () => {
        render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);
        // Defaults to Salary
        const frequencySelect = screen.getByRole('combobox', { name: /frequency/i });
        expect(frequencySelect).toHaveTextContent('Annual');
    });

    it('should default frequency to Monthly when switching to Commuting Allowance', async () => {
        const user = userEvent.setup();
        render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

        // Switch to Commuting Allowance
        const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
        await user.click(typeSelect);
        const listbox = screen.getByRole('listbox');
        await user.click(within(listbox).getByRole('option', { name: /commuting allowance/i }));

        // Check frequency
        const frequencySelect = screen.getByRole('combobox', { name: /frequency/i });
        expect(frequencySelect).toHaveTextContent('1 Month');
    });
});
