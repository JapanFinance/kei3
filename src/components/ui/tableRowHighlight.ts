// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SxProps, Theme } from '@mui/material/styles';

/**
 * The shared "this is your row" highlight for the statutory reference tables in the tooltips.
 *
 * This is the calm variant: a tinted background plus a slightly heavier weight, sized for the
 * short, fully-visible tables rendered by {@link import('./ReferenceTable').default} (deduction
 * tiers, tax brackets, …). It deliberately reads quieter than the SMR premium table
 * ({@link import('../TakeHomeCalculator/tabs/SMRTableTooltip').default}), whose `primary.main`
 * background and scale transform are tuned for spotting one row inside a 47-row scrollable list.
 * Keeping the token here means every reference table marks the applicable row identically.
 */
export const HIGHLIGHTED_ROW_SX: SxProps<Theme> = {
  bgcolor: 'action.selected',
  fontWeight: 600,
};
