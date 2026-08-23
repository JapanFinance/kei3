// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  AGE_RANGES,
  coversAgeBand,
  AGE_RANGE_LABELS,
  DEFAULT_AGE_RANGE,
  type AgeRange,
  isLatterStageElderly,
  isLongTermCareCategory1Insured,
  isLongTermCareCategory2Insured,
  isSubjectToEmployeesPension,
  isSubjectToNationalPension,
} from '../types/ageRange';

interface PredicateExpectations {
  ltc2: boolean;
  ltc1: boolean;
  nationalPension: boolean;
  employeesPension: boolean;
  latterStage: boolean;
}

const EXPECTED: Record<AgeRange, PredicateExpectations> = {
  under18: {
    ltc2: false,
    ltc1: false,
    nationalPension: false,
    employeesPension: true,
    latterStage: false,
  },
  age18to19: {
    ltc2: false,
    ltc1: false,
    nationalPension: false,
    employeesPension: true,
    latterStage: false,
  },
  age20to39: {
    ltc2: false,
    ltc1: false,
    nationalPension: true,
    employeesPension: true,
    latterStage: false,
  },
  age40to59: {
    ltc2: true,
    ltc1: false,
    nationalPension: true,
    employeesPension: true,
    latterStage: false,
  },
  age60to64: {
    ltc2: true,
    ltc1: false,
    nationalPension: false,
    employeesPension: true,
    latterStage: false,
  },
  age65to69: {
    ltc2: false,
    ltc1: true,
    nationalPension: false,
    employeesPension: true,
    latterStage: false,
  },
  age70to74: {
    ltc2: false,
    ltc1: true,
    nationalPension: false,
    employeesPension: false,
    latterStage: false,
  },
  age75plus: {
    ltc2: false,
    ltc1: true,
    nationalPension: false,
    employeesPension: false,
    latterStage: true,
  },
};

describe('AgeRange predicates', () => {
  it.each(AGE_RANGES)('matches the expected rule set at %s', ageRange => {
    const { ltc2, ltc1, nationalPension, employeesPension, latterStage } = EXPECTED[ageRange];
    expect(isLongTermCareCategory2Insured(ageRange)).toBe(ltc2);
    expect(isLongTermCareCategory1Insured(ageRange)).toBe(ltc1);
    expect(isSubjectToNationalPension(ageRange)).toBe(nationalPension);
    expect(isSubjectToEmployeesPension(ageRange)).toBe(employeesPension);
    expect(isLatterStageElderly(ageRange)).toBe(latterStage);
  });

  it('covers a band only when every age in the range falls inside it', () => {
    expect(coversAgeBand('age40to59', { minAgeInclusive: 40, maxAgeExclusive: 60 })).toBe(true);
    expect(coversAgeBand('age40to59', { minAgeInclusive: 20 })).toBe(true);
    // A band starting mid-range holds for the oldest in it but not the youngest.
    expect(coversAgeBand('age40to59', { minAgeInclusive: 50 })).toBe(false);
    expect(coversAgeBand('age40to59', { maxAgeExclusive: 50 })).toBe(false);
    expect(coversAgeBand('age40to59', { minAgeInclusive: 60 })).toBe(false);
    expect(coversAgeBand('age75plus', { minAgeInclusive: 75 })).toBe(true);
    expect(coversAgeBand('age75plus', { maxAgeExclusive: 200 })).toBe(false);
  });

  it('defaults to 20-39 and labels every range', () => {
    expect(DEFAULT_AGE_RANGE).toBe('age20to39');
    expect(Object.keys(AGE_RANGE_LABELS).sort()).toEqual([...AGE_RANGES].sort());
    expect(AGE_RANGE_LABELS[DEFAULT_AGE_RANGE]).toBe('20-39');
  });
});
