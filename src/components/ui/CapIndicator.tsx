import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import InfoTooltip from './InfoTooltip';
import type { CapStatus } from '../../utils/capDetection';

interface CapIndicatorProps {
  capStatus: CapStatus;
  iconOnly?: boolean;
  contributionType: 'pension' | 'health insurance' | 'medical portion' | 'elderly support portion' | 'long-term care portion';
}

/**
 * Visual indicator that shows when health insurance and pension contributions are capped or fixed
 */
export const CapIndicator: React.FC<CapIndicatorProps> = ({ capStatus, iconOnly = false, contributionType }) => {
  const hasAnyCaps = capStatus.healthInsuranceCapped || capStatus.pensionCapped;
  if (!hasAnyCaps) {
    return null;
  }

  // Determine the appropriate label and tooltip content based on contribution type and status
  const isNationalPension = contributionType === 'pension' && capStatus.pensionFixed;
  const labelText = isNationalPension ? 'Fixed' : 'Capped';
  
  const tooltipContent = (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {isNationalPension
          ? `This ${contributionType} contribution is fixed and does not increase with income.`
          : `This ${contributionType} contribution has reached its maximum amount.`
        }
      </Typography>
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        {isNationalPension
          ? '💡 Additional income will not change this contribution.'
          : '💡 Additional income won\'t increase this contribution further.'}
      </Typography>
    </Box>
  );

  if (iconOnly) {
    return (
      <InfoTooltip
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
        children={tooltipContent}
      />
    );
  }

  return (
    <InfoTooltip
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
      children={tooltipContent}
    />
  );
};

export default CapIndicator;
