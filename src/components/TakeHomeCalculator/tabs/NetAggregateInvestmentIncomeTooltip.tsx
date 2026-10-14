// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import type { Source } from '../../ui/SourceLinks';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetAggregateInvestmentIncomeTooltipProps {
  /** Dividends reported under aggregate taxation (総合課税), as entered. Absent when none. */
  dividends?: number | undefined;
  /** Interest paid outside Japan, as entered. Absent when none. */
  interest?: number | undefined;
}

const CELL_SX = { padding: '2px 0' };
const TOTAL_CELL_SX = { padding: '4px 0', fontWeight: 600 };

/**
 * Tooltip for the "Net Investment Income (aggregate)" row: the investment income taxed with the
 * other income rather than apart from it, which is dividends reported under 総合課税 and interest
 * paid outside Japan. Renders its own DetailedTooltip trigger, so callers place it directly after
 * the row label. Shared by the Taxes and Social Insurance tabs.
 */
const NetAggregateInvestmentIncomeTooltip: React.FC<NetAggregateInvestmentIncomeTooltipProps> = ({
  dividends,
  interest,
}) => {
  const sources: Source[] = [];
  if (dividends !== undefined) {
    sources.push(
      {
        href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm',
        label: 'Dividend income (配当所得) - NTA',
      },
      {
        href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1250.htm',
        label: 'Dividend tax credit (配当控除) - NTA',
      },
    );
  }
  if (interest !== undefined) {
    sources.push({
      href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1310.htm',
      label: 'Interest income (利子所得) - NTA',
    });
  }

  return (
    <DetailedTooltip title="Investment Income under Aggregate Taxation">
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          marginBottom: '8px',
        }}
      >
        <tbody>
          {dividends !== undefined && (
            <tr>
              <Box component="td" sx={CELL_SX}>
                Dividends (配当所得):
              </Box>
              <Box component="td" sx={{ ...CELL_SX, textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(dividends)}
              </Box>
            </tr>
          )}
          {interest !== undefined && (
            <tr>
              <Box component="td" sx={CELL_SX}>
                Interest paid outside Japan (利子所得):
              </Box>
              <Box component="td" sx={{ ...CELL_SX, textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(interest)}
              </Box>
            </tr>
          )}
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Box component="td" sx={TOTAL_CELL_SX}>
              Net Investment Income (aggregate):
            </Box>
            <Box component="td" sx={{ ...TOTAL_CELL_SX, textAlign: 'right' }}>
              {formatJPY((dividends ?? 0) + (interest ?? 0))}
            </Box>
          </Box>
        </tbody>
      </table>

      {dividends !== undefined && (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {formatJPY(dividends)} of dividends reported under aggregate taxation (総合課税) are
            dividend income (配当所得, 所法24条) inside the aggregate income (総所得金額,
            所法22条②一): they count toward total net income (合計所得金額) and are taxed in the
            progressive brackets and at the 10% residence rate together with the other income. The
            amount is the dividends as entered; the deduction for interest on money borrowed to buy
            the shares (負債利子, 所法24条②) is not modelled.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            The dividend tax credit (配当控除, 所法92条, 地方税法附則5条) that offsets part of that
            tax for a dividend from a domestic company is not modelled yet, so the tax shown is
            overstated for those. No capital loss is set against a dividend reported this way: the
            law nets a loss only against dividends reported under separate taxation (申告分離課税,
            措法37条の12の2). The 20.315% withheld at source is credited on the return and is not
            shown as a refund.
          </Typography>
        </>
      )}

      {interest !== undefined && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {formatJPY(interest)} of interest paid outside Japan had no Japanese tax withheld on it,
          so the whole amount is interest income (利子所得, 所法23条) inside the aggregate income
          (総所得金額, 所法22条②一): it counts toward total net income (合計所得金額) and is taxed
          in the progressive brackets and at the 10% residence rate together with the other income.
          Foreign tax withheld on it is not modelled (the foreign tax credit, 外国税額控除).
        </Typography>
      )}

      <SourceLinks sources={sources} />
    </DetailedTooltip>
  );
};

export default NetAggregateInvestmentIncomeTooltip;
