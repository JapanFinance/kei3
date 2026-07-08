// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OFFICIAL_SOURCES } from '../data/officialSources';
import SourceFooter from '../components/ui/SourceFooter';
import SourceLink from '../components/ui/SourceLink';

describe('OFFICIAL_SOURCES registry', () => {
  it('has a unique https URL per entry (one URL, one place)', () => {
    const urls = Object.values(OFFICIAL_SOURCES).map(s => s.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it('only cites government domains', () => {
    for (const source of Object.values(OFFICIAL_SOURCES)) {
      expect(new URL(source.url).hostname).toMatch(/\.(go\.jp|lg\.jp|tokyo\.jp)$/);
    }
  });
});

describe('SourceFooter', () => {
  it('uses the singular heading for one source', () => {
    render(<SourceFooter sources={['nta1199']} />);

    expect(screen.getByText('Official source')).toBeInTheDocument();
    expect(screen.queryByText('Official sources')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'No.1199 基礎控除' })).toHaveAttribute(
      'href',
      OFFICIAL_SOURCES.nta1199.url,
    );
  });

  it('uses the plural heading and one row per source', () => {
    render(<SourceFooter sources={['nta1180', 'nta1191']} />);

    expect(screen.getByText('Official sources')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders the org tag and gloss outside the link', () => {
    render(<SourceFooter sources={['nta1199']} />);

    const link = screen.getByRole('link', { name: 'No.1199 基礎控除' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/NTA/)).toBeInTheDocument();
    expect(screen.getByText(/Basic deduction/)).toBeInTheDocument();
  });

  it('accepts data-carried source objects', () => {
    render(
      <SourceFooter
        sources={[
          {
            org: 'Kyoto City',
            title: 'National Health Insurance rates',
            url: 'https://www.city.kyoto.lg.jp/hokenfukushi/page/x.html',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'National Health Insurance rates' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kyoto City/)).toBeInTheDocument();
  });

  it('renders nothing for an empty source list', () => {
    const { container } = render(<SourceFooter sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SourceLink', () => {
  it('renders docNo, title, and org for inline prose use', () => {
    render(<SourceLink source="nta2072" />);

    const link = screen.getByRole('link', { name: 'No.2072 青色申告特別控除 (NTA)' });
    expect(link).toHaveAttribute('href', OFFICIAL_SOURCES.nta2072.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders org and docNo only in the compact variant', () => {
    render(<SourceLink source="nta1543" variant="compact" />);

    expect(screen.getByRole('link', { name: 'NTA No.1543' })).toHaveAttribute(
      'href',
      OFFICIAL_SOURCES.nta1543.url,
    );
  });

  it('appends a decorative external-link icon inside the link', () => {
    render(<SourceLink source="nta1199" />);

    const link = screen.getByRole('link');
    const icon = link.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
