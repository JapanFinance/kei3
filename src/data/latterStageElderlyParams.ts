// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  LatterStageElderlyRegionDefinition,
  LatterStageElderlyRegionParams,
} from '../types/healthInsurance';

/**
 * 後期高齢者医療制度 premium parameters for all 47 prefectures.
 *
 * Unlike NHI's municipal parameters, these are uniform across a whole prefecture by law —
 * 高齢者の医療の確保に関する法律施行令第18条第1項第6号・第12号 require the 所得割率 and
 * 被保険者均等割額 to be 「当該後期高齢者医療広域連合の全区域にわたって均一」 — and each
 * 広域連合 sets them for two fiscal years at a time. Full national coverage is therefore
 * only 47 entries per rate cycle, which is why every prefecture is shipped rather than
 * asking anyone to enter rates by hand.
 *
 * Both rate periods come from one MHLW publication, which tabulates every 広域連合:
 * 「後期高齢者医療制度の令和8・9年度の保険料率について」 (令和8年4月10日) — page 2 gives the
 * 医療分 均等割額/所得割率 for both 令和6・7年度 and 令和8・9年度, page 3 the
 * 子ども・子育て支援納付金分 for 令和8年度.
 * https://www.mhlw.go.jp/content/12403500/001689077.pdf
 *
 * The 賦課限度額 are national and set by cabinet order, not by the 広域連合:
 * 施行令第18条第1項第7号 (基礎賦課額 85万円) and 第13号 (子ども・子育て支援納付金賦課額
 * 2.1万円); before FY2026 the 基礎賦課額 limit was 80万円 and there was no 子ども分.
 * https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18
 *
 * Rates shown are the uniform prefecture-wide ones. A few 広域連合 also set reduced rates
 * for designated remote areas (特定地域, 施行令第18条第2項); those are not modeled.
 */
const allLatterStageRegions: Record<string, LatterStageElderlyRegionDefinition> = {
  Hokkaido: {
    regionName: 'Hokkaido / 北海道',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 59963,
          medicalRate: 0.1161,
          medicalCap: 850000,
          childSupportPerCapita: 1364,
          childSupportRate: 0.0028,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 52953,
          medicalRate: 0.1179,
          medicalCap: 800000,
        },
      },
    ],
  },
  Aomori: {
    regionName: 'Aomori / 青森県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 50500,
          medicalRate: 0.09,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.002,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 46800,
          medicalRate: 0.099,
          medicalCap: 800000,
        },
      },
    ],
  },
  Iwate: {
    regionName: 'Iwate / 岩手県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 48800,
          medicalRate: 0.085,
          medicalCap: 850000,
          childSupportPerCapita: 1366,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 43800,
          medicalRate: 0.0853,
          medicalCap: 800000,
        },
      },
    ],
  },
  Miyagi: {
    regionName: 'Miyagi / 宮城県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52200,
          medicalRate: 0.0912,
          medicalCap: 850000,
          childSupportPerCapita: 1370,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 47400,
          medicalRate: 0.0928,
          medicalCap: 800000,
        },
      },
    ],
  },
  Akita: {
    regionName: 'Akita / 秋田県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55996,
          medicalRate: 0.0973,
          medicalCap: 850000,
          childSupportPerCapita: 1350,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 45260,
          medicalRate: 0.0902,
          medicalCap: 800000,
        },
      },
    ],
  },
  Yamagata: {
    regionName: 'Yamagata / 山形県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52500,
          medicalRate: 0.0963,
          medicalCap: 850000,
          childSupportPerCapita: 1373,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 47600,
          medicalRate: 0.0943,
          medicalCap: 800000,
        },
      },
    ],
  },
  Fukushima: {
    regionName: 'Fukushima / 福島県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 49000,
          medicalRate: 0.0924,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 45900,
          medicalRate: 0.0898,
          medicalCap: 800000,
        },
      },
    ],
  },
  Ibaraki: {
    regionName: 'Ibaraki / 茨城県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 49500,
          medicalRate: 0.0932,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0028,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 47500,
          medicalRate: 0.0966,
          medicalCap: 800000,
        },
      },
    ],
  },
  Tochigi: {
    regionName: 'Tochigi / 栃木県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 49100,
          medicalRate: 0.09,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 45600,
          medicalRate: 0.0884,
          medicalCap: 800000,
        },
      },
    ],
  },
  Gunma: {
    regionName: 'Gunma / 群馬県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 54600,
          medicalRate: 0.0978,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 49100,
          medicalRate: 0.1007,
          medicalCap: 800000,
        },
      },
    ],
  },
  Saitama: {
    regionName: 'Saitama / 埼玉県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52370,
          medicalRate: 0.0949,
          medicalCap: 850000,
          childSupportPerCapita: 1330,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 45930,
          medicalRate: 0.0903,
          medicalCap: 800000,
        },
      },
    ],
  },
  Chiba: {
    regionName: 'Chiba / 千葉県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 51000,
          medicalRate: 0.094,
          medicalCap: 850000,
          childSupportPerCapita: 1310,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 43800,
          medicalRate: 0.0911,
          medicalCap: 800000,
        },
      },
    ],
  },
  Tokyo: {
    regionName: 'Tokyo / 東京都',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 53300,
          medicalRate: 0.0988,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 47300,
          medicalRate: 0.0967,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kanagawa: {
    regionName: 'Kanagawa / 神奈川県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52531,
          medicalRate: 0.103,
          medicalCap: 850000,
          childSupportPerCapita: 1330,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 45900,
          medicalRate: 0.1008,
          medicalCap: 800000,
        },
      },
    ],
  },
  Niigata: {
    regionName: 'Niigata / 新潟県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 49200,
          medicalRate: 0.0861,
          medicalCap: 850000,
          childSupportPerCapita: 1354,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 44200,
          medicalRate: 0.0861,
          medicalCap: 800000,
        },
      },
    ],
  },
  Toyama: {
    regionName: 'Toyama / 富山県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55800,
          medicalRate: 0.1019,
          medicalCap: 850000,
          childSupportPerCapita: 1373,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 46800,
          medicalRate: 0.0882,
          medicalCap: 800000,
        },
      },
    ],
  },
  Ishikawa: {
    regionName: 'Ishikawa / 石川県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 57300,
          medicalRate: 0.1114,
          medicalCap: 850000,
          childSupportPerCapita: 1360,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 50760,
          medicalRate: 0.0988,
          medicalCap: 800000,
        },
      },
    ],
  },
  Fukui: {
    regionName: 'Fukui / 福井県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 54140,
          medicalRate: 0.1083,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 49700,
          medicalRate: 0.097,
          medicalCap: 800000,
        },
      },
    ],
  },
  Yamanashi: {
    regionName: 'Yamanashi / 山梨県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52610,
          medicalRate: 0.0944,
          medicalCap: 850000,
          childSupportPerCapita: 1330,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 50770,
          medicalRate: 0.1111,
          medicalCap: 800000,
        },
      },
    ],
  },
  Nagano: {
    regionName: 'Nagano / 長野県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 48827,
          medicalRate: 0.088,
          medicalCap: 850000,
          childSupportPerCapita: 1339,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 44365,
          medicalRate: 0.0945,
          medicalCap: 800000,
        },
      },
    ],
  },
  Gifu: {
    regionName: 'Gifu / 岐阜県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55385,
          medicalRate: 0.0971,
          medicalCap: 850000,
          childSupportPerCapita: 1374,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 49412,
          medicalRate: 0.0956,
          medicalCap: 800000,
        },
      },
    ],
  },
  Shizuoka: {
    regionName: 'Shizuoka / 静岡県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 51100,
          medicalRate: 0.0935,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 47000,
          medicalRate: 0.0949,
          medicalCap: 800000,
        },
      },
    ],
  },
  Aichi: {
    regionName: 'Aichi / 愛知県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 56130,
          medicalRate: 0.1048,
          medicalCap: 850000,
          childSupportPerCapita: 1362,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 53438,
          medicalRate: 0.1113,
          medicalCap: 800000,
        },
      },
    ],
  },
  Mie: {
    regionName: 'Mie / 三重県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 54843,
          medicalRate: 0.0953,
          medicalCap: 850000,
          childSupportPerCapita: 1370,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 48903,
          medicalRate: 0.0982,
          medicalCap: 800000,
        },
      },
    ],
  },
  Shiga: {
    regionName: 'Shiga / 滋賀県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55380,
          medicalRate: 0.1013,
          medicalCap: 850000,
          childSupportPerCapita: 1340,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 48604,
          medicalRate: 0.0956,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kyoto: {
    regionName: 'Kyoto / 京都府',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 59590,
          medicalRate: 0.1015,
          medicalCap: 850000,
          childSupportPerCapita: 1350,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 56340,
          medicalRate: 0.1095,
          medicalCap: 800000,
        },
      },
    ],
  },
  Osaka: {
    regionName: 'Osaka / 大阪府',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 64931,
          medicalRate: 0.1151,
          medicalCap: 850000,
          childSupportPerCapita: 1373,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 57172,
          medicalRate: 0.1175,
          medicalCap: 800000,
        },
      },
    ],
  },
  Hyogo: {
    regionName: 'Hyogo / 兵庫県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 58427,
          medicalRate: 0.1077,
          medicalCap: 850000,
          childSupportPerCapita: 1351,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 52791,
          medicalRate: 0.1124,
          medicalCap: 800000,
        },
      },
    ],
  },
  Nara: {
    regionName: 'Nara / 奈良県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 57100,
          medicalRate: 0.1063,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 51500,
          medicalRate: 0.1055,
          medicalCap: 800000,
        },
      },
    ],
  },
  Wakayama: {
    regionName: 'Wakayama / 和歌山県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 58748,
          medicalRate: 0.1036,
          medicalCap: 850000,
          childSupportPerCapita: 1385,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 54428,
          medicalRate: 0.1104,
          medicalCap: 800000,
        },
      },
    ],
  },
  Tottori: {
    regionName: 'Tottori / 鳥取県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 52138,
          medicalRate: 0.1064,
          medicalCap: 850000,
          childSupportPerCapita: 1363,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 52138,
          medicalRate: 0.1064,
          medicalCap: 800000,
        },
      },
    ],
  },
  Shimane: {
    regionName: 'Shimane / 島根県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 57170,
          medicalRate: 0.1002,
          medicalCap: 850000,
          childSupportPerCapita: 1370,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 50160,
          medicalRate: 0.1008,
          medicalCap: 800000,
        },
      },
    ],
  },
  Okayama: {
    regionName: 'Okayama / 岡山県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 60100,
          medicalRate: 0.1088,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 50200,
          medicalRate: 0.1049,
          medicalCap: 800000,
        },
      },
    ],
  },
  Hiroshima: {
    regionName: 'Hiroshima / 広島県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55090,
          medicalRate: 0.0993,
          medicalCap: 850000,
          childSupportPerCapita: 1337,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 49621,
          medicalRate: 0.0963,
          medicalCap: 800000,
        },
      },
    ],
  },
  Yamaguchi: {
    regionName: 'Yamaguchi / 山口県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 63513,
          medicalRate: 0.1136,
          medicalCap: 850000,
          childSupportPerCapita: 1354,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 57012,
          medicalRate: 0.1152,
          medicalCap: 800000,
        },
      },
    ],
  },
  Tokushima: {
    regionName: 'Tokushima / 徳島県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 60976,
          medicalRate: 0.1091,
          medicalCap: 850000,
          childSupportPerCapita: 1356,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 56311,
          medicalRate: 0.1055,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kagawa: {
    regionName: 'Kagawa / 香川県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 58000,
          medicalRate: 0.0993,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 54000,
          medicalRate: 0.1041,
          medicalCap: 800000,
        },
      },
    ],
  },
  Ehime: {
    regionName: 'Ehime / 愛媛県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 55630,
          medicalRate: 0.0979,
          medicalCap: 850000,
          childSupportPerCapita: 1320,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 51930,
          medicalRate: 0.1016,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kochi: {
    regionName: 'Kochi / 高知県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 60400,
          medicalRate: 0.1031,
          medicalCap: 850000,
          childSupportPerCapita: 1393,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 56000,
          medicalRate: 0.1078,
          medicalCap: 800000,
        },
      },
    ],
  },
  Fukuoka: {
    regionName: 'Fukuoka / 福岡県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 66340,
          medicalRate: 0.117,
          medicalCap: 850000,
          childSupportPerCapita: 1339,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 60004,
          medicalRate: 0.1183,
          medicalCap: 800000,
        },
      },
    ],
  },
  Saga: {
    regionName: 'Saga / 佐賀県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 68700,
          medicalRate: 0.1179,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 57100,
          medicalRate: 0.1109,
          medicalCap: 800000,
        },
      },
    ],
  },
  Nagasaki: {
    regionName: 'Nagasaki / 長崎県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 56200,
          medicalRate: 0.0959,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 52400,
          medicalRate: 0.1031,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kumamoto: {
    regionName: 'Kumamoto / 熊本県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 63000,
          medicalRate: 0.1106,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 58000,
          medicalRate: 0.1098,
          medicalCap: 800000,
        },
      },
    ],
  },
  Oita: {
    regionName: 'Oita / 大分県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 64200,
          medicalRate: 0.1125,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0024,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 59200,
          medicalRate: 0.1155,
          medicalCap: 800000,
        },
      },
    ],
  },
  Miyazaki: {
    regionName: 'Miyazaki / 宮崎県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 56300,
          medicalRate: 0.1008,
          medicalCap: 850000,
          childSupportPerCapita: 1356,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 51700,
          medicalRate: 0.1008,
          medicalCap: 800000,
        },
      },
    ],
  },
  Kagoshima: {
    regionName: 'Kagoshima / 鹿児島県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 69800,
          medicalRate: 0.1172,
          medicalCap: 850000,
          childSupportPerCapita: 1400,
          childSupportRate: 0.0025,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 59900,
          medicalRate: 0.1172,
          medicalCap: 800000,
        },
      },
    ],
  },
  Okinawa: {
    regionName: 'Okinawa / 沖縄県',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          medicalPerCapita: 61000,
          medicalRate: 0.1081,
          medicalCap: 850000,
          childSupportPerCapita: 1290,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025)
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          medicalPerCapita: 56400,
          medicalRate: 0.116,
          medicalCap: 800000,
        },
      },
    ],
  },
};

if (import.meta.env.DEV) {
  // Validate that each prefecture's rate periods are sorted newest-first
  for (const [regionKey, region] of Object.entries(allLatterStageRegions)) {
    for (let i = 1; i < region.periods.length; i++) {
      const prev = region.periods[i - 1]!.effectiveFrom;
      const curr = region.periods[i]!.effectiveFrom;
      if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
        throw new Error(
          `allLatterStageRegions["${regionKey}"].periods must be sorted newest-first, ` +
            `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
        );
      }
    }
  }
}

/**
 * Returns the 後期高齢者医療 parameters in effect for the given calendar month, or
 * undefined for an unknown prefecture. Same newest-first lookup as getNHIParamsForMonth.
 */
export function getLatterStageParamsForMonth(
  region: string,
  year: number,
  month: number,
): LatterStageElderlyRegionParams | undefined {
  const regionDef = allLatterStageRegions[region];
  if (!regionDef || regionDef.periods.length === 0) {
    return undefined;
  }

  for (const period of regionDef.periods) {
    const { effectiveFrom } = period;
    if (
      year > effectiveFrom.year ||
      (year === effectiveFrom.year && month >= effectiveFrom.month)
    ) {
      return { regionName: regionDef.regionName, ...period.params };
    }
  }
  const oldest = regionDef.periods[regionDef.periods.length - 1]!;
  return { regionName: regionDef.regionName, ...oldest.params };
}

export const LATTER_STAGE_REGIONS = Object.keys(allLatterStageRegions);

/** Prefecture options for the region dropdown, analogous to the NHI region options. */
export const LATTER_STAGE_REGION_OPTIONS = Object.entries(allLatterStageRegions).map(
  ([regionKey, def]) => ({
    id: regionKey,
    displayName: def.regionName,
  }),
);
