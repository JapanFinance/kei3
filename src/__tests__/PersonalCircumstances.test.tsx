// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdditionalDeductionsModal } from '../components/TakeHomeCalculator/AdditionalDeductionsModal';
import type { PersonalCircumstancesInput } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, EMPTY_PERSONAL_CIRCUMSTANCES } from '../types/tax';
import { calculatePersonalDeductions } from '../utils/personalDeductions';

const renderModal = (
  personalCircumstances: PersonalCircumstancesInput,
  netIncome: number,
  onPersonalCircumstancesChange = vi.fn(),
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
      personalDeductions={personalDeductions}
      incomeYear={2026}
    />,
  );
  return { onPersonalCircumstancesChange };
};

describe('Personal Circumstances card', () => {
  it('shows no deduction readout until a status is selected', () => {
    renderModal(EMPTY_PERSONAL_CIRCUMSTANCES, 3_000_000);
    expect(screen.getByRole('combobox', { name: /Disability/ })).toHaveTextContent(
      'Not applicable',
    );
    expect(screen.queryByText(/deduction: /i)).not.toBeInTheDocument();
  });

  it('reports the selected status to the caller', async () => {
    const user = userEvent.setup();
    const { onPersonalCircumstancesChange } = renderModal(EMPTY_PERSONAL_CIRCUMSTANCES, 3_000_000);

    await user.click(screen.getByRole('combobox', { name: 'Widow / single parent' }));
    await user.click(screen.getByRole('option', { name: /Single parent, mother/ }));

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

    await user.click(screen.getByRole('combobox', { name: 'Widow / single parent' }));
    await user.click(screen.getByRole('option', { name: /Widowed or divorced woman/ }));

    expect(onPersonalCircumstancesChange).toHaveBeenCalledWith({
      disability: 'special',
      widowOrSingleParent: 'widow',
    });
  });

  it('reads out each applied deduction with its per-tax amounts', () => {
    renderModal({ disability: 'special', widowOrSingleParent: 'widow' }, 3_000_000);
    expect(screen.getByText(/Disability deduction:/)).toHaveTextContent(
      'Disability deduction: ¥400,000 income tax, ¥300,000 residence tax',
    );
    expect(screen.getByText(/Widow deduction:/)).toHaveTextContent(
      'Widow deduction: ¥270,000 income tax, ¥260,000 residence tax',
    );
  });

  it('explains why a 寡婦/ひとり親 selection was not applied above the income ceiling', () => {
    renderModal({ disability: 'none', widowOrSingleParent: 'widow' }, 6_000_000);
    expect(screen.queryByText(/Widow deduction:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Not applied/)).toHaveTextContent('¥5,000,000 or less');
  });

  it('shows the over-ceiling note even while the disability deduction applies', () => {
    // 障害者控除 has no income limit, so it must read out while the 寡婦 selection reports
    // not-applied — the note keys off the missing widow/singleParent item, not an empty result.
    renderModal({ disability: 'special', widowOrSingleParent: 'widow' }, 6_000_000);
    expect(screen.getByText(/Disability deduction:/)).toBeInTheDocument();
    expect(screen.queryByText(/Widow deduction:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Not applied/)).toBeInTheDocument();
  });
});
