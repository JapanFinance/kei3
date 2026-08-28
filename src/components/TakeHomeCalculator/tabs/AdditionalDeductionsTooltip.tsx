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

import type { AdditionalDeductionsResult, PersonalDeductionsResult } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import { DetailedTooltip } from '../../ui/Tooltips';
import { ADDITIONAL_DEDUCTION_INFO, getPersonalDeductionInfo } from '../additionalDeductionInfo';

interface AdditionalDeductionsTooltipProps {
  deductions: AdditionalDeductionsResult;
  /** The taxpayer's own 人的控除, shown in the same breakdown; absent when none applies. */
  personalDeductions?: PersonalDeductionsResult | undefined;
  /** Income year, for the year-dependent figures in the personal-deduction explanations. */
  incomeYear: number;
  taxType: 'national' | 'residence';
}

/**
 * Tooltip for the "Other Deductions" row: a breakdown of the additional income deductions
 * (生命保険料控除 / 地震保険料控除 / 医療費控除) and the taxpayer's own 人的控除
 * (障害者控除 / 寡婦控除 / ひとり親控除) for the given tax, with per-item explanations and
 * sources. The row shows the two groups combined to keep the tab short; the residence-tax note
 * about the 調整控除 appears only when a 人的控除 is present, since the 物的控除 do not affect it.
 * Renders its own DetailedTooltip trigger (titled per tax type), so callers place it directly
 * after the row label.
 */
const AdditionalDeductionsTooltip: React.FC<AdditionalDeductionsTooltipProps> = ({
  deductions,
  personalDeductions,
  incomeYear,
  taxType,
}) => {
  const isNational = taxType === 'national';
  const getAmount = (item: { national: number; residence: number }) =>
    isNational ? item.national : item.residence;
  // One combined row list: each item pairs its per-tax amounts with its display metadata, so the
  // table rows and the explanation blocks below stay in the same order.
  const rows = [
    ...deductions.items.map(item => ({ item, info: ADDITIONAL_DEDUCTION_INFO[item.key] })),
    ...(personalDeductions?.items ?? []).map(item => ({
      item,
      info: getPersonalDeductionInfo(incomeYear)[item.key],
    })),
  ].filter(({ item }) => getAmount(item) > 0);
  const total = getAmount(deductions) + (personalDeductions ? getAmount(personalDeductions) : 0);
  const hasPersonal = (personalDeductions?.items.length ?? 0) > 0;

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
              {rows.map(({ item, info }) => (
                <TableRow key={item.key}>
                  <TableCell>{info.name}</TableCell>
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
            ? 'These reduce taxable income for national income tax.'
            : 'These reduce taxable income for residence tax. The life and earthquake insurance deductions are smaller for residence tax than for income tax.'}
        </Typography>
        {!isNational && hasPersonal && (
          <Typography variant="body2" sx={{ fontSize: '0.85em', color: 'text.secondary', mb: 1 }}>
            The disability, widow, and single parent deductions are personal deductions (人的控除),
            so they also raise the 人的控除額の差 behind the adjustment credit (調整控除), which
            offsets part of the gap between the two taxes.
          </Typography>
        )}
        {rows.map(({ item, info }) => (
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
        ))}
      </Box>
    </DetailedTooltip>
  );
};

export default AdditionalDeductionsTooltip;
