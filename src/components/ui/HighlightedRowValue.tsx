// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatJPY } from '../../utils/formatters';

interface HighlightedRowValueProps {
  /** What the figure is, phrased for the reader, e.g. "Net income". */
  label: string;
  /**
   * The taxpayer's figure that determines which {@link import('./ReferenceTable').default} row is
   * highlighted, in yen. Renders nothing when this is undefined or not positive — the same
   * condition under which the row highlight is suppressed — so the two always appear together.
   */
  value: number | undefined;
}

/**
 * A one-line caption that restates the taxpayer's own figure above a reference table, styling the
 * amount as a chip in the same `action.selected` tint as the highlighted row so it reads as "this
 * number puts you in that row". Without it the highlight is unexplained — most visibly on mobile,
 * where the tooltip covers the underlying breakdown that shows the figure.
 */
const HighlightedRowValue: React.FC<HighlightedRowValueProps> = ({ label, value }) => {
  if (value === undefined || value <= 0) {
    return null;
  }

  return (
    <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.85em', color: 'text.secondary' }}>
      {label}:{' '}
      <Box
        component="span"
        sx={{
          bgcolor: 'action.selected',
          color: 'text.primary',
          fontWeight: 600,
          px: 0.5,
          borderRadius: 0.5,
        }}
      >
        {formatJPY(value)}
      </Box>
    </Typography>
  );
};

export default HighlightedRowValue;
