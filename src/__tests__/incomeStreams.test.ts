// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  annualIncomeStreamAmount,
  countsTowardAnnualIncome,
  dependentTestAnnualIncome,
  isEarnedIncomeStream,
  monthlyIncomeStreamAmount,
  totalAnnualIncomeFromStreams,
  totalCommutingAllowanceFromStreams,
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

  it('excludes investment income settled by withholding, which stays off the return', () => {
    expect(
      totalAnnualIncomeFromStreams([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        {
          id: 'g1',
          type: 'capitalGains',
          shareType: 'listed',
          account: 'specifiedWithholding',
          taxTreatment: 'withheldOnly',
          amount: 2_000_000,
        },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          taxTreatment: 'withheldOnly',
          amount: 300_000,
        },
        { id: 'i1', type: 'interest', payerDomicile: 'domestic', amount: 100_000 },
      ]),
    ).toBe(1_000_000);
  });

  it('includes investment income reported under 申告分離課税, as entered', () => {
    expect(
      totalAnnualIncomeFromStreams([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        {
          id: 'g1',
          type: 'capitalGains',
          shareType: 'listed',
          account: 'foreign',
          taxTreatment: 'separate',
          amount: -200_000,
        },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          taxTreatment: 'separate',
          amount: 300_000,
        },
      ]),
    ).toBe(1_000_000 - 200_000 + 300_000);
  });
});

describe('dependentTestAnnualIncome', () => {
  it('counts earned income only, leaving investment income out whether or not it is reported', () => {
    expect(
      dependentTestAnnualIncome([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        { id: 'p1', type: 'publicPension', amount: 500_000 },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          taxTreatment: 'separate',
          amount: 300_000,
        },
        {
          id: 'd2',
          type: 'dividends',
          shareType: 'listed',
          taxTreatment: 'withheldOnly',
          amount: 300_000,
        },
        { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
      ]),
    ).toBe(1_500_000 + 10_000 * 12);
  });

  it('adds the annualized commuting allowance that annual income leaves out', () => {
    const streams: Parameters<typeof dependentTestAnnualIncome>[0] = [
      { id: 's1', type: 'salary', amount: 100_000, frequency: 'monthly' },
      { id: 'c1', type: 'commutingAllowance', amount: 15_000, frequency: 'monthly' },
    ];

    expect(totalAnnualIncomeFromStreams(streams)).toBe(1_200_000);
    expect(dependentTestAnnualIncome(streams)).toBe(1_200_000 + 15_000 * 12);
  });

  it('equals the annual income when there is no commuting allowance', () => {
    expect(
      dependentTestAnnualIncome([
        { id: 's1', type: 'salary', amount: 1_200_000, frequency: 'annual' },
      ]),
    ).toBe(1_200_000);
  });
});

describe('isEarnedIncomeStream', () => {
  it('is true for pay, business, miscellaneous and pension income and false for the rest', () => {
    expect(isEarnedIncomeStream({ id: 's1', type: 'salary', amount: 1, frequency: 'annual' })).toBe(
      true,
    );
    expect(isEarnedIncomeStream({ id: 'p1', type: 'publicPension', amount: 1 })).toBe(true);
    expect(
      isEarnedIncomeStream({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 1,
        frequency: 'monthly',
      }),
    ).toBe(false);
    expect(
      isEarnedIncomeStream({
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        taxTreatment: 'separate',
        amount: 1,
      }),
    ).toBe(false);
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
  it('includes investment income once it is reported', () => {
    expect(
      countsTowardAnnualIncome({
        id: 'g1',
        type: 'capitalGains',
        shareType: 'listed',
        account: 'domesticNoWithholding',
        taxTreatment: 'separate',
        amount: 10_000,
      }),
    ).toBe(true);
    expect(
      countsTowardAnnualIncome({
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        taxTreatment: 'separate',
        amount: 10_000,
      }),
    ).toBe(true);
  });

  it('excludes the commuting allowance (a reimbursement) and investment income settled by withholding', () => {
    expect(
      countsTowardAnnualIncome({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 10_000,
        frequency: 'monthly',
      }),
    ).toBe(false);
    expect(
      countsTowardAnnualIncome({
        id: 'g1',
        type: 'capitalGains',
        shareType: 'listed',
        account: 'specifiedWithholding',
        taxTreatment: 'withheldOnly',
        amount: -10_000,
      }),
    ).toBe(false);
    expect(
      countsTowardAnnualIncome({
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        taxTreatment: 'withheldOnly',
        amount: 10_000,
      }),
    ).toBe(false);
    expect(
      countsTowardAnnualIncome({
        id: 'i1',
        type: 'interest',
        payerDomicile: 'domestic',
        amount: 10_000,
      }),
    ).toBe(false);
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

describe('totalCommutingAllowanceFromStreams', () => {
  it('annualizes every commuting allowance by its frequency and ignores other streams', () => {
    expect(
      totalCommutingAllowanceFromStreams([
        { id: 's1', type: 'salary', amount: 3_000_000, frequency: 'annual' },
        { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
        { id: 'c2', type: 'commutingAllowance', amount: 60_000, frequency: '6-months' },
      ]),
    ).toBe(10_000 * 12 + 60_000 * 2);
  });

  it('returns 0 when no stream is a commuting allowance', () => {
    expect(
      totalCommutingAllowanceFromStreams([{ id: 'm1', type: 'miscellaneous', amount: 500_000 }]),
    ).toBe(0);
  });
});

