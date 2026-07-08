// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';

/** Inline style shared by every source anchor across the tooltips. */
const SOURCE_LINK_STYLE: React.CSSProperties = {
  color: 'var(--primary-main)',
  textDecoration: 'underline',
  fontSize: '0.95em',
};

export interface Source {
  /** Visible link text (usually the Japanese title with an English gloss). */
  label: React.ReactNode;
  /** Destination URL, opened in a new tab. */
  href: string;
}

interface SourceLinksProps {
  sources: Source[];
  /**
   * Overrides the default heading, which is `"Official Source:"` or `"Official Sources:"`
   * depending on the number of sources. Only for bespoke variants that carry extra information
   * (e.g. `"Official Sources (NTA):"`).
   */
  heading?: string;
}

/**
 * Renders the recurring "Official Sources:" block used throughout the calculator tooltips: a
 * heading (automatically singular or plural) followed by a bulleted list of external links, each
 * opening in a new tab with the shared underlined-primary styling. Replaces the ~35 hand-written
 * copies of this markup.
 */
const SourceLinks: React.FC<SourceLinksProps> = ({ sources, heading }) => (
  <Box sx={{ mt: 1 }}>
    {heading ?? (sources.length === 1 ? 'Official Source:' : 'Official Sources:')}
    <ul>
      {sources.map((source, i) => (
        <li key={i}>
          <a href={source.href} target="_blank" rel="noopener noreferrer" style={SOURCE_LINK_STYLE}>
            {source.label}
          </a>
        </li>
      ))}
    </ul>
  </Box>
);

export default SourceLinks;
