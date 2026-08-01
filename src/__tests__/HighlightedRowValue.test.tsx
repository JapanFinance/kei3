// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import HighlightedRowValue from '../components/ui/HighlightedRowValue';
import { formatJPY } from '../utils/formatters';

describe('HighlightedRowValue', () => {
  it('renders the label and the formatted value when the value is positive', () => {
    render(<HighlightedRowValue label="Net income" value={3_560_000} />);
    expect(screen.getByText(/Net income/)).toBeInTheDocument();
    expect(screen.getByText(formatJPY(3_560_000))).toBeInTheDocument();
  });

  it('renders nothing when the value is undefined', () => {
    const { container } = render(<HighlightedRowValue label="Net income" value={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the value is zero (no meaningful row to point at)', () => {
    const { container } = render(<HighlightedRowValue label="Net income" value={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
