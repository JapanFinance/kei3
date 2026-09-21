// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import type { IncomeStream, ReportedDividendsTaxation, TakeHomeInputs } from '../../../types/tax';
import { formatJPY, formatNumber } from '../../../utils/formatters';
import type { PlanFigures } from '../../../utils/reportingPlanner';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import ReferenceTable from '../../ui/ReferenceTable';
import { DetailedTooltip } from '../../ui/Tooltips';
import { type ReportingRow, type SearchProgress, useReportingPlans } from './useReportingPlans';

interface ReportingPlannerProps {
  /** The calculation inputs behind the income modal's streams. */
  inputs: TakeHomeInputs;
  /** Applies a row's plan: every entry's reporting flags. */
  onStreamsChange: (streams: IncomeStream[]) => void;
  /** Applies a row's plan: the election its reported dividends, if any, are taxed under. */
  onReportedDividendsTaxationChange?: ((election: ReportedDividendsTaxation) => void) | undefined;
}

const FIGURE_COLUMNS: readonly { key: keyof PlanFigures; label: string }[] = [
  { key: 'kept', label: 'Take-home' },
  { key: 'incomeTax', label: 'Income tax' },
  { key: 'residenceTax', label: 'Residence tax' },
  { key: 'socialInsurance', label: 'Social insurance' },
  { key: 'furusatoNozeiLimit', label: 'Furusato limit' },
  { key: 'totalIncome', label: 'Net income (合計所得金額)' },
];

const CURRENT_KEEPS_MOST = 'The current choices already keep the most.';

/**
 * The short column heading for a plan in the desktop table, where the full row labels would
 * wrap several times: the uniform plans are named by their election, matching the election
 * toggle's "Separate"/"Aggregate"; Current and Best keep their labels.
 */
const columnLabel = (row: ReportingRow): string => {
  switch (row.key) {
    case 'withheldOnly':
      return 'Withheld only';
    case 'separate':
      return 'Separate';
    case 'aggregate':
      return 'Aggregate';
    default:
      return row.label;
  }
};

/**
 * The phone card's title: the full row labels for the uniform plans wrap at 375 px, so they
 * shorten to "All" plus the election, the way the desktop columns do.
 */
const cardTitle = (row: ReportingRow): string => {
  switch (row.key) {
    case 'withheldOnly':
      return 'All withheld only';
    case 'separate':
      return 'All reported, separate taxation';
    case 'aggregate':
      return 'All reported, aggregate taxation';
    default:
      return row.label;
  }
};

/**
 * What applying the Best plan would change, as a list, or the note that nothing would: Current
 * needs no text (the entry cards above show its choices) and a uniform plan's name says what it
 * sets, so only Best carries instructions, and only for the entries it changes.
 */
const BestChanges: React.FC<{ row: ReportingRow }> = ({ row }) =>
  row.canApply ? (
    <>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Changes from the current entries:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
        {row.changes.map(change => (
          <li key={change}>{change}</li>
        ))}
      </Box>
    </>
  ) : (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {CURRENT_KEEPS_MOST}
    </Typography>
  );

/**
 * The search indicator, at the top of the panel so it is in view right after expanding: a
 * determinate bar with "done of count" while the search is exhaustive, an indeterminate one with
 * the plans checked so far once it has fallen back to descent, whose length is not known ahead.
 */
const SearchIndicator: React.FC<{ progress: SearchProgress }> = ({ progress }) => (
  <Box sx={{ mb: 1.5 }}>
    {progress.count === undefined ? (
      <LinearProgress />
    ) : (
      <LinearProgress variant="determinate" value={(progress.done / progress.count) * 100} />
    )}
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {progress.count === undefined
        ? `Searching: ${formatNumber(progress.done)} plans checked`
        : `Searching: ${formatNumber(progress.done)} of ${formatNumber(progress.count)} plans`}
    </Typography>
  </Box>
);

/**
 * Searches the ways to report the capital-gains and dividends entries that are not already fixed
 * — one election per account and per domestic dividend — and shows, for each, the same figures
 * the summary and tabs use (7.3.4). Collapsed by default: {@link useReportingPlans} runs the
 * search only once expanded, and again whenever the inputs change while it stays open.
 */
export const ReportingPlanner: React.FC<ReportingPlannerProps> = ({
  inputs,
  onStreamsChange,
  onReportedDividendsTaxationChange,
}) => {
  const theme = useTheme();
  // The dialog is about 550px wide, which fits a column per plan but not a column per figure,
  // so plans are the columns and Best's change list sits under the table. A phone screen fits
  // neither, so each plan gets its own two-column table there, as the comparison this replaces
  // did for each election.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);
  const { rows, mandatoryNote, progress, showProgress, bounded, boundedEstimate } =
    useReportingPlans(inputs, expanded);

  const applyRow = (row: ReportingRow) => {
    onStreamsChange(row.evaluated.streams);
    onReportedDividendsTaxationChange?.(row.evaluated.election);
  };

  const applyButton = (row: ReportingRow) =>
    row.canApply ? (
      <Button size="small" variant="outlined" onClick={() => applyRow(row)}>
        Apply
      </Button>
    ) : undefined;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      sx={{ mt: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Compare reporting plans
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {rows && (
          <Box>
            <Typography
              variant="body2"
              component="div"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <span>Ways to report the capital-gains and dividends entries.</span>
              <DetailedTooltip
                title="Reporting Plans"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="reporting plans info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  Each plan is one way to set the entries that are not fixed already, one election
                  per withholding designated account and per domestic-dividend entry: Current is the
                  entries as they stand, Best is the plan found to keep the most, and the rest set
                  every such entry the same way. Apply sets every entry and the election to that
                  plan&apos;s choices.
                </Typography>
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Take-home</strong> here is take-home pay plus, for an amount left to
                  withholding, that amount net of the tax withheld at source; that withheld tax is
                  counted in the tax rows instead. Every row therefore compares the same money,
                  while the summary keeps withheld-only income on its own row.
                </Typography>
                {mandatoryNote && (
                  <Typography sx={{ display: 'block' }}>
                    {mandatoryNote.replace(/\.$/, '')} (措法37条の11の5①, 措令4条の3②).
                  </Typography>
                )}
              </DetailedTooltip>
            </Typography>
            {showProgress && progress && <SearchIndicator progress={progress} />}
            {isMobile ? (
              <Stack spacing={1.5}>
                {rows.map(row => (
                  // One card per plan: the figures under the plan's name as the table's caption,
                  // then (for Best) what applying it changes, and Apply, framed so the text
                  // reads as part of the plan rather than of the next one. The Best card is outlined in the primary
                  // colour so it stands out among the references.
                  <Box
                    key={row.key}
                    sx={{
                      border: 1,
                      borderColor: row.key === 'best' ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      p: 1,
                    }}
                  >
                    <ReferenceTable
                      caption={cardTitle(row)}
                      headers={[]}
                      rows={FIGURE_COLUMNS.map(column => [
                        column.label,
                        formatJPY(row.evaluated.figures[column.key]),
                      ])}
                    />
                    {row.key === 'best' && (
                      <Box
                        sx={{
                          mt: 1,
                          pt: 1,
                          // Lines up with the table text, which sits inside the cells' padding.
                          px: 0.75,
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <BestChanges row={row} />
                      </Box>
                    )}
                    {applyButton(row) && <Box sx={{ mt: 1, px: 0.75 }}>{applyButton(row)}</Box>}
                  </Box>
                ))}
              </Stack>
            ) : (
              <>
                {/* Six columns fit the dialog only at this size, with the figure names wrapping. */}
                <Box
                  sx={{
                    overflowX: 'auto',
                    fontSize: '0.8rem',
                    '& td, & th': { whiteSpace: 'nowrap' },
                    '& td:first-of-type': { whiteSpace: 'normal' },
                  }}
                >
                  <ReferenceTable
                    headers={([''] as React.ReactNode[]).concat(
                      rows.map(row => (
                        <Box
                          key={row.key}
                          component="span"
                          sx={{ fontWeight: row.key === 'best' ? 700 : undefined }}
                        >
                          {columnLabel(row)}
                        </Box>
                      )),
                    )}
                    rows={FIGURE_COLUMNS.map(column =>
                      ([column.label] as React.ReactNode[]).concat(
                        rows.map(row => formatJPY(row.evaluated.figures[column.key])),
                      ),
                    )}
                  />
                </Box>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {rows
                    .filter(row => row.key === 'best' || row.canApply)
                    .map(row => (
                      <Box key={row.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2">
                            <strong>{row.label}</strong>
                          </Typography>
                          {row.key === 'best' && <BestChanges row={row} />}
                        </Box>
                        {applyButton(row)}
                      </Box>
                    ))}
                </Stack>
              </>
            )}
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              This year only. The aggregate-taxation (総合課税) rows apply no dividend tax credit
              (配当控除, not modelled yet), so for a dividend from a Japanese company they
              understate what is kept. Carrying a loss forward (繰越控除), the foreign tax credit
              (外国税額控除), and the rule that lets an employee skip filing when other income is
              ¥200,000 or less are not modelled either. Entries that have to be reported stay
              reported in every plan.
              {bounded && boundedEstimate && (
                <>
                  {' '}
                  The search was bounded: {formatNumber(boundedEstimate.count)} plans would have
                  taken about {(boundedEstimate.predictedMs / 1000).toFixed(1)} seconds here, so the
                  planner improved the best uniform plan one entry at a time.
                </>
              )}
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default ReportingPlanner;
