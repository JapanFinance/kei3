// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Rules for the home loan tax credit (住宅ローン控除 / 住宅借入金等特別控除).
 * The rules a person receives are determined by the
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
 *   - NTA (home loan credit guide, with links per situation): https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm
 *   - Residence-tax spillover (総務省): https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/090929.html
 *   - MLIT 住宅ローン減税: https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html
 */

/**
 * A residence-tax spillover cap: the credit remainder (after income tax) is capped at
 *   min(flatCap, floor(所得税の課税総所得金額等 × taxableIncomeRate)).
 */
export interface ResidenceTaxSpilloverCap {
    flatCap: number;
    taxableIncomeRate: number;
}

export interface HomeLoanTaxCreditCohort {
    /** Inclusive lower bound of move-in years this band covers. */
    moveInYearFrom: number;
    /** Inclusive upper bound of move-in years this band covers. */
    moveInYearTo: number;
    /** Maximum (inclusive) 合計所得金額 to be eligible at all (yen). */
    incomeLimit: number;
    /**
     * Residence-tax spillover cap applied when the credit exceeds income tax
     * (個人住民税の住宅借入金等特別税額控除), for a 特定取得 purchase — and the only cap on
     * bands that don't distinguish 特定取得 (see spilloverNonTokuteiShutoku). Final cap =
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
    spillover: ResidenceTaxSpilloverCap;
    /**
     * Residence-tax spillover cap for a non-特定取得 purchase — one with no 8%/10% consumption
     * tax, e.g. a pre-owned home bought from a private individual. Present only on the
     * 2014–2021 band, where 特定取得 raised the cap to 7%/¥136,500 while a non-特定取得 purchase
     * keeps the baseline 5%/¥97,500. Omitted on bands where the distinction is moot (2022+
     * already uses 5%/¥97,500 for everyone); when omitted, applyHomeLoanTaxCredit uses
     * `spillover` regardless of the 特定取得 flag.
     */
    spilloverNonTokuteiShutoku?: ResidenceTaxSpilloverCap;
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
    // 2014-2021: the 特定取得 distinction applies. A 特定取得 (home acquired under the 8%/10%
    // consumption tax — e.g. a new build or a pre-owned home bought from a business) raises the
    // spillover cap to 7% / ¥136,500; a non-特定取得 (no consumption tax, e.g. a pre-owned home
    // bought from a private individual) keeps the baseline 5% / ¥97,500. The input's 特定取得 flag
    // selects between them (default 特定取得). Income limit 30M. Move-ins before 2014 are not
    // supported (the UI offers move-ins from ~10 years ago onward; older credits have expired).
    //
    // The 8% consumption tax took effect 2014/4/1, so a 特定取得 is only possible from then on;
    // a 2014/1/1–3/31 move-in is always non-特定取得. The move-in-year dropdown floor is ~10 years
    // back (2017 for a 2026 calc), so those early-2014 move-ins are already past every credit
    // period and never reach this band in practice — we don't model that sub-year boundary.
    {
        moveInYearFrom: 2014,
        moveInYearTo: 2021,
        incomeLimit: 30_000_000,
        spillover: { flatCap: 136_500, taxableIncomeRate: 0.07 },
        spilloverNonTokuteiShutoku: { flatCap: 97_500, taxableIncomeRate: 0.05 },
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
 * move-in year, or undefined if no band covers it (e.g. a pre-2014 move-in).
 */
export const getHomeLoanTaxCreditCohort = (moveInYear: number): HomeLoanTaxCreditCohort | undefined => {
    for (const cohort of HOME_LOAN_TAX_CREDIT_COHORTS) {
        if (moveInYear >= cohort.moveInYearFrom && moveInYear <= cohort.moveInYearTo) {
            return cohort;
        }
    }
    return undefined;
};
