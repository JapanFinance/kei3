// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ReportedInvestmentIncome } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetInvestmentIncomeTooltipProps {
  reported: ReportedInvestmentIncome;
}

/**
 * Tooltip for the "Net Investment Income (reported)" row: shows how the amounts reported under
 * 申告分離課税 net into the figure that enters 合計所得金額. Renders its own DetailedTooltip
 * trigger, so callers place it directly after the row label. Shared by the Taxes and Social
 * Insurance tabs.
 */
const NetInvestmentIncomeTooltip: React.FC<NetInvestmentIncomeTooltipProps> = ({ reported }) => {
  const netIncome = reported.netIncome.capitalGains + reported.netIncome.dividends;

  return (
    <DetailedTooltip title="Reported Investment Income Details">
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
          {reported.gross.capitalGains !== 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Capital Gains (net for the year):</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(reported.gross.capitalGains)}
              </td>
            </tr>
          )}
          {reported.gross.dividends !== 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Dividends:</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(reported.gross.dividends)}
              </td>
            </tr>
          )}
          {reported.lossOffsetAgainstDividends > 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Loss offset against dividends (損益通算):</td>
              <Box
                component="td"
                sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
              >
                -{formatJPY(reported.lossOffsetAgainstDividends)}
              </Box>
            </tr>
          )}
          {reported.unabsorbedQualifyingLoss > 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Loss left over (not carried forward here):</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(reported.unabsorbedQualifyingLoss)}
              </td>
            </tr>
          )}
          {reported.nonQualifyingLoss > 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Foreign-account loss, offsetting nothing:</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(reported.nonQualifyingLoss)}
              </td>
            </tr>
          )}
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Investment Income:</td>
            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
              {formatJPY(netIncome)}
            </td>
          </Box>
        </tbody>
      </table>

      <Typography variant="body2" sx={{ mb: 1 }}>
        Investment income reported under 申告分離課税 is part of total net income (合計所得金額), so
        it counts toward the basic deduction, spouse and dependent eligibility, residence-tax
        exemption and National Health Insurance, but it is taxed apart from the progressive brackets
        at 15% income tax and 5% residence tax. A capital loss is first set against the year's other
        reported gains; what remains offsets reported dividends only where the sale settled in a
        Japanese account.
      </Typography>
      <SourceLinks
        sources={[
          {
            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
            label: '株式等を譲渡したときの課税(申告分離課税) - NTA',
          },
          {
            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm',
            label: '配当金を受け取ったとき(配当所得) - NTA',
          },
          {
            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1474.htm',
            label: '上場株式等に係る譲渡損失の損益通算及び繰越控除 - NTA',
          },
        ]}
      />
    </DetailedTooltip>
  );
};

export default NetInvestmentIncomeTooltip;
