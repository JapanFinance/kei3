// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent, within } from '@testing-library/react';
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
    render(<IncomeStreamForm type="salary" onSave={mockOnSave} onCancel={mockOnCancel} />);
    const frequencySelect = screen.getByRole('combobox', { name: /frequency/i });
    expect(frequencySelect).toHaveTextContent('Annual');
  });

  it('should default frequency to Monthly for Commuting Allowance', () => {
    render(
      <IncomeStreamForm type="commutingAllowance" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    const frequencySelect = screen.getByRole('combobox', { name: /frequency/i });
    expect(frequencySelect).toHaveTextContent('1 Month');
  });

  it('names the type in the heading for adding and for editing', () => {
    const { rerender } = render(
      <IncomeStreamForm type="bonus" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    expect(screen.getByRole('heading', { name: 'Add Bonus' })).toBeInTheDocument();

    rerender(
      <IncomeStreamForm
        type="bonus"
        initialData={{ id: 'b1', type: 'bonus', amount: 300000, month: 5 }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit Bonus' })).toBeInTheDocument();
  });

  it('shows the listed-share guidance box for withholding accounts, capital gains and dividends', () => {
    const { rerender } = render(
      <IncomeStreamForm type="withholdingAccount" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    expect(screen.getByText(/Copy the two figures from the account's/)).toBeInTheDocument();
    expect(screen.getByText(/Capital losses are combined with the dividends/)).toBeInTheDocument();

    // The in-account netting belongs to the withholding account alone; the other two forms say
    // what withholding, if any, applies to them.
    rerender(<IncomeStreamForm type="capitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(
      screen.getByText(/No tax is withheld on a sale outside a withholding designated account/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Capital losses are combined with the dividends/),
    ).not.toBeInTheDocument();

    rerender(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText(/A dividend paid in Japan has 20.315% withheld/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Capital losses are combined with the dividends/),
    ).not.toBeInTheDocument();
  });

  it('shows the deposit-interest guidance box', () => {
    render(<IncomeStreamForm type="interest" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText(/does not affect total net income/)).toBeInTheDocument();
  });

  it('accepts a capital-gains loss as a negative amount and saves it unchanged', () => {
    render(<IncomeStreamForm type="capitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />);
    const input = screen.getByLabelText('Net Capital Gains');
    fireEvent.change(input, { target: { value: '-¥500,000' } });
    expect(input.getAttribute('value')).toBe('-¥500,000');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'capitalGains', amount: -500000 }),
    );
  });

  it('has no minus sign available for dividends, unlike capital gains', () => {
    render(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);
    const input = screen.getByLabelText('Gross Dividends');
    // The minus sign is not part of the allowed format (min is 0, not negative), so it is
    // dropped rather than producing a negative value.
    fireEvent.change(input, { target: { value: '-¥300,000' } });
    expect(input.getAttribute('value')).toBe('¥300,000');
  });

  // The unsupported variant of each investment type is shown but disabled, so what the
  // calculation does and does not cover is visible where the amount is entered.
  it.each([
    ['capitalGains', 'Listed', 'Other'],
    ['dividends', 'Listed', 'Other'],
  ] as const)('offers only listed shares for %s', (type, supported, unsupported) => {
    render(<IncomeStreamForm type={type} onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: supported })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: unsupported })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ shareType: 'listed' }));
  });

  it('offers only interest paid in Japan', () => {
    render(<IncomeStreamForm type="interest" onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: 'In Japan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Outside Japan' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ payerDomicile: 'domestic' }));
  });

  it('offers only accounts outside a withholding account, with no reporting toggle for a sale', async () => {
    const user = userEvent.setup();
    render(<IncomeStreamForm type="capitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />);

    // A sale outside a 特定口座（源泉徴収あり）is always reported (措法37条の11の5①); a
    // withholding account has its own entry type, so it is not offered as an account here.
    await user.click(screen.getByRole('combobox', { name: /account/i }));
    const options = screen.getAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'Domestic account without withholding (特定口座（源泉徴収なし）・一般口座)',
      'Foreign account',
    ]);
    for (const option of options) {
      expect(option).not.toHaveAttribute('aria-disabled', 'true');
    }
    await user.click(screen.getByRole('option', { name: 'Foreign account' }));

    expect(screen.queryByRole('button', { name: 'Withheld only' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reported' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ account: 'foreign' }));
    expect(mockOnSave.mock.calls[0]![0]).not.toHaveProperty('isReported');
  });

  it('offers withheld-only and reported for a dividend, starting withheld only', () => {
    render(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByRole('button', { name: 'Withheld only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Reported' })).toBeEnabled();
  });

  it('forces Reported and disables Withheld only when a dividend is paid abroad', () => {
    render(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abroad' }));
    expect(screen.getByRole('button', { name: 'Withheld only' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reported' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ paymentChannel: 'abroad', isReported: true }),
    );
  });

  it('explains the disabled Withheld only button only for a dividend paid abroad', () => {
    render(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(
      screen.queryByText('A dividend paid abroad has to be reported.'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abroad' }));
    expect(screen.getByText('A dividend paid abroad has to be reported.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'In Japan' }));
    expect(
      screen.queryByText('A dividend paid abroad has to be reported.'),
    ).not.toBeInTheDocument();
  });

  it('saves a dividend as reported when Reported is chosen', () => {
    render(<IncomeStreamForm type="dividends" onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reported' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dividends', isReported: true }),
    );
  });

  it('saves the default account for a sale', () => {
    render(<IncomeStreamForm type="capitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'domesticNoWithholding' }),
    );
    expect(mockOnSave.mock.calls[0]![0]).not.toHaveProperty('isReported');
  });

  it('keeps an edited entry on the variant it was saved with', () => {
    render(
      <IncomeStreamForm
        type="dividends"
        initialData={{
          id: 'd1',
          type: 'dividends',
          amount: 300000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
        }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', shareType: 'listed' }),
    );
  });

  it('saves the account amounts and both reporting flags', () => {
    render(
      <IncomeStreamForm type="withholdingAccount" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    fireEvent.change(screen.getByLabelText('Net Capital Gains (譲渡損益)'), {
      target: { value: '¥1,000,000' },
    });
    fireEvent.change(screen.getByLabelText('Dividends Received into the Account (配当等)'), {
      target: { value: '¥200,000' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Sales' })).getByRole('button', {
        name: 'Reported',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Dividends' })).getByRole('button', {
        name: 'Reported',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'withholdingAccount',
        capitalGains: 1_000_000,
        dividends: 200_000,
        reportsCapitalGains: true,
        reportsDividends: true,
      }),
    );
  });

  it('forces the dividends toggle to reported when a reported loss reduced their withholding', () => {
    render(
      <IncomeStreamForm type="withholdingAccount" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    fireEvent.change(screen.getByLabelText('Net Capital Gains (譲渡損益)'), {
      target: { value: '-¥500,000' },
    });
    fireEvent.change(screen.getByLabelText('Dividends Received into the Account (配当等)'), {
      target: { value: '¥800,000' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Sales' })).getByRole('button', {
        name: 'Reported',
      }),
    );

    const dividendsGroup = within(screen.getByRole('group', { name: 'Dividends' }));
    expect(dividendsGroup.getByRole('button', { name: 'Withheld only' })).toBeDisabled();
    expect(dividendsGroup.getByRole('button', { name: 'Reported' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByText(/Reporting this account's loss requires reporting its dividends as well/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ reportsCapitalGains: true, reportsDividends: true }),
    );
  });
});
