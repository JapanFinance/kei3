// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import type { InvestmentIncomeAmounts } from '../types/tax';
import {
  calculateWithheldInvestmentTax,
  hasInvestmentIncome,
  withholdingAccountBase,
} from '../utils/investmentIncome';

const amounts = (overrides: Partial<InvestmentIncomeAmounts> = {}): InvestmentIncomeAmounts => ({
  capitalGains: 0,
  dividends: 0,
  interest: 0,
  ...overrides,
});

describe('hasInvestmentIncome', () => {
  it('is false when every amount is zero', () => {
    expect(hasInvestmentIncome(amounts())).toBe(false);
  });

  it('is true when any one amount is non-zero, including a loss', () => {
    expect(hasInvestmentIncome(amounts({ capitalGains: -500_000 }))).toBe(true);
    expect(hasInvestmentIncome(amounts({ dividends: 1 }))).toBe(true);
    expect(hasInvestmentIncome(amounts({ interest: 1 }))).toBe(true);
  });
});

describe('withholdingAccountBase', () => {
  // 措法37条の11の6⑥: a same-account 譲渡損 nets against 配当等 before withholding.
  it('nets a capital loss against dividends down to zero when the loss is larger', () => {
    expect(withholdingAccountBase(-500_000, 300_000)).toBe(0);
  });

  it('nets a capital loss against dividends, leaving only the remainder', () => {
    expect(withholdingAccountBase(-500_000, 800_000)).toBe(300_000);
  });

  it('is the sum of the two when the gain is positive', () => {
    expect(withholdingAccountBase(1_000_000, 200_000)).toBe(1_200_000);
  });
});

describe('calculateWithheldInvestmentTax', () => {
  // 措法8条の4①・37条の11①: 15% national + 2.1% surtax = 15.315%; 地方税法71条の28・71条の49: 5%.
  it('withholds 15.315% national and 5% residence on the listed base', () => {
    const result = calculateWithheldInvestmentTax({ listed: 1_200_000, interest: 0 }, 2026);
    // 1,200,000 * 0.15315 = 183,780; 1,200,000 * 0.05 = 60,000
    expect(result).toEqual({ national: 183_780, residence: 60_000, total: 243_780 });
  });

  it('withholds deposit interest independently of the listed base', () => {
    const result = calculateWithheldInvestmentTax({ listed: 0, interest: 100_000 }, 2026);
    // 100,000 * 0.15315 = 15,315; 100,000 * 0.05 = 5,000
    expect(result).toEqual({ national: 15_315, residence: 5_000, total: 20_315 });
  });

  it('sums both categories when both are present', () => {
    const result = calculateWithheldInvestmentTax({ listed: 1_200_000, interest: 100_000 }, 2026);
    expect(result.national).toBe(183_780 + 15_315);
    expect(result.residence).toBe(60_000 + 5_000);
    expect(result.total).toBe(183_780 + 15_315 + 60_000 + 5_000);
  });

  it('truncates to the whole yen (floors, never rounds)', () => {
    // 1,234,567 * 0.15315 = 189,073.936..., * 0.05 = 61,728.35
    const result = calculateWithheldInvestmentTax({ listed: 1_234_567, interest: 0 }, 2026);
    expect(result.national).toBe(189_073);
    expect(result.residence).toBe(61_728);
  });

  it('is all zero for all-zero bases', () => {
    const result = calculateWithheldInvestmentTax({ listed: 0, interest: 0 }, 2026);
    expect(result).toEqual({ national: 0, residence: 0, total: 0 });
  });
});

describe('getInvestmentIncomeTaxRates', () => {
  it('returns the 2014-onward rates for every income year this calculator models', () => {
    for (const year of [2014, 2020, 2025, 2026]) {
      expect(getInvestmentIncomeTaxRates(year)).toEqual({
        effectiveYear: 2014,
        listedNationalRate: 0.15315,
        listedResidenceRate: 0.05,
        interestNationalRate: 0.15315,
        interestResidenceRate: 0.05,
        listedAssessedNationalRate: 0.15,
        listedAssessedMunicipalRate: 0.03,
        listedAssessedPrefecturalRate: 0.02,
      });
    }
  });
});
