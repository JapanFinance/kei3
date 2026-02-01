// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import InsuranceIcon from '@mui/icons-material/HealthAndSafety';
import InfoTooltip from '../../ui/InfoTooltip';
import DetailInfoTooltip from '../../ui/DetailInfoTooltip';
import { ResultRow } from '../ResultRow';
import { employmentInsuranceRate } from '../../../utils/taxCalculations';
import HealthInsurancePremiumTableTooltip from './HealthInsurancePremiumTableTooltip';
import PensionPremiumTableTooltip from './PensionPremiumTableTooltip';
import HealthInsuranceBonusTooltip from './HealthInsuranceBonusTooltip';
import PensionBonusTooltip from './PensionBonusTooltip';
import CapIndicator from '../../ui/CapIndicator';
import { detectCaps } from '../../../utils/capDetection';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../../../types/healthInsurance';

interface SocialInsuranceTabProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const SocialInsuranceTab: React.FC<SocialInsuranceTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalSocialInsurance = results.socialInsuranceOverride !== undefined
    ? results.socialInsuranceOverride
    : results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);

  // Determine if using National Health Insurance
  const isNationalHealthInsurance = inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;


  // Detect if any caps are applied
  const capStatus = detectCaps(results);

  if (results.socialInsuranceOverride !== undefined) {
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

        <Box sx={{ my: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed', borderColor: 'text.secondary' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Using manually entered social insurance amount.
            <br />
            Detailed breakdown is not available.
          </Typography>
        </Box>

        <ResultRow label="Total Social Insurance" value={formatJPY(totalSocialInsurance)} type="total" />
      </Box>
    );
  }

  // Calculate specifically for display purposes
  const salaryIncome = inputs.incomeStreams.length > 0
    ? inputs.incomeStreams
      .filter(s => s.type === 'salary')
      .reduce((sum, s) => sum + (s.frequency === 'monthly' ? s.amount * 12 : s.amount), 0)
    : (results.isEmploymentIncome ? results.annualIncome : 0);

  const bonusIncome = inputs.incomeStreams
    .filter(s => s.type === 'bonus')
    .reduce((sum, s) => sum + s.amount, 0);

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

      {isNationalHealthInsurance ? (
        <>
          <ResultRow label="Annual Income" value={formatJPY(results.annualIncome)} type="header" />
          {/* For NHI, show the income calculation details regardless of employment status */}
          {results.isEmploymentIncome && (
            <ResultRow label="Net Employment Income" value={formatJPY(results.netEmploymentIncome!)} type="default" />
          )}
          {results.totalNetIncome !== undefined && results.netEmploymentIncome !== undefined && (results.totalNetIncome - results.netEmploymentIncome > 0) && (
            <ResultRow
              label="Business / Misc Income"
              value={formatJPY(results.totalNetIncome - results.netEmploymentIncome)}
              type="default"
            />
          )}
          {results.blueFilerDeduction !== undefined && results.blueFilerDeduction > 0 && (
            <ResultRow label="Blue-Filer Deduction" value={formatJPY(-results.blueFilerDeduction)} type="default" />
          )}
          <ResultRow label="Basic Deduction" value={formatJPY(-results.residenceTaxBasicDeduction!)} type="default" />
          <ResultRow
            label="NHI Calculation Base"
            value={formatJPY(Math.max(0, (results.totalNetIncome ?? results.annualIncome) - results.residenceTaxBasicDeduction!))}
            type="default"
          />
        </>
      ) : (
        <>
          {/* For Employees' Health Insurance, show the salary info, since that is the basis for calculations */}
          <ResultRow label="Annual Salary Income" value={formatJPY(salaryIncome)} type="header" />
          <ResultRow label="Monthly Salary Income" value={formatJPY(salaryIncome / 12)} type="default" />
          {bonusIncome > 0 && (
            <ResultRow label="Annual Bonus Income" value={formatJPY(bonusIncome)} type="default" />
          )}
        </>
      )}

      {/* Health Insurance */}
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {isNationalHealthInsurance ? "National Health Insurance" : "Employees' Health Insurance"}
            {isNationalHealthInsurance && (
              <DetailInfoTooltip
                title="Health Insurance Premium Details"
                children={<HealthInsurancePremiumTableTooltip results={results} inputs={inputs} />}
              />
            )}
          </Typography>
          {!isNationalHealthInsurance && capStatus.healthInsuranceCapped && (
            <CapIndicator capStatus={capStatus} contributionType="health insurance" iconOnly={isMobile} />
          )}
        </Box>
        {isNationalHealthInsurance ? (
          <>
            <ResultRow
              label="Medical Portion"
              labelSuffix={capStatus.healthInsuranceCapDetails?.medicalCapped && (
                <CapIndicator capStatus={capStatus} iconOnly contributionType="medical portion" />
              )}
              value={formatJPY(results.nhiMedicalPortion ?? 0)}
              type="indented"
            />
            <ResultRow
              label="Elderly Support Portion"
              labelSuffix={capStatus.healthInsuranceCapDetails?.supportCapped && (
                <CapIndicator capStatus={capStatus} iconOnly contributionType="elderly support portion" />
              )}
              value={formatJPY(results.nhiElderlySupportPortion ?? 0)}
              type="indented"
            />
            {results.nhiLongTermCarePortion !== undefined && results.nhiLongTermCarePortion > 0 && (
              <ResultRow
                label="Long-term Care Portion"
                labelSuffix={capStatus.healthInsuranceCapDetails?.ltcCapped && (
                  <CapIndicator capStatus={capStatus} iconOnly contributionType="long-term care portion" />
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
              labelSuffix={
                <DetailInfoTooltip
                  title="Health Insurance Premium Details"
                  children={<HealthInsurancePremiumTableTooltip results={results} inputs={inputs} />}
                />
              }
              value={formatJPY((results.healthInsurance - (results.healthInsuranceOnBonus ?? 0)) / 12)}
              type="indented"
            />
            {results.healthInsuranceOnBonus !== undefined && results.healthInsuranceOnBonus > 0 && (
              <ResultRow
                label="Bonus Premium"
                labelSuffix={
                  <DetailInfoTooltip
                    title="Bonus Health Insurance Details"
                    children={<HealthInsuranceBonusTooltip results={results} inputs={inputs} />}
                  />
                }
                value={formatJPY(results.healthInsuranceOnBonus)}
                type="indented"
              />
            )}
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {isNationalHealthInsurance ? "National Pension" : "Employees' Pension"}
            {isNationalHealthInsurance && (
              <DetailInfoTooltip
                title="Pension Contribution Details"
                children={<PensionPremiumTableTooltip inputs={inputs} />}
              />
            )}
          </Typography>
          {(capStatus.pensionCapped || capStatus.pensionFixed) && (
            <CapIndicator capStatus={capStatus} contributionType="pension" />
          )}
        </Box>
        <ResultRow
          label="Monthly Contribution"
          labelSuffix={
            !isNationalHealthInsurance && (
              <DetailInfoTooltip
                title="Pension Contribution Details"
                children={<PensionPremiumTableTooltip inputs={inputs} />}
              />
            )
          }
          value={formatJPY(Math.round((results.pensionPayments - (results.pensionOnBonus ?? 0)) / 12))}
          type="indented"
        />
        {results.pensionOnBonus !== undefined && results.pensionOnBonus > 0 && (
          <ResultRow
            label="Bonus Contribution"
            labelSuffix={
              <DetailInfoTooltip
                title="Bonus Pension Contribution Details"
                children={<PensionBonusTooltip />}
              />
            }
            value={formatJPY(results.pensionOnBonus)}
            type="indented"
          />
        )}
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
            value={formatJPY(Math.round(((results.employmentInsurance ?? 0) - (results.employmentInsuranceOnBonus ?? 0)) / 12))}
            type="indented"
          />
          {results.employmentInsuranceOnBonus !== undefined && results.employmentInsuranceOnBonus > 0 && (
            <ResultRow
              label="Bonus Premium"
              value={formatJPY(results.employmentInsuranceOnBonus)}
              type="indented"
            />
          )}
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
