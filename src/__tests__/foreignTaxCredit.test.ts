// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import type {
  DividendsIncomeStream,
  InterestIncomeStream,
  PublicPensionIncomeStream,
  WithholdingAccountIncomeStream,
} from '../types/tax';
import { calculateForeignTaxCredit, foreignTaxEntryError } from '../utils/foreignTaxCredit';

// NTA 記載例1 of the 外国税額控除に関する明細書 (令和7年分): 所得税額 B 200,800, 復興特別所得税額
// R 4,216 (⌊200,800 × 2.1%⌋), 所得総額 T 5,606,000, 調整国外所得金額 A 280,000.
//   L     = ⌊200,800 × 280,000 / 5,606,000⌋ = ⌊10,029.25⌋ = 10,029
//   L_R   = ⌊4,216 × 280,000 / 5,606,000⌋ = ⌊210.57⌋ = 210
//   L_道府県 = ⌊10,029 × 12 / 100⌋ = ⌊1,203.48⌋ = 1,203
//   L_市町村 = ⌊10,029 × 18 / 100⌋ = ⌊1,805.22⌋ = 1,805
const ntaExample = (foreignTax: number) => ({
  incomeTax: 200_800,
  reconstructionSurtax: 4_216,
  totalIncome: 5_606_000,
  foreignSourceIncome: 280_000,
  foreignTax,
});
const NTA_LIMITS = { incomeTax: 10_029, reconstructionSurtax: 210, prefecture: 1_203, city: 1_805 };

describe('calculateForeignTaxCredit', () => {
  it('reproduces NTA 記載例1', () => {
    // F 28,000: every limit is used, and 28,000 − 10,029 − 210 − 1,203 − 1,805 = 14,753 is left.
    expect(calculateForeignTaxCredit(ntaExample(28_000))).toEqual({
      foreignTax: 28_000,
      foreignSourceIncome: 280_000,
      adjustedForeignSourceIncome: 280_000,
      totalIncome: 5_606_000,
      incomeTax: 200_800,
      limit: NTA_LIMITS,
      credit: NTA_LIMITS,
      excess: 14_753,
    });
  });

  it('credits foreign tax within the income tax limit against income tax alone', () => {
    // F 10,000 ≤ L 10,029.
    const result = calculateForeignTaxCredit(ntaExample(10_000));
    expect(result.credit).toEqual({
      incomeTax: 10_000,
      reconstructionSurtax: 0,
      prefecture: 0,
      city: 0,
    });
    expect(result.excess).toBe(0);
  });

  it('credits what the income tax limit leaves against the reconstruction surtax', () => {
    // L 10,029 < F 10,100 ≤ L + L_R 10,239: the other 71 comes off the surtax.
    const result = calculateForeignTaxCredit(ntaExample(10_100));
    expect(result.credit).toEqual({
      incomeTax: 10_029,
      reconstructionSurtax: 71,
      prefecture: 0,
      city: 0,
    });
    expect(result.excess).toBe(0);
  });

  it('credits the prefectural tax first and the municipal tax with what is left', () => {
    // F 11,239 = 10,029 + 210 + 1,000: the 1,000 left is under the 1,203 prefectural limit, so
    // nothing reaches the municipal side.
    const result = calculateForeignTaxCredit(ntaExample(11_239));
    expect(result.credit).toEqual({
      incomeTax: 10_029,
      reconstructionSurtax: 210,
      prefecture: 1_000,
      city: 0,
    });
    expect(result.excess).toBe(0);
  });

  it('caps the foreign-source income at the total income (所令222③)', () => {
    // A = min(6,000,000, 5,606,000) = 5,606,000 = T, so L = B and L_R = R;
    // ⌊200,800 × 12 / 100⌋ = 24,096 and ⌊200,800 × 18 / 100⌋ = 36,144.
    const result = calculateForeignTaxCredit({
      ...ntaExample(28_000),
      foreignSourceIncome: 6_000_000,
    });
    expect(result.foreignSourceIncome).toBe(6_000_000);
    expect(result.adjustedForeignSourceIncome).toBe(5_606_000);
    expect(result.limit).toEqual({
      incomeTax: 200_800,
      reconstructionSurtax: 4_216,
      prefecture: 24_096,
      city: 36_144,
    });
    expect(result.credit.incomeTax).toBe(28_000);
    expect(result.excess).toBe(0);
  });

  it.each([
    ['no income tax', { incomeTax: 0 }],
    ['no total income', { totalIncome: 0 }],
  ])('has no limit and credits nothing with %s', (_name, override) => {
    const result = calculateForeignTaxCredit({ ...ntaExample(28_000), ...override });
    const zero = { incomeTax: 0, reconstructionSurtax: 0, prefecture: 0, city: 0 };
    expect(result.limit).toEqual(zero);
    expect(result.credit).toEqual(zero);
    expect(result.excess).toBe(28_000);
  });

  it('floors fractional inputs to the yen instead of throwing', () => {
    // The chart sweep scales salaries by float ratios, which makes the total income fractional.
    expect(
      calculateForeignTaxCredit({
        ...ntaExample(28_000),
        incomeTax: 200_800.4,
        totalIncome: 5_606_000.5,
        foreignSourceIncome: 280_000.25,
      }),
    ).toEqual(calculateForeignTaxCredit(ntaExample(28_000)));
  });

  it('computes the limits in integer arithmetic where floats fall a yen short', () => {
    // B × A overflows 2^53 here, and ⌊96,717,250 × 225,585,093 / 225,585,093⌋ comes out as
    // 96,717,249 in floats. A = T, so L = B and L_R = R = ⌊96,717,250 × 21 / 1000⌋ = 2,031,062;
    // ⌊96,717,250 × 12 / 100⌋ = 11,606,070 and ⌊96,717,250 × 18 / 100⌋ = 17,409,105.
    const result = calculateForeignTaxCredit({
      incomeTax: 96_717_250,
      reconstructionSurtax: 2_031_062,
      totalIncome: 225_585_093,
      foreignSourceIncome: 225_585_093,
      foreignTax: 200_000_000,
    });
    expect(result.limit).toEqual({
      incomeTax: 96_717_250,
      reconstructionSurtax: 2_031_062,
      prefecture: 11_606_070,
      city: 17_409_105,
    });
    // 200,000,000 − 96,717,250 − 2,031,062 − 11,606,070 − 17,409,105.
    expect(result.excess).toBe(72_236_513);
  });
});

describe('foreignTaxEntryError', () => {
  const dividend = (overrides: Partial<DividendsIncomeStream> = {}): DividendsIncomeStream => ({
    id: 'd',
    type: 'dividends',
    shareType: 'listed',
    paymentChannel: 'domestic',
    isReported: true,
    issuerDomicile: 'foreign',
    amount: 1_000_000,
    foreignTax: 100_000,
    ...overrides,
  });
  const interest = (overrides: Partial<InterestIncomeStream> = {}): InterestIncomeStream => ({
    id: 'i',
    type: 'interest',
    payerDomicile: 'foreign',
    amount: 100_000,
    foreignTax: 10_000,
    ...overrides,
  });
  const pension = (
    overrides: Partial<PublicPensionIncomeStream> = {},
  ): PublicPensionIncomeStream => ({
    id: 'p',
    type: 'publicPension',
    payerDomicile: 'foreign',
    treatyCredit: 'available',
    amount: 2_000_000,
    foreignTax: 100_000,
    ...overrides,
  });
  const account = (
    overrides: Partial<WithholdingAccountIncomeStream> = {},
  ): WithholdingAccountIncomeStream => ({
    id: 'a',
    type: 'withholdingAccount',
    capitalGains: 0,
    dividends: 800_000,
    foreignDividends: 500_000,
    foreignTax: 50_000,
    reportsCapitalGains: false,
    reportsDividends: false,
    ...overrides,
  });

  it('accepts foreign tax within the amount it was withheld from', () => {
    expect(foreignTaxEntryError(dividend())).toBeUndefined();
    expect(foreignTaxEntryError(dividend({ foreignTax: 1_000_000 }))).toBeUndefined();
    expect(foreignTaxEntryError(interest())).toBeUndefined();
    expect(foreignTaxEntryError(pension())).toBeUndefined();
    expect(foreignTaxEntryError(pension({ foreignTax: 2_000_000 }))).toBeUndefined();
    expect(foreignTaxEntryError(account())).toBeUndefined();
    expect(
      foreignTaxEntryError(account({ foreignDividends: 800_000, foreignTax: 800_000 })),
    ).toBeUndefined();
  });

  it('accepts no foreign tax on any entry', () => {
    expect(
      foreignTaxEntryError(dividend({ issuerDomicile: 'domestic', foreignTax: 0 })),
    ).toBeUndefined();
    expect(
      foreignTaxEntryError(interest({ payerDomicile: 'domestic', foreignTax: 0 })),
    ).toBeUndefined();
    expect(
      foreignTaxEntryError(pension({ payerDomicile: 'domestic', foreignTax: 0 })),
    ).toBeUndefined();
    expect(
      foreignTaxEntryError(pension({ treatyCredit: 'unavailable', foreignTax: 0 })),
    ).toBeUndefined();
    expect(foreignTaxEntryError(account({ foreignDividends: 0, foreignTax: 0 }))).toBeUndefined();
  });

  it('rejects negative foreign amounts', () => {
    expect(foreignTaxEntryError(dividend({ foreignTax: -1 }))).toBe(
      'Foreign tax cannot be negative.',
    );
    expect(foreignTaxEntryError(interest({ foreignTax: -1 }))).toBe(
      'Foreign tax cannot be negative.',
    );
    expect(foreignTaxEntryError(pension({ foreignTax: -1 }))).toBe(
      'Foreign tax cannot be negative.',
    );
    expect(foreignTaxEntryError(account({ foreignTax: -1 }))).toBe(
      'Foreign tax cannot be negative.',
    );
    expect(foreignTaxEntryError(account({ foreignDividends: -1, foreignTax: 0 }))).toBe(
      'Foreign dividends cannot be negative.',
    );
  });

  it('rejects foreign tax on a dividend from a Japanese company or fund', () => {
    expect(foreignTaxEntryError(dividend({ issuerDomicile: 'domestic' }))).toBe(
      'Only a dividend from a foreign company or fund has foreign tax withheld.',
    );
  });

  it('rejects foreign tax on interest paid in Japan', () => {
    expect(foreignTaxEntryError(interest({ payerDomicile: 'domestic' }))).toBe(
      'Foreign tax on interest paid in Japan is not supported.',
    );
  });

  it('rejects foreign tax on a pension from a Japanese system', () => {
    expect(foreignTaxEntryError(pension({ payerDomicile: 'domestic' }))).toBe(
      'Foreign tax can be entered only for a pension from a foreign system.',
    );
  });

  it('rejects foreign tax on a pension when tax credit is unavailable in Japan under treaty', () => {
    expect(
      foreignTaxEntryError(pension({ treatyCredit: 'unavailable', foreignTax: 100_000 })),
    ).toBe(
      'Foreign tax can be entered only when a tax credit is available in Japan under a tax treaty.',
    );
  });

  it('rejects foreign tax above the amount it was withheld from', () => {
    expect(foreignTaxEntryError(dividend({ foreignTax: 1_000_001 }))).toBe(
      'Foreign tax cannot be more than the gross dividend.',
    );
    expect(foreignTaxEntryError(interest({ foreignTax: 100_001 }))).toBe(
      'Foreign tax cannot be more than the gross interest.',
    );
    expect(foreignTaxEntryError(pension({ foreignTax: 2_000_001 }))).toBe(
      'Foreign tax cannot be more than the gross pension.',
    );
  });

  it("rejects an account's foreign dividends above its dividends, and foreign tax above them", () => {
    expect(foreignTaxEntryError(account({ foreignDividends: 800_001 }))).toBe(
      'Foreign dividends cannot be more than the dividends received into the account.',
    );
    expect(foreignTaxEntryError(account({ foreignTax: 500_001 }))).toBe(
      'Foreign tax cannot be more than the foreign dividends.',
    );
  });
});
