// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DependentForm } from '../components/TakeHomeCalculator/Dependents/DependentForm';
import type { OtherDependent } from '../types/dependents';

const INCOME_YEAR = 2026;

describe('DependentForm public pension income', () => {
  const pensionerParent: OtherDependent = {
    id: 'dep-1',
    relationship: 'parent',
    ageCategory: '70plus',
    income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 1_580_000, otherNetIncome: 0 },
    disability: 'none',
    isCohabiting: true,
  };

  it('shows the pension row and applies the 公的年金等控除 in the previews', () => {
    render(
      <DependentForm
        dependent={pensionerParent}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
      />,
    );

    // Income table, Public Pension row: the gross input and the derived net in the Net column.
    // 1,580,000 − 1,100,000 (65+ minimum deduction) = 480,000
    const pensionRow = screen.getByRole('row', { name: /Public Pension/ });
    expect(within(pensionRow).getByRole('textbox')).toHaveValue('¥1,580,000');
    const pensionCells = within(pensionRow).getAllByRole('cell');
    expect(pensionCells[2]!).toHaveTextContent(/^¥480,000$/);

    // The pension net flows through to the Total (合計所得金額) row's Net column
    const totalRow = screen.getByRole('row', { name: /Total \(合計所得金額\)/ });
    const totalCells = within(totalRow).getAllByRole('cell');
    expect(totalCells[2]!).toHaveTextContent(/^¥480,000$/);

    // Eligible-deductions preview: the 同居老親等 amounts in the income-tax and
    // residence-tax columns of the 扶養控除 row
    const deductionRow = screen.getByRole('row', { name: /Dependent Deduction \(扶養控除\)/ });
    const deductionCells = within(deductionRow).getAllByRole('cell');
    expect(deductionCells[1]!).toHaveTextContent(/^¥580,000$/);
    expect(deductionCells[2]!).toHaveTextContent(/^¥450,000$/);
  });

  it('offers the age categories split at 65', async () => {
    const user = userEvent.setup();
    render(
      <DependentForm
        dependent={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Age' }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: '23 - 64' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '65 - 69' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: '23 - 69' })).not.toBeInTheDocument();
  });
});
