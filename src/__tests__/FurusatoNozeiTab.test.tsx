// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import { FURUSATO_SOURCES } from '../data/furusatoNozei';
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
    expect(screen.getByLabelText('High out-of-pocket cost warning')).toBeInTheDocument();
    expect(screen.getByTestId('WarningIcon')).toHaveClass('MuiSvgIcon-colorWarning');
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
      screen.getByText(/If eligible.*this issue is avoided by using the One-Stop system/s),
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

  it('displays temporary-income cause when temporary income tax alone raises out-of-pocket cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 50_000_000,
      nationalIncomeTax: 15_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_101_000,
        incomeTaxReduction: 964_300,
        residenceTaxReduction: 1_134_600,
        temporaryIncomeTax: {
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
    expect(
      screen.getByText(
        /because the return gifts are estimated to create taxable temporary income \(一時所得\) exceeding the ¥500,000 annual special deduction, adding ≈ ¥49,200 in income and residence tax \(on top of the ¥2,100 base donation cost\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/One-Stop system.*cannot be used/s)).toBeInTheDocument();
    expect(
      screen.queryByText(/taxable income changes income tax brackets/),
    ).not.toBeInTheDocument();
  });

  it('explains both bracket shift and temporary income tax and suppresses One-Stop advice when both apply', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      grossEmploymentIncome: 44_000_000,
      nationalIncomeTax: 12_000_000,
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 1_830_000,
        incomeTaxReduction: 760_600,
        residenceTaxReduction: 988_200,
        temporaryIncomeTax: {
          nationalIncomeTax: 18_400,
          residenceTax: 4_000,
          total: 22_400,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    // ¥81,200 donation cost + ¥22,400 temporary income tax = ¥103,600
    expect(screen.getByText('≈ ¥103,600')).toBeInTheDocument();
    expect(screen.getByText('≈ -¥103,600')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This happens when filing a tax return if taxable income changes income tax brackets after applying the Furusato Nozei donation deduction/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The One-Stop system \(ワンストップ特例制度\) cannot be used to avoid this here because filing a tax return is required \(taxable temporary income from Furusato Nozei return gifts; gross employment income exceeding ¥20,000,000\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /In addition, estimated taxable temporary income from the return gifts adds ≈ ¥22,400 in income and residence tax \(¥81,200 donation cost before temporary income tax \+ ≈ ¥22,400 temporary income tax = ≈ ¥103,600 total\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/This issue is avoided by using the One-Stop system/),
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(
      screen.getByText(
        /The One-Stop system \(ワンストップ特例制度\) cannot be used to avoid this here because filing a tax return is required \(gross employment income exceeding ¥20,000,000\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/estimated taxable temporary income from the return gifts adds/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/This issue is avoided by using the One-Stop system/),
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
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(
      screen.getByText(
        /because the Home Loan Tax Credit already reduces Japanese national income tax to ¥0, and any spillover into residence tax has reached its statutory cap/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The One-Stop system \(ワンストップ特例制度\) cannot be used to avoid this here because filing a tax return is required \(gross employment income exceeding ¥20,000,000\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/If eligible.*this issue is avoided by using the One-Stop system/s),
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
  it('explains Value of Goods Received in a tooltip without asterisks or bottom footnote', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(screen.getByText('Value of Goods Received')).toBeInTheDocument();
    expect(screen.getByText('≈ ¥15,900')).toBeInTheDocument();
    // ¥15,900 - ¥2,000 = ¥13,900
    expect(screen.getByText('≈ ¥13,900')).toBeInTheDocument();
    expect(
      screen.getByText(/Estimated at 26\.5% of the donation amount based on the MIC FY2025/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MIC Furusato Nozei status survey' })).toHaveAttribute(
      'href',
      FURUSATO_SOURCES.micArchive,
    );
    expect(screen.queryByText(/^\* Estimated/)).not.toBeInTheDocument();
  });
});

describe('FurusatoNozeiTab Tax on Temporary Income Disclosure', () => {
  it('renders collapsed at ¥0 below ¥500,000 and expands to show goods, shipping, and remaining allowance', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const toggleButton = screen.getByRole('button', {
      name: /Tax on Temporary Income/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/est\. benefit/)).not.toBeInTheDocument();
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.queryByText('Estimated shipping (5.7%)')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    const details = document.getElementById(toggleButton.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Goods received (26.5%)')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥15,900')).toBeInTheDocument();
    expect(within(details).getByText('Estimated shipping (5.7%)')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥3,420')).toBeInTheDocument();
    expect(within(details).getByText('Estimated economic benefit')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥19,320')).toBeInTheDocument();
    expect(within(details).getByText('Remaining deduction allowance')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥480,680')).toBeInTheDocument();
    expect(within(details).getByText('Taxable temporary income (½)')).toBeInTheDocument();
    expect(within(details).getByText('¥0')).toBeInTheDocument();
  });

  it('starts collapsed above ¥500,000, shows warning tooltip icon without double icon, and includes tax in Out-of-Pocket Cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_200_000,
        incomeTaxReduction: 1_009_900,
        residenceTaxReduction: 1_188_100,
        temporaryIncomeTax: {
          nationalIncomeTax: 47_800,
          residenceTax: 10_400,
          total: 58_200,
        },
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    const toggleButton = screen.getByRole('button', {
      name: /Tax on Temporary Income/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/est\. benefit/)).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated shipping (5.7%)')).not.toBeInTheDocument();

    // Tooltip trigger uses the amber warning icon directly (no separate info icon beside it)
    expect(screen.getByLabelText('Taxable temporary income warning')).toBeInTheDocument();
    expect(
      within(toggleButton.parentElement!).queryByTestId('HelpOutlineIcon'),
    ).not.toBeInTheDocument();

    // Cost Breakdown includes ¥58,200 temp tax -> ¥60,200 Out-of-Pocket Cost; Net = ¥583,000 - ¥60,200 = ¥522,800
    expect(screen.getByText('≈ ¥58,200')).toBeInTheDocument();
    expect(screen.getByText('≈ ¥60,200')).toBeInTheDocument();
    expect(screen.getByText('≈ -¥60,200')).toBeInTheDocument();
    expect(screen.getByText('≈ ¥522,800')).toBeInTheDocument();

    // Clicking expands the breakdown
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    const details = document.getElementById(toggleButton.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('≈ ¥583,000')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥125,400')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥708,400')).toBeInTheDocument();
    expect(within(details).getByText('-¥500,000')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥208,400')).toBeInTheDocument();
    expect(within(details).getByText('≈ ¥104,200')).toBeInTheDocument();
    expect(within(details).getByText('Income tax & surtax')).toBeInTheDocument();
    expect(within(details).getByText('¥47,800')).toBeInTheDocument();
    expect(within(details).getByText('Residence tax')).toBeInTheDocument();
    expect(within(details).getByText('¥10,400')).toBeInTheDocument();

    // Official legal and statistical source links are present in the tooltip
    expect(screen.getByRole('link', { name: /令和4年2月7日裁決/ })).toHaveAttribute(
      'href',
      FURUSATO_SOURCES.kfsDecision2022,
    );
    expect(screen.getByRole('link', { name: /横浜地裁 令和6年2月14日判決/ })).toHaveAttribute(
      'href',
      FURUSATO_SOURCES.yokohamaDistrictCourt2024Pdf,
    );
    expect(screen.getByRole('link', { name: /東京高裁 令和6年12月11日判決/ })).toHaveAttribute(
      'href',
      FURUSATO_SOURCES.tokyoHighCourt2024Pdf,
    );
    expect(
      screen.getAllByRole('link', { name: /令和8年度調査結果/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
