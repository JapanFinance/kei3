// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Cohort-based rules for the Japanese home loan tax credit (住宅ローン控除 /
 * 住宅借入金等特別控除). The rules a person receives are determined by the
 * **year they first moved into the residence**.
 *
 * The user supplies the calculated credit amount directly (the 控除可能額), so
 * the only cohort-dependent values we need are:
 *   1. the residence-tax spillover cap (used when the credit exceeds income tax), and
 *   2. the income-eligibility limit (合計所得金額 ceiling).
 *
 * Lookup: pass the user's `moveInYear` to `getHomeLoanTaxCreditCohort()`.
 * Bands are sorted newest-first; each covers an inclusive `[moveInYearFrom, moveInYearTo]` range.
 *
 * Maintenance:
 * - Review each December after the MOF tax reform announcement.
 * - When the spillover cap or income limit changes, add a new band at the top and
 *   tighten the `moveInYearTo` of the previous current band.
 *
 * Sources:
 *   - NTA overview: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm
 *   - Residence-tax spillover (総務省): https://www.soumu.go.jp/main_content/000094961.pdf
 *   - MLIT 住宅ローン減税: https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html
 *
 * ---------------------------------------------------------------------------
 * Deferred (future auto-calculate iteration): qualifying loan-balance caps per
 * housing tier, credit rate, and duration. Researched values kept here so the
 * auto-calc feature doesn't start from zero. NOT used by the manual-input MVP.
 *
 * Tiers: longTermExcellent / lowCarbon / zehWaterSaving / energySaving / standard
 * Caps are { newBuilds, existingHomes } qualifying year-end loan balance (yen):
 *
 *   2024+   rate 0.7%, 13y new / 10y existing
 *     longTermExcellent 45M/30M · lowCarbon 45M/30M · zehWaterSaving 35M/30M
 *     energySaving 30M/30M · standard 0/20M (non-energy new builds don't qualify)
 *     (child-rearing / young-couple households get higher new-build caps)
 *   2022-2023  rate 0.7%, 13y new / 10y existing
 *     longTermExcellent 50M/30M · lowCarbon 50M/30M · zehWaterSaving 45M/30M
 *     energySaving 40M/30M · standard 30M/20M
 *   2014-2021  rate 1.0%, 10y (some 2019-2021 got a 13y consumption-tax-hike extension)
 *     longTermExcellent 50M/30M · lowCarbon 50M/30M · zehWaterSaving 40M/30M
 *     energySaving 40M/30M · standard 40M/20M
 *   2009-2013  rate 1.0%, 10y, rules varied by year
 * ---------------------------------------------------------------------------
 */

export interface HomeLoanTaxCreditCohort {
    /** Inclusive lower bound of move-in years this band covers. */
    moveInYearFrom: number;
    /** Inclusive upper bound of move-in years this band covers. */
    moveInYearTo: number;
    /** Maximum 合計所得金額 to be eligible at all (yen). */
    incomeLimit: number;
    /**
     * Residence-tax spillover cap applied when the credit exceeds income tax
     * (個人住民税の住宅借入金等特別税額控除). Final cap =
     *   min(flatCap, floor(所得税の課税総所得金額等 × taxableIncomeRate)).
     *
     * Figures are set by the 地方税法 residence-tax credit provisions (see the 総務省
     * source above). taxableIncomeRate is 7% for 特定取得 (homes acquired under the
     * 8%/10% consumption tax, ~2014–2021 move-ins) and 5% otherwise. flatCap is that
     * same rate applied to ¥1,950,000 (the top of the lowest income-tax bracket):
     * 5% → ¥97,500, 7% → ¥136,500.
     *
     * NOTE: the statute also caps the credit at the residence 所得割 itself, but that
     * third sub-limit never binds here. The residence 所得割 is ~10% of a taxable base
     * that is always ≥ the income-tax base (residence deductions are smaller), so it
     * always exceeds 5–7% of the income-tax base — i.e. flatCap or the 課税総所得 × rate
     * cap is always reached first. We therefore omit the 所得割 limit.
     */
    spillover: {
        flatCap: number;
        taxableIncomeRate: number;
    };
    /** Optional free-form notes for the band. */
    notes?: string;
}

/**
 * Home loan tax credit bands, sorted newest-first. Each band defines the
 * residence-tax spillover cap and income-eligibility limit for its move-in years.
 */
export const HOME_LOAN_TAX_CREDIT_COHORTS: ReadonlyArray<HomeLoanTaxCreditCohort> = [
    // 2022+ (R4 tax reform onward): income limit cut 30M → 20M; spillover cap 5% / ¥97,500.
    {
        moveInYearFrom: 2022,
        moveInYearTo: 9999,
        incomeLimit: 20_000_000,
        spillover: { flatCap: 97_500, taxableIncomeRate: 0.05 },
    },
    // 2014-2021: 8%/10% consumption-tax era; spillover cap raised to 7% / ¥136,500. Income limit 30M.
    {
        moveInYearFrom: 2014,
        moveInYearTo: 2021,
        incomeLimit: 30_000_000,
        spillover: { flatCap: 136_500, taxableIncomeRate: 0.07 },
    },
    // 2009-2013: residence-tax spillover introduced for 2009 move-ins; 5% / ¥97,500. Income limit 30M.
    {
        moveInYearFrom: 2009,
        moveInYearTo: 2013,
        incomeLimit: 30_000_000,
        spillover: { flatCap: 97_500, taxableIncomeRate: 0.05 },
    },
];

if (import.meta.env.DEV) {
    // Sorted newest-first, no gaps, no overlaps.
    for (let i = 0; i < HOME_LOAN_TAX_CREDIT_COHORTS.length; i++) {
        const cohort = HOME_LOAN_TAX_CREDIT_COHORTS[i]!;
        if (cohort.moveInYearFrom > cohort.moveInYearTo) {
            throw new Error(
                `HOME_LOAN_TAX_CREDIT_COHORTS[${i}] has moveInYearFrom (${cohort.moveInYearFrom}) ` +
                `> moveInYearTo (${cohort.moveInYearTo})`
            );
        }
        if (i > 0) {
            const prev = HOME_LOAN_TAX_CREDIT_COHORTS[i - 1]!;
            if (prev.moveInYearFrom <= cohort.moveInYearTo) {
                throw new Error(
                    `HOME_LOAN_TAX_CREDIT_COHORTS must be sorted newest-first with no overlaps; ` +
                    `entry ${i - 1} starts at ${prev.moveInYearFrom} but entry ${i} ends at ${cohort.moveInYearTo}`
                );
            }
            if (prev.moveInYearFrom - cohort.moveInYearTo > 1) {
                throw new Error(
                    `HOME_LOAN_TAX_CREDIT_COHORTS has a gap between entries ${i - 1} ` +
                    `(starts ${prev.moveInYearFrom}) and ${i} (ends ${cohort.moveInYearTo})`
                );
            }
        }
    }
}

/**
 * Returns the band whose [moveInYearFrom, moveInYearTo] range contains the given
 * move-in year, or undefined if no band covers it (pre-2009 move-in).
 */
export const getHomeLoanTaxCreditCohort = (moveInYear: number): HomeLoanTaxCreditCohort | undefined => {
    for (const cohort of HOME_LOAN_TAX_CREDIT_COHORTS) {
        if (moveInYear >= cohort.moveInYearFrom && moveInYear <= cohort.moveInYearTo) {
            return cohort;
        }
    }
    return undefined;
};
