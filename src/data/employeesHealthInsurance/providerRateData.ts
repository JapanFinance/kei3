/**
 * Regional rate variations for a provider
 * Contains only the data that varies by region: rates and region-specific metadata
 * Note: region is now the map key, so no longer needed as a field
 */
export interface RegionalRates {
  /** Region-specific source URL or document reference */
  source?: string;
  /** Employee's health insurance premium rate (as decimal) */
  employeeHealthInsuranceRate: number;
  /** Employer's health insurance premium rate. If omitted, defaults to same as employee */
  employerHealthInsuranceRate?: number;
  /** Employee's long-term care insurance premium rate (as decimal) */
  employeeLongTermCareRate: number;
  /** Employer's long-term care insurance premium rate. If omitted, defaults to same as employee */
  employerLongTermCareRate?: number;
}

/**
 * Provider definition with shared metadata and regional variations
 */
export interface ProviderDefinition {
  providerName: string;
  effectiveDate: string;
  /** Default source URL if not specified per region */
  defaultSource?: string;
  /** Regional rate variations mapped by region name */
  regions: Record<string, RegionalRates>;
}

/**
 * All provider definitions with their regional variations
 * Keyed by providerId for direct access
 * 
 * Note: This only includes employee health insurance providers.
 * National Health Insurance is handled separately as it has a different calculation structure.
 */
export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  'KantoItsKenpo': {
    providerName: 'Kanto ITS Kenpo',
    effectiveDate: '2025-03-01',
    defaultSource: 'https://www.its-kenpo.or.jp/documents/hoken/jimu/hokenryou/2025.3.1ryougaku.pdf',
    regions: {
      'DEFAULT': {
        employeeHealthInsuranceRate: 0.0475, // 4.75%
        employeeLongTermCareRate: 0.009, // 0.9%
      }
    }
  },
  'KyokaiKenpo': {
    providerName: 'Kyokai Kenpo',
    effectiveDate: '2025-03-01',
    regions: {
      'Tokyo': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/13tokyo.pdf',
        employeeHealthInsuranceRate: 0.04955, // 4.955%
        employeeLongTermCareRate: 0.00795, // 0.795%
      },
      // Additional regions can be easily added here:
      // 'Osaka': {
      //   source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/27osaka.pdf',
      //   employeeHealthInsuranceRate: 0.0512, // Example different rate for Osaka
      //   employeeLongTermCareRate: 0.00795, // Same LTC rate
      // },
      // 'Kanagawa': {
      //   source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/14kanagawa.pdf',
      //   employeeHealthInsuranceRate: 0.0498, // Example different rate for Kanagawa
      //   employeeLongTermCareRate: 0.00795, // Same LTC rate
      // }
      // Note: Only rates and region-specific source URLs need to be specified
      // Provider name, effective date, etc. are inherited from the parent definition
    }
  }
};
