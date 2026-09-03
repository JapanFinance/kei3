// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
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

describe('SummaryTab with investment income', () => {
  // 500万 salary baseline (src/__tests__/taxCalculations.test.ts) + gains 100万 + dividends 20万:
  // base 1,200,000 → withheld national 183,780 (15.315%), residence 60,000 (5%), total 243,780.
  const investmentResults: TakeHomeResults = makeTakeHomeResults({
    annualIncome: 5_000_000,
    hasEmploymentIncome: true,
    nationalIncomeTax: 91_700,
    residenceTax: makeResidenceTaxDetails({ totalResidenceTax: 243_100 }),
    healthInsurance: 246_449,
    pensionPayments: 450_180,
    employmentInsurance: 25_623,
    takeHomeIncome: 4_899_168,
    totalNetIncome: 3_560_000,
    investmentIncome: {
      gross: { listedCapitalGains: 1_000_000, listedDividends: 200_000, depositInterest: 0 },
      grossTotal: 1_200_000,
      withheld: { national: 183_780, residence: 60_000, total: 243_780 },
    },
  });

  it('shows the Investment Income row and the Total Income subtotal', () => {
    render(<SummaryTab results={investmentResults} />);

    expect(screen.getByText('Investment Income')).toBeInTheDocument();
    expect(screen.getByText('¥1,200,000')).toBeInTheDocument();
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('¥6,200,000')).toBeInTheDocument();
  });

  it('shows the withheld investment tax as its own row, as a share of the combined gross', () => {
    render(<SummaryTab results={investmentResults} />);

    expect(screen.getByText(/Investment Income Tax \(withheld\)/)).toBeInTheDocument();
    // 243,780 / 6,200,000 = 3.9%
    expect(screen.getByText(/¥243,780 \(3\.9%\)/)).toBeInTheDocument();
  });

  it('computes the take-home percentage over earned plus investment income', () => {
    render(<SummaryTab results={investmentResults} />);

    // 4,899,168 / 6,200,000 = 79.0%
    expect(screen.getByText('(79.0%)')).toBeInTheDocument();
  });

  it('omits every investment row when there is no investment income', () => {
    render(<SummaryTab results={{ ...investmentResults, investmentIncome: undefined }} />);

    expect(screen.queryByText('Investment Income')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Income')).not.toBeInTheDocument();
    expect(screen.queryByText(/Investment Income Tax/)).not.toBeInTheDocument();
  });
});
