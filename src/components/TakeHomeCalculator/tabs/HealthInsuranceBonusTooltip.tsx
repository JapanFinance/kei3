// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { CUSTOM_PROVIDER_ID } from '../../../types/healthInsurance';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { DEFAULT_PROVIDER_REGION } from '../../../types/healthInsurance';

interface HealthInsuranceBonusTooltipProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const HealthInsuranceBonusTooltip: React.FC<HealthInsuranceBonusTooltipProps> = ({ inputs }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;
  
  let employeeRate = 0;
  let providerLabel = '';

  if (provider === CUSTOM_PROVIDER_ID) {
    // Custom rates are entered as percentages (e.g. 5 for 5%)
    employeeRate = (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100;
    providerLabel = "Custom Provider";
  } else {
    const providerDef = PROVIDER_DEFINITIONS[provider];
    if (providerDef) {
      const regionalRates = providerDef.regions[region] || providerDef.regions[DEFAULT_PROVIDER_REGION];
      if (regionalRates) {
        // Regional rates are stored as decimals (e.g. 0.05 for 5%)
        employeeRate = regionalRates.employeeHealthInsuranceRate;
      }
      providerLabel = `${providerDef.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
    }
  }

  // Add Long Term Care rate if applicable
  if (inputs.isSubjectToLongTermCarePremium) {
     if (provider === CUSTOM_PROVIDER_ID) {
        employeeRate += (inputs.customEHIRates?.longTermCareRate ?? 0) / 100;
     } else {
        const providerDef = PROVIDER_DEFINITIONS[provider];
        if (providerDef) {
           const regionalRates = providerDef.regions[region] || providerDef.regions[DEFAULT_PROVIDER_REGION];
           if (regionalRates) {
              employeeRate += regionalRates.employeeLongTermCareRate;
           }
        }
     }
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Bonus Health Insurance Premium
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        For bonuses, the premium is calculated by multiplying the Standard Bonus Amount (rounded down to nearest 1,000 yen) by the premium rate.
      </Typography>
      
      <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          Bonus Amount × Rate ({ (employeeRate * 100).toFixed(3) }%)
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        * The rate shown is the employee's share.
        <br/>
        * Provider: {providerLabel}
      </Typography>

      <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
        <Typography variant="caption" fontWeight="bold">
          Cap Limit:
        </Typography>
        <Typography variant="caption" display="block">
          Premiums are capped at a cumulative annual bonus amount of 5.73 million yen (April 1 to March 31).
        </Typography>
      </Box>
    </Box>
  );
};

export default HealthInsuranceBonusTooltip;
