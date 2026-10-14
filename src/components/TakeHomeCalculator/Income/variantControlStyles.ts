// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Styling shared by the small labelled toggle controls of the income entry form and the income
 * list (share type, account, reporting, the election for reported dividends), so that a choice
 * made in the list looks like the choices made on an entry.
 */
export const variantToggleGroupSx = {
  '& .MuiToggleButton-root': {
    px: 2,
    py: 0.5,
    fontSize: '0.85rem',
    fontWeight: 500,
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
};
