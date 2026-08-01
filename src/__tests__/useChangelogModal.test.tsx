// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChangelogModal } from '../hooks/useChangelogModal';
import { CHANGELOG_STORAGE_KEYS } from '../utils/changelogStorage';

// The same value the build inlines into the hook, so these tests exercise the
// real comparison rather than a stand-in date.
const LATEST = __LATEST_CHANGELOG_DATE__;

describe('useChangelogModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // openModal pushes #changelog; reset so tests stay independent.
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('bakes in a changelog date to compare against', () => {
    expect(LATEST).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows the badge on a first visit, with nothing viewed yet', () => {
    const { result } = renderHook(() => useChangelogModal());

    expect(result.current.hasNewFeatures).toBe(true);
  });

  it('hides the badge once the newest entry has been viewed', () => {
    localStorage.setItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_DATE, LATEST);

    const { result } = renderHook(() => useChangelogModal());

    expect(result.current.hasNewFeatures).toBe(false);
  });

  it('shows the badge again when an older entry was the last one viewed', () => {
    localStorage.setItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_DATE, '2000-01-01');

    const { result } = renderHook(() => useChangelogModal());

    expect(result.current.hasNewFeatures).toBe(true);
  });

  it('clears the badge when the modal is opened', () => {
    const { result } = renderHook(() => useChangelogModal());
    expect(result.current.hasNewFeatures).toBe(true);

    act(() => {
      result.current.openModal();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.hasNewFeatures).toBe(false);
  });
});
