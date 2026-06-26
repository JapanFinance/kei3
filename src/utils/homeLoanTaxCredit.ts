// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Home loan tax credit (住宅ローン控除) application.
 *
 * The user supplies the calculated credit amount (控除可能額). We apply it as a
 * 税額控除: first against the base national income tax (所得税額, before the 2.1%
 * reconstruction surtax), then any remainder spills over to residence tax up to a
 * cohort-specific cap. The cohort is determined by the user's first move-in year.
 */

import type { HomeLoanTaxCreditInput, HomeLoanTaxCreditResult } from '../types/tax';
import {
  getHomeLoanTaxCreditCohort,
  HOME_LOAN_TAX_CREDIT_COHORTS,
} from '../data/homeLoanTaxCredit';

const EMPTY_RESULT: HomeLoanTaxCreditResult = {
  availableCredit: 0,
  appliedToIncomeTax: 0,
  appliedToResidenceTax: 0,
  unusedCredit: 0,
  warnings: [],
};

// Bands are sorted newest-first, so the last entry has the earliest start year.
const EARLIEST_SUPPORTED_MOVE_IN_YEAR =
  HOME_LOAN_TAX_CREDIT_COHORTS[HOME_LOAN_TAX_CREDIT_COHORTS.length - 1]?.moveInYearFrom ?? 2014;

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
  const floor = Math.min(tenYearFloor, thirteenYearFloor);
  return Math.max(EARLIEST_SUPPORTED_MOVE_IN_YEAR, floor);
}

/**
 * Whether the 特定取得 / non-特定取得 distinction changes the residence-tax spillover cap for the
 * given move-in year — true only for cohorts that carry a separate non-特定取得 cap (the 2014–2021
 * band). The UI uses this to show the 特定取得 checkbox only for move-in years where it matters.
 */
export function homeLoanCreditDistinguishesTokuteiShutoku(moveInYear: number): boolean {
  return getHomeLoanTaxCreditCohort(moveInYear)?.spilloverNonTokuteiShutoku !== undefined;
}

/**
 * Computes how the user's home loan tax credit applies, split between the base
 * income tax and the residence-tax spillover.
 *
 * Returns an empty result (with a warning) when the user is ineligible: income
 * over the cohort limit, or an unsupported (pre-2014) move-in year.
 *
 * @param input The home loan tax credit input (first move-in year and 控除可能額).
 * @param netIncome Net income (合計所得金額), checked against the cohort income-eligibility limit.
 * @param baseIncomeTax Base national income tax (所得税額) BEFORE the reconstruction surtax; the credit reduces this base and the caller recomputes the surtax on the reduced base.
 * @param taxableTotalIncome 所得税の課税総所得金額等 — the INCOME-TAX taxable total income (not the residence-tax taxable income); used for the spillover cap min(flatCap, floor(this × taxableIncomeRate)).
 */
export function applyHomeLoanTaxCredit(
  input: HomeLoanTaxCreditInput,
  netIncome: number,
  baseIncomeTax: number,
  taxableTotalIncome: number,
): HomeLoanTaxCreditResult {
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
        `eligibility limit for a ${input.moveInYear} move-in.`,
    );
    return { ...EMPTY_RESULT, warnings };
  }

  const availableCredit = Math.max(0, Math.floor(input.creditAmount));
  if (availableCredit <= 0) {
    return { ...EMPTY_RESULT, warnings };
  }

  // Apply to the base income tax (所得税額) first — this is a 税額控除.
  const appliedToIncomeTax = Math.min(availableCredit, Math.max(0, baseIncomeTax));
  const spilloverEligible = availableCredit - appliedToIncomeTax;

  // Pick the spillover cap variant. The 2014–2021 band carries a lower non-特定取得 cap
  // (5%/¥97,500) alongside its 特定取得 cap (7%/¥136,500); we use it only when the input is
  // explicitly non-特定取得 AND the band distinguishes them. Omitting the flag means 特定取得
  // (matching the original behavior); other bands have no non-特定取得 variant, so the flag is moot.
  const spillover =
    input.isTokuteiShutoku === false && cohort.spilloverNonTokuteiShutoku
      ? cohort.spilloverNonTokuteiShutoku
      : cohort.spillover;

  // Remainder spills over to residence tax, capped at min(定額限度 flatCap, 定率限度 課税総所得金額等 × rate).
  const incomeRateCap = Math.floor(Math.max(0, taxableTotalIncome) * spillover.taxableIncomeRate);
  const residenceTaxCap = Math.min(spillover.flatCap, incomeRateCap);
  const appliedToResidenceTax = Math.min(spilloverEligible, residenceTaxCap);
  const unusedCredit = availableCredit - appliedToIncomeTax - appliedToResidenceTax;

  if (unusedCredit > 0) {
    warnings.push(
      `¥${unusedCredit.toLocaleString()} of the credit could not be applied: it exceeds your income tax ` +
        `plus the ¥${residenceTaxCap.toLocaleString()} residence-tax spillover cap for this year.`,
    );
  }

  return {
    availableCredit,
    appliedToIncomeTax,
    appliedToResidenceTax,
    unusedCredit,
    residenceTaxSpilloverCap: {
      applied: residenceTaxCap,
      flatCap: spillover.flatCap,
      incomeRateCap,
    },
    warnings,
  };
}
