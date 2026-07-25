// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  AGE_RANGES,
  AGE_RANGE_LABELS,
  DEFAULT_AGE_RANGE,
  type AgeRange,
  isResidenceTaxMinor,
  isSubjectToLongTermCarePremium,
  isSubjectToNationalPension,
} from '../types/ageRange';

// One row per age range: [ltc 40-64, national pension 20-59, minor <18]
const EXPECTED: Record<AgeRange, [boolean, boolean, boolean]> = {
  under18: [false, false, true],
  age18to19: [false, false, false],
  age20to39: [false, true, false],
  age40to59: [true, true, false],
  age60to64: [true, false, false],
};

describe('AgeRange predicates', () => {
  it.each(AGE_RANGES)('matches the expected rule set at %s', ageRange => {
    const [ltc, nationalPension, minor] = EXPECTED[ageRange];
    expect(isSubjectToLongTermCarePremium(ageRange)).toBe(ltc);
    expect(isSubjectToNationalPension(ageRange)).toBe(nationalPension);
    expect(isResidenceTaxMinor(ageRange)).toBe(minor);
  });

  it('defaults to 20-39 and labels every range', () => {
    expect(DEFAULT_AGE_RANGE).toBe('age20to39');
    expect(Object.keys(AGE_RANGE_LABELS).sort()).toEqual([...AGE_RANGES].sort());
    expect(AGE_RANGE_LABELS[DEFAULT_AGE_RANGE]).toBe('20-39');
  });
});
