// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RealEstateStreamForm } from '../components/TakeHomeCalculator/Income/forms/RealEstateStreamForm';

describe('RealEstateStreamForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders domestic real estate form by default without foreign tax field', () => {
    render(<RealEstateStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByRole('heading', { name: 'Add Real Estate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /property location/i })).toHaveTextContent(
      /domestic/i,
    );
    expect(screen.queryByRole('textbox', { name: /foreign income tax/i })).not.toBeInTheDocument();
    // Loss netting adjustments box and land debt interest field are always available (措法41条の4 applies across all properties)
    expect(screen.getByText('Loss Netting Adjustments')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /interest on debt to acquire land/i }),
    ).toBeInTheDocument();
    // Foreign building depreciation is only for foreign properties with loss
    expect(
      screen.queryByRole('textbox', { name: /shortened used building depreciation/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /real estate income/i })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1370.htm',
    );
  });

  it('allows switching location to foreign and entering foreign tax', async () => {
    const user = userEvent.setup();
    render(<RealEstateStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const locationSelect = screen.getByRole('combobox', { name: /property location/i });
    await user.click(locationSelect);
    const foreignOption = screen.getByRole('option', { name: /foreign/i });
    await user.click(foreignOption);

    const foreignTaxInput = screen.getByRole('textbox', { name: /foreign income tax/i });
    expect(foreignTaxInput).toBeInTheDocument();
    expect(screen.getByText('Income tax paid abroad on this income.')).toBeInTheDocument();
    expect(screen.queryByText(/外国所得税/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /foreign tax credit/i })).toBeInTheDocument();
    await user.type(foreignTaxInput, '50000');

    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
    await user.clear(amountInput);
    await user.type(amountInput, '1500000');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'realEstate',
        location: 'foreign',
        amount: 1_500_000,
        foreignTax: 50_000,
      }),
    );
  });

  it('allows entering land debt interest on negative amount and displays offset link', async () => {
    const user = userEvent.setup();
    render(<RealEstateStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
    await user.clear(amountInput);
    await user.type(amountInput, '-800000');

    const landInterestInput = screen.getByRole('textbox', {
      name: /interest on debt to acquire land/i,
    });
    expect(landInterestInput).toBeInTheDocument();
    expect(
      screen.getByText(
        'Interest paid on loans to purchase land. Only restricts loss-netting if total real estate income is a net loss.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/措法/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /offsetting real estate losses/i })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1391.htm',
    );
    await user.type(landInterestInput, '200000');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'realEstate',
        location: 'domestic',
        amount: -800_000,
        landDebtInterest: 200_000,
      }),
    );
  });

  it('shows foreign used building disallowed loss when foreign property has a loss', async () => {
    const user = userEvent.setup();
    render(
      <RealEstateStreamForm
        initialData={{
          id: 're-foreign-loss',
          type: 'realEstate',
          location: 'foreign',
          amount: -1_000_000,
          foreignTax: 0,
          landDebtInterest: 100_000,
          foreignUsedBuildingDepreciation: 300_000,
        }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Real Estate' })).toBeInTheDocument();
    expect(screen.getByText('Loss Netting Adjustments')).toBeInTheDocument();

    const buildingLossInput = screen.getByRole('textbox', {
      name: /shortened used building depreciation/i,
    });
    expect(buildingLossInput).toHaveValue('¥300,000');
    expect(
      screen.getByText(
        'Depreciation calculated using shortened useful life cannot offset other income.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/措法/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/国外中古建物/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 're-foreign-loss',
        type: 'realEstate',
        location: 'foreign',
        amount: -1_000_000,
        landDebtInterest: 100_000,
        foreignUsedBuildingDepreciation: 300_000,
      }),
    );
  });

  it('preserves landDebtInterest on a profitable property while clearing foreign depreciation on positive amount (T14)', async () => {
    const user = userEvent.setup();
    render(
      <RealEstateStreamForm
        initialData={{
          id: 're-profit',
          type: 'realEstate',
          location: 'foreign',
          amount: 1_200_000,
          foreignTax: 50_000,
          landDebtInterest: 300_000,
          foreignUsedBuildingDepreciation: 400_000, // Should be omitted since amount > 0
        }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );

    const landInterestInput = screen.getByRole('textbox', {
      name: /interest on debt to acquire land/i,
    });
    expect(landInterestInput).toHaveValue('¥300,000');
    // Shortened building depreciation field is hidden when amount is positive
    expect(
      screen.queryByRole('textbox', { name: /shortened used building depreciation/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(mockOnSave).toHaveBeenCalledWith({
      id: 're-profit',
      type: 'realEstate',
      location: 'foreign',
      amount: 1_200_000,
      foreignTax: 50_000,
      landDebtInterest: 300_000,
    });
  });

  it('cancels without saving when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<RealEstateStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
