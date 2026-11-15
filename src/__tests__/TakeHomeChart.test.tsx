// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import TakeHomeChart, { MAX_CHART_INCOME } from '../components/TakeHomeCalculator/TakeHomeChart';
import { theme } from '../theme';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { DEFAULT_TAXPAYER_AGE_RANGE } from '../types/taxpayerAge';

vi.mock('react-chartjs-2', () => ({
  Chart: ({ data }: { data?: { datasets?: { label?: string; borderColor?: string }[] } }) => {
    const health = data?.datasets?.find(d => d.label === 'Health Insurance');
    return <div data-testid="chart-canvas" data-border-color={health?.borderColor} />;
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
});
