// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TakeHomeFormState } from '../types/tax';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  isDependentCoverageEligible,
  type HealthInsuranceProviderId,
} from '../types/healthInsurance';
import { NATIONAL_HEALTH_INSURANCE_REGIONS } from '../data/nationalHealthInsurance/nhiParamsData';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';

export function selectDefaultRegion(regions: readonly string[]): string {
  return regions.includes('Tokyo')
    ? 'Tokyo'
    : regions.length > 0
      ? regions[0]!
      : DEFAULT_PROVIDER_REGION;
}

/**
 * Derives the region a provider should default to when it becomes the selected
 * health insurance provider (on an explicit provider change, or as a side effect of
 * an income mode change that forces a particular provider).
 */
function defaultRegionForProvider(provider: HealthInsuranceProviderId): string {
  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    return selectDefaultRegion(NATIONAL_HEALTH_INSURANCE_REGIONS);
  }
  if (provider === DEPENDENT_COVERAGE_ID) {
    // Dependent coverage doesn't need a region
    return DEFAULT_PROVIDER_REGION;
  }

  // For employee providers (Kyokai Kenpo, ITS Kenpo, etc.)
  const providerDefinition = PROVIDER_DEFINITIONS[provider];
  if (providerDefinition) {
    return selectDefaultRegion(Object.keys(providerDefinition.regions));
  }

  console.warn(
    `Data for ID ${provider} not found in Employees Health Insurance Provider data. Defaulting region.`,
  );
  return DEFAULT_PROVIDER_REGION;
}

/**
 * Generic field setter. The mapped union over `keyof TakeHomeFormState` keeps `field`
 * and `value` correlated at every call site (e.g. you can't pass a `string` for
 * `dependents`), which is the whole point of moving off the stringly-typed fake-event
 * pattern. The `-?` strips the optionality that homomorphic mapped types would
 * otherwise copy from optional fields (e.g. `customEHIRates?`) onto this mapped type's
 * own properties — left in place, indexing by `[keyof TakeHomeFormState]` would leak
 * `undefined` into the union and break the `switch (action.type)` narrowing below.
 */
type SetFieldAction = {
  [K in keyof TakeHomeFormState]-?: {
    type: 'setField';
    field: K;
    value: TakeHomeFormState[K];
  };
}[keyof TakeHomeFormState];

/** Income mode changed: resets health insurance provider/region for salary and miscellaneous modes. */
interface IncomeModeChangedAction {
  type: 'incomeModeChanged';
  mode: TakeHomeFormState['incomeMode'];
}

/** Health insurance provider changed: resets region to the new provider's default. */
interface ProviderChangedAction {
  type: 'providerChanged';
  provider: TakeHomeFormState['healthInsuranceProvider'];
}

/**
 * Annual income changed: if dependent coverage is currently selected and the new
 * income is no longer eligible, auto-switches to National Health Insurance.
 */
interface AnnualIncomeChangedAction {
  type: 'annualIncomeChanged';
  value: TakeHomeFormState['annualIncome'];
}

export type FormAction =
  SetFieldAction | IncomeModeChangedAction | ProviderChangedAction | AnnualIncomeChangedAction;

export function takeHomeFormReducer(
  state: TakeHomeFormState,
  action: FormAction,
): TakeHomeFormState {
  switch (action.type) {
    case 'setField':
      // TS can't correlate `action.field`/`action.value` across the mapped union once
      // destructured this way, even though every call site is checked individually.
      return { ...state, [action.field]: action.value } as TakeHomeFormState;

    case 'incomeModeChanged': {
      const newState = { ...state, incomeMode: action.mode };
      if (action.mode === 'salary') {
        newState.healthInsuranceProvider = 'KyokaiKenpo';
        newState.region = defaultRegionForProvider('KyokaiKenpo');
      } else if (action.mode === 'miscellaneous') {
        newState.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
        newState.region = defaultRegionForProvider(NATIONAL_HEALTH_INSURANCE_ID);
      }
      return newState;
    }

    case 'providerChanged':
      return {
        ...state,
        healthInsuranceProvider: action.provider,
        region: defaultRegionForProvider(action.provider),
      };

    case 'annualIncomeChanged': {
      const newState = { ...state, annualIncome: action.value };
      // If income changes and the user has dependent coverage selected, check eligibility
      if (
        state.healthInsuranceProvider === DEPENDENT_COVERAGE_ID &&
        !isDependentCoverageEligible(action.value)
      ) {
        // Income exceeded threshold, automatically switch to NHI
        newState.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
        newState.region = defaultRegionForProvider(NATIONAL_HEALTH_INSURANCE_ID);
      }
      return newState;
    }

    default:
      return state;
  }
}
