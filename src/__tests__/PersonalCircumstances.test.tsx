// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPersonalDeductionInfo } from '../components/TakeHomeCalculator/additionalDeductionInfo';
import { AdditionalDeductionsModal } from '../components/TakeHomeCalculator/AdditionalDeductionsModal';
import type { Dependent } from '../types/dependents';
import type { PersonalCircumstancesInput } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, EMPTY_PERSONAL_CIRCUMSTANCES } from '../types/tax';
import { calculatePersonalDeductions } from '../utils/personalDeductions';

const renderModal = (
  personalCircumstances: PersonalCircumstancesInput,
  netIncome: number,
  onPersonalCircumstancesChange = vi.fn(),
  dependents: Dependent[] = [],
) => {
  const personalDeductions = calculatePersonalDeductions(personalCircumstances, netIncome);
  render(
    <AdditionalDeductionsModal
      open
      onClose={vi.fn()}
      dcPlanContributions={0}
      onDcPlanContributionsChange={vi.fn()}
      onHomeLoanTaxCreditChange={vi.fn()}
      lifeInsurance={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.lifeInsurance}
      onLifeInsuranceChange={vi.fn()}
      earthquakeInsurance={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.earthquakeInsurance}
      onEarthquakeInsuranceChange={vi.fn()}
      medicalExpenses={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.medicalExpenses}
      onMedicalExpensesChange={vi.fn()}
      personalCircumstances={personalCircumstances}
      onPersonalCircumstancesChange={onPersonalCircumstancesChange}
      dependents={dependents}
      personalDeductions={personalDeductions}
      incomeYear={2026}
    />,
  );
  return { onPersonalCircumstancesChange };
};

describe('getPersonalDeductionInfo', () => {
  it('derives the year-dependent child limit instead of hard-coding it', () => {
    expect(getPersonalDeductionInfo(2025).singleParent.explanation).toContain('¥580,000');
    expect(getPersonalDeductionInfo(2026).singleParent.explanation).toContain('¥620,000');
  });
});

describe('Personal Circumstances card', () => {
  it('shows no deduction readout until a status is selected', () => {
    renderModal(EMPTY_PERSONAL_CIRCUMSTANCES, 3_000_000);
    expect(screen.getByRole('combobox', { name: /Disability/ })).toHaveTextContent(
      'Not applicable',
    );
    expect(screen.queryByText(/deduction: /i)).not.toBeInTheDocument();
  });

  it('attaches the eligibility note to the select as helper text', () => {
    renderModal(EMPTY_PERSONAL_CIRCUMSTANCES, 3_000_000);
    // The child and dependent-relative requirements live in the warnings and the tooltip, so the
    // static helper text carries only the condition that never varies.
    expect(
      screen.getByRole('combobox', { name: /^Widow \/ single parent/ }),
    ).toHaveAccessibleDescription(/not being married/);
  });

  it('reports the selected status to the caller', async () => {
    const user = userEvent.setup();
    const { onPersonalCircumstancesChange } = renderModal(EMPTY_PERSONAL_CIRCUMSTANCES, 3_000_000);

    await user.click(screen.getByRole('combobox', { name: /^Widow \/ single parent/ }));
    await user.click(screen.getByRole('option', { name: /Single mother/ }));

    expect(onPersonalCircumstancesChange).toHaveBeenCalledWith({
      disability: 'none',
      widowOrSingleParent: 'singleParentMother',
    });
  });

  it('preserves the other field when one select changes', async () => {
    const user = userEvent.setup();
    const { onPersonalCircumstancesChange } = renderModal(
      { disability: 'special', widowOrSingleParent: 'none' },
      3_000_000,
    );

    await user.click(screen.getByRole('combobox', { name: /^Widow \/ single parent/ }));
    await user.click(screen.getByRole('option', { name: /Widowed woman/ }));

    expect(onPersonalCircumstancesChange).toHaveBeenCalledWith({
      disability: 'special',
      widowOrSingleParent: 'widowBereaved',
    });
  });

  it('reads out each applied deduction with its per-tax amounts', () => {
    renderModal({ disability: 'special', widowOrSingleParent: 'widowBereaved' }, 3_000_000);
    expect(screen.getByText(/Disability deduction:/)).toHaveTextContent(
      'Disability deduction: ¥400,000 income tax, ¥300,000 residence tax',
    );
    expect(screen.getByText(/Widow deduction:/)).toHaveTextContent(
      'Widow deduction: ¥270,000 income tax, ¥260,000 residence tax',
    );
  });

  it('explains why a 寡婦/ひとり親 selection was not applied above the income ceiling', () => {
    renderModal({ disability: 'none', widowOrSingleParent: 'widowBereaved' }, 6_000_000);
    expect(screen.queryByText(/Widow deduction:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Not applied/)).toHaveTextContent('¥5,000,000 or less');
  });

  it('warns when a single parent selection has no qualifying child in Dependents', () => {
    renderModal({ disability: 'none', widowOrSingleParent: 'singleParentMother' }, 3_000_000);
    expect(screen.getByText(/No qualifying child is entered under Dependents/)).toHaveTextContent(
      '¥620,000 or less',
    );
  });

  it('does not warn once a qualifying child is entered', () => {
    renderModal(
      { disability: 'none', widowOrSingleParent: 'singleParentMother' },
      3_000_000,
      vi.fn(),
      [
        {
          id: 'c1',
          relationship: 'child',
          ageRange: 'under16',
          isCohabiting: true,
          disability: 'none',
          income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
        },
      ],
    );
    expect(screen.queryByText(/No qualifying child/)).not.toBeInTheDocument();
  });

  it('suppresses dependents warnings while the over-ceiling note shows', () => {
    renderModal({ disability: 'none', widowOrSingleParent: 'singleParentMother' }, 6_000_000);
    expect(screen.getByText(/Not applied/)).toBeInTheDocument();
    expect(screen.queryByText(/No qualifying child/)).not.toBeInTheDocument();
  });

  it('shows the over-ceiling note even while the disability deduction applies', () => {
    // 障害者控除 has no income limit, so it must read out while the 寡婦 selection reports
    // not-applied — the note keys off the missing widow/singleParent item, not an empty result.
    renderModal({ disability: 'special', widowOrSingleParent: 'widowBereaved' }, 6_000_000);
    expect(screen.getByText(/Disability deduction:/)).toBeInTheDocument();
    expect(screen.queryByText(/Widow deduction:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Not applied/)).toBeInTheDocument();
  });
});
