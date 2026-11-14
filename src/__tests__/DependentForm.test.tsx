// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DependentForm } from '../components/TakeHomeCalculator/Dependents/DependentForm';
import { DependentsModal } from '../components/TakeHomeCalculator/Dependents/DependentsModal';
import SpouseSection from '../components/TakeHomeCalculator/Dependents/SpouseSection';
import type { OtherDependent } from '../types/dependents';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { makeDependent, makeSpouse } from './fixtures/dependents';

const INCOME_YEAR = 2026;

describe('DependentForm public pension income', () => {
  const pensionerParent: OtherDependent = makeDependent({
    id: 'dep-1',
    relationship: 'parent',
    ageRange: '70to74',
    income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 1_580_000, otherNetIncome: 0 },
    disability: 'none',
    isSameHousehold: true,
  });

  it('shows the pension row and applies the 公的年金等控除 in the previews', () => {
    render(
      <DependentForm
        dependent={pensionerParent}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );

    // Income table, Public Pension row: the gross input and the derived net in the Net column.
    // 1,580,000 − 1,100,000 (65+ minimum deduction) = 480,000
    const pensionRow = screen.getByRole('row', { name: /Public Pension/ });
    expect(within(pensionRow).getByRole('textbox')).toHaveValue('¥1,580,000');
    const pensionCells = within(pensionRow).getAllByRole('cell');
    expect(pensionCells[2]!).toHaveTextContent(/^¥480,000$/);

    // The pension net flows through to the Total (合計所得金額) row's Net column (label spans 2 columns)
    const totalRow = screen.getByRole('row', { name: /Total \(合計所得金額\)/ });
    const totalCells = within(totalRow).getAllByRole('cell');
    expect(totalCells[1]!).toHaveTextContent(/^¥480,000$/);

    // Eligible-deductions preview: the 同居老親等 amounts in the income-tax and
    // residence-tax columns of the 扶養控除 row
    const deductionRow = screen.getByRole('row', { name: /Dependent Deduction \(扶養控除\)/ });
    const deductionCells = within(deductionRow).getAllByRole('cell');
    expect(deductionCells[1]!).toHaveTextContent(/^¥580,000$/);
    expect(deductionCells[2]!).toHaveTextContent(/^¥450,000$/);
  });

  it('offers the age categories split at 20, 60, and 65', async () => {
    const user = userEvent.setup();
    render(
      <DependentForm
        dependent={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /Age/ }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: '19' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '20 - 22' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '23 - 39' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '40 - 59' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '60 - 64' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '65 - 69' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '70 - 74' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: '75 or Older' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: '19 - 22' })).not.toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: '40 - 64' })).not.toBeInTheDocument();
  });
});

describe('DependentForm National Pension payment controls', () => {
  it('shows National Pension controls only for ages 20–59', async () => {
    const user = userEvent.setup();
    render(
      <DependentForm
        dependent={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );

    // Default age is 16 - 18 -> National Pension hidden
    expect(screen.queryByText(/Paid by taxpayer/)).not.toBeInTheDocument();

    // Select age 19 -> still hidden
    await user.click(screen.getByRole('combobox', { name: /Age/ }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '19' }));
    expect(screen.queryByText(/Paid by taxpayer/)).not.toBeInTheDocument();

    // Select age 20 - 22 -> shown
    await user.click(screen.getByRole('combobox', { name: /Age/ }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '20 - 22' }));
    expect(screen.getByText(/Paid by taxpayer/)).toBeInTheDocument();

    // Select age 60 - 64 -> hidden again
    await user.click(screen.getByRole('combobox', { name: /Age/ }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '60 - 64' }));
    expect(screen.queryByText(/Paid by taxpayer/)).not.toBeInTheDocument();
  });

  it('remains accessible and saves full-year or custom National Pension even when not tax-claimed or cohabiting', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <DependentForm
        dependent={makeDependent({
          id: 'student-1',
          relationship: 'child',
          ageRange: '20to22',
          isClaimedAsDependent: false,
          isSameHousehold: false,
        })}
        onSave={onSave}
        onCancel={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );

    // Even with both Claim as tax dependent and Same registered address unchecked,
    // the National Pension toggle is visible and interactive
    const paidSwitch = screen.getByRole('switch', { name: /Paid by taxpayer/ });
    expect(paidSwitch).not.toBeChecked();
    expect(screen.getByText(/no effect on taxes or social insurance/)).toBeInTheDocument();

    await user.click(paidSwitch);
    expect(paidSwitch).toBeChecked();
    expect(screen.queryByText(/no effect on taxes or social insurance/)).not.toBeInTheDocument();

    // Full-year 2026 statutory amount (3 * 17,510 + 9 * 17,920 = 213,810) is displayed disabled
    const amountField = screen.getByLabelText(/Annual Contribution/);
    expect(amountField).toBeDisabled();
    expect(amountField).toHaveValue('¥213,810');

    // Submit in full-year mode -> nationalPensionCustomAmount is undefined
    await user.click(screen.getByRole('button', { name: /Update Dependent/ }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'student-1',
        ageRange: '20to22',
        isClaimedAsDependent: false,
        isSameHousehold: false,
        paysNationalPension: true,
      }),
    );
    expect(onSave.mock.lastCall?.[0]).not.toHaveProperty('nationalPensionCustomAmount');

    // Toggle Custom mode on and enter partial-year amount (6 months * 17,920 = 107,520)
    await user.click(screen.getByRole('switch', { name: 'Custom' }));
    const customInput = screen.getByLabelText('Annual Contribution');
    expect(customInput).not.toBeDisabled();
    await user.clear(customInput);
    await user.type(customInput, '107520');

    await user.click(screen.getByRole('button', { name: /Update Dependent/ }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'student-1',
        paysNationalPension: true,
        nationalPensionCustomAmount: 107520,
      }),
    );
  });
});

describe('SpouseSection & DependentsModal National Pension integration', () => {
  it('shows National Pension controls on SpouseSection for ages 20–59 and hides outside', () => {
    const { rerender } = render(
      <SpouseSection
        spouse={makeSpouse({
          ageRange: '20to39',
          isClaimedAsDependent: false,
          isSameHousehold: false,
        })}
        onChange={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );
    expect(screen.getByRole('switch', { name: /Paid by taxpayer/ })).toBeInTheDocument();

    rerender(
      <SpouseSection
        spouse={makeSpouse({
          ageRange: 'under20',
          isClaimedAsDependent: false,
          isSameHousehold: false,
        })}
        onChange={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );
    expect(screen.queryByRole('switch', { name: /Paid by taxpayer/ })).not.toBeInTheDocument();

    rerender(
      <SpouseSection
        spouse={makeSpouse({
          ageRange: '60to64',
          isClaimedAsDependent: false,
          isSameHousehold: false,
        })}
        onChange={vi.fn()}
        incomeYear={INCOME_YEAR}
        isTaxpayerNHI={false}
      />,
    );
    expect(screen.queryByRole('switch', { name: /Paid by taxpayer/ })).not.toBeInTheDocument();
  });

  it('displays National Pension chip and suppresses No tax/NHI impact chip in DependentsModal', () => {
    render(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[
          makeDependent({
            id: 'student-np',
            relationship: 'child',
            ageRange: '20to22',
            isClaimedAsDependent: false,
            isSameHousehold: false,
            paysNationalPension: true,
          }),
        ]}
        onDependentsChange={vi.fn()}
        taxpayerNetIncome={5_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={vi.fn()}
        region="Tokyo"
        onNHIHouseholdRegionChange={vi.fn()}
      />,
    );

    expect(screen.getByText('National Pension')).toBeInTheDocument();
    expect(screen.queryByText('No tax/NHI impact')).not.toBeInTheDocument();
  });

  it('treats a ¥0 custom National Pension entry as no tax/NHI impact in forms and chips', () => {
    const zeroPensionChild = makeDependent({
      id: 'student-zero',
      relationship: 'child',
      ageRange: '20to22',
      isClaimedAsDependent: false,
      isSameHousehold: false,
      paysNationalPension: true,
      nationalPensionCustomAmount: 0,
    });

    render(
      <>
        <DependentForm
          dependent={zeroPensionChild}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          incomeYear={INCOME_YEAR}
          isTaxpayerNHI={false}
        />
        <DependentsModal
          open
          onClose={vi.fn()}
          dependents={[zeroPensionChild]}
          onDependentsChange={vi.fn()}
          taxpayerNetIncome={5_000_000}
          incomeYear={INCOME_YEAR}
          healthInsuranceProvider={DEFAULT_PROVIDER}
          taxpayerAgeRange="age20to39"
          onNHIPaymentAttributionChange={vi.fn()}
          region="Tokyo"
          onNHIHouseholdRegionChange={vi.fn()}
        />
      </>,
    );

    expect(screen.getByText(/no effect on taxes or social insurance/)).toBeInTheDocument();
    expect(screen.queryByText('National Pension')).not.toBeInTheDocument();
    expect(screen.getByText('No tax/NHI impact')).toBeInTheDocument();
  });

  it('seeds Custom mode with the current income year statutory amount after incomeYear changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const spouse = makeSpouse({
      ageRange: '20to39',
      isClaimedAsDependent: true,
      paysNationalPension: true,
    });

    const { rerender } = render(
      <SpouseSection spouse={spouse} onChange={onChange} incomeYear={2025} isTaxpayerNHI={false} />,
    );

    rerender(
      <SpouseSection spouse={spouse} onChange={onChange} incomeYear={2026} isTaxpayerNHI={false} />,
    );

    await user.click(screen.getByRole('switch', { name: 'Custom' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paysNationalPension: true,
        nationalPensionCustomAmount: 213_810,
      }),
    );
  });

  it('omits National Pension wording from the no-impact notice outside ages 20–59', () => {
    const minorChild = makeDependent({
      id: 'minor-child',
      relationship: 'child',
      ageRange: '16to18',
      isClaimedAsDependent: false,
      isSameHousehold: false,
    });
    const seniorSpouse = makeSpouse({
      ageRange: '60to64',
      isClaimedAsDependent: false,
      isSameHousehold: false,
    });

    render(
      <>
        <DependentForm
          dependent={minorChild}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          incomeYear={INCOME_YEAR}
          isTaxpayerNHI={false}
        />
        <SpouseSection
          spouse={seniorSpouse}
          onChange={vi.fn()}
          incomeYear={INCOME_YEAR}
          isTaxpayerNHI={false}
        />
      </>,
    );

    expect(
      screen.queryByText(/unless the taxpayer pays their National Pension/),
    ).not.toBeInTheDocument();
  });
});
