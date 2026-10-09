// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react';

import { AdditionalDeductionsModal } from '../components/TakeHomeCalculator/AdditionalDeductionsModal';
import type { ForeignTaxCreditInput, ForeignTaxCreditResult } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';

const FOREIGN_TAX_LABEL = 'Foreign Tax Paid with a Tax Return (外国所得税)';

const renderModal = (
  foreignTaxCredit: ForeignTaxCreditInput | undefined,
  foreignTaxCreditResult?: ForeignTaxCreditResult,
  withheldForeignTax?: number,
) => {
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
      foreignTaxCreditResult={foreignTaxCreditResult}
      withheldForeignTax={withheldForeignTax}
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

/** The summary's rows as [label, amount] pairs, in order. */
const summaryRows = () => {
  const terms = screen.queryAllByRole('term').map(term => term.textContent);
  const definitions = screen.queryAllByRole('definition').map(definition => definition.textContent);
  return terms.map((term, index) => [term, definitions[index]]);
};

const NO_AMOUNTS = { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 };

// The engine's case A plus 5,000 paid with a return: a foreign dividend of 1,000,000 with
// 100,000 foreign tax, reported beside a 5,000,000 salary; every limit used.
const CASE_A_WITH_RETURN: ForeignTaxCreditResult = {
  foreignTax: 105_000,
  foreignSourceIncome: 1_000_000,
  adjustedForeignSourceIncome: 1_000_000,
  totalIncome: 4_560_000,
  incomeTax: 239_850,
  manualForeignTax: 5_000,
  limit: { incomeTax: 52_598, reconstructionSurtax: 1_104, prefecture: 6_311, city: 9_467 },
  credit: { incomeTax: 52_598, reconstructionSurtax: 1_104, prefecture: 6_311, city: 9_467 },
  excess: 35_520,
};

describe('Foreign Tax Credit card', () => {
  it('starts empty and reports the tax paid with a return', () => {
    const { onForeignTaxCreditChange } = renderModal(undefined);
    expect(screen.getByLabelText(FOREIGN_TAX_LABEL)).toHaveValue('¥0');
    expect(screen.queryByLabelText(/Foreign-Source Income/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(FOREIGN_TAX_LABEL), { target: { value: '¥20,000' } });
    expect(onForeignTaxCreditChange).toHaveBeenLastCalledWith({ foreignTax: 20_000 });
  });

  it('removes the input once the amount is cleared', () => {
    const { onForeignTaxCreditChange } = renderModal({ foreignTax: 20_000 });

    fireEvent.change(screen.getByLabelText(FOREIGN_TAX_LABEL), { target: { value: '' } });
    expect(onForeignTaxCreditChange).toHaveBeenLastCalledWith(undefined);
  });

  it('says that tax withheld abroad belongs with the income', () => {
    renderModal(undefined);

    expect(screen.getByLabelText(FOREIGN_TAX_LABEL)).toHaveAccessibleDescription(
      'Only tax paid with a foreign tax return filed this year. Withheld foreign tax is entered with the income it was withheld from.',
    );
  });

  it('shows no summary with no foreign tax and no foreign-source income', () => {
    renderModal(undefined);

    expect(summaryRows()).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sums the foreign tax, the foreign-source income and the limit, and warns of the excess', () => {
    renderModal({ foreignTax: 5_000 }, CASE_A_WITH_RETURN, 50_000);

    // 105,000 − 5,000 from the entries; limit 52,598 + 1,104 + 6,311 + 9,467 = 69,480.
    expect(summaryRows()).toEqual([
      ['Foreign tax entered with income', '¥100,000'],
      ['On dividends left to withholding, not eligible', '¥50,000'],
      ['Paid with a tax return', '¥5,000'],
      ['Total eligible foreign tax', '¥105,000'],
      ['Foreign-source income', '¥1,000,000'],
      ['Credit limit', '¥69,480'],
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '¥35,520 of the foreign tax is above the limit and is not credited this year. It can be carried forward for up to three years by attaching the foreign tax credit statement (外国税額控除に関する明細書) to the tax return each year.',
    );
  });

  it('shows the limit with no warning when the foreign tax is within it', () => {
    // The engine's case K: 20,000 paid with a return against 500,000 of foreign interest.
    renderModal(
      { foreignTax: 20_000 },
      {
        foreignTax: 20_000,
        foreignSourceIncome: 500_000,
        adjustedForeignSourceIncome: 500_000,
        totalIncome: 4_060_000,
        incomeTax: 132_200,
        manualForeignTax: 20_000,
        limit: { incomeTax: 16_280, reconstructionSurtax: 341, prefecture: 1_953, city: 2_930 },
        credit: { incomeTax: 16_280, reconstructionSurtax: 341, prefecture: 1_953, city: 1_426 },
        excess: 0,
      },
    );

    // 16,280 + 341 + 1,953 + 2,930 = 21,504.
    expect(summaryRows()).toEqual([
      ['Paid with a tax return', '¥20,000'],
      ['Total eligible foreign tax', '¥20,000'],
      ['Foreign-source income', '¥500,000'],
      ['Credit limit', '¥21,504'],
    ]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says there is no foreign-source income to credit the tax against', () => {
    renderModal(
      { foreignTax: 20_000 },
      {
        foreignTax: 20_000,
        foreignSourceIncome: 0,
        adjustedForeignSourceIncome: 0,
        totalIncome: 3_560_000,
        incomeTax: 89_850,
        manualForeignTax: 20_000,
        limit: NO_AMOUNTS,
        credit: NO_AMOUNTS,
        excess: 20_000,
      },
    );

    expect(summaryRows()).toContainEqual(['Credit limit', '¥0']);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'There is no foreign-source income to credit the foreign tax against, so ¥20,000 is not credited this year.',
    );
  });

  it('shows the limit before any foreign tax is entered', () => {
    // The engine's case J: a reported foreign dividend with no foreign tax.
    renderModal(undefined, {
      foreignTax: 0,
      foreignSourceIncome: 1_000_000,
      adjustedForeignSourceIncome: 1_000_000,
      totalIncome: 4_560_000,
      incomeTax: 239_850,
      limit: { incomeTax: 52_598, reconstructionSurtax: 1_104, prefecture: 6_311, city: 9_467 },
      credit: NO_AMOUNTS,
      excess: 0,
    });

    expect(summaryRows()).toEqual([
      ['Total eligible foreign tax', '¥0'],
      ['Foreign-source income', '¥1,000,000'],
      ['Credit limit', '¥69,480'],
    ]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
