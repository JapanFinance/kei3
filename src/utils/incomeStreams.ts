// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CommutingAllowanceIncomeStream, IncomeStream, IncomeStreamType } from '../types/tax';

/**
 * Whether each stream type is part of the taxpayer's income. A commuting allowance (通勤手当)
 * reimburses a cost rather than paying for work, so it is the only type excluded.
 *
 * Consumed through {@link countsTowardAnnualIncome}; adding a stream type must answer here.
 */
const COUNTS_TOWARD_ANNUAL_INCOME: Record<IncomeStreamType, boolean> = {
  salary: true,
  bonus: true,
  business: true,
  miscellaneous: true,
  publicPension: true,
  stockCompensation: true,
  commutingAllowance: false,
};

/** Whether `stream` contributes to {@link totalAnnualIncomeFromStreams}. */
export const countsTowardAnnualIncome = (stream: IncomeStream): boolean =>
  COUNTS_TOWARD_ANNUAL_INCOME[stream.type];

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
 * Returns the annualized amount for a commuting allowance income stream.
 */
export const getCommutingAllowanceAnnualAmount = (stream: CommutingAllowanceIncomeStream): number =>
  stream.amount * getFrequencyAnnualMultiplier(stream.frequency);

/**
 * The annual amount of a single stream: salary and commuting allowance are entered per period
 * and annualized by their frequency, every other type is entered as an annual amount.
 */
export const annualIncomeStreamAmount = (stream: IncomeStream): number => {
  switch (stream.type) {
    case 'salary':
      return stream.frequency === 'monthly' ? stream.amount * 12 : stream.amount;
    case 'commutingAllowance':
      return getCommutingAllowanceAnnualAmount(stream);
    default:
      return stream.amount;
  }
};

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
