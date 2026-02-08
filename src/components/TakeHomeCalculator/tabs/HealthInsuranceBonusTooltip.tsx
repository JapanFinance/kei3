// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { CUSTOM_PROVIDER_ID } from '../../../types/healthInsurance';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { DEFAULT_PROVIDER_REGION } from '../../../types/healthInsurance';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import type { HealthInsuranceBonusBreakdownItem } from '../../../utils/healthInsuranceCalculator';

interface HealthInsuranceBonusTooltipProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
  breakdown?: HealthInsuranceBonusBreakdownItem[] | undefined;
}

const HealthInsuranceBonusTooltip: React.FC<HealthInsuranceBonusTooltipProps> = ({ inputs, breakdown }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;

  let employeeRate = 0;
  let employerRate: number | undefined;
  let providerLabel = '';
  let sourceUrl: string | undefined;

  if (provider === CUSTOM_PROVIDER_ID) {
    // Custom rates are entered as percentages (e.g. 5 for 5%)
    employeeRate = (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100;
    // For custom provider, we don't know the employer rate, so we leave it undefined.
    providerLabel = "Custom Provider";
  } else {
    const providerDef = PROVIDER_DEFINITIONS[provider];
    if (providerDef) {
      const regionalRates = providerDef.regions[region] || providerDef.regions[DEFAULT_PROVIDER_REGION];
      if (regionalRates) {
        // Regional rates are stored as decimals (e.g. 0.05 for 5%)
        employeeRate = regionalRates.employeeHealthInsuranceRate;
        employerRate = regionalRates.employerHealthInsuranceRate ?? regionalRates.employeeHealthInsuranceRate;
        sourceUrl = regionalRates.source;
      }
      // Fallback for source if not in regional rates
      if (!sourceUrl) {
        sourceUrl = providerDef.defaultSource;
      }
      providerLabel = `${providerDef.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
    }
  }

  // Add Long Term Care rate if applicable
  if (inputs.isSubjectToLongTermCarePremium) {
    if (provider === CUSTOM_PROVIDER_ID) {
      const ltcRate = (inputs.customEHIRates?.longTermCareRate ?? 0) / 100;
      employeeRate += ltcRate;
      // Employer rate remains undefined for custom provider
    } else {
      const providerDef = PROVIDER_DEFINITIONS[provider];
      if (providerDef) {
        const regionalRates = providerDef.regions[region] || providerDef.regions[DEFAULT_PROVIDER_REGION];
        if (regionalRates) {
          employeeRate += regionalRates.employeeLongTermCareRate;
          if (employerRate !== undefined) {
            employerRate += regionalRates.employerLongTermCareRate ?? regionalRates.employeeLongTermCareRate;
          }
        }
      }
    }
  }

  // Helper to format month index to name
  const getMonthName = (monthIndex: number) => {
    const date = new Date();
    date.setMonth(monthIndex);
    return date.toLocaleString('default', { month: 'short' });
  };

  return (
    <Box sx={{ p: 1, maxWidth: 500 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Bonus Health Insurance Premium
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is calculated as follows, where the Standard Bonus Amount is the gross bonus rounded down to the nearest 1,000 yen.
      </Typography>

      <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          Standard Bonus Amount × {formatPercent(employeeRate)}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {employerRate !== undefined
          ? `The employer also pays at a rate of ${formatPercent(employerRate)}.`
          : `The employer also contributes separately.`}
      </Typography>

      {breakdown && breakdown.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.9em' }}>
            Calculation Detail
          </Typography>
          <Box
            component="table"
            sx={{
              width: '100%',
              fontSize: '0.85em',
              borderCollapse: 'collapse',
              '& th': { textAlign: 'left', borderBottom: '1px solid #ccc', p: 0.5 },
              '& td': { p: 0.5, borderBottom: '1px solid #eee' },
              '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'right' }
            }}
          >
            <thead>
              <tr>
                <th>Month</th>
                <th>Bonus</th>
                <th>Std. Bonus Amount</th>
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
                      <span style={{ color: 'orange', marginLeft: 4 }} title={`Capped: Cumulative Standard Bonus (${formatJPY(item.cumulativeStandardBonus)}) reached annnual limit`}>*</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatJPY(item.healthInsurancePremium + item.longTermCarePremium)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #aaa', fontWeight: 700 }}>
                <td style={{ paddingTop: 4 }}>Total</td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.bonusAmount, 0))}
                </td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.standardBonusAmount, 0))}
                </td>
                <td style={{ paddingTop: 4 }}>
                  {formatJPY(breakdown.reduce((sum, item) => sum + item.healthInsurancePremium + item.longTermCarePremium, 0))}
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
            <span style={{ color: 'orange', marginRight: 4 }}>*</span>
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
    </Box>
  );
};

export default HealthInsuranceBonusTooltip;
