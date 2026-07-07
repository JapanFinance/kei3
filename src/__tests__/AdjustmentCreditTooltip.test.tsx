// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdjustmentCreditTooltip from '../components/TakeHomeCalculator/tabs/AdjustmentCreditTooltip';
import { formatJPY } from '../utils/formatters';

// Render the DetailedTooltip body inline so the content is queryable without hovering.
vi.mock('../components/ui/Tooltips', () => ({
  DetailedTooltip: ({ children }: { title?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleTooltip: () => <div data-testid="info-tooltip" />,
}));

describe('AdjustmentCreditTooltip', () => {
  it('renders the municipal variant with the 60% split and formatted amounts', () => {
    render(
      <AdjustmentCreditTooltip
        level="municipal"
        adjustmentCredit={1500}
        personalDeductionDifference={50000}
      />,
    );

    expect(screen.getByText('Tax Credits Applied to Municipal Portion')).toBeInTheDocument();
    expect(screen.getByText(/reduce the municipal portion of residence tax/)).toBeInTheDocument();
    expect(
      screen.getByText(`Personal deduction difference: ${formatJPY(50000)}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`Municipal portion (60%): ${formatJPY(1500)}`)).toBeInTheDocument();
    expect(screen.getByText(`Total Municipal Tax Credit: ${formatJPY(1500)}`)).toBeInTheDocument();
  });

  it('renders the prefectural variant with the 40% split and formatted amounts', () => {
    render(
      <AdjustmentCreditTooltip
        level="prefectural"
        adjustmentCredit={1000}
        personalDeductionDifference={50000}
      />,
    );

    expect(screen.getByText('Tax Credits Applied to Prefectural Portion')).toBeInTheDocument();
    expect(screen.getByText(/reduce the prefectural portion of residence tax/)).toBeInTheDocument();
    expect(screen.getByText(`Prefectural portion (40%): ${formatJPY(1000)}`)).toBeInTheDocument();
    expect(
      screen.getByText(`Total Prefectural Tax Credit: ${formatJPY(1000)}`),
    ).toBeInTheDocument();
  });
});
