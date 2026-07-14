// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared styles for the hand-rolled breakdown tables inside calculator tooltips. Two dialects
 * live here (data-driven reference tables are a third, covered by
 * {@link import('./ReferenceTable').default}):
 *
 * - Period-breakdown tables (`table*`/`cell*`/`header*`/`total*`): plain `<table>` elements
 *   styled via inline `style=`, listing per-month/per-period amounts with an "Annual Total"
 *   row. Used by NationalPensionTooltip, EmploymentInsuranceRateTooltip and
 *   HealthInsurancePremiumTooltip.
 * - Bonus-breakdown tables (`bonus*`): `<Box component="table">` styled via sx, with hairline
 *   rules under every row and a heavier `--border-strong` rule before the tfoot total. Used by
 *   PensionBonusTooltip and HealthInsuranceBonusTooltip.
 */

import type { SxProps, Theme } from '@mui/material/styles';

/** Period-breakdown `<table>` element: full width, collapsed borders, reduced type. */
export const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
} as const;

/** Period-breakdown body cell in the leading label column. */
export const cellStyle = { padding: '2px 8px 2px 0' } as const;

/** Period-breakdown body cell holding a numeric value: right-aligned. */
export const rightCellStyle = { ...cellStyle, textAlign: 'right' as const };

/** Period-breakdown header cell for the leading label column. */
export const headerStyle = {
  ...cellStyle,
  borderBottom: '1px solid var(--mui-palette-divider)',
  fontWeight: 'normal' as const,
};

/** Period-breakdown header cell over a numeric column: right-aligned. */
export const rightHeaderStyle = {
  ...rightCellStyle,
  borderBottom: '1px solid var(--mui-palette-divider)',
  fontWeight: 'normal' as const,
};

/** Period-breakdown total cell: separated from the body by a top rule, emphasized. */
export const totalStyle = {
  ...rightCellStyle,
  borderTop: '1px solid var(--mui-palette-divider)',
  fontWeight: 600,
};

/**
 * Bonus-breakdown `<Box component="table">` sx: hairline rule under every row, first column
 * left-aligned, all other columns right-aligned.
 */
export const bonusTableSx: SxProps<Theme> = {
  width: '100%',
  fontSize: '0.85em',
  borderCollapse: 'collapse',
  '& th': { textAlign: 'left', borderBottom: 1, borderColor: 'divider', p: 0.5 },
  '& td': { p: 0.5, borderBottom: 1, borderColor: 'divider' },
  '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'right' },
};

/** Bonus-breakdown tfoot total row: heavier rule than the per-row hairlines, bold text. */
export const bonusTotalRowStyle = {
  borderTop: '2px solid var(--border-strong)',
  fontWeight: 700,
} as const;

/** Cell inside the bonus-breakdown tfoot total row. */
export const bonusTotalCellStyle = { paddingTop: 4 } as const;
