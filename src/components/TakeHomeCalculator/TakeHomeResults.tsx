// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { TakeHomeResults, TakeHomeInputs } from '../../types/tax';
import { hasHighOutOfPocketCost } from '../../utils/furusatoNozei';
import { useLoadMilestone } from '../../utils/loadMilestones';
import FurusatoNozeiTab from './tabs/FurusatoNozeiTab';
import SocialInsuranceTab from './tabs/SocialInsuranceTab';
import SummaryTab from './tabs/SummaryTab';
import TaxesTab from './tabs/TaxesTab';

interface DetailedTaxResultsProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

// Width the high-out-of-pocket warning icon adds to the Furusato Nozei tab:
// the 16px glyph plus its 4px left margin.
const WARNING_ICON_WIDTH = 20;

// The full wordings stop fitting at different container widths in the two tab
// padding regimes: they need 469px of container at the desktop padding and
// 419px at the mobile padding (measured 2026-07, bold; Arial and Segoe UI
// fallbacks measure the same or narrower), so each regime gets its own
// threshold, ~3.5% above the need for rendering variance. The 600px media
// split must match the viewport breakpoint where the tab padding changes.
// While the warning icon shows, the wordings need its width on top, so both
// thresholds shift by it rather than the strip overflowing into scroll mode.
const narrowTabs = (styles: Record<string, string>, warningIconWidth: number) => ({
  [`@container (max-width: ${435 + warningIconWidth}px)`]: styles,
  '@media (min-width: 600px)': {
    [`@container (max-width: ${485 + warningIconWidth}px)`]: styles,
  },
});

// Long tab wordings shorten by dropping their trailing words, which a container
// query hides. Deciding in CSS rather than from a width measured after mount
// means the wording that survives is already in place at first paint, so the
// tab strip never re-lays-out. `display: none` also keeps the dropped words out
// of the accessible name.
const TAB_LABELS: readonly {
  head: string;
  tail?: string;
  warnsOnHighOutOfPocket?: true;
}[] = [
  { head: 'Summary' },
  { head: 'Social', tail: ' Insurance' },
  { head: 'Taxes' },
  { head: 'Furusato', tail: ' Nozei', warnsOnHighOutOfPocket: true },
];

const renderTabLabel = (
  { head, tail, warnsOnHighOutOfPocket }: (typeof TAB_LABELS)[number],
  warningIconWidth: number,
) => (
  // A single element keeps the wording on one line: MUI lays a Tab's children
  // out as a flex column, so a bare text node and the tail would stack.
  <span>
    {head}
    {tail && (
      <Box component="span" sx={narrowTabs({ display: 'none' }, warningIconWidth)}>
        {tail}
      </Box>
    )}
    {warnsOnHighOutOfPocket &&
      warningIconWidth > 0 && (
        // titleAccess renders an SVG <title>, which joins the tab's accessible
        // name so the warning is not color-and-shape only.
        <WarningIcon
          titleAccess="High out-of-pocket cost"
          sx={{ ml: 0.5, fontSize: '1rem', color: 'error.main', verticalAlign: 'text-bottom' }}
        />
      )}
  </span>
);

const TakeHomeResultsDisplay: React.FC<DetailedTaxResultsProps> = ({ results, inputs }) => {
  useLoadMilestone('results-rendered');

  const [currentTab, setCurrentTab] = React.useState(0);

  const warningIconWidth =
    results.furusatoNozei.limit > 0 && hasHighOutOfPocketCost(results.furusatoNozei)
      ? WARNING_ICON_WIDTH
      : 0;

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
              // Bold restores the apparent weight the labels had while they
              // rendered uppercase; uniform across states so selecting a tab
              // never changes tab widths.
              fontWeight: 700,
              // MUI's default 90px tab min-width plus bold short wordings fills
              // the narrowest two-column container (363px) to the last pixel;
              // 72px keeps the floor below every wording so tabs size to text.
              minWidth: 72,
              minHeight: { xs: 36, sm: 48 },
              padding: { xs: '6px 8px', sm: '12px 16px' },
              ...narrowTabs({ fontSize: '0.8rem' }, warningIconWidth),
            },
          }}
        >
          {TAB_LABELS.map((label, index) => (
            <Tab
              key={label.head}
              label={renderTabLabel(label, warningIconWidth)}
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
