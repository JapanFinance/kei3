// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream, IncomeStream, IncomeStreamType } from '../types/tax';

/** The member of the {@link IncomeStream} union discriminated by `T`. */
type IncomeStreamOfType<T extends IncomeStreamType> = Extract<IncomeStream, { type: T }>;

interface IncomeStreamBehavior<T extends IncomeStreamType> {
  /** Whether streams of this type are part of {@link totalAnnualIncomeFromStreams}. */
  countsTowardAnnualIncome: boolean;
  /** The amount the stream represents over a year, from however its amount is entered. */
  annualAmount: (stream: IncomeStreamOfType<T>) => number;
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

/** The amount `stream` represents over a year. */
export const annualIncomeStreamAmount = (stream: IncomeStream): number =>
  // The table is keyed by the same discriminant that narrows `stream`, but TypeScript cannot
  // correlate an indexed access with that narrowing (microsoft/TypeScript#30581), so the
  // entry's parameter type widens to `never` at this one call.
  (INCOME_STREAM_BEHAVIOR[stream.type].annualAmount as (s: IncomeStream) => number)(stream);

/** Returns the annualized amount for a commuting allowance income stream. */
export const getCommutingAllowanceAnnualAmount = (stream: CommutingAllowanceIncomeStream): number =>
  INCOME_STREAM_BEHAVIOR.commutingAllowance.annualAmount(stream);

/**
 * Total annual income represented by a set of income streams: every stream that
 * {@link countsTowardAnnualIncome}, at its {@link annualIncomeStreamAmount}.
 */
export function totalAnnualIncomeFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) => (countsTowardAnnualIncome(s) ? sum + annualIncomeStreamAmount(s) : sum),
    0,
  );
}
