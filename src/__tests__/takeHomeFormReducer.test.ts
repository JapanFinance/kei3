// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TakeHomeFormState } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, DEFAULT_INCOME_YEAR } from '../types/tax';
import {
  DEFAULT_PROVIDER,
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  DEPENDENT_INCOME_THRESHOLD,
} from '../types/healthInsurance';
import { NATIONAL_HEALTH_INSURANCE_REGIONS } from '../data/nationalHealthInsurance/nhiParamsData';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';
import { takeHomeFormReducer, totalAnnualIncomeFromStreams } from '../state/takeHomeFormReducer';

const baseState: TakeHomeFormState = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  annualIncome: 5_000_000,
  incomeYear: DEFAULT_INCOME_YEAR,
  incomeMode: 'salary',
  incomeStreams: [{ id: 'default-salary', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
  isSubjectToLongTermCarePremium: false,
  region: 'Tokyo',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
};

describe('takeHomeFormReducer', () => {
  describe('setField', () => {
    it('updates the named field and leaves everything else untouched', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'setField',
        field: 'dcPlanContributions',
        value: 23_000,
      });

      expect(result.dcPlanContributions).toBe(23_000);
      expect(result).toEqual({ ...baseState, dcPlanContributions: 23_000 });
    });

    it('does not cascade into other fields (e.g. changing region directly)', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'setField',
        field: 'region',
        value: 'Osaka',
      });

      expect(result.region).toBe('Osaka');
      expect(result.healthInsuranceProvider).toBe(baseState.healthInsuranceProvider);
    });

    it('is a type error to setField a cascade-managed field, forcing the semantic action instead', () => {
      // This test is a compile-time check: the assertions below just confirm the calls were
      // reached, since the point is that each @ts-expect-error above them is required to compile.
      // @ts-expect-error 'incomeMode' has its own cascade (incomeModeChanged) and is
      // excluded from SetFieldAction so this bypass can't compile.
      takeHomeFormReducer(baseState, { type: 'setField', field: 'incomeMode', value: 'salary' });
      // @ts-expect-error 'healthInsuranceProvider' has its own cascade (providerChanged).
      // prettier-ignore
      takeHomeFormReducer(baseState, { type: 'setField', field: 'healthInsuranceProvider', value: 'KyokaiKenpo' });
      // @ts-expect-error 'annualIncome' has its own cascade (annualIncomeChanged).
      takeHomeFormReducer(baseState, { type: 'setField', field: 'annualIncome', value: 1 });
      // @ts-expect-error 'incomeStreams' has its own cascade (incomeStreamsChanged).
      takeHomeFormReducer(baseState, { type: 'setField', field: 'incomeStreams', value: [] });
      // @ts-expect-error 'savedIncomeStreams' is managed by incomeModeChanged.
      takeHomeFormReducer(baseState, { type: 'setField', field: 'savedIncomeStreams', value: [] });

      expect(true).toBe(true);
    });
  });

  describe('incomeModeChanged', () => {
    it('resets to KyokaiKenpo and its default region when switching to salary mode', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'miscellaneous',
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
        region: NATIONAL_HEALTH_INSURANCE_REGIONS[0]!,
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'salary',
      });

      expect(result.incomeMode).toBe('salary');
      expect(result.healthInsuranceProvider).toBe('KyokaiKenpo');
      const kyokaiRegions = Object.keys(PROVIDER_DEFINITIONS['KyokaiKenpo']!.regions);
      expect(kyokaiRegions).toContain(result.region);
      expect(result.region).toBe('Tokyo');
    });

    it('resets to National Health Insurance and its default region when switching to miscellaneous mode', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'incomeModeChanged',
        mode: 'miscellaneous',
      });

      expect(result.incomeMode).toBe('miscellaneous');
      expect(result.healthInsuranceProvider).toBe(NATIONAL_HEALTH_INSURANCE_ID);
      expect(NATIONAL_HEALTH_INSURANCE_REGIONS).toContain(result.region);
    });

    it('leaves health insurance provider and region untouched when switching to advanced mode', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      expect(result.incomeMode).toBe('advanced');
      expect(result.healthInsuranceProvider).toBe(baseState.healthInsuranceProvider);
      expect(result.region).toBe(baseState.region);
    });

    it('syncs the streams to a single annual salary stream when switching to salary mode', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'miscellaneous',
        incomeStreams: [{ id: 'simple-miscellaneous', type: 'miscellaneous', amount: 5_000_000 }],
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'salary',
      });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-salary', type: 'salary', amount: 5_000_000, frequency: 'annual' },
      ]);
    });

    it('syncs the streams to a single miscellaneous stream when switching to miscellaneous mode', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'incomeModeChanged',
        mode: 'miscellaneous',
      });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-miscellaneous', type: 'miscellaneous', amount: 5_000_000 },
      ]);
    });

    it('saves the current streams when leaving advanced mode', () => {
      const advancedStreams: TakeHomeFormState['incomeStreams'] = [
        { id: 's1', type: 'salary', amount: 4_000_000, frequency: 'annual' },
        { id: 'b1', type: 'bonus', amount: 1_000_000, month: 5 },
      ];
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'advanced',
        incomeStreams: advancedStreams,
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'salary',
      });

      expect(result.savedIncomeStreams).toEqual(advancedStreams);
      expect(result.incomeStreams).toEqual([
        { id: 'simple-salary', type: 'salary', amount: 5_000_000, frequency: 'annual' },
      ]);
    });

    it('restores the saved streams when entering advanced mode and their total still matches', () => {
      const savedStreams: TakeHomeFormState['incomeStreams'] = [
        { id: 's1', type: 'salary', amount: 4_000_000, frequency: 'annual' },
        { id: 'b1', type: 'bonus', amount: 1_000_000, month: 5 },
      ];
      const state: TakeHomeFormState = { ...baseState, savedIncomeStreams: savedStreams };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      expect(result.incomeStreams).toEqual(savedStreams);
    });

    it('matches saved-stream totals with monthly salaries annualized and commuting allowance excluded', () => {
      const savedStreams: TakeHomeFormState['incomeStreams'] = [
        { id: 's1', type: 'salary', amount: 400_000, frequency: 'monthly' },
        { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
        { id: 'b1', type: 'bonus', amount: 200_000, month: 11 },
      ];
      const state: TakeHomeFormState = { ...baseState, savedIncomeStreams: savedStreams };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      // 400,000 × 12 + 200,000 = 5,000,000; the commuting allowance does not count
      expect(result.incomeStreams).toEqual(savedStreams);
    });

    it('keeps the current salary stream when entering advanced mode from salary with a stale saved total', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        annualIncome: 6_000_000,
        // Simple-mode invariant: the stream mirrors the annual income
        incomeStreams: [
          { id: 'simple-salary', type: 'salary', amount: 6_000_000, frequency: 'annual' },
        ],
        savedIncomeStreams: [{ id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-salary', type: 'salary', frequency: 'annual', amount: 6_000_000 },
      ]);
    });

    it('keeps the current miscellaneous stream when entering advanced mode from miscellaneous with a stale saved total', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'miscellaneous',
        annualIncome: 6_000_000,
        incomeStreams: [{ id: 'simple-miscellaneous', type: 'miscellaneous', amount: 6_000_000 }],
        savedIncomeStreams: [{ id: 's1', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-miscellaneous', type: 'miscellaneous', amount: 6_000_000 },
      ]);
    });

    it('falls back to the current streams when entering advanced mode with nothing saved', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'incomeModeChanged',
        mode: 'advanced',
      });

      expect(result.incomeStreams).toEqual(baseState.incomeStreams);
    });
  });

  describe('providerChanged', () => {
    it('defaults to Tokyo (or the first available region) for an employee provider', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'providerChanged',
        provider: 'KantoItsKenpo',
      });

      expect(result.healthInsuranceProvider).toBe('KantoItsKenpo');
      const regions = Object.keys(PROVIDER_DEFINITIONS['KantoItsKenpo']!.regions);
      expect(regions).toContain(result.region);
    });

    it('defaults to a National Health Insurance region when switching to NHI', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'providerChanged',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
      });

      expect(result.healthInsuranceProvider).toBe(NATIONAL_HEALTH_INSURANCE_ID);
      expect(NATIONAL_HEALTH_INSURANCE_REGIONS).toContain(result.region);
    });

    it('clears the region to the sentinel default when switching to dependent coverage', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'providerChanged',
        provider: DEPENDENT_COVERAGE_ID,
      });

      expect(result.healthInsuranceProvider).toBe(DEPENDENT_COVERAGE_ID);
      expect(result.region).toBe(DEFAULT_PROVIDER_REGION);
    });

    it('warns and defaults the region when the provider id is not found in provider data', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = takeHomeFormReducer(baseState, {
        type: 'providerChanged',
        provider: 'CustomProvider',
      });

      expect(result.healthInsuranceProvider).toBe('CustomProvider');
      expect(result.region).toBe(DEFAULT_PROVIDER_REGION);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CustomProvider'));

      warnSpy.mockRestore();
    });
  });

  describe('annualIncomeChanged', () => {
    it('auto-switches from dependent coverage to NHI when income crosses the eligibility threshold', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
        region: DEFAULT_PROVIDER_REGION,
        annualIncome: 1_000_000,
      };

      const result = takeHomeFormReducer(state, {
        type: 'annualIncomeChanged',
        value: DEPENDENT_INCOME_THRESHOLD,
      });

      expect(result.annualIncome).toBe(DEPENDENT_INCOME_THRESHOLD);
      expect(result.healthInsuranceProvider).toBe(NATIONAL_HEALTH_INSURANCE_ID);
      expect(NATIONAL_HEALTH_INSURANCE_REGIONS).toContain(result.region);
    });

    it('keeps dependent coverage selected when the new income is still under the threshold', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
        region: DEFAULT_PROVIDER_REGION,
        annualIncome: 1_000_000,
      };

      const result = takeHomeFormReducer(state, {
        type: 'annualIncomeChanged',
        value: DEPENDENT_INCOME_THRESHOLD - 1,
      });

      expect(result.annualIncome).toBe(DEPENDENT_INCOME_THRESHOLD - 1);
      expect(result.healthInsuranceProvider).toBe(DEPENDENT_COVERAGE_ID);
      expect(result.region).toBe(DEFAULT_PROVIDER_REGION);
    });

    it('does not touch the provider when a non-dependent-coverage provider is selected', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'annualIncomeChanged',
        value: 20_000_000,
      });

      expect(result.annualIncome).toBe(20_000_000);
      expect(result.healthInsuranceProvider).toBe(baseState.healthInsuranceProvider);
      expect(result.region).toBe(baseState.region);
    });

    it('syncs the single stream to the new amount in salary mode', () => {
      const result = takeHomeFormReducer(baseState, {
        type: 'annualIncomeChanged',
        value: 6_000_000,
      });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-salary', type: 'salary', amount: 6_000_000, frequency: 'annual' },
      ]);
    });

    it('syncs the single stream to the new amount in miscellaneous mode', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'miscellaneous',
        incomeStreams: [{ id: 'simple-miscellaneous', type: 'miscellaneous', amount: 5_000_000 }],
      };

      const result = takeHomeFormReducer(state, { type: 'annualIncomeChanged', value: 6_000_000 });

      expect(result.incomeStreams).toEqual([
        { id: 'simple-miscellaneous', type: 'miscellaneous', amount: 6_000_000 },
      ]);
    });

    it('leaves the streams untouched in advanced mode', () => {
      const advancedStreams: TakeHomeFormState['incomeStreams'] = [
        { id: 's1', type: 'salary', amount: 4_000_000, frequency: 'annual' },
        { id: 'b1', type: 'bonus', amount: 1_000_000, month: 5 },
      ];
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'advanced',
        incomeStreams: advancedStreams,
      };

      const result = takeHomeFormReducer(state, { type: 'annualIncomeChanged', value: 6_000_000 });

      expect(result.annualIncome).toBe(6_000_000);
      expect(result.incomeStreams).toEqual(advancedStreams);
    });
  });

  describe('incomeStreamsChanged', () => {
    it('sets the streams and recomputes the annual income (monthly salary annualized, commuting allowance excluded)', () => {
      const streams: TakeHomeFormState['incomeStreams'] = [
        { id: 's1', type: 'salary', amount: 300_000, frequency: 'monthly' },
        { id: 'c1', type: 'commutingAllowance', amount: 15_000, frequency: 'monthly' },
        { id: 'b1', type: 'bonus', amount: 1_200_000, month: 11 },
      ];
      const state: TakeHomeFormState = { ...baseState, incomeMode: 'advanced' };

      const result = takeHomeFormReducer(state, { type: 'incomeStreamsChanged', streams });

      expect(result.incomeStreams).toEqual(streams);
      expect(result.annualIncome).toBe(300_000 * 12 + 1_200_000);
    });

    it('auto-switches from dependent coverage to NHI when the new stream total crosses the eligibility threshold', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'advanced',
        healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
        region: DEFAULT_PROVIDER_REGION,
        annualIncome: 1_000_000,
        incomeStreams: [{ id: 'm1', type: 'miscellaneous', amount: 1_000_000 }],
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeStreamsChanged',
        streams: [{ id: 'm1', type: 'miscellaneous', amount: DEPENDENT_INCOME_THRESHOLD }],
      });

      expect(result.annualIncome).toBe(DEPENDENT_INCOME_THRESHOLD);
      expect(result.healthInsuranceProvider).toBe(NATIONAL_HEALTH_INSURANCE_ID);
      expect(NATIONAL_HEALTH_INSURANCE_REGIONS).toContain(result.region);
    });

    it('keeps dependent coverage when the new stream total stays under the threshold', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'advanced',
        healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
        region: DEFAULT_PROVIDER_REGION,
        annualIncome: 1_000_000,
        incomeStreams: [{ id: 'm1', type: 'miscellaneous', amount: 1_000_000 }],
      };

      const result = takeHomeFormReducer(state, {
        type: 'incomeStreamsChanged',
        streams: [{ id: 'm1', type: 'miscellaneous', amount: DEPENDENT_INCOME_THRESHOLD - 1 }],
      });

      expect(result.annualIncome).toBe(DEPENDENT_INCOME_THRESHOLD - 1);
      expect(result.healthInsuranceProvider).toBe(DEPENDENT_COVERAGE_ID);
      expect(result.region).toBe(DEFAULT_PROVIDER_REGION);
    });
  });

  describe('totalAnnualIncomeFromStreams', () => {
    it('annualizes monthly salaries, excludes commuting allowance, and sums everything else', () => {
      expect(
        totalAnnualIncomeFromStreams([
          { id: 's1', type: 'salary', amount: 300_000, frequency: 'monthly' },
          { id: 's2', type: 'salary', amount: 1_000_000, frequency: 'annual' },
          { id: 'c1', type: 'commutingAllowance', amount: 10_000, frequency: 'monthly' },
          { id: 'b1', type: 'bonus', amount: 500_000, month: 5 },
          { id: 'm1', type: 'miscellaneous', amount: 200_000 },
        ]),
      ).toBe(300_000 * 12 + 1_000_000 + 500_000 + 200_000);
    });

    it('returns 0 for an empty stream list', () => {
      expect(totalAnnualIncomeFromStreams([])).toBe(0);
    });
  });
});
