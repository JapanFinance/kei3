// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { IncomeMode, IncomeStream, TakeHomeFormState } from '../types/tax';
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
 * Total annual income represented by a set of income streams: commuting allowance is
 * not included, monthly salaries are annualized, everything else counts at face value.
 */
export function totalAnnualIncomeFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce((sum, s) => {
    if (s.type === 'commutingAllowance') {
      return sum;
    }
    if (s.type === 'salary' && s.frequency === 'monthly') {
      return sum + s.amount * 12;
    }
    return sum + s.amount;
  }, 0);
}

/**
 * Whether the form state includes employment income — salary mode, or advanced mode
 * with at least one employment-type stream. Determines eligibility for employee health
 * insurance providers.
 */
export function hasEmploymentIncome(
  state: Pick<TakeHomeFormState, 'incomeMode' | 'incomeStreams'>,
): boolean {
  return (
    state.incomeMode === 'salary' ||
    (state.incomeMode === 'advanced' &&
      state.incomeStreams.some(
        s => s.type === 'salary' || s.type === 'bonus' || s.type === 'stockCompensation',
      ))
  );
}

/** The simple (non-advanced) income modes, each of which mirrors `annualIncome` in one stream. */
type SimpleIncomeMode = Exclude<IncomeMode, 'advanced'>;

/**
 * The single income stream that mirrors `annualIncome` in a simple mode. The `never`
 * default makes adding a mode to {@link IncomeMode} a compile error here (matching the
 * exhaustiveness idiom in {@link takeHomeFormReducer}) rather than a silent fall-through.
 */
function simpleModeStreams(mode: SimpleIncomeMode, amount: number): IncomeStream[] {
  switch (mode) {
    case 'salary':
      return [{ id: 'simple-salary', type: 'salary', amount, frequency: 'annual' }];
    case 'miscellaneous':
      return [{ id: 'simple-miscellaneous', type: 'miscellaneous', amount }];
    default: {
      const unhandledMode: never = mode;
      throw new Error(`Unhandled simple income mode: ${JSON.stringify(unhandledMode)}`);
    }
  }
}

/**
 * Constrains `T` to actual keys of {@link TakeHomeFormState}. Used below so
 * {@link CascadeManagedField} fails to compile — rather than silently going stale — if
 * one of its field names is ever renamed or removed from `TakeHomeFormState`.
 */
type AssertFormFields<T extends keyof TakeHomeFormState> = T;

/**
 * Fields managed by a semantic action (below) because changing them triggers cascade
 * logic beyond a plain overwrite. Excluded from {@link SetFieldAction} so a caller can't
 * bypass the cascade by dispatching a bare `setField` for one of these — e.g.
 * `dispatch({ type: 'setField', field: 'healthInsuranceProvider', value: ... })` would
 * update the provider but skip the region reset that `providerChanged` performs.
 * `incomeStreams` and `savedIncomeStreams` are kept in sync with `annualIncome` and
 * `incomeMode` by their semantic actions, so a bare overwrite would break that invariant.
 */
type CascadeManagedField = AssertFormFields<
  'annualIncome' | 'incomeMode' | 'healthInsuranceProvider' | 'incomeStreams' | 'savedIncomeStreams'
>;

/**
 * Generic field setter for every field *without* its own cascade (see
 * {@link CascadeManagedField}). The mapped union over `keyof TakeHomeFormState` keeps
 * `field` and `value` correlated at every call site (e.g. you can't pass a `string` for
 * `dependents`), which is the whole point of moving off the stringly-typed fake-event
 * pattern. The `-?` strips the optionality that homomorphic mapped types would
 * otherwise copy from optional fields (e.g. `customEHIRates?`) onto this mapped type's
 * own properties — left in place, indexing by `[...]` would leak `undefined` into the
 * union and break the `switch (action.type)` narrowing below.
 */
type SetFieldAction = {
  [K in Exclude<keyof TakeHomeFormState, CascadeManagedField>]-?: {
    type: 'setField';
    field: K;
    value: TakeHomeFormState[K];
  };
}[Exclude<keyof TakeHomeFormState, CascadeManagedField>];

/**
 * Income mode changed: resets health insurance provider/region for salary and
 * miscellaneous modes, and syncs the income streams to the new mode — saving the
 * advanced-mode streams when leaving advanced, and restoring or resetting them when
 * entering it (see {@link reduceIncomeModeChanged}).
 */
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
 * income is no longer eligible, auto-switches to National Health Insurance. In the
 * simple (non-advanced) modes, also syncs the single income stream to the new amount.
 */
interface AnnualIncomeChangedAction {
  type: 'annualIncomeChanged';
  value: TakeHomeFormState['annualIncome'];
}

/**
 * Income streams changed (advanced mode): recomputes the total annual income from the
 * streams and applies the same eligibility cascade as {@link AnnualIncomeChangedAction}.
 */
interface IncomeStreamsChangedAction {
  type: 'incomeStreamsChanged';
  streams: IncomeStream[];
}

export type FormAction =
  | SetFieldAction
  | IncomeModeChangedAction
  | ProviderChangedAction
  | AnnualIncomeChangedAction
  | IncomeStreamsChangedAction;

/**
 * Applies a new annual income, auto-switching from dependent coverage to National
 * Health Insurance when the new income exceeds the eligibility threshold.
 */
function applyAnnualIncome(state: TakeHomeFormState, value: number): TakeHomeFormState {
  const newState = { ...state, annualIncome: value };
  if (
    state.healthInsuranceProvider === DEPENDENT_COVERAGE_ID &&
    !isDependentCoverageEligible(value)
  ) {
    newState.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
    newState.region = defaultRegionForProvider(NATIONAL_HEALTH_INSURANCE_ID);
  }
  return newState;
}

function reduceIncomeModeChanged(
  state: TakeHomeFormState,
  action: IncomeModeChangedAction,
): TakeHomeFormState {
  const newState = { ...state, incomeMode: action.mode };

  // Leaving advanced mode: save the streams so a round trip back can restore them
  if (state.incomeMode === 'advanced') {
    newState.savedIncomeStreams = state.incomeStreams;
  }

  if (action.mode === 'salary' || action.mode === 'miscellaneous') {
    newState.healthInsuranceProvider =
      action.mode === 'salary' ? 'KyokaiKenpo' : NATIONAL_HEALTH_INSURANCE_ID;
    newState.region = defaultRegionForProvider(newState.healthInsuranceProvider);
    // Sync streams to strictly match the simple mode
    newState.incomeStreams = simpleModeStreams(action.mode, state.annualIncome);
  } else {
    // Entering advanced mode: restore the saved advanced streams if they still total the
    // current annual income; otherwise keep the current simple-mode stream, which already
    // mirrors the annual income (invariant maintained by simpleModeStreams).
    const saved = state.savedIncomeStreams;
    newState.incomeStreams =
      saved && saved.length > 0 && totalAnnualIncomeFromStreams(saved) === state.annualIncome
        ? saved
        : state.incomeStreams;
  }

  return newState;
}

function reduceAnnualIncomeChanged(
  state: TakeHomeFormState,
  action: AnnualIncomeChangedAction,
): TakeHomeFormState {
  const newState = applyAnnualIncome(state, action.value);
  // In the simple modes the single income stream mirrors the annual income
  if (state.incomeMode === 'salary' || state.incomeMode === 'miscellaneous') {
    newState.incomeStreams = simpleModeStreams(state.incomeMode, action.value);
  }
  return newState;
}

function reduceIncomeStreamsChanged(
  state: TakeHomeFormState,
  action: IncomeStreamsChangedAction,
): TakeHomeFormState {
  const newState = applyAnnualIncome(state, totalAnnualIncomeFromStreams(action.streams));
  newState.incomeStreams = action.streams;
  return newState;
}

export function takeHomeFormReducer(
  state: TakeHomeFormState,
  action: FormAction,
): TakeHomeFormState {
  switch (action.type) {
    case 'setField':
      // TS can't correlate `action.field`/`action.value` across the mapped union once
      // destructured this way, even though every call site is checked individually.
      return { ...state, [action.field]: action.value } as TakeHomeFormState;

    case 'incomeModeChanged':
      return reduceIncomeModeChanged(state, action);

    case 'providerChanged':
      return {
        ...state,
        healthInsuranceProvider: action.provider,
        region: defaultRegionForProvider(action.provider),
      };

    case 'annualIncomeChanged':
      return reduceAnnualIncomeChanged(state, action);

    case 'incomeStreamsChanged':
      return reduceIncomeStreamsChanged(state, action);

    default: {
      // Exhaustiveness check: if a new FormAction variant is added without a
      // matching case above, `action` won't narrow to `never` here and this
      // line fails to compile — turning a silent no-op into a build error.
      const unhandledAction: never = action;
      throw new Error(`Unhandled form action: ${JSON.stringify(unhandledAction)}`);
    }
  }
}
