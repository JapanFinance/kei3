// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'
import { calculateHealthInsurancePremium, calculateHealthInsuranceBreakdown, calculateEmployeesHealthInsuranceBonusBreakdown } from '../utils/healthInsuranceCalculator'
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, DEFAULT_PROVIDER, CUSTOM_PROVIDER_ID } from '../types/healthInsurance'

const KYOKAI_KENPO_PROVIDER = DEFAULT_PROVIDER;
const ITS_KENPO_PROVIDER = 'KantoItsKenpo';

describe('calculateHealthInsurancePremium for employees', () => {
  describe('Kyokai Kenpo (Tokyo)', () => {
    it('calculates premium for people under 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(243_780)
    })

    it('calculates employees health insurance premium for people under 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(826_488)
    })

    it('calculates employees health insurance premium with nursing care for people over 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(282_900)
    })

    it('calculates employees health insurance premium with nursing care for people over 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(959_100)
    })

    it('handles zero income correctly', () => {
      expect(calculateHealthInsurancePremium(0, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(34_488)
      expect(calculateHealthInsurancePremium(0, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(40_020)
    })

    it('handles negative income correctly', () => {
      expect(() => calculateHealthInsurancePremium(-1_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toThrowError('Income cannot be negative.')
      expect(() => calculateHealthInsurancePremium(-1_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toThrowError('Income cannot be negative.')
    })
  });

  describe('ITS Kenpo (Default Region)', () => {
    // Annual income 5,000,000 / 12 = 416,666.67. SMR: 410,000円
    // Employee No LTC: 19,475. Employee With LTC: 19,475 + 3,690 (LTC for 410k) = 23,165
    it('calculates premium for people under 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(19475 * 12); // 233_700
    });

    // Annual income 20,000,000 / 12 = 1,666,666.67. SMR: 1,390,000円 (Max)
    // Employee No LTC: 66,025. Employee With LTC: 66,025 + 12,510 (LTC for 1.39M) = 78,535
    it('calculates premium for people under 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(66025 * 12); // 792_300
    });

    it('calculates premium with nursing care for people over 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(23165 * 12); // 277_980
    });

    it('calculates premium with nursing care for people over 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(78535 * 12); // 942_420
    });

    // Annual income 0 / 12 = 0. SMR: 58,000円
    // Employee No LTC: 2,755. Employee With LTC: 2,755 + 522 (LTC for 58k) = 3,277
    it('handles zero income correctly', () => {
      expect(calculateHealthInsurancePremium(0, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(2755 * 12); // 33_060
      expect(calculateHealthInsurancePremium(0, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(3277 * 12); // 39_324
    });

    it('handles negative income correctly', () => {
      expect(() => calculateHealthInsurancePremium(-1_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toThrowError('Income cannot be negative.');
      expect(() => calculateHealthInsurancePremium(-1_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toThrowError('Income cannot be negative.');
    });
  });
})

describe('calculateHealthInsurancePremium for non-employees', () => {
  it('calculates NHI premium', () => {
    expect(calculateHealthInsurancePremium(5_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(539_380)
  })

  it('calculates NHI premium with cap', () => {
    expect(calculateHealthInsurancePremium(20_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(920_000)
  })

  it('calculates NHI premium with nursing care', () => {
    expect(calculateHealthInsurancePremium(5_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(658_805)
  })

  it('calculates NHI premium with nursing care and cap', () => {
    expect(calculateHealthInsurancePremium(20_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(1_090_000)
  })

  it('handles zero income correctly', () => {
    expect(calculateHealthInsurancePremium(0, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(64_100)
    expect(calculateHealthInsurancePremium(0, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(80_700)
  })

  it('handles negative income correctly', () => {
    expect(() => calculateHealthInsurancePremium(-1_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toThrowError('Income cannot be negative.')
    expect(() => calculateHealthInsurancePremium(-1_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toThrowError('Income cannot be negative.')
  })
})

describe('calculateHealthInsurancePremium for employees with NHI', () => {
  // Test cases for employment income workers who are on NHI
  // (e.g., small employers, part-time workers, low income thresholds)
  it('calculates NHI premium for employment income', () => {
    expect(calculateHealthInsurancePremium(5_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(539_380)
  })

  it('calculates NHI premium for employment income with nursing care', () => {
    expect(calculateHealthInsurancePremium(5_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(658_805)
  })

  it('calculates NHI premium for employment income with cap', () => {
    expect(calculateHealthInsurancePremium(20_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(920_000)
  })

  it('calculates NHI premium for employment income with nursing care and cap', () => {
    expect(calculateHealthInsurancePremium(20_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(1_090_000)
  })

  it('handles zero employment income correctly', () => {
    expect(calculateHealthInsurancePremium(0, false, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(64_100)
    expect(calculateHealthInsurancePremium(0, true, NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo')).toBe(80_700)
  })
})

describe('calculateHealthInsurancePremium for Osaka (with household flat rate)', () => {
  // Osaka has household flat rate (平等割) components:
  // Medical: ¥33,574, Support: ¥10,761, LTC: ¥0
  // These are per-household amounts added to the calculation

  it('calculates Osaka NHI premium without nursing care', () => {
    // Expected calculation for 5M income:
    // Medical: (5M - 430k) * 9.30% + 34,424 + 33,574 = 424,980 + 34,424 + 33,574 = 492,978 (under cap 650k)
    // Support: (5M - 430k) * 3.02% + 11,034 + 10,761 = 138,030 + 11,034 + 10,761 = 159,825 (under cap 240k)
    // LTC: 0 (not applicable)
    // Total: 492,978 + 159,825 = 652,803 (adjusted for rounding: 652,817)
    expect(calculateHealthInsurancePremium(5_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(652_817)
  })

  it('calculates Osaka NHI premium with nursing care', () => {
    // Expected calculation for 5M income:
    // Medical: Same as above = 492,978
    // Support: Same as above = 159,825  
    // LTC: (5M - 430k) * 2.56% + 18,784 + 0 = 116,915 + 18,784 = 135,699 (under cap 170k)
    // Total: 492,978 + 159,825 + 135,699 = 788,502 (adjusted for rounding: 788,593)
    expect(calculateHealthInsurancePremium(5_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(788_593)
  })

  it('calculates Osaka NHI premium with caps applied', () => {
    // For very high income like 20M, caps will be applied
    // Medical: Capped at 650,000
    // Support: Capped at 240,000  
    // LTC: Capped at 170,000 (if applicable)
    expect(calculateHealthInsurancePremium(20_000_000, false, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(890_000) // 650k + 240k
    expect(calculateHealthInsurancePremium(20_000_000, true, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(1_060_000) // 650k + 240k + 170k
  })

  it('handles zero income correctly for Osaka (only per-capita and household flat amounts)', () => {
    // Medical: 0 + 34,424 + 33,574 = 67,998
    // Support: 0 + 11,034 + 10,761 = 21,795
    // Total without LTC: 89,793
    expect(calculateHealthInsurancePremium(0, false, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(89_793)

    // With LTC: + 18,784 = 108,577
    expect(calculateHealthInsurancePremium(0, true, NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe(108_577)
  })
})

describe('Dependent Coverage', () => {
  it('returns zero premium for dependent coverage regardless of age', () => {
    expect(calculateHealthInsurancePremium(0, false, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(0, true, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(500_000, false, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(500_000, true, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(1_299_999, false, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(1_299_999, true, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
  })

  it('returns zero premium for dependent coverage at threshold income', () => {
    expect(calculateHealthInsurancePremium(1_300_000, false, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(1_300_000, true, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
  })

  it('returns zero premium for dependent coverage even above threshold (validation should be in UI)', () => {
    // The calculator itself doesn't enforce the threshold - that's done at the UI level
    expect(calculateHealthInsurancePremium(2_000_000, false, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
    expect(calculateHealthInsurancePremium(2_000_000, true, 'DependentCoverage', DEFAULT_PROVIDER_REGION)).toBe(0)
  })
})

describe('Custom Provider', () => {
  const customRates = { healthRate: 5, ltcRate: 1 }; // 5% and 1%

  // Annual income 5,000,000 / 12 = 416,666.67. SMR: 410,000円
  // Employee No LTC: 410,000 * 0.05 = 20,500
  it('calculates premium with custom rates for people under 40', () => {
    expect(calculateHealthInsurancePremium(5_000_000, false, CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION, customRates)).toBe(20500 * 12); // 246,000
  });

  // Employee With LTC: 410,000 * 0.05 + 410,000 * 0.01 = 20,500 + 4,100 = 24,600
  it('calculates premium with custom rates for people over 40', () => {
    expect(calculateHealthInsurancePremium(5_000_000, true, CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION, customRates)).toBe(24600 * 12); // 295,200
  });

  it('returns 0 if custom rates are missing', () => {
    expect(calculateHealthInsurancePremium(5_000_000, false, CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION)).toBe(0);
  });

  it('handles zero income correctly with custom rates', () => {
    // SMR for 0 income is 58,000 (min bracket)
    // 58,000 * 0.05 = 2,900
    expect(calculateHealthInsurancePremium(0, false, CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION, customRates)).toBe(2900 * 12);
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
    const result = calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
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
    const result = calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
    expect(result.bonusPortion).toBe(283_921);
  });

  it('calculates premium for multiple bonuses summing below cap', () => {
    // Bonus 1: 1,000,000
    // Bonus 2: 2,000,000
    // Total Standard Bonus: 3,000,000 (all rounded to nearest 1k already)
    // Health: 3,000,000 * 0.04955 = 148,650
    const bonuses = [
      { amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 2_000_000, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const result = calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
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
      { amount: 3_000_000, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const result = calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
    expect(result.bonusPortion).toBe(283_921);
  });

  it('applies rounding to standard bonus amount before summing', () => {
    // Bonus 1: 100,500 -> 100,000
    // Bonus 2: 200,999 -> 200,000
    // Total Standard Bonus: 300,000
    // Health: 300,000 * 0.04955 = 14,865
    const bonuses = [
      { amount: 100_500, id: '1', type: 'bonus' as const, month: 6 },
      { amount: 200_999, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const result = calculateHealthInsuranceBreakdown(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
    expect(result.bonusPortion).toBe(14_865);
  });

  it('calculates premium with long term care insurance', () => {
    // Bonus: 1,000,000
    // Health: 1,000,000 * 0.04955 = 49,550
    // LTC: 1,000,000 * 0.00795 = 7,950
    // Total Bonus Premium: 57,500
    const bonuses = [{ amount: 1_000_000, id: '1', type: 'bonus' as const, month: 6 }];
    const result = calculateHealthInsuranceBreakdown(5_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo", undefined, bonuses);
    expect(result.bonusPortion).toBe(57_500);
  });
});

describe('calculateHealthInsuranceBonusBreakdown details', () => {
  // Using Kyokai Kenpo (Tokyo) rates for testing
  // Health Rate: 9.91% -> Employee: 4.955% (0.04955)
  // LTC Rate: 1.59% -> Employee: 0.795% (0.00795)

  const rates = {
    employeeHealthInsuranceRate: 0.04955,
    employeeLongTermCareRate: 0.00795
  };

  it('returns correct breakdown for single bonus below cap', () => {
    const bonuses = [{ amount: 1_000_500, id: '1', type: 'bonus' as const, month: 6 }];
    const breakdown = calculateEmployeesHealthInsuranceBonusBreakdown(bonuses, rates, true);

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
      { amount: 3_000_000, id: '2', type: 'bonus' as const, month: 12 }
    ];
    const breakdown = calculateEmployeesHealthInsuranceBonusBreakdown(bonuses, rates, false);

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
