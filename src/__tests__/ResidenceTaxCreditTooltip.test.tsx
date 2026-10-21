// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import ResidenceTaxCreditTooltip from '../components/TakeHomeCalculator/tabs/ResidenceTaxCreditTooltip';
import type { ForeignTaxCreditResult } from '../types/tax';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the content is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

const foreignTaxCredit: ForeignTaxCreditResult = {
  foreignTax: 100000,
  foreignSourceIncome: 500000,
  adjustedForeignSourceIncome: 500000,
  totalIncome: 5000000,
  incomeTax: 400000,
  limit: { incomeTax: 40000, reconstructionSurtax: 840, prefecture: 4000, city: 6000 },
  credit: { incomeTax: 40000, reconstructionSurtax: 840, prefecture: 4000, city: 6000 },
  excess: 49160,
};

describe('ResidenceTaxCreditTooltip', () => {
  it('renders the municipal variant with only the adjustment credit', () => {
    render(
      <ResidenceTaxCreditTooltip
        level="municipal"
        adjustmentCredit={1500}
        personalDeductionDifference={50000}
      />,
    );

    expect(screen.getByText('Adjustment Credit (調整控除)')).toBeInTheDocument();
    expect(
      screen.getByText(`Personal deduction difference: ${formatJPY(50000)}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`Municipal portion (60%): ${formatJPY(1500)}`)).toBeInTheDocument();
    expect(screen.queryByText('Foreign Tax Credit (外国税額控除)')).not.toBeInTheDocument();
    expect(screen.getByText(`Municipal tax credit: ${formatJPY(1500)}`)).toBeInTheDocument();
  });

  it('renders the prefectural variant with only the adjustment credit', () => {
    render(
      <ResidenceTaxCreditTooltip
        level="prefectural"
        adjustmentCredit={1000}
        personalDeductionDifference={50000}
      />,
    );

    expect(screen.getByText(`Prefectural portion (40%): ${formatJPY(1000)}`)).toBeInTheDocument();
    expect(screen.getByText(`Prefectural tax credit: ${formatJPY(1000)}`)).toBeInTheDocument();
  });

  it('folds in the foreign tax credit and totals both components', () => {
    render(
      <ResidenceTaxCreditTooltip
        level="municipal"
        adjustmentCredit={1500}
        personalDeductionDifference={50000}
        foreignTaxCredit={{ credit: foreignTaxCredit, applied: 6000 }}
      />,
    );

    expect(screen.getByText('Adjustment Credit (調整控除)')).toBeInTheDocument();
    expect(screen.getByText('Foreign Tax Credit (外国税額控除)')).toBeInTheDocument();
    expect(screen.getByText(`Municipal tax credit: ${formatJPY(7500)}`)).toBeInTheDocument();
  });

  it('caps the foreign tax credit note when the applied amount is less than the credited amount', () => {
    render(
      <ResidenceTaxCreditTooltip
        level="prefectural"
        adjustmentCredit={0}
        personalDeductionDifference={50000}
        foreignTaxCredit={{ credit: foreignTaxCredit, applied: 2000 }}
      />,
    );

    expect(
      screen.getByText(/prefectural income-based portion.*is less than the credit/),
    ).toBeInTheDocument();
    expect(screen.getByText(`Prefectural tax credit: ${formatJPY(2000)}`)).toBeInTheDocument();
  });
});
