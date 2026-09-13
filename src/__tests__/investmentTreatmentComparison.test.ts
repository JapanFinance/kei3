// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, type TakeHomeInputs } from '../types/tax';
import { compareInvestmentTreatments } from '../utils/investmentTreatmentComparison';

// The 5,000,000-yen employee of the engine tests, income year 2026: 所得税 91,700, 住民税
// 243,100, social insurance 722,252, take-home 3,942,948, furusato limit 61,000.
const salaryInputs = (streams: TakeHomeInputs['incomeStreams']): TakeHomeInputs => ({
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { type: 'salary', amount: 5_000_000, frequency: 'annual', id: 'salary' },
    ...streams,
  ],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
});
const dividends = (
  isReported: boolean,
  amount = 1_000_000,
): TakeHomeInputs['incomeStreams'][number] => ({
  type: 'dividends',
  shareType: 'listed',
  isReported,
  amount,
  id: 'dividends',
});
const gains = (
  account: 'specifiedWithholding' | 'domesticNoWithholding' | 'foreign',
  isReported: boolean,
  amount: number,
): TakeHomeInputs['incomeStreams'][number] => ({
  type: 'capitalGains',
  shareType: 'listed',
  account,
  isReported,
  amount,
  id: 'gains',
});

describe('compareInvestmentTreatments', () => {
  it('recomputes each election for 1,000,000 of dividends and marks the one in force', () => {
    const columns = compareInvestmentTreatments(salaryInputs([dividends(true)]));

    expect(columns.map(c => c.key)).toEqual(['withheldOnly', 'separate', 'aggregate']);
    expect(columns.map(c => c.isCurrent)).toEqual([false, true, false]);
    expect(columns.every(c => c.unavailableReason === undefined)).toBe(true);

    // 申告不要: 15.315% and 5% withheld on the 1,000,000 (153,150 and 50,000) are counted with
    // the assessed tax, and the dividends net of them with take-home; nothing else moves.
    expect(columns[0]!.figures).toEqual({
      kept: 3_942_948 + 1_000_000 - 203_150,
      incomeTax: 91_700 + 153_150,
      residenceTax: 243_100 + 50_000,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 61_000,
    });
    // 申告分離課税: the engine's own figures for the reported dividends.
    expect(columns[1]!.figures).toEqual({
      kept: 4_739_848,
      incomeTax: 244_800,
      residenceTax: 293_100,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 74_000,
    });
    // 総合課税, with no 配当控除: 課税総所得金額 2,797,000 → 182,200 → 186,000 with the surtax;
    // 住民税 343,100; furusato limit 99,000.
    expect(columns[2]!.figures).toEqual({
      kept: 6_000_000 - 186_000 - 343_100 - 722_252,
      incomeTax: 186_000,
      residenceTax: 343_100,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 99_000,
    });
  });

  it('marks the 総合課税 column current when that election is in force for the reported dividends', () => {
    const columns = compareInvestmentTreatments({
      ...salaryInputs([dividends(true)]),
      reportedDividendsTaxation: 'aggregate',
    });
    expect(columns.map(c => c.isCurrent)).toEqual([false, false, true]);
    expect(columns[2]!.figures?.incomeTax).toBe(186_000);
    // The 申告分離課税 column is computed under its own election, whatever is in force.
    expect(columns[1]!.figures?.incomeTax).toBe(244_800);
  });

  it('marks 申告不要 unavailable for a sale outside a withholding account, and no column current for mixed elections', () => {
    const columns = compareInvestmentTreatments(
      salaryInputs([gains('foreign', true, 500_000), dividends(false)]),
    );

    expect(columns[0]!.figures).toBeUndefined();
    expect(columns[0]!.unavailableReason).toMatch(/措法37条の11の5/);
    expect(columns.map(c => c.isCurrent)).toEqual([false, false, false]);

    // The 総合課税 column keeps the sale under 申告分離課税: 合計所得金額 5,060,000 → 基礎控除
    // 670,000; 課税総所得金額 3,167,000 → 219,200, plus 15% of 500,000 → 294,200 → 300,300; 住民税
    // 217,900 + 145,200 + 5,000.
    expect(columns[2]!.figures?.incomeTax).toBe(300_300);
    expect(columns[2]!.figures?.residenceTax).toBe(368_100);
  });

  it('leaves interest as entered in every column, counting its withholding with the tax', () => {
    const columns = compareInvestmentTreatments(
      salaryInputs([
        { type: 'interest', payerDomicile: 'domestic', amount: 100_000, id: 'interest' },
        dividends(true),
      ]),
    );

    expect(columns[1]!.isCurrent).toBe(true);
    // 15,315 and 5,000 withheld on the interest join the 申告分離課税 figures.
    expect(columns[1]!.figures).toEqual({
      kept: 4_739_848 + 100_000 - 20_315,
      incomeTax: 244_800 + 15_315,
      residenceTax: 293_100 + 5_000,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 74_000,
    });
  });

  it('marks no column current without a listed-share entry', () => {
    const columns = compareInvestmentTreatments(salaryInputs([]));
    expect(columns.every(c => !c.isCurrent)).toBe(true);
  });
});
