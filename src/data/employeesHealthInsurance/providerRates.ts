// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Core health insurance premium calculation functions
 * Works directly with provider rate data without intermediate transformations
 */

import { roundSocialInsurancePremium } from '../../utils/taxCalculations';
import {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  type RegionalRates,
} from './providerRateData';

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
  month: number,
): RegionalRates | undefined {
  const periods = getProviderDefinition(providerId)?.regions[region];
  if (!periods || periods.length === 0) return undefined;

  for (const period of periods) {
    const { effectiveFrom } = period;
    if (
      year > effectiveFrom.year ||
      (year === effectiveFrom.year && month >= effectiveFrom.month)
    ) {
      return period.rates;
    }
  }
  // Fallback to the oldest known rate
  return periods[periods.length - 1]!.rates;
}

/**
 * Calculate monthly premium for an employee based on SMR and regional rates
 */
export function calculateMonthlyEmployeePremium(
  smrAmount: number,
  regionalRates: RegionalRates,
  includeLongTermCare: boolean,
): number {
  const rate =
    regionalRates.employeeHealthInsuranceRate +
    (includeLongTermCare ? regionalRates.employeeLongTermCareRate : 0);
  return roundSocialInsurancePremium(smrAmount * rate);
}

/**
 * Get all available regions for a specific provider
 */
export function getAvailableRegions(providerId: string): string[] {
  const provider = getProviderDefinition(providerId);
  return provider ? Object.keys(provider.regions) : [];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): Array<{ providerId: string; providerName: string }> {
  return Object.entries(PROVIDER_DEFINITIONS).map(([providerId, provider]) => ({
    providerId,
    providerName: provider.providerName,
  }));
}
