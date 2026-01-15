// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  
  // Set CSS variables on the root element
  const root = document.documentElement;
  root.style.setProperty('--background-default', isDark ? '#121212' : '#f5f5f5');
  root.style.setProperty('--background-paper', isDark ? '#1e1e1e' : '#ffffff');
  root.style.setProperty('--text-primary', isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.87)');
  root.style.setProperty('--text-secondary', isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)');
  root.style.setProperty('--divider', isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)');
  root.style.setProperty('--action-hover', isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)');
  root.style.setProperty('--action-selected', isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)');
  root.style.setProperty('--primary-main', '#1976d2');
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#9c27b0',
      },
      background: {
        default: isDark ? '#121212' : '#f5f5f5',
        paper: isDark ? '#1e1e1e' : '#ffffff',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: 'var(--background-default)',
            color: 'var(--text-primary)',
          },
        },
      },
    },
  });
};
