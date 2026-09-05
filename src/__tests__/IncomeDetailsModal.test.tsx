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

    // 2. Choose the "Business" type
    await user.click(screen.getByRole('button', { name: /^Business/ }));

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

    // 2. Verify the Business entry is disabled, with the reason
    const businessOption = screen.getByRole('button', { name: /^Business/ });
    expect(businessOption).toHaveAttribute('aria-disabled', 'true');
    expect(businessOption).toHaveTextContent(/Already added/);
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

    // Choose Commuting Allowance
    await user.click(screen.getByRole('button', { name: /^Commuting Allowance/ }));

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

    // Check that the Commuting Allowance entry is disabled
    const option = screen.getByRole('button', { name: /^Commuting Allowance/ });
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

    const stockOption = screen.getByRole('button', { name: /^Stock-Based Compensation/ });
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

    await user.click(screen.getByRole('button', { name: /^Public Pension/ }));

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

    const pensionOption = screen.getByRole('button', { name: /^Public Pension/ });
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

describe('IncomeDetailsModal - Investment Income', () => {
  it('allows adding listed capital gains, dividends, and deposit interest', async () => {
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
    await user.click(screen.getByRole('button', { name: /^Listed Share Capital Gains/ }));

    const amountInput = screen.getByRole('textbox', { name: /annual net capital gains/i });
    await user.clear(amountInput);
    await user.type(amountInput, '1000000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(handleStreamsChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'listedCapitalGains', amount: 1000000 }),
    ]);
  });

  it('displays investment streams in their own section with chips and a gross subtotal', () => {
    const streams: IncomeStream[] = [
      { id: 'g1', type: 'listedCapitalGains', amount: 1_000_000 },
      { id: 'd1', type: 'listedDividends', amount: 200_000 },
      { id: 'i1', type: 'depositInterest', amount: 50_000 },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText('Investment Income (配当・譲渡・利子)')).toBeInTheDocument();
    expect(screen.getByText('CAPITAL GAINS')).toBeInTheDocument();
    expect(screen.getByText('DIVIDENDS')).toBeInTheDocument();
    expect(screen.getByText('INTEREST')).toBeInTheDocument();
    expect(screen.getByText('Subtotal: ¥1,250,000')).toBeInTheDocument();
    // Investment income is excluded from the header's earned-income total.
    expect(screen.getByText('Total: ¥0')).toBeInTheDocument();
    expect(screen.getByText('Investment: ¥1,250,000')).toBeInTheDocument();
  });

  it('shows a negative gross subtotal when capital losses exceed the rest', () => {
    const streams: IncomeStream[] = [{ id: 'g1', type: 'listedCapitalGains', amount: -300_000 }];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText('Subtotal: -¥300,000')).toBeInTheDocument();
  });

  it('shows the withheld tax and net investment income alongside the group subtotal', () => {
    const streams: IncomeStream[] = [
      { id: 'g1', type: 'listedCapitalGains', amount: 1_000_000 },
      { id: 'd1', type: 'listedDividends', amount: 200_000 },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        investmentIncome={{
          gross: { listedCapitalGains: 1_000_000, listedDividends: 200_000, depositInterest: 0 },
          grossTotal: 1_200_000,
          withheld: { national: 183_780, residence: 60_000, total: 243_780 },
        }}
      />,
    );

    expect(screen.getByText(/Withheld at Source \(源泉徴収\): -¥243,780/)).toBeInTheDocument();
    expect(screen.getByText(/Net Investment Income: ¥956,220/)).toBeInTheDocument();
  });

  it('omits the section when no investment streams are present', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[{ id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' }]}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.queryByText(/Investment Income/)).not.toBeInTheDocument();
    expect(screen.queryByText('Investment: ¥0')).not.toBeInTheDocument();
  });
});

describe('IncomeDetailsModal - Type chooser', () => {
  const salary: IncomeStream = { id: 's1', type: 'salary', amount: 5000000, frequency: 'annual' };

  const renderModal = () =>
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[salary]}
        onStreamsChange={vi.fn()}
      />,
    );

  it('lists every income classification with a description per type', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /add income/i }));

    for (const heading of [
      'Employment Income (給与所得)',
      'Business Income (事業所得)',
      'Miscellaneous Income (雑所得)',
      'Public Pension Income (公的年金等)',
      'Investment Income (配当・譲渡・利子)',
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /^Salary/ })).toHaveTextContent(
      /Regular wages from an employer/,
    );
    expect(screen.getByRole('button', { name: /^Deposit Interest/ })).toHaveTextContent(
      /預貯金の利子/,
    );
  });

  it('returns to the list from Cancel', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /add income/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: /add income/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Salary/ })).not.toBeInTheDocument();
  });

  it('opens the form for the chosen type and returns to the chooser from Change type', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /add income/i }));
    await user.click(screen.getByRole('button', { name: /^Bonus/ }));

    expect(screen.getByRole('heading', { name: 'Add Bonus' })).toBeInTheDocument();
    expect(screen.getAllByText('Month Paid').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /change type/i }));
    expect(screen.getByRole('button', { name: /^Bonus/ })).toBeInTheDocument();
  });

  it('keeps the type fixed while editing', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /edit income/i }));

    expect(screen.getByRole('heading', { name: 'Edit Salary' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change type/i })).not.toBeInTheDocument();
  });

  it('reopens on the list after closing part-way through an add', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[salary]}
        onStreamsChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /add income/i }));
    await user.click(screen.getByRole('button', { name: /^Bonus/ }));
    await user.click(screen.getByRole('textbox', { name: /gross income/i }));
    await user.keyboard('{Escape}');

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[salary]}
        onStreamsChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /add income/i })).toBeInTheDocument();
  });
});
