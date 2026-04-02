// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * National pension (国民年金) monthly contribution amounts.
 *
 * The contribution is a fixed monthly amount set per fiscal year (April–March).
 * Assumes monthly payment (毎月納付), the default payment method with no advance discount.
 *
 * Source: https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html
 * Historical rates: https://www.nenkin.go.jp/service/kokunen/hokenryo/hensen.html
 */

export interface NationalPensionContributionPeriod {
    /** The date from which this rate applies (inclusive). Month is 0-indexed (0=Jan, 3=Apr). */
    effectiveFrom: { year: number; month: number };
    /** Monthly contribution in yen */
    monthlyContribution: number;
}

/**
 * Time-series of national pension contribution amounts, sorted newest-first.
 * Each entry defines the monthly contribution starting from the given date.
 */
export const NATIONAL_PENSION_CONTRIBUTION_PERIODS: ReadonlyArray<NationalPensionContributionPeriod> = [
    // FY2026 (令和8年度): April 2026 – March 2027
    { effectiveFrom: { year: 2026, month: 3 }, monthlyContribution: 17_920 },
    // FY2025 (令和7年度): April 2025 – March 2026
    { effectiveFrom: { year: 2025, month: 3 }, monthlyContribution: 17_510 },
    // FY2024 (令和6年度): April 2024 – March 2025
    { effectiveFrom: { year: 2024, month: 3 }, monthlyContribution: 16_980 },
];

if (import.meta.env.DEV) {
    for (let i = 1; i < NATIONAL_PENSION_CONTRIBUTION_PERIODS.length; i++) {
        const prev = NATIONAL_PENSION_CONTRIBUTION_PERIODS[i - 1]!.effectiveFrom;
        const curr = NATIONAL_PENSION_CONTRIBUTION_PERIODS[i]!.effectiveFrom;
        if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
            throw new Error(
                `NATIONAL_PENSION_CONTRIBUTION_PERIODS must be sorted newest-first, ` +
                `but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`
            );
        }
    }
}

/**
 * Returns the monthly national pension contribution for a given year and month.
 *
 * @param year Calendar year
 * @param month 0-indexed month (0=Jan, 11=Dec)
 */
export const getNationalPensionMonthlyContribution = (year: number, month: number): number => {
    for (const period of NATIONAL_PENSION_CONTRIBUTION_PERIODS) {
        const { effectiveFrom } = period;
        if (year > effectiveFrom.year || (year === effectiveFrom.year && month >= effectiveFrom.month)) {
            return period.monthlyContribution;
        }
    }
    return NATIONAL_PENSION_CONTRIBUTION_PERIODS[NATIONAL_PENSION_CONTRIBUTION_PERIODS.length - 1]!.monthlyContribution;
};

/**
 * Returns the total annual national pension contribution for a given calendar year,
 * summing the 12 monthly contributions (which may span two fiscal years).
 *
 * @param year Calendar year
 */
export const getNationalPensionAnnualTotal = (year: number): number => {
    let total = 0;
    for (let month = 0; month < 12; month++) {
        total += getNationalPensionMonthlyContribution(year, month);
    }
    return total;
};
