// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { IncomeMode, IncomeStream, TakeHomeFormState } from '../types/tax';
import {
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
  getProviderDisplayName,
  isDependentCoverageEligible,
  type HealthInsuranceProviderId,
} from '../types/healthInsurance';
import { NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS } from '../data/nationalHealthInsurance/nhiParamsData';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';

export function selectDefaultRegion(regions: readonly string[]): string {
  return regions.includes('Tokyo')
    ? 'Tokyo'
    : regions.length > 0
      ? regions[0]!
      : DEFAULT_PROVIDER_REGION;
}

/** A selectable region for a provider: its key and the label shown in the dropdown. */
export interface RegionOption {
  id: string;
  displayName: string;
}

/**
 * The regions selectable for a given health insurance provider, in dropdown order. NHI
 * regions carry official display names; employee providers use the region key as its own
 * label. Dependent coverage and the custom provider are region-less by design (empty list),
 * as is an unrecognized id. Pure and colocated with the reducer so the same list drives both
 * the region dropdown (via a `useMemo` in InputForm) and the reducer's region defaulting
 * ({@link defaultRegionForProvider}) and validation ({@link reduceRegionChanged}), rather
 * than the two drifting apart.
 */
export function regionOptionsFor(provider: HealthInsuranceProviderId): RegionOption[] {
  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    return NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS;
  }
  if (provider === DEPENDENT_COVERAGE_ID || provider === CUSTOM_PROVIDER_ID) {
    return [];
  }
  // `provider` has narrowed to an employee-provider id (the region-less ids returned above),
  // so it is a known key of PROVIDER_DEFINITIONS.
  return Object.keys(PROVIDER_DEFINITIONS[provider].regions).map(regionKey => ({
    id: regionKey,
    displayName: regionKey,
  }));
}

/**
 * The region a provider defaults to when it becomes selected (on an explicit provider change,
 * or as a side effect of an income-mode change that forces a provider): Tokyo if offered, else
 * the first listed region. Region-less providers (dependent coverage, custom) have no options,
 * so {@link selectDefaultRegion} returns the {@link DEFAULT_PROVIDER_REGION} sentinel.
 */
function defaultRegionForProvider(provider: HealthInsuranceProviderId): string {
  return selectDefaultRegion(regionOptionsFor(provider).map(option => option.id));
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

/** A selectable health insurance provider: its id and the label shown in the dropdown. */
export interface HealthInsuranceProviderOption {
  id: HealthInsuranceProviderId;
  displayName: string;
}

const nhiProviderOption: HealthInsuranceProviderOption = {
  id: NATIONAL_HEALTH_INSURANCE_ID,
  displayName: getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID),
};

const dependentProviderOption: HealthInsuranceProviderOption = {
  id: DEPENDENT_COVERAGE_ID,
  displayName: getProviderDisplayName(DEPENDENT_COVERAGE_ID),
};

const customProviderOption: HealthInsuranceProviderOption = {
  id: CUSTOM_PROVIDER_ID,
  displayName: getProviderDisplayName(CUSTOM_PROVIDER_ID),
};

const employeeProviderOptions: HealthInsuranceProviderOption[] = (
  Object.keys(PROVIDER_DEFINITIONS) as (keyof typeof PROVIDER_DEFINITIONS)[]
).map(id => ({ id, displayName: getProviderDisplayName(id) }));

/**
 * The health insurance providers selectable for a given form state, in dropdown order.
 * Employment income can use an employee provider, National Health Insurance, or a custom
 * provider; dependent coverage ("None") is offered only while income is under the
 * eligibility threshold; non-employment income is limited to NHI (plus dependent coverage
 * when eligible). Pure and colocated with the reducer so the same list drives both the
 * dropdown (via a `useMemo` in InputForm) and the reducer's provider-validity cascade
 * ({@link applyProviderValidity}), rather than the two drifting apart.
 */
export function availableProvidersFor(
  state: Pick<TakeHomeFormState, 'incomeMode' | 'incomeStreams' | 'annualIncome'>,
): HealthInsuranceProviderOption[] {
  const dependentEligible = isDependentCoverageEligible(state.annualIncome);
  if (hasEmploymentIncome(state)) {
    return dependentEligible
      ? [
          ...employeeProviderOptions,
          dependentProviderOption,
          nhiProviderOption,
          customProviderOption,
        ]
      : [...employeeProviderOptions, nhiProviderOption, customProviderOption];
  }
  return dependentEligible ? [dependentProviderOption, nhiProviderOption] : [nhiProviderOption];
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
 * update the provider but skip the region reset that `providerChanged` performs, and a bare
 * `region` write would skip the validity check `regionChanged` performs against the current
 * provider's options. `incomeStreams` and `savedIncomeStreams` are kept in sync with
 * `annualIncome` and `incomeMode` by their semantic actions, so a bare overwrite would break
 * that invariant.
 */
type CascadeManagedField = AssertFormFields<
  | 'annualIncome'
  | 'incomeMode'
  | 'healthInsuranceProvider'
  | 'region'
  | 'incomeStreams'
  | 'savedIncomeStreams'
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
 * Region changed: validates the chosen region against the current provider's options
 * ({@link regionOptionsFor}) and clamps to the provider's default if it isn't one, so a
 * region that doesn't belong to the selected provider can never be stored.
 */
interface RegionChangedAction {
  type: 'regionChanged';
  region: TakeHomeFormState['region'];
}

/**
 * Annual income changed: in the simple (non-advanced) modes, syncs the single income stream
 * to the new amount and re-checks the provider-validity invariant — which, for an income
 * change, means switching dependent coverage to National Health Insurance once the income
 * exceeds the eligibility threshold.
 */
interface AnnualIncomeChangedAction {
  type: 'annualIncomeChanged';
  value: TakeHomeFormState['annualIncome'];
}

/**
 * Income streams changed (advanced mode): recomputes the total annual income from the
 * streams, then reconciles the provider-validity invariant the same way
 * {@link AnnualIncomeChangedAction} does — e.g. removing the last employment stream switches
 * an employee provider to National Health Insurance.
 */
interface IncomeStreamsChangedAction {
  type: 'incomeStreamsChanged';
  streams: IncomeStream[];
}

export type FormAction =
  | SetFieldAction
  | IncomeModeChangedAction
  | ProviderChangedAction
  | RegionChangedAction
  | AnnualIncomeChangedAction
  | IncomeStreamsChangedAction;

/**
 * Enforces the invariant that `healthInsuranceProvider` is one of the providers
 * {@link availableProvidersFor} offers for the current state. When it isn't — e.g. the last
 * employment stream was removed while an employee/custom provider was selected, or dependent
 * coverage is selected once income crosses the threshold — falls back to National Health
 * Insurance if available, otherwise the first offered provider, and resets the region to that
 * provider's default (as `providerChanged` does). Every income/stream/mode change routes
 * through this one check against the same selector the dropdown renders, so the selected value
 * and the offered options can't disagree; it replaces a correcting effect that used to run a
 * render later in InputForm. `availableProvidersFor` always includes NHI, so a fallback always
 * exists; the empty-list guard only satisfies the type of `available[0]`.
 */
function applyProviderValidity(state: TakeHomeFormState): TakeHomeFormState {
  const available = availableProvidersFor(state);
  if (available.some(option => option.id === state.healthInsuranceProvider)) {
    return state;
  }
  const fallback =
    available.find(option => option.id === NATIONAL_HEALTH_INSURANCE_ID) ?? available[0];
  if (!fallback) {
    return state;
  }
  return {
    ...state,
    healthInsuranceProvider: fallback.id,
    region: defaultRegionForProvider(fallback.id),
  };
}

/**
 * Normalizes a freshly-constructed form state (App's hardcoded defaults, or any state
 * restored from elsewhere) so it satisfies invariants before the first
 * render, then hands it to the reducer which maintains those invariants from there. Passed as
 * the `init` argument to `useReducer`. Centralizing mount-time normalization here gives any
 * future invariant a single entry point instead of a re-introduced mount effect.
 */
export function normalizeInitialFormState(state: TakeHomeFormState): TakeHomeFormState {
  return applyProviderValidity(state);
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

  switch (action.mode) {
    case 'salary':
    case 'miscellaneous':
      newState.healthInsuranceProvider =
        action.mode === 'salary' ? 'KyokaiKenpo' : NATIONAL_HEALTH_INSURANCE_ID;
      newState.region = defaultRegionForProvider(newState.healthInsuranceProvider);
      newState.incomeStreams = simpleModeStreams(action.mode, state.annualIncome);
      break;
    case 'advanced': {
      // Entering advanced mode: restore the saved advanced streams if they still total the
      // current annual income; otherwise keep the current simple-mode stream.
      const saved = state.savedIncomeStreams;
      newState.incomeStreams =
        saved.length > 0 && totalAnnualIncomeFromStreams(saved) === state.annualIncome
          ? saved
          : state.incomeStreams;
      break;
    }
    default: {
      // Exhaustiveness: a new IncomeMode must add its own routing branch here rather than
      // silently inheriting the advanced-mode behavior (the real first-fail point a bare
      // if/else would hide).
      const unhandledMode: never = action.mode;
      throw new Error(`Unhandled income mode: ${JSON.stringify(unhandledMode)}`);
    }
  }

  // Salary/miscellaneous force a valid provider above; but entering advanced mode carries
  // the provider over, and restored/kept streams may lack employment income — reconcile it.
  return applyProviderValidity(newState);
}

function reduceAnnualIncomeChanged(
  state: TakeHomeFormState,
  action: AnnualIncomeChangedAction,
): TakeHomeFormState {
  // In advanced mode annualIncome is derived from the streams (via incomeStreamsChanged),
  // so a direct annualIncome change doesn't apply — ignore it rather than desync the two.
  // (The UI never dispatches this in advanced mode; this only guards against misuse.)
  if (state.incomeMode === 'advanced') {
    return state;
  }
  const newState = { ...state, annualIncome: action.value };
  // In the simple modes the single income stream mirrors the annual income
  newState.incomeStreams = simpleModeStreams(state.incomeMode, action.value);
  // Reconcile the provider through the same selector the dropdown uses. In the simple modes
  // this only ever fires for dependent coverage crossing the income threshold, but routing it
  // through applyProviderValidity keeps every path on one definition of "valid provider".
  return applyProviderValidity(newState);
}

function reduceRegionChanged(
  state: TakeHomeFormState,
  action: RegionChangedAction,
): TakeHomeFormState {
  const isValid = regionOptionsFor(state.healthInsuranceProvider).some(
    option => option.id === action.region,
  );
  return {
    ...state,
    region: isValid ? action.region : defaultRegionForProvider(state.healthInsuranceProvider),
  };
}

function reduceIncomeStreamsChanged(
  state: TakeHomeFormState,
  action: IncomeStreamsChangedAction,
): TakeHomeFormState {
  const newState = { ...state, annualIncome: totalAnnualIncomeFromStreams(action.streams) };
  newState.incomeStreams = action.streams;
  // Removing the last employment stream (or dependent coverage crossing the income threshold)
  // can strand a provider that is no longer offered; correct it here so the returned state is
  // already valid.
  return applyProviderValidity(newState);
}

export function takeHomeFormReducer(
  state: TakeHomeFormState,
  action: FormAction,
): TakeHomeFormState {
  switch (action.type) {
    case 'setField':
      // TS can't correlate `action.field`/`action.value` across the mapped union once
      // destructured this way, even though every call site is checked individually.
      return { ...state, [action.field]: action.value };

    case 'incomeModeChanged':
      return reduceIncomeModeChanged(state, action);

    case 'providerChanged':
      return {
        ...state,
        healthInsuranceProvider: action.provider,
        region: defaultRegionForProvider(action.provider),
      };

    case 'regionChanged':
      return reduceRegionChanged(state, action);

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
