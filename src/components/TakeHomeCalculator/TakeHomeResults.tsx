// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import type { TakeHomeResults, TakeHomeInputs } from '../../types/tax';
import SummaryTab from './tabs/SummaryTab';
import SocialInsuranceTab from './tabs/SocialInsuranceTab';
import TaxesTab from './tabs/TaxesTab';
import FurusatoNozeiTab from './tabs/FurusatoNozeiTab';

interface DetailedTaxResultsProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const TakeHomeResultsDisplay: React.FC<DetailedTaxResultsProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentTab, setCurrentTab] = React.useState(0);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Use ResizeObserver to track container width
  React.useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Use container width instead of screen breakpoint for tab labels
  // Threshold around 500px works well for tab label switching
  const useShortLabels = containerWidth > 0 && containerWidth < 500;
  
  const tabLabels = useShortLabels 
    ? ['Summary', 'Social', 'Taxes', 'Furusato']
    : ['Summary', 'Social Insurance', 'Taxes', 'Furusato Nozei'];

  return (
    <Paper
      ref={containerRef}
      elevation={0}
      sx={{
        p: { xs: 1.2, sm: 2 },
        bgcolor: 'background.paper',
        borderRadius: 3,
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '100%',
        width: '100%',
        mx: 'auto',
      }}
    >
      <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1.08rem', sm: '1.3rem' }, mb: { xs: 0.7, sm: 1.2 }, fontWeight: 700 }}>
        Take-Home Pay Breakdown
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: isMobile ? 36 : 48,
            '& .MuiTab-root': {
              fontSize: useShortLabels ? '0.8rem' : '0.9rem',
              minHeight: isMobile ? 36 : 48,
              padding: isMobile ? '6px 8px' : '12px 16px',
            }
          }}
        >
          {tabLabels.map((label, index) => (
            <Tab 
              key={label} 
              label={label} 
              id={`tab-${index}`}
              aria-controls={`tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {currentTab === 0 && (
          <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0">
            <SummaryTab results={results} />
          </Box>
        )}
        {currentTab === 1 && (
          <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1">
            <SocialInsuranceTab results={results} inputs={inputs} />
          </Box>
        )}
        {currentTab === 2 && (
          <Box role="tabpanel" id="tabpanel-2" aria-labelledby="tab-2">
            <TaxesTab results={results} />
          </Box>
        )}
        {currentTab === 3 && (
          <Box role="tabpanel" id="tabpanel-3" aria-labelledby="tab-3">
            <FurusatoNozeiTab results={results} />
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default TakeHomeResultsDisplay;
