import { describe, expect, it } from 'vitest'
import {
  getSpouseSpecialDeduction,
  getSpecificRelativeDeduction,
  NATIONAL_TAX_DEDUCTIONS,
  RESIDENCE_TAX_DEDUCTIONS,
} from '../utils/dependentDeductions'
import {
  isEligibleForDependentDeduction,
  isEligibleForSpouseDeduction,
  isEligibleForSpouseSpecialDeduction,
  isEligibleForSpecificRelativeDeduction,
  isSpecialDependent,
  isElderlyDependent,
  calculateDependentTotalNetIncome,
} from '../types/dependents'
import type { Dependent } from '../types/dependents'

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

describe('Spouse Special Deduction Amounts', () => {
  describe('First bracket (58万円超～95万円以下)', () => {
    it('returns correct national tax amount at 580,001 yen', () => {
      expect(getSpouseSpecialDeduction(580_001, false)).toBe(NATIONAL_TAX_DEDUCTIONS.SPOUSE_SPECIAL_58TO95)
      expect(getSpouseSpecialDeduction(580_001, false)).toBe(380_000)
    })

    it('returns correct residence tax amount at 580,001 yen', () => {
      expect(getSpouseSpecialDeduction(580_001, true)).toBe(RESIDENCE_TAX_DEDUCTIONS.SPOUSE_SPECIAL_58TO95)
      expect(getSpouseSpecialDeduction(580_001, true)).toBe(330_000)
    })

    it('returns correct amount at 950,000 yen (upper bound)', () => {
      expect(getSpouseSpecialDeduction(950_000, false)).toBe(380_000)
    })
  })

  describe('Bracket boundaries', () => {
    it('transitions correctly at 95万円', () => {
      expect(getSpouseSpecialDeduction(950_000, false)).toBe(380_000)
      expect(getSpouseSpecialDeduction(950_001, false)).toBe(360_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpouseSpecialDeduction(1_000_000, false)).toBe(360_000)
      expect(getSpouseSpecialDeduction(1_000_001, false)).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpouseSpecialDeduction(1_050_000, false)).toBe(310_000)
      expect(getSpouseSpecialDeduction(1_050_001, false)).toBe(260_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpouseSpecialDeduction(1_100_000, false)).toBe(260_000)
      expect(getSpouseSpecialDeduction(1_100_001, false)).toBe(210_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpouseSpecialDeduction(1_150_000, false)).toBe(210_000)
      expect(getSpouseSpecialDeduction(1_150_001, false)).toBe(160_000)
    })

    it('transitions correctly at 120万円', () => {
      expect(getSpouseSpecialDeduction(1_200_000, false)).toBe(160_000)
      expect(getSpouseSpecialDeduction(1_200_001, false)).toBe(110_000)
    })

    it('transitions correctly at 125万円', () => {
      expect(getSpouseSpecialDeduction(1_250_000, false)).toBe(110_000)
      expect(getSpouseSpecialDeduction(1_250_001, false)).toBe(60_000)
    })

    it('transitions correctly at 130万円', () => {
      expect(getSpouseSpecialDeduction(1_300_000, false)).toBe(60_000)
      expect(getSpouseSpecialDeduction(1_300_001, false)).toBe(30_000)
    })

    it('upper limit at 133万円', () => {
      expect(getSpouseSpecialDeduction(1_330_000, false)).toBe(30_000)
      expect(getSpouseSpecialDeduction(1_330_001, false)).toBe(0)
    })
  })

  describe('Returns 0 outside valid range', () => {
    it('returns 0 for income at or below spouse deduction threshold', () => {
      expect(getSpouseSpecialDeduction(580_000, false)).toBe(0)
      expect(getSpouseSpecialDeduction(500_000, false)).toBe(0)
    })

    it('returns 0 for income above upper limit', () => {
      expect(getSpouseSpecialDeduction(1_330_001, false)).toBe(0)
      expect(getSpouseSpecialDeduction(2_000_000, false)).toBe(0)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(false)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(true)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(true)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(false)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(false)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(false)
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
      expect(isEligibleForSpecificRelativeDeduction(dependent)).toBe(false)
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
      expect(isEligibleForSpecificRelativeDeduction(spouse)).toBe(false)
      expect(isEligibleForSpouseSpecialDeduction(spouse)).toBe(true)
    })
  })
})

describe('Specific Relative Special Deduction Amounts', () => {
  describe('First bracket (58万円超～85万円以下)', () => {
    it('returns correct national tax amount at 580,001 yen', () => {
      expect(getSpecificRelativeDeduction(580_001, false)).toBe(NATIONAL_TAX_DEDUCTIONS.SPECIFIC_RELATIVE_58TO85)
      expect(getSpecificRelativeDeduction(580_001, false)).toBe(630_000)
    })

    it('returns correct residence tax amount at 580,001 yen', () => {
      expect(getSpecificRelativeDeduction(580_001, true)).toBe(RESIDENCE_TAX_DEDUCTIONS.SPECIFIC_RELATIVE_58TO85)
      expect(getSpecificRelativeDeduction(580_001, true)).toBe(450_000)
    })

    it('returns correct amount at 850,000 yen (upper bound)', () => {
      expect(getSpecificRelativeDeduction(850_000, false)).toBe(630_000)
    })
  })

  describe('Bracket boundaries (national tax)', () => {
    it('transitions correctly at 85万円', () => {
      expect(getSpecificRelativeDeduction(850_000, false)).toBe(630_000)
      expect(getSpecificRelativeDeduction(850_001, false)).toBe(610_000)
    })

    it('transitions correctly at 90万円', () => {
      expect(getSpecificRelativeDeduction(900_000, false)).toBe(610_000)
      expect(getSpecificRelativeDeduction(900_001, false)).toBe(510_000)
    })

    it('transitions correctly at 95万円', () => {
      expect(getSpecificRelativeDeduction(950_000, false)).toBe(510_000)
      expect(getSpecificRelativeDeduction(950_001, false)).toBe(410_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpecificRelativeDeduction(1_000_000, false)).toBe(410_000)
      expect(getSpecificRelativeDeduction(1_000_001, false)).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpecificRelativeDeduction(1_050_000, false)).toBe(310_000)
      expect(getSpecificRelativeDeduction(1_050_001, false)).toBe(210_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpecificRelativeDeduction(1_100_000, false)).toBe(210_000)
      expect(getSpecificRelativeDeduction(1_100_001, false)).toBe(110_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpecificRelativeDeduction(1_150_000, false)).toBe(110_000)
      expect(getSpecificRelativeDeduction(1_150_001, false)).toBe(60_000)
    })
    
    it('transitions correctly at 120万円', () => {
      expect(getSpecificRelativeDeduction(1_200_000, false)).toBe(60_000)
      expect(getSpecificRelativeDeduction(1_200_001, false)).toBe(30_000)
    })
    
    it('upper limit at 123万円', () => {
      expect(getSpecificRelativeDeduction(1_230_000, false)).toBe(30_000)
      expect(getSpecificRelativeDeduction(1_230_001, false)).toBe(0)
    })
  })

  describe('Bracket boundaries (residence tax)', () => {
    it('first three brackets all return 45万円', () => {
      // 58万円超～85万円以下
      expect(getSpecificRelativeDeduction(580_001, true)).toBe(450_000)
      expect(getSpecificRelativeDeduction(850_000, true)).toBe(450_000)
      
      // 85万円超～90万円以下
      expect(getSpecificRelativeDeduction(850_001, true)).toBe(450_000)
      expect(getSpecificRelativeDeduction(900_000, true)).toBe(450_000)
      
      // 90万円超～95万円以下
      expect(getSpecificRelativeDeduction(900_001, true)).toBe(450_000)
      expect(getSpecificRelativeDeduction(950_000, true)).toBe(450_000)
    })

    it('transitions correctly at 95万円', () => {
      expect(getSpecificRelativeDeduction(950_000, true)).toBe(450_000)
      expect(getSpecificRelativeDeduction(950_001, true)).toBe(410_000)
    })

    it('transitions correctly at 100万円', () => {
      expect(getSpecificRelativeDeduction(1_000_000, true)).toBe(410_000)
      expect(getSpecificRelativeDeduction(1_000_001, true)).toBe(310_000)
    })

    it('transitions correctly at 105万円', () => {
      expect(getSpecificRelativeDeduction(1_050_000, true)).toBe(310_000)
      expect(getSpecificRelativeDeduction(1_050_001, true)).toBe(210_000)
    })

    it('transitions correctly at 110万円', () => {
      expect(getSpecificRelativeDeduction(1_100_000, true)).toBe(210_000)
      expect(getSpecificRelativeDeduction(1_100_001, true)).toBe(110_000)
    })

    it('transitions correctly at 115万円', () => {
      expect(getSpecificRelativeDeduction(1_150_000, true)).toBe(110_000)
      expect(getSpecificRelativeDeduction(1_150_001, true)).toBe(60_000)
    })

    it('transitions correctly at 120万円', () => {
      expect(getSpecificRelativeDeduction(1_200_000, true)).toBe(60_000)
      expect(getSpecificRelativeDeduction(1_200_001, true)).toBe(30_000)
    })

    it('upper limit at 123万円', () => {
      expect(getSpecificRelativeDeduction(1_230_000, true)).toBe(30_000)
      expect(getSpecificRelativeDeduction(1_230_001, true)).toBe(0)
    })
  })

  describe('Returns 0 outside valid range', () => {
    it('returns 0 for income at or below dependent deduction threshold', () => {
      expect(getSpecificRelativeDeduction(580_000, false)).toBe(0)
      expect(getSpecificRelativeDeduction(500_000, false)).toBe(0)
    })

    it('returns 0 for income above upper limit (123万円)', () => {
      expect(getSpecificRelativeDeduction(1_230_001, false)).toBe(0)
      expect(getSpecificRelativeDeduction(2_000_000, false)).toBe(0)
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
