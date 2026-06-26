// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NetEmploymentIncomeTooltip from '../components/TakeHomeCalculator/tabs/NetEmploymentIncomeTooltip';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the breakdown is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => <div>{children}</div>,
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

describe('NetEmploymentIncomeTooltip', () => {
  it('derives a non-negative 給与所得控除 from the canonical gross and reconciles to net', () => {
    // Repro shape: salary 6M + foreign RSU 4M → canonical gross 10M, net 8.05M (2026 cap), no adjustment.
    render(
      <NetEmploymentIncomeTooltip
        grossEmploymentIncome={10_000_000}
        netEmploymentIncome={8_050_000}
        year={2026}
      />
    );

    expect(screen.getByText(formatJPY(10_000_000))).toBeInTheDocument();       // Gross
    expect(screen.getByText(`-${formatJPY(1_950_000)}`)).toBeInTheDocument();  // 給与所得控除 = gross − net − adjustment
    expect(screen.getByText(formatJPY(8_050_000))).toBeInTheDocument();        // Net
    expect(screen.queryByText('Income Adjustment Deduction:')).not.toBeInTheDocument();
  });

  it('backs the 所得金額調整控除 out of the employment income deduction so the rows reconcile', () => {
    // gross 10M, net 7.9M, adjustment 150k → 給与所得控除 = 10M − 7.9M − 150k = 1.95M
    render(
      <NetEmploymentIncomeTooltip
        grossEmploymentIncome={10_000_000}
        netEmploymentIncome={7_900_000}
        incomeAdjustmentDeduction={150_000}
        year={2026}
      />
    );

    expect(screen.getByText(`-${formatJPY(1_950_000)}`)).toBeInTheDocument();  // 給与所得控除
    expect(screen.getByText('Income Adjustment Deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(150_000)}`)).toBeInTheDocument();    // 所得金額調整控除
    expect(screen.getByText(formatJPY(7_900_000))).toBeInTheDocument();        // Net
  });
});
