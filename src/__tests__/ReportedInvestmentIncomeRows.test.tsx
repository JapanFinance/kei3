// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { SeparateTaxationIncome, TakeHomeInputs, TakeHomeResults } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  makeFurusatoNozeiDetails,
  makeResidenceTaxDetails,
  makeTakeHomeResults,
} from './fixtures/takeHomeResults';

vi.mock('../components/ui/Tooltips', async () => {
  const { createPortal } = await import('react-dom');
  return {
    DetailedTooltip: ({
      title,
      children,
      icon,
      iconAriaLabel,
    }: {
      title: string;
      children?: React.ReactNode;
      icon?: React.ReactNode;
      iconAriaLabel?: string;
    }) => (
      <>
        <span data-testid="detail-info-tooltip-trigger" title={title} aria-label={iconAriaLabel}>
          {icon ?? 'ℹ️'}
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
const separate: SeparateTaxationIncome = {
  gross: { capitalGains: -500_000, dividends: 800_000 },
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
      foreignDividends: 0,
      foreignTax: 0,
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
  // ⌊134,850 × 2.1%⌋ = ⌊2,831.85⌋: the surtax on the return drops the fraction.
  reconstructionSurtax: 2_831,
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
    reported: { separate },
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
    expect(
      within(tooltip!).getByText(
        /credited against the Japanese income tax and residence tax up to a limit, through the foreign tax credit \(外国税額控除\)/,
      ),
    ).toBeInTheDocument();

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
    investmentIncome: {
      reported: { separate, aggregate: { dividends: 400_000, interest: 0 } },
    },
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
    expect(
      within(tooltip!).getByText(
        /credited against the Japanese income tax and residence tax up to a limit, through the foreign tax credit \(外国税額控除\)/,
      ),
    ).toBeInTheDocument();
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
            reported: { aggregate: { dividends: 400_000, interest: 0 } },
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
    aggregate: { dividends: number; interest: number },
    totalNetIncome: number,
  ): TakeHomeResults => ({
    ...results,
    totalNetIncome,
    investmentIncome: {
      reported: { aggregate },
    },
    residenceTax: makeResidenceTaxDetails(residenceTaxOnEarnedIncome),
  });

  it('shows it on the aggregate row alone, with only the interest part in the tooltip', () => {
    render(
      <TaxesTab
        results={aggregateOnly({ dividends: 0, interest: 100_000 }, 3_660_000)}
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
    expect(
      within(tooltip!).getByText(
        /credited against the Japanese income tax and residence tax up to a limit, through the foreign tax credit \(外国税額控除\)/,
      ),
    ).toBeInTheDocument();
    expect(within(tooltip!).queryByText(/dividend tax credit \(配当控除/)).not.toBeInTheDocument();
  });

  it('adds it to the dividends on the same row rather than a second one', () => {
    render(
      <TaxesTab
        results={aggregateOnly({ dividends: 400_000, interest: 100_000 }, 4_060_000)}
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

describe('TaxesTab with investment income left to withholding in two accounts', () => {
  // Account 1: max(0, −18,000 + 8,000) = 0; account 2: 10,000. The pooled gross amounts net to 0,
  // so the tooltip lists each account at its own base and the taxed amount the rates apply to:
  // floor(10,000 × 15.315%) = 1,531 and 10,000 × 5% = 500.
  it('lists each account at its own base so the rows add up to the taxed amount', () => {
    render(
      <TaxesTab
        results={{
          ...results,
          investmentIncome: {
            withheld: {
              accounts: [
                { position: 1, capitalGains: -18_000, dividends: 8_000, base: 0 },
                { position: 2, capitalGains: 0, dividends: 10_000, base: 10_000 },
              ],
              dividends: 0,
              interest: 0,
              received: 0,
              taxedAmount: 10_000,
              tax: { national: 1_531, residence: 500, total: 2_031 },
            },
          },
        }}
        inputs={inputs}
      />,
    );

    const tooltip = tooltipTitled('Tax Withheld on Investment Income')!;
    const amountOf = (label: string) =>
      within(within(tooltip).getByText(label).closest('tr')!).getAllByRole('cell')[1]!.textContent;
    expect(amountOf('Account 1 (sales -¥18,000, dividends ¥8,000):')).toBe('¥0');
    expect(amountOf('Account 2 (dividends ¥10,000):')).toBe('¥10,000');
    expect(amountOf('Taxed amount:')).toBe('¥10,000');
    expect(amountOf('Income tax withheld (15.315%):')).toBe('¥1,531');
    expect(amountOf('Residence tax withheld (5%):')).toBe('¥500');
    expect(within(tooltip).queryByText('Capital gains:')).not.toBeInTheDocument();
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
    // The 3%/2% rates on separate income are folded into the single Municipal/Prefectural
    // portion rows, with the breakdown in each row's own tooltip rather than in its title.
    const split = expand(screen.getByText('Income-based Portion'));
    expect(
      within(rowOf(within(split).getByText('Municipal portion'))).getByText('¥153,420'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(within(split).getByText('Prefectural portion'))).getByText('¥102,280'),
    ).toBeInTheDocument();
    const municipalPortionTooltip = tooltipTitled('Municipal Income-based Portion')!;
    expect(within(municipalPortionTooltip).getByText('6%')).toBeInTheDocument();
    expect(within(municipalPortionTooltip).getByText('3%')).toBeInTheDocument();
    expect(within(municipalPortionTooltip).getByText('¥9,000')).toBeInTheDocument();
    const prefecturalPortionTooltip = tooltipTitled('Prefectural Income-based Portion')!;
    expect(within(prefecturalPortionTooltip).getByText('4%')).toBeInTheDocument();
    expect(within(prefecturalPortionTooltip).getByText('2%')).toBeInTheDocument();
    expect(within(prefecturalPortionTooltip).getByText('¥6,000')).toBeInTheDocument();
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
            withheld: {
              accounts: [],
              dividends: 0,
              interest: 100_000,
              received: 100_000,
              taxedAmount: 100_000,
              tax: { national: 15_315, residence: 5_000, total: 20_315 },
            },
            reported: { separate },
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
          investmentIncome: {
            reported: {
              ...props.results.investmentIncome!.reported,
              aggregate: { dividends: 400_000, interest: 100_000 },
            },
          },
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

const rowOf = (label: HTMLElement) => label.closest('div')!.parentElement!;

/** The amount beside a label in a tooltip's amount table. */
const amountIn = (tooltip: HTMLElement, label: string) =>
  within(within(tooltip).getByText(`${label}:`).closest('tr')!).getAllByRole('cell')[1]!
    .textContent;

/** Expands a disclosure row and returns the region it controls. */
const expand = (label: HTMLElement) => {
  const button = label.closest('button')!;
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  return document.getElementById(button.getAttribute('aria-controls')!)!;
};

const expectInDocumentOrder = (elements: HTMLElement[]) => {
  elements.slice(1).forEach((element, i) => {
    expect(
      elements[i]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
};

// Case E of the foreign tax cases in taxCalculations.test.ts: the account's 800,000 of dividends
// above are all from foreign companies, with 80,000 of foreign tax. The loss leaves 合計所得金額 at
// 3,860,000 but not the 800,000 of foreign-source income. B = 89,850 + 45,000 = 134,850,
// R = ⌊2,831.85⌋ = 2,831; L = ⌊134,850 × 800,000 / 3,860,000⌋ = 27,948, L_R = ⌊2,831 × 800,000 /
// 3,860,000⌋ = 586, ⌊27,948 × 12%⌋ = 3,353, ⌊27,948 × 18%⌋ = 5,030, all used. Income tax
// ⌊(134,850 + 2,831 − 27,948 − 586) / 100⌋ × 100 = 109,100; 住民税 市 151,920 − 5,030 = 146,890 →
// 146,800, 県 101,280 − 3,353 = 97,927 → 97,900, + 5,000 = 249,700.
const caseELimits = {
  incomeTax: 27_948,
  reconstructionSurtax: 586,
  prefecture: 3_353,
  city: 5_030,
};
const withForeignTax: TakeHomeResults = {
  ...results,
  nationalIncomeTax: 109_100,
  residenceTax: makeResidenceTaxDetails({
    ...residenceTaxOnEarnedIncome,
    city: { ...residenceTaxOnEarnedIncome.city, cityIncomeTax: 146_800 },
    prefecture: { ...residenceTaxOnEarnedIncome.prefecture, prefecturalIncomeTax: 97_900 },
    totalResidenceTax: 249_700,
    separate: {
      taxableDividends: 300_000,
      taxableCapitalGains: 0,
      cityIncomeTax: 9_000,
      prefecturalIncomeTax: 6_000,
    },
    foreignTaxCredit: { city: 5_030, prefecture: 3_353 },
  }),
  residenceTaxIncomeBasedBeforeForeignTaxCredit: 253_100,
  foreignTaxCredit: {
    foreignTax: 80_000,
    foreignSourceIncome: 800_000,
    adjustedForeignSourceIncome: 800_000,
    totalIncome: 3_860_000,
    incomeTax: 134_850,
    limit: caseELimits,
    credit: caseELimits,
    excess: 43_083,
  },
  foreignTaxPaid: 80_000,
};

describe('TaxesTab with the foreign tax credit', () => {
  it('shows the credit under each tax and the foreign tax paid in the income tax total', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    // 27,948 + 586 off the income tax and the surtax.
    expect(within(rowOf(incomeTaxCredit)).getByText('-¥28,534')).toBeInTheDocument();
    expect(
      within(rowOf(screen.getByText('Foreign Tax Paid'))).getByText('¥80,000'),
    ).toBeInTheDocument();
    // 109,100 + 80,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥189,100'),
    ).toBeInTheDocument();
    // 189,100 + 249,700.
    expect(
      within(rowOf(screen.getByText('Total Taxes'))).getByText('¥438,800'),
    ).toBeInTheDocument();

    // On the residence side the credit is folded into the Tax credit rows below the portions,
    // alongside the adjustment credit: 1,500 + 5,030 municipal, 1,000 + 3,353 prefectural.
    const split = expand(screen.getByText('Income-based Portion'));
    expect(
      within(rowOf(within(split).getByText('Tax credit (municipal)'))).getByText('-¥6,530'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(within(split).getByText('Tax credit (prefectural)'))).getByText('-¥4,353'),
    ).toBeInTheDocument();
  });

  it('breaks the income tax credit down into the foreign tax, the income and the two limits', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    const details = expand(incomeTaxCredit);
    expect(
      within(rowOf(within(details).getByText('Income tax credit'))).getByText('-¥27,948'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(within(details).getByText('Surtax credit'))).getByText('-¥586'),
    ).toBeInTheDocument();

    // L = ⌊134,850 × 800,000 / 3,860,000⌋, all of it credited since F = 80,000 is more.
    const incomeTaxCreditTooltip = tooltipTitled('Income Tax Credit')!;
    expect(amountIn(incomeTaxCreditTooltip, 'Income tax, after the home loan tax credit')).toBe(
      '¥134,850',
    );
    expect(amountIn(incomeTaxCreditTooltip, 'Foreign-source income')).toBe('¥800,000');
    expect(amountIn(incomeTaxCreditTooltip, 'Total net income')).toBe('¥3,860,000');
    expect(amountIn(incomeTaxCreditTooltip, 'Income tax limit')).toBe('¥27,948');
    expect(amountIn(incomeTaxCreditTooltip, 'Credited against income tax')).toBe('¥27,948');
    // The account's dividends are all the foreign-source income, below 所得総額, so no cap.
    expect(
      within(incomeTaxCreditTooltip).queryByText('Capped foreign-source income:'),
    ).not.toBeInTheDocument();
    // All of F came with the income entries, so there is no return breakdown to show.
    expect(
      within(incomeTaxCreditTooltip).queryByText('Paid with a foreign tax return:'),
    ).not.toBeInTheDocument();

    // L_R = ⌊2,831 × 800,000 / 3,860,000⌋ out of the 80,000 − 27,948 = 52,052 left.
    const surtaxCreditTooltip = tooltipTitled('Surtax Credit')!;
    expect(amountIn(surtaxCreditTooltip, 'Reconstruction surtax')).toBe('¥2,831');
    expect(amountIn(surtaxCreditTooltip, 'Surtax limit')).toBe('¥586');
    expect(amountIn(surtaxCreditTooltip, 'Left after the income tax credit')).toBe('¥52,052');
    expect(amountIn(surtaxCreditTooltip, 'Credited against the surtax')).toBe('¥586');
  });

  it('breaks the residence tax credit down into the prefectural and municipal credits', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const split = expand(screen.getByText('Income-based Portion'));
    expect(
      within(rowOf(within(split).getByText('Tax credit (municipal)'))).getByText('-¥6,530'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(within(split).getByText('Tax credit (prefectural)'))).getByText('-¥4,353'),
    ).toBeInTheDocument();

    // 80,000 − 27,948 − 586 = 51,466 left; the limit ⌊27,948 × 12%⌋ is the smaller.
    const prefectural = tooltipTitled('Prefectural Tax Credit')!;
    expect(amountIn(prefectural, 'Left after income tax and the surtax')).toBe('¥51,466');
    expect(amountIn(prefectural, 'Limit (12% of ¥27,948)')).toBe('¥3,353');
    expect(amountIn(prefectural, 'Credit, the smaller of the two')).toBe('¥3,353');
    // 51,466 − 3,353 = 48,113 left; the limit ⌊27,948 × 18%⌋ is the smaller.
    const municipal = tooltipTitled('Municipal Tax Credit')!;
    expect(amountIn(municipal, 'Left after the prefectural credit')).toBe('¥48,113');
    expect(amountIn(municipal, 'Limit (18% of ¥27,948)')).toBe('¥5,030');
    expect(amountIn(municipal, 'Credit, the smaller of the two')).toBe('¥5,030');
    // Each income-based portion absorbed its whole credit.
    for (const tooltip of [prefectural, municipal]) {
      expect(within(tooltip).queryByText(/^Capped at/)).not.toBeInTheDocument();
    }
    // Each tooltip also shows the adjustment credit sharing the row, and the combined total.
    expect(within(prefectural).getByText(/Adjustment Credit/)).toBeInTheDocument();
    expect(within(prefectural).getByText('Prefectural tax credit: ¥4,353')).toBeInTheDocument();
    expect(within(municipal).getByText('Municipal tax credit: ¥6,530')).toBeInTheDocument();
  });

  it('shows the portions without the foreign tax, folded into the tax credit rows instead', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const split = expand(screen.getByText('Income-based Portion'));
    expect(within(split).queryByText(/foreign/i)).not.toBeInTheDocument();
    // 2,407,000 × 6% = 144,420 + the 300,000 dividends' 3% = 9,000.
    expect(
      within(rowOf(within(split).getByText('Municipal portion'))).getByText('¥153,420'),
    ).toBeInTheDocument();
    // 2,407,000 × 4% = 96,280 + the 300,000 dividends' 2% = 6,000.
    expect(
      within(rowOf(within(split).getByText('Prefectural portion'))).getByText('¥102,280'),
    ).toBeInTheDocument();
  });

  it('shows the foreign tax above every limit in the Foreign Tax Paid tooltip', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    // 51,466 left for residence tax − 3,353 − 5,030.
    const tooltip = tooltipTitled('Foreign Tax Paid')!;
    expect(amountIn(tooltip, 'Not credited this year')).toBe('¥43,083');
    expect(
      within(tooltip).getByText(/can be carried forward for up to three years/),
    ).toBeInTheDocument();
    expect(
      within(tooltip).getByText(
        'Foreign tax and unused limits carried forward from earlier years are not supported.',
      ),
    ).toBeInTheDocument();
  });

  it('places the rows where the calculation applies them', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    expectInDocumentOrder([
      screen.getByText('Reconstruction Surtax'),
      screen.getByText('Foreign Tax Credit'),
      screen.getByText('Foreign Tax Paid'),
      screen.getByText('Total Income Tax'),
      screen.getByText('Income-based Portion'),
      screen.getByText('Tax credit (municipal)'),
      screen.getByText('Tax credit (prefectural)'),
      screen.getByText('Per Capita Portion'),
      screen.getByText('Total Residence Tax'),
    ]);
  });

  it('shows no foreign tax rows without foreign tax', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    expect(screen.queryByText('Foreign Tax Credit')).not.toBeInTheDocument();
    expect(screen.queryByText('Foreign Tax Paid')).not.toBeInTheDocument();
    // The Tax credit rows still show for their ordinary adjustment credit, with no foreign
    // tax credit section in their tooltip.
    const split = expand(screen.getByText('Income-based Portion'));
    within(split).getByText('Tax credit (municipal)');
    const municipalTooltip = tooltipTitled('Municipal Tax Credit')!;
    expect(
      within(municipalTooltip).queryByText('Foreign Tax Credit (外国税額控除)'),
    ).not.toBeInTheDocument();
  });

  // Case K′ of the engine tests: 20,000 paid with a foreign tax return beside the 5,000,000 salary,
  // with no income entry that has foreign-source income. There is no limit, so the taxes are the
  // salary's alone: income tax 91,700 (B 89,850, R ⌊1,886.85⌋ = 1,886) and residence tax 243,100.
  const zero = { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 };
  const earnedIncomeResidenceTax = {
    ...residenceTaxOnEarnedIncome,
    city: { ...residenceTaxOnEarnedIncome.city, cityIncomeTax: 142_900 },
    prefecture: { ...residenceTaxOnEarnedIncome.prefecture, prefecturalIncomeTax: 95_200 },
    totalResidenceTax: 243_100,
  };
  const paidWithReturn: TakeHomeResults = {
    ...results,
    annualIncome: 5_000_000,
    totalNetIncome: 3_560_000,
    investmentIncome: undefined,
    nationalIncomeTax: 91_700,
    reconstructionSurtax: 1_886,
    residenceTax: makeResidenceTaxDetails(earnedIncomeResidenceTax),
    foreignTaxCredit: {
      foreignTax: 20_000,
      foreignSourceIncome: 0,
      adjustedForeignSourceIncome: 0,
      totalIncome: 3_560_000,
      incomeTax: 89_850,
      manualForeignTax: 20_000,
      limit: zero,
      credit: zero,
      excess: 20_000,
    },
    foreignTaxPaid: 20_000,
  };

  it('shows the rows for tax paid with a return, with no investment income', () => {
    render(<TaxesTab results={paidWithReturn} inputs={inputs} />);

    // No limit: the credit row reads ¥0, not a negative zero.
    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    expect(within(rowOf(incomeTaxCredit)).getByText('¥0')).toBeInTheDocument();
    expect(within(rowOf(incomeTaxCredit)).queryByText('-¥0')).not.toBeInTheDocument();
    expect(
      within(rowOf(screen.getByText('Foreign Tax Paid'))).getByText('¥20,000'),
    ).toBeInTheDocument();
    // 91,700 + 20,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥111,700'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Withheld on Investment Income')).not.toBeInTheDocument();
    expect(screen.queryByText('Net Investment Income (separate)')).not.toBeInTheDocument();

    // The eligible foreign tax is all paid with the return, so that is its only part.
    const details = expand(incomeTaxCredit);
    expect(
      within(rowOf(within(details).getByText('Income tax credit'))).getByText('¥0'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(within(details).getByText('Surtax credit'))).getByText('¥0'),
    ).toBeInTheDocument();
    const incomeTaxCreditTooltip = tooltipTitled('Income Tax Credit')!;
    expect(amountIn(incomeTaxCreditTooltip, 'Paid with a foreign tax return')).toBe('¥20,000');
    expect(amountIn(incomeTaxCreditTooltip, 'Eligible for the credit')).toBe('¥20,000');
    expect(
      within(incomeTaxCreditTooltip).queryByText('Entered with income entries:'),
    ).not.toBeInTheDocument();
    expect(amountIn(incomeTaxCreditTooltip, 'Income tax limit')).toBe('¥0');
    expect(within(incomeTaxCreditTooltip).getByText(/the limit is ¥0/)).toBeInTheDocument();

    // The residence side has only the ordinary adjustment credit; nothing was left to credit
    // there, so the Tax credit tooltips have no foreign tax credit section.
    const municipalTooltip = tooltipTitled('Municipal Tax Credit')!;
    expect(
      within(municipalTooltip).queryByText('Foreign Tax Credit (外国税額控除)'),
    ).not.toBeInTheDocument();

    // Nothing is credited, so all 20,000 carries forward.
    expect(amountIn(tooltipTitled('Foreign Tax Paid')!, 'Not credited this year')).toBe('¥20,000');
  });

  it('shows the credit row at ¥0 when all the foreign tax is on dividends left to withholding', () => {
    // Case B of the engine tests: a 1,000,000 dividend from a foreign company with 100,000 of
    // foreign tax, left to withholding beside the 5,000,000 salary. Nothing is creditable
    // (措令4条の5⑫), so there is no credit result, but foreign tax was entered, so the row answers
    // it. Withholding on 1,000,000 − 100,000 = 900,000: ⌊900,000 × 15.315%⌋ = 137,835 and 45,000.
    render(
      <TaxesTab
        results={{
          ...paidWithReturn,
          annualIncome: 6_000_000,
          investmentIncome: {
            withheld: {
              accounts: [],
              dividends: 1_000_000,
              dividendsForeignTax: 100_000,
              interest: 0,
              received: 1_000_000,
              taxedAmount: 900_000,
              foreignTax: 100_000,
              tax: { national: 137_835, residence: 45_000, total: 182_835 },
            },
          },
          foreignTaxCredit: undefined,
          foreignTaxPaid: 100_000,
        }}
        inputs={inputs}
      />,
    );

    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    expect(within(rowOf(incomeTaxCredit)).getByText('¥0')).toBeInTheDocument();
    // 91,700 + 137,835 + 100,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥329,535'),
    ).toBeInTheDocument();
    expect(
      within(tooltipTitled('Foreign Tax Credit — Income Tax')!).getByText(
        /All the foreign tax paid, ¥100,000, is on dividends left to withholding\./,
      ),
    ).toBeInTheDocument();
    // With no figures to break down, the row is not a disclosure.
    expect(within(rowOf(incomeTaxCredit)).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Income tax credit')).not.toBeInTheDocument();

    // The residence side still has only the ordinary adjustment credit.
    const municipalTooltip = tooltipTitled('Municipal Tax Credit')!;
    expect(
      within(municipalTooltip).queryByText('Foreign Tax Credit (外国税額控除)'),
    ).not.toBeInTheDocument();
  });

  it('displays warning icon and excess explanation when foreign tax exceeds the limit', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    const row = rowOf(incomeTaxCredit);
    const trigger = within(row).getByTestId('detail-info-tooltip-trigger');

    expect(trigger).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Foreign tax credit warning: ¥43,083 exceeds limits'),
    );

    const tooltip = tooltipTitled('Foreign Tax Credit — Income Tax')!;
    expect(
      within(tooltip).getByText(/¥43,083 of foreign tax is not credited this year/),
    ).toBeInTheDocument();
    expect(
      within(tooltip).getByText(/Foreign tax exceeds the allowable Japanese credit limits/),
    ).toBeInTheDocument();
    expect(
      within(tooltip).getByText(
        /It can be carried forward for up to three years by attaching the foreign tax credit statement/,
      ),
    ).toBeInTheDocument();
  });

  it('displays standard info icon and no excess alert when foreign tax is fully credited', () => {
    const fullyCreditedResults: TakeHomeResults = {
      ...withForeignTax,
      foreignTaxCredit: {
        ...withForeignTax.foreignTaxCredit!,
        excess: 0,
      },
    };
    render(<TaxesTab results={fullyCreditedResults} inputs={inputs} />);

    const incomeTaxCredit = screen.getByText('Foreign Tax Credit');
    const row = rowOf(incomeTaxCredit);
    const trigger = within(row).getByTestId('detail-info-tooltip-trigger');

    expect(trigger).toHaveAttribute('aria-label', 'Foreign tax credit details');
    expect(trigger).toHaveTextContent('ℹ️');

    const tooltip = tooltipTitled('Foreign Tax Credit — Income Tax')!;
    expect(within(tooltip).queryByText(/is not credited this year/)).not.toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab with the foreign tax credit', () => {
  it('shows FTC-specific warning when FTC wipes out income tax and suppresses One-Stop recommendation', () => {
    const wipedOutResults = {
      ...withForeignTax,
      nationalIncomeTax: 0,
      furusatoNozei: {
        ...withForeignTax.furusatoNozei,
        incomeTaxReduction: 0,
        outOfPocketCost: 15_000,
      },
    };
    render(<FurusatoNozeiTab results={wipedOutResults} />);

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
});
