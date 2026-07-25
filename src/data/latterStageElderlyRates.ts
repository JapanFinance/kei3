// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  LatterStageElderlyRegionDefinition,
  LatterStageElderlyRegionParams,
} from '../types/healthInsurance';

/**
 * 後期高齢者医療制度 premium parameters by prefecture. Unlike NHI's municipal rates, these
 * are uniform across each prefecture (set by its 広域連合 on a two-year cycle), so Tokyo
 * alone covers every NHI municipality the calculator ships. Other prefectures use the
 * custom rate inputs ({@link CUSTOM_LATTER_STAGE_ID}).
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
 * Nationwide statutory 賦課限度額 (combined 医療分 + 子ども・子育て支援金分), set by
 * cabinet order and identical in every prefecture — e.g. FY2026 shows the same 85万/2.1万
 * caps in Tokyo and Osaka despite different rates. Used to cap the custom-rate path,
 * where the user enters only 均等割額 and 所得割率.
 * Sources:
 * - https://www.tokyo-ikiiki.net/seido/1001968/1001975/index.html
 * - https://www.city.higashiosaka.lg.jp/0000003175.html
 */
const STATUTORY_CAP_PERIODS = [
  { effectiveFrom: { year: 2026, month: 3 }, cap: 871000 }, // 850,000 medical + 21,000 child
  { effectiveFrom: { year: 2024, month: 3 }, cap: 800000 },
] as const;

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
