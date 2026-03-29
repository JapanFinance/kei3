// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Core health insurance premium calculation functions
 * Works directly with provider rate data without intermediate transformations
 */

import { roundSocialInsurancePremium } from '../../utils/taxCalculations';
import { PROVIDER_DEFINITIONS, type RegionalRates } from './providerRateData';
import { EHI_SMR_BRACKETS } from './smrBrackets';

/**
 * Returns the applicable regional rates for a given provider, region, year, and month.
 * Finds the most recent rate period whose effective date is on or before the given date.
 *
 * @param providerId The provider key (e.g., 'KyokaiKenpo')
 * @param region The region key (e.g., 'Tokyo' or 'DEFAULT')
 * @param year Calendar year
 * @param month 0-indexed month (0=Jan, 11=Dec)
 */
export function getRegionalRatesForMonth(
  providerId: string,
  region: string,
  year: number,
  month: number
): RegionalRates | undefined {
  const periods = PROVIDER_DEFINITIONS[providerId]?.regions[region];
  if (!periods || periods.length === 0) return undefined;

  for (const period of periods) {
    const { effectiveFrom } = period;
    if (year > effectiveFrom.year || (year === effectiveFrom.year && month >= effectiveFrom.month)) {
      return period.rates;
    }
  }
  // Fallback to the oldest known rate
  return periods[periods.length - 1]!.rates;
}

/**
 * Get regional rates for a specific provider and region using the current date.
 * Convenience wrapper around getRegionalRatesForMonth.
 */
export function getRegionalRates(
  providerId: string,
  region: string = 'DEFAULT'
): RegionalRates | undefined {
  const now = new Date();
  return getRegionalRatesForMonth(providerId, region, now.getFullYear(), now.getMonth());
}

/**
 * Calculate monthly premium for an employee based on SMR and regional rates
 */
export function calculateMonthlyEmployeePremium(
  smrAmount: number,
  regionalRates: RegionalRates,
  includeLongTermCare: boolean
): number {
  const rate = regionalRates.employeeHealthInsuranceRate + (includeLongTermCare ? regionalRates.employeeLongTermCareRate : 0);
  return roundSocialInsurancePremium(smrAmount * rate);
}

/**
 * Get all available regions for a specific provider
 */
export function getAvailableRegions(providerId: string): string[] {
  const provider = PROVIDER_DEFINITIONS[providerId];
  return provider ? Object.keys(provider.regions) : [];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<{ providerId: string, providerName: string }> {
  return Object.entries(PROVIDER_DEFINITIONS).map(([providerId, provider]) => ({
    providerId,
    providerName: provider.providerName
  }));
}

/**
 * Generate a premium table from a specific set of rates
 */
export function generatePremiumTableFromRates(
  regionalRates: RegionalRates
): Array<{
  minIncomeInclusive: number;
  maxIncomeExclusive: number;
  employeePremiumNoLTC: number;
  employeePremiumWithLTC: number;
  fullPremiumNoLTC: number;
  fullPremiumWithLTC: number;
}> {
  return EHI_SMR_BRACKETS.map((bracket) => {
    const employeePremiumNoLTC = calculateMonthlyEmployeePremium(bracket.smrAmount, regionalRates, false);
    const employeePremiumWithLTC = calculateMonthlyEmployeePremium(bracket.smrAmount, regionalRates, true);

    // Calculate full premiums (employee + employer)
    const employerHealthRate = regionalRates.employerHealthInsuranceRate ?? regionalRates.employeeHealthInsuranceRate;
    const employerLTCRate = regionalRates.employerLongTermCareRate ?? regionalRates.employeeLongTermCareRate;

    const fullHealthPremium = Math.round(bracket.smrAmount * (regionalRates.employeeHealthInsuranceRate + employerHealthRate));
    const fullLTCPremium = Math.round(bracket.smrAmount * (regionalRates.employeeLongTermCareRate + employerLTCRate));

    return {
      minIncomeInclusive: bracket.minIncomeInclusive,
      maxIncomeExclusive: bracket.maxIncomeExclusive,
      employeePremiumNoLTC,
      employeePremiumWithLTC,
      fullPremiumNoLTC: fullHealthPremium,
      fullPremiumWithLTC: fullHealthPremium + fullLTCPremium
    };
  });
}

/**
 * Generate a premium table for display purposes
 *
 * @param providerId Provider key
 * @param region Region key
 * @param year Optional calendar year for rate lookup (defaults to current year)
 * @param month Optional 0-indexed month for rate lookup (defaults to current month)
 */
export function generateHealthInsurancePremiumTable(
  providerId: string,
  region: string = 'DEFAULT',
  year?: number,
  month?: number
): Array<{
  minIncomeInclusive: number;
  maxIncomeExclusive: number;
  employeePremiumNoLTC: number;
  employeePremiumWithLTC: number;
  fullPremiumNoLTC: number;
  fullPremiumWithLTC: number;
}> | undefined {
  let regionalRates: RegionalRates | undefined;
  if (year !== undefined && month !== undefined) {
    regionalRates = getRegionalRatesForMonth(providerId, region, year, month);
  } else {
    regionalRates = getRegionalRates(providerId, region);
  }
  if (!regionalRates) return undefined;

  return generatePremiumTableFromRates(regionalRates);
}
