// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock scrollIntoView to avoid errors in JSDOM
window.HTMLElement.prototype.scrollIntoView = function () { };

describe('App Integration - Income Mode Switching', () => {
    it('should switch health insurance provider when changing income mode', async () => {
        const user = userEvent.setup();
        render(<App mode="light" toggleColorMode={() => { }} />);

        // 1. Initial State: Salary Mode -> Kyokai Kenpo
        expect(screen.getByRole('button', { name: /salary/i })).toHaveAttribute('aria-pressed', 'true');

        // Verify provider is Kyokai Kenpo (or default employee provider)
        expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toHaveTextContent('Kyokai Kenpo');

        // 2. Switch to Business Mode
        await user.click(screen.getByRole('button', { name: /business/i }));

        // Verify mode changed
        expect(screen.getByRole('button', { name: /business/i })).toHaveAttribute('aria-pressed', 'true');

        // 3. Verify Provider Switched to National Health Insurance
        expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toHaveTextContent('National Health Insurance');
    });
});
