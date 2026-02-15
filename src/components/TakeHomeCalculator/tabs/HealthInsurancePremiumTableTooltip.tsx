// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, CUSTOM_PROVIDER_ID } from '../../../types/healthInsurance';
import { getNationalHealthInsuranceParams } from '../../../data/nationalHealthInsurance/nhiParamsData';
import PremiumTableTooltip from './PremiumTableTooltip';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { EHI_SMR_BRACKETS, type StandardMonthlyRemunerationBracket } from '../../../data/employeesHealthInsurance/smrBrackets';
import { roundSocialInsurancePremium } from '../../../utils/taxCalculations';

interface HealthInsurancePremiumTableTooltipProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
  standardMonthlyRemuneration: number;
}

const HealthInsurancePremiumTableTooltip: React.FC<HealthInsurancePremiumTableTooltipProps> = ({ results, inputs, standardMonthlyRemuneration }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;

  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    // National Health Insurance - show region parameters
    const regionData = getNationalHealthInsuranceParams(region);
    if (!regionData) {
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            National Health Insurance Parameters
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Premium calculation parameters for {region} are not available in the current data.
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 1 }}>
            💡 National Health Insurance premiums vary by municipality. Please check with your local city/ward office for specific rates.
          </Typography>
        </Box>
      );
    }

    // Return National Health Insurance parameters display
    const includeNursingCareInsurance = inputs.isSubjectToLongTermCarePremium;

    // Calculate step-by-step breakdown like the actual calculation
    // Note: NHI premiums are based on previous year's income, but we're using current year as assumption
    const nhiTaxableIncome = Math.max(0, results.totalNetIncome - regionData.nhiStandardDeduction);

    // 1. Medical Portion (医療分)
    const incomeBasedMedical = nhiTaxableIncome * regionData.medicalRate;
    const perCapitaMedical = regionData.medicalPerCapita;
    const householdFlatMedical = regionData.medicalHouseholdFlat || 0;
    const uncappedMedical = incomeBasedMedical + perCapitaMedical + householdFlatMedical;
    const totalMedicalPremium = Math.min(uncappedMedical, regionData.medicalCap);

    // 2. Elderly Support Portion (後期高齢者支援金分)
    const incomeBasedSupport = nhiTaxableIncome * regionData.supportRate;
    const perCapitaSupport = regionData.supportPerCapita;
    const householdFlatSupport = regionData.supportHouseholdFlat || 0;
    const uncappedSupport = incomeBasedSupport + perCapitaSupport + householdFlatSupport;
    const totalSupportPremium = Math.min(uncappedSupport, regionData.supportCap);

    // 3. Long-Term Care Portion (介護納付金分) - only for those aged 40-64
    let incomeBasedLtc = 0;
    let perCapitaLtc = 0;
    let householdFlatLtc = 0;
    let uncappedLtc = 0;
    let totalLtcPremium = 0;
    if (includeNursingCareInsurance && regionData.ltcRateForEligible && regionData.ltcPerCapitaForEligible && regionData.ltcCapForEligible) {
      incomeBasedLtc = nhiTaxableIncome * regionData.ltcRateForEligible;
      perCapitaLtc = regionData.ltcPerCapitaForEligible;
      householdFlatLtc = regionData.ltcHouseholdFlatForEligible || 0;
      uncappedLtc = incomeBasedLtc + perCapitaLtc + householdFlatLtc;
      totalLtcPremium = Math.min(uncappedLtc, regionData.ltcCapForEligible);
    }

    const totalCalculatedPremium = totalMedicalPremium + totalSupportPremium + totalLtcPremium;

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 460 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          National Health Insurance - {regionData.regionName}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          NHI premiums are calculated using income-based rates plus per-capita amounts, with annual caps applied to each portion.
          NHI premiums are based on last year's reported income.
          These calculations assume your income is the same as the previous year.
        </Typography>

        {/* Medical Portion */}
        <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
            🏥 Medical Portion (医療分)
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Income-based (所得割): <strong>{(regionData.medicalRate * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedMedical)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Per-capita (均等割): {formatJPY(perCapitaMedical)}
          </Typography>
          {householdFlatMedical > 0 && (
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Household flat rate (平等割): {formatJPY(householdFlatMedical)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Subtotal: {formatJPY(uncappedMedical)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Annual Cap: {formatJPY(regionData.medicalCap)}
          </Typography>
          <Typography variant="body2" sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: uncappedMedical > regionData.medicalCap ? 'warning.main' : 'success.main',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}>
            = Final: {formatJPY(totalMedicalPremium)}
            {uncappedMedical > regionData.medicalCap && (
              <Box component="span" sx={{
                px: 0.5,
                py: 0.2,
                borderRadius: 0.5,
                bgcolor: 'warning.light',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'warning.contrastText'
              }}>
                🔒 CAPPED
              </Box>
            )}
          </Typography>
        </Box>

        {/* Support Portion */}
        <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
            👥 Elderly Support Portion (後期高齢者支援金分)
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Income-based (所得割): <strong>{(regionData.supportRate * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedSupport)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Per-capita (均等割): {formatJPY(perCapitaSupport)}
          </Typography>
          {householdFlatSupport > 0 && (
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Household flat rate (平等割): {formatJPY(householdFlatSupport)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Subtotal: {formatJPY(uncappedSupport)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Annual Cap: {formatJPY(regionData.supportCap)}
          </Typography>
          <Typography variant="body2" sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: uncappedSupport > regionData.supportCap ? 'warning.main' : 'success.main',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}>
            = Final: {formatJPY(totalSupportPremium)}
            {uncappedSupport > regionData.supportCap && (
              <Box component="span" sx={{
                px: 0.5,
                py: 0.2,
                borderRadius: 0.5,
                bgcolor: 'warning.light',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'warning.contrastText'
              }}>
                🔒 CAPPED
              </Box>
            )}
          </Typography>
        </Box>

        {/* LTC Portion (if applicable) */}
        {includeNursingCareInsurance && regionData.ltcRateForEligible && (
          <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
              🏠 Long-Term Care Portion (介護分) - Ages 40-64
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Income-based (所得割): <strong>{(regionData.ltcRateForEligible * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedLtc)}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Per-capita (均等割): {formatJPY(perCapitaLtc)}
            </Typography>
            {householdFlatLtc > 0 && (
              <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                Household flat rate (平等割): {formatJPY(householdFlatLtc)}
              </Typography>
            )}
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Subtotal: {formatJPY(uncappedLtc)}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Annual Cap: {formatJPY(regionData.ltcCapForEligible!)}
            </Typography>
            <Typography variant="body2" sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: uncappedLtc > regionData.ltcCapForEligible! ? 'warning.main' : 'success.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}>
              = Final: {formatJPY(totalLtcPremium)}
              {uncappedLtc > regionData.ltcCapForEligible! && (
                <Box component="span" sx={{
                  px: 0.5,
                  py: 0.2,
                  borderRadius: 0.5,
                  bgcolor: 'warning.light',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'warning.contrastText'
                }}>
                  🔒 CAPPED
                </Box>
              )}
            </Typography>
          </Box>
        )}

        {!includeNursingCareInsurance && (
          <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'text.secondary' }}>
              🏠 Long-Term Care Portion: Not applicable (under 40 or over 64 years old)
            </Typography>
          </Box>
        )}

        {/* Verification note */}
        {Math.abs(totalCalculatedPremium - results.healthInsurance) > 1 && (
          <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'warning.contrastText' }}>
              ⚠️ Note: Calculated total ({formatJPY(totalCalculatedPremium)}) differs from system calculation ({formatJPY(results.healthInsurance)}). This may be due to rounding or different calculation methods.
            </Typography>
          </Box>
        )}

        {/* Source link */}
        {regionData.source && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              <strong>Source:</strong>{' '}
              <a
                href={regionData.source}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                Official NHI Premium Information
              </a>
            </Typography>
          </Box>
        )}
      </Box>
    );
  } else {
    // Employee Health Insurance
    let employeeRate = 0;
    let employeeLtcRate = 0;
    let employerRate: number | undefined;
    let sourceUrl;
    let providerLabel;

    if (standardMonthlyRemuneration === undefined) {
      throw new Error('standardMonthlyRemuneration is required for the Employee Health Insurance tooltip');
    }

    if (provider === CUSTOM_PROVIDER_ID) {
      employeeRate = (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100;
      employeeLtcRate = (inputs.customEHIRates?.longTermCareRate ?? 0) / 100;
      // For custom provider, we don't know the employer rate, so we leave it undefined.
      providerLabel = "Custom Provider";
    } else {
      const providerDef = PROVIDER_DEFINITIONS[provider];
      const regionalRates = providerDef?.regions[region] || providerDef?.regions['DEFAULT'];

      if (regionalRates) {
        employeeRate = regionalRates.employeeHealthInsuranceRate;
        employeeLtcRate = regionalRates.employeeLongTermCareRate;
        employerRate = regionalRates.employerHealthInsuranceRate ?? regionalRates.employeeHealthInsuranceRate;
        if (inputs.isSubjectToLongTermCarePremium) {
          employerRate += regionalRates.employerLongTermCareRate ?? regionalRates.employeeLongTermCareRate;
        }
        sourceUrl = regionalRates?.source || providerDef?.defaultSource;
        providerLabel = `${PROVIDER_DEFINITIONS[provider]!.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
      }
    }

    const includeLTC: boolean = inputs.isSubjectToLongTermCarePremium;
    const finalRate = employeeRate + (includeLTC ? employeeLtcRate : 0);
    const totalPremium = roundSocialInsurancePremium(standardMonthlyRemuneration * finalRate);

    // Prepare table data for the lookup table
    // Highlight the row corresponding to the current SMR
    const currentRow = EHI_SMR_BRACKETS.find(bracket => bracket.smrAmount === standardMonthlyRemuneration) || null;

    const getIncomeRange = (row: Record<string, unknown>) => {
      const bracket = row as unknown as StandardMonthlyRemunerationBracket;
      return `${formatJPY(bracket.minIncomeInclusive)} - ${bracket.maxIncomeExclusive === Infinity ? '∞' : formatJPY(bracket.maxIncomeExclusive)}`;
    };

    const columns = [
      {
        header: 'Grade',
        render: (row: Record<string, unknown>) => (row as unknown as StandardMonthlyRemunerationBracket).grade,
        align: 'left' as const
      },
      {
        header: 'Monthly Remuneration',
        render: getIncomeRange,
        align: 'left' as const
      },
      {
        header: 'SMR',
        getValue: (row: Record<string, unknown>) => (row as unknown as StandardMonthlyRemunerationBracket).smrAmount
      },
    ];

    const getCurrentRowSummary = (row: Record<string, unknown>) => {
      const bracket = row as unknown as StandardMonthlyRemunerationBracket;
      return `Your Grade: ${bracket.grade} (SMR: ${formatJPY(bracket.smrAmount)})`;
    };

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 500 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Health Insurance Calculation - {providerLabel}
        </Typography>

        <Box sx={{ mb: 0.5, p: 0, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {/* Supporting Details */}
          <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Monthly Remuneration</Typography>
              <Typography variant="caption" fontWeight={500}>
                {formatJPY(
                  inputs.incomeStreams
                    .filter(s => s.type === 'salary' || s.type === 'commutingAllowance')
                    .reduce((sum, s) => {
                      if (s.frequency === 'monthly') return sum + s.amount;
                      if (s.frequency === '3-months') return sum + s.amount / 3;
                      if (s.frequency === '6-months') return sum + s.amount / 6;
                      return sum + s.amount / 12;
                    }, 0)
                )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Standard Monthly Remuneration
              </Typography>
              <Typography variant="caption" fontWeight={500}>{formatJPY(standardMonthlyRemuneration)}</Typography>
            </Box>
          </Box>

          {/* Main Calculation Highlight */}
          <Box sx={{ p: 1.5, bgcolor: 'primary.50', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" color="primary.main" fontWeight={600} sx={{ mb: 0.5 }}>
              Monthly Insurance Premium
            </Typography>

            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              my: 0.5,
              '& math': {
                fontSize: '1.1rem',
                fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
              },
              '& mn': { fontWeight: 500 },
              '& mo': { mx: 1, color: 'text.secondary' },
              '& mn:last-child': { fontWeight: 700, color: 'primary.main' }
            }}>
              <math>
                <mrow>
                  <mn>{formatJPY(standardMonthlyRemuneration)}</mn>
                  <mo>×</mo>
                  <mn>{formatPercent(finalRate)}</mn>
                  <mo>=</mo>
                  <mn>{formatJPY(totalPremium)}</mn>
                </mrow>
              </math>
            </Box>
          </Box>
        </Box>

        {includeLTC && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
            Rate breakdown: Health {formatPercent(employeeRate)} + LTC {formatPercent(employeeLtcRate)}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>
          {employerRate !== undefined
            ? `The employer also pays at a rate of ${formatPercent(employerRate)}.`
            : `The employer also contributes separately.`
          }
        </Typography>

        <PremiumTableTooltip
          title="Employee Health Insurance SMR Table"
          description="Standard Monthly Remuneration (SMR or 標準報酬月額) is determined by the below table."
          tableData={EHI_SMR_BRACKETS as unknown as Record<string, unknown>[]}
          columns={columns}
          currentRow={currentRow as unknown as Record<string, unknown> | null}
          tableContainerDataAttr="data-smr-table-container"
          currentRowId="current-smr-row"
          getCurrentRowSummary={getCurrentRowSummary}
          {...(sourceUrl ? {
            officialSourceLink: { url: sourceUrl, text: `${providerLabel} Rates` }
          } : {})}
        />
      </Box>
    );
  }
};

export default HealthInsurancePremiumTableTooltip;
