// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react';

import { AdditionalDeductionsModal } from '../components/TakeHomeCalculator/AdditionalDeductionsModal';
import type { ForeignTaxCreditInput } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';

const FOREIGN_TAX_LABEL = 'Foreign Tax Paid (外国所得税)';
const FOREIGN_SOURCE_INCOME_LABEL = 'Foreign-Source Income (国外所得金額)';

const renderModal = (foreignTaxCredit: ForeignTaxCreditInput | undefined) => {
  const onForeignTaxCreditChange = vi.fn();
  render(
    <AdditionalDeductionsModal
      open
      onClose={vi.fn()}
      dcPlanContributions={0}
      onDcPlanContributionsChange={vi.fn()}
      onHomeLoanTaxCreditChange={vi.fn()}
      foreignTaxCredit={foreignTaxCredit}
      onForeignTaxCreditChange={onForeignTaxCreditChange}
      lifeInsurance={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.lifeInsurance}
      onLifeInsuranceChange={vi.fn()}
      earthquakeInsurance={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.earthquakeInsurance}
      onEarthquakeInsuranceChange={vi.fn()}
      medicalExpenses={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.medicalExpenses}
      onMedicalExpensesChange={vi.fn()}
      personalCircumstances={EMPTY_ADDITIONAL_DEDUCTION_INPUTS.personalCircumstances}
      onPersonalCircumstancesChange={vi.fn()}
      dependents={[]}
      incomeYear={2026}
    />,
  );
  return { onForeignTaxCreditChange };
};

describe('Foreign Tax Credit card', () => {
  it('starts empty and reports the foreign tax entered, with no foreign-source income yet', () => {
    const { onForeignTaxCreditChange } = renderModal(undefined);
    expect(screen.getByLabelText(FOREIGN_TAX_LABEL)).toHaveValue('¥0');
    expect(screen.getByLabelText(FOREIGN_SOURCE_INCOME_LABEL)).toHaveValue('¥0');

    fireEvent.change(screen.getByLabelText(FOREIGN_TAX_LABEL), { target: { value: '¥20,000' } });
    expect(onForeignTaxCreditChange).toHaveBeenLastCalledWith({
      foreignTax: 20_000,
      foreignSourceIncome: 0,
    });
  });

  it('keeps the foreign tax when the foreign-source income changes', () => {
    const { onForeignTaxCreditChange } = renderModal({
      foreignTax: 20_000,
      foreignSourceIncome: 0,
    });

    fireEvent.change(screen.getByLabelText(FOREIGN_SOURCE_INCOME_LABEL), {
      target: { value: '¥500,000' },
    });
    expect(onForeignTaxCreditChange).toHaveBeenLastCalledWith({
      foreignTax: 20_000,
      foreignSourceIncome: 500_000,
    });
  });

  it('removes the input once both amounts are cleared', () => {
    const { onForeignTaxCreditChange } = renderModal({
      foreignTax: 20_000,
      foreignSourceIncome: 0,
    });

    fireEvent.change(screen.getByLabelText(FOREIGN_TAX_LABEL), { target: { value: '' } });
    expect(onForeignTaxCreditChange).toHaveBeenLastCalledWith(undefined);
  });

  it('says that foreign tax on an investment entry is counted there', () => {
    renderModal(undefined);

    expect(screen.getByLabelText(FOREIGN_TAX_LABEL)).toHaveAccessibleDescription(
      /Only foreign tax not entered with an investment entry/,
    );
  });
});
