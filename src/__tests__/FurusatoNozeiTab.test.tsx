// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import { percentTo } from '../data/rate';
import type {
  ForeignTaxCreditResult,
  HighIncomeMinimumTaxResult,
  HomeLoanTaxCreditResult,
  TakeHomeResults,
} from '../types/tax';
import {
  makeFurusatoNozeiDetails,
  makeResidenceTaxDetails,
  makeTakeHomeResults,
} from './fixtures/takeHomeResults';

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

vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false),
}));

vi.mock('../components/ui/Tooltips', () => ({
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
  DetailedTooltip: ({
    title,
    children,
    icon,
    iconAriaLabel,
  }: {
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    iconAriaLabel?: string;
  }) => (
    <span data-testid="detail-info-tooltip" title={title} aria-label={iconAriaLabel}>
      {icon && <span data-testid="detail-info-tooltip-icon">{icon}</span>}
      {title && <span data-testid="detail-info-tooltip-title">{title}</span>}
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
  statutoryExcess: 160,
  unabsorbedResidenceCredit: 0,
  uncreditedTax: 160,
};

const mockHomeLoanCredit: HomeLoanTaxCreditResult = {
  availableCredit: 100_000,
  appliedToIncomeTax: 100_000,
  appliedToResidenceTax: 0,
  unusedCredit: 0,
  warnings: [],
};

describe('FurusatoNozeiTab Cost Breakdown Layout', () => {
  it('renders signed reductions and keeps Residence Tax Reduction sub-rows collapsed by default', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      residenceTax: makeResidenceTaxDetails({
        cityProportion: percentTo(1)(60),
        prefecturalProportion: percentTo(1)(40),
      }),
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 77_000,
        incomeTaxReduction: 7_600,
        residenceTaxDonationBasicDeduction: 7_500,
        residenceTaxSpecialDeduction: 59_800,
        residenceTaxReduction: 67_300,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('Cost Breakdown (at limit)')).toBeInTheDocument();
    expect(screen.getByText('Donation Amount')).toBeInTheDocument();
    expect(screen.queryByText('Total Tax Reduction')).not.toBeInTheDocument();
    expect(screen.getByText('-¥7,600')).toBeInTheDocument();
    expect(screen.getByText('-¥67,300')).toBeInTheDocument();
    expect(screen.getByText('¥2,100')).toBeInTheDocument();

    const residenceToggle = screen.getByRole('button', { name: /Residence Tax Reduction/ });
    expect(residenceToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Municipal tax credit')).not.toBeInTheDocument();
    expect(screen.queryByText('Prefectural tax credit')).not.toBeInTheDocument();

    fireEvent.click(residenceToggle);

    expect(residenceToggle).toHaveAttribute('aria-expanded', 'true');
    const details = document.getElementById(residenceToggle.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Municipal tax credit')).toBeInTheDocument();
    expect(within(details).getByText('-¥40,380')).toBeInTheDocument();
    expect(within(details).getByText('Prefectural tax credit')).toBeInTheDocument();
    expect(within(details).getByText('-¥26,920')).toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab High Out-of-Pocket Cost Warnings', () => {
  it('does not display warning when out-of-pocket cost is nominal (<= 2,200 yen)', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.queryByText('High Out-of-Pocket Cost')).not.toBeInTheDocument();
  });

  it('displays Branch 1 warning when FTC wipes out Japanese national income tax to 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      nationalIncomeTax: 0,
      foreignTaxCredit: mockForeignTaxCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 50_000,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('High Out-of-Pocket Cost')).toBeInTheDocument();
    const warningTooltip = screen.getByLabelText('High out-of-pocket cost warning');
    expect(warningTooltip).toBeInTheDocument();
    expect(within(warningTooltip).getByTestId('WarningIcon')).toHaveClass(
      'MuiSvgIcon-colorWarning',
    );
    expect(
      screen.getByText(
        /because the Foreign Tax Credit already reduces Japanese national income tax to ¥0/,
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('High Out-of-Pocket Cost')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Applying the donation deduction lowers the Japanese income tax base, which reduces the allowable Foreign Tax Credit limit/,
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('High Out-of-Pocket Cost')).toBeInTheDocument();
    expect(
      screen.getByText(
        /because the Home Loan Tax Credit already reduces Japanese national income tax to ¥0, and any spillover into residence tax has reached its statutory cap/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This issue is avoided by using the One-Stop system/),
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('High Out-of-Pocket Cost')).toBeInTheDocument();
    expect(
      screen.getByText(
        /because the Minimum Tax on High Income Taxpayers \(特定の基準所得金額の課税の特例\) sets a statutory tax floor on baseline income/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /any reduction in baseline income tax is offset yen-for-yen by an increase in the minimum tax addition/,
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('High Out-of-Pocket Cost')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This happens when filing a tax return if taxable income changes income tax brackets after applying the Furusato Nozei donation deduction/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This issue is avoided by using the One-Stop system/),
    ).toBeInTheDocument();
  });

  it('displays temporary-income cause when temporary income effect alone raises out-of-pocket cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 50_000_000,
      nationalIncomeTax: 15_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_101_000,
        incomeTaxReduction: 964_300,
        residenceTaxReduction: 1_134_600,
        temporaryIncomeEffect: {
          nationalIncomeTax: 40_400,
          residenceTax: 8_800,
          total: 49_200,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('≈ ¥51,300')).toBeInTheDocument();
    expect(screen.getByText('≈ -¥51,300')).toBeInTheDocument();
    // ¥556,765 goods - ¥51,300 out-of-pocket = ¥505,465
    expect(screen.getByText('≈ ¥505,465')).toBeInTheDocument();

    expect(screen.getByLabelText('High out-of-pocket cost warning')).toBeInTheDocument();
    expect(screen.getByText(/taxable temporary income \(一時所得\)/)).toBeInTheDocument();
    expect(screen.getByText(/adding ≈ ¥49,200 in income and residence tax/)).toBeInTheDocument();
    expect(screen.getByText(/¥2,100 base donation cost/)).toBeInTheDocument();
    expect(screen.getByText(/One-Stop system.*cannot be used/s)).toBeInTheDocument();
    expect(screen.queryByText(/income tax brackets/)).not.toBeInTheDocument();
  });

  it('explains both bracket shift and temporary income effect and suppresses One-Stop advice when both apply', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 44_000_000,
      nationalIncomeTax: 12_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 1_830_000,
        incomeTaxReduction: 760_600,
        residenceTaxReduction: 988_200,
        temporaryIncomeEffect: {
          nationalIncomeTax: 18_400,
          residenceTax: 4_000,
          total: 22_400,
        },
        oneStop: {
          eligible: false,
          ineligibleReasons: ['taxableTemporaryIncome', 'employmentIncomeOverThreshold'],
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    // ¥81,200 donation cost + ¥22,400 temporary income effect = ¥103,600
    expect(screen.getByText('≈ ¥103,600')).toBeInTheDocument();
    expect(screen.getByText('≈ -¥103,600')).toBeInTheDocument();
    const warningTooltip = screen.getByLabelText('High out-of-pocket cost warning');
    expect(within(warningTooltip).getByText(/changes income tax brackets/)).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/One-Stop system.*cannot be used/s),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/taxable temporary income from Furusato Nozei return gifts/),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/gross employment income exceeding ¥20,000,000/),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(
        /¥81,200 base donation cost \+ ≈ ¥22,400 gift temporary income effect/,
      ),
    ).toBeInTheDocument();
    expect(within(warningTooltip).getByText(/= ≈ ¥103,600 total/)).toBeInTheDocument();
    expect(
      within(warningTooltip).queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('suppresses One-Stop advice in Branch 4 when salary exceeds ¥20,000,000 without taxable temporary income', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 23_000_000,
      nationalIncomeTax: 4_500_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 771_000,
        incomeTaxReduction: 310_000,
        residenceTaxReduction: 458_400,
        oneStop: {
          eligible: false,
          ineligibleReasons: ['employmentIncomeOverThreshold'],
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const warningTooltip = screen.getByLabelText('High out-of-pocket cost warning');
    expect(
      within(warningTooltip).getByText(/One-Stop system.*cannot be used/s),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/gross employment income exceeding ¥20,000,000/),
    ).toBeInTheDocument();
    expect(within(warningTooltip).queryByText(/adds ≈/)).not.toBeInTheDocument();
    expect(
      within(warningTooltip).queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('suppresses One-Stop advice in Branch 3 when Home Loan Tax Credit applies alongside a return-filing trigger', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 25_000_000,
      nationalIncomeTax: 0,
      homeLoanTaxCredit: mockHomeLoanCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 852_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 750_000,
        oneStop: {
          eligible: false,
          ineligibleReasons: ['employmentIncomeOverThreshold'],
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const warningTooltip = screen.getByLabelText('High out-of-pocket cost warning');
    expect(
      within(warningTooltip).getByText(/Home Loan Tax Credit already reduces/),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/One-Stop system.*cannot be used/s),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).getByText(/gross employment income exceeding ¥20,000,000/),
    ).toBeInTheDocument();
    expect(
      within(warningTooltip).queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('renders fallback placeholder when limit is 0', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({ limit: 0 }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('No Furusato Nozei Data Available')).toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab Effective Return Analysis', () => {
  it('explains Value of Gifts Received in a tooltip without asterisks or bottom footnote', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('Value of Gifts Received')).toBeInTheDocument();
    expect(screen.getAllByText('≈ ¥15,900')).toHaveLength(2);
    // ¥15,900 - ¥2,000 = ¥13,900
    expect(screen.getByText('≈ ¥13,900')).toBeInTheDocument();
    expect(screen.getByText(/26\.5% of the donation amount/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MIC Furusato Nozei status survey' })).toHaveAttribute(
      'href',
      'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac03',
    );
    expect(screen.queryByText(/^\* Estimated/)).not.toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab Gift Temporary Income Effect Disclosure', () => {
  it('renders non-collapsible ¥0 row below ¥500,000 and shows gift derivation inside tooltip', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('Gift Temporary Income Effect')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Gift Temporary Income Effect/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('¥0')).toHaveLength(2);
    expect(screen.queryByLabelText('Taxable temporary income warning')).not.toBeInTheDocument();
    expect(screen.queryByText('Income tax & surtax')).not.toBeInTheDocument();

    const tooltip = screen.getByTitle('Temporary Income from Furusato Nozei');
    expect(within(tooltip).getByText('Estimated Temporary Income')).toBeInTheDocument();
    expect(within(tooltip).getByText('Value of gifts received (26.5%):')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥15,900')).toBeInTheDocument();
    expect(within(tooltip).getByText('Estimated shipping (5.7%):')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥3,420')).toBeInTheDocument();
    expect(within(tooltip).getByText('Estimated economic benefit:')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥19,320')).toBeInTheDocument();
    expect(within(tooltip).getByText('Annual special deduction (特別控除):')).toBeInTheDocument();
    expect(within(tooltip).getByText('-¥500,000')).toBeInTheDocument();
    expect(within(tooltip).getByText('Net temporary income:')).toBeInTheDocument();
    expect(within(tooltip).getByText('¥0')).toBeInTheDocument();
    expect(within(tooltip).queryByText('Taxable temporary income (½):')).not.toBeInTheDocument();
  });

  it('renders plain non-collapsible ¥0 row when taxable temporary income produces zero cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 1_553_000,
        incomeTaxReduction: 633_000,
        residenceTaxReduction: 918_000,
        temporaryIncomeEffect: { nationalIncomeTax: 0, residenceTax: 0, total: 0 },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('Gift Temporary Income Effect')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Gift Temporary Income Effect/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.queryByText('≈ ¥0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Taxable temporary income warning')).not.toBeInTheDocument();
  });

  it('starts collapsed above ¥500,000, expands only to tax breakdown, and keeps gift derivation in tooltip', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_200_000,
        incomeTaxReduction: 1_009_900,
        residenceTaxReduction: 1_188_100,
        temporaryIncomeEffect: {
          nationalIncomeTax: 47_800,
          residenceTax: 10_400,
          total: 58_200,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const toggleButton = screen.getByRole('button', {
      name: /Gift Temporary Income Effect/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Income tax & surtax')).not.toBeInTheDocument();
    expect(screen.queryByText('Social insurance')).not.toBeInTheDocument();

    // Tooltip trigger uses the amber warning icon directly (no separate info icon beside it)
    expect(screen.getByLabelText('Taxable temporary income warning')).toBeInTheDocument();
    expect(
      within(toggleButton.parentElement!).queryByTestId('HelpOutlineIcon'),
    ).not.toBeInTheDocument();

    // Cost Breakdown includes ¥58,200 temp effect -> ¥60,200 Out-of-Pocket Cost; Net = ¥583,000 - ¥60,200 = ¥522,800
    expect(screen.getByText('≈ ¥58,200')).toBeInTheDocument();
    expect(screen.getByText('≈ ¥60,200')).toBeInTheDocument();
    expect(screen.getByText('≈ -¥60,200')).toBeInTheDocument();
    expect(screen.getByText('≈ ¥522,800')).toBeInTheDocument();

    // Clicking expands strictly to additive components
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    const details = document.getElementById(toggleButton.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Income tax & surtax')).toBeInTheDocument();
    expect(within(details).getByText('¥47,800')).toBeInTheDocument();
    expect(within(details).getByText('Residence tax')).toBeInTheDocument();
    expect(within(details).getByText('¥10,400')).toBeInTheDocument();
    expect(within(details).queryByText('Social insurance')).not.toBeInTheDocument();
    expect(within(details).queryByText(/Estimated economic benefit/)).not.toBeInTheDocument();
    expect(within(details).queryByText(/Taxable temporary income/)).not.toBeInTheDocument();

    // Tooltip shows gift derivation table without a duplicate tax breakdown table
    const tooltip = screen.getByTitle('Temporary Income from Furusato Nozei');
    expect(within(tooltip).getByText('Estimated Temporary Income')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥583,000')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥125,400')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥708,400')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥208,400')).toBeInTheDocument();
    expect(within(tooltip).getByText('≈ ¥104,200')).toBeInTheDocument();
    expect(within(tooltip).queryByText('Additional Tax Breakdown')).not.toBeInTheDocument();

    // Official legal and statistical source links are present in the tooltip
    expect(screen.getByRole('link', { name: /令和4年2月7日裁決/ })).toHaveAttribute(
      'href',
      'https://www.kfs.go.jp/service/JP/126/02/index.html',
    );
    expect(screen.getByRole('link', { name: /横浜地裁 令和6年2月14日判決/ })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/13940.pdf',
    );
    expect(screen.getByRole('link', { name: /東京高裁 令和6年12月11日判決/ })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/14061.pdf',
    );
    expect(
      screen.getAllByRole('link', { name: /令和8年度調査結果/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows Social insurance row and mentions social insurance in warning when socialInsurance is non-zero', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 150_000,
        incomeTaxReduction: 20_000,
        residenceTaxReduction: 128_000,
        temporaryIncomeEffect: {
          nationalIncomeTax: -2_800,
          residenceTax: -1_300,
          socialInsurance: 17_900,
          total: 13_800,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const toggleButton = screen.getByRole('button', {
      name: /Gift Temporary Income Effect/,
    });
    fireEvent.click(toggleButton);

    const details = document.getElementById(toggleButton.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Income tax & surtax')).toBeInTheDocument();
    expect(within(details).getByText('-¥2,800')).toBeInTheDocument();
    expect(within(details).getByText('Residence tax')).toBeInTheDocument();
    expect(within(details).getByText('-¥1,300')).toBeInTheDocument();
    expect(within(details).getByText('Social insurance')).toBeInTheDocument();
    expect(within(details).getByText('¥17,900')).toBeInTheDocument();
    expect(
      screen.getByText(/adding ≈ ¥13,800 in additional tax and social insurance/),
    ).toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab One-Stop vs Tax Return Comparison', () => {
  const makeEligibleBracketShiftResults = (): TakeHomeResults =>
    makeTakeHomeResults({
      residenceTax: makeResidenceTaxDetails({
        cityProportion: percentTo(1)(60),
        prefecturalProportion: percentTo(1)(40),
      }),
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 98_000,
        incomeTaxReduction: 9_800,
        residenceTaxDonationBasicDeduction: 9_600,
        residenceTaxSpecialDeduction: 66_800,
        residenceTaxReduction: 76_400,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 19_605,
          municipalTaxCredit: 57_602,
          prefecturalTaxCredit: 38_401,
          residenceTaxReduction: 96_000,
        },
      }),
    });

  it('renders aligned desktop two-column table with One-Stop and Tax Return breakdowns and collapsible details', () => {
    render(<FurusatoNozeiTab results={makeEligibleBracketShiftResults()} />);

    expect(screen.getByRole('columnheader', { name: /One-Stop/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tax Return/ })).toBeInTheDocument();

    const outOfPocketRows = screen.getAllByRole('rowheader', { name: 'Out-of-Pocket Cost' });
    expect(outOfPocketRows).toHaveLength(2);
    const costBreakdownOutOfPocketRow = outOfPocketRows[0]!.closest('tr')!;
    expect(within(costBreakdownOutOfPocketRow).getByText('¥2,000')).toBeInTheDocument();
    expect(within(costBreakdownOutOfPocketRow).getByText('¥11,800')).toBeInTheDocument();
    const effectiveReturnOutOfPocketRow = outOfPocketRows[1]!.closest('tr')!;
    expect(within(effectiveReturnOutOfPocketRow).getByText('-¥2,000')).toBeInTheDocument();
    expect(within(effectiveReturnOutOfPocketRow).getByText('-¥11,800')).toBeInTheDocument();

    const netBenefitRow = screen
      .getByRole('rowheader', { name: 'Net Estimated Benefit' })
      .closest('tr')!;
    // Gifts = round(98,000 * 0.265) = 25,970 -> One-Stop net = 23,970; Tax Return net = 14,170
    expect(within(netBenefitRow).getByText('≈ ¥23,970')).toBeInTheDocument();
    expect(within(netBenefitRow).getByText('≈ ¥14,170')).toBeInTheDocument();

    expect(
      screen.getByText(/Declaration Special Credit \(申告特例控除 — One-Stop only\):/),
    ).toBeInTheDocument();

    const residenceToggle = screen.getByRole('button', { name: /Residence Tax Reduction/ });
    expect(residenceToggle).not.toHaveAttribute('aria-controls');
    fireEvent.click(residenceToggle);
    expect(residenceToggle).toHaveAttribute('aria-controls');
    const details = document.getElementById(residenceToggle.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('-¥57,602')).toBeInTheDocument();
    expect(within(details).getByText('-¥45,840')).toBeInTheDocument();
  });

  it('switches active column via compact Filing Method toggle with out-of-pocket previews', () => {
    render(<FurusatoNozeiTab results={makeEligibleBracketShiftResults()} />);

    const oneStopBtn = screen.getByRole('button', {
      name: /One-Stop.*Cost: ¥2,000/,
      hidden: true,
    });
    const taxReturnBtn = screen.getByRole('button', {
      name: /Tax Return.*Cost: ¥11,800/,
      hidden: true,
    });
    const table = screen.getByRole('columnheader', { name: /One-Stop/ }).closest('table')!;
    expect(oneStopBtn).toHaveAttribute('aria-pressed', 'true');
    expect(taxReturnBtn).toHaveAttribute('aria-pressed', 'false');
    expect(table).toHaveAttribute('data-mobile-method', 'oneStop');

    fireEvent.click(taxReturnBtn);
    expect(taxReturnBtn).toHaveAttribute('aria-pressed', 'true');
    expect(oneStopBtn).toHaveAttribute('aria-pressed', 'false');
    expect(table).toHaveAttribute('data-mobile-method', 'taxReturn');
  });

  it('defaults the compact Filing Method toggle to Tax Return when One-Stop is more expensive', () => {
    const results = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 8_000,
        residenceTaxReduction: 40_000,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 5_000,
          municipalTaxCredit: 27_000,
          prefecturalTaxCredit: 18_000,
          residenceTaxReduction: 40_000,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const oneStopBtn = screen.getByRole('button', {
      name: /One-Stop.*Cost: ¥10,000/,
      hidden: true,
    });
    const taxReturnBtn = screen.getByRole('button', {
      name: /Tax Return.*Cost: ¥2,000/,
      hidden: true,
    });
    expect(taxReturnBtn).toHaveAttribute('aria-pressed', 'true');
    expect(oneStopBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('columnheader', { name: /One-Stop/ }).closest('table')).toHaveAttribute(
      'data-mobile-method',
      'taxReturn',
    );
  });

  it('disables the One-Stop column and toggle option with tooltip triggers when One-Stop is unavailable', () => {
    const results = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 98_000,
        incomeTaxReduction: 9_800,
        residenceTaxDonationBasicDeduction: 9_600,
        residenceTaxSpecialDeduction: 66_800,
        residenceTaxReduction: 76_400,
        oneStop: {
          eligible: false,
          ineligibleReasons: ['medicalExpensesDeduction'],
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const oneStopHeader = screen.getByRole('columnheader', { name: /One-Stop/ });
    expect(oneStopHeader).toBeInTheDocument();
    expect(within(oneStopHeader).getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tax Return/ })).toBeInTheDocument();
    expect(screen.queryByText(/Tax Return required/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Unavailable').length).toBeGreaterThan(0);

    const oneStopBtn = screen.getByRole('button', {
      name: /One-Stop.*Unavailable/,
      hidden: true,
    });
    const taxReturnBtn = screen.getByRole('button', {
      name: /Tax Return.*Cost: ¥11,800/,
      hidden: true,
    });
    expect(oneStopBtn).toBeDisabled();
    expect(taxReturnBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('columnheader', { name: /One-Stop/ }).closest('table')).toHaveAttribute(
      'data-mobile-method',
      'taxReturn',
    );

    const oneStopTooltip = screen.getAllByLabelText('One-Stop Exception system info')[0]!;
    expect(within(oneStopTooltip).getByText(/Detected filing triggers:/)).toBeInTheDocument();
    expect(within(oneStopTooltip).getByText(/medical expenses deduction/)).toBeInTheDocument();
  });

  it('shows One-Stop exhaustion warning when Home Loan spillover also limits One-Stop credit', () => {
    const results = makeTakeHomeResults({
      nationalIncomeTax: 0,
      homeLoanTaxCredit: mockHomeLoanCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 40_000,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 5_000,
          municipalTaxCredit: 27_000,
          prefecturalTaxCredit: 18_000,
          residenceTaxReduction: 40_000,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByLabelText('High One-Stop out-of-pocket cost warning')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Even under the One-Stop system.*leaves insufficient remaining residence tax/s,
      ),
    ).toBeInTheDocument();
  });

  it('does not claim One-Stop avoids high cost in fallback tooltip branch when One-Stop also has high cost', () => {
    const results = makeTakeHomeResults({
      homeLoanTaxCredit: mockHomeLoanCredit,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 2_500,
        residenceTaxReduction: 40_000,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 5_000,
          municipalTaxCredit: 27_000,
          prefecturalTaxCredit: 18_000,
          residenceTaxReduction: 40_000,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const taxReturnTooltip = screen.getByLabelText('High out-of-pocket cost warning');
    expect(within(taxReturnTooltip).getByText(/changes income tax brackets/)).toBeInTheDocument();
    expect(
      within(taxReturnTooltip).getByText(
        /Even under the One-Stop system.*leaves insufficient remaining residence tax/s,
      ),
    ).toBeInTheDocument();
    expect(
      within(taxReturnTooltip).queryByText(/This issue is avoided by using the One-Stop system/),
    ).not.toBeInTheDocument();
  });

  it('renders expanded detail row labels with text.secondary contrast instead of text.disabled', () => {
    render(<FurusatoNozeiTab results={makeEligibleBracketShiftResults()} />);

    const residenceToggle = screen.getByRole('button', { name: /Residence Tax Reduction/ });
    fireEvent.click(residenceToggle);

    const details = document.getElementById(residenceToggle.getAttribute('aria-controls')!)!;
    const municipalLabel = within(details).getByRole('rowheader', { name: 'Municipal tax credit' });
    const prefecturalLabel = within(details).getByRole('rowheader', {
      name: 'Prefectural tax credit',
    });
    const defaultTheme = createTheme();
    expect(getComputedStyle(municipalLabel).color).toBe(defaultTheme.palette.text.secondary);
    expect(getComputedStyle(prefecturalLabel).color).toBe(defaultTheme.palette.text.secondary);
  });
});
