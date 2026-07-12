// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, lazy } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';
import { theme } from './theme';
import './index.css';

// Defer loading of the main App component
const App = lazy(() => import('./App.tsx'));

// Animation keyframes
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Create a loading component
export const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      bgcolor: 'background.default',
    }}
  >
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '4px solid',
        borderColor: 'primary.main',
        borderTopColor: 'transparent',
        animation: `${spin} 1s linear infinite`,
      }}
    />
  </Box>
);

export const Root = () => {
  // MUI owns the color scheme: it reads/persists the mode (localStorage
  // 'mui-mode'), syncs across tabs, and toggles the .light/.dark class on
  // <html>. `defaultMode="system"` follows the OS preference until the user
  // chooses one via the ThemeToggle (which uses useColorScheme).
  return (
    <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
      <CssBaseline />
      <Suspense fallback={<LoadingFallback />}>
        <App />
      </Suspense>
    </ThemeProvider>
  );
};
