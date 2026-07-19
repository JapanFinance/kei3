// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
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

// Below this width the full wordings no longer fit across the tab strip.
const NARROW_TABS = '@container (max-width: 500px)';

// Long tab wordings shorten by dropping their trailing words, which a container
// query hides. Deciding in CSS rather than from a width measured after mount
// means the wording that survives is already in place at first paint, so the
// tab strip never re-lays-out. `display: none` also keeps the dropped words out
// of the accessible name.
const TAB_LABELS: readonly { head: string; tail?: string }[] = [
  { head: 'Summary' },
  { head: 'Social', tail: ' Insurance' },
  { head: 'Taxes' },
  { head: 'Furusato', tail: ' Nozei' },
];

const renderTabLabel = ({ head, tail }: (typeof TAB_LABELS)[number]) => (
  // A single element keeps the wording on one line: MUI lays a Tab's children
  // out as a flex column, so a bare text node and the tail would stack.
  <span>
    {head}
    {tail && (
      <Box component="span" sx={{ [NARROW_TABS]: { display: 'none' } }}>
        {tail}
      </Box>
    )}
  </span>
);

const TakeHomeResultsDisplay: React.FC<DetailedTaxResultsProps> = ({ results, inputs }) => {
  const [currentTab, setCurrentTab] = React.useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Paper
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
      <Typography
        variant="h6"
        component="h2"
        sx={{
          fontSize: { xs: '1.08rem', sm: '1.3rem' },
          mb: { xs: 0.7, sm: 1.2 },
          fontWeight: 700,
        }}
      >
        Take-Home Pay Breakdown
      </Typography>

      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 2,
          containerType: 'inline-size',
        }}
      >
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: { xs: 36, sm: 48 },
            '& .MuiTab-root': {
              fontSize: '0.9rem',
              minHeight: { xs: 36, sm: 48 },
              padding: { xs: '6px 8px', sm: '12px 16px' },
              [NARROW_TABS]: { fontSize: '0.8rem' },
            },
          }}
        >
          {TAB_LABELS.map((label, index) => (
            <Tab
              key={label.head}
              label={renderTabLabel(label)}
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
            <TaxesTab results={results} inputs={inputs} />
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
