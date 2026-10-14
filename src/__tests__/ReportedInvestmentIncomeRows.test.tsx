// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { ReportedInvestmentIncome, TakeHomeInputs, TakeHomeResults } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  makeFurusatoNozeiDetails,
  makeResidenceTaxDetails,
  makeTakeHomeResults,
} from './fixtures/takeHomeResults';

vi.mock('../components/ui/Tooltips', async () => {
  const { createPortal } = await import('react-dom');
  return {
    DetailedTooltip: ({ title, children }: { title: string; children?: React.ReactNode }) => (
      <>
        <span data-testid="detail-info-tooltip-trigger" title={title}>
          ℹ️
        </span>
        {createPortal(
          <div data-testid="detail-info-tooltip-content" data-title={title}>
            {children}
          </div>,
          document.body,
        )}
      </>
    ),
    SimpleTooltip: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="info-tooltip">{children}</div>
    ),
  };
});

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

// The 損益通算 case of the engine tests: a −500,000 loss in a 特定口座 and 800,000 of dividends,
// both reported, beside a 5,000,000 salary.
const reported: ReportedInvestmentIncome = {
  gross: { capitalGains: -500_000, qualifyingCapitalLosses: 500_000, dividends: 800_000 },
  lossOffsetAgainstDividends: 500_000,
  unabsorbedQualifyingLoss: 0,
  nonQualifyingLoss: 0,
  netIncome: { capitalGains: 0, dividends: 300_000 },
  taxable: { capitalGains: 0, dividends: 300_000 },
  nationalIncomeTaxBase: 45_000,
};

const inputs: TakeHomeInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' },
    {
      id: 'g1',
      type: 'capitalGains',
      shareType: 'listed',
      account: 'specifiedWithholding',
      taxTreatment: 'separate',
      amount: -500_000,
    },
    { id: 'd1', type: 'dividends', shareType: 'listed', taxTreatment: 'separate', amount: 800_000 },
  ],
  ageRange: 'age20to39',
  region: 'Tokyo',
  healthInsuranceProvider: 'KyokaiKenpo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
};

const results: TakeHomeResults = makeTakeHomeResults({
  annualIncome: 5_300_000,
  hasEmploymentIncome: true,
  salaryIncome: 5_000_000,
  grossEmploymentIncome: 5_000_000,
  netEmploymentIncome: 3_560_000,
  totalNetIncome: 3_860_000,
  healthInsurance: 246_449,
  pensionPayments: 450_180,
  employmentInsurance: 25_623,
  nationalIncomeTaxBasicDeduction: 1_040_000,
  taxableIncomeForNationalIncomeTax: 1_797_000,
  nationalIncomeTaxBase: 89_850,
  reconstructionSurtax: 2_831.85,
  nationalIncomeTax: 137_600,
  residenceTaxBasicDeduction: 430_000,
  taxableIncomeForResidenceTax: 2_407_000,
  residenceTax: makeResidenceTaxDetails({
    taxableIncome: 2_407_000,
    cityProportion: 0.6,
    prefecturalProportion: 0.4,
    residenceTaxRate: 0.1,
    basicDeduction: 430_000,
    personalDeductionDifference: 50_000,
    city: {
      cityTaxableIncome: 1_444_200,
      cityAdjustmentCredit: 1_500,
      cityIncomeTax: 151_900,
      cityPerCapitaTax: 3_000,
    },
    prefecture: {
      prefecturalTaxableIncome: 962_800,
      prefecturalAdjustmentCredit: 1_000,
      prefecturalIncomeTax: 101_200,
      prefecturalPerCapitaTax: 1_000,
    },
    perCapitaTax: 5_000,
    forestEnvironmentTax: 1_000,
    totalResidenceTax: 258_100,
    separate: {
      taxableDividends: 300_000,
      taxableCapitalGains: 0,
      cityIncomeTax: 9_000,
      prefecturalIncomeTax: 6_000,
    },
  }),
  furusatoNozei: makeFurusatoNozeiDetails({
    limit: 65_000,
    incomeTaxReduction: 3_200,
    residenceTaxDonationBasicDeduction: 6_300,
    residenceTaxSpecialDeduction: 50_269,
    residenceTaxReduction: 56_600,
    outOfPocketCost: 5_200,
  }),
  investmentIncome: {
    gross: { capitalGains: 0, dividends: 0, interest: 0 },
    grossTotal: 0,
    withheld: { national: 0, residence: 0, total: 0 },
    reported,
  },
});

const tooltipTitled = (title: string) =>
  screen.getAllByTestId('detail-info-tooltip-content').find(el => el.dataset.title === title);

// The Social Insurance tab lists the income rows only for the income-assessed providers.
const onNhi = {
  results: { ...results, healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID },
  inputs: { ...inputs, healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID },
};

describe.each([
  ['TaxesTab', TaxesTab, { results, inputs }],
  ['SocialInsuranceTab', SocialInsuranceTab, onNhi],
] as const)('%s net investment income row', (_name, Tab, props) => {
  it('shows the reported net amount with its netting breakdown, and the 合計所得金額 subtotal', () => {
    render(<Tab results={props.results} inputs={props.inputs} />);

    expect(screen.getByText('Net Investment Income (reported)')).toBeInTheDocument();
    const tooltip = tooltipTitled('Reported Investment Income Details');
    expect(tooltip).toBeDefined();
    // The −500,000 appears as the year's net capital gains and again as the offset.
    expect(within(tooltip!).getAllByText('-¥500,000')).toHaveLength(2);
    expect(within(tooltip!).getByText('¥800,000')).toBeInTheDocument();
    expect(
      within(tooltip!).getByText('Loss offset against dividends (損益通算):'),
    ).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥300,000')).toBeInTheDocument();

    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.getAllByText('¥3,860,000').length).toBeGreaterThanOrEqual(1);
  });
});

describe('TaxesTab with reported investment income', () => {
  it('lists the taxable amount and its 15% under income tax, and the 3% + 2% under residence tax', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    // Once under Income Tax (after the 所得控除 spillover) and once under Residence Tax.
    expect(screen.getAllByText('Taxable Investment Income (reported)')).toHaveLength(2);
    expect(screen.getByText('Tax on Investment Income (15%)')).toBeInTheDocument();
    expect(screen.getByText('¥45,000')).toBeInTheDocument();
    expect(screen.getByText('Municipal portion, investment income (3%)')).toBeInTheDocument();
    expect(screen.getByText('¥9,000')).toBeInTheDocument();
    expect(screen.getByText('Prefectural portion, investment income (2%)')).toBeInTheDocument();
    expect(screen.getByText('¥6,000')).toBeInTheDocument();
  });

  it('counts the assessed tax in Total Taxes and shows no 源泉徴収 section', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    // 137,600 income tax + 258,100 residence tax, both of which already include the reported income.
    const totalRow = screen.getByText('Total Taxes').closest('div')!.parentElement!;
    expect(within(totalRow).getByText('¥395,700')).toBeInTheDocument();
    expect(screen.queryByText('Investment Income Tax (源泉徴収)')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Withheld')).not.toBeInTheDocument();
  });

  it('keeps the 源泉徴収 section for amounts withheld beside the reported ones', () => {
    render(
      <TaxesTab
        results={{
          ...results,
          investmentIncome: {
            gross: { capitalGains: 0, dividends: 0, interest: 100_000 },
            grossTotal: 100_000,
            withheld: { national: 15_315, residence: 5_000, total: 20_315 },
            reported,
          },
        }}
        inputs={inputs}
      />,
    );

    expect(screen.getByText('Investment Income Tax (源泉徴収)')).toBeInTheDocument();
    expect(screen.getByText('Total Withheld')).toBeInTheDocument();
    expect(screen.getByText('Tax on Investment Income (15%)')).toBeInTheDocument();
  });
});

describe('SocialInsuranceTab with reported investment income on NHI', () => {
  it('names the reported amount inside the NHI calculation base', () => {
    render(<SocialInsuranceTab results={onNhi.results} inputs={onNhi.inputs} />);

    expect(screen.getByText('NHI Calculation Base')).toBeInTheDocument();
    expect(
      screen.getByText(/Includes ¥300,000 of investment income reported under 申告分離課税/),
    ).toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab with reported investment income', () => {
  it('explains that the reported income raises the limit through its residence tax', () => {
    render(<FurusatoNozeiTab results={results} />);

    expect(
      screen.getByText(/Investment income reported under 申告分離課税 raises the limit/),
    ).toBeInTheDocument();
  });

  it('says nothing about it otherwise', () => {
    render(<FurusatoNozeiTab results={{ ...results, investmentIncome: undefined }} />);

    expect(
      screen.queryByText(/Investment income reported under 申告分離課税 raises the limit/),
    ).not.toBeInTheDocument();
  });
});
