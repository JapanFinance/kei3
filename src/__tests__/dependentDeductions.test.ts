import { describe, expect, it } from 'vitest'
import {
  calculateDependentDeductions,
  calculateDependentTotalNetIncome,
} from '../utils/dependentDeductions'
import { DEDUCTION_TYPES, type Dependent } from '../types/dependents'

// --- Helper functions to test internal logic via public API ---

function isEligibleForDependentDeduction(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  return result.nationalTax.dependentDeduction > 0;
}

function isEligibleForSpouseDeduction(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  return result.nationalTax.spouseDeduction > 0;
}

function isEligibleForSpouseSpecialDeduction(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  return result.nationalTax.spouseSpecialDeduction > 0;
}

function isEligibleForSpecificRelativeSpecialDeduction(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  return result.nationalTax.specificRelativeDeduction > 0;
}

function isSpecialDependent(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  // Special dependent deduction amount is 630,000
  return result.nationalTax.dependentDeduction === 630000;
}

function isElderlyDependent(dependent: Dependent): boolean {
  const result = calculateDependentDeductions([dependent], 5000000);
  // Elderly dependent deduction amount is 480,000 or 580,000 (cohabiting parent)
  return result.nationalTax.dependentDeduction === 480000 || result.nationalTax.dependentDeduction === 580000;
}

function getSpouseSpecialDeduction(spouseNetIncome: number, taxpayerNetIncome: number) {
  const spouse: Dependent = {
    id: 'test-spouse',
    relationship: 'spouse',
    ageCategory: 'under70',
    isCohabiting: true,
    disability: 'none',
    income: {
      grossEmploymentIncome: 0,
      otherNetIncome: spouseNetIncome,
    },
  };
  const result = calculateDependentDeductions([spouse], taxpayerNetIncome);
  return {
    national: result.nationalTax.spouseSpecialDeduction,
    residence: result.residenceTax.spouseSpecialDeduction
  };
}

function getSpecificRelativeDeduction(dependentNetIncome: number) {
  const dependent: Dependent = {
    id: 'test-child',
    relationship: 'child',
    ageCategory: '19to22',
    isCohabiting: false,
    disability: 'none',
    income: {
      grossEmploymentIncome: 0,
      otherNetIncome: dependentNetIncome,
    },
  };
  const result = calculateDependentDeductions([dependent], 5000000);
  return {
    national: result.nationalTax.specificRelativeDeduction,
    residence: result.residenceTax.specificRelativeDeduction
  };
}

/**
 * Helper to test spouse deduction logic via the public API
 */
function getSpouseDeduction(isElderly: boolean, taxpayerNetIncome: number) {
  const dependent: Dependent = {
    id: 'test-spouse',
    relationship: 'spouse',
    ageCategory: isElderly ? '70plus' : 'under70',
    isCohabiting: true,
    disability: 'none',
    income: {
      grossEmploymentIncome: 0,
      otherNetIncome: 0,
    },
  };
  
  const results = calculateDependentDeductions([dependent], taxpayerNetIncome);
  return {
    national: results.nationalTax.spouseDeduction,
    residence: results.residenceTax.spouseDeduction
  };
}

/**
 * Tests for dependent deduction eligibility and calculations
 * 
 * These tests verify the 2025 tax reform thresholds are correctly applied:
 * - Dependent deduction: income ≤ 58万円 (changed from 48万円)
 * - Spouse deduction: income ≤ 58万円 (changed from 48万円)
 * - Spouse special deduction: 58万円 < income ≤ 133万円 (lower bound changed from 48万円)
 * - Specific relative deduction: 58万円 < income ≤ 123万円 (lower bound changed from 48万円, upper limit 123万円)
 * 
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm
 */

describe('Dependent Deduction Eligibility (扶養控除)', () => {
  describe('At 58万円 threshold (2025 reform)', () => {
    it('qualifies with income at exactly 580,000 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_000, // Net = 580,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(dependent)).toBe(true)
    })

    it('does not qualify with income at 580,001 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_001, // Net = 580,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(dependent)).toBe(false)
    })

    it('qualifies with income at 579,999 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_229_999, // Net = 579,999
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(dependent)).toBe(true)
    })
  })

  describe('Old threshold boundary (48万円) no longer applies', () => {
    it('qualifies with income at 480,001 yen (would have failed under old rules)', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_130_001, // Net = 480,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(dependent)).toBe(true)
    })

    it('qualifies with income at 550,000 yen (between old and new thresholds)', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_200_000, // Net = 550,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(dependent)).toBe(true)
    })
  })

  describe('Spouse is never eligible for dependent deduction', () => {
    it('spouse with zero income does not qualify', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(spouse)).toBe(false)
    })

    it('spouse with 500,000 yen income does not qualify', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_150_000, // Net = 500,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForDependentDeduction(spouse)).toBe(false)
    })
  })
})

describe('Spouse Deduction Eligibility (配偶者控除)', () => {
  describe('At 58万円 threshold (2025 reform)', () => {
    it('qualifies with income at exactly 580,000 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_000, // Net = 580,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseDeduction(spouse)).toBe(true)
    })

    it('does not qualify with income at 580,001 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_001, // Net = 580,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseDeduction(spouse)).toBe(false)
    })

    it('qualifies with income at 579,999 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_229_999, // Net = 579,999
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseDeduction(spouse)).toBe(true)
    })
  })

  describe('Old threshold boundary (48万円) no longer applies', () => {
    it('qualifies with income at 480,001 yen (would have failed under old rules)', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_130_001, // Net = 480,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseDeduction(spouse)).toBe(true)
    })
  })

  describe('Non-spouse never qualifies', () => {
    it('child with zero income does not qualify for spouse deduction', () => {
      const child: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseDeduction(child)).toBe(false)
    })
  })
})

describe('Spouse Special Deduction Eligibility (配偶者特別控除)', () => {
  describe('At lower threshold boundary (58万円)', () => {
    it('does not qualify at exactly 580,000 yen (must be above)', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_000, // Net = 580,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(false)
    })

    it('qualifies at 580,001 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_001, // Net = 580,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })
  })

  describe('At upper threshold boundary (133万円)', () => {
    it('qualifies at exactly 1,330,000 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_980_000, // Net = 1,330,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })

    it('does not qualify at 1,330,001 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0, // Using otherNetIncome for exact control
          otherNetIncome: 1_330_001,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(false)
    })
  })

  describe('Old lower boundary (48万円) no longer applies', () => {
    it('does not qualify at 480,001 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_130_001, // Net = 480,001
          otherNetIncome: 0,
        },
      }
      // This is below the new 58万円 threshold, so it falls into spouse deduction range
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(false)
      expect(isEligibleForSpouseDeduction(spouse)).toBe(true)
    })
  })

  describe('Middle range values', () => {
    it('qualifies at 600,000 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_250_000, // Net = 600,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })

    it('qualifies at 1,000,000 yen', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_650_000, // Net = 1,000,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })
  })
})

describe('Spouse Special Deduction Amounts (with low taxpayer income)', () => {
  const taxpayerIncome = 5_000_000 // Below phase-out threshold

  describe('First bracket (58万円超～95万円以下)', () => {
    it('returns correct national tax amount at 580,001 yen', () => {
      expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).national).toBe(380_000)
    })

    it('returns correct residence tax amount at 580,001 yen', () => {
      expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).residence).toBe(330_000)
      expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).residence).toBe(330_000)
    })

    it('returns correct amount at 950,000 yen (upper bound)', () => {
      expect(getSpouseSpecialDeduction(950_000, taxpayerIncome).national).toBe(380_000)
    })
  })

  describe('Bracket boundaries', () => {
    it('transitions correctly at 95万円', () => {
      expect(getSpouseSpecialDeduction(950_000, taxpayerIncome).national).toBe(380_000)
      expect(getSpouseSpecialDeduction(950_001, taxpayerIncome).national).toBe(360_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).national).toBe(360_000)
      expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).national).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).national).toBe(310_000)
      expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).national).toBe(260_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).national).toBe(260_000)
      expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).national).toBe(210_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).national).toBe(210_000)
      expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).national).toBe(160_000)
    })

    it('transitions correctly at 120万円', () => {
      expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).national).toBe(160_000)
      expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).national).toBe(110_000)
    })

    it('transitions correctly at 125万円', () => {
      expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).national).toBe(110_000)
      expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).national).toBe(60_000)
    })

    it('transitions correctly at 130万円', () => {
      expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).national).toBe(60_000)
      expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).national).toBe(30_000)
    })

    it('upper limit at 133万円', () => {
      expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).national).toBe(30_000)
      expect(getSpouseSpecialDeduction(1_330_001, taxpayerIncome).national).toBe(0)
    })
  })

  describe('Returns 0 outside valid range', () => {
    it('returns 0 for income at or below spouse deduction threshold', () => {
      expect(getSpouseSpecialDeduction(580_000, taxpayerIncome).national).toBe(0)
      expect(getSpouseSpecialDeduction(500_000, taxpayerIncome).national).toBe(0)
    })

    it('returns 0 for income above upper limit', () => {
      expect(getSpouseSpecialDeduction(1_330_001, taxpayerIncome).national).toBe(0)
      expect(getSpouseSpecialDeduction(2_000_000, taxpayerIncome).national).toBe(0)
    })
  })
})

describe('Specific Relative Special Deduction Eligibility (特定親族特別控除)', () => {
  describe('Age 19-22 at threshold boundaries', () => {
    it('does not qualify at exactly 580,000 yen (must be above)', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_000, // Net = 580,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(false)
      // Should qualify for regular dependent deduction instead
      expect(isEligibleForDependentDeduction(dependent)).toBe(true)
    })

    it('qualifies at 580,001 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_230_001, // Net = 580,001
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(true)
    })

    it('qualifies at exactly 1,230,000 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 1_230_000, // Using otherNetIncome for exact control
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(true)
    })

    it('does not qualify at 1,230,001 yen', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0, // Using otherNetIncome for exact control
          otherNetIncome: 1_230_001,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(false)
    })
  })

  describe('Wrong age category does not qualify', () => {
    it('age 16-18 does not qualify', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_650_000, // Net = 1,000,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(false)
    })

    it('age 23 (in 23to69 category) does not qualify', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '23to69',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_650_000, // Net = 1,000,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(false)
    })

    it('age 70+ does not qualify', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'parent',
        ageCategory: '70plus',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_650_000, // Net = 1,000,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(dependent)).toBe(false)
    })
  })

  describe('Spouse never qualifies', () => {
    it('spouse with income in range does not qualify', () => {
      const spouse: Dependent = {
        id: '1',
        relationship: 'spouse',
        ageCategory: 'under70',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 1_650_000, // Net = 1,000,000
          otherNetIncome: 0,
        },
      }
      expect(isEligibleForSpecificRelativeSpecialDeduction(spouse)).toBe(false)
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })
  })
})

describe('Specific Relative Special Deduction Amounts', () => {
  describe('First bracket (58万円超～85万円以下)', () => {
    it('returns correct national tax amount at 580,001 yen', () => {
      expect(getSpecificRelativeDeduction(580_001).national).toBe(630_000)
    })

    it('returns correct residence tax amount at 580,001 yen', () => {
      expect(getSpecificRelativeDeduction(580_001).residence).toBe(450_000)
    })

    it('returns correct amount at 850,000 yen (upper bound)', () => {
      expect(getSpecificRelativeDeduction(850_000).national).toBe(630_000)
    })
  })

  describe('Bracket boundaries (national tax)', () => {
    it('transitions correctly at 85万円', () => {
      expect(getSpecificRelativeDeduction(850_000).national).toBe(630_000)
      expect(getSpecificRelativeDeduction(850_001).national).toBe(610_000)
    })

    it('transitions correctly at 90万円', () => {
      expect(getSpecificRelativeDeduction(900_000).national).toBe(610_000)
      expect(getSpecificRelativeDeduction(900_001).national).toBe(510_000)
    })

    it('transitions correctly at 95万円', () => {
      expect(getSpecificRelativeDeduction(950_000).national).toBe(510_000)
      expect(getSpecificRelativeDeduction(950_001).national).toBe(410_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpecificRelativeDeduction(1_000_000).national).toBe(410_000)
      expect(getSpecificRelativeDeduction(1_000_001).national).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpecificRelativeDeduction(1_050_000).national).toBe(310_000)
      expect(getSpecificRelativeDeduction(1_050_001).national).toBe(210_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpecificRelativeDeduction(1_100_000).national).toBe(210_000)
      expect(getSpecificRelativeDeduction(1_100_001).national).toBe(110_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpecificRelativeDeduction(1_150_000).national).toBe(110_000)
      expect(getSpecificRelativeDeduction(1_150_001).national).toBe(60_000)
    })
    
    it('transitions correctly at 120万円', () => {
      expect(getSpecificRelativeDeduction(1_200_000).national).toBe(60_000)
      expect(getSpecificRelativeDeduction(1_200_001).national).toBe(30_000)
    })
    
    it('upper limit at 123万円', () => {
      expect(getSpecificRelativeDeduction(1_230_000).national).toBe(30_000)
      expect(getSpecificRelativeDeduction(1_230_001).national).toBe(0)
    })
  })

  describe('Bracket boundaries (residence tax)', () => {
    it('first three brackets all return 45万円', () => {
      // 58万円超～85万円以下
      expect(getSpecificRelativeDeduction(580_001).residence).toBe(450_000)
      expect(getSpecificRelativeDeduction(850_000).residence).toBe(450_000)
      
      // 85万円超～90万円以下
      expect(getSpecificRelativeDeduction(850_001).residence).toBe(450_000)
      expect(getSpecificRelativeDeduction(900_000).residence).toBe(450_000)
      
      // 90万円超～95万円以下
      expect(getSpecificRelativeDeduction(900_001).residence).toBe(450_000)
      expect(getSpecificRelativeDeduction(950_000).residence).toBe(450_000)
    })

    it('transitions correctly at 95万円', () => {
      expect(getSpecificRelativeDeduction(950_000).residence).toBe(450_000)
      expect(getSpecificRelativeDeduction(950_001).residence).toBe(410_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpecificRelativeDeduction(1_000_000).residence).toBe(410_000)
      expect(getSpecificRelativeDeduction(1_000_001).residence).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpecificRelativeDeduction(1_050_000).residence).toBe(310_000)
      expect(getSpecificRelativeDeduction(1_050_001).residence).toBe(210_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpecificRelativeDeduction(1_100_000).residence).toBe(210_000)
      expect(getSpecificRelativeDeduction(1_100_001).residence).toBe(110_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpecificRelativeDeduction(1_150_000).residence).toBe(110_000)
      expect(getSpecificRelativeDeduction(1_150_001).residence).toBe(60_000)
    })

    it('transitions correctly at 120万円', () => {
      expect(getSpecificRelativeDeduction(1_200_000).residence).toBe(60_000)
      expect(getSpecificRelativeDeduction(1_200_001).residence).toBe(30_000)
    })

    it('upper limit at 123万円', () => {
      expect(getSpecificRelativeDeduction(1_230_000).residence).toBe(30_000)
      expect(getSpecificRelativeDeduction(1_230_001).residence).toBe(0)
    })
  })

  describe('Returns 0 outside valid range', () => {
    it('returns 0 for income at or below dependent deduction threshold', () => {
      expect(getSpecificRelativeDeduction(580_000).national).toBe(0)
      expect(getSpecificRelativeDeduction(500_000).national).toBe(0)
    })

    it('returns 0 for income above upper limit (123万円)', () => {
      expect(getSpecificRelativeDeduction(1_230_001).national).toBe(0)
      expect(getSpecificRelativeDeduction(2_000_000).national).toBe(0)
    })
  })
})

describe('Special Dependent (特定扶養親族) Classification', () => {
  it('age 19-22 with income ≤ 58万円 is special dependent', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_000, // Net = 580,000
        otherNetIncome: 0,
      },
    }
    expect(isSpecialDependent(dependent)).toBe(true)
  })

  it('age 19-22 with income > 58万円 is not special dependent', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_001, // Net = 580,001
        otherNetIncome: 0,
      },
    }
    expect(isSpecialDependent(dependent)).toBe(false)
  })
})

describe('Elderly Dependent Classification', () => {
  it('age 70+ with income ≤ 58万円 is elderly dependent', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'parent',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_000, // Net = 580,000
        otherNetIncome: 0,
      },
    }
    expect(isElderlyDependent(dependent)).toBe(true)
  })

  it('age 70+ with income > 58万円 is not elderly dependent', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'parent',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_001, // Net = 580,001
        otherNetIncome: 0,
      },
    }
    expect(isElderlyDependent(dependent)).toBe(false)
  })
})

describe('Total Net Income Calculation with Other Income', () => {
  it('combines employment income and other net income correctly', () => {
    const income = {
      grossEmploymentIncome: 1_000_000, // Net = 350,000
      otherNetIncome: 200_000,
    }
    expect(calculateDependentTotalNetIncome(income)).toBe(550_000)
  })

  it('threshold applies to total net income (employment + other)', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: '16to18',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_000_000, // Net = 350,000
        otherNetIncome: 230_000, // Total = 580,000
      },
    }
    expect(isEligibleForDependentDeduction(dependent)).toBe(true)
  })

  it('total net income of 580,001 exceeds threshold', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: '16to18',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_000_000, // Net = 350,000
        otherNetIncome: 230_001, // Total = 580,001
      },
    }
    expect(isEligibleForDependentDeduction(dependent)).toBe(false)
  })
})

describe('Taxpayer Income Effects on Spouse Deduction (配偶者控除)', () => {
  describe('Taxpayer income ≤ 9,000,000 yen', () => {
    it('returns full spouse deduction for national tax (380,000)', () => {
      expect(getSpouseDeduction(false, 9_000_000).national).toBe(380_000)
      expect(getSpouseDeduction(false, 5_000_000).national).toBe(380_000)
    })

    it('returns full spouse deduction for residence tax (330,000)', () => {
      expect(getSpouseDeduction(false, 9_000_000).residence).toBe(330_000)
      expect(getSpouseDeduction(false, 5_000_000).residence).toBe(330_000)
    })

    it('returns full elderly spouse deduction for national tax (480,000)', () => {
      expect(getSpouseDeduction(true, 9_000_000).national).toBe(480_000)
    })

    it('returns full elderly spouse deduction for residence tax (380,000)', () => {
      expect(getSpouseDeduction(true, 9_000_000).residence).toBe(380_000)
    })
  })

  describe('Taxpayer income 9,000,001 - 9,500,000 yen', () => {
    it('returns reduced spouse deduction for national tax (260,000)', () => {
      expect(getSpouseDeduction(false, 9_000_001).national).toBe(260_000)
      expect(getSpouseDeduction(false, 9_500_000).national).toBe(260_000)
    })

    it('returns reduced spouse deduction for residence tax (220,000)', () => {
      expect(getSpouseDeduction(false, 9_000_001).residence).toBe(220_000)
      expect(getSpouseDeduction(false, 9_500_000).residence).toBe(220_000)
    })

    it('returns reduced elderly spouse deduction for national tax (320,000)', () => {
      expect(getSpouseDeduction(true, 9_000_001).national).toBe(320_000)
      expect(getSpouseDeduction(true, 9_500_000).national).toBe(320_000)
    })

    it('returns reduced elderly spouse deduction for residence tax (260,000)', () => {
      expect(getSpouseDeduction(true, 9_000_001).residence).toBe(260_000)
      expect(getSpouseDeduction(true, 9_500_000).residence).toBe(260_000)
    })
  })

  describe('Taxpayer income 9,500,001 - 10,000,000 yen', () => {
    it('returns further reduced spouse deduction for national tax (130,000)', () => {
      expect(getSpouseDeduction(false, 9_500_001).national).toBe(130_000)
      expect(getSpouseDeduction(false, 10_000_000).national).toBe(130_000)
    })

    it('returns further reduced spouse deduction for residence tax (110,000)', () => {
      expect(getSpouseDeduction(false, 9_500_001).residence).toBe(110_000)
      expect(getSpouseDeduction(false, 10_000_000).residence).toBe(110_000)
    })

    it('returns further reduced elderly spouse deduction for national tax (160,000)', () => {
      expect(getSpouseDeduction(true, 9_500_001).national).toBe(160_000)
      expect(getSpouseDeduction(true, 10_000_000).national).toBe(160_000)
    })

    it('returns further reduced elderly spouse deduction for residence tax (130,000)', () => {
      expect(getSpouseDeduction(true, 9_500_001).residence).toBe(130_000)
      expect(getSpouseDeduction(true, 10_000_000).residence).toBe(130_000)
    })
  })

  describe('Taxpayer income > 10,000,000 yen', () => {
    it('returns zero - no spouse deduction allowed', () => {
      expect(getSpouseDeduction(false, 10_000_001).national).toBe(0)
      expect(getSpouseDeduction(false, 10_000_001).residence).toBe(0)
      expect(getSpouseDeduction(true, 10_000_001).national).toBe(0)
      expect(getSpouseDeduction(true, 10_000_001).residence).toBe(0)
      expect(getSpouseDeduction(false, 15_000_000).national).toBe(0)
    })
  })
})

describe('Taxpayer Income Effects on Spouse Special Deduction (配偶者特別控除)', () => {
  const spouseIncome = 950_001 // In the 95万円超～100万円以下 bracket

  describe('Taxpayer income ≤ 9,000,000 yen', () => {
    const taxpayerIncome = 8_000_000

    describe('National tax - all brackets', () => {
      it('58万円超～95万円以下: 380,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).national).toBe(380_000)
        expect(getSpouseSpecialDeduction(950_000, taxpayerIncome).national).toBe(380_000)
      })

      it('95万円超～100万円以下: 360,000', () => {
        expect(getSpouseSpecialDeduction(950_001, taxpayerIncome).national).toBe(360_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).national).toBe(360_000)
      })

      it('100万円超～105万円以下: 310,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).national).toBe(310_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).national).toBe(310_000)
      })

      it('105万円超～110万円以下: 260,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).national).toBe(260_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).national).toBe(260_000)
      })

      it('110万円超～115万円以下: 210,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).national).toBe(210_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).national).toBe(210_000)
      })

      it('115万円超～120万円以下: 160,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).national).toBe(160_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).national).toBe(160_000)
      })

      it('120万円超～125万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).national).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).national).toBe(110_000)
      })

      it('125万円超～130万円以下: 60,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).national).toBe(60_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).national).toBe(60_000)
      })

      it('130万円超～133万円以下: 30,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).national).toBe(30_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).national).toBe(30_000)
      })
    })

    describe('Residence tax - all brackets', () => {
      it('58万円超～100万円以下: 330,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).residence).toBe(330_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).residence).toBe(330_000)
      })

      it('100万円超～105万円以下: 310,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).residence).toBe(310_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).residence).toBe(310_000)
      })

      it('105万円超～110万円以下: 260,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).residence).toBe(260_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).residence).toBe(260_000)
      })

      it('110万円超～115万円以下: 210,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).residence).toBe(210_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).residence).toBe(210_000)
      })

      it('115万円超～120万円以下: 160,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).residence).toBe(160_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).residence).toBe(160_000)
      })

      it('120万円超～125万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).residence).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).residence).toBe(110_000)
      })

      it('125万円超～130万円以下: 60,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).residence).toBe(60_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).residence).toBe(60_000)
      })

      it('130万円超～133万円以下: 30,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).residence).toBe(30_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).residence).toBe(30_000)
      })
    })
  })

  describe('Taxpayer income 9,000,001 - 9,500,000 yen', () => {
    const taxpayerIncome = 9_200_000

    describe('National tax - all brackets', () => {
      it('58万円超～95万円以下: 260,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).national).toBe(260_000)
        expect(getSpouseSpecialDeduction(950_000, taxpayerIncome).national).toBe(260_000)
      })

      it('95万円超～100万円以下: 240,000', () => {
        expect(getSpouseSpecialDeduction(950_001, taxpayerIncome).national).toBe(240_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).national).toBe(240_000)
      })

      it('100万円超～105万円以下: 210,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).national).toBe(210_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).national).toBe(210_000)
      })

      it('105万円超～110万円以下: 180,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).national).toBe(180_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).national).toBe(180_000)
      })

      it('110万円超～115万円以下: 140,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).national).toBe(140_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).national).toBe(140_000)
      })

      it('115万円超～120万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).national).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).national).toBe(110_000)
      })

      it('120万円超～125万円以下: 80,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).national).toBe(80_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).national).toBe(80_000)
      })

      it('125万円超～130万円以下: 40,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).national).toBe(40_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).national).toBe(40_000)
      })

      it('130万円超～133万円以下: 20,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).national).toBe(20_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).national).toBe(20_000)
      })
    })

    describe('Residence tax - all brackets', () => {
      it('58万円超～100万円以下: 220,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).residence).toBe(220_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).residence).toBe(220_000)
      })

      it('100万円超～105万円以下: 210,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).residence).toBe(210_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).residence).toBe(210_000)
      })

      it('105万円超～110万円以下: 180,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).residence).toBe(180_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).residence).toBe(180_000)
      })

      it('110万円超～115万円以下: 140,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).residence).toBe(140_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).residence).toBe(140_000)
      })

      it('115万円超～120万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).residence).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).residence).toBe(110_000)
      })

      it('120万円超～125万円以下: 80,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).residence).toBe(80_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).residence).toBe(80_000)
      })

      it('125万円超～130万円以下: 40,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).residence).toBe(40_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).residence).toBe(40_000)
      })

      it('130万円超～133万円以下: 20,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).residence).toBe(20_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).residence).toBe(20_000)
      })
    })
  })

  describe('Taxpayer income 9,500,001 - 10,000,000 yen', () => {
    const taxpayerIncome = 9_700_000

    describe('National tax - all brackets', () => {
      it('58万円超～95万円以下: 130,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).national).toBe(130_000)
        expect(getSpouseSpecialDeduction(950_000, taxpayerIncome).national).toBe(130_000)
      })

      it('95万円超～100万円以下: 120,000', () => {
        expect(getSpouseSpecialDeduction(950_001, taxpayerIncome).national).toBe(120_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).national).toBe(120_000)
      })

      it('100万円超～105万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).national).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).national).toBe(110_000)
      })

      it('105万円超～110万円以下: 90,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).national).toBe(90_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).national).toBe(90_000)
      })

      it('110万円超～115万円以下: 70,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).national).toBe(70_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).national).toBe(70_000)
      })

      it('115万円超～120万円以下: 60,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).national).toBe(60_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).national).toBe(60_000)
      })

      it('120万円超～125万円以下: 40,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).national).toBe(40_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).national).toBe(40_000)
      })

      it('125万円超～130万円以下: 20,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).national).toBe(20_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).national).toBe(20_000)
      })

      it('130万円超～133万円以下: 10,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).national).toBe(10_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).national).toBe(10_000)
      })
    })

    describe('Residence tax - all brackets', () => {
      it('58万円超～100万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(580_001, taxpayerIncome).residence).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_000_000, taxpayerIncome).residence).toBe(110_000)
      })

      it('100万円超～105万円以下: 110,000', () => {
        expect(getSpouseSpecialDeduction(1_000_001, taxpayerIncome).residence).toBe(110_000)
        expect(getSpouseSpecialDeduction(1_050_000, taxpayerIncome).residence).toBe(110_000)
      })

      it('105万円超～110万円以下: 90,000', () => {
        expect(getSpouseSpecialDeduction(1_050_001, taxpayerIncome).residence).toBe(90_000)
        expect(getSpouseSpecialDeduction(1_100_000, taxpayerIncome).residence).toBe(90_000)
      })

      it('110万円超～115万円以下: 70,000', () => {
        expect(getSpouseSpecialDeduction(1_100_001, taxpayerIncome).residence).toBe(70_000)
        expect(getSpouseSpecialDeduction(1_150_000, taxpayerIncome).residence).toBe(70_000)
      })

      it('115万円超～120万円以下: 60,000', () => {
        expect(getSpouseSpecialDeduction(1_150_001, taxpayerIncome).residence).toBe(60_000)
        expect(getSpouseSpecialDeduction(1_200_000, taxpayerIncome).residence).toBe(60_000)
      })

      it('120万円超～125万円以下: 40,000', () => {
        expect(getSpouseSpecialDeduction(1_200_001, taxpayerIncome).residence).toBe(40_000)
        expect(getSpouseSpecialDeduction(1_250_000, taxpayerIncome).residence).toBe(40_000)
      })

      it('125万円超～130万円以下: 20,000', () => {
        expect(getSpouseSpecialDeduction(1_250_001, taxpayerIncome).residence).toBe(20_000)
        expect(getSpouseSpecialDeduction(1_300_000, taxpayerIncome).residence).toBe(20_000)
      })

      it('130万円超～133万円以下: 10,000', () => {
        expect(getSpouseSpecialDeduction(1_300_001, taxpayerIncome).residence).toBe(10_000)
        expect(getSpouseSpecialDeduction(1_330_000, taxpayerIncome).residence).toBe(10_000)
      })
    })
  })

  describe('Taxpayer income > 10,000,000 yen', () => {
    it('returns zero - no spouse special deduction allowed', () => {
      expect(getSpouseSpecialDeduction(spouseIncome, 10_000_001).national).toBe(0)
      expect(getSpouseSpecialDeduction(spouseIncome, 10_000_001).residence).toBe(0)
      expect(getSpouseSpecialDeduction(580_001, 15_000_000).national).toBe(0)
    })
  })

  describe('Returns zero outside spouse income range', () => {
    it('returns zero when spouse income ≤ 58万円', () => {
      expect(getSpouseSpecialDeduction(580_000, 5_000_000).national).toBe(0)
    })

    it('returns zero when spouse income > 133万円', () => {
      expect(getSpouseSpecialDeduction(1_330_001, 5_000_000).national).toBe(0)
    })
  })
})

describe('Integration: calculateDependentDeductions with Taxpayer Income', () => {
  describe('Spouse deduction with varying taxpayer income', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_000, // Net = 580,000
        otherNetIncome: 0,
      },
    }

    it('full deduction when taxpayer income ≤ 9,000,000', () => {
      const result = calculateDependentDeductions([spouse], 8_000_000)
      expect(result.nationalTax.spouseDeduction).toBe(380_000)
      expect(result.residenceTax.spouseDeduction).toBe(330_000)
    })

    it('reduced deduction when taxpayer income 9,000,001 - 9,500,000', () => {
      const result = calculateDependentDeductions([spouse], 9_200_000)
      expect(result.nationalTax.spouseDeduction).toBe(260_000)
      expect(result.residenceTax.spouseDeduction).toBe(220_000)
    })

    it('further reduced when taxpayer income 9,500,001 - 10,000,000', () => {
      const result = calculateDependentDeductions([spouse], 9_700_000)
      expect(result.nationalTax.spouseDeduction).toBe(130_000)
      expect(result.residenceTax.spouseDeduction).toBe(110_000)
    })

    it('no deduction when taxpayer income > 10,000,000', () => {
      const result = calculateDependentDeductions([spouse], 11_000_000)
      expect(result.nationalTax.spouseDeduction).toBe(0)
      expect(result.residenceTax.spouseDeduction).toBe(0)
    })
  })

  describe('Spouse special deduction with varying taxpayer income', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_600_001, // Net = 950,001 (95万円超～100万円 bracket)
        otherNetIncome: 0,
      },
    }

    it('full deduction when taxpayer income ≤ 9,000,000', () => {
      const result = calculateDependentDeductions([spouse], 8_000_000)
      expect(result.nationalTax.spouseSpecialDeduction).toBe(360_000)
      expect(result.residenceTax.spouseSpecialDeduction).toBe(330_000)
    })

    it('reduced deduction when taxpayer income 9,000,001 - 9,500,000', () => {
      const result = calculateDependentDeductions([spouse], 9_200_000)
      expect(result.nationalTax.spouseSpecialDeduction).toBe(240_000)
      expect(result.residenceTax.spouseSpecialDeduction).toBe(220_000)
    })

    it('further reduced when taxpayer income 9,500,001 - 10,000,000', () => {
      const result = calculateDependentDeductions([spouse], 9_700_000)
      expect(result.nationalTax.spouseSpecialDeduction).toBe(120_000)
      expect(result.residenceTax.spouseSpecialDeduction).toBe(110_000)
    })

    it('no deduction when taxpayer income > 10,000,000', () => {
      const result = calculateDependentDeductions([spouse], 11_000_000)
      expect(result.nationalTax.spouseSpecialDeduction).toBe(0)
      expect(result.residenceTax.spouseSpecialDeduction).toBe(0)
    })
  })

  describe('Elderly spouse deduction with varying taxpayer income', () => {
    const elderlySpouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000, // Net = 350,000
        otherNetIncome: 0,
      },
    }

    it('full elderly spouse deduction when taxpayer income ≤ 9,000,000', () => {
      const result = calculateDependentDeductions([elderlySpouse], 8_000_000)
      expect(result.nationalTax.spouseDeduction).toBe(480_000)
      expect(result.residenceTax.spouseDeduction).toBe(380_000)
    })

    it('reduced elderly spouse deduction when taxpayer income 9,000,001 - 9,500,000', () => {
      const result = calculateDependentDeductions([elderlySpouse], 9_200_000)
      expect(result.nationalTax.spouseDeduction).toBe(320_000)
      expect(result.residenceTax.spouseDeduction).toBe(260_000)
    })

    it('further reduced when taxpayer income 9,500,001 - 10,000,000', () => {
      const result = calculateDependentDeductions([elderlySpouse], 9_700_000)
      expect(result.nationalTax.spouseDeduction).toBe(160_000)
      expect(result.residenceTax.spouseDeduction).toBe(130_000)
    })

    it('no deduction when taxpayer income > 10,000,000', () => {
      const result = calculateDependentDeductions([elderlySpouse], 11_000_000)
      expect(result.nationalTax.spouseDeduction).toBe(0)
      expect(result.residenceTax.spouseDeduction).toBe(0)
    })
  })

  describe('Non-spouse dependents unaffected by taxpayer income', () => {
    const child: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_230_000, // Net = 580,000
        otherNetIncome: 0,
      },
    }

    it('dependent deduction remains constant regardless of taxpayer income', () => {
      const result1 = calculateDependentDeductions([child], 5_000_000)
      const result2 = calculateDependentDeductions([child], 9_500_000)
      const result3 = calculateDependentDeductions([child], 11_000_000)
      
      expect(result1.nationalTax.dependentDeduction).toBe(630_000)
      expect(result2.nationalTax.dependentDeduction).toBe(630_000)
      expect(result3.nationalTax.dependentDeduction).toBe(630_000)
    })
  })
})

describe('Dependent Deductions - Under 16', () => {
  it('should not provide dependent deduction for child under 16', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'none',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    const result = calculateDependentDeductions([dependent], 5000000)
    
    // Should have 0 deduction
    expect(result.nationalTax.dependentDeduction).toBe(0)
    expect(result.residenceTax.dependentDeduction).toBe(0)
    
    // Should be marked as NOT_ELIGIBLE in breakdown
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0]!.deductionType).toBe(DEDUCTION_TYPES.NOT_ELIGIBLE)
  })

  it('should provide disability deduction for disabled child under 16', () => {
    const dependent: Dependent = {
      id: '1',
      relationship: 'child',
      ageCategory: 'under16',
      isCohabiting: true,
      disability: 'regular',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    const result = calculateDependentDeductions([dependent], 5000000)
    
    // Should have disability deduction
    expect(result.nationalTax.disabilityDeduction).toBeGreaterThan(0)
    expect(result.residenceTax.disabilityDeduction).toBeGreaterThan(0)
    
    // Should NOT have dependent deduction
    expect(result.nationalTax.dependentDeduction).toBe(0)
    expect(result.residenceTax.dependentDeduction).toBe(0)
    
    // Breakdown should show Disability
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0]!.deductionType).toBe(DEDUCTION_TYPES.DISABILITY)
  })
})
