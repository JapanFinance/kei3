// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { theme } from '../theme';

// Mock scrollIntoView to avoid errors in JSDOM
window.HTMLElement.prototype.scrollIntoView = function () {};

// The lazily loaded chart is outside these tests' scope. Left real, chart.js measures its
// canvas from a resize callback that can fire after the test's DOM has been torn down.
vi.mock('../components/TakeHomeCalculator/TakeHomeChart', () => ({
  default: () => null,
}));

describe('App Integration - Income Mode Switching', () => {
  it('should switch health insurance provider when the income streams lose employment income', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>,
    );

    // 1. Initial State: Salary Mode -> Kyokai Kenpo
    expect(screen.getByRole('button', { name: 'Salary only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Verify provider is Kyokai Kenpo (or default employee provider)
    expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toHaveTextContent(
      'Kyokai Kenpo',
    );

    // 2. Switch to Advanced Mode: the salary stream carries over, so the provider is kept
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toHaveTextContent(
      'Kyokai Kenpo',
    );

    // 3. Replace the salary with miscellaneous income
    await user.click(screen.getByRole('button', { name: /edit income\/benefits/i }));
    await user.click(await screen.findByRole('button', { name: /delete income/i }));
    await user.click(screen.getByRole('button', { name: /add miscellaneous income/i }));
    await user.type(
      screen.getByRole('textbox', { name: /annual income after expenses/i }),
      '5000000',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    // 4. Verify Provider Switched to National Health Insurance
    expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toHaveTextContent(
      'National Health Insurance',
    );
  });
});

describe('App Integration - 介護保険第1号 estimate', () => {
  it('feeds the computed estimate back into the input form at 65+', async () => {
    // Pins the results → InputForm passthrough. Both the estimate prop and the read-only field
    // fall back silently when it is missing, so dropping it is invisible to a component test.
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('combobox', { name: /age/i }));
    await user.click(screen.getByRole('option', { name: '65-69' }));

    const field = await screen.findByLabelText('Annual Premium (estimate)');
    expect(field).toBeDisabled();
    // The default ¥5,000,000 salary at 65-69 in Tokyo lands in tier 9: 75,840 × 1.7 = 128,928
    // floored to 128,900.
    expect(field).toHaveValue('¥128,900');
    expect(screen.getByRole('switch', { name: 'Estimate' })).toBeChecked();
  });
});
