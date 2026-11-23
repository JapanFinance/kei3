// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  formatChangelogDate,
  formatChangelogDateShort,
  getChangelogEntryCategories,
  getChangelogEntryTitle,
  matchesChangelogFilter,
  parseChangelog,
  parseInlineMarkdown,
  splitChangelogEntries,
  stripInlineMarkdown,
  type ChangelogEntry,
} from '../utils/changelogUtils';

describe('parseChangelog', () => {
  it('parses optional release titles with em dash, en dash, or hyphen', () => {
    const md = `
## 2026-11-23 — Furusato Nozei return ratio updated to 26.5%

### Updated

- Updated ratio.

## 2026-11-22 – Family National Pension contributions

### New

- Added family contributions.

## 2026-11-05 - Household modal

### Fixed

- Fixed calculation.

## 2026-10-25

### New

- Added real estate income.
`;

    const parsed = parseChangelog(md);

    expect(parsed.latestDate).toBe('2026-11-23');
    expect(parsed.entries).toHaveLength(4);
    expect(parsed.entries[0]?.title).toBe('Furusato Nozei return ratio updated to 26.5%');
    expect(parsed.entries[1]?.title).toBe('Family National Pension contributions');
    expect(parsed.entries[2]?.title).toBe('Household modal');
    expect(parsed.entries[3]?.title).toBeUndefined();
    expect('title' in (parsed.entries[3] ?? {})).toBe(false);
  });

  it('merges duplicate category headings under the same date without overwriting', () => {
    const md = `
## 2026-10-24 — Sample

### New

- First item.

### New

- Second item.
`;

    const parsed = parseChangelog(md);

    expect(parsed.entries[0]?.sections.new).toEqual(['First item.', 'Second item.']);
  });
});

describe('date formatters', () => {
  it('formats ISO dates in long and short US English formats', () => {
    expect(formatChangelogDate('2026-11-23')).toBe('November 23, 2026');
    expect(formatChangelogDateShort('2026-11-23')).toBe('Nov 23, 2026');
  });

  it('falls back to the original string for invalid dates', () => {
    expect(formatChangelogDate('not-a-date')).toBe('not-a-date');
    expect(formatChangelogDateShort('not-a-date')).toBe('not-a-date');
  });
});

describe('parseInlineMarkdown and stripInlineMarkdown', () => {
  it('tokenizes links, PDF detection, bold, and inline code', () => {
    const tokens = parseInlineMarkdown(
      'See **bold** and `code` in [Survey](https://example.com/file.pdf?v=1).',
    );

    expect(tokens).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'code' },
      { type: 'text', value: ' in ' },
      {
        type: 'link',
        label: 'Survey',
        href: 'https://example.com/file.pdf?v=1',
        isPdf: true,
      },
      { type: 'text', value: '.' },
    ]);
  });

  it('keeps unsafe link schemes as plain text', () => {
    const tokens = parseInlineMarkdown('Click [here](javascript:alert) safely.');

    expect(tokens).toEqual([
      { type: 'text', value: 'Click ' },
      { type: 'text', value: '[here](javascript:alert)' },
      { type: 'text', value: ' safely.' },
    ]);
  });

  it('strips inline markdown syntax down to readable plain text', () => {
    const plain = stripInlineMarkdown(
      'Updated **Furusato** `rate` per [MIC survey](https://www.soumu.go.jp/doc.pdf).',
    );

    expect(plain).toBe('Updated Furusato rate per MIC survey.');
  });
});

describe('getChangelogEntryTitle', () => {
  it('returns the explicit title when present', () => {
    const entry: ChangelogEntry = {
      date: '2026-11-23',
      title: 'Custom Release Title',
      sections: { updated: ['Long description here.'] },
    };

    expect(getChangelogEntryTitle(entry)).toBe('Custom Release Title');
  });

  it('derives a concise fallback title from the first sentence without cutting decimals', () => {
    const entry: ChangelogEntry = {
      date: '2026-11-23',
      sections: {
        updated: [
          'Updated ratio from 25.2% to 26.5% per [MIC](https://example.com). Extra details follow.',
        ],
      },
    };

    expect(getChangelogEntryTitle(entry)).toBe('Updated ratio from 25.2% to 26.5% per MIC');
  });
});

describe('splitChangelogEntries', () => {
  const sampleEntries: ChangelogEntry[] = [
    { date: '2026-11-23', sections: { updated: ['Newest'] } },
    { date: '2026-11-22', sections: { updated: ['Second newest'] } },
    { date: '2026-11-05', sections: { new: ['Older'] } },
    { date: '2026-10-25', sections: { fixed: ['Oldest'] } },
  ];

  it('places entries newer than previousLastViewedDate into recent with hasUnread true', () => {
    const result = splitChangelogEntries(sampleEntries, '2026-11-05');

    expect(result.hasUnread).toBe(true);
    expect(result.recent.map(e => e.date)).toEqual(['2026-11-23', '2026-11-22']);
    expect(result.earlier.map(e => e.date)).toEqual(['2026-11-05', '2026-10-25']);
  });

  it('falls back to latest two entries with hasUnread false for first-time visitors', () => {
    const result = splitChangelogEntries(sampleEntries, null);

    expect(result.hasUnread).toBe(false);
    expect(result.recent.map(e => e.date)).toEqual(['2026-11-23', '2026-11-22']);
    expect(result.earlier.map(e => e.date)).toEqual(['2026-11-05', '2026-10-25']);
  });

  it('falls back to latest two entries with hasUnread false when already caught up', () => {
    const result = splitChangelogEntries(sampleEntries, '2026-11-23');

    expect(result.hasUnread).toBe(false);
    expect(result.recent.map(e => e.date)).toEqual(['2026-11-23', '2026-11-22']);
    expect(result.earlier.map(e => e.date)).toEqual(['2026-11-05', '2026-10-25']);
  });
});

describe('getChangelogEntryCategories and matchesChangelogFilter', () => {
  const entry: ChangelogEntry = {
    date: '2026-10-24',
    title: 'National Pension exemption and NHI reductions',
    sections: {
      new: ['Added toggle for [国民年金保険料の全額免除](https://www.nenkin.go.jp/).'],
      fixed: ['Applied low-income reduction.'],
    },
  };

  it('returns categories in canonical order', () => {
    expect(getChangelogEntryCategories(entry)).toEqual(['new', 'fixed']);
  });

  it('filters by category, title, plain text, Japanese terms, and formatted date', () => {
    expect(matchesChangelogFilter(entry, 'all', '')).toBe(true);
    expect(matchesChangelogFilter(entry, 'updated', '')).toBe(false);
    expect(matchesChangelogFilter(entry, 'new', '全額免除')).toBe(true);
    expect(matchesChangelogFilter(entry, 'fixed', '全額免除')).toBe(false);
    expect(matchesChangelogFilter(entry, 'all', 'oct 24, 2026')).toBe(true);
    expect(matchesChangelogFilter(entry, 'all', 'nenkin.go.jp')).toBe(false);
  });
});
