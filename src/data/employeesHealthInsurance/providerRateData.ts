// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Prefecture } from '../prefectures';

/**
 * Decimal places of a percentage that a health insurance premium rate can have. Four, because a
 * society can set a rate that fine: プリマハム健康保険組合 splits 88/1,000 into 48.053/1,000 for
 * the employer and 39.947/1,000, that is 3.9947%, for the employee.
 * @see https://www.kenpo.gr.jp/primaham/contents/shikumi/hkenryou/index.html
 */
export const HEALTH_INSURANCE_RATE_PERCENT_DECIMALS = 4;

/**
 * Health insurance premium rates are integers over this scale (50_750 is 5.075%), so that a
 * premium, a whole-yen amount times a rate, is an exact integer product.
 */
export const HEALTH_INSURANCE_RATE_SCALE = 100 * 10 ** HEALTH_INSURANCE_RATE_PERCENT_DECIMALS;

/**
 * Regional rate variations for a provider
 * Contains only the data that varies by region: rates and region-specific metadata
 * Note: region is now the map key, so no longer needed as a field
 *
 * Each rate is an integer over {@link HEALTH_INSURANCE_RATE_SCALE}.
 */
export interface RegionalRates {
  /** Region-specific source URL or document reference */
  source?: string;
  /** Employee's health insurance premium rate */
  employeeHealthInsuranceRate: number;
  /** Employer's health insurance premium rate. If omitted, defaults to same as employee */
  employerHealthInsuranceRate?: number;
  /** Employee's long-term care insurance premium rate */
  employeeLongTermCareRate: number;
  /** Employer's long-term care insurance premium rate. If omitted, defaults to same as employee */
  employerLongTermCareRate?: number;
}

/**
 * A rate period with an effective date and the rates for that period.
 */
export interface HealthInsuranceRatePeriod {
  /**
   * The paycheck month from which this rate is first deducted.
   * Month is 0-indexed (0=Jan, 3=Apr, 4=May).
   *
   * For providers using next-month collection (翌月徴収), this is one month
   * after the official billing month (e.g., "3月分" billing → month 3 = April paycheck).
   */
  effectiveFrom: { year: number; month: number };
  rates: RegionalRates;
}

/**
 * Provider definition with shared metadata and regional variations
 */
export interface ProviderDefinition {
  providerName: string;
  /** Default source URL if not specified per region */
  defaultSource?: string;
  /**
   * Regional rate timelines. Each region maps to an array of rate periods,
   * sorted newest-first. Use getRegionalRatesForMonth() to look up the
   * applicable rate for a given year/month.
   */
  regions: Record<string, HealthInsuranceRatePeriod[]>;
}

/**
 * All provider definitions with their regional variations
 * Keyed by providerId for direct access
 *
 * Note: This only includes employee health insurance providers.
 * National Health Insurance is handled separately as it has a different calculation structure.
 *
 * FY2026 notes:
 * - Childcare Support Contribution (子ども・子育て支援金) of 0.23% (0.115% employee) is folded
 *   into employeeHealthInsuranceRate starting from its effective paycheck month. It is calculated
 *   on the same SMR base with the same rounding, so combining it is exact.
 */
export const PROVIDER_DEFINITIONS = {
  KantoItsKenpo: {
    providerName: 'Kanto ITS Kenpo',
    defaultSource: 'https://www.its-kenpo.or.jp/hoken/jimu/hokenryou/index.html',
    regions: {
      DEFAULT: [
        // FY2026 with childcare support contribution (May 2026 paycheck — April billing + contribution)
        // Health 4.635% + contribution 0.115% = 4.75%
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source:
              'https://www.its-kenpo.or.jp/documents/hoken/jimu/hokenryou/20260401kara_hokenryouichiran.pdf',
            employeeHealthInsuranceRate: 47_500, // 4.75%
            employeeLongTermCareRate: 9_000, // 0.9%
          },
        },
        // FY2026 without contribution (April 2026 paycheck — March billing, new health rate)
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source:
              'https://www.its-kenpo.or.jp/documents/hoken/jimu/hokenryou/20260331made_hokenryouichiran.pdf',
            employeeHealthInsuranceRate: 47_500, // 4.75%
            employeeLongTermCareRate: 9_000, // 0.9%
          },
        },
        // FY2025 (April 2025 paycheck — March billing)
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source:
              'https://www.its-kenpo.or.jp/documents/hoken/jimu/hokenryou/2025.3.1ryougaku.pdf',
            employeeHealthInsuranceRate: 47_500, // 4.75%
            employeeLongTermCareRate: 9_000, // 0.9%
          },
        },
      ],
    },
  },
  KyokaiKenpo: {
    providerName: 'Kyokai Kenpo',
    regions: {
      // Hokkaido & Tohoku
      Hokkaido: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_01hokkaido.pdf',
            employeeHealthInsuranceRate: 52_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.28% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_01hokkaido.pdf',
            employeeHealthInsuranceRate: 51_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.28% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/01hokkaido_7.pdf',
            employeeHealthInsuranceRate: 51_550,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.31% / 2
      ],
      Aomori: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_02aomori.pdf',
            employeeHealthInsuranceRate: 50_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.85% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_02aomori.pdf',
            employeeHealthInsuranceRate: 49_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.85% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/02aomori_7.pdf',
            employeeHealthInsuranceRate: 49_250,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.85% / 2
      ],
      Iwate: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_03iwate.pdf',
            employeeHealthInsuranceRate: 48_700,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.51% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_03iwate.pdf',
            employeeHealthInsuranceRate: 47_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.51% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/03iwate_7.pdf',
            employeeHealthInsuranceRate: 48_100,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.62% / 2
      ],
      Miyagi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_04miyagi.pdf',
            employeeHealthInsuranceRate: 51_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.10% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_04miyagi.pdf',
            employeeHealthInsuranceRate: 50_500,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.10% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/04miyagi_7.pdf',
            employeeHealthInsuranceRate: 50_550,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.11% / 2
      ],
      Akita: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_05akita.pdf',
            employeeHealthInsuranceRate: 51_200,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.01% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_05akita.pdf',
            employeeHealthInsuranceRate: 50_050,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.01% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/05akita_7.pdf',
            employeeHealthInsuranceRate: 50_050,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.01% / 2
      ],
      Yamagata: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_06yamagata.pdf',
            employeeHealthInsuranceRate: 49_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.75% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_06yamagata.pdf',
            employeeHealthInsuranceRate: 48_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.75% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/06yamagata_7.pdf',
            employeeHealthInsuranceRate: 48_750,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.75% / 2
      ],
      Fukushima: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_07fukushima.pdf',
            employeeHealthInsuranceRate: 48_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.50% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_07fukushima.pdf',
            employeeHealthInsuranceRate: 47_500,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.50% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/07fukushima_7.pdf',
            employeeHealthInsuranceRate: 48_100,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.62% / 2
      ],

      // Kanto
      Ibaraki: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_08ibaraki.pdf',
            employeeHealthInsuranceRate: 48_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.52% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_08ibaraki.pdf',
            employeeHealthInsuranceRate: 47_600,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.52% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/08ibaraki_7.pdf',
            employeeHealthInsuranceRate: 48_350,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.67% / 2
      ],
      Tochigi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_09tochigi.pdf',
            employeeHealthInsuranceRate: 50_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.82% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_09tochigi.pdf',
            employeeHealthInsuranceRate: 49_100,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.82% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/09tochigi_7.pdf',
            employeeHealthInsuranceRate: 49_100,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.82% / 2
      ],
      Gunma: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_10gunma.pdf',
            employeeHealthInsuranceRate: 49_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.68% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_10gunma.pdf',
            employeeHealthInsuranceRate: 48_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.68% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/10gunma_7.pdf',
            employeeHealthInsuranceRate: 48_850,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.77% / 2
      ],
      Saitama: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_11saitama.pdf',
            employeeHealthInsuranceRate: 49_500,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.67% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_11saitama.pdf',
            employeeHealthInsuranceRate: 48_350,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.67% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/11saitama_7.pdf',
            employeeHealthInsuranceRate: 48_800,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.76% / 2
      ],
      Chiba: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_12chiba.pdf',
            employeeHealthInsuranceRate: 49_800,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.73% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_12chiba.pdf',
            employeeHealthInsuranceRate: 48_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.73% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/12chiba_7.pdf',
            employeeHealthInsuranceRate: 48_950,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.79% / 2
      ],
      Tokyo: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf',
            employeeHealthInsuranceRate: 50_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.85% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf',
            employeeHealthInsuranceRate: 49_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.85% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/13tokyo_7.pdf',
            employeeHealthInsuranceRate: 49_550,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.91% / 2
      ],
      Kanagawa: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_14kanagawa.pdf',
            employeeHealthInsuranceRate: 50_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.92% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_14kanagawa.pdf',
            employeeHealthInsuranceRate: 49_600,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.92% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/14kanagawa_7.pdf',
            employeeHealthInsuranceRate: 49_600,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.92% / 2
      ],

      // Chubu
      Niigata: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_15niigata.pdf',
            employeeHealthInsuranceRate: 47_200,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.21% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_15niigata.pdf',
            employeeHealthInsuranceRate: 46_050,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.21% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/15niigata_7.pdf',
            employeeHealthInsuranceRate: 47_750,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.55% / 2
      ],
      Toyama: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_16toyama.pdf',
            employeeHealthInsuranceRate: 49_100,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.59% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_16toyama.pdf',
            employeeHealthInsuranceRate: 47_950,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.59% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/16toyama_7.pdf',
            employeeHealthInsuranceRate: 48_250,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.65% / 2
      ],
      Ishikawa: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_17ishikawa.pdf',
            employeeHealthInsuranceRate: 49_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.70% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_17ishikawa.pdf',
            employeeHealthInsuranceRate: 48_500,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.70% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/17ishikawa_7.pdf',
            employeeHealthInsuranceRate: 49_400,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.88% / 2
      ],
      Fukui: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_18fukui.pdf',
            employeeHealthInsuranceRate: 49_700,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.71% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_18fukui.pdf',
            employeeHealthInsuranceRate: 48_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.71% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/18fukui_7.pdf',
            employeeHealthInsuranceRate: 49_700,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.94% / 2
      ],
      Yamanashi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_19yamanashi.pdf',
            employeeHealthInsuranceRate: 48_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.55% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_19yamanashi.pdf',
            employeeHealthInsuranceRate: 47_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.55% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/19yamanashi_7.pdf',
            employeeHealthInsuranceRate: 49_450,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.89% / 2
      ],
      Nagano: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_20nagano.pdf',
            employeeHealthInsuranceRate: 49_300,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.63% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_20nagano.pdf',
            employeeHealthInsuranceRate: 48_150,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.63% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/20nagano_7.pdf',
            employeeHealthInsuranceRate: 48_450,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.69% / 2
      ],
      Gifu: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_21gifu.pdf',
            employeeHealthInsuranceRate: 50_150,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.80% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_21gifu.pdf',
            employeeHealthInsuranceRate: 49_000,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.80% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/21gifu_7.pdf',
            employeeHealthInsuranceRate: 49_650,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.93% / 2
      ],
      Shizuoka: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_22shizuoka.pdf',
            employeeHealthInsuranceRate: 49_200,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.61% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_22shizuoka.pdf',
            employeeHealthInsuranceRate: 48_050,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.61% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/22shizuoka_7.pdf',
            employeeHealthInsuranceRate: 49_000,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.80% / 2
      ],
      Aichi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_23aichi.pdf',
            employeeHealthInsuranceRate: 50_800,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.93% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_23aichi.pdf',
            employeeHealthInsuranceRate: 49_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.93% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/23aichi_7.pdf',
            employeeHealthInsuranceRate: 50_150,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.03% / 2
      ],

      // Kansai
      Mie: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_24mie.pdf',
            employeeHealthInsuranceRate: 50_000,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.77% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_24mie.pdf',
            employeeHealthInsuranceRate: 48_850,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.77% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/24mie_7_1.pdf',
            employeeHealthInsuranceRate: 49_950,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.99% / 2
      ],
      Shiga: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_25shiga.pdf',
            employeeHealthInsuranceRate: 50_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.88% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_25shiga.pdf',
            employeeHealthInsuranceRate: 49_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.88% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/25shiga_7.pdf',
            employeeHealthInsuranceRate: 49_850,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.97% / 2
      ],
      Kyoto: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_26kyoto.pdf',
            employeeHealthInsuranceRate: 50_600,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.89% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_26kyoto.pdf',
            employeeHealthInsuranceRate: 49_450,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.89% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/26kyoto_7.pdf',
            employeeHealthInsuranceRate: 50_150,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.03% / 2
      ],
      Osaka: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_27osaka.pdf',
            employeeHealthInsuranceRate: 51_800,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.13% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_27osaka.pdf',
            employeeHealthInsuranceRate: 50_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.13% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/27osaka_7.pdf',
            employeeHealthInsuranceRate: 51_200,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.24% / 2
      ],
      Hyogo: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_28hyogo.pdf',
            employeeHealthInsuranceRate: 51_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.12% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_28hyogo.pdf',
            employeeHealthInsuranceRate: 50_600,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.12% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/28hyogo_7_1.pdf',
            employeeHealthInsuranceRate: 50_800,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.16% / 2
      ],
      Nara: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_29nara.pdf',
            employeeHealthInsuranceRate: 50_700,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.91% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_29nara.pdf',
            employeeHealthInsuranceRate: 49_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.91% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/29nara_7.pdf',
            employeeHealthInsuranceRate: 50_100,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.02% / 2
      ],
      Wakayama: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_30wakayama.pdf',
            employeeHealthInsuranceRate: 51_450,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.06% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_30wakayama.pdf',
            employeeHealthInsuranceRate: 50_300,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.06% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/30wakayama_7.pdf',
            employeeHealthInsuranceRate: 50_950,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.19% / 2
      ],

      // Chugoku
      Tottori: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_31tottori.pdf',
            employeeHealthInsuranceRate: 50_450,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.86% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_31tottori.pdf',
            employeeHealthInsuranceRate: 49_300,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.86% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/31tottori_7.pdf',
            employeeHealthInsuranceRate: 49_650,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.93% / 2
      ],
      Shimane: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_32shimane.pdf',
            employeeHealthInsuranceRate: 50_850,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.94% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_32shimane.pdf',
            employeeHealthInsuranceRate: 49_700,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.94% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/32shimane_7.pdf',
            employeeHealthInsuranceRate: 49_700,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.94% / 2
      ],
      Okayama: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_33okayama.pdf',
            employeeHealthInsuranceRate: 51_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.05% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_33okayama.pdf',
            employeeHealthInsuranceRate: 50_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.05% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/33okayama_7_1.pdf',
            employeeHealthInsuranceRate: 50_850,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.17% / 2
      ],
      Hiroshima: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_34hiroshima.pdf',
            employeeHealthInsuranceRate: 50_050,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.78% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_34hiroshima.pdf',
            employeeHealthInsuranceRate: 48_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.78% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/34hiroshima_7.pdf',
            employeeHealthInsuranceRate: 49_850,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.97% / 2
      ],
      Yamaguchi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_35yamaguchi.pdf',
            employeeHealthInsuranceRate: 51_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.15% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_35yamaguchi.pdf',
            employeeHealthInsuranceRate: 50_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.15% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/35yamaguchi_7.pdf',
            employeeHealthInsuranceRate: 51_800,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.36% / 2
      ],

      // Shikoku
      Tokushima: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_36tokushima.pdf',
            employeeHealthInsuranceRate: 52_350,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.24% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_36tokushima.pdf',
            employeeHealthInsuranceRate: 51_200,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.24% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/36tokushima_7.pdf',
            employeeHealthInsuranceRate: 52_350,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.47% / 2
      ],
      Kagawa: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_37kagawa.pdf',
            employeeHealthInsuranceRate: 51_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.02% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_37kagawa.pdf',
            employeeHealthInsuranceRate: 50_100,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.02% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/37kagawa_7.pdf',
            employeeHealthInsuranceRate: 51_050,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.21% / 2
      ],
      Ehime: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_38ehime.pdf',
            employeeHealthInsuranceRate: 51_050,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.98% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_38ehime.pdf',
            employeeHealthInsuranceRate: 49_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.98% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/38ehime_7.pdf',
            employeeHealthInsuranceRate: 50_900,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.18% / 2
      ],
      Kochi: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_39kouchi.pdf',
            employeeHealthInsuranceRate: 51_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.05% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_39kouchi.pdf',
            employeeHealthInsuranceRate: 50_250,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.05% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/39kouchi_7.pdf',
            employeeHealthInsuranceRate: 50_650,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.13% / 2
      ],

      // Kyushu & Okinawa
      Fukuoka: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_40fukuoka.pdf',
            employeeHealthInsuranceRate: 51_700,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.11% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_40fukuoka.pdf',
            employeeHealthInsuranceRate: 50_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.11% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/40fukuoka_7.pdf',
            employeeHealthInsuranceRate: 51_550,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.31% / 2
      ],
      Saga: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_41saga.pdf',
            employeeHealthInsuranceRate: 53_900,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.55% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_41saga.pdf',
            employeeHealthInsuranceRate: 52_750,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.55% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/41saga_7.pdf',
            employeeHealthInsuranceRate: 53_900,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.78% / 2
      ],
      Nagasaki: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_42nagasaki.pdf',
            employeeHealthInsuranceRate: 51_450,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.06% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_42nagasaki.pdf',
            employeeHealthInsuranceRate: 50_300,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.06% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/42nagasaki_7.pdf',
            employeeHealthInsuranceRate: 52_050,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.41% / 2
      ],
      Kumamoto: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_43kumamotoi.pdf',
            employeeHealthInsuranceRate: 51_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.08% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_43kumamotoi.pdf',
            employeeHealthInsuranceRate: 50_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.08% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/43kumamoto_7.pdf',
            employeeHealthInsuranceRate: 50_600,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.12% / 2
      ],
      Oita: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_44oita.pdf',
            employeeHealthInsuranceRate: 51_550,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.08% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_44oita.pdf',
            employeeHealthInsuranceRate: 50_400,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.08% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/44oita_7.pdf',
            employeeHealthInsuranceRate: 51_250,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.25% / 2
      ],
      Miyazaki: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_45miyazaki.pdf',
            employeeHealthInsuranceRate: 50_000,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.77% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_45miyazaki.pdf',
            employeeHealthInsuranceRate: 48_850,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.77% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/45miyazaki_7.pdf',
            employeeHealthInsuranceRate: 50_450,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.09% / 2
      ],
      Kagoshima: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_46kagoshima.pdf',
            employeeHealthInsuranceRate: 51_800,
            employeeLongTermCareRate: 8_100,
          },
        }, // (10.13% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_46kagoshima.pdf',
            employeeHealthInsuranceRate: 50_650,
            employeeLongTermCareRate: 8_100,
          },
        }, // 10.13% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/46kagoshima_7_1.pdf',
            employeeHealthInsuranceRate: 51_550,
            employeeLongTermCareRate: 7_950,
          },
        }, // 10.31% / 2
      ],
      Okinawa: [
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_47okinawa.pdf',
            employeeHealthInsuranceRate: 48_350,
            employeeLongTermCareRate: 8_100,
          },
        }, // (9.44% + 0.23%) / 2
        {
          effectiveFrom: { year: 2026, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/R8_47okinawa.pdf',
            employeeHealthInsuranceRate: 47_200,
            employeeLongTermCareRate: 8_100,
          },
        }, // 9.44% / 2
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://www.kyoukaikenpo.or.jp/assets/47okinawa_7.pdf',
            employeeHealthInsuranceRate: 47_200,
            employeeLongTermCareRate: 7_950,
          },
        }, // 9.44% / 2
      ],

      // Note: All Kyokai Kenpo rates are split evenly between employer and employee.
      // FY2025 health insurance rates from Table 17 (effective March 2025 billing / April 2025 paycheck)
      // FY2025 nursing insurance rate is 1.59% for all regions
      // FY2026 health insurance rates from Table 18 (effective March 2026 billing / April 2026 paycheck)
      // FY2026 nursing insurance rate is 1.62% for all regions
      // FY2026 childcare support contribution of 0.23% (effective April 2026 billing / May 2026 paycheck) is folded into health rate
    },
  },
  RakutenKenpo: {
    providerName: 'Rakuten KENPO',
    defaultSource: 'https://kenpo.rakuten.or.jp/member/outline/fee.html',
    regions: {
      DEFAULT: [
        // FY2026 with childcare support contribution (May 2026 paycheck)
        // Health 4.7% + contribution 0.115% = 4.815%
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://kenpo.rakuten.or.jp/member/outline/files/fee.pdf',
            employeeHealthInsuranceRate: 48_150, // 4.815%
            employeeLongTermCareRate: 10_000, // 1.0%
          },
        },
        // FY2025 (April 2025)
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://kenpo.rakuten.or.jp/member/outline/files/fee.pdf',
            employeeHealthInsuranceRate: 47_000, // 4.7% (total 9.4% split evenly)
            employeeLongTermCareRate: 10_000, // 1.0% (total 2.0% split evenly)
          },
        },
      ],
    },
  },
  RecruitKenpo: {
    providerName: 'Recruit Health Insurance Society',
    defaultSource: 'https://kempo.recruit.co.jp/member/outline/fee.html',
    regions: {
      DEFAULT: [
        // FY2026 with childcare support contribution (May 2026 paycheck)
        // Employee health 4.35% + contribution 0.115% = 4.465%, employer health 4.65% + 0.115% = 4.765%
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source: 'https://kempo.recruit.co.jp/member/info/pdf/r8_fee.pdf',
            employeeHealthInsuranceRate: 44_650, // 4.465%
            employerHealthInsuranceRate: 47_650, // 4.765%
            employeeLongTermCareRate: 10_000, // 1.0%
          },
        },
        // FY2025 (April 2025)
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source: 'https://kempo.recruit.co.jp/member/info/pdf/r7_fee.pdf',
            employeeHealthInsuranceRate: 43_500, // 4.35%
            employerHealthInsuranceRate: 46_500, // 4.65%
            employeeLongTermCareRate: 10_000, // 1.0%
          },
        },
      ],
    },
  },
  TokyoSecuritiesKenpo: {
    providerName: 'Tokyo Securities Health Insurance Society',
    defaultSource: 'https://www.shoken-kenpo.or.jp/member/outline/fee.html',
    regions: {
      DEFAULT: [
        // FY2026 with childcare support contribution (May 2026 paycheck)
        // Employee health 3.3% + contribution 0.115% = 3.415%, employer health 5.1% + 0.115% = 5.215%
        {
          effectiveFrom: { year: 2026, month: 4 },
          rates: {
            source:
              'https://www.shoken-kenpo.or.jp/member/outline/files/hokenryou_getsugaku_2026.pdf',
            employeeHealthInsuranceRate: 34_150, // 3.415%
            employerHealthInsuranceRate: 52_150, // 5.215%
            employeeLongTermCareRate: 8_300, // 0.83%
          },
        },
        // FY2025 (April 2025)
        {
          effectiveFrom: { year: 2025, month: 3 },
          rates: {
            source:
              'https://www.shoken-kenpo.or.jp/member/outline/files/hokenryou_getsugaku_2025.pdf',
            employeeHealthInsuranceRate: 33_000, // 3.3% (total 8.4% split 33/51)
            employerHealthInsuranceRate: 51_000, // 5.1%
            employeeLongTermCareRate: 8_300, // 0.83% (total 1.66% split evenly)
          },
        },
      ],
    },
  },
} satisfies Record<string, ProviderDefinition> & {
  // Kyokai Kenpo's rates vary by prefecture, and the region dropdown offers the same
  // identifiers here as for 後期高齢者医療, so a key list that lost or renamed a prefecture
  // would leave that prefecture unselectable under one provider. Requiring every
  // Prefecture here ties the two lists together at compile time.
  KyokaiKenpo: ProviderDefinition & { regions: Record<Prefecture, HealthInsuranceRatePeriod[]> };
};

if (import.meta.env.DEV) {
  for (const [providerId, provider] of Object.entries(PROVIDER_DEFINITIONS)) {
    for (const [regionKey, periods] of Object.entries(provider.regions)) {
      // Validate that each region's rate periods are sorted newest-first
      for (let i = 1; i < periods.length; i++) {
        const prev = periods[i - 1]!.effectiveFrom;
        const curr = periods[i]!.effectiveFrom;
        if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
          throw new Error(
            `${providerId}/${regionKey} rate periods must be sorted newest-first, ` +
              `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
          );
        }
      }
      for (const period of periods) {
        const { effectiveFrom, rates }: HealthInsuranceRatePeriod = period;
        for (const field of [
          'employeeHealthInsuranceRate',
          'employerHealthInsuranceRate',
          'employeeLongTermCareRate',
          'employerLongTermCareRate',
        ] as const) {
          const rate = rates[field];
          if (rate !== undefined && !(Number.isSafeInteger(rate) && rate >= 0)) {
            throw new Error(
              `${providerId}/${regionKey} ${effectiveFrom.year}-${effectiveFrom.month} ${field} ` +
                `must be a non-negative integer over HEALTH_INSURANCE_RATE_SCALE, but is ${rate}`,
            );
          }
        }
      }
    }
  }
}

/** All employee-health-insurance provider IDs (the keys of PROVIDER_DEFINITIONS). */
export type EmployeeProviderId = keyof typeof PROVIDER_DEFINITIONS;

/**
 * Safe lookup of an employee-health-insurance provider definition. Returns undefined for
 * IDs that aren't employee providers (e.g. National Health Insurance, dependent coverage,
 * or custom), which callers are expected to handle.
 */
export function getProviderDefinition(id: string): ProviderDefinition | undefined {
  return Object.hasOwn(PROVIDER_DEFINITIONS, id)
    ? PROVIDER_DEFINITIONS[id as EmployeeProviderId]
    : undefined;
}
