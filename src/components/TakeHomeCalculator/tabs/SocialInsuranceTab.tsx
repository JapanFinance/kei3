// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import InsuranceIcon from '@mui/icons-material/HealthAndSafety';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React from 'react';

import { findSMRBracket } from '../../../data/employeesHealthInsurance/smrBrackets';
import { LATTER_STAGE_RATE_TABLE_URL } from '../../../data/latterStageElderlyParams';
import {
  isLongTermCareCategory1Insured,
  isSubjectToEmployeesPension,
  isSubjectToLongTermCarePremium,
  isSubjectToNationalPension,
} from '../../../types/ageRange';
import {
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
  LATTER_STAGE_ELDERLY_ID,
} from '../../../types/healthInsurance';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import type { BonusIncomeStream } from '../../../types/tax';
import { detectCaps } from '../../../utils/capDetection';
import { formatJPY } from '../../../utils/formatters';
import { calculateEmployeesHealthInsuranceBonusBreakdown } from '../../../utils/healthInsuranceCalculator';
import {
  calculatePensionBonusBreakdown,
  findPensionBracket,
} from '../../../utils/pensionCalculator';
import CapIndicator from '../../ui/CapIndicator';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip, SimpleTooltip } from '../../ui/Tooltips';
import { ResultRow } from '../ResultRow';
import { SalaryBreakdownTooltip, BonusBreakdownTooltip } from './EmploymentInsuranceRateTooltip';
import HealthInsuranceBonusTooltip from './HealthInsuranceBonusTooltip';
import HealthInsurancePremiumTooltip, { NHIPortionTooltip } from './HealthInsurancePremiumTooltip';
import NationalPensionTooltip from './NationalPensionTooltip';
import NetEmploymentIncomeTooltip from './NetEmploymentIncomeTooltip';
import NetPublicPensionIncomeTooltip from './NetPublicPensionIncomeTooltip';
import PensionBonusTooltip from './PensionBonusTooltip';
import PensionPremiumTooltip from './PensionPremiumTooltip';

const LATTER_STAGE_SOURCES: Source[] = [
  {
    label: '後期高齢者医療制度の保険料率について (rates for all 47 prefectures)',
    href: LATTER_STAGE_RATE_TABLE_URL,
  },
  {
    label: '保険料試算用シート (per-portion rounding and caps)',
    href: 'https://www.tokyo-ikiiki.net/seido/1001968/1002520.html',
  },
  {
    label: '高齢者の医療の確保に関する法律施行令第18条 (uniform rates, premium cap)',
    href: 'https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18',
  },
];

interface SocialInsuranceTabProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const SocialInsuranceTab: React.FC<SocialInsuranceTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalSocialInsurance =
    results.socialInsuranceOverride !== undefined
      ? results.socialInsuranceOverride
      : results.healthInsurance +
        results.pensionPayments +
        (results.employmentInsurance ?? 0) +
        (results.longTermCareCategory1Premium ?? 0);

  // Determine if using National Health Insurance
  const isNationalHealthInsurance = inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;
  const isLatterStage = inputs.healthInsuranceProvider === LATTER_STAGE_ELDERLY_ID;
  // NHI and the 後期高齢者医療制度 both assess premiums on net income rather than SMR.
  const isIncomeBasedProvider = isNationalHealthInsurance || isLatterStage;
  const includeLTC = isSubjectToLongTermCarePremium(inputs.ageRange);

  // Calculate Health Insurance Bonus Breakdown for Tooltip
  // We need to determine the rates here to pass to the breakdown calculator
  const bonuses = inputs.incomeStreams.filter(
    (s): s is BonusIncomeStream => s.type === 'bonus' && s.amount > 0,
  );
  let healthInsuranceBreakdown = undefined;

  if (bonuses.length > 0 && !isIncomeBasedProvider) {
    const provider = inputs.healthInsuranceProvider;
    const region = inputs.region;

    if (provider === CUSTOM_PROVIDER_ID) {
      const rates = {
        employeeHealthInsuranceRate: (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100,
        employeeLongTermCareRate: (inputs.customEHIRates?.longTermCareRate ?? 0) / 100,
      };
      healthInsuranceBreakdown = calculateEmployeesHealthInsuranceBonusBreakdown(
        bonuses,
        rates,
        includeLTC,
        inputs.incomeYear,
      );
    } else {
      healthInsuranceBreakdown = calculateEmployeesHealthInsuranceBonusBreakdown(
        bonuses,
        provider,
        region,
        inputs.incomeYear,
        includeLTC,
      );
    }
  }

  // Detect if any caps are applied
  const capStatus = detectCaps(results, inputs.incomeYear, healthInsuranceBreakdown);

  const nationalPensionDue = isSubjectToNationalPension(inputs.ageRange);
  const employeesPensionDue = isSubjectToEmployeesPension(inputs.ageRange);

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
            fontSize: isMobile ? '1.1rem' : '1.25rem',
          }}
        >
          <InsuranceIcon sx={{ mr: 1, fontSize: isMobile ? 20 : 24 }} />
          Social Insurance Details
        </Typography>

        <ResultRow label="Annual Income" value={formatJPY(results.annualIncome)} type="header" />

        <Box
          sx={{
            my: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'text.secondary',
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            Using manually entered social insurance amount.
            <br />
            Detailed breakdown is not available.
          </Typography>
        </Box>

        <ResultRow
          label="Total Social Insurance"
          value={formatJPY(totalSocialInsurance)}
          type="total"
        />
      </Box>
    );
  }

  // Calculate specifically for display purposes
  const salaryIncome =
    inputs.incomeStreams.length > 0
      ? inputs.incomeStreams
          .filter(s => s.type === 'salary')
          .reduce((sum, s) => sum + (s.frequency === 'monthly' ? s.amount * 12 : s.amount), 0)
      : results.hasEmploymentIncome
        ? results.annualIncome
        : 0;

  const bonusIncome = inputs.incomeStreams
    .filter(s => s.type === 'bonus')
    .reduce((sum, s) => sum + s.amount, 0);

  const businessAndMiscIncome = inputs.incomeStreams
    .filter(s => s.type === 'business' || s.type === 'miscellaneous')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasEmploymentIncome = results.grossEmploymentIncome > 0;
  const hasBusinessOrMiscIncome = businessAndMiscIncome > 0;
  const hasPublicPensionIncome = (results.grossPublicPensionIncome ?? 0) > 0;
  // Backing the other net components out of the total keeps this row reconciled with it.
  const netBusinessAndMiscIncome =
    results.totalNetIncome -
    (results.netEmploymentIncome ?? 0) -
    (results.netPublicPensionIncome ?? 0);
  const presentIncomeComponents = [
    hasEmploymentIncome,
    hasBusinessOrMiscIncome,
    hasPublicPensionIncome,
  ].filter(Boolean).length;

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
          fontSize: isMobile ? '1.1rem' : '1.25rem',
        }}
      >
        <InsuranceIcon sx={{ mr: 1, fontSize: isMobile ? 20 : 24 }} />
        Social Insurance Details
      </Typography>

      {isIncomeBasedProvider ? (
        <>
          {/* For income-based providers, show the income calculation details regardless of employment status */}
          {hasEmploymentIncome && results.netEmploymentIncome !== undefined && (
            <ResultRow
              label={
                <span>
                  Net Employment Income
                  <NetEmploymentIncomeTooltip
                    grossEmploymentIncome={results.grossEmploymentIncome}
                    netEmploymentIncome={results.netEmploymentIncome}
                    incomeAdjustmentDeduction={results.incomeAdjustmentDeduction ?? 0}
                    pensionIncomeAdjustmentDeduction={results.pensionIncomeAdjustmentDeduction ?? 0}
                    year={inputs.incomeYear}
                  />
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
                    <DetailedTooltip title="Business & Miscellaneous Income">
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Calculation Breakdown
                        </Typography>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem',
                            marginBottom: '8px',
                          }}
                        >
                          <tbody>
                            <tr>
                              <td style={{ padding: '2px 0' }}>Business/Miscellaneous Income:</td>
                              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                                {formatJPY(businessAndMiscIncome)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
                              <Box
                                component="td"
                                sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
                              >
                                -{formatJPY(results.blueFilerDeduction)}
                              </Box>
                            </tr>
                            <tr style={{ borderTop: '1px solid #ddd' }}>
                              <td style={{ padding: '4px 0', fontWeight: 600 }}>
                                Net Business/Misc Income:
                              </td>
                              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                                {formatJPY(netBusinessAndMiscIncome)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Blue-Filer Special Deduction
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            A special deduction for business operators with permission to file a
                            Blue Return. This amount is deducted from business income after expenses
                            before calculating taxable income.
                          </Typography>
                          <SourceLinks
                            sources={[
                              {
                                href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
                                label: '青色申告特別控除 - NTA',
                              },
                            ]}
                          />
                        </Box>
                      </Box>
                    </DetailedTooltip>
                  )}
                </span>
              }
              value={formatJPY(netBusinessAndMiscIncome)}
              type="default"
            />
          )}
          {hasPublicPensionIncome && (
            <ResultRow
              label={
                <span>
                  Net Public Pension Income
                  <NetPublicPensionIncomeTooltip
                    grossPublicPensionIncome={results.grossPublicPensionIncome ?? 0}
                    netPublicPensionIncome={results.netPublicPensionIncome ?? 0}
                  />
                </span>
              }
              value={formatJPY(results.netPublicPensionIncome ?? 0)}
              type="default"
            />
          )}
          {/* Total Net Income Row */}
          {presentIncomeComponents >= 2 && (
            <ResultRow
              label="Total Net Income"
              value={formatJPY(results.totalNetIncome)}
              type="subtotal"
            />
          )}
          <ResultRow
            label="Basic Deduction"
            value={formatJPY(-results.residenceTaxBasicDeduction!)}
            type="default"
          />
          <ResultRow
            label={isNationalHealthInsurance ? 'NHI Calculation Base' : 'Premium Calculation Base'}
            value={formatJPY(
              Math.max(0, results.totalNetIncome - results.residenceTaxBasicDeduction!),
            )}
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
              <DetailedTooltip title="Monthly Remuneration">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Breakdown
                  </Typography>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.9rem',
                      marginBottom: '8px',
                    }}
                  >
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
                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                          {formatJPY(rawMonthlyRemuneration)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <Typography variant="body2" color="text.secondary">
                    Monthly remuneration includes base salary and various allowances (e.g. commuting
                    allowance, housing allowance).
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
            {isLatterStage
              ? 'Medical System for the Elderly (75+)'
              : isNationalHealthInsurance
                ? 'National Health Insurance'
                : "Employees' Health Insurance"}
            {isNationalHealthInsurance && (
              <DetailedTooltip title="Health Insurance Premium" icon={SIMPLE_TOOLTIP_ICON}>
                <HealthInsurancePremiumTooltip
                  inputs={inputs}
                  standardMonthlyRemuneration={healthSMR}
                />
              </DetailedTooltip>
            )}
            {isLatterStage && (
              <DetailedTooltip
                title="Medical System for the Elderly Premium"
                icon={SIMPLE_TOOLTIP_ICON}
              >
                <Typography variant="body2" sx={{ mb: 1 }}>
                  The annual premium is a per-capita amount (均等割額) plus an income-based amount:
                  the rate applied to total net income minus the basic deduction. Each portion is
                  rounded down to ¥100 and capped at its statutory maximum (賦課限度額), which is
                  set nationally. Rates are uniform across each prefecture by law and are revised
                  every two years.
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  The low-income per-capita reduction (均等割額の軽減) and the reduction for former
                  dependents (元被扶養者) are not currently applied.
                </Typography>
                <SourceLinks sources={LATTER_STAGE_SOURCES} />
              </DetailedTooltip>
            )}
          </Typography>
        </Box>
        {isLatterStage ? (
          <>
            <ResultRow
              label="Medical Portion"
              labelSuffix={
                capStatus.healthInsuranceCapped ? (
                  <CapIndicator
                    capStatus={capStatus}
                    contributionType="health insurance"
                    iconOnly={isMobile}
                  />
                ) : undefined
              }
              value={formatJPY(results.latterStageMedicalPortion ?? 0)}
              type="indented"
            />
            {results.latterStageChildSupportPortion !== undefined &&
              results.latterStageChildSupportPortion > 0 && (
                <ResultRow
                  label="Child Support Portion"
                  value={formatJPY(results.latterStageChildSupportPortion)}
                  type="indented"
                />
              )}
            <ResultRow
              label="Annual Premium"
              value={formatJPY(results.healthInsurance)}
              type="subtotal"
            />
          </>
        ) : isNationalHealthInsurance ? (
          <>
            <ResultRow
              label="Medical Portion"
              labelSuffix={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                  <DetailedTooltip title="🏥 Medical Portion (医療分)">
                    <NHIPortionTooltip portion="medical" results={results} inputs={inputs} />
                  </DetailedTooltip>
                  {capStatus.healthInsuranceCapDetails?.medicalCapped && (
                    <CapIndicator
                      capStatus={capStatus}
                      iconOnly
                      contributionType="medical portion"
                    />
                  )}
                </Box>
              }
              value={formatJPY(results.nhiMedicalPortion ?? 0)}
              type="indented"
            />
            <ResultRow
              label="Elderly Support Portion"
              labelSuffix={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                  <DetailedTooltip title="👥 Elderly Support Portion (後期高齢者支援金分)">
                    <NHIPortionTooltip portion="elderlySupport" results={results} inputs={inputs} />
                  </DetailedTooltip>
                  {capStatus.healthInsuranceCapDetails?.supportCapped && (
                    <CapIndicator
                      capStatus={capStatus}
                      iconOnly
                      contributionType="elderly support portion"
                    />
                  )}
                </Box>
              }
              value={formatJPY(results.nhiElderlySupportPortion ?? 0)}
              type="indented"
            />
            {results.nhiLongTermCarePortion !== undefined && results.nhiLongTermCarePortion > 0 && (
              <ResultRow
                label="Long-term Care Portion"
                labelSuffix={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    <DetailedTooltip title="🏠 Long-Term Care Portion (介護分)">
                      <NHIPortionTooltip portion="longTermCare" results={results} inputs={inputs} />
                    </DetailedTooltip>
                    {capStatus.healthInsuranceCapDetails?.ltcCapped && (
                      <CapIndicator
                        capStatus={capStatus}
                        iconOnly
                        contributionType="long-term care portion"
                      />
                    )}
                  </Box>
                }
                value={formatJPY(results.nhiLongTermCarePortion)}
                type="indented"
              />
            )}
            {results.nhiChildSupportPortion !== undefined && results.nhiChildSupportPortion > 0 && (
              <ResultRow
                label="Child Support Portion"
                labelSuffix={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    <DetailedTooltip title="👶 Child Support Portion (子ども・子育て支援納付金分)">
                      <NHIPortionTooltip portion="childSupport" results={results} inputs={inputs} />
                    </DetailedTooltip>
                    {capStatus.healthInsuranceCapDetails?.childSupportCapped && (
                      <CapIndicator
                        capStatus={capStatus}
                        iconOnly
                        contributionType="child support portion"
                      />
                    )}
                  </Box>
                }
                value={formatJPY(results.nhiChildSupportPortion)}
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
          // Employee Health Insurance
          <>
            <ResultRow
              label="Salary Premium"
              labelSuffix={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                  <DetailedTooltip title="Health Insurance Premium">
                    <HealthInsurancePremiumTooltip
                      inputs={inputs}
                      standardMonthlyRemuneration={healthSMR}
                    />
                  </DetailedTooltip>
                  {capStatus.healthInsuranceCapped && (
                    <CapIndicator
                      capStatus={capStatus}
                      contributionType="health insurance"
                      iconOnly={isMobile}
                    />
                  )}
                </Box>
              }
              value={formatJPY(results.healthInsurance - (results.healthInsuranceOnBonus ?? 0))}
              type="indented"
            />
            {results.healthInsuranceOnBonus !== undefined && results.healthInsuranceOnBonus > 0 && (
              <ResultRow
                label="Bonus Premium"
                labelSuffix={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    <DetailedTooltip title="Bonus Health Insurance Premium">
                      <HealthInsuranceBonusTooltip
                        inputs={inputs}
                        breakdown={healthInsuranceBreakdown}
                      />
                    </DetailedTooltip>
                    {capStatus.healthInsuranceBonusCapped && (
                      <CapIndicator
                        capStatus={capStatus}
                        contributionType="health insurance bonus"
                        iconOnly={isMobile}
                      />
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
            {isLatterStage
              ? 'Pension'
              : isNationalHealthInsurance
                ? 'National Pension'
                : "Employees' Pension"}
          </Typography>
        </Box>
        {!isIncomeBasedProvider && (
          <ResultRow
            label="Monthly Contribution"
            labelSuffix={
              employeesPensionDue ? (
                <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                  <DetailedTooltip title="Pension Contribution">
                    <PensionPremiumTooltip
                      inputs={inputs}
                      standardMonthlyRemuneration={pensionSMR}
                    />
                  </DetailedTooltip>
                  {(capStatus.pensionCapped || capStatus.pensionFixed) && (
                    <CapIndicator
                      capStatus={capStatus}
                      contributionType="pension"
                      iconOnly={isMobile}
                    />
                  )}
                </Box>
              ) : (
                <SimpleTooltip>
                  At the selected age there is no compulsory Employees' Pension (厚生年金保険)
                  contribution: enrollment ends at age 70.
                </SimpleTooltip>
              )
            }
            value={formatJPY(
              Math.round((results.pensionPayments - (results.pensionOnBonus ?? 0)) / 12),
            )}
            type="indented"
          />
        )}
        {results.pensionOnBonus !== undefined && results.pensionOnBonus > 0 && (
          <ResultRow
            label="Bonus Contribution"
            labelSuffix={
              <DetailedTooltip title="Bonus Pension Contribution">
                <PensionBonusTooltip breakdown={calculatePensionBonusBreakdown(bonuses)} />
              </DetailedTooltip>
            }
            value={formatJPY(results.pensionOnBonus)}
            type="indented"
          />
        )}
        <ResultRow
          label="Annual Contribution"
          labelSuffix={
            isLatterStage ? (
              <SimpleTooltip>
                At the selected age there are no compulsory pension contributions: Employees'
                Pension (厚生年金保険) enrollment ends at age 70 and National Pension (国民年金)
                enrollment at age 60.
              </SimpleTooltip>
            ) : isNationalHealthInsurance ? (
              nationalPensionDue ? (
                <DetailedTooltip title="Pension Contribution">
                  <NationalPensionTooltip year={inputs.incomeYear} />
                </DetailedTooltip>
              ) : (
                <SimpleTooltip>
                  At the selected age there is no compulsory National Pension (国民年金)
                  contribution: enrollment covers ages 20-59.
                </SimpleTooltip>
              )
            ) : undefined
          }
          value={formatJPY(results.pensionPayments)}
          type="subtotal"
        />
      </Box>

      {/* Long-term Care Insurance (第1号被保険者, ages 65+) */}
      {isLongTermCareCategory1Insured(inputs.ageRange) && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Age 65+ Long-term Care Insurance
          </Typography>
          <ResultRow
            label="Annual Premium"
            value={formatJPY(results.longTermCareCategory1Premium ?? 0)}
            type="subtotal"
          />
        </Box>
      )}

      {/* Employment Insurance */}
      {results.hasEmploymentIncome && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
            Employment Insurance
            <DetailedTooltip title="Employment Insurance" icon={SIMPLE_TOOLTIP_ICON}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                雇用保険
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Insurance for unemployment and work-related benefits. This amount includes only the
                employment insurance premium paid by the employee. The rate is applied to the gross
                salary. The employer also contributes to employment insurance separately.
              </Typography>
              <SourceLinks
                sources={[
                  {
                    href: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html',
                    label: 'Employment Insurance Premium Rate (MHLW)',
                  },
                ]}
              />
            </DetailedTooltip>
          </Typography>
          <ResultRow
            label="Salary Premium"
            value={formatJPY(
              (results.employmentInsurance ?? 0) - (results.employmentInsuranceOnBonus ?? 0),
            )}
            type="indented"
            labelSuffix={
              <SalaryBreakdownTooltip
                monthlyIncome={rawMonthlyRemuneration}
                year={inputs.incomeYear}
              />
            }
          />
          {results.employmentInsuranceOnBonus !== undefined &&
            results.employmentInsuranceOnBonus > 0 && (
              <ResultRow
                label="Bonus Premium"
                value={formatJPY(results.employmentInsuranceOnBonus)}
                type="indented"
                labelSuffix={<BonusBreakdownTooltip bonuses={bonuses} year={inputs.incomeYear} />}
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
          label="Annual Social Insurance"
          value={formatJPY(totalSocialInsurance)}
          type="total"
        />
      </Box>
    </Box>
  );
};

export default SocialInsuranceTab;
