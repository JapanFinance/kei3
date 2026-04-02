// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Employment Income Deduction (給与所得控除) tables, indexed by income year.
 *
 * The deduction is determined by the taxpayer's gross employment income (給与等の収入金額).
 * Each period defines the flat-floor region, any fixed transition values, and the standard
 * percentage-formula tiers that apply for the given income year.
 *
 * Source: NTA overview: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
 */

/** One tier in the standard percentage-formula region. */
export interface EmploymentIncomeStandardTier {
    /** Upper bound of gross salary (inclusive) for this tier. Use Infinity for the final cap tier. */
    grossMaxInclusive: number;
    /**
     * Net retention rate applied to (optionally rounded) gross:
     *   net = floor(base × retentionRate) − offset
     * where base = roundTo4k ? floor(gross / 4000) × 4000 : gross
     */
    retentionRate: number;
    /** Constant subtracted after applying the retention rate. */
    offset: number;
    /** Whether to round gross down to the nearest 4,000 yen before applying the rate. */
    roundTo4k: boolean;
}

/**
 * All parameters describing the employment income deduction for one income-year period.
 * The compute logic is:
 *  1. gross < flatFloorGrossMinInclusive  →  net = 0
 *  2. flatFloorGrossMinInclusive ≤ gross ≤ flatFloorGrossMaxInclusive  →  net = gross − flatFloorDeduction
 *  3. transitionValues (checked in order)  →  first matching grossMaxInclusive wins
 *  4. standardTiers (checked in order)  →  first matching grossMaxInclusive wins
 */
export interface EmploymentIncomeDeductionPeriod {
    /**
     * The income year (calendar year) from which this period's rules apply (inclusive).
     * Periods are sorted newest-first; the lookup returns the first period where year ≥ effectiveYear.
     */
    effectiveYear: number;

    /**
     * Minimum gross salary (inclusive) at which a positive net is possible.
     * For gross < this value, net = 0.
     *   R7 (2025): 650_001 — ITA Art 28(3) flat floor is 65万; gross ≤ 65万 → net ≤ 0
     *   R8 (2026): 741_000 — STMA Art 29-4 para 2 item 1 explicitly sets net = 0 for 69.1万–74万
     */
    flatFloorGrossMinInclusive: number;

    /**
     * Flat deduction applied in the floor region:
     *   net = gross − flatFloorDeduction
     * for flatFloorGrossMinInclusive ≤ gross ≤ flatFloorGrossMaxInclusive.
     */
    flatFloorDeduction: number;

    /**
     * Maximum gross salary (inclusive) for the flat-floor region.
     *   R7: 1_900_000 — ITA Art 28(3) item 1 applies up to 190万
     *   R8: 2_190_999 — STMA Art 29-4 para 2 item 2: up to (but not incl.) 219万1千
     */
    flatFloorGrossMaxInclusive: number;

    /**
     * Fixed net-income values for specific gross ranges that sit between the flat-floor region
     * and the standard formula region. Checked in order; first match (gross ≤ grossMaxInclusive) wins.
     * Sorted by grossMaxInclusive ascending.
     *   R7: empty — the 30% formula joins smoothly at 190万 with no special steps
     *   R8: three steps spanning 219万1千–219万9999 (near the 220万 boundary)
     */
    transitionValues: ReadonlyArray<{ grossMaxInclusive: number; net: number }>;

    /**
     * Standard percentage-formula tiers for gross above the flat-floor and all transition values.
     * Sorted by grossMaxInclusive ascending; the final tier must have grossMaxInclusive = Infinity
     * to handle the deduction cap (e.g. 195万 or 199万).
     */
    standardTiers: ReadonlyArray<EmploymentIncomeStandardTier>;
}

/**
 * Time-series of employment income deduction parameters, sorted newest-first.
 * Each entry defines the rules in effect for the given income year onward.
 */
export const EMPLOYMENT_INCOME_DEDUCTION_PERIODS: ReadonlyArray<EmploymentIncomeDeductionPeriod> = [
    // R8/R9 (令和8年・令和9年) — income years 2026–2027
    // Permanent base: ITA Art 28(3) amended (floor 69万 for salary ≤ ~230万, cap 195万)
    //   Only item 1's minimum changed (65万→69万); items 2–4 (tiers above 360万) are unchanged.
    //   Effective December 1, 2026 (applies to all 2026 income)
    //   Source: https://laws.e-gov.go.jp/law/340AC0000000033/20261201_508AC0000000012#Mp-Pa_2-Ch_2-Se_2-Ss_1-At_28
    // Temporary +5万: STMA Art 29-4 (R8/R9) extends floor to 74万 for salary ≤ 220万
    //   Source: https://laws.e-gov.go.jp/law/332AC0000000026/20261201_508AC0000000012#Mp-Ch_2-Se_3-At_29_4
    {
        effectiveYear: 2026,
        flatFloorGrossMinInclusive: 741_000,  // STMA Art 29-4 para 2 item 2: net > 0 starts at 74万1千
        flatFloorDeduction:         740_000,  // 74万 (69万 ITA permanent + 5万 STMA temporary)
        flatFloorGrossMaxInclusive: 2_190_999, // Art 29-4 para 2 item 2: up to (not incl.) 219万1千
        transitionValues: [
            // STMA Art 29-4 para 2 items 3–5: fixed net values near the 220万 boundary
            { grossMaxInclusive: 2_192_999, net: 1_451_000 }, // 219万1千–219万3千: net = 145万1千
            { grossMaxInclusive: 2_195_999, net: 1_453_000 }, // 219万3千–219万6千: net = 145万3千
            { grossMaxInclusive: 2_199_999, net: 1_456_000 }, // 219万6千–220万:   net = 145万6千
        ],
        standardTiers: [
            // ITA Art 28(3) items 1–4 — standard tiers unchanged from R7
            // Item 1: deduction = 8万 + gross×30% (min 69万) → net = gross×0.7 − 8万
            // Items 2–4: unchanged offsets (116万, 176万, 195万 deductions)
            { grossMaxInclusive: 3_600_000, retentionRate: 0.7, offset:    80_000, roundTo4k: true  },
            { grossMaxInclusive: 6_600_000, retentionRate: 0.8, offset:   440_000, roundTo4k: true  },
            { grossMaxInclusive: 8_500_000, retentionRate: 0.9, offset: 1_100_000, roundTo4k: false },
            { grossMaxInclusive: Infinity,  retentionRate: 1.0, offset: 1_950_000, roundTo4k: false }, // 195万 cap
        ],
    },
    // R7 (令和7年) — income year 2025
    // Permanent base: ITA Art 28(3) amended (floor 65万 for salary ≤ 190万, cap 195万)
    //   Effective December 1, 2025 (applies to all 2025 income)
    //   Source: https://laws.e-gov.go.jp/law/340AC0000000033/20251201_507AC0000000013?occasion_date=20251201#Mp-Pa_2-Ch_2-Se_2-Ss_1-At_28
    {
        effectiveYear: 2025,
        flatFloorGrossMinInclusive: 650_001,  // ITA Art 28(3) item 1: net > 0 starts at 65万+1円
        flatFloorDeduction:         650_000,  // 65万
        flatFloorGrossMaxInclusive: 1_900_000, // ITA Art 28(3) item 1: applies up to 190万 (inclusive)
        transitionValues: [],                 // Smooth join: 30%-formula gives same value at exactly 190万
        standardTiers: [
            // ITA Art 28(3) items 2–5 (R7 amended constants), with 4000-yen rounding per Art 28(4)
            { grossMaxInclusive: 3_600_000, retentionRate: 0.7, offset:    80_000, roundTo4k: true  },
            { grossMaxInclusive: 6_600_000, retentionRate: 0.8, offset:   440_000, roundTo4k: true  },
            { grossMaxInclusive: 8_500_000, retentionRate: 0.9, offset: 1_100_000, roundTo4k: false },
            { grossMaxInclusive: Infinity,  retentionRate: 1.0, offset: 1_950_000, roundTo4k: false }, // 195万 cap
        ],
    },
];

if (import.meta.env.DEV) {
    for (let i = 1; i < EMPLOYMENT_INCOME_DEDUCTION_PERIODS.length; i++) {
        const prev = EMPLOYMENT_INCOME_DEDUCTION_PERIODS[i - 1]!.effectiveYear;
        const curr = EMPLOYMENT_INCOME_DEDUCTION_PERIODS[i]!.effectiveYear;
        if (prev <= curr) {
            throw new Error(
                `EMPLOYMENT_INCOME_DEDUCTION_PERIODS must be sorted newest-first, ` +
                `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`
            );
        }
    }
}

/**
 * Returns the employment income deduction period applicable for the given income year.
 * Finds the most recent period whose effectiveYear is on or before the given year.
 *
 * @param year Income year (calendar year the income was earned)
 */
export const getEmploymentIncomeDeductionPeriod = (year: number): EmploymentIncomeDeductionPeriod => {
    for (const period of EMPLOYMENT_INCOME_DEDUCTION_PERIODS) {
        if (year >= period.effectiveYear) return period;
    }
    return EMPLOYMENT_INCOME_DEDUCTION_PERIODS[EMPLOYMENT_INCOME_DEDUCTION_PERIODS.length - 1]!;
};

/**
 * Calculates net employment income (給与所得の金額) for a given period.
 *
 * @param grossEmploymentIncome  Gross employment income (給与等の収入金額) in yen
 * @param period                 The deduction period parameters to apply
 */
export const calculateNetEmploymentIncomeForPeriod = (
    grossEmploymentIncome: number,
    period: EmploymentIncomeDeductionPeriod
): number => {
    if (grossEmploymentIncome < period.flatFloorGrossMinInclusive) return 0;

    if (grossEmploymentIncome <= period.flatFloorGrossMaxInclusive) {
        return grossEmploymentIncome - period.flatFloorDeduction;
    }

    for (const { grossMaxInclusive, net } of period.transitionValues) {
        if (grossEmploymentIncome <= grossMaxInclusive) return net;
    }

    for (const tier of period.standardTiers) {
        if (grossEmploymentIncome <= tier.grossMaxInclusive) {
            const base = tier.roundTo4k
                ? Math.floor(grossEmploymentIncome / 4000) * 4000
                : grossEmploymentIncome;
            return Math.floor(base * tier.retentionRate) - tier.offset;
        }
    }

    return 0; // unreachable: final tier has grossMaxInclusive = Infinity
};
