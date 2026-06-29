// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { AdditionalDeductionsResult } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import { ADDITIONAL_DEDUCTION_INFO } from '../additionalDeductionInfo';
import { DetailedTooltip } from '../../ui/Tooltips';

interface AdditionalDeductionsTooltipProps {
  deductions: AdditionalDeductionsResult;
  taxType: 'national' | 'residence';
}

/**
 * Tooltip for the "Other Deductions" row: a breakdown of the additional income deductions
 * (生命保険料控除 / 地震保険料控除 / 医療費控除) for the given tax, with per-item explanations and
 * sources. Renders its own DetailedTooltip trigger (titled per tax type), so callers place it
 * directly after the row label.
 */
const AdditionalDeductionsTooltip: React.FC<AdditionalDeductionsTooltipProps> = ({
  deductions,
  taxType,
}) => {
  const isNational = taxType === 'national';
  const getAmount = (item: AdditionalDeductionsResult['items'][number]) =>
    isNational ? item.national : item.residence;
  const rows = deductions.items.filter(item => getAmount(item) > 0);
  const total = isNational ? deductions.national : deductions.residence;

  return (
    <DetailedTooltip
      title={`Other Income Deductions (${isNational ? 'National' : 'Residence'} Tax)`}
    >
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 460 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Additional Deductions Breakdown
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
                  <TableCell>{ADDITIONAL_DEDUCTION_INFO[item.key].name}</TableCell>
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
            ? 'These reduce your taxable income for national income tax.'
            : 'These reduce your taxable income for residence tax. The life and earthquake insurance deductions are smaller for residence tax than for income tax.'}
        </Typography>
        {rows.map(item => {
          const info = ADDITIONAL_DEDUCTION_INFO[item.key];
          if (!info) return null;
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
                style={{ color: 'var(--primary-main)', textDecoration: 'underline' }}
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

export default AdditionalDeductionsTooltip;
