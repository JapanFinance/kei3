import React from 'react';
import {
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import InsuranceIcon from '@mui/icons-material/HealthAndSafety';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import { ResultRow } from '../ResultRow';
import InfoTooltip from '../../ui/InfoTooltip';
import CapIndicator from '../../ui/CapIndicator';
import { detectCaps } from '../../../utils/capDetection';

interface SummaryTabProps {
  results: TakeHomeResults;
  inputs?: TakeHomeInputs;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalSocialInsurance = results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);
  const totalTaxes = results.nationalIncomeTax + results.residenceTax.totalResidenceTax;
  const totalDeductions = totalSocialInsurance + totalTaxes;
  const takeHomePercentage = results.annualIncome > 0 ? `${((results.takeHomeIncome / results.annualIncome) * 100).toFixed(1)}%` : '100%';

  // Detect caps if inputs are provided
  const capStatus = inputs ? detectCaps(inputs) : null;

  return (
    <Box>
      <ResultRow label="Annual Income" value={formatJPY(results.annualIncome)} type="header" />
      <Divider sx={{ my: { xs: 1, sm: 1.5 } }} />

      {/* Social Insurance Section */}
      <Box sx={{ bgcolor: 'rgba(33,150,243,0.03)', borderRadius: 2, px: 1, py: 1, mb: { xs: 0.5, sm: 1 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 } }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '1rem' : '1.1rem'
            }}
          >
            <InsuranceIcon sx={{ mr: 1, fontSize: isMobile ? 18 : 20 }} />
            Social Insurance
          </Typography>
          {capStatus && (capStatus.healthInsuranceCapped || capStatus.pensionCapped) && (
            <CapIndicator capStatus={capStatus} compact />
          )}
        </Box>
        <ResultRow 
          label="Health Insurance" 
          value={
            !isMobile ? 
              `${formatJPY(results.healthInsurance)} (${((results.healthInsurance / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(results.healthInsurance)
          } 
          type="indented" 
        />
        <ResultRow 
          label="Pension Payments" 
          value={
            !isMobile ? 
              `${formatJPY(results.pensionPayments)} (${((results.pensionPayments / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(results.pensionPayments)
          } 
          type="indented" 
        />
        {results.isEmploymentIncome && (
          <ResultRow 
            label="Employment Insurance"
            value={
              !isMobile ? 
                `${formatJPY(results.employmentInsurance ?? 0)} (${(((results.employmentInsurance ?? 0) / results.annualIncome) * 100).toFixed(2)}%)` : 
                formatJPY(results.employmentInsurance ?? 0)
            } 
            type="indented" 
          />
        )}
        <ResultRow 
          label="Total Social Insurance" 
          value={
            !isMobile ? 
              `${formatJPY(totalSocialInsurance)} (${((totalSocialInsurance / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(totalSocialInsurance)
          } 
          type="subtotal" 
        />
      </Box>
      
      {/* Taxes Section */}
      <Box sx={{ bgcolor: 'rgba(255,193,7,0.03)', borderRadius: 2, px: 1, py: 1, mb: { xs: 0.5, sm: 1 } }}>
        <Typography
          variant="subtitle2"
          sx={{
            mt: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 },
            color: 'warning.main',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            fontSize: isMobile ? '1rem' : '1.1rem'
          }}
        >
          <AccountBalanceIcon sx={{ mr: 1, fontSize: isMobile ? 18 : 20, color: 'warning.main' }} />
          Taxes
        </Typography>
        <ResultRow 
          label="Income Tax" 
          value={
            !isMobile ? 
              `${formatJPY(results.nationalIncomeTax)} (${((results.nationalIncomeTax / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(results.nationalIncomeTax)
          } 
          type="indented" 
        />
        <ResultRow 
          label="Residence Tax" 
          value={
            !isMobile ? 
              `${formatJPY(results.residenceTax.totalResidenceTax)} (${((results.residenceTax.totalResidenceTax / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(results.residenceTax.totalResidenceTax)
          } 
          type="indented" 
        />
        <ResultRow 
          label="Total Taxes" 
          value={
            !isMobile ? 
              `${formatJPY(totalTaxes)} (${((totalTaxes / results.annualIncome) * 100).toFixed(1)}%)` : 
              formatJPY(totalTaxes)
          } 
          type="subtotal" 
        />
      </Box>
      
      {/* Total Deductions */}
      <Box>
         <ResultRow 
           label="Total Deductions" 
           value={
             !isMobile ? 
               `${formatJPY(-totalDeductions)} (${((totalDeductions / results.annualIncome) * 100).toFixed(1)}%)` : 
               formatJPY(-totalDeductions)
           } 
           type="total"
         />
      </Box>
      
      <Divider sx={{ borderBottomWidth: 2 }} />

      {/* Net Take-Home Pay */}
      <ResultRow
        label="Take-Home Pay"
        value={
          <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>
            {formatJPY(results.takeHomeIncome)}
            <Box
              component="span"
              sx={{
                color: 'success.dark',
                fontWeight: 600,
                ml: 1,
                whiteSpace: 'nowrap',
              }}
            >
              ({takeHomePercentage})
            </Box>
          </Box>
        }
        type="final"
      />

      {/* Furusato Nozei Summary */}
      {results.furusatoNozei !== undefined && results.furusatoNozei.limit > 0 && (
        <Box sx={{ bgcolor: 'rgba(156,39,176,0.07)', borderRadius: 2, px: 1, py: 1, mt: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 } }}>
          <Typography
            variant="subtitle2"
            sx={{
              mt: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 },
              color: 'secondary.main',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '1rem' : '1.1rem'
            }}
          >
            <VolunteerActivismIcon sx={{ mr: 1, fontSize: isMobile ? 18 : 20, color: 'secondary.main' }} />
            Furusato Nozei
          </Typography>
          <ResultRow
            label={
              <span>
                Furusato Nozei Limit
                {results.furusatoNozei.outOfPocketCost > 2200 && (
                  <InfoTooltip
                    title="Warning: High Out-of-Pocket Cost"
                    icon={<WarningIcon fontSize="small" />}
                    iconSx={{ color: 'error.main' }}
                    iconAriaLabel="Warning: High out-of-pocket cost"
                    children={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          Your out-of-pocket cost ({formatJPY(results.furusatoNozei.outOfPocketCost)}) is higher than the expected ≈2,000 yen.
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          See the Furusato Nozei tab for details.
                        </Typography>
                      </Box>
                    }
                  />
                )}
              </span>
            }
            value={
              <Box 
                component="span" 
                sx={{ 
                  color: results.furusatoNozei.outOfPocketCost > 2200 ? 'error.main' : 'inherit', 
                  fontWeight: results.furusatoNozei.outOfPocketCost > 2200 ? 700 : 500
                }}
              >
                {formatJPY(results.furusatoNozei.limit)}
              </Box>
            }
            type="subtotal"
            sx={{ mt: 1, borderRadius: 2 }}
          />
        </Box>
      )}
    </Box>
  );
};

export default SummaryTab;
