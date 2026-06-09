// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Employment insurance (雇用保険) premium rates for general businesses (一般の事業).
 * Employee portion only (労働者負担).
 *
 * Source: Ministry of Health, Labour and Welfare (MHLW)
 * https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html
 */
export interface EmploymentInsuranceRatePeriod {
    /** The date from which this rate applies (inclusive). Month is 0-indexed (0=Jan, 3=Apr). */
    effectiveFrom: { year: number; month: number };
    /** Employee premium rate as a decimal (e.g., 0.005 for 0.50%) */
    rate: number;
}

/**
 * Time-series of employment insurance rates, sorted newest-first.
 * Each entry defines the employee rate starting from the given date.
 */
export const EMPLOYMENT_INSURANCE_RATES: EmploymentInsuranceRatePeriod[] = [
    // FY2026 (令和8年度): April 2026 – March 2027
    // source: https://www.mhlw.go.jp/content/001672589.pdf
    { effectiveFrom: { year: 2026, month: 3 }, rate: 0.005 },    // 5/1,000

    // FY2025 (令和7年度): April 2025 – March 2026
    // source: https://www.mhlw.go.jp/content/001401966.pdf
    { effectiveFrom: { year: 2025, month: 3 }, rate: 0.0055 },   // 5.5/1,000
];

if (import.meta.env.DEV) {
    // Validate that the rates are sorted newest-first
    for (let i = 1; i < EMPLOYMENT_INSURANCE_RATES.length; i++) {
        const prev = EMPLOYMENT_INSURANCE_RATES[i - 1]!.effectiveFrom;
        const curr = EMPLOYMENT_INSURANCE_RATES[i]!.effectiveFrom;
        if (prev.year < curr.year || (prev.year === curr.year && prev.month <= curr.month)) {
            throw new Error(`EMPLOYMENT_INSURANCE_RATES must be sorted newest-first, but entry ${i - 1} (${prev.year}-${prev.month}) is not after entry ${i} (${curr.year}-${curr.month})`);
        }
    }
}

/**
 * Returns the applicable employment insurance rate for a given calendar year and month.
 * Finds the most recent rate entry whose effective date is on or before the given date.
 *
 * @param year Calendar year
 * @param month 0-indexed month (0=Jan, 11=Dec)
 */
export const getEmploymentInsuranceRate = (year: number, month: number): number => {
    for (const period of EMPLOYMENT_INSURANCE_RATES) {
        const { effectiveFrom } = period;
        if (year > effectiveFrom.year || (year === effectiveFrom.year && month >= effectiveFrom.month)) {
            return period.rate;
        }
    }
    // Fallback to the oldest known rate
    return EMPLOYMENT_INSURANCE_RATES[EMPLOYMENT_INSURANCE_RATES.length - 1]!.rate;
};
