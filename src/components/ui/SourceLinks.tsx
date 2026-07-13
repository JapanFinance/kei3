// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/** Inline style shared by every source anchor across the tooltips. */
const SOURCE_LINK_STYLE: React.CSSProperties = {
  color: 'var(--mui-palette-primary-main)',
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
   * Overrides the default heading, which is `"Official Source"` or `"Official Sources"` depending
   * on the number of sources. Only for bespoke variants that carry extra information (e.g.
   * `"Official Sources (NTA)"`).
   */
  heading?: string;
}

/**
 * Renders the recurring source-citation footer used throughout the calculator tooltips: a hairline
 * divider, a small uppercase "Official Sources" label, and the external links stacked tightly
 * beneath (opening in a new tab, in the shared underlined-primary style). Replaces the ~35
 * hand-written copies of this markup.
 */
const SourceLinks: React.FC<SourceLinksProps> = ({ sources, heading }) => (
  <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
    <Typography
      variant="caption"
      component="div"
      sx={{
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'text.secondary',
        mb: 0.5,
      }}
    >
      {heading ?? (sources.length === 1 ? 'Official Source' : 'Official Sources')}
    </Typography>
    <Box
      component="ul"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      {sources.map((source, i) => (
        <li key={i}>
          <a href={source.href} target="_blank" rel="noopener noreferrer" style={SOURCE_LINK_STYLE}>
            {source.label}
            <OpenInNewIcon
              sx={{ fontSize: '0.85em', ml: 0.4, verticalAlign: '-0.15em', color: 'inherit' }}
            />
          </a>
        </li>
      ))}
    </Box>
  </Box>
);

export default SourceLinks;
