// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import NegativeTakeHomeTooltip from '../components/TakeHomeCalculator/tabs/NegativeTakeHomeTooltip';
import {
  DEFAULT_PROVIDER,
  DEPENDENT_COVERAGE_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import type { TakeHomeResults } from '../types/tax';
import { makeTakeHomeResults } from './fixtures/takeHomeResults';

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

describe('NegativeTakeHomeTooltip', () => {
  it('renders nothing when take-home pay is zero or positive', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      takeHomeIncome: 0,
      healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
    });
    const { container } = render(<NegativeTakeHomeTooltip results={results} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains manual social insurance override when take-home is negative', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      takeHomeIncome: -50_000,
      socialInsuranceOverride: 50_000,
    });
    render(<NegativeTakeHomeTooltip results={results} />);

    expect(screen.getByTestId('detailed-tooltip')).toHaveAttribute(
      'data-icon-label',
      'Negative take-home pay explanation',
    );
    expect(
      screen.getByText(/manually entered social insurance amount exceeds income after taxes/),
    ).toBeInTheDocument();
  });

  it('explains fixed NHI per-capita and National Pension charges when exemption is not applied', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      takeHomeIncome: -233_664,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      nhiReductionRatios: { prevFY: 0.7, currFY: 0.7 },
      nationalPensionExemption: {
        requested: false,
        eligible: true,
        applied: false,
        incomeThreshold: 670_000,
      },
    });
    render(<NegativeTakeHomeTooltip results={results} />);

    expect(screen.getByText(/per-person amounts \(均等割\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/statutory low-income reduction \(均等割額の軽減\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/National Pension contribution/)).toBeInTheDocument();
    expect(
      screen.getByText(/within the full exemption \(全額免除\) threshold/),
    ).toBeInTheDocument();
  });

  it('omits the statutory reduction note when no NHI reduction was applied', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      takeHomeIncome: -100_000,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      nhiReductionRatios: { prevFY: 0, currFY: 0 },
    });
    render(<NegativeTakeHomeTooltip results={results} />);

    expect(screen.getByText(/per-person amounts \(均等割\)/)).toBeInTheDocument();
    expect(
      screen.queryByText(/statutory low-income reduction \(均等割額の軽減\)/),
    ).not.toBeInTheDocument();
  });

  it('omits the pension note when the National Pension full exemption is applied', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      takeHomeIncome: -19_854,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      nationalPensionExemption: {
        requested: true,
        eligible: true,
        applied: true,
        incomeThreshold: 670_000,
      },
    });
    render(<NegativeTakeHomeTooltip results={results} />);

    expect(screen.getByText(/per-person amounts \(均等割\)/)).toBeInTheDocument();
    expect(screen.queryByText(/National Pension contribution/)).not.toBeInTheDocument();
  });

  it('explains minimum SMR grade and short-time enrollment criteria for low-salary employee coverage', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      salaryIncome: 50_000 * 12,
      commutingAllowance: 0,
      takeHomeIncome: -10_000,
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });
    render(<NegativeTakeHomeTooltip results={results} />);

    expect(screen.getByText(/standard monthly remuneration \(標準報酬月額\)/)).toBeInTheDocument();
    expect(screen.getByText(/short-time worker has statutory criteria/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /短時間労働者に対する健康保険・厚生年金保険の適用の拡大/,
      }),
    ).toHaveAttribute(
      'href',
      'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',
    );
  });
});
