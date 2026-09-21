// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import useMediaQuery from '@mui/material/useMediaQuery';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportingPlanner } from '../components/TakeHomeCalculator/Income/ReportingPlanner';
import {
  useReportingPlans,
  type ReportingRow,
  type UseReportingPlansResult,
} from '../components/TakeHomeCalculator/Income/useReportingPlans';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import {
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type IncomeStream,
  type TakeHomeInputs,
} from '../types/tax';
import type { EvaluatedPlan, PlanFigures } from '../utils/reportingPlanner';

vi.mock('../components/TakeHomeCalculator/Income/useReportingPlans', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../components/TakeHomeCalculator/Income/useReportingPlans')
  >()),
  useReportingPlans: vi.fn(),
}));

const mockedUseReportingPlans = vi.mocked(useReportingPlans);
const mockedUseMediaQuery = vi.mocked(useMediaQuery);

const streamA: IncomeStream = {
  id: 'a',
  type: 'withholdingAccount',
  capitalGains: 500_000,
  dividends: 0,
  reportsCapitalGains: false,
  reportsDividends: false,
};

const figures = (overrides: Partial<PlanFigures> = {}): PlanFigures => ({
  kept: 0,
  incomeTax: 0,
  residenceTax: 0,
  socialInsurance: 0,
  furusatoNozeiLimit: 0,
  totalIncome: 0,
  ...overrides,
});

const evaluated = (
  streams: IncomeStream[],
  overrides: Partial<PlanFigures> = {},
): EvaluatedPlan => ({
  streams,
  election: 'separate',
  figures: figures(overrides),
});

const row = (overrides: Partial<ReportingRow>): ReportingRow => ({
  key: 'current',
  label: 'Current',
  evaluated: evaluated([streamA]),
  changes: [],
  canApply: false,
  ...overrides,
});

const inputs: TakeHomeInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [streamA],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
};

const setResult = (result: Partial<UseReportingPlansResult>) => {
  mockedUseReportingPlans.mockReturnValue({
    rows: undefined,
    bestPlan: undefined,
    mandatoryNote: undefined,
    progress: undefined,
    showProgress: false,
    bounded: false,
    boundedEstimate: undefined,
    ...result,
  });
};

const expandPanel = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /compare reporting plans/i }));
  return user;
};

describe('ReportingPlanner', () => {
  beforeEach(() => {
    mockedUseReportingPlans.mockReset();
    mockedUseMediaQuery.mockReturnValue(false);
  });

  it('renders each row with its label and figures', async () => {
    setResult({
      rows: [
        row({
          key: 'current',
          label: 'Current',
          evaluated: evaluated([streamA], { kept: 1_000_000, totalIncome: 5_000_000 }),
        }),
        row({
          key: 'best',
          label: 'Best',
          canApply: true,
          changes: ['Account 1 (sales ¥500,000, dividends ¥0): report the sales only.'],
          evaluated: evaluated([{ ...streamA, reportsCapitalGains: true }], {
            kept: 1_100_000,
            totalIncome: 5_500_000,
          }),
        }),
      ],
    });

    render(
      <ReportingPlanner
        inputs={inputs}
        onStreamsChange={vi.fn()}
        onReportedDividendsTaxationChange={vi.fn()}
      />,
    );
    await expandPanel();

    expect(screen.getByText('Current')).toBeInTheDocument();
    // The table's column heading and the change list's title both read "Best".
    expect(screen.getAllByText('Best').length).toBeGreaterThan(0);
    expect(screen.getByText('¥1,000,000')).toBeInTheDocument();
    expect(screen.getByText('¥1,100,000')).toBeInTheDocument();
    expect(screen.getByText('¥5,000,000')).toBeInTheDocument();
    expect(screen.getByText('¥5,500,000')).toBeInTheDocument();
    expect(screen.getByText('Changes from the current entries:')).toBeInTheDocument();
    expect(
      screen.getByText('Account 1 (sales ¥500,000, dividends ¥0): report the sales only.'),
    ).toBeInTheDocument();
  });

  it("applies exactly the row plan's streams and election, and never on Current", async () => {
    const onStreamsChange = vi.fn();
    const onReportedDividendsTaxationChange = vi.fn();
    const bestStreams: IncomeStream[] = [{ ...streamA, reportsCapitalGains: true }];

    setResult({
      rows: [
        row({ key: 'current', label: 'Current', canApply: false }),
        row({
          key: 'best',
          label: 'Best',
          canApply: true,
          evaluated: {
            streams: bestStreams,
            election: 'aggregate',
            figures: figures({ kept: 42 }),
          },
        }),
      ],
    });

    render(
      <ReportingPlanner
        inputs={inputs}
        onStreamsChange={onStreamsChange}
        onReportedDividendsTaxationChange={onReportedDividendsTaxationChange}
      />,
    );
    const user = await expandPanel();

    // Current offers no Apply button at all.
    expect(screen.queryAllByRole('button', { name: 'Apply' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onStreamsChange).toHaveBeenCalledExactlyOnceWith(bestStreams);
    expect(onReportedDividendsTaxationChange).toHaveBeenCalledExactlyOnceWith('aggregate');
  });

  it('works without an election callback', async () => {
    const onStreamsChange = vi.fn();
    setResult({
      rows: [row({ key: 'best', label: 'Best', canApply: true })],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={onStreamsChange} />);
    const user = await expandPanel();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onStreamsChange).toHaveBeenCalledExactlyOnceWith([streamA]);
  });

  it('shows "Best found" and the bounded caption when the search was bounded', async () => {
    setResult({
      bounded: true,
      boundedEstimate: { count: 12_345, predictedMs: 3_500 },
      rows: [
        row({ key: 'current', label: 'Current' }),
        row({
          key: 'best',
          label: 'Best found',
          canApply: true,
          changes: ['Account 1 (...): report.'],
        }),
      ],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    await expandPanel();

    expect(screen.getAllByText('Best found').length).toBeGreaterThan(0);
    expect(screen.getByText(/The search was bounded/)).toBeInTheDocument();
    expect(screen.getByText(/12,345 plans/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5 seconds/)).toBeInTheDocument();
  });

  it('says the current choices already keep the most when Best equals Current, and offers no Apply for it', async () => {
    setResult({
      rows: [
        row({ key: 'current', label: 'Current' }),
        row({ key: 'best', label: 'Best', canApply: false, changes: ['should not be shown'] }),
      ],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    await expandPanel();

    expect(screen.getByText('The current choices already keep the most.')).toBeInTheDocument();
    expect(screen.queryByText('should not be shown')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('shows a determinate search indicator while an exhaustive search reports progress', async () => {
    setResult({
      showProgress: true,
      progress: { done: 4, count: 10 },
      rows: [row({ key: 'current', label: 'Current' }), row({ key: 'best', label: 'Best' })],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    await expandPanel();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('Searching: 4 of 10 plans')).toBeInTheDocument();
  });

  it('shows an indeterminate search indicator with the count so far once the search is bounded', async () => {
    setResult({
      showProgress: true,
      progress: { done: 250 },
      bounded: true,
      boundedEstimate: { count: 16_352, predictedMs: 40_000 },
      rows: [row({ key: 'current', label: 'Current' }), row({ key: 'best', label: 'Best found' })],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    await expandPanel();

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Searching: 250 plans checked')).toBeInTheDocument();
  });

  it('renders one two-column block per plan on a phone screen', async () => {
    mockedUseMediaQuery.mockReturnValue(true);
    setResult({
      rows: [
        row({
          key: 'current',
          label: 'Current',
          evaluated: evaluated([streamA], { kept: 1_000_000 }),
        }),
        row({
          key: 'best',
          label: 'Best',
          canApply: true,
          evaluated: evaluated([streamA], { kept: 1_100_000 }),
        }),
      ],
    });

    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    await expandPanel();

    // Each plan gets its own table (mirroring the desktop table's one row become one table),
    // rather than one shared multi-column table.
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByText('¥1,000,000')).toBeInTheDocument();
    expect(screen.getByText('¥1,100,000')).toBeInTheDocument();
  });

  it('shows nothing while the search has not produced rows yet', () => {
    setResult({ rows: undefined });
    render(<ReportingPlanner inputs={inputs} onStreamsChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /compare reporting plans/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
