// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream, IncomeStream, IncomeStreamType } from '../types/tax';

/** The member of the {@link IncomeStream} union discriminated by `T`, by discriminant. */
type IncomeStreamOfType = { [T in IncomeStreamType]: Extract<IncomeStream, { type: T }> };

interface IncomeStreamBehavior<T extends IncomeStreamType> {
  /**
   * Whether streams of this type are earned income: pay for work, or business, miscellaneous or
   * pension income received over the year. Earned income is what the chart sweep scales across
   * its income range (see isPassThroughStream in chartConfig.ts, the complement of this) and what
   * the social-insurance dependent-coverage test counts ({@link dependentTestAnnualIncome}).
   * False for a reimbursement (通勤手当, not income at all) and for investment income, which is
   * asset-based: it is held at its entered amount across the sweep.
   */
  isEarnedIncome: boolean;
  /**
   * Whether a stream counts toward annual income (see TakeHomeResults.annualIncome in tax.ts):
   * the income the return covers. Earned income always does; investment income does when it is
   * reported rather than settled by withholding, since only then does the tax system count it
   * (TakeHomeResults.investmentIncome is where the withheld amounts are reported instead).
   */
  countsTowardAnnualIncome: (stream: IncomeStreamOfType[T]) => boolean;
  /**
   * Whether streams of this type contribute to their category's subtotal in the income modal.
   * True for everything except a reimbursement (通勤手当), which sits in the employment category
   * for entry but is not income of that category either. Distinct from
   * {@link countsTowardAnnualIncome}: withheld investment income is real income of its own
   * category even though it does not count toward annual income.
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

const earned = <T extends IncomeStreamType>(
  annualAmount: IncomeStreamBehavior<T>['annualAmount'],
): IncomeStreamBehavior<T> => ({
  isEarnedIncome: true,
  countsTowardAnnualIncome: () => true,
  countsTowardCategorySubtotal: true,
  annualAmount,
});

/**
 * How each income stream type behaves. Every type answers every question, so adding one to
 * {@link IncomeStream} does not compile until its behaviour is declared here — in particular
 * a type whose amount is entered per period cannot silently annualize at face value.
 *
 * Read through {@link isEarnedIncomeStream}, {@link countsTowardAnnualIncome} and
 * {@link annualIncomeStreamAmount}.
 */
const INCOME_STREAM_BEHAVIOR: { [T in IncomeStreamType]: IncomeStreamBehavior<T> } = {
  salary: earned(s => (s.frequency === 'monthly' ? s.amount * 12 : s.amount)),
  bonus: earned(s => s.amount),
  business: earned(s => s.amount),
  miscellaneous: earned(s => s.amount),
  publicPension: earned(s => s.amount),
  stockCompensation: earned(s => s.amount),
  // A commuting allowance (通勤手当) reimburses a cost rather than paying for work.
  commutingAllowance: {
    isEarnedIncome: false,
    countsTowardAnnualIncome: () => false,
    countsTowardCategorySubtotal: false,
    annualAmount: s => s.amount * getFrequencyAnnualMultiplier(s.frequency),
  },
  // Asset-based income. Settled at source under 申告不要 (see calculateWithheldInvestmentTax in
  // investmentIncome.ts) or taxed through the return when reported; real income of its own
  // category either way.
  capitalGains: {
    isEarnedIncome: false,
    countsTowardAnnualIncome: s => s.taxTreatment !== 'withheldOnly',
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  dividends: {
    isEarnedIncome: false,
    countsTowardAnnualIncome: s => s.taxTreatment !== 'withheldOnly',
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
  // 措法3条① settles interest paid in Japan by withholding; interest paid outside Japan is
  // reported.
  interest: {
    isEarnedIncome: false,
    countsTowardAnnualIncome: s => s.payerDomicile !== 'domestic',
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
  },
};

/** Whether `stream` is earned income — see {@link IncomeStreamBehavior.isEarnedIncome}. */
export const isEarnedIncomeStream = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].isEarnedIncome;

// Taking the discriminant and the stream as correlated parameters is what lets TypeScript
// check the indexed call; reading INCOME_STREAM_BEHAVIOR[stream.type] inline does not.
const countsTowardAnnualIncomeOf = <T extends IncomeStreamType>(
  type: T,
  stream: IncomeStreamOfType[T],
): boolean => INCOME_STREAM_BEHAVIOR[type].countsTowardAnnualIncome(stream);

/** Whether `stream` contributes to {@link totalAnnualIncomeFromStreams}. */
export const countsTowardAnnualIncome = (stream: IncomeStream): boolean =>
  countsTowardAnnualIncomeOf(stream.type, stream);

/** Whether `stream` contributes to its category's subtotal in the income modal. */
export const countsTowardCategorySubtotal = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].countsTowardCategorySubtotal;

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
 * 必要経費 for business and miscellaneous income, as entered for reported investment income.
 */
export function totalAnnualIncomeFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) => (countsTowardAnnualIncome(s) ? sum + annualIncomeStreamAmount(s) : sum),
    0,
  );
}

/**
 * The 年間収入 the dependent-coverage test is judged on: the earned income among `streams`
 * ({@link isEarnedIncomeStream}). Investment income is left out whether or not it is reported.
 * The test is a social-insurance rule on 収入, not a tax rule on the return, so the reporting
 * election cannot be what decides it; which investment receipts count is a question of
 * 被扶養者認定 practice that is not modelled.
 */
export function dependentTestAnnualIncome(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) => (isEarnedIncomeStream(s) ? sum + annualIncomeStreamAmount(s) : sum),
    0,
  );
}
