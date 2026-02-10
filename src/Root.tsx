// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, lazy, useState, useMemo } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';
import { getTheme } from './theme'
import './index.css'

// Defer loading of the main App component
const App = lazy(() => import('./App.tsx'))

// Animation keyframes
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Create a loading component
export const LoadingFallback = () => (
    <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default'
    }}>
        <Box sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid',
            borderColor: 'primary.main',
            borderTopColor: 'transparent',
            animation: `${spin} 1s linear infinite`,
        }} />
    </Box>
)

export const Root = () => {
    const [mode, setMode] = useState<'light' | 'dark'>(() => {
        // Check for saved theme preference
        const savedMode = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedMode) return savedMode;

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    });

    const theme = useMemo(() => getTheme(mode), [mode]);

    const toggleColorMode = () => {
        setMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newMode);
            return newMode;
        });
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Suspense fallback={<LoadingFallback />}>
                <App mode={mode} toggleColorMode={toggleColorMode} />
            </Suspense>
        </ThemeProvider>
    );
};
