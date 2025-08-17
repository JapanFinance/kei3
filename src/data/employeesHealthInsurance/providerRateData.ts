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
    defaultSource: 'https://www.its-kenpo.or.jp/hoken/jimu/hokenryou/index.html',
    regions: {
      'DEFAULT': {
        source: 'https://www.its-kenpo.or.jp/documents/hoken/jimu/hokenryou/2025.3.1ryougaku.pdf',
        employeeHealthInsuranceRate: 0.0475, // 4.75%
        employeeLongTermCareRate: 0.009, // 0.9%
      }
    }
  },
  'KyokaiKenpo': {
    providerName: 'Kyokai Kenpo',
    effectiveDate: '2025-03-01',
    regions: {
      // Hokkaido & Tohoku
      'Hokkaido': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/01hokkaido.pdf',
        employeeHealthInsuranceRate: 0.05155, // 10.31% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Aomori': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/02aomori.pdf',
        employeeHealthInsuranceRate: 0.04925, // 9.85% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Iwate': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/03iwate.pdf',
        employeeHealthInsuranceRate: 0.0481, // 9.62% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Miyagi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/04miyagi.pdf',
        employeeHealthInsuranceRate: 0.05055, // 10.11% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Akita': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/05akita.pdf',
        employeeHealthInsuranceRate: 0.05005, // 10.01% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Yamagata': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/06yamagata.pdf',
        employeeHealthInsuranceRate: 0.04875, // 9.75% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Fukushima': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/07fukushima.pdf',
        employeeHealthInsuranceRate: 0.0481, // 9.62% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Kanto
      'Ibaraki': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/08ibaraki.pdf',
        employeeHealthInsuranceRate: 0.04835, // 9.67% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Tochigi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/09tochigi.pdf',
        employeeHealthInsuranceRate: 0.0491, // 9.82% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Gunma': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/10gunma.pdf',
        employeeHealthInsuranceRate: 0.04885, // 9.77% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Saitama': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/11saitama.pdf',
        employeeHealthInsuranceRate: 0.0488, // 9.76% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Chiba': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/12chiba.pdf',
        employeeHealthInsuranceRate: 0.04895, // 9.79% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Tokyo': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/13tokyo.pdf',
        employeeHealthInsuranceRate: 0.04955, // 9.91% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kanagawa': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/14kanagawa.pdf',
        employeeHealthInsuranceRate: 0.0496, // 9.92% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Chubu
      'Niigata': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/15niigata.pdf',
        employeeHealthInsuranceRate: 0.04775, // 9.55% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Toyama': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/16toyama.pdf',
        employeeHealthInsuranceRate: 0.04825, // 9.65% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Ishikawa': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/17ishikawa.pdf',
        employeeHealthInsuranceRate: 0.0494, // 9.88% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Fukui': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/18fukui.pdf',
        employeeHealthInsuranceRate: 0.0497, // 9.94% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Yamanashi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/19yamanashi.pdf',
        employeeHealthInsuranceRate: 0.04945, // 9.89% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Nagano': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/20nagano.pdf',
        employeeHealthInsuranceRate: 0.04845, // 9.69% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Gifu': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/21gifu.pdf',
        employeeHealthInsuranceRate: 0.04965, // 9.93% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Shizuoka': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/22shizuoka.pdf',
        employeeHealthInsuranceRate: 0.049, // 9.80% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Aichi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/23aichi.pdf',
        employeeHealthInsuranceRate: 0.05015, // 10.03% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Kansai
      'Mie': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/24mie.pdf',
        employeeHealthInsuranceRate: 0.04995, // 9.99% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Shiga': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/25shiga.pdf',
        employeeHealthInsuranceRate: 0.04985, // 9.97% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kyoto': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/26kyoto.pdf',
        employeeHealthInsuranceRate: 0.05015, // 10.03% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Osaka': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/27osaka.pdf',
        employeeHealthInsuranceRate: 0.0512, // 10.24% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Hyogo': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/28hyogo.pdf',
        employeeHealthInsuranceRate: 0.0508, // 10.16% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Nara': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/29nara.pdf',
        employeeHealthInsuranceRate: 0.0501, // 10.02% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Wakayama': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/30wakayama.pdf',
        employeeHealthInsuranceRate: 0.05095, // 10.19% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Chugoku
      'Tottori': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/31tottori.pdf',
        employeeHealthInsuranceRate: 0.04965, // 9.93% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Shimane': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/32shimane.pdf',
        employeeHealthInsuranceRate: 0.0497, // 9.94% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Okayama': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/33okayama.pdf',
        employeeHealthInsuranceRate: 0.05085, // 10.17% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Hiroshima': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/34hiroshima.pdf',
        employeeHealthInsuranceRate: 0.04985, // 9.97% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Yamaguchi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/35yamaguchi.pdf',
        employeeHealthInsuranceRate: 0.0518, // 10.36% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Shikoku
      'Tokushima': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/36tokushima.pdf',
        employeeHealthInsuranceRate: 0.05235, // 10.47% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kagawa': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/37kagawa.pdf',
        employeeHealthInsuranceRate: 0.05105, // 10.21% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Ehime': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/38ehime.pdf',
        employeeHealthInsuranceRate: 0.0509, // 10.18% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kochi': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/39kochi.pdf',
        employeeHealthInsuranceRate: 0.05065, // 10.13% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Kyushu & Okinawa
      'Fukuoka': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/40fukuoka.pdf',
        employeeHealthInsuranceRate: 0.05155, // 10.31% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Saga': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/41saga.pdf',
        employeeHealthInsuranceRate: 0.0539, // 10.78% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Nagasaki': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/42nagasaki.pdf',
        employeeHealthInsuranceRate: 0.05205, // 10.41% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kumamoto': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/43kumamoto.pdf',
        employeeHealthInsuranceRate: 0.0506, // 10.12% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Oita': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/44oita.pdf',
        employeeHealthInsuranceRate: 0.05125, // 10.25% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Miyazaki': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/45miyazaki.pdf',
        employeeHealthInsuranceRate: 0.05045, // 10.09% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Kagoshima': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/46kagoshima.pdf',
        employeeHealthInsuranceRate: 0.05155, // 10.31% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },
      'Okinawa': {
        source: 'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r7/ippan/47okinawa.pdf',
        employeeHealthInsuranceRate: 0.0472, // 9.44% / 2
        employeeLongTermCareRate: 0.00795, // 1.59% / 2
      },

      // Note: All rates are split evenly between employer and employee
      // Health insurance rates are from Table 17 (effective March 2025)
      // Nursing insurance rate is 1.59% for all regions (effective March 2025)
    }
  },
  'RakutenKenpo': {
    providerName: 'Rakuten KENPO',
    effectiveDate: '2025-04-01',
    defaultSource: 'https://kenpo.rakuten.or.jp/member/outline/fee.html',
    regions: {
      'DEFAULT': {
        source: 'https://kenpo.rakuten.or.jp/member/outline/files/fee.pdf',
        employeeHealthInsuranceRate: 0.047, // 4.7% (total 9.4% split evenly)
        employeeLongTermCareRate: 0.01, // 1.0% (total 2.0% split evenly)
      }
    }
  },
  'RecruitKenpo': {
    providerName: 'Recruit Health Insurance Society',
    effectiveDate: '2025-04-01',
    defaultSource: 'https://kempo.recruit.co.jp/member/outline/fee.html',
    regions: {
      'DEFAULT': {
        source: 'https://kempo.recruit.co.jp/member/info/pdf/r7_fee.pdf',
        employeeHealthInsuranceRate: 0.0435, // 4.35%
        employerHealthInsuranceRate: 0.0465, // 4.65%
        employeeLongTermCareRate: 0.01, // 1.0%
      }
    }
  },
  'TokyoSecuritiesKenpo': {
    providerName: 'Tokyo Securities Health Insurance Society',
    effectiveDate: '2025-04-01',
    defaultSource: 'https://www.shoken-kenpo.or.jp/member/outline/fee.html',
    regions: {
      'DEFAULT': {
        source: 'https://www.shoken-kenpo.or.jp/member/outline/files/hokenryou_getsugaku_2025.pdf',
        employeeHealthInsuranceRate: 0.033, // 3.3% (total 8.4% split 33/51)
        employerHealthInsuranceRate: 0.051, // 5.1%
        employeeLongTermCareRate: 0.0083, // 0.83% (total 1.66% split evenly)
      }
    }
  }
};
