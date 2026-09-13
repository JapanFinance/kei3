// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

import type { TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import {
  compareInvestmentTreatments,
  type InvestmentTreatmentColumn,
  type InvestmentTreatmentFigures,
} from '../../../utils/investmentTreatmentComparison';
import ReferenceTable from '../../ui/ReferenceTable';

interface InvestmentTreatmentComparisonProps {
  /** The calculation inputs behind the income modal's streams. */
  inputs: TakeHomeInputs;
}

const FIGURE_ROWS: readonly { key: keyof InvestmentTreatmentFigures; label: string }[] = [
  { key: 'kept', label: 'Kept after tax and insurance' },
  { key: 'incomeTax', label: 'Income tax' },
  { key: 'residenceTax', label: 'Residence tax' },
  { key: 'socialInsurance', label: 'Social insurance' },
  { key: 'furusatoNozeiLimit', label: 'Furusato nozei limit' },
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
  const [expanded, setExpanded] = useState(false);
  const columns = useMemo(
    () => (expanded ? compareInvestmentTreatments(inputs) : undefined),
    [expanded, inputs],
  );
  const unavailable = columns?.filter(column => column.unavailableReason !== undefined) ?? [];

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      sx={{ mt: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Compare tax treatments (課税方式の比較)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {columns && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Every capital-gains and dividends entry switched to one election at a time, with
              everything else as entered. A share sale is always reported under 申告分離課税 in the
              総合課税 column, since 措法37条の11 offers it no other reported treatment.
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <ReferenceTable
                headers={['' as React.ReactNode].concat(columns.map(columnHeader))}
                rows={FIGURE_ROWS.map(row =>
                  ([row.label] as React.ReactNode[]).concat(
                    columns.map(column =>
                      column.figures ? formatJPY(column.figures[row.key]) : '—',
                    ),
                  ),
                )}
              />
            </Box>
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
              The 総合課税 column has no 配当控除, which is not modelled yet, so its tax is
              overstated for a dividend from a domestic company. Under 申告不要 the tax withheld at
              source is counted in the tax rows and the investment income net of it in the amount
              kept, so the columns compare the same money; the summary keeps that income on its own
              row. The 20.315% withheld on a reported dividend is credited on the return
              (地方税法37条の4, 314条の9 for the 配当割) and is not shown as a refund.
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default InvestmentTreatmentComparison;
