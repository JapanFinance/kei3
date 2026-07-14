// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  EMPLOYEES_PENSION_RATE,
  type PensionBonusBreakdownItem,
} from '../../../utils/pensionCalculator';
import { formatJPY, formatPercent, formatMonthShort } from '../../../utils/formatters';
import { bonusTableSx, bonusTotalRowStyle, bonusTotalCellStyle } from '../../ui/tooltipTableStyles';

interface PensionBonusTooltipProps {
  breakdown?: PensionBonusBreakdownItem[];
}

const PensionBonusTooltip: React.FC<PensionBonusTooltipProps> = ({ breakdown }) => {
  // Employee share is half
  const employeeRate = EMPLOYEES_PENSION_RATE / 2;

  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is calculated as follows, where the Standard Bonus Amount is the gross bonus
        rounded down to the nearest 1,000 yen.
      </Typography>

      <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          Standard Bonus Amount × {formatPercent(employeeRate)}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        The employer also pays an equal amount.
      </Typography>

      {breakdown && breakdown.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.9em' }}>
            Calculation Detail
          </Typography>
          <Box component="table" sx={bonusTableSx}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Bonus Total</th>
                <th>Std. Bonus Amt.</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((item, index) => (
                <tr key={index}>
                  <td>{formatMonthShort(item.month)}</td>
                  <td>{formatJPY(item.totalBonusAmount)}</td>
                  <td>
                    {formatJPY(item.standardBonusAmount)}
                    {item.standardBonusAmount < Math.floor(item.totalBonusAmount / 1000) * 1000 && (
                      <Box
                        component="span"
                        sx={{ color: 'warning.main', ml: 0.5 }}
                        title="Capped at 1,500,000 JPY"
                      >
                        *
                      </Box>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatJPY(item.premium)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={bonusTotalRowStyle}>
                <td style={bonusTotalCellStyle}>Total</td>
                <td style={bonusTotalCellStyle}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.totalBonusAmount, 0))}
                </td>
                <td style={bonusTotalCellStyle}></td>
                <td style={bonusTotalCellStyle}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.premium, 0))}
                </td>
              </tr>
            </tfoot>
          </Box>
        </Box>
      )}

      {/* Cap Note */}
      {breakdown?.some(
        item => item.standardBonusAmount < Math.floor(item.totalBonusAmount / 1000) * 1000,
      ) && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
              *
            </Box>
            Indicates the standard bonus amount is capped.
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
          Standard Bonus Amount Monthly Limit:
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          The standard bonus amount is capped at 1.5 million yen per month (adding all bonuses paid
          in the same month).
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
        Reference:{' '}
        <a
          href="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150515-01.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit' }}
        >
          厚生年金保険の保険料 (Japan Pension Service)
        </a>
      </Typography>
    </>
  );
};

export default PensionBonusTooltip;
