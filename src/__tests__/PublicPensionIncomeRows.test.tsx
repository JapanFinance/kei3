// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import TaxesTab from '../components/TakeHomeCalculator/tabs/TaxesTab';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type { IncomeStream, TakeHomeInputs, TakeHomeResults } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { makeTakeHomeResults } from './fixtures/takeHomeResults';

vi.mock('../components/ui/Tooltips', async () => {
  const { createPortal } = await import('react-dom');
  return {
    DetailedTooltip: ({ title, children }: { title: string; children?: React.ReactNode }) => (
      <>
        <span data-testid="detail-info-tooltip-trigger" title={title}>
          ℹ️
        </span>
        {createPortal(
          <div data-testid="detail-info-tooltip-content" data-title={title}>
            {children}
          </div>,
          document.body,
        )}
      </>
    ),
    SimpleTooltip: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="info-tooltip">{children}</div>
    ),
  };
});

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const pensionStream: IncomeStream = { id: 'p1', type: 'publicPension', amount: 2_400_000 };

const makeInputs = (incomeStreams: IncomeStream[]): TakeHomeInputs => ({
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams,
  ageRange: 'age65to69',
  region: 'Tokyo',
  healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
});

// Gross 2,400,000 at 65+ → 公的年金等控除 1,100,000 → 雑所得 1,300,000.
const pensionResults = (overrides: Partial<TakeHomeResults> = {}): TakeHomeResults =>
  makeTakeHomeResults({
    annualIncome: 2_400_000,
    ageRange: 'age65to69',
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    grossPublicPensionIncome: 2_400_000,
    netPublicPensionIncome: 1_300_000,
    totalNetIncome: 1_300_000,
    ...overrides,
  });

const tabs = [
  ['TaxesTab', TaxesTab],
  ['SocialInsuranceTab', SocialInsuranceTab],
] as const;

describe.each(tabs)('%s public pension income rows', (_name, Tab) => {
  it('shows the net pension row with its deduction and no subtotal for pension-only income', () => {
    render(<Tab results={pensionResults()} inputs={makeInputs([pensionStream])} />);

    expect(screen.getByText('Net Public Pension Income')).toBeInTheDocument();
    const tooltip = screen
      .getAllByTestId('detail-info-tooltip-content')
      .find(el => el.dataset.title === 'Public Pension Income Details');
    expect(tooltip).toBeDefined();
    expect(within(tooltip!).getByText('¥2,400,000')).toBeInTheDocument();
    expect(within(tooltip!).getByText('-¥1,100,000')).toBeInTheDocument();
    expect(within(tooltip!).getByText('¥1,300,000')).toBeInTheDocument();

    expect(screen.queryByText('Total Net Income')).not.toBeInTheDocument();
    expect(screen.queryByText(/Net Business.*Misc Income/)).not.toBeInTheDocument();
  });

  it('shows the Total Net Income subtotal when salary accompanies the pension', () => {
    render(
      <Tab
        results={pensionResults({
          annualIncome: 5_400_000,
          hasEmploymentIncome: true,
          salaryIncome: 3_000_000,
          grossEmploymentIncome: 3_000_000,
          netEmploymentIncome: 1_920_000,
          pensionIncomeAdjustmentDeduction: 100_000,
          totalNetIncome: 3_220_000,
        })}
        inputs={makeInputs([
          { id: 's1', type: 'salary', amount: 3_000_000, frequency: 'annual' },
          pensionStream,
        ])}
      />,
    );

    expect(screen.getByText('Net Public Pension Income')).toBeInTheDocument();
    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.getAllByText('¥3,220,000').length).toBeGreaterThanOrEqual(1);
  });

  it('backs the pension out of the Net Business / Misc Income row', () => {
    render(
      <Tab
        results={pensionResults({
          annualIncome: 4_400_000,
          totalNetIncome: 3_300_000,
        })}
        inputs={makeInputs([{ id: 'b1', type: 'business', amount: 2_000_000 }, pensionStream])}
      />,
    );

    // 3,300,000 total − 1,300,000 net pension: the business row must not absorb the pension.
    expect(screen.getByText(/Net Business.*Misc Income/)).toBeInTheDocument();
    expect(screen.getAllByText('¥2,000,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Net Income')).toBeInTheDocument();
    expect(screen.getAllByText('¥3,300,000').length).toBeGreaterThanOrEqual(1);
  });
});
