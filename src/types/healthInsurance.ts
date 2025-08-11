import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';

export const NATIONAL_HEALTH_INSURANCE_ID = 'NationalHealthInsurance';
export const DEFAULT_PROVIDER = 'KyokaiKenpo';

// Exhaustive union type of all valid health insurance provider IDs
export type HealthInsuranceProviderId = keyof typeof PROVIDER_DEFINITIONS | typeof NATIONAL_HEALTH_INSURANCE_ID;

/**
 * Get the display name for any health insurance provider ID
 */
export function getProviderDisplayName(providerId: HealthInsuranceProviderId): string {
  if (providerId === NATIONAL_HEALTH_INSURANCE_ID) {
    return 'National Health Insurance';
  }
  
  const providerDef = PROVIDER_DEFINITIONS[providerId as keyof typeof PROVIDER_DEFINITIONS];
  if (!providerDef) {
    throw new Error(`Unknown provider ID: ${providerId}`);
  }
  
  return providerDef.providerName;
}

// A generic type for region. Can be a specific enum or a string for flexibility.
// For providers without distinct regions, you might use a conventional default string.
export type ProviderRegion = string;

export const DEFAULT_PROVIDER_REGION = 'DEFAULT';

/**
 * Parameters for calculating National Health Insurance (NHI) premiums.
 * These values vary by municipality.
 * All rates are annual. Caps are annual. Per-capita amounts are annual.
 */
export interface NationalHealthInsuranceRegionParams {
  regionName: string; // For display or reference, e.g., "Tokyo Special Wards Average"
  // Income-based portion (所得割) rates
  medicalRate: number;        // 医療分保険料率 (e.g., 7.71%)
  supportRate: number;        // 後期高齢者支援金等分保険料率 (e.g., 2.69%)
  ltcRateForEligible?: number; // 介護納付金分保険料率 (for those 40-64, e.g., 2.25%)
  // Per-capita portion (均等割) annual amounts
  medicalPerCapita: number;   // 医療分均等割額 (e.g., 47,300 JPY)
  supportPerCapita: number;   // 後期高齢者支援金等分均等割額 (e.g., 16,800 JPY)
  ltcPerCapitaForEligible?: number; // 介護納付金分均等割額 (e.g., 16,600 JPY)
  // Annual caps for the income-based portion
  medicalCap: number;         // 医療分賦課限度額 (e.g., 660,000 JPY)
  supportCap: number;         // 後期高齢者支援金等分賦課限度額 (e.g., 260,000 JPY)
  ltcCapForEligible?: number;    // 介護納付金分賦課限度額 (e.g., 170,000 JPY)
  // Standard deduction used for calculating NHI taxable income (e.g., 430,000 JPY, often same as residence tax basic deduction)
  nhiStandardDeduction: number;
}