// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import NetEmploymentIncomeTooltip from '../components/TakeHomeCalculator/tabs/NetEmploymentIncomeTooltip';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the breakdown is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
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
      />,
    );

    expect(screen.getByText(formatJPY(10_000_000))).toBeInTheDocument(); // Gross
    expect(screen.getByText(`-${formatJPY(1_950_000)}`)).toBeInTheDocument(); // 給与所得控除 = gross − net − adjustment
    expect(screen.getByText(formatJPY(8_050_000))).toBeInTheDocument(); // Net
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
      />,
    );

    expect(screen.getByText(`-${formatJPY(1_950_000)}`)).toBeInTheDocument(); // 給与所得控除
    expect(screen.getByText('Income Adjustment Deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(150_000)}`)).toBeInTheDocument(); // 所得金額調整控除
    expect(screen.getByText(formatJPY(7_900_000))).toBeInTheDocument(); // Net
  });

  it('shows the 双方 adjustment as its own row and note without the 子ども等 note', () => {
    // 所法28③二: gross 3,000,000 → 給与所得控除 = 30% × 3,000,000 + 80,000 = 980,000.
    // 措法41の3の11①: the 双方 adjustment is min(給与所得, 100,000) + min(年金雑所得, 100,000)
    // − 100,000, here the full 100,000, so net = 3,000,000 − 980,000 − 100,000 = 1,920,000.
    render(
      <NetEmploymentIncomeTooltip
        grossEmploymentIncome={3_000_000}
        netEmploymentIncome={1_920_000}
        pensionIncomeAdjustmentDeduction={100_000}
        year={2026}
      />,
    );

    expect(screen.getByText(`-${formatJPY(980_000)}`)).toBeInTheDocument(); // 給与所得控除
    expect(screen.getByText('Income Adjustment Deduction (Pension):')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(100_000)}`)).toBeInTheDocument(); // 双方の調整控除
    expect(screen.getByText(formatJPY(1_920_000))).toBeInTheDocument(); // Net
    // The 子ども・特別障害者等 row and its note belong to the other adjustment.
    expect(screen.queryByText('Income Adjustment Deduction:')).not.toBeInTheDocument();
    expect(
      screen.getByText('Income Amount Adjustment Deduction (所得金額調整控除)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/exceeding ¥8,500,000/)).not.toBeInTheDocument();
  });

  it('backs both income adjustments out of the employment income deduction', () => {
    // 所法28③五: gross 10,000,000 is above the 8,500,000 cap → 給与所得控除 = 1,950,000 (max).
    // 措法41の3の11①二 caps the 子ども等 adjustment at 150,000, and ①一 adds 100,000 for the
    // 双方 case, so net = 10,000,000 − 1,950,000 − 150,000 − 100,000 = 7,800,000.
    render(
      <NetEmploymentIncomeTooltip
        grossEmploymentIncome={10_000_000}
        netEmploymentIncome={7_800_000}
        incomeAdjustmentDeduction={150_000}
        pensionIncomeAdjustmentDeduction={100_000}
        year={2026}
      />,
    );

    expect(screen.getByText(`-${formatJPY(1_950_000)}`)).toBeInTheDocument(); // 給与所得控除
    expect(screen.getByText('Income Adjustment Deduction:')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(150_000)}`)).toBeInTheDocument();
    expect(screen.getByText('Income Adjustment Deduction (Pension):')).toBeInTheDocument();
    expect(screen.getByText(`-${formatJPY(100_000)}`)).toBeInTheDocument();
    expect(screen.getByText(formatJPY(7_800_000))).toBeInTheDocument(); // Net
  });

  it('highlights the deduction-table row that applies to the gross income', () => {
    // gross 10M (2026) → above the 8,500,000 tier, so the "8,500,001 and above" cap row is current.
    render(
      <NetEmploymentIncomeTooltip
        grossEmploymentIncome={10_000_000}
        netEmploymentIncome={8_050_000}
        year={2026}
      />,
    );

    const marked = Array.from(document.querySelectorAll('tbody tr')).filter(
      tr => tr.getAttribute('aria-current') === 'true',
    );
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('8,500,001 and above');
  });
});
