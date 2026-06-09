// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import SiteHeader from '../shared/components/SiteHeader'
import type { PageProps } from '../shared/Root'

export default function App({ mode, toggleColorMode }: PageProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <SiteHeader title="Home Loan Simulator" mode={mode} toggleColorMode={toggleColorMode} />

      <Box sx={{
        maxWidth: 1024,
        mx: 'auto',
        px: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 4, sm: 6 },
        pb: { xs: 6, sm: 8 },
      }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          A tool to simulate fixed vs. variable mortgage rate scenarios is coming soon.
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
          It will let you compare how interest costs play out under different future rate paths, so
          discussions can focus on which scenarios are likely rather than guessing at outcomes.
        </Typography>
      </Box>
    </Box>
  )
}
