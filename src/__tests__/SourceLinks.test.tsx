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

  it('says when a link opens a PDF rather than a page', () => {
    // Part of the link text, not a decorative icon, so it is announced rather than only seen.
    render(
      <SourceLinks
        sources={[
          { label: 'Rate table', href: 'https://example.com/rates.pdf' },
          { label: 'Guidance', href: 'https://example.com/guidance' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Rate table (PDF)' })).toHaveAttribute(
      'href',
      'https://example.com/rates.pdf',
    );
    expect(screen.getByRole('link', { name: 'Guidance' })).toBeInTheDocument();
  });

  it('sees the extension through a query string or fragment', () => {
    render(
      <SourceLinks
        sources={[
          { label: 'Versioned', href: 'https://example.com/a.pdf?v=2' },
          { label: 'Anchored', href: 'https://example.com/b.pdf#page=3' },
          { label: 'Not a document', href: 'https://example.com/pdf-guidance' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Versioned (PDF)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anchored (PDF)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Not a document' })).toBeInTheDocument();
  });

  it('appends a decorative external-link icon inside each link', () => {
    render(<SourceLinks sources={[{ label: 'A', href: 'https://example.com/a' }]} />);

    // The icon lives inside the anchor but is aria-hidden, so the link name is unchanged.
    const link = screen.getByRole('link', { name: 'A' });
    const icon = link.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
