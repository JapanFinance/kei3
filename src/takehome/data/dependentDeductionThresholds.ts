// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Dependent deduction income eligibility thresholds, indexed by income year.
 *
 * This threshold determines the maximum net income (合計所得金額) for a dependent
 * (or spouse) to qualify for the dependent deduction (扶養控除) or spouse deduction (配偶者控除).
 * It also serves as the lower bound for the spouse special deduction (配偶者特別控除)
 * and specific relative special deduction (特定親族特別控除).
 *
 * The threshold tracks changes to the basic deduction (基礎控除) — when the basic
 * deduction is raised, this threshold is raised by the same amount.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm — 扶養控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm — 配偶者控除
 */

export interface DependentDeductionThresholdPeriod {
    /** The income year (calendar year) from which this threshold applies (inclusive) */
    effectiveYear: number;
    /** Max net income (inclusive) for dependent/spouse deduction eligibility, in yen */
    dependentEligibilityMax: number;
}

/**
 * Time-series of dependent deduction eligibility thresholds, sorted newest-first.
 */
export const DEPENDENT_DEDUCTION_THRESHOLD_PERIODS: ReadonlyArray<DependentDeductionThresholdPeriod> = [
    // R8 (2026): raised from 58万 to 62万 per 令和8年度税制改正
    { effectiveYear: 2026, dependentEligibilityMax: 620_000 },
    // R7 (2025): raised from 48万 to 58万 per 令和7年度税制改正
    { effectiveYear: 2025, dependentEligibilityMax: 580_000 },
];

if (import.meta.env.DEV) {
    for (let i = 1; i < DEPENDENT_DEDUCTION_THRESHOLD_PERIODS.length; i++) {
        const prev = DEPENDENT_DEDUCTION_THRESHOLD_PERIODS[i - 1]!.effectiveYear;
        const curr = DEPENDENT_DEDUCTION_THRESHOLD_PERIODS[i]!.effectiveYear;
        if (prev <= curr) {
            throw new Error(
                `DEPENDENT_DEDUCTION_THRESHOLD_PERIODS must be sorted newest-first, ` +
                `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`
            );
        }
    }
}

/**
 * Returns the dependent/spouse deduction eligibility max for the given income year.
 *
 * @param year Income year (calendar year the income was earned)
 */
export const getDependentEligibilityMax = (year: number): number => {
    for (const period of DEPENDENT_DEDUCTION_THRESHOLD_PERIODS) {
        if (year >= period.effectiveYear) {
            return period.dependentEligibilityMax;
        }
    }
    return DEPENDENT_DEDUCTION_THRESHOLD_PERIODS[DEPENDENT_DEDUCTION_THRESHOLD_PERIODS.length - 1]!.dependentEligibilityMax;
};
