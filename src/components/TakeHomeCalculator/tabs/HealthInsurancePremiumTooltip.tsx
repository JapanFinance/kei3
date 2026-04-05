// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, CUSTOM_PROVIDER_ID, type NationalHealthInsuranceRegionParams } from '../../../types/healthInsurance';
import { getNHIParamsForMonth } from '../../../data/nationalHealthInsurance/nhiParamsData';
import SMRTableTooltip from './SMRTableTooltip';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';
import { getRegionalRatesForMonth } from '../../../data/employeesHealthInsurance/providerRates';
import { EHI_SMR_BRACKETS, type StandardMonthlyRemunerationBracket } from '../../../data/employeesHealthInsurance/smrBrackets';
import { roundSocialInsurancePremium } from '../../../utils/taxCalculations';

export type NHIPortionType = 'medical' | 'elderlySupport' | 'longTermCare' | 'childSupport';

const PORTION_CONFIG: Record<NHIPortionType, {
  label: string;
  rateKey: keyof NationalHealthInsuranceRegionParams;
  perCapitaKey: keyof NationalHealthInsuranceRegionParams;
  householdFlatKey: keyof NationalHealthInsuranceRegionParams;
  capKey: keyof NationalHealthInsuranceRegionParams;
}> = {
  medical: {
    label: 'Medical Portion',
    rateKey: 'medicalRate',
    perCapitaKey: 'medicalPerCapita',
    householdFlatKey: 'medicalHouseholdFlat',
    capKey: 'medicalCap',
  },
  elderlySupport: {
    label: 'Elderly Support Portion',
    rateKey: 'supportRate',
    perCapitaKey: 'supportPerCapita',
    householdFlatKey: 'supportHouseholdFlat',
    capKey: 'supportCap',
  },
  longTermCare: {
    label: 'Long-Term Care Portion',
    rateKey: 'ltcRateForEligible',
    perCapitaKey: 'ltcPerCapitaForEligible',
    householdFlatKey: 'ltcHouseholdFlatForEligible',
    capKey: 'ltcCapForEligible',
  },
  childSupport: {
    label: 'Child Support Portion',
    rateKey: 'childSupportRate',
    perCapitaKey: 'childSupportPerCapita',
    householdFlatKey: 'childSupportHouseholdFlat',
    capKey: 'childSupportCap',
  },
};

function calculatePortionForFY(
  nhiTaxableIncome: number,
  params: NationalHealthInsuranceRegionParams,
  portion: NHIPortionType
): { incomeBasedAmount: number; perCapita: number; householdFlat: number; uncapped: number; cap: number; final: number } {
  const config = PORTION_CONFIG[portion];
  const rate = params[config.rateKey] as number | undefined;
  const perCapita = (params[config.perCapitaKey] as number | undefined) ?? 0;
  const householdFlat = (params[config.householdFlatKey] as number | undefined) ?? 0;
  const cap = params[config.capKey] as number | undefined;

  if (!rate || !cap) {
    return { incomeBasedAmount: 0, perCapita: 0, householdFlat: 0, uncapped: 0, cap: 0, final: 0 };
  }

  const incomeBasedAmount = nhiTaxableIncome * rate;
  const uncapped = incomeBasedAmount + perCapita + householdFlat;
  return { incomeBasedAmount, perCapita, householdFlat, uncapped, cap, final: Math.min(uncapped, cap) };
}

interface NHIPortionTooltipProps {
  portion: NHIPortionType;
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const PortionBreakdown: React.FC<{
  label: string;
  rate: number;
  nhiTaxableIncome: number;
  calc: ReturnType<typeof calculatePortionForFY>;
}> = ({ label, rate, nhiTaxableIncome, calc }) => (
  <Box sx={{ mb: 0.5 }}>
    {label && (
      <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.3 }}>
        {label}
      </Typography>
    )}
    <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
      Income-based (所得割):{' '}
      <math><mrow>
        <mn><strong>{formatPercent(rate)}</strong></mn>
        <mo>×</mo>
        <mn>{formatJPY(nhiTaxableIncome)}</mn>
        <mo>=</mo>
        <mn>{formatJPY(calc.incomeBasedAmount)}</mn>
      </mrow></math>
    </Typography>
    <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
      Per-capita (均等割): {formatJPY(calc.perCapita)}
    </Typography>
    {calc.householdFlat > 0 && (
      <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
        Household flat rate (平等割): {formatJPY(calc.householdFlat)}
      </Typography>
    )}
    <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
      Subtotal: {formatJPY(calc.uncapped)} (cap: {formatJPY(calc.cap)})
    </Typography>
    <Typography variant="body2" sx={{
      fontSize: '0.85rem',
      fontWeight: 600,
      color: calc.uncapped > calc.cap ? 'warning.main' : 'success.main',
      display: 'flex',
      alignItems: 'center',
      gap: 0.5
    }}>
      = <strong>{formatJPY(calc.final)}</strong>
      {calc.uncapped > calc.cap && (
        <Box component="span" sx={{
          px: 0.5, py: 0.2, borderRadius: 0.5,
          bgcolor: 'warning.light', fontSize: '0.75rem', fontWeight: 600, color: 'warning.contrastText'
        }}>
          🔒 CAPPED
        </Box>
      )}
    </Typography>
  </Box>
);

export const NHIPortionTooltip: React.FC<NHIPortionTooltipProps> = ({ portion, results, inputs }) => {
  const region = inputs.region;
  const year = new Date().getFullYear();
  const prevFYData = getNHIParamsForMonth(region, year, 0);  // Jan → previous FY
  const currFYData = getNHIParamsForMonth(region, year, 3);  // Apr → current FY

  if (!currFYData) {
    return (
      <Box>
        <Typography variant="body2">Rate data not available for {region}.</Typography>
      </Box>
    );
  }

  const config = PORTION_CONFIG[portion];
  const nhiTaxableIncome = Math.max(0, results.totalNetIncome - currFYData.nhiStandardDeduction);

  // Check if this portion has rates in the current FY data
  const currRate = currFYData[config.rateKey] as number | undefined;
  if (!currRate) {
    return (
      <Box>
        <Typography variant="body2">{config.label} data not available.</Typography>
      </Box>
    );
  }

  // Determine if rates are blended across fiscal years for this portion
  const prevRate = prevFYData ? prevFYData[config.rateKey] as number | undefined : undefined;
  const ratesBlended = prevFYData && prevFYData !== currFYData && (
    // Portion is newly introduced (exists in current FY but not previous)
    (!prevRate && currRate) ||
    // Both FYs have the portion but parameters differ
    (prevRate && (
      prevRate !== currRate ||
      (prevFYData[config.perCapitaKey] as number | undefined) !== (currFYData[config.perCapitaKey] as number | undefined) ||
      (prevFYData[config.capKey] as number | undefined) !== (currFYData[config.capKey] as number | undefined) ||
      (prevFYData[config.householdFlatKey] as number | undefined) !== (currFYData[config.householdFlatKey] as number | undefined)
    ))
  );

  // For blended calculation, we need NHI taxable income from each FY's deduction
  // (in practice, the deduction is usually the same, but use each FY's value for correctness)
  const prevNhiTaxableIncome = prevFYData
    ? Math.max(0, results.totalNetIncome - prevFYData.nhiStandardDeduction)
    : nhiTaxableIncome;

  const currCalc = calculatePortionForFY(nhiTaxableIncome, currFYData, portion);

  // The tooltip's displayed total should match the authoritative value from the calculator.
  const resultValueByPortion: Record<NHIPortionType, number | undefined> = {
    medical: results.nhiMedicalPortion,
    elderlySupport: results.nhiElderlySupportPortion,
    longTermCare: results.nhiLongTermCarePortion,
    childSupport: results.nhiChildSupportPortion,
  };

  if (ratesBlended) {
    const prevCalc = calculatePortionForFY(prevNhiTaxableIncome, prevFYData!, portion);
    const blendedAmount = Math.round(prevCalc.final * 3 / 10 + currCalc.final * 7 / 10);
    const prevFYLabel = `FY${year - 1}`;
    const currFYLabel = `FY${year}`;

    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      const expected = resultValueByPortion[portion];
      if (expected !== undefined && Math.abs(blendedAmount - expected) > 1) {
        throw new Error(
          `NHIPortionTooltip: ${config.label} blended total (${blendedAmount}) does not match calculator result (${expected}). The tooltip and calculator blending logic may have diverged.`
        );
      }
    }

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 440 } }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
          NHI Calculation Base: {formatJPY(nhiTaxableIncome)}
        </Typography>

        <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {prevRate ? (
            <PortionBreakdown
              label={`${prevFYLabel} (Jan-Mar, 3\u204410 of annual):`}
              rate={prevRate}
              nhiTaxableIncome={prevNhiTaxableIncome}
              calc={prevCalc}
            />
          ) : (
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.3 }}>
                {prevFYLabel} (Jan-Mar, 3⁄10 of annual):
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'text.secondary' }}>
                Not applicable — this portion was introduced in {currFYLabel}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <PortionBreakdown
            label={`${currFYLabel} (Jun-Dec, 7\u204410 of annual):`}
            rate={currRate}
            nhiTaxableIncome={nhiTaxableIncome}
            calc={currCalc}
          />
        </Box>

        <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Total:{' '}
            <math><mrow>
              <mn>{formatJPY(prevCalc.final)}</mn>
              <mo>×</mo>
              <mfrac><mn>3</mn><mn>10</mn></mfrac>
              <mo>+</mo>
              <mn>{formatJPY(currCalc.final)}</mn>
              <mo>×</mo>
              <mfrac><mn>7</mn><mn>10</mn></mfrac>
              <mo>=</mo>
              <mn><strong>{formatJPY(blendedAmount)}</strong></mn>
            </mrow></math>
          </Typography>
        </Box>

        {currFYData.source && (
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
            Calculation parameters from{' '}
            <a href={currFYData.source} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
              Official NHI Premium Information
            </a>
          </Typography>
        )}
      </Box>
    );
  }

  // Non-blended: single FY calculation
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    const expected = resultValueByPortion[portion];
    const tooltipTotal = Math.round(currCalc.final);
    if (expected !== undefined && Math.abs(tooltipTotal - expected) > 1) {
      throw new Error(
        `NHIPortionTooltip: ${config.label} total (${tooltipTotal}) does not match calculator result (${expected}). The tooltip and calculator logic may have diverged.`
      );
    }
  }

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 280 }, maxWidth: { xs: '100vw', sm: 400 } }}>
      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
        NHI Calculation Base: {formatJPY(nhiTaxableIncome)}
      </Typography>

      <PortionBreakdown
        label=""
        rate={currRate}
        nhiTaxableIncome={nhiTaxableIncome}
        calc={currCalc}
      />

      {currFYData.source && (
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
          Calculation parameters from{' '}
          <a href={currFYData.source} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            Official NHI Premium Information
          </a>
        </Typography>
      )}
    </Box>
  );
};

interface HealthInsurancePremiumTooltipProps {
  inputs: TakeHomeInputs;
  standardMonthlyRemuneration: number;
}

const HealthInsurancePremiumTooltip: React.FC<HealthInsurancePremiumTooltipProps> = ({ inputs, standardMonthlyRemuneration }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;

  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    // National Health Insurance - overview tooltip on the heading
    const year = new Date().getFullYear();
    const prevFYData = getNHIParamsForMonth(region, year, 0);  // Jan → previous FY
    const currFYData = getNHIParamsForMonth(region, year, 3);  // Apr → current FY
    const regionData = currFYData;
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
            National Health Insurance premiums vary by municipality. Please check with your local city/ward office for specific rates.
          </Typography>
        </Box>
      );
    }

    const ratesBlended = prevFYData && prevFYData !== currFYData && (
      prevFYData.medicalRate !== regionData.medicalRate ||
      prevFYData.supportRate !== regionData.supportRate ||
      prevFYData.medicalCap !== regionData.medicalCap ||
      prevFYData.supportCap !== regionData.supportCap ||
      prevFYData.ltcRateForEligible !== regionData.ltcRateForEligible ||
      prevFYData.childSupportRate !== regionData.childSupportRate ||
      prevFYData.childSupportCap !== regionData.childSupportCap
    );

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          National Health Insurance - {regionData.regionName}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          NHI premiums are calculated using income-based rates plus per-capita amounts, with annual caps applied to each portion.
          NHI premiums are based on last year's reported income.
          These calculations assume your income is the same as the previous year.
        </Typography>

        {ratesBlended && (
          <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem', fontStyle: 'italic', color: 'info.main' }}>
            NHI rates change in April.
            Since premiums are paid in 10 installments (Jun-Mar), the calendar year straddles two fiscal years: 3/10 from Jan-Mar (previous FY) + 7/10 from Jun-Dec (current FY).
            The premium paid in a calendar year is a combination of both fiscal years.
            See the tooltip on each portion for details.
          </Typography>
        )}

        {regionData.source && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
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
    let sourceUrl;
    let providerLabel;

    if (standardMonthlyRemuneration === undefined) {
      throw new Error('standardMonthlyRemuneration is required for the Employee Health Insurance tooltip');
    }

    const year = new Date().getFullYear();

    if (provider === CUSTOM_PROVIDER_ID) {
      employeeRate = (inputs.customEHIRates?.healthInsuranceRate ?? 0) / 100;
      employeeLtcRate = (inputs.customEHIRates?.longTermCareRate ?? 0) / 100;
      // For custom provider, we don't know the employer rate, so we leave it undefined.
      providerLabel = "Custom Provider";
    } else {
      // Use the current month's rates for display
      const now = new Date();
      const regionalRates = getRegionalRatesForMonth(provider, region, now.getFullYear(), now.getMonth());
      const providerDef = PROVIDER_DEFINITIONS[provider];

      if (regionalRates) {
        employeeRate = regionalRates.employeeHealthInsuranceRate;
        employeeLtcRate = regionalRates.employeeLongTermCareRate;
        sourceUrl = regionalRates.source || providerDef?.defaultSource;
        providerLabel = `${providerDef!.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
      }
    }

    const includeLTC: boolean = inputs.isSubjectToLongTermCarePremium;
    const finalRate = employeeRate + (includeLTC ? employeeLtcRate : 0);
    const totalPremium = roundSocialInsurancePremium(standardMonthlyRemuneration * finalRate);

    // Check if rates differ across the 12 months of the year
    const monthlyRates: { rate: number; premium: number }[] = [];
    let ratesVary = false;

    if (provider !== CUSTOM_PROVIDER_ID) {
      for (let m = 0; m < 12; m++) {
        const monthRates = getRegionalRatesForMonth(provider, region, year, m);
        if (monthRates) {
          const r = monthRates.employeeHealthInsuranceRate + (includeLTC ? monthRates.employeeLongTermCareRate : 0);
          const p = roundSocialInsurancePremium(standardMonthlyRemuneration * r);
          monthlyRates.push({ rate: r, premium: p });
          if (m > 0 && r !== monthlyRates[0]!.rate) ratesVary = true;
        }
      }
    }

    // Prepare table data for the lookup table
    // Highlight the row corresponding to the current SMR
    const currentRow = EHI_SMR_BRACKETS.find(bracket => bracket.smrAmount === standardMonthlyRemuneration) || null;

    const getIncomeRange = (row: StandardMonthlyRemunerationBracket) => {
      return `${formatJPY(row.minIncomeInclusive)} - ${row.maxIncomeExclusive === Infinity ? '∞' : formatJPY(row.maxIncomeExclusive)}`;
    };

    const columns = [
      {
        header: 'Grade',
        render: (row: StandardMonthlyRemunerationBracket) => row.grade,
        align: 'left' as const
      },
      {
        header: 'Monthly Remuneration',
        render: getIncomeRange,
        align: 'left' as const
      },
      {
        header: 'SMR',
        getValue: (row: StandardMonthlyRemunerationBracket) => row.smrAmount
      },
    ];

    const getCurrentRowSummary = (row: StandardMonthlyRemunerationBracket) => {
      return `Your Grade: ${row.grade} (SMR: ${formatJPY(row.smrAmount)})`;
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
            {ratesVary && monthlyRates.length === 12 ? (
              <>
                <Typography variant="subtitle2" color="primary.main" fontWeight={600} sx={{ mb: 0.5 }}>
                  Salary Premium ({year})
                </Typography>
                {(() => {
                  // Group consecutive months with the same rate
                  const groups: { startMonth: number; endMonth: number; rate: number; premium: number }[] = [];
                  for (let i = 0; i < monthlyRates.length; i++) {
                    const mr = monthlyRates[i]!;
                    const lastGroup = groups[groups.length - 1];
                    if (lastGroup && lastGroup.rate === mr.rate) {
                      lastGroup.endMonth = i;
                    } else {
                      groups.push({ startMonth: i, endMonth: i, rate: mr.rate, premium: mr.premium });
                    }
                  }
                  const formatMonth = (m: number) => new Date(2000, m).toLocaleString('en', { month: 'short' });
                  const annualTotal = monthlyRates.reduce((sum, mr) => sum + mr.premium, 0);
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '2px 8px 2px 0', borderBottom: '1px solid #ccc', fontWeight: 'normal', textAlign: 'left' }}>Months</th>
                          <th style={{ padding: '2px 8px 2px 0', borderBottom: '1px solid #ccc', fontWeight: 'normal', textAlign: 'right' }}>Rate</th>
                          <th style={{ padding: '2px 8px 2px 0', borderBottom: '1px solid #ccc', fontWeight: 'normal', textAlign: 'right' }}>Monthly</th>
                          <th style={{ padding: '2px 8px 2px 0', borderBottom: '1px solid #ccc', fontWeight: 'normal', textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g, idx) => {
                          const count = g.endMonth - g.startMonth + 1;
                          const monthLabel = g.startMonth === g.endMonth
                            ? formatMonth(g.startMonth)
                            : `${formatMonth(g.startMonth)}\u2013${formatMonth(g.endMonth)}`;
                          return (
                            <tr key={idx}>
                              <td style={{ padding: '2px 8px 2px 0' }}>{monthLabel}</td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>{formatPercent(g.rate)}</td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>{formatJPY(g.premium)}</td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>{formatJPY(g.premium * count)}</td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td colSpan={3} style={{ padding: '2px 8px 2px 0', textAlign: 'right', borderTop: '1px solid #ccc', fontWeight: 600 }}>Annual Total</td>
                          <td style={{ padding: '2px 8px 2px 0', textAlign: 'right', borderTop: '1px solid #ccc', fontWeight: 600 }}>
                            {formatJPY(annualTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </>
            ) : (
              <>
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
              </>
            )}
          </Box>
        </Box>

        {includeLTC && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
            Rate breakdown: Health {formatPercent(employeeRate)} + LTC {formatPercent(employeeLtcRate)}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>
          The employer also contributes separately.
        </Typography>

        <SMRTableTooltip
          title="Employee Health Insurance SMR Table"
          description="Standard Monthly Remuneration (SMR or 標準報酬月額) is determined by the below table."
          tableData={EHI_SMR_BRACKETS}
          columns={columns}
          currentRow={currentRow}
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

export default HealthInsurancePremiumTooltip;
