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
      id: 'a1',
      type: 'withholdingAccount',
      capitalGains: -500_000,
      dividends: 800_000,
      reportsCapitalGains: true,
      reportsDividends: true,
    },
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

const residenceTaxOnEarnedIncome = {
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
    ...residenceTaxOnEarnedIncome,
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

    expect(screen.getByText('Net Investment Income (separate)')).toBeInTheDocument();
    const tooltip = tooltipTitled('Investment Income under Separate Taxation');
    expect(tooltip).toBeDefined();
    // The −500,000 appears as the year's net capital gains and again as the offset.
    expect(within(tooltip!).getAllByText('-¥500,000')).toHaveLength(2);
    expect(within(tooltip!).getByText('¥800,000')).toBeInTheDocument();
    expect(
      within(tooltip!).getByText('Loss subtracted from dividends (損益通算):'),
    ).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥300,000')).toBeInTheDocument();
    expect(within(tooltip!).getByText(/foreign tax credit \(外国税額控除\)/)).toBeInTheDocument();

    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.getAllByText('¥3,860,000').length).toBeGreaterThanOrEqual(1);
  });
});

// 400,000 of dividends under aggregate taxation beside the 申告分離課税 amounts above: 配当所得 in
// 総所得金額, so 合計所得金額 is 3,860,000 + 400,000.
const withAggregateDividends = <T extends { results: TakeHomeResults }>(props: T): T => ({
  ...props,
  results: {
    ...props.results,
    totalNetIncome: 4_260_000,
    investmentIncome: { ...props.results.investmentIncome!, aggregateDividends: 400_000 },
  },
});

describe.each([
  ['TaxesTab', TaxesTab, withAggregateDividends({ results, inputs })],
  ['SocialInsuranceTab', SocialInsuranceTab, withAggregateDividends(onNhi)],
] as const)('%s dividends reported under 総合課税', (_name, Tab, props) => {
  it('lists them on the aggregate row, inside the 合計所得金額 subtotal', () => {
    render(<Tab results={props.results} inputs={props.inputs} />);

    const label = screen.getByText('Net Investment Income (aggregate)');
    expect(within(label.closest('div')!.parentElement!).getByText('¥400,000')).toBeInTheDocument();
    const tooltip = tooltipTitled('Investment Income under Aggregate Taxation');
    expect(tooltip).toBeDefined();
    expect(within(tooltip!).getByText('Dividends (配当所得):')).toBeInTheDocument();
    expect(
      within(tooltip!).queryByText('Interest paid outside Japan (利子所得):'),
    ).not.toBeInTheDocument();
    expect(
      within(tooltip!).getByText(/dividend tax credit \(配当控除\).*not supported yet/),
    ).toBeInTheDocument();
    expect(within(tooltip!).getByText(/foreign tax credit \(外国税額控除\)/)).toBeInTheDocument();
    expect(screen.getByText('Net Investment Income (separate)')).toBeInTheDocument();
    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.getAllByText('¥4,260,000').length).toBeGreaterThanOrEqual(1);
  });
});

describe('TaxesTab with dividends reported under 総合課税 alone', () => {
  it('shows the aggregate row and the 合計所得金額 subtotal with no 申告分離課税 rows', () => {
    render(
      <TaxesTab
        results={{
          ...results,
          totalNetIncome: 3_960_000,
          investmentIncome: {
            gross: { capitalGains: 0, dividends: 0, interest: 0 },
            grossTotal: 0,
            withheld: { national: 0, residence: 0, total: 0 },
            aggregateDividends: 400_000,
          },
          residenceTax: makeResidenceTaxDetails(residenceTaxOnEarnedIncome),
        }}
        inputs={inputs}
      />,
    );

    expect(screen.getByText('Net Investment Income (aggregate)')).toBeInTheDocument();
    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.queryByText('Net Investment Income (separate)')).not.toBeInTheDocument();
    expect(screen.queryByText('Taxable Investment Income (reported)')).not.toBeInTheDocument();
    expect(screen.queryByText('Tax on Investment Income (separate)')).not.toBeInTheDocument();
  });
});

// Interest paid outside Japan is 利子所得 in 総所得金額 like a 総合課税 dividend, so it
// shares that one row instead of adding a second.
describe('TaxesTab with interest paid outside Japan', () => {
  const aggregateOnly = (
    amounts: { aggregateDividends?: number; aggregateInterest?: number },
    totalNetIncome: number,
  ): TakeHomeResults => ({
    ...results,
    totalNetIncome,
    investmentIncome: {
      gross: { capitalGains: 0, dividends: 0, interest: 0 },
      grossTotal: 0,
      withheld: { national: 0, residence: 0, total: 0 },
      ...amounts,
    },
    residenceTax: makeResidenceTaxDetails(residenceTaxOnEarnedIncome),
  });

  it('shows it on the aggregate row alone, with only the interest part in the tooltip', () => {
    render(
      <TaxesTab
        results={aggregateOnly({ aggregateInterest: 100_000 }, 3_660_000)}
        inputs={inputs}
      />,
    );

    const label = screen.getByText('Net Investment Income (aggregate)');
    expect(within(label.closest('div')!.parentElement!).getByText('¥100,000')).toBeInTheDocument();
    const tooltip = tooltipTitled('Investment Income under Aggregate Taxation');
    expect(
      within(tooltip!).getByText('Interest paid outside Japan (利子所得):'),
    ).toBeInTheDocument();
    expect(within(tooltip!).queryByText('Dividends (配当所得):')).not.toBeInTheDocument();
    expect(
      within(tooltip!).getByText(
        /whole amount is interest income that counts toward total net income/,
      ),
    ).toBeInTheDocument();
    // The foreign tax credit note applies to dividends and interest alike, so it shows either way.
    expect(within(tooltip!).getByText(/foreign tax credit \(外国税額控除\)/)).toBeInTheDocument();
    expect(within(tooltip!).queryByText(/dividend tax credit \(配当控除/)).not.toBeInTheDocument();
  });

  it('adds it to the dividends on the same row rather than a second one', () => {
    render(
      <TaxesTab
        results={aggregateOnly(
          { aggregateDividends: 400_000, aggregateInterest: 100_000 },
          4_060_000,
        )}
        inputs={inputs}
      />,
    );

    expect(screen.getAllByText('Net Investment Income (aggregate)')).toHaveLength(1);
    const label = screen.getByText('Net Investment Income (aggregate)');
    expect(within(label.closest('div')!.parentElement!).getByText('¥500,000')).toBeInTheDocument();
    const tooltip = tooltipTitled('Investment Income under Aggregate Taxation');
    expect(within(tooltip!).getByText('Dividends (配当所得):')).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥400,000')).toBeInTheDocument();
    expect(
      within(tooltip!).getByText('Interest paid outside Japan (利子所得):'),
    ).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥100,000')).toBeInTheDocument();
    expect(within(tooltip!).getByText('Net Investment Income (aggregate):')).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥500,000')).toBeInTheDocument();
  });
});

describe('TaxesTab with reported investment income', () => {
  it('lists the 15% under income tax and the 3% + 2% under residence tax, with the taxable amount in the tooltips', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    // The taxable amount (after the 所得控除 spillover) has no row of its own: the 15% row's
    // tooltip derives it, and the residence-tax portion's tooltip names it.
    expect(screen.queryByText('Taxable Investment Income (reported)')).not.toBeInTheDocument();
    const taxRow = screen
      .getByText('Tax on Investment Income (separate)')
      .closest('div')!.parentElement!;
    expect(within(taxRow).getByText('¥45,000')).toBeInTheDocument();
    expect(
      within(tooltipTitled('Income Tax on Investment Income under Separate Taxation')!).getByText(
        'Taxable (¥1,000 floor):',
      ),
    ).toBeInTheDocument();
    expect(
      within(tooltipTitled('Income-based Residence Tax')!).getByText(
        /^Taxable investment income \(separate\):/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Municipal portion, investment income (3%)')).toBeInTheDocument();
    expect(screen.getByText('¥9,000')).toBeInTheDocument();
    expect(screen.getByText('Prefectural portion, investment income (2%)')).toBeInTheDocument();
    expect(screen.getByText('¥6,000')).toBeInTheDocument();
  });

  it('counts the assessed tax in Total Taxes and shows no withheld rows', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    // 137,600 income tax + 258,100 residence tax, both of which already include the reported income.
    const totalRow = screen.getByText('Total Taxes').closest('div')!.parentElement!;
    expect(within(totalRow).getByText('¥395,700')).toBeInTheDocument();
    expect(screen.queryByText(/Withheld on Investment Income/)).not.toBeInTheDocument();
  });

  it('adds a withheld row under each tax for amounts withheld beside the reported ones', () => {
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

    // One row under each tax, named alike; the rates are in their shared tooltip.
    const withheldRows = screen
      .getAllByText('Withheld on Investment Income')
      .map(label => label.closest('div')!.parentElement!);
    expect(withheldRows).toHaveLength(2);
    expect(within(withheldRows[0]!).getByText('¥15,315')).toBeInTheDocument();
    expect(within(withheldRows[1]!).getByText('¥5,000')).toBeInTheDocument();
    // 395,700 assessed + 20,315 withheld.
    const totalRow = screen.getByText('Total Taxes').closest('div')!.parentElement!;
    expect(within(totalRow).getByText('¥416,015')).toBeInTheDocument();
    expect(screen.getByText('Tax on Investment Income (separate)')).toBeInTheDocument();
  });
});

describe('SocialInsuranceTab with reported investment income on NHI', () => {
  // The investment rows and Total Net Income sit directly above the base, so the base row adds
  // no tooltip restating them.
  it('derives the NHI calculation base from Total Net Income with no restating tooltip', () => {
    const props = withAggregateDividends(onNhi);
    render(
      <SocialInsuranceTab
        results={{
          ...props.results,
          totalNetIncome: 4_360_000,
          investmentIncome: { ...props.results.investmentIncome!, aggregateInterest: 100_000 },
        }}
        inputs={props.inputs}
      />,
    );

    // 4,360,000 total net income − 430,000 basic deduction.
    const baseRow = screen.getByText('NHI Calculation Base').closest('div')!.parentElement!;
    expect(within(baseRow).getByText('¥3,930,000')).toBeInTheDocument();
    expect(within(baseRow).queryByTestId('info-tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Includes /)).not.toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab with reported investment income', () => {
  it('explains that the reported income raises the limit through its residence tax', () => {
    render(<FurusatoNozeiTab results={results} />);

    expect(
      screen.getByText(
        /Investment income reported under separate taxation \(申告分離課税\) raises the limit/,
      ),
    ).toBeInTheDocument();
  });

  it('says nothing about it otherwise', () => {
    render(<FurusatoNozeiTab results={{ ...results, investmentIncome: undefined }} />);

    expect(
      screen.queryByText(
        /Investment income reported under separate taxation \(申告分離課税\) raises the limit/,
      ),
    ).not.toBeInTheDocument();
  });
});
