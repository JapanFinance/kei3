import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';

export const NATIONAL_HEALTH_INSURANCE_ID = 'NationalHealthInsurance';
export const DEPENDENT_COVERAGE_ID = 'DependentCoverage';
export const DEFAULT_PROVIDER = 'KyokaiKenpo';

// Income threshold for dependent coverage eligibility (1.3 million yen)
// Source: https://www.mhlw.go.jp/stf/taiou_001_00002.html
export const DEPENDENT_INCOME_THRESHOLD = 1_300_000;

// Exhaustive union type of all valid health insurance provider IDs
export type HealthInsuranceProviderId = keyof typeof PROVIDER_DEFINITIONS | typeof NATIONAL_HEALTH_INSURANCE_ID | typeof DEPENDENT_COVERAGE_ID;

/**
 * Checks if dependent coverage is eligible based on annual income.
 * Dependents must have income below 1.3 million yen to be covered.
 * Source: https://www.mhlw.go.jp/stf/taiou_001_00002.html
 */
export function isDependentCoverageEligible(annualIncome: number): boolean {
  return annualIncome < DEPENDENT_INCOME_THRESHOLD;
}

/**
 * Get the display name for any health insurance provider ID
 */
export function getProviderDisplayName(providerId: HealthInsuranceProviderId): string {
  if (providerId === NATIONAL_HEALTH_INSURANCE_ID) {
    return 'National Health Insurance';
  }
  
  if (providerId === DEPENDENT_COVERAGE_ID) {
    return 'None (dependent of insured employee)';
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
  // Source information
  source?: string; // URL or reference to the official source for these parameters
  // Income-based portion (所得割) rates
  medicalRate: number;        // 医療分保険料率 (e.g., 7.71%)
  supportRate: number;        // 後期高齢者支援金等分保険料率 (e.g., 2.69%)
  ltcRateForEligible?: number; // 介護納付金分保険料率 (for those 40-64, e.g., 2.25%)
  // Per-capita portion (均等割) annual amounts
  medicalPerCapita: number;   // 医療分均等割額 (e.g., 47,300 JPY)
  supportPerCapita: number;   // 後期高齢者支援金等分均等割額 (e.g., 16,800 JPY)
  ltcPerCapitaForEligible?: number; // 介護納付金分均等割額 (e.g., 16,600 JPY)
  // Household flat rate portion (平等割) annual amounts - defaults to 0 if not specified
  medicalHouseholdFlat?: number;   // 医療分平等割額 (e.g., 33,574 JPY) - per household
  supportHouseholdFlat?: number;   // 後期高齢者支援金等分平等割額 (e.g., 10,761 JPY) - per household
  ltcHouseholdFlatForEligible?: number; // 介護納付金分平等割額 (e.g., 0 JPY) - per household
  // Annual caps for the income-based portion
  medicalCap: number;         // 医療分賦課限度額 (e.g., 660,000 JPY)
  supportCap: number;         // 後期高齢者支援金等分賦課限度額 (e.g., 260,000 JPY)
  ltcCapForEligible?: number;    // 介護納付金分賦課限度額 (e.g., 170,000 JPY)
  // Standard deduction used for calculating NHI taxable income (e.g., 430,000 JPY, often same as residence tax basic deduction)
  nhiStandardDeduction: number;
}