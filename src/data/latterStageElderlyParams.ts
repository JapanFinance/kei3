// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LatterStageElderlyRegionParams } from '../types/healthInsurance';

/**
 * Display names for the 47 prefectures, each of which is one 後期高齢者医療広域連合.
 * Period-independent, so they live apart from the rates.
 */
const PREFECTURE_NAMES: Record<string, string> = {
  Hokkaido: 'Hokkaido / 北海道',
  Aomori: 'Aomori / 青森県',
  Iwate: 'Iwate / 岩手県',
  Miyagi: 'Miyagi / 宮城県',
  Akita: 'Akita / 秋田県',
  Yamagata: 'Yamagata / 山形県',
  Fukushima: 'Fukushima / 福島県',
  Ibaraki: 'Ibaraki / 茨城県',
  Tochigi: 'Tochigi / 栃木県',
  Gunma: 'Gunma / 群馬県',
  Saitama: 'Saitama / 埼玉県',
  Chiba: 'Chiba / 千葉県',
  Tokyo: 'Tokyo / 東京都',
  Kanagawa: 'Kanagawa / 神奈川県',
  Niigata: 'Niigata / 新潟県',
  Toyama: 'Toyama / 富山県',
  Ishikawa: 'Ishikawa / 石川県',
  Fukui: 'Fukui / 福井県',
  Yamanashi: 'Yamanashi / 山梨県',
  Nagano: 'Nagano / 長野県',
  Gifu: 'Gifu / 岐阜県',
  Shizuoka: 'Shizuoka / 静岡県',
  Aichi: 'Aichi / 愛知県',
  Mie: 'Mie / 三重県',
  Shiga: 'Shiga / 滋賀県',
  Kyoto: 'Kyoto / 京都府',
  Osaka: 'Osaka / 大阪府',
  Hyogo: 'Hyogo / 兵庫県',
  Nara: 'Nara / 奈良県',
  Wakayama: 'Wakayama / 和歌山県',
  Tottori: 'Tottori / 鳥取県',
  Shimane: 'Shimane / 島根県',
  Okayama: 'Okayama / 岡山県',
  Hiroshima: 'Hiroshima / 広島県',
  Yamaguchi: 'Yamaguchi / 山口県',
  Tokushima: 'Tokushima / 徳島県',
  Kagawa: 'Kagawa / 香川県',
  Ehime: 'Ehime / 愛媛県',
  Kochi: 'Kochi / 高知県',
  Fukuoka: 'Fukuoka / 福岡県',
  Saga: 'Saga / 佐賀県',
  Nagasaki: 'Nagasaki / 長崎県',
  Kumamoto: 'Kumamoto / 熊本県',
  Oita: 'Oita / 大分県',
  Miyazaki: 'Miyazaki / 宮崎県',
  Kagoshima: 'Kagoshima / 鹿児島県',
  Okinawa: 'Okinawa / 沖縄県',
};

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
 * `source` is likewise a per-cycle fact: MHLW publishes one table covering every 広域連合 when
 * the rates are set. The FY2026 publication tabulates both cycles shipped here — the 令和8・9年度
 * rates and the 令和6・7年度 comparison column — so both periods cite it; a future cycle adds a
 * period with its own URL.
 *
 * Rates are the uniform prefecture-wide ones. A few 広域連合 also set reduced rates for
 * designated remote areas (特定地域, 施行令第18条第2項); those are not modeled.
 */
interface LatterStagePeriod {
  /** Month is 0-indexed; rates take effect in April (month 3) of the cycle's first year. */
  effectiveFrom: { year: number; month: number };
  /** 医療分賦課限度額 — national. */
  medicalCap: number;
  /** 子ども・子育て支援納付金分賦課限度額 — national; absent before FY2026. */
  childSupportCap?: number;
  /** The MHLW publication listing every 広域連合's rates for this cycle. */
  source: string;
  /** 均等割額 and 所得割率 by prefecture: 医療分, plus 子ども分 where the levy exists. */
  rates: Record<
    string,
    { perCapita: number; rate: number; childPerCapita?: number; childRate?: number }
  >;
}

/** 「後期高齢者医療制度の令和8・9年度の保険料率について」(令和8年4月10日) — all 47 広域連合. */
const MHLW_FY2026_RATE_TABLE = 'https://www.mhlw.go.jp/content/12403500/001689077.pdf';

/** Rate periods, newest first. */
const LATTER_STAGE_PERIODS: LatterStagePeriod[] = [
  {
    // 令和8・9年度 (FY2026-2027)
    effectiveFrom: { year: 2026, month: 3 },
    medicalCap: 850_000,
    childSupportCap: 21_000,
    source: MHLW_FY2026_RATE_TABLE,
    rates: {
      Hokkaido: { perCapita: 59963, rate: 0.1161, childPerCapita: 1364, childRate: 0.0028 },
      Aomori: { perCapita: 50500, rate: 0.09, childPerCapita: 1300, childRate: 0.002 },
      Iwate: { perCapita: 48800, rate: 0.085, childPerCapita: 1366, childRate: 0.0026 },
      Miyagi: { perCapita: 52200, rate: 0.0912, childPerCapita: 1370, childRate: 0.0025 },
      Akita: { perCapita: 55996, rate: 0.0973, childPerCapita: 1350, childRate: 0.0025 },
      Yamagata: { perCapita: 52500, rate: 0.0963, childPerCapita: 1373, childRate: 0.0025 },
      Fukushima: { perCapita: 49000, rate: 0.0924, childPerCapita: 1400, childRate: 0.0025 },
      Ibaraki: { perCapita: 49500, rate: 0.0932, childPerCapita: 1400, childRate: 0.0028 },
      Tochigi: { perCapita: 49100, rate: 0.09, childPerCapita: 1300, childRate: 0.0025 },
      Gunma: { perCapita: 54600, rate: 0.0978, childPerCapita: 1400, childRate: 0.0025 },
      Saitama: { perCapita: 52370, rate: 0.0949, childPerCapita: 1330, childRate: 0.0025 },
      Chiba: { perCapita: 51000, rate: 0.094, childPerCapita: 1310, childRate: 0.0025 },
      Tokyo: { perCapita: 53300, rate: 0.0988, childPerCapita: 1300, childRate: 0.0026 },
      Kanagawa: { perCapita: 52531, rate: 0.103, childPerCapita: 1330, childRate: 0.0025 },
      Niigata: { perCapita: 49200, rate: 0.0861, childPerCapita: 1354, childRate: 0.0026 },
      Toyama: { perCapita: 55800, rate: 0.1019, childPerCapita: 1373, childRate: 0.0026 },
      Ishikawa: { perCapita: 57300, rate: 0.1114, childPerCapita: 1360, childRate: 0.0024 },
      Fukui: { perCapita: 54140, rate: 0.1083, childPerCapita: 1300, childRate: 0.0026 },
      Yamanashi: { perCapita: 52610, rate: 0.0944, childPerCapita: 1330, childRate: 0.0025 },
      Nagano: { perCapita: 48827, rate: 0.088, childPerCapita: 1339, childRate: 0.0025 },
      Gifu: { perCapita: 55385, rate: 0.0971, childPerCapita: 1374, childRate: 0.0025 },
      Shizuoka: { perCapita: 51100, rate: 0.0935, childPerCapita: 1400, childRate: 0.0025 },
      Aichi: { perCapita: 56130, rate: 0.1048, childPerCapita: 1362, childRate: 0.0025 },
      Mie: { perCapita: 54843, rate: 0.0953, childPerCapita: 1370, childRate: 0.0025 },
      Shiga: { perCapita: 55380, rate: 0.1013, childPerCapita: 1340, childRate: 0.0025 },
      Kyoto: { perCapita: 59590, rate: 0.1015, childPerCapita: 1350, childRate: 0.0025 },
      Osaka: { perCapita: 64931, rate: 0.1151, childPerCapita: 1373, childRate: 0.0024 },
      Hyogo: { perCapita: 58427, rate: 0.1077, childPerCapita: 1351, childRate: 0.0024 },
      Nara: { perCapita: 57100, rate: 0.1063, childPerCapita: 1400, childRate: 0.0025 },
      Wakayama: { perCapita: 58748, rate: 0.1036, childPerCapita: 1385, childRate: 0.0025 },
      Tottori: { perCapita: 52138, rate: 0.1064, childPerCapita: 1363, childRate: 0.0025 },
      Shimane: { perCapita: 57170, rate: 0.1002, childPerCapita: 1370, childRate: 0.0026 },
      Okayama: { perCapita: 60100, rate: 0.1088, childPerCapita: 1400, childRate: 0.0025 },
      Hiroshima: { perCapita: 55090, rate: 0.0993, childPerCapita: 1337, childRate: 0.0025 },
      Yamaguchi: { perCapita: 63513, rate: 0.1136, childPerCapita: 1354, childRate: 0.0024 },
      Tokushima: { perCapita: 60976, rate: 0.1091, childPerCapita: 1356, childRate: 0.0025 },
      Kagawa: { perCapita: 58000, rate: 0.0993, childPerCapita: 1300, childRate: 0.0025 },
      Ehime: { perCapita: 55630, rate: 0.0979, childPerCapita: 1320, childRate: 0.0025 },
      Kochi: { perCapita: 60400, rate: 0.1031, childPerCapita: 1393, childRate: 0.0024 },
      Fukuoka: { perCapita: 66340, rate: 0.117, childPerCapita: 1339, childRate: 0.0025 },
      Saga: { perCapita: 68700, rate: 0.1179, childPerCapita: 1400, childRate: 0.0024 },
      Nagasaki: { perCapita: 56200, rate: 0.0959, childPerCapita: 1300, childRate: 0.0025 },
      Kumamoto: { perCapita: 63000, rate: 0.1106, childPerCapita: 1400, childRate: 0.0025 },
      Oita: { perCapita: 64200, rate: 0.1125, childPerCapita: 1400, childRate: 0.0024 },
      Miyazaki: { perCapita: 56300, rate: 0.1008, childPerCapita: 1356, childRate: 0.0025 },
      Kagoshima: { perCapita: 69800, rate: 0.1172, childPerCapita: 1400, childRate: 0.0025 },
      Okinawa: { perCapita: 61000, rate: 0.1081, childPerCapita: 1290, childRate: 0.0026 },
    },
  },
  {
    // 令和6・7年度 (FY2024-2025), from the FY2026 publication's comparison column. Its
    // FY2024-only relief measures (a reduced 所得割率 for lower incomes, and a transitional
    // 賦課限度額 for continuing insured) are not modeled: within the supported income years
    // they would affect only the January-March slice of calendar 2025.
    effectiveFrom: { year: 2024, month: 3 },
    medicalCap: 800_000,
    source: MHLW_FY2026_RATE_TABLE,
    rates: {
      Hokkaido: { perCapita: 52953, rate: 0.1179 },
      Aomori: { perCapita: 46800, rate: 0.099 },
      Iwate: { perCapita: 43800, rate: 0.0853 },
      Miyagi: { perCapita: 47400, rate: 0.0928 },
      Akita: { perCapita: 45260, rate: 0.0902 },
      Yamagata: { perCapita: 47600, rate: 0.0943 },
      Fukushima: { perCapita: 45900, rate: 0.0898 },
      Ibaraki: { perCapita: 47500, rate: 0.0966 },
      Tochigi: { perCapita: 45600, rate: 0.0884 },
      Gunma: { perCapita: 49100, rate: 0.1007 },
      Saitama: { perCapita: 45930, rate: 0.0903 },
      Chiba: { perCapita: 43800, rate: 0.0911 },
      Tokyo: { perCapita: 47300, rate: 0.0967 },
      Kanagawa: { perCapita: 45900, rate: 0.1008 },
      Niigata: { perCapita: 44200, rate: 0.0861 },
      Toyama: { perCapita: 46800, rate: 0.0882 },
      Ishikawa: { perCapita: 50760, rate: 0.0988 },
      Fukui: { perCapita: 49700, rate: 0.097 },
      Yamanashi: { perCapita: 50770, rate: 0.1111 },
      Nagano: { perCapita: 44365, rate: 0.0945 },
      Gifu: { perCapita: 49412, rate: 0.0956 },
      Shizuoka: { perCapita: 47000, rate: 0.0949 },
      Aichi: { perCapita: 53438, rate: 0.1113 },
      Mie: { perCapita: 48903, rate: 0.0982 },
      Shiga: { perCapita: 48604, rate: 0.0956 },
      Kyoto: { perCapita: 56340, rate: 0.1095 },
      Osaka: { perCapita: 57172, rate: 0.1175 },
      Hyogo: { perCapita: 52791, rate: 0.1124 },
      Nara: { perCapita: 51500, rate: 0.1055 },
      Wakayama: { perCapita: 54428, rate: 0.1104 },
      Tottori: { perCapita: 52138, rate: 0.1064 },
      Shimane: { perCapita: 50160, rate: 0.1008 },
      Okayama: { perCapita: 50200, rate: 0.1049 },
      Hiroshima: { perCapita: 49621, rate: 0.0963 },
      Yamaguchi: { perCapita: 57012, rate: 0.1152 },
      Tokushima: { perCapita: 56311, rate: 0.1055 },
      Kagawa: { perCapita: 54000, rate: 0.1041 },
      Ehime: { perCapita: 51930, rate: 0.1016 },
      Kochi: { perCapita: 56000, rate: 0.1078 },
      Fukuoka: { perCapita: 60004, rate: 0.1183 },
      Saga: { perCapita: 57100, rate: 0.1109 },
      Nagasaki: { perCapita: 52400, rate: 0.1031 },
      Kumamoto: { perCapita: 58000, rate: 0.1098 },
      Oita: { perCapita: 59200, rate: 0.1155 },
      Miyazaki: { perCapita: 51700, rate: 0.1008 },
      Kagoshima: { perCapita: 59900, rate: 0.1172 },
      Okinawa: { perCapita: 56400, rate: 0.116 },
    },
  },
];

if (import.meta.env.DEV) {
  // Validate that the periods are sorted newest-first and cover every prefecture
  for (let i = 0; i < LATTER_STAGE_PERIODS.length; i++) {
    const period = LATTER_STAGE_PERIODS[i]!;
    const missing = Object.keys(PREFECTURE_NAMES).filter(key => !period.rates[key]);
    if (missing.length > 0) {
      throw new Error(`LATTER_STAGE_PERIODS[${i}] is missing rates for: ${missing.join(', ')}`);
    }
    if (i === 0) continue;
    const prev = LATTER_STAGE_PERIODS[i - 1]!.effectiveFrom;
    const curr = period.effectiveFrom;
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
 * for an unknown prefecture. Composes the period's national caps and source with the
 * prefecture's own rates. Same newest-first lookup as getNHIParamsForMonth.
 */
export function getLatterStageParamsForMonth(
  region: string,
  year: number,
  month: number,
): LatterStageElderlyRegionParams | undefined {
  const regionName = PREFECTURE_NAMES[region];
  if (!regionName) {
    return undefined;
  }

  const period =
    LATTER_STAGE_PERIODS.find(
      p =>
        year > p.effectiveFrom.year ||
        (year === p.effectiveFrom.year && month >= p.effectiveFrom.month),
    ) ?? LATTER_STAGE_PERIODS[LATTER_STAGE_PERIODS.length - 1]!;

  const rates = period.rates[region]!;
  return {
    regionName,
    source: period.source,
    medicalPerCapita: rates.perCapita,
    medicalRate: rates.rate,
    medicalCap: period.medicalCap,
    ...(rates.childPerCapita !== undefined && { childSupportPerCapita: rates.childPerCapita }),
    ...(rates.childRate !== undefined && { childSupportRate: rates.childRate }),
    ...(period.childSupportCap !== undefined && { childSupportCap: period.childSupportCap }),
  };
}

export const LATTER_STAGE_REGIONS = Object.keys(PREFECTURE_NAMES);

/** Prefecture options for the region dropdown, analogous to the NHI region options. */
export const LATTER_STAGE_REGION_OPTIONS = Object.entries(PREFECTURE_NAMES).map(
  ([id, displayName]) => ({ id, displayName }),
);
