// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import { percentTo } from '../data/rate';
import {
  applyDeductionSpillover,
  calculateSeparateNationalIncomeTaxBase,
  calculateWithheldInvestmentTax,
  calculateReportedSeparateInvestmentIncomeTaxationBase,
  floorTaxableIncome,
  hasSeparateTaxationReportedInvestmentIncome,
  withholdingAccountBase,
} from '../utils/investmentIncome';

describe('withholdingAccountBase', () => {
  // 措法37条の11の6⑥: a same-account 譲渡損 nets against 配当等 before withholding.
  it('nets a capital loss against dividends down to zero when the loss is larger', () => {
    expect(withholdingAccountBase(-500_000, 300_000, 0)).toBe(0);
  });

  it('nets a capital loss against dividends, leaving only the remainder', () => {
    expect(withholdingAccountBase(-500_000, 800_000, 0)).toBe(300_000);
  });

  it('is the sum of the two when the gain is positive', () => {
    expect(withholdingAccountBase(1_000_000, 200_000, 0)).toBe(1_200_000);
  });

  // 措法9条の2③: the withholding is on the dividends after the foreign tax, and 措法37条の11の6⑥
  // nets the loss against that amount.
  it('charges the dividends after the foreign tax withheld on them', () => {
    // 800,000 − 50,000 = 750,000.
    expect(withholdingAccountBase(0, 800_000, 50_000)).toBe(750_000);
  });

  it('nets a loss against the dividends after the foreign tax', () => {
    // −500,000 + 800,000 − 50,000 = 250,000; with a −800,000 loss, max(0, −50,000) = 0.
    expect(withholdingAccountBase(-500_000, 800_000, 50_000)).toBe(250_000);
    expect(withholdingAccountBase(-800_000, 800_000, 50_000)).toBe(0);
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

const percent = percentTo(3);

describe('getInvestmentIncomeTaxRates', () => {
  it('returns the 2014-onward rates for every income year this calculator models', () => {
    for (const year of [2014, 2020, 2025, 2026]) {
      expect(getInvestmentIncomeTaxRates(year)).toEqual({
        effectiveYear: 2014,
        listedWithholdingNationalRate: percent(15.315),
        listedWithholdingResidenceRate: percent(5),
        interestWithholdingNationalRate: percent(15.315),
        interestWithholdingResidenceRate: percent(5),
        listedReportedNationalRate: percent(15),
        listedReportedMunicipalRate: percent(3),
        listedReportedPrefecturalRate: percent(2),
      });
    }
  });
});

describe('hasSeparateTaxationReportedInvestmentIncome', () => {
  it('is false when both capital gains and dividends are zero', () => {
    expect(
      hasSeparateTaxationReportedInvestmentIncome({
        capitalGains: 0,
        dividends: 0,
      }),
    ).toBe(false);
  });

  it('is true when capital gains is non-zero (gain or loss)', () => {
    expect(
      hasSeparateTaxationReportedInvestmentIncome({
        capitalGains: 100_000,
        dividends: 0,
      }),
    ).toBe(true);
    expect(
      hasSeparateTaxationReportedInvestmentIncome({
        capitalGains: -100_000,
        dividends: 0,
      }),
    ).toBe(true);
  });

  it('is true when dividends is non-zero', () => {
    expect(
      hasSeparateTaxationReportedInvestmentIncome({
        capitalGains: 0,
        dividends: 50_000,
      }),
    ).toBe(true);
  });
});

describe('classifyReportedInvestmentIncome', () => {
  it('leaves positive capital gains and dividends un-netted', () => {
    const result = calculateReportedSeparateInvestmentIncomeTaxationBase({
      capitalGains: 1_000_000,
      dividends: 500_000,
      qualifyingCapitalLosses: 0,
    });
    expect(result).toEqual({
      gross: { capitalGains: 1_000_000, dividends: 500_000 },
      lossOffsetAgainstDividends: 0,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 1_000_000, dividends: 500_000 },
    });
  });

  it('nets qualifying capital loss against dividends when loss is smaller than dividends', () => {
    const result = calculateReportedSeparateInvestmentIncomeTaxationBase({
      capitalGains: -300_000,
      dividends: 500_000,
      qualifyingCapitalLosses: 300_000,
    });
    expect(result).toEqual({
      gross: { capitalGains: -300_000, dividends: 500_000 },
      lossOffsetAgainstDividends: 300_000,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 0, dividends: 200_000 },
    });
  });

  it('nets qualifying capital loss against dividends up to dividend amount and leaves unabsorbed loss', () => {
    const result = calculateReportedSeparateInvestmentIncomeTaxationBase({
      capitalGains: -800_000,
      dividends: 500_000,
      qualifyingCapitalLosses: 800_000,
    });
    expect(result).toEqual({
      gross: { capitalGains: -800_000, dividends: 500_000 },
      lossOffsetAgainstDividends: 500_000,
      unabsorbedQualifyingLoss: 300_000,
      nonQualifyingLoss: 0,
      netIncome: { capitalGains: 0, dividends: 0 },
    });
  });

  it('does not offset dividends with non-qualifying losses', () => {
    const result = calculateReportedSeparateInvestmentIncomeTaxationBase({
      capitalGains: -500_000,
      dividends: 500_000,
      qualifyingCapitalLosses: 0,
    });
    expect(result).toEqual({
      gross: { capitalGains: -500_000, dividends: 500_000 },
      lossOffsetAgainstDividends: 0,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 500_000,
      netIncome: { capitalGains: 0, dividends: 500_000 },
    });
  });

  it('splits mixed losses into qualifying (offsets dividends) and non-qualifying', () => {
    const result = calculateReportedSeparateInvestmentIncomeTaxationBase({
      capitalGains: -600_000,
      dividends: 400_000,
      qualifyingCapitalLosses: 200_000,
    });
    expect(result).toEqual({
      gross: { capitalGains: -600_000, dividends: 400_000 },
      lossOffsetAgainstDividends: 200_000,
      unabsorbedQualifyingLoss: 0,
      nonQualifyingLoss: 400_000,
      netIncome: { capitalGains: 0, dividends: 200_000 },
    });
  });
});

describe('applyDeductionSpillover', () => {
  it('absorbs deductions fully in aggregate income when sufficient', () => {
    const result = applyDeductionSpillover(
      { aggregate: 5_000_000, dividends: 1_000_000, capitalGains: 2_000_000 },
      3_000_000,
    );
    expect(result).toEqual({
      aggregate: 2_000_000,
      dividends: 1_000_000,
      capitalGains: 2_000_000,
    });
  });

  it('spills unabsorbed deductions into separate dividends first', () => {
    const result = applyDeductionSpillover(
      { aggregate: 2_000_000, dividends: 1_000_000, capitalGains: 2_000_000 },
      2_500_000,
    );
    expect(result).toEqual({
      aggregate: 0,
      dividends: 500_000,
      capitalGains: 2_000_000,
    });
  });

  it('spills through dividends into capital gains', () => {
    const result = applyDeductionSpillover(
      { aggregate: 1_000_000, dividends: 1_000_000, capitalGains: 2_000_000 },
      2_500_000,
    );
    expect(result).toEqual({
      aggregate: 0,
      dividends: 0,
      capitalGains: 1_500_000,
    });
  });

  it('floors all classes to 0 when deductions exceed total income', () => {
    const result = applyDeductionSpillover(
      { aggregate: 1_000_000, dividends: 500_000, capitalGains: 500_000 },
      5_000_000,
    );
    expect(result).toEqual({
      aggregate: 0,
      dividends: 0,
      capitalGains: 0,
    });
  });

  it('leaves classes unchanged when deductions is zero or negative', () => {
    const initial = { aggregate: 1_000_000, dividends: 500_000, capitalGains: 500_000 };
    expect(applyDeductionSpillover(initial, 0)).toEqual(initial);
    expect(applyDeductionSpillover(initial, -100_000)).toEqual(initial);
  });

  it('handles negative aggregate income (e.g. business operating loss)', () => {
    // When aggregate income has an operating loss, it cannot absorb deductions.
    // All deductions spill over to separate dividends and capital gains, and aggregate taxable income is 0.
    const result = applyDeductionSpillover(
      { aggregate: -1_000_000, dividends: 500_000, capitalGains: 1_000_000 },
      800_000,
    );
    expect(result).toEqual({
      aggregate: 0,
      dividends: 0,
      capitalGains: 700_000,
    });
  });

  it('floors negative aggregate income to 0 when deductions are zero or negative', () => {
    const result = applyDeductionSpillover(
      { aggregate: -500_000, dividends: 300_000, capitalGains: 400_000 },
      0,
    );
    expect(result).toEqual({
      aggregate: 0,
      dividends: 300_000,
      capitalGains: 400_000,
    });
  });
});

describe('floorTaxableIncome', () => {
  it('floors to the nearest ¥1,000 per statutory rules', () => {
    expect(floorTaxableIncome(1_234_567)).toBe(1_234_000);
    expect(floorTaxableIncome(1_000)).toBe(1_000);
    expect(floorTaxableIncome(999)).toBe(0);
    expect(floorTaxableIncome(0)).toBe(0);
  });

  it('floors negative amounts to 0', () => {
    expect(floorTaxableIncome(-500)).toBe(0);
    expect(floorTaxableIncome(-100_000)).toBe(0);
  });
});

describe('calculateSeparateNationalIncomeTaxBase', () => {
  it('applies 15% flat national tax rate to the sum of taxable dividends and capital gains', () => {
    // 3,000,000 * 0.15 = 450,000
    const tax = calculateSeparateNationalIncomeTaxBase(
      { dividends: 1_000_000, capitalGains: 2_000_000 },
      2026,
    );
    expect(tax).toBe(450_000);
  });

  it('returns 0 when both amounts are zero', () => {
    expect(calculateSeparateNationalIncomeTaxBase({ dividends: 0, capitalGains: 0 }, 2026)).toBe(0);
  });
});
