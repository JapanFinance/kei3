// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetDividendIncomeTooltipProps {
  /** 配当所得 reported under 総合課税, as entered. */
  amount: number;
}

/**
 * Tooltip for the "Net Dividend Income (reported, aggregate)" row: dividends reported under
 * 総合課税 are 配当所得 inside 総所得金額 and are taxed with the other income. Renders its own
 * DetailedTooltip trigger, so callers place it directly after the row label. Shared by the
 * Taxes and Social Insurance tabs.
 */
const NetDividendIncomeTooltip: React.FC<NetDividendIncomeTooltipProps> = ({ amount }) => (
  <DetailedTooltip title="Dividends Reported under 総合課税">
    <Typography variant="body2" sx={{ mb: 1 }}>
      {formatJPY(amount)} of dividends reported under 総合課税 are 配当所得 (所法24条) inside
      総所得金額 (所法22条②一): they enter 合計所得金額 and are taxed in the progressive brackets
      and at the 10% residence rate together with the other income. The amount is the dividends as
      entered; the 負債利子 offset of 所法24条② is not modelled.
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      The 配当控除 (所法92条, 地方税法附則5条) that offsets part of that tax for a dividend from a
      domestic company is not modelled yet, so the tax shown is overstated for those. No capital
      loss is set against a dividend reported this way: 措法37条の12の2 nets a loss only against
      dividends reported under 申告分離課税. The 20.315% withheld at source is credited on the
      return and is not shown as a refund.
    </Typography>
    <SourceLinks
      sources={[
        {
          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm',
          label: '配当金を受け取ったとき(配当所得) - NTA',
        },
        {
          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1250.htm',
          label: '配当所得があるとき(配当控除) - NTA',
        },
      ]}
    />
  </DetailedTooltip>
);

export default NetDividendIncomeTooltip;
