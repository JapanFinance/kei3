// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeInputs } from '../../../types/tax';
import { CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION } from '../../../types/healthInsurance';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { getRegionalRatesForMonth } from '../../../data/employeesHealthInsurance/providerRates';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import type { EmployeesHealthInsuranceBonusBreakdownItem } from '../../../utils/healthInsuranceCalculator';

interface HealthInsuranceBonusTooltipProps {
  inputs: TakeHomeInputs;
  breakdown?: EmployeesHealthInsuranceBonusBreakdownItem[] | undefined;
}

const HealthInsuranceBonusTooltip: React.FC<HealthInsuranceBonusTooltipProps> = ({ inputs, breakdown }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;
  const includeLTC = inputs.isSubjectToLongTermCarePremium;
  const year = new Date().getFullYear();

  let providerLabel = '';
  let sourceUrl: string | undefined;

  if (provider === CUSTOM_PROVIDER_ID) {
    providerLabel = "Custom Provider";
  } else {
    const providerDef = PROVIDER_DEFINITIONS[provider];
    const regionalRates = getRegionalRatesForMonth(provider, region, new Date().getFullYear(), new Date().getMonth());
    if (regionalRates) {
      sourceUrl = regionalRates.source;
    }
    if (!sourceUrl && providerDef) {
      sourceUrl = providerDef.defaultSource;
    }
    if (providerDef) {
      providerLabel = `${providerDef.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
    }
  }

  // Look up the applicable rate for a given bonus month
  const getRateForMonth = (month: number): number => {
    if (provider === CUSTOM_PROVIDER_ID) {
      let rate = (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100;
      if (includeLTC) rate += (inputs.customEHIRates?.longTermCareRate ?? 0) / 100;
      return rate;
    }
    const rates = getRegionalRatesForMonth(provider, region, year, month);
    if (!rates) return 0;
    return rates.employeeHealthInsuranceRate + (includeLTC ? rates.employeeLongTermCareRate : 0);
  };

  // Helper to format month index to name
  const getMonthName = (monthIndex: number) => {
    const date = new Date();
    date.setMonth(monthIndex);
    return date.toLocaleString('default', { month: 'short' });
  };

  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is calculated on the Standard Bonus Amount, which is the gross bonus rounded down to the nearest 1,000 yen. The employer also contributes separately.
      </Typography>

      {breakdown && breakdown.length > 0 && (
        <Box>
          <Box
            component="table"
            sx={{
              width: '100%',
              fontSize: '0.85em',
              borderCollapse: 'collapse',
              '& th': { textAlign: 'left', borderBottom: 1, borderColor: 'divider', p: 0.5 },
              '& td': { p: 0.5, borderBottom: 1, borderColor: 'divider' },
              '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'right' }
            }}
          >
            <thead>
              <tr>
                <th>Month</th>
                <th>Bonus</th>
                <th>Std. Bonus Amount</th>
                <th>Rate</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((item, index) => (
                <tr key={index}>
                  <td>{getMonthName(item.month)}</td>
                  <td>{formatJPY(item.bonusAmount)}</td>
                  <td>
                    {formatJPY(item.standardBonusAmount)}
                    {item.standardBonusAmount < (Math.floor(item.bonusAmount / 1000) * 1000) && (
                      <Box component="span" sx={{ color: 'warning.main', ml: 0.5 }} title={`Capped: Cumulative Standard Bonus (${formatJPY(item.cumulativeStandardBonus)}) reached annual limit`}>*</Box>
                    )}
                  </td>
                  <td>{formatPercent(getRateForMonth(item.month))}</td>
                  <td style={{ fontWeight: 600 }}>{formatJPY(item.premium)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-strong)', fontWeight: 700 }}>
                <td style={{ paddingTop: 4 }}>Total</td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.bonusAmount, 0))}
                </td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.standardBonusAmount, 0))}
                </td>
                <td style={{ paddingTop: 4 }} />
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.premium, 0))}
                </td>
              </tr>
            </tfoot>
          </Box>
        </Box>
      )}

      {/* Cap Note */}
      {breakdown?.some(item => item.standardBonusAmount < (Math.floor(item.bonusAmount / 1000) * 1000)) && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>*</Box>
            Indicates the cumulative standard bonus amount has reached the annual cap.
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
        <Typography variant="caption" fontWeight="bold">
          Standard Bonus Amount Annual Limit:
        </Typography>
        <Typography variant="caption" display="block">
          The cumulative standard bonus amount is capped at 5.73 million yen per year (April 1 to March 31).
        </Typography>
      </Box>

      {/* Source Link */}
      {sourceUrl && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Source:</strong>{' '}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              {providerLabel} Premium Rates
            </a>
          </Typography>
        </Box>
      )}
    </>
  );
};

export default HealthInsuranceBonusTooltip;
