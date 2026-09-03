// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { TakeHomeInputs, IncomeStream } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { formatJPY } from '../utils/formatters';
import { calculateTaxes } from '../utils/taxCalculations';

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

const withStreams = (streams: IncomeStream[]): TakeHomeInputs => ({
  ...baseInputs,
  incomeStreams: [...baseInputs.incomeStreams, ...streams],
});

describe('TaxesTab investment income tax section', () => {
  it('shows gross rows, withheld tax, and the Total Withheld subtotal', () => {
    const inputs = withStreams([
      { id: 'g', type: 'listedCapitalGains', amount: 1_000_000 },
      { id: 'd', type: 'listedDividends', amount: 200_000 },
    ]);
    const results = calculateTaxes(inputs);
    render(<TaxesTab results={results} inputs={inputs} />);

    expect(screen.getByText('Investment Income Tax (源泉徴収)')).toBeInTheDocument();
    expect(screen.getByText('Listed Capital Gains')).toBeInTheDocument();
    expect(screen.getByText('¥1,000,000')).toBeInTheDocument();
    expect(screen.getByText('Listed Dividends')).toBeInTheDocument();
    expect(screen.getByText('¥200,000')).toBeInTheDocument();
    expect(screen.getByText('Withheld Income Tax (15.315%)')).toBeInTheDocument();
    expect(screen.getByText('¥183,780')).toBeInTheDocument();
    expect(screen.getByText('Withheld Residence Tax (5%)')).toBeInTheDocument();
    expect(screen.getByText('¥60,000')).toBeInTheDocument();
    expect(screen.getByText('Total Withheld')).toBeInTheDocument();
    expect(screen.getByText('¥243,780')).toBeInTheDocument();
  });

  it('hides the Deposit Interest row when no interest was entered', () => {
    const inputs = withStreams([{ id: 'g', type: 'listedCapitalGains', amount: 1_000_000 }]);
    const results = calculateTaxes(inputs);
    render(<TaxesTab results={results} inputs={inputs} />);

    expect(screen.queryByText('Deposit Interest')).not.toBeInTheDocument();
  });

  it('shows a signed capital-loss row', () => {
    const inputs = withStreams([{ id: 'g', type: 'listedCapitalGains', amount: -300_000 }]);
    const results = calculateTaxes(inputs);
    render(<TaxesTab results={results} inputs={inputs} />);

    expect(screen.getByText('Listed Capital Gains')).toBeInTheDocument();
    expect(screen.getByText('-¥300,000')).toBeInTheDocument();
    // Nothing to net against, so nothing is withheld.
    expect(results.investmentIncome?.withheld.total).toBe(0);
    expect(screen.getByText('Total Withheld')).toBeInTheDocument();
  });

  it('includes the withheld total in Total Taxes', () => {
    const withInvestment = calculateTaxes(
      withStreams([{ id: 'd', type: 'listedDividends', amount: 200_000 }]),
    );
    const withoutInvestment = calculateTaxes(baseInputs);
    render(<TaxesTab results={withInvestment} inputs={baseInputs} />);

    // Dividends only: base 200,000 → national 30,630, residence 10,000, total 40,630.
    const expectedTotal =
      withoutInvestment.nationalIncomeTax +
      withoutInvestment.residenceTax.totalResidenceTax +
      40_630;
    expect(screen.getByText(formatJPY(expectedTotal))).toBeInTheDocument();
  });

  it('omits the section entirely when there is no investment income', () => {
    const results = calculateTaxes(baseInputs);
    render(<TaxesTab results={results} inputs={baseInputs} />);

    expect(screen.queryByText('Investment Income Tax (源泉徴収)')).not.toBeInTheDocument();
  });
});
