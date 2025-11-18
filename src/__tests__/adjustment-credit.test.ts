import { describe, expect, it } from "vitest"
import { calculateResidenceTax } from "../utils/residenceTax"
import { calculateDependentDeductions } from "../utils/dependentDeductions"
import type { Dependent } from "../types/dependents"

/**
 * Tests for adjustment credit (調整控除) calculation per Local Tax Act Article 314-6
 * 
 * These tests verify that the statutory personal deduction differences (人的控除額の差)
 * are correctly calculated for various dependent scenarios.
 * 
 * References:
 * - Local Tax Act Article 314-6: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * - Saitama City explanation: https://www.city.saitama.jp/006/014/008/003/001/008/p001079.html
 */

describe('Adjustment Credit - Spouse Deduction (配偶者控除)', () => {
  describe('General spouse (under 70) - income ≤ 95万円', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000, // Gross 90万円 → net 35万円 (under 95万円 limit)
        otherNetIncome: 0,
      },
    }

    it('taxpayer income ≤ 900万円 → 5万円 statutory difference', () => {
      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([spouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (spouse) = 100,000
      expect(result.personalDeductionDifference).toBe(100_000)
      
      // Taxable income: 8M - 1M - 430K - 330K (spouse residence tax) = 6,240,000
      expect(result.taxableIncome).toBe(6_240_000)
      
      // Adjustment credit for taxable > 2M:
      // max((100K - (6.24M - 2M)) * 0.05, 100K * 0.05) = 5,000
      const expectedAdjustment = 100_000 * 0.05
      expect(result.city.cityAdjustmentCredit + result.prefecture.prefecturalAdjustmentCredit).toBe(expectedAdjustment)
    })

    it('taxpayer income 900-950万円 → 4万円 statutory difference', () => {
      const taxpayerIncome = 9_200_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([spouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 40,000 (spouse) = 90,000
      expect(result.personalDeductionDifference).toBe(90_000)
    })

    it('taxpayer income 950-1000万円 → 2万円 statutory difference', () => {
      const taxpayerIncome = 9_700_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([spouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 20,000 (spouse) = 70,000
      expect(result.personalDeductionDifference).toBe(70_000)
    })

    it('taxpayer income > 1000万円 → 0 statutory difference (no spouse deduction)', () => {
      const taxpayerIncome = 11_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([spouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 0 (no spouse deduction) = 50,000
      expect(result.personalDeductionDifference).toBe(50_000)
    })
  })

  describe('Elderly spouse (70+) - income ≤ 95万円', () => {
    const elderlySpouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000, // Gross 90万円 → net 35万円
        otherNetIncome: 0,
      },
    }

    it('taxpayer income ≤ 900万円 → 10万円 statutory difference', () => {
      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([elderlySpouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 100,000 (elderly spouse) = 150,000
      expect(result.personalDeductionDifference).toBe(150_000)
    })

    it('taxpayer income 900-950万円 → 6万円 statutory difference', () => {
      const taxpayerIncome = 9_200_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([elderlySpouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 60,000 (elderly spouse) = 110,000
      expect(result.personalDeductionDifference).toBe(110_000)
    })

    it('taxpayer income 950-1000万円 → 3万円 statutory difference', () => {
      const taxpayerIncome = 9_700_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([elderlySpouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 30,000 (elderly spouse) = 80,000
      expect(result.personalDeductionDifference).toBe(80_000)
    })
  })
})

describe('Adjustment Credit - Spouse Special Deduction (配偶者特別控除)', () => {
  describe('Spouse income 95-100万円 (qualifies for spouse special deduction)', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 1_600_001, // Gross 1,600,001円 → net 950,001円 (just over 95万円, qualifies for spouse special deduction)
        otherNetIncome: 0,
      },
    }

    it('statutory difference is 0 (mutually exclusive income ranges)', () => {
      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([spouse])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 0 (spouse special) = 50,000
      // Spouse special deduction has NO statutory difference per Article 314-6(7)
      // because spouse income > 58万円 (required for special deduction) and
      // statutory difference only defined for spouse income < 55万円
      expect(result.personalDeductionDifference).toBe(50_000)
    })
  })

  describe('Spouse income 100-133万円 (higher spouse special deduction brackets)', () => {
    const testCases = [
      { grossIncome: 1_650_000, description: '165万円 gross (net 100万円)' },
      { grossIncome: 1_770_000, description: '177万円 gross (net 117万円)' },
      { grossIncome: 1_900_000, description: '190万円 gross (net 125万円)' },
      { grossIncome: 1_980_000, description: '198万円 gross (net 133万円, at limit)' },
    ]

    testCases.forEach(({ grossIncome, description }) => {
      it(`spouse ${description} → statutory difference is 0`, () => {
        const spouse: Dependent = {
          id: '1',
          relationship: 'spouse',
          ageCategory: 'under70',
          isCohabiting: false,
          disability: 'none',
          income: {
            grossEmploymentIncome: grossIncome,
            otherNetIncome: 0,
          },
        }

        const taxpayerIncome = 8_000_000
        const socialInsurance = 1_000_000
        const dependents = calculateDependentDeductions([spouse])
        
        const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
        
        // All spouse special deduction cases have 0 statutory difference
        expect(result.personalDeductionDifference).toBe(50_000)
      })
    })
  })
})

describe('Adjustment Credit - Dependent Deductions (扶養控除)', () => {
  describe('General dependent (16-18, 23-69) - 5万円 statutory difference', () => {
    it('calculates correctly for age 16-18', () => {
      const dependent: Dependent = {
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

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (general dependent) = 100,000
      expect(result.personalDeductionDifference).toBe(100_000)
    })

    it('calculates correctly for age 23-69', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'parent',
        ageCategory: '23to69',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (general dependent) = 100,000
      expect(result.personalDeductionDifference).toBe(100_000)
    })
  })

  describe('Special dependent (19-22) - 18万円 statutory difference', () => {
    it('calculates correctly for special dependent', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 180,000 (special dependent) = 230,000
      expect(result.personalDeductionDifference).toBe(230_000)
    })
  })

  describe('Elderly dependent (70+) - 10万円 statutory difference', () => {
    it('calculates correctly for non-cohabiting elderly parent', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'parent',
        ageCategory: '70plus',
        isCohabiting: false,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 100,000 (elderly dependent) = 150,000
      expect(result.personalDeductionDifference).toBe(150_000)
    })

    it('calculates correctly for cohabiting elderly parent - 13万円 statutory difference', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'parent',
        ageCategory: '70plus',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 130,000 (elderly cohabiting) = 180,000
      expect(result.personalDeductionDifference).toBe(180_000)
    })

    it('calculates correctly for cohabiting elderly grandparent - 13万円 statutory difference', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'other',
        ageCategory: '70plus',
        isCohabiting: true,
        disability: 'none',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 130,000 (elderly cohabiting) = 180,000
      expect(result.personalDeductionDifference).toBe(180_000)
    })
  })
})

describe('Adjustment Credit - Disability Deductions (障害者控除)', () => {
  describe('Regular disability - 1万円 statutory difference', () => {
    it('calculates correctly for regular disability', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: true,
        disability: 'regular',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (general dependent) + 10,000 (regular disability) = 110,000
      expect(result.personalDeductionDifference).toBe(110_000)
    })
  })

  describe('Special disability - 10万円 statutory difference', () => {
    it('calculates correctly for non-cohabiting special disability', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: false,
        disability: 'special',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (general dependent) + 100,000 (special disability) = 200,000
      expect(result.personalDeductionDifference).toBe(200_000)
    })

    it('calculates correctly for cohabiting special disability - 22万円 statutory difference', () => {
      const dependent: Dependent = {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: true,
        disability: 'special',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
      }

      const taxpayerIncome = 8_000_000
      const socialInsurance = 1_000_000
      const dependents = calculateDependentDeductions([dependent])
      
      const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
      
      // Personal deduction difference = 50,000 (basic) + 50,000 (general dependent) + 220,000 (special cohabiting disability) = 320,000
      expect(result.personalDeductionDifference).toBe(320_000)
    })
  })
})

describe('Adjustment Credit - Combined Scenarios', () => {
  it('spouse + multiple dependents + disability', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: 'under70',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000,
        otherNetIncome: 0,
      },
    }

    const child1: Dependent = {
      id: '2',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: true,
      disability: 'none',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    const child2: Dependent = {
      id: '3',
      relationship: 'child',
      ageCategory: '16to18',
      isCohabiting: true,
      disability: 'regular',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    const taxpayerIncome = 8_000_000
    const socialInsurance = 1_000_000
    const dependents = calculateDependentDeductions([spouse, child1, child2])
    
    const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
    
    // Personal deduction difference breakdown:
    // - Basic: 50,000
    // - Spouse (taxpayer income ≤ 900万円): 50,000
    // - Child1 (special dependent 19-22): 180,000
    // - Child2 (general dependent 16-18): 50,000
    // - Child2 (regular disability): 10,000
    // Total: 340,000
    expect(result.personalDeductionDifference).toBe(340_000)
  })

  it('elderly spouse + elderly cohabiting parent + special disability', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000,
        otherNetIncome: 0,
      },
    }

    const parent: Dependent = {
      id: '2',
      relationship: 'parent',
      ageCategory: '70plus',
      isCohabiting: true,
      disability: 'special',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    const taxpayerIncome = 8_000_000
    const socialInsurance = 1_000_000
    const dependents = calculateDependentDeductions([spouse, parent])
    
    const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
    
    // Personal deduction difference breakdown:
    // - Basic: 50,000
    // - Elderly spouse (taxpayer income ≤ 900万円): 100,000
    // - Elderly cohabiting parent: 130,000
    // - Special cohabiting disability: 220,000
    // Total: 500,000
    expect(result.personalDeductionDifference).toBe(500_000)
  })

  it('higher taxpayer income affects spouse deduction statutory difference', () => {
    const spouse: Dependent = {
      id: '1',
      relationship: 'spouse',
      ageCategory: '70plus',
      isCohabiting: false,
      disability: 'none',
      income: {
        grossEmploymentIncome: 900_000,
        otherNetIncome: 0,
      },
    }

    const child: Dependent = {
      id: '2',
      relationship: 'child',
      ageCategory: '19to22',
      isCohabiting: true,
      disability: 'none',
      income: {
        grossEmploymentIncome: 0,
        otherNetIncome: 0,
      },
    }

    // Test with taxpayer income in 950-1000万円 bracket
    const taxpayerIncome = 9_700_000
    const socialInsurance = 1_000_000
    const dependents = calculateDependentDeductions([spouse, child])
    
    const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependents)
    
    // Personal deduction difference breakdown:
    // - Basic: 50,000
    // - Elderly spouse (taxpayer income 950-1000万円): 30,000 (reduced from 100,000)
    // - Special dependent: 180,000 (unaffected by taxpayer income)
    // Total: 260,000
    expect(result.personalDeductionDifference).toBe(260_000)
  })

  it('multiple dependents in different age categories', () => {
    const dependents: Dependent[] = [
      {
        id: '1',
        relationship: 'child',
        ageCategory: '16to18',
        isCohabiting: true,
        disability: 'none',
        income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
      },
      {
        id: '2',
        relationship: 'child',
        ageCategory: '19to22',
        isCohabiting: true,
        disability: 'none',
        income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
      },
      {
        id: '3',
        relationship: 'child',
        ageCategory: '23to69',
        isCohabiting: false,
        disability: 'none',
        income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
      },
    ]

    const taxpayerIncome = 8_000_000
    const socialInsurance = 1_000_000
    const dependentResults = calculateDependentDeductions(dependents)
    
    const result = calculateResidenceTax(taxpayerIncome, socialInsurance, dependentResults)
    
    // Personal deduction difference breakdown:
    // - Basic: 50,000
    // - Child1 (16-18, general): 50,000
    // - Child2 (19-22, special): 180,000
    // - Child3 (23-69, general): 50,000
    // Total: 330,000
    expect(result.personalDeductionDifference).toBe(330_000)
  })
})
