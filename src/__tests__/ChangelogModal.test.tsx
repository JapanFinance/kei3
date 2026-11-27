// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import useMediaQuery from '@mui/material/useMediaQuery';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import changelogContent from '../../CHANGELOG.md?raw';
import ChangelogModal, { EntryBody } from '../components/ChangelogModal';
import { parseChangelog } from '../utils/changelogUtils';

const { entries } = parseChangelog(changelogContent);

describe('ChangelogModal', () => {
  afterEach(() => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.restoreAllMocks();
  });

  it('calls onViewed when open', () => {
    const onViewed = vi.fn();

    render(<ChangelogModal open onClose={vi.fn()} onViewed={onViewed} />);

    expect(onViewed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: /what's new/i })).toBeInTheDocument();
  });

  it('shows New since last visit for returning visitors with unread releases', () => {
    const cutoffDate = entries[2]?.date ?? '2026-11-05';

    render(
      <ChangelogModal
        open
        onClose={vi.fn()}
        onViewed={vi.fn()}
        previousLastViewedDate={cutoffDate}
      />,
    );

    expect(screen.getByText('New since last visit (2)')).toBeInTheDocument();
    expect(screen.getByText(`Earlier updates (${entries.length - 2})`)).toBeInTheDocument();
  });

  it('shows Latest updates instead of New since last visit on first visit or when caught up', () => {
    const latestDate = entries[0]?.date ?? '2026-11-23';

    const { rerender } = render(
      <ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} previousLastViewedDate={null} />,
    );

    expect(screen.getByText('Latest updates')).toBeInTheDocument();
    expect(screen.queryByText(/new since last visit/i)).not.toBeInTheDocument();

    rerender(
      <ChangelogModal
        open
        onClose={vi.fn()}
        onViewed={vi.fn()}
        previousLastViewedDate={latestDate}
      />,
    );

    expect(screen.getByText('Latest updates')).toBeInTheDocument();
  });

  it('keeps earlier updates collapsed until clicked or expanded all', async () => {
    const user = userEvent.setup();

    render(<ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} />);

    const earlierEntry = entries[2];
    expect(earlierEntry).toBeDefined();
    const detailsEl = document.getElementById(`changelog-entry-${earlierEntry!.date}`);
    expect(detailsEl).not.toBeNull();
    expect(detailsEl).not.toHaveAttribute('open');

    const summary = detailsEl!.querySelector('summary');
    expect(summary).not.toBeNull();
    await user.click(summary!);

    expect(detailsEl).toHaveAttribute('open');

    const toggleAllBtn = screen.getByRole('button', { name: 'Expand all' });
    expect(toggleAllBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggleAllBtn);

    expect(screen.getByRole('button', { name: 'Collapse all' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    for (const entry of entries.slice(2)) {
      expect(document.getElementById(`changelog-entry-${entry.date}`)).toHaveAttribute('open');
    }

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByRole('button', { name: 'Expand all' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.getElementById(`changelog-entry-${earlierEntry!.date}`)).not.toHaveAttribute(
      'open',
    );
  });

  it('auto-expands a deep-linked targetDate in the earlier archive', () => {
    const deepLinkedDate = entries[4]?.date ?? '2026-10-24';

    render(
      <ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} targetDate={deepLinkedDate} />,
    );

    const detailsEl = document.getElementById(`changelog-entry-${deepLinkedDate}`);
    expect(detailsEl).toHaveAttribute('open');
  });

  it('filters entries by category and search query and resets via Clear filters', async () => {
    const user = userEvent.setup();

    render(<ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} />);

    const searchInput = screen.getByLabelText('Search updates');
    await user.type(searchInput, 'Real estate income');

    expect(screen.getByText(/Matching updates \(/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Real estate income in Advanced mode/i }),
    ).toBeInTheDocument();

    const filterGroup = screen.getByRole('group', { name: 'Filter by category' });
    const fixedChip = within(filterGroup).getByRole('button', { name: /^Fixed \(/ });
    await user.click(fixedChip);

    expect(screen.getByText('No updates match the current filter.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Latest updates')).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });

  it('renders external links safely with (PDF) cues on PDF documents', () => {
    render(<ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} />);

    const pdfLink = screen.getByRole('link', { name: /FY2025 Furusato Nozei status survey/i });
    expect(pdfLink).toHaveAttribute('target', '_blank');
    expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pdfLink).toHaveTextContent('(PDF)');
  });

  it('renders full-screen layout on mobile viewports with consistent footer summary', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);

    render(
      <ChangelogModal
        open
        onClose={vi.fn()}
        onViewed={vi.fn()}
        previousLastViewedDate="2026-11-05"
      />,
    );

    expect(screen.queryByText(/Last viewed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/updates · Last updated/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('renders plain paragraphs and markdown tables from CHANGELOG.md and matches table cells in search', async () => {
    const user = userEvent.setup();

    render(<ChangelogModal open onClose={vi.fn()} onViewed={vi.fn()} />);

    const entryEl = document.getElementById('changelog-entry-2026-11-27');
    expect(entryEl).not.toBeNull();
    expect(entryEl!.querySelectorAll('ul')).toHaveLength(0);
    expect(within(entryEl!).getByText(/Impact on the Furusato Nozei limit/i)).toBeInTheDocument();

    const table = within(entryEl!).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Salary range' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '¥4.4M–¥5.25M' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '¥327,000 → ¥277,000 at ¥13M' })).toBeVisible();

    const searchInput = screen.getByLabelText('Search updates');
    await user.type(searchInput, '¥22.1M');

    expect(
      screen.getByRole('heading', {
        name: /Fix Furusato Nozei limit for 2026 basic deduction increase/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders nested bullet lists with nested list elements', () => {
    const parsed = parseChangelog(`
## 2026-11-27: Nested list test

### New

- Parent item
  - Child item
    - Grandchild item
`);

    const { container } = render(<EntryBody entry={parsed.entries[0]!} hideSingleCategoryBadge />);

    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(3);
    expect(screen.getByText('Parent item')).toBeInTheDocument();
    expect(screen.getByText('Child item')).toBeInTheDocument();
    expect(screen.getByText('Grandchild item')).toBeInTheDocument();
  });
});
