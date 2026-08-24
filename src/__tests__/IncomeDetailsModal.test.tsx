// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { IncomeDetailsModal } from '../components/TakeHomeCalculator/Income/IncomeDetailsModal';
import type { IncomeStream } from '../types/tax';

describe('IncomeDetailsModal - Business Income', () => {
  it('allows adding business income with blue-filer deduction', async () => {
    const user = userEvent.setup();
    const handleStreamsChange = vi.fn();
    const streams: IncomeStream[] = [];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={handleStreamsChange}
      />,
    );

    // 1. Click Add Income
    await user.click(screen.getByRole('button', { name: /add income/i }));

    // 2. Select "Business" type
    // Use getByRole 'combobox' for the MUI Select trigger
    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
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
      }),
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
        blueFilerDeduction: 100000,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={handleStreamsChange}
      />,
    );

    // 1. Click Add Income
    await user.click(screen.getByRole('button', { name: /add income/i }));

    // 2. Open Type Dropdown
    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);

    // 3. Verify Business option is disabled
    const listbox = screen.getByRole('listbox');
    const businessOption = within(listbox).getByRole('option', { name: /business/i });

    expect(businessOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('displays Blue-filer Deduction in the list', () => {
    // Render with an existing business stream with deduction
    const streams: IncomeStream[] = [
      {
        id: '1',
        type: 'business',
        amount: 5000000,
        blueFilerDeduction: 650000,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText(/Blue-filer Deduction: -¥650,000/i)).toBeInTheDocument();
  });

  it('displays capped Blue-filer Deduction when income is less than deduction', () => {
    // Income (300k) < Deduction (650k)
    const streams: IncomeStream[] = [
      {
        id: '1',
        type: 'business',
        amount: 300000,
        blueFilerDeduction: 650000,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    // Should display capped amount (-300,000)
    expect(screen.getByText(/Blue-filer Deduction: -¥300,000/i)).toBeInTheDocument();
  });

  it('does not display Blue-filer Deduction or stray 0 when it is 0/None', () => {
    const streams: IncomeStream[] = [
      {
        id: '1',
        type: 'business',
        amount: 1111111, // Use an amount with no zeros
        blueFilerDeduction: 0,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    // Should NOT display "Blue-filer Deduction"
    expect(screen.queryByText(/Blue-filer Deduction/i)).not.toBeInTheDocument();

    // Should NOT display a stray "0"
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('IncomeDetailsModal - Commuting Allowance', () => {
  it('displays Commuting Allowance in the Employment Income section', () => {
    const streams: IncomeStream[] = [
      {
        id: 'commute-1',
        type: 'commutingAllowance',
        amount: 20000,
        frequency: 'monthly',
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    // Section title "Employment Income (給与所得)" should be present
    expect(screen.getByText(/Employment Income/i)).toBeInTheDocument();

    // Separate "Commuting Allowance" section title should NOT be present
    expect(screen.queryByText('Commuting Allowance (通勤手当)')).not.toBeInTheDocument();

    // Should check for the amount
    expect(screen.getByText('¥20,000')).toBeInTheDocument();

    // Should check for the description "Monthly"
    expect(screen.getByText('Monthly')).toBeInTheDocument();

    // Should check for the annual calculation hint
    expect(screen.getByText(/\(Annual: ¥240,000\)/i)).toBeInTheDocument();
  });

  it('validates commuting allowance limit', async () => {
    const user = userEvent.setup();
    const handleStreamsChange = vi.fn();

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[]}
        onStreamsChange={handleStreamsChange}
      />,
    );

    // Click Add Income
    await user.click(screen.getByText(/Add Income\/Benefit/i));

    // Select Commuting Allowance
    const typeSelect = screen.getByLabelText(/Income\/Benefit Type/i);
    await user.click(typeSelect);
    await user.click(screen.getByRole('option', { name: /Commuting Allowance/i }));

    // Select Frequency: Monthly
    const frequencySelect = screen.getByLabelText(/Frequency/i);
    await user.click(frequencySelect);
    await user.click(screen.getByRole('option', { name: /1 Month/i }));

    // Enter amount > 150,000
    const amountInput = screen.getByLabelText('Allowance Amount');

    // Verify initial helper text is present
    expect(screen.getByText(/Commuting allowance up to ¥150,000 per month/i)).toBeInTheDocument();

    await user.clear(amountInput);
    await user.type(amountInput, '200000');

    // Click Add
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/exceed ¥150,000\/month/i)).toBeInTheDocument();
    });
    expect(handleStreamsChange).not.toHaveBeenCalled();
  });

  it('disables Commuting Allowance option if one already exists', async () => {
    const user = userEvent.setup();
    const streams: IncomeStream[] = [
      {
        id: 'commute-1',
        type: 'commutingAllowance',
        amount: 20000,
        frequency: 'monthly',
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    // Click Add Income
    await user.click(screen.getByText(/Add Income\/Benefit/i));

    // Open Type Select
    const typeSelect = screen.getByLabelText(/Income\/Benefit Type/i);
    await user.click(typeSelect);

    // Check if Commuting Allowance option is disabled
    const option = screen.getByRole('option', { name: /Commuting Allowance/i });
    expect(option).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('IncomeDetailsModal - Stock Compensation', () => {
  it('keeps Stock-Based Compensation option enabled and allows adding multiple streams', async () => {
    const user = userEvent.setup();
    const handleStreamsChange = vi.fn();
    const streams: IncomeStream[] = [
      {
        id: 'stock-1',
        type: 'stockCompensation',
        amount: 1_000_000,
        issuerDomicile: 'foreign',
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={handleStreamsChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add income/i }));

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);

    const listbox = screen.getByRole('listbox');
    const stockOption = within(listbox).getByRole('option', { name: /stock-based compensation/i });
    expect(stockOption).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(stockOption);

    const amountInput = screen.getByRole('textbox', { name: /gross income/i });
    await user.clear(amountInput);
    await user.type(amountInput, '500000');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(handleStreamsChange).toHaveBeenCalledWith([
      streams[0],
      expect.objectContaining({
        type: 'stockCompensation',
        amount: 500000,
        issuerDomicile: 'foreign',
      }),
    ]);
  });
});

describe('IncomeDetailsModal - Public Pension', () => {
  it('allows adding public pension income', async () => {
    const user = userEvent.setup();
    const handleStreamsChange = vi.fn();

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[]}
        onStreamsChange={handleStreamsChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add income/i }));

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /public pension/i }));

    // The gross-amount guidance and non-taxable pension warning are shown
    expect(screen.getByText(/What Counts as Public Pension/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /公的年金等の課税関係/ })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm',
    );

    const amountInput = screen.getByRole('textbox', { name: /annual gross pension income/i });
    await user.clear(amountInput);
    await user.type(amountInput, '2400000');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(handleStreamsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'publicPension',
        amount: 2400000,
      }),
    ]);
  });

  it('displays public pension streams in their own section with a PENSION chip and subtotal', () => {
    const streams: IncomeStream[] = [
      { id: 'p1', type: 'publicPension', amount: 1_800_000 },
      { id: 'p2', type: 'publicPension', amount: 600_000 },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText('Public Pension Income (公的年金等)')).toBeInTheDocument();
    expect(screen.getAllByText('PENSION')).toHaveLength(2);
    expect(screen.getByText('Subtotal: ¥2,400,000')).toBeInTheDocument();
    // The header total counts pension income at face value.
    expect(screen.getByText('Total: ¥2,400,000')).toBeInTheDocument();
  });

  it('keeps the Public Pension option enabled when a pension stream already exists', async () => {
    const user = userEvent.setup();
    const streams: IncomeStream[] = [{ id: 'p1', type: 'publicPension', amount: 1_800_000 }];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add income/i }));

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    const listbox = screen.getByRole('listbox');
    const pensionOption = within(listbox).getByRole('option', { name: /public pension/i });
    expect(pensionOption).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the deduction and net alongside the group subtotal, over the combined gross', () => {
    const streams: IncomeStream[] = [
      { id: 'p1', type: 'publicPension', amount: 1_800_000 },
      { id: 'p2', type: 'publicPension', amount: 600_000 },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        netPublicPensionIncome={1_300_000}
      />,
    );

    // ¥2,400,000 combined gross − the ¥1,100,000 deduction the caller's net implies.
    expect(screen.getByText('Subtotal: ¥2,400,000')).toBeInTheDocument();
    expect(
      screen.getByText(/Public Pension Deduction \(公的年金等控除\): -¥1,100,000/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Net Public Pension Income: ¥1,300,000/)).toBeInTheDocument();
  });

  it('still shows the breakdown when the deduction covers the whole pension', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[{ id: 'p1', type: 'publicPension', amount: 1_100_000 }]}
        onStreamsChange={() => {}}
        netPublicPensionIncome={0}
      />,
    );

    expect(
      screen.getByText(/Public Pension Deduction \(公的年金等控除\): -¥1,100,000/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Net Public Pension Income: ¥0/)).toBeInTheDocument();
  });

  it('shows only the gross subtotal when no net pension income is supplied', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[{ id: 'p1', type: 'publicPension', amount: 2_400_000 }]}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText('Subtotal: ¥2,400,000')).toBeInTheDocument();
    expect(screen.queryByText(/公的年金等控除/)).not.toBeInTheDocument();
  });
});
