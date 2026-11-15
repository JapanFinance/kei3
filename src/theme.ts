// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  // Consistent keyboard-only focus ring (2px primary outline, 2px offset)
  // across all components, replacing each component's own focus treatment.
  // https://mui.com/material-ui/customization/focus-visible/
  focusVisible: true,
  // Override light-mode `background` so paper contrasts with the page, and
  // darken `primary.main` / `warning.main` from MUI's defaults (#1976d2 /
  // #ed6c02) so text using those tokens maintains >= 4.5:1 WCAG AA contrast
  // on both white paper and tinted summary/banner backgrounds.
  colorSchemes: {
    light: {
      palette: {
        background: { default: '#f5f5f5' },
        primary: { main: '#1565c0' },
        warning: { main: '#c2410c' },
      },
    },
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
    MuiSlider: {
      styleOverrides: {
        mark: {
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'currentColor',
        },
        markActive: {
          opacity: 1,
          backgroundColor: 'currentColor',
        },
        markLabel: {
          fontSize: '0.75rem',
          color: 'var(--mui-palette-text-secondary)',
          marginTop: 8,
        },
      },
    },
    // Render button and tab labels as written instead of MUI's default
    // uppercase transform. Sites that want a transform set it explicitly in sx.
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    // Every accordion in the app is the flat kind: no shadow, no expanded
    // gutter jump, outlined with the divider hairline. Call sites keep only
    // their spacing.
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid var(--mui-palette-divider)' },
      },
    },
  },
});
