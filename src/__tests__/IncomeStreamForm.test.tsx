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

  it('accepts a negative amount for listed capital gains (a loss)', async () => {
    const user = userEvent.setup();
    render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: /listed share capital gains/i,
      }),
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
    render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: /listed share dividends/i,
      }),
    );

    const amountInput = screen.getByRole('textbox', { name: /annual gross dividends/i });
    await user.clear(amountInput);
    await user.type(amountInput, '-500000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'listedDividends', amount: 500000 }),
    );
  });

  it('shows the deposit interest withholding rate in the helper text', async () => {
    const user = userEvent.setup();
    render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /deposit interest/i }),
    );

    expect(screen.getAllByText(/20\.315%/).length).toBeGreaterThan(0);
  });

  it('shows the listed-share assumptions and NTA sources for capital gains and dividends', async () => {
    const user = userEvent.setup();
    render(<IncomeStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: /listed share capital gains/i,
      }),
    );

    expect(screen.getByText(/Assumptions for Listed-Share Income/i)).toBeInTheDocument();
    expect(screen.getByText(/Assumes a domestic/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /株式等を譲渡したときの課税/ })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
    );
  });
});
