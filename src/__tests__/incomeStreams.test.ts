// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  annualIncomeStreamAmount,
  countsTowardAnnualIncome,
  totalAnnualIncomeFromStreams,
} from '../utils/incomeStreams';

describe('totalAnnualIncomeFromStreams', () => {
  it('annualizes monthly salaries, excludes commuting allowance, and sums everything else', () => {
    expect(
      totalAnnualIncomeFromStreams([
        { id: 's1', type: 'salary', amount: 300_000, frequency: 'monthly' },
        { id: 's2', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
        { id: 'b1', type: 'bonus', amount: 500_000, month: 5 },
        { id: 'm1', type: 'miscellaneous', amount: 200_000 },
      ]),
    ).toBe(300_000 * 12 + 1_000_000 + 500_000 + 200_000);
  });

  it('returns 0 for an empty stream list', () => {
    expect(totalAnnualIncomeFromStreams([])).toBe(0);
  });
});

describe('annualIncomeStreamAmount', () => {
  it('annualizes a commuting allowance by its payment frequency', () => {
    expect(
      annualIncomeStreamAmount({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 30_000,
        frequency: '3-months',
      }),
    ).toBe(120_000);
  });

  it('takes every other type at its entered amount', () => {
    expect(annualIncomeStreamAmount({ id: 'p1', type: 'publicPension', amount: 1_800_000 })).toBe(
      1_800_000,
    );
  });
});

describe('countsTowardAnnualIncome', () => {
  it('excludes only the commuting allowance', () => {
    expect(
      countsTowardAnnualIncome({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 10_000,
        frequency: 'monthly',
      }),
    ).toBe(false);
    expect(
      countsTowardAnnualIncome({ id: 's1', type: 'salary', amount: 10_000, frequency: 'monthly' }),
    ).toBe(true);
  });
});
