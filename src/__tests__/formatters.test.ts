// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, afterEach, vi } from 'vitest';

import { formatMonthShort } from '../utils/formatters';

describe('formatMonthShort', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  it('maps zero-based month indices to short English names', () => {
    expect(Array.from({ length: 12 }, (_, m) => formatMonthShort(m))).toEqual(MONTHS);
  });

  // Regression test: the previous helper seeded its date from `new Date()`, inheriting
  // today's day-of-month. On the 29th-31st, formatting a shorter month (e.g. February)
  // via setMonth rolled the date over into the following month — so it returned 'Mar'
  // instead of 'Feb'. The output must not depend on the current date.
  it('does not roll over when today is the 31st', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 31)); // Jan 31 — longer than Feb/Apr/Jun/Sep/Nov
    expect(formatMonthShort(1)).toBe('Feb');
    expect(Array.from({ length: 12 }, (_, m) => formatMonthShort(m))).toEqual(MONTHS);
  });
});
