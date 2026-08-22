// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';
import {
  CUSTOM_PROVIDER_ID,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
  getProviderDisplayName,
  isEmployeeHealthProvider,
  type HealthInsuranceProviderId,
} from '../types/healthInsurance';

const EMPLOYEE_PROVIDER_IDS = Object.keys(
  PROVIDER_DEFINITIONS,
) as (keyof typeof PROVIDER_DEFINITIONS)[];

const NON_EMPLOYEE_PROVIDER_IDS = [
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
  LATTER_STAGE_ELDERLY_ID,
] as const;

describe('isEmployeeHealthProvider', () => {
  it('accepts every provider defined in PROVIDER_DEFINITIONS', () => {
    expect(EMPLOYEE_PROVIDER_IDS.length).toBeGreaterThan(0);
    for (const id of EMPLOYEE_PROVIDER_IDS) {
      expect(isEmployeeHealthProvider(id)).toBe(true);
    }
  });

  it('rejects each id that stands for a coverage type of its own', () => {
    for (const id of NON_EMPLOYEE_PROVIDER_IDS) {
      expect(isEmployeeHealthProvider(id)).toBe(false);
    }
  });

  it('covers the whole id union between the two sets', () => {
    const all: HealthInsuranceProviderId[] = [
      ...EMPLOYEE_PROVIDER_IDS,
      ...NON_EMPLOYEE_PROVIDER_IDS,
    ];
    expect(new Set(all).size).toBe(EMPLOYEE_PROVIDER_IDS.length + NON_EMPLOYEE_PROVIDER_IDS.length);
  });
});

describe('getProviderDisplayName', () => {
  it('names every id in the union', () => {
    for (const id of [...EMPLOYEE_PROVIDER_IDS, ...NON_EMPLOYEE_PROVIDER_IDS]) {
      expect(getProviderDisplayName(id)).not.toBe('');
    }
  });

  it('throws on an id outside the union', () => {
    expect(() => getProviderDisplayName('NotAProvider' as HealthInsuranceProviderId)).toThrow(
      /Unknown provider ID/,
    );
  });
});
