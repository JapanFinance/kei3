// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalLoadingDialog from '../components/ui/ModalLoadingDialog';
import { getReducedMotionStyles } from './fixtures/reducedMotionStyles';

describe('ModalLoadingDialog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden before the spinner delay elapses', () => {
    vi.useFakeTimers();
    render(<ModalLoadingDialog onClose={vi.fn()} ariaLabel="Loading dependents dialog" />);

    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
  });

  it('renders a labeled dialog once the spinner delay elapses', () => {
    vi.useFakeTimers();
    render(<ModalLoadingDialog onClose={vi.fn()} ariaLabel="Loading dependents dialog" />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByLabelText('Loading dependents dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed after appearing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(<ModalLoadingDialog onClose={onClose} ariaLabel="Loading dependents dialog" />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels its timer when unmounted before the delay', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <ModalLoadingDialog onClose={vi.fn()} ariaLabel="Loading dependents dialog" />,
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
  });

  it('renders a status spinner with a prefers-reduced-motion rule', () => {
    vi.useFakeTimers();
    render(<ModalLoadingDialog onClose={vi.fn()} ariaLabel="Loading dependents dialog" />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    const spinner = screen.getByRole('status', { name: 'Loading' });
    const reducedMotionStyles = getReducedMotionStyles(spinner);

    expect(spinner).toBeInTheDocument();
    expect(reducedMotionStyles.some(style => style.animation === 'none')).toBe(true);
    expect(reducedMotionStyles.some(style => style.opacity === '0.4')).toBe(true);
  });
});
