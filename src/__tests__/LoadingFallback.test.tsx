// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingFallback } from '../Root';

describe('LoadingFallback', () => {
  it('renders a status spinner with a prefers-reduced-motion rule', () => {
    render(<LoadingFallback />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(
      Array.from(document.head.querySelectorAll('style')).some(style =>
        style.textContent?.includes('prefers-reduced-motion'),
      ),
    ).toBe(true);
  });
});
