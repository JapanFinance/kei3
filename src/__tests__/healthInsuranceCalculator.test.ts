// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { percent } from '../data/employeesHealthInsurance/providerRateData';
import { getNHIParamsForMonth } from '../data/nationalHealthInsurance/nhiParamsData';
import type { Dependent } from '../types/dependents';
import {
  DEFAULT_PROVIDER_REGION,
  DEFAULT_PROVIDER,
  CUSTOM_PROVIDER_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import {
  calculateHealthInsuranceBreakdown,
  calculateEmployeesHealthInsuranceBonusBreakdown,
  calculateHouseholdNHIBreakdown,
  calculateNationalHealthInsurancePortion,
  calculateNationalHealthInsurancePremiumWithBreakdown,
  getNHIPremiumReductionRatioForMonth,
  premiumCalculationBase,
} from '../utils/healthInsuranceCalculator';
import { composeNHIHousehold } from '../utils/nhiHousehold';

const KYOKAI_KENPO_PROVIDER = DEFAULT_PROVIDER;
const ITS_KENPO_PROVIDER = 'KantoItsKenpo';

const FY2025 = 2025;
const YEAR_2026 = 2026;

describe('calculateHealthInsuranceBreakdown for employees', () => {
  describe('Kyokai Kenpo (Tokyo)', () => {
    it('calculates premium for people under 40', () => {
      expect(
        calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo')
          .total,
      ).toBe(243_780);
    });

    it('calculates employees health insurance premium for people under 40 with cap', () => {
      expect(
        calculateHealthInsuranceBreakdown(20_000_000, false, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo')
          .total,
      ).toBe(826_488);
    });

    it('calculates employees health insurance premium with nursing care for people over 40', () => {
      expect(
        calculateHealthInsuranceBreakdown(5_000_000, true, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo')
          .total,
      ).toBe(282_900);
    });

    it('calculates employees health insurance premium with nursing care for people over 40 with cap', () => {
      expect(
        calculateHealthInsuranceBreakdown(20_000_000, true, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo')
          .total,
      ).toBe(959_100);
    });

    it('handles zero income correctly', () => {
      expect(
        calculateHealthInsuranceBreakdown(0, false, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo').total,
      ).toBe(34_488);
      expect(
        calculateHealthInsuranceBreakdown(0, true, KYOKAI_KENPO_PROVIDER, FY2025, 'Tokyo').total,
      ).toBe(40_020);
    });

    it('handles negative income correctly', () => {
      expect(
        () =>
          calculateHealthInsuranceBreakdown(
            -1_000_000,
            false,
            KYOKAI_KENPO_PROVIDER,
            FY2025,
            'Tokyo',
          ).total,
      ).toThrow("Income for Employees' Health Insurance cannot be negative.");
      expect(
        () =>
          calculateHealthInsuranceBreakdown(
            -1_000_000,
            true,
            KYOKAI_KENPO_PROVIDER,
            FY2025,
            'Tokyo',
          ).total,
      ).toThrow("Income for Employees' Health Insurance cannot be negative.");
    });
  });

  describe('ITS Kenpo (Default Region)', () => {
    // Annual income 5,000,000 / 12 = 416,666.67. SMR: 410,000円
    // Employee No LTC: 19,475. Employee With LTC: 19,475 + 3,690 (LTC for 410k) = 23,165
    it('calculates premium for people under 40', () => {
      expect(
        calculateHealthInsuranceBreakdown(
          5_000_000,
          false,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(19475 * 12); // 233_700
    });

    // Annual income 20,000,000 / 12 = 1,666,666.67. SMR: 1,390,000円 (Max)
    // Employee No LTC: 66,025. Employee With LTC: 66,025 + 12,510 (LTC for 1.39M) = 78,535
    it('calculates premium for people under 40 with cap', () => {
      expect(
        calculateHealthInsuranceBreakdown(
          20_000_000,
          false,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(66025 * 12); // 792_300
    });

    it('calculates premium with nursing care for people over 40', () => {
      expect(
        calculateHealthInsuranceBreakdown(
          5_000_000,
          true,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(23165 * 12); // 277_980
    });

    it('calculates premium with nursing care for people over 40 with cap', () => {
      expect(
        calculateHealthInsuranceBreakdown(
          20_000_000,
          true,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(78535 * 12); // 942_420
    });

    // Annual income 0 / 12 = 0. SMR: 58,000円
    // Employee No LTC: 2,755. Employee With LTC: 2,755 + 522 (LTC for 58k) = 3,277
    it('handles zero income correctly', () => {
      expect(
        calculateHealthInsuranceBreakdown(
          0,
          false,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(2755 * 12); // 33_060
      expect(
        calculateHealthInsuranceBreakdown(
          0,
          true,
          ITS_KENPO_PROVIDER,
          FY2025,
          DEFAULT_PROVIDER_REGION,
        ).total,
      ).toBe(3277 * 12); // 39_324
    });

    it('handles negative income correctly', () => {
      expect(
        () =>
          calculateHealthInsuranceBreakdown(
            -1_000_000,
            false,
            ITS_KENPO_PROVIDER,
            FY2025,
            DEFAULT_PROVIDER_REGION,
          ).total,
      ).toThrow("Income for Employees' Health Insurance cannot be negative.");
      expect(
        () =>
          calculateHealthInsuranceBreakdown(
            -1_000_000,
            true,
            ITS_KENPO_PROVIDER,
            FY2025,
            DEFAULT_PROVIDER_REGION,
          ).total,
      ).toThrow("Income for Employees' Health Insurance cannot be negative.");
    });
  });
});

describe('calculateNationalHealthInsurancePremiumWithBreakdown for non-employees', () => {
  it('calculates NHI premium', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, FY2025, 'Tokyo').total,
    ).toBe(539_380);
  });

  it('calculates NHI premium with cap', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, false, FY2025, 'Tokyo')
        .total,
    ).toBe(920_000);
  });

  it('calculates NHI premium with nursing care', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, true, FY2025, 'Tokyo').total,
    ).toBe(658_805);
  });

  it('calculates NHI premium with nursing care and cap', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, true, FY2025, 'Tokyo').total,
    ).toBe(1_090_000);
  });

  it('handles zero income correctly in 2026', () => {
    // Zero income is within the 7割軽減 tier (≤ ¥430,000) for both FY2025 and FY2026.
    // Tokyo 2026 blends FY2025 (3/10) and FY2026 (7/10):
    // Medical: round(14,190 × 0.3 + 14,280 × 0.7) = 14,253
    // Support: round(5,040 × 0.3 + 5,280 × 0.7) = 5,208
    // Child support (FY2026): round(0 × 0.3 + 562 × 0.7) = 393
    // Total without LTC: 19,854
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, false, YEAR_2026, 'Tokyo').total,
    ).toBe(19_854);
    // With LTC: + round(4,980 × 0.3 + 5,340 × 0.7) = 5,232 → total 25,086
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, true, YEAR_2026, 'Tokyo').total,
    ).toBe(25_086);
  });

  it('handles negative income correctly', () => {
    // Negative income is within the 7割軽減 tier (≤ ¥430,000) for FY2025.
    // 均等割 is reduced by 70% (30% remains):
    // Medical: 47,300 × 0.3 = 14,190
    // Support: 16,800 × 0.3 = 5,040
    // Total without LTC: 19,230
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(-1_000_000, false, FY2025, 'Tokyo')
        .total,
    ).toBe(19_230);
    // With LTC: + 16,600 × 0.3 = 4,980 → total 24,210
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(-1_000_000, true, FY2025, 'Tokyo').total,
    ).toBe(24_210);
  });
});

describe('calculateNationalHealthInsurancePremiumWithBreakdown for employees with NHI', () => {
  // Test cases for employment income workers who are on NHI
  // (e.g., small employers, part-time workers, low income thresholds)
  it('calculates NHI premium for employment income', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, FY2025, 'Tokyo').total,
    ).toBe(539_380);
  });

  it('calculates NHI premium for employment income with nursing care', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, true, FY2025, 'Tokyo').total,
    ).toBe(658_805);
  });

  it('calculates NHI premium for employment income with cap', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, false, FY2025, 'Tokyo')
        .total,
    ).toBe(920_000);
  });

  it('calculates NHI premium for employment income with nursing care and cap', () => {
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, true, FY2025, 'Tokyo').total,
    ).toBe(1_090_000);
  });

  it('handles zero employment income correctly in 2026', () => {
    // 7割軽減 applies (≤ ¥430,000): Tokyo 2026 total is 19,854; with LTC adds 5,232 = 25,086
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, false, YEAR_2026, 'Tokyo').total,
    ).toBe(19_854);
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, true, YEAR_2026, 'Tokyo').total,
    ).toBe(25_086);
  });
});

describe('NHI low-income premium reduction (均等割額の軽減)', () => {
  // Statutory thresholds for a single insured person (被保険者数 = 1, 給与所得者等 = 1):
  //   FY2025 (令和7年度): 7割 ≤ 430,000; 5割 ≤ 430,000 + 305,000 = 735,000; 2割 ≤ 430,000 + 560,000 = 990,000
  //   FY2026 (令和8年度): 7割 ≤ 430,000; 5割 ≤ 430,000 + 310,000 = 740,000; 2割 ≤ 430,000 + 570,000 = 1,000,000
  // Sources: 国民健康保険法施行令 第29条の7,
  //          https://www.city.setagaya.lg.jp/02060/300.html,
  //          https://www.city.nara.lg.jp/site/kokuminkenkouhoken/9305.html

  describe('FY2026 statutory threshold ratio evaluation', () => {
    // Evaluated for month 3 (April 2026, start of FY2026)
    it.each([
      { income: 0, expected: 0.7 },
      { income: 430_000, expected: 0.7 },
      { income: 430_001, expected: 0.5 },
      { income: 740_000, expected: 0.5 },
      { income: 740_001, expected: 0.2 },
      { income: 1_000_000, expected: 0.2 },
      { income: 1_000_001, expected: 0 },
    ])('returns ratio $expected at net income $income', ({ income, expected }) => {
      expect(getNHIPremiumReductionRatioForMonth(income, YEAR_2026, 3)).toBe(expected);
    });
  });

  describe('calendar year 2026 blended calculations', () => {
    // Calendar 2026 blends FY2025 (Jan–Mar, 3/10) and FY2026 (Apr–Dec, 7/10).
    // In Tokyo, FY2025 per-capita is 47,300/16,800; FY2026 is 47,600/17,600 + child support 1,873.

    it('applies 7割軽減 up to and including net income 430,000', () => {
      // Both FYs apply 7割軽減. Taxable income (430,000 − 430,000) = 0, so only reduced per-capita remains:
      // FY2025: (47,300 + 16,800) × 0.3 = 19,230
      // FY2026: (47,600 + 17,600 + 1,873) × 0.3 = 14,280 + 5,280 + 562 = 20,122
      // Blended: round(14,190 × 0.3 + 14,280 × 0.7) = 14,253; round(5,040 × 0.3 + 5,280 × 0.7) = 5,208;
      //          round(0 × 0.3 + 562 × 0.7) = 393 → total 19,854
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        430_000,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.7, currFY: 0.7 });
      expect(result.total).toBe(19_854);
    });

    it('applies 5割軽減 in both fiscal years just above the 7割 threshold', () => {
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        430_001,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.5, currFY: 0.5 });
      expect(result.total).toBe(33_091);
    });

    it('applies 5割軽減 in both fiscal years up to 735,000', () => {
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        735_000,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.5, currFY: 0.5 });
      expect(result.total).toBe(65_196);
    });

    it('handles threshold transition where FY2025 is 2割 and FY2026 is 5割 (735,001 to 740,000)', () => {
      // 740,000 exceeds FY2025's 5割 threshold (735,000) so FY2025 applies 2割,
      // but is within FY2026's revised 5割 threshold (740,000) so FY2026 applies 5割.
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        740_000,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.2, currFY: 0.5 });
      expect(result.total).toBe(71_491);
    });

    it('applies 2割軽減 in both fiscal years just above the FY2026 5割 threshold', () => {
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        740_001,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.2, currFY: 0.2 });
      expect(result.total).toBe(85_576);
    });

    it('applies 2割軽減 in both fiscal years up to 990,000', () => {
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        990_000,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0.2, currFY: 0.2 });
      expect(result.total).toBe(111_890);
    });

    it('handles threshold transition where FY2025 is unreduced and FY2026 is 2割 (990,001 to 1,000,000)', () => {
      // 1,000,000 exceeds FY2025's 2割 threshold (990,000) so FY2025 applies no reduction,
      // but is within FY2026's revised 2割 threshold (1,000,000) so FY2026 applies 2割.
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        1_000_000,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0, currFY: 0.2 });
      expect(result.total).toBe(116_789);
    });

    it('applies no reduction in either fiscal year above the FY2026 2割 threshold', () => {
      const result = calculateNationalHealthInsurancePremiumWithBreakdown(
        1_000_001,
        false,
        YEAR_2026,
        'Tokyo',
      );
      expect(result.reductionRatios).toEqual({ prevFY: 0, currFY: 0 });
      expect(result.total).toBe(126_179);
    });
  });
});

describe('calculateNationalHealthInsurancePremiumWithBreakdown for Osaka', () => {
  // Osaka has household flat rate (平等割) components:
  // Medical: ¥33,574, Support: ¥10,761, LTC: ¥0
  // These are per-household amounts added to the calculation

  it('calculates Osaka NHI premium without nursing care', () => {
    // Expected calculation for 5M income:
    // Medical: (5M - 430k) * 9.30% + 34,424 + 33,574 = 424,980 + 34,424 + 33,574 = 492,978 (under cap 650k)
    // Support: (5M - 430k) * 3.02% + 11,034 + 10,761 = 138,030 + 11,034 + 10,761 = 159,825 (under cap 240k)
    // LTC: 0 (not applicable)
    // Total: 492,978 + 159,825 = 652,803 (adjusted for rounding: 652,817)
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, FY2025, 'Osaka').total,
    ).toBe(652_817);
  });

  it('calculates Osaka NHI premium with nursing care', () => {
    // Expected calculation for 5M income:
    // Medical: Same as above = 492,978
    // Support: Same as above = 159,825
    // LTC: (5M - 430k) * 2.56% + 18,784 + 0 = 116,915 + 18,784 = 135,699 (under cap 170k)
    // Total: 492,978 + 159,825 + 135,699 = 788,502 (adjusted for rounding: 788,593)
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, true, FY2025, 'Osaka').total,
    ).toBe(788_593);
  });

  it('calculates Osaka NHI premium with caps applied', () => {
    // For very high income like 20M, caps will be applied
    // Medical: Capped at 650,000
    // Support: Capped at 240,000
    // LTC: Capped at 170,000 (if applicable)
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, false, FY2025, 'Osaka')
        .total,
    ).toBe(890_000); // 650k + 240k
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, true, FY2025, 'Osaka').total,
    ).toBe(1_060_000); // 650k + 240k + 170k
  });

  it('handles zero income correctly for Osaka in 2026 (reduced per-capita and household flat amounts)', () => {
    // 7割軽減 applies to both 均等割 and 平等割 in Osaka for 2026:
    // FY2025: Medical (34,424 + 33,574) × 0.3 = 20,399.4 → 20,399; Support (11,034 + 10,761) × 0.3 = 6,538.5 → 6,539
    // FY2026: Medical (34,990 + 33,908) × 0.3 = 20,669.4 → 20,669; Support (11,191 + 10,845) × 0.3 = 6,610.8 → 6,611;
    //         Child support 1,841 × 0.3 = 552.3 → 552
    // Blended: Medical 20,588 + Support 6,589 + Child 386 = 27,563
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, false, YEAR_2026, 'Osaka').total,
    ).toBe(27_563);

    // With LTC: FY2025 LTC 18,784 × 0.3 = 5,635; FY2026 LTC 18,682 × 0.3 = 5,605
    // Blended LTC: round(5,635 × 0.3 + 5,605 × 0.7) = 5,614 → total 33,177
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(0, true, YEAR_2026, 'Osaka').total,
    ).toBe(33_177);
  });
});

describe('Dependent Coverage', () => {
  it('returns zero premium for dependent coverage regardless of age', () => {
    expect(
      calculateHealthInsuranceBreakdown(
        0,
        false,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        0,
        true,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        500_000,
        false,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        500_000,
        true,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        1_299_999,
        false,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        1_299_999,
        true,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
  });

  it('returns zero premium for dependent coverage at threshold income', () => {
    expect(
      calculateHealthInsuranceBreakdown(
        1_300_000,
        false,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        1_300_000,
        true,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
  });

  it('returns zero premium for dependent coverage even above threshold (validation should be in UI)', () => {
    // The calculator itself doesn't enforce the threshold - that's done at the UI level
    expect(
      calculateHealthInsuranceBreakdown(
        2_000_000,
        false,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
    expect(
      calculateHealthInsuranceBreakdown(
        2_000_000,
        true,
        'DependentCoverage',
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
  });
});

describe('Custom Provider', () => {
  const customRates = { healthInsuranceRate: 5, longTermCareRate: 1 }; // 5% and 1%

  // Annual income 5,000,000 / 12 = 416,666.67. SMR: 410,000円
  // Employee No LTC: 410,000 * 0.05 = 20,500
  it('calculates premium with custom rates for people under 40', () => {
    expect(
      calculateHealthInsuranceBreakdown(
        5_000_000,
        false,
        CUSTOM_PROVIDER_ID,
        FY2025,
        DEFAULT_PROVIDER_REGION,
        customRates,
      ).total,
    ).toBe(20500 * 12); // 246,000
  });

  // Employee With LTC: 410,000 * 0.05 + 410,000 * 0.01 = 20,500 + 4,100 = 24,600
  it('calculates premium with custom rates for people over 40', () => {
    expect(
      calculateHealthInsuranceBreakdown(
        5_000_000,
        true,
        CUSTOM_PROVIDER_ID,
        FY2025,
        DEFAULT_PROVIDER_REGION,
        customRates,
      ).total,
    ).toBe(24600 * 12); // 295,200
  });

  it('returns 0 if custom rates are missing', () => {
    expect(
      calculateHealthInsuranceBreakdown(
        5_000_000,
        false,
        CUSTOM_PROVIDER_ID,
        FY2025,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(0);
  });

  it('handles zero income correctly with custom rates', () => {
    // SMR for 0 income is 58,000 (min bracket)
    // 58,000 * 0.05 = 2,900
    expect(
      calculateHealthInsuranceBreakdown(
        0,
        false,
        CUSTOM_PROVIDER_ID,
        FY2025,
        DEFAULT_PROVIDER_REGION,
        customRates,
      ).total,
    ).toBe(2900 * 12);
  });
});

describe('calculateHealthInsuranceBreakdown with bonuses', () => {
  // Using Kyokai Kenpo (Tokyo) rates for testing
  // Rate: 9.91% (0.0991) -> employee share 4.955% (0.04955)
  // LTC Rate: 1.59% (0.0159) -> employee share 0.795% (0.00795)

  it('calculates premium for a single bonus below cap', () => {
    // Bonus: 1,000,000 => Standard Bonus: 1,000,000
    // Health: 1,000,000 * 0.04955 = 49,550
    const bonuses = [{ amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      false,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(49_550);

    // Total should include monthly premium (243,780 from previous test) + bonus (49,550)
    expect(result.total).toBe(243_780 + 49_550);
  });

  it('calculates premium for a single bonus above annual cap', () => {
    // Annual Cap for bonuses is 5.73 million yen
    // Bonus: 10,000,000 => Capped at 5,730,000
    // Health: 5,730,000 * 0.04955 = 283,921.5 -> 283,921
    // Total: 283,921
    const bonuses = [{ amount: 10_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      false,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(283_921);
  });

  it('calculates premium for multiple bonuses summing below cap', () => {
    // Bonus 1: 1,000,000
    // Bonus 2: 2,000,000
    // Total Standard Bonus: 3,000,000 (all rounded to nearest 1k already)
    // Health: 3,000,000 * 0.04955 = 148,650
    const bonuses = [
      { amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 2_000_000, id: '2', type: 'bonus' as const, month: 12 },
    ];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      false,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(148_650);
  });

  it('calculates premium for multiple bonuses summing above cap', () => {
    // Bonus 1: 3,000,000
    // Bonus 2: 3,000,000
    // Total Standard Bonus: 6,000,000
    // Capped Total: 5,730,000
    // Health: 5,730,000 * 0.04955 = 283,921.5 -> 283,921
    const bonuses = [
      { amount: 3_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 3_000_000, id: '2', type: 'bonus' as const, month: 12 },
    ];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      false,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(283_921);
  });

  it('applies rounding to standard bonus amount before summing', () => {
    // Bonus 1: 100,500 -> 100,000
    // Bonus 2: 200,999 -> 200,000
    // Total Standard Bonus: 300,000
    // Health: 300,000 * 0.04955 = 14,865
    const bonuses = [
      { amount: 100_500, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 200_999, id: '2', type: 'bonus' as const, month: 12 },
    ];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      false,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(14_865);
  });

  it('calculates premium with long term care insurance', () => {
    // Bonus: 1,000,000
    // Health: 1,000,000 * 0.04955 = 49,550
    // LTC: 1,000,000 * 0.00795 = 7,950
    // Total Bonus Premium: 57,500
    const bonuses = [{ amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculateHealthInsuranceBreakdown(
      5_000_000,
      true,
      KYOKAI_KENPO_PROVIDER,
      FY2025,
      'Tokyo',
      undefined,
      bonuses,
    );
    expect(result.bonusPortion).toBe(57_500);
  });
});

describe('calculateHealthInsuranceBonusBreakdown details', () => {
  // Using Kyokai Kenpo (Tokyo) rates for testing
  // Health Rate: 9.91% -> Employee: 4.955%
  // LTC Rate: 1.59% -> Employee: 0.795%

  const rates = {
    employeeHealthInsuranceRate: percent(4.955),
    employeeLongTermCareRate: percent(0.795),
  };

  it('returns correct breakdown for single bonus below cap', () => {
    const bonuses = [{ amount: 1_000_500, id: '1', type: 'bonus' as const, month: 6 }];
    const breakdown = calculateEmployeesHealthInsuranceBonusBreakdown(bonuses, rates, true, FY2025);

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]!.bonusAmount).toBe(1_000_500);
    expect(breakdown[0]!.standardBonusAmount).toBe(1_000_000);
    expect(breakdown[0]!.cumulativeStandardBonus).toBe(1_000_000);
    // Premium: 1,000,000 * (0.04955 + 0.00795) = 1,000,000 * 0.0575 = 57,500
    // Premium: 1,000,000 * (0.04955 + 0.00795) = 1,000,000 * 0.0575 = 57,500
    expect(breakdown[0]!.premium).toBe(57_500);
    expect(breakdown[0]!.includesLongTermCare).toBe(true);
  });

  it('returns correct breakdown for multiple bonuses reaching cap', () => {
    // Annual Cap: 5,730,000
    const bonuses = [
      { amount: 4_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 3_000_000, id: '2', type: 'bonus' as const, month: 12 },
    ];
    const breakdown = calculateEmployeesHealthInsuranceBonusBreakdown(
      bonuses,
      rates,
      false,
      FY2025,
    );

    expect(breakdown).toHaveLength(2);

    // First bonus
    expect(breakdown[0]!.month).toBe(6);
    expect(breakdown[0]!.standardBonusAmount).toBe(4_000_000);
    expect(breakdown[0]!.cumulativeStandardBonus).toBe(4_000_000);
    expect(breakdown[0]!.premium).toBe(198_200); // 4,000,000 * 0.04955
    expect(breakdown[0]!.includesLongTermCare).toBe(false);

    // Second bonus
    // Remaining Cap: 5,730,000 - 4,000,000 = 1,730,000
    expect(breakdown[1]!.month).toBe(12);
    expect(breakdown[1]!.standardBonusAmount).toBe(1_730_000); // Capped
    expect(breakdown[1]!.cumulativeStandardBonus).toBe(5_730_000);
    expect(breakdown[1]!.premium).toBe(85_721); // 1,730,000 * 0.04955 = 85,721.5 -> 85,721
    expect(breakdown[1]!.includesLongTermCare).toBe(false);
  });
});

describe('FY2026 time-series rate support', () => {
  // Calendar year 2026 for Kyokai Kenpo (Tokyo):
  // - Months 0-2 (Jan-Mar): FY2025 rates — health 4.955%, LTC 0.795%
  // - Month 3 (Apr): FY2026 without contribution — health 4.925%, LTC 0.81%
  // - Months 4-11 (May-Dec): FY2026 with contribution — health 5.04%, LTC 0.81%
  //
  // SMR for 5M income = 410,000

  it('calculates split-year premium for Kyokai Kenpo Tokyo in 2026 (no LTC)', () => {
    // Jan-Mar (3 months): 410,000 × 0.04955 = 20,315.5 → 20,315 each → 60,945
    // Apr (1 month):       410,000 × 0.04925 = 20,192.5 → 20,192
    // May-Dec (8 months):  410,000 × 0.05040 = 20,664.0 → 20,664 each → 165,312
    // Annual: 60,945 + 20,192 + 165,312 = 246,449
    expect(
      calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, 2026, 'Tokyo')
        .total,
    ).toBe(246_449);
  });

  it('calculates split-year premium for Kyokai Kenpo Tokyo in 2026 (with LTC)', () => {
    // Jan-Mar (3 months): 410,000 × (0.04955 + 0.00795) = 410,000 × 0.05750 = 23,575.0 → 23,575 each → 70,725
    // Apr (1 month):       410,000 × (0.04925 + 0.00810) = 410,000 × 0.05735 = 23,513.5 → 23,513
    // May-Dec (8 months):  410,000 × (0.05040 + 0.00810) = 410,000 × 0.05850 = 23,985.0 → 23,985 each → 191,880
    // Annual: 70,725 + 23,513 + 191,880 = 286,118
    expect(
      calculateHealthInsuranceBreakdown(5_000_000, true, KYOKAI_KENPO_PROVIDER, 2026, 'Tokyo')
        .total,
    ).toBe(286_118);
  });

  it('applies correct rate to bonuses based on month in 2026', () => {
    // Bonus in March (month 2) → FY2025 rate: 0.04955
    // 500,000 × 0.04955 = 24,775
    const marchBonus = [{ amount: 500_000, id: 'b1', type: 'bonus' as const, month: 2 }];
    const marchResult = calculateHealthInsuranceBreakdown(
      0,
      false,
      KYOKAI_KENPO_PROVIDER,
      2026,
      'Tokyo',
      undefined,
      marchBonus,
    );
    expect(marchResult.bonusPortion).toBe(24_775);

    // Bonus in May (month 4) → FY2026 with contribution rate: 0.05040
    // 500,000 × 0.05040 = 25,200
    const mayBonus = [{ amount: 500_000, id: 'b2', type: 'bonus' as const, month: 4 }];
    const mayResult = calculateHealthInsuranceBreakdown(
      0,
      false,
      KYOKAI_KENPO_PROVIDER,
      2026,
      'Tokyo',
      undefined,
      mayBonus,
    );
    expect(mayResult.bonusPortion).toBe(25_200);
  });

  it('ITS Kenpo rates in 2026 are uniform (contribution offsets health rate reduction)', () => {
    // ITS in 2026:
    // All months: 4.75% (FY2025: 4.75%, FY2026 Apr: 4.75%, FY2026 May+: 4.635% + 0.115% contribution = 4.75%)
    // 410,000 × 0.0475 = 19,475 × 12 = 233,700
    expect(
      calculateHealthInsuranceBreakdown(
        5_000_000,
        false,
        ITS_KENPO_PROVIDER,
        2026,
        DEFAULT_PROVIDER_REGION,
      ).total,
    ).toBe(233_700);
  });
});

describe('NHI split-year blending (3/10 prev FY + 7/10 curr FY)', () => {
  // NHI premiums are paid in 10 installments (Jun-Mar). In calendar year N:
  //   Jan-Mar: 3 installments of FY(N-1) → 3/10 of that annual premium
  //   Jun-Dec: 7 installments of FY(N)   → 7/10 of that annual premium
  //
  // Nakano FY2025: medical 7.92%, support 2.87%, LTC 2.25%, no child support
  // Nakano FY2026: medical 8.03%, support 2.94%, LTC 2.53%, child support 0.27%

  it('year=2025 uses single FY (both Jan and Apr resolve to same FY2025 params)', () => {
    // No blending needed — FY2024 has no separate entry, falls back to FY2025
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, FY2025, 'Tokyo-Nakano')
        .total,
    ).toBe(554_903);
  });

  it('sums rounded portions to produce the annual total in single-fiscal-year calculations', () => {
    // 2025 has identical rates across months (single FY path)
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      3_456_789,
      true,
      2025,
      'Tokyo-Chiyoda',
    );
    expect(breakdown.total).toBe(
      breakdown.medicalPortion +
        breakdown.elderlySupportPortion +
        breakdown.longTermCarePortion +
        breakdown.childSupportPortion,
    );
  });

  it('year=2026 blends FY2025 and FY2026 for Nakano (no LTC)', () => {
    // FY2025: medical 407,544 + support 147,359 + child 0 = 554,903
    // FY2026: medical 414,071 + support 151,758 + child 14,212 = 580,041
    // Blended: medical round(407,544×0.3 + 414,071×0.7) = 412,113
    //          support round(147,359×0.3 + 151,758×0.7) = 150,438
    //          child   round(0×0.3 + 14,212×0.7)        = 9,948
    //          total: 412,113 + 150,438 + 9,948          = 572,499
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, 2026, 'Tokyo-Nakano')
        .total,
    ).toBe(572_499);
  });

  it('year=2026 blends FY2025 and FY2026 for Nakano (with LTC)', () => {
    // FY2025 LTC (rate 2.20%, per-capita 17,400): 117,940
    // FY2026 LTC (rate 2.53%, per-capita 17,700): 133,321
    // Blended LTC: round(117,940×0.3 + 133,321×0.7) = 128,707
    // Total: 572,499 + 128,707 = 701,206
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, true, 2026, 'Tokyo-Nakano')
        .total,
    ).toBe(701_206);
  });

  it('year=2026 blends Osaka FY2025 and FY2026 (no LTC)', () => {
    // FY2025 (rates 9.30%/3.02%, caps 650k/240k): medical 493,008 + support 159,809 = 652,817
    // FY2026 (rates 9.50%/3.06%, caps 660k/260k): medical 503,048 + support 161,878 + child 14,637 = 679,563
    // Blended: medical round(493,008×0.3 + 503,048×0.7) = 500,036
    //          support round(159,809×0.3 + 161,878×0.7) = 161,257
    //          child   round(0×0.3 + 14,637×0.7)        = 10,246
    //          total: 500,036 + 161,257 + 10,246         = 671,539
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(5_000_000, false, 2026, 'Osaka').total,
    ).toBe(671_539);
  });

  it('year=2026 blends caps correctly for Osaka at high income', () => {
    // FY2025 caps: medical 650k, support 240k, LTC 170k, child 0
    // FY2026 caps: medical 660k, support 260k, LTC 170k, child 30k
    // Blended: medical round(650k×0.3 + 660k×0.7) = 657,000
    //          support round(240k×0.3 + 260k×0.7) = 254,000
    //          LTC: 170,000 (same both FYs)
    //          child round(0×0.3 + 30k×0.7) = 21,000
    //          total: 657,000 + 254,000 + 170,000 + 21,000 = 1,102,000
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, true, 2026, 'Osaka').total,
    ).toBe(1_102_000);
  });

  it('year=2026 blends caps correctly for Nakano at high income (no LTC)', () => {
    // FY2025 caps: medical 660k, support 260k, child 0
    // FY2026 caps: medical 670k, support 260k, child 30k
    // Blended: medical round(660k×0.3 + 670k×0.7) = 667,000
    //          support: 260,000 (same both FYs)
    //          child round(0×0.3 + 30,000×0.7) = 21,000
    //          total: 667,000 + 260,000 + 21,000 = 948,000
    expect(
      calculateNationalHealthInsurancePremiumWithBreakdown(20_000_000, false, 2026, 'Tokyo-Nakano')
        .total,
    ).toBe(948_000);
  });
});

describe('NHI portions and the capped flags', () => {
  // Chiyoda FY2025 caps its medical portion at 660,000 and FY2026 at 670,000. Between ¥8,377,000
  // and ¥8,717,000 of income the FY2025 portion is at its cap and the FY2026 one is not.
  const region = 'Tokyo-Chiyoda';
  const prevFY = getNHIParamsForMonth(region, 2026, 0)!;
  const currFY = getNHIParamsForMonth(region, 2026, 3)!;

  it('reports a portion as levied only where its parameters exist', () => {
    // Nakano introduced the child support portion in FY2026.
    const nakano2025 = getNHIParamsForMonth('Tokyo-Nakano', 2026, 0)!;
    const nakano2026 = getNHIParamsForMonth('Tokyo-Nakano', 2026, 3)!;
    const base = premiumCalculationBase(5_000_000);

    expect(calculateNationalHealthInsurancePortion(base, nakano2025, 'childSupport')).toBe(
      undefined,
    );
    const portion = calculateNationalHealthInsurancePortion(base, nakano2026, 'childSupport')!;
    expect(portion.rate).toBe(nakano2026.childSupportRate);
    expect(portion.cap).toBe(nakano2026.childSupportCap);
    expect(portion.uncapped).toBe(portion.incomeBased + portion.perCapita + portion.householdFlat);
    expect(portion.premium).toBe(Math.round(Math.min(portion.uncapped, portion.cap)));
    expect(portion.isCapped).toBe(false);
  });

  it('reduces the base by the stepped residence tax basic deduction, never below zero', () => {
    // 地方税法第314条の2第2項, which the NHI rules point at: ¥430,000 up to ¥24,000,000 of
    // 合計所得金額, then ¥290,000, ¥150,000 and nothing above ¥25,000,000.
    expect(premiumCalculationBase(5_000_000)).toBe(4_570_000);
    expect(premiumCalculationBase(100_000)).toBe(0);
    expect(premiumCalculationBase(24_200_000)).toBe(23_910_000);
    expect(premiumCalculationBase(25_000_000)).toBe(24_850_000);
    expect(premiumCalculationBase(26_000_000)).toBe(26_000_000);
  });

  it('marks a fiscal year portion capped from the first yen at its 賦課限度額', () => {
    const base = premiumCalculationBase(8_377_000);
    expect(calculateNationalHealthInsurancePortion(base, prevFY, 'medical')!.isCapped).toBe(true);
    expect(calculateNationalHealthInsurancePortion(base, currFY, 'medical')!.isCapped).toBe(false);
  });

  it('marks a blended portion capped only when every fiscal year that levies it is capped', () => {
    const prevOnly = calculateNationalHealthInsurancePremiumWithBreakdown(
      8_377_000,
      false,
      2026,
      region,
    );
    expect(prevOnly.medicalPortion).toBeLessThan(667_000);
    expect(prevOnly.medicalCapped).toBe(false);

    const both = calculateNationalHealthInsurancePremiumWithBreakdown(
      8_718_000,
      false,
      2026,
      region,
    );
    expect(both.medicalPortion).toBe(667_000);
    expect(both.medicalCapped).toBe(true);
    expect(both.elderlySupportCapped).toBe(false);
  });

  it('judges a portion the previous fiscal year did not levy on the current one alone', () => {
    // Nakano FY2025 has no child support portion; at ¥20,000,000 the FY2026 one is at its cap.
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      20_000_000,
      false,
      2026,
      'Tokyo-Nakano',
    );
    expect(breakdown.childSupportPortion).toBe(21_000);
    expect(breakdown.childSupportCapped).toBe(true);
    // Not levied at this age, so nothing is capped.
    expect(breakdown.longTermCarePortion).toBe(0);
    expect(breakdown.longTermCareCapped).toBe(false);
  });

  it('reports no caps at moderate income', () => {
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      5_000_000,
      true,
      2026,
      region,
    );
    expect(breakdown.medicalCapped).toBe(false);
    expect(breakdown.elderlySupportCapped).toBe(false);
    expect(breakdown.longTermCareCapped).toBe(false);
    expect(breakdown.childSupportCapped).toBe(false);
  });
});

describe('calculateHouseholdNHIBreakdown', () => {
  const year = 2026;

  it('calculates fullHousehold attribution where taxpayer pays entire household premium', () => {
    const spouse: Dependent = {
      id: 'spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 1_200_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
      healthInsurance: 'nhi',
    };

    const household = composeNHIHousehold({
      taxpayer: {
        netIncome: 3_000_000,
        grossEmploymentIncome: 4_300_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shibuya',
      },
      dependents: [spouse],
      incomeYear: year,
      paymentAttribution: 'fullHousehold',
    });

    const result = calculateHouseholdNHIBreakdown(household, year);
    expect(result.householdBreakdown.total).toBeGreaterThan(0);
    expect(result.taxpayerBreakdown.total).toBe(result.householdBreakdown.total);
    expect(result.summary.paymentAttribution).toBe('fullHousehold');
    expect(result.summary.taxpayerTotal).toBe(result.summary.householdTotal);
  });

  it('handles paymentAttribution: none by setting taxpayer portions to zero', () => {
    const spouse: Dependent = {
      id: 'spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 2_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    };

    const household = composeNHIHousehold({
      taxpayer: {
        netIncome: 3_000_000,
        grossEmploymentIncome: 4_300_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shibuya',
      },
      dependents: [spouse],
      incomeYear: year,
      paymentAttribution: 'none',
    });

    const result = calculateHouseholdNHIBreakdown(household, year);
    expect(result.householdBreakdown.total).toBeGreaterThan(0);
    expect(result.taxpayerBreakdown.total).toBe(0);
    expect(result.taxpayerBreakdown.medicalPortion).toBe(0);
    expect(result.taxpayerBreakdown.elderlySupportPortion).toBe(0);
    expect(result.summary.paymentAttribution).toBe('none');
    expect(result.summary.taxpayerTotal).toBe(0);
  });

  it('apportions pro-rata taxpayerShare when taxpayer and spouse share NHI', () => {
    const spouse: Dependent = {
      id: 'spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 4_300_000, // Same gross income as taxpayer
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    };

    const household = composeNHIHousehold({
      taxpayer: {
        netIncome: 3_000_000,
        grossEmploymentIncome: 4_300_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shibuya',
      },
      dependents: [spouse],
      incomeYear: year,
      paymentAttribution: 'taxpayerShare',
    });

    const result = calculateHouseholdNHIBreakdown(household, year);
    expect(result.householdBreakdown.total).toBeGreaterThan(0);
    // Equal income and identical LTC eligibility should result in roughly 50% share
    const ratio = result.taxpayerBreakdown.total / result.householdBreakdown.total;
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('allocates zero taxpayer share when taxpayer is a deemed household head', () => {
    const spouse: Dependent = {
      id: 'spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 1_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    };

    const household = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: DEFAULT_PROVIDER, // Kyokai Kenpo (taxpayer not on NHI)
        region: 'Tokyo-Shibuya',
      },
      dependents: [spouse],
      incomeYear: year,
      paymentAttribution: 'taxpayerShare',
    });

    const result = calculateHouseholdNHIBreakdown(household, year);
    expect(result.householdBreakdown.total).toBeGreaterThan(0);
    expect(result.taxpayerBreakdown.total).toBe(0);
    expect(result.summary.isDeemedHead).toBe(true);
  });

  it('applies statutory 50% preschool discount and under-18 child support exemption', () => {
    const preschoolChild: Dependent = {
      id: 'child-preschool',
      relationship: 'child',
      ageRange: 'under6',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
      healthInsurance: 'nhi',
    };

    const householdWithPreschool = composeNHIHousehold({
      taxpayer: {
        netIncome: 2_000_000,
        grossEmploymentIncome: 3_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shibuya',
      },
      dependents: [preschoolChild],
      incomeYear: year,
    });

    const adultDependent: Dependent = {
      id: 'adult-dep',
      relationship: 'child',
      ageRange: '23to39',
      isCohabiting: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
      healthInsurance: 'nhi',
    };

    const householdWithAdultChild = composeNHIHousehold({
      taxpayer: {
        netIncome: 2_000_000,
        grossEmploymentIncome: 3_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo-Shibuya',
      },
      dependents: [adultDependent],
      incomeYear: year,
    });

    const resPreschool = calculateHouseholdNHIBreakdown(householdWithPreschool, year);
    const resAdult = calculateHouseholdNHIBreakdown(householdWithAdultChild, year);

    // Preschooler gets 50% off medical & elderlySupport per-capita, and 100% off childSupport per-capita
    expect(resPreschool.householdBreakdown.total).toBeLessThan(resAdult.householdBreakdown.total);
    expect(resPreschool.summary.preschoolCount).toBe(1);
    expect(resPreschool.summary.childSupportExemptCount).toBe(1);
  });
});
