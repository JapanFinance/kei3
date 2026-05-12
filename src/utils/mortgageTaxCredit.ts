// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Mortgage tax credit (住宅ローン控除) application.
 *
 * The credit is applied first to national income tax, with any remainder
 * spilling over to residence tax up to a cohort-specific cap. The cohort that
 * applies is determined by the user's first move-in year, not the current
 * calculation year. See `src/data/mortgageTaxCredit.ts` for cohort rules.
 */

import type { MortgageTaxCreditInput, MortgageTaxCreditResult } from "../types/tax";
import { getMortgageTaxCreditCohort, MORTGAGE_TAX_CREDIT_COHORTS } from "../data/mortgageTaxCredit";

export interface ApplyMortgageTaxCreditArgs {
    input: MortgageTaxCreditInput;
    /** Net income (合計所得金額) — used to check the cohort income limit. */
    netIncome: number;
    /** National income tax before any credit is applied (yen). */
    nationalIncomeTax: number;
    /** 課税総所得金額: residence-tax taxable total income — used for the spillover cap. */
    taxableTotalIncome: number;
    /** Year being calculated. Used to check the credit's duration window. */
    calculationYear: number;
}

const EMPTY_RESULT: MortgageTaxCreditResult = {
    annualCredit: 0,
    appliedToIncomeTax: 0,
    appliedToResidenceTax: 0,
    unusedCredit: 0,
    warnings: [],
};

/**
 * Computes how much of the mortgage tax credit applies for the calculation year,
 * split between income tax and residence tax spillover.
 *
 * Returns an empty result (with warnings) when the user is ineligible — income
 * over cohort limit, calculation year outside the credit's duration window, or
 * unrecognised move-in year.
 */
export function applyMortgageTaxCredit(args: ApplyMortgageTaxCreditArgs): MortgageTaxCreditResult {
    const { input, netIncome, nationalIncomeTax, taxableTotalIncome, calculationYear } = args;

    const cohort = getMortgageTaxCreditCohort(input.moveInYear);
    if (!cohort) {
        return {
            ...EMPTY_RESULT,
            warnings: [
                `No mortgage tax credit rules are configured for a move-in year of ${input.moveInYear}. ` +
                `The credit applies to move-ins from ${earliestSupportedMoveInYear()} onward.`,
            ],
        };
    }

    const warnings: string[] = [];

    // Eligibility: income limit.
    if (netIncome > cohort.incomeLimit) {
        warnings.push(
            `Mortgage tax credit not applied: net income exceeds the ¥${cohort.incomeLimit.toLocaleString()} ` +
            `cohort eligibility limit.`
        );
        return { ...EMPTY_RESULT, warnings };
    }

    // Eligibility: credit window.
    const durationYears = input.isExistingHome
        ? cohort.durationYears.existingHomes
        : cohort.durationYears.newBuilds;
    const yearsSinceMoveIn = calculationYear - input.moveInYear;
    if (yearsSinceMoveIn < 0) {
        warnings.push(
            `Mortgage tax credit not applied: move-in year (${input.moveInYear}) is later than calculation ` +
            `year (${calculationYear}).`
        );
        return { ...EMPTY_RESULT, warnings };
    }
    if (yearsSinceMoveIn >= durationYears) {
        warnings.push(
            `Mortgage tax credit not applied: the ${durationYears}-year credit period ended after ` +
            `${input.moveInYear + durationYears - 1}.`
        );
        return { ...EMPTY_RESULT, warnings };
    }

    // Determine annual credit.
    let annualCredit: number;
    if (input.mode === 'manual') {
        annualCredit = Math.max(0, Math.floor(input.manualAnnualCredit ?? 0));
    } else {
        const housingTier = input.housingTier;
        if (!housingTier) {
            warnings.push("Mortgage tax credit not applied: select a housing tier in Auto mode.");
            return { ...EMPTY_RESULT, warnings };
        }
        const tierCap = cohort.housingTierCaps[housingTier];
        const balanceCap = input.isExistingHome ? tierCap.existingHomes : tierCap.newBuilds;
        if (balanceCap <= 0) {
            warnings.push(
                `Mortgage tax credit not applied: housing tier "${housingTier}" with this build/existing status ` +
                `has no qualifying loan-balance cap for the ${cohort.moveInYearFrom}-${cohort.moveInYearTo} cohort.`
            );
            return { ...EMPTY_RESULT, warnings };
        }
        const eligibleBalance = Math.min(Math.max(0, input.yearEndLoanBalance ?? 0), balanceCap);
        // Round down to nearest ¥100, the conventional NTA rounding for this credit.
        annualCredit = Math.floor((eligibleBalance * cohort.creditRate) / 100) * 100;
    }

    if (annualCredit <= 0) {
        return { ...EMPTY_RESULT, warnings };
    }

    const appliedToIncomeTax = Math.min(annualCredit, Math.max(0, nationalIncomeTax));
    const spilloverEligible = annualCredit - appliedToIncomeTax;

    const residenceTaxCap = Math.min(
        cohort.spillover.flatCap,
        Math.floor(Math.max(0, taxableTotalIncome) * cohort.spillover.taxableIncomeRate),
    );
    const appliedToResidenceTax = Math.min(spilloverEligible, residenceTaxCap);
    const unusedCredit = annualCredit - appliedToIncomeTax - appliedToResidenceTax;

    if (unusedCredit > 0) {
        warnings.push(
            `¥${unusedCredit.toLocaleString()} of the annual credit could not be applied because the ` +
            `combined income-tax and residence-tax-spillover caps were reached.`
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

// Cohorts are sorted newest-first, so the last entry has the earliest start.
const EARLIEST_SUPPORTED_MOVE_IN_YEAR =
    MORTGAGE_TAX_CREDIT_COHORTS[MORTGAGE_TAX_CREDIT_COHORTS.length - 1]?.moveInYearFrom ?? 2009;

function earliestSupportedMoveInYear(): number {
    return EARLIEST_SUPPORTED_MOVE_IN_YEAR;
}
