// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Styling shared by the small labelled toggle controls of the income entry form and the income
 * list (share type, account, reporting, the election for reported dividends), so that a choice
 * made in the list looks like the choices made on an entry.
 */
export const variantToggleGroupSx = {
  height: { xs: 34, sm: 40 },
  '& .MuiToggleButton-root': {
    px: { xs: 1.5, sm: 2 },
    py: { xs: 0.25, sm: 0.5 },
    fontSize: { xs: '0.8rem', sm: '0.85rem' },
    fontWeight: 500,
    height: '100%',
    boxSizing: 'border-box',
  },
  '& .MuiToggleButton-root.Mui-selected': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '&:hover': {
      bgcolor: 'primary.dark',
    },
  },
};

export const variantLabelSx = {
  mb: 0.5,
  fontWeight: 500,
  color: 'text.primary',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: { xs: 20, sm: 24 },
};
