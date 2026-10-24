// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  incomeStreams: [],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
};

describe('TaxesTab municipal non-taxable resident display (Issue #686)', () => {
  it('hides intermediate residence tax rows and explains the ¥450,000 threshold at ¥436,000 miscellaneous income', () => {
    const inputs: TakeHomeInputs = {
      ...baseInputs,
      incomeStreams: [
        {
          type: 'miscellaneous',
          amount: 436_000,
          id: 'misc1',
        },
      ],
    };
    const results = calculateTaxes(inputs);

    expect(results.residenceTax.totalResidenceTax).toBe(0);
    expect(results.residenceTax.nonTaxableStatus).toBe('incomeThreshold');
    expect(results.residenceTax.nonTaxableLimit).toBe(450_000);

    render(<TaxesTab results={results} inputs={inputs} />);

    // Intermediate residence tax rows should NOT be displayed
    expect(screen.queryByText('Taxable Income for Residence Tax')).not.toBeInTheDocument();
    expect(screen.queryByText('Income-based Portion')).not.toBeInTheDocument();
    expect(screen.queryByText('Per Capita Portion')).not.toBeInTheDocument();

    // Total Residence Tax should be ¥0
    const totalResidenceRow = screen.getByText('Total Residence Tax').closest('div')?.parentElement;
    expect(totalResidenceRow).toBeInTheDocument();
    expect(within(totalResidenceRow!).getByText('¥0')).toBeInTheDocument();

    // Detailed tooltip explaining the municipal threshold should be present
    const tooltip = screen.getByTitle('Municipal Non-Taxable Threshold');
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText(/均等割・所得割非課税限度額/)).toBeInTheDocument();
    expect(
      within(tooltip).getByText(
        /No residence tax is levied when total net income \(合計所得金額\) is at or below the municipal non-taxable threshold \(¥450,000\)\./,
      ),
    ).toBeInTheDocument();
    expect(within(tooltip).getByText(/Single with no dependents:/)).toBeInTheDocument();
  });

  it('displays the dependent formula in the tooltip when taxpayer has a dependent', () => {
    const inputs: TakeHomeInputs = {
      ...baseInputs,
      incomeStreams: [
        {
          type: 'miscellaneous',
          amount: 1_000_000,
          id: 'misc1',
        },
      ],
      dependents: [
        {
          id: 'spouse1',
          relationship: 'spouse',
          ageRange: 'under65',
          isCohabiting: true,
          disability: 'none',
          income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
        },
      ],
    };
    const results = calculateTaxes(inputs);

    expect(results.residenceTax.totalResidenceTax).toBe(0);
    expect(results.residenceTax.nonTaxableStatus).toBe('incomeThreshold');
    expect(results.residenceTax.nonTaxableLimit).toBe(1_010_000);

    render(<TaxesTab results={results} inputs={inputs} />);

    // Intermediate residence tax rows should NOT be displayed
    expect(screen.queryByText('Income-based Portion')).not.toBeInTheDocument();
    expect(screen.queryByText('Per Capita Portion')).not.toBeInTheDocument();

    // Tooltip should reflect the 1-dependent limit (¥1,010,000) and formula
    const tooltip = screen.getByTitle('Municipal Non-Taxable Threshold');
    expect(tooltip).toBeInTheDocument();
    expect(
      within(tooltip).getByText(
        /No residence tax is levied when total net income \(合計所得金額\) is at or below the municipal non-taxable threshold \(¥1,010,000\)\./,
      ),
    ).toBeInTheDocument();
    expect(within(tooltip).getByText(/With dependents:/)).toBeInTheDocument();
    expect(
      within(tooltip).getByText(/For 1 dependent: ¥350,000 × 2 \+ ¥100,000 \+ ¥210,000 =/),
    ).toBeInTheDocument();
  });

  it('renders intermediate rows normally when income exceeds the non-taxable threshold', () => {
    const inputs: TakeHomeInputs = {
      ...baseInputs,
      incomeStreams: [
        {
          type: 'miscellaneous',
          amount: 460_000,
          id: 'misc1',
        },
      ],
    };
    const results = calculateTaxes(inputs);

    expect(results.residenceTax.nonTaxableStatus).toBeUndefined();
    expect(results.residenceTax.totalResidenceTax).toBeGreaterThan(0);

    render(<TaxesTab results={results} inputs={inputs} />);

    // Intermediate rows should be present
    expect(screen.getByText('Income-based Portion')).toBeInTheDocument();
    expect(screen.getByText('Per Capita Portion')).toBeInTheDocument();
    expect(screen.queryByTitle('Municipal Non-Taxable Threshold')).not.toBeInTheDocument();
  });

  it('handles zero income by collapsing intermediate residence tax rows with the threshold tooltip', () => {
    const results = calculateTaxes(baseInputs);

    expect(results.residenceTax.totalResidenceTax).toBe(0);
    expect(results.residenceTax.nonTaxableStatus).toBe('incomeThreshold');
    expect(results.residenceTax.nonTaxableLimit).toBe(450_000);

    render(<TaxesTab results={results} inputs={baseInputs} />);

    expect(screen.queryByText('Income-based Portion')).not.toBeInTheDocument();
    expect(screen.queryByText('Per Capita Portion')).not.toBeInTheDocument();
    expect(screen.getByTitle('Municipal Non-Taxable Threshold')).toBeInTheDocument();
  });
});
