// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Core health insurance premium calculation functions
 * Works directly with provider rate data without intermediate transformations
 */

import type { CustomEmployeesHealthInsuranceRates } from '../../types/tax';
import { roundSocialInsurancePremium } from '../../utils/taxCalculations';
import {
  HEALTH_INSURANCE_RATE_SCALE,
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  type RegionalRates,
} from './providerRateData';

/**
 * The rates that an employee's premium is calculated with, as integers over
 * {@link HEALTH_INSURANCE_RATE_SCALE}.
 */
export type EmployeeRates = Pick<
  RegionalRates,
  'employeeHealthInsuranceRate' | 'employeeLongTermCareRate'
>;

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
 * The custom provider's employee rates, from the percentages entered in the form, rounded to
 * whole units of 1/{@link HEALTH_INSURANCE_RATE_SCALE} (the form accepts no finer percentages).
 * Missing rates count as 0%, as the form shows them.
 */
export function getCustomProviderRates(
  customRates: CustomEmployeesHealthInsuranceRates | undefined,
): EmployeeRates {
  const unitsPerPercent = HEALTH_INSURANCE_RATE_SCALE / 100;
  return {
    employeeHealthInsuranceRate: Math.round(
      (customRates?.healthInsuranceRate ?? 0) * unitsPerPercent,
    ),
    employeeLongTermCareRate: Math.round((customRates?.longTermCareRate ?? 0) * unitsPerPercent),
  };
}

/**
 * The employee's premium rate: health insurance, plus long-term care for a Category 2 insured
 * person (ages 40-64). An integer over {@link HEALTH_INSURANCE_RATE_SCALE}.
 */
export function getEmployeePremiumRate(rates: EmployeeRates, includeLongTermCare: boolean): number {
  return (
    rates.employeeHealthInsuranceRate + (includeLongTermCare ? rates.employeeLongTermCareRate : 0)
  );
}

/**
 * The employee's premium on a standard monthly remuneration or standard bonus amount.
 */
export function calculateEmployeeHealthInsurancePremium(
  standardAmount: number,
  rates: EmployeeRates,
  includeLongTermCare: boolean,
): number {
  return roundSocialInsurancePremium(
    standardAmount * getEmployeePremiumRate(rates, includeLongTermCare),
    HEALTH_INSURANCE_RATE_SCALE,
  );
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
