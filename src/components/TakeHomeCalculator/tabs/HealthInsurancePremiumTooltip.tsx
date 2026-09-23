// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  getProviderDefinition,
  percent,
} from '../../../data/employeesHealthInsurance/providerRateData';
import {
  getCustomProviderRates,
  getEmployeePremiumRate,
  getRegionalRatesForMonth,
  type EmployeeRates,
} from '../../../data/employeesHealthInsurance/providerRates';
import {
  EHI_SMR_BRACKETS,
  type StandardMonthlyRemunerationBracket,
} from '../../../data/employeesHealthInsurance/smrBrackets';
import {
  getNHIParamsForMonth,
  nhiParamsDiffer,
} from '../../../data/nationalHealthInsurance/nhiParamsData';
import type { PremiumRate } from '../../../data/premiumRate';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
} from '../../../types/healthInsurance';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { isLongTermCareCategory2Insured } from '../../../types/taxpayerAge';
import { formatJPY, formatPercent, formatMonthShort } from '../../../utils/formatters';
import {
  calculateNationalHealthInsurancePortion,
  premiumCalculationBase,
  nationalHealthInsurancePortionDiffers,
  type NationalHealthInsurancePortion,
  type NationalHealthInsurancePortionKey,
} from '../../../utils/healthInsuranceCalculator';
import SMRTableTooltip from './SMRTableTooltip';

const PORTION_LABELS: Record<NationalHealthInsurancePortionKey, string> = {
  medical: 'Medical Portion',
  elderlySupport: 'Elderly Support Portion',
  longTermCare: 'Long-Term Care Portion',
  childSupport: 'Child Support Portion',
};

interface NHIPortionTooltipProps {
  portion: NationalHealthInsurancePortionKey;
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const PortionBreakdown: React.FC<{
  label: string;
  calculationBase: number;
  calc: NationalHealthInsurancePortion;
  /** The figure the breakdown arrives at, shown after the equals sign. */
  amount: number;
}> = ({ label, calculationBase, calc, amount }) => (
  <Box sx={{ mb: 0.5 }}>
    {label && (
      <Typography
        variant="body2"
        sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.3 }}
      >
        {label}
      </Typography>
    )}
    <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
      Income-based (所得割): <strong>{formatPercent(calc.rate)}</strong>
      {' × '}
      {formatJPY(calculationBase)}
      {' = '}
      {formatJPY(calc.incomeBased)}
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
    <Typography
      variant="body2"
      sx={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: calc.capped ? 'warning.main' : 'success.main',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      = <strong>{formatJPY(amount)}</strong>
      {calc.capped && (
        <Box
          component="span"
          sx={{
            px: 0.5,
            py: 0.2,
            borderRadius: 0.5,
            bgcolor: 'warning.light',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'warning.contrastText',
          }}
        >
          🔒 CAPPED
        </Box>
      )}
    </Typography>
  </Box>
);

/**
 * Explains one National Health Insurance portion: each fiscal year's amount from the same
 * function the premium calculation used, and the calculation's own figure for the calendar year
 * as the total, so the tooltip cannot arrive at a total the row beside it does not show.
 */
export const NHIPortionTooltip: React.FC<NHIPortionTooltipProps> = ({
  portion,
  results,
  inputs,
}) => {
  const region = inputs.region;
  const year = inputs.incomeYear;
  const prevFYData = getNHIParamsForMonth(region, year, 0); // Jan → previous FY
  const currFYData = getNHIParamsForMonth(region, year, 3); // Apr → current FY

  if (!currFYData) {
    return (
      <Box>
        <Typography variant="body2">Rate data not available for {region}.</Typography>
      </Box>
    );
  }

  const base = premiumCalculationBase(results.totalNetIncome);
  const currCalc = calculateNationalHealthInsurancePortion(base, currFYData, portion);
  if (!currCalc) {
    return (
      <Box>
        <Typography variant="body2">{PORTION_LABELS[portion]} data not available.</Typography>
      </Box>
    );
  }

  // The portion as the calculation charged it, which the row beside this tooltip shows.
  const amount =
    {
      medical: results.nhiMedicalPortion,
      elderlySupport: results.nhiElderlySupportPortion,
      longTermCare: results.nhiLongTermCarePortion,
      childSupport: results.nhiChildSupportPortion,
    }[portion] ?? 0;

  // Show both fiscal years only when this portion's amount can differ between them. The
  // calculation blends every portion whenever any parameter differs, but a portion whose own
  // parameters are unchanged blends to its single-year amount.
  const blended =
    prevFYData !== undefined &&
    nationalHealthInsurancePortionDiffers(prevFYData, currFYData, portion);

  const source = currFYData.source && (
    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
      Calculation parameters from{' '}
      <a
        href={currFYData.source}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit' }}
      >
        {currFYData.regionName} NHI Rates
      </a>
    </Typography>
  );

  if (blended) {
    const prevCalc = calculateNationalHealthInsurancePortion(base, prevFYData, portion);
    const prevFYLabel = `FY${year - 1}`;
    const currFYLabel = `FY${year}`;

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 440 } }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
          NHI Calculation Base: {formatJPY(base)}
        </Typography>

        <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {prevCalc ? (
            <PortionBreakdown
              label={`${prevFYLabel} (Jan-Mar, 3⁄10 of annual):`}
              calculationBase={base}
              calc={prevCalc}
              amount={prevCalc.amount}
            />
          ) : (
            <Box>
              <Typography
                variant="body2"
                sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.3 }}
              >
                {prevFYLabel} (Jan-Mar, 3⁄10 of annual):
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'text.secondary' }}
              >
                Not applicable — this portion was introduced in {currFYLabel}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <PortionBreakdown
            label={`${currFYLabel} (Jun-Dec, 7⁄10 of annual):`}
            calculationBase={base}
            calc={currCalc}
            amount={currCalc.amount}
          />
        </Box>

        <Box
          sx={{ p: 1, bgcolor: theme => alpha(theme.palette.primary.main, 0.12), borderRadius: 1 }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Total: {formatJPY(prevCalc?.amount ?? 0)} × 3⁄10
            {' + '}
            {formatJPY(currCalc.amount)} × 7⁄10
            {' = '}
            <strong>{formatJPY(amount)}</strong>
          </Typography>
        </Box>

        {source}
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 280 }, maxWidth: { xs: '100vw', sm: 400 } }}>
      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
        NHI Calculation Base: {formatJPY(base)}
      </Typography>

      <PortionBreakdown label="" calculationBase={base} calc={currCalc} amount={amount} />

      {source}
    </Box>
  );
};

interface HealthInsurancePremiumTooltipProps {
  inputs: TakeHomeInputs;
  /** The remuneration the premium was charged on, before it was graded. */
  monthlyRemuneration: number;
  standardMonthlyRemuneration: number;
}

const HealthInsurancePremiumTooltip: React.FC<HealthInsurancePremiumTooltipProps> = ({
  inputs,
  monthlyRemuneration,
  standardMonthlyRemuneration,
}) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;

  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    // National Health Insurance - overview tooltip on the heading
    const year = inputs.incomeYear;
    const prevFYData = getNHIParamsForMonth(region, year, 0); // Jan → previous FY
    const currFYData = getNHIParamsForMonth(region, year, 3); // Apr → current FY
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
            National Health Insurance premiums vary by municipality. Please check with the local
            city/ward office for specific rates.
          </Typography>
        </Box>
      );
    }

    const ratesBlended = prevFYData && nhiParamsDiffer(prevFYData, regionData);

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          National Health Insurance - {regionData.regionName}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          NHI premiums are calculated using income-based rates plus per-capita amounts, with annual
          caps applied to each portion. NHI premiums are based on last year's reported income. These
          calculations assume income is the same as the previous year.
        </Typography>

        {ratesBlended && (
          <Typography
            variant="body2"
            sx={{ mb: 1, fontSize: '0.85rem', fontStyle: 'italic', color: 'info.main' }}
          >
            NHI rates change in April. Since premiums are paid in 10 installments (Jun-Mar), the
            calendar year straddles two fiscal years: 3/10 from Jan-Mar (previous FY) + 7/10 from
            Jun-Dec (current FY). The premium paid in a calendar year is a combination of both
            fiscal years. See the tooltip on each portion for details.
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
                {regionData.regionName} NHI Rates
              </a>
            </Typography>
          </Box>
        )}
      </Box>
    );
  } else {
    // Employee Health Insurance
    let rates: EmployeeRates = {
      employeeHealthInsuranceRate: percent(0),
      employeeLongTermCareRate: percent(0),
    };
    let sourceUrl;
    let providerLabel;

    const year = inputs.incomeYear;

    if (provider === CUSTOM_PROVIDER_ID) {
      rates = getCustomProviderRates(inputs.customEHIRates);
      // For custom provider, we don't know the employer rate, so we leave it undefined.
      providerLabel = 'Custom Provider';
    } else {
      // Use a representative month of the income year (April = fiscal-year start) for the headline rate.
      const regionalRates = getRegionalRatesForMonth(provider, region, year, 3);
      const providerDef = getProviderDefinition(provider);

      if (regionalRates) {
        rates = regionalRates;
        sourceUrl = regionalRates.source || providerDef?.defaultSource;
        providerLabel = `${providerDef!.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
      }
    }

    const includeLTC: boolean = isLongTermCareCategory2Insured(inputs.ageRange);
    const finalRate = getEmployeePremiumRate(rates, includeLTC);
    const totalPremium = finalRate.premiumOn(standardMonthlyRemuneration);

    // Check if rates differ across the 12 months of the year
    const monthlyRates: { rate: PremiumRate; premium: number }[] = [];
    let ratesVary = false;

    if (provider !== CUSTOM_PROVIDER_ID) {
      for (let m = 0; m < 12; m++) {
        const monthRates = getRegionalRatesForMonth(provider, region, year, m);
        if (monthRates) {
          const r = getEmployeePremiumRate(monthRates, includeLTC);
          const p = r.premiumOn(standardMonthlyRemuneration);
          monthlyRates.push({ rate: r, premium: p });
          if (m > 0 && !r.equals(monthlyRates[0]!.rate)) ratesVary = true;
        }
      }
    }

    // Prepare table data for the lookup table
    // Highlight the row corresponding to the current SMR
    const currentRow =
      EHI_SMR_BRACKETS.find(bracket => bracket.smrAmount === standardMonthlyRemuneration) || null;

    const getIncomeRange = (row: StandardMonthlyRemunerationBracket) => {
      return `${formatJPY(row.minIncomeInclusive)} - ${row.maxIncomeExclusive === Infinity ? '∞' : formatJPY(row.maxIncomeExclusive)}`;
    };

    const columns = [
      {
        header: 'Grade',
        render: (row: StandardMonthlyRemunerationBracket) => row.grade,
        align: 'left' as const,
      },
      {
        header: 'Monthly Remuneration',
        render: getIncomeRange,
        align: 'left' as const,
      },
      {
        header: 'SMR',
        getValue: (row: StandardMonthlyRemunerationBracket) => row.smrAmount,
      },
    ];

    const getCurrentRowSummary = (row: StandardMonthlyRemunerationBracket) => {
      return `Grade: ${row.grade} (SMR: ${formatJPY(row.smrAmount)})`;
    };

    return (
      <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 500 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Health Insurance Calculation - {providerLabel}
        </Typography>

        <Box
          sx={{
            mb: 0.5,
            p: 0,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {/* Supporting Details */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'action.hover',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Monthly Remuneration
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {formatJPY(monthlyRemuneration)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Standard Monthly Remuneration
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {formatJPY(standardMonthlyRemuneration)}
              </Typography>
            </Box>
          </Box>

          {/* Main Calculation Highlight */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {ratesVary && monthlyRates.length === 12 ? (
              <>
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'primary.main', fontWeight: 600, mb: 0.5 }}
                >
                  Salary Premium ({year})
                </Typography>
                {(() => {
                  // Group consecutive months with the same rate
                  const groups: {
                    startMonth: number;
                    endMonth: number;
                    rate: PremiumRate;
                    premium: number;
                  }[] = [];
                  for (let i = 0; i < monthlyRates.length; i++) {
                    const mr = monthlyRates[i]!;
                    const lastGroup = groups[groups.length - 1];
                    if (lastGroup && lastGroup.rate.equals(mr.rate)) {
                      lastGroup.endMonth = i;
                    } else {
                      groups.push({
                        startMonth: i,
                        endMonth: i,
                        rate: mr.rate,
                        premium: mr.premium,
                      });
                    }
                  }
                  const annualTotal = monthlyRates.reduce((sum, mr) => sum + mr.premium, 0);
                  return (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              padding: '2px 8px 2px 0',
                              borderBottom: '1px solid var(--mui-palette-divider)',
                              fontWeight: 'normal',
                              textAlign: 'left',
                            }}
                          >
                            Months
                          </th>
                          <th
                            style={{
                              padding: '2px 8px 2px 0',
                              borderBottom: '1px solid var(--mui-palette-divider)',
                              fontWeight: 'normal',
                              textAlign: 'right',
                            }}
                          >
                            Rate
                          </th>
                          <th
                            style={{
                              padding: '2px 8px 2px 0',
                              borderBottom: '1px solid var(--mui-palette-divider)',
                              fontWeight: 'normal',
                              textAlign: 'right',
                            }}
                          >
                            Monthly
                          </th>
                          <th
                            style={{
                              padding: '2px 8px 2px 0',
                              borderBottom: '1px solid var(--mui-palette-divider)',
                              fontWeight: 'normal',
                              textAlign: 'right',
                            }}
                          >
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g, idx) => {
                          const count = g.endMonth - g.startMonth + 1;
                          const monthLabel =
                            g.startMonth === g.endMonth
                              ? formatMonthShort(g.startMonth)
                              : `${formatMonthShort(g.startMonth)}\u2013${formatMonthShort(g.endMonth)}`;
                          return (
                            <tr key={idx}>
                              <td style={{ padding: '2px 8px 2px 0' }}>{monthLabel}</td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>
                                {g.rate.toPercent()}
                              </td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>
                                {formatJPY(g.premium)}
                              </td>
                              <td style={{ padding: '2px 8px 2px 0', textAlign: 'right' }}>
                                {formatJPY(g.premium * count)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              padding: '2px 8px 2px 0',
                              textAlign: 'right',
                              borderTop: '1px solid var(--mui-palette-divider)',
                              fontWeight: 600,
                            }}
                          >
                            Annual Total
                          </td>
                          <td
                            style={{
                              padding: '2px 8px 2px 0',
                              textAlign: 'right',
                              borderTop: '1px solid var(--mui-palette-divider)',
                              fontWeight: 600,
                            }}
                          >
                            {formatJPY(annualTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </>
            ) : (
              // If rates don't vary, show the simple calculation
              <>
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'primary.main', fontWeight: 600, mb: 0.5 }}
                >
                  Monthly Insurance Premium
                </Typography>
                <Typography
                  sx={{
                    textAlign: 'center',
                    width: '100%',
                    my: 0.5,
                    fontSize: '1.1rem',
                    fontWeight: 500,
                  }}
                >
                  {formatJPY(standardMonthlyRemuneration)}
                  <Box component="span" sx={{ mx: 1, color: 'text.secondary' }}>
                    ×
                  </Box>
                  {finalRate.toPercent()}
                  <Box component="span" sx={{ mx: 1, color: 'text.secondary' }}>
                    =
                  </Box>
                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatJPY(totalPremium)}
                  </Box>
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {includeLTC && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: -0.5 }}>
            Rate breakdown: Health {rates.employeeHealthInsuranceRate.toPercent()} + LTC{' '}
            {rates.employeeLongTermCareRate.toPercent()}
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block' }}
        >
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
          {...(sourceUrl
            ? {
                officialSourceLink: { url: sourceUrl, text: `${providerLabel} Rates` },
              }
            : {})}
        />
      </Box>
    );
  }
};

export default HealthInsurancePremiumTooltip;
