import { describe, it, expect } from 'vitest'
import { isDependentCoverageEligible, DEPENDENT_INCOME_THRESHOLD } from '../types/healthInsurance'

describe('isDependentCoverageEligible', () => {
  it('returns true for income below threshold', () => {
    expect(isDependentCoverageEligible(0)).toBe(true)
    expect(isDependentCoverageEligible(500_000)).toBe(true)
    expect(isDependentCoverageEligible(1_000_000)).toBe(true)
    expect(isDependentCoverageEligible(1_299_999)).toBe(true)
  })

  it('returns false for income at or above threshold', () => {
    expect(isDependentCoverageEligible(1_300_000)).toBe(false)
    expect(isDependentCoverageEligible(1_300_001)).toBe(false)
    expect(isDependentCoverageEligible(2_000_000)).toBe(false)
    expect(isDependentCoverageEligible(5_000_000)).toBe(false)
  })

  it('threshold is set to 1.3 million yen', () => {
    expect(DEPENDENT_INCOME_THRESHOLD).toBe(1_300_000)
  })

  it('handles edge case at exactly threshold minus 1', () => {
    expect(isDependentCoverageEligible(DEPENDENT_INCOME_THRESHOLD - 1)).toBe(true)
  })

  it('handles edge case at exactly threshold', () => {
    expect(isDependentCoverageEligible(DEPENDENT_INCOME_THRESHOLD)).toBe(false)
  })

  it('handles edge case at exactly threshold plus 1', () => {
    expect(isDependentCoverageEligible(DEPENDENT_INCOME_THRESHOLD + 1)).toBe(false)
  })
})
