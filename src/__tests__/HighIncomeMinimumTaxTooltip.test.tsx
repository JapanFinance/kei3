// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { HighIncomeMinimumTaxTooltip } from '../components/TakeHomeCalculator/tabs/HighIncomeMinimumTaxTooltip';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { percentTo } from '../data/premiumRate';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { HighIncomeMinimumTaxResult, TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, EMPTY_PERSONAL_CIRCUMSTANCES } from '../types/tax';
import { formatJPY } from '../utils/formatters';
import { makeTakeHomeResults } from './fixtures/takeHomeResults';

// Render the DetailedTooltip body inline so the content is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const sampleMinimumTax: HighIncomeMinimumTaxResult = {
  baselineIncome: 1_053_000_000,
  threshold: 330_000_000,
  taxableExcess: 723_000_000,
  rate: percentTo(1)(22.5),
  taxOnExcess: 162_675_000,
  baselineIncomeTax: 160_983_622,
  additionalIncomeTax: 1_691_378,
  additionalReconstructionSurtax: 35_518,
  totalAdditionalTax: 1_726_896,
};

describe('HighIncomeMinimumTaxTooltip', () => {
  it('renders all statutory calculation breakdown rows from Form 01.pdf', () => {
    render(<HighIncomeMinimumTaxTooltip minimumTax={sampleMinimumTax} />);

    // Section Title
    expect(screen.getByText('特定の基準所得金額の課税の特例')).toBeInTheDocument();

    // Baseline Income (⑬)
    expect(screen.getByText('Baseline income (基準所得金額, ⑬):')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(1_053_000_000))).toBeInTheDocument();

    // Threshold Deduction
    expect(screen.getByText('Statutory threshold deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(330_000_000)}`)).toBeInTheDocument();

    // Taxable Excess (⑭)
    expect(screen.getByText('Taxable excess (¥1,000 floor, ⑭):')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(723_000_000))).toBeInTheDocument();

    // Rate
    expect(screen.getByText('Minimum tax rate:')).toBeInTheDocument();
    expect(screen.getByText('22.5%')).toBeInTheDocument();

    // Target Tax (⑮)
    expect(screen.getByText('Target tax amount (⑮):')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(162_675_000))).toBeInTheDocument();

    // Baseline Income Tax (㉒)
    expect(screen.getByText('Baseline income tax & surtax (㉒):')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(160_983_622)}`)).toBeInTheDocument();

    // Additional Income Tax (㉓)
    expect(screen.getByText('Additional income tax (㉓):')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(1_691_378))).toBeInTheDocument();

    // Reconstruction Surtax on Addition
    expect(screen.getByText('Reconstruction surtax on addition (2.1%):')).toBeInTheDocument();
    expect(screen.getByText(`+${formatJPY(35_518)}`)).toBeInTheDocument();

    // Total Minimum Tax Addition
    expect(screen.getByText('Total minimum tax addition:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(1_726_896))).toBeInTheDocument();

    // Official NTA Source Links
    expect(
      screen.getByRole('link', { name: /極めて高い水準の所得に対する負担の適正化措置について/ }),
    ).toHaveAttribute('href', 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/kiwataka/index.htm');
    expect(
      screen.getByRole('link', { name: /適用判定表 兼 税額計算書 \(Form 01\.pdf\)/ }),
    ).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/gengaku/01.pdf',
    );
  });
});

describe('TaxesTab Minimum Tax on High Income Row', () => {
  const dummyInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    personalCircumstances: EMPTY_PERSONAL_CIRCUMSTANCES,
    incomeStreams: [],
    ageRange: 'age40to59',
    region: 'Tokyo',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2025,
  };

  it('renders Minimum Tax on High Income row when highIncomeMinimumTax is present', () => {
    const resultsWithMinTax = makeTakeHomeResults({
      nationalIncomeTaxBase: 157_672_500,
      highIncomeMinimumTax: sampleMinimumTax,
      reconstructionSurtax: 3_346_641,
      nationalIncomeTax: 162_710_500,
    });

    render(<TaxesTab results={resultsWithMinTax} inputs={dummyInputs} />);

    expect(screen.getByText('Minimum Tax on High Income')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(1_691_378))).toHaveLength(2);
  });

  it('does not render Minimum Tax on High Income row when highIncomeMinimumTax is undefined', () => {
    const resultsWithoutMinTax = makeTakeHomeResults({
      nationalIncomeTaxBase: 50_000,
      highIncomeMinimumTax: undefined,
      reconstructionSurtax: 1_050,
      nationalIncomeTax: 51_000,
    });

    render(<TaxesTab results={resultsWithoutMinTax} inputs={dummyInputs} />);

    expect(screen.queryByText('Minimum Tax on High Income')).not.toBeInTheDocument();
  });
});
