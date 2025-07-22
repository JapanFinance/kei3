import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import type { CapStatus } from '../../utils/capDetection';

interface CapIndicatorProps {
  capStatus: CapStatus;
  compact?: boolean;
}

/**
 * Visual indicator that shows when health insurance and pension contributions are capped
 */
export const CapIndicator: React.FC<CapIndicatorProps> = ({ capStatus, compact = false }) => {
  const hasAnyCaps = capStatus.healthInsuranceCapped || capStatus.pensionCapped;
  
  if (!hasAnyCaps) {
    return null;
  }

  const cappedItems: string[] = [];
  
  if (capStatus.pensionCapped) {
    cappedItems.push('Pension');
  }
  
  if (capStatus.healthInsuranceCapped) {
    if (capStatus.healthInsuranceCapDetails) {
      const details = capStatus.healthInsuranceCapDetails;
      const cappedComponents: string[] = [];
      
      if (details.medicalCapped) cappedComponents.push('Medical');
      if (details.supportCapped) cappedComponents.push('Elderly Support');
      if (details.ltcCapped) cappedComponents.push('Long-Term Care');
      
      if (cappedComponents.length > 0) {
        cappedItems.push(`Health Insurance (${cappedComponents.join(', ')})`);
      } else {
        cappedItems.push('Health Insurance');
      }
    } else {
      cappedItems.push('Health Insurance');
    }
  }

  const tooltipContent = (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Contribution Caps Applied
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Your income is high enough that the following contributions have reached their maximum amounts:
      </Typography>
      <Box component="ul" sx={{ pl: 2, m: 0 }}>
        {cappedItems.map((item, index) => (
          <Typography key={index} component="li" variant="body2" sx={{ mb: 0.3 }}>
            {item}
          </Typography>
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', fontSize: '0.85rem' }}>
        💡 This means additional income won't increase these contributions further.
      </Typography>
    </Box>
  );

  if (compact) {
    return (
      <Tooltip title={tooltipContent} placement="top">
        <Chip
          icon={<SecurityIcon sx={{ fontSize: '16px !important' }} />}
          label="Capped"
          size="small"
          color="warning"
          variant="outlined"
          sx={{
            fontSize: '0.75rem',
            height: 24,
            '& .MuiChip-icon': {
              fontSize: 14,
            },
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipContent} placement="top">
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: 'warning.light',
          color: 'warning.contrastText',
          border: '1px solid',
          borderColor: 'warning.main',
          cursor: 'help',
          fontSize: '0.85rem',
        }}
      >
        <SecurityIcon sx={{ fontSize: 16 }} />
        <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
          Cap Applied
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default CapIndicator;
