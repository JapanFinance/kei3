// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    50?: string;
  }
  interface SimplePaletteColorOptions {
    50?: string;
  }
}

// CSS theme variables + colorSchemes let MUI own light/dark: it generates
// --mui-palette-* variables per scheme and toggles the .light/.dark class on
// <html> (colorSchemeSelector: 'class'), driven by useColorScheme. The palette
// lives under colorSchemes (not a top-level `palette`, which would take
// precedence). index.css aliases the app's own custom vars to --mui-palette-*,
// so no per-mode JavaScript is needed.
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1976d2', 50: '#e3f2fd' },
        secondary: { main: '#9c27b0' },
        background: { default: '#f5f5f5', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#1976d2', 50: 'rgba(25, 118, 210, 0.12)' },
        secondary: { main: '#9c27b0' },
        background: { default: '#121212', paper: '#1e1e1e' },
      },
    },
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
