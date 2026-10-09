// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import IncomeBasedPortionTooltip from '../components/TakeHomeCalculator/tabs/IncomeBasedPortionTooltip';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the content is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

describe('IncomeBasedPortionTooltip', () => {
  it('renders a single aggregate-rate row when no separate income applies', () => {
    render(
      <IncomeBasedPortionTooltip
        level="municipal"
        aggregateRatePercent={6}
        aggregateAmount={60000}
        separateRatePercent={3}
      />,
    );

    expect(screen.getByText(/6% of taxable income\./)).toBeInTheDocument();
    expect(screen.getByText(formatJPY(60000))).toBeInTheDocument();
  });

  it('breaks down the aggregate and separate amounts with a total when both apply', () => {
    render(
      <IncomeBasedPortionTooltip
        level="prefectural"
        aggregateRatePercent={4}
        aggregateAmount={40000}
        separateRatePercent={2}
        separateAmount={2000}
      />,
    );

    expect(
      screen.getByText(/4% of taxable income, plus 2% of taxable investment income/),
    ).toBeInTheDocument();
    expect(screen.getByText(formatJPY(40000))).toBeInTheDocument();
    expect(screen.getByText(formatJPY(2000))).toBeInTheDocument();
    expect(screen.getByText(formatJPY(42000))).toBeInTheDocument();
  });
});
