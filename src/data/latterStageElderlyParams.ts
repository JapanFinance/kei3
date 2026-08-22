// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LatterStageElderlyRegionParams } from '../types/healthInsurance';
import { isPrefecture, PREFECTURE_NAMES, type Prefecture } from './prefectures';

/**
 * 後期高齢者医療制度 premium parameters, laid out by rate period rather than by prefecture.
 *
 * Rates are uniform across a whole prefecture by law — 高齢者の医療の確保に関する法律施行令
 * 第18条第1項第6号・第12号 require the 所得割率 and 被保険者均等割額 to be 「当該後期高齢者医療
 * 広域連合の全区域にわたって均一」 — and each 広域連合 sets them for two fiscal years at a time,
 * so full national coverage is only 47 entries per cycle.
 *
 * The 賦課限度額 are national, fixed by the same cabinet order rather than by each 広域連合
 * (第1項第7号: 基礎賦課額 85万円; 第13号: 子ども・子育て支援納付金賦課額 2.1万円; before FY2026
 * the 基礎賦課額 limit was 80万円 and there was no 子ども分), so they are stated once per period
 * instead of being repeated for every prefecture.
 * https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18
 *
 * MHLW publishes one table covering every 広域連合 when the rates are set. The FY2026
 * publication tabulates both cycles shipped here, so it is the single source the UI cites
 * ({@link LATTER_STAGE_RATE_TABLE_URL}); a future cycle's publication replaces it. Where to
 * read the figures in that PDF, for whoever adds the 令和10・11年度 cycle in April 2028:
 * - Page 2 is the 医療分 table, one row per 広域連合. Its 令和8・9年度 columns give the
 *   均等割額 and 所得割率 of the newer period here, and its 令和6・7年度 comparison columns
 *   give the older period's.
 * - Page 3 is the 子ども・子育て支援納付金分 table, again one row per 広域連合, giving the
 *   均等割額 and 所得割率 of the 令和8・9年度 period. The levy did not exist in 令和6・7年度,
 *   so that period carries no 子ども分.
 * Two prefectures were cross-checked against a second publisher to confirm the figures were
 * read out of the right columns: Tokyo against tokyo-ikiiki.net and Osaka against 東大阪市.
 *
 * Rates are the uniform prefecture-wide ones. A few 広域連合 also set reduced rates for
 * designated remote areas (特定地域, 施行令第18条第2項); those are not modeled.
 */
interface LatterStagePeriodBase {
  /** Month is 0-indexed; rates take effect in April (month 3) of the cycle's first year. */
  effectiveFrom: { year: number; month: number };
  medicalCap: number;
  rates: Record<Prefecture, LatterStageRegionRates>;
}

/** The 子ども・子育て支援納付金分 均等割額 and 所得割率 for one prefecture. */
interface ChildSupportRates {
  perCapita: number;
  rate: number;
}

/** 均等割額 and 所得割率 for one prefecture, in the vocabulary the lookup returns. */
interface LatterStageRegionRates {
  medicalPerCapita: number;
  medicalRate: number;
  childSupport?: ChildSupportRates;
}

/** A period from FY2026 on, where every prefecture also levies the 子ども分. */
interface LatterStagePeriodWithChildSupport extends LatterStagePeriodBase {
  childSupportCap: number;
  rates: Record<Prefecture, LatterStageRegionRates & { childSupport: ChildSupportRates }>;
}

/** A period before FY2026, when the 子ども分 did not exist. */
interface LatterStagePeriodMedicalOnly extends LatterStagePeriodBase {
  childSupportCap?: never;
  rates: Record<Prefecture, LatterStageRegionRates & { childSupport?: never }>;
}

/**
 * The two shapes are separate so that the 子ども分 cap and the per-prefecture 子ども分 rates
 * can only be added together.
 */
type LatterStagePeriod = LatterStagePeriodWithChildSupport | LatterStagePeriodMedicalOnly;

/**
 * 「後期高齢者医療制度の令和8・9年度の保険料率について」(令和8年4月10日) — the MHLW table of
 * every 広域連合's rates, the source for both periods in {@link LATTER_STAGE_PERIODS}.
 */
export const LATTER_STAGE_RATE_TABLE_URL = 'https://www.mhlw.go.jp/content/12403500/001689077.pdf';

/** Rate periods, newest first. */
const LATTER_STAGE_PERIODS: LatterStagePeriod[] = [
  {
    // 令和8・9年度 (FY2026-2027)
    effectiveFrom: { year: 2026, month: 3 },
    medicalCap: 850_000,
    childSupportCap: 21_000,
    rates: {
      Hokkaido: {
        medicalPerCapita: 59963,
        medicalRate: 0.1161,
        childSupport: { perCapita: 1364, rate: 0.0028 },
      },
      Aomori: {
        medicalPerCapita: 50500,
        medicalRate: 0.09,
        childSupport: { perCapita: 1300, rate: 0.002 },
      },
      Iwate: {
        medicalPerCapita: 48800,
        medicalRate: 0.085,
        childSupport: { perCapita: 1366, rate: 0.0026 },
      },
      Miyagi: {
        medicalPerCapita: 52200,
        medicalRate: 0.0912,
        childSupport: { perCapita: 1370, rate: 0.0025 },
      },
      Akita: {
        medicalPerCapita: 55996,
        medicalRate: 0.0973,
        childSupport: { perCapita: 1350, rate: 0.0025 },
      },
      Yamagata: {
        medicalPerCapita: 52500,
        medicalRate: 0.0963,
        childSupport: { perCapita: 1373, rate: 0.0025 },
      },
      Fukushima: {
        medicalPerCapita: 49000,
        medicalRate: 0.0924,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Ibaraki: {
        medicalPerCapita: 49500,
        medicalRate: 0.0932,
        childSupport: { perCapita: 1400, rate: 0.0028 },
      },
      Tochigi: {
        medicalPerCapita: 49100,
        medicalRate: 0.09,
        childSupport: { perCapita: 1300, rate: 0.0025 },
      },
      Gunma: {
        medicalPerCapita: 54600,
        medicalRate: 0.0978,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Saitama: {
        medicalPerCapita: 52370,
        medicalRate: 0.0949,
        childSupport: { perCapita: 1330, rate: 0.0025 },
      },
      Chiba: {
        medicalPerCapita: 51000,
        medicalRate: 0.094,
        childSupport: { perCapita: 1310, rate: 0.0025 },
      },
      Tokyo: {
        medicalPerCapita: 53300,
        medicalRate: 0.0988,
        childSupport: { perCapita: 1300, rate: 0.0026 },
      },
      Kanagawa: {
        medicalPerCapita: 52531,
        medicalRate: 0.103,
        childSupport: { perCapita: 1330, rate: 0.0025 },
      },
      Niigata: {
        medicalPerCapita: 49200,
        medicalRate: 0.0861,
        childSupport: { perCapita: 1354, rate: 0.0026 },
      },
      Toyama: {
        medicalPerCapita: 55800,
        medicalRate: 0.1019,
        childSupport: { perCapita: 1373, rate: 0.0026 },
      },
      Ishikawa: {
        medicalPerCapita: 57300,
        medicalRate: 0.1114,
        childSupport: { perCapita: 1360, rate: 0.0024 },
      },
      Fukui: {
        medicalPerCapita: 54140,
        medicalRate: 0.1083,
        childSupport: { perCapita: 1300, rate: 0.0026 },
      },
      Yamanashi: {
        medicalPerCapita: 52610,
        medicalRate: 0.0944,
        childSupport: { perCapita: 1330, rate: 0.0025 },
      },
      Nagano: {
        medicalPerCapita: 48827,
        medicalRate: 0.088,
        childSupport: { perCapita: 1339, rate: 0.0025 },
      },
      Gifu: {
        medicalPerCapita: 55385,
        medicalRate: 0.0971,
        childSupport: { perCapita: 1374, rate: 0.0025 },
      },
      Shizuoka: {
        medicalPerCapita: 51100,
        medicalRate: 0.0935,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Aichi: {
        medicalPerCapita: 56130,
        medicalRate: 0.1048,
        childSupport: { perCapita: 1362, rate: 0.0025 },
      },
      Mie: {
        medicalPerCapita: 54843,
        medicalRate: 0.0953,
        childSupport: { perCapita: 1370, rate: 0.0025 },
      },
      Shiga: {
        medicalPerCapita: 55380,
        medicalRate: 0.1013,
        childSupport: { perCapita: 1340, rate: 0.0025 },
      },
      Kyoto: {
        medicalPerCapita: 59590,
        medicalRate: 0.1015,
        childSupport: { perCapita: 1350, rate: 0.0025 },
      },
      Osaka: {
        medicalPerCapita: 64931,
        medicalRate: 0.1151,
        childSupport: { perCapita: 1373, rate: 0.0024 },
      },
      Hyogo: {
        medicalPerCapita: 58427,
        medicalRate: 0.1077,
        childSupport: { perCapita: 1351, rate: 0.0024 },
      },
      Nara: {
        medicalPerCapita: 57100,
        medicalRate: 0.1063,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Wakayama: {
        medicalPerCapita: 58748,
        medicalRate: 0.1036,
        childSupport: { perCapita: 1385, rate: 0.0025 },
      },
      Tottori: {
        medicalPerCapita: 52138,
        medicalRate: 0.1064,
        childSupport: { perCapita: 1363, rate: 0.0025 },
      },
      Shimane: {
        medicalPerCapita: 57170,
        medicalRate: 0.1002,
        childSupport: { perCapita: 1370, rate: 0.0026 },
      },
      Okayama: {
        medicalPerCapita: 60100,
        medicalRate: 0.1088,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Hiroshima: {
        medicalPerCapita: 55090,
        medicalRate: 0.0993,
        childSupport: { perCapita: 1337, rate: 0.0025 },
      },
      Yamaguchi: {
        medicalPerCapita: 63513,
        medicalRate: 0.1136,
        childSupport: { perCapita: 1354, rate: 0.0024 },
      },
      Tokushima: {
        medicalPerCapita: 60976,
        medicalRate: 0.1091,
        childSupport: { perCapita: 1356, rate: 0.0025 },
      },
      Kagawa: {
        medicalPerCapita: 58000,
        medicalRate: 0.0993,
        childSupport: { perCapita: 1300, rate: 0.0025 },
      },
      Ehime: {
        medicalPerCapita: 55630,
        medicalRate: 0.0979,
        childSupport: { perCapita: 1320, rate: 0.0025 },
      },
      Kochi: {
        medicalPerCapita: 60400,
        medicalRate: 0.1031,
        childSupport: { perCapita: 1393, rate: 0.0024 },
      },
      Fukuoka: {
        medicalPerCapita: 66340,
        medicalRate: 0.117,
        childSupport: { perCapita: 1339, rate: 0.0025 },
      },
      Saga: {
        medicalPerCapita: 68700,
        medicalRate: 0.1179,
        childSupport: { perCapita: 1400, rate: 0.0024 },
      },
      Nagasaki: {
        medicalPerCapita: 56200,
        medicalRate: 0.0959,
        childSupport: { perCapita: 1300, rate: 0.0025 },
      },
      Kumamoto: {
        medicalPerCapita: 63000,
        medicalRate: 0.1106,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Oita: {
        medicalPerCapita: 64200,
        medicalRate: 0.1125,
        childSupport: { perCapita: 1400, rate: 0.0024 },
      },
      Miyazaki: {
        medicalPerCapita: 56300,
        medicalRate: 0.1008,
        childSupport: { perCapita: 1356, rate: 0.0025 },
      },
      Kagoshima: {
        medicalPerCapita: 69800,
        medicalRate: 0.1172,
        childSupport: { perCapita: 1400, rate: 0.0025 },
      },
      Okinawa: {
        medicalPerCapita: 61000,
        medicalRate: 0.1081,
        childSupport: { perCapita: 1290, rate: 0.0026 },
      },
    },
  },
  {
    // 令和6・7年度 (FY2024-2025), from the FY2026 publication's comparison column. Its
    // FY2024-only relief measures (a reduced 所得割率 for lower incomes, and a transitional
    // 賦課限度額 for continuing insured) are not modeled: within the supported income years
    // they would affect only the January-March slice of calendar 2025.
    effectiveFrom: { year: 2024, month: 3 },
    medicalCap: 800_000,
    rates: {
      Hokkaido: { medicalPerCapita: 52953, medicalRate: 0.1179 },
      Aomori: { medicalPerCapita: 46800, medicalRate: 0.099 },
      Iwate: { medicalPerCapita: 43800, medicalRate: 0.0853 },
      Miyagi: { medicalPerCapita: 47400, medicalRate: 0.0928 },
      Akita: { medicalPerCapita: 45260, medicalRate: 0.0902 },
      Yamagata: { medicalPerCapita: 47600, medicalRate: 0.0943 },
      Fukushima: { medicalPerCapita: 45900, medicalRate: 0.0898 },
      Ibaraki: { medicalPerCapita: 47500, medicalRate: 0.0966 },
      Tochigi: { medicalPerCapita: 45600, medicalRate: 0.0884 },
      Gunma: { medicalPerCapita: 49100, medicalRate: 0.1007 },
      Saitama: { medicalPerCapita: 45930, medicalRate: 0.0903 },
      Chiba: { medicalPerCapita: 43800, medicalRate: 0.0911 },
      Tokyo: { medicalPerCapita: 47300, medicalRate: 0.0967 },
      Kanagawa: { medicalPerCapita: 45900, medicalRate: 0.1008 },
      Niigata: { medicalPerCapita: 44200, medicalRate: 0.0861 },
      Toyama: { medicalPerCapita: 46800, medicalRate: 0.0882 },
      Ishikawa: { medicalPerCapita: 50760, medicalRate: 0.0988 },
      Fukui: { medicalPerCapita: 49700, medicalRate: 0.097 },
      Yamanashi: { medicalPerCapita: 50770, medicalRate: 0.1111 },
      Nagano: { medicalPerCapita: 44365, medicalRate: 0.0945 },
      Gifu: { medicalPerCapita: 49412, medicalRate: 0.0956 },
      Shizuoka: { medicalPerCapita: 47000, medicalRate: 0.0949 },
      Aichi: { medicalPerCapita: 53438, medicalRate: 0.1113 },
      Mie: { medicalPerCapita: 48903, medicalRate: 0.0982 },
      Shiga: { medicalPerCapita: 48604, medicalRate: 0.0956 },
      Kyoto: { medicalPerCapita: 56340, medicalRate: 0.1095 },
      Osaka: { medicalPerCapita: 57172, medicalRate: 0.1175 },
      Hyogo: { medicalPerCapita: 52791, medicalRate: 0.1124 },
      Nara: { medicalPerCapita: 51500, medicalRate: 0.1055 },
      Wakayama: { medicalPerCapita: 54428, medicalRate: 0.1104 },
      Tottori: { medicalPerCapita: 52138, medicalRate: 0.1064 },
      Shimane: { medicalPerCapita: 50160, medicalRate: 0.1008 },
      Okayama: { medicalPerCapita: 50200, medicalRate: 0.1049 },
      Hiroshima: { medicalPerCapita: 49621, medicalRate: 0.0963 },
      Yamaguchi: { medicalPerCapita: 57012, medicalRate: 0.1152 },
      Tokushima: { medicalPerCapita: 56311, medicalRate: 0.1055 },
      Kagawa: { medicalPerCapita: 54000, medicalRate: 0.1041 },
      Ehime: { medicalPerCapita: 51930, medicalRate: 0.1016 },
      Kochi: { medicalPerCapita: 56000, medicalRate: 0.1078 },
      Fukuoka: { medicalPerCapita: 60004, medicalRate: 0.1183 },
      Saga: { medicalPerCapita: 57100, medicalRate: 0.1109 },
      Nagasaki: { medicalPerCapita: 52400, medicalRate: 0.1031 },
      Kumamoto: { medicalPerCapita: 58000, medicalRate: 0.1098 },
      Oita: { medicalPerCapita: 59200, medicalRate: 0.1155 },
      Miyazaki: { medicalPerCapita: 51700, medicalRate: 0.1008 },
      Kagoshima: { medicalPerCapita: 59900, medicalRate: 0.1172 },
      Okinawa: { medicalPerCapita: 56400, medicalRate: 0.116 },
    },
  },
];

if (import.meta.env.DEV) {
  // Validate that the periods are sorted newest-first
  for (let i = 1; i < LATTER_STAGE_PERIODS.length; i++) {
    const prev = LATTER_STAGE_PERIODS[i - 1]!.effectiveFrom;
    const curr = LATTER_STAGE_PERIODS[i]!.effectiveFrom;
    if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
      throw new Error(
        `LATTER_STAGE_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
      );
    }
  }
}

/**
 * Returns the 後期高齢者医療 parameters in effect for the given calendar month, or undefined
 * for an unknown prefecture. Composes the period's national caps with the prefecture's
 * own rates, and tags them with the period they came from. Same newest-first lookup as
 * {@link getNHIParamsForMonth}.
 */
export function getLatterStageParamsForMonth(
  region: string,
  year: number,
  month: number,
): LatterStageElderlyRegionParams | undefined {
  if (!isPrefecture(region)) {
    return undefined;
  }

  const period =
    LATTER_STAGE_PERIODS.find(
      p =>
        year > p.effectiveFrom.year ||
        (year === p.effectiveFrom.year && month >= p.effectiveFrom.month),
    ) ?? LATTER_STAGE_PERIODS[LATTER_STAGE_PERIODS.length - 1]!;

  const medical = {
    regionName: PREFECTURE_NAMES[region],
    periodId: `${period.effectiveFrom.year}-${period.effectiveFrom.month}`,
    medicalPerCapita: period.rates[region].medicalPerCapita,
    medicalRate: period.rates[region].medicalRate,
    medicalCap: period.medicalCap,
  };
  if (period.childSupportCap === undefined) {
    return medical;
  }
  return {
    ...medical,
    childSupport: { ...period.rates[region].childSupport, cap: period.childSupportCap },
  };
}

export const LATTER_STAGE_REGIONS = Object.keys(PREFECTURE_NAMES) as Prefecture[];

/** Prefecture options for the region dropdown, analogous to the NHI region options. */
export const LATTER_STAGE_REGION_OPTIONS = Object.entries(PREFECTURE_NAMES).map(
  ([id, displayName]) => ({ id, displayName }),
);
