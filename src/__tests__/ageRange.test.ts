// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  AGE_RANGES,
  AGE_RANGE_LABELS,
  DEFAULT_AGE_RANGE,
  type AgeRange,
  isLatterStageElderly,
  isLongTermCareCategory1Insured,
  isResidenceTaxMinor,
  isSubjectToEmployeesPension,
  isSubjectToLongTermCarePremium,
  isSubjectToNationalPension,
} from '../types/ageRange';

// One row per age range:
// [ltc 40-64 (2号), ltc 65+ (1号), national pension 20-59, employees' pension <70, 75+, minor <18]
const EXPECTED: Record<AgeRange, [boolean, boolean, boolean, boolean, boolean, boolean]> = {
  under18: [false, false, false, true, false, true],
  age18to19: [false, false, false, true, false, false],
  age20to39: [false, false, true, true, false, false],
  age40to59: [true, false, true, true, false, false],
  age60to64: [true, false, false, true, false, false],
  age65to69: [false, true, false, true, false, false],
  age70to74: [false, true, false, false, false, false],
  age75plus: [false, true, false, false, true, false],
};

describe('AgeRange predicates', () => {
  it.each(AGE_RANGES)('matches the expected rule set at %s', ageRange => {
    const [ltc2, ltc1, nationalPension, employeesPension, latterStage, minor] = EXPECTED[ageRange];
    expect(isSubjectToLongTermCarePremium(ageRange)).toBe(ltc2);
    expect(isLongTermCareCategory1Insured(ageRange)).toBe(ltc1);
    expect(isSubjectToNationalPension(ageRange)).toBe(nationalPension);
    expect(isSubjectToEmployeesPension(ageRange)).toBe(employeesPension);
    expect(isLatterStageElderly(ageRange)).toBe(latterStage);
    expect(isResidenceTaxMinor(ageRange)).toBe(minor);
  });

  it('defaults to 20-39 and labels every range', () => {
    expect(DEFAULT_AGE_RANGE).toBe('age20to39');
    expect(Object.keys(AGE_RANGE_LABELS).sort()).toEqual([...AGE_RANGES].sort());
    expect(AGE_RANGE_LABELS[DEFAULT_AGE_RANGE]).toBe('20-39');
  });
});
