import React from 'react';
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  type SxProps, type Theme
} from '@mui/material';
import InfoTooltip from '../ui/InfoTooltip';

const labelTooltips: Record<string, string> = {
  'Health Insurance': 'Mandatory health insurance contributions.',
  'Pension Payments': 'Employees/National pension system contributions.',
  'Employment Insurance': 'Insurance for unemployment and work-related benefits.',
  'Income Tax': 'Income tax paid to the national government.',
  'Residence Tax': 'Local income tax paid to your local municipality and prefecture. Note that residence tax is billed in arrears. For example, residents on January 1, 2026 will be billed from June 2026 based on their income in 2025. If your income fluctuates from year to year, consider the effect on your residence tax billed in arrears.',
  'Total Deductions': 'Sum of all taxes and social insurance payments.',
};

const iconMap: Record<string, React.ReactNode> = {
  // Icons can be added here in the future if needed
};

interface ResultRowProps {
  label: string | React.ReactNode;
  value: string | React.ReactNode;
  type?: 'default' | 'indented' | 'subtotal' | 'total' | 'final' | 'header' | 'detail' | 'detail-subtotal';
  valuePrefix?: string;
  sx?: SxProps<Theme>;
  labelSuffix?: React.ReactNode; // Additional content to show after the label and tooltip
}

export const ResultRow: React.FC<ResultRowProps> = ({
  label,
  value,
  type = 'default',
  valuePrefix,
  sx: rowSxOverride,
  labelSuffix
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  let labelSpecificSx: SxProps<Theme> = {};
  let valueSpecificSx: SxProps<Theme> = {};
  let boxSx: SxProps<Theme> = {
    display: 'flex',
    alignItems: 'center',
    py: isMobile ? 0.15 : 0.6, // reduced vertical padding for mobile
    bgcolor: type === 'final' ? 'rgba(76, 175, 80, 0.07)' : undefined,
    borderRadius: type === 'final' ? 2 : undefined,
    mt: type === 'final' ? (isMobile ? 0.5 : 1) : undefined, // less margin on mobile
  };

  switch (type) {
    case 'header':
      labelSpecificSx = { fontWeight: 500, fontSize: isMobile ? '0.98rem' : '1rem', color: 'text.primary' };
      valueSpecificSx = { fontWeight: 500, fontSize: isMobile ? '0.98rem' : '1rem', color: 'text.primary' };
      boxSx.py = isMobile ? 0.3 : 1.1; // slightly reduced
      break;
    case 'indented':
      labelSpecificSx = { fontSize: '0.95rem', color: 'text.secondary', display: 'flex', alignItems: 'center' };
      valueSpecificSx = { fontSize: '0.95rem', color: 'text.primary' };
      boxSx.pl = theme.spacing(2.5); // Indentation for sub-items
      boxSx.py = isMobile ? 0.18 : 0.6;
      break;
    case 'subtotal':
      labelSpecificSx = { fontSize: '1rem', fontWeight: 500, color: 'primary.main' };
      valueSpecificSx = { fontSize: '1rem', fontWeight: 700, color: 'primary.main' };
      boxSx.pl = theme.spacing(2.5); // Match indentation of items it subtotals
      boxSx.pt = isMobile ? 0.4 : 0.75;
      boxSx.mt = isMobile ? 0.3 : 0.5;
      boxSx.borderTop = `1px solid ${theme.palette.divider}`; // Solid line for emphasis
      break;
    case 'total':
      labelSpecificSx = { fontSize: isMobile ? '1.05rem' : '1.1rem', fontWeight: 600, color: 'text.primary' };
      valueSpecificSx = { fontSize: isMobile ? '1.05rem' : '1.1rem', fontWeight: 700, color: 'error.main' };
      boxSx.py = isMobile ? 0.4 : 1;
      boxSx.mt = isMobile ? 0.3 : 0.5;
      boxSx.borderTop = `2px solid ${theme.palette.divider}`; // Line above total deductions
      break;
    case 'final':
      labelSpecificSx = {
        ...labelSpecificSx,
        fontSize: isMobile ? '1.15rem' : '1.3rem', // Make it larger than total
        fontWeight: 700,
        color: 'success.dark',
        textAlign: 'left',
        minWidth: 0,
        pr: 2,
        flexShrink: 1,
        flexBasis: 'auto',
        width: 'auto',
      };
      valueSpecificSx = {
        ...valueSpecificSx,
        fontSize: isMobile ? '1.15rem' : '1.3rem', // Match label
        fontWeight: 700,
        color: 'success.main',
        textAlign: 'right',
        marginLeft: 'auto',
        minWidth: 0,
        flexShrink: 1,
        flexBasis: 'auto',
        width: 'auto',
        overflowWrap: 'break-word',
        whiteSpace: 'nowrap',
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'center',
      };
      boxSx = {
        ...boxSx,
        py: isMobile ? 0.5 : 1.5, // reduced on mobile
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
      };
      break;
    case 'detail':
      labelSpecificSx = { fontSize: '0.8rem', color: 'text.disabled' };
      valueSpecificSx = { fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 };
      boxSx.pl = theme.spacing(3.5); // Deeper indent for details
      boxSx.py = isMobile ? 0.12 : 0.5;
      break;
    case 'detail-subtotal': // For subtotals within the detailed view
      labelSpecificSx = { fontSize: '0.8rem', fontWeight: 500, color: 'text.disabled' };
      valueSpecificSx = { fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' };
      boxSx.pl = theme.spacing(3.5); // Match detail indentation
      boxSx.py = isMobile ? 0.12 : 0.5;
      // No border for detail-subtotals to keep it lighter
      break;
    default: // 'default' for percentage row
      labelSpecificSx = { fontSize: '0.95rem', color: 'text.secondary' };
      valueSpecificSx = { fontSize: '0.95rem', fontWeight: 500, color: 'text.primary' };
      break;
  }

  // Merge rowSxOverride after specific type styles have been applied to boxSx
  if (rowSxOverride) {
    boxSx = { ...boxSx, ...rowSxOverride };
  }

  // Responsive: stack label/value vertically on mobile
  const leftColumnLayoutSx: SxProps<Theme> = isMobile
    ? { width: '60%', textAlign: 'left', pr: 1 }
    : { flexBasis: '60%', textAlign: 'left', pr: 2 };
  const rightColumnLayoutSx: SxProps<Theme> = isMobile
    ? { width: '40%', textAlign: 'right' }
    : { flexBasis: '40%', textAlign: 'right' };

  // Add tooltip and icon if available
  const labelContent = (
    <Box component="span" sx={{ display: 'inline-flex' }}>
      {iconMap[typeof label === 'string' ? label : ''] || null}
      {label}
      {typeof label === 'string' && labelTooltips[label] && (
        <InfoTooltip title={labelTooltips[label]} />
      )}
      {labelSuffix}
    </Box>
  );

  return (
    <Box sx={boxSx}>
      <Typography sx={{ ...leftColumnLayoutSx, ...labelSpecificSx }}>
        {labelContent}
      </Typography>
      <Typography sx={{ ...rightColumnLayoutSx, ...valueSpecificSx }}>
        {valuePrefix}{value}
      </Typography>
    </Box>
  );
};
