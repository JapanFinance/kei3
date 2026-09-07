// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream, IncomeStream, IncomeStreamType } from '../types/tax';

/** The member of the {@link IncomeStream} union discriminated by `T`, by discriminant. */
type IncomeStreamOfType = { [T in IncomeStreamType]: Extract<IncomeStream, { type: T }> };

interface IncomeStreamBehavior<T extends IncomeStreamType> {
  /**
   * Whether streams of this type are income at all. Not "is it taxable" and not "does it
   * grow with earnings": a type that is income but is asset-based rather than earned still
   * answers true here and needs its own property for that distinction.
   */
  countsTowardAnnualIncome: boolean;
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
    annualAmount: s => (s.frequency === 'monthly' ? s.amount * 12 : s.amount),
  },
  bonus: { countsTowardAnnualIncome: true, annualAmount: s => s.amount },
  business: { countsTowardAnnualIncome: true, annualAmount: s => s.amount },
  miscellaneous: { countsTowardAnnualIncome: true, annualAmount: s => s.amount },
  publicPension: { countsTowardAnnualIncome: true, annualAmount: s => s.amount },
  stockCompensation: { countsTowardAnnualIncome: true, annualAmount: s => s.amount },
  // A commuting allowance (通勤手当) reimburses a cost rather than paying for work.
  commutingAllowance: {
    countsTowardAnnualIncome: false,
    annualAmount: s => s.amount * getFrequencyAnnualMultiplier(s.frequency),
  },
};

/** Whether `stream` contributes to {@link totalAnnualIncomeFromStreams}. */
export const countsTowardAnnualIncome = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].countsTowardAnnualIncome;

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

/** The annualized total of every commuting allowance among `streams`. */
export function totalCommutingAllowanceFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) =>
      s.type === 'commutingAllowance' ? sum + getCommutingAllowanceAnnualAmount(s) : sum,
    0,
  );
}

/**
 * The 年間収入 the dependent-coverage test is judged on: annual income plus the annualized
 * commuting allowance. The allowance is the one amount the two figures disagree on — annual
 * income leaves it out as a cost reimbursement, while 認定 reads 年間収入 off the 労働基準法
 * 第11条 賃金, which includes 諸手当, and a labour contract stating only 「通勤手当有」 without
 * an amount is one the 保険者 cannot judge on. Its income-tax non-taxability does not exempt
 * it, that being a tax rule rather than a 社会保険 one.
 *
 * Source: 日本年金機構「労働契約内容による年間収入での被扶養者の認定の取り扱いについて」
 * https://www.nenkin.go.jp/oshirase/taisetu/jigyosho/2026/202605/0501.html
 */
export function dependentTestAnnualIncome(
  annualIncome: number,
  streams: readonly IncomeStream[],
): number {
  return annualIncome + totalCommutingAllowanceFromStreams(streams);
}
