// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetPublicPensionIncomeTooltipProps {
  /** Gross public pension income (公的年金等の収入金額) in yen. */
  grossPublicPensionIncome: number;
  /** Net public pension income (公的年金等に係る雑所得), already net of the 公的年金等控除. */
  netPublicPensionIncome: number;
}

/**
 * Tooltip for the "Net Public Pension Income" row: shows how gross public pension income becomes
 * net pension income via the public pension deduction (公的年金等控除), with a note on what drives
 * the deduction amount. Renders its own DetailedTooltip trigger, so callers place it directly
 * after the row label. Shared by the Taxes and Social Insurance tabs.
 */
const NetPublicPensionIncomeTooltip: React.FC<NetPublicPensionIncomeTooltipProps> = ({
  grossPublicPensionIncome,
  netPublicPensionIncome,
}) => {
  const publicPensionDeduction = grossPublicPensionIncome - netPublicPensionIncome;

  return (
    <DetailedTooltip title="Public Pension Income Details">
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
            <td style={{ padding: '2px 0' }}>Gross Public Pension Income:</td>
            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
              {formatJPY(grossPublicPensionIncome)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0' }}>Public Pension Deduction:</td>
            <Box component="td" sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}>
              -{formatJPY(publicPensionDeduction)}
            </Box>
          </tr>
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Public Pension Income:</td>
            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
              {formatJPY(netPublicPensionIncome)}
            </td>
          </Box>
        </tbody>
      </table>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Public Pension Deduction (公的年金等控除)
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Public pension income is Miscellaneous income (雑所得), computed from the gross amount with
        its own deduction.
      </Typography>
      <SourceLinks
        sources={[
          {
            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm',
            label: '公的年金等の課税関係 - NTA',
          },
        ]}
      />
    </DetailedTooltip>
  );
};

export default NetPublicPensionIncomeTooltip;
