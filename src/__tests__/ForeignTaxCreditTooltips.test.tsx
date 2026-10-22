// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ForeignTaxCreditTooltip,
  ForeignTaxPaidTooltip,
  hasForeignTaxCreditDetails,
  IncomeTaxCreditTooltip,
  ResidenceSideCreditContent,
  SurtaxCreditTooltip,
} from '../components/TakeHomeCalculator/tabs/ForeignTaxCreditTooltips';
import type { ForeignTaxCreditResult } from '../types/tax';
import { formatJPY } from '../utils/formatters';

vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({
    children,
    title,
    iconAriaLabel,
  }: {
    title?: string;
    children?: ReactNode;
    iconAriaLabel?: string;
  }) => (
    <div data-testid="detailed-tooltip" data-title={title} data-icon-label={iconAriaLabel}>
      {children}
    </div>
  ),
}));

const sampleCredit = (overrides: Partial<ForeignTaxCreditResult> = {}): ForeignTaxCreditResult => ({
  foreignTax: 28_000,
  foreignSourceIncome: 280_000,
  adjustedForeignSourceIncome: 280_000,
  totalIncome: 5_606_000,
  incomeTax: 200_800,
  limit: {
    incomeTax: 10_029,
    reconstructionSurtax: 210,
    prefecture: 1_203,
    city: 1_805,
  },
  credit: {
    incomeTax: 10_029,
    reconstructionSurtax: 210,
    prefecture: 1_203,
    city: 1_805,
  },
  excess: 14_753,
  ...overrides,
});

describe('hasForeignTaxCreditDetails', () => {
  it('returns false for undefined or zero foreign tax', () => {
    expect(hasForeignTaxCreditDetails(undefined)).toBe(false);
    expect(hasForeignTaxCreditDetails(sampleCredit({ foreignTax: 0 }))).toBe(false);
  });

  it('returns true when foreignTax is positive', () => {
    expect(hasForeignTaxCreditDetails(sampleCredit({ foreignTax: 100 }))).toBe(true);
  });
});

describe('ForeignTaxCreditTooltip', () => {
  it('renders withheld-only notice when credit is undefined', () => {
    render(<ForeignTaxCreditTooltip withheldForeignTax={50_000} />);
    expect(
      screen.getByText(/All the foreign tax paid, ¥50,000, is on dividends left to withholding\./),
    ).toBeInTheDocument();
  });

  it('renders warning alert and excess amount when foreign tax exceeds limits', () => {
    const credit = sampleCredit({ excess: 14_753 });
    render(<ForeignTaxCreditTooltip credit={credit} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByText(/⚠️ ¥14,753 of foreign tax is not credited this year/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Foreign tax exceeds the allowable Japanese credit limits\./),
    ).toBeInTheDocument();
  });

  it('explains residence-tax income-based portion limitation when foreign tax is within limits but unabsorbed', () => {
    const credit = sampleCredit({
      foreignTax: 10_000,
      excess: 2_000,
    });
    render(<ForeignTaxCreditTooltip credit={credit} />);

    expect(
      screen.getByText(/⚠️ ¥2,000 of foreign tax is not credited this year/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The residence-tax income-based portion \(所得割\) is less than the credit\./,
      ),
    ).toBeInTheDocument();
  });

  it('explains zero foreign-source income when adjustedForeignSourceIncome is 0', () => {
    const credit = sampleCredit({
      adjustedForeignSourceIncome: 0,
      excess: 10_000,
    });
    render(<ForeignTaxCreditTooltip credit={credit} />);

    expect(
      screen.getByText(/No foreign-source income to credit against \(limit is ¥0\)\./),
    ).toBeInTheDocument();
  });

  it('explains zero Japanese income tax when incomeTax is 0', () => {
    const credit = sampleCredit({
      adjustedForeignSourceIncome: 200_000,
      incomeTax: 0,
      excess: 10_000,
    });
    render(<ForeignTaxCreditTooltip credit={credit} />);

    expect(screen.getByText(/Japanese income tax is ¥0 \(limit is ¥0\)\./)).toBeInTheDocument();
  });

  it('does not render alert when excess is 0', () => {
    const credit = sampleCredit({ excess: 0 });
    render(<ForeignTaxCreditTooltip credit={credit} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Foreign tax can be credited against Japanese tax, up to limits, to alleviate double taxation/,
      ),
    ).toBeInTheDocument();
  });
});

describe('IncomeTaxCreditTooltip', () => {
  it('renders standard credit breakdown and formula', () => {
    const credit = sampleCredit();
    render(<IncomeTaxCreditTooltip credit={credit} />);

    expect(screen.getByText('Income tax, after the home loan tax credit:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(credit.incomeTax))).toBeInTheDocument();
    expect(screen.getByText('Income tax limit:')).toBeInTheDocument();
    expect(screen.getByText('Credited against income tax:')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(credit.credit.incomeTax)).length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('renders manual foreign tax breakdown when manualForeignTax is present', () => {
    const credit = sampleCredit({
      foreignTax: 50_000,
      manualForeignTax: 20_000,
    });
    render(<IncomeTaxCreditTooltip credit={credit} />);

    expect(screen.getByText('Entered with income entries:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(30_000))).toBeInTheDocument();
    expect(screen.getByText('Paid with a foreign tax return:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(20_000))).toBeInTheDocument();
    expect(screen.getByText('Eligible for the credit:')).toBeInTheDocument();
  });

  it('renders withheld foreign tax note when withheldForeignTax > 0', () => {
    const credit = sampleCredit();
    render(<IncomeTaxCreditTooltip credit={credit} withheldForeignTax={12_000} />);

    expect(
      screen.getByText(
        /The ¥12,000 of foreign tax on dividends left to withholding is not eligible\./,
      ),
    ).toBeInTheDocument();
  });

  it('renders capped foreign-source income table when foreignSourceIncome > adjustedForeignSourceIncome', () => {
    const credit = sampleCredit({
      foreignSourceIncome: 6_000_000,
      adjustedForeignSourceIncome: 5_606_000,
      totalIncome: 5_606_000,
    });
    render(<IncomeTaxCreditTooltip credit={credit} />);

    expect(screen.getByText('Capped foreign-source income:')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(5_606_000)).length).toBeGreaterThan(0);
  });

  it('renders zero credit limit note when incomeTax limit is 0', () => {
    const credit = sampleCredit({
      limit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
      credit: { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 },
    });
    render(<IncomeTaxCreditTooltip credit={credit} />);

    expect(
      screen.getByText(
        /With no income tax or no foreign-source income the limit is ¥0, so nothing is credited\./,
      ),
    ).toBeInTheDocument();
  });
});

describe('SurtaxCreditTooltip', () => {
  it('renders surtax credit breakdown rows', () => {
    const credit = sampleCredit();
    render(<SurtaxCreditTooltip credit={credit} reconstructionSurtax={4_216} />);

    expect(screen.getByText('Reconstruction surtax:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(4_216))).toBeInTheDocument();
    expect(screen.getByText('Surtax limit:')).toBeInTheDocument();
    expect(screen.getByText('Credited against the surtax:')).toBeInTheDocument();
    expect(
      screen.getAllByText(formatJPY(credit.credit.reconstructionSurtax)).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('ResidenceSideCreditContent', () => {
  it('renders prefectural credit breakdown', () => {
    const credit = sampleCredit();
    render(<ResidenceSideCreditContent credit={credit} side="prefecture" applied={1_203} />);

    expect(
      screen.getByText(
        /The foreign tax left after income tax and the surtax comes off the prefectural tax first/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Left after income tax and the surtax:')).toBeInTheDocument();
    expect(screen.getByText('Credit, the smaller of the two:')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(1_203)).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/Capped at the prefectural income-based portion/),
    ).not.toBeInTheDocument();
  });

  it('renders municipal credit breakdown', () => {
    const credit = sampleCredit();
    render(<ResidenceSideCreditContent credit={credit} side="city" applied={1_805} />);

    expect(
      screen.getByText(
        /The foreign tax left after the prefectural credit comes off the municipal tax/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Left after the prefectural credit:')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(1_805)).length).toBeGreaterThanOrEqual(1);
  });

  it('renders capped portion note when applied is less than credited', () => {
    const credit = sampleCredit();
    render(<ResidenceSideCreditContent credit={credit} side="prefecture" applied={500} />);

    expect(screen.getByText('Capped at the prefectural income-based portion:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(500))).toBeInTheDocument();
    expect(
      screen.getByText(
        /The prefectural income-based portion \(所得割\) is less than the credit, so only ¥500 comes off it/,
      ),
    ).toBeInTheDocument();
  });
});

describe('ForeignTaxPaidTooltip', () => {
  it('renders foreign tax paid breakdown with manual tax and excess', () => {
    const credit = sampleCredit({
      foreignTax: 50_000,
      manualForeignTax: 20_000,
      excess: 14_753,
    });
    render(
      <ForeignTaxPaidTooltip foreignTaxPaid={65_000} credit={credit} withheldForeignTax={15_000} />,
    );

    expect(screen.getByText('Eligible for the credit:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(50_000))).toBeInTheDocument();
    expect(screen.getByText('Paid with a foreign tax return:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(20_000))).toBeInTheDocument();
    expect(screen.getByText('On dividends left to withholding, not credited:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(15_000))).toBeInTheDocument();
    expect(screen.getByText('Foreign tax paid:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(65_000))).toBeInTheDocument();
    expect(screen.getByText('Not credited this year:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(14_753))).toBeInTheDocument();
  });

  it('explains residence-tax unabsorbed credit when foreign tax is within limits but unabsorbed', () => {
    const credit = sampleCredit({
      foreignTax: 10_000,
      excess: 2_000,
    });
    render(<ForeignTaxPaidTooltip foreignTaxPaid={10_000} credit={credit} />);

    expect(screen.getByText('Not credited this year:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(2_000))).toBeInTheDocument();
    expect(
      screen.getByText(
        /The ¥2,000 unabsorbed by the residence-tax income-based portion \(所得割\) \(控除不足額\) is not credited this year\./,
      ),
    ).toBeInTheDocument();
  });

  it('renders basic notice when credit is undefined', () => {
    render(<ForeignTaxPaidTooltip foreignTaxPaid={10_000} withheldForeignTax={10_000} />);

    expect(screen.getByText('Foreign tax paid:')).toBeInTheDocument();
    expect(screen.getAllByText(formatJPY(10_000)).length).toBe(2);
    expect(screen.queryByText('Eligible for the credit:')).not.toBeInTheDocument();
  });
});
