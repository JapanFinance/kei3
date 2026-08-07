// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { PersonalDeductionsResult } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import { DetailedTooltip } from '../../ui/Tooltips';
import { PERSONAL_DEDUCTION_INFO } from '../additionalDeductionInfo';

interface PersonalDeductionsTooltipProps {
  deductions: PersonalDeductionsResult;
  taxType: 'national' | 'residence';
}

/**
 * Tooltip for the "Personal Deductions" row: a breakdown of the taxpayer's own 人的控除
 * (障害者控除 / 寡婦控除 / ひとり親控除) for the given tax, with per-item explanations and sources.
 * Renders its own DetailedTooltip trigger (titled per tax type), so callers place it directly
 * after the row label.
 */
const PersonalDeductionsTooltip: React.FC<PersonalDeductionsTooltipProps> = ({
  deductions,
  taxType,
}) => {
  const isNational = taxType === 'national';
  const getAmount = (item: PersonalDeductionsResult['items'][number]) =>
    isNational ? item.national : item.residence;
  const rows = deductions.items.filter(item => getAmount(item) > 0);
  const total = isNational ? deductions.national : deductions.residence;

  return (
    <DetailedTooltip title={`Personal Deductions (${isNational ? 'National' : 'Residence'} Tax)`}>
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 460 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Personal Deductions Breakdown
        </Typography>
        <TableContainer component={Box} sx={{ mb: 2 }}>
          <Table
            size="small"
            sx={{ '& .MuiTableCell-root': { padding: '2px 6px', fontSize: '0.95em' } }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Deduction</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(item => (
                <TableRow key={item.key}>
                  <TableCell>{PERSONAL_DEDUCTION_INFO[item.key].name}</TableCell>
                  <TableCell align="right">{formatJPY(getAmount(item))}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatJPY(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="body2" sx={{ fontSize: '0.85em', color: 'text.secondary', mb: 1 }}>
          {isNational
            ? "Deductions for the taxpayer's own status, as opposed to a dependent's. These reduce taxable income for national income tax."
            : 'These reduce taxable income for residence tax, by less than for income tax. Being 人的控除, they also raise the 人的控除額の差 behind the adjustment credit (調整控除), which offsets part of that gap.'}
        </Typography>
        {rows.map(item => {
          const info = PERSONAL_DEDUCTION_INFO[item.key];
          return (
            <Typography
              key={item.key}
              variant="body2"
              sx={{ fontSize: '0.85em', color: 'text.secondary', mt: 1 }}
            >
              <strong>{info.name}:</strong> {info.explanation}{' '}
              <a
                href={info.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--mui-palette-primary-main)', textDecoration: 'underline' }}
              >
                {info.sourceLabel}
              </a>
            </Typography>
          );
        })}
      </Box>
    </DetailedTooltip>
  );
};

export default PersonalDeductionsTooltip;
