// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChangelogLoadingDialog from '../components/ChangelogLoadingDialog';

describe('ChangelogLoadingDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const findSpinner = () => screen.queryByLabelText('Loading changelog');

  it('stays hidden while the changelog module could still arrive promptly', () => {
    render(<ChangelogLoadingDialog onClose={vi.fn()} />);

    expect(findSpinner()).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(findSpinner()).not.toBeInTheDocument();
  });

  it('appears once the wait is long enough to notice', () => {
    render(<ChangelogLoadingDialog onClose={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(findSpinner()).toBeInTheDocument();
  });

  it('cancels its timer when the changelog arrives first', () => {
    const { unmount } = render(<ChangelogLoadingDialog onClose={vi.fn()} />);
    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(findSpinner()).not.toBeInTheDocument();
  });
});
