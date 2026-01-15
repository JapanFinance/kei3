// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Core health insurance premium calculation functions
 * Works directly with provider rate data without intermediate transformations
 */

import { PROVIDER_DEFINITIONS, type RegionalRates } from './providerRateData';
import { STANDARD_SMR_BRACKETS } from './smrBrackets';

/**
 * Calculate monthly premium for an employee based on SMR and regional rates
 */
export function calculateMonthlyEmployeePremium(
  smrAmount: number,
  regionalRates: RegionalRates,
  includeLongTermCare: boolean
): number {
  // Calculate the total premium first, then round - this matches the original table behavior better
  const healthInsuranceTotal = smrAmount * regionalRates.employeeHealthInsuranceRate;
  const longTermCareTotal = includeLongTermCare 
    ? smrAmount * regionalRates.employeeLongTermCareRate
    : 0;
  
  // Round the combined total to match original table rounding behavior
  return Math.round(healthInsuranceTotal + longTermCareTotal);
}

/**
 * Get regional rates for a specific provider and region
 */
export function getRegionalRates(
  providerId: string, 
  region: string = 'DEFAULT'
): RegionalRates | undefined {
  return PROVIDER_DEFINITIONS[providerId]?.regions[region];
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
export function getAvailableProviders(): Array<{providerId: string, providerName: string}> {
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
  return STANDARD_SMR_BRACKETS.map((bracket) => {
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
 */
export function generateHealthInsurancePremiumTable(
  providerId: string,
  region: string = 'DEFAULT'
): Array<{
  minIncomeInclusive: number;
  maxIncomeExclusive: number;
  employeePremiumNoLTC: number;
  employeePremiumWithLTC: number;
  fullPremiumNoLTC: number;
  fullPremiumWithLTC: number;
}> | undefined {
  const regionalRates = getRegionalRates(providerId, region);
  if (!regionalRates) return undefined;

  return generatePremiumTableFromRates(regionalRates);
}
