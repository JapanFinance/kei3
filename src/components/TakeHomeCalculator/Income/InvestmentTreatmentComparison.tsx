// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useMemo, useState } from 'react';

import type { TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import {
  compareInvestmentTreatments,
  type InvestmentTreatmentColumn,
  type InvestmentTreatmentFigures,
} from '../../../utils/investmentTreatmentComparison';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import ReferenceTable from '../../ui/ReferenceTable';
import { DetailedTooltip } from '../../ui/Tooltips';

interface InvestmentTreatmentComparisonProps {
  /** The calculation inputs behind the income modal's streams. */
  inputs: TakeHomeInputs;
}

// Short labels so that the label column and the three election columns fit a phone screen.
const FIGURE_ROWS: readonly { key: keyof InvestmentTreatmentFigures; label: string }[] = [
  { key: 'kept', label: 'Take-home' },
  { key: 'incomeTax', label: 'Income tax' },
  { key: 'residenceTax', label: 'Residence tax' },
  { key: 'socialInsurance', label: 'Social insurance' },
  { key: 'furusatoNozeiLimit', label: 'Furusato limit' },
];

const columnHeader = (column: InvestmentTreatmentColumn) => (
  <span aria-current={column.isCurrent ? 'true' : undefined}>
    {column.label}
    {column.isCurrent && (
      <Typography component="span" variant="caption" sx={{ display: 'block', fontWeight: 400 }}>
        (current)
      </Typography>
    )}
  </span>
);

/**
 * Compares the three elections for the listed-share streams, each recomputed by
 * {@link compareInvestmentTreatments}. Collapsed by default: the three extra calculations run
 * only once it is expanded, and again whenever the inputs change while it stays open.
 */
export const InvestmentTreatmentComparison: React.FC<InvestmentTreatmentComparisonProps> = ({
  inputs,
}) => {
  const theme = useTheme();
  // A label column beside three yen columns does not fit a phone screen, so each election gets
  // its own two-column table there.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);
  const columns = useMemo(
    () => (expanded ? compareInvestmentTreatments(inputs) : undefined),
    [expanded, inputs],
  );
  const unavailable = columns?.filter(column => column.unavailableReason !== undefined) ?? [];
  const figureCell = (column: InvestmentTreatmentColumn, key: keyof InvestmentTreatmentFigures) =>
    column.figures ? formatJPY(column.figures[key]) : '—';

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      sx={{ mt: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Compare tax treatments
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {columns && (
          <Box>
            <Typography
              variant="body2"
              component="div"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <span>Every capital-gains and dividends entry under one election at a time.</span>
              <DetailedTooltip
                title="Comparing the Elections"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="comparison info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  Each column puts every capital-gains and dividends entry under one election, with
                  everything else as entered. A share sale is 申告分離課税 whenever it is reported
                  (措法37条の11), so it is taxed that way in the 総合課税 column too.
                </Typography>
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Take-home</strong> here is take-home pay plus, under 申告不要, the
                  investment income net of the tax withheld at source; that withheld tax is counted
                  in the tax rows. The columns therefore compare the same money, while the summary
                  keeps 申告不要 income on its own row.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  The 総合課税 column applies no 配当控除 (not modelled yet), so its tax is
                  overstated for a dividend from a domestic company. The 20.315% withheld on a
                  reported dividend is credited on the return (地方税法37条の4, 314条の9 for the
                  配当割) and is not shown as a refund.
                </Typography>
              </DetailedTooltip>
            </Typography>
            {isMobile ? (
              <Stack spacing={1.5}>
                {columns.map(column => (
                  <ReferenceTable
                    key={column.key}
                    headers={[columnHeader(column), '']}
                    rows={FIGURE_ROWS.map(row => [row.label, figureCell(column, row.key)])}
                  />
                ))}
              </Stack>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <ReferenceTable
                  headers={['' as React.ReactNode].concat(columns.map(columnHeader))}
                  rows={FIGURE_ROWS.map(row =>
                    ([row.label] as React.ReactNode[]).concat(
                      columns.map(column => figureCell(column, row.key)),
                    ),
                  )}
                />
              </Box>
            )}
            {unavailable.map(column => (
              <Typography
                key={column.key}
                variant="caption"
                sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
              >
                {column.label}: not available. {column.unavailableReason}
              </Typography>
            ))}
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              Take-home here includes withheld-only investment income net of the tax withheld, so
              every column counts the same money. The 総合課税 column has no 配当控除, which is not
              modelled yet.
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default InvestmentTreatmentComparison;
