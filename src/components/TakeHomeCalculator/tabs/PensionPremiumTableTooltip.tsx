// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeInputs } from '../../../types/tax';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import { EMPLOYEES_PENSION_BRACKETS, EMPLOYEES_PENSION_RATE, type StandardMonthlyRemunerationBracket } from '../../../utils/pensionCalculator';
import PremiumTableTooltip from './PremiumTableTooltip';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../../../types/healthInsurance';
import { roundSocialInsurancePremium } from '../../../utils/taxCalculations';

interface PensionPremiumTableTooltipProps {
  inputs: TakeHomeInputs;
  standardMonthlyRemuneration: number;
}

const PensionPremiumTableTooltip: React.FC<PensionPremiumTableTooltipProps> = ({ inputs, standardMonthlyRemuneration }) => {

  if (inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID) {
    throw new Error("Wrong tooltip used for National Health Insurance");
  }

  // Find the current row for the user's income
  const currentRow = EMPLOYEES_PENSION_BRACKETS.find(bracket =>
    standardMonthlyRemuneration >= bracket.minIncomeInclusive && standardMonthlyRemuneration < bracket.maxIncomeExclusive
  ) || null; // Force null if undefined

  const getIncomeRange = (row: Record<string, unknown>) => {
    const bracket = row as unknown as StandardMonthlyRemunerationBracket;
    return `${formatJPY(bracket.minIncomeInclusive)} - ${bracket.maxIncomeExclusive === Infinity ? '∞' : formatJPY(bracket.maxIncomeExclusive)}`;
  };

  const columns = [
    {
      header: 'Grade',
      render: (row: Record<string, unknown>) => (row as unknown as StandardMonthlyRemunerationBracket).grade,
      align: 'left' as const
    },
    {
      header: 'Income Range',
      render: getIncomeRange,
      align: 'left' as const
    },
    {
      header: 'Pension SMR',
      getValue: (row: Record<string, unknown>) => (row as unknown as StandardMonthlyRemunerationBracket).smrAmount
    },
  ];

  const getCurrentRowSummary = (row: Record<string, unknown>) => {
    const bracket = row as unknown as StandardMonthlyRemunerationBracket;
    const isCapped = bracket.maxIncomeExclusive === Infinity;
    const baseSummary = `Grade: ${bracket.grade} (SMR: ${formatJPY(bracket.smrAmount)})`;

    if (isCapped) {
      return `${baseSummary} (Maximum Cap)`;
    }

    return baseSummary;
  };

  const employeeRate = EMPLOYEES_PENSION_RATE / 2;
  const totalPremium = roundSocialInsurancePremium(standardMonthlyRemuneration * employeeRate);

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 500 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Employees Pension Insurance Calculation
      </Typography>

      <Box sx={{ mb: 0.5, p: 0, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {/* Supporting Details */}
        <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Monthly Remuneration</Typography>
            <Typography variant="caption" fontWeight={500}>
              {formatJPY(
                inputs.incomeStreams
                  .filter(s => s.type === 'salary' || s.type === 'commutingAllowance')
                  .reduce((sum, s) => {
                    if (s.frequency === 'monthly') return sum + s.amount;
                    if (s.frequency === '3-months') return sum + s.amount / 3;
                    if (s.frequency === '6-months') return sum + s.amount / 6;
                    return sum + s.amount / 12;
                  }, 0)
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Standard Monthly Remuneration
            </Typography>
            <Typography variant="caption" fontWeight={500}>{formatJPY(standardMonthlyRemuneration)}</Typography>
          </Box>
        </Box>

        {/* Main Calculation Highlight */}
        <Box sx={{ p: 1.5, bgcolor: 'primary.50', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2" color="primary.main" fontWeight={600} sx={{ mb: 0.5 }}>
            Monthly Pension Contribution
          </Typography>

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            my: 0.5,
            '& math': {
              fontSize: '1.1rem',
              fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
            },
            '& mn': { fontWeight: '500' },
            '& mo': { mx: 1, color: 'text.secondary' },
            '& mn:last-child': { fontWeight: '700', color: 'primary.main' }
          }}>
            <math>
              <mrow>
                <mn>{formatJPY(standardMonthlyRemuneration)}</mn>
                <mo>×</mo>
                <mn>{formatPercent(employeeRate)}</mn>
                <mo>=</mo>
                <mn>{formatJPY(totalPremium)}</mn>
              </mrow>
            </math>
          </Box>
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mb: 1 }}>
        The employer also pays {formatPercent(employeeRate)}.
      </Typography>

      <PremiumTableTooltip
        title="Employees Pension (厚生年金) SMR Table"
        description="Standard Monthly Remuneration (SMR or 標準報酬月額) is determined by the below table."
        tableData={EMPLOYEES_PENSION_BRACKETS as unknown as Record<string, unknown>[]}
        columns={columns}
        currentRow={currentRow as unknown as Record<string, unknown> | null}
        tableContainerDataAttr="data-pension-table-container"
        currentRowId="current-pension-row"
        getCurrentRowSummary={getCurrentRowSummary}
        officialSourceLink={{
          url: "https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html",
          text: "厚生年金保険料額表 (Japan Pension Service)"
        }}
      />
    </Box >
  );
};

export default PensionPremiumTableTooltip;
