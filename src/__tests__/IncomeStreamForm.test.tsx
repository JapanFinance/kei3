// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent } from '@testing-library/react';

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

  it('shows the listed-share guidance box for both capital gains and dividends', () => {
    const { rerender } = render(
      <IncomeStreamForm type="listedCapitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    expect(screen.getByText('Assumptions for Listed-Share Income')).toBeInTheDocument();

    rerender(
      <IncomeStreamForm type="listedDividends" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    expect(screen.getByText('Assumptions for Listed-Share Income')).toBeInTheDocument();
  });

  it('shows the deposit-interest guidance box', () => {
    render(<IncomeStreamForm type="depositInterest" onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText(/never affects 合計所得金額/)).toBeInTheDocument();
  });

  it('accepts a capital-gains loss as a negative amount and saves it unchanged', () => {
    render(
      <IncomeStreamForm type="listedCapitalGains" onSave={mockOnSave} onCancel={mockOnCancel} />,
    );
    const input = screen.getByLabelText('Net Capital Gains');
    fireEvent.change(input, { target: { value: '-¥500,000' } });
    expect(input.getAttribute('value')).toBe('-¥500,000');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'listedCapitalGains', amount: -500000 }),
    );
  });

  it('has no minus sign available for dividends, unlike capital gains', () => {
    render(<IncomeStreamForm type="listedDividends" onSave={mockOnSave} onCancel={mockOnCancel} />);
    const input = screen.getByLabelText('Gross Dividends');
    // The minus sign is not part of the allowed format (min is 0, not negative), so it is
    // dropped rather than producing a negative value.
    fireEvent.change(input, { target: { value: '-¥300,000' } });
    expect(input.getAttribute('value')).toBe('¥300,000');
  });
});
