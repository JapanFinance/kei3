// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import ReferenceTable from '../../ui/ReferenceTable';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface IncomeBasedPortionTooltipProps {
  /** Which side of the income-based residence tax this row totals. */
  level: 'municipal' | 'prefectural';
  /** This side's rate on aggregate taxable income: 6% municipal / 4% prefectural. */
  aggregateRatePercent: number;
  /** This side's amount at {@link aggregateRatePercent}, before rounding for display. */
  aggregateAmount: number;
  /** This side's rate on separately-taxed investment income: 3% municipal / 2% prefectural. */
  separateRatePercent: number;
  /** This side's amount at {@link separateRatePercent}, present only when it applies. */
  separateAmount?: number | undefined;
}

/**
 * Tooltip for the "Municipal portion" / "Prefectural portion" residence-tax rows: explains the
 * rate on aggregate taxable income and, when investment income is reported under separate
 * taxation, the additional rate on it, rather than putting the percentages in the row title.
 * Renders its own DetailedTooltip trigger, so callers place it after the label.
 */
const IncomeBasedPortionTooltip: React.FC<IncomeBasedPortionTooltipProps> = ({
  level,
  aggregateRatePercent,
  aggregateAmount,
  separateRatePercent,
  separateAmount,
}) => {
  const isMunicipal = level === 'municipal';
  const levelLabel = isMunicipal ? 'Municipal' : 'Prefectural';
  const hasSeparate = separateAmount !== undefined;
  const total = aggregateAmount + (separateAmount ?? 0);

  return (
    <DetailedTooltip title={`${levelLabel} Income-based Portion`}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Income-based Portion (所得割) on the {levelLabel} Side
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9em' }}>
          {hasSeparate
            ? `${aggregateRatePercent}% of taxable income, plus ${separateRatePercent}% of taxable investment income reported under separate taxation (申告分離課税).`
            : `${aggregateRatePercent}% of taxable income.`}
        </Typography>
        <ReferenceTable
          headers={['Component', 'Rate', 'Amount']}
          rows={
            hasSeparate
              ? [
                  [
                    'Aggregate taxable income',
                    `${aggregateRatePercent}%`,
                    formatJPY(aggregateAmount),
                  ],
                  [
                    'Separate taxable investment income',
                    `${separateRatePercent}%`,
                    formatJPY(separateAmount),
                  ],
                  [<strong>Total</strong>, '', <strong>{formatJPY(total)}</strong>],
                ]
              : [['Aggregate taxable income', `${aggregateRatePercent}%`, formatJPY(total)]]
          }
        />
        <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85em', color: 'text.secondary' }}>
          Shown here before any tax credits below; the amount is rounded down to the nearest ¥100
          after they are applied.
        </Typography>
        <SourceLinks
          sources={[
            {
              href: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
              label: '個人住民税 (Tokyo Bureau of Taxation)',
            },
          ]}
        />
      </Box>
    </DetailedTooltip>
  );
};

export default IncomeBasedPortionTooltip;
