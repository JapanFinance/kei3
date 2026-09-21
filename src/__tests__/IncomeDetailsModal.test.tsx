// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { IncomeDetailsModal } from '../components/TakeHomeCalculator/Income/IncomeDetailsModal';
import {
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type IncomeStream,
  type TakeHomeInputs,
} from '../types/tax';

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

    // 1. Add from the Business Income section
    await user.click(screen.getByRole('button', { name: /add business income/i }));

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
    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
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

    // The Business Income section has its one entry, so it offers no add button
    expect(screen.queryByRole('button', { name: /add business income/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add employment income/i })).toBeInTheDocument();
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
    expect(screen.getByText('Employment Income (給与所得)')).toBeInTheDocument();

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

    // Choose Commuting Allowance from the employment-income type menu
    await user.click(screen.getByRole('button', { name: /add employment income/i }));
    await user.click(screen.getByRole('menuitem', { name: /commuting allowance/i }));

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

    // The Commuting Allowance entry of the employment-income type menu is disabled
    await user.click(screen.getByRole('button', { name: /add employment income/i }));
    const option = screen.getByRole('menuitem', { name: /commuting allowance/i });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveTextContent(/Already added/);
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

    await user.click(screen.getByRole('button', { name: /add employment income/i }));
    const stockOption = screen.getByRole('menuitem', { name: /stock-based compensation/i });
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

    await user.click(screen.getByRole('button', { name: /add public pension/i }));

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
    const streams: IncomeStream[] = [{ id: 'p1', type: 'publicPension', amount: 1_800_000 }];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /add public pension/i })).toBeEnabled();
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
  it('lists all four investment types in the category menu and opens the form for the chosen one', async () => {
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

    await user.click(screen.getByRole('button', { name: /add investment income/i }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual([
      'Withholding Designated Account特定口座（源泉徴収あり）',
      'Capital GainsOther accounts',
      'DividendsOther accounts',
      'Interest',
    ]);

    await user.click(within(menu).getByRole('menuitem', { name: /^dividends/i }));
    expect(screen.getByRole('heading', { name: 'Add Dividends' })).toBeInTheDocument();

    const amountInput = screen.getByRole('textbox', { name: /gross dividends/i });
    await user.clear(amountInput);
    await user.type(amountInput, '300000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(handleStreamsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        amount: 300000,
      }),
    ]);
  });

  it('displays the withheld-tax footer and net investment income alongside the subtotal', () => {
    const streams: IncomeStream[] = [
      {
        id: 'a1',
        type: 'withholdingAccount',
        capitalGains: 1_000_000,
        dividends: 200_000,
        reportsCapitalGains: false,
        reportsDividends: false,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        investmentIncome={{
          gross: { capitalGains: 1_000_000, dividends: 200_000, interest: 0 },
          grossTotal: 1_200_000,
          withheld: { national: 183_780, residence: 60_000, total: 243_780 },
        }}
      />,
    );

    expect(screen.getByText('Subtotal: ¥1,200,000')).toBeInTheDocument();
    expect(
      screen.getByText(/Withheld only: ¥1,200,000 − ¥243,780 tax = ¥956,220/),
    ).toBeInTheDocument();
    // The header caption mirrors the category subtotal.
    expect(screen.getByText('Investment: ¥1,200,000')).toBeInTheDocument();
  });

  it("shows an account's card total, its sales/dividends caption, and its per-flag description", () => {
    const { rerender } = render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'a1',
            type: 'withholdingAccount',
            capitalGains: -500_000,
            dividends: 800_000,
            reportsCapitalGains: false,
            reportsDividends: false,
          },
        ]}
        onStreamsChange={() => {}}
      />,
    );
    expect(screen.getByText('¥300,000')).toBeInTheDocument();
    // Each figure is its own unbreakable span, so a narrow card breaks at the separator.
    expect(screen.getByText('Sales -¥500,000')).toBeInTheDocument();
    expect(screen.getByText('Dividends ¥800,000')).toBeInTheDocument();
    expect(screen.getByText('Withheld only')).toBeInTheDocument();

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'a1',
            type: 'withholdingAccount',
            capitalGains: -500_000,
            dividends: 800_000,
            reportsCapitalGains: true,
            reportsDividends: true,
          },
        ]}
        onStreamsChange={() => {}}
      />,
    );
    expect(screen.getByText('Reported')).toBeInTheDocument();

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'a1',
            type: 'withholdingAccount',
            capitalGains: 500_000,
            dividends: 0,
            reportsCapitalGains: true,
            reportsDividends: false,
          },
        ]}
        onStreamsChange={() => {}}
      />,
    );
    expect(screen.getByText('Sales reported')).toBeInTheDocument();

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'a1',
            type: 'withholdingAccount',
            capitalGains: 0,
            dividends: 300_000,
            reportsCapitalGains: false,
            reportsDividends: true,
          },
        ]}
        onStreamsChange={() => {}}
      />,
    );
    expect(screen.getByText('Dividends reported')).toBeInTheDocument();
  });

  it('offers the reported-dividends election for an account whose dividends are reported', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'a1',
            type: 'withholdingAccount',
            capitalGains: 0,
            dividends: 300_000,
            reportsCapitalGains: false,
            reportsDividends: true,
          },
        ]}
        onStreamsChange={() => {}}
        onReportedDividendsTaxationChange={() => {}}
      />,
    );

    expect(screen.getByRole('group', { name: 'Reported dividends' })).toBeInTheDocument();
  });

  it('describes each entry by its election and account, and footers the reported total without a withheld line', () => {
    const streams: IncomeStream[] = [
      {
        id: 'g1',
        type: 'capitalGains',
        shareType: 'listed',
        account: 'foreign',
        amount: -100_000,
      },
      {
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: true,
        amount: 300_000,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        investmentIncome={{
          gross: { capitalGains: 0, dividends: 0, interest: 0 },
          grossTotal: 0,
          withheld: { national: 0, residence: 0, total: 0 },
          reported: {
            gross: { capitalGains: -100_000, qualifyingCapitalLosses: 0, dividends: 300_000 },
            lossOffsetAgainstDividends: 0,
            unabsorbedQualifyingLoss: 0,
            nonQualifyingLoss: 100_000,
            netIncome: { capitalGains: 0, dividends: 300_000 },
            taxable: { capitalGains: 0, dividends: 300_000 },
            nationalIncomeTaxBase: 45_000,
          },
        }}
      />,
    );

    expect(screen.getByText('Reported, foreign account')).toBeInTheDocument();
    expect(screen.getByText('Reported')).toBeInTheDocument();
    expect(screen.getByText('Subtotal: ¥200,000')).toBeInTheDocument();
    expect(screen.getByText(/Reported on the return: ¥200,000/)).toBeInTheDocument();
    expect(screen.queryByText(/Withheld only:/)).not.toBeInTheDocument();
  });

  it('describes each dividend by whether it is reported, without the election, and footers the reported total', () => {
    // The election is one for every reported dividend (措法8条の4②), shown once on the group,
    // so an entry says only whether it is on the return.
    const streams: IncomeStream[] = [
      {
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: true,
        amount: 400_000,
      },
      {
        id: 'd2',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        amount: 300_000,
      },
    ];

    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        reportedDividendsTaxation="aggregate"
        investmentIncome={{
          gross: { capitalGains: 0, dividends: 300_000, interest: 0 },
          grossTotal: 300_000,
          withheld: { national: 45_945, residence: 15_000, total: 60_945 },
          aggregateDividends: 400_000,
        }}
      />,
    );

    expect(screen.getByText('Reported')).toBeInTheDocument();
    expect(screen.getByText('Withheld only')).toBeInTheDocument();
    expect(screen.queryByText(/progressive|separate/i)).not.toBeInTheDocument();
    expect(screen.getByText('Subtotal: ¥700,000')).toBeInTheDocument();
    expect(
      screen.getByText(/Withheld only: ¥300,000 − ¥60,945 tax = ¥239,055/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Reported on the return: ¥400,000/)).toBeInTheDocument();
    expect(screen.queryByText(/Reported on the return: ¥300,000/)).not.toBeInTheDocument();
  });

  it('offers the election for the reported dividends as one control for the group', async () => {
    const user = userEvent.setup();
    const onReportedDividendsTaxationChange = vi.fn();
    const withheldOnly: IncomeStream[] = [
      {
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        amount: 300_000,
      },
    ];
    const reported: IncomeStream[] = [
      {
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: true,
        amount: 300_000,
      },
      {
        id: 'd2',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        amount: 200_000,
      },
    ];

    const { rerender } = render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={withheldOnly}
        onStreamsChange={() => {}}
        onReportedDividendsTaxationChange={onReportedDividendsTaxationChange}
      />,
    );
    // With no reported dividend there is nothing the election applies to.
    expect(screen.queryByRole('group', { name: 'Reported dividends' })).toBeNull();

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={reported}
        onStreamsChange={() => {}}
        onReportedDividendsTaxationChange={onReportedDividendsTaxationChange}
      />,
    );
    const group = screen.getByRole('group', { name: 'Reported dividends' });
    expect(within(group).getByRole('button', { name: 'Separate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The statutory notes sit behind the label's tooltip rather than under the control.
    expect(screen.getByRole('button', { name: 'reported dividends info' })).toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Progressive' }));
    expect(onReportedDividendsTaxationChange).toHaveBeenCalledWith('aggregate');

    // Without a way to change it the election is not offered, and the entries still say which
    // election they follow.
    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={reported}
        onStreamsChange={() => {}}
        reportedDividendsTaxation="aggregate"
      />,
    );
    expect(screen.queryByRole('group', { name: 'Reported dividends' })).toBeNull();
    expect(screen.getByText('Reported')).toBeInTheDocument();
    expect(screen.getByText('Withheld only')).toBeInTheDocument();
  });

  it('offers the reporting planner with calculation inputs and a listed-share entry, computing it on expand', async () => {
    const user = userEvent.setup();
    const streams: IncomeStream[] = [
      { id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' },
      {
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: true,
        amount: 1_000_000,
      },
    ];
    const calculationInputs: TakeHomeInputs = {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: streams,
      ageRange: 'age20to39',
      healthInsuranceProvider: 'KyokaiKenpo',
      region: 'Tokyo',
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    const { rerender } = render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
        calculationInputs={calculationInputs}
      />,
    );

    const toggle = screen.getByRole('button', { name: /compare reporting plans/i });
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    await user.click(toggle);

    // The engine tests' three elections, now rows instead of columns: 申告不要 (withheld only)
    // kept 4,739,798, 申告分離課税 (Current, the election in force, and the "all reported"
    // row) kept 4,739,848, 総合課税 kept 4,748,648 — the best of the four, so it is also Best.
    expect(await screen.findByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Best')).toBeInTheDocument();
    expect(screen.getByText('¥4,739,798')).toBeInTheDocument();
    expect(screen.getAllByText('¥4,739,848')).not.toHaveLength(0);
    expect(screen.getAllByText('¥4,748,648')).not.toHaveLength(0);
    expect(screen.getByText(/配当控除, not modelled yet/)).toBeInTheDocument();

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /compare reporting plans/i }),
    ).not.toBeInTheDocument();
  });

  it('shows only the gross subtotal when no investmentIncome prop is supplied', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[
          {
            id: 'd1',
            type: 'dividends',
            shareType: 'listed',
            paymentChannel: 'domestic',
            isReported: false,
            amount: 200_000,
          },
        ]}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.getByText('Subtotal: ¥200,000')).toBeInTheDocument();
    expect(screen.queryByText(/Withheld only:/)).not.toBeInTheDocument();
  });

  it('omits the header Investment caption when there is no investment income', () => {
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[{ id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' }]}
        onStreamsChange={() => {}}
      />,
    );

    expect(screen.queryByText(/Investment:/)).not.toBeInTheDocument();
  });
});

describe('IncomeDetailsModal - Adding from each section', () => {
  const salary: IncomeStream = { id: 's1', type: 'salary', amount: 5000000, frequency: 'annual' };

  const renderModal = (streams: IncomeStream[] = [salary]) =>
    render(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={streams}
        onStreamsChange={vi.fn()}
      />,
    );

  it('shows every income classification with its own add button, even when empty', () => {
    renderModal([]);

    for (const heading of [
      'Employment Income (給与所得)',
      'Business Income (事業所得)',
      'Miscellaneous Income (雑所得)',
      'Public Pension Income (公的年金等)',
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    for (const label of [
      /add employment income/i,
      /add business income/i,
      /add miscellaneous income/i,
      /add public pension/i,
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByText(/Subtotal:/)).not.toBeInTheDocument();
  });

  it('lists the types of a multi-type section in a menu and opens the form for the chosen one', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /add employment income/i }));

    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Salary', 'Bonus', 'Commuting Allowance', 'Stock-Based Compensation']);

    await user.click(within(menu).getByRole('menuitem', { name: /bonus/i }));
    expect(screen.getByRole('heading', { name: 'Add Bonus' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the form directly for a single-type section', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /add miscellaneous income/i }));

    expect(screen.getByRole('heading', { name: 'Add Miscellaneous' })).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /annual income after expenses/i }),
    ).toBeInTheDocument();
  });

  it('keeps the type fixed while editing', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /edit income/i }));

    expect(screen.getByRole('heading', { name: 'Edit Salary' })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /income\/benefit type/i }),
    ).not.toBeInTheDocument();
  });

  it('reopens on the list after closing part-way through an add', async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal();
    await user.click(screen.getByRole('button', { name: /add public pension/i }));
    await user.click(screen.getByRole('textbox', { name: /annual gross pension income/i }));
    await user.keyboard('{Escape}');

    rerender(
      <IncomeDetailsModal
        open={true}
        onClose={() => {}}
        streams={[salary]}
        onStreamsChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /add public pension/i })).toBeInTheDocument();
  });
});
