// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Mortgage tax credit (住宅ローン控除) application.
 *
 * The user supplies the calculated credit amount (控除可能額). We apply it as a
 * 税額控除: first against the base national income tax (所得税額, before the 2.1%
 * reconstruction surtax), then any remainder spills over to residence tax up to a
 * cohort-specific cap. The cohort is determined by the user's first move-in year.
 * See `src/data/mortgageTaxCredit.ts`.
 */

import type { MortgageTaxCreditInput, MortgageTaxCreditResult } from "../types/tax";
import { getMortgageTaxCreditCohort, MORTGAGE_TAX_CREDIT_COHORTS } from "../data/mortgageTaxCredit";

export interface ApplyMortgageTaxCreditArgs {
    input: MortgageTaxCreditInput;
    /** Net income (合計所得金額) — used to check the cohort income-eligibility limit. */
    netIncome: number;
    /**
     * Base national income tax (所得税額) BEFORE the reconstruction surtax. The credit
     * reduces this base; the surtax is recomputed by the caller on the reduced base.
     */
    baseIncomeTax: number;
    /** 課税総所得金額: residence-tax taxable total income — used for the spillover cap. */
    taxableTotalIncome: number;
}

const EMPTY_RESULT: MortgageTaxCreditResult = {
    annualCredit: 0,
    appliedToIncomeTax: 0,
    appliedToResidenceTax: 0,
    unusedCredit: 0,
    warnings: [],
};

// Bands are sorted newest-first, so the last entry has the earliest start year.
const EARLIEST_SUPPORTED_MOVE_IN_YEAR =
    MORTGAGE_TAX_CREDIT_COHORTS[MORTGAGE_TAX_CREDIT_COHORTS.length - 1]?.moveInYearFrom ?? 2009;

/**
 * Computes how the user's mortgage tax credit applies, split between the base
 * income tax and the residence-tax spillover.
 *
 * Returns an empty result (with a warning) when the user is ineligible: income
 * over the cohort limit, or an unsupported (pre-2009) move-in year.
 */
export function applyMortgageTaxCredit(args: ApplyMortgageTaxCreditArgs): MortgageTaxCreditResult {
    const { input, netIncome, baseIncomeTax, taxableTotalIncome } = args;

    const cohort = getMortgageTaxCreditCohort(input.moveInYear);
    if (!cohort) {
        return {
            ...EMPTY_RESULT,
            warnings: [
                `No mortgage tax credit rules are configured for a move-in year of ${input.moveInYear}. ` +
                `The credit applies to move-ins from ${EARLIEST_SUPPORTED_MOVE_IN_YEAR} onward.`,
            ],
        };
    }

    const warnings: string[] = [];

    // Eligibility: income limit (合計所得金額 ceiling for the cohort).
    if (netIncome > cohort.incomeLimit) {
        warnings.push(
            `Mortgage tax credit not applied: net income exceeds the ¥${cohort.incomeLimit.toLocaleString()} ` +
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

    // Remainder spills over to residence tax, capped at min(flatCap, 課税総所得金額 × rate).
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
