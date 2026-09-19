// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DependentIncome } from '../../types/dependents';
import { DEFAULT_PROVIDER, NATIONAL_HEALTH_INSURANCE_ID } from '../../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS, type TakeHomeInputs } from '../../types/tax';
import { scaleIncomeStreamsToIncome } from '../../utils/chartConfig';
import { calculateTaxes } from '../../utils/taxCalculations';
import type { EngineScenarioName } from './engineScenarioNames';

const NO_INCOME: DependentIncome = {
  grossEmploymentIncome: 0,
  grossPublicPensionIncome: 0,
  otherNetIncome: 0,
};

const EMPLOYEE: TakeHomeInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [{ id: 'salary', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
  ageRange: 'age20to39',
  region: 'Tokyo',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
};

/**
 * The workloads of the engine benchmark (calculateTaxes.bench.ts), which `npm run profile` also
 * runs. One iteration of a scenario runs {@link calculateTaxes} once per listed input; the chart
 * sweep lists the 11 incomes the chart calculates per input change.
 */
export const ENGINE_SCENARIOS = {
  employee: [EMPLOYEE],
  'employee-bonuses': [
    {
      ...EMPLOYEE,
      incomeStreams: [
        ...EMPLOYEE.incomeStreams,
        { id: 'summer', type: 'bonus', amount: 500_000, month: 5 },
        { id: 'winter', type: 'bonus', amount: 500_000, month: 11 },
      ],
    },
  ],
  'employee-40-59': [{ ...EMPLOYEE, ageRange: 'age40to59' }],
  'self-employed-nhi': [
    {
      ...EMPLOYEE,
      incomeStreams: [
        { id: 'business', type: 'business', amount: 5_000_000, blueFilerDeduction: 650_000 },
      ],
      ageRange: 'age40to59',
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      dependents: [
        {
          id: 'spouse',
          relationship: 'spouse',
          ageRange: 'under65',
          income: NO_INCOME,
          disability: 'none',
          isCohabiting: true,
        },
        {
          id: 'child',
          relationship: 'child',
          ageRange: '16to18',
          income: NO_INCOME,
          disability: 'none',
          isCohabiting: true,
        },
      ],
    },
  ],
  'pensioner-65-69': [
    {
      ...EMPLOYEE,
      incomeStreams: [{ id: 'pension', type: 'publicPension', amount: 2_000_000 }],
      ageRange: 'age65to69',
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    },
  ],
  'chart-sweep': Array.from({ length: 11 }, (_, i) => ({
    ...EMPLOYEE,
    incomeStreams: scaleIncomeStreamsToIncome(EMPLOYEE.incomeStreams, i * 1_000_000),
  })),
} satisfies Record<EngineScenarioName, TakeHomeInputs[]>;

/**
 * Runs {@link calculateTaxes} on every input of a scenario and returns the summed take-home
 * income. Callers use the sum, so that the JavaScript compiler cannot remove the calls as
 * unused.
 */
export const runScenario = (inputs: readonly TakeHomeInputs[]): number => {
  let takeHome = 0;
  for (const input of inputs) takeHome += calculateTaxes(input).takeHomeIncome;
  return takeHome;
};
