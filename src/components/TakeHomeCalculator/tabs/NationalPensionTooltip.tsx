// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getNationalPensionMonthlyContribution } from '../../../data/nationalPensionContribution';
import { formatJPY, formatMonthShort } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';

const cellStyle = { padding: '2px 8px 2px 0' } as const;
const rightCellStyle = { ...cellStyle, textAlign: 'right' as const };
const headerStyle = {
  ...cellStyle,
  borderBottom: '1px solid var(--mui-palette-divider)',
  fontWeight: 'normal' as const,
};
const rightHeaderStyle = {
  ...rightCellStyle,
  borderBottom: '1px solid var(--mui-palette-divider)',
  fontWeight: 'normal' as const,
};
const totalStyle = {
  ...rightCellStyle,
  borderTop: '1px solid var(--mui-palette-divider)',
  fontWeight: 600,
};

interface NationalPensionTooltipProps {
  year: number;
  /** 全額免除 status from the calculation results; absent for employee pension contexts. */
  exemption?:
    | { requested: boolean; eligible: boolean; applied: boolean; incomeThreshold: number }
    | undefined;
}

const NationalPensionTooltip: React.FC<NationalPensionTooltipProps> = ({ year, exemption }) => {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    contribution: getNationalPensionMonthlyContribution(year, month),
  }));

  const annualTotal = months.reduce((sum, m) => sum + m.contribution, 0);

  // Group consecutive months with the same contribution amount
  const groups: { startMonth: number; endMonth: number; contribution: number }[] = [];
  for (const { month, contribution } of months) {
    const last = groups[groups.length - 1];
    if (last && last.contribution === contribution) {
      last.endMonth = month;
    } else {
      groups.push({ startMonth: month, endMonth: month, contribution });
    }
  }

  const allSame = groups.length === 1;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        National Pension (国民年金)
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
        National pension contributions are a fixed amount regardless of income level.
        {!allSame && ' The monthly amount changes in April with the fiscal year.'}
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={headerStyle}>Period</th>
            <th style={rightHeaderStyle}>Monthly</th>
            <th style={rightHeaderStyle}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => {
            const count = g.endMonth - g.startMonth + 1;
            const label =
              g.startMonth === g.endMonth
                ? formatMonthShort(g.startMonth)
                : `${formatMonthShort(g.startMonth)}–${formatMonthShort(g.endMonth)}`;
            return (
              <tr key={idx}>
                <td style={cellStyle}>{label}</td>
                <td style={rightCellStyle}>{formatJPY(g.contribution)}</td>
                <td style={rightCellStyle}>{formatJPY(g.contribution * count)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={2} style={totalStyle}>
              Annual Total
            </td>
            <td style={totalStyle}>{formatJPY(annualTotal)}</td>
          </tr>
        </tbody>
      </table>
      {exemption && (
        <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85rem' }}>
          {exemption.applied
            ? `Full exemption (全額免除) applied: the contribution for the year is ¥0. ` +
              `Income is at or below the threshold of ${formatJPY(exemption.incomeThreshold)} ` +
              `((number of dependents + 1) × ¥350,000 + ¥320,000). An application is required — ` +
              `the exemption is not applied automatically — and fully exempted periods accrue ` +
              `one half of the normal basic pension amount.`
            : `An income-based full exemption (全額免除) exists: it applies on application when ` +
              `the previous year's income is at or below (number of dependents + 1) × ¥350,000 ` +
              `+ ¥320,000 (currently ${formatJPY(exemption.incomeThreshold)}). Fully exempted ` +
              `periods accrue one half of the normal basic pension amount.`}
        </Typography>
      )}
      <SourceLinks
        sources={[
          {
            href: 'https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01',
            label: '国民年金保険料の金額 (Japan Pension Service)',
          },
          ...(exemption
            ? [
                {
                  href: 'https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html',
                  label: '国民年金保険料の免除制度・納付猶予制度 - 日本年金機構',
                },
              ]
            : []),
        ]}
      />
    </Box>
  );
};

export default NationalPensionTooltip;
