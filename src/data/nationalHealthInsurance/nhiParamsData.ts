// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NationalHealthInsuranceRegionParams, NHIRegionDefinition } from '../../types/healthInsurance';

/**
 * A map storing National Health Insurance region definitions by region key (string).
 * The region key uses the format "Prefecture-Municipality" (e.g., "Tokyo-Setagaya").
 * Region names include both English and Japanese for easy searching.
 *
 * Each region contains a time-series of rate periods sorted newest-first.
 * Use getNHIParamsForMonth() to look up the applicable rates for a given date.
 */
const allNHIRegions: Record<string, NHIRegionDefinition> = {
  'Tokyo-Chiyoda': {
    regionName: "Chiyoda Ward, Tokyo / 千代田区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0172,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16200,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Chuo': {
    regionName: "Chuo Ward, Tokyo / 中央区",
    periods: [
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Minato': {
    regionName: "Minato Ward, Tokyo / 港区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.minato.tokyo.jp/shikaku/kurashi/hoken/kenkohoken/hokenryo.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Shinjuku': {
    regionName: "Shinjuku Ward, Tokyo / 新宿区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.shinjuku.lg.jp/hoken/hoken01_001028.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Bunkyo': {
    regionName: "Bunkyo Ward, Tokyo / 文京区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.bunkyo.lg.jp/b021/p000424.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0223,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Taito': {
    regionName: "Taito Ward, Tokyo / 台東区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.taito.lg.jp/kurashi/zeikin/kokuminkenkohoken/hokenryou/20130605104825870.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Sumida': {
    regionName: "Sumida Ward, Tokyo / 墨田区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.sumida.lg.jp/kurashi/kenkouhoken/kokuminkenkouhoken/kokuhoryoukeisan.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Koto': {
    regionName: "Koto Ward, Tokyo / 江東区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.koto.lg.jp/250102/fukushi/kokumin/hokenryo/20170201.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Shinagawa': {
    regionName: "Shinagawa Ward, Tokyo / 品川区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "http://www.city.shinagawa.tokyo.jp/PC/procedure/procedure-kenkouhoken/procedure-kenkouhoken-hokenryo/hpg000019306.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Meguro': {
    regionName: "Meguro Ward, Tokyo / 目黒区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.meguro.tokyo.jp/kokuho/kurashi/kokuho/keisan.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0235,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0219,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Ota': {
    regionName: "Ota Ward, Tokyo / 大田区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.ota.tokyo.jp/seikatsu/kokunen/kokuho/hokenryou/keisan.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Setagaya': {
    regionName: "Setagaya Ward, Tokyo / 世田谷区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.setagaya.lg.jp/02060/297.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Shibuya': {
    regionName: "Shibuya Ward, Tokyo / 渋谷区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.shibuya.tokyo.jp/kurashi/kokuho/kenkohokenryo/hokenryo_26.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Nakano': {
    regionName: "Nakano Ward, Tokyo / 中野区",
    periods: [
      // FY2026 (April 2026)
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.tokyo-nakano.lg.jp/kurashi/hoken/hokenryo/keisan.html",
        medicalRate: 0.0803,
        supportRate: 0.0294,
        ltcRateForEligible: 0.0253,
        medicalPerCapita: 47100,
        supportPerCapita: 17400,
        ltcPerCapitaForEligible: 17700,
        medicalCap: 670000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        childSupportRate: 0.0027,
        childSupportPerCapita: 73,
        childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.city.tokyo-nakano.lg.jp/kurashi/hoken/hokenryo/keisan.html",
        medicalRate: 0.0792,
        supportRate: 0.0287,
        ltcRateForEligible: 0.0220,
        medicalPerCapita: 45600,
        supportPerCapita: 16200,
        ltcPerCapitaForEligible: 17400,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Suginami': {
    regionName: "Suginami Ward, Tokyo / 杉並区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.suginami.tokyo.jp/s035/1991.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Toshima': {
    regionName: "Toshima Ward, Tokyo / 豊島区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.toshima.lg.jp/109/tetsuzuki/nenkin/kenkohoken/hokenryo/004922.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Kita': {
    regionName: "Kita Ward, Tokyo / 北区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.kita.lg.jp/living/insurance-pension/1001703/1001723/1001724.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Arakawa': {
    regionName: "Arakawa Ward, Tokyo / 荒川区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.arakawa.tokyo.jp/a031/kenkouhoken/kokuho/hokenryo.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0210,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Itabashi': {
    regionName: "Itabashi Ward, Tokyo / 板橋区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.itabashi.tokyo.jp/kenko/kokuho/kokuho/hokenryo/1003135.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0222,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Nerima': {
    regionName: "Nerima Ward, Tokyo / 練馬区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.nerima.tokyo.jp/kurashi/nenkinhoken/kokuminkenkohoken/hoken_hokenryo/keisan_hoho.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Adachi': {
    regionName: "Adachi Ward, Tokyo / 足立区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.adachi.tokyo.jp/kokuho/kurashi/hoken/hokenryoukimekata.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Katsushika': {
    regionName: "Katsushika Ward, Tokyo / 葛飾区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.katsushika.lg.jp/kurashi/1000049/1001690/1001711.html",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo-Edogawa': {
    regionName: "Edogawa Ward, Tokyo / 江戸川区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.city.edogawa.tokyo.jp/e053/kurashi/iryohoken/kokuho/hokenryou/hokenryo_simulation.html",
        medicalRate: 0.0783, supportRate: 0.0284, ltcRateForEligible: 0.0245,
        medicalPerCapita: 48900, supportPerCapita: 17400, ltcPerCapitaForEligible: 17400,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1870, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0859,
        supportRate: 0.0297,
        ltcRateForEligible: 0.0245,
        medicalPerCapita: 50400,
        supportPerCapita: 17400,
        ltcPerCapitaForEligible: 17400,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Tokyo': {
    regionName: "Tokyo Special Wards / 東京都特別区",
    periods: [
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0751, supportRate: 0.0280, ltcRateForEligible: 0.0243,
        medicalPerCapita: 47600, supportPerCapita: 17600, ltcPerCapitaForEligible: 17800,
        medicalCap: 670000, supportCap: 260000, ltcCapForEligible: 170000,
        childSupportRate: 0.0027, childSupportPerCapita: 1873, childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/hokennryou/h30hokenryougaku",
        medicalRate: 0.0771,
        supportRate: 0.0269,
        ltcRateForEligible: 0.0225,
        medicalPerCapita: 47300,
        supportPerCapita: 16800,
        ltcPerCapitaForEligible: 16600,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Osaka': {
    regionName: "Osaka Prefecture / 大阪府",
    periods: [
      // FY2026 (April 2026)
      { effectiveFrom: { year: 2026, month: 3 }, params: {
        source: "https://www.pref.osaka.lg.jp/o100080/kokuho/iryouseido/hokenryouritsu/hokenryouritsu2.html",
        medicalRate: 0.0950,
        supportRate: 0.0306,
        ltcRateForEligible: 0.0260,
        medicalPerCapita: 34990,
        supportPerCapita: 11191,
        ltcPerCapitaForEligible: 18682,
        medicalHouseholdFlat: 33908,
        supportHouseholdFlat: 10845,
        ltcHouseholdFlatForEligible: 0,
        medicalCap: 660000,
        supportCap: 260000,
        ltcCapForEligible: 170000,
        childSupportRate: 0.0028,
        childSupportPerCapita: 1841,
        childSupportHouseholdFlat: 0,
        childSupportCap: 30000,
        nhiStandardDeduction: 430000,
      }},
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.pref.osaka.lg.jp/o100080/kokuho/iryouseido/hokenryouritsu/hokenryouritsu.html",
        medicalRate: 0.0930,
        supportRate: 0.0302,
        ltcRateForEligible: 0.0256,
        medicalPerCapita: 34424,
        supportPerCapita: 11034,
        ltcPerCapitaForEligible: 18784,
        medicalHouseholdFlat: 33574,
        supportHouseholdFlat: 10761,
        ltcHouseholdFlatForEligible: 0,
        medicalCap: 650000,
        supportCap: 240000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  'Nara': {
    regionName: "Nara Prefecture / 奈良県",
    periods: [
      { effectiveFrom: { year: 2025, month: 3 }, params: {
        source: "https://www.city.nara.lg.jp/site/kokuminkenkouhoken/9305.html",
        medicalRate: 0.0764,
        supportRate: 0.0327,
        ltcRateForEligible: 0.0303,
        medicalPerCapita: 27600,
        supportPerCapita: 11500,
        ltcPerCapitaForEligible: 16900,
        medicalHouseholdFlat: 20000,
        supportHouseholdFlat: 8400,
        ltcHouseholdFlatForEligible: 0,
        medicalCap: 650000,
        supportCap: 240000,
        ltcCapForEligible: 170000,
        nhiStandardDeduction: 430000,
      }},
    ],
  },
  // Add more regions/municipalities as needed
};

/**
 * Returns the applicable NHI parameters for a given region, year, and month.
 * Finds the most recent rate period whose effective date is on or before the given date.
 *
 * @param region Region key (e.g., 'Tokyo', 'Osaka')
 * @param year Calendar year
 * @param month 0-indexed month (0=Jan, 11=Dec)
 */
export function getNHIParamsForMonth(
  region: string,
  year: number,
  month: number
): NationalHealthInsuranceRegionParams | undefined {
  const regionDef = allNHIRegions[region];
  if (!regionDef || regionDef.periods.length === 0) {
    console.warn(`National Health Insurance parameters not found for region: ${region}`);
    return undefined;
  }

  for (const period of regionDef.periods) {
    const { effectiveFrom } = period;
    if (year > effectiveFrom.year || (year === effectiveFrom.year && month >= effectiveFrom.month)) {
      return { regionName: regionDef.regionName, ...period.params };
    }
  }
  // Fallback to the oldest known rate
  const oldest = regionDef.periods[regionDef.periods.length - 1]!;
  return { regionName: regionDef.regionName, ...oldest.params };
}

/**
 * Exported list of available region keys for National Health Insurance.
 */
export const NATIONAL_HEALTH_INSURANCE_REGIONS = Object.keys(allNHIRegions);

/**
 * National Health Insurance region options for UI components.
 * Array of region options with id (regionKey) and displayName (regionName).
 */
export const NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS = Object.entries(allNHIRegions).map(([regionKey, def]) => ({
  id: regionKey,
  displayName: def.regionName
}));
