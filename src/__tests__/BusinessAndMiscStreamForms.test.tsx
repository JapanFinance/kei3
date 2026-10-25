// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  BusinessStreamForm,
  MiscellaneousStreamForm,
} from '../components/TakeHomeCalculator/Income/forms/BusinessAndMiscStreamForms';

describe('BusinessStreamForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders business stream form with helper text explaining losses', () => {
    render(<BusinessStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByRole('heading', { name: 'Add Business' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Business revenue minus necessary expenses.*enter a loss as a negative amount/,
      ),
    ).toBeInTheDocument();
  });

  it('allows entering a negative business income (loss) and saving it', async () => {
    const user = userEvent.setup();
    render(<BusinessStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
    await user.clear(amountInput);
    await user.type(amountInput, '-1500000');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'business',
        amount: -1_500_000,
      }),
    );
  });

  it('loads initial negative business income for editing and preserves it on save', async () => {
    const user = userEvent.setup();
    render(
      <BusinessStreamForm
        initialData={{
          id: 'b-loss',
          type: 'business',
          amount: -500_000,
        }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Business' })).toBeInTheDocument();

    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
    expect(amountInput).toHaveValue('-¥500,000');

    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'b-loss',
        type: 'business',
        amount: -500_000,
      }),
    );
  });

  it('cancels without saving when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<BusinessStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});

describe('MiscellaneousStreamForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders miscellaneous stream form and saves amount', async () => {
    const user = userEvent.setup();
    render(<MiscellaneousStreamForm onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByRole('heading', { name: 'Add Miscellaneous' })).toBeInTheDocument();

    const amountInput = screen.getByRole('textbox', { name: /annual income after expenses/i });
    await user.clear(amountInput);
    await user.type(amountInput, '200000');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'miscellaneous',
        amount: 200_000,
      }),
    );
  });
});
