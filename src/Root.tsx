// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, lazy } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';
import SiteHeader, { SITE_TITLE } from './components/SiteHeader';
import { theme } from './theme';
import './index.css';

// Defer loading of the main App component
const App = lazy(() => import('./App.tsx'));

// Animation keyframes
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// The loading screen renders the real site header so first paint carries the
// page title (its largest contentful element) instead of only a spinner —
// borders are not "content", so a bare spinner leaves first-paint metrics
// waiting for the whole app. App renders the same component when it loads,
// keeping the pixels identical; only the header's changelog button appears
// with the app.
export const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      bgcolor: 'background.default',
    }}
  >
    <SiteHeader title={SITE_TITLE} />
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
  </Box>
);

export const Root = () => {
  return (
    <ThemeProvider theme={theme} noSsr disableTransitionOnChange>
      <CssBaseline />
      <Suspense fallback={<LoadingFallback />}>
        <App />
      </Suspense>
    </ThemeProvider>
  );
};
