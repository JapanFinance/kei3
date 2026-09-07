// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Typography from '@mui/material/Typography';
import React from 'react';

import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

/**
 * Tooltip for the "Annual Income" header row: states what the figure counts, so the reader can
 * see why it is gross for some income types and after expenses for others. The definition itself
 * is documented on TakeHomeResults.annualIncome in tax.ts. Renders its own DetailedTooltip
 * trigger, so callers place it directly after the row label. Shared by the Summary and Social
 * Insurance tabs.
 */
const AnnualIncomeTooltip: React.FC = () => (
  <DetailedTooltip title="Annual Income" iconAriaLabel="About annual income">
    <Typography variant="body2" sx={{ mb: 1 }}>
      The amount received over the year, before taxes and social insurance: gross salary, bonus and
      stock compensation, gross public pension income, and business and miscellaneous income after
      necessary expenses (必要経費).
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      Deductions that reduce taxable income without reducing the amount received are not subtracted:
      the employment income deduction (給与所得控除), the public pension deduction (公的年金等控除)
      and the blue-filer special deduction (青色申告特別控除). A commuting allowance is not counted,
      as it reimburses a cost.
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      Take-home pay is this amount minus taxes and social insurance. The chart compares it with
      household income from the 国民生活基礎調査, whose 用語の説明 counts income the same way:
      雇用者所得 including taxes and social insurance, 事業所得 as revenue minus 必要経費, and
      公的年金・恩給 as the amount paid. Its 可処分所得, income minus taxes and social insurance, is
      described there as the equivalent of take-home pay (手取り収入).
    </Typography>
    <SourceLinks
      sources={[
        {
          href: 'https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/07.pdf',
          label: '用語の説明 13・15 - 2025年 国民生活基礎調査 (MHLW)',
        },
      ]}
    />
  </DetailedTooltip>
);

export default AnnualIncomeTooltip;
