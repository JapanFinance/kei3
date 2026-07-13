// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  // Only `background` differs from MUI's defaults, overridden so paper
  // contrasts with the page: MUI's defaults make default and paper identical
  // (both #fff light, both #121212 dark), which would flatten cards against the
  // background. Everything else (primary, secondary, text, divider, action)
  // uses the default palette.
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
  },
});
