// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/sx';

interface ReferenceTableProps {
  /** Column headings, one per column. */
  headers: React.ReactNode[];
  /** Table body: an array of rows, each an array of cells matching the header count. */
  rows: React.ReactNode[][];
  /** Overrides/extends the table styling. */
  sx?: SxProps<Theme>;
}

/**
 * The compact two/three-column reference table used across the calculator tooltips (deduction
 * tiers, tax brackets, per-capita amounts, …). Feed it `headers` and `rows` as data; the borders,
 * padding and font sizing are baked in so every tooltip table renders identically.
 */
const ReferenceTable: React.FC<ReferenceTableProps> = ({ headers, rows, sx }) => (
  <Box
    component="table"
    sx={mergeSx(
      {
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
      },
      sx,
    )}
  >
    <thead>
      <tr>
        {headers.map((header, i) => (
          <th key={i}>{header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td key={ci}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </Box>
);

export default ReferenceTable;
