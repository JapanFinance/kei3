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
  // Only values that differ from MUI's defaults are set here; everything else
  // (secondary, text, divider, action, the other background half) uses the
  // default palette. `primary.main` equals the default but must be present to
  // attach the custom `50` shade — a light-blue tint used by tooltip callouts
  // (bgcolor: 'primary.50'). `background` is overridden so paper contrasts with
  // the page: MUI's defaults make default and paper identical (both #fff light,
  // both #121212 dark), which would flatten cards against the background.
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1976d2', 50: '#e3f2fd' },
        background: { default: '#f5f5f5' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#1976d2', 50: 'rgba(25, 118, 210, 0.12)' },
        background: { paper: '#1e1e1e' },
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
