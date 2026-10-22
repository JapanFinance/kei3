// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { calculateTaxes } from '../utils/taxCalculations';

// The tooltip content is rendered inline so its rows are visible without opening a popover.
vi.mock('../components/ui/Tooltips', () => ({
  SimpleTooltip: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="info-tooltip">{children}</div>
  ),
  DetailedTooltip: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <span data-testid="detail-info-tooltip" title={title}>
      {children}
    </span>
  ),
}));

Element.prototype.scrollTo = vi.fn();

const baseInputs: TakeHomeInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [{ type: 'salary', amount: 5_000_000, frequency: 'annual', id: 's1' }],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
};

describe('TaxesTab personal deductions display', () => {
  it('folds the personal deductions into the Other Deductions rows, not their own row', () => {
    const results = calculateTaxes({
      ...baseInputs,
      personalCircumstances: { disability: 'special', widowOrSingleParent: 'none' },
    });
    render(<TaxesTab results={results} inputs={baseInputs} />);

    expect(screen.queryByText('Personal Deductions')).not.toBeInTheDocument();
    const rows = screen.getAllByText('Other Deductions');
    expect(rows).toHaveLength(2); // one per tax section
    // 特別障害者: ¥400,000 national / ¥300,000 residence, with no other modal deductions entered.
    expect(screen.getByText('-¥400,000')).toBeInTheDocument();
    expect(screen.getByText('-¥300,000')).toBeInTheDocument();
  });

  it('combines the personal and additional amounts into one row total', () => {
    const results = calculateTaxes({
      ...baseInputs,
      medicalExpenses: { paid: 350_000, reimbursed: 100_000 },
      personalCircumstances: { disability: 'special', widowOrSingleParent: 'none' },
    });
    render(<TaxesTab results={results} inputs={baseInputs} />);

    // Medical ¥150,000 (both taxes) + disability ¥400,000/¥300,000.
    expect(screen.getByText('-¥550,000')).toBeInTheDocument(); // national
    expect(screen.getByText('-¥450,000')).toBeInTheDocument(); // residence
    // The breakdown tooltip itemizes both groups.
    const tooltips = screen.getAllByTitle('Other Income Deductions (National Tax)');
    expect(tooltips).toHaveLength(1);
    expect(within(tooltips[0]!).getByText('Medical expenses')).toBeInTheDocument();
    expect(within(tooltips[0]!).getByText('Disability')).toBeInTheDocument();
  });

  it('shows the Other Deductions row when only a personal deduction applies', () => {
    const results = calculateTaxes({
      ...baseInputs,
      personalCircumstances: { disability: 'none', widowOrSingleParent: 'widowBereaved' },
    });
    render(<TaxesTab results={results} inputs={baseInputs} />);

    expect(screen.getAllByText('Other Deductions')).toHaveLength(2);
    expect(screen.getByText('-¥270,000')).toBeInTheDocument();
    expect(screen.getByText('-¥260,000')).toBeInTheDocument();
  });

  it('names the exempting status in the residence-tax message', () => {
    // Gross ¥2,090,000 salary → 合計所得金額 exactly ¥1,350,000.
    const results = calculateTaxes({
      ...baseInputs,
      incomeStreams: [{ type: 'salary', amount: 2_090_000, frequency: 'annual', id: 's1' }],
      personalCircumstances: { disability: 'none', widowOrSingleParent: 'widowBereaved' },
    });
    render(<TaxesTab results={results} inputs={baseInputs} />);

    expect(results.residenceTax.nonTaxableStatus).toBe('widow');
    expect(
      screen.getByText(/No residence tax is levied on widowed or divorced women \(寡婦\)/),
    ).toBeInTheDocument();
  });
});
