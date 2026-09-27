// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
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

    const [incomeTaxCredit, residenceTaxCredit] = screen.getAllByText('Foreign Tax Credit');
    // 27,948 + 586 off the income tax and the surtax.
    expect(within(rowOf(incomeTaxCredit!)).getByText('-¥28,534')).toBeInTheDocument();
    // The floored 所得割 before the credit, 151,900 + 101,200 = 253,100, less the 146,800 +
    // 97,900 = 244,700 after it.
    expect(within(rowOf(residenceTaxCredit!)).getByText('-¥8,400')).toBeInTheDocument();
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
    // What each side's income-based portion absorbed, in its breakdown.
    expect(
      within(rowOf(screen.getByText('Foreign tax credit (municipal)'))).getByText('-¥5,030'),
    ).toBeInTheDocument();
    expect(
      within(rowOf(screen.getByText('Foreign tax credit (prefectural)'))).getByText('-¥3,353'),
    ).toBeInTheDocument();
  });

  it('places the rows where the calculation applies them', () => {
    render(<TaxesTab results={withForeignTax} inputs={inputs} />);

    const [incomeTaxCredit, residenceTaxCredit] = screen.getAllByText('Foreign Tax Credit');
    expectInDocumentOrder([
      screen.getByText('Reconstruction Surtax'),
      incomeTaxCredit!,
      screen.getByText('Foreign Tax Paid'),
      screen.getByText('Total Income Tax'),
      screen.getByText('Income-based Portion'),
      residenceTaxCredit!,
      screen.getByText('Per Capita Portion'),
      screen.getByText('Total Residence Tax'),
    ]);
  });

  it('shows no foreign tax rows without foreign tax', () => {
    render(<TaxesTab results={results} inputs={inputs} />);

    expect(screen.queryByText('Foreign Tax Credit')).not.toBeInTheDocument();
    expect(screen.queryByText('Foreign Tax Paid')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Foreign tax credit \(/)).not.toBeInTheDocument();
  });

  // Case K of the engine tests: 20,000 of foreign tax on 500,000 of foreign-source income entered
  // by hand beside the 5,000,000 salary, with no investment entry. B = 89,850, R = 1,886;
  // L = ⌊89,850 × 500,000 / 3,560,000⌋ = 12,619, L_R = ⌊1,886 × 500,000 / 3,560,000⌋ = 264,
  // ⌊12,619 × 12%⌋ = 1,514, ⌊12,619 × 18%⌋ = 2,271. Income tax ⌊(89,850 + 1,886 − 12,619 − 264) /
  // 100⌋ × 100 = 78,800; 住民税 市 142,920 − 2,271 → 140,600, 県 95,280 − 1,514 → 93,700.
  const caseKLimits = {
    incomeTax: 12_619,
    reconstructionSurtax: 264,
    prefecture: 1_514,
    city: 2_271,
  };
  const earnedIncomeResidenceTax = {
    ...residenceTaxOnEarnedIncome,
    city: { ...residenceTaxOnEarnedIncome.city, cityIncomeTax: 142_900 },
    prefecture: { ...residenceTaxOnEarnedIncome.prefecture, prefecturalIncomeTax: 95_200 },
    totalResidenceTax: 243_100,
  };
  const enteredByHand: TakeHomeResults = {
    ...results,
    annualIncome: 5_000_000,
    totalNetIncome: 3_560_000,
    investmentIncome: undefined,
    nationalIncomeTax: 78_800,
    reconstructionSurtax: 1_886,
    residenceTax: makeResidenceTaxDetails({
      ...earnedIncomeResidenceTax,
      city: { ...earnedIncomeResidenceTax.city, cityIncomeTax: 140_600 },
      prefecture: { ...earnedIncomeResidenceTax.prefecture, prefecturalIncomeTax: 93_700 },
      totalResidenceTax: 239_300,
      foreignTaxCredit: { city: 2_271, prefecture: 1_514 },
    }),
    residenceTaxIncomeBasedBeforeForeignTaxCredit: 238_100,
    foreignTaxCredit: {
      foreignTax: 20_000,
      foreignSourceIncome: 500_000,
      adjustedForeignSourceIncome: 500_000,
      totalIncome: 3_560_000,
      incomeTax: 89_850,
      manualForeignTax: 20_000,
      manualForeignSourceIncome: 500_000,
      limit: caseKLimits,
      credit: caseKLimits,
      excess: 3_332,
    },
    foreignTaxPaid: 20_000,
  };

  it('shows the rows for foreign tax entered by hand, with no investment income', () => {
    render(<TaxesTab results={enteredByHand} inputs={inputs} />);

    const [incomeTaxCredit, residenceTaxCredit] = screen.getAllByText('Foreign Tax Credit');
    // 12,619 + 264; the floored 所得割 238,100 before, 234,300 after.
    expect(within(rowOf(incomeTaxCredit!)).getByText('-¥12,883')).toBeInTheDocument();
    expect(within(rowOf(residenceTaxCredit!)).getByText('-¥3,800')).toBeInTheDocument();
    expect(
      within(rowOf(screen.getByText('Foreign Tax Paid'))).getByText('¥20,000'),
    ).toBeInTheDocument();
    // 78,800 + 20,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥98,800'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Withheld on Investment Income')).not.toBeInTheDocument();
    expect(screen.queryByText('Net Investment Income (separate)')).not.toBeInTheDocument();
    // The tooltip names the foreign tax and the foreign-source income entered by hand.
    expect(
      within(tooltipTitled('Foreign Tax Credit — Income Tax')!).getAllByText(
        'Entered in Additional Deductions & Credits:',
      ),
    ).toHaveLength(2);
  });

  it('shows a credit of ¥0 rather than a negative zero when there is no limit', () => {
    // Case K′: no foreign-source income, so every limit is 0 and the taxes are the baseline's.
    const zero = { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 };
    render(
      <TaxesTab
        results={{
          ...enteredByHand,
          nationalIncomeTax: 91_700,
          residenceTax: makeResidenceTaxDetails(earnedIncomeResidenceTax),
          residenceTaxIncomeBasedBeforeForeignTaxCredit: undefined,
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
        }}
        inputs={inputs}
      />,
    );

    const creditRows = screen.getAllByText('Foreign Tax Credit').map(rowOf);
    expect(creditRows).toHaveLength(2);
    for (const row of creditRows) {
      expect(within(row).getByText('¥0')).toBeInTheDocument();
      expect(within(row).queryByText('-¥0')).not.toBeInTheDocument();
    }
    // 91,700 + 20,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥111,700'),
    ).toBeInTheDocument();
  });

  it('shows the credit rows at ¥0 when all the foreign tax is on dividends left to withholding', () => {
    // Case B of the engine tests: a 1,000,000 dividend from a foreign company with 100,000 of
    // foreign tax, left to withholding beside the 5,000,000 salary. Nothing is creditable
    // (措令4条の5⑫), so there is no credit result, but foreign tax was entered, so the rows answer
    // it. Withholding on 1,000,000 − 100,000 = 900,000: ⌊900,000 × 15.315%⌋ = 137,835 and 45,000.
    render(
      <TaxesTab
        results={{
          ...enteredByHand,
          annualIncome: 6_000_000,
          nationalIncomeTax: 91_700,
          residenceTax: makeResidenceTaxDetails(earnedIncomeResidenceTax),
          residenceTaxIncomeBasedBeforeForeignTaxCredit: undefined,
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

    const creditRows = screen.getAllByText('Foreign Tax Credit').map(rowOf);
    expect(creditRows).toHaveLength(2);
    for (const row of creditRows) {
      expect(within(row).getByText('¥0')).toBeInTheDocument();
    }
    // 91,700 + 137,835 + 100,000.
    expect(
      within(rowOf(screen.getByText('Total Income Tax'))).getByText('¥329,535'),
    ).toBeInTheDocument();
    for (const title of ['Foreign Tax Credit — Income Tax', 'Foreign Tax Credit — Residence Tax']) {
      expect(
        within(tooltipTitled(title)!).getByText(
          /All the foreign tax paid, ¥100,000, is on dividends left to withholding\./,
        ),
      ).toBeInTheDocument();
    }
  });
});

describe('FurusatoNozeiTab with the foreign tax credit', () => {
  it('says the reductions may be slightly high when a credit applies', () => {
    render(<FurusatoNozeiTab results={withForeignTax} />);

    expect(
      screen.getByText(/A donation also lowers the foreign tax credit limits/),
    ).toBeInTheDocument();
  });

  it('says nothing about it without a credit', () => {
    render(<FurusatoNozeiTab results={results} />);

    expect(
      screen.queryByText(/A donation also lowers the foreign tax credit limits/),
    ).not.toBeInTheDocument();
  });
});
