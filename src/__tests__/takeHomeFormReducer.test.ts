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
import { takeHomeFormReducer } from '../state/takeHomeFormReducer';

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
  });

  describe('incomeModeChanged', () => {
    it('resets to KyokaiKenpo and its default region when switching to salary mode', () => {
      const state: TakeHomeFormState = {
        ...baseState,
        incomeMode: 'miscellaneous',
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
        region: NATIONAL_HEALTH_INSURANCE_REGIONS[0]!,
      };

      const result = takeHomeFormReducer(state, { type: 'incomeModeChanged', mode: 'salary' });

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
  });
});
