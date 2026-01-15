// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'
import { calculatePensionPremium } from '../utils/pensionCalculator'

describe('calculatePensionPremium', () => {
    it('calculates employees pension correctly for employment income below cap', () => {
      expect(calculatePensionPremium(true, 5_000_000 / 12)).toBe(450_180)
    })
  
    it('respects maximum cap for high employment income', () => {
      expect(calculatePensionPremium(true, 10_000_000 / 12)).toBe(713_700) // Capped at 59,475 * 12
    })
  
    it('calculates fixed national pension for non-employment income', () => {
      expect(calculatePensionPremium(false, 5_000_000 / 12)).toBe(210_120) // 17,510 * 12 months
      expect(calculatePensionPremium(false, 10_000_000 / 12)).toBe(210_120) // Same fixed amount regardless of income
    })
  
    it('handles zero income correctly', () => {
      expect(calculatePensionPremium(true, 0)).toBe(96_624)
      expect(calculatePensionPremium(false, 0)).toBe(210_120) // Still pays fixed amount
    })
  
    it('handles negative income correctly', () => {
      expect(() => calculatePensionPremium(true, -1_000_000)).toThrowError('Monthly income must be a positive number')
      expect(calculatePensionPremium(false, -1_000_000)).toBe(210_120) // Still pays fixed amount
    })
  })
