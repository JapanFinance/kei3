// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  annualIncomeStreamAmount,
  countsTowardAnnualIncome,
  monthlyIncomeStreamAmount,
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

  it('excludes investment income (asset-based, taxed separately from earned income)', () => {
    expect(
      totalAnnualIncomeFromStreams([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        { id: 'g1', type: 'listedCapitalGains', amount: 2_000_000 },
        { id: 'd1', type: 'listedDividends', amount: 300_000 },
        { id: 'i1', type: 'depositInterest', amount: 100_000 },
      ]),
    ).toBe(1_000_000);
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
  it('excludes the commuting allowance (a reimbursement) and investment income (asset-based)', () => {
    expect(
      countsTowardAnnualIncome({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 10_000,
        frequency: 'monthly',
      }),
    ).toBe(false);
    expect(
      countsTowardAnnualIncome({ id: 'g1', type: 'listedCapitalGains', amount: -10_000 }),
    ).toBe(false);
    expect(countsTowardAnnualIncome({ id: 'd1', type: 'listedDividends', amount: 10_000 })).toBe(
      false,
    );
    expect(countsTowardAnnualIncome({ id: 'i1', type: 'depositInterest', amount: 10_000 })).toBe(
      false,
    );
    expect(
      countsTowardAnnualIncome({ id: 's1', type: 'salary', amount: 10_000, frequency: 'monthly' }),
    ).toBe(true);
  });
});

describe('monthlyIncomeStreamAmount', () => {
  it('returns the entered amount for a commuting allowance already entered per month', () => {
    expect(
      monthlyIncomeStreamAmount({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 20_000,
        frequency: 'monthly',
      }),
    ).toBe(20_000);
  });

  it.each([
    { frequency: '3-months' as const, amount: 60_000, monthly: 20_000 },
    { frequency: '6-months' as const, amount: 120_000, monthly: 20_000 },
    { frequency: 'annual' as const, amount: 240_000, monthly: 20_000 },
  ])(
    'divides a $frequency commuting allowance down to a month',
    ({ frequency, amount, monthly }) => {
      expect(
        monthlyIncomeStreamAmount({ id: 'c1', type: 'commutingAllowance', amount, frequency }),
      ).toBe(monthly);
    },
  );

  // The 標準報酬月額 band a premium is read from turns on this value, so a per-period amount
  // that does not divide evenly has to give the same double as dividing it directly.
  it.each([
    { frequency: '3-months' as const, divisor: 3 },
    { frequency: '6-months' as const, divisor: 6 },
    { frequency: 'annual' as const, divisor: 12 },
  ])(
    'matches an exact division of a $frequency amount that does not divide evenly',
    ({ frequency, divisor }) => {
      for (let amount = 1; amount <= 2_000; amount++) {
        expect(
          monthlyIncomeStreamAmount({ id: 'c1', type: 'commutingAllowance', amount, frequency }),
        ).toBe(amount / divisor);
      }
    },
  );

  it('returns a twelfth of a salary entered annually and the entered amount when monthly', () => {
    expect(
      monthlyIncomeStreamAmount({
        id: 's1',
        type: 'salary',
        amount: 6_000_000,
        frequency: 'annual',
      }),
    ).toBe(500_000);
    expect(
      monthlyIncomeStreamAmount({
        id: 's2',
        type: 'salary',
        amount: 494_999,
        frequency: 'monthly',
      }),
    ).toBe(494_999);
  });
});
