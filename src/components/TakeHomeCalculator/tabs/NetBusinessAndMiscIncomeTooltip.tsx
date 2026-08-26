// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetBusinessAndMiscIncomeTooltipProps {
  /** Business and miscellaneous income as entered, before the 青色申告特別控除 (yen). */
  grossBusinessAndMiscIncome: number;
  /** The 青色申告特別控除 applied (yen). */
  blueFilerDeduction: number;
  /** Net business and miscellaneous income, already net of the 青色申告特別控除. */
  netBusinessAndMiscIncome: number;
}

/**
 * Tooltip for the "Net Business / Misc Income" row: shows how the entered business and
 * miscellaneous income becomes net income via the blue-filer special deduction (青色申告特別控除).
 * Renders its own DetailedTooltip trigger, so callers place it directly after the row label.
 * Shared by the Taxes and Social Insurance tabs.
 */
const NetBusinessAndMiscIncomeTooltip: React.FC<NetBusinessAndMiscIncomeTooltipProps> = ({
  grossBusinessAndMiscIncome,
  blueFilerDeduction,
  netBusinessAndMiscIncome,
}) => (
  <DetailedTooltip title="Business & Miscellaneous Income">
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Calculation Breakdown
      </Typography>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          marginBottom: '8px',
        }}
      >
        <tbody>
          <tr>
            <td style={{ padding: '2px 0' }}>Business/Miscellaneous Income:</td>
            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
              {formatJPY(grossBusinessAndMiscIncome)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
            <Box component="td" sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}>
              -{formatJPY(blueFilerDeduction)}
            </Box>
          </tr>
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Business/Misc Income:</td>
            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
              {formatJPY(netBusinessAndMiscIncome)}
            </td>
          </Box>
        </tbody>
      </table>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Blue-Filer Special Deduction
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          A special deduction for business operators with permission to file a Blue Return. This
          amount is deducted from business income after expenses before calculating taxable income.
        </Typography>
        <SourceLinks
          sources={[
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
              label: '青色申告特別控除 - NTA',
            },
          ]}
        />
      </Box>
    </Box>
  </DetailedTooltip>
);

export default NetBusinessAndMiscIncomeTooltip;
