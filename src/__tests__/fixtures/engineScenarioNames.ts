// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The names of the engine benchmark's scenarios, in the order `npm run bench` runs them. They are
 * kept apart from the inputs in engineScenarios.ts so that vitest.bench.config.ts can create a
 * project per scenario without loading the engine.
 */
export const ENGINE_SCENARIO_NAMES = [
  'employee',
  'employee-bonuses',
  'employee-40-59',
  'self-employed-nhi',
  'pensioner-65-69',
  'chart-sweep',
] as const;

export type EngineScenarioName = (typeof ENGINE_SCENARIO_NAMES)[number];

declare module 'vitest' {
  export interface ProvidedContext {
    /** The scenario that calculateTaxes.bench.ts runs in the current project. */
    scenario: EngineScenarioName;
  }
}
