// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import type { InvestmentIncomeAmounts } from '../types/tax';
import { calculateWithheldInvestmentTax, hasInvestmentIncome } from '../utils/investmentIncome';

const amounts = (overrides: Partial<InvestmentIncomeAmounts> = {}): InvestmentIncomeAmounts => ({
  listedCapitalGains: 0,
  listedDividends: 0,
  depositInterest: 0,
  ...overrides,
});

describe('hasInvestmentIncome', () => {
  it('is false when every amount is zero', () => {
    expect(hasInvestmentIncome(amounts())).toBe(false);
  });

  it('is true when any one amount is non-zero, including a loss', () => {
    expect(hasInvestmentIncome(amounts({ listedCapitalGains: -500_000 }))).toBe(true);
    expect(hasInvestmentIncome(amounts({ listedDividends: 1 }))).toBe(true);
    expect(hasInvestmentIncome(amounts({ depositInterest: 1 }))).toBe(true);
  });
});

describe('calculateWithheldInvestmentTax', () => {
  // 措法8条の4①・37条の11①: 15% national + 2.1% surtax = 15.315%; 地方税法71条の28・71条の49: 5%.
  it('withholds 15.315% national and 5% residence on gains plus dividends, in one account', () => {
    const result = calculateWithheldInvestmentTax(
      amounts({ listedCapitalGains: 1_000_000, listedDividends: 200_000 }),
      2026,
    );
    expect(result.listed).toEqual({ base: 1_200_000, national: 183_780, residence: 60_000 });
    expect(result.depositInterest).toEqual({ base: 0, national: 0, residence: 0 });
    expect(result.national).toBe(183_780);
    expect(result.residence).toBe(60_000);
    expect(result.total).toBe(243_780);
  });

  // 措法37条の11の6: a same-account 譲渡損 nets against 配当等 before withholding.
  it('nets a capital loss against dividends down to zero when the loss is larger', () => {
    const result = calculateWithheldInvestmentTax(
      amounts({ listedCapitalGains: -500_000, listedDividends: 300_000 }),
      2026,
    );
    expect(result.listed).toEqual({ base: 0, national: 0, residence: 0 });
    expect(result.total).toBe(0);
  });

  it('nets a capital loss against dividends, taxing only the remainder', () => {
    const result = calculateWithheldInvestmentTax(
      amounts({ listedCapitalGains: -500_000, listedDividends: 800_000 }),
      2026,
    );
    // base = 300,000; 300,000 * 0.15315 = 45,945; 300,000 * 0.05 = 15,000
    expect(result.listed).toEqual({ base: 300_000, national: 45_945, residence: 15_000 });
    expect(result.total).toBe(60_945);
  });

  it('withholds deposit interest independently of listed gains and dividends', () => {
    const result = calculateWithheldInvestmentTax(amounts({ depositInterest: 100_000 }), 2026);
    expect(result.depositInterest).toEqual({ base: 100_000, national: 15_315, residence: 5_000 });
    expect(result.listed).toEqual({ base: 0, national: 0, residence: 0 });
    expect(result.total).toBe(20_315);
  });

  it('sums both categories when both are present', () => {
    const result = calculateWithheldInvestmentTax(
      amounts({
        listedCapitalGains: 1_000_000,
        listedDividends: 200_000,
        depositInterest: 100_000,
      }),
      2026,
    );
    expect(result.national).toBe(183_780 + 15_315);
    expect(result.residence).toBe(60_000 + 5_000);
    expect(result.total).toBe(183_780 + 15_315 + 60_000 + 5_000);
  });

  it('truncates to the whole yen (floors, never rounds)', () => {
    // 1,234,567 * 0.15315 = 189,073.936..., * 0.05 = 61,728.35
    const result = calculateWithheldInvestmentTax(amounts({ listedDividends: 1_234_567 }), 2026);
    expect(result.listed.national).toBe(189_073);
    expect(result.listed.residence).toBe(61_728);
  });

  it('is all zero for all-zero amounts', () => {
    const result = calculateWithheldInvestmentTax(amounts(), 2026);
    expect(result).toEqual({
      listed: { base: 0, national: 0, residence: 0 },
      depositInterest: { base: 0, national: 0, residence: 0 },
      national: 0,
      residence: 0,
      total: 0,
    });
  });
});

describe('getInvestmentIncomeTaxRates', () => {
  it('returns the 2014-onward rates for every income year this calculator models', () => {
    for (const year of [2014, 2020, 2025, 2026]) {
      expect(getInvestmentIncomeTaxRates(year)).toEqual({
        effectiveYear: 2014,
        listedNationalRate: 0.15315,
        listedResidenceRate: 0.05,
        depositInterestNationalRate: 0.15315,
        depositInterestResidenceRate: 0.05,
      });
    }
  });
});
