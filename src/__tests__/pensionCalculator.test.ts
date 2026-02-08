// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'
import { calculatePensionPremium, calculatePensionBreakdown, calculatePensionBonusBreakdown } from '../utils/pensionCalculator'

describe('calculatePensionPremium', () => {
  it('calculates employees pension correctly for employment income below cap', () => {
    expect(calculatePensionPremium(true, 5_000_000 / 12, true)).toBe(450_180)
  })

  it('respects maximum cap for high employment income', () => {
    expect(calculatePensionPremium(true, 10_000_000 / 12, true)).toBe(713_700) // Capped at 59,475 * 12
  })

  it('calculates fixed national pension for non-employment income', () => {
    expect(calculatePensionPremium(false, 5_000_000 / 12, true)).toBe(210_120) // 17,510 * 12 months
    expect(calculatePensionPremium(false, 10_000_000 / 12, true)).toBe(210_120) // Same fixed amount regardless of income
  })

  it('handles zero income correctly', () => {
    expect(calculatePensionPremium(true, 0, true)).toBe(96_624)
    expect(calculatePensionPremium(false, 0, true)).toBe(210_120) // Still pays fixed amount
  })

  it('handles negative income correctly', () => {
    expect(() => calculatePensionPremium(true, -1_000_000, true)).toThrowError('Monthly income must be a positive number')
    expect(calculatePensionPremium(false, -1_000_000, true)).toBe(210_120) // Still pays fixed amount
  })
})

describe('calculatePensionBreakdown with bonuses', () => {
  // Rate: 18.3% -> half amount 9.15% (0.0915)

  it('calculates premium for a single bonus below cap', () => {
    // Bonus: 1,000,000 => Standard: 1,000,000
    // Premium: 1,000,000 * 0.0915 = 91,500
    const bonuses = [{ amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(91_500);
  });

  it('calculates premium for a single bonus above per-payment cap', () => {
    // Bonus: 2,000,000 => Capped at 1,500,000
    // Premium: 1,500,000 * 0.0915 = 137,250
    const bonuses = [{ amount: 2_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(137_250);
  });

  it('calculates premium for multiple bonuses each below cap but summing above cap in same month', () => {
    // Bonus 1: 1,000,000 in June
    // Bonus 2: 1,000,000 in June
    // Total: 2,000,000 -> Capped at 1,500,000
    // Premium: 1,500,000 * 0.0915 = 137,250
    const bonuses = [
      { amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 1_000_000, id: '2', type: 'bonus' as const, month: 6 }
    ];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(137_250);
  });

  it('calculates premium for multiple bonuses in different months', () => {
    // Bonus 1: 1,000,000 in June -> Premium: 91,500
    // Bonus 2: 1,000,000 in Dec -> Premium: 91,500
    // Total: 183,000
    const bonuses = [
      { amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 1_000_000, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(183_000);
  });

  it('calculates premium for multiple bonuses with one above cap', () => {
    // Bonus 1: 2,000,000 => Capped 1.5M => 137,250
    // Bonus 2: 1,000,000 => 91,500
    // Total: 228,750
    const bonuses = [
      { amount: 2_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 1_000_000, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(228_750);
  });

  it('applies rounding to standard bonus amount', () => {
    // Bonus: 100,999 => Standard: 100,000
    // Premium: 100,000 * 0.0915 = 9,150
    const bonuses = [{ amount: 100_999, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculatePensionBreakdown(true, 300_000, true, bonuses);
    expect(result.bonusPortion).toBe(9_150);
  });
})

describe('calculatePensionBonusBreakdown', () => {
  it('returns empty array for no bonuses', () => {
    expect(calculatePensionBonusBreakdown([])).toEqual([]);
  });

  it('correctly calculates breakdown for single bonus', () => {
    const bonuses = [{ amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const breakdown = calculatePensionBonusBreakdown(bonuses, true);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toEqual({
      month: 6,
      totalBonusAmount: 1_000_000,
      standardBonusAmount: 1_000_000,
      premium: 91_500
    });
  });

  it('correctly calculates breakdown for capped bonus', () => {
    const bonuses = [{ amount: 2_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const breakdown = calculatePensionBonusBreakdown(bonuses, true);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toEqual({
      month: 6,
      totalBonusAmount: 2_000_000,
      standardBonusAmount: 1_500_000,
      premium: 137_250
    });
  });

  it('aggregates multiple bonuses in same month', () => {
    const bonuses = [
      { amount: 800_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 300_000, id: '2', type: 'bonus' as const, month: 6 }
    ];
    const breakdown = calculatePensionBonusBreakdown(bonuses, true);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toEqual({
      month: 6,
      totalBonusAmount: 1_100_000,
      standardBonusAmount: 1_100_000,
      premium: 100_650 // 1,100,000 * 0.0915
    });
  });

  it('sorts breakdown by month', () => {
    const bonuses = [
      { amount: 500_000, id: '1', type: 'bonus' as const, month: 12 },
      { amount: 500_000, id: '2', type: 'bonus' as const, month: 6 }
    ];
    const breakdown = calculatePensionBonusBreakdown(bonuses, true);

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]!.month).toBe(6);
    expect(breakdown[1]!.month).toBe(12);
  });

  it('rounds standard bonus amount after summing bonuses for the same month', () => {
    // Reference: https://support.yayoi-kk.co.jp/faq_Subcontents.html?page_id=19494
    // Bonus 1: 200,500
    // Bonus 2: 100,600
    // Total raw: 301,100
    // Rounded Standard Bonus Amount: 301,000 (NOT 200,000 + 100,000 = 300,000)
    // Premium: 301,000 * 0.0915 = 27,541.5 -> 27,542
    const bonuses = [
      { amount: 200_500, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 100_600, id: '2', type: 'bonus' as const, month: 6 }
    ];
    const breakdown = calculatePensionBonusBreakdown(bonuses, true);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]!.totalBonusAmount).toBe(301_100);
    expect(breakdown[0]!.standardBonusAmount).toBe(301_000);
    expect(breakdown[0]!.premium).toBe(27_542);
  });
})
