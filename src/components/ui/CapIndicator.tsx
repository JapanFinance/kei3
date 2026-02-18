// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import { DetailedTooltip } from './Tooltips';
import type { CapStatus } from '../../utils/capDetection';
import { formatJPY } from '../../utils/formatters';
import { ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP } from '../../utils/healthInsuranceCalculator';

interface CapIndicatorProps {
  capStatus: CapStatus;
  iconOnly?: boolean;
  contributionType: 'pension' | 'health insurance' | 'medical portion' | 'elderly support portion' | 'long-term care portion' | 'health insurance bonus';
}

/**
 * Visual indicator that shows when health insurance and pension contributions are capped or fixed
 */
export const CapIndicator: React.FC<CapIndicatorProps> = ({ capStatus, iconOnly = false, contributionType }) => {
  // Determine if this specific contribution type is capped or fixed
  let isIndicatorActive = false;
  let isNationalPension = false;
  const isNationalHealthInsurance = !!capStatus.pensionFixed;

  if (contributionType === 'pension') {
    isNationalPension = !!capStatus.pensionFixed;
    isIndicatorActive = capStatus.pensionCapped || isNationalPension;
  } else if (contributionType === 'health insurance') {
    isIndicatorActive = capStatus.healthInsuranceCapped || isNationalHealthInsurance;
  } else if (contributionType === 'medical portion') {
    isIndicatorActive = !!capStatus.healthInsuranceCapDetails?.medicalCapped;
  } else if (contributionType === 'elderly support portion') {
    isIndicatorActive = !!capStatus.healthInsuranceCapDetails?.supportCapped;
  } else if (contributionType === 'long-term care portion') {
    isIndicatorActive = !!capStatus.healthInsuranceCapDetails?.ltcCapped;
  } else if (contributionType === 'health insurance bonus') {
    isIndicatorActive = !!capStatus.healthInsuranceBonusCapped;
  }

  if (!isIndicatorActive) {
    return null;
  }

  // Determine label and tooltip
  const labelText = isNationalPension ? 'Fixed' : 'Capped';

  const tooltipContent = (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {isNationalPension
          ? `This ${contributionType} contribution is fixed and does not increase with income.`
          : contributionType === 'health insurance bonus'
            ? `Total bonus income subject to health insurance premiums is capped at ${formatJPY(ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP)} per year.`
            : `This ${contributionType} contribution has reached its maximum amount.`
        }
      </Typography>
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        {isNationalPension || isNationalHealthInsurance
          ? '💡 Additional income will not change this amount.'
          : contributionType === 'health insurance bonus'
            ? '💡 Additional bonus income will not increase this amount.'
            : `💡 Additional salary income will not increase this amount.`}
      </Typography>
    </Box>
  );

  if (iconOnly) {
    return (
      <DetailedTooltip
        title={isNationalPension ? 'Contribution Fixed' : 'Contribution Cap Applied'}
        icon={
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'warning.main',
            }}
          >
            <VerticalAlignTopIcon
              sx={{
                fontSize: 14,
                color: 'warning.main'
              }}
            />
          </Box>
        }
        iconSx={{ p: 0, ml: 0.5 }}
      >
        {tooltipContent}
      </DetailedTooltip>
    );
  }

  return (
    <DetailedTooltip
      title={isNationalPension ? 'Contribution Fixed' : 'Contribution Cap Applied'}
      icon={
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.main',
            color: 'warning.main',
            fontSize: '0.75rem',
            height: 24,
          }}
        >
          <VerticalAlignTopIcon sx={{ fontSize: 14 }} />
          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
            {labelText}
          </Typography>
        </Box>
      }
      iconSx={{ p: 0, ml: 0.5 }}
    >
      {tooltipContent}
    </DetailedTooltip>
  );
};

export default CapIndicator;
