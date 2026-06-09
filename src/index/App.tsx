// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import SiteHeader from '../shared/components/SiteHeader'
import { CALCULATORS } from '../shared/calculators'
import type { PageProps } from '../shared/Root'

export default function App({ mode, toggleColorMode }: PageProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <SiteHeader title="Japan Finance Calculators" mode={mode} toggleColorMode={toggleColorMode} />

      <Box sx={{
        maxWidth: 1024,
        mx: 'auto',
        px: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 4, sm: 6 },
        pb: { xs: 6, sm: 8 },
      }}>
        <Typography variant="body1" sx={{ mb: { xs: 4, sm: 5 }, color: 'text.secondary' }}>
          Free, open-source tools to anchor Japan personal-finance decisions in real numbers.
        </Typography>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3,
        }}>
          {CALCULATORS.map((calc) => (
            <Card key={calc.href} variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea
                href={calc.href}
                sx={{
                  height: '100%',
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" component="h2">{calc.title}</Typography>
                  {calc.comingSoon && <Chip label="Coming soon" size="small" />}
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {calc.description}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
