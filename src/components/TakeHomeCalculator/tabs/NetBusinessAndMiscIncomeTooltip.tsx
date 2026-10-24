// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetBusinessAndMiscIncomeTooltipProps {
  /** Business income as entered, before the 青色申告特別控除 (yen), if present. */
  businessIncome?: number | undefined;
  /** Miscellaneous income as entered (yen), if present. */
  miscIncome?: number | undefined;
  /** The 青色申告特別控除 applied (yen). */
  blueFilerDeduction: number;
  /** Net business and miscellaneous income, already net of the 青色申告特別控除. */
  netBusinessAndMiscIncome: number;
}

/**
 * Tooltip for the "Net Business / Misc Income" row: shows how the entered business and
 * miscellaneous income becomes net income via the blue-filer special deduction (青色申告特別控除)
 * and constituent category breakdown.
 * Renders its own DetailedTooltip trigger, so callers place it directly after the row label.
 * Shared by the Taxes and Social Insurance tabs.
 */
const NetBusinessAndMiscIncomeTooltip: React.FC<NetBusinessAndMiscIncomeTooltipProps> = ({
  businessIncome,
  miscIncome,
  blueFilerDeduction,
  netBusinessAndMiscIncome,
}) => {
  const hasLoss =
    (businessIncome !== undefined && businessIncome < 0) || netBusinessAndMiscIncome < 0;

  return (
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
            {businessIncome !== undefined && (
              <tr>
                <td style={{ padding: '2px 0' }}>Business Income:</td>
                <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                  {formatJPY(businessIncome)}
                </td>
              </tr>
            )}
            {blueFilerDeduction > 0 && (
              <tr>
                <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
                <Box
                  component="td"
                  sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
                >
                  -{formatJPY(blueFilerDeduction)}
                </Box>
              </tr>
            )}
            {miscIncome !== undefined && (
              <tr>
                <td style={{ padding: '2px 0' }}>Miscellaneous Income:</td>
                <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                  {formatJPY(miscIncome)}
                </td>
              </tr>
            )}
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Business/Misc Income:</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                {formatJPY(netBusinessAndMiscIncome)}
              </td>
            </Box>
          </tbody>
        </table>
        {blueFilerDeduction > 0 && (
          <Box sx={{ mb: hasLoss ? 1.5 : 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Blue-Filer Special Deduction
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              A special deduction for business operators with permission to file a Blue Return. This
              amount is deducted from business income after expenses before calculating taxable
              income.
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
        )}
        {hasLoss && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Loss Netting (損益通算)
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              A net loss from business income can offset other aggregate income (such as employment
              income or miscellaneous income) when calculating total net income (総所得金額 /
              合計所得金額). A business loss cannot offset separately taxed income under
              申告分離課税 (such as capital gains), though under statutory ordering it can offset
              retirement income (退職所得) and forestry income (山林所得). The blue-filer special
              deduction cannot create or increase a loss.
            </Typography>
            <SourceLinks
              sources={[
                {
                  href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2250.htm',
                  label: '損益通算 (Loss Netting) - NTA',
                },
              ]}
            />
          </Box>
        )}
      </Box>
    </DetailedTooltip>
  );
};

export default NetBusinessAndMiscIncomeTooltip;
