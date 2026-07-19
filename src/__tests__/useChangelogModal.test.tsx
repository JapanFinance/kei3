// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useChangelogModal } from '../hooks/useChangelogModal';

describe('useChangelogModal', () => {
  afterEach(() => {
    // openModal pushes #changelog; reset so tests stay independent.
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('starts with the badge hidden and lights it when the deferred check resolves true', async () => {
    let resolve!: (hasUnread: boolean) => void;
    const check = new Promise<boolean>(r => {
      resolve = r;
    });
    const { result } = renderHook(() => useChangelogModal(check));

    expect(result.current.hasNewFeatures).toBe(false);

    await act(async () => {
      resolve(true);
      await check;
    });
    expect(result.current.hasNewFeatures).toBe(true);
  });

  it('keeps the badge hidden when the deferred check resolves false', async () => {
    const check = Promise.resolve(false);
    const { result } = renderHook(() => useChangelogModal(check));

    await act(async () => {
      await check;
    });
    expect(result.current.hasNewFeatures).toBe(false);
  });

  it('does not light the badge when the modal was opened before the check resolved', async () => {
    let resolve!: (hasUnread: boolean) => void;
    const check = new Promise<boolean>(r => {
      resolve = r;
    });
    const { result } = renderHook(() => useChangelogModal(check));

    act(() => {
      result.current.openModal();
    });
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      resolve(true);
      await check;
    });
    expect(result.current.hasNewFeatures).toBe(false);
  });

  it('clears the badge when the modal is opened', async () => {
    const { result } = renderHook(() => useChangelogModal(Promise.resolve(true)));
    await waitFor(() => {
      expect(result.current.hasNewFeatures).toBe(true);
    });

    act(() => {
      result.current.openModal();
    });
    expect(result.current.hasNewFeatures).toBe(false);
  });
});
