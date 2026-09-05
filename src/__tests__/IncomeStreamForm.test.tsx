// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
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

  it('accepts a negative amount for listed capital gains (a loss)', async () => {
    const user = userEvent.setup();
    render(
      <IncomeStreamForm type="listedCapitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const amountInput = screen.getByRole('textbox', { name: /annual net capital gains/i });
    await user.clear(amountInput);
    await user.type(amountInput, '-500000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'listedCapitalGains', amount: -500000 }),
    );
  });

  it('rejects a negative amount for listed dividends', async () => {
    const user = userEvent.setup();
    render(<IncomeStreamForm type="listedDividends" onSave={mockOnSave} onCancel={mockOnCancel} />);

    const amountInput = screen.getByRole('textbox', { name: /annual gross dividends/i });
    await user.clear(amountInput);
    await user.type(amountInput, '-500000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'listedDividends', amount: 500000 }),
    );
  });

  it('shows the deposit interest withholding rate in the helper text', () => {
    render(<IncomeStreamForm type="depositInterest" onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getAllByText(/20\.315%/).length).toBeGreaterThan(0);
  });

  it('shows the listed-share assumptions and NTA sources for capital gains and dividends', () => {
    render(
      <IncomeStreamForm type="listedCapitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    expect(screen.getByText(/Assumptions for Listed-Share Income/i)).toBeInTheDocument();
    expect(screen.getByText(/Assumes a domestic/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /株式等を譲渡したときの課税/ })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
    );
  });
});
