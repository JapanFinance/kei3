// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PENSION_RATE } from '../../../utils/pensionCalculator';

const PensionBonusTooltip: React.FC = () => {
  // Employee share is half
  const employeeRate = PENSION_RATE / 2;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Bonus Pension Contribution
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        For bonuses, the contribution is calculated by multiplying the Standard Bonus Amount (gross bonus amount rounded down to nearest 1,000 yen) by the contribution rate.
      </Typography>

      <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          Standard Bonus Amount × {(employeeRate * 100).toFixed(3)}%
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        * The rate shown is the employee's share (50% of the total rate).
      </Typography>

      <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
        <Typography variant="caption" fontWeight="bold">
          Standard Bonus Amount Limit:
        </Typography>
        <Typography variant="caption" display="block">
          The standard bonus amount is capped at 1.5 million yen per month (adding all bonuses paid in the same month).
        </Typography>
      </Box>
      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
        Official Source:<a href="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150515-01.html" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
          厚生年金保険の保険料 (Japan Pension Service)
        </a>
      </Typography>
    </Box>
  );
};

export default PensionBonusTooltip;
