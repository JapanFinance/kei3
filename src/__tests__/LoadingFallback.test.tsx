// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingFallback } from '../Root';
import { getReducedMotionStyles } from './fixtures/reducedMotionStyles';

describe('LoadingFallback', () => {
  it('renders a status spinner with a prefers-reduced-motion rule', () => {
    render(<LoadingFallback />);

    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner).toBeInTheDocument();

    const reducedMotionStyles = getReducedMotionStyles(spinner);
    expect(reducedMotionStyles.some(style => style.animation === 'none')).toBe(true);
    expect(reducedMotionStyles.some(style => style.opacity === '0.4')).toBe(true);
  });
});
