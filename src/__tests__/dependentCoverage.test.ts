// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { AGE_RANGES } from '../types/ageRange';
import {
  isDependentCoverageEligible,
  getDependentIncomeThreshold,
  DEPENDENT_INCOME_THRESHOLD,
  DEPENDENT_INCOME_THRESHOLD_AGE60_PLUS,
} from '../types/healthInsurance';

const UNDER_60_RANGES = ['under18', 'age18to19', 'age20to39', 'age40to59'] as const;
const AGE_60_PLUS_RANGES = ['age60to64', 'age65to69', 'age70to74'] as const;

describe('getDependentIncomeThreshold', () => {
  it('is 1.3 million yen below age 60 and 1.8 million yen from age 60', () => {
    expect(DEPENDENT_INCOME_THRESHOLD).toBe(1_300_000);
    expect(DEPENDENT_INCOME_THRESHOLD_AGE60_PLUS).toBe(1_800_000);
    for (const ageRange of UNDER_60_RANGES) {
      expect(getDependentIncomeThreshold(ageRange)).toBe(DEPENDENT_INCOME_THRESHOLD);
    }
    for (const ageRange of AGE_60_PLUS_RANGES) {
      expect(getDependentIncomeThreshold(ageRange)).toBe(DEPENDENT_INCOME_THRESHOLD_AGE60_PLUS);
    }
  });

  it('covers every age range', () => {
    expect([...UNDER_60_RANGES, ...AGE_60_PLUS_RANGES]).toEqual([...AGE_RANGES]);
  });
});

describe('isDependentCoverageEligible', () => {
  it.each(UNDER_60_RANGES)('applies the 1.3 million yen boundary at %s', ageRange => {
    expect(isDependentCoverageEligible(0, ageRange)).toBe(true);
    expect(isDependentCoverageEligible(1_299_999, ageRange)).toBe(true);
    expect(isDependentCoverageEligible(1_300_000, ageRange)).toBe(false);
    expect(isDependentCoverageEligible(1_799_999, ageRange)).toBe(false);
  });

  it.each(AGE_60_PLUS_RANGES)('applies the 1.8 million yen boundary at %s', ageRange => {
    expect(isDependentCoverageEligible(0, ageRange)).toBe(true);
    expect(isDependentCoverageEligible(1_300_000, ageRange)).toBe(true);
    expect(isDependentCoverageEligible(1_799_999, ageRange)).toBe(true);
    expect(isDependentCoverageEligible(1_800_000, ageRange)).toBe(false);
  });
});
