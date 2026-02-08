// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PENSION_RATE, type PensionBonusBreakdownItem } from '../../../utils/pensionCalculator';
import { formatJPY, formatPercent } from '../../../utils/formatters';

interface PensionBonusTooltipProps {
  breakdown?: PensionBonusBreakdownItem[];
}

const PensionBonusTooltip: React.FC<PensionBonusTooltipProps> = ({ breakdown }) => {
  // Employee share is half
  const employeeRate = PENSION_RATE / 2;

  // Helper to format month index to name
  const getMonthName = (monthIndex: number) => {
    const date = new Date();
    date.setMonth(monthIndex);
    return date.toLocaleString('default', { month: 'short' });
  };

  return (
    <Box sx={{ p: 1, maxWidth: 500 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Bonus Pension Contribution
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is calculated as follows, where the Standard Bonus Amount is the gross bonus rounded down to the nearest 1,000 yen.
      </Typography>

      <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          Standard Bonus Amount × {formatPercent(employeeRate)}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        The employer also pays an equal amount.
      </Typography>

      {breakdown && breakdown.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.9em' }}>
            Calculation Detail
          </Typography>
          <Box
            component="table"
            sx={{
              width: '100%',
              fontSize: '0.85em',
              borderCollapse: 'collapse',
              '& th': { textAlign: 'left', borderBottom: '1px solid #ccc', p: 0.5 },
              '& td': { p: 0.5, borderBottom: '1px solid #eee' },
              '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'right' }
            }}
          >
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
                  <td>{getMonthName(item.month)}</td>
                  <td>{formatJPY(item.totalBonusAmount)}</td>
                  <td>
                    {formatJPY(item.standardBonusAmount)}
                    {item.standardBonusAmount < Math.floor(item.totalBonusAmount / 1000) * 1000 && (
                      <span style={{ color: 'orange', marginLeft: 4 }} title="Capped at 1,500,000 JPY">*</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatJPY(item.premium)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #aaa', fontWeight: 700 }}>
                <td style={{ paddingTop: 4 }}>Total</td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.totalBonusAmount, 0))}
                </td>
                <td style={{ paddingTop: 4 }}></td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.premium, 0))}
                </td>
              </tr>
            </tfoot>
          </Box>
        </Box>
      )}

      {/* Cap Note */}
      {breakdown?.some(item => item.standardBonusAmount < Math.floor(item.totalBonusAmount / 1000) * 1000) && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            <span style={{ color: 'orange', marginRight: 4 }}>*</span>
            Indicates the standard bonus amount is capped.
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
        <Typography variant="caption" fontWeight="bold">
          Standard Bonus Amount Monthly Limit:
        </Typography>
        <Typography variant="caption" display="block">
          The standard bonus amount is capped at 1.5 million yen per month (adding all bonuses paid in the same month).
        </Typography>
      </Box>
      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
        Reference: <a href="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150515-01.html" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
          厚生年金保険の保険料 (Japan Pension Service)
        </a>
      </Typography>
    </Box>
  );
};

export default PensionBonusTooltip;
