// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  resolveOfficialSource,
  SOURCE_ORG_FULL_NAMES,
  type OfficialSourceRef,
} from '../../data/officialSources';
import SourceLink from './SourceLink';

interface SourceFooterProps {
  sources: OfficialSourceRef[];
}

/**
 * The standardized official-source footer: a hairline divider, a small uppercase
 * "Official source(s)" label, and one row per source — a de-emphasized organization tag (with the
 * full organization name on hover) followed by the linked document title.
 *
 * Tooltips get this automatically via the `sources` prop on `SimpleTooltip`/`DetailedTooltip`;
 * render it directly only from tooltip-content components whose sources are computed from data
 * (e.g. per-region NHI rate pages). Rows gain extra vertical padding below the `sm` breakpoint,
 * where the tooltip renders as a dialog and the links are tap targets.
 */
const SourceFooter: React.FC<SourceFooterProps> = ({ sources }) => {
  if (sources.length === 0) return null;
  return (
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
        {sources.length === 1 ? 'Official source' : 'Official sources'}
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          fontSize: '0.95em',
        }}
      >
        {sources.map((ref, i) => {
          const source = resolveOfficialSource(ref);
          const orgFullName = SOURCE_ORG_FULL_NAMES[source.org];
          return (
            <Box component="li" key={i} sx={{ py: { xs: 0.25, sm: 0 } }}>
              <Box
                component="span"
                sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                {...(orgFullName !== undefined && { title: orgFullName })}
              >
                {source.org}
                {' · '}
              </Box>
              <SourceLink source={source} variant="footer" />
              {source.gloss !== undefined && (
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {' '}
                  ({source.gloss})
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default SourceFooter;
