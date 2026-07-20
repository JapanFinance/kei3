// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import ThemeToggle from './ThemeToggle';

/**
 * Shared by {@link import('../App').default} and the loading fallback in
 * {@link import('../Root').Root}, which renders the same header so the title —
 * the page's largest contentful element — paints before the app has loaded.
 */
export const SITE_TITLE = 'Japan Take-Home Pay Calculator';

interface SiteHeaderProps {
  /** Title shown in the bar. */
  title: string;
  /** Optional controls rendered before the theme toggle (e.g. the changelog button). */
  actions?: ReactNode;
}

/**
 * Slim top bar for the app. Replaces the previous large in-page heading
 * with a compact bar that leaves more room for the calculator, especially
 * on mobile. Static (scrolls away with the page): its controls are "on
 * load" affordances, not needed while scrolling.
 */
export default function SiteHeader({ title, actions }: SiteHeaderProps) {
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1, py: 0.5 }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: { xs: '1.05rem', sm: '1.25rem' },
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {actions}
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  );
}
