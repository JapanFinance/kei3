// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  // Only `background` differs from MUI's defaults, overridden so paper
  // contrasts with the page.
  colorSchemes: {
    light: { palette: { background: { default: '#f5f5f5' } } },
    dark: { palette: { background: { paper: '#1e1e1e' } } },
  },
  components: {
    // Default all input fields to the compact "small" size for visual
    // consistency. MuiFormControl cascades its size to the Select/Input it
    // wraps, so every FormControl-wrapped Select inherits this automatically
    // (no MuiSelect default needed). MuiTextField covers standalone text
    // fields (e.g. SpinnerNumberField), and MuiAutocomplete keeps the
    // Autocomplete's internal layout aligned with its small input.
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiAutocomplete: { defaultProps: { size: 'small' } },
    // Soften the resting outline on every outlined input: use the theme's
    // divider colour (0.12 opacity) instead of MUI's default 0.23.
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: 'var(--mui-palette-divider)' },
      },
    },
  },
});
