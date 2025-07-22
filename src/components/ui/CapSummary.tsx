import React from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import type { CapStatus } from '../../utils/capDetection';
import { formatJPY } from '../../utils/formatters';

interface CapSummaryProps {
  capStatus: CapStatus;
  annualIncome: number;
}

/**
 * Comprehensive display of cap status for high-income users
 */
export const CapSummary: React.FC<CapSummaryProps> = ({ capStatus, annualIncome }) => {
  const hasAnyCaps = capStatus.healthInsuranceCapped || capStatus.pensionCapped;
  
  if (!hasAnyCaps) {
    return null;
  }

  return (
    <Alert 
      severity="info" 
      icon={<SecurityIcon />}
      sx={{ 
        mb: 2,
        '& .MuiAlert-message': {
          width: '100%',
        }
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Contribution Caps Applied
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        Your annual income of <strong>{formatJPY(annualIncome)}</strong> is high enough that the following contributions have reached their maximum amounts:
      </Typography>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {capStatus.pensionCapped && (
          <Chip 
            label="Pension Contributions" 
            color="primary" 
            size="small"
            icon={<SecurityIcon />}
          />
        )}
        
        {capStatus.healthInsuranceCapped && (
          <Chip 
            label={
              capStatus.healthInsuranceCapDetails ? 
                `Health Insurance (${Object.entries(capStatus.healthInsuranceCapDetails)
                  .filter(([, capped]) => capped)
                  .map(([component]) => component.charAt(0).toUpperCase() + component.slice(1).replace('Capped', ''))
                  .join(', ')})` :
                'Health Insurance'
            }
            color="primary" 
            size="small"
            icon={<SecurityIcon />}
          />
        )}
      </Box>
      
      <Typography variant="body2" sx={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
        💡 This means additional income above current levels won't increase these specific contributions further, 
        potentially improving your effective tax rate on incremental income.
      </Typography>
    </Alert>
  );
};

export default CapSummary;
