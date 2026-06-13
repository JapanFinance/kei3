// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Home loan tax credit (住宅ローン控除) application.
 *
 * The user supplies the calculated credit amount (控除可能額). We apply it as a
 * 税額控除: first against the base national income tax (所得税額, before the 2.1%
 * reconstruction surtax), then any remainder spills over to residence tax up to a
 * cohort-specific cap. The cohort is determined by the user's first move-in year.
 * See `src/data/homeLoanTaxCredit.ts`.
 */

import type { HomeLoanTaxCreditInput, HomeLoanTaxCreditResult } from "../types/tax";
import { getHomeLoanTaxCreditCohort, HOME_LOAN_TAX_CREDIT_COHORTS } from "../data/homeLoanTaxCredit";

export interface ApplyHomeLoanTaxCreditArgs {
    input: HomeLoanTaxCreditInput;
    /** Net income (合計所得金額) — used to check the cohort income-eligibility limit. */
    netIncome: number;
    /**
     * Base national income tax (所得税額) BEFORE the reconstruction surtax. The credit
     * reduces this base; the surtax is recomputed by the caller on the reduced base.
     */
    baseIncomeTax: number;
    /**
     * 所得税の課税総所得金額等 — the INCOME-TAX taxable total income (not the
     * residence-tax taxable income). Used for the residence-tax spillover cap:
     * the cap is min(flatCap, floor(this × taxableIncomeRate)).
     */
    taxableTotalIncome: number;
}

const EMPTY_RESULT: HomeLoanTaxCreditResult = {
    annualCredit: 0,
    appliedToIncomeTax: 0,
    appliedToResidenceTax: 0,
    unusedCredit: 0,
    warnings: [],
};

// Bands are sorted newest-first, so the last entry has the earliest start year.
const EARLIEST_SUPPORTED_MOVE_IN_YEAR =
    HOME_LOAN_TAX_CREDIT_COHORTS[HOME_LOAN_TAX_CREDIT_COHORTS.length - 1]?.moveInYearFrom ?? 2009;

// 13-year credits exist only for move-ins from 2019 onward (the consumption-tax-hike
// measure, then the 2022+ new-build regime). Every other cohort is a 10-year credit.
const FIRST_13_YEAR_MOVE_IN = 2019;

/**
 * Oldest move-in year that could still be within its credit period in `taxYear`.
 * Used to bound the move-in-year dropdown — there's no point offering years whose
 * credit has already ended. A move-in Y is still claimable when taxYear ≤ Y + 9
 * (10-year credits, all cohorts) or, for Y ≥ 2019, taxYear ≤ Y + 12 (13-year credits).
 * For taxYear 2026 this yields 2017.
 */
export function earliestEligibleMoveInYear(taxYear: number): number {
    const tenYearFloor = taxYear - 9;
    const thirteenYearFloor = Math.max(FIRST_13_YEAR_MOVE_IN, taxYear - 12);
    const thirteenYearStillRunning = thirteenYearFloor + 12 >= taxYear;
    const floor = thirteenYearStillRunning ? Math.min(tenYearFloor, thirteenYearFloor) : tenYearFloor;
    return Math.max(EARLIEST_SUPPORTED_MOVE_IN_YEAR, floor);
}

/**
 * Computes how the user's home loan tax credit applies, split between the base
 * income tax and the residence-tax spillover.
 *
 * Returns an empty result (with a warning) when the user is ineligible: income
 * over the cohort limit, or an unsupported (pre-2009) move-in year.
 */
export function applyHomeLoanTaxCredit(args: ApplyHomeLoanTaxCreditArgs): HomeLoanTaxCreditResult {
    const { input, netIncome, baseIncomeTax, taxableTotalIncome } = args;

    const cohort = getHomeLoanTaxCreditCohort(input.moveInYear);
    if (!cohort) {
        return {
            ...EMPTY_RESULT,
            warnings: [
                `No home loan tax credit rules are configured for a move-in year of ${input.moveInYear}. ` +
                `The credit applies to move-ins from ${EARLIEST_SUPPORTED_MOVE_IN_YEAR} onward.`,
            ],
        };
    }

    const warnings: string[] = [];

    // Eligibility: income limit (合計所得金額 ceiling for the cohort).
    if (netIncome > cohort.incomeLimit) {
        warnings.push(
            `Home loan tax credit not applied: net income exceeds the ¥${cohort.incomeLimit.toLocaleString()} ` +
            `eligibility limit for a ${input.moveInYear} move-in.`
        );
        return { ...EMPTY_RESULT, warnings };
    }

    const annualCredit = Math.max(0, Math.floor(input.creditAmount));
    if (annualCredit <= 0) {
        return { ...EMPTY_RESULT, warnings };
    }

    // Apply to the base income tax (所得税額) first — this is a 税額控除.
    const appliedToIncomeTax = Math.min(annualCredit, Math.max(0, baseIncomeTax));
    const spilloverEligible = annualCredit - appliedToIncomeTax;

    // Remainder spills over to residence tax, capped at min(flatCap, 課税総所得金額等 × rate).
    const residenceTaxCap = Math.min(
        cohort.spillover.flatCap,
        Math.floor(Math.max(0, taxableTotalIncome) * cohort.spillover.taxableIncomeRate),
    );
    const appliedToResidenceTax = Math.min(spilloverEligible, residenceTaxCap);
    const unusedCredit = annualCredit - appliedToIncomeTax - appliedToResidenceTax;

    if (unusedCredit > 0) {
        warnings.push(
            `¥${unusedCredit.toLocaleString()} of the credit could not be applied: it exceeds your income tax ` +
            `plus the ¥${residenceTaxCap.toLocaleString()} residence-tax spillover cap for this year.`
        );
    }

    return {
        annualCredit,
        appliedToIncomeTax,
        appliedToResidenceTax,
        unusedCredit,
        warnings,
    };
}
