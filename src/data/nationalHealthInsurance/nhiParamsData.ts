import type { NationalHealthInsuranceRegionParams } from '../../types/healthInsurance';

/**
 * A map storing National Health Insurance parameters by region key (string).
 * The region key would typically be a municipality identifier.
 */
const allNationalHealthInsuranceParams: { [regionKey: string]: NationalHealthInsuranceRegionParams } = {
  'Tokyo': {
    regionName: "Tokyo Special Wards",
    medicalRate: 0.0771,
    supportRate: 0.0269,
    ltcRateForEligible: 0.0225,
    // Per-capita annual amounts
    medicalPerCapita: 47300,
    supportPerCapita: 16800,
    ltcPerCapitaForEligible: 16600,
    // Annual caps for income-levied portion
    medicalCap: 660000,
    supportCap: 260000,
    ltcCapForEligible: 170000,
    // Deduction
    nhiStandardDeduction: 430000, // Often aligns with residence tax basic deduction
  },
  // 'OsakaCity': NHI_OSAKA_PARAMS, // Example for another region
  // Add more regions/municipalities as needed
};

/**
 * Retrieves National Health Insurance parameters for a given region.
 * @param region A string identifying the region/municipality (e.g., "Tokyo", "OsakaCity").
 * @returns The NHI parameters for the region, or undefined if not found.
 */
export function getNationalHealthInsuranceParams(region: string): NationalHealthInsuranceRegionParams | undefined {
  const params = allNationalHealthInsuranceParams[region];
  if (!params) {
    console.warn(`National Health Insurance parameters not found for region: ${region}`);
  }
  return params;
}

/**
 * Exported list of available region keys for National Health Insurance.
 */
export const NATIONAL_HEALTH_INSURANCE_REGIONS = Object.keys(allNationalHealthInsuranceParams);
