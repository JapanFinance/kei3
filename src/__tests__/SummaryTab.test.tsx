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

describe('SummaryTab annual income header', () => {
  it('explains what annual income counts', () => {
    render(<SummaryTab results={baseResults} />);

    expect(screen.getByText('Annual Income')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About annual income' })).toBeInTheDocument();
  });
});

describe('SummaryTab with investment income', () => {
  const withInvestmentIncome: TakeHomeResults = makeTakeHomeResults({
    annualIncome: 5_000_000,
    healthInsurance: 246_449,
    pensionPayments: 450_180,
    employmentInsurance: 25_623,
    hasEmploymentIncome: true,
    nationalIncomeTax: 91_700,
    residenceTax: makeResidenceTaxDetails({ totalResidenceTax: 243_100 }),
    // 1,200,000 gross investment income, 243,780 withheld; take-home = 3,942,948 + 1,200,000 - 243,780.
    takeHomeIncome: 4_899_168,
    totalNetIncome: 3_560_000,
    investmentIncome: {
      gross: { capitalGains: 1_000_000, dividends: 200_000, interest: 0 },
      grossTotal: 1_200_000,
      withheld: { national: 183_780, residence: 60_000, total: 243_780 },
    },
  });

  it('divides every share by gross earned plus gross investment income, not earned income alone', () => {
    render(<SummaryTab results={withInvestmentIncome} />);

    // grossTotal = 5,000,000 + 1,200,000 = 6,200,000; take-home share = 4,899,168 / 6,200,000 = 79.0%.
    expect(screen.getByText('(79.0%)')).toBeInTheDocument();
    // Income tax share = 91,700 / 6,200,000 = 1.5% (not 1.8%, its share of annualIncome alone).
    expect(screen.getByText(/\(1\.5%\)/)).toBeInTheDocument();
  });

  it('still shows the Annual Income header as earned income only', () => {
    render(<SummaryTab results={withInvestmentIncome} />);

    expect(screen.getByText('¥5,000,000')).toBeInTheDocument();
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
