// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  annualIncomeContribution,
  annualIncomeStreamAmount,
  dependentTestAnnualIncome,
  isEarnedIncomeStream,
  monthlyIncomeStreamAmount,
  totalAnnualIncomeFromStreams,
  totalCommutingAllowanceFromStreams,
  validateIncomeStream,
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

  it('includes investment income settled by withholding, as entered', () => {
    expect(
      totalAnnualIncomeFromStreams([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        {
          id: 'g1',
          type: 'withholdingAccount',
          capitalGains: 2_000_000,
          dividends: 0,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
        },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 300_000,
        },
        { id: 'i1', type: 'interest', payerDomicile: 'domestic', amount: 100_000, foreignTax: 0 },
      ]),
    ).toBe(1_000_000 + 2_000_000 + 300_000 + 100_000);
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
          amount: -200_000,
        },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 300_000,
        },
      ]),
    ).toBe(1_000_000 - 200_000 + 300_000);
  });
});

describe('dependentTestAnnualIncome', () => {
  it('counts earned income, the commuting allowance, and dividends and interest gross whatever their election', () => {
    expect(
      dependentTestAnnualIncome([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        {
          id: 'p1',
          type: 'publicPension',
          payerDomicile: 'domestic',
          foreignTax: 0,
          amount: 500_000,
        },
        {
          id: 'd1',
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 300_000,
        },
        {
          id: 'd2',
          type: 'dividends',
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
          amount: 300_000,
        },
        { id: 'i1', type: 'interest', payerDomicile: 'domestic', amount: 100_000, foreignTax: 0 },
        { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
      ]),
    ).toBe(1_500_000 + 300_000 * 2 + 100_000 + 10_000 * 12);
  });

  it('counts a year of capital gains netted across accounts, and nothing in a losing year', () => {
    const salary = {
      id: 's1',
      type: 'salary' as const,
      amount: 1_000_000,
      frequency: 'annual' as const,
    };

    // +500,000 in a withholding account and −200,000 in a foreign one: the year's gains are 300,000.
    expect(
      dependentTestAnnualIncome([
        salary,
        {
          id: 'g1',
          type: 'withholdingAccount',
          capitalGains: 500_000,
          dividends: 0,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
        },
        {
          id: 'g2',
          type: 'capitalGains',
          shareType: 'listed',
          account: 'foreign',
          amount: -200_000,
        },
      ]),
    ).toBe(1_300_000);

    // A losing year adds nothing and is not netted against the dividends of the same account.
    expect(
      dependentTestAnnualIncome([
        salary,
        {
          id: 'g1',
          type: 'withholdingAccount',
          capitalGains: -500_000,
          dividends: 300_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
        },
      ]),
    ).toBe(1_300_000);
  });

  it('adds the annualized commuting allowance that annual income leaves out', () => {
    const streams: Parameters<typeof dependentTestAnnualIncome>[0] = [
      { id: 's1', type: 'salary', amount: 100_000, frequency: 'monthly' },
      { id: 'c1', type: 'commutingAllowance', amount: 15_000, frequency: 'monthly' },
    ];

    expect(totalAnnualIncomeFromStreams(streams)).toBe(1_200_000);
    expect(dependentTestAnnualIncome(streams)).toBe(1_200_000 + 15_000 * 12);
  });

  it('floors business income at zero for dependent testing and does not reduce other earnings', () => {
    expect(
      dependentTestAnnualIncome([
        { id: 's1', type: 'salary', amount: 1_000_000, frequency: 'annual' },
        { id: 'b1', type: 'business', amount: -400_000, blueFilerDeduction: 0 },
      ]),
    ).toBe(1_000_000);

    expect(
      dependentTestAnnualIncome([
        { id: 'b1', type: 'business', amount: 500_000, blueFilerDeduction: 650_000 },
      ]),
    ).toBe(500_000);
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
    expect(
      isEarnedIncomeStream({
        id: 'p1',
        type: 'publicPension',
        payerDomicile: 'domestic',
        foreignTax: 0,
        amount: 1,
      }),
    ).toBe(true);
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
        paymentChannel: 'domestic',
        isReported: true,
        issuerDomicile: 'domestic',
        foreignTax: 0,
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
    expect(
      annualIncomeStreamAmount({
        id: 'p1',
        type: 'publicPension',
        payerDomicile: 'domestic',
        foreignTax: 0,
        amount: 1_800_000,
      }),
    ).toBe(1_800_000);
  });
});

describe('annualIncomeContribution', () => {
  it('includes investment income that is reported', () => {
    expect(
      annualIncomeContribution({
        id: 'g1',
        type: 'capitalGains',
        shareType: 'listed',
        account: 'domesticNoWithholding',
        amount: 10_000,
      }),
    ).toBe(10_000);
    expect(
      annualIncomeContribution({
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: true,
        issuerDomicile: 'domestic',
        foreignTax: 0,
        amount: 10_000,
      }),
    ).toBe(10_000);
  });

  it('includes investment income settled by withholding and excludes only the commuting allowance', () => {
    expect(
      annualIncomeContribution({
        id: 'c1',
        type: 'commutingAllowance',
        amount: 10_000,
        frequency: 'monthly',
      }),
    ).toBe(0);
    expect(
      annualIncomeContribution({
        id: 'g1',
        type: 'withholdingAccount',
        capitalGains: -10_000,
        dividends: 0,
        foreignDividends: 0,
        foreignTax: 0,
        reportsCapitalGains: false,
        reportsDividends: false,
      }),
    ).toBe(-10_000);
    expect(
      annualIncomeContribution({
        id: 'd1',
        type: 'dividends',
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        issuerDomicile: 'domestic',
        foreignTax: 0,
        amount: 10_000,
      }),
    ).toBe(10_000);
    expect(
      annualIncomeContribution({
        id: 'i1',
        type: 'interest',
        payerDomicile: 'domestic',
        foreignTax: 0,
        amount: 10_000,
      }),
    ).toBe(10_000);
    // A monthly amount contributes its annualized total, not the entered amount.
    expect(
      annualIncomeContribution({ id: 's1', type: 'salary', amount: 10_000, frequency: 'monthly' }),
    ).toBe(120_000);
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

describe('validateIncomeStream', () => {
  it('accepts valid streams of all 11 types', () => {
    expect(
      validateIncomeStream({ id: '1', type: 'salary', amount: 5_000_000, frequency: 'annual' }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({ id: '2', type: 'bonus', amount: 1_000_000, month: 5 }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '3',
        type: 'business',
        amount: 2_000_000,
        blueFilerDeduction: 650_000,
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({ id: '4', type: 'miscellaneous', amount: 500_000 }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '5',
        type: 'publicPension',
        amount: 1_500_000,
        payerDomicile: 'domestic',
        foreignTax: 0,
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '6',
        type: 'stockCompensation',
        amount: 800_000,
        issuerDomicile: 'foreign',
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '7',
        type: 'commutingAllowance',
        amount: 150_000,
        frequency: 'monthly',
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '8',
        type: 'withholdingAccount',
        capitalGains: 1_000_000,
        dividends: 200_000,
        foreignDividends: 0,
        foreignTax: 0,
        reportsCapitalGains: false,
        reportsDividends: false,
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '9',
        type: 'capitalGains',
        amount: 500_000,
        shareType: 'listed',
        account: 'domesticNoWithholding',
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '10',
        type: 'dividends',
        amount: 300_000,
        shareType: 'listed',
        paymentChannel: 'domestic',
        isReported: false,
        issuerDomicile: 'domestic',
        foreignTax: 0,
      }),
    ).toBeUndefined();
    expect(
      validateIncomeStream({
        id: '11',
        type: 'interest',
        amount: 100_000,
        payerDomicile: 'domestic',
        foreignTax: 0,
      }),
    ).toBeUndefined();
  });

  describe('commuting allowance monthly cap', () => {
    it.each([
      { frequency: 'monthly' as const, valid: 150_000, invalid: 150_001 },
      { frequency: '3-months' as const, valid: 450_000, invalid: 450_001 },
      { frequency: '6-months' as const, valid: 900_000, invalid: 900_001 },
      { frequency: 'annual' as const, valid: 1_800_000, invalid: 1_800_001 },
    ])('validates cap across frequency $frequency', ({ frequency, valid, invalid }) => {
      expect(
        validateIncomeStream({ id: 'c', type: 'commutingAllowance', amount: valid, frequency }),
      ).toBeUndefined();
      expect(
        validateIncomeStream({ id: 'c', type: 'commutingAllowance', amount: invalid, frequency }),
      ).toContain('Commuting allowance cannot exceed ¥150,000/month (non-taxable cap)');
    });
  });

  describe('business income', () => {
    it('accepts negative business income', () => {
      expect(
        validateIncomeStream({ id: 'b', type: 'business', amount: -1, blueFilerDeduction: 0 }),
      ).toBeUndefined();
    });
  });

  describe('public pension', () => {
    it('validates foreign tax entry invariants', () => {
      expect(
        validateIncomeStream({
          id: 'p',
          type: 'publicPension',
          amount: 1_000_000,
          payerDomicile: 'domestic',
          foreignTax: 10_000,
        }),
      ).toBe('Foreign tax can be entered only for a pension from a foreign system.');
    });
  });

  describe('withholding account', () => {
    it('rejects foreign tax errors', () => {
      expect(
        validateIncomeStream({
          id: 'w',
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: 100_000,
          foreignDividends: 0,
          foreignTax: -1,
          reportsCapitalGains: false,
          reportsDividends: false,
        }),
      ).toBe('Foreign tax cannot be negative.');
    });

    it('rejects negative dividends', () => {
      expect(
        validateIncomeStream({
          id: 'w',
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: -1,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false,
        }),
      ).toBe('Dividends cannot be negative.');
    });

    it('rejects unreported dividends when reported loss reduced withholding', () => {
      expect(
        validateIncomeStream({
          id: 'w',
          type: 'withholdingAccount',
          capitalGains: -100_000,
          dividends: 200_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: true,
          reportsDividends: false,
        }),
      ).toBe(
        "A reported loss that reduced this account's dividend withholding must be reported together with the dividends (措法37条の11の6⑩).",
      );
    });
  });

  describe('capital gains', () => {
    it('rejects non-listed shares', () => {
      expect(
        validateIncomeStream({
          id: 'cg',
          type: 'capitalGains',
          amount: 100_000,
          shareType: 'other',
          account: 'domesticNoWithholding',
        }),
      ).toBe('Capital gains on 一般株式等 are not currently supported.');
    });
  });

  describe('dividends', () => {
    it('rejects non-listed shares', () => {
      expect(
        validateIncomeStream({
          id: 'd',
          type: 'dividends',
          amount: 100_000,
          shareType: 'other',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        }),
      ).toBe('Dividends on 一般株式等 are not currently supported.');
    });

    it('rejects negative dividends', () => {
      expect(
        validateIncomeStream({
          id: 'd',
          type: 'dividends',
          amount: -1,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        }),
      ).toBe('Dividends cannot be negative.');
    });

    it('rejects unreported dividend received outside Japan', () => {
      expect(
        validateIncomeStream({
          id: 'd',
          type: 'dividends',
          amount: 100_000,
          shareType: 'listed',
          paymentChannel: 'abroad',
          isReported: false,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        }),
      ).toBe(
        'A dividend received outside Japan with no Japanese handler must be reported (措令4条の3②).',
      );
    });
  });

  describe('interest', () => {
    it('rejects negative interest', () => {
      expect(
        validateIncomeStream({
          id: 'i',
          type: 'interest',
          amount: -1,
          payerDomicile: 'domestic',
          foreignTax: 0,
        }),
      ).toBe('Interest cannot be negative.');
    });
  });
});
