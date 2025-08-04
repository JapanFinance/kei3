import React from 'react';
import { Box, Typography } from '@mui/material';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import InfoTooltip from './InfoTooltip';
import type { CapStatus } from '../../utils/capDetection';

interface CapIndicatorProps {
  capStatus: CapStatus;
  iconOnly?: boolean;
  itemName?: string; // Simple string describing what is capped (e.g., "health insurance", "pension", "medical portion")
}

/**
 * Visual indicator that shows when health insurance and pension contributions are capped
 */
export const CapIndicator: React.FC<CapIndicatorProps> = ({ capStatus, iconOnly = false, itemName }) => {
  const hasAnyCaps = capStatus.healthInsuranceCapped || capStatus.pensionCapped;
  
  if (!hasAnyCaps) {
    return null;
  }

  // Create simple tooltip content
  const tooltipContent = (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {itemName ? 
          `This ${itemName} contribution has reached its maximum amount.` :
          'This contribution has reached its maximum amount.'
        }
      </Typography>
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        💡 Additional income won't increase this contribution further.
      </Typography>
    </Box>
  );

  if (iconOnly) {
    return (
      <InfoTooltip
        title="Contribution Cap Applied"
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
      title="Contribution Cap Applied"
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
            Capped
          </Typography>
        </Box>
      }
      iconSx={{ p: 0, ml: 0.5 }}
      children={tooltipContent}
    />
  );
};

export default CapIndicator;
