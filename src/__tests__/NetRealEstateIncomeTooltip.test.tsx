// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import NetRealEstateIncomeTooltip from '../components/TakeHomeCalculator/tabs/NetRealEstateIncomeTooltip';

// Render the DetailedTooltip body inline so the breakdown is queryable directly.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

describe('NetRealEstateIncomeTooltip', () => {
  it('renders breakdown table with blue-filer deduction for positive income', () => {
    render(
      <NetRealEstateIncomeTooltip
        grossRealEstateIncome={2_000_000}
        blueFilerDeduction={650_000}
        netRealEstateIncome={1_350_000}
      />,
    );

    expect(screen.getByText('Calculation Breakdown')).toBeInTheDocument();
    expect(screen.getByText('¥2,000,000')).toBeInTheDocument();
    expect(screen.getByText('-¥650,000')).toBeInTheDocument();
    expect(screen.getByText('¥1,350,000')).toBeInTheDocument();
    expect(screen.getByText(/Blue-Filer Special Deduction/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /青色申告特別控除 - NTA/i })).toHaveAttribute(
      'href',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
    );
  });

  it('renders breakdown table with disallowed land loan interest for negative income', () => {
    render(
      <NetRealEstateIncomeTooltip
        grossRealEstateIncome={-1_000_000}
        blueFilerDeduction={0}
        netRealEstateIncome={-600_000}
        disallowedLandDebtInterest={400_000}
      />,
    );

    expect(screen.getByText('-¥1,000,000')).toBeInTheDocument();
    expect(screen.getByText('+¥400,000')).toBeInTheDocument();
    expect(screen.getByText('-¥600,000')).toBeInTheDocument();
    expect(screen.getByText(/Loss Netting \(損益通算\) & Disallowances/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /不動産所得が赤字のときの通算 - NTA/i }),
    ).toHaveAttribute('href', 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1391.htm');
  });

  it('renders breakdown table with overseas used building disallowance for foreign property', () => {
    render(
      <NetRealEstateIncomeTooltip
        grossRealEstateIncome={-2_000_000}
        blueFilerDeduction={0}
        netRealEstateIncome={-1_000_000}
        disallowedLandDebtInterest={300_000}
        disallowedForeignDepreciationLoss={700_000}
      />,
    );

    expect(screen.getByText('-¥2,000,000')).toBeInTheDocument();
    expect(screen.getByText('+¥300,000')).toBeInTheDocument();
    expect(screen.getByText('+¥700,000')).toBeInTheDocument();
    expect(screen.getByText('-¥1,000,000')).toBeInTheDocument();
  });
});
