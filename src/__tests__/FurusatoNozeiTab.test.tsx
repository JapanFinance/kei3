// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import { percentTo } from '../data/premiumRate';
import type {
  ForeignTaxCreditResult,
  HighIncomeMinimumTaxResult,
  HomeLoanTaxCreditResult,
  TakeHomeResults,
} from '../types/tax';
import { makeFurusatoNozeiDetails, makeTakeHomeResults } from './fixtures/takeHomeResults';

const mockMinimumTax: HighIncomeMinimumTaxResult = {
  baselineIncome: 353_560_000,
  threshold: 165_000_000,
  taxableExcess: 188_560_000,
  rate: percentTo(1)(30),
  taxOnExcess: 56_568_000,
  baselineIncomeTax: 53_788_526,
  additionalIncomeTax: 2_779_474,
  additionalReconstructionSurtax: 58_368,
  totalAdditionalTax: 2_837_842,
};

vi.mock('../components/ui/Tooltips', () => ({
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
  DetailedTooltip: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <span data-testid="detail-info-tooltip" title={title}>
      {children}
    </span>
  ),
}));

const mockForeignTaxCredit: ForeignTaxCreditResult = {
  foreignTax: 50_000,
  foreignSourceIncome: 500_000,
  adjustedForeignSourceIncome: 500_000,
  totalIncome: 5_000_000,
  incomeTax: 100_000,
  limit: { incomeTax: 40_000, reconstructionSurtax: 840, prefecture: 3_000, city: 6_000 },
  credit: { incomeTax: 40_000, reconstructionSurtax: 840, prefecture: 3_000, city: 6_000 },
  excess: 160,
};

const mockHomeLoanCredit: HomeLoanTaxCreditResult = {
  availableCredit: 100_000,
  appliedToIncomeTax: 100_000,
  appliedToResidenceTax: 0,
  unusedCredit: 0,
  warnings: [],
};

describe('FurusatoNozeiTab High Out-of-Pocket Cost Warnings', () => {
  it('does not display warning when out-of-pocket cost is nominal (<= 2,200 yen)', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
        outOfPocketCost: 2_000,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.queryByText(/Warning: High Out-of-Pocket Cost/)).not.toBeInTheDocument();
  });

  it('displays Branch 1 warning when FTC wipes out Japanese national income tax to 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 0,
      foreignTaxCredit: mockForeignTaxCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 50_000,
        outOfPocketCost: 10_000,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText(/Warning: High Out-of-Pocket Cost/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /because the Foreign Tax Credit already reduces your Japanese national income tax to ¥0/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/One-Stop system.*cannot be used/s)).toBeInTheDocument();
    expect(
      screen.queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('displays Branch 2 warning when FTC is partial but donation lowers the FTC limit', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 50_000,
      foreignTaxCredit: mockForeignTaxCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 74_000,
        incomeTaxReduction: 2_800,
        residenceTaxReduction: 64_300,
        outOfPocketCost: 6_900,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText(/Warning: High Out-of-Pocket Cost/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Applying the donation deduction lowers your Japanese income tax base, which reduces the allowable Foreign Tax Credit limit/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/One-Stop system.*cannot be used/s)).toBeInTheDocument();
    expect(
      screen.queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('displays Branch 3 warning when Home Loan Tax Credit wipes out national income tax to 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 0,
      homeLoanTaxCredit: mockHomeLoanCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 45_000,
        outOfPocketCost: 5_000,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText(/Warning: High Out-of-Pocket Cost/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /because the Home Loan Tax Credit already reduces your Japanese national income tax to ¥0, and any spillover into residence tax has reached its statutory cap/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If you are eligible.*this issue is avoided by using the One-Stop system/s),
    ).toBeInTheDocument();
  });

  it('displays Minimum Tax warning when minimum tax sets floor and incomeTaxReduction is 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 56_626_300,
      highIncomeMinimumTax: mockMinimumTax,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 4_458_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 4_001_100,
        outOfPocketCost: 456_900,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText(/Warning: High Out-of-Pocket Cost/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /because the Minimum Tax on High Income Taxpayers \(特定の基準所得金額の課税の特例\) sets a statutory tax floor on baseline income/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /any reduction in your baseline income tax is offset yen-for-yen by an increase in the minimum tax addition/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/One-Stop system.*cannot be used/s)).toBeInTheDocument();
    expect(
      screen.queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('displays Branch 4 fallback warning when standard bracket shift causes high out-of-pocket cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 100_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 98_000,
        incomeTaxReduction: 9_800,
        residenceTaxReduction: 76_400,
        outOfPocketCost: 11_800,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText(/Warning: High Out-of-Pocket Cost/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /This happens when filing a tax return if taxable income changes income tax brackets after applying the Furusato Nozei donation deduction/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This issue is avoided by using the One-Stop system/),
    ).toBeInTheDocument();
  });

  it('renders fallback placeholder when limit is 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 0 }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('No Furusato Nozei Data Available')).toBeInTheDocument();
  });
});
