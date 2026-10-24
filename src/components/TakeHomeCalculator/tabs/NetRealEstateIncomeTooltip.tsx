// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NetRealEstateIncomeTooltipProps {
  /** Real estate income as entered, before deductions or loss netting disallowances (yen). */
  grossRealEstateIncome: number;
  /** The blue-filer deduction applied to real estate income (yen). */
  blueFilerDeduction: number;
  /** Net real estate income (allowable loss if negative) (yen). */
  netRealEstateIncome: number;
  /** Interest on debt used to acquire land (yen). */
  landDebtInterest?: number | undefined;
  /** Disallowed loss from foreign used building depreciation (yen). */
  foreignUsedBuildingDisallowedLoss?: number | undefined;
}

/**
 * Tooltip for the "Net Real Estate Income" row: shows how the entered real estate income
 * becomes net income via the blue-filer special deduction (青色申告特別控除) or allowable loss netting
 * after disallowances under 措法41条の4 (land debt interest) and 措法41条の4の3 (overseas used buildings).
 */
const NetRealEstateIncomeTooltip: React.FC<NetRealEstateIncomeTooltipProps> = ({
  grossRealEstateIncome,
  blueFilerDeduction,
  netRealEstateIncome,
  landDebtInterest,
  foreignUsedBuildingDisallowedLoss,
}) => {
  const grossLoss = Math.max(0, -grossRealEstateIncome);
  const disallowedLand = Math.min(grossLoss, Math.max(0, landDebtInterest ?? 0));
  const disallowedForeign = Math.min(
    grossLoss - disallowedLand,
    Math.max(0, foreignUsedBuildingDisallowedLoss ?? 0),
  );

  return (
    <DetailedTooltip title="Real Estate Income" iconAriaLabel="real estate income info">
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
            <tr>
              <td style={{ padding: '2px 0' }}>Real Estate Income (Gross / Net of Expenses):</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                {formatJPY(grossRealEstateIncome)}
              </td>
            </tr>
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
            {disallowedLand > 0 && (
              <tr>
                <td style={{ padding: '2px 0' }}>Disallowed Land Loan Interest (措法41条の4):</td>
                <Box
                  component="td"
                  sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
                >
                  +{formatJPY(disallowedLand)}
                </Box>
              </tr>
            )}
            {disallowedForeign > 0 && (
              <tr>
                <td style={{ padding: '2px 0' }}>
                  Disallowed Overseas Used Building Loss (措法41条の4の3):
                </td>
                <Box
                  component="td"
                  sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
                >
                  +{formatJPY(disallowedForeign)}
                </Box>
              </tr>
            )}
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Real Estate Income:</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                {formatJPY(netRealEstateIncome)}
              </td>
            </Box>
          </tbody>
        </table>
        {blueFilerDeduction > 0 && (
          <Box sx={{ mb: grossRealEstateIncome < 0 ? 1.5 : 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Blue-Filer Special Deduction
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Per statutory priority (措法25条の2②), the blue-filer deduction is allocated first to
              real estate income, with any remaining amount allocated to business income. It cannot
              reduce real estate income below ¥0 or create a loss.
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
        {grossRealEstateIncome < 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Loss Netting (損益通算) &amp; Disallowances
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Under Income Tax Act Article 69 (所得税法第69条), an allowable loss from real estate
              income can be netted against other aggregate income categories (such as employment or
              business income). Under Special Taxation Measures Law, losses attributable to interest
              on debt used to acquire land (措法41条の4) and depreciation from overseas used
              buildings (措法41条の4の3) cannot offset other income.
            </Typography>
            <SourceLinks
              sources={[
                {
                  href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1391.htm',
                  label: '不動産所得が赤字のときの通算 - NTA',
                },
                {
                  href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2250.htm',
                  label: '損益通算 - NTA',
                },
              ]}
            />
          </Box>
        )}
      </Box>
    </DetailedTooltip>
  );
};

export default NetRealEstateIncomeTooltip;
