// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import NetBusinessAndMiscIncomeTooltip from '../components/TakeHomeCalculator/tabs/NetBusinessAndMiscIncomeTooltip';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the breakdown is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

describe('NetBusinessAndMiscIncomeTooltip', () => {
  it('breaks down business loss and miscellaneous income separately', () => {
    // Repro: -100k business loss + 50k misc income -> -50k net
    render(
      <NetBusinessAndMiscIncomeTooltip
        businessIncome={-100_000}
        miscIncome={50_000}
        blueFilerDeduction={0}
        netBusinessAndMiscIncome={-50_000}
      />,
    );

    expect(screen.getByText('Business Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(-100_000))).toBeInTheDocument();

    expect(screen.getByText('Miscellaneous Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(50_000))).toBeInTheDocument();

    expect(screen.getByText('Net Business/Misc Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(-50_000))).toBeInTheDocument();

    // Shows loss netting section because net is negative
    expect(screen.getByText('Loss Netting (損益通算)')).toBeInTheDocument();
  });

  it('shows business income, blue-filer deduction, and miscellaneous income when all present', () => {
    render(
      <NetBusinessAndMiscIncomeTooltip
        businessIncome={2_000_000}
        blueFilerDeduction={650_000}
        miscIncome={300_000}
        netBusinessAndMiscIncome={1_650_000}
      />,
    );

    expect(screen.getByText('Business Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(2_000_000))).toBeInTheDocument();

    expect(screen.getByText('Blue-Filer Deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(650_000)}`)).toBeInTheDocument();

    expect(screen.getByText('Miscellaneous Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(300_000))).toBeInTheDocument();

    expect(screen.getByText('Net Business/Misc Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(1_650_000))).toBeInTheDocument();

    expect(screen.getByText('Blue-Filer Special Deduction')).toBeInTheDocument();
    expect(screen.queryByText('Loss Netting (損益通算)')).not.toBeInTheDocument();
  });

  it('shows loss netting section when business has a loss even if misc income absorbs it', () => {
    // -100k business loss + 150k misc income -> +50k net
    render(
      <NetBusinessAndMiscIncomeTooltip
        businessIncome={-100_000}
        miscIncome={150_000}
        blueFilerDeduction={0}
        netBusinessAndMiscIncome={50_000}
      />,
    );

    expect(screen.getByText('Business Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(-100_000))).toBeInTheDocument();

    expect(screen.getByText('Miscellaneous Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(150_000))).toBeInTheDocument();

    expect(screen.getByText('Net Business/Misc Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(50_000))).toBeInTheDocument();

    // Business income was negative, so loss netting occurred
    expect(screen.getByText('Loss Netting (損益通算)')).toBeInTheDocument();
  });

  it('shows business income and blue-filer deduction without miscellaneous income', () => {
    render(
      <NetBusinessAndMiscIncomeTooltip
        businessIncome={5_000_000}
        blueFilerDeduction={650_000}
        netBusinessAndMiscIncome={4_350_000}
      />,
    );

    expect(screen.getByText('Business Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(5_000_000))).toBeInTheDocument();
    expect(screen.getByText('Blue-Filer Deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(650_000)}`)).toBeInTheDocument();
    expect(screen.queryByText('Miscellaneous Income:')).not.toBeInTheDocument();
    expect(screen.getByText('Net Business/Misc Income:')).toBeInTheDocument();
    expect(screen.getByText(formatJPY(4_350_000))).toBeInTheDocument();
  });
});
