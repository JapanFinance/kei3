// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { resolveOfficialSource, type OfficialSourceRef } from '../../data/officialSources';

interface SourceLinkProps {
  source: OfficialSourceRef;
  /**
   * Which context the link sits in:
   *  - `'inline'` (default): part of a sentence — renders `docNo title (org)` so the prose reads
   *    like the existing citation convention.
   *  - `'compact'`: a parenthetical aside in a sentence that already describes the document in
   *    English — renders just `org docNo` (falling back to `title (org)` without a docNo).
   *  - `'footer'`: a SourceFooter row — the org tag and the de-emphasized gloss are rendered by
   *    the footer around this link, so it renders just `docNo title`.
   */
  variant?: 'inline' | 'compact' | 'footer';
}

/**
 * An anchor to an official source, labeled from the registry entry (never free-form text, so the
 * official-terminology rule is enforced structurally) and marked with an external-link icon.
 * Opens in a new tab and inherits the surrounding font size.
 *
 * The primary blue (`#1976d2`) falls below AA contrast on dark paper, so dark mode brightens to
 * the palette's light primary — the one theme-aware link color for every citation.
 */
const SourceLink: React.FC<SourceLinkProps> = ({ source, variant = 'inline' }) => {
  const s = resolveOfficialSource(source);
  const label =
    variant === 'compact' && s.docNo !== undefined
      ? `${s.org} ${s.docNo}`
      : `${s.docNo !== undefined ? `${s.docNo} ` : ''}${s.title}${variant === 'footer' ? '' : ` (${s.org})`}`;
  return (
    <Box
      component="a"
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        textDecoration: 'underline',
        color: theme =>
          theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
      }}
    >
      {label}
      <OpenInNewIcon sx={{ fontSize: '0.85em', ml: 0.4, verticalAlign: '-0.15em' }} />
    </Box>
  );
};

export default SourceLink;
