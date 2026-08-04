// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  LatterStageElderlyRegionDefinition,
  LatterStageElderlyRegionParams,
} from '../types/healthInsurance';

/**
 * 後期高齢者医療制度 premium parameters by prefecture. Unlike NHI's municipal parameters,
 * these are uniform across a whole prefecture by law — 高齢者の医療の確保に関する法律
 * 施行令第18条第1項第6号・第12号 require the 所得割率 and 被保険者均等割額 to be 「当該後期
 * 高齢者医療広域連合の全区域にわたって均一」 — and each 広域連合 sets them on a two-year
 * cycle. The data here is therefore far more bounded than the NHI tables: one entry per
 * prefecture, revised every two years. Tokyo covers the 23 wards the NHI data ships; the
 * NHI data also covers Osaka and Nara, whose 後期高齢者 parameters are not here yet.
 * Prefectures without an entry use the custom parameter inputs
 * ({@link CUSTOM_LATTER_STAGE_ID}), and adding them later is cheap.
 * Source: https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18
 */
const allLatterStageRegions: Record<string, LatterStageElderlyRegionDefinition> = {
  Tokyo: {
    regionName: 'Tokyo / 東京都',
    periods: [
      {
        // 令和8・9年度 (FY2026-2027)
        effectiveFrom: { year: 2026, month: 3 },
        params: {
          source: 'https://www.tokyo-ikiiki.net/seido/1001968/1001975/index.html',
          medicalPerCapita: 53300,
          medicalRate: 0.0988,
          medicalCap: 850000,
          childSupportPerCapita: 1300,
          childSupportRate: 0.0026,
          childSupportCap: 21000,
        },
      },
      {
        // 令和6・7年度 (FY2024-2025). The FY2024-only relief measures (8.78% 所得割率 when
        // 賦課のもととなる所得金額 is 58万円以下, and the transitional 賦課限度額 of 73万円
        // for continuing insured) are not modeled: within the supported income years they
        // would affect only the January-March slice of calendar 2025.
        effectiveFrom: { year: 2024, month: 3 },
        params: {
          source:
            'https://www.city.koganei.lg.jp/kenkofukuhsi/koreishafukushi/koukikoureishairyou/hokenryoutb2024.html',
          medicalPerCapita: 47300,
          medicalRate: 0.0967,
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

/**
 * Nationwide statutory 賦課限度額 (医療分 + 子ども・子育て支援金分 combined). The caps are
 * fixed by cabinet order, not by each 広域連合: 施行令第18条第1項第7号 sets 「第一号イの
 * 基礎賦課額は、八十五万円を超えることができない」 and 第13号 sets 「第一号ロの
 * 子ども・子育て支援納付金賦課額は、二万千円を超えることができない」, so the pair is the
 * same in every prefecture. Used to cap the custom-parameter path, where the user enters
 * only the 均等割額 and 所得割率. The FY2024-2025 entry is the same provision's amount
 * before the FY2026 increase (80万円, with no 子ども・子育て支援金分 yet).
 * Sources:
 * - https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18 (高齢者の医療の確保に関する法律施行令第18条)
 * - https://www.city.koganei.lg.jp/kenkofukuhsi/koreishafukushi/koukikoureishairyou/hokenryoutb2024.html
 */
const STATUTORY_CAP_PERIODS = [
  { effectiveFrom: { year: 2026, month: 3 }, cap: 871000 }, // 850,000 medical + 21,000 child
  { effectiveFrom: { year: 2024, month: 3 }, cap: 800000 },
] as const;

if (import.meta.env.DEV) {
  // Validate that the statutory caps are sorted newest-first
  for (let i = 1; i < STATUTORY_CAP_PERIODS.length; i++) {
    const prev = STATUTORY_CAP_PERIODS[i - 1]!.effectiveFrom;
    const curr = STATUTORY_CAP_PERIODS[i]!.effectiveFrom;
    if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
      throw new Error(
        `STATUTORY_CAP_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
      );
    }
  }
}

/** The combined statutory 賦課限度額 in effect for the given calendar month. */
export function getLatterStageStatutoryCap(year: number, month: number): number {
  for (const period of STATUTORY_CAP_PERIODS) {
    const { effectiveFrom } = period;
    if (
      year > effectiveFrom.year ||
      (year === effectiveFrom.year && month >= effectiveFrom.month)
    ) {
      return period.cap;
    }
  }
  return STATUTORY_CAP_PERIODS[STATUTORY_CAP_PERIODS.length - 1]!.cap;
}
