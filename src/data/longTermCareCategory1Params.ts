// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { prefectureForRegion, type Prefecture } from './prefectures';

/**
 * Parameters for estimating the 介護保険 第1号被保険者 (65+) premium: the national-standard
 * income-tier (所得段階) schedule plus MHLW-published average 基準額.
 *
 * Unlike the 後期高齢者医療 rates, which are prefecture-uniform by law, each of the ~1,573
 * insurers (市町村・広域連合) sets its own monthly 基準額 for a three-year 計画期間 and may
 * depart from the standard tier schedule (施行令第39条 lets it change tier counts, multipliers,
 * and 合計所得金額 boundaries). The 第9期 基準額 spread is 3,374円〜9,249円 against a national
 * weighted average of 6,225円, so this module can only power an explicitly-labeled estimate —
 * the weighted-average 基準額 of the selected prefecture (or the national one when the region
 * carries no prefecture) times the national-standard multiplier.
 *
 * The standard schedule is 介護保険法施行令第38条 (the 法第129条第2項 basis for municipal
 * ordinances), read together with the MHLW schedule diagram ({@link LONG_TERM_CARE_TIER_SOURCES}):
 * - 第1項: the 13 段階 and their 標準割合 — tiers 1-3 are 0.455 / 0.685 / 0.69 before reduction.
 * - 第11項〜第13項: the 減額賦課 that public funds finance lets tiers 1-3 be reduced by up to
 *   0.17 / 0.20 / 0.005, giving the 公費軽減後 rates 0.285 / 0.485 / 0.685 shipped here, which
 *   the MHLW diagram presents as the standard final multipliers.
 * - 第6項〜第9項: the 合計所得金額 boundaries for tiers 6-8 are 厚生労働大臣-set amounts
 *   (120万 / 210万 / 320万 per the MHLW diagram), and tiers 9-12 add 100万〜400万 to the
 *   tier-8 amount, giving 420万 / 520万 / 620万 / 720万.
 *
 * The 年金収入等 boundary of tiers 1 and 4 tracks the full 老齢基礎年金 and now moves within a
 * 計画期間, which is why the periods here are per fiscal year: 80万円 (FY2024, the level set with
 * the 平成17年度 schedule), 80万9千円 (FY2025), 82万6千500円 (FY2026). Each value was read from
 * the point-in-time e-Gov text of 第38条第1項第1号ハ・第4号イ for that fiscal year.
 *
 * 基準額 figures come from the MHLW 第9期 publication ({@link LONG_TERM_CARE_BASE_SOURCES}),
 * attachment 「（第9期）各都道府県平均保険料基準額一覧」: one row per prefecture with the
 * 第9期保険料基準額（月額）in its fourth column, here rounded to whole yen — matching how the
 * accompanying 集計結果 PDF prints the same table (its page 2 lists 北海道 5,738円, 青森 6,715円,
 * …). The national 6,225円 is the same file's 全国1,573保険者 weighted average. Osaka (7,486円,
 * the highest) and Yamaguchi (5,568円, the lowest) were cross-checked against a second publisher
 * (gemmed.ghc-j.com) to confirm the column was read correctly.
 *
 * For whoever adds the 第10期 period in April 2027: MHLW publishes the next
 * 各都道府県平均保険料基準額一覧 around May 2027 (the 第9期 one appeared 2024-05-14), and the
 * 年金収入等 boundary should be re-read from 施行令第38条第1項第1号ハ each April — it is now
 * revised with pension indexation, announced in 社会保障審議会介護保険部会 materials ahead of
 * promulgation.
 */
export interface LongTermCareStandardTierTable {
  /**
   * 年金収入等 — 公的年金等の収入金額 plus 合計所得金額 with the 公的年金等に係る雑所得 removed
   * (施行令第38条第1項第1号ハ: 「公的年金等の収入金額及び…合計所得金額から所得税法第三十五条
   * 第二項第一号に掲げる金額を控除して得た額の合計額」) — at or below this lands in tier 1 when
   * the whole household is 住民税非課税, or tier 4 when only the person is untaxed.
   */
  tier1PensionIncomeEtcMax: number;
  /** 年金収入等 at or below this (and above the tier-1 bound) lands in tier 2; beyond is tier 3. */
  tier2PensionIncomeEtcMax: number;
  /**
   * Exclusive 合計所得金額 upper bounds of tiers 6-12 for a 住民税課税 person (未満 per the
   * statute); at or above the last bound is tier 13.
   */
  taxedIncomeBracketUpperBounds: readonly number[];
  /** Multiplier applied to the annual 基準額, indexed by tier − 1; tiers 1-3 are 公費軽減後. */
  multipliers: readonly number[];
}

/** 施行令第38条第1項 multipliers with the 第11項〜第13項 reductions applied to tiers 1-3. */
const STANDARD_TIER_MULTIPLIERS: readonly number[] = [
  0.285, 0.485, 0.685, 0.9, 1.0, 1.2, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.4,
];

/** Tier 6-12 合計所得金額 bounds: 厚生労働大臣-set 120万/210万/320万, then +100万〜400万 (第9項). */
const TAXED_INCOME_BRACKET_UPPER_BOUNDS: readonly number[] = [
  1_200_000, 2_100_000, 3_200_000, 4_200_000, 5_200_000, 6_200_000, 7_200_000,
];

/** Monthly 基準額 averages of one 計画期間: the national figure and one per prefecture. */
interface LongTermCareMonthlyBases {
  national: number;
  prefecture: Record<Prefecture, number>;
}

/** 第9期 (FY2024-2026) weighted-average monthly 基準額, rounded to whole yen. */
const DAI9KI_MONTHLY_BASES: LongTermCareMonthlyBases = {
  national: 6_225,
  prefecture: {
    Hokkaido: 5_738,
    Aomori: 6_715,
    Iwate: 6_093,
    Miyagi: 6_098,
    Akita: 6_565,
    Yamagata: 6_058,
    Fukushima: 6_340,
    Ibaraki: 5_609,
    Tochigi: 5_773,
    Gunma: 6_203,
    Saitama: 5_922,
    Chiba: 5_885,
    Tokyo: 6_320,
    Kanagawa: 6_340,
    Niigata: 6_412,
    Toyama: 6_327,
    Ishikawa: 6_354,
    Fukui: 6_223,
    Yamanashi: 5_744,
    Nagano: 5_647,
    Gifu: 6_094,
    Shizuoka: 5_810,
    Aichi: 5_957,
    Mie: 6_295,
    Shiga: 5_979,
    Kyoto: 6_608,
    Osaka: 7_486,
    Hyogo: 6_344,
    Nara: 6_034,
    Wakayama: 6_539,
    Tottori: 6_219,
    Shimane: 6_432,
    Okayama: 6_364,
    Hiroshima: 6_098,
    Yamaguchi: 5_568,
    Tokushima: 6_515,
    Kagawa: 6_219,
    Ehime: 6_438,
    Kochi: 5_809,
    Fukuoka: 6_295,
    Saga: 5_983,
    Nagasaki: 6_222,
    Kumamoto: 6_190,
    Oita: 6_235,
    Miyazaki: 6_038,
    Kagoshima: 6_210,
    Okinawa: 6_955,
  },
};

interface LongTermCareCategory1Period {
  /** Month is 0-indexed; each fiscal year's parameters take effect in April (month 3). */
  effectiveFrom: { year: number; month: number };
  monthlyBases: LongTermCareMonthlyBases;
  tiers: LongTermCareStandardTierTable;
}

/**
 * Parameter periods, newest first. The 基準額 averages are per 計画期間, but the 年金収入等
 * boundary moves per fiscal year, so the 第9期 spans three entries sharing the same bases.
 */
const LONG_TERM_CARE_PERIODS: LongTermCareCategory1Period[] = [
  {
    // FY2026 (令和8年度): 年金収入等 boundary raised to 82.65万 (令和7年中の満額 826,464円).
    effectiveFrom: { year: 2026, month: 3 },
    monthlyBases: DAI9KI_MONTHLY_BASES,
    tiers: {
      tier1PensionIncomeEtcMax: 826_500,
      tier2PensionIncomeEtcMax: 1_200_000,
      taxedIncomeBracketUpperBounds: TAXED_INCOME_BRACKET_UPPER_BOUNDS,
      multipliers: STANDARD_TIER_MULTIPLIERS,
    },
  },
  {
    // FY2025 (令和7年度): boundary raised to 80.9万 (令和6年中の満額 809,000円).
    effectiveFrom: { year: 2025, month: 3 },
    monthlyBases: DAI9KI_MONTHLY_BASES,
    tiers: {
      tier1PensionIncomeEtcMax: 809_000,
      tier2PensionIncomeEtcMax: 1_200_000,
      taxedIncomeBracketUpperBounds: TAXED_INCOME_BRACKET_UPPER_BOUNDS,
      multipliers: STANDARD_TIER_MULTIPLIERS,
    },
  },
  {
    // FY2024 (令和6年度), the 第9期 start: 13-tier standard introduced, boundary still 80万.
    effectiveFrom: { year: 2024, month: 3 },
    monthlyBases: DAI9KI_MONTHLY_BASES,
    tiers: {
      tier1PensionIncomeEtcMax: 800_000,
      tier2PensionIncomeEtcMax: 1_200_000,
      taxedIncomeBracketUpperBounds: TAXED_INCOME_BRACKET_UPPER_BOUNDS,
      multipliers: STANDARD_TIER_MULTIPLIERS,
    },
  },
];

if (import.meta.env.DEV) {
  // Validate that the periods are sorted newest-first
  for (let i = 1; i < LONG_TERM_CARE_PERIODS.length; i++) {
    const prev = LONG_TERM_CARE_PERIODS[i - 1]!.effectiveFrom;
    const curr = LONG_TERM_CARE_PERIODS[i]!.effectiveFrom;
    if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
      throw new Error(
        `LONG_TERM_CARE_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`,
      );
    }
  }
}

/**
 * 「第9期計画期間における介護保険の第1号保険料及びサービス見込み量等について」(令和6年5月14日) —
 * the MHLW publication whose 各都道府県平均保険料基準額一覧 attachment supplies every 基準額
 * average in {@link LONG_TERM_CARE_PERIODS}.
 */
export const LONG_TERM_CARE_BASE_SOURCES = {
  page: 'https://www.mhlw.go.jp/stf/newpage_40211.html',
  prefectureTable: 'https://www.mhlw.go.jp/content/12303500/001253799.xlsx',
} as const;

/**
 * The standard tier schedule: 介護保険法施行令第38条, and the MHLW diagram
 * (社会保障審議会介護保険部会 第126回 資料3, 令和7年10月) that states the 厚生労働大臣-set
 * tier 6-8 boundaries and the 公費軽減後 multipliers in one table.
 */
export const LONG_TERM_CARE_TIER_SOURCES = {
  statute: 'https://laws.e-gov.go.jp/law/410CO0000000412#Mp-Ch_6-At_38',
  mhlwDiagram: 'https://www.mhlw.go.jp/content/12300000/001576452.pdf',
} as const;

/** What {@link getLongTermCareCategory1ParamsForMonth} resolves for one calendar month. */
export interface LongTermCareCategory1Params {
  /** Identifies the period, so callers can tell whether two months share parameters. */
  periodId: string;
  /** Annual 基準額 the estimate scales: the resolved monthly average × 12. */
  annualBase: number;
  /**
   * Whose average {@link annualBase} is: the prefecture the region key resolved to, or
   * 'national' when it carries none. No prefecture is keyed 'national', so comparing against
   * it narrows the other branch to a {@link Prefecture}.
   */
  baseScope: Prefecture | 'national';
  tiers: LongTermCareStandardTierTable;
}

/**
 * Returns the 第1号被保険者 estimate parameters in effect for the given calendar month. Falls
 * back to the national-average 基準額 when the region key carries no prefecture, and to the
 * oldest period for months before April 2024 — never undefined, matching the estimate's
 * best-effort nature. Same newest-first lookup as {@link getLatterStageParamsForMonth}.
 */
export function getLongTermCareCategory1ParamsForMonth(
  region: string,
  year: number,
  month: number,
): LongTermCareCategory1Params {
  const period =
    LONG_TERM_CARE_PERIODS.find(
      p =>
        year > p.effectiveFrom.year ||
        (year === p.effectiveFrom.year && month >= p.effectiveFrom.month),
    ) ?? LONG_TERM_CARE_PERIODS[LONG_TERM_CARE_PERIODS.length - 1]!;

  const baseScope = prefectureForRegion(region) ?? 'national';
  const monthlyBase =
    baseScope === 'national'
      ? period.monthlyBases.national
      : period.monthlyBases.prefecture[baseScope];

  return {
    periodId: `${period.effectiveFrom.year}-${period.effectiveFrom.month}`,
    annualBase: monthlyBase * 12,
    baseScope,
    tiers: period.tiers,
  };
}
