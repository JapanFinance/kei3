// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Dependent, OtherDependent, Spouse } from '../../types/dependents';

const NO_INCOME = {
  grossEmploymentIncome: 0,
  grossPublicPensionIncome: 0,
  otherNetIncome: 0,
};

/**
 * Builds a complete {@link Spouse} with safe defaults so tests can specify only the fields
 * relevant to the scenario being asserted.
 */
export const makeSpouse = (overrides: Partial<Spouse> = {}): Spouse => ({
  id: 'test-spouse',
  relationship: 'spouse',
  ageRange: 'under40',
  income: NO_INCOME,
  disability: 'none',
  isSameHousehold: true,
  isClaimedAsDependent: true,
  healthInsurance: 'auto',
  isHouseholdHead: false,
  ...overrides,
});

/**
 * Builds a complete non-spouse {@link OtherDependent} with safe defaults so tests can specify
 * only the fields relevant to the scenario being asserted.
 */
export const makeDependent = (overrides: Partial<OtherDependent> = {}): OtherDependent => ({
  id: 'test-dependent',
  relationship: 'child',
  ageRange: '6to15',
  income: NO_INCOME,
  disability: 'none',
  isSameHousehold: true,
  isClaimedAsDependent: true,
  healthInsurance: 'auto',
  isHouseholdHead: false,
  ...overrides,
});

/**
 * Builds a complete {@link Dependent} (either {@link Spouse} or {@link OtherDependent})
 * based on relationship, with safe defaults for testing.
 */
export const makeMember = (
  overrides: Partial<Spouse> | Partial<OtherDependent> = {},
): Dependent => {
  if (overrides.relationship === 'spouse') {
    return makeSpouse(overrides as Partial<Spouse>);
  }
  return makeDependent(overrides as Partial<OtherDependent>);
};
