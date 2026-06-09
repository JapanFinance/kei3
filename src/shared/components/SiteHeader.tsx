// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ThemeToggle from './ThemeToggle'
import { CALCULATORS } from '../calculators'

interface SiteHeaderProps {
  /** Title shown in the bar — the only part that changes between pages. */
  title: string
  mode: 'light' | 'dark'
  toggleColorMode: () => void
  /** Optional page-specific controls, rendered between the nav and the theme toggle. */
  actions?: ReactNode
}

// Normalize a path for active-link comparison (ignore the trailing slash).
const normalizePath = (path: string): string => path.replace(/\/+$/, '') || '/'

/**
 * Shared top bar rendered on every page. The layout (home link, nav links,
 * theme toggle) is identical everywhere for continuity; only the title text
 * and optional per-page actions differ.
 */
export default function SiteHeader({ title, mode, toggleColorMode, actions }: SiteHeaderProps) {
  const currentPath = normalizePath(window.location.pathname)

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 1 } }}>
        <Tooltip title="All calculators">
          <IconButton edge="start" href="/" aria-label="All calculators" color="inherit">
            <HomeOutlinedIcon />
          </IconButton>
        </Tooltip>

        <Typography
          variant="h6"
          component="h1"
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: { xs: '1rem', sm: '1.125rem' },
            fontWeight: 600,
          }}
        >
          {title}
        </Typography>

        <Box component="nav" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {CALCULATORS.map((calc) => {
            const isActive = normalizePath(calc.href) === currentPath
            return (
              <Button
                key={calc.href}
                href={calc.href}
                size="small"
                color="inherit"
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  minWidth: 'auto',
                  px: { xs: 0.75, sm: 1 },
                }}
              >
                {calc.label}
              </Button>
            )
          })}
        </Box>

        {actions}

        <ThemeToggle mode={mode} toggleColorMode={toggleColorMode} />
      </Toolbar>
    </AppBar>
  )
}
