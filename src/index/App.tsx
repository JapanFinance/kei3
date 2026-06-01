// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import ThemeToggle from '../shared/components/ThemeToggle'
import type { PageProps } from '../shared/Root'

interface CalculatorLink {
  title: string
  description: string
  href: string
  comingSoon?: boolean
}

const calculators: CalculatorLink[] = [
  {
    title: 'Take-Home Pay Calculator',
    description: 'Estimate your net pay in Japan: income tax, residence tax, health insurance, pension, and Furusato Nozei limits.',
    href: '/takehome/',
  },
  {
    title: 'Home Loan Rate Simulator',
    description: 'Compare fixed vs. variable mortgage rate scenarios and see how interest costs play out over time.',
    href: '/loan/',
    comingSoon: true,
  },
]

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
          Japan Finance Calculators
        </Typography>
        <ThemeToggle mode={mode} toggleColorMode={toggleColorMode} />
      </Box>

      <Typography variant="body1" sx={{ mb: { xs: 4, sm: 5 }, color: 'text.secondary' }}>
        Free, open-source tools to anchor Japan personal-finance decisions in real numbers.
      </Typography>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 3,
      }}>
        {calculators.map((calc) => (
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
  )
}
