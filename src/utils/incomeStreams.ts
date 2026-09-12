// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream, IncomeStream, IncomeStreamType } from '../types/tax';

/** The member of the {@link IncomeStream} union discriminated by `T`, by discriminant. */
type IncomeStreamOfType = { [T in IncomeStreamType]: Extract<IncomeStream, { type: T }> };

interface IncomeStreamBehavior<T extends IncomeStreamType> {
  /**
   * Whether streams of this type are earned annual income (see TakeHomeResults.annualIncome in
   * tax.ts): gross salary-like or business/misc/pension income received over the year. False for
   * a reimbursement (通勤手当, not income at all) and for investment income (真に income, but
   * asset-based rather than earned — it is reported separately, see
   * TakeHomeResults.investmentIncome). Also decides whether the chart sweep scales the stream:
   * see isPassThroughStream in chartConfig.ts, the complement of this property.
   */
  countsTowardAnnualIncome: boolean;
  /**
   * Whether streams of this type contribute to their category's subtotal in the income modal.
   * True for everything except a reimbursement (通勤手当), which sits in the employment category
   * for entry but is not income of that category either. Distinct from
   * {@link countsTowardAnnualIncome}: investment income is real income of its own category even
   * though it does not count toward earned annual income.
   */
  countsTowardCategorySubtotal: boolean;
  /** The amount the stream represents over a year, from however its amount is entered. */
  annualAmount: (stream: IncomeStreamOfType[T]) => number;
}

/**
 * Returns the multiplier to convert a per-period commuting allowance amount to an annual total.
 * e.g. a monthly payment × 12 = annual; a 3-month payment × 4 = annual.
 */
export const getFrequencyAnnualMultiplier = (
  frequency: CommutingAllowanceIncomeStream['frequency'],
): number => {
  switch (frequency) {
    case 'monthly':
      return 12;
    case '3-months':
      return 4;
    case '6-months':
      return 2;
    case 'annual':
      return 1;
  }
};

/**
 * How each income stream type behaves. Every type answers both questions, so adding one to
 * {@link IncomeStream} does not compile until its behaviour is declared here — in particular
 * a type whose amount is entered per period cannot silently annualize at face value.
 *
 * Read through {@link countsTowardAnnualIncome} and {@link annualIncomeStreamAmount}.
 */
const INCOME_STREAM_BEHAVIOR: { [T in IncomeStreamType]: IncomeStreamBehavior<T> } = {
  salary: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => (s.frequency === 'monthly' ? s.amount * 12 : s.amount),
  },
  bonus: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  business: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  miscellaneous: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  publicPension: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  stockCompensation: {
    countsTowardAnnualIncome: true,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  // A commuting allowance (通勤手当) reimburses a cost rather than paying for work.
  commutingAllowance: {
    countsTowardAnnualIncome: false,
    countsTowardCategorySubtotal: false,
    annualAmount: s => s.amount * getFrequencyAnnualMultiplier(s.frequency),
  },
  // Asset-based income, taxed separately at source — see calculateWithheldInvestmentTax in
  // investmentIncome.ts. Not earned annual income, but real income of its own category.
  capitalGains: {
    countsTowardAnnualIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  dividends: {
    countsTowardAnnualIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  interest: {
    countsTowardAnnualIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
};

/** Whether `stream` contributes to {@link totalAnnualIncomeFromStreams}. */
export const countsTowardAnnualIncome = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].countsTowardAnnualIncome;

/** Whether `stream` contributes to its category's subtotal in the income modal. */
export const countsTowardCategorySubtotal = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].countsTowardCategorySubtotal;

// Taking the discriminant and the stream as correlated parameters is what lets TypeScript
// check the indexed call; reading INCOME_STREAM_BEHAVIOR[stream.type] inline does not.
const annualAmountOf = <T extends IncomeStreamType>(
  type: T,
  stream: IncomeStreamOfType[T],
): number => INCOME_STREAM_BEHAVIOR[type].annualAmount(stream);

/** The amount `stream` represents over a year. */
export const annualIncomeStreamAmount = (stream: IncomeStream): number =>
  annualAmountOf(stream.type, stream);

/**
 * The amount `stream` represents in a month, from however its amount is entered: its
 * {@link annualIncomeStreamAmount} spread evenly over the year.
 */
export const monthlyIncomeStreamAmount = (stream: IncomeStream): number =>
  annualIncomeStreamAmount(stream) / 12;

/** Returns the annualized amount for a commuting allowance income stream. */
export const getCommutingAllowanceAnnualAmount = (stream: CommutingAllowanceIncomeStream): number =>
  INCOME_STREAM_BEHAVIOR.commutingAllowance.annualAmount(stream);

/**
 * Total annual income represented by a set of income streams: every stream that
 * {@link countsTowardAnnualIncome}, at its {@link annualIncomeStreamAmount}. Each stream's
 * entered amount is already at the level this total is defined at (see
 * TakeHomeResults.annualIncome in tax.ts): gross for employment and public pension income, after
 * 必要経費 for business and miscellaneous income.
 */
export function totalAnnualIncomeFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) => (countsTowardAnnualIncome(s) ? sum + annualIncomeStreamAmount(s) : sum),
    0,
  );
}
