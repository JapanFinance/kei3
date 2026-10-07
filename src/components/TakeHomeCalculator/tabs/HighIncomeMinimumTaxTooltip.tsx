// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { HighIncomeMinimumTaxResult } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface HighIncomeMinimumTaxTooltipProps {
  minimumTax: HighIncomeMinimumTaxResult;
}

export const HighIncomeMinimumTaxTooltip: React.FC<HighIncomeMinimumTaxTooltipProps> = ({
  minimumTax,
}) => {
  const percentRate = minimumTax.rate.toPercent(1);

  return (
    <DetailedTooltip title="Minimum Tax on High Income Taxpayers">
      <Box sx={{ maxWidth: 460 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          特定の基準所得金額の課税の特例
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          A statutory minimum tax on ultra-high incomes (in force since 2025). When baseline income
          (基準所得金額) exceeds {formatJPY(minimumTax.threshold)}, an additional tax is imposed if{' '}
          {percentRate} of the excess exceeds the baseline income tax.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Taxpayers subject to this minimum tax are required to report all investment income on the
          tax return.
        </Typography>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 0' }}>Baseline income (基準所得金額, ⑬):</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>
                {formatJPY(minimumTax.baselineIncome)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0' }}>Statutory threshold deduction:</td>
              <Box
                component="td"
                sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
              >
                -{formatJPY(minimumTax.threshold)}
              </Box>
            </tr>
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '2px 0' }}>Taxable excess (¥1,000 floor, ⑭):</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>
                {formatJPY(minimumTax.taxableExcess)}
              </td>
            </Box>
            <tr>
              <td style={{ padding: '2px 0' }}>Minimum tax rate:</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>{percentRate}</td>
            </tr>
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '2px 0', fontWeight: 600 }}>Target tax amount (⑮):</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 600 }}>
                {formatJPY(minimumTax.taxOnExcess)}
              </td>
            </Box>
            <tr>
              <td style={{ padding: '2px 0' }}>Baseline income tax & surtax (㉒):</td>
              <Box
                component="td"
                sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
              >
                -{formatJPY(minimumTax.baselineIncomeTax)}
              </Box>
            </tr>
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '4px 0', fontWeight: 600 }}>Additional income tax (㉓):</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                {formatJPY(minimumTax.additionalIncomeTax)}
              </td>
            </Box>
            <tr>
              <td style={{ padding: '2px 0', color: 'text.secondary' }}>
                Reconstruction surtax on addition (2.1%):
              </td>
              <td style={{ padding: '2px 0', textAlign: 'right', color: 'text.secondary' }}>
                +{formatJPY(minimumTax.additionalReconstructionSurtax)}
              </td>
            </tr>
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '4px 0', fontWeight: 600 }}>Total minimum tax addition:</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                {formatJPY(minimumTax.totalAdditionalTax)}
              </td>
            </Box>
          </tbody>
        </table>

        <SourceLinks
          heading="Official Sources (NTA)"
          sources={[
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/kiwataka/index.htm',
              label: '極めて高い水準の所得に対する負担の適正化措置について - NTA',
            },
            {
              href: 'https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/gengaku/01.pdf',
              label: '適用判定表 兼 税額計算書 (Form 01.pdf) - NTA',
            },
          ]}
        />
      </Box>
    </DetailedTooltip>
  );
};
