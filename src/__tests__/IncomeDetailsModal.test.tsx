// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeDetailsModal } from '../components/TakeHomeCalculator/Income/IncomeDetailsModal';
import { describe, it, expect, vi } from 'vitest';
import type { IncomeStream } from '../types/tax';

describe('IncomeDetailsModal - Business Income', () => {
    it('allows adding business income with blue-filer deduction', async () => {
        const user = userEvent.setup();
        const handleStreamsChange = vi.fn();
        const streams: IncomeStream[] = [];

        render(
            <IncomeDetailsModal
                open={true}
                onClose={() => { }}
                streams={streams}
                onStreamsChange={handleStreamsChange}
            />
        );

        // 1. Click Add Income
        await user.click(screen.getByRole('button', { name: /add income/i }));

        // 2. Select "Business" type
        // Use getByRole 'combobox' for the MUI Select trigger
        const typeSelect = screen.getByRole('combobox', { name: /income type/i });
        await user.click(typeSelect);

        // Select option from the listbox
        const listbox = screen.getByRole('listbox');
        await user.click(within(listbox).getByRole('option', { name: /business/i }));

        // 3. Verify Blue-Filer Deduction input and text appears
        const deductionSelect = screen.getByRole('combobox', { name: /blue-filer special deduction/i });
        expect(deductionSelect).toBeInTheDocument();

        // Check for explanation text (NTA No.2072 is visible outside tooltip)
        expect(screen.getByText(/No.2072/i)).toBeInTheDocument();

        // 3b. Verify Tooltip Trigger (Info Icon)
        const infoButton = screen.getByRole('button', { name: /requirements/i });
        expect(infoButton).toBeInTheDocument();

        // 4. Select deduction (e.g., ¥650,000)
        await user.click(deductionSelect);
        const deductionListbox = screen.getByRole('listbox');
        await user.click(within(deductionListbox).getByRole('option', { name: /¥650,000/i }));

        // 5. Enter Amount
        // SpinnerNumberField renders as a textbox type="text" for formatting
        const amountInput = screen.getByRole('textbox', { name: /annual net income/i });
        await user.clear(amountInput);
        await user.type(amountInput, '6000000');

        // 6. Save
        await user.click(screen.getByRole('button', { name: /add/i }));

        // 7. Verify callback
        expect(handleStreamsChange).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'business',
                amount: 6000000,
                blueFilerDeduction: 650000,
            })
        ]);
    });

    it('disables Business option if a business stream already exists', async () => {
        const user = userEvent.setup();
        const handleStreamsChange = vi.fn();
        const streams: IncomeStream[] = [
            {
                id: '1',
                type: 'business',
                amount: 3000000,
                blueFilerDeduction: 100000
            }
        ];

        render(
            <IncomeDetailsModal
                open={true}
                onClose={() => { }}
                streams={streams}
                onStreamsChange={handleStreamsChange}
            />
        );

        // 1. Click Add Income
        await user.click(screen.getByRole('button', { name: /add income/i }));

        // 2. Open Type Dropdown
        const typeSelect = screen.getByRole('combobox', { name: /income type/i });
        await user.click(typeSelect);

        // 3. Verify Business option is disabled
        const listbox = screen.getByRole('listbox');
        const businessOption = within(listbox).getByRole('option', { name: /business/i });

        expect(businessOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('displays Blue-filer Deduction in the list', () => {
        // Render with an existing business stream with deduction
        const streams: IncomeStream[] = [{
            id: '1',
            type: 'business',
            amount: 5000000,
            blueFilerDeduction: 650000
        }];

        render(
            <IncomeDetailsModal
                open={true}
                onClose={() => { }}
                streams={streams}
                onStreamsChange={() => { }}
            />
        );

        expect(screen.getByText(/Blue-filer Deduction: -¥650,000/i)).toBeInTheDocument();
    });

    it('displays capped Blue-filer Deduction when income is less than deduction', () => {
        // Income (300k) < Deduction (650k)
        const streams: IncomeStream[] = [{
            id: '1',
            type: 'business',
            amount: 300000,
            blueFilerDeduction: 650000
        }];

        render(
            <IncomeDetailsModal
                open={true}
                onClose={() => { }}
                streams={streams}
                onStreamsChange={() => { }}
            />
        );

        // Should display capped amount (-300,000)
        expect(screen.getByText(/Blue-filer Deduction: -¥300,000/i)).toBeInTheDocument();
    });

    it('does not display Blue-filer Deduction or stray 0 when it is 0/None', () => {
        const streams: IncomeStream[] = [{
            id: '1',
            type: 'business',
            amount: 1111111, // Use an amount with no zeros
            blueFilerDeduction: 0
        }];

        render(
            <IncomeDetailsModal
                open={true}
                onClose={() => { }}
                streams={streams}
                onStreamsChange={() => { }}
            />
        );

        // Should NOT display "Blue-filer Deduction"
        expect(screen.queryByText(/Blue-filer Deduction/i)).not.toBeInTheDocument();

        // Should NOT display a stray "0"
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
});

