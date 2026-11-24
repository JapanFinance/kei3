// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';

import TakeHomeChart, { MAX_CHART_INCOME } from '../components/TakeHomeCalculator/TakeHomeChart';
import { HOUSEHOLD_INCOME_DISTRIBUTIONS } from '../data/income';
import { theme } from '../theme';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { DEFAULT_TAXPAYER_AGE_RANGE } from '../types/taxpayerAge';
import { formatJPY } from '../utils/formatters';
import { estimateIncomePercentile } from '../utils/incomeDistribution';
import { makeDependent, makeSpouse } from './fixtures/dependents';

vi.mock('react-chartjs-2', () => ({
  Chart: ({
    data,
    options,
    role,
    'aria-label': ariaLabel,
  }: {
    data?: { datasets?: { label?: string; borderColor?: string }[] };
    options?: {
      animation?: false | object;
      plugins?: { customPlugin?: { data?: { currentIncome?: number } } };
    };
    role?: string;
    'aria-label'?: string;
  }) => {
    const health = data?.datasets?.find(d => d.label === 'Health Insurance');
    return (
      <div
        data-testid="chart-canvas"
        role={role}
        aria-label={ariaLabel}
        data-border-color={health?.borderColor}
        data-current-income={options?.plugins?.customPlugin?.data?.currentIncome}
        data-animation={
          options?.animation === false
            ? 'false'
            : options?.animation === undefined
              ? 'undefined'
              : 'object'
        }
      />
    );
  },
}));

const baseProps: React.ComponentProps<typeof TakeHomeChart> = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  currentIncome: 5_000_000,
  incomeYear: 2026,
  ageRange: DEFAULT_TAXPAYER_AGE_RANGE,
  longTermCareCategory1Premium: 0,
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dcPlanContributions: 0,
  dependents: [],
  incomeStreams: [{ id: 's', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
};

describe('TakeHomeChart', () => {
  afterEach(() => {
    vi.mocked(useMediaQuery).mockImplementation(() => false);
  });

  it('renders the chart and controls when income is within the supported range', () => {
    render(<TakeHomeChart {...baseProps} currentIncome={5_000_000} />);

    expect(screen.getByText('Take-Home Pay Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toBeInTheDocument();
    expect(screen.getByText(/Chart Income Range:/)).toBeInTheDocument();
    expect(screen.queryByText('Chart Disabled')).not.toBeInTheDocument();
  });

  it('renders the chart at exactly 100 million yen', () => {
    render(
      <TakeHomeChart
        {...baseProps}
        currentIncome={MAX_CHART_INCOME}
        incomeStreams={[{ id: 's', type: 'salary', amount: MAX_CHART_INCOME, frequency: 'annual' }]}
      />,
    );

    expect(screen.getByTestId('chart-canvas')).toBeInTheDocument();
    expect(screen.queryByText('Chart Disabled')).not.toBeInTheDocument();
  });

  it('disables the chart and displays an explanation when income exceeds 100 million yen', () => {
    render(
      <TakeHomeChart
        {...baseProps}
        currentIncome={100_000_001}
        incomeStreams={[{ id: 's', type: 'salary', amount: 100_000_001, frequency: 'annual' }]}
      />,
    );

    expect(screen.getByText('Take-Home Pay Chart')).toBeInTheDocument();
    expect(screen.getByText('Chart Disabled')).toBeInTheDocument();
    expect(
      screen.getByText('The take-home pay chart is disabled for total incomes over ¥100,000,000.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('chart-canvas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chart Income Range:/)).not.toBeInTheDocument();
  });

  it('disables the chart when incomeStreams total exceeds 100 million yen even if currentIncome is not passed', () => {
    render(
      <TakeHomeChart
        {...baseProps}
        currentIncome={0}
        incomeStreams={[
          {
            id: 'inv',
            type: 'capitalGains',
            shareType: 'listed',
            account: 'domesticNoWithholding',
            amount: 150_000_000,
          },
        ]}
      />,
    );

    expect(screen.getByText('Chart Disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-canvas')).not.toBeInTheDocument();
  });

  it('resolves light and dark text.primary for capped-bar borderColor', async () => {
    const user = userEvent.setup();
    const SwitchToDark = () => {
      const { setMode } = useColorScheme();
      return <button onClick={() => setMode('dark')}>Switch to dark</button>;
    };

    render(
      <ThemeProvider theme={theme} defaultMode="light" storageManager={null}>
        <SwitchToDark />
        <TakeHomeChart {...baseProps} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('chart-canvas')).toHaveAttribute(
      'data-border-color',
      'rgba(0, 0, 0, 0.87)',
    );

    await user.click(screen.getByRole('button', { name: 'Switch to dark' }));

    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-border-color', '#fff');
  });

  it('renders the basis selector without same-household members and ignores non-cohabiting income', async () => {
    const user = userEvent.setup();
    const nonCohabitingDependent = makeDependent({
      isSameHousehold: false,
      isClaimedAsDependent: true,
      income: {
        grossEmploymentIncome: 1_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    render(<TakeHomeChart {...baseProps} dependents={[nonCohabitingDependent]} />);

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Individual Income',
    );
    expect(screen.getByText(/: ¥5,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '5000000');

    await user.click(screen.getByRole('combobox', { name: 'Income comparison basis' }));
    await user.click(screen.getByRole('option', { name: 'Household Income' }));

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Household Income',
    );
    expect(screen.getByText(/: ¥5,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '5000000');
  });

  it('always renders the basis selector at default empty dependents', () => {
    render(<TakeHomeChart {...baseProps} />);

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Individual Income',
    );
    expect(screen.getByText(/: ¥5,000,000/)).toBeInTheDocument();
  });

  it('defaults to Household Income when same-household members have income and updates marker and percentile', () => {
    const allRanges = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges;
    const expectedPercentile = estimateIncomePercentile(9_000_000, allRanges).percentile.toFixed(1);
    const spouse = makeSpouse({
      isSameHousehold: true,
      isClaimedAsDependent: false,
      income: {
        grossEmploymentIncome: 4_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    render(<TakeHomeChart {...baseProps} dependents={[spouse]} />);

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Household Income',
    );
    expect(screen.getByText(/: ¥9,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '9000000');
    expect(
      screen.getByText(new RegExp(`This income is higher than ~${expectedPercentile}% of`)),
    ).toBeInTheDocument();
  });

  it('switches between Household Income and Individual Income and updates amount, marker, and percentile', async () => {
    const user = userEvent.setup();
    const allRanges = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges;
    const indivPercentile = estimateIncomePercentile(5_000_000, allRanges).percentile.toFixed(1);
    const householdPercentile = estimateIncomePercentile(9_000_000, allRanges).percentile.toFixed(
      1,
    );
    const spouse = makeSpouse({
      isSameHousehold: true,
      isClaimedAsDependent: false,
      income: {
        grossEmploymentIncome: 4_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    render(<TakeHomeChart {...baseProps} dependents={[spouse]} />);

    expect(
      screen.getByText(new RegExp(`This income is higher than ~${householdPercentile}% of`)),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Income comparison basis' }));
    await user.click(screen.getByRole('option', { name: 'Individual Income' }));

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Individual Income',
    );
    expect(screen.getByText(/: ¥5,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '5000000');
    expect(
      screen.getByText(new RegExp(`This income is higher than ~${indivPercentile}% of`)),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Income comparison basis' }));
    await user.click(screen.getByRole('option', { name: 'Household Income' }));

    expect(screen.getByText(/: ¥9,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '9000000');
    expect(
      screen.getByText(new RegExp(`This income is higher than ~${householdPercentile}% of`)),
    ).toBeInTheDocument();
  });

  it('defaults to Individual Income while keeping the selector when same-household members have zero income', () => {
    const child = makeDependent({ isSameHousehold: true });

    render(<TakeHomeChart {...baseProps} dependents={[child]} />);

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Individual Income',
    );
    expect(screen.getByText(/: ¥5,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '5000000');
  });

  it('handles zero taxpayer income with earning spouse and switching back to Individual Income', async () => {
    const user = userEvent.setup();
    const allRanges = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges;
    const spousePercentile = estimateIncomePercentile(4_000_000, allRanges).percentile.toFixed(1);
    const spouse = makeSpouse({
      isSameHousehold: true,
      isClaimedAsDependent: false,
      income: {
        grossEmploymentIncome: 4_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    render(
      <TakeHomeChart {...baseProps} currentIncome={0} incomeStreams={[]} dependents={[spouse]} />,
    );

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Household Income',
    );
    expect(screen.getByText(/: ¥4,000,000/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`This income is higher than ~${spousePercentile}% of`)),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Income comparison basis' }));
    await user.click(screen.getByRole('option', { name: 'Individual Income' }));

    expect(screen.getByRole('combobox', { name: 'Income comparison basis' })).toHaveTextContent(
      'Individual Income',
    );
    expect(screen.getByText(/^: ¥0$/)).toBeInTheDocument();
    expect(screen.getByText(/Comparison group:/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '0');
  });

  it('reports top bracket when household total reaches 20 million yen without disabling the chart', () => {
    const topPercent = HOUSEHOLD_INCOME_DISTRIBUTIONS.all.ranges.at(-1)!.percent.toFixed(1);
    const spouse = makeSpouse({
      isSameHousehold: true,
      isClaimedAsDependent: false,
      income: {
        grossEmploymentIncome: 10_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    render(
      <TakeHomeChart
        {...baseProps}
        currentIncome={15_000_000}
        incomeStreams={[{ id: 's', type: 'salary', amount: 15_000_000, frequency: 'annual' }]}
        dependents={[spouse]}
      />,
    );

    expect(screen.queryByText('Chart Disabled')).not.toBeInTheDocument();
    expect(screen.getByText(/: ¥25,000,000/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-current-income', '25000000');
    expect(
      screen.getByText(new RegExp(`This income is in the top ~${topPercent}% of`)),
    ).toBeInTheDocument();
  });

  it('enables chart animations on md+ viewports when reduced motion is not requested', () => {
    vi.mocked(useMediaQuery).mockImplementation(query => String(query).includes('min-width'));

    render(<TakeHomeChart {...baseProps} />);

    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-animation', 'undefined');
  });

  it('disables chart animations when prefers-reduced-motion is enabled', () => {
    vi.mocked(useMediaQuery).mockImplementation(
      query =>
        String(query).includes('min-width') || String(query).includes('prefers-reduced-motion'),
    );

    render(<TakeHomeChart {...baseProps} />);

    expect(screen.getByTestId('chart-canvas')).toHaveAttribute('data-animation', 'false');
  });

  it('exposes an accessible img role and summary label on the chart canvas', () => {
    const expectedMedian = formatJPY(HOUSEHOLD_INCOME_DISTRIBUTIONS.all.median);
    const spouse = makeSpouse({
      isSameHousehold: true,
      isClaimedAsDependent: false,
      income: {
        grossEmploymentIncome: 4_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    const { rerender } = render(<TakeHomeChart {...baseProps} />);

    expect(
      screen.getByRole('img', {
        name: new RegExp(
          `Take-home pay breakdown chart from ¥0 to .*Individual income: ¥5,000,000, median income: ${expectedMedian}`,
        ),
      }),
    ).toBeInTheDocument();

    rerender(<TakeHomeChart {...baseProps} dependents={[spouse]} />);

    expect(
      screen.getByRole('img', {
        name: new RegExp(
          `Take-home pay breakdown chart from ¥0 to .*Household income: ¥9,000,000, median income: ${expectedMedian}`,
        ),
      }),
    ).toBeInTheDocument();
  });

  it('describes unavailable comparative data in the chart label for manual social insurance entry', () => {
    render(<TakeHomeChart {...baseProps} manualSocialInsuranceEntry />);

    expect(
      screen.getByRole('img', {
        name: /comparative data across other income levels is unavailable/i,
      }),
    ).toBeInTheDocument();
  });
});
