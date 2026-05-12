// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Cohort-based rules for the Japanese mortgage tax credit (住宅ローン控除 /
 * 住宅借入金等特別控除). The rules a person receives are determined by the
 * **year they first moved into the residence** and continue (in most cases
 * unchanged) for the full credit duration (typically 10 years for existing
 * homes, 13 years for newly built energy-compliant homes).
 *
 * Lookup: pass the user's `moveInYear` to `getMortgageTaxCreditCohort()`.
 * The cohorts array is sorted newest-first and each entry covers an inclusive
 * `[moveInYearFrom, moveInYearTo]` range.
 *
 * Maintenance:
 * - Review each December after the MOF tax reform announcement.
 * - When new rules take effect, add a new cohort to the top of the array and
 *   tighten the `moveInYearTo` of the previous current-cohort entry.
 * - When historical rules are clarified or extended, edit the relevant entry.
 *
 * Sources:
 *   - NTA overview: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm
 *   - MLIT 住宅ローン減税: https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html
 */

import type { MortgageHousingTier } from "../types/tax";

/** Loan-balance caps per housing tier, separated by new vs existing home. */
export interface MortgageHousingTierCap {
    /** Cap on qualifying year-end loan balance for newly built homes (yen). */
    newBuilds: number;
    /** Cap on qualifying year-end loan balance for existing homes (yen). */
    existingHomes: number;
}

export interface MortgageTaxCreditCohort {
    /** Inclusive lower bound of move-in years this cohort covers. */
    moveInYearFrom: number;
    /** Inclusive upper bound of move-in years this cohort covers. */
    moveInYearTo: number;
    /** Credit rate applied to year-end loan balance, e.g. 0.007 for 0.7%. */
    creditRate: number;
    /** Number of years the credit applies for, by build type. */
    durationYears: {
        newBuilds: number;
        existingHomes: number;
    };
    /** Maximum 合計所得金額 to be eligible at all (yen). */
    incomeLimit: number;
    /**
     * Residence-tax spillover cap when annual credit exceeds income tax.
     * Final cap = min(flatCap, floor(taxableTotalIncome × taxableIncomeRate)).
     */
    spillover: {
        flatCap: number;
        taxableIncomeRate: number;
    };
    /** Qualifying loan-balance cap per housing tier. */
    housingTierCaps: Record<MortgageHousingTier, MortgageHousingTierCap>;
    /** Optional free-form notes for the cohort. */
    notes?: string;
}

/**
 * All known mortgage tax credit cohorts, sorted newest-first.
 *
 * Note on simplifications:
 * - "Child-rearing / young couple" bonus caps that apply to 2024+ cohorts in
 *   newly built energy-compliant homes are NOT modelled here in v1. Users with
 *   such bonuses can use Manual mode to enter the exact credit amount.
 * - Pre-2014 cohorts collapse into a conservative catch-all entry; users with
 *   very early move-in years should use Manual mode.
 */
export const MORTGAGE_TAX_CREDIT_COHORTS: ReadonlyArray<MortgageTaxCreditCohort> = [
    // ----- 2024+ cohort (current regime; R6 tax reform onward) -----
    // 0.7% rate, ¥20M income limit, ¥97,500 / 5% spillover cap.
    // New builds must be energy-compliant; non-compliant standard new builds
    // generally do not qualify (modelled here as a cap of 0).
    // Duration: 13 years for new builds, 10 years for existing homes.
    // Sources:
    //   NTA: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm
    //   MLIT: https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html
    {
        moveInYearFrom: 2024,
        moveInYearTo: 9999,
        creditRate: 0.007,
        durationYears: { newBuilds: 13, existingHomes: 10 },
        incomeLimit: 20_000_000,
        spillover: { flatCap: 97_500, taxableIncomeRate: 0.05 },
        housingTierCaps: {
            longTermExcellent: { newBuilds: 45_000_000, existingHomes: 30_000_000 },
            lowCarbon:         { newBuilds: 45_000_000, existingHomes: 30_000_000 },
            zehWaterSaving:    { newBuilds: 35_000_000, existingHomes: 30_000_000 },
            energySaving:      { newBuilds: 30_000_000, existingHomes: 30_000_000 },
            standard:          { newBuilds:          0, existingHomes: 20_000_000 },
        },
        notes:
            "Child-rearing / young-couple households may receive higher new-build caps. " +
            "Use Manual mode to enter the exact credit amount in that case.",
    },

    // ----- 2022-2023 cohort (R4 tax reform) -----
    // Rate dropped from 1.0% to 0.7%; income limit dropped from ¥30M to ¥20M;
    // spillover cap dropped to ¥97,500 / 5%.
    // Duration: 13 years new / 10 years existing.
    {
        moveInYearFrom: 2022,
        moveInYearTo: 2023,
        creditRate: 0.007,
        durationYears: { newBuilds: 13, existingHomes: 10 },
        incomeLimit: 20_000_000,
        spillover: { flatCap: 97_500, taxableIncomeRate: 0.05 },
        housingTierCaps: {
            longTermExcellent: { newBuilds: 50_000_000, existingHomes: 30_000_000 },
            lowCarbon:         { newBuilds: 50_000_000, existingHomes: 30_000_000 },
            zehWaterSaving:    { newBuilds: 45_000_000, existingHomes: 30_000_000 },
            energySaving:      { newBuilds: 40_000_000, existingHomes: 30_000_000 },
            standard:          { newBuilds: 30_000_000, existingHomes: 20_000_000 },
        },
    },

    // ----- 2014-2021 cohort -----
    // 1.0% credit rate, ¥30M income limit, ¥136,500 / 7% spillover cap
    // (applies when consumption tax was 8% or 10%).
    // Duration: 10 years (the 13-year extension granted for specific
    // consumption-tax-hike timing windows is not modelled separately here;
    // those users can override with Manual mode).
    {
        moveInYearFrom: 2014,
        moveInYearTo: 2021,
        creditRate: 0.01,
        durationYears: { newBuilds: 10, existingHomes: 10 },
        incomeLimit: 30_000_000,
        spillover: { flatCap: 136_500, taxableIncomeRate: 0.07 },
        housingTierCaps: {
            longTermExcellent: { newBuilds: 50_000_000, existingHomes: 30_000_000 },
            lowCarbon:         { newBuilds: 50_000_000, existingHomes: 30_000_000 },
            zehWaterSaving:    { newBuilds: 40_000_000, existingHomes: 30_000_000 },
            energySaving:      { newBuilds: 40_000_000, existingHomes: 30_000_000 },
            standard:          { newBuilds: 40_000_000, existingHomes: 20_000_000 },
        },
        notes:
            "Some 2019-2021 move-ins received a 13-year extension tied to the " +
            "consumption-tax hike. Use Manual mode if you received the extended duration.",
    },

    // ----- 2009-2013 catch-all cohort -----
    // Conservative defaults for older move-ins; the rules varied by year.
    // Recommend Manual mode for these users.
    {
        moveInYearFrom: 2009,
        moveInYearTo: 2013,
        creditRate: 0.01,
        durationYears: { newBuilds: 10, existingHomes: 10 },
        incomeLimit: 30_000_000,
        spillover: { flatCap: 97_500, taxableIncomeRate: 0.05 },
        housingTierCaps: {
            longTermExcellent: { newBuilds: 50_000_000, existingHomes: 20_000_000 },
            lowCarbon:         { newBuilds: 50_000_000, existingHomes: 20_000_000 },
            zehWaterSaving:    { newBuilds: 30_000_000, existingHomes: 20_000_000 },
            energySaving:      { newBuilds: 30_000_000, existingHomes: 20_000_000 },
            standard:          { newBuilds: 30_000_000, existingHomes: 20_000_000 },
        },
        notes: "Pre-2014 rules varied by year; Manual mode is recommended.",
    },
];

if (import.meta.env.DEV) {
    const tiers: ReadonlyArray<MortgageHousingTier> = [
        'longTermExcellent',
        'lowCarbon',
        'zehWaterSaving',
        'energySaving',
        'standard',
    ];

    // Sorted newest-first, no gaps, no overlaps, all tiers present.
    for (let i = 0; i < MORTGAGE_TAX_CREDIT_COHORTS.length; i++) {
        const cohort = MORTGAGE_TAX_CREDIT_COHORTS[i]!;
        if (cohort.moveInYearFrom > cohort.moveInYearTo) {
            throw new Error(
                `MORTGAGE_TAX_CREDIT_COHORTS[${i}] has moveInYearFrom (${cohort.moveInYearFrom}) ` +
                `> moveInYearTo (${cohort.moveInYearTo})`
            );
        }
        for (const tier of tiers) {
            if (!(tier in cohort.housingTierCaps)) {
                throw new Error(
                    `MORTGAGE_TAX_CREDIT_COHORTS[${i}] is missing housingTierCaps for tier "${tier}"`
                );
            }
        }
        if (i > 0) {
            const prev = MORTGAGE_TAX_CREDIT_COHORTS[i - 1]!;
            if (prev.moveInYearFrom <= cohort.moveInYearTo) {
                throw new Error(
                    `MORTGAGE_TAX_CREDIT_COHORTS must be sorted newest-first with no overlaps; ` +
                    `entry ${i - 1} starts at ${prev.moveInYearFrom} but entry ${i} ends at ${cohort.moveInYearTo}`
                );
            }
            if (prev.moveInYearFrom - cohort.moveInYearTo > 1) {
                throw new Error(
                    `MORTGAGE_TAX_CREDIT_COHORTS has a gap between entries ${i - 1} ` +
                    `(starts ${prev.moveInYearFrom}) and ${i} (ends ${cohort.moveInYearTo})`
                );
            }
        }
    }
}

/**
 * Returns the cohort whose [moveInYearFrom, moveInYearTo] range contains the
 * given move-in year, or undefined if no cohort covers it (pre-2009 move-in).
 */
export const getMortgageTaxCreditCohort = (moveInYear: number): MortgageTaxCreditCohort | undefined => {
    for (const cohort of MORTGAGE_TAX_CREDIT_COHORTS) {
        if (moveInYear >= cohort.moveInYearFrom && moveInYear <= cohort.moveInYearTo) {
            return cohort;
        }
    }
    return undefined;
};
