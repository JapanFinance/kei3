// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SummaryTab from '../components/TakeHomeCalculator/tabs/SummaryTab';
import type { TakeHomeResults } from '../types/tax';
import { makeResidenceTaxDetails, makeTakeHomeResults } from './fixtures/takeHomeResults';

const baseResults: TakeHomeResults = makeTakeHomeResults({
  annualIncome: 4_000_000,
  healthInsurance: 408_500,
  nationalIncomeTax: 100_000,
  residenceTax: makeResidenceTaxDetails({ totalResidenceTax: 200_000 }),
  takeHomeIncome: 3_000_000,
  healthInsuranceProvider: 'LatterStageElderly',
  region: 'Tokyo',
  ageRange: 'age75plus',
  totalNetIncome: 4_000_000,
  residenceTaxBasicDeduction: 430_000,
  latterStageMedicalPortion: 401_500,
  latterStageChildSupportPortion: 7_000,
});

describe('SummaryTab annual income header', () => {
  it('explains what annual income counts', () => {
    render(<SummaryTab results={baseResults} />);

    expect(screen.getByText('Annual Income')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About annual income' })).toBeInTheDocument();
  });
});

describe('SummaryTab with investment income', () => {
  // 申告不要 investment income enters no aggregate and changes no assessed figure, so it stays
  // out of take-home and out of this tab entirely — the same treatment a 通勤手当 gets. It is
  // reported on the input form, in the income modal, and in the Taxes tab instead.
  it('renders exactly as it would without it', () => {
    const { asFragment } = render(<SummaryTab results={baseResults} />);
    const withoutInvestmentIncome = asFragment();

    cleanup();
    const { asFragment: withInvestmentIncome } = render(
      <SummaryTab
        results={{
          ...baseResults,
          investmentIncome: {
            gross: { capitalGains: 1_000_000, dividends: 200_000, interest: 0 },
            grossTotal: 1_200_000,
            withheld: { national: 183_780, residence: 60_000, total: 243_780 },
          },
        }}
      />,
    );

    expect(withInvestmentIncome()).toEqual(withoutInvestmentIncome);
  });

  it('adds an Investment Income row and a Total Income subtotal under the header', () => {
    render(<SummaryTab results={withInvestmentIncome} />);

    expect(screen.getByText('Investment Income')).toBeInTheDocument();
    expect(screen.getByText('¥1,200,000')).toBeInTheDocument();
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('¥6,200,000')).toBeInTheDocument();
  });

  it('shows the withheld investment tax as its own row in the Taxes section', () => {
    render(<SummaryTab results={withInvestmentIncome} />);

    expect(screen.getByText('Investment Income Tax (withheld)')).toBeInTheDocument();
    expect(screen.getByText(/¥243,780/)).toBeInTheDocument();
  });

  it('omits the investment rows entirely when there is no investment income', () => {
    render(<SummaryTab results={baseResults} />);

    expect(screen.queryByText('Investment Income')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Income')).not.toBeInTheDocument();
    expect(screen.queryByText('Investment Income Tax (withheld)')).not.toBeInTheDocument();
  });
});

describe('SummaryTab with the 介護保険第1号 premium', () => {
  it('shows the premium as its own row and includes it in the social insurance total', () => {
    render(<SummaryTab results={{ ...baseResults, longTermCareCategory1Premium: 150_000 }} />);

    expect(screen.getByText('Age 65+ Long-term Care Insurance')).toBeInTheDocument();
    expect(screen.getByText(/^¥150,000/)).toBeInTheDocument();
    // 408,500 health insurance + 0 pension + 150,000 第1号.
    expect(screen.getByText('Total Social Insurance')).toBeInTheDocument();
    expect(screen.getByText(/^¥558,500/)).toBeInTheDocument();
  });

  it('marks the premium with ≈ when it is the calculator estimate', () => {
    render(
      <SummaryTab
        results={{
          ...baseResults,
          longTermCareCategory1Premium: 128_900,
          longTermCareCategory1Estimate: {
            currentFiscalYear: { tier: 9, multiplier: 1.7, annualBase: 75_840, premium: 128_900 },
            baseScope: 'Tokyo',
            total: 128_900,
          },
        }}
      />,
    );

    expect(screen.getByText(/^≈ ¥128,900/)).toBeInTheDocument();
    // 408,500 health insurance + 0 pension + the 128,900 estimate.
    expect(screen.getByText(/^¥537,400/)).toBeInTheDocument();
  });

  it('omits the row when no premium applies', () => {
    render(<SummaryTab results={baseResults} />);

    expect(screen.queryByText('Age 65+ Long-term Care Insurance')).not.toBeInTheDocument();
    // Health insurance and the total are both 408,500 with nothing else due.
    expect(screen.getAllByText(/^¥408,500/)).toHaveLength(2);
  });
});
