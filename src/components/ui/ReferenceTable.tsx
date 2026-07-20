// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

/**
 * The calm "this is your row" highlight for the row the current taxpayer falls in (see
 * `highlightedRow`): a tinted background plus a slightly heavier weight, sized for these short,
 * fully-visible tables. It reads quieter than the SMR premium table
 * ({@link import('../TakeHomeCalculator/tabs/SMRTableTooltip').default}), whose `primary.main`
 * background and scale transform are tuned for spotting one row inside a 47-row scrollable list.
 */
const HIGHLIGHTED_ROW_SX: SxProps<Theme> = {
  bgcolor: 'action.selected',
  fontWeight: 600,
};

interface ReferenceTableProps {
  /** Column headings, one per column. */
  headers: React.ReactNode[];
  /** Table body: an array of rows, each an array of cells matching the header count. */
  rows: React.ReactNode[][];
  /**
   * Zero-based index (into `rows`) of the row that applies to the current taxpayer, given a calm
   * "this is your row" highlight. Omit (or pass an out-of-range value) to highlight nothing — do
   * that whenever the applicable row can't be determined, e.g. the driving value is 0/undefined.
   */
  highlightedRow?: number | undefined;
}

/**
 * The compact two/three-column reference table used across the calculator tooltips (deduction
 * tiers, tax brackets, per-capita amounts, …). Feed it `headers` and `rows` as data; the borders,
 * padding and font sizing are baked in so every tooltip table renders identically.
 */
const ReferenceTable: React.FC<ReferenceTableProps> = ({ headers, rows, highlightedRow }) => (
  <Box
    component="table"
    sx={{
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: '0.95em',
      '& td': {
        padding: '2px 6px',
      },
      '& th': {
        borderBottom: 1,
        borderColor: 'divider',
        padding: '2px 6px',
        textAlign: 'left',
      },
    }}
  >
    <thead>
      <tr>
        {headers.map((header, i) => (
          <th key={i} scope="col">
            {header}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => {
        const isHighlighted = ri === highlightedRow;
        return (
          <Box
            component="tr"
            key={ri}
            aria-current={isHighlighted ? 'true' : undefined}
            sx={isHighlighted ? HIGHLIGHTED_ROW_SX : undefined}
          >
            {row.map((cell, ci) => (
              <td key={ci}>{cell}</td>
            ))}
          </Box>
        );
      })}
    </tbody>
  </Box>
);

export default ReferenceTable;
