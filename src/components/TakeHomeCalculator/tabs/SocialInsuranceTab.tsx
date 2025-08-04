import React from 'react';
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import InsuranceIcon from '@mui/icons-material/HealthAndSafety';
import InfoTooltip from '../../ui/InfoTooltip';
import DetailInfoTooltip from '../../ui/DetailInfoTooltip';
import { ResultRow } from '../ResultRow';
import { employmentInsuranceRate } from '../../../utils/taxCalculations';
import HealthInsurancePremiumTableTooltip from './HealthInsurancePremiumTableTooltip';
import PensionPremiumTableTooltip from './PensionPremiumTableTooltip';
import CapIndicator from '../../ui/CapIndicator';
import { detectCaps } from '../../../utils/capDetection';

interface SocialInsuranceTabProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const SocialInsuranceTab: React.FC<SocialInsuranceTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalSocialInsurance = results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);
  
  // Determine if using National Health Insurance
  const isNationalHealthInsurance = inputs.healthInsuranceProvider.id === 'NationalHealthInsurance';

  
  // Detect if any caps are applied
  const capStatus = detectCaps(results);

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          mb: 1,
          color: 'primary.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          fontSize: isMobile ? '1.1rem' : '1.25rem'
        }}
      >
        <InsuranceIcon sx={{ mr: 1, fontSize: isMobile ? 20 : 24 }} />
        Social Insurance Details
      </Typography>

      <ResultRow label="Annual Income" value={formatJPY(results.annualIncome)} type="header" />
      {isNationalHealthInsurance ? (
        <>
          {/* For NHI, show the income calculation details regardless of employment status */}
          {results.isEmploymentIncome && (
            <ResultRow label="Net Employment Income" value={formatJPY(results.netEmploymentIncome!)} type="default" />
          )}
          <ResultRow label="Basic Deduction" value={formatJPY(-results.residenceTaxBasicDeduction!)} type="default" />
          <ResultRow label="NHI Calculation Base" value={formatJPY(Math.max(0, (results.netEmploymentIncome ?? results.annualIncome) - results.residenceTaxBasicDeduction!))} type="default" />
        </>
      ) : (
        <ResultRow label="Monthly Income" value={formatJPY(results.annualIncome / 12)} type="default" />
      )}

      {/* Health Insurance */}
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {isNationalHealthInsurance ? "National Health Insurance" : "Employees' Health Insurance"}
            <DetailInfoTooltip
              title="Health Insurance Premium Details"
              children={<HealthInsurancePremiumTableTooltip results={results} inputs={inputs} />}
            />
          </Typography>
          {!isNationalHealthInsurance && capStatus.healthInsuranceCapped && (
            <CapIndicator capStatus={capStatus} itemName="health insurance" />
          )}
        </Box>
        {isNationalHealthInsurance ? (
          <>
            <ResultRow
              label="Medical Portion"
              labelSuffix={capStatus.healthInsuranceCapDetails?.medicalCapped && (
                <CapIndicator capStatus={capStatus} iconOnly itemName="medical portion" />
              )}
              value={formatJPY(results.nhiMedicalPortion ?? 0)}
              type="indented"
            />
            <ResultRow
              label="Elderly Support Portion"
              labelSuffix={capStatus.healthInsuranceCapDetails?.supportCapped && (
                <CapIndicator capStatus={capStatus} iconOnly itemName="elderly support portion" />
              )}
              value={formatJPY(results.nhiElderlySupportPortion ?? 0)}
              type="indented"
            />
            {results.nhiLongTermCarePortion !== undefined && results.nhiLongTermCarePortion > 0 && (
              <ResultRow
                label="Long-term Care Portion"
                labelSuffix={capStatus.healthInsuranceCapDetails?.ltcCapped && (
                  <CapIndicator capStatus={capStatus} iconOnly itemName="long-term care portion" />
                )}
                value={formatJPY(results.nhiLongTermCarePortion)}
                type="indented"
              />
            )}
            <ResultRow 
              label="Annual Premium" 
              value={formatJPY(results.healthInsurance)} 
              type="subtotal" 
            />
          </>
        ) : (
          <>
            <ResultRow 
              label="Monthly Premium" 
              value={formatJPY(results.healthInsurance / 12)} 
              type="indented" 
            />
            <ResultRow 
              label="Annual Premium" 
              value={formatJPY(results.healthInsurance)} 
              type="subtotal" 
            />
          </>
        )}
      </Box>

      {/* Pension Payments */}
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {isNationalHealthInsurance ? "National Pension" : "Employees' Pension Insurance"}
            <DetailInfoTooltip
              title="Pension Contribution Details"
              children={<PensionPremiumTableTooltip results={results} inputs={inputs} />}
            />
          </Typography>
          {capStatus.pensionCapped && <CapIndicator capStatus={capStatus} />}
        </Box>
        <ResultRow 
          label="Monthly Contribution" 
          value={formatJPY(Math.round(results.pensionPayments / 12))} 
          type="indented" 
        />
        <ResultRow 
          label="Annual Contribution" 
          value={formatJPY(results.pensionPayments)} 
          type="subtotal" 
        />
      </Box>

      {/* Employment Insurance */}
      {results.isEmploymentIncome && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
            Employment Insurance
            <InfoTooltip
              title="Employment Insurance (雇用保険)"
              children={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Employment Insurance (雇用保険)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Insurance for unemployment and work-related benefits.
                    This amount includes only the employment insurance premium paid by the employee. The rate is applied to your gross salary. The employer also contributes to employment insurance separately.
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    Official Source:
                    <ul>
                      <li>
                        <a href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          Employment Insurance Premium Rate (MHLW)
                        </a>
                      </li>
                    </ul>
                  </Box>
                </Box>
              }
            />
          </Typography>
          <ResultRow 
            label={`Monthly Premium (${(employmentInsuranceRate * 100).toFixed(2)}%)`}
            value={formatJPY(Math.round((results.employmentInsurance ?? 0) / 12))} 
            type="indented" 
          />
          <ResultRow 
            label="Annual Premium"
            value={formatJPY(results.employmentInsurance ?? 0)} 
            type="subtotal" 
          />
        </Box>
      )}

      {/* Total */}
      <Box sx={{ mt: 2 }}>
        <ResultRow 
          label={`Monthly ${results.isEmploymentIncome ? 'Total' : 'Average'}`}
          value={formatJPY(Math.round(totalSocialInsurance / 12))} 
          type="total" 
        />
        <ResultRow 
          label="Annual Social Insurance" 
          value={formatJPY(totalSocialInsurance)} 
          type="total" 
        />
      </Box>
    </Box>
  );
};

export default SocialInsuranceTab;
