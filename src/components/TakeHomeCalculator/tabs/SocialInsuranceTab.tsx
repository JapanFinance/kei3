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
import { DetailedTooltip } from '../../ui/Tooltips';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import { ResultRow } from '../ResultRow';
import { employmentInsuranceRate } from '../../../utils/taxCalculations';
import HealthInsurancePremiumTooltip from './HealthInsurancePremiumTooltip';
import PensionPremiumTooltip from './PensionPremiumTooltip';
import EmploymentIncomeDeductionTooltip from './EmploymentIncomeDeductionTooltip';
import HealthInsuranceBonusTooltip from './HealthInsuranceBonusTooltip';
import PensionBonusTooltip from './PensionBonusTooltip';
import { calculatePensionBonusBreakdown, findPensionBracket } from '../../../utils/pensionCalculator';
import { calculateEmployeesHealthInsuranceBonusBreakdown } from '../../../utils/healthInsuranceCalculator';
import type { BonusIncomeStream } from '../../../types/tax';
import CapIndicator from '../../ui/CapIndicator';
import { detectCaps } from '../../../utils/capDetection';
import {
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
  DEFAULT_PROVIDER_REGION
} from '../../../types/healthInsurance';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { findSMRBracket } from '../../../data/employeesHealthInsurance/smrBrackets';

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

  // Calculate Health Insurance Bonus Breakdown for Tooltip
  // We need to determine the rates here to pass to the breakdown calculator
  const bonuses = inputs.incomeStreams.filter((s): s is BonusIncomeStream => s.type === 'bonus' && s.amount > 0);
  let healthInsuranceBreakdown = undefined;

  if (bonuses.length > 0 && !isNationalHealthInsurance) {
    const provider = inputs.healthInsuranceProvider;
    const region = inputs.region;
    let rates = undefined;

    if (provider === CUSTOM_PROVIDER_ID) {
      rates = {
        employeeHealthInsuranceRate: (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100,
        employeeLongTermCareRate: (inputs.customEHIRates?.longTermCareRate ?? 0) / 100
      };
    } else {
      const providerDef = PROVIDER_DEFINITIONS[provider];
      if (providerDef) {
        const regionalRates = providerDef.regions[region] || providerDef.regions[DEFAULT_PROVIDER_REGION];
        if (regionalRates) {
          rates = {
            employeeHealthInsuranceRate: regionalRates.employeeHealthInsuranceRate,
            employeeLongTermCareRate: regionalRates.employeeLongTermCareRate
          };
        }
      }
    }

    if (rates) {
      healthInsuranceBreakdown = calculateEmployeesHealthInsuranceBonusBreakdown(
        bonuses,
        rates,
        inputs.isSubjectToLongTermCarePremium
      );
    }
  }

  // Detect if any caps are applied
  const capStatus = detectCaps(results, healthInsuranceBreakdown);

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
    : (results.hasEmploymentIncome ? results.annualIncome : 0);

  const bonusIncome = inputs.incomeStreams
    .filter(s => s.type === 'bonus')
    .reduce((sum, s) => sum + s.amount, 0);

  // Calculate separated gross income
  const grossEmploymentIncome = inputs.incomeStreams
    .filter(s => s.type === 'salary' || s.type === 'bonus')
    .reduce((sum, s) => sum + (s.type === 'salary' && s.frequency === 'monthly' ? s.amount * 12 : s.amount), 0);

  const businessAndMiscIncome = inputs.incomeStreams
    .filter(s => s.type === 'business' || s.type === 'miscellaneous')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasEmploymentIncome = grossEmploymentIncome > 0;
  const hasBusinessOrMiscIncome = businessAndMiscIncome > 0;

  const monthlyCommutingAllowance = inputs.incomeStreams
    .filter(s => s.type === 'commutingAllowance')
    .reduce((sum, s) => {
      if (s.frequency === 'monthly') return sum + s.amount;
      if (s.frequency === '3-months') return sum + s.amount / 3;
      if (s.frequency === '6-months') return sum + s.amount / 6;
      return sum + s.amount / 12;
    }, 0);

  // Calculate Raw Monthly Remuneration (Salary + Commuting)
  const rawMonthlyRemuneration = inputs.incomeStreams
    .filter(s => s.type === 'salary' || s.type === 'commutingAllowance')
    .reduce((sum, s) => {
      if (s.frequency === 'monthly') return sum + s.amount;
      if (s.frequency === '3-months') return sum + s.amount / 3;
      if (s.frequency === '6-months') return sum + s.amount / 6;
      return sum + s.amount / 12;
    }, 0);

  // Find SMR Brackets
  const healthSMR = findSMRBracket(rawMonthlyRemuneration).smrAmount;
  const pensionSMR = findPensionBracket(rawMonthlyRemuneration).smrAmount;

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
          {/* For NHI, show the income calculation details regardless of employment status */}
          {hasEmploymentIncome && results.netEmploymentIncome !== undefined && (
            <ResultRow
              label={
                <span>
                  Net Employment Income
                  <DetailedTooltip
                    title="Employment Income Details"
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Calculation Breakdown
                      </Typography>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '8px' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Gross Employment Income:</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>{formatJPY(grossEmploymentIncome)}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Employment Income Deduction:</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', color: '#d32f2f' }}>-{formatJPY(grossEmploymentIncome - results.netEmploymentIncome)}</td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #ddd' }}>
                            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Employment Income:</td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{formatJPY(results.netEmploymentIncome)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <EmploymentIncomeDeductionTooltip />
                    </Box>
                  </DetailedTooltip>
                </span>
              }
              value={formatJPY(results.netEmploymentIncome)}
              type="default"
            />
          )}
          {hasBusinessOrMiscIncome && (
            <ResultRow
              label={
                <span>
                  Net Business / Misc Income
                  {results.blueFilerDeduction !== undefined && results.blueFilerDeduction > 0 && (
                    <DetailedTooltip
                      title="Business & Miscellaneous Income"
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Calculation Breakdown
                        </Typography>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '8px' }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '2px 0' }}>Business/Miscellaneous Income:</td>
                              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>{formatJPY(businessAndMiscIncome)}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
                              <td style={{ padding: '2px 0', textAlign: 'right', color: '#d32f2f' }}>-{formatJPY(results.blueFilerDeduction)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid #ddd' }}>
                              <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Business/Misc Income:</td>
                              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                                {formatJPY(results.totalNetIncome - (results.netEmploymentIncome ?? 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Blue-Filer Special Deduction
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            A special deduction for business operators with permission to file a Blue Return. This amount is deducted from business income after expenses before calculating taxable income.
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            Official Sources:
                            <ul>
                              <li>
                                <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                                  青色申告特別控除 - NTA
                                </a>
                              </li>
                            </ul>
                          </Box>
                        </Box>
                      </Box>
                    </DetailedTooltip>
                  )}
                </span>
              }
              value={formatJPY(results.totalNetIncome - (results.netEmploymentIncome ?? 0))}
              type="default"
            />
          )}
          {/* Total Net Income Row */}
          {hasEmploymentIncome && hasBusinessOrMiscIncome && (
            <ResultRow label="Total Net Income" value={formatJPY(results.totalNetIncome)} type="subtotal" sx={{ mt: 0.5, mb: 0.5 }} />
          )}
          <ResultRow label="Basic Deduction" value={formatJPY(-results.residenceTaxBasicDeduction!)} type="default" />
          <ResultRow
            label="NHI Calculation Base"
            value={formatJPY(Math.max(0, results.totalNetIncome - results.residenceTaxBasicDeduction!))}
            type="subtotal"
          />
        </>
      ) : (
        <>
          {/* For Employees' Health Insurance, show the salary info, since that is the basis for calculations */}
          <ResultRow label="Annual Salary Income" value={formatJPY(salaryIncome)} type="header" />
          <ResultRow
            label="Monthly Remuneration"
            labelSuffix={
              <DetailedTooltip
                title="Monthly Remuneration"
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Breakdown
                  </Typography>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 0' }}>Base Monthly Salary:</td>
                        <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                          {formatJPY(salaryIncome / 12)}
                        </td>
                      </tr>
                      {monthlyCommutingAllowance > 0 && (
                        <tr>
                          <td style={{ padding: '2px 0' }}>Monthly Commuting Allowance:</td>
                          <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                            {formatJPY(monthlyCommutingAllowance)}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderTop: '1px solid #ddd' }}>
                        <td style={{ padding: '4px 0', fontWeight: 600 }}>Total:</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{formatJPY(rawMonthlyRemuneration)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <Typography variant="body2" color="text.secondary">
                    Monthly remuneration includes base salary and various allowances (e.g. commuting allowance, housing allowance).
                  </Typography>
                </Box>
              </DetailedTooltip>
            }
            value={formatJPY(rawMonthlyRemuneration)}
            type="default"
          />
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
              <DetailedTooltip
                title="Health Insurance Premium"
              >
                <HealthInsurancePremiumTooltip results={results} inputs={inputs} standardMonthlyRemuneration={healthSMR} />
              </DetailedTooltip>
            )}
          </Typography>
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
        ) : ( // Employee Health Insurance
          <>
            <ResultRow
              label="Monthly Premium"
              labelSuffix={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                  <DetailedTooltip
                    title="Health Insurance Premium"
                  >
                    <HealthInsurancePremiumTooltip results={results} inputs={inputs} standardMonthlyRemuneration={healthSMR} />
                  </DetailedTooltip>
                  {capStatus.healthInsuranceCapped && (
                    <CapIndicator capStatus={capStatus} contributionType="health insurance" iconOnly={isMobile} />
                  )}
                </Box>
              }
              value={formatJPY((results.healthInsurance - (results.healthInsuranceOnBonus ?? 0)) / 12)}
              type="indented"
            />
            {results.healthInsuranceOnBonus !== undefined && results.healthInsuranceOnBonus > 0 && (
              <ResultRow
                label="Bonus Premium"
                labelSuffix={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    <DetailedTooltip
                      title="Bonus Health Insurance Premium"
                    >
                      <HealthInsuranceBonusTooltip results={results} inputs={inputs} breakdown={healthInsuranceBreakdown} />
                    </DetailedTooltip>
                    {capStatus.healthInsuranceBonusCapped && (
                      <CapIndicator capStatus={capStatus} contributionType="health insurance bonus" iconOnly={isMobile} />
                    )}
                  </Box>
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
              <DetailedTooltip
                title="Pension Contribution"
                icon={SIMPLE_TOOLTIP_ICON}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  National Pension (国民年金)
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
                  National pension contributions are a fixed amount regardless of income level.
                </Typography>
                <Box sx={{ mt: 1 }}>
                  Source:<a href="https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                    国民年金保険料の金額 (Japan Pension Service)
                  </a>
                </Box >
              </DetailedTooltip>
            )}
          </Typography>
        </Box>
        <ResultRow
          label="Monthly Contribution"
          labelSuffix={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
              {!isNationalHealthInsurance && (
                <DetailedTooltip
                  title="Pension Contribution"
                >
                  <PensionPremiumTooltip inputs={inputs} standardMonthlyRemuneration={pensionSMR} />
                </DetailedTooltip>
              )}
              {(capStatus.pensionCapped || capStatus.pensionFixed) && (
                <CapIndicator capStatus={capStatus} contributionType="pension" iconOnly={isMobile} />
              )}
            </Box>
          }
          value={formatJPY(Math.round((results.pensionPayments - (results.pensionOnBonus ?? 0)) / 12))}
          type="indented"
        />
        {results.pensionOnBonus !== undefined && results.pensionOnBonus > 0 && (
          <ResultRow
            label="Bonus Contribution"
            labelSuffix={
              <DetailedTooltip
                title="Bonus Pension Contribution"
              >
                <PensionBonusTooltip
                  breakdown={calculatePensionBonusBreakdown(
                    bonuses
                  )}
                />
              </DetailedTooltip>
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
      {results.hasEmploymentIncome && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
            Employment Insurance
            <DetailedTooltip
              title="Employment Insurance"
              icon={SIMPLE_TOOLTIP_ICON}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                雇用保険
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
            </DetailedTooltip>
          </Typography>
          <ResultRow
            label={`Monthly Premium (${(employmentInsuranceRate * 100).toFixed(2)}%)`}
            value={formatJPY(Math.round(((results.employmentInsurance ?? 0) - (results.employmentInsuranceOnBonus ?? 0)) / 12))}
            type="indented"
          />
          {results.employmentInsuranceOnBonus !== undefined && results.employmentInsuranceOnBonus > 0 && (
            <ResultRow
              label={`Bonus Premium (${(employmentInsuranceRate * 100).toFixed(2)}%)`}
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
          label={`Monthly ${results.hasEmploymentIncome ? 'Total' : 'Average'}`}
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
