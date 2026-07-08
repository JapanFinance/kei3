// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReferenceTable from '../components/ui/ReferenceTable';

const headers = ['Net Income (¥)', 'Deduction Amount'];
const rows = [
  ['Up to 24,000,000', '430,000'],
  ['24,000,001 - 24,500,000', '290,000'],
  ['24,500,001 - 25,000,000', '150,000'],
  ['Over 25,000,000', '0'],
];

/** The <tr> elements of the body (excludes the header row). */
const bodyRows = (): HTMLTableRowElement[] => Array.from(document.querySelectorAll('tbody tr'));

describe('ReferenceTable', () => {
  it('renders headers and every row', () => {
    render(<ReferenceTable headers={headers} rows={rows} />);
    expect(screen.getByText('Net Income (¥)')).toBeInTheDocument();
    expect(screen.getByText('430,000')).toBeInTheDocument();
    expect(screen.getByText('Over 25,000,000')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(4);
  });

  it('highlights only the row at highlightedRow with aria-current', () => {
    render(<ReferenceTable headers={headers} rows={rows} highlightedRow={2} />);
    const marked = bodyRows().filter(tr => tr.getAttribute('aria-current') === 'true');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('24,500,001 - 25,000,000');
    expect(marked[0]).toHaveStyle({ fontWeight: '600' });
  });

  it('highlights nothing when highlightedRow is omitted', () => {
    render(<ReferenceTable headers={headers} rows={rows} />);
    expect(bodyRows().some(tr => tr.getAttribute('aria-current') === 'true')).toBe(false);
  });

  it('highlights nothing when highlightedRow is out of range', () => {
    render(<ReferenceTable headers={headers} rows={rows} highlightedRow={99} />);
    expect(bodyRows().some(tr => tr.getAttribute('aria-current') === 'true')).toBe(false);
  });
});
