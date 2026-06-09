// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * National Income Tax Basic Deduction (基礎控除) tier tables, indexed by income year.
 *
 * The deduction is determined by the taxpayer's net income (合計所得金額).
 * Each tier lists the maximum net income (inclusive) and the corresponding deduction amount.
 *
 * Source: NTA overview: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 */

export interface BasicDeductionTier {
    /** Maximum net income (inclusive) for this tier, in yen */
    maxIncomeInclusive: number;
    /** Deduction amount in yen */
    deduction: number;
}

export interface BasicDeductionTierPeriod {
    /** The income year (calendar year) from which this tier set applies (inclusive) */
    effectiveYear: number;
    /** Tiers sorted by maxIncomeInclusive ascending; income above all tiers → deduction = 0 */
    tiers: ReadonlyArray<BasicDeductionTier>;
}

/**
 * Time-series of national basic deduction tier tables, sorted newest-first.
 * Each entry defines the tiers in effect for the given income year onward.
 */
export const NATIONAL_BASIC_DEDUCTION_TIER_PERIODS: ReadonlyArray<BasicDeductionTierPeriod> = [
    // R8 (令和8年) — income year 2026 onward
    // Base deduction: Art. 86 raised from 58万 to 62万, effective December 1, 2026
    //   Source: https://laws.e-gov.go.jp/law/340AC0000000033/20261201_508AC0000000012?occasion_date=20261201#Mp-Pa_2-Ch_2-Se_4-At_86
    // Temporary additions: Special Tax Measures Act Art. 41-16-2 (December 1, 2026 version):
    //   net income ≤ 489万: +42万 → combined 104万
    //   489万 < net ≤ 655万: +5万 → combined 67万
    //   net > 655万: 0 → combined 62万
    //   Source: https://laws.e-gov.go.jp/law/332AC0000000026/20261201_508AC0000000012?occasion_date=20261201#Mp-Ch_2-Se_6-At_41_16_2
    {
        effectiveYear: 2026,
        tiers: [
            { maxIncomeInclusive:  1_320_000, deduction: 1_040_000 }, // 62万 base + 42万 temp = 104万
            { maxIncomeInclusive:  3_360_000, deduction: 1_040_000 }, // 62万 base + 42万 temp = 104万
            { maxIncomeInclusive:  4_890_000, deduction: 1_040_000 }, // 62万 base + 42万 temp = 104万
            { maxIncomeInclusive:  6_550_000, deduction:   670_000 }, // 62万 base + 5万 temp = 67万
            { maxIncomeInclusive: 23_500_000, deduction:   620_000 }, // 62万 base, no temp addition
            { maxIncomeInclusive: 24_000_000, deduction:   480_000 }, // Phase-down (unchanged from R7)
            { maxIncomeInclusive: 24_500_000, deduction:   320_000 },
            { maxIncomeInclusive: 25_000_000, deduction:   160_000 },
            // Above 25,000,000: deduction = 0
        ],
    },
    // R7 (令和7年) — income year 2025
    // Base deduction: Art. 86 raised from 48万 to 58万, effective June 1, 2025
    //   Source: Income Tax Act Article 86: https://laws.e-gov.go.jp/law/340AC0000000033/20250601_504AC0000000068?occasion_date=20250601#Mp-Pa_2-Ch_2-Se_4-At_86
    // Temporary additions: Special Tax Measures Act Art. 41-16-2 (December 1 2025 version):
    //   net income ≤ 132万: +37万 → combined 95万
    //   132万 < net ≤ 336万: +30万 → combined 88万
    //   336万 < net ≤ 489万: +10万 → combined 68万
    //   489万 < net ≤ 655万: +5万 → combined 63万
    //   net > 655万: 0 → combined 58万
    // Source: Special Tax Measures Act Article 41-16-2: https://laws.e-gov.go.jp/law/332AC0000000026/20251201_507AC0000000013?occasion_date=20251201#Mp-Ch_2-Se_6-At_41_16_2
    {
        effectiveYear: 2025,
        tiers: [
            { maxIncomeInclusive:  1_320_000, deduction:   950_000 }, // 58万 base + 37万 temp = 95万
            { maxIncomeInclusive:  3_360_000, deduction:   880_000 }, // 58万 base + 30万 temp = 88万
            { maxIncomeInclusive:  4_890_000, deduction:   680_000 }, // 58万 base + 10万 temp = 68万
            { maxIncomeInclusive:  6_550_000, deduction:   630_000 }, // 58万 base + 5万 temp = 63万
            { maxIncomeInclusive: 23_500_000, deduction:   580_000 }, // 58万 base, no temp addition
            { maxIncomeInclusive: 24_000_000, deduction:   480_000 }, // Phase-down
            { maxIncomeInclusive: 24_500_000, deduction:   320_000 },
            { maxIncomeInclusive: 25_000_000, deduction:   160_000 },
            // Above 25,000,000: deduction = 0
        ],
    },
];

if (import.meta.env.DEV) {
    // Validate that the periods are sorted newest-first
    for (let i = 1; i < NATIONAL_BASIC_DEDUCTION_TIER_PERIODS.length; i++) {
        const prev = NATIONAL_BASIC_DEDUCTION_TIER_PERIODS[i - 1]!.effectiveYear;
        const curr = NATIONAL_BASIC_DEDUCTION_TIER_PERIODS[i]!.effectiveYear;
        if (prev <= curr) {
            throw new Error(
                `NATIONAL_BASIC_DEDUCTION_TIER_PERIODS must be sorted newest-first, ` +
                `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`
            );
        }
    }
}

/**
 * Returns the basic deduction tiers applicable for the given income year.
 * Finds the most recent period whose effectiveYear is on or before the given year.
 *
 * @param year Income year (calendar year the income was earned)
 */
export const getNationalBasicDeductionTiers = (year: number): ReadonlyArray<BasicDeductionTier> => {
    for (const period of NATIONAL_BASIC_DEDUCTION_TIER_PERIODS) {
        if (year >= period.effectiveYear) {
            return period.tiers;
        }
    }
    // Fallback to the oldest known tiers
    return NATIONAL_BASIC_DEDUCTION_TIER_PERIODS[NATIONAL_BASIC_DEDUCTION_TIER_PERIODS.length - 1]!.tiers;
};
