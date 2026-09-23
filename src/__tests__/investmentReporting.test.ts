// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import type {
  DividendsIncomeStream,
  IncomeStream,
  WithholdingAccountIncomeStream,
} from '../types/tax';
import {
  dividendMustBeReported,
  withholdingAccountDividendsMustBeReported,
  withRequiredReporting,
} from '../utils/investmentReporting';

describe('withholdingAccountDividendsMustBeReported', () => {
  it('is true when a reported loss reduced the dividends withheld in the same account', () => {
    expect(
      withholdingAccountDividendsMustBeReported({
        capitalGains: -500_000,
        dividends: 800_000,
        reportsCapitalGains: true,
      }),
    ).toBe(true);
  });

  it('is false when the loss is not reported', () => {
    expect(
      withholdingAccountDividendsMustBeReported({
        capitalGains: -500_000,
        dividends: 800_000,
        reportsCapitalGains: false,
      }),
    ).toBe(false);
  });

  it('is false when the account has a gain rather than a loss', () => {
    expect(
      withholdingAccountDividendsMustBeReported({
        capitalGains: 500_000,
        dividends: 800_000,
        reportsCapitalGains: true,
      }),
    ).toBe(false);
  });

  it('is false when the account has no dividends to reduce', () => {
    expect(
      withholdingAccountDividendsMustBeReported({
        capitalGains: -500_000,
        dividends: 0,
        reportsCapitalGains: true,
      }),
    ).toBe(false);
  });
});

describe('dividendMustBeReported', () => {
  it('is true for a dividend paid abroad', () => {
    expect(dividendMustBeReported({ paymentChannel: 'abroad' })).toBe(true);
  });

  it('is false for a domestic dividend', () => {
    expect(dividendMustBeReported({ paymentChannel: 'domestic' })).toBe(false);
  });
});

describe('withRequiredReporting', () => {
  it("forces an account whose reported loss reduced its dividends' withholding to report them too", () => {
    const account: WithholdingAccountIncomeStream = {
      id: 'a1',
      type: 'withholdingAccount',
      capitalGains: -500_000,
      dividends: 800_000,
      reportsCapitalGains: true,
      reportsDividends: false,
    };
    expect(withRequiredReporting(account)).toEqual({ ...account, reportsDividends: true });
  });

  it('returns an account whose loss is not reported unchanged', () => {
    const account: WithholdingAccountIncomeStream = {
      id: 'a1',
      type: 'withholdingAccount',
      capitalGains: -500_000,
      dividends: 800_000,
      reportsCapitalGains: false,
      reportsDividends: false,
    };
    expect(withRequiredReporting(account)).toBe(account);
  });

  it('forces a dividend paid abroad to be reported', () => {
    const dividend: DividendsIncomeStream = {
      id: 'd1',
      type: 'dividends',
      shareType: 'listed',
      paymentChannel: 'abroad',
      isReported: false,
      amount: 1_000_000,
    };
    expect(withRequiredReporting(dividend)).toEqual({ ...dividend, isReported: true });
  });

  it('returns a domestic dividend unchanged', () => {
    const dividend: DividendsIncomeStream = {
      id: 'd1',
      type: 'dividends',
      shareType: 'listed',
      paymentChannel: 'domestic',
      isReported: false,
      amount: 1_000_000,
    };
    expect(withRequiredReporting(dividend)).toBe(dividend);
  });

  it('returns every other stream type unchanged', () => {
    const salary: IncomeStream = {
      id: 's1',
      type: 'salary',
      amount: 5_000_000,
      frequency: 'annual',
    };
    expect(withRequiredReporting(salary)).toBe(salary);

    const gains: IncomeStream = {
      id: 'g1',
      type: 'capitalGains',
      shareType: 'listed',
      account: 'foreign',
      amount: -500_000,
    };
    expect(withRequiredReporting(gains)).toBe(gains);
  });
});
