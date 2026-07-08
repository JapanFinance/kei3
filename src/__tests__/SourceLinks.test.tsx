// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SourceLinks from '../components/ui/SourceLinks';

describe('SourceLinks', () => {
  it('uses the singular default heading for one source', () => {
    render(<SourceLinks sources={[{ label: '基礎控除', href: 'https://example.com/a' }]} />);

    expect(screen.getByText('Official Source')).toBeInTheDocument();
    expect(screen.queryByText('Official Sources')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '基礎控除' })).toHaveAttribute(
      'href',
      'https://example.com/a',
    );
  });

  it('uses the plural default heading for multiple sources', () => {
    render(
      <SourceLinks
        sources={[
          { label: 'A', href: 'https://example.com/a' },
          { label: 'B', href: 'https://example.com/b' },
        ]}
      />,
    );

    expect(screen.getByText('Official Sources')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders a custom heading when provided', () => {
    render(
      <SourceLinks
        heading="Official Sources (NTA)"
        sources={[
          { label: 'A', href: 'https://example.com/a' },
          { label: 'B', href: 'https://example.com/b' },
        ]}
      />,
    );

    expect(screen.getByText('Official Sources (NTA)')).toBeInTheDocument();
  });

  it('opens links in a new tab with rel protection', () => {
    render(<SourceLinks sources={[{ label: 'A', href: 'https://example.com/a' }]} />);

    const link = screen.getByRole('link', { name: 'A' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
