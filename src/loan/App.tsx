// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import ThemeToggle from '../shared/components/ThemeToggle'
import type { PageProps } from '../shared/Root'

export default function App({ mode, toggleColorMode }: PageProps) {
  return (
    <Box sx={{
      maxWidth: 1024,
      mx: 'auto',
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 4, sm: 6, md: 8 },
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
    }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        mb: { xs: 3, sm: 4 },
      }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Home Loan Rate Simulator
        </Typography>
        <ThemeToggle mode={mode} toggleColorMode={toggleColorMode} />
      </Box>

      <Typography variant="body1" sx={{ mb: 2 }}>
        A tool to simulate fixed vs. variable mortgage rate scenarios is coming soon.
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
        It will let you compare how interest costs play out under different future rate paths, so
        discussions can focus on which scenarios are likely rather than guessing at outcomes.
      </Typography>

      <Box sx={{ mt: 4 }}>
        <Link href="/">&larr; Back to all calculators</Link>
      </Box>
    </Box>
  )
}
