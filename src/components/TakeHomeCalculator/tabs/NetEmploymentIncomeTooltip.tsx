// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { getEmploymentIncomeDeductionPeriod } from '../../../data/netEmploymentIncome';
import { formatJPY, formatNumber } from '../../../utils/formatters';
import ReferenceTable from '../../ui/ReferenceTable';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';
import { getEmploymentIncomeDeductionHighlightIndex } from './referenceTableHighlight';

interface NetEmploymentIncomeTooltipProps {
  /** Gross employment income (給与等の収入金額) in yen. */
  grossEmploymentIncome: number;
  /** Net employment income (給与所得), already net of the 給与所得控除 and 所得金額調整控除. */
  netEmploymentIncome: number;
  /**
   * 所得金額調整控除 applied to this taxpayer (yen). When greater than 0, it is shown as its own
   * breakdown line and an explanatory note is added below the 給与所得控除 table.
   */
  incomeAdjustmentDeduction?: number;
  /** Income year, for the 給与所得控除 table lookup. */
  year: number;
}

/**
 * Tooltip for the "Net Employment Income" row: shows how gross employment income becomes net
 * employment income (the 給与所得控除, then the 所得金額調整控除 when applicable), followed by the
 * 給与所得控除 rate table and source links. Renders its own DetailedTooltip trigger, so callers
 * place it directly after the row label. Shared by the Taxes and Social Insurance tabs.
 */
const NetEmploymentIncomeTooltip: React.FC<NetEmploymentIncomeTooltipProps> = ({
  grossEmploymentIncome,
  netEmploymentIncome,
  incomeAdjustmentDeduction = 0,
  year,
}) => {
  const period = getEmploymentIncomeDeductionPeriod(year);

  // The 給与所得控除 portion is whatever remains after backing out the income adjustment, so the
  // displayed rows always reconcile to net employment income regardless of which gross is passed.
  const employmentIncomeDeduction =
    grossEmploymentIncome - netEmploymentIncome - incomeAdjustmentDeduction;

  // The effective upper boundary of the flat-floor region (including transition values).
  // For R8: transitions end at 2,199,999 → standard starts at 2,200,000.
  // For R7: no transitions → standard starts at flatFloorGrossMaxInclusive + 1.
  const flatUpperBound =
    period.transitionValues.length > 0
      ? period.transitionValues[period.transitionValues.length - 1]!.grossMaxInclusive + 1
      : period.flatFloorGrossMaxInclusive;

  // Build rows from standardTiers
  const tierRows = period.standardTiers.map((tier, i) => {
    const lower = (i === 0 ? flatUpperBound : period.standardTiers[i - 1]!.grossMaxInclusive) + 1;
    const isCap = !isFinite(tier.grossMaxInclusive);
    const deductionPct = Math.round((1 - tier.retentionRate) * 100);

    const range = isCap
      ? `${formatNumber(lower)} and above`
      : `${formatNumber(lower)} – ${formatNumber(tier.grossMaxInclusive)}`;

    const deduction = isCap
      ? `${formatNumber(tier.offset)} (max)`
      : `${deductionPct}% of income + ${formatNumber(tier.offset)}`;

    return { range, deduction };
  });

  // Highlight the row that applies to this taxpayer. The displayed rows are the flat-floor "Up to X"
  // row (index 0) followed by tierRows, so the helper indexes match. Guard on a positive gross so an
  // income-less result doesn't highlight a row.
  const deductionTableHighlight =
    grossEmploymentIncome > 0
      ? getEmploymentIncomeDeductionHighlightIndex(
          grossEmploymentIncome,
          flatUpperBound,
          period.standardTiers,
        )
      : undefined;

  return (
    <DetailedTooltip title="Employment Income Details">
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
            <td style={{ padding: '2px 0' }}>Gross Employment Income:</td>
            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
              {formatJPY(grossEmploymentIncome)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0' }}>Employment Income Deduction:</td>
            <Box component="td" sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}>
              -{formatJPY(employmentIncomeDeduction)}
            </Box>
          </tr>
          {incomeAdjustmentDeduction > 0 && (
            <tr>
              <td style={{ padding: '2px 0' }}>Income Adjustment Deduction:</td>
              <Box
                component="td"
                sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
              >
                -{formatJPY(incomeAdjustmentDeduction)}
              </Box>
            </tr>
          )}
          <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Employment Income:</td>
            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
              {formatJPY(netEmploymentIncome)}
            </td>
          </Box>
        </tbody>
      </table>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Employment Income Deduction Table
      </Typography>
      <ReferenceTable
        headers={['Gross Employment Income (¥)', 'Deduction Amount']}
        highlightedRow={deductionTableHighlight}
        rows={[
          [`Up to ${formatNumber(flatUpperBound)}`, formatNumber(period.flatFloorDeduction)],
          ...tierRows.map(row => [row.range, row.deduction]),
        ]}
      />
      <SourceLinks
        sources={[
          {
            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm',
            label: '給与所得控除 - NTA',
          },
          {
            href: 'https://www.nta.go.jp/english/taxes/individual/12012.htm',
            label: 'Overview of deduction for employment income - NTA (English)',
          },
        ]}
      />

      {incomeAdjustmentDeduction > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Income Amount Adjustment Deduction (所得金額調整控除)
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Taxpayers with employment income exceeding ¥8,500,000 and who have a qualifying
            dependent (a dependent relative under 23, or a spouse/dependent with special disability
            status) are eligible for this deduction. It reduces net employment income by 10% of
            gross employment income less ¥8,500,000, up to ¥150,000.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Rounding:</strong> Fractional yen amounts are rounded up.
          </Typography>
          <SourceLinks
            sources={[
              {
                href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm',
                label: '所得金額調整控除 - NTA',
              },
            ]}
          />
        </Box>
      )}
    </DetailedTooltip>
  );
};

export default NetEmploymentIncomeTooltip;
