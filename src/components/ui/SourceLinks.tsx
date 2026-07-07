// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/sx';

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
   * Heading rendered above the list. Defaults to `"Official Sources:"`. Pass a custom string for
   * the singular case (`"Official Source:"`) or bespoke variants (`"Official Sources (NTA):"`),
   * or `null` to omit the heading entirely.
   */
  heading?: string | null;
  /** Overrides/extends the outer Box styling (defaults to `{ mt: 1 }`). */
  sx?: SxProps<Theme>;
}

/**
 * Renders the recurring "Official Sources:" block used throughout the calculator tooltips: a
 * heading followed by a bulleted list of external links, each opening in a new tab with the
 * shared underlined-primary styling. Replaces the ~35 hand-written copies of this markup.
 */
const SourceLinks: React.FC<SourceLinksProps> = ({
  sources,
  heading = 'Official Sources:',
  sx,
}) => (
  <Box sx={mergeSx({ mt: 1 }, sx)}>
    {heading}
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
